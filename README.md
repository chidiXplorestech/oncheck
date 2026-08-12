# ONCHECK

ONCHECK is a visual personal operating system for goals, daily execution, weekly planning, training, progress tracking and media references.

## Stack

- TypeScript (strict mode)
- Vite
- localStorage for core goal/planning/account state
- IndexedDB for uploaded media
- Progressive Web App shell for mobile installation/offline reopening
- Mobile-first responsive layer down to 320px
- Zero UI framework dependency

## Functional MVP

- Preloaded long-term goal system
- Add, edit, duplicate and delete goals
- Active / on-hold / completed goal states
- Reliable Save Changes + goal autosave
- Editable checklists with automatic progress calculation
- Goal search and status filtering
- Daily Focus system with capped priorities
- Low-Energy Mode with a configurable minimum-day target
- Execution Pulse for goals, weekly blocks and today's priorities
- Account / Settings area
- Editable profile name, role and optional email
- Configurable daily priority limit and low-energy minutes
- Weekly review with wins, friction, next-week changes and score
- JSON backup export/import
- Unlimited app-level media count; browser/device quota is the practical limit
- Multi-image/video uploads stored in IndexedDB
- Change/remove goal covers from the media library
- Weekly planning calendar with current dates
- Add, edit, complete and delete planning blocks
- Dynamic Training Space with Monday / Wednesday / Thursday split
- Editable exercises, checkboxes and rotating explosive movement
- Responsive desktop/tablet/mobile layout
- Installable PWA
- Single-file offline build option
- Persistent local data between refreshes

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

## Test on your phone over the same Wi-Fi

```bash
npm run dev:mobile
```

Vite will print a `Network` URL such as `http://192.168.x.x:5173`. Open that URL on your phone while the phone and computer are on the same network.

## Netlify

The repository includes `netlify.toml` and is ready for a standard Vite deployment.

Build command:

```text
npm run build
```

Publish directory:

```text
dist
```

The PWA manifest and service worker are included in the production build.

## Single-file local/offline build

Generate one bundled HTML file:

```bash
npm run build:offline
```

Output:

```text
dist/oncheck-offline.html
```

GitHub Actions also uploads this file as the `oncheck-offline` build artifact after successful pushes to `main`.

Important: opening local HTML files directly behaves differently across mobile operating systems and browsers. The single-file build removes ONCHECK's normal external JS/CSS asset dependency, but durable browser storage and install/PWA APIs can still depend on the browser environment. For everyday phone use, a hosted PWA remains the most predictable route.

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

## Project structure

```text
index.html
netlify.toml
public/
  manifest.webmanifest
  oncheck-icon.svg
  sw.js
scripts/
  build-offline.mjs
src/
  main.ts
  styles.css
  app-v2.css
  responsive-v2.css
  media-layer.ts
  media-layer.css
  workout-layer.ts
  workout.css
  mobile.css
  workout-mobile.css
  pwa.ts
package.json
tsconfig.json
vite.config.ts
```

## Data and sync

ONCHECK is currently local-first. Goal/planning/account/training state is stored in browser storage and uploaded media is stored in IndexedDB.

This means phone and laptop installations currently maintain independent local state. Cross-device sync would require a shared backend/auth layer later; it is intentionally not required for the current local-first MVP.
