import './workout.css';

type DayId = 'monday' | 'wednesday' | 'thursday';

type Exercise = {
  id: string;
  group: string;
  name: string;
  prescription: string;
  note: string;
  done: boolean;
};

type WorkoutDay = {
  id: DayId;
  day: string;
  area: string;
  focus: string;
  exercises: Exercise[];
  explosiveOptions: string[];
  explosiveIndex: number;
  explosiveDone: boolean;
};

type WorkoutState = {
  week: number;
  target: string;
  days: Record<DayId, WorkoutDay>;
};

const STORAGE_KEY = 'oncheck-training-space-v1';
const uid = () => crypto.randomUUID();

const explosivePool = [
  '10-yard sprint — fast, crisp effort',
  'High / vertical jumps',
  'Jumping jacks — fast conditioning burst',
  'Farmer walk — heavy carry',
  'Farmer push / sled-style push',
  'Deadlift — controlled power sets; stop before form breaks',
];

const ex = (group: string, name: string, prescription: string, note = ''): Exercise => ({
  id: uid(),
  group,
  name,
  prescription,
  note,
  done: false,
});

const seeded: WorkoutState = {
  week: 1,
  target: 'Build a strong, big, aesthetic physique · long-term target: 120 kg while staying lean',
  days: {
    monday: {
      id: 'monday',
      day: 'MONDAY',
      area: 'TRUNK',
      focus: 'Neck · Chest · Core · Back · Shoulders',
      explosiveOptions: explosivePool,
      explosiveIndex: 0,
      explosiveDone: false,
      exercises: [
        ex('NECK', 'Weighted neck flexion', '3 × 10', 'Weight supported at the forehead; slow, controlled range.'),
        ex('NECK', 'Lateral neck flexion — left', '3 × 10 · lighter load', 'Controlled side flexion.'),
        ex('NECK', 'Lateral neck flexion — right', '3 × 10 · lighter load', 'Controlled side flexion.'),
        ex('CHEST', 'Dips', 'Work to technical failure', 'Bodyweight first; add load only when form stays clean.'),
        ex('CHEST', 'Barbell bench press', 'Progressive working sets', 'Increase load incrementally when reps and form are solid.'),
        ex('CHEST', 'Push-ups', 'Work to technical failure'),
        ex('CHEST', 'Dumbbell squeeze press', 'Controlled working sets', 'Press dumbbells together and drive forward/up as one unit.'),
        ex('CORE', 'Weighted plate core flow', '1 extended working sequence', 'Rotate across the body, press forward, move under the legs and swing side-to-side; use a 10–20 kg plate as appropriate.'),
        ex('CORE', 'Full-range core raise', 'Controlled reps', 'Move through lower-to-upper range to load centre and lower core.'),
        ex('BACK', 'Pull-up variations', 'Close + wide · work to technical failure', 'Rotate grips/widths rather than treating each as a separate workout.'),
        ex('BACK', 'Barbell rows', 'Progressive working sets'),
        ex('BACK', 'Seated rows', 'Progressive working sets'),
        ex('SHOULDERS', 'Lateral raises', 'Controlled working sets'),
        ex('SHOULDERS', 'Front raises', 'Controlled working sets'),
        ex('SHOULDERS', 'Heavy shrugs', 'Working sets · target load ~50 kg', 'Follow with a lighter controlled variation if useful.'),
      ],
    },
    wednesday: {
      id: 'wednesday',
      day: 'WEDNESDAY',
      area: 'LOWER BODY',
      focus: 'Hamstrings · Squat pattern · Lunges · Calves · Thighs',
      explosiveOptions: explosivePool,
      explosiveIndex: 1,
      explosiveDone: false,
      exercises: [
        ex('HAMSTRINGS', 'Hamstring curls', 'Progressive working sets'),
        ex('LEGS', 'Heavy dumbbell squat', 'Progressive working sets'),
        ex('LEGS', 'Wide-stance dumbbell squat', 'Progressive working sets'),
        ex('LEGS', 'Walking forward lunges', 'Controlled working sets', 'Dumbbells or kettlebells.'),
        ex('LEGS', 'Reverse walking lunges', 'Controlled working sets', 'Dumbbells or kettlebells.'),
        ex('CALVES', 'Calf raises', 'Working sets to a hard clean finish'),
        ex('THIGHS', 'Leg extensions — standard', 'Work to technical failure'),
        ex('THIGHS', 'Leg extensions — reverse variation', 'Work to technical failure', 'Keep this variation exactly as you define/use it in your gym setup.'),
      ],
    },
    thursday: {
      id: 'thursday',
      day: 'THURSDAY',
      area: 'SIDES / ARMS',
      focus: 'Biceps · Triceps · Forearms · Aesthetic detail',
      explosiveOptions: explosivePool,
      explosiveIndex: 5,
      explosiveDone: false,
      exercises: [
        ex('BICEPS', 'Barbell curl', 'Work to technical failure'),
        ex('BICEPS', 'Preacher curl', 'Work to technical failure'),
        ex('TRICEPS', 'Triceps pushdown', 'Hard controlled working sets'),
        ex('TRICEPS', 'Skull crushers', 'Controlled working sets', 'Included from your “old-school” triceps description; edit this if you meant a different movement.'),
        ex('FOREARMS', 'Kettlebell + band wrist roller', 'Forward + reverse until the weight reaches the end range', 'Roll in both directions; stop when grip/form gives out.'),
      ],
    },
  },
};

