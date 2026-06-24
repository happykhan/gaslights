# AGENTS.md — Gaslights implementation instructions

This repository is for **Gaslights**, a web/mobile historical detective game set in Victorian London.

The user wants an implementation that can borrow platform ideas from `happykhan/Londontour`, but Gaslights must become a separate investigation product with a data-driven case engine.

## Product north star

Build a playable digital consulting-detective-style case where the player investigates through:

- A historical London map.
- Searchable places of interest.
- A directory of people, businesses, and institutions.
- Newspaper articles and adverts.
- Static location leads.
- Specialist evidence interpretation hubs.
- A theory board and final solution comparison.

## Non-goals for early implementation

Do **not** start with:

- GPS walking mechanics.
- Accounts/login.
- Payments.
- AI-generated case text.
- Procedural cases.
- Multiplayer.
- Voice acting.
- Full adventure-game inventory puzzles.
- Dialogue trees as the main interaction model.

## Recommended technical approach for v0.1

Start simple and close to the existing LondonTour style:

```text
public/
  index.html
  assets/
    app.js
    styles.css
  data/
    london1895/
    cases/
scripts/
tests/
docs/
```

A no-build static app is acceptable for the first prototype. If a framework is introduced later, document why.

Useful LondonTour patterns to inspect and adapt:

- Static deployable app structure.
- MapLibre map shell.
- Layer catalog and layer toggles.
- Search panel.
- Editor mode.
- Service worker/offline pack approach.
- Smoke tests and Playwright map tests.

Do not hardcode case content into the JavaScript runtime. Store case content in JSON/Markdown-like data files.

## Design principles to preserve

### 1. The city is the interface

The main player decision is where to go next. Avoid replacing city navigation with dialogue menus.

### 2. The player's travel decision is usually the interaction

If the player finds a train ticket and then visits the railway clerk, the game should assume they are asking about the ticket. It should not expose an inventory/action menu unless the choice is genuinely ambiguous.

### 3. Prefer specialist POIs over dialogue options

Instead of one inspector location with many topics, use separate points of interest:

- Coroner.
- Railway office.
- Chemist.
- Insurance office.
- Port authority.
- Bank.
- Newspaper archive.
- Police station.

### 4. Most locations are flat

Most case locations should provide one useful lead and then be done. Only a few locations should have temporal or evidence-reactive behaviour.

### 5. Evidence is first-class, not inventory clutter

Evidence should be stored as structured objects. The player should not have to manually “use” evidence unless that interaction is clearly meaningful.

### 6. Experts interpret; players deduce

The runtime may convert evidence into interpreted facts at specialist hubs. It must not automatically solve the case for the player.

## Data-first implementation rules

All mechanics should be driven by data files:

- Locations.
- Directory entries.
- Newspaper articles.
- Cases.
- Leads.
- Evidence.
- Facts.
- Hub responses.
- Generic lead rules.
- Theory schema.

When adding a new mechanic, first ask: can this be represented in the data model without changing runtime code?

## Testing expectations

Add lightweight tests early:

- JSON schema validation for all data files.
- Smoke test: app loads.
- Smoke test: map initializes.
- Runtime test: visiting a location records it in state.
- Runtime test: evidence discovered at one location triggers the correct specialist hub text.
- Runtime test: generic locations fall back to generic text without breaking.
- Runtime test: theory comparison marks correct/incorrect slots.

## Copyright and data caution

Do not commit scanned historic map assets, directory data, newspaper scans, or third-party text unless the license is verified.

For v0.1, use placeholder historical tile URLs and sample hand-authored POIs. Add clear attribution and license fields to every imported data source.

Do not copy text, cases, artwork, maps, newspapers, or distinctive presentation from commercial detective games.

## First agent task

Implement the smallest vertical slice:

1. Static app scaffold.
2. Map shell with placeholder basemap and a configurable historical tile layer.
3. Load `public/data/london1895/locations.sample.json`.
4. Display POIs and search results.
5. Load one sample case.
6. Let the player visit a location and read lead text.
7. Discover a `train_ticket` evidence object.
8. Revisit a railway clerk hub and automatically show the ticket interpretation.
9. Save investigation state to localStorage.

That vertical slice proves the most important mechanic: **find evidence, choose the right specialist location, receive interpretation without exposing inventory machinery**.

## Web/mobile formula notes

Before adding a player-facing feature, read `docs/WEB_MOBILE_ADVANTAGES.md`. The early product should preserve the consulting-detective loop: choose a place, read a lead, think, and choose another place. Digital features should reduce paper friction, support note-taking/research, and make London richer. They should not replace the core loop with inventory puzzles or dialogue trees.
