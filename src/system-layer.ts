import './system-layer.css';

type WeekStart = 'monday' | 'sunday';

type AccountPrefs = {
  name: string;
  role: string;
  email: string;
  maxDailyPriorities: number;
  lowEnergyMinutes: number;
  weekStart: WeekStart;
};

type WeeklyReview = {
  weekKey: string;
  wins: string;
  friction: string;
  nextWeek: string;
  score: number;
};

type FocusItem = {
  id: string;
  title: string;
  done: boolean;
};

type DailyFocus = {
  date: string;
  lowEnergy: boolean;
  items: FocusItem[];
};

const ACCOUNT_KEY = 'oncheck-account-v2';
const REVIEW_KEY = 'oncheck-weekly-review-v2';
const FOCUS_KEY = 'oncheck-daily-focus-v2';
const CORE_STATE_KEY = 'oncheck-state-v1';

const defaultAccount: AccountPrefs = {
  name: 'James',
  role: 'Personal OS',
  email: '',
  maxDailyPriorities: 3,
  lowEnergyMinutes: 60,
  weekStart: 'monday',
};

let account = readJson<AccountPrefs>(ACCOUNT_KEY, defaultAccount);
let patchPending = false;
let replayingGoalAction = false;
let preActionSave = false;

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(start: WeekStart) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const delta = start === 'monday' ? (day === 0 ? -6 : 1 - day) : -day;
  date.setDate(date.getDate() + delta);
  return date;
}