let state = loadState();
let activeDay: DayId = 'monday';
let injectedFor: Element | null = null;
let patchQueued = false;

function loadState(): WorkoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(seeded);
    const parsed = JSON.parse(raw) as Partial<WorkoutState>;
    if (!parsed.days?.monday || !parsed.days?.wednesday || !parsed.days?.thursday) return structuredClone(seeded);
    return parsed as WorkoutState;
  } catch {
    return structuredClone(seeded);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function esc(value: string) {
  return value.replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch));
}

function dayProgress(day: WorkoutDay) {
  const total = day.exercises.length + 1;
  const completed = day.exercises.filter(item => item.done).length + (day.explosiveDone ? 1 : 0);
  return total ? Math.round((completed / total) * 100) : 0;
}

function weeklyProgress() {
  const days = Object.values(state.days);
  const total = days.reduce((sum, day) => sum + day.exercises.length + 1, 0);
  const complete = days.reduce((sum, day) => sum + day.exercises.filter(item => item.done).length + (day.explosiveDone ? 1 : 0), 0);
  return total ? Math.round((complete / total) * 100) : 0;
}

function explosive(day: WorkoutDay) {
  return day.explosiveOptions[day.explosiveIndex % day.explosiveOptions.length] ?? 'Choose movement';
}

function renderTrainingSpace(container: HTMLElement) {
  const day = state.days[activeDay];
  const progress = dayProgress(day);
  const weekly = weeklyProgress();

  container.innerHTML = `
    <div class="training-kicker"><span>TRAINING SPACE</span><span>WEEK ${state.week.toString().padStart(2, '0')}</span></div>
    <div class="training-head">
      <div>
        <h2>Build the frame.</h2>
        <p>${esc(state.target)}</p>
      </div>
      <div class="training-week-score"><strong>${weekly}%</strong><span>WEEK</span></div>
    </div>

    <div class="training-days" role="tablist" aria-label="Training days">
      ${(['monday', 'wednesday', 'thursday'] as DayId[]).map(id => {
        const item = state.days[id];
        return `<button type="button" class="training-day ${id === activeDay ? 'active' : ''}" data-workout-day="${id}">
          <span>${item.day}</span><strong>${esc(item.area)}</strong><em>${dayProgress(item)}%</em>
        </button>`;
      }).join('')}
    </div>

    <div class="training-session-head">
      <div><span>${day.day} · ${esc(day.area)}</span><h3>${esc(day.focus)}</h3></div>
      <div class="session-progress"><strong>${progress}%</strong><div><i style="width:${progress}%"></i></div></div>
    </div>

    <section class="explosive-slot ${day.explosiveDone ? 'done' : ''}">
      <button type="button" class="workout-check" data-workout-action="toggle-explosive" aria-label="Toggle explosive movement">${day.explosiveDone ? '✓' : ''}</button>
      <div><span>ONE POWER / EXPLOSIVE MOVEMENT</span><strong>${esc(explosive(day))}</strong><small>One movement outside the normal routine. Rotate it week-to-week.</small></div>
      <button type="button" class="workout-ghost" data-workout-action="change-explosive">CHANGE</button>
    </section>

    <div class="exercise-groups">
      ${groupExercises(day)}
    </div>

    <div class="training-footer">
      <button type="button" class="workout-add" data-workout-action="add-exercise">+ ADD EXERCISE</button>
      <div>
        <button type="button" class="workout-ghost" data-workout-action="reset-session">RESET DAY</button>
        <button type="button" class="workout-next" data-workout-action="next-week">NEXT WEEK ↗</button>
      </div>
    </div>

    <div class="training-note"><span>FORM RULE</span><p>“Failure” is logged here as technical failure: stop the set when clean form breaks. Keep loaded neck work and deadlifts controlled rather than chasing sloppy reps.</p></div>
  `;
}

