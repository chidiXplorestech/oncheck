import './redesign-layer.css';
import { supabase } from './supabase';

type Priority = 'low' | 'medium' | 'high';
type GoalStatus = 'active' | 'on-hold' | 'completed';

type CoreTask = { id: string; title: string; done: boolean };
type CoreGoal = {
  id: string;
  title: string;
  category: string;
  status: GoalStatus;
  priority: Priority;
  cadence: string;
  targetDate: string;
  notes: string;
  tasks: CoreTask[];
  cover?: string;
};
type CoreBlock = {
  id: string;
  goalId: string;
  day: number;
  start: number;
  duration: number;
  title: string;
  done: boolean;
};
type CoreState = { goals: CoreGoal[]; blocks: CoreBlock[]; media: string[] };
type DailyFocus = { date: string; lowEnergy: boolean; items: Array<{ id: string; title: string; done: boolean }> };
type AccountPrefs = { name?: string; role?: string; email?: string; maxDailyPriorities?: number; lowEnergyMinutes?: number };
type AiPlan = {
  title: string;
  summary: string;
  category: string;
  priority: Priority;
  cadence: string;
  target_date: string | null;
  tasks: Array<{ title: string }>;
  schedule: {
    sessions_per_week: number;
    duration_minutes: number;
    preferred_time: 'morning' | 'afternoon' | 'evening' | 'any';
  };
  assumptions: string[];
};

const CORE_KEY = 'oncheck-state-v1';
const FOCUS_KEY = 'oncheck-daily-focus-v2';
const ACCOUNT_KEY = 'oncheck-account-v2';
const CALENDAR_KEY = 'oncheck-calendar-v2';

const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function esc(value: string) {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[character] ?? character));
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function mondayIndex() {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

function priorityRank(priority: Priority) {
  return priority === 'high' ? 0 : priority === 'medium' ? 1 : 2;
}

function activeGoals(state: CoreState) {
  return state.goals
    .filter(goal => goal.status === 'active')
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
}

function nextBlocks(state: CoreState) {
  const today = mondayIndex();
  return state.blocks
    .filter(block => !block.done && block.day >= today)
    .sort((a, b) => (a.day - b.day) || (a.start - b.start))
    .slice(0, 4);
}

function dayName(day: number) {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][day] ?? 'Day';
}

function timeLabel(hour: number) {
  const whole = Math.floor(hour);
  const minutes = Math.round((hour - whole) * 60);
  const twelve = whole % 12 || 12;
  return `${twelve}:${String(minutes).padStart(2, '0')} ${whole >= 12 ? 'PM' : 'AM'}`;
}

function progress(goal: CoreGoal) {
  if (!goal.tasks.length) return 0;
  return Math.round((goal.tasks.filter(task => task.done).length / goal.tasks.length) * 100);
}

function syncLabel() {
  const state = document.documentElement.dataset.cloudSync;
  if (state === 'syncing') return 'Syncing';
  if (state === 'offline') return 'Offline';
  if (state === 'error') return 'Sync issue';
  if (state === 'conflict') return 'Needs review';
  return 'Synced';
}

