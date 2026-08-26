# ONTRACK

ONTRACK is a visual personal operating system for goals, daily execution, weekly planning, training, progress tracking and media references.

Production app: https://ontrack-everyday.netlify.app/

## Stack

- TypeScript (strict mode)
- Vite
- Supabase Auth for sign-up, login, email verification and password recovery
- Supabase Postgres with Row Level Security for user-owned cloud data
- Supabase Realtime for cross-device propagation
- Supabase Storage for private user media
- localStorage / IndexedDB retained as offline cache and migration support
- Progressive Web App shell for mobile installation/offline reopening
- Netlify deployment
- Mobile-first responsive layer down to 320px
- Zero UI framework dependency

## ONTRACK Sync V2

ONTRACK now follows a one-account, one-cloud-state model:

- Supabase is the authoritative state for goals, tasks and calendar blocks.
- Signed-in devices pull cloud state at login, when the app regains focus/visibility, and when the network reconnects.
- Local edits are pushed back to Supabase automatically.
- Supabase Realtime subscriptions propagate changes made on another device.
- Account execution settings, Daily Focus, Weekly Review, workout progress/custom exercises and cover assignments sync through the account's RLS-protected settings record.
- Media files are uploaded to the private `user-media` Storage bucket and downloaded into the local IndexedDB cache on other devices.
- Media deletions propagate across devices.
- localStorage and IndexedDB remain local caches so the UI can continue to behave quickly and preserve the migration path from the original local-only app.

No cron job is required for normal ONTRACK synchronization.

## Cloud security

- Secure email/password accounts through Supabase Auth
- Automatic profile creation tied to the Supabase Auth user ID
- RLS-protected profiles, goals, tasks, calendar entries, workout sessions, activity logs, media metadata and user settings
- Private `user-media` Storage bucket with per-user folder policies
- Passwords are never stored in ONTRACK application tables
- The browser uses only the public project URL and publishable key; service-role credentials must never be exposed in Vite/browser code

## Functional product

- Preloaded long-term goal system
- Add, edit, duplicate and delete goals
- Active / on-hold / completed goal states
- Reliable Save Changes + goal autosave
- Editable checklists with automatic progress calculation
- Goal search and status filtering
- Daily Focus system with capped priorities
- Low-Energy Mode with a configurable minimum-day target
- Account / Settings area
- Configurable daily priority limit and low-energy minutes
- Weekly review with wins, friction, next-week changes and score
- JSON backup export/import
- Multi-image/video uploads
- Change/remove goal covers from the media library
- Weekly planning calendar with current dates
- Add, edit, complete and delete planning blocks
- Dynamic Training Space with Monday / Wednesday / Thursday split
- Editable exercises, checkboxes and rotating explosive movement
- Responsive desktop/tablet/mobile layout
- Installable PWA
- Single-file offline build option

## Run from VS Code

Requirements: Node.js 22+ and npm.

```bash
git clone https://github.com/chidiXplorestech/oncheck.git
cd oncheck
code .
npm install
npm run dev
```

Vite will print the local URL, normally:

```text
http://localhost:5173
```

## Supabase

Project ref:

```text
ayizmdoyynptwadnjpdc
```

For production authentication, Supabase Authentication → URL Configuration should use:

```text
Site URL: https://ontrack-everyday.netlify.app/
Redirect URL: https://ontrack-everyday.netlify.app/**
```

Local development can additionally allow:

```text
http://localhost:5173/**
```

## Netlify

Production deployment:

```text
https://ontrack-everyday.netlify.app/
```

Build command:

```text
npm run build
```

Publish directory:

```text
dist
```

The repository includes `netlify.toml`, the PWA manifest and service worker.

## Test on your phone over the same Wi-Fi

```bash
npm run dev:mobile
```

Vite will print a `Network` URL such as `http://192.168.x.x:5173`. Open that URL on your phone while the phone and computer are on the same network.

## Single-file local/offline build

Generate one bundled HTML file:

```bash
npm run build:offline
```

Output:

```text
dist/oncheck-offline.html
```

GitHub Actions uploads the offline phone build after successful CI runs. For normal use, the hosted PWA is the primary ONTRACK experience because authentication and cross-device cloud sync require the Supabase-backed deployment.

## Verify before development

```bash
npm run typecheck
npm run build
npm run build:offline
```

## Production preview

```bash
npm run build
npm run preview
```