function groupExercises(day: WorkoutDay) {
  const groups = [...new Set(day.exercises.map(item => item.group))];
  return groups.map(group => {
    const rows = day.exercises.filter(item => item.group === group);
    return `<section class="exercise-group">
      <div class="exercise-group-label"><span>${esc(group)}</span><em>${rows.filter(row => row.done).length}/${rows.length}</em></div>
      <div class="exercise-list">
        ${rows.map(item => `<article class="exercise-row ${item.done ? 'done' : ''}" data-exercise-id="${item.id}">
          <button type="button" class="workout-check" data-workout-action="toggle-exercise" data-id="${item.id}">${item.done ? '✓' : ''}</button>
          <button type="button" class="exercise-copy" data-workout-action="edit-exercise" data-id="${item.id}">
            <strong>${esc(item.name)}</strong>
            <span>${esc(item.prescription)}</span>
            ${item.note ? `<small>${esc(item.note)}</small>` : ''}
          </button>
          <button type="button" class="exercise-more" data-workout-action="edit-exercise" data-id="${item.id}" aria-label="Edit ${esc(item.name)}">•••</button>
        </article>`).join('')}
      </div>
    </section>`;
  }).join('');
}

function findTrainingEditor() {
  const cover = document.querySelector<HTMLElement>('.preview-cover[data-id="training"]');
  if (!cover) return null;
  return cover.closest('.editor-layout')?.querySelector<HTMLElement>('section') ?? null;
}

function ensureTrainingSpace() {
  patchQueued = false;
  const editorSection = findTrainingEditor();
  if (!editorSection) {
    injectedFor = null;
    return;
  }
  if (injectedFor === editorSection && editorSection.querySelector('.training-space')) return;

  editorSection.querySelector('.training-space')?.remove();
  const space = document.createElement('section');
  space.className = 'training-space';
  const editorCard = editorSection.querySelector('.editor-card');
  if (editorCard) editorCard.insertAdjacentElement('afterend', space);
  else editorSection.append(space);
  injectedFor = editorSection;
  renderTrainingSpace(space);
}

function queuePatch() {
  if (patchQueued) return;
  patchQueued = true;
  requestAnimationFrame(ensureTrainingSpace);
}

function currentSpace() {
  return document.querySelector<HTMLElement>('.training-space');
}

function rerender() {
  saveState();
  const space = currentSpace();
  if (space) renderTrainingSpace(space);
}

