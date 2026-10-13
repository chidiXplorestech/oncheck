import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentFocus, homeSyncLabel, localDateKey } from '../src/home-state.ts';

test('Today excludes yesterday’s priorities without deleting stored history', () => {
  const saved = { date: '2026-10-11', lowEnergy: true, items: [{ id: 'a', title: 'Yesterday', done: false }] };
  const today = currentFocus(saved, new Date(2026, 9, 12, 0, 5));
  assert.equal(today.date, '2026-10-12');
  assert.equal(today.lowEnergy, false);
  assert.deepEqual(today.items, []);
  assert.equal(saved.items.length, 1);
});

test('Today retains current priorities and uses the local calendar date', () => {
  const now = new Date(2026, 9, 12, 23, 59);
  const saved = { date: localDateKey(now), lowEnergy: true, items: [{ id: 'a', done: true }] };
  assert.equal(currentFocus(saved, now), saved);
  assert.equal(localDateKey(now), '2026-10-12');
});

test('sync badge reports success only after explicit confirmation', () => {
  assert.equal(homeSyncLabel(), 'Checking sync');
  assert.equal(homeSyncLabel('unrecognised'), 'Checking sync');
  assert.equal(homeSyncLabel('synced'), 'Synced');
  assert.equal(homeSyncLabel('error'), 'Sync issue');
  assert.equal(homeSyncLabel('offline'), 'Offline');
});
