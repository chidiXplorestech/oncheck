export function localDateKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function currentFocus<T extends { date: string; lowEnergy: boolean; items: unknown[] }>(focus: T, now = new Date()): T {
  return focus.date === localDateKey(now) ? focus : { ...focus, date: localDateKey(now), lowEnergy: false, items: [] };
}

export function homeSyncLabel(state?: string) {
  switch (state) {
    case 'synced': return 'Synced';
    case 'syncing': return 'Syncing';
    case 'offline': return 'Offline';
    case 'error': return 'Sync issue';
    case 'conflict': return 'Needs review';
    default: return 'Checking sync';
  }
}
