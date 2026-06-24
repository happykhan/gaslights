# Gaslights

Gaslights is a web/mobile historical detective game set in a persistent, explorable Victorian London.

The product goal is not a walking tour and not a generic mystery generator. It is a digital-first historical mystery experience inspired by the core pleasures of consulting detective games: map, directory, newspaper, leads, evidence, deduction, and final theory.

## Product statement

> Solve historical mysteries in a living Victorian London by exploring real places, reading newspapers and directories, interpreting evidence through specialist locations, and building a theory of the case.

## Core loop

1. Read the case briefing.
2. Use the historical map, directory, and newspaper to choose a lead.
3. Visit a place of interest.
4. Read the location text.
5. Discover evidence, facts, people, or further locations.
6. Take evidence to relevant specialist locations where appropriate.
7. Update your theory: who, why, how, where, and when.
8. Submit the theory and compare it with the true solution.

## Core design principles

- The city is the interface.
- The player's travel decision is usually the interaction.
- Prefer new locations over dialogue trees.
- Most locations are static and only need one useful visit.
- A small number of specialist hub locations interpret evidence.
- Evidence is first-class, but this is not an inventory-combination adventure game.
- The player discovers evidence; experts interpret evidence; the player performs deduction.
- The mystery does not need to be impossibly clever. The challenge comes from finding the right threads inside a large, plausible city.
- Do not expose the machinery unless the choice is genuinely meaningful.

## Initial implementation documents

- [`AGENTS.md`](AGENTS.md) — instructions for AI coding agents working in this repository.
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — phased product and engineering plan.
- [`docs/CASE_AUTHORING_AND_EDITOR.md`](docs/CASE_AUTHORING_AND_EDITOR.md) — case development workflow, editor requirements, POI review, and generic lead engine.
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — initial JSON-first data model for locations, cases, evidence, hub responses, newspapers, directories, and theories.
- [`docs/PILOT_CASE_BRIEF.md`](docs/PILOT_CASE_BRIEF.md) — scope for the first playable pilot case.

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
- A few specialist evidence interpretation hubs.
- Notebook/history.
- Theory submission.
- End-of-case comparison.

No accounts, payments, AI writing, procedural cases, GPS walking, or multiplayer are needed for v0.1.
