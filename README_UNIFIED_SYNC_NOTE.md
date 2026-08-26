# ONTRACK Unified Sync

The app now uses `public.user_state` + `src/unified-cloud-state.ts` as the single registry for meaningful browser-persisted account state. `cloud-sync.ts` and `extended-cloud-sync.ts` are no longer loaded by `src/layers.ts`.

Rich Calendar V2 (`oncheck-calendar-v2`) is included explicitly, alongside goals/checklists, account/execution settings, Daily Focus, Weekly Review, Training Space, cover assignments and strategy start.

Media blobs remain in private Supabase Storage and are mirrored into IndexedDB as a device cache.
