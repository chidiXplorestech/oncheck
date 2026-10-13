import { supabase } from './supabase';
import { currentFocus, homeSyncLabel } from './home-state';
import { trackMark, navIcon } from './identity';

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

function readCoreState(): CoreState {
  const stored = localStorage.getItem(CORE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as CoreState;
    } catch {
      // Fall through to the live runtime state.
    }
  }
  const runtime = (window as unknown as { __ONTRACK_CORE_STATE__?: CoreState }).__ONTRACK_CORE_STATE__;
  return runtime ? structuredClone(runtime) : { goals: [], blocks: [], media: [] };
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
  return homeSyncLabel(document.documentElement.dataset.cloudSync);
}

function brandMark() { return trackMark(); }

function patchNavigation() {
  const brand = document.querySelector<HTMLElement>('.brand');
  if (brand && brand.dataset.v3 !== '1') {
    brand.dataset.v3 = '1';
    brand.innerHTML = `<span class="ot-brand-mark">${brandMark()}</span><span class="ontrack-wordmark">ontrack.</span>`;
  }

  const labels: Record<string, string> = {
    overview: 'Today',
    goals: 'Plans',
    calendar: 'Week',
    media: 'Vault',
  };
  document.querySelectorAll<HTMLElement>('.nav-btn[data-nav]').forEach(button => {
    const key = button.dataset.nav ?? '';
    if (!labels[key] || button.dataset.v3Nav === '1') return;
    const icon = `<span class="ot-nav-icon">${navIcon(key)}</span>`;
    button.innerHTML = `${icon}<span class="ot-nav-label">${labels[key]}</span>`;
    button.dataset.v3Nav = '1';
    button.setAttribute('aria-label', labels[key]);
  });

  const settings = document.querySelector<HTMLElement>('.oncheck-system-nav');
  if (settings && settings.dataset.v3Nav !== '1') {
    const icon = `<span class="ot-nav-icon">${navIcon('settings')}</span>`;
    settings.innerHTML = `${icon}<span class="ot-nav-label">Settings</span>`;
    settings.dataset.v3Nav = '1';
  }

  const quote = document.querySelector<HTMLElement>('.side-quote');
  if (quote) quote.remove();
  const sidebar = document.querySelector('.sidebar');
  if (sidebar && !sidebar.querySelector('.ot-rail-note')) {
    const note = document.createElement('div');
    note.className = 'ot-rail-note';
    note.innerHTML = '<span>AT YOUR PACE</span><p>Make room for<br>what matters.</p><i></i><small>One day. One next step.</small>';
    sidebar.append(note);
  }
}

function screenHeader(label: string) {
  return `<header class="ot-topbar ot-screen-bar"><button type="button" class="ot-wordmark" data-v3-nav-target="overview" aria-label="ONTRACK home"><span class="ot-wordmark-mark">${brandMark()}</span><span class="ontrack-wordmark">ontrack.</span></button><span class="ot-page-context">Your workspace <i>/</i> ${label}</span><div class="ot-topbar-actions"><button class="ot-tour-button" type="button" data-v3-tour>Quick tour</button><button class="ot-account-button" type="button" data-system-settings="1" aria-label="Open account settings">${navIcon('settings')}<span>Account</span></button></div></header>`;
}

function patchScreenChrome() {
  const workspace = document.querySelector<HTMLElement>('.workspace');
  if (!workspace || workspace.querySelector('.ot-home,.ot-plans-page,.ot-screen-bar')) return;
  const calendar = workspace.querySelector('.calendar-shell');
  if (calendar && !calendar.closest('.ot-calendar-scroll')) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ot-calendar-scroll';
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Weekly calendar, scroll horizontally to view every day');
    wrapper.tabIndex = 0;
    calendar.before(wrapper);
    wrapper.append(calendar);
    const hint = document.createElement('p');
    hint.className = 'ot-calendar-hint';
    hint.textContent = 'Swipe across to see your full week.';
    wrapper.before(hint);
  }
  const label = workspace.querySelector('.calendar-page') ? 'Week' : workspace.querySelector('.media-grid') ? 'Vault' : 'Plan';
  workspace.insertAdjacentHTML('afterbegin', screenHeader(label));
}

