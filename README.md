# ONCHECK

ONCHECK is a visual personal operating system for goals, weekly planning, progress tracking and media references.

## Stack

- TypeScript (strict mode)
- Vite
- Browser-native localStorage persistence
- Zero UI framework dependency

## Functional MVP

- Preloaded 2026–2029 goal system
- Add, edit, duplicate and delete goals
- Active / on-hold / completed goal states
- Editable checklists with automatic progress calculation
- Goal cover-image uploads
- Media library with local image uploads
- Weekly planning calendar
- Add, edit, complete and delete planning blocks
- Goal/status filtering
- Responsive desktop/tablet/mobile layout
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
src/
  main.ts       # application state, CRUD and interaction logic
  styles.css    # ONCHECK UI system and responsive layout
package.json
tsconfig.json
```

## Data and media

This MVP is local-first. Goals, planning blocks and uploaded images are saved to browser `localStorage`.

For uploaded images, keep files under 2 MB. A later production phase should move media to object storage and app data to a database with authentication and cloud sync.

## Development direction

The next architecture step is a proper backend layer (for example Postgres + object storage + authentication) while preserving the current ONCHECK interaction model and visual language.
