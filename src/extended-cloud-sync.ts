import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const ACCOUNT_KEY = 'oncheck-account-v2';
const FOCUS_KEY = 'oncheck-daily-focus-v2';
const REVIEW_KEY = 'oncheck-weekly-review-v2';
const WORKOUT_KEY = 'oncheck-training-space-v1';
const COVER_KEY = 'oncheck-cover-map-v2';
const E2E_BYPASS = import.meta.env.VITE_E2E_BYPASS_AUTH === '1';

type SyncBundle = {
  execution: Record<string, unknown>;
  focus: unknown;
  review: unknown;
  workout: unknown;
  coverMap: Record<string, string>;
  updatedAt: string;
};

type CloudSettings = Record<string, unknown> & {
  sync_v2?: SyncBundle;
};

let session: Session | null = null;
let channel: RealtimeChannel | null = null;
let cloudSettings: CloudSettings = {};
let lastLocalSignature = '';
let pushing = false;
let pulling = false;
let timer = 0;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function localBundle(): SyncBundle {
  const account = readJson<Record<string, unknown>>(ACCOUNT_KEY, {});
  return {
    execution: {
      maxDailyPriorities: account.maxDailyPriorities ?? 3,
      lowEnergyMinutes: account.lowEnergyMinutes ?? 60,
      weekStart: account.weekStart ?? 'monday',
    },
    focus: readJson<unknown>(FOCUS_KEY, null),
    review: readJson<unknown>(REVIEW_KEY, null),
    workout: readJson<unknown>(WORKOUT_KEY, null),
    coverMap: readJson<Record<string, string>>(COVER_KEY, {}),
    updatedAt: new Date().toISOString(),
  };
}

function stableBundle(bundle: SyncBundle) {
  return JSON.stringify({
    execution: bundle.execution,
    focus: bundle.focus,
    review: bundle.review,
    workout: bundle.workout,
    coverMap: bundle.coverMap,
  });
}

function localSignature() {
  return stableBundle(localBundle());
}

function applyBundle(bundle: SyncBundle) {
  const account = readJson<Record<string, unknown>>(ACCOUNT_KEY, {});
  const nextAccount = { ...account, ...bundle.execution };
  let changed = false;

  const writes: Array<[string, string]> = [
    [ACCOUNT_KEY, JSON.stringify(nextAccount)],
    [FOCUS_KEY, JSON.stringify(bundle.focus)],
    [REVIEW_KEY, JSON.stringify(bundle.review)],
    [WORKOUT_KEY, JSON.stringify(bundle.workout)],
    [COVER_KEY, JSON.stringify(bundle.coverMap ?? {})],
  ];

  for (const [key, value] of writes) {
    if (value === 'null' && !localStorage.getItem(key)) continue;
    if (localStorage.getItem(key) !== value) {
      if (value === 'null') localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      changed = true;
    }
  }

  lastLocalSignature = stableBundle(bundle);
  return changed;
}

async function fetchCloudSettings(userId: string) {
  const result = await supabase.from('user_settings').select('settings').eq('user_id', userId).maybeSingle();
  if (result.error) throw result.error;
  cloudSettings = (result.data?.settings ?? {}) as CloudSettings;
  return cloudSettings;
}

async function pushBundle() {
  if (!session || pushing || pulling || !navigator.onLine) return;
  const signature = localSignature();
  if (signature === lastLocalSignature) return;
  pushing = true;
  try {
    const current = await fetchCloudSettings(session.user.id);
    const bundle = localBundle();
    const result = await supabase.from('user_settings').upsert({
      user_id: session.user.id,
      settings: { ...current, sync_v2: bundle },
    }, { onConflict: 'user_id' });
    if (result.error) throw result.error;
    cloudSettings = { ...current, sync_v2: bundle };
    lastLocalSignature = stableBundle(bundle);
    document.documentElement.dataset.extendedSync = 'synced';
  } catch (error) {
    document.documentElement.dataset.extendedSync = 'error';
    console.error('ONTRACK extended sync push failed', error);
  } finally {
    pushing = false;
  }
}

async function pullBundle(reason = 'remote') {
  if (!session || pulling || !navigator.onLine) return;
  pulling = true;
  try {
    const settings = await fetchCloudSettings(session.user.id);
    const bundle = settings.sync_v2;
    if (!bundle) {
      lastLocalSignature = '';
      await pushBundle();
      return;
    }
    const changed = applyBundle(bundle);
    document.documentElement.dataset.extendedSync = 'synced';
    document.documentElement.dataset.extendedSyncReason = reason;
    if (changed) location.reload();
  } catch (error) {
    document.documentElement.dataset.extendedSync = 'error';
    console.error('ONTRACK extended sync pull failed', error);
  } finally {
    pulling = false;
  }
}

async function pullProfile() {
  if (!session) return;
  const result = await supabase.from('profiles').select('display_name').eq('id', session.user.id).maybeSingle();
  if (result.error || !result.data) return;
  const account = readJson<Record<string, unknown>>(ACCOUNT_KEY, {});
  const displayName = String(result.data.display_name ?? '').trim();
  if (displayName && account.name !== displayName) {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ ...account, name: displayName, email: session.user.email ?? account.email ?? '' }));
    location.reload();
  }
}

function queuePull(reason: string) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void pullBundle(reason), 220);
}

function subscribe(userId: string) {
  if (channel) void supabase.removeChannel(channel);
  channel = supabase.channel(`ontrack-extended-v2-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_settings', filter: `user_id=eq.${userId}` }, () => queuePull('realtime:settings'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, () => void pullProfile())
    .subscribe(status => {
      document.documentElement.dataset.extendedRealtime = status.toLowerCase();
    });
}

async function initialise(next: Session) {
  session = next;
  subscribe(next.user.id);
  const settings = await fetchCloudSettings(next.user.id);
  if (settings.sync_v2) {
    const changed = applyBundle(settings.sync_v2);
    if (changed) {
      location.reload();
      return;
    }
  } else {
    lastLocalSignature = '';
    await pushBundle();
  }
  lastLocalSignature = localSignature();
}

if (!E2E_BYPASS) {
  supabase.auth.onAuthStateChange((_event, nextSession) => {
    session = nextSession;
    if (!nextSession) {
      if (channel) void supabase.removeChannel(channel);
      channel = null;
      return;
    }
    void initialise(nextSession).catch(error => console.error('ONTRACK extended sync init failed', error));
  });

  void supabase.auth.getSession().then(({ data }) => {
    if (data.session) return initialise(data.session);
  });

  window.setInterval(() => void pushBundle(), 1100);
  window.addEventListener('online', () => queuePull('online'));
  window.addEventListener('focus', () => queuePull('focus'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') queuePull('visible');
  });
}
