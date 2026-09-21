import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const E2E_BYPASS = import.meta.env.VITE_E2E_BYPASS_AUTH === '1';
const OWNER_KEY = 'ontrack-cloud-owner-v2';
const LEGACY_OWNER_KEY = 'ontrack-cloud-owner-v1';
const UNCLAIMED_CACHE_KEY = 'ontrack-unclaimed-cache-v1';
const CONFLICT_KEY_PREFIX = 'ontrack-sync-conflict-v1';
const DELETED_VALUE = { __ontrack_deleted: true } as const;

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

document.documentElement.dataset.cloudStateKeys = CLOUD_STATE_KEYS.join(',');

let session: Session | null = null;
let channel: RealtimeChannel | null = null;
let snapshot: Snapshot = new Map();
let revisions = new Map<CloudStateKey, number>();
let initialisedUser = '';
let pushing = false;
let pulling = false;
let pushTimer = 0;
let pullTimer = 0;
let suppressUntil = 0;
let allowLegacySeed = false;

function isCloudKey(key: string): key is CloudStateKey {
  return (CLOUD_STATE_KEYS as readonly string[]).includes(key);
}

function isDeletedValue(value: unknown) {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value as Record<string, unknown>).__ontrack_deleted === true,
  );
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

function localCacheOwner() {
  return localStorage.getItem(OWNER_KEY) || localStorage.getItem(LEGACY_OWNER_KEY) || '';
}

function clearCloudCache() {
  for (const key of CLOUD_STATE_KEYS) localStorage.removeItem(key);
}

function quarantineUnownedCache() {
  const state = Object.fromEntries(
    CLOUD_STATE_KEYS.flatMap(key => {
      const raw = localStorage.getItem(key);
      return raw === null ? [] : [[key, raw]];
    }),
  );
  if (!Object.keys(state).length) return false;
  localStorage.setItem(UNCLAIMED_CACHE_KEY, JSON.stringify({
    capturedAt: new Date().toISOString(),
    state,
  }));
  clearCloudCache();
  document.documentElement.dataset.cloudCacheQuarantined = 'true';
  return true;
}

function prepareCacheForUser(userId: string) {
  const owner = localCacheOwner();
  allowLegacySeed = owner === userId;

  if (owner && owner !== userId) {
    clearCloudCache();
    document.documentElement.dataset.cloudCacheReset = 'account-switch';
  } else if (!owner) {
    // State without an owner cannot safely be attributed to the account that happens
    // to sign in next. Preserve it locally for manual recovery, but never upload it.
    quarantineUnownedCache();
    allowLegacySeed = false;
  }

  localStorage.setItem(OWNER_KEY, userId);
  document.documentElement.dataset.cloudCacheOwner = userId;
}

function conflictKey(userId: string, key: CloudStateKey) {
  return `${CONFLICT_KEY_PREFIX}:${userId}:${key}`;
}

function preserveConflict(userId: string, key: CloudStateKey, raw: string | null) {
  localStorage.setItem(conflictKey(userId, key), JSON.stringify({
    capturedAt: new Date().toISOString(),
    stateKey: key,
    raw,
  }));
  document.documentElement.dataset.cloudSyncConflict = key;
}

function setSyncStatus(status: 'syncing' | 'synced' | 'offline' | 'error' | 'conflict', reason = '') {
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
  const previousRevisions = revisions;
  let changed = false;
  suppressUntil = Date.now() + 1200;

  for (const key of CLOUD_STATE_KEYS) {
    const row = remote.get(key);
    if (!row) {
      // If this device previously observed the row and it has disappeared, honour the
      // remote deletion instead of recreating it from stale local cache.
      if (previousRevisions.has(key) && localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        changed = true;
      }
      continue;
    }

    if (isDeletedValue(row.value)) {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        changed = true;
      }
      continue;
    }

    const next = encodeCloud(row.value);
    if (localStorage.getItem(key) !== next) {
      localStorage.setItem(key, next);
      changed = true;
    }
  }

  revisions = new Map(
    rows
      .filter(row => isCloudKey(row.state_key))
      .map(row => [row.state_key as CloudStateKey, Number(row.revision)]),
  );
  snapshot = currentSnapshot();
  setSyncStatus('synced', reason);
  if (changed) {
    window.dispatchEvent(new CustomEvent('ontrack:unified-state', { detail: { reason } }));
    location.reload();
  }
  return changed;
}

