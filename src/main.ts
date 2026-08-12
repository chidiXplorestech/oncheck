import './styles.css';
import './app-v2.css';

type GoalStatus = 'active' | 'on-hold' | 'completed';
type Priority = 'low' | 'medium' | 'high';
type View = 'overview' | 'goals' | 'calendar' | 'media' | 'settings';
type WeekStart = 'monday' | 'sunday';

type Task = {
  id: string;
  title: string;
  done: boolean;
};

type Goal = {
  id: string;
  title: string;
  category: string;
  status: GoalStatus;
  priority: Priority;
  cadence: string;
  targetDate: string;
  notes: string;
  tasks: Task[];
  cover?: string;
};

type PlanBlock = {
  id: string;
  goalId: string;
  day: number;
  start: number;
  duration: number;
  title: string;
  done: boolean;
};

type AccountSettings = {
  name: string;
  role: string;
  email: string;
  lowEnergyMinutes: number;
  maxDailyPriorities: number;
  weekStart: WeekStart;
};

type FocusItem = {
  id: string;
  title: string;
  goalId: string;
  done: boolean;
};

type DailyFocus = {
  date: string;
  lowEnergy: boolean;
  items: FocusItem[];
};

type WeeklyReview = {
  weekKey: string;
  rating: number;
  wins: string;
  friction: string;
  nextWeek: string;
};

type AppState = {
  goals: Goal[];
  blocks: PlanBlock[];
  media: string[];
  account: AccountSettings;
  dailyFocus: DailyFocus;
  weeklyReview: WeeklyReview;
};

const STORAGE_KEY = 'oncheck-state-v1';
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const todayKey = () => new Date().toISOString().slice(0, 10);

function startOfWeek(date = new Date(), start: WeekStart = 'monday') {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const day = value.getDay();
  const diff = start === 'monday' ? (day === 0 ? -6 : 1 - day) : -day;
  value.setDate(value.getDate() + diff);
  return value;
}

function weekKey(start: WeekStart = 'monday') {
  return startOfWeek(new Date(), start).toISOString().slice(0, 10);
}

const seeded: AppState = {
  goals: [
    { id: 'academics', title: 'Academics', category: 'Education', status: 'active', priority: 'high', cadence: 'Daily', targetDate: '2027-06-30', notes: 'Pass strongly, progress consistently, and protect future options.', tasks: [
      { id: uid(), title: 'Track every deadline in one place', done: true },
      { id: uid(), title: 'Complete focused study blocks each week', done: false },
      { id: uid(), title: 'Review weak topics every Sunday', done: false },
    ] },
    { id: 'coding', title: 'Coding: C → Python → TypeScript', category: 'Career', status: 'active', priority: 'high', cadence: 'Daily', targetDate: '2028-06-30', notes: 'Learn by shipping. C first, then Python, TypeScript and AI systems.', tasks: [
      { id: uid(), title: 'Finish C foundations', done: false },
      { id: uid(), title: 'Build one C mini-project', done: false },
      { id: uid(), title: 'Progress to Python', done: false },
      { id: uid(), title: 'Progress to TypeScript', done: false },
    ] },
    { id: 'declutter', title: 'Declutter', category: 'Product', status: 'active', priority: 'high', cadence: 'Weekly', targetDate: '2027-02-28', notes: 'Ship the product into real users’ hands within the six-month execution window.', tasks: [
      { id: uid(), title: 'Lock product scope', done: true },
      { id: uid(), title: 'Complete working beta', done: false },
      { id: uid(), title: 'Run private user test', done: false },
    ] },
    { id: 'training', title: 'Training', category: 'Health', status: 'active', priority: 'medium', cadence: 'Mon · Wed · Thu', targetDate: '2029-12-31', notes: 'Make training a permanent staple and build sustainable strength, size and athleticism.', tasks: [
      { id: uid(), title: 'Complete the three-day split consistently', done: false },
      { id: uid(), title: 'Progress load without sacrificing form', done: false },
      { id: uid(), title: 'Track recovery and body composition', done: false },
    ] },
    { id: 'content', title: 'Content Creation', category: 'Creator', status: 'active', priority: 'medium', cadence: 'Weekly', targetDate: '2029-12-31', notes: 'AI for everyday life, robotics, tech finds and building in public.', tasks: [
      { id: uid(), title: 'Define three content pillars', done: true },
      { id: uid(), title: 'Publish one piece each week', done: false },
      { id: uid(), title: 'Build LinkedIn carousel system', done: false },
    ] },
    { id: 'driving', title: 'Driving Licence', category: 'Independence', status: 'active', priority: 'medium', cadence: 'Weekly', targetDate: '2027-08-31', notes: 'Find Nottingham instructors, pass theory and complete the practical test.', tasks: [
      { id: uid(), title: 'Shortlist Nottingham instructors', done: false },
      { id: uid(), title: 'Book theory test', done: false },
      { id: uid(), title: 'Book practical test', done: false },
    ] },
    { id: 'investing', title: 'Financial Security', category: 'Money', status: 'active', priority: 'high', cadence: 'Weekly', targetDate: '2029-12-31', notes: 'Build long-term wealth through disciplined investing and separated calculated-risk capital.', tasks: [
      { id: uid(), title: 'Automate long-term investing', done: false },
      { id: uid(), title: 'Run one weekly portfolio review', done: false },
      { id: uid(), title: 'Maintain joint experience savings', done: false },
    ] },
    { id: 'passport', title: 'Passport / Status', category: 'Life admin', status: 'active', priority: 'high', cadence: 'Monthly', targetDate: '2027-12-31', notes: 'Complete the Life in the UK / citizenship / passport pathway before the end of 2027.', tasks: [
      { id: uid(), title: 'Prepare Life in the UK test', done: false },
      { id: uid(), title: 'Create application cost fund', done: false },
      { id: uid(), title: 'Complete required application process', done: false },
    ] },
    { id: 'study-abroad', title: 'Study Abroad', category: 'Global', status: 'active', priority: 'medium', cadence: 'Monthly', targetDate: '2027-11-30', notes: 'Research Canada versus Singapore, compare fit, then submit the strongest application.', tasks: [
      { id: uid(), title: 'Compare Canada vs Singapore', done: false },
      { id: uid(), title: 'Check university application dates', done: false },
      { id: uid(), title: 'Prepare application materials', done: false },
    ] },
  ],
  blocks: [
    { id: uid(), goalId: 'training', day: 0, start: 18, duration: 1.5, title: 'Training · Trunk', done: false },
    { id: uid(), goalId: 'academics', day: 0, start: 20, duration: 1, title: 'Academics', done: false },
    { id: uid(), goalId: 'coding', day: 1, start: 19, duration: 1, title: 'Coding', done: false },
    { id: uid(), goalId: 'training', day: 2, start: 18, duration: 1.5, title: 'Training · Lower Body', done: false },
    { id: uid(), goalId: 'training', day: 3, start: 18, duration: 1.5, title: 'Training · Sides / Arms', done: false },
    { id: uid(), goalId: 'content', day: 4, start: 19, duration: 1, title: 'Content', done: false },
  ],
  media: [],
  account: {
    name: 'Chidi',
    role: 'Personal OS',
    email: '',
    lowEnergyMinutes: 60,
    maxDailyPriorities: 3,
    weekStart: 'monday',
  },
  dailyFocus: {
    date: todayKey(),
    lowEnergy: false,
    items: [],
  },
  weeklyReview: {
    weekKey: weekKey('monday'),
    rating: 0,
    wins: '',
    friction: '',
    nextWeek: '',
  },
};

