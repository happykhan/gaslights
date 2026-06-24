# Gaslights implementation plan

## 1. Product definition

Gaslights is a web/mobile historical detective game set in a persistent Victorian London.

The player does not physically walk around London. They explore a digital historical map, read case materials, visit locations, collect evidence, and deduce the answer.

The product should feel grounded, like an investigation inside a real city rather than a generic mystery UI.

## 2. Core experience

The player receives:

- Case briefing.
- Historical London map.
- Directory.
- Newspaper.
- Known informants / specialist institutions.
- Notebook / visited lead history.
- Theory board.

They then choose where to investigate.

A typical loop:

```text
Briefing
  ↓
Map / directory / newspaper
  ↓
Choose a place
  ↓
Read the lead
  ↓
Discover evidence, facts, people, or further places
  ↓
Take evidence to a specialist POI if useful
  ↓
Update theory
  ↓
Submit final answer
```

## 3. Relationship to LondonTour

Borrow platform ideas from `happykhan/Londontour`, not product identity.

Useful existing concepts:

- Static deployable web app.
- MapLibre map shell.
- Layer panel.
- Search panel.
- POI layer catalog.
- Offline fallback and service worker approach.
- Editor mode that outputs JSON.
- Smoke tests and Playwright map tests.

Gaslights-specific replacements:

| LondonTour concept | Gaslights equivalent |
| --- | --- |
| Route | Case |
| Tour stop | Investigation location / lead |
| Layer stop | POI / directory location / case-relevant place |
| Route editor | Case editor |
| Printable directions | Case notebook / lead history |
| Nearby exploration | Searchable city / POI discovery |
| Route geometry | Optional alibi/travel-time calculations |

## 4. Technical architecture

### 4.1 v0 architecture

Use a simple static app first:

```text
public/
  index.html
  assets/
    app.js
    styles.css
  data/
    london1895/
      locations.sample.json
      directory.sample.json
      newspapers.sample.json
      generic-lead-rules.json
    cases/
      missing-chemist.sample.json
scripts/
  validate-data.mjs
  build-search-index.mjs
tests/
  smoke.test.mjs
  case-engine.test.mjs
docs/
```

This keeps the first build close to LondonTour and easy for an AI agent to reason about.

### 4.2 Future architecture

If the prototype proves fun, refactor into modules:

```text
apps/web/
packages/map/
packages/cases/
packages/directory/
packages/newspaper/
packages/deduction/
packages/editor/
packages/content-schema/
```

Do not begin with this complexity unless the static prototype becomes hard to maintain.

## 5. Milestones

### Milestone 0 — Repo scaffold

Goal: create a working static app shell.

Deliverables:

- `package.json` with scripts.
- `public/index.html`.
- `public/assets/app.js`.
- `public/assets/styles.css`.
- Basic smoke test.
- Local dev command.

Acceptance criteria:

- `npm install` works.
- `npm start` serves the app.
- App loads on desktop and mobile viewport.

### Milestone 1 — Victorian London explorer

Goal: prove the map and POI browsing experience.

Deliverables:

- MapLibre map shell.
- Configurable basemap layer.
- Configurable historical tile layer placeholder.
- Layer toggle panel.
- POI markers loaded from JSON.
- POI popup / side panel.
- Search by POI name, alias, type, and address.

Acceptance criteria:

- The player can open the app, pan around London, search for a POI, and open its page.
- The map layer source is configurable without code changes.
- POI data is not hardcoded in `app.js`.

### Milestone 2 — Case runtime vertical slice

Goal: one case can be loaded and one lead can be visited.

Deliverables:

- Case selector or direct case load.
- Case briefing page.
- Active case locations highlighted on map.
- Location visit panel.
- Visit state saved in localStorage.
- Lead count recorded.

Acceptance criteria:

- Player can start a case.
- Player can visit at least three locations.
- Visited locations are recorded.
- Refreshing the page keeps investigation state.

### Milestone 3 — Evidence and specialist hub mechanic

Goal: implement the core digital improvement.

Deliverables:

- Evidence objects.
- Facts / knowledge objects.
- Hub response rules.
- Automatic hub interpretation when the player visits the correct specialist location.
- No explicit “use item on person” UI for the simple case.

Acceptance criteria:

Example vertical slice:

1. Player visits the body/crime scene.
2. Player discovers `train_ticket`.
3. Player visits `charing_cross_railway_office`.
4. The railway clerk automatically gives new text interpreting the ticket.
5. The game records the interpreted fact.
6. No inventory menu is exposed.

### Milestone 4 — Generic location engine

Goal: let the player visit non-case POIs without every POI needing bespoke case text.

Deliverables:

- Generic lead rules by location type and hub domain.
- Fallback text for irrelevant locations.
- Ambient/generic visit handling.
- Generic visits should not break scoring.

Acceptance criteria:

- Visiting a random pub gives plausible non-critical text.
- Visiting a random church gives plausible non-critical text.
- Visiting an expert hub without relevant evidence gives a useful “nothing specific yet” response.
- Generic text is clearly non-spoilery.

### Milestone 5 — Newspaper and directory

Goal: make the map feel grounded in a city information network.

Deliverables:

- Directory screen.
- Searchable directory entries.
- Newspaper issue screen.
- Searchable newspaper articles and adverts.
- Links from directory/newspaper entries to POIs where appropriate.

Acceptance criteria:

- Player can search a person/business and jump to its location.
- Player can search a newspaper term and find article/ad mentions.
- Newspaper contains both clues and irrelevant flavour/noise.

### Milestone 6 — Case editor MVP

Goal: enable case development from auto-generated/fetched POIs.

Deliverables:

- Editor mode behind a query string or local flag.
- POI review queue.
- Promote POI to global location.
- Add/edit case-specific lead text for a location.
- Add evidence discovered at a lead.
- Add hub response triggered by evidence.
- Preview a lead as the player would see it.
- Export updated JSON.

Acceptance criteria:

- Author can import POI candidates.
- Author can select a POI and make it part of a case.
- Author can write lead text and evidence output.
- Author can define a specialist hub response.
- Author can export valid case JSON.

### Milestone 7 — Theory board and endgame

Goal: evaluate what the player understood, not just what they clicked.

Deliverables:

- Theory board with slots: who, why, how, where, when.
- Evidence/fact support selection or automatic explanation list.
- Solution model.
- End-of-case comparison screen.
- Lead count and optional score.

Acceptance criteria:

- Player can submit a theory.
- App compares each theory slot to the solution.
- App shows which categories were correct/incorrect.
- App lists missed critical evidence without being cruel or opaque.

### Milestone 8 — First playable pilot

Goal: a 60–120 minute playable case.

Deliverables:

- One complete case.
- 50–100 visible POIs.
- 20–30 case leads.
- 5–8 specialist hubs.
- 8–12 evidence objects.
- One newspaper issue.
- Directory entries.
- End solution and scoring/comparison.

Acceptance criteria:

- A tester can complete the case without developer assistance.
- A tester can solve through multiple possible routes.
- The tester understands why the answer is correct.
- The tester feels they were investigating London, not clicking a linear story.

## 6. Initial scripts

Suggested `package.json` scripts:

```json
{
  "scripts": {
    "start": "npx --yes serve public",
    "test": "node --test tests/*.test.mjs",
    "validate:data": "node scripts/validate-data.mjs",
    "build:search": "node scripts/build-search-index.mjs",
    "test:all": "npm run validate:data && npm test"
  }
}
```

Add Playwright later once the map shell exists.

## 7. Source and licensing tasks

Do not block v0.1 on perfect historical data ingestion.

Initial approach:

- Use hand-authored sample POIs.
- Use configurable placeholder historical tile URL.
- Keep source/attribution/license fields in every imported item.
- Add a later data pipeline for real historical map tiles, gazetteers, and directory imports.

Open licensing tasks:

- Verify historical map tile source and commercial terms.
- Verify any gazetteer data source and reuse terms.
- Verify any directory or newspaper data source and reuse terms.
- Keep a `docs/SOURCES.md` once real data is imported.

## 8. Implementation priority

Build in this order:

1. Map and POI browser.
2. Case runtime.
3. Evidence-to-hub interpretation.
4. Generic location fallback.
5. Editor.
6. Newspaper/directory.
7. Theory board.
8. Full pilot case.

Do not spend weeks on historical data ingestion before the evidence-hub gameplay works.