function currentWeekKey() {
  const date = startOfWeek(account.weekStart);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(fallback);
    return { ...structuredClone(fallback), ...JSON.parse(raw) } as T;
  } catch {
    return structuredClone(fallback);
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
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

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function toast(message: string) {
  document.querySelector('.system-toast')?.remove();
  const node = document.createElement('div');
  node.className = 'system-toast';
  node.textContent = message;
  document.body.append(node);
  requestAnimationFrame(() => node.classList.add('show'));
  window.setTimeout(() => {
    node.classList.remove('show');
    window.setTimeout(() => node.remove(), 220);
  }, 1700);
}

function schedulePatch() {
  if (patchPending) return;
  patchPending = true;
  requestAnimationFrame(() => {
    patchPending = false;
    patchShell();
  });
}

function patchShell() {
  const profile = document.querySelector<HTMLElement>('.profile');
  if (profile) {
    profile.dataset.systemSettings = '1';
    profile.setAttribute('role', 'button');
    profile.setAttribute('tabindex', '0');
    profile.setAttribute('aria-label', 'Open ONCHECK account settings');
    const name = profile.querySelector<HTMLElement>('strong');
    const role = profile.querySelector<HTMLElement>('span');
    if (name) name.textContent = account.name || 'Account';
    if (role) role.textContent = account.role || 'Personal OS';
  }

  const greetingNode = document.querySelector<HTMLElement>('.hero-copy h1');
  if (greetingNode) greetingNode.textContent = `${greeting()}, ${account.name || 'James'}.`;

  const nav = document.querySelector<HTMLElement>('.sidebar nav');
  if (nav && !nav.querySelector('.oncheck-system-nav')) {
    const settings = document.createElement('button');
    settings.type = 'button';
    settings.className = 'nav-btn oncheck-system-nav';
    settings.dataset.systemSettings = '1';
    settings.setAttribute('aria-label', 'Account settings');
    settings.innerHTML = '<span>⌁</span>Settings';
    nav.append(settings);
  }

  const focusCard = document.querySelector<HTMLElement>('.focus-card');
  if (focusCard) {
    focusCard.dataset.systemFocus = '1';
    focusCard.setAttribute('role', 'button');
    focusCard.setAttribute('tabindex', '0');
    focusCard.setAttribute('aria-label', "Open today's focus list");
    focusCard.setAttribute('title', "Open today's focus");
  }
}

function weeklyReview(): WeeklyReview {
  const fallback: WeeklyReview = {
    weekKey: currentWeekKey(),
    wins: '',
    friction: '',
    nextWeek: '',
    score: 0,
  };
  const saved = readJson<WeeklyReview>(REVIEW_KEY, fallback);
  return saved.weekKey === currentWeekKey() ? saved : fallback;
}

function dailyFocus(): DailyFocus {
  const fallback: DailyFocus = { date: todayKey(), lowEnergy: false, items: [] };
  const saved = readJson<DailyFocus>(FOCUS_KEY, fallback);
  if (saved.date !== todayKey()) return fallback;
  saved.items = Array.isArray(saved.items) ? saved.items.slice(0, Math.max(1, account.maxDailyPriorities)) : [];
  return saved;
}

function openSettings() {
  document.querySelector<HTMLDialogElement>('.system-dialog')?.close();
  const review = weeklyReview();
  const dialog = document.createElement('dialog');
  dialog.className = 'system-dialog';
  dialog.innerHTML = `
    <div class="system-panel">
      <header class="system-head">
        <div><span>ONCHECK / ACCOUNT</span><h2>Settings</h2><p>Local account, execution rules, weekly review and backup. Nothing here changes the dashboard design.</p></div>
        <button class="system-close" type="button" aria-label="Close">×</button>
      </header>
      <div class="system-body">
        <nav class="system-tabs" aria-label="Settings sections">
          <button class="system-tab active" type="button" data-system-tab="account">Account</button>
          <button class="system-tab" type="button" data-system-tab="execution">Execution</button>
          <button class="system-tab" type="button" data-system-tab="review">Weekly Review</button>
          <button class="system-tab" type="button" data-system-tab="data">Data</button>
        </nav>

        <section class="system-section active" data-system-section="account">
          <h3>Local account</h3><p>This is your ONCHECK identity on this device. Cloud login is not being faked here.</p>
          <form id="system-account-form">
            <div class="system-grid">
              <label class="system-field">Display name<input name="name" required value="${escapeHtml(account.name)}"></label>
              <label class="system-field">Role / label<input name="role" value="${escapeHtml(account.role)}"></label>
            </div>
            <label class="system-field">Email (optional)<input name="email" type="email" value="${escapeHtml(account.email)}" placeholder="you@example.com"></label>
            <div class="system-actions"><button class="system-button primary" type="submit">Save Account</button></div>
          </form>
        </section>

        <section class="system-section" data-system-section="execution">
          <h3>Execution rules</h3><p>Keep the system realistic: cap daily priorities and define what still counts on a low-energy day.</p>
          <form id="system-execution-form">
            <div class="system-grid three">
              <label class="system-field">Daily priority cap<input name="maxDailyPriorities" type="number" min="1" max="5" value="${account.maxDailyPriorities}"></label>
              <label class="system-field">Low-energy floor (min)<input name="lowEnergyMinutes" type="number" min="15" max="180" step="5" value="${account.lowEnergyMinutes}"></label>
              <label class="system-field">Week starts<select name="weekStart"><option value="monday" ${account.weekStart === 'monday' ? 'selected' : ''}>Monday</option><option value="sunday" ${account.weekStart === 'sunday' ? 'selected' : ''}>Sunday</option></select></label>
            </div>
            <div class="system-actions"><button class="system-button primary" type="submit">Save Execution Rules</button></div>
          </form>
        </section>

        <section class="system-section" data-system-section="review">
          <h3>Weekly review</h3><p>One short review per week: what moved, what created friction, and what changes next.</p>
          <form id="system-review-form">
            <label class="system-field">What moved forward?<textarea name="wins" placeholder="Wins, completed work, evidence of progress…">${escapeHtml(review.wins)}</textarea></label>
            <label class="system-field">What created friction?<textarea name="friction" placeholder="Distraction, timing, overload, unclear next action…">${escapeHtml(review.friction)}</textarea></label>
            <label class="system-field">What changes next week?<textarea name="nextWeek" placeholder="Keep it to one or two actual system changes.">${escapeHtml(review.nextWeek)}</textarea></label>
            <label class="system-field">Week score</label>
            <div class="system-score">${[1,2,3,4,5].map(score => `<label><input type="radio" name="score" value="${score}" ${review.score === score ? 'checked' : ''}><span>${score}</span></label>`).join('')}</div>
            <div class="system-actions"><button class="system-button primary" type="submit">Save Weekly Review</button></div>
          </form>
        </section>

        <section class="system-section" data-system-section="data">
          <h3>Data & backup</h3><p>Core ONCHECK state, account preferences, focus and reviews can be moved between browsers with a JSON backup.</p>
          <div class="system-actions" style="justify-content:flex-start;flex-wrap:wrap">
            <button class="system-button" type="button" data-system-export>Export JSON Backup</button>
            <button class="system-button" type="button" data-system-import>Import JSON Backup</button>
          </div>
          <p class="system-note">Uploaded image/video blobs live in IndexedDB and are not included in this JSON backup. Keep important originals outside ONCHECK.</p>
        </section>
      </div>
    </div>`;

  document.body.append(dialog);
  dialog.querySelector<HTMLButtonElement>('.system-close')?.addEventListener('click', () => dialog.close());

  dialog.querySelectorAll<HTMLButtonElement>('[data-system-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const target = button.dataset.systemTab;
      dialog.querySelectorAll('.system-tab').forEach(node => node.classList.toggle('active', node === button));
      dialog.querySelectorAll<HTMLElement>('[data-system-section]').forEach(section => section.classList.toggle('active', section.dataset.systemSection === target));
    });
  });

  dialog.querySelector<HTMLFormElement>('#system-account-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    account.name = String(data.get('name') ?? '').trim() || 'James';
    account.role = String(data.get('role') ?? '').trim() || 'Personal OS';
    account.email = String(data.get('email') ?? '').trim();
    writeJson(ACCOUNT_KEY, account);
    patchShell();
    toast('Account settings saved.');
  });

  dialog.querySelector<HTMLFormElement>('#system-execution-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    account.maxDailyPriorities = Math.min(5, Math.max(1, Number(data.get('maxDailyPriorities') ?? 3)));
    account.lowEnergyMinutes = Math.min(180, Math.max(15, Number(data.get('lowEnergyMinutes') ?? 60)));
    account.weekStart = data.get('weekStart') === 'sunday' ? 'sunday' : 'monday';
    writeJson(ACCOUNT_KEY, account);
    const focus = dailyFocus();
    focus.items = focus.items.slice(0, account.maxDailyPriorities);
    writeJson(FOCUS_KEY, focus);
    toast('Execution rules saved.');
  });

  dialog.querySelector<HTMLFormElement>('#system-review-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const saved: WeeklyReview = {
      weekKey: currentWeekKey(),
      wins: String(data.get('wins') ?? '').trim(),
      friction: String(data.get('friction') ?? '').trim(),
      nextWeek: String(data.get('nextWeek') ?? '').trim(),
      score: Math.min(5, Math.max(0, Number(data.get('score') ?? 0))),
    };
    writeJson(REVIEW_KEY, saved);
    toast('Weekly review saved.');
  });

  dialog.querySelector('[data-system-export]')?.addEventListener('click', exportBackup);
  dialog.querySelector('[data-system-import]')?.addEventListener('click', importBackup);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.showModal();
}

