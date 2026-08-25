# ONTRACK

ONTRACK is a visual personal operating system for goals, daily execution, weekly planning, training, progress tracking and media references.

Production app: https://ontrack-everyday.netlify.app/

## Stack

- TypeScript (strict mode)
- Vite
- Supabase Auth for sign-up, login, email verification and password recovery
- Supabase Postgres with Row Level Security for user-owned cloud data
- Supabase Storage for private user media
- localStorage / IndexedDB retained as local cache and migration support
- Progressive Web App shell for mobile installation/offline reopening
- Netlify deployment
- Mobile-first responsive layer down to 320px
- Zero UI framework dependency

## Current cloud foundation

- Secure email/password accounts through Supabase Auth
- Automatic profile creation tied to the Supabase Auth user ID
- RLS-protected profiles, goals, tasks, calendar entries, workout sessions, activity logs, media metadata and user settings
- Private `user-media` Storage bucket with per-user access policies
- Cross-device cloud sync for goals, checklists and calendar blocks
- Existing local goal/calendar data can be migrated into the first signed-in account
- Account Settings hydrate from the signed-in Supabase profile rather than a separate local identity
- Passwords are never stored in ONTRACK application tables

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

The frontend uses the public Supabase URL and publishable key only. Never expose a Supabase service-role key in Vite or browser code.

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

## Data model

Supabase is the cloud source of truth for account-owned data. Local browser storage remains useful for offline/cache behavior and migration from the original local-only build. Goals, checklists and calendar entries currently sync to the authenticated account; workout and media cloud synchronization continue to use the backend infrastructure prepared for their dedicated sync layer.