function normaliseState(raw: Partial<AppState> | null | undefined): AppState {
  const account: AccountSettings = {
    ...seeded.account,
    ...(raw?.account ?? {}),
  };

  const dailyFocus = raw?.dailyFocus?.date === todayKey()
    ? {
        date: todayKey(),
        lowEnergy: Boolean(raw.dailyFocus.lowEnergy),
        items: Array.isArray(raw.dailyFocus.items) ? raw.dailyFocus.items : [],
      }
    : { date: todayKey(), lowEnergy: false, items: [] };

  const reviewKey = weekKey(account.weekStart);
  const weeklyReview = raw?.weeklyReview?.weekKey === reviewKey
    ? { ...seeded.weeklyReview, ...raw.weeklyReview, weekKey: reviewKey }
    : { ...seeded.weeklyReview, weekKey: reviewKey };

  return {
    goals: Array.isArray(raw?.goals) ? raw!.goals! : structuredClone(seeded.goals),
    blocks: Array.isArray(raw?.blocks) ? raw!.blocks! : structuredClone(seeded.blocks),
    media: Array.isArray(raw?.media) ? raw!.media! : [],
    account,
    dailyFocus,
    weeklyReview,
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normaliseState(raw ? JSON.parse(raw) as Partial<AppState> : null);
  } catch {
    return structuredClone(seeded);
  }
}

let state: AppState = load();
let view: View = 'overview';
let selectedGoalId = state.goals[0]?.id ?? '';
let filter: 'all' | GoalStatus = 'all';
let goalSearch = '';
let autosaveTimer: number | undefined;

function save(silent = true) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error('ONCHECK could not save state.', error);
    if (!silent) toast('Could not save. Your browser storage may be full.', 'error');
    return false;
  }
}

function toast(message: string, tone: 'ok' | 'error' = 'ok') {
  document.querySelector('.oncheck-toast')?.remove();
  const element = document.createElement('div');
  element.className = `oncheck-toast ${tone}`;
  element.textContent = message;
  document.body.append(element);
  requestAnimationFrame(() => element.classList.add('show'));
  window.setTimeout(() => {
    element.classList.remove('show');
    window.setTimeout(() => element.remove(), 220);
  }, 1900);
}

function progress(goal: Goal) {
  if (!goal.tasks.length) return 0;
  return Math.round((goal.tasks.filter(task => task.done).length / goal.tasks.length) * 100);
}

function esc(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] ?? character));
}

function goalTone(goal: Goal) {
  const tones = ['blue', 'violet', 'green', 'amber', 'coral', 'cyan'];
  return tones[Math.abs([...goal.id].reduce((total, character) => total + character.charCodeAt(0), 0)) % tones.length];
}

