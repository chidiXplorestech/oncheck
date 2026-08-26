# Unified Sync Cutover

- Added `public.user_state` with RLS, revisions and Realtime publication.
- Seeded existing accounts from Sync V2 data and normalized goal/calendar rows.
- Added `src/unified-cloud-state.ts` as the only localStorage account-state synchronizer.
- Stopped loading the previous `cloud-sync.ts` and `extended-cloud-sync.ts` loops.
- Added rich Calendar V2 and strategy start to cloud ownership.
- Kept media blobs on the existing private Storage synchronizer.
- Kept auth/session/PWA/migration/cache markers device-only.