function openExerciseDialog(day: WorkoutDay, existing?: Exercise) {
  const dialog = document.createElement('dialog');
  dialog.className = 'workout-modal';
  const draft = existing ?? ex('CUSTOM', '', '3 × 10');
  dialog.innerHTML = `
    <form method="dialog" class="workout-modal-panel">
      <div class="workout-modal-head"><div><span>${existing ? 'EDIT MOVEMENT' : 'NEW MOVEMENT'}</span><h2>${existing ? esc(existing.name) : 'Add exercise'}</h2></div><button value="cancel" type="submit">×</button></div>
      <label>Muscle / section<input name="group" value="${esc(draft.group)}" required /></label>
      <label>Exercise<input name="name" value="${esc(draft.name)}" required autofocus /></label>
      <label>Sets / reps / target<input name="prescription" value="${esc(draft.prescription)}" /></label>
      <label>Notes<textarea name="note" rows="3">${esc(draft.note)}</textarea></label>
      <div class="workout-modal-actions">
        ${existing ? '<button type="submit" value="delete" class="workout-delete">DELETE</button>' : '<span></span>'}
        <div><button type="submit" value="cancel" class="workout-ghost">CANCEL</button><button type="submit" value="save" class="workout-next">SAVE</button></div>
      </div>
    </form>`;
  document.body.append(dialog);
  dialog.showModal();
  dialog.addEventListener('close', () => {
    if (dialog.returnValue === 'delete' && existing) {
      day.exercises = day.exercises.filter(item => item.id !== existing.id);
      rerender();
    }
    if (dialog.returnValue === 'save') {
      const data = new FormData(dialog.querySelector('form')!);
      draft.group = String(data.get('group') ?? 'CUSTOM').trim().toUpperCase() || 'CUSTOM';
      draft.name = String(data.get('name') ?? '').trim() || 'Untitled exercise';
      draft.prescription = String(data.get('prescription') ?? '').trim();
      draft.note = String(data.get('note') ?? '').trim();
      if (!existing) day.exercises.push(draft);
      rerender();
    }
    dialog.remove();
  }, { once: true });
}

function openExplosiveDialog(day: WorkoutDay) {
  const dialog = document.createElement('dialog');
  dialog.className = 'workout-modal';
  dialog.innerHTML = `<div class="workout-modal-panel"><div class="workout-modal-head"><div><span>POWER SLOT</span><h2>Choose one movement</h2></div><button type="button" data-close>×</button></div><div class="explosive-picker">${day.explosiveOptions.map((option, index) => `<button type="button" class="${index === day.explosiveIndex ? 'active' : ''}" data-explosive-index="${index}"><span>${String(index + 1).padStart(2, '0')}</span><strong>${esc(option)}</strong></button>`).join('')}</div></div>`;
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-explosive-index]');
    if (!button) return;
    day.explosiveIndex = Number(button.dataset.explosiveIndex ?? 0);
    day.explosiveDone = false;
    rerender();
    dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
}

function nextWeek() {
  state.week += 1;
  const days = Object.values(state.days);
  days.forEach((day, index) => {
    day.exercises.forEach(item => item.done = false);
    day.explosiveDone = false;
    day.explosiveIndex = (day.explosiveIndex + 1 + index) % day.explosiveOptions.length;
  });
  rerender();
}

document.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-workout-day],[data-workout-action]');
  if (!target) return;

  const dayId = target.dataset.workoutDay as DayId | undefined;
  if (dayId) {
    activeDay = dayId;
    const space = currentSpace();
    if (space) renderTrainingSpace(space);
    return;
  }

  const action = target.dataset.workoutAction;
  const day = state.days[activeDay];
  const id = target.dataset.id;

  if (action === 'toggle-explosive') {
    day.explosiveDone = !day.explosiveDone;
    rerender();
    return;
  }
  if (action === 'change-explosive') {
    openExplosiveDialog(day);
    return;
  }
  if (action === 'toggle-exercise' && id) {
    const item = day.exercises.find(exercise => exercise.id === id);
    if (item) item.done = !item.done;
    rerender();
    return;
  }
  if (action === 'edit-exercise' && id) {
    const item = day.exercises.find(exercise => exercise.id === id);
    if (item) openExerciseDialog(day, item);
    return;
  }
  if (action === 'add-exercise') {
    openExerciseDialog(day);
    return;
  }
  if (action === 'reset-session') {
    if (!confirm(`Reset ${day.day.toLowerCase()} checkboxes?`)) return;
    day.exercises.forEach(item => item.done = false);
    day.explosiveDone = false;
    rerender();
    return;
  }
  if (action === 'next-week') {
    if (!confirm('Start the next training week? This resets all workout checkboxes and rotates the power movement.')) return;
    nextWeek();
  }
});

const observer = new MutationObserver(queuePatch);
observer.observe(document.documentElement, { childList: true, subtree: true });
queuePatch();
