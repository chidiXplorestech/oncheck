import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const DB_NAME = 'oncheck-media-v2';
const DB_VERSION = 1;
const STORE_NAME = 'media';
const BUCKET = 'user-media';
const E2E_BYPASS = import.meta.env.VITE_E2E_BYPASS_AUTH === '1';

type StoredMedia = {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
  blob: Blob;
  goalIds: string[];
};

type RemoteMedia = {
  id: string;
  client_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | string | null;
  goal_client_ids: string[] | null;
  created_at: string;
};

let session: Session | null = null;
let channel: RealtimeChannel | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;
let syncing = false;
let timer = 0;

function indexKey(userId: string) {
  return `ontrack-media-remote-index-v2:${userId}`;
}

function readIndex(userId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(indexKey(userId)) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function writeIndex(userId: string, ids: string[]) {
  localStorage.setItem(indexKey(userId), JSON.stringify(ids));
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open ONTRACK media cache.'));
  });
  return dbPromise;
}

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error ?? new Error('ONTRACK media cache request failed.'));
  });
}

async function listLocal(): Promise<StoredMedia[]> {
  const db = await openDb();
  return request(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll() as IDBRequest<StoredMedia[]>);
}

async function putLocal(item: StoredMedia) {
  const db = await openDb();
  await request(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(item));
}

async function deleteLocal(id: string) {
  const db = await openDb();
  await request(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id));
}

async function fetchRemote(userId: string): Promise<RemoteMedia[]> {
  const result = await supabase.from('media')
    .select('id,client_id,storage_path,file_name,mime_type,size_bytes,goal_client_ids,created_at')
    .eq('user_id', userId)
    .order('created_at');
  if (result.error) throw result.error;
  return (result.data ?? []) as RemoteMedia[];
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120) || 'file';
}

async function uploadOne(userId: string, item: StoredMedia) {
  const path = `${userId}/${item.id}/${safeName(item.name)}`;
  const upload = await supabase.storage.from(BUCKET).upload(path, item.blob, {
    contentType: item.type || 'application/octet-stream',
    upsert: true,
  });
  if (upload.error) throw upload.error;

  const row = await supabase.from('media').upsert({
    user_id: userId,
    client_id: item.id,
    storage_path: path,
    file_name: item.name,
    mime_type: item.type,
    size_bytes: item.size,
    goal_client_ids: item.goalIds ?? [],
  }, { onConflict: 'user_id,client_id' });

  if (row.error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw row.error;
  }
}

async function downloadOne(item: RemoteMedia) {
  const clientId = item.client_id || item.id;
  const result = await supabase.storage.from(BUCKET).download(item.storage_path);
  if (result.error) throw result.error;
  const blob = result.data;
  await putLocal({
    id: clientId,
    name: item.file_name,
    type: item.mime_type || blob.type || 'application/octet-stream',
    size: Number(item.size_bytes ?? blob.size),
    createdAt: new Date(item.created_at).getTime() || Date.now(),
    blob,
    goalIds: item.goal_client_ids ?? [],
  });
}

async function removeRemote(item: RemoteMedia) {
  const storage = await supabase.storage.from(BUCKET).remove([item.storage_path]);
  if (storage.error) throw storage.error;
  const row = await supabase.from('media').delete().eq('id', item.id);
  if (row.error) throw row.error;
}

async function syncMedia(reason = 'periodic') {
  if (!session || syncing || !navigator.onLine) return;
  syncing = true;
  let localChanged = false;
  try {
    const userId = session.user.id;
    const [remote, local] = await Promise.all([fetchRemote(userId), listLocal()]);
    const previousRemote = new Set(readIndex(userId));
    const remoteByClient = new Map(remote.map(item => [item.client_id || item.id, item]));
    const localById = new Map(local.map(item => [item.id, item]));

    // A row that existed in the previous remote index but is now gone was deleted on another device.
    for (const id of previousRemote) {
      if (!remoteByClient.has(id) && localById.has(id)) {
        await deleteLocal(id);
        localById.delete(id);
        localChanged = true;
      }
    }

    // A remote row that is missing locally after this device has already been hydrated means a local delete.
    if (previousRemote.size) {
      for (const item of remote) {
        const id = item.client_id || item.id;
        if (previousRemote.has(id) && !localById.has(id)) {
          await removeRemote(item);
          remoteByClient.delete(id);
        }
      }
    }

    // Download files created on another device.
    for (const [id, item] of remoteByClient) {
      if (!localById.has(id)) {
        await downloadOne(item);
        localChanged = true;
      }
    }

    // Upload files created on this device.
    const refreshedRemote = await fetchRemote(userId);
    const refreshedIds = new Set(refreshedRemote.map(item => item.client_id || item.id));
    const latestLocal = await listLocal();
    for (const item of latestLocal) {
      if (!refreshedIds.has(item.id)) await uploadOne(userId, item);
    }

    const finalRemote = await fetchRemote(userId);
    writeIndex(userId, finalRemote.map(item => item.client_id || item.id));
    document.documentElement.dataset.mediaCloudSync = 'synced';
    document.documentElement.dataset.mediaCloudReason = reason;

    if (localChanged) location.reload();
  } catch (error) {
    document.documentElement.dataset.mediaCloudSync = 'error';
    console.error('ONTRACK media cloud sync failed', error);
  } finally {
    syncing = false;
  }
}

function queue(reason: string) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncMedia(reason), 350);
}

function subscribe(userId: string) {
  if (channel) void supabase.removeChannel(channel);
  channel = supabase.channel(`ontrack-media-v2-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'media', filter: `user_id=eq.${userId}` }, () => queue('realtime'))
    .subscribe(status => {
      document.documentElement.dataset.mediaRealtime = status.toLowerCase();
    });
}

async function initialise(next: Session) {
  session = next;
  subscribe(next.user.id);
  await syncMedia('login');
}

if (!E2E_BYPASS) {
  supabase.auth.onAuthStateChange((_event, nextSession) => {
    session = nextSession;
    if (!nextSession) {
      if (channel) void supabase.removeChannel(channel);
      channel = null;
      return;
    }
    void initialise(nextSession);
  });

  void supabase.auth.getSession().then(({ data }) => {
    if (data.session) return initialise(data.session);
  });

  window.setInterval(() => queue('periodic'), 2500);
  window.addEventListener('online', () => queue('online'));
  window.addEventListener('focus', () => queue('focus'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') queue('visible');
  });
}
