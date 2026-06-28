# Gaslights

Gaslights is a web/mobile historical detective game set in a persistent, explorable Victorian London.

The product goal is not a walking tour and not a generic mystery generator. It is a digital-first historical mystery experience inspired by the core pleasures of consulting detective games: map, directory, newspaper, location leads, deduction, and final theory.

## Product statement

> Solve historical mysteries in a living Victorian London by exploring real places, reading newspapers and directories, following location leads, and building a theory of the case.

## Core loop

1. Read the case briefing.
2. Use the historical map, directory, and newspaper to choose a lead.
3. Visit a place of interest.
4. Read the location text.
5. Discover people, contradictions, routes, or further locations.
6. Revisit relevant offices, institutions, or experts when previous visits give you something concrete to ask about.
7. Update your theory: who, why, how, and where.
8. Lock your theory, answer case-specific questions, and compare with the true solution.

## Core design principles

- The city is the interface.
- The player's travel decision is usually the interaction.
- Prefer new locations over dialogue trees.
- Most locations are static and only need one useful visit.
- A small number of locations react to prior visits.
- The game is not an inventory-combination adventure game.
- The player chooses places; the runtime tracks visits; the player performs deduction.
- The mystery does not need to be impossibly clever. The challenge comes from finding the right threads inside a large, plausible city.
- Do not expose the machinery unless the choice is genuinely meaningful.

## Initial implementation documents

- [`AGENTS.md`](AGENTS.md) — instructions for AI coding agents working in this repository.
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — phased product and engineering plan.
- [`docs/CASE_AUTHORING_AND_EDITOR.md`](docs/CASE_AUTHORING_AND_EDITOR.md) — case development workflow, editor requirements, POI review, and generic lead engine.
- [`docs/AUTHORING_WORKFLOW.md`](docs/AUTHORING_WORKFLOW.md) — local editor workflow, validation commands, and publish path for the static Vercel deployment.
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — JSON-first data model for locations, people, visit rules, cases, newspapers, and theories.
- [`docs/PILOT_CASE_BRIEF.md`](docs/PILOT_CASE_BRIEF.md) — scope for the first playable pilot case.
- [`docs/PILOT_CASE_FULL_DRAFT.md`](docs/PILOT_CASE_FULL_DRAFT.md) — complete playable draft for the first case.
- [`docs/PILOT_CASE_RUNTIME_CHECKLIST.md`](docs/PILOT_CASE_RUNTIME_CHECKLIST.md) — runtime requirements for loading and playing the pilot case.
- [`data/cases/missing-chemist.case.json`](data/cases/missing-chemist.case.json) — machine-readable pilot case data.

## Historical map docs

- [`docs/HISTORICAL_TILE_BUILD_PROCESS.md`](docs/HISTORICAL_TILE_BUILD_PROCESS.md) — the end-to-end guide for building historical overlays from reviewed NLS sheets into `public/tiles/`.
- [`docs/NLS_HISTORICAL_MAP_PIPELINE.md`](docs/NLS_HISTORICAL_MAP_PIPELINE.md) — command-level NLS preview, crop-review, reviewed-build, and manifest workflow notes.
- [`docs/IIIF_TILE_DOWNLOAD_WORKFLOW.md`](docs/IIIF_TILE_DOWNLOAD_WORKFLOW.md) — lower-level single-sheet IIIF download notes and source-image constraints.

## Local authoring

For day-to-day case authoring, run both the static app and the local editor backend:

```bash
npm run authoring:dev
```

This exposes:

- app: `http://localhost:3000/`
- editor: `http://localhost:4179/editor/`

Before publishing updated content, run:

```bash
npm run publish:check
```

Full workflow details are in [`docs/AUTHORING_WORKFLOW.md`](docs/AUTHORING_WORKFLOW.md).

## Historical map build

Gaslights uses a single local historical overlay based on the London 1895 six-inch series rather than hotlinking the NLS viewer at runtime.

The cheapest reviewed-sheet build is preview mode:

```bash
npm run nls:build:preview -- --manifest data/raw/nls-sheet-index/london-1895-six-inch.manifest.json
```

This builds zooms `12-14`, which is useful when you want to get sheets onto the map quickly with the smallest tile pyramid.

The normal reviewed-sheet build command is draft mode:

```bash
npm run nls:build:draft -- --manifest data/raw/nls-sheet-index/london-1895-six-inch.manifest.json
```

This builds zooms `12-16`, which is enough to get the map in place without generating the heaviest deep-zoom pyramid.

If you want the slower, heavier build with deeper zoom tiles:

```bash
npm run nls:build:full -- --manifest data/raw/nls-sheet-index/london-1895-six-inch.manifest.json
```

This builds zooms `12-18`.

If the reviewed sheets are already fully downloaded locally and you only want to build the overlay from what is present:

```bash
npm run nls:build:preview -- --manifest data/raw/nls-sheet-index/london-1895-six-inch.manifest.json --skip-download
```

or

```bash
npm run nls:build:draft -- --manifest data/raw/nls-sheet-index/london-1895-six-inch.manifest.json --skip-download
```

This flow is documented in:

- [`docs/HISTORICAL_TILE_BUILD_PROCESS.md`](docs/HISTORICAL_TILE_BUILD_PROCESS.md)

## Public POI import

Gaslights now supports a separate imported public-POI layer sourced from modern OpenStreetMap data inside the current six-inch historical map bounds.

The import command is:

```bash
npm run pois:osm:import
```

This writes:

- `public/data/london1895/locations.osm.json` — imported public POIs shown by the app.
- `public/data/london1895/location-overrides.json` — local hide/edit patches for later editor work.
- `data/raw/osm-london-1895.summary.json` — import counts and type breakdown.

The runtime keeps these imported locations separate from the hand-authored case seed in `public/data/london1895/locations.seed.json`.

## Relationship to LondonTour

Gaslights can borrow platform ideas from `happykhan/Londontour`, especially the map shell, layer panel, search UI, offline/service-worker approach, and editor-mode thinking.

Do not simply turn LondonTour into a detective game. Reuse the useful map/product patterns while making the investigation model data-driven from the beginning.

## Version 0.1 target

The first useful milestone is a single playable case in a small but convincing slice of Victorian London:

- Historical map layer.
- Searchable POIs.
- Directory entries.
- One newspaper issue.
- Static location leads.
- A few tagged POIs unlocked by prior visits.
- Notebook/history.
- Theory submission.
- End-of-case comparison.

No accounts, payments, AI writing, procedural cases, GPS walking, or multiplayer are needed for v0.1.
