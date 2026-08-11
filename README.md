# ONCHECK

ONCHECK is a local-first personal operating system for goals, focus, planning, and visual references.

## Stack

- TypeScript in strict mode
- Modern browser ES modules
- Node.js development server with no runtime framework dependency
- IndexedDB for uploaded media
- localStorage for goals, plans, notes, and app state

The first version deliberately stays dependency-light and local-first. It is fast to run in VS Code and leaves a clean path to add accounts, cloud sync, and a backend later.

## Current features

- Add, edit, archive, reorder, and delete goals
- Goal checklists with computed progress
- Goal media attachments and cover art
- Weekly planning blocks: add, edit, complete, and delete
- Functional focus timer
- Journal with per-goal notes
- Analytics dashboard
- Media library stored in IndexedDB
- Search and status filtering
- Seeded with the 2026–2029 ONCHECK goals

## Run from VS Code

### Fastest route

```bash
git clone https://github.com/chidiXplorestech/oncheck.git
cd oncheck
code .
npm run dev
```

Then open:

```text
http://localhost:5173
```

`npm run dev` uses Node's built-in HTTP server, so the checked-in build can run without installing packages first.

### If you want to edit the TypeScript source

Install the dev dependency once:

```bash
npm install
```

Then after editing `src/app.ts`:

```bash
npm run build
npm run dev
```

## Verify the source

```bash
npm install
npm run typecheck
npm run build
```

## Project structure

```text
index.html             App entry point
styles.css             ONCHECK design system / UI styling
src/app.ts             TypeScript source
dist/app.js            Browser-ready compiled app
media/                  Built-in visual references
scripts/dev-server.mjs Local development server
```

## Local data

- Goal/planning state is stored in `localStorage`.
- Uploaded media is stored in IndexedDB.
- Clearing browser site storage resets local state.
