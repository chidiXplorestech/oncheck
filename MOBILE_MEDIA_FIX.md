# Mobile media runtime fix

This change adds a mobile-first media picker path that runs before the legacy media interception layer.

It exists because mobile Safari/PWA environments are less tolerant of detached programmatic file inputs than desktop Chromium.

Key behavior:
- native file input is attached to the document while the picker is active
- `showPicker()` is used when supported, with `.click()` fallback
- image/video uploads continue to use IndexedDB (`oncheck-media-v2`)
- cover selection gets a mobile bottom sheet instead of relying on the desktop dialog
- successful mobile uploads/cover changes reload once so the existing media layer refreshes its IndexedDB cache cleanly
- desktop behavior is unchanged
- the service-worker cache was bumped so installed copies pick up this runtime
