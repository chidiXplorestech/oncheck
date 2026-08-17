import './workout-visuals.css';

type DayId = 'monday' | 'wednesday' | 'thursday';

type WorkoutArtwork = {
  day: string;
  area: string;
  focus: string;
  athlete: string;
  src: string;
  alt: string;
};

const base = import.meta.env.BASE_URL;

const artwork: Record<DayId, WorkoutArtwork> = {
  monday: {
    day: 'MONDAY',
    area: 'TRUNK',
    focus: 'Neck · Chest · Core · Back · Shoulders',
    athlete: 'TRUNK',
    src: `${base}workouts/monday-trunk-v2.webp`,
    alt: 'Monday trunk training artwork in ONCHECK dark wide-banner styling.',
  },
  wednesday: {
    day: 'WEDNESDAY',
    area: 'LOWER BODY',
    focus: 'Hamstrings · Squats · Lunges · Calves · Thighs',
    athlete: 'LOWER BODY',
    src: `${base}workouts/wednesday-lower-body-v2.webp`,
    alt: 'Wednesday lower-body training artwork focused on the squat and leg area.',
  },
  thursday: {
    day: 'THURSDAY',
    area: 'SIDES / ARMS',
    focus: 'Biceps · Triceps · Forearms · Power',
    athlete: 'SIDES / ARMS',
    src: `${base}workouts/thursday-arms-v2.webp`,
    alt: 'Thursday sides and arms training artwork in ONCHECK dark wide-banner styling.',
  },
};

let queued = false;

function activeDay(space: HTMLElement): DayId {
  const active = space.querySelector<HTMLElement>('.training-day.active[data-workout-day]');
  const id = active?.dataset.workoutDay as DayId | undefined;
  return id && id in artwork ? id : 'monday';
}

function renderBanner(space: HTMLElement) {
  const days = space.querySelector<HTMLElement>('.training-days');
  if (!days) return;

  const id = activeDay(space);
  const item = artwork[id];
  let banner = space.querySelector<HTMLElement>('.training-visual-banner');

  if (!banner) {
    banner = document.createElement('figure');
    days.insertAdjacentElement('afterend', banner);
  }

  if (banner.dataset.day === id) return;

  banner.className = `training-visual-banner training-visual-${id}`;
  banner.dataset.day = id;
  banner.innerHTML = `
    <img src="${item.src}" alt="${item.alt}" decoding="async" />
    <span class="training-visual-shade" aria-hidden="true"></span>
    <figcaption class="training-visual-copy">
      <span>${item.day}</span>
      <strong>${item.area}</strong>
      <small>${item.focus}</small>
    </figcaption>
    <span class="training-visual-athlete" aria-hidden="true">${item.athlete}</span>
  `;
}

function patchAll() {
  queued = false;
  document.querySelectorAll<HTMLElement>('.training-space').forEach(renderBanner);
}

function queuePatch() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(patchAll);
}

document.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest('[data-workout-day]');
  if (target) queuePatch();
});

const observer = new MutationObserver(queuePatch);
observer.observe(document.documentElement, { childList: true, subtree: true });

queuePatch();
