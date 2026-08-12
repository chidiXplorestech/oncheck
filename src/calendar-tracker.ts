import './calendar-layer.css';

type GoalRef = {
  id: string;
  title: string;
};

type CalendarBlock = {
  id: string;
  goalId: string;
  day: number;
  start: number;
  duration: number;
  title: string;
  done: boolean;
  weekStart: string;
  date: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  actualMinutes?: number;
  logNote?: string;
  tone?: string;
};

type CalendarStore = {
  version: 2;
  strategyStart: string;
  blocks: CalendarBlock[];
};

type LegacyCoreState = {
  goals?: Array<{ id: string; title: string }>;
  blocks?: Array<{
    id: string;
    goalId: string;
    day: number;
    start: number;
    duration: number;
    title: string;
    done: boolean;
    weekStart?: string;
    date?: string;
    createdAt?: string;
    updatedAt?: string;
    completedAt?: string;
    actualMinutes?: number;
    logNote?: string;
  }>;
};

const CALENDAR_KEY = 'oncheck-calendar-v2';
const CORE_KEY = 'oncheck-state-v1';
const STRATEGY_START_KEY = 'oncheck-strategy-start-v1';
const STRATEGY_START = '2026-08-10';
const HOUR_HEIGHT = 56;
const FIRST_HOUR = 6;
const LAST_HOUR = 21;

let selectedWeekStart = currentWeekStart();
let goalsCache: GoalRef[] = [];
let patchScheduled = false;
let patching = false;

function parseDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mondayOf(date: Date) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  const day = copy.getDay();
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  return isoDate(copy);
}

function currentWeekStart() {
  const current = mondayOf(new Date());
  return current < STRATEGY_START ? STRATEGY_START : current;
}

function addDays(start: string, amount: number) {
  const date = parseDate(start);
  date.setDate(date.getDate() + amount);
  return isoDate(date);
}

function dateDayIndex(value: string) {
  const day = parseDate(value).getDay();
  return day === 0 ? 6 : day - 1;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[character] ?? character));
}

function readLegacyCore(): LegacyCoreState | null {
  try {
    const raw = localStorage.getItem(CORE_KEY);
    return raw ? JSON.parse(raw) as LegacyCoreState : null;
  } catch {
    return null;
  }
}

function captureGoals() {
  const legacy = readLegacyCore();
  if (legacy?.goals?.length) {
    goalsCache = legacy.goals.map(goal => ({ id: goal.id, title: goal.title }));
    return;
  }

  const fromOverview = Array.from(document.querySelectorAll<HTMLElement>('.goal-row[data-goal]'))
    .map(row => ({
      id: row.dataset.goal ?? '',
      title: row.querySelector<HTMLElement>('.goal-main h3')?.textContent?.trim() ?? '',
    }))
    .filter(goal => goal.id && goal.title);
  if (fromOverview.length) goalsCache = fromOverview;
}

function strategyStart() {
  if (!localStorage.getItem(STRATEGY_START_KEY)) localStorage.setItem(STRATEGY_START_KEY, STRATEGY_START);
  return localStorage.getItem(STRATEGY_START_KEY) ?? STRATEGY_START;
}

