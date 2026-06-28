# Authoring Workflow

Gaslights uses a split model:

- gameplay is a static app served from `public/`
- authoring is local-only and writes JSON files into the repo
- Vercel should stay read-only for published play

## Local commands

Run both the static app and the local authoring server:

```bash
npm run authoring:dev
```

Endpoints:

- app: `http://localhost:3000/`
- editor: `http://localhost:4179/editor/`

If you only need the player app:

```bash
npm run start
```

If you only need the authoring backend:

```bash
npm run editor
```

## Authoring flow

1. Open the app at `http://localhost:3000/`
2. Open the editor from the app shell or directly at `http://localhost:4179/editor/`
3. Edit:
   - world places
   - world people
   - world visit rules
   - case briefing
   - case locations
   - case visit rules
   - theory answers and solution questions
   - newspaper issue/articles
4. Save changes locally into repo JSON
5. Export JSON/CSV if you want a snapshot or batch-edit roundtrip

## Source of truth

Published runtime data lives in repo-tracked JSON under:

- `public/data/cases/`
- `public/data/london1895/`
- `public/data/newspapers/`

The mirrored non-public `data/` copies are kept for local authoring support where needed.

## Pre-publish checks

Run:

```bash
npm run publish:check
```

This runs:

- `npm run validate:data`
- `npm run validate:maps`
- `npm test`

To print the release checklist after checks pass:

```bash
npm run publish:prep
```

## What validation checks

`npm run validate:data` now validates:

- global locations
- global people
- case index and case files
- newspaper index and issue files
- broken references across:
  - locations
  - people
  - cases
  - visit rules
  - newspaper article links
- theory slot completeness
- solution question structure
- case-linked newspaper issue existence
- hidden-location reveal paths
- critical-path solvability warnings
- visit-rule reachability warnings for obvious shadowing cases

Warnings do not fail the command. Errors do.

## Publish model

Best-for-now publish model:

1. Author locally
2. Save/export into repo JSON
3. Run `npm run publish:check`
4. Commit and push
5. Let Vercel redeploy the static site

Do not treat the Vercel deployment as the authoring backend.