function openFocus() {
  const focus = dailyFocus();
  const dialog = document.createElement('dialog');
  dialog.className = 'focus-dialog';
  dialog.innerHTML = `
    <div class="system-panel">
      <header class="system-head"><div><span>TODAY / EXECUTION</span><h2>Today's Focus</h2><p>Maximum ${account.maxDailyPriorities} priorities. The point is to finish, not continuously add.</p></div><button class="system-close" type="button" aria-label="Close">×</button></header>
      <div class="system-body">
        <div class="focus-meta"><span>${new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}</span><label class="focus-low"><input type="checkbox" data-focus-low ${focus.lowEnergy ? 'checked' : ''}> Low-energy day · ${account.lowEnergyMinutes} min floor</label></div>
        <div class="focus-list"></div>
        <div class="focus-add"><input type="text" maxlength="120" placeholder="Add the next concrete action…" data-focus-new><button class="system-button primary" type="button" data-focus-add>Add Priority</button></div>
        <div class="system-actions"><button class="system-button primary" type="button" data-focus-done>Done</button></div>
      </div>
    </div>`;
  document.body.append(dialog);

  const list = dialog.querySelector<HTMLElement>('.focus-list')!;
  const newInput = dialog.querySelector<HTMLInputElement>('[data-focus-new]')!;

  const persist = () => writeJson(FOCUS_KEY, focus);
  const renderRows = () => {
    list.innerHTML = focus.items.length ? focus.items.map(item => `
      <div class="focus-row ${item.done ? 'done' : ''}" data-focus-id="${item.id}">
        <button class="focus-check" type="button" data-focus-check="${item.id}">${item.done ? '✓' : ''}</button>
        <input type="text" value="${escapeHtml(item.title)}" maxlength="120" data-focus-title="${item.id}" aria-label="Priority">
        <button class="focus-delete" type="button" data-focus-delete="${item.id}" aria-label="Delete priority">⌫</button>
      </div>`).join('') : '<p class="system-note">No priorities yet. Add the one action that matters most first.</p>';
  };

  const add = () => {
    const title = newInput.value.trim();
    if (!title) return;
    if (focus.items.length >= account.maxDailyPriorities) {
      toast(`Daily priority cap is ${account.maxDailyPriorities}. Finish or remove one first.`);
      return;
    }
    focus.items.push({ id: uid(), title, done: false });
    newInput.value = '';
    persist();
    renderRows();
  };

  renderRows();
  dialog.querySelector<HTMLButtonElement>('.system-close')?.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-focus-done]')?.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-focus-add]')?.addEventListener('click', add);
  newInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); add(); } });
  dialog.querySelector<HTMLInputElement>('[data-focus-low]')?.addEventListener('change', event => {
    focus.lowEnergy = (event.currentTarget as HTMLInputElement).checked;
    persist();
  });

  list.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-focus-check],[data-focus-delete]');
    if (!button) return;
    const checkId = button.dataset.focusCheck;
    const deleteId = button.dataset.focusDelete;
    if (checkId) {
      const item = focus.items.find(candidate => candidate.id === checkId);
      if (item) item.done = !item.done;
    }
    if (deleteId) focus.items = focus.items.filter(item => item.id !== deleteId);
    persist();
    renderRows();
  });

  list.addEventListener('input', event => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>('[data-focus-title]');
    if (!input) return;
    const item = focus.items.find(candidate => candidate.id === input.dataset.focusTitle);
    if (item) {
      item.title = input.value;
      persist();
    }
  });

  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.showModal();
}