async function seedMissingRows(userId: string, remoteRows: CloudRow[]) {
  if (!allowLegacySeed) return false;
  const present = new Set(remoteRows.map(row => row.state_key));
  const rows = CLOUD_STATE_KEYS.flatMap(key => {
    if (present.has(key)) return [];
    const raw = readRaw(key);
    if (raw === null) return [];
    return [{ user_id: userId, state_key: key, value: decodeLocal(raw) }];
  });
  if (!rows.length) return false;

  const result = await supabase.from('user_state').insert(rows);
  // Another device may have created one of the rows after our read. In that case,
  // simply refetch; never overwrite it with an upsert.
  if (result.error && result.error.code !== '23505') throw result.error;
  return true;
}

async function writeRevisionChecked(
  userId: string,
  key: CloudStateKey,
  value: unknown,
  expectedRevision: number | undefined,
) {
  if (expectedRevision === undefined) {
    const inserted = await supabase
      .from('user_state')
      .insert({ user_id: userId, state_key: key, value })
      .select('revision')
      .maybeSingle();

    if (inserted.error?.code === '23505') return false;
    if (inserted.error) throw inserted.error;
    if (!inserted.data) return false;
    revisions.set(key, Number(inserted.data.revision));
    return true;
  }

  const updated = await supabase
    .from('user_state')
    .update({ value })
    .eq('user_id', userId)
    .eq('state_key', key)
    .eq('revision', expectedRevision)
    .select('revision')
    .maybeSingle();

  if (updated.error) throw updated.error;
  if (!updated.data) return false;
  revisions.set(key, Number(updated.data.revision));
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
    if (reason === 'login' && await seedMissingRows(session.user.id, rows)) {
      rows = await fetchRows(session.user.id);
    }
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
  let conflicted = false;

  try {
    const remoteRows = await fetchRows(session.user.id);
    const remoteByKey = new Map(
      remoteRows
        .filter(row => isCloudKey(row.state_key))
        .map(row => [row.state_key as CloudStateKey, row]),
    );

    for (const item of dirty) {
      const observedRevision = revisions.get(item.key);
      const currentRemote = remoteByKey.get(item.key);
      const remoteRevision = currentRemote ? Number(currentRemote.revision) : undefined;

      // If cloud changed since our last pull, do not silently overwrite the newer edit.
      if (observedRevision !== remoteRevision) {
        preserveConflict(session.user.id, item.key, item.current);
        conflicted = true;
        break;
      }

      const value = item.current === null ? DELETED_VALUE : decodeLocal(item.current);
      const written = await writeRevisionChecked(
        session.user.id,
        item.key,
        value,
        observedRevision,
      );

      if (!written) {
        preserveConflict(session.user.id, item.key, item.current);
        conflicted = true;
        break;
      }

      snapshot.set(item.key, item.current);
    }

    if (conflicted) {
      setSyncStatus('conflict', reason);
    } else {
      delete document.documentElement.dataset.cloudSyncConflict;
      setSyncStatus('synced', reason);
    }
  } catch (error) {
    setSyncStatus('error', reason);
    console.error('ONTRACK unified cloud push failed', error);
  } finally {
    pushing = false;
  }

  if (conflicted) queuePull('conflict');
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
  prepareCacheForUser(next.user.id);
  snapshot = currentSnapshot();
  revisions = new Map();
  subscribe(next.user.id);
  await pull('login');
}

function resetSession() {
  initialisedUser = '';
  session = null;
  snapshot = new Map();
  revisions = new Map();
  allowLegacySeed = false;
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