function readStore(): CalendarStore | null {
  try {
    const raw = localStorage.getItem(CALENDAR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CalendarStore;
    if (!parsed || parsed.version !== 2 || !Array.isArray(parsed.blocks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStore(store: CalendarStore) {
  localStorage.setItem(CALENDAR_KEY, JSON.stringify(store));
}

function toneFromElement(element: HTMLElement) {
  return Array.from(element.classList).find(name => name.startsWith('tone-'))?.replace('tone-', '') ?? 'blue';
}

function goalIdFromTitle(title: string) {
  const normalized = title.toLowerCase();
  const exact = goalsCache.find(goal => normalized === goal.title.toLowerCase());
  if (exact) return exact.id;
  const prefix = goalsCache.find(goal => normalized.startsWith(goal.title.toLowerCase()) || goal.title.toLowerCase().startsWith(normalized));
  if (prefix) return prefix.id;
  if (normalized.includes('money') || normalized.includes('invest')) return goalsCache.find(goal => /financial|invest/i.test(goal.title))?.id ?? '';
  if (normalized.includes('training')) return goalsCache.find(goal => /training/i.test(goal.title))?.id ?? '';
  if (normalized.includes('coding')) return goalsCache.find(goal => /coding/i.test(goal.title))?.id ?? '';
  if (normalized.includes('academic')) return goalsCache.find(goal => /academic/i.test(goal.title))?.id ?? '';
  if (normalized.includes('content')) return goalsCache.find(goal => /content/i.test(goal.title))?.id ?? '';
  if (normalized.includes('driving')) return goalsCache.find(goal => /driving/i.test(goal.title))?.id ?? '';
  if (normalized.includes('study abroad')) return goalsCache.find(goal => /study abroad/i.test(goal.title))?.id ?? '';
  return '';
}

function blockFromRenderedElement(element: HTMLElement, day: number): CalendarBlock {
  const top = Number.parseFloat(element.style.top || '4');
  const height = Number.parseFloat(element.style.height || '48');
  const start = Math.round((FIRST_HOUR + Math.max(0, top - 4) / HOUR_HEIGHT) * 4) / 4;
  const duration = Math.max(0.25, Math.round(((height + 8) / HOUR_HEIGHT) * 4) / 4);
  const title = element.querySelector<HTMLElement>('strong')?.textContent?.trim() || 'Focus block';
  const launch = strategyStart();
  const date = addDays(launch, day);
  return {
    id: element.dataset.id || crypto.randomUUID(),
    goalId: goalIdFromTitle(title),
    day,
    start,
    duration,
    title,
    done: element.classList.contains('done'),
    weekStart: launch,
    date,
    createdAt: `${date}T09:00:00.000Z`,
    tone: toneFromElement(element),
  };
}

function seedStoreFromExistingCalendar(page: HTMLElement) {
  captureGoals();
  const legacy = readLegacyCore();
  const launch = strategyStart();

  if (legacy?.blocks?.length) {
    const blocks: CalendarBlock[] = legacy.blocks.map(block => {
      const weekStart = block.weekStart ?? launch;
      const date = block.date ?? addDays(weekStart, Math.min(6, Math.max(0, Number(block.day) || 0)));
      return {
        id: block.id,
        goalId: block.goalId,
        day: Math.min(6, Math.max(0, Number(block.day) || 0)),
        start: Number(block.start) || 9,
        duration: Number(block.duration) || 1,
        title: block.title || 'Focus block',
        done: Boolean(block.done),
        weekStart,
        date,
        createdAt: block.createdAt ?? `${date}T09:00:00.000Z`,
        updatedAt: block.updatedAt,
        completedAt: block.completedAt,
        actualMinutes: block.actualMinutes,
        logNote: block.logNote,
        tone: 'blue',
      };
    });
    const store: CalendarStore = { version: 2, strategyStart: launch, blocks };
    writeStore(store);
    return store;
  }

  const columns = Array.from(page.querySelectorAll<HTMLElement>('.day-col'));
  const blocks = columns.flatMap((column, day) => Array.from(column.querySelectorAll<HTMLElement>('.plan-block[data-id]')).map(element => blockFromRenderedElement(element, day)));
  const store: CalendarStore = { version: 2, strategyStart: launch, blocks };
  writeStore(store);
  return store;
}

function ensureStore(page: HTMLElement) {
  return readStore() ?? seedStoreFromExistingCalendar(page);
}

function formatWeekRange(start: string) {
  const first = parseDate(start);
  const last = parseDate(addDays(start, 6));
  const sameMonth = first.getMonth() === last.getMonth();
  const firstText = first.toLocaleDateString('en-GB', sameMonth ? { day: '2-digit' } : { day: '2-digit', month: 'short' });
  const lastText = last.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${firstText} — ${lastText}`.toUpperCase();
}

function formatFullDate(value: string) {
  return parseDate(value).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(hour: number) {
  const whole = Math.floor(hour);
  const minutes = Math.round((hour - whole) * 60);
  const display = whole > 12 ? whole - 12 : whole;
  return `${display}:${String(minutes).padStart(2, '0')} ${whole >= 12 ? 'PM' : 'AM'}`;
}

function hourToTime(hour: number) {
  const whole = Math.floor(hour);
  const minutes = Math.round((hour - whole) * 60);
  return `${String(whole).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function timeToHour(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour + minute / 60;
}

function weekBlocks(store: CalendarStore) {
  return store.blocks.filter(block => block.weekStart === selectedWeekStart).sort((a, b) => (a.day - b.day) || (a.start - b.start));
}

function calendarFingerprint(store: CalendarStore) {
  return `${selectedWeekStart}:${store.blocks.map(block => [block.id, block.weekStart, block.date, block.start, block.duration, block.done, block.actualMinutes ?? '', block.logNote ?? '', block.title].join(':')).join('|')}`;
}

function toast(message: string) {
  document.querySelector('.calendar-toast')?.remove();
  const node = document.createElement('div');
  node.className = 'calendar-toast';
  node.textContent = message;
  document.body.append(node);
  requestAnimationFrame(() => node.classList.add('show'));
  window.setTimeout(() => {
    node.classList.remove('show');
    window.setTimeout(() => node.remove(), 200);
  }, 1800);
}

function renderOwnedBlocks(page: HTMLElement, blocks: CalendarBlock[]) {
  page.querySelectorAll<HTMLElement>('.plan-block[data-action="edit-block"]').forEach(element => { element.hidden = true; });
  page.querySelectorAll('[data-calendar-owned]').forEach(element => element.remove());
  const columns = Array.from(page.querySelectorAll<HTMLElement>('.day-col'));

  for (const block of blocks) {
    const column = columns[block.day];
    if (!column) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `plan-block tone-${block.tone ?? 'blue'} ${block.done ? 'done' : ''}`;
    button.dataset.calendarOwned = '1';
    button.dataset.calendarEdit = block.id;
    button.style.top = `${(block.start - FIRST_HOUR) * HOUR_HEIGHT + 4}px`;
    button.style.height = `${Math.max(46, block.duration * HOUR_HEIGHT - 8)}px`;
    button.title = `${formatFullDate(block.date)} · ${formatTime(block.start)} · Tap to edit / log`;
    button.innerHTML = `<span>${block.done ? '✓' : '○'}</span><strong>${escapeHtml(block.title)}</strong><small>${formatTime(block.start)} · ${block.duration}h</small>`;
    column.append(button);
  }
}

function renderWeeklyLog(page: HTMLElement, store: CalendarStore, blocks: CalendarBlock[]) {
  let panel = page.querySelector<HTMLElement>('.calendar-log-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'calendar-log-panel';
    page.append(panel);
  }

  const completed = blocks.filter(block => block.done).length;
  const plannedMinutes = Math.round(blocks.reduce((total, block) => total + block.duration * 60, 0));
  const actualMinutes = blocks.reduce((total, block) => total + (block.actualMinutes ?? 0), 0);
  const goalName = (goalId: string) => goalsCache.find(goal => goal.id === goalId)?.title ?? 'Unlinked';

  panel.innerHTML = `
    <div class="calendar-log-head">
      <div><span>WEEKLY LOG</span><h2>Track what actually happened.</h2><p>Plans stay attached to their week, so past execution remains visible instead of resetting.</p></div>
      <button type="button" class="secondary" data-calendar-add>+ Add / Log Block</button>
    </div>
    <div class="calendar-log-stats">
      <div><strong>${blocks.length}</strong><span>PLANNED</span></div>
      <div><strong>${completed}</strong><span>COMPLETED</span></div>
      <div><strong>${Math.round(plannedMinutes / 6) / 10}h</strong><span>PLANNED TIME</span></div>
      <div><strong>${actualMinutes ? `${Math.round(actualMinutes / 6) / 10}h` : '—'}</strong><span>LOGGED TIME</span></div>
    </div>
    <div class="calendar-log-list">
      ${blocks.length ? blocks.map(block => `
        <button type="button" class="calendar-log-row ${block.done ? 'done' : ''}" data-calendar-edit="${block.id}">
          <span class="calendar-log-status">${block.done ? '✓' : '○'}</span>
          <span class="calendar-log-copy"><strong>${escapeHtml(block.title)}</strong><small>${escapeHtml(goalName(block.goalId))} · ${formatFullDate(block.date)} · ${formatTime(block.start)}</small>${block.logNote ? `<em>${escapeHtml(block.logNote)}</em>` : ''}</span>
          <span class="calendar-log-time"><b>${Math.round(block.duration * 60)}m</b><small>${block.actualMinutes ? `${block.actualMinutes}m actual` : 'not logged'}</small></span>
        </button>`).join('') : '<div class="calendar-log-empty">No blocks for this week yet. Tap an empty calendar slot or add one here.</div>'}
    </div>`;
}

function patchCalendar(force = false) {
  if (patching) return;
  const page = document.querySelector<HTMLElement>('.calendar-page');
  if (!page) return;
  patching = true;
  try {
    captureGoals();
    const store = ensureStore(page);
    const fingerprint = calendarFingerprint(store);
    if (!force && page.dataset.calendarTrackerFingerprint === fingerprint) return;
    page.dataset.calendarTrackerFingerprint = fingerprint;

    const today = isoDate(new Date());
    Array.from(page.querySelectorAll<HTMLElement>('.day-head')).forEach((header, index) => {
      const date = addDays(selectedWeekStart, index);
      const number = header.querySelector<HTMLElement>('span');
      if (number) number.textContent = String(parseDate(date).getDate());
      header.classList.toggle('calendar-today', date === today);
      header.title = formatFullDate(date);
    });

    const heroInfo = page.querySelector<HTMLElement>('.calendar-hero > div');
    if (heroInfo) {
      let meta = heroInfo.querySelector<HTMLElement>('.calendar-strategy-meta');
      if (!meta) {
        meta = document.createElement('div');
        meta.className = 'calendar-strategy-meta';
        heroInfo.append(meta);
      }
      meta.innerHTML = `<span>STRATEGY START · ${formatFullDate(store.strategyStart).toUpperCase()}</span><small>Tap an empty time slot to add · tap a block to edit or log it.</small>`;

      let controls = heroInfo.querySelector<HTMLElement>('.calendar-week-controls');
      if (!controls) {
        controls = document.createElement('div');
        controls.className = 'calendar-week-controls';
        heroInfo.append(controls);
      }
      const atLaunch = selectedWeekStart <= store.strategyStart;
      controls.innerHTML = `<button type="button" data-calendar-week="prev" ${atLaunch ? 'disabled' : ''} aria-label="Previous week">←</button><strong>${formatWeekRange(selectedWeekStart)}</strong><button type="button" data-calendar-week="today">THIS WEEK</button><button type="button" data-calendar-week="next" aria-label="Next week">→</button>`;
    }

    const blocks = weekBlocks(store);
    renderOwnedBlocks(page, blocks);
    renderWeeklyLog(page, store, blocks);
  } finally {
    patching = false;
  }
}

function initialStartHour() {
  const now = new Date();
  if (selectedWeekStart !== mondayOf(now)) return 9;
  const rounded = Math.ceil((now.getHours() + now.getMinutes() / 60) * 2) / 2;
  return Math.min(LAST_HOUR, Math.max(FIRST_HOUR, rounded));
}

function openCalendarBlockDialog(block?: CalendarBlock, initial?: { day?: number; start?: number }) {
  const page = document.querySelector<HTMLElement>('.calendar-page');
  if (!page) return;
  captureGoals();
  const store = ensureStore(page);
  const defaultDay = initial?.day ?? Math.min(6, Math.max(0, dateDayIndex(isoDate(new Date()))));
  const now = new Date().toISOString();
  const draft: CalendarBlock = block ? { ...block } : {
    id: crypto.randomUUID(),
    goalId: goalsCache[0]?.id ?? '',
    day: defaultDay,
    start: initial?.start ?? initialStartHour(),
    duration: 1,
    title: 'Focus block',
    done: false,
    weekStart: selectedWeekStart,
    date: addDays(selectedWeekStart, defaultDay),
    createdAt: now,
    tone: 'blue',
  };

  const dialog = document.createElement('dialog');
  dialog.className = 'modal calendar-edit-dialog';
  dialog.innerHTML = `
    <form method="dialog">
      <div class="modal-head"><div><span class="calendar-dialog-kicker">${block ? 'EDIT + LOG' : 'NEW CALENDAR BLOCK'}</span><h2>${block ? 'Edit calendar block' : 'Add to the week'}</h2></div><button value="cancel" class="icon-btn" type="submit" aria-label="Close">×</button></div>
      <label>Goal<select name="goalId">${goalsCache.length ? goalsCache.map(goal => `<option value="${goal.id}" ${goal.id === draft.goalId ? 'selected' : ''}>${escapeHtml(goal.title)}</option>`).join('') : '<option value="">Unlinked</option>'}</select></label>
      <label>Block title<input name="title" value="${escapeHtml(draft.title)}" required /></label>
      <div class="form-grid three"><label>Date<input type="date" name="date" min="${store.strategyStart}" value="${draft.date}" required /></label><label>Start time<input type="time" name="time" step="900" value="${hourToTime(draft.start)}" required /></label><label>Planned minutes<input type="number" name="plannedMinutes" min="15" max="480" step="15" value="${Math.round(draft.duration * 60)}" required /></label></div>
      <div class="calendar-completion-box"><label class="checkbox-line"><input type="checkbox" name="done" ${draft.done ? 'checked' : ''}/> Completed</label><label>Actual minutes <small>Optional — log what it really took.</small><input type="number" name="actualMinutes" min="1" max="720" step="1" value="${draft.actualMinutes ?? ''}" placeholder="e.g. 55" /></label><label>Session log / reflection <small>What happened? What changed? What should you remember?</small><textarea name="logNote" rows="3" placeholder="Short execution note…">${escapeHtml(draft.logNote ?? '')}</textarea></label></div>
      <div class="modal-actions">${block ? '<button value="delete" class="danger" type="submit">Delete</button>' : '<span></span>'}<div><button value="cancel" class="secondary" type="submit">Cancel</button><button value="save" class="primary" type="submit">Save Block</button></div></div>
    </form>`;

  document.body.append(dialog);
  dialog.showModal();
  dialog.addEventListener('close', () => {
    if (dialog.returnValue === 'delete' && block) {
      store.blocks = store.blocks.filter(candidate => candidate.id !== block.id);
      writeStore(store);
      toast('Calendar block deleted.');
      dialog.remove();
      patchCalendar(true);
      return;
    }

    if (dialog.returnValue === 'save') {
      const form = dialog.querySelector<HTMLFormElement>('form');
      if (!form) return;
      const data = new FormData(form);
      const date = String(data.get('date') ?? draft.date);
      const done = data.get('done') === 'on';
      const wasDone = Boolean(block?.done);
      const actual = Number(data.get('actualMinutes') ?? 0);
      draft.goalId = String(data.get('goalId') ?? '');
      draft.title = String(data.get('title') ?? '').trim() || 'Focus block';
      draft.date = date;
      draft.weekStart = mondayOf(parseDate(date));
      draft.day = dateDayIndex(date);
      draft.start = timeToHour(String(data.get('time') ?? '09:00'));
      draft.duration = Math.max(15, Number(data.get('plannedMinutes') ?? 60)) / 60;
      draft.done = done;
      draft.actualMinutes = actual > 0 ? actual : undefined;
      draft.logNote = String(data.get('logNote') ?? '').trim() || undefined;
      draft.updatedAt = new Date().toISOString();
      draft.completedAt = done ? (wasDone && block?.completedAt ? block.completedAt : new Date().toISOString()) : undefined;

      const index = store.blocks.findIndex(candidate => candidate.id === draft.id);
      if (index >= 0) store.blocks[index] = draft;
      else store.blocks.push(draft);
      writeStore(store);
      selectedWeekStart = draft.weekStart;
      toast(done ? 'Block saved to your execution log.' : 'Calendar block saved.');
      dialog.remove();
      patchCalendar(true);
      return;
    }
    dialog.remove();
  }, { once: true });
}

function moveWeek(direction: 'prev' | 'next' | 'today') {
  const page = document.querySelector<HTMLElement>('.calendar-page');
  if (!page) return;
  const store = ensureStore(page);
  if (direction === 'today') selectedWeekStart = currentWeekStart();
  else {
    const candidate = addDays(selectedWeekStart, direction === 'next' ? 7 : -7);
    selectedWeekStart = candidate < store.strategyStart ? store.strategyStart : candidate;
  }
  patchCalendar(true);
}

document.addEventListener('click', event => {
  const element = event.target as HTMLElement;
  const page = document.querySelector<HTMLElement>('.calendar-page');
  if (!page) return;

  const mainAction = element.closest<HTMLElement>('[data-action="new-block"],[data-action="edit-block"]');
  if (mainAction) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (mainAction.dataset.action === 'new-block') openCalendarBlockDialog();
    else {
      const store = ensureStore(page);
      const block = store.blocks.find(candidate => candidate.id === mainAction.dataset.id);
      if (block) openCalendarBlockDialog(block);
    }
    return;
  }

  const weekControl = element.closest<HTMLElement>('[data-calendar-week]');
  if (weekControl) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const direction = weekControl.dataset.calendarWeek;
    if (direction === 'prev' || direction === 'next' || direction === 'today') moveWeek(direction);
    return;
  }

  const calendarEdit = element.closest<HTMLElement>('[data-calendar-edit]');
  if (calendarEdit) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const store = ensureStore(page);
    const block = store.blocks.find(candidate => candidate.id === calendarEdit.dataset.calendarEdit);
    if (block) openCalendarBlockDialog(block);
    return;
  }

  if (element.closest('[data-calendar-add]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openCalendarBlockDialog();
    return;
  }

  if (element.closest('.plan-block')) return;
  const dayColumn = element.closest<HTMLElement>('.day-col');
  if (!dayColumn) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const columns = Array.from(page.querySelectorAll<HTMLElement>('.day-col'));
  const day = columns.indexOf(dayColumn);
  if (day < 0) return;
  const rect = dayColumn.getBoundingClientRect();
  const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
  const rawHour = FIRST_HOUR + y / HOUR_HEIGHT;
  const start = Math.min(LAST_HOUR, Math.max(FIRST_HOUR, Math.round(rawHour * 2) / 2));
  openCalendarBlockDialog(undefined, { day, start });
}, true);

document.addEventListener('click', event => {
  const nav = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-nav="calendar"]');
  if (!nav) return;
  requestAnimationFrame(() => patchCalendar(true));
});

const observer = new MutationObserver(() => {
  captureGoals();
  if (patchScheduled) return;
  patchScheduled = true;
  requestAnimationFrame(() => {
    patchScheduled = false;
    patchCalendar();
  });
});
observer.observe(document.documentElement, { childList: true, subtree: true });

captureGoals();
strategyStart();
patchCalendar();
