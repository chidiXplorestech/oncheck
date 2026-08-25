import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const STATE_KEY = 'oncheck-state-v1';
const OWNER_KEY = 'ontrack-cloud-owner-v1';
const RELOAD_KEY = 'ontrack-cloud-reload-v1';

type LocalTask = { id: string; title: string; done: boolean };
type LocalGoal = {
  id: string;
  title: string;
  category: string;
  status: 'active' | 'on-hold' | 'completed';
  priority: 'low' | 'medium' | 'high';
  cadence: string;
  targetDate: string;
  notes: string;
  tasks: LocalTask[];
  cover?: string;
};
type LocalBlock = {
  id: string;
  goalId: string;
  day: number;
  start: number;
  duration: number;
  title: string;
  done: boolean;
};
type LocalState = { goals: LocalGoal[]; blocks: LocalBlock[]; media: string[] };

type RemoteGoal = {
  id: string;
  client_id: string | null;
  title: string;
  category: string;
  status: LocalGoal['status'];
  priority: LocalGoal['priority'];
  cadence: string;
  target_date: string | null;
  notes: string;
  cover_path: string | null;
};
type RemoteTask = { id: string; goal_id: string; client_id: string | null; title: string; done: boolean };
type RemoteBlock = {
  id: string;
  goal_id: string | null;
  client_id: string | null;
  title: string;
  day_index: number | null;
  start_hour: number | string | null;
  duration_hours: number | string | null;
  done: boolean;
};

let session: Session | null = null;
let lastLocal = '';
let syncing = false;
let queued = false;