function icon(name: string) {
  const icons: Record<string, string> = {
    overview: '◫', goals: '◎', calendar: '▦', media: '▧', settings: '⌁', plus: '+', more: '•••', check: '✓', trash: '⌫', upload: '↑', reset: '↺', search: '⌕'
  };
  return icons[name] ?? '•';
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function initials(name: string) {
  const value = name.trim();
  if (!value) return 'OC';
  return value.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('');
}

function layout(content: string) {
  return `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">ONCHECK</div>
        <nav aria-label="Primary navigation">
          ${navButton('overview', 'Overview')}
          ${navButton('goals', 'Goals')}
          ${navButton('calendar', 'Calendar')}
          ${navButton('media', 'Media')}
          ${navButton('settings', 'Settings')}
        </nav>
        <div class="side-quote"><i></i>Plan less. Execute the next useful thing.</div>
        <button class="profile profile-button" type="button" data-nav="settings" aria-label="Open account settings">
          <div class="avatar avatar-initials">${esc(initials(state.account.name))}</div>
          <div><strong>${esc(state.account.name || 'Account')}</strong><span>${esc(state.account.role || 'Personal OS')}</span></div>
        </button>
      </aside>
      <main class="workspace">${content}</main>
    </div>`;
}

function navButton(target: View, label: string) {
  return `<button class="nav-btn ${view === target ? 'active' : ''}" data-nav="${target}" type="button"><span>${icon(target)}</span>${label}</button>`;
}

function focusCard() {
  const complete = state.dailyFocus.items.filter(item => item.done).length;
  const max = Math.max(1, state.account.maxDailyPriorities);
  const lowEnergyCopy = state.dailyFocus.lowEnergy ? `MINIMUM DAY · ${state.account.lowEnergyMinutes} MIN` : 'NORMAL MODE';
  return `
    <section class="today-card ${state.dailyFocus.lowEnergy ? 'low-energy' : ''}">
      <div class="today-head">
        <div><span>TODAY · ${new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()}</span><h2>What actually moves today forward?</h2></div>
        <button type="button" class="mode-toggle ${state.dailyFocus.lowEnergy ? 'active' : ''}" data-action="toggle-low-energy">${lowEnergyCopy}</button>
      </div>
      <div class="today-items">
        ${state.dailyFocus.items.length ? state.dailyFocus.items.map((item, index) => {
          const goal = state.goals.find(candidate => candidate.id === item.goalId);
          return `<div class="today-item ${item.done ? 'done' : ''}">
            <button type="button" class="square-check" data-action="toggle-focus" data-id="${item.id}">${item.done ? '✓' : ''}</button>
            <div><span>0${index + 1}</span><strong>${esc(item.title)}</strong>${goal ? `<small>${esc(goal.title)}</small>` : ''}</div>
            <button type="button" class="icon-btn" data-action="delete-focus" data-id="${item.id}" aria-label="Remove priority">×</button>
          </div>`;
        }).join('') : `<button type="button" class="today-empty" data-action="add-focus"><strong>SET TODAY'S FIRST MOVE</strong><span>Keep the list deliberately short.</span></button>`}
      </div>
      <div class="today-foot"><span>${complete}/${state.dailyFocus.items.length || 0} DONE · LIMIT ${max}</span><button type="button" class="text-btn" data-action="add-focus">+ Add priority</button></div>
    </section>`;
}

function growthPulse() {
  const allTasks = state.goals.flatMap(goal => goal.tasks);
  const taskRate = allTasks.length ? Math.round(allTasks.filter(task => task.done).length / allTasks.length * 100) : 0;
  const blockRate = state.blocks.length ? Math.round(state.blocks.filter(block => block.done).length / state.blocks.length * 100) : 0;
  const focusRate = state.dailyFocus.items.length ? Math.round(state.dailyFocus.items.filter(item => item.done).length / state.dailyFocus.items.length * 100) : 0;
  return `<section class="side-card growth-pulse"><div class="side-title"><h3>Execution Pulse</h3><strong>${Math.round((taskRate + blockRate + focusRate) / 3)}%</strong></div><div class="pulse-grid"><div><span>GOALS</span><b>${taskRate}%</b></div><div><span>WEEK</span><b>${blockRate}%</b></div><div><span>TODAY</span><b>${focusRate}%</b></div></div><button type="button" class="review-link" data-nav="settings">Weekly review →</button></section>`;
}

function overviewView() {
  const filtered = state.goals.filter(goal => filter === 'all' ? true : goal.status === filter);
  const overall = state.goals.length ? Math.round(state.goals.reduce((total, goal) => total + progress(goal), 0) / state.goals.length) : 0;
  const focus = state.goals.find(goal => goal.id === selectedGoalId) ?? state.goals[0];
  const upcoming = state.goals.filter(goal => goal.targetDate).sort((a, b) => a.targetDate.localeCompare(b.targetDate)).slice(0, 4);

  return layout(`
    <section class="hero">
      <div class="hero-blur"></div>
      <div class="hero-copy"><h1>${greeting()}, ${esc(state.account.name || 'there')}.</h1><p>STAY FOCUSED. RISK IT FOR THE PLOT.</p></div>
    </section>
    <div class="overview-grid">
      <section class="goal-panel">
        ${focusCard()}
        <div class="toolbar enhanced-toolbar">
          <div class="toolbar-stack">
            <div class="tabs">${tab('all', 'All Goals')}${tab('active', 'Active')}${tab('on-hold', 'On Hold')}${tab('completed', 'Completed')}</div>
            <label class="goal-search"><span>${icon('search')}</span><input data-search-goals type="search" value="${esc(goalSearch)}" placeholder="Search goals" aria-label="Search goals" /></label>
          </div>
          <button class="primary" data-action="new-goal" type="button">${icon('plus')} New Goal</button>
        </div>
        <div class="goal-list">${filtered.map(goalRow).join('')}</div>
      </section>
      <aside class="right-rail">
        ${focus ? `<section class="focus-card tone-${goalTone(focus)}"><div class="focus-art"></div><div class="focus-overlay"><span>Current Focus</span><h2>${esc(focus.title)}</h2><p>${esc(focus.notes)}</p><div class="ring" style="--p:${progress(focus)}">${progress(focus)}%</div></div></section>` : ''}
        ${growthPulse()}
        <section class="side-card"><div class="side-title"><h3>Progress Overview</h3><strong>${overall}%</strong></div><div class="long-bar"><i style="width:${overall}%"></i></div><div class="stats"><div><b>${state.goals.filter(goal => goal.status === 'completed').length}</b><span>Completed</span></div><div><b>${state.goals.filter(goal => goal.status === 'active').length}</b><span>Active</span></div><div><b>${state.goals.filter(goal => goal.status === 'on-hold').length}</b><span>On Hold</span></div></div></section>
        <section class="side-card"><div class="side-title"><h3>Upcoming Milestones</h3></div>${upcoming.map(goal => `<button class="milestone milestone-button" type="button" data-action="select-goal" data-id="${goal.id}"><i class="dot tone-${goalTone(goal)}"></i><span>${esc(goal.title)}</span><time>${new Date(`${goal.targetDate}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</time></button>`).join('')}</section>
        <section class="side-card"><div class="side-title"><h3>Recent Media</h3><button class="text-btn" data-action="upload-media" type="button">Add</button></div><div class="media-strip">${mediaStrip()}</div></section>
      </aside>
    </div>`);
}

function tab(value: string, label: string) {
  return `<button class="tab ${filter === value ? 'active' : ''}" data-filter="${value}" type="button">${label}</button>`;
}

function goalRow(goal: Goal) {
  const currentProgress = progress(goal);
  const searchText = `${goal.title} ${goal.category} ${goal.notes}`.toLowerCase();
  return `<article class="goal-row" data-goal="${goal.id}" data-search="${esc(searchText)}" ${goalSearch && !searchText.includes(goalSearch.toLowerCase()) ? 'hidden' : ''}>
    <button class="round-check ${goal.status === 'completed' ? 'done' : ''}" data-action="toggle-goal" data-id="${goal.id}" type="button" aria-label="Toggle ${esc(goal.title)} completion">${goal.status === 'completed' ? icon('check') : ''}</button>
    <button class="goal-main goal-main-button" data-action="select-goal" data-id="${goal.id}" type="button"><h3>${esc(goal.title)}</h3><div><span>${esc(goal.cadence)}</span><span>${goal.tasks.filter(task => task.done).length} / ${goal.tasks.length} tasks</span></div></button>
    <div class="goal-progress"><strong>${currentProgress}%</strong><div><i style="width:${currentProgress}%"></i></div></div>
    <button class="cover tone-${goalTone(goal)}" data-action="select-goal" data-id="${goal.id}" type="button">${goal.cover ? `<img src="${goal.cover}" alt="" />` : '<span></span>'}</button>
    <button class="icon-btn" data-action="edit-goal" data-id="${goal.id}" type="button" aria-label="Edit ${esc(goal.title)}">${icon('more')}</button>
  </article>`;
}

function goalsView() {
  const goal = state.goals.find(candidate => candidate.id === selectedGoalId) ?? state.goals[0];
  if (!goal) return layout(`<div class="empty"><h1>No goals yet.</h1><button class="primary" data-action="new-goal" type="button">New Goal</button></div>`);

  return layout(`
    <div class="page-wrap editor-layout">
      <section>
        <div class="page-head"><div><button class="back-link" data-nav="overview" type="button">← Back to overview</button><h1>Edit Goal</h1><span class="autosave-state" id="goalSaveState">SAVED</span></div><div class="head-actions"><button class="secondary" data-action="duplicate-goal" data-id="${goal.id}" type="button">Duplicate</button><button class="danger" data-action="delete-goal" data-id="${goal.id}" type="button">Delete</button></div></div>
        <form id="goalForm" class="editor-card" data-goal-id="${goal.id}">
          <div class="form-grid three"><label>Goal title<input name="title" value="${esc(goal.title)}" required /></label><label>Category<input name="category" value="${esc(goal.category)}" /></label><label>Status<select name="status"><option value="active" ${goal.status === 'active' ? 'selected' : ''}>Active</option><option value="on-hold" ${goal.status === 'on-hold' ? 'selected' : ''}>On Hold</option><option value="completed" ${goal.status === 'completed' ? 'selected' : ''}>Completed</option></select></label></div>
          <div class="form-grid four"><label>Cadence<input name="cadence" value="${esc(goal.cadence)}" /></label><label>Priority<select name="priority"><option value="low" ${goal.priority === 'low' ? 'selected' : ''}>Low</option><option value="medium" ${goal.priority === 'medium' ? 'selected' : ''}>Medium</option><option value="high" ${goal.priority === 'high' ? 'selected' : ''}>High</option></select></label><label>Target date<input type="date" name="targetDate" value="${goal.targetDate}" /></label><label>Progress<div class="progress-readout"><b>${progress(goal)}%</b><div class="long-bar"><i style="width:${progress(goal)}%"></i></div></div></label></div>
          <label>Notes<textarea name="notes" rows="4">${esc(goal.notes)}</textarea></label>
          <div class="editor-section"><div class="section-head"><div><h3>Checklist</h3><p>Track the actions that move this goal forward.</p></div><button type="button" class="text-btn" data-action="add-task" data-id="${goal.id}">+ Add item</button></div><div class="task-list">${goal.tasks.map(task => `<div class="task-row"><button type="button" class="mini-check ${task.done ? 'done' : ''}" data-action="toggle-task" data-goal="${goal.id}" data-task="${task.id}">${task.done ? '✓' : ''}</button><input data-task-title="${task.id}" value="${esc(task.title)}" aria-label="Checklist item" /><button type="button" class="icon-btn" data-action="delete-task" data-goal="${goal.id}" data-task="${task.id}" aria-label="Delete checklist item">${icon('trash')}</button></div>`).join('')}</div></div>
          <div class="form-actions"><span>Your edits auto-save. The button also commits them immediately.</span><button class="primary" type="submit">Save Changes</button></div>
        </form>
      </section>
      <aside class="editor-aside">
        <div class="preview-card"><button class="preview-cover tone-${goalTone(goal)}" data-action="goal-cover" data-id="${goal.id}" type="button">${goal.cover ? `<img src="${goal.cover}" alt="" />` : '<span></span>'}<em>${icon('upload')} Change cover</em></button><h2>${esc(goal.title)}</h2><p>${esc(goal.category)} · ${goal.status.replace('-', ' ')}</p><div class="long-bar"><i style="width:${progress(goal)}%"></i></div></div>
        <div class="side-card"><div class="side-title"><h3>Media & Resources</h3><button class="text-btn" data-action="upload-media" type="button">Add Media</button></div><div class="media-strip">${mediaStrip()}</div></div>
      </aside>
    </div>`);
}

function weekDates() {
  const start = startOfWeek(new Date(), state.account.weekStart);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function calendarView() {
  const dates = weekDates();
  const dayNames = dates.map(date => date.toLocaleDateString('en-GB', { weekday: 'short' }));
  const hours = Array.from({ length: 16 }, (_, index) => 6 + index);
  return layout(`
    <div class="calendar-page">
      <section class="calendar-hero"><div><span>WEEKLY SYSTEM</span><h1>Plan your week.</h1><p>Time blocks for deep work and real progress.</p></div><button class="primary" data-action="new-block" type="button">+ New Block</button></section>
      <div class="calendar-shell">
        <div class="time-head">TIME</div>${dayNames.map((day, index) => `<div class="day-head"><strong>${day}</strong><span>${dates[index].getDate()}</span></div>`).join('')}
        <div class="time-axis">${hours.map(hour => `<span style="top:${(hour - 6) * 56 + 8}px">${hour > 12 ? hour - 12 : hour} ${hour >= 12 ? 'PM' : 'AM'}</span>`).join('')}</div>
        ${dayNames.map((_, day) => `<div class="day-col">${hours.map(() => '<div class="hour-line"></div>').join('')}${state.blocks.filter(block => block.day === day).map(blockCard).join('')}</div>`).join('')}
      </div>
    </div>`);
}

function blockCard(block: PlanBlock) {
  const goal = state.goals.find(candidate => candidate.id === block.goalId);
  const top = (block.start - 6) * 56 + 4;
  const height = Math.max(46, block.duration * 56 - 8);
  return `<button class="plan-block tone-${goal ? goalTone(goal) : 'blue'} ${block.done ? 'done' : ''}" style="top:${top}px;height:${height}px" data-action="edit-block" data-id="${block.id}" type="button"><span>${block.done ? '✓' : '○'}</span><strong>${esc(block.title)}</strong><small>${formatHour(block.start)} · ${block.duration}h</small></button>`;
}

function formatHour(hour: number) {
  const wholeHour = Math.floor(hour);
  const minute = Math.round((hour - wholeHour) * 60);
  const display = wholeHour > 12 ? wholeHour - 12 : wholeHour;
  return `${display}:${String(minute).padStart(2, '0')} ${wholeHour >= 12 ? 'PM' : 'AM'}`;
}

function mediaView() {
  return layout(`<div class="page-wrap"><div class="page-head"><div><span class="eyebrow">VISUAL REFERENCES</span><h1>Media</h1><p>Attach mood, references and proof to the goals you care about.</p></div><button class="primary" data-action="upload-media" type="button">${icon('upload')} Add Media</button></div><div class="media-grid">${state.media.map((src, index) => `<div class="media-item"><img src="${src}" alt="Uploaded reference ${index + 1}"/><button class="icon-btn" data-action="delete-media" data-index="${index}" type="button">${icon('trash')}</button></div>`).join('')}<button class="media-add" data-action="upload-media" type="button"><span>+</span><small>Add media</small></button></div></div>`);
}

function mediaStrip() {
  const builtins = ['gradient-a', 'gradient-b', 'gradient-c'];
  const uploaded = state.media.slice(-3);
  return [...builtins.map(className => `<div class="media-thumb ${className}"></div>`), ...uploaded.map(src => `<div class="media-thumb"><img src="${src}" alt="" /></div>`), `<button class="media-thumb add" data-action="upload-media" type="button">+</button>`].join('');
}

function settingsView() {
  const review = state.weeklyReview;
  const activeGoals = state.goals.filter(goal => goal.status === 'active').length;
  const localSize = new Blob([localStorage.getItem(STORAGE_KEY) ?? '']).size;
  return layout(`
    <div class="settings-page page-wrap">
      <div class="settings-hero"><span>ACCOUNT / SYSTEM</span><h1>Make ONCHECK fit your life.</h1><p>The useful settings: identity, execution limits, weekly review and your local backup.</p></div>
      <div class="settings-grid">
        <section class="settings-panel">
          <div class="settings-panel-head"><div><span>01</span><h2>Account</h2></div><small>LOCAL PROFILE</small></div>
          <form id="accountForm">
            <div class="form-grid two"><label>Display name<input name="name" value="${esc(state.account.name)}" required /></label><label>Role / label<input name="role" value="${esc(state.account.role)}" /></label></div>
            <label>Email <small class="field-help">Optional for now. ONCHECK is not using cloud auth yet.</small><input name="email" type="email" value="${esc(state.account.email)}" placeholder="you@example.com" /></label>
            <div class="form-grid three settings-controls"><label>Daily priority limit<input name="maxDailyPriorities" type="number" min="1" max="5" value="${state.account.maxDailyPriorities}" /></label><label>Low-energy floor (minutes)<input name="lowEnergyMinutes" type="number" min="15" max="180" step="5" value="${state.account.lowEnergyMinutes}" /></label><label>Week starts<select name="weekStart"><option value="monday" ${state.account.weekStart === 'monday' ? 'selected' : ''}>Monday</option><option value="sunday" ${state.account.weekStart === 'sunday' ? 'selected' : ''}>Sunday</option></select></label></div>
            <div class="form-actions"><span>Changes update your greeting, calendar and daily focus rules.</span><button class="primary" type="submit">Save Account Settings</button></div>
          </form>
        </section>

        <section class="settings-panel weekly-review-panel">
          <div class="settings-panel-head"><div><span>02</span><h2>Weekly Review</h2></div><small>WEEK OF ${review.weekKey}</small></div>
          <form id="reviewForm">
            <label>What moved forward?<textarea name="wins" rows="3" placeholder="Wins, completed work, proof of progress…">${esc(review.wins)}</textarea></label>
            <label>What created friction?<textarea name="friction" rows="3" placeholder="What wasted time, created drag or kept repeating?">${esc(review.friction)}</textarea></label>
            <label>What must be different next week?<textarea name="nextWeek" rows="3" placeholder="One or two system changes, not twenty new goals.">${esc(review.nextWeek)}</textarea></label>
            <label>Week score<select name="rating"><option value="0" ${review.rating === 0 ? 'selected' : ''}>Not scored</option>${[1,2,3,4,5].map(value => `<option value="${value}" ${review.rating === value ? 'selected' : ''}>${value} / 5</option>`).join('')}</select></label>
            <div class="form-actions"><span>Keep this short enough that you actually do it.</span><button class="primary" type="submit">Save Weekly Review</button></div>
          </form>
        </section>

        <section class="settings-panel execution-panel">
          <div class="settings-panel-head"><div><span>03</span><h2>Execution Rules</h2></div><small>${activeGoals} ACTIVE GOALS</small></div>
          <div class="rule-list">
            <div><b>01</b><span><strong>Daily priorities stay capped.</strong><small>Current cap: ${state.account.maxDailyPriorities}. New work should compete for a slot.</small></span></div>
            <div><b>02</b><span><strong>Low-energy days still count.</strong><small>Your minimum viable day is ${state.account.lowEnergyMinutes} minutes.</small></span></div>
            <div><b>03</b><span><strong>Complete before expanding.</strong><small>Use On Hold instead of pretending every goal is active today.</small></span></div>
          </div>
        </section>

        <section class="settings-panel data-panel">
          <div class="settings-panel-head"><div><span>04</span><h2>Data & Device</h2></div><small>${(localSize / 1024).toFixed(1)} KB CORE DATA</small></div>
          <p class="settings-copy">Goals, blocks, account settings, daily focus and reviews are stored on this device. Media uses the separate IndexedDB media library.</p>
          <div class="data-actions"><button class="secondary" type="button" data-action="export-data">Export JSON Backup</button><button class="secondary" type="button" data-action="import-data">Import Backup</button><button class="danger" type="button" data-action="reset-core">Reset Core Data</button></div>
          <p class="settings-warning">A backup file does not currently include uploaded media. Keep important originals outside ONCHECK too.</p>
        </section>
      </div>
    </div>`);
}

function render() {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) return;
  root.innerHTML = view === 'overview' ? overviewView() : view === 'goals' ? goalsView() : view === 'calendar' ? calendarView() : view === 'media' ? mediaView() : settingsView();
  bindForms();
  if (view === 'overview' && goalSearch) applyGoalSearch(goalSearch);
}

function syncGoalForm(form?: HTMLFormElement | null) {
  const activeForm = form ?? document.querySelector<HTMLFormElement>('#goalForm');
  if (!activeForm) return;
  const goalId = activeForm.dataset.goalId ?? selectedGoalId;
  const goal = state.goals.find(candidate => candidate.id === goalId);
  if (!goal) return;

  const data = new FormData(activeForm);
  goal.title = String(data.get('title') ?? '').trim() || 'Untitled Goal';
  goal.category = String(data.get('category') ?? 'Personal').trim() || 'Personal';
  goal.status = String(data.get('status') ?? 'active') as GoalStatus;
  goal.priority = String(data.get('priority') ?? 'medium') as Priority;
  goal.cadence = String(data.get('cadence') ?? 'Weekly').trim() || 'Weekly';
  goal.targetDate = String(data.get('targetDate') ?? '');
  goal.notes = String(data.get('notes') ?? '');
  activeForm.querySelectorAll<HTMLInputElement>('[data-task-title]').forEach(input => {
    const task = goal.tasks.find(candidate => candidate.id === input.dataset.taskTitle);
    if (task) task.title = input.value;
  });
}

function setAutosaveState(text: string) {
  const indicator = document.querySelector<HTMLElement>('#goalSaveState');
  if (indicator) indicator.textContent = text;
}

function scheduleGoalAutosave(form: HTMLFormElement) {
  syncGoalForm(form);
  setAutosaveState('EDITING…');
  if (autosaveTimer) window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    save();
    setAutosaveState('SAVED');
  }, 350);
}

