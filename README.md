# ONCHECK

ONCHECK is a visual personal operating system for goals, weekly planning, training, progress tracking and media references.

## Stack

- TypeScript (strict mode)
- Vite
- localStorage for goal/planning state
- IndexedDB for uploaded media
- Progressive Web App shell for mobile installation/offline reopening
- Zero UI framework dependency

## Functional MVP

- Preloaded 2026–2029 goal system
- Add, edit, duplicate and delete goals
- Active / on-hold / completed goal states
- Editable checklists with automatic progress calculation
- Unlimited app-level media count; browser/device quota is the practical limit
- Multi-image/video uploads stored in IndexedDB
- Change/remove goal covers from the media library
- Weekly planning calendar
- Add, edit, complete and delete planning blocks
- Dynamic Training Space with Monday / Wednesday / Thursday split
- Editable exercises, checkboxes and rotating explosive movement
- Goal/status filtering
- Responsive desktop/tablet/mobile layout
- Installable mobile PWA
- Persistent local data between refreshes

## Run from VS Code

Requirements: Node.js 20+ and npm.

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

## Permanent mobile access

The repository includes `.github/workflows/pages.yml`, which builds and deploys ONCHECK to GitHub Pages. GitHub Pages must be enabled once in the repository:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Re-run **Deploy ONCHECK to GitHub Pages** under the Actions tab, or push any commit.

The expected site address is:

```text
https://chidixplorestech.github.io/oncheck/
```

When opened on mobile, ONCHECK exposes an install option. On iPhone, open it in Safari and use **Share → Add to Home Screen**. On Android/Chromium, use the ONCHECK install prompt or the browser's **Install app / Add to Home screen** option.

## Verify before development

```bash
npm run typecheck
npm run build
```

## Production preview

```bash
npm run build
npm run preview
```

## Project structure

```text
index.html
public/
  manifest.webmanifest
  oncheck-icon.svg
  sw.js
src/
  main.ts
  styles.css
  media-layer.ts
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

ONCHECK is currently local-first. Goal/planning/training state is stored in the browser and uploaded media is stored in IndexedDB.

This means an installed phone version works independently, but changes made on a laptop do **not** automatically appear on the phone yet. The next architecture step for true cross-device use is authentication + a cloud database + object storage, while keeping an offline local cache for fast mobile use.
