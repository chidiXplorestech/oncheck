import './calendar-layer.css';

type CalendarBlock = {
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
};

type CoreGoal = {
  id: string;
  title: string;
};

type CoreState = {
  goals: CoreGoal[];
  blocks: CalendarBlock[];
  media?: string[];
};

const CORE_KEY = 'oncheck-state-v1';
const STRATEGY_START_KEY = 'oncheck-strategy-start-v1';
const STRATEGY_START = '2026-08-10';
const HOUR_HEIGHT = 56;
const FIRST_HOUR = 6;
const LAST_HOUR = 21;

let selectedWeekStart = currentWeekStart();
let patchScheduled = false;

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

function readCoreState(): CoreState | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(CORE_KEY) ?? 'null') as CoreState | null;
    if (!parsed || !Array.isArray(parsed.blocks) || !Array.isArray(parsed.goals)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCoreState(state: CoreState) {
  localStorage.setItem(CORE_KEY, JSON.stringify(state));
}

function strategyStart() {
  if (!localStorage.getItem(STRATEGY_START_KEY)) localStorage.setItem(STRATEGY_START_KEY, STRATEGY_START);
  return localStorage.getItem(STRATEGY_START_KEY) ?? STRATEGY_START;
}

function migrateBlocks(state: CoreState) {
  const launchWeek = strategyStart();
  let changed = false;

  for (const block of state.blocks) {
    if (!block.weekStart) {
      block.weekStart = launchWeek;
      changed = true;
    }
    if (!block.date) {
      block.date = addDays(block.weekStart, Math.min(6, Math.max(0, Number(block.day) || 0)));
      changed = true;
    }
    if (!block.createdAt) {
      block.createdAt = `${block.date}T09:00:00.000Z`;
      changed = true;
    }
  }

  if (changed) writeCoreState(state);
  return changed;
}

function formatWeekRange(start: string) {
  const first = parseDate(start);
  const last = parseDate(addDays(start, 6));
  const sameMonth = first.getMonth() === last.getMonth();
  const firstText = first.toLocaleDateString('en-GB', sameMonth
    ? { day: '2-digit' }
    : { day: '2-digit', month: 'short' });
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

function weekBlocks(state: CoreState) {
  return state.blocks
    .filter(block => block.weekStart === selectedWeekStart)
    .sort((a, b) => (a.day - b.day) || (a.start - b.start));
}

function refreshCalendar() {
  const calendarNav = document.querySelector<HTMLButtonElement>('[data-nav="calendar"]');
  if (calendarNav) calendarNav.click();
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

function patchCalendar() {
  const page = document.querySelector<HTMLElement>('.calendar-page');
  if (!page) return;
  const state = readCoreState();
  if (!state) return;
  migrateBlocks(state);

  const blocks = weekBlocks(state);
  const fingerprint = `${selectedWeekStart}:${state.blocks.map(block => [block.id, block.weekStart, block.date, block.start, block.duration, block.done, block.actualMinutes, block.logNote].join(':')).join('|')}`;
  if (page.dataset.calendarLayerFingerprint === fingerprint) return;
  page.dataset.calendarLayerFingerprint = fingerprint;

  const today = isoDate(new Date());
  const headers = Array.from(page.querySelectorAll<HTMLElement>('.day-head'));
  headers.forEach((header, index) => {
    const date = addDays(selectedWeekStart, index);
    const dayNumber = header.querySelector<HTMLElement>('span');
    if (dayNumber) dayNumber.textContent = String(parseDate(date).getDate());
    header.classList.toggle('calendar-today', date === today);
    header.title = formatFullDate(date);
  });

  for (const element of page.querySelectorAll<HTMLElement>('.plan-block[data-id]')) {
    const block = state.blocks.find(candidate => candidate.id === element.dataset.id);
    element.hidden = !block || block.weekStart !== selectedWeekStart;
    if (block?.date) element.title = `${formatFullDate(block.date)} · ${formatTime(block.start)} · Tap to edit / log`;
  }

  const heroInfo = page.querySelector<HTMLElement>('.calendar-hero > div');
  if (heroInfo) {
    let meta = heroInfo.querySelector<HTMLElement>('.calendar-strategy-meta');
    if (!meta) {
      meta = document.createElement('div');
      meta.className = 'calendar-strategy-meta';
      heroInfo.append(meta);
    }
    meta.innerHTML = `<span>STRATEGY START · ${formatFullDate(strategyStart()).toUpperCase()}</span><small>Tap an empty time slot to add · tap a block to edit or log it.</small>`;

    let controls = heroInfo.querySelector<HTMLElement>('.calendar-week-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'calendar-week-controls';
      heroInfo.append(controls);
    }
    const atLaunch = selectedWeekStart <= strategyStart();
    controls.innerHTML = `
      <button type="button" data-calendar-week="prev" ${atLaunch ? 'disabled' : ''} aria-label="Previous week">←</button>
      <strong>${formatWeekRange(selectedWeekStart)}</strong>
      <button type="button" data-calendar-week="today">THIS WEEK</button>
      <button type="button" data-calendar-week="next" aria-label="Next week">→</button>`;
  }

  renderWeeklyLog(page, state, blocks);
}

function renderWeeklyLog(page: HTMLElement, state: CoreState, blocks: CalendarBlock[]) {
  let panel = page.querySelector<HTMLElement>('.calendar-log-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'calendar-log-panel';
    page.append(panel);
  }

  const completed = blocks.filter(block => block.done).length;
  const plannedMinutes = Math.round(blocks.reduce((total, block) => total + block.duration * 60, 0));
  const actualMinutes = blocks.reduce((total, block) => total + (block.actualMinutes ?? 0), 0);
  const goalName = (goalId: string) => state.goals.find(goal => goal.id === goalId)?.title ?? 'Unlinked';

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
          <span class="calendar-log-copy"><strong>${escapeHtml(block.title)}</strong><small>${escapeHtml(goalName(block.goalId))} · ${block.date ? formatFullDate(block.date) : ''} · ${formatTime(block.start)}</small>${block.logNote ? `<em>${escapeHtml(block.logNote)}</em>` : ''}</span>
          <span class="calendar-log-time"><b>${Math.round(block.duration * 60)}m</b><small>${block.actualMinutes ? `${block.actualMinutes}m actual` : 'not logged'}</small></span>
        </button>`).join('') : '<div class="calendar-log-empty">No blocks for this week yet. Tap an empty calendar slot or add one here.</div>'}
    </div>`;
}

function initialStartHour() {
  const now = new Date();
  if (selectedWeekStart !== mondayOf(now)) return 9;
  const rounded = Math.ceil((now.getHours() + now.getMinutes() / 60) * 2) / 2;
  return Math.min(LAST_HOUR, Math.max(FIRST_HOUR, rounded));
}

function openCalendarBlockDialog(block?: CalendarBlock, initial?: { day?: number; start?: number }) {
  const state = readCoreState();
  if (!state) return;
  migrateBlocks(state);

  const now = new Date().toISOString();
  const draft: CalendarBlock = block ? { ...block } : {
    id: crypto.randomUUID(),
    goalId: state.goals[0]?.id ?? '',
    day: initial?.day ?? Math.min(6, Math.max(0, dateDayIndex(isoDate(new Date())))),
    start: initial?.start ?? initialStartHour(),
    duration: 1,
    title: 'Focus block',
    done: false,
    weekStart: selectedWeekStart,
    date: addDays(selectedWeekStart, initial?.day ?? Math.min(6, Math.max(0, dateDayIndex(isoDate(new Date()))))),
    createdAt: now,
  };

  const date = draft.date ?? addDays(draft.weekStart ?? selectedWeekStart, draft.day);
  const dialog = document.createElement('dialog');
  dialog.className = 'modal calendar-edit-dialog';
  dialog.innerHTML = `
    <form method="dialog">
      <div class="modal-head"><div><span class="calendar-dialog-kicker">${block ? 'EDIT + LOG' : 'NEW CALENDAR BLOCK'}</span><h2>${block ? 'Edit calendar block' : 'Add to the week'}</h2></div><button value="cancel" class="icon-btn" type="submit" aria-label="Close">×</button></div>
      <label>Goal<select name="goalId">${state.goals.map(goal => `<option value="${goal.id}" ${goal.id === draft.goalId ? 'selected' : ''}>${escapeHtml(goal.title)}</option>`).join('')}</select></label>
      <label>Block title<input name="title" value="${escapeHtml(draft.title)}" required /></label>
      <div class="form-grid three">
        <label>Date<input type="date" name="date" min="${strategyStart()}" value="${date}" required /></label>
        <label>Start time<input type="time" name="time" step="900" value="${hourToTime(draft.start)}" required /></label>
        <label>Planned minutes<input type="number" name="plannedMinutes" min="15" max="480" step="15" value="${Math.round(draft.duration * 60)}" required /></label>
      </div>
      <div class="calendar-completion-box">
        <label class="checkbox-line"><input type="checkbox" name="done" ${draft.done ? 'checked' : ''}/> Completed</label>
        <label>Actual minutes <small>Optional — log what it really took.</small><input type="number" name="actualMinutes" min="1" max="720" step="1" value="${draft.actualMinutes ?? ''}" placeholder="e.g. 55" /></label>
        <label>Session log / reflection <small>What happened? What changed? What should you remember?</small><textarea name="logNote" rows="3" placeholder="Short execution note…">${escapeHtml(draft.logNote ?? '')}</textarea></label>
      </div>
      <div class="modal-actions">${block ? '<button value="delete" class="danger" type="submit">Delete</button>' : '<span></span>'}<div><button value="cancel" class="secondary" type="submit">Cancel</button><button value="save" class="primary" type="submit">Save Block</button></div></div>
    </form>`;

  document.body.append(dialog);
  dialog.showModal();
  dialog.addEventListener('close', () => {
    if (dialog.returnValue === 'delete' && block) {
      state.blocks = state.blocks.filter(candidate => candidate.id !== block.id);
      writeCoreState(state);
      toast('Calendar block deleted.');
      dialog.remove();
      refreshCalendar();
      return;
    }

    if (dialog.returnValue === 'save') {
      const form = dialog.querySelector<HTMLFormElement>('form');
      if (!form) return;
      const data = new FormData(form);
      const blockDate = String(data.get('date') ?? date);
      const wasDone = Boolean(block?.done);
      const done = data.get('done') === 'on';
      const actual = Number(data.get('actualMinutes') ?? 0);

      draft.goalId = String(data.get('goalId') ?? '');
      draft.title = String(data.get('title') ?? '').trim() || 'Focus block';
      draft.date = blockDate;
      draft.weekStart = mondayOf(parseDate(blockDate));
      draft.day = dateDayIndex(blockDate);
      draft.start = timeToHour(String(data.get('time') ?? '09:00'));
      draft.duration = Math.max(15, Number(data.get('plannedMinutes') ?? 60)) / 60;
      draft.done = done;
      draft.actualMinutes = actual > 0 ? actual : undefined;
      draft.logNote = String(data.get('logNote') ?? '').trim() || undefined;
      draft.updatedAt = new Date().toISOString();
      draft.completedAt = done ? (wasDone && block?.completedAt ? block.completedAt : new Date().toISOString()) : undefined;

      if (block) {
        Object.assign(block, draft);
      } else {
        state.blocks.push(draft);
      }
      writeCoreState(state);
      selectedWeekStart = draft.weekStart;
      toast(done ? 'Block saved to your execution log.' : 'Calendar block saved.');
      dialog.remove();
      refreshCalendar();
      return;
    }

    dialog.remove();
  }, { once: true });
}

function weekMove(direction: 'prev' | 'next' | 'today') {
  if (direction === 'today') {
    selectedWeekStart = currentWeekStart();
  } else {
    const candidate = addDays(selectedWeekStart, direction === 'next' ? 7 : -7);
    selectedWeekStart = candidate < strategyStart() ? strategyStart() : candidate;
  }
  refreshCalendar();
}

document.addEventListener('click', event => {
  const element = event.target as HTMLElement;
  const calendarPage = document.querySelector('.calendar-page');
  if (!calendarPage) return;

  const mainAction = element.closest<HTMLElement>('[data-action="new-block"],[data-action="edit-block"]');
  if (mainAction) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (mainAction.dataset.action === 'new-block') {
      openCalendarBlockDialog();
      return;
    }
    const state = readCoreState();
    const block = state?.blocks.find(candidate => candidate.id === mainAction.dataset.id);
    if (block) openCalendarBlockDialog(block);
    return;
  }

  const weekControl = element.closest<HTMLButtonElement>('[data-calendar-week]');
  if (weekControl) {
    event.preventDefault();
    const direction = weekControl.dataset.calendarWeek;
    if (direction === 'prev' || direction === 'next' || direction === 'today') weekMove(direction);
    return;
  }

  const logEdit = element.closest<HTMLElement>('[data-calendar-edit]');
  if (logEdit) {
    event.preventDefault();
    const state = readCoreState();
    const block = state?.blocks.find(candidate => candidate.id === logEdit.dataset.calendarEdit);
    if (block) openCalendarBlockDialog(block);
    return;
  }

  if (element.closest('[data-calendar-add]')) {
    event.preventDefault();
    openCalendarBlockDialog();
    return;
  }

  if (element.closest('.plan-block')) return;
  const dayColumn = element.closest<HTMLElement>('.day-col');
  if (dayColumn) {
    event.preventDefault();
    const columns = Array.from(document.querySelectorAll<HTMLElement>('.calendar-page .day-col'));
    const day = columns.indexOf(dayColumn);
    if (day < 0) return;
    const rect = dayColumn.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const rawHour = FIRST_HOUR + y / HOUR_HEIGHT;
    const start = Math.min(LAST_HOUR, Math.max(FIRST_HOUR, Math.round(rawHour * 2) / 2));
    openCalendarBlockDialog(undefined, { day, start });
  }
}, true);

const observer = new MutationObserver(() => {
  if (patchScheduled) return;
  patchScheduled = true;
  requestAnimationFrame(() => {
    patchScheduled = false;
    patchCalendar();
  });
});

observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', patchCalendar);
patchCalendar();