function bindForms() {
  const goalForm = document.querySelector<HTMLFormElement>('#goalForm');
  if (goalForm) {
    goalForm.addEventListener('input', () => scheduleGoalAutosave(goalForm));
    goalForm.addEventListener('change', () => scheduleGoalAutosave(goalForm));
    goalForm.addEventListener('submit', event => {
      event.preventDefault();
      syncGoalForm(goalForm);
      if (save(false)) {
        render();
        toast('Goal changes saved.');
      }
    });
  }

  const accountForm = document.querySelector<HTMLFormElement>('#accountForm');
  accountForm?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(accountForm);
    state.account.name = String(data.get('name') ?? '').trim() || 'ONCHECK User';
    state.account.role = String(data.get('role') ?? '').trim() || 'Personal OS';
    state.account.email = String(data.get('email') ?? '').trim();
    state.account.maxDailyPriorities = Math.min(5, Math.max(1, Number(data.get('maxDailyPriorities') ?? 3)));
    state.account.lowEnergyMinutes = Math.min(180, Math.max(15, Number(data.get('lowEnergyMinutes') ?? 60)));
    state.account.weekStart = String(data.get('weekStart') ?? 'monday') as WeekStart;
    const newReviewKey = weekKey(state.account.weekStart);
    if (state.weeklyReview.weekKey !== newReviewKey) state.weeklyReview = { ...seeded.weeklyReview, weekKey: newReviewKey };
    if (save(false)) {
      render();
      toast('Account settings saved.');
    }
  });

  const reviewForm = document.querySelector<HTMLFormElement>('#reviewForm');
  reviewForm?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(reviewForm);
    state.weeklyReview.wins = String(data.get('wins') ?? '');
    state.weeklyReview.friction = String(data.get('friction') ?? '');
    state.weeklyReview.nextWeek = String(data.get('nextWeek') ?? '');
    state.weeklyReview.rating = Math.min(5, Math.max(0, Number(data.get('rating') ?? 0)));
    state.weeklyReview.weekKey = weekKey(state.account.weekStart);
    if (save(false)) toast('Weekly review saved.');
  });
}

function openGoalDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  dialog.innerHTML = `<form id="newGoalForm"><div class="modal-head"><h2>New Goal</h2><button type="button" class="icon-btn" data-dialog-close>×</button></div><label>Goal title<input name="title" required autofocus /></label><div class="form-grid two"><label>Category<input name="category" value="Personal" /></label><label>Priority<select name="priority"><option value="low">low</option><option value="medium" selected>medium</option><option value="high">high</option></select></label></div><div class="form-grid two"><label>Cadence<input name="cadence" value="Weekly" /></label><label>Target date<input name="targetDate" type="date" /></label></div><label>Notes<textarea name="notes" rows="4"></textarea></label><div class="modal-actions"><span></span><div><button type="button" class="secondary" data-dialog-close>Cancel</button><button type="submit" class="primary">Create Goal</button></div></div></form>`;
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelectorAll('[data-dialog-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.querySelector<HTMLFormElement>('#newGoalForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const goal: Goal = {
      id: uid(),
      title: String(data.get('title') ?? '').trim() || 'Untitled Goal',
      category: String(data.get('category') ?? 'Personal').trim() || 'Personal',
      status: 'active',
      priority: String(data.get('priority') ?? 'medium') as Priority,
      cadence: String(data.get('cadence') ?? 'Weekly').trim() || 'Weekly',
      targetDate: String(data.get('targetDate') ?? ''),
      notes: String(data.get('notes') ?? ''),
      tasks: [],
    };
    state.goals.unshift(goal);
    selectedGoalId = goal.id;
    save();
    dialog.close();
    view = 'goals';
    render();
    toast('Goal created.');
  });
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
}