function brandMark() {
  return `
    <svg viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="11.4" fill="none" stroke="currentColor" stroke-width="3.6" stroke-dasharray="52 20" stroke-linecap="round"/>
      <path d="M10.5 22.6 24.8 8.3m-6.1.3h6.4V15" fill="none" stroke="var(--ot-lime)" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

function patchNavigation() {
  const brand = document.querySelector<HTMLElement>('.brand');
  if (brand && brand.dataset.v3 !== '1') {
    brand.dataset.v3 = '1';
    brand.innerHTML = `<span class="ot-brand-mark">${brandMark()}</span><span>ONTRACK</span>`;
  }

  const labels: Record<string, string> = {
    overview: 'Today',
    goals: 'Plans',
    calendar: 'Week',
    media: 'Vault',
  };
  document.querySelectorAll<HTMLElement>('.nav-btn[data-nav]').forEach(button => {
    const key = button.dataset.nav ?? '';
    if (!labels[key]) return;
    const icon = button.querySelector('span')?.outerHTML ?? '';
    button.innerHTML = `${icon}<span class="ot-nav-label">${labels[key]}</span>`;
  });

  const settings = document.querySelector<HTMLElement>('.oncheck-system-nav');
  if (settings && !settings.querySelector('.ot-nav-label')) {
    const icon = settings.querySelector('span')?.outerHTML ?? '<span>⌁</span>';
    settings.innerHTML = `${icon}<span class="ot-nav-label">Settings</span>`;
  }

  const quote = document.querySelector<HTMLElement>('.side-quote');
  if (quote) quote.remove();
}

function focusRows(focus: DailyFocus, goals: CoreGoal[]) {
  if (focus.items.length) {
    return focus.items.map(item => `
      <button class="ot-focus-row ${item.done ? 'done' : ''}" type="button" data-v3-focus-toggle="${item.id}">
        <span class="ot-check">${item.done ? '✓' : ''}</span>
        <span>${esc(item.title)}</span>
      </button>`).join('');
  }

  const suggestions = goals
    .flatMap(goal => goal.tasks.filter(task => !task.done).slice(0, 1).map(task => ({ goal, task })))
    .slice(0, 3);

  if (!suggestions.length) return '<p class="ot-empty">Nothing is demanding your attention right now.</p>';

  return suggestions.map(({ goal, task }) => `
    <button class="ot-focus-row suggestion" type="button" data-action="select-goal" data-id="${goal.id}">
      <span class="ot-suggest-dot"></span>
      <span><b>${esc(task.title)}</b><small>${esc(goal.title)}</small></span>
    </button>`).join('');
}

function buildHome() {
  const state = readJson<CoreState>(CORE_KEY, { goals: [], blocks: [], media: [] });
  const account = readJson<AccountPrefs>(ACCOUNT_KEY, {});
  const focus = readJson<DailyFocus>(FOCUS_KEY, { date: '', lowEnergy: false, items: [] });
  const goals = activeGoals(state);
  const blocks = nextBlocks(state);
  const name = (account.name || '').trim() || 'there';
  const maxPriorities = Math.max(1, account.maxDailyPriorities ?? 3);

  return `
    <div class="ot-home" data-ontrack-v3-home>
      <header class="ot-home-head">
        <div>
          <p class="ot-date">${todayLabel()}</p>
          <h1>${greeting()}, ${esc(name)}.</h1>
          <p class="ot-context">${goals.length} active priorities · ${focus.items.filter(item => !item.done).length} for today</p>
        </div>
        <div class="ot-sync" data-v3-sync><span></span>${syncLabel()}</div>
      </header>

      <section class="ot-command">
        <div class="ot-command-kicker"><span class="ot-pulse"></span> PLAN WITH ONTRACK</div>
        <form data-v3-plan-form>
          <textarea data-v3-plan-input rows="2" maxlength="1200" placeholder="Tell ONTRACK what changed or what you want to make happen…"></textarea>
          <div class="ot-command-actions">
            <div class="ot-chips" aria-label="Planning shortcuts">
              <button type="button" data-v3-prompt="Fit a new goal into my week without overloading me.">Fit into my week</button>
              <button type="button" data-v3-prompt="Reorganise my week around a new deadline.">Add a deadline</button>
              <button type="button" data-v3-prompt="Make next week lighter while protecting my most important work.">Lighten next week</button>
            </div>
            <button class="ot-plan-button" type="submit">Plan it <span>↗</span></button>
          </div>
        </form>
        <div class="ot-plan-status" data-v3-plan-status hidden></div>
      </section>

      <div class="ot-home-grid">
        <section class="ot-section ot-today">
          <div class="ot-section-head">
            <div><span>TODAY</span><h2>What matters now</h2></div>
            <button type="button" data-system-focus="1">Edit focus</button>
          </div>
          <div class="ot-focus-list">${focusRows(focus, goals)}</div>
          <p class="ot-limit">Keep today to ${maxPriorities} real priorities.</p>
        </section>

        <section class="ot-section ot-up-next">
          <div class="ot-section-head"><div><span>UP NEXT</span><h2>Your next commitments</h2></div><button data-nav="calendar" type="button">Week →</button></div>
          <div class="ot-next-list">
            ${blocks.length ? blocks.map(block => `
              <button type="button" class="ot-next-row" data-action="edit-block" data-id="${block.id}">
                <time><b>${dayName(block.day)}</b><span>${timeLabel(block.start)}</span></time>
                <span class="ot-next-title">${esc(block.title)}</span>
                <span class="ot-duration">${block.duration}h</span>
              </button>`).join('') : '<p class="ot-empty">No upcoming blocks. Your week has room.</p>'}
          </div>
        </section>

        <section class="ot-section ot-priorities">
          <div class="ot-section-head"><div><span>CURRENT FOCUS</span><h2>Active priorities</h2></div><button data-nav="goals" type="button">All plans →</button></div>
          <div class="ot-priority-list">
            ${goals.slice(0, 3).map((goal, index) => `
              <button class="ot-priority-row" type="button" data-action="select-goal" data-id="${goal.id}">
                <span class="ot-priority-index">0${index + 1}</span>
                <span class="ot-priority-copy"><b>${esc(goal.title)}</b><small>${esc(goal.category)} · ${esc(goal.cadence)}</small></span>
                <span class="ot-priority-progress"><i style="--p:${progress(goal)}%"></i><em>${progress(goal)}%</em></span>
              </button>`).join('') || '<p class="ot-empty">No active priorities yet.</p>'}
          </div>
        </section>
      </div>
    </div>`;
}

function patchHome() {
  patchNavigation();
  const workspace = document.querySelector<HTMLElement>('.workspace');
  if (!workspace || workspace.querySelector('[data-ontrack-v3-home]')) return;
  if (!workspace.querySelector('.hero') || !workspace.querySelector('.overview-grid')) return;
  workspace.innerHTML = buildHome();
}

function updateSyncBadge() {
  const badge = document.querySelector<HTMLElement>('[data-v3-sync]');
  if (!badge) return;
  badge.innerHTML = `<span></span>${syncLabel()}`;
}

function toggleFocus(id: string) {
  const focus = readJson<DailyFocus>(FOCUS_KEY, { date: '', lowEnergy: false, items: [] });
  const item = focus.items.find(candidate => candidate.id === id);
  if (!item) return;
  item.done = !item.done;
  writeJson(FOCUS_KEY, focus);
  const workspace = document.querySelector<HTMLElement>('.workspace');
  if (workspace?.querySelector('[data-ontrack-v3-home]')) workspace.innerHTML = buildHome();
}

function windowFor(preferred: AiPlan['schedule']['preferred_time']) {
  if (preferred === 'morning') return [8, 12] as const;
  if (preferred === 'afternoon') return [12, 17] as const;
  if (preferred === 'evening') return [17, 21] as const;
  return [9, 20] as const;
}

function hasConflict(blocks: CoreBlock[], day: number, start: number, duration: number) {
  const end = start + duration;
  return blocks.some(block => block.day === day && start < block.start + block.duration && end > block.start);
}

function suggestedSlots(plan: AiPlan, state: CoreState) {
  const count = Math.min(7, Math.max(0, Math.round(plan.schedule.sessions_per_week)));
  if (!count) return [] as Array<{ day: number; start: number; duration: number }>;
  const duration = Math.max(0.5, Math.min(4, plan.schedule.duration_minutes / 60));
  const [from, to] = windowFor(plan.schedule.preferred_time);
  const found: Array<{ day: number; start: number; duration: number }> = [];
  const today = mondayIndex();

  for (let offset = 0; offset < 7 && found.length < count; offset += 1) {
    const day = (today + offset) % 7;
    for (let start = from; start + duration <= to; start += 0.5) {
      if (!hasConflict(state.blocks, day, start, duration)) {
        found.push({ day, start, duration });
        break;
      }
    }
  }
  return found;
}

function planContext() {
  const state = readJson<CoreState>(CORE_KEY, { goals: [], blocks: [], media: [] });
  const account = readJson<AccountPrefs>(ACCOUNT_KEY, {});
  return {
    active_goals: activeGoals(state).slice(0, 8).map(goal => ({
      title: goal.title,
      category: goal.category,
      priority: goal.priority,
      cadence: goal.cadence,
      target_date: goal.targetDate || null,
      next_tasks: goal.tasks.filter(task => !task.done).slice(0, 4).map(task => task.title),
    })),
    existing_blocks: state.blocks.filter(block => !block.done).map(block => ({
      day: block.day,
      start_hour: block.start,
      duration_hours: block.duration,
      title: block.title,
    })),
    execution_rules: {
      max_daily_priorities: account.maxDailyPriorities ?? 3,
      low_energy_minutes: account.lowEnergyMinutes ?? 60,
    },
    calendar_present: Boolean(localStorage.getItem(CALENDAR_KEY)),
  };
}

async function requestPlan(intent: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again before using the planner.');

  const response = await fetch('/api/ontrack-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ intent, context: planContext() }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (payload?.code === 'ai_not_configured') {
      throw new Error('The ONTRACK AI planner is built but the OpenAI API key has not been connected yet.');
    }
    throw new Error(payload?.error || 'ONTRACK could not create a plan right now.');
  }
  return payload.plan as AiPlan;
}

function previewPlan(plan: AiPlan, sourceText: string) {
  document.querySelector<HTMLDialogElement>('.ot-plan-dialog')?.close();
  const state = readJson<CoreState>(CORE_KEY, { goals: [], blocks: [], media: [] });
  const slots = suggestedSlots(plan, state);
  const dialog = document.createElement('dialog');
  dialog.className = 'ot-plan-dialog';
  dialog.innerHTML = `
    <div class="ot-plan-panel">
      <header>
        <div><span>PLAN PREVIEW</span><h2>${esc(plan.title)}</h2><p>${esc(plan.summary)}</p></div>
        <button type="button" data-v3-close aria-label="Close">×</button>
      </header>
      <div class="ot-plan-meta">
        <span>${esc(plan.priority)} priority</span>
        <span>${esc(plan.cadence)}</span>
        ${plan.target_date ? `<span>Target ${esc(plan.target_date)}</span>` : ''}
      </div>
      <section><h3>Actions</h3><div class="ot-plan-tasks">${plan.tasks.map(task => `<div><span>○</span>${esc(task.title)}</div>`).join('')}</div></section>
      <section><h3>Suggested space</h3>
        ${slots.length ? `<div class="ot-slot-list">${slots.map(slot => `<div><b>${dayName(slot.day)}</b><span>${timeLabel(slot.start)}</span><em>${slot.duration}h</em></div>`).join('')}</div>` : '<p class="ot-empty">No recurring time requested. ONTRACK will add the plan without calendar blocks.</p>'}
      </section>
      ${plan.assumptions.length ? `<section class="ot-assumptions"><h3>Assumptions</h3><p>${plan.assumptions.map(esc).join(' · ')}</p></section>` : ''}
      <footer>
        <button type="button" class="ot-secondary" data-v3-close>Adjust later</button>
        <button type="button" class="ot-apply" data-v3-apply>Apply to ONTRACK</button>
      </footer>
    </div>`;
  document.body.append(dialog);
  dialog.showModal();

  const close = () => dialog.close();
  dialog.querySelectorAll('[data-v3-close]').forEach(button => button.addEventListener('click', close));
  dialog.querySelector('[data-v3-apply]')?.addEventListener('click', () => {
    const current = readJson<CoreState>(CORE_KEY, { goals: [], blocks: [], media: [] });
    const goalId = `ai-${uid()}`;
    current.goals.unshift({
      id: goalId,
      title: plan.title,
      category: plan.category || 'Personal',
      status: 'active',
      priority: plan.priority,
      cadence: plan.cadence || 'Weekly',
      targetDate: plan.target_date ?? '',
      notes: `${plan.summary}\n\nCreated from: ${sourceText}`,
      tasks: plan.tasks.map(task => ({ id: uid(), title: task.title, done: false })),
    });
    for (const slot of slots) {
      current.blocks.push({
        id: uid(),
        goalId,
        day: slot.day,
        start: slot.start,
        duration: slot.duration,
        title: plan.title,
        done: false,
      });
    }
    writeJson(CORE_KEY, current);
    dialog.close();
    patchHome();
    window.setTimeout(() => location.reload(), 350);
  });
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
}

let planning = false;
async function submitPlan(form: HTMLFormElement) {
  if (planning) return;
  const input = form.querySelector<HTMLTextAreaElement>('[data-v3-plan-input]');
  const status = document.querySelector<HTMLElement>('[data-v3-plan-status]');
  const intent = input?.value.trim() ?? '';
  if (!intent || !status) return;

  planning = true;
  status.hidden = false;
  status.textContent = 'Understanding your plan…';
  form.classList.add('busy');

  const timer = window.setTimeout(() => {
    status.textContent = 'Checking your priorities and available space…';
  }, 900);

  try {
    const plan = await requestPlan(intent);
    window.clearTimeout(timer);
    status.textContent = 'Plan ready.';
    previewPlan(plan, intent);
  } catch (error) {
    window.clearTimeout(timer);
    status.textContent = error instanceof Error ? error.message : 'ONTRACK could not create the plan.';
  } finally {
    planning = false;
    form.classList.remove('busy');
  }
}

document.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-v3-prompt],[data-v3-focus-toggle]');
  if (!target) return;

  if (target.dataset.v3Prompt) {
    const input = document.querySelector<HTMLTextAreaElement>('[data-v3-plan-input]');
    if (input) {
      input.value = target.dataset.v3Prompt;
      input.focus();
    }
    return;
  }

  if (target.dataset.v3FocusToggle) toggleFocus(target.dataset.v3FocusToggle);
});

document.addEventListener('submit', event => {
  const form = (event.target as HTMLElement).closest<HTMLFormElement>('[data-v3-plan-form]');
  if (!form) return;
  event.preventDefault();
  void submitPlan(form);
});

const observer = new MutationObserver(() => {
  patchHome();
  updateSyncBadge();
});
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-cloud-sync'] });

window.addEventListener('ontrack:unified-state', patchHome);
requestAnimationFrame(patchHome);