function showPlansPage() {
  const workspace = document.querySelector<HTMLElement>('.workspace');
  if (!workspace) return;
  const state = readCoreState();
  workspace.innerHTML = `<div class="ot-plans-page">${screenHeader('Plans')}<div class="ot-collection">
    <div class="ot-collection-head"><div><p class="ot-eyebrow">THE BIGGER PICTURE</p><h1>Your plans.<br><span>Your own pace.</span></h1><p>A place for what you’re working towards.</p></div><button type="button" class="primary" data-action="new-goal">+ New plan</button></div>
    <div class="ot-plan-tools"><label class="ot-search">${navIcon('search')}<input type="search" aria-label="Search plans" placeholder="Find a plan…" data-plan-search></label><div class="ot-plan-filters" aria-label="Filter plans"><button type="button" class="active" data-plan-filter="all" aria-pressed="true">All plans</button><button type="button" data-plan-filter="active" aria-pressed="false">Active</button><button type="button" data-plan-filter="on-hold" aria-pressed="false">On hold</button><button type="button" data-plan-filter="completed" aria-pressed="false">Completed</button></div></div>
    <div class="ot-plan-collection">${state.goals.map((goal, index) => `<button type="button" class="ot-collection-card" data-action="edit-goal" data-id="${goal.id}" data-plan-card data-plan-title="${esc(goal.title.toLowerCase())}" data-plan-status="${goal.status}" style="--card-tone:${index % 3}"><span class="ot-card-symbol">${navIcon('goals')}</span><span class="ot-card-category">${esc(goal.category)}</span><h2>${esc(goal.title)}</h2><p>${esc(goal.tasks.find(task => !task.done)?.title || 'Take a moment to review your next step.')}</p><div class="ot-card-footer"><span>${goal.status.replace('-', ' ')}</span><b>${progress(goal)}% <span aria-hidden="true">↗</span></b></div><i style="--p:${progress(goal)}%"></i></button>`).join('')}</div>
    <div class="ot-collection-empty" ${state.goals.length ? 'hidden' : ''}><h2>A little room for possibility.</h2><p>Start with one thing you want to make happen.</p><button type="button" class="primary" data-action="new-goal">Create your first plan</button></div>
    <p class="ot-no-matches" hidden>No plans match. Try another search or filter.</p>
  </div></div>`;
  document.querySelectorAll<HTMLElement>('.sidebar [data-nav]').forEach(button => button.classList.toggle('active', button.dataset.nav === 'goals'));
  patchNavigation();
}

function filterPlans() {
  const page = document.querySelector('.ot-plans-page');
  if (!page) return;
  const term = page.querySelector<HTMLInputElement>('[data-plan-search]')?.value.trim().toLowerCase() || '';
  const filter = page.querySelector<HTMLElement>('[data-plan-filter].active')?.dataset.planFilter || 'all';
  let visible = 0;
  page.querySelectorAll<HTMLElement>('[data-plan-card]').forEach(card => {
    card.hidden = !((filter === 'all' || card.dataset.planStatus === filter) && (card.dataset.planTitle || '').includes(term));
    if (!card.hidden) visible += 1;
  });
  const empty = page.querySelector<HTMLElement>('.ot-no-matches');
  if (empty) empty.hidden = visible > 0 || !readCoreState().goals.length;
}