function openFocusDialog() {
  const limit = Math.max(1, state.account.maxDailyPriorities);
  if (state.dailyFocus.items.length >= limit) {
    toast(`Daily focus is capped at ${limit}. Finish or remove one first.`, 'error');
    return;
  }
  const dialog = document.createElement('dialog');
  dialog.className = 'modal focus-modal';
  dialog.innerHTML = `<form id="focusForm"><div class="modal-head"><div><span class="eyebrow">TODAY</span><h2>Add a priority</h2></div><button type="button" class="icon-btn" data-dialog-close>×</button></div><label>Next physical action<input name="title" required autofocus placeholder="e.g. Finish C pointers exercise" /></label><label>Related goal<select name="goalId"><option value="">No goal</option>${state.goals.filter(goal => goal.status === 'active').map(goal => `<option value="${goal.id}">${esc(goal.title)}</option>`).join('')}</select></label><div class="modal-actions"><span>${state.dailyFocus.items.length}/${limit} slots used</span><div><button type="button" class="secondary" data-dialog-close>Cancel</button><button type="submit" class="primary">Add Priority</button></div></div></form>`;
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelectorAll('[data-dialog-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.querySelector<HTMLFormElement>('#focusForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    state.dailyFocus.items.push({ id: uid(), title: String(data.get('title') ?? '').trim(), goalId: String(data.get('goalId') ?? ''), done: false });
    save();
    dialog.close();
    render();
  });
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
}

