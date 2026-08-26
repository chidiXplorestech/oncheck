# ONTRACK Unified Sync Architecture

Supabase is the account source of truth. Browser storage is an offline/runtime cache.

## Cloud-owned browser state

`src/unified-cloud-state.ts` is the single registry for meaningful localStorage state:

- `oncheck-state-v1` — goals, checklist tasks and legacy planning blocks
- `oncheck-account-v2` — account-facing preferences and execution rules
- `oncheck-daily-focus-v2` — Daily Focus
- `oncheck-weekly-review-v2` — Weekly Review
- `oncheck-training-space-v1` — complete Training Space state
- `oncheck-cover-map-v2` — goal-to-media cover assignments
- `oncheck-calendar-v2` — rich multi-week calendar/log data including actual time, notes and completion history
- `oncheck-strategy-start-v1` — calendar strategy start

These values are stored per user in `public.user_state`, protected by RLS and published through Supabase Realtime.

## Cloud-owned non-localStorage state

- Identity: Supabase Auth + `profiles`
- Media blobs: private Supabase Storage bucket `user-media`
- Media metadata: `media`

The browser IndexedDB media database is a local cache populated from Storage.

## Device-only state

Do not sync authentication tokens, PWA/install state, migration markers, local sync owner/index markers, temporary object URLs, open dialog/tab state, search text, scroll position, current viewport state, or session-only hydration markers.

## Rule for new features

A new persistent user feature must either:

1. own a normalized RLS-protected Supabase table and Realtime subscription, or
2. add its browser storage key to `CLOUD_STATE_KEYS` in `src/unified-cloud-state.ts`.

It must not create a third independent sync loop.
