export const ONTRACK_PERSISTENCE_AUDIT = {
  cloudOwnedLocalStorage: [
    'oncheck-state-v1',
    'oncheck-account-v2',
    'oncheck-daily-focus-v2',
    'oncheck-weekly-review-v2',
    'oncheck-training-space-v1',
    'oncheck-cover-map-v2',
    'oncheck-calendar-v2',
    'oncheck-strategy-start-v1',
  ],
  cloudOwnedExternal: [
    'supabase-auth-session',
    'profiles',
    'user-media-storage',
    'media-metadata',
  ],
  deviceOnlyExamples: [
    'auth-browser-token-cache',
    'session-hydration-marker',
    'pwa-install-state',
    'media-migration-marker',
    'remote-media-index',
    'temporary-object-urls',
    'open-dialog-or-tab',
    'search-text',
    'scroll-position',
  ],
} as const;