function exportBackup() {
  const localData: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith('oncheck-')) continue;
    const value = localStorage.getItem(key);
    if (value !== null) localData[key] = value;
  }
  const payload = {
    product: 'ONCHECK',
    version: 2,
    exportedAt: new Date().toISOString(),
    localStorage: localData,
    mediaIncluded: false,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `oncheck-backup-${todayKey()}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  toast('Backup exported.');
}

function importBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text()) as { product?: string; localStorage?: Record<string, string> };
      if (payload.product !== 'ONCHECK' || !payload.localStorage || typeof payload.localStorage !== 'object') throw new Error('Invalid ONCHECK backup.');
      if (!confirm('Import this ONCHECK backup? Current core local data on this device will be replaced.')) return;
      const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((key): key is string => Boolean(key?.startsWith('oncheck-')));
      keys.forEach(key => localStorage.removeItem(key));
      Object.entries(payload.localStorage).forEach(([key, value]) => {
        if (key.startsWith('oncheck-') && typeof value === 'string') localStorage.setItem(key, value);
      });
      location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not import this backup.');
    }
  });
  input.click();
}

function goalActionSelector(element: HTMLElement) {
  const nav = element.dataset.nav;
  if (nav) return `[data-nav="${CSS.escape(nav)}"]`;
  const action = element.dataset.action;
  if (!action) return '';
  let selector = `[data-action="${CSS.escape(action)}"]`;
  for (const key of ['id', 'goal', 'task']) {
    const value = element.dataset[key];
    if (value) selector += `[data-${key}="${CSS.escape(value)}"]`;
  }
  return selector;
}

const actionsThatRerenderGoalEditor = new Set([
  'add-task',
  'toggle-task',
  'delete-task',
  'duplicate-goal',
  'delete-goal',
  'goal-cover',
  'upload-media',
]);

/*
  The original editor keeps form values in the DOM until Save Changes is submitted.
  Any checklist/media action rerenders the page, so we commit the form first and then
  replay the user's intended action. This fixes the disappearing-edit bug without
  rewriting the original dashboard or its state architecture.
*/
document.addEventListener('click', event => {
  if (replayingGoalAction) return;
  const element = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-nav],[data-action]');
  const form = document.querySelector<HTMLFormElement>('#goalForm');
  if (!element || !form) return;

  const shouldCommitFirst = Boolean(element.dataset.nav) || actionsThatRerenderGoalEditor.has(element.dataset.action ?? '');
  if (!shouldCommitFirst) return;

  const selector = goalActionSelector(element);
  if (!selector) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  preActionSave = true;
  form.requestSubmit();
  preActionSave = false;

  queueMicrotask(() => {
    const replayTarget = document.querySelector<HTMLElement>(selector);
    if (!replayTarget) return;
    replayingGoalAction = true;
    replayTarget.click();
    replayingGoalAction = false;
  });
}, true);

document.addEventListener('submit', event => {
  const form = event.target as HTMLFormElement | null;
  if (form?.id !== 'goalForm' || preActionSave) return;
  window.setTimeout(() => toast('Goal changes saved.'), 0);
}, true);

document.addEventListener('click', event => {
  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-system-settings],[data-system-focus]');
  if (!target) return;
  if (target.dataset.systemSettings) {
    event.preventDefault();
    openSettings();
  } else if (target.dataset.systemFocus) {
    event.preventDefault();
    openFocus();
  }
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const target = event.target as HTMLElement | null;
  if (target?.dataset.systemSettings) {
    event.preventDefault();
    openSettings();
  } else if (target?.dataset.systemFocus) {
    event.preventDefault();
    openFocus();
  }
});

const observer = new MutationObserver(schedulePatch);
observer.observe(document.documentElement, { childList: true, subtree: true });

/* Make sure old v2 account values, if present from the failed pass, are not lost. */
try {
  if (!localStorage.getItem(ACCOUNT_KEY)) {
    const legacy = JSON.parse(localStorage.getItem(CORE_STATE_KEY) ?? '{}') as { account?: Partial<AccountPrefs> };
    if (legacy.account) {
      account = { ...defaultAccount, ...legacy.account };
      writeJson(ACCOUNT_KEY, account);
    }
  }
} catch {
  // Keep defaults when legacy state is malformed.
}

schedulePatch();
