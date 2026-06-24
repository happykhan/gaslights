# Web/mobile advantages for the Gaslights formula

This note defines what the web/mobile app should add to the classic consulting-detective formula without changing the genre.

The default play mode remains:

```text
choose location → read lead → think → choose next location
```

Most locations are static. The player visits once, reads the lead, and moves on. Specialist evidence interpretation is one additional mechanic, not the whole game.

## 1. Product position

Gaslights should make the paper formula smoother, deeper, and less clunky.

It should **not** become:

- an inventory-combination adventure game
- a dialogue-tree RPG
- a chatbot mystery
- a GPS walking game
- a mini-game collection
- a procedural mystery generator

The app should preserve the pleasure of reading, researching, mapping, and deducing.

## 2. Good digital upgrades

These are the kinds of features that improve the formula while preserving the core experience:

- spoiler control
- automatic visited-lead tracking
- searchable directory
- searchable newspaper archive
- historical map layers
- notebook and evidence log
- timeline builder
- theory sheet
- specialist evidence interpretation
- save/resume
- endgame comparison
- post-case exploration
- authoring and playtest tools

These are useful because they reduce paper friction or make Victorian London feel richer.

## 3. Dangerous digital upgrades for v0.1

Avoid these in the early product:

- inventory puzzles
- dialogue trees everywhere
- NPC chatbots
- hidden object scenes
- XP, levelling, or character stats
- procedural mysteries
- GPS walking requirements
- combat
- excessive animation
- voice acting dependency

These can distract from the main fantasy: being a clever investigator in a grounded historical city.

## 4. v0.1 feature set

The first pilot case should include only the features needed to prove the formula:

1. Historical zoomable map.
2. Searchable directory.
3. Searchable newspaper.
4. Static location leads.
5. Visited-lead tracking.
6. Notebook / evidence list.
7. A small number of specialist hub responses.
8. Theory submission.
9. Endgame comparison.
10. Save/resume.

This is enough to feel meaningfully better than paper while still being recognisably a consulting-detective-style game.

## 5. No accidental spoilers

Paper case books can accidentally expose adjacent leads on the same page. The app should only render the exact lead the player has chosen to visit.

Implementation requirements:

- Route all lead viewing through a single visit/open function.
- Render one lead at a time.
- Hide unrevealed conditional text.
- Keep solution/endgame content locked until the player deliberately ends the case.
- Do not show hidden location text in search results.

Suggested runtime function:

```ts
function visitLocation(caseId: string, locationId: string): LeadResolutionResult
```

## 6. Automatic visited-lead tracking

The app should record every meaningful visit automatically.

Suggested state:

```ts
type Visit = {
  caseId: string;
  locationId: string;
  leadId?: string;
  visitedAt: string;
  visitCount: number;
  countsAsLead: boolean;
};
```

Uses:

- map marker state
- lead count / score
- save/resume
- post-game route review
- debugging and playtesting analytics

Design note: do not punish the player for visiting ambient generic locations unless the case explicitly marks those visits as lead-counting.

## 7. Searchable directory

The directory is one of the key research tools.

The player should be able to search:

- person name
- business name
- institution name
- profession/category
- address text
- aliases
- district

Example searches:

```text
chemist
Harley Street
railway clerk
Lloyd's
coroner
```

Important rule: directory search should search directory data, not hidden case leads. It helps lookup; it should not solve deduction.

## 8. Searchable newspaper archive

The newspaper should become a proper research surface rather than a static prop.

Search should cover:

- the current issue for the case
- previous issues available up to the case date
- articles
- adverts
- court reports
- shipping notices
- births, deaths, and marriages
- society notices
- letters to the editor

Important rules:

- Only search newspapers available for the case date.
- Include irrelevant material and atmospheric noise.
- Do not highlight “this is a clue” too aggressively.
- Newspaper items should be linkable to locations/people when appropriate, but not every reference needs to become a lead.

## 9. Historical map layers

The map is a major digital advantage.

Initial layer types:

- Victorian base map
- modern reference map, optional
- known case locations
- visited locations
- directory locations
- police stations
- railways/stations
- hospitals/coroners
- hotels/lodging houses
- newspaper offices
- banks/insurance offices
- docks/shipping offices
- pubs/clubs

Map state should be saved with the investigation state:

```ts
type MapState = {
  center: [number, number];
  zoom: number;
  activeLayerIds: string[];
  historicalOpacity?: number;
};
```

## 10. Historical map controls

The first map controls should be simple:

- pan
- zoom
- search/jump to POI
- click POI
- toggle layers
- historical map opacity slider
- optional modern reference overlay

Do not build sophisticated route/alibi tools before the map, POI, and lead loop feel good.

## 11. Alibi and travel-time checking

The app can eventually provide a detective tool for estimating movement plausibility.

Example:

```text
Whitechapel → Paddington
Walking: unlikely in 30 minutes
Cab: possible
Rail/Underground: possible depending on route
```

This should be a tool, not an answer generator.

v0.1 approach:

- start with simple rough travel estimates
- support author overrides for case-critical journeys
- label results as estimates
- do not automatically mark alibis true/false unless the case author explicitly models that

Future approach:

- walking graph
- historical rail/Underground stops
- cab speed assumptions
- time-of-day modifiers

## 12. Notebook without admin pain

The notebook should have both automatic and manual sections.

Automatic sections:

- visited leads
- discovered people
- discovered places
- discovered evidence
- discovered facts
- hub interpretations

Manual sections:

- free text notes
- pinned clues
- suspected connections
- unresolved questions

Design rule: the app tracks what the player has encountered; the player still performs the deduction.

## 13. Timeline builder

Many mysteries depend on sequence, alibi, and travel time.

Timeline entries can be:

- auto-added by lead text
- auto-added by hub interpretation
- manually added by the player
- edited or pinned by the player

Suggested type:

```ts
type TimelineEvent = {
  id: string;
  caseId: string;
  label: string;
  timeText: string;
  sortTime?: string;
  source: 'auto' | 'player';
  sourceLeadId?: string;
  sourceEvidenceId?: string;
  sourceFactId?: string;
};
```

The timeline should help the player see contradictions. It should not automatically solve them.

## 14. Theory sheet

The theory sheet should be available during the investigation, not only at the end.

Core slots:

- Who?
- Why?
- How?
- Where?
- When?

Optional slots:

- accomplice
- key evidence
- cover-up
- red herring explanation
- unresolved question

Suggested type:

```ts
type PlayerTheory = {
  caseId: string;
  who?: string;
  why?: string;
  how?: string;
  where?: string;
  when?: string;
  evidenceIds?: string[];
  notes?: string;
  submittedAt?: string;
};
```

At endgame, compare each slot with the solution and award partial credit.

## 15. Evidence as first-class objects

Evidence should be structured, visible, and linkable.

Example:

```ts
type Evidence = {
  id: string;
  caseId: string;
  name: string;
  shortDescription: string;
  discoveredAtLocationId: string;
  discoveredInLeadId: string;
  domains: string[];
  tags: string[];
  supportsSolutionSlots?: string[];
};
```

Evidence is **not** an adventure-game inventory. In the common case, the player should not manually use evidence on a person or place.

## 16. Specialist hub responses

A small number of specialist POIs can interpret evidence.

Examples:

| Specialist POI | Interprets |
| --- | --- |
| Railway clerk | tickets, routes, timetables, luggage |
| Coroner | wounds, bodies, time of death, medical details |
| Chemist | powders, stains, poison, chemicals |
| Insurance office | policies, beneficiaries, claims |
| Bank | cheques, transfers, debts, accounts |
| Port authority | shipping manifests, dock records, cargo |
| Newspaper office/archive | past reports, adverts, public notices |

Mechanic:

```text
Find train ticket
Visit railway clerk
Game silently detects known evidence
Show new interpretation text
```

No menu is needed if the player’s intention is obvious. The location choice is the interaction.

Suggested type:

```ts
type HubResponse = {
  id: string;
  caseId: string;
  hubLocationId: string;
  priority: number;
  trigger: {
    evidenceAny?: string[];
    evidenceAll?: string[];
    factsAny?: string[];
    factsAll?: string[];
  };
  text: string;
  onResolve?: {
    discoverFactIds?: string[];
    revealLocationIds?: string[];
    addTimelineEventIds?: string[];
    addNotebook?: string;
  };
  repeatText?: string;
  countsAsLead?: boolean;
};
```

## 17. Persistent London knowledge

Across cases, the player should learn how Victorian London works.

Examples:

- Fleet Street = newspapers
- Harley Street = doctors
- Limehouse = docks, sailors, immigration
- Westminster = government
- City = finance, banks, insurance
- Whitechapel = lodging houses, poverty, crime
- Charing Cross / major termini = travel, railway clerks, luggage

This is a major product advantage over one-off mystery games. The city becomes familiar over time.

## 18. Recurring people and institutions

Recurring institutions help replace some of the comfort of named series characters.

Examples:

- Scotland Yard
- coroner
- railway office
- Lloyd's / insurance office
- newspaper office
- British Museum Reading Room
- port authority
- bank
- chemist/laboratory

These should be stable global POIs with case-specific text layered on top.

## 19. Spoiler-free hints

Hints can help stuck players without solving the case.

Good hints:

```text
You have not followed up the railway angle.
You have evidence that may be useful to a specialist.
Your theory explains the motive but not the timing.
The newspaper archive may contain useful context.
```

Bad hints:

```text
Go to Charing Cross Station.
The assistant did it.
Search the newspaper for Golden Pheasant.
```

Implement hints after the core case state is reliable. Hints depend on knowing what the player has visited, found, and theorised.

## 20. Better endgame reveal

The solution screen should compare the player’s path and theory to the true solution.

Show:

- submitted theory
- correct solution
- correct / partial / wrong slots
- critical clues found
- critical clues missed
- locations visited
- lead count
- optional optimal route
- red herrings explained

This turns failure into learning rather than simply saying “wrong”.

## 21. Post-case exploration

After solving, unlock extra material:

- all leads
- optimal route
- hidden evidence chain
- historical notes
- author commentary
- unused red herrings
- complete newspaper issue
- complete directory slice

This gives more value to a one-and-done case.

## 22. Solo and group play

For v0.1, build solo-first. Avoid design decisions that block group play later.

Future group mode:

- shared session code
- shared map/newspaper
- one lead opened at a time
- shared notebook
- multiple players can search reference material
- lead investigator role, optional

Do not build this in v0.1.

## 23. Accessibility

Digital should make the game easier to use than a printed map and booklet.

Requirements:

- responsive layout
- readable font sizes
- dark/light mode
- keyboard navigation
- semantic HTML
- screen-reader-friendly lead text
- no reliance on tiny map labels only
- no upside-down solution gimmicks

## 24. Save/resume

A case may take multiple sessions.

Save:

- current case
- visited leads
- discovered evidence
- discovered facts
- notes
- theory sheet
- timeline entries
- map/layer state
- newspaper bookmarks/search history, if useful

For v0.1, localStorage is enough. Accounts/cloud sync can wait.

Suggested type:

```ts
type InvestigationState = {
  caseId: string;
  startedAt: string;
  updatedAt: string;
  visits: Visit[];
  discoveredEvidenceIds: string[];
  discoveredFactIds: string[];
  revealedLocationIds: string[];
  notebook: NotebookState;
  timeline: TimelineEvent[];
  theory: PlayerTheory;
  mapState?: MapState;
};
```

## 25. Authoring and playtest benefits

The web app should also make case development easier.

The editor should eventually show:

- all case locations on the map
- which clues point to which locations
- which evidence can be interpreted where
- whether the case can be solved without a critical location
- dead-end density
- missing repeat text
- missing generic fallback text
- solution slots with supporting evidence

During playtesting, record:

- visit order
- common stuck points
- unused leads
- evidence found but never interpreted
- theories submitted
- wrong suspects/motives

This feedback makes case writing easier than a purely paper design process.

## 26. Implementation priority

Build in this order:

1. Static app shell and map.
2. Load global POIs and case-specific leads from JSON.
3. Directory search.
4. Newspaper reader/search.
5. Visit lead and track visited locations.
6. Notebook/evidence log.
7. Specialist hub responses.
8. Theory sheet.
9. Endgame comparison.
10. Save/resume.

## 27. Acceptance test for v0.1

A player can:

1. Start the pilot case.
2. Read the briefing.
3. Search the directory.
4. Search the newspaper.
5. Choose locations on the map.
6. Read only the leads they visit.
7. Discover evidence.
8. Get at least one specialist interpretation by visiting the right POI.
9. Maintain notes and a theory.
10. Submit a final theory.
11. See a meaningful comparison with the solution.

If this works, Gaslights has proven its core digital value while preserving the classic formula.