function focusRows(focus: DailyFocus, goals: CoreGoal[]) {
  if (focus.items.length) {
    return focus.items.map(item => `
      <button class="ot-focus-row ${item.done ? 'done' : ''}" type="button" aria-pressed="${item.done}" data-v3-focus-toggle="${item.id}">
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
  const state = readCoreState();
  const account = readJson<AccountPrefs>(ACCOUNT_KEY, {});
  const focus = currentFocus(readJson<DailyFocus>(FOCUS_KEY, { date: '', lowEnergy: false, items: [] }));
  const goals = activeGoals(state);
  const blocks = nextBlocks(state);
  const name = (account.name || '').trim() || 'there';
  const maxPriorities = Math.max(1, account.maxDailyPriorities ?? 3);

  return `
    <div class="ot-home" data-ontrack-v3-home>
      <header class="ot-topbar">
        <button class="ot-wordmark" type="button" data-v3-nav-target="overview" aria-label="ONTRACK home">
          <span class="ot-wordmark-mark">${brandMark()}</span>
          <span class="ontrack-wordmark">ontrack.</span>
        </button>
        <div class="ot-topbar-actions">
          <span class="ot-date">${todayLabel()}</span>
          <button class="ot-tour-button" type="button" data-v3-tour>Quick tour</button>
          <button class="ot-sync" type="button" data-system-settings="1" data-v3-sync><span></span>${syncLabel()}</button>
        </div>
      </header>

      <main class="ot-home-main">
        <section class="ot-life">
          <div class="ot-life-heading">
            <p class="ot-eyebrow">${greeting()}, ${esc(name)}.</p>
            <h1>A little progress.<br><span>A better day.</span></h1>
            <span>Make space for what matters. Keep today to ${maxPriorities} priorities.</span>
          </div>

          <div class="ot-life-layout">
            <section class="ot-plain-section ot-today">
              <div class="ot-section-head">
                <div><span>TODAY’S FOCUS</span><h3>Your next moves</h3></div>
                <button type="button" data-system-focus="1">Edit focus <span aria-hidden="true">↗</span></button>
              </div>
              <p class="ot-focus-hint">${focus.items.length ? `${focus.items.filter(item => item.done).length} of ${focus.items.length} complete · one step at a time` : 'Suggested from your plans. Choose your priorities with Edit focus.'}</p><div class="ot-focus-list">${focusRows(focus, goals)}</div><div class="ot-focus-foot"><span>Small steps count.</span><span>${String(new Date().getDate()).padStart(2, '0')} / ${String(new Date().getMonth()+1).padStart(2, '0')}</span></div>
            </section>

            <section class="ot-plain-section ot-up-next">
              <div class="ot-section-head">
                <div><span>ON THE HORIZON</span><h3>Coming up</h3></div>
                <button data-v3-nav-target="calendar" type="button">Week ↗</button>
              </div>
              <div class="ot-next-list">
                ${blocks.length ? blocks.map(block => `
                  <button type="button" class="ot-next-row" data-action="edit-block" data-id="${block.id}">
                    <time><b>${dayName(block.day)}</b><span>${timeLabel(block.start)}</span></time>
                    <span class="ot-next-title">${esc(block.title)}</span>
                    <span class="ot-duration">${block.duration}h</span>
                  </button>`).join('') : '<p class="ot-empty">Nothing else is pulling at your week.</p>'}
              </div>
            </section>

            <section class="ot-plain-section ot-priorities">
              <div class="ot-section-head">
                <div><span>YOUR PLANS</span><h3>Good things in motion</h3></div>
                <button data-v3-all-plans type="button">All plans ↗</button>
              </div>
              <div class="ot-priority-list">
                ${goals.slice(0, 3).map((goal, index) => `
                  <button class="ot-priority-row" type="button" data-action="select-goal" data-id="${goal.id}">
                    <span class="ot-priority-index">${navIcon('goals')}</span>
                    <span class="ot-priority-copy"><b>${esc(goal.title)}</b><small>${esc(goal.category)} · ${esc(goal.cadence)}</small></span>
                    <span class="ot-priority-progress"><i style="--p:${progress(goal)}%"></i><em>${progress(goal)}%</em></span>
                  </button>`).join('') || '<div class="ot-empty-state"><p>No plans yet.</p><span>Choose one thing you want to work towards.</span><button type="button" class="ot-apply" data-action="new-goal">Create your first plan</button></div>'}
              </div>
            </section>
          </div>
        </section>
        <section class="ot-intro">
          <h2>Make room for something new.</h2>
          <p class="ot-intro-copy">A new goal, a shifting deadline, a lighter week. Start with what you need.</p>

          <section class="ot-command">
            <form data-v3-plan-form>
              <div class="ot-prompt-field">
                <textarea data-v3-plan-input rows="2" maxlength="1200" required aria-label="Describe your plan" placeholder="What do you want to work towards?"></textarea>
                <button class="ot-plan-button" type="submit" aria-label="Plan it">↑</button>
              </div>
              <details class="ot-shortcuts"><summary>Planning shortcuts</summary><div class="ot-chips" aria-label="Planning shortcuts">
                <button type="button" data-v3-prompt="Fit a new goal into my week without overloading me."><span>Fit something new into my week</span><em>↗</em></button>
                <button type="button" data-v3-prompt="Reorganise my week around a new deadline."><span>I have a new deadline</span><em>↗</em></button>
                <button type="button" data-v3-prompt="Make next week lighter while protecting my most important work."><span>Make next week lighter</span><em>↗</em></button>
              </div></details>
            </form>
            <div class="ot-plan-status" data-v3-plan-status role="status" aria-live="polite" hidden></div>
          </section>
        </section>

      </main>
    </div>`;
}
function refreshHomeIdentity() {
  const account = readJson<AccountPrefs>(ACCOUNT_KEY, {});
  const name = (account.name || '').trim() || 'there';
  const heading = document.querySelector<HTMLElement>('.ot-eyebrow');
  const next = `${greeting()}, ${name}.`;
  if (heading && heading.textContent !== next) heading.textContent = next;
}

function patchHome(refresh = false) {
  patchNavigation();
  const workspace = document.querySelector<HTMLElement>('.workspace');
  if (!workspace) return;
  if (workspace.querySelector('[data-ontrack-v3-home]')) {
    refreshHomeIdentity();
    if (refresh) {
      const template = document.createElement('template');
      template.innerHTML = buildHome();
      const current = workspace.querySelector('.ot-life');
      const next = template.content.querySelector('.ot-life');
      if (current && next) current.replaceWith(next);
      const date = workspace.querySelector('.ot-date');
      if (date) date.textContent = todayLabel();
    }
    return;
  }
  if (!workspace.querySelector('.hero') || !workspace.querySelector('.overview-grid')) return;
  workspace.innerHTML = buildHome();
}

function updateSyncBadge() {
  const badge = document.querySelector<HTMLElement>('[data-v3-sync]');
  if (!badge) return;
  const label = syncLabel();
  if (badge.dataset.syncState === label) return;
  badge.dataset.syncState = label;
  badge.innerHTML = `<span></span>${label}`;
}

function toggleFocus(id: string) {
  const focus = currentFocus(readJson<DailyFocus>(FOCUS_KEY, { date: '', lowEnergy: false, items: [] }));
  const item = focus.items.find(candidate => candidate.id === id);
  if (!item) return;
  item.done = !item.done;
  writeJson(FOCUS_KEY, focus);
  patchHome(true);
  document.querySelector<HTMLButtonElement>(`[data-v3-focus-toggle="${CSS.escape(id)}"]`)?.focus();
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
  const state = readCoreState();
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

  let response: Response;
  try {
    response = await fetch('/api/ontrack-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ intent, context: planContext() }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error('Planning took too long. Your draft is safe; please try again.');
    }
    throw new Error('Could not reach the planner. Check your connection and try again.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (payload?.code === 'ai_not_configured') {
      throw new Error('The ONTRACK AI planner is built but the OpenAI API key has not been connected yet.');
    }
    throw new Error(payload?.error || 'ONTRACK could not create a plan right now.');
  }
  return payload.plan as AiPlan;
}

function openPlans() { showPlansPage(); }

function previewPlan(plan: AiPlan, sourceText: string) {
  document.querySelector<HTMLDialogElement>('.ot-plan-dialog')?.close();
  const state = readCoreState();
  const slots = suggestedSlots(plan, state);
  const dialog = document.createElement('dialog');
  dialog.className = 'ot-plan-dialog';
  dialog.setAttribute('aria-label', 'Plan preview');
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
        ${slots.length ? `<div class="ot-slot-list">${slots.map(slot => `<div><b>${dayName(slot.day)}</b><span>${timeLabel(slot.start)}</span><em>${slot.duration}h</em></div>`).join('')}</div>` : `<p class="ot-empty">${plan.schedule.sessions_per_week ? 'No free slots were found. The plan can be added without calendar blocks.' : 'No recurring time requested. ONTRACK will add the plan without calendar blocks.'}</p>`}
        ${slots.length > 0 && slots.length < plan.schedule.sessions_per_week ? `<p class="ot-empty">Only ${slots.length} of ${plan.schedule.sessions_per_week} requested sessions fit. Review your week before adding more.</p>` : ''}
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
    const current = readCoreState();
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

function openTour() {
  document.querySelector<HTMLDialogElement>('.ot-tour-dialog')?.close();
  const steps = [
    { title: 'Choose what matters today', copy: 'Keep a short focus list. Tick off an action when it is finished.', demo: '<span class="ot-demo-label">TODAY</span><p>○ Review lecture notes</p><p>✓ Finish one coding exercise</p>' },
    { title: 'Give your goals space', copy: 'Use Plans for your next actions and Week to choose when to work on them.', demo: '<span class="ot-demo-label">YOUR WEEK</span><p>Tuesday · 10:00</p><strong>Study block · 45 minutes</strong>' },
    { title: 'Make changes at your pace', copy: 'Describe a new goal in the planner. Check its actions and suggested times before applying it.', demo: '<span class="ot-demo-label">PLAN PREVIEW</span><p>Prepare for my next deadline</p><strong>Review actions → Apply when ready</strong>' },
  ];
  const dialog = document.createElement('dialog');
  dialog.className = 'ot-plan-dialog ot-tour-dialog';
  dialog.setAttribute('aria-label', 'How ONTRACK works');
  let step = 0;
  const render = () => {
    const current = steps[step];
    dialog.innerHTML = `<div class="ot-plan-panel ot-tour-panel">
      <header><div><span>QUICK TOUR · ${step + 1} OF ${steps.length}</span><h2>${current.title}</h2><p>${current.copy}</p></div><button type="button" data-tour-skip aria-label="Close tour">×</button></header>
      <div class="ot-tour-demo" aria-label="Illustrative example">${current.demo}</div>
      <p class="ot-tour-note">Example shown for illustration.</p>
      <footer><button type="button" class="ot-secondary" data-tour-skip>Skip tour</button><button type="button" class="ot-apply" data-tour-next>${step === steps.length - 1 ? 'Start my day' : 'Continue'}</button></footer>
    </div>`;
    dialog.querySelectorAll('[data-tour-skip]').forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.querySelector('[data-tour-next]')?.addEventListener('click', () => {
      if (step === steps.length - 1) { dialog.close(); return; }
      step += 1;
      render();
      dialog.querySelector<HTMLButtonElement>('[data-tour-next]')?.focus();
    });
  };
  render();
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.showModal();
}

function openPlanningStage() {
  document.querySelector('.ot-thinking-stage')?.remove();
  const stage = document.createElement('div');
  stage.className = 'ot-thinking-stage';
  stage.innerHTML = `
    <div class="ot-thinking-mark">${brandMark()}</div>
    <p>Making sense of your week…</p>
  `;
  document.body.append(stage);
  requestAnimationFrame(() => stage.classList.add('show'));
}

function closePlanningStage() {
  const stage = document.querySelector<HTMLElement>('.ot-thinking-stage');
  if (!stage) return;
  stage.classList.remove('show');
  window.setTimeout(() => stage.remove(), 240);
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
  form.setAttribute('aria-busy', 'true');
  const submit = form.querySelector<HTMLButtonElement>('[type="submit"]');
  if (submit) submit.disabled = true;
  openPlanningStage();

  const timer = window.setTimeout(() => {
    status.textContent = 'Checking your priorities and available space…';
  }, 900);

  try {
    const plan = await requestPlan(intent);
    window.clearTimeout(timer);
    status.textContent = 'Plan ready.';
    closePlanningStage();
    previewPlan(plan, intent);
  } catch (error) {
    window.clearTimeout(timer);
    closePlanningStage();
    status.textContent = error instanceof Error ? error.message : 'ONTRACK could not create the plan.';
  } finally {
    planning = false;
    form.classList.remove('busy');
    form.removeAttribute('aria-busy');
    if (submit) submit.disabled = false;
  }
}

document.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-v3-prompt],[data-v3-focus-toggle],[data-v3-all-plans],[data-v3-nav-target],[data-v3-tour]');
  if (!target) return;

  if (target.hasAttribute('data-v3-tour')) {
    openTour();
    return;
  }

  if (target.hasAttribute('data-v3-all-plans')) {
    openPlans();
    return;
  }

  if (target.dataset.v3NavTarget) {
    document.querySelector<HTMLElement>(`.sidebar [data-nav="${CSS.escape(target.dataset.v3NavTarget)}"]`)?.click();
    return;
  }

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

function bindLiquidDock() {
  const dock = document.querySelector<HTMLElement>('.sidebar');
  if (!dock || dock.dataset.liquidBound === '1') return;
  dock.dataset.liquidBound = '1';

  const update = (event: PointerEvent) => {
    const rect = dock.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    dock.style.setProperty('--glass-x', `${x}%`);
    dock.style.setProperty('--glass-y', `${y}%`);
  };

  const reset = () => {
    dock.style.setProperty('--glass-x', '50%');
    dock.style.setProperty('--glass-y', '50%');
  };

  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    dock.addEventListener('pointermove', update, { passive: true });
    dock.addEventListener('pointerleave', reset, { passive: true });
  }
}

const observer = new MutationObserver(() => {
  patchHome();
  patchScreenChrome();
  updateSyncBadge();
  bindLiquidDock();
});
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-cloud-sync'] });

window.addEventListener('ontrack:unified-state', () => patchHome(true));
window.addEventListener('ontrack:local-state', () => patchHome(true));
window.addEventListener('focus', () => patchHome(true));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) patchHome(true);
});
requestAnimationFrame(() => {
  patchHome();
  patchScreenChrome();
  bindLiquidDock();
});

document.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('.sidebar [data-nav="goals"],[data-plan-filter]');
  if (!target) return;
  if (target.hasAttribute('data-nav')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    showPlansPage();
  } else {
    document.querySelectorAll<HTMLElement>('[data-plan-filter]').forEach(button => {
      button.classList.toggle('active', button === target);
      button.setAttribute('aria-pressed', String(button === target));
    });
    filterPlans();
  }
}, true);
document.addEventListener('input', event => {
  if ((event.target as HTMLElement).matches('[data-plan-search]')) filterPlans();
});
