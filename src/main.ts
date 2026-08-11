import './styles.css';

type GoalStatus = 'active' | 'on-hold' | 'completed';
type Priority = 'low' | 'medium' | 'high';

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

type AppState = {
  goals: Goal[];
  blocks: PlanBlock[];
  media: string[];
};

const STORAGE_KEY = 'oncheck-state-v1';
const uid = () => crypto.randomUUID();

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
    { id: 'training', title: 'Training', category: 'Health', status: 'active', priority: 'medium', cadence: '5× weekly', targetDate: '2029-12-31', notes: 'Make training a staple and build sustainable strength and muscle.', tasks: [
      { id: uid(), title: 'Full-body intensive routine', done: true },
      { id: uid(), title: 'Progressive overload', done: false },
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
    { id: uid(), goalId: 'training', day: 0, start: 6, duration: 1.25, title: 'Training', done: false },
    { id: uid(), goalId: 'academics', day: 0, start: 8, duration: 2, title: 'Academics', done: false },
    { id: uid(), goalId: 'coding', day: 0, start: 13, duration: 1.5, title: 'Coding', done: false },
    { id: uid(), goalId: 'content', day: 1, start: 18, duration: 1.5, title: 'Content', done: false },
    { id: uid(), goalId: 'investing', day: 2, start: 16, duration: 1, title: 'Money review', done: false },
    { id: uid(), goalId: 'driving', day: 3, start: 18, duration: 1, title: 'Driving theory', done: false },
    { id: uid(), goalId: 'study-abroad', day: 5, start: 10, duration: 1.5, title: 'Study Abroad', done: false },
  ],
  media: [],
};

let state: AppState = load();
let view: 'overview' | 'goals' | 'calendar' | 'media' = 'overview';
let selectedGoalId = state.goals[0]?.id ?? '';
let filter: 'all' | GoalStatus = 'all';

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : structuredClone(seeded);
  } catch {
    return structuredClone(seeded);
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function progress(goal: Goal) {
  if (!goal.tasks.length) return 0;
  return Math.round((goal.tasks.filter(t => t.done).length / goal.tasks.length) * 100);
}

function esc(value: string) {
  return value.replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch));
}

function goalTone(goal: Goal) {
  const tones = ['blue', 'violet', 'green', 'amber', 'coral', 'cyan'];
  return tones[Math.abs([...goal.id].reduce((a, c) => a + c.charCodeAt(0), 0)) % tones.length];
}

function icon(name: string) {
  const icons: Record<string, string> = {
    overview: '◫', goals: '◎', focus: '◉', calendar: '▦', media: '▧', plus: '+', more: '•••', check: '✓', edit: '✎', trash: '⌫', upload: '↑', reset: '↺'
  };
  return icons[name] ?? '•';
}

function layout(content: string) {
  return `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">ONCHECK</div>
        <nav>
          ${navButton('overview', 'Overview')}
          ${navButton('goals', 'Goals')}
          ${navButton('calendar', 'Calendar')}
          ${navButton('media', 'Media')}
        </nav>
        <div class="side-quote"><i></i>That dream was planted in your heart for a reason, chase it.</div>
        <div class="profile"><div class="avatar"></div><div><strong>James</strong><span>Personal OS</span></div></div>
      </aside>
      <main class="workspace">${content}</main>
    </div>`;
}

function navButton(target: typeof view, label: string) {
  return `<button class="nav-btn ${view === target ? 'active' : ''}" data-nav="${target}"><span>${icon(target)}</span>${label}</button>`;
}

