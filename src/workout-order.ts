type DayId = 'monday' | 'wednesday' | 'thursday';

const groupOrder: Record<DayId, string[]> = {
  monday: ['NECK', 'CHEST', 'BACK', 'SHOULDERS', 'CORE'],
  wednesday: ['HAMSTRINGS', 'LEGS', 'THIGHS', 'CALVES'],
  thursday: ['BICEPS', 'TRICEPS', 'FOREARMS'],
};

const exerciseOrder: Record<DayId, string[]> = {
  monday: [
    'Weighted neck flexion',
    'Lateral neck flexion — left',
    'Lateral neck flexion — right',
    'Barbell bench press',
    'Dips',
    'Dumbbell squeeze press',
    'Push-ups',
    'Pull-up variations',
    'Barbell rows',
    'Seated rows',
    'Lateral raises',
    'Front raises',
    'Heavy shrugs',
    'Weighted plate core flow',
    'Full-range core raise',
  ],
  wednesday: [
    'Hamstring curls',
    'Heavy dumbbell squat',
    'Wide-stance dumbbell squat',
    'Walking forward lunges',
    'Reverse walking lunges',
    'Leg extensions — standard',
    'Leg extensions — reverse variation',
    'Calf raises',
  ],
  thursday: [
    'Barbell curl',
    'Preacher curl',
    'Triceps pushdown',
    'Skull crushers',
    'Kettlebell + band wrist roller',
  ],
};

const displayLabels: Record<string, string> = {
  SHOULDERS: 'SHOULDERS + TRAPS',
};

let queued = false;

function activeDay(space: HTMLElement): DayId {
  const active = space.querySelector<HTMLElement>('.training-day.active[data-workout-day]');
  const id = active?.dataset.workoutDay as DayId | undefined;
  return id === 'wednesday' || id === 'thursday' ? id : 'monday';
}

function groupName(section: HTMLElement) {
  const label = section.querySelector<HTMLElement>('.exercise-group-label span')?.textContent?.trim() ?? '';
  return label === 'SHOULDERS + TRAPS' ? 'SHOULDERS' : label;
}

function exerciseName(row: HTMLElement) {
  return row.querySelector<HTMLElement>('.exercise-copy strong')?.textContent?.trim() ?? '';
}

function sortNodes<T extends HTMLElement>(nodes: T[], desired: string[], name: (node: T) => string) {
  const rank = new Map(desired.map((value, index) => [value, index]));
  return [...nodes].sort((a, b) => {
    const aRank = rank.get(name(a)) ?? Number.MAX_SAFE_INTEGER;
    const bRank = rank.get(name(b)) ?? Number.MAX_SAFE_INTEGER;
    return aRank - bRank;
  });
}

function isSameOrder<T extends Node>(current: T[], desired: T[]) {
  return current.length === desired.length && current.every((node, index) => node === desired[index]);
}

function patchSpace(space: HTMLElement) {
  const day = activeDay(space);
  const groupsContainer = space.querySelector<HTMLElement>('.exercise-groups');
  if (!groupsContainer) return;

  const groups = Array.from(groupsContainer.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node.classList.contains('exercise-group'));
  const orderedGroups = sortNodes(groups, groupOrder[day], groupName);

  if (!isSameOrder(groups, orderedGroups)) {
    orderedGroups.forEach(group => groupsContainer.append(group));
  }

  orderedGroups.forEach(group => {
    const canonicalGroup = groupName(group);
    const label = group.querySelector<HTMLElement>('.exercise-group-label span');
    const display = displayLabels[canonicalGroup] ?? canonicalGroup;
    if (label && label.textContent !== display) label.textContent = display;

    const list = group.querySelector<HTMLElement>('.exercise-list');
    if (!list) return;
    const rows = Array.from(list.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node.classList.contains('exercise-row'));
    const orderedRows = sortNodes(rows, exerciseOrder[day], exerciseName);
    if (!isSameOrder(rows, orderedRows)) orderedRows.forEach(row => list.append(row));
  });
}

function patchAll() {
  queued = false;
  document.querySelectorAll<HTMLElement>('.training-space').forEach(patchSpace);
}

function queuePatch() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(patchAll);
}

document.addEventListener('click', event => {
  if ((event.target as HTMLElement).closest('[data-workout-day],[data-workout-action]')) queuePatch();
});

const observer = new MutationObserver(queuePatch);
observer.observe(document.documentElement, { childList: true, subtree: true });
queuePatch();