function openBlockDialog(block?: PlanBlock) {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  const draft: PlanBlock = block ? { ...block } : { id: uid(), goalId: state.goals[0]?.id ?? '', day: 0, start: 9, duration: 1, title: 'Focus block', done: false };
  dialog.innerHTML = `<form id="blockForm"><div class="modal-head"><h2>${block ? 'Edit' : 'New'} Block</h2><button type="button" class="icon-btn" data-dialog-close>×</button></div><label>Goal<select name="goalId">${state.goals.map(goal => `<option value="${goal.id}" ${goal.id === draft.goalId ? 'selected' : ''}>${esc(goal.title)}</option>`).join('')}</select></label><label>Title<input name="title" value="${esc(draft.title)}" /></label><div class="form-grid three"><label>Day<select name="day">${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((day, index) => `<option value="${index}" ${index === draft.day ? 'selected' : ''}>${day}</option>`).join('')}</select></label><label>Start<input type="number" step="0.5" min="6" max="21" name="start" value="${draft.start}" /></label><label>Hours<input type="number" step="0.25" min="0.25" max="8" name="duration" value="${draft.duration}" /></label></div><label class="checkbox-line"><input type="checkbox" name="done" ${draft.done ? 'checked' : ''}/> Completed</label><div class="modal-actions">${block ? '<button type="button" class="danger" data-delete-block>Delete</button>' : '<span></span>'}<div><button type="button" class="secondary" data-dialog-close>Cancel</button><button type="submit" class="primary">Save Block</button></div></div></form>`;
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelectorAll('[data-dialog-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.querySelector('[data-delete-block]')?.addEventListener('click', () => {
    if (!block || !confirm('Delete this block?')) return;
    state.blocks = state.blocks.filter(candidate => candidate.id !== block.id);
    save();
    dialog.close();
    render();
    toast('Block deleted.');
  });
  dialog.querySelector<HTMLFormElement>('#blockForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    draft.goalId = String(data.get('goalId') ?? '');
    draft.title = String(data.get('title') ?? 'Focus block').trim() || 'Focus block';
    draft.day = Number(data.get('day') ?? 0);
    draft.start = Number(data.get('start') ?? 9);
    draft.duration = Number(data.get('duration') ?? 1);
    draft.done = data.get('done') === 'on';
    if (block) Object.assign(block, draft); else state.blocks.push(draft);
    save();
    dialog.close();
    render();
    toast('Calendar block saved.');
  });
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
}

