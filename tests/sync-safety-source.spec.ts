import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('unified sync protects account ownership, deletions and stale writes', () => {
  const unified = source('src/unified-cloud-state.ts');

  expect(unified).toContain("const OWNER_KEY = 'ontrack-cloud-owner-v2'");
  expect(unified).toContain("const LEGACY_OWNER_KEY = 'ontrack-cloud-owner-v1'");
  expect(unified).toContain('quarantineUnownedCache');
  expect(unified).toContain('recoverQuarantineForSession');
  expect(unified).toContain("document.documentElement.dataset.cloudCacheRecovered = 'email-match'");
  expect(unified).toContain('cachedEmail === sessionEmail');
  expect(unified).toContain('__ontrack_deleted');
  expect(unified).toContain(".eq('revision', expectedRevision)");
  expect(unified).toContain('preserveConflict');
  expect(unified).not.toContain(".from('user_state')\n        .delete()");
});

test('media sync never treats cache absence as a cloud delete', () => {
  const cloud = source('src/media-cloud-sync.ts');
  const layer = source('src/media-layer.ts');

  expect(cloud).toContain("const MEDIA_OWNER_KEY = 'ontrack-media-cache-owner-v1'");
  expect(cloud).toContain('prepareCacheForUser');
  expect(cloud).toContain('readPendingDeletes');
  expect(cloud).toContain("window.addEventListener('ontrack:media-deleted'");
  expect(cloud).not.toContain('previousRemote.has(id) && !localById.has(id)');
  expect(layer).toContain("new CustomEvent('ontrack:media-deleted'");
});


test('auth keeps non-sensitive identity fields when a request fails', () => {
  const auth = source('src/auth-layer.ts');

  expect(auth).toContain("let emailDraft = ''");
  expect(auth).toContain("value=\"\${esc(emailDraft)}\"");
  expect(auth).toContain('friendlyAuthError');
  expect(auth).toContain('Your account data has not been deleted.');
});
