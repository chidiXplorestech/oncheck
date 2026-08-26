import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const E2E_BYPASS = import.meta.env.VITE_E2E_BYPASS_AUTH === '1';

/**
 * Every meaningful browser-persisted user state key belongs here.
 * Anything not listed here is intentionally device/session/cache state.
 */
export const CLOUD_STATE_KEYS = [
  'oncheck-state-v1',
  'oncheck-account-v2',
  'oncheck-daily-focus-v2',
  'oncheck-weekly-review-v2',
  'oncheck-training-space-v1',
  'oncheck-cover-map-v2',
  'oncheck-calendar-v2',
  'oncheck-strategy-start-v1',
] as const;

type CloudStateKey = typeof CLOUD_STATE_KEYS[number];
type CloudRow = {
  state_key: string;
  value: unknown;
  revision: number;
  updated_at: string;
};

type Snapshot = Map<CloudStateKey, string | null>;

let session: Session | null = null;
let channel: RealtimeChannel | null = null;
let snapshot: Snapshot = new Map();
let initialisedUser = '';
let pushing = false;
let pulling = false;
let pushTimer = 0;
let pullTimer = 0;
let suppressUntil = 0;

function isCloudKey(key: string): key is CloudStateKey {
  return (CLOUD_STATE_KEYS as readonly string[]).includes(key);
}

function readRaw(key: CloudStateKey) {
  return localStorage.getItem(key);
}

function decodeLocal(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function encodeCloud(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function currentSnapshot(): Snapshot {
  return new Map(CLOUD_STATE_KEYS.map(key => [key, readRaw(key)]));
}

function setSyncStatus(status: 'syncing' | 'synced' | 'offline' | 'error', reason = '') {
  document.documentElement.dataset.cloudSync = status;
  document.documentElement.dataset.cloudSyncMode = 'unified';
  if (reason) document.documentElement.dataset.cloudSyncReason = reason;
}

async function fetchRows(userId: string): Promise<CloudRow[]> {
  const result = await supabase
    .from('user_state')
    .select('state_key,value,revision,updated_at')
    .eq('user_id', userId)
    .in('state_key', [...CLOUD_STATE_KEYS]);
  if (result.error) throw result.error;
  return (result.data ?? []) as CloudRow[];
}

function applyRows(rows: CloudRow[], reason: string) {
  const remote = new Map(rows.filter(row => isCloudKey(row.state_key)).map(row => [row.state_key as CloudStateKey, row]));
  let changed = false;
  suppressUntil = Date.now() + 1200;

  for (const key of CLOUD_STATE_KEYS) {
    const row = remote.get(key);
    if (!row) continue;
    const next = encodeCloud(row.value);
    if (localStorage.getItem(key) !== next) {
      localStorage.setItem(key, next);
      changed = true;
    }
  }

  snapshot = currentSnapshot();
  setSyncStatus('synced', reason);
  if (changed) {
    window.dispatchEvent(new CustomEvent('ontrack:unified-state', { detail: { reason } }));
    location.reload();
  }
  return changed;
}

async function seedMissingRows(userId: string, remoteRows: CloudRow[]) {
  const present = new Set(remoteRows.map(row => row.state_key));
  const rows = CLOUD_STATE_KEYS.flatMap(key => {
    if (present.has(key)) return [];
    const raw = readRaw(key);
    if (raw === null) return [];
    return [{ user_id: userId, state_key: key, value: decodeLocal(raw) }];
  });
  if (!rows.length) return false;
  const result = await supabase.from('user_state').upsert(rows, { onConflict: 'user_id,state_key' });
  if (result.error) throw result.error;
  return true;
}

async function pull(reason = 'remote') {
  if (!session || pulling || pushing) return;
  if (!navigator.onLine) {
    setSyncStatus('offline', reason);
    return;
  }
  pulling = true;
  setSyncStatus('syncing', reason);
  try {
    let rows = await fetchRows(session.user.id);
    if (await seedMissingRows(session.user.id, rows)) rows = await fetchRows(session.user.id);
    applyRows(rows, reason);
  } catch (error) {
    setSyncStatus('error', reason);
    console.error('ONTRACK unified cloud pull failed', error);
  } finally {
    pulling = false;
  }
}

async function pushDirty(reason = 'local') {
  if (!session || pushing || pulling || Date.now() < suppressUntil) return;
  if (!navigator.onLine) {
    setSyncStatus('offline', reason);
    return;
  }

  const dirty = CLOUD_STATE_KEYS.flatMap(key => {
    const current = readRaw(key);
    const previous = snapshot.get(key) ?? null;
    if (current === previous) return [];
    return [{ key, current }];
  });
  if (!dirty.length) return;

  pushing = true;
  setSyncStatus('syncing', reason);
  try {
    const upserts = dirty
      .filter(item => item.current !== null)
      .map(item => ({
        user_id: session!.user.id,
        state_key: item.key,
        value: decodeLocal(item.current!),
      }));
    const deleted = dirty.filter(item => item.current === null).map(item => item.key);

    if (upserts.length) {
      const result = await supabase.from('user_state').upsert(upserts, { onConflict: 'user_id,state_key' });
      if (result.error) throw result.error;
    }
    if (deleted.length) {
      const result = await supabase
        .from('user_state')
        .delete()
        .eq('user_id', session.user.id)
        .in('state_key', deleted);
      if (result.error) throw result.error;
    }

    snapshot = currentSnapshot();
    setSyncStatus('synced', reason);
  } catch (error) {
    setSyncStatus('error', reason);
    console.error('ONTRACK unified cloud push failed', error);
  } finally {
    pushing = false;
  }
}

function queuePush(reason = 'local') {
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => void pushDirty(reason), 300);
}

function queuePull(reason = 'realtime') {
  window.clearTimeout(pullTimer);
  pullTimer = window.setTimeout(() => void pull(reason), 220);
}

function subscribe(userId: string) {
  if (channel) void supabase.removeChannel(channel);
  channel = supabase
    .channel(`ontrack-unified-state-${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'user_state',
      filter: `user_id=eq.${userId}`,
    }, payload => {
      const key = String((payload.new as Record<string, unknown> | null)?.state_key ?? (payload.old as Record<string, unknown> | null)?.state_key ?? '');
      if (isCloudKey(key)) queuePull(`realtime:${key}`);
    })
    .subscribe(status => {
      document.documentElement.dataset.cloudRealtime = status.toLowerCase();
    });
}

async function initialise(next: Session) {
  session = next;
  if (initialisedUser === next.user.id) return;
  initialisedUser = next.user.id;
  snapshot = currentSnapshot();
  subscribe(next.user.id);
  await pull('login');
}

function resetSession() {
  initialisedUser = '';
  session = null;
  snapshot = new Map();
  if (channel) void supabase.removeChannel(channel);
  channel = null;
}

if (!E2E_BYPASS) {
  supabase.auth.onAuthStateChange((_event, nextSession) => {
    if (!nextSession) {
      resetSession();
      return;
    }
    void initialise(nextSession);
  });

  void supabase.auth.getSession().then(({ data }) => {
    if (data.session) return initialise(data.session);
  });

  // Existing feature modules still write to localStorage. This is now an offline cache;
  // the registry observes it and mirrors all cloud-owned keys to the account.
  window.setInterval(() => queuePush('local-poll'), 700);
  window.addEventListener('storage', event => {
    if (event.key && isCloudKey(event.key)) queuePush('storage-event');
  });
  window.addEventListener('online', () => queuePull('online'));
  window.addEventListener('focus', () => queuePull('focus'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') queuePull('visible');
  });
}