function applyGoalSearch(value: string) {
  const needle = value.trim().toLowerCase();
  document.querySelectorAll<HTMLElement>('.goal-row[data-search]').forEach(row => {
    row.hidden = Boolean(needle) && !(row.dataset.search ?? '').includes(needle);
  });
}

function exportData() {
  syncGoalForm();
  save();
  const payload = JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), state }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `oncheck-backup-${todayKey()}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup exported.');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { state?: Partial<AppState> } | Partial<AppState>;
      const candidate = 'state' in parsed && parsed.state ? parsed.state : parsed as Partial<AppState>;
      if (!Array.isArray(candidate.goals) || !Array.isArray(candidate.blocks)) throw new Error('Invalid ONCHECK backup.');
      state = normaliseState(candidate);
      selectedGoalId = state.goals[0]?.id ?? '';
      save();
      render();
      toast('Backup imported.');
    } catch (error) {
      console.error(error);
      toast('That file is not a valid ONCHECK backup.', 'error');
    }
  }, { once: true });
  input.click();
}

function resetCoreData() {
  if (!confirm('Reset goals, calendar, account, daily focus and reviews? Uploaded media is not deleted.')) return;
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(seeded);
  selectedGoalId = state.goals[0]?.id ?? '';
  filter = 'all';
  goalSearch = '';
  save();
  view = 'overview';
  render();
  toast('Core ONCHECK data reset.');
}

document.addEventListener('input', event => {
  const input = (event.target as HTMLElement | null)?.closest<HTMLInputElement>('[data-search-goals]');
  if (!input) return;
  goalSearch = input.value;
  applyGoalSearch(goalSearch);
});

document.addEventListener('click', event => {
  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-nav],[data-action],[data-filter]');
  if (!target) return;

  const nav = target.dataset.nav as View | undefined;
  if (nav) {
    syncGoalForm();
    save();
    view = nav;
    render();
    return;
  }

  if (target.dataset.filter) {
    syncGoalForm();
    filter = target.dataset.filter as typeof filter;
    render();
    return;
  }

  const action = target.dataset.action;
  const id = target.dataset.id;

  if (action === 'new-goal') return openGoalDialog();
  if (action === 'select-goal' || action === 'edit-goal') {
    syncGoalForm();
    selectedGoalId = id ?? selectedGoalId;
    view = 'goals';
    render();
    return;
  }
  if (action === 'toggle-goal' && id) {
    const goal = state.goals.find(candidate => candidate.id === id);
    if (goal) goal.status = goal.status === 'completed' ? 'active' : 'completed';
    save();
    render();
    return;
  }
  if (action === 'duplicate-goal' && id) {
    syncGoalForm();
    const goal = state.goals.find(candidate => candidate.id === id);
    if (goal) {
      const copy = structuredClone(goal);
      copy.id = uid();
      copy.title += ' Copy';
      copy.tasks = copy.tasks.map(task => ({ ...task, id: uid(), done: false }));
      state.goals.unshift(copy);
      selectedGoalId = copy.id;
      save();
      render();
      toast('Goal duplicated.');
    }
    return;
  }
  if (action === 'delete-goal' && id) {
    syncGoalForm();
    if (!confirm('Delete this goal and its calendar blocks?')) return;
    state.goals = state.goals.filter(goal => goal.id !== id);
    state.blocks = state.blocks.filter(block => block.goalId !== id);
    state.dailyFocus.items = state.dailyFocus.items.filter(item => item.goalId !== id);
    selectedGoalId = state.goals[0]?.id ?? '';
    save();
    view = 'overview';
    render();
    toast('Goal deleted.');
    return;
  }
  if (action === 'add-task' && id) {
    syncGoalForm();
    const goal = state.goals.find(candidate => candidate.id === id);
    if (goal) goal.tasks.push({ id: uid(), title: 'New task', done: false });
    save();
    render();
    requestAnimationFrame(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('[data-task-title]');
      const last = inputs[inputs.length - 1];
      last?.focus();
      last?.select();
    });
    return;
  }
  if (action === 'toggle-task') {
    syncGoalForm();
    const goal = state.goals.find(candidate => candidate.id === target.dataset.goal);
    const task = goal?.tasks.find(candidate => candidate.id === target.dataset.task);
    if (task) task.done = !task.done;
    save();
    render();
    return;
  }
  if (action === 'delete-task') {
    syncGoalForm();
    const goal = state.goals.find(candidate => candidate.id === target.dataset.goal);
    if (goal) goal.tasks = goal.tasks.filter(task => task.id !== target.dataset.task);
    save();
    render();
    return;
  }
  if (action === 'new-block') return openBlockDialog();
  if (action === 'edit-block' && id) {
    const block = state.blocks.find(candidate => candidate.id === id);
    if (block) openBlockDialog(block);
    return;
  }
  if (action === 'add-focus') return openFocusDialog();
  if (action === 'toggle-focus' && id) {
    const item = state.dailyFocus.items.find(candidate => candidate.id === id);
    if (item) item.done = !item.done;
    save();
    render();
    return;
  }
  if (action === 'delete-focus' && id) {
    state.dailyFocus.items = state.dailyFocus.items.filter(item => item.id !== id);
    save();
    render();
    return;
  }
  if (action === 'toggle-low-energy') {
    state.dailyFocus.lowEnergy = !state.dailyFocus.lowEnergy;
    save();
    render();
    return;
  }
  if (action === 'export-data') return exportData();
  if (action === 'import-data') return importData();
  if (action === 'reset-core') return resetCoreData();
  if (action === 'delete-media') {
    const index = Number(target.dataset.index);
    state.media.splice(index, 1);
    save();
    render();
  }
});

save();
render();