function readLocal(): LocalState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalState;
    if (!Array.isArray(parsed.goals) || !Array.isArray(parsed.blocks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function localSignature() {
  return localStorage.getItem(STATE_KEY) ?? '';
}

async function fetchRemote(userId: string) {
  const [goalsResult, tasksResult, blocksResult] = await Promise.all([
    supabase.from('goals').select('id,client_id,title,category,status,priority,cadence,target_date,notes,cover_path').eq('user_id', userId).order('created_at'),
    supabase.from('tasks').select('id,goal_id,client_id,title,done').eq('user_id', userId).order('position'),
    supabase.from('calendar_entries').select('id,goal_id,client_id,title,day_index,start_hour,duration_hours,done').eq('user_id', userId).order('created_at'),
  ]);
  if (goalsResult.error) throw goalsResult.error;
  if (tasksResult.error) throw tasksResult.error;
  if (blocksResult.error) throw blocksResult.error;
  return {
    goals: (goalsResult.data ?? []) as RemoteGoal[],
    tasks: (tasksResult.data ?? []) as RemoteTask[],
    blocks: (blocksResult.data ?? []) as RemoteBlock[],
  };
}

function remoteToLocal(remote: Awaited<ReturnType<typeof fetchRemote>>, existing: LocalState | null): LocalState {
  const goalClientByUuid = new Map<string, string>();
  remote.goals.forEach(goal => goalClientByUuid.set(goal.id, goal.client_id || goal.id));

  const tasksByGoal = new Map<string, LocalTask[]>();
  remote.tasks.forEach(task => {
    const goalClient = goalClientByUuid.get(task.goal_id);
    if (!goalClient) return;
    const list = tasksByGoal.get(goalClient) ?? [];
    list.push({ id: task.client_id || task.id, title: task.title, done: task.done });
    tasksByGoal.set(goalClient, list);
  });

  const goals: LocalGoal[] = remote.goals.map(goal => {
    const clientId = goal.client_id || goal.id;
    return {
      id: clientId,
      title: goal.title,
      category: goal.category,
      status: goal.status,
      priority: goal.priority,
      cadence: goal.cadence,
      targetDate: goal.target_date ?? '',
      notes: goal.notes,
      tasks: tasksByGoal.get(clientId) ?? [],
      ...(goal.cover_path?.startsWith('data:') || goal.cover_path?.startsWith('http') ? { cover: goal.cover_path } : {}),
    };
  });

  const blocks: LocalBlock[] = remote.blocks.map(block => ({
    id: block.client_id || block.id,
    goalId: block.goal_id ? goalClientByUuid.get(block.goal_id) ?? '' : '',
    day: Number(block.day_index ?? 0),
    start: Number(block.start_hour ?? 0),
    duration: Number(block.duration_hours ?? 1),
    title: block.title,
    done: block.done,
  }));

  return { goals, blocks, media: existing?.media ?? [] };
}

async function deleteMissing(table: 'goals' | 'tasks' | 'calendar_entries', userId: string, remote: Array<{ id: string; client_id: string | null }>, keep: Set<string>) {
  const ids = remote.filter(row => row.client_id && !keep.has(row.client_id)).map(row => row.id);
  if (!ids.length) return;
  const { error } = await supabase.from(table).delete().eq('user_id', userId).in('id', ids);
  if (error) throw error;
}

async function pushLocal(userId: string, state: LocalState) {
  const existingGoals = await supabase.from('goals').select('id,client_id').eq('user_id', userId);
  if (existingGoals.error) throw existingGoals.error;
  await deleteMissing('goals', userId, existingGoals.data ?? [], new Set(state.goals.map(goal => goal.id)));

  const goalRows = state.goals.map(goal => ({
    user_id: userId,
    client_id: goal.id,
    title: goal.title,
    category: goal.category ?? '',
    status: goal.status,
    priority: goal.priority,
    cadence: goal.cadence ?? '',
    target_date: goal.targetDate || null,
    notes: goal.notes ?? '',
    cover_path: goal.cover?.startsWith('http') ? goal.cover : null,
  }));
  const goalUpsert = await supabase.from('goals').upsert(goalRows, { onConflict: 'user_id,client_id' }).select('id,client_id');
  if (goalUpsert.error) throw goalUpsert.error;
  const goalUuidByClient = new Map((goalUpsert.data ?? []).map(row => [row.client_id as string, row.id as string]));

  const existingTasks = await supabase.from('tasks').select('id,client_id').eq('user_id', userId);
  if (existingTasks.error) throw existingTasks.error;
  const localTasks = state.goals.flatMap(goal => goal.tasks.map((task, position) => ({ goal, task, position })));
  await deleteMissing('tasks', userId, existingTasks.data ?? [], new Set(localTasks.map(item => item.task.id)));
  if (localTasks.length) {
    const rows = localTasks.flatMap(({ goal, task, position }) => {
      const goalId = goalUuidByClient.get(goal.id);
      return goalId ? [{
        user_id: userId,
        goal_id: goalId,
        client_id: task.id,
        title: task.title,
        done: task.done,
        position,
      }] : [];
    });
    const result = await supabase.from('tasks').upsert(rows, { onConflict: 'user_id,client_id' });
    if (result.error) throw result.error;
  }

  const existingBlocks = await supabase.from('calendar_entries').select('id,client_id').eq('user_id', userId);
  if (existingBlocks.error) throw existingBlocks.error;
  await deleteMissing('calendar_entries', userId, existingBlocks.data ?? [], new Set(state.blocks.map(block => block.id)));
  if (state.blocks.length) {
    const rows = state.blocks.map(block => ({
      user_id: userId,
      goal_id: goalUuidByClient.get(block.goalId) ?? null,
      client_id: block.id,
      title: block.title,
      day_index: block.day,
      start_hour: block.start,
      duration_hours: block.duration,
      done: block.done,
    }));
    const result = await supabase.from('calendar_entries').upsert(rows, { onConflict: 'user_id,client_id' });
    if (result.error) throw result.error;
  }
}

async function logEvent(userId: string, eventType: string, metadata: Record<string, unknown> = {}) {
  await supabase.from('activity_logs').insert({ user_id: userId, event_type: eventType, entity_type: 'app', metadata });
}

async function initialiseForSession(next: Session) {
  session = next;
  const userId = next.user.id;
  const owner = localStorage.getItem(OWNER_KEY);
  const local = readLocal();
  const remote = await fetchRemote(userId);

  if (!owner && remote.goals.length === 0 && local?.goals.length) {
    await pushLocal(userId, local);
    localStorage.setItem(OWNER_KEY, userId);
    lastLocal = localSignature();
    await logEvent(userId, 'legacy_device_import', { goals: local.goals.length, blocks: local.blocks.length });
    return;
  }

  if (owner && owner !== userId && remote.goals.length === 0) {
    localStorage.removeItem(STATE_KEY);
    localStorage.setItem(OWNER_KEY, userId);
    localStorage.setItem(RELOAD_KEY, '1');
    location.reload();
    return;
  }

  if (remote.goals.length > 0 && owner !== userId) {
    const nextState = remoteToLocal(remote, local);
    localStorage.setItem(STATE_KEY, JSON.stringify(nextState));
    localStorage.setItem(OWNER_KEY, userId);
    localStorage.setItem(RELOAD_KEY, '1');
    location.reload();
    return;
  }

  localStorage.setItem(OWNER_KEY, userId);
  lastLocal = localSignature();

  if (localStorage.getItem(RELOAD_KEY)) {
    localStorage.removeItem(RELOAD_KEY);
    const fresh = readLocal();
    if (fresh && remote.goals.length === 0) await pushLocal(userId, fresh);
  }
}

async function syncNow() {
  if (!session || syncing || !navigator.onLine) return;
  const current = localSignature();
  if (!current || current === lastLocal) return;
  const state = readLocal();
  if (!state) return;
  syncing = true;
  try {
    await pushLocal(session.user.id, state);
    lastLocal = current;
    document.documentElement.dataset.cloudSync = 'synced';
  } catch (error) {
    document.documentElement.dataset.cloudSync = 'error';
    console.error('ONTRACK cloud sync failed', error);
  } finally {
    syncing = false;
  }
}

function queueSync() {
  if (queued) return;
  queued = true;
  setTimeout(() => {
    queued = false;
    void syncNow();
  }, 450);
}

supabase.auth.onAuthStateChange((_event, nextSession) => {
  session = nextSession;
  if (!nextSession) return;
  void initialiseForSession(nextSession).catch(error => {
    document.documentElement.dataset.cloudSync = 'error';
    console.error('ONTRACK cloud initialisation failed', error);
  });
});

void supabase.auth.getSession().then(({ data }) => {
  if (data.session) return initialiseForSession(data.session);
});

setInterval(queueSync, 1200);
window.addEventListener('online', queueSync);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') queueSync();
});