function overviewView() {
  const filtered = state.goals.filter(g => filter === 'all' ? true : g.status === filter);
  const overall = state.goals.length ? Math.round(state.goals.reduce((n, g) => n + progress(g), 0) / state.goals.length) : 0;
  const focus = state.goals.find(g => g.id === selectedGoalId) ?? state.goals[0];
  return layout(`
    <section class="hero">
      <div class="hero-blur"></div>
      <div class="hero-copy"><h1>Good evening, James.</h1><p>STAY FOCUSED. RISK IT FOR THE PLOT.</p></div>
    </section>
    <div class="overview-grid">
      <section class="goal-panel">
        <div class="toolbar">
          <div class="tabs">
            ${tab('all','All Goals')}${tab('active','Active')}${tab('on-hold','On Hold')}${tab('completed','Completed')}
          </div>
          <button class="primary" data-action="new-goal">${icon('plus')} New Goal</button>
        </div>
        <div class="goal-list">${filtered.map(goalRow).join('')}</div>
      </section>
      <aside class="right-rail">
        ${focus ? `<section class="focus-card tone-${goalTone(focus)}"><div class="focus-art"></div><div class="focus-overlay"><span>Current Focus</span><h2>${esc(focus.title)}</h2><p>${esc(focus.notes)}</p><div class="ring" style="--p:${progress(focus)}">${progress(focus)}%</div></div></section>` : ''}
        <section class="side-card"><div class="side-title"><h3>Progress Overview</h3><strong>${overall}%</strong></div><div class="long-bar"><i style="width:${overall}%"></i></div><div class="stats"><div><b>${state.goals.filter(g=>g.status==='completed').length}</b><span>Completed</span></div><div><b>${state.goals.filter(g=>g.status==='active').length}</b><span>Active</span></div><div><b>${state.goals.filter(g=>g.status==='on-hold').length}</b><span>On Hold</span></div></div></section>
        <section class="side-card"><div class="side-title"><h3>Upcoming Milestones</h3></div>${state.goals.filter(g=>g.targetDate).sort((a,b)=>a.targetDate.localeCompare(b.targetDate)).slice(0,4).map(g=>`<div class="milestone"><i class="dot tone-${goalTone(g)}"></i><span>${esc(g.title)}</span><time>${new Date(g.targetDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</time></div>`).join('')}</section>
        <section class="side-card"><div class="side-title"><h3>Recent Media</h3><button class="text-btn" data-action="upload-media">Add</button></div><div class="media-strip">${mediaStrip()}</div></section>
      </aside>
    </div>
  `);
}

function tab(value: string, label: string) {
  return `<button class="tab ${filter === value ? 'active' : ''}" data-filter="${value}">${label}</button>`;
}

function goalRow(goal: Goal) {
  const p = progress(goal);
  return `<article class="goal-row" data-goal="${goal.id}">
    <button class="round-check ${goal.status === 'completed' ? 'done' : ''}" data-action="toggle-goal" data-id="${goal.id}">${goal.status === 'completed' ? icon('check') : ''}</button>
    <div class="goal-main"><h3>${esc(goal.title)}</h3><div><span>${esc(goal.cadence)}</span><span>${goal.tasks.filter(t=>t.done).length} / ${goal.tasks.length} tasks</span></div></div>
    <div class="goal-progress"><strong>${p}%</strong><div><i style="width:${p}%"></i></div></div>
    <button class="cover tone-${goalTone(goal)}" data-action="select-goal" data-id="${goal.id}">${goal.cover ? `<img src="${goal.cover}" alt="" />` : '<span></span>'}</button>
    <button class="icon-btn" data-action="edit-goal" data-id="${goal.id}">${icon('more')}</button>
  </article>`;
}

function goalsView() {
  const goal = state.goals.find(g => g.id === selectedGoalId) ?? state.goals[0];
  if (!goal) return layout(`<div class="empty"><h1>No goals yet.</h1><button class="primary" data-action="new-goal">New Goal</button></div>`);
  return layout(`
    <div class="page-wrap editor-layout">
      <section>
        <div class="page-head"><div><button class="back-link" data-nav="overview">← Back to overview</button><h1>Edit Goal</h1></div><div class="head-actions"><button class="secondary" data-action="duplicate-goal" data-id="${goal.id}">Duplicate</button><button class="danger" data-action="delete-goal" data-id="${goal.id}">Delete</button></div></div>
        <form id="goalForm" class="editor-card">
          <div class="form-grid three"><label>Goal title<input name="title" value="${esc(goal.title)}" required /></label><label>Category<input name="category" value="${esc(goal.category)}" /></label><label>Status<select name="status"><option value="active" ${goal.status==='active'?'selected':''}>Active</option><option value="on-hold" ${goal.status==='on-hold'?'selected':''}>On Hold</option><option value="completed" ${goal.status==='completed'?'selected':''}>Completed</option></select></label></div>
          <div class="form-grid four"><label>Cadence<input name="cadence" value="${esc(goal.cadence)}" /></label><label>Priority<select name="priority"><option value="low" ${goal.priority==='low'?'selected':''}>Low</option><option value="medium" ${goal.priority==='medium'?'selected':''}>Medium</option><option value="high" ${goal.priority==='high'?'selected':''}>High</option></select></label><label>Target date<input type="date" name="targetDate" value="${goal.targetDate}" /></label><label>Progress<div class="progress-readout"><b>${progress(goal)}%</b><div class="long-bar"><i style="width:${progress(goal)}%"></i></div></div></label></div>
          <label>Notes<textarea name="notes" rows="4">${esc(goal.notes)}</textarea></label>
          <div class="editor-section"><div class="section-head"><div><h3>Checklist</h3><p>Track the actions that move this goal forward.</p></div><button type="button" class="text-btn" data-action="add-task" data-id="${goal.id}">+ Add item</button></div><div class="task-list">${goal.tasks.map(t=>`<div class="task-row"><button type="button" class="mini-check ${t.done?'done':''}" data-action="toggle-task" data-goal="${goal.id}" data-task="${t.id}">${t.done?'✓':''}</button><input data-task-title="${t.id}" value="${esc(t.title)}" /><button type="button" class="icon-btn" data-action="delete-task" data-goal="${goal.id}" data-task="${t.id}">${icon('trash')}</button></div>`).join('')}</div></div>
          <div class="form-actions"><span>Changes are saved locally in your browser.</span><button class="primary" type="submit">Save Changes</button></div>
        </form>
      </section>
      <aside class="editor-aside">
        <div class="preview-card"><button class="preview-cover tone-${goalTone(goal)}" data-action="goal-cover" data-id="${goal.id}">${goal.cover ? `<img src="${goal.cover}" alt="" />` : '<span></span>'}<em>${icon('upload')} Change cover</em></button><h2>${esc(goal.title)}</h2><p>${esc(goal.category)} · ${goal.status.replace('-', ' ')}</p><div class="long-bar"><i style="width:${progress(goal)}%"></i></div></div>
        <div class="side-card"><div class="side-title"><h3>Media & Resources</h3><button class="text-btn" data-action="upload-media">Add Media</button></div><div class="media-strip">${mediaStrip()}</div></div>
      </aside>
    </div>
  `);
}

function calendarView() {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const hours = Array.from({length:16},(_,i)=>6+i);
  return layout(`
    <div class="calendar-page">
      <section class="calendar-hero"><div><span>WEEKLY SYSTEM</span><h1>Plan your week.</h1><p>Time blocks for deep work and real progress.</p></div><button class="primary" data-action="new-block">+ New Block</button></section>
      <div class="calendar-shell">
        <div class="time-head">TIME</div>${days.map((d,i)=>`<div class="day-head"><strong>${d}</strong><span>${19+i}</span></div>`).join('')}
        <div class="time-axis">${hours.map(h=>`<span style="top:${(h-6)*56+8}px">${h>12?h-12:h} ${h>=12?'PM':'AM'}</span>`).join('')}</div>
        ${days.map((_,day)=>`<div class="day-col">${hours.map(()=>'<div class="hour-line"></div>').join('')}${state.blocks.filter(b=>b.day===day).map(blockCard).join('')}</div>`).join('')}
      </div>
    </div>
  `);
}

function blockCard(block: PlanBlock) {
  const goal = state.goals.find(g=>g.id===block.goalId);
  const top = (block.start - 6) * 56 + 4;
  const height = Math.max(46, block.duration * 56 - 8);
  return `<button class="plan-block tone-${goal ? goalTone(goal) : 'blue'} ${block.done?'done':''}" style="top:${top}px;height:${height}px" data-action="edit-block" data-id="${block.id}"><span>${block.done?'✓':'○'}</span><strong>${esc(block.title)}</strong><small>${formatHour(block.start)} · ${block.duration}h</small></button>`;
}

function formatHour(hour: number) {
  const h = Math.floor(hour);
  const m = Math.round((hour-h)*60);
  const display = h > 12 ? h - 12 : h;
  return `${display}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function mediaView() {
  return layout(`<div class="page-wrap"><div class="page-head"><div><span class="eyebrow">VISUAL REFERENCES</span><h1>Media</h1><p>Attach mood, references and proof to the goals you care about.</p></div><button class="primary" data-action="upload-media">${icon('upload')} Add Media</button></div><div class="media-grid">${state.media.map((src,i)=>`<div class="media-item"><img src="${src}" alt="Uploaded reference ${i+1}"/><button class="icon-btn" data-action="delete-media" data-index="${i}">${icon('trash')}</button></div>`).join('')}<button class="media-add" data-action="upload-media"><span>+</span><small>Add image</small></button></div></div>`);
}

function mediaStrip() {
  const builtins = ['gradient-a','gradient-b','gradient-c'];
  const uploaded = state.media.slice(-3);
  return [...builtins.map(x=>`<div class="media-thumb ${x}"></div>`), ...uploaded.map(src=>`<div class="media-thumb"><img src="${src}" alt="" /></div>`), `<button class="media-thumb add" data-action="upload-media">+</button>`].join('');
}

function render() {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) return;
  root.innerHTML = view === 'overview' ? overviewView() : view === 'goals' ? goalsView() : view === 'calendar' ? calendarView() : mediaView();
  bindForms();
}

function bindForms() {
  const form = document.querySelector<HTMLFormElement>('#goalForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const goal = state.goals.find(g=>g.id===selectedGoalId);
    if (!goal) return;
    const data = new FormData(form);
    goal.title = String(data.get('title') ?? '').trim() || 'Untitled Goal';
    goal.category = String(data.get('category') ?? 'Personal');
    goal.status = String(data.get('status') ?? 'active') as GoalStatus;
    goal.priority = String(data.get('priority') ?? 'medium') as Priority;
    goal.cadence = String(data.get('cadence') ?? 'Weekly');
    goal.targetDate = String(data.get('targetDate') ?? '');
    goal.notes = String(data.get('notes') ?? '');
    document.querySelectorAll<HTMLInputElement>('[data-task-title]').forEach(input => {
      const task = goal.tasks.find(t=>t.id===input.dataset.taskTitle);
      if (task) task.title = input.value;
    });
    save(); render();
  });
}

function openGoalDialog(existing?: Goal) {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  const goal = existing ?? { id: uid(), title: '', category: 'Personal', status: 'active' as GoalStatus, priority: 'medium' as Priority, cadence: 'Weekly', targetDate: '', notes: '', tasks: [] };
  dialog.innerHTML = `<form method="dialog"><div class="modal-head"><h2>${existing?'Edit':'New'} Goal</h2><button value="cancel" class="icon-btn">×</button></div><label>Goal title<input name="title" value="${esc(goal.title)}" required autofocus /></label><div class="form-grid two"><label>Category<input name="category" value="${esc(goal.category)}" /></label><label>Priority<select name="priority"><option>low</option><option ${goal.priority==='medium'?'selected':''}>medium</option><option ${goal.priority==='high'?'selected':''}>high</option></select></label></div><label>Notes<textarea name="notes" rows="4">${esc(goal.notes)}</textarea></label><div class="modal-actions"><button value="cancel" class="secondary">Cancel</button><button value="save" class="primary">Save Goal</button></div></form>`;
  document.body.append(dialog);
  dialog.showModal();
  dialog.addEventListener('close',()=>{
    if (dialog.returnValue === 'save') {
      const data = new FormData(dialog.querySelector('form')!);
      goal.title = String(data.get('title') ?? '').trim() || 'Untitled Goal';
      goal.category = String(data.get('category') ?? 'Personal');
      goal.priority = String(data.get('priority') ?? 'medium') as Priority;
      goal.notes = String(data.get('notes') ?? '');
      if (!existing) state.goals.unshift(goal);
      selectedGoalId = goal.id;
      save();
      view = 'goals';
      render();
    }
    dialog.remove();
  });
}

function openBlockDialog(block?: PlanBlock) {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  const draft = block ?? { id: uid(), goalId: state.goals[0]?.id ?? '', day: 0, start: 9, duration: 1, title: 'Focus block', done: false };
  dialog.innerHTML = `<form method="dialog"><div class="modal-head"><h2>${block?'Edit':'New'} Block</h2><button value="cancel" class="icon-btn">×</button></div><label>Goal<select name="goalId">${state.goals.map(g=>`<option value="${g.id}" ${g.id===draft.goalId?'selected':''}>${esc(g.title)}</option>`).join('')}</select></label><label>Title<input name="title" value="${esc(draft.title)}" /></label><div class="form-grid three"><label>Day<select name="day">${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((d,i)=>`<option value="${i}" ${i===draft.day?'selected':''}>${d}</option>`).join('')}</select></label><label>Start<input type="number" step="0.5" min="6" max="21" name="start" value="${draft.start}" /></label><label>Hours<input type="number" step="0.25" min="0.5" max="6" name="duration" value="${draft.duration}" /></label></div><label class="checkbox-line"><input type="checkbox" name="done" ${draft.done?'checked':''}/> Completed</label><div class="modal-actions">${block?'<button value="delete" class="danger">Delete</button>':'<span></span>'}<div><button value="cancel" class="secondary">Cancel</button><button value="save" class="primary">Save Block</button></div></div></form>`;
  document.body.append(dialog); dialog.showModal();
  dialog.addEventListener('close',()=>{
    if (dialog.returnValue === 'delete' && block) state.blocks = state.blocks.filter(b=>b.id!==block.id);
    if (dialog.returnValue === 'save') {
      const data = new FormData(dialog.querySelector('form')!);
      draft.goalId = String(data.get('goalId') ?? '');
      draft.title = String(data.get('title') ?? 'Focus block');
      draft.day = Number(data.get('day') ?? 0);
      draft.start = Number(data.get('start') ?? 9);
      draft.duration = Number(data.get('duration') ?? 1);
      draft.done = data.get('done') === 'on';
      if (!block) state.blocks.push(draft);
    }
    save(); render(); dialog.remove();
  });
}

async function uploadMedia(forGoal?: Goal) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) return alert('Please use an image under 2 MB for this local-first build.');
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result ?? '');
      if (forGoal) forGoal.cover = src;
      else state.media.push(src);
      save(); render();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

document.addEventListener('click', e => {
  const target = (e.target as HTMLElement).closest<HTMLElement>('[data-nav],[data-action],[data-filter]');
  if (!target) return;
  const nav = target.dataset.nav as typeof view | undefined;
  if (nav) { view = nav; render(); return; }
  if (target.dataset.filter) { filter = target.dataset.filter as typeof filter; render(); return; }
  const action = target.dataset.action;
  const id = target.dataset.id;
  if (action === 'new-goal') return openGoalDialog();
  if (action === 'select-goal' || action === 'edit-goal') { selectedGoalId = id ?? selectedGoalId; view = 'goals'; render(); return; }
  if (action === 'toggle-goal' && id) { const g = state.goals.find(x=>x.id===id); if (g) g.status = g.status === 'completed' ? 'active' : 'completed'; save(); render(); return; }
  if (action === 'duplicate-goal' && id) { const g = state.goals.find(x=>x.id===id); if (g) { const copy = structuredClone(g); copy.id = uid(); copy.title += ' Copy'; copy.tasks = copy.tasks.map(t=>({...t,id:uid()})); state.goals.unshift(copy); selectedGoalId = copy.id; save(); render(); } return; }
  if (action === 'delete-goal' && id) { if (!confirm('Delete this goal?')) return; state.goals = state.goals.filter(g=>g.id!==id); state.blocks = state.blocks.filter(b=>b.goalId!==id); selectedGoalId = state.goals[0]?.id ?? ''; save(); view='overview'; render(); return; }
  if (action === 'add-task' && id) { const g=state.goals.find(x=>x.id===id); if(g){g.tasks.push({id:uid(),title:'New task',done:false}); save(); render();} return; }
  if (action === 'toggle-task') { const g=state.goals.find(x=>x.id===target.dataset.goal); const t=g?.tasks.find(x=>x.id===target.dataset.task); if(t){t.done=!t.done; save(); render();} return; }
  if (action === 'delete-task') { const g=state.goals.find(x=>x.id===target.dataset.goal); if(g){g.tasks=g.tasks.filter(x=>x.id!==target.dataset.task); save(); render();} return; }
  if (action === 'goal-cover' && id) { const g=state.goals.find(x=>x.id===id); if(g) uploadMedia(g); return; }
  if (action === 'upload-media') return void uploadMedia();
  if (action === 'delete-media') { const index=Number(target.dataset.index); state.media.splice(index,1); save(); render(); return; }
  if (action === 'new-block') return openBlockDialog();
  if (action === 'edit-block' && id) { const b=state.blocks.find(x=>x.id===id); if(b) openBlockDialog(b); return; }
});

render();
