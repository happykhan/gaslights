# Case authoring and editor plan

## 1. What a Gaslights case is

A case is not just a sequence of pages. It is a small mystery layered onto a much larger city.

A case contains:

- A true solution.
- A briefing.
- Case-relevant locations.
- Static leads.
- Visit rules.
- Notebook notes.
- Reactive POI responses.
- Directory entries.
- Newspaper items.
- Red herrings and ambient city material.
- A final theory check.

The case should feel like a needle-in-a-haystack investigation, but not an impossible search.

## 2. Design principle: the city is the interaction model

The author should usually ask:

> “Where would a good detective go with this information?”

Not:

> “Which dialogue option should appear?”

If the player finds a train ticket and visits a railway clerk, the game should assume they are asking about the ticket.

If the player finds a strange powder and visits a chemist, the game should assume they ask about the powder.

If the player finds an insurance policy and visits an insurance office, the game should assume they ask about the policy.

Only expose a choice when there are genuinely multiple possible things to discuss and the choice itself is interesting.

## 3. Case development workflow

### Step 1 — Write the truth first

Before writing leads, define the true solution:

```text
Who did it?
Why did they do it?
How did they do it?
Where did the key event happen?
When did the key event happen?
What was the cover-up?
What evidence proves each point?
```

Do this before writing flavour text.

### Step 2 — Define the critical evidence chain

A simple chain might be:

```text
Crime scene
  → train ticket found
  → railway office interprets ticket
  → hotel register discovered
  → hotel witness identifies suspect
  → shipping office confirms planned escape
```

Each link should map to a location or document.

### Step 3 — Define multiple routes to the same truth

Avoid one brittle chain. A player should be able to solve by different paths:

```text
Route A: crime scene → ticket → railway office → hotel
Route B: newspaper advert → hotel → shipping office
Route C: directory search → suspect address → pawn receipt → docks
```

This makes the player feel clever rather than railroaded.

### Step 4 — Choose the case slice of London

For the pilot, avoid all of London.

Use a focused slice:

- 50–100 visible POIs.
- 20–30 case-relevant leads.
- 5–8 useful offices, institutions, or experts.
- A few large districts: e.g. Whitechapel, Fleet Street, Charing Cross, Limehouse, City.

The player should see the haystack, but the haystack should be tuned.

### Step 5 — Write static leads first

Most locations should be flat:

```text
Visit once → read useful text → done.
```

Do not make every location evolve.

### Step 6 — Add reactive visit rules

Only after the static leads exist, add case-specific responses at relevant expert or institutional locations.

Examples:

- Railway office interprets tickets and timetables.
- Coroner interprets body, wounds, time of death.
- Chemist interprets powders, stains, poisons.
- Insurance office interprets policies and beneficiaries.
- Port authority interprets shipping manifests and dock records.
- Bank interprets cheques, transfers, and accounts.

### Step 7 — Add generic/ambient locations

Generic locations stop the wider city from feeling broken without requiring bespoke writing for every POI.

Examples:

- Pubs.
- Churches.
- Lodging houses.
- Shops.
- Police stations.
- Theatres.
- Hotels.

Generic text should be plausible, short, and non-spoilery.

### Step 8 — Add newspaper and directory material

The newspaper should include:

- One or two case-relevant items.
- A few indirect hints.
- Plenty of irrelevant but atmospheric material.
- Adverts that may become useful if searched later.

The directory should include:

- Case suspects.
- Realistic businesses.
- Specialist institutions.
- Enough noise to make searching feel investigative.

### Step 9 — Test the case as a graph

For each solution slot, check that evidence exists:

| Slot | Proof required | Where discovered | Optional confirmation |
| --- | --- | --- | --- |
| Who | Suspect identity | Hotel witness | Newspaper advert |
| Why | Motive | Insurance policy | Bank record |
| How | Method | Chemist report | Coroner report |
| Where | Key location | Shipping ledger | Witness statement |
| When | Timeline | Train timetable | Cab record |

### Step 10 — Playtest for search frustration

Watch for:

- Too many dead ends.
- Critical clues hidden behind obscure reasoning.
- The player knowing the answer but the game blocking them.
- Reactive POIs feeling like adventure-game item puzzles.
- Newspaper being too obviously clue-highlighted.

## 4. Editor goals

The editor exists to help the author build a case from a large set of auto-generated or fetched POIs.

It should support three authoring layers:

1. Global city data.
2. Case-specific overlays.
3. Runtime gameplay rules.

## 5. Editor mode screens

### 5.1 POI review queue

Purpose: inspect auto-generated/fetched POIs before they become part of the game.

Features:

- List candidate POIs.
- Filter by source, type, confidence, district, and missing fields.
- Show POI on map.
- Edit name, aliases, address, coordinates, type, tags.
- Merge duplicates.
- Reject bad POIs.
- Promote POI to global location database.
- Attach source and license notes.

Suggested statuses:

```text
candidate → reviewed → promoted → rejected → needs_research
```

### 5.2 Global location editor

Purpose: maintain the persistent Victorian London location database.

Fields:

- Name.
- Aliases.
- Type.
- Address.
- Coordinates.
- Search preview text.
- Default visit text.
- World visit texts for reusable global behaviour.
- Tags.
- Source references.
- Small map/search tags.

### 5.3 Case map editor

Purpose: select which global locations are active in a case.

Features:

- Pick a case.
- Toggle global POIs into the case.
- Mark a POI as one of:
  - `lead`.
  - `ambient`.
  - `red_herring`.
  - `hidden`.
- Add map marker style.
- Add case-specific labels and visit rules.

### 5.4 Lead editor

Purpose: write what happens when the player visits a case location.

Fields:

- Lead title.
- Location.
- Main text.
- Discover evidence.
- Discover facts.
- Reveal people.
- Reveal locations.
- Add notebook summary.
- Counts as lead? yes/no.
- Tags for scoring and solution support.

Most leads should have a single main text.

### 5.5 Evidence editor

Purpose: make evidence first-class.

Fields:

- Evidence ID.
- Display name.
- Short summary.
- Full description.
- Discovered at.
- Domains.
- Tags.
- Related people.
- Related locations.
- Which solution slot it supports.

Example domains:

```text
railway_ticket
medical
chemical
financial
insurance
shipping
handwriting
weapon
newspaper_archive
identity
```

### 5.6 Reactive visit rule editor

Purpose: define what happens when prior visits make a later place relevant.

Fields:

- Location.
- Required resolved visit rules, visited locations, or visit counts.
- Response text.
- Revealed locations.
- Notebook note.
- Counts as lead? usually yes for first useful response.
- Can repeat? usually no.

Example:

```text
Prior visit rule: lead_harcourt_laboratory
Location visited: Charing Cross Railway Office
Response: Clerk checks the ledger once the player knows what journey matters.
Reveals location: Brighton Hotel Office
```

### 5.7 Generic lead rule editor

Purpose: control what happens when the player visits a location without case-specific content.

Features:

- Rules by location type.
- Rules by tags.
- First-visit vs repeat-visit variants.
- Case-aware neutral flavour.
- “Nothing useful yet” text for tagged offices or institutions.

Example generic rule:

```text
Type: pub
Text: The publican has heard the usual gossip, but nothing that appears to touch the present matter.
Counts as lead: false
```

Example tagged-office generic rule:

```text
Tag: railway
Text: The clerk explains that railway records are exacting, but he needs a ticket, destination, date, or named passenger before he can help.
Counts as lead: false
```

### 5.8 Preview and validation

The editor should allow the author to preview a location as the player would see it under different investigation states:

- No evidence.
- Evidence found.
- Fact interpreted.
- Location already visited.

Validation should warn about:

- Lead references missing location.
- Visit rule references missing location.
- Visit rule condition references missing rules or locations.
- Solution slot has no option or solution value.
- Hidden location has no unlock path.
- Duplicate IDs.
- Missing source/license for imported POI.

### 5.9 Export

For v0.1, the editor can simply export JSON to copy into the repository.

Later options:

- Save to local file.
- Commit to GitHub through API.
- Store in a small CMS.
- Use a backend database.

## 6. Runtime lead selection logic

When the player visits a location, the engine should select content in this order:

1. Matching case visit rule.
2. Matching world visit rule.
3. Generic tag or location-type rule.
4. Global fallback text.

Pseudo-code:

```js
function resolveVisit(caseData, location, state) {
  const caseRule = findMatchingCaseVisitRule(caseData, location.id, state);
  if (caseRule) return renderVisitRule(caseRule);

  const worldRule = findMatchingWorldVisitRule(location, caseData.date, state);
  if (worldRule) return renderVisitRule(worldRule);

  const genericRule = findGenericTagOrTypeRule(location, state);
  if (genericRule) return renderGeneric(genericRule);

  return renderFallback(location);
}
```

Important: if a later visit rule depends on an earlier visit, that rule should generally have higher priority than generic or repeat text.

## 7. Counting leads and scoring

Lead counting should avoid punishing reasonable exploration too harshly.

Suggested v0 rules:

- First visit to a case lead counts.
- First useful reactive POI response counts.
- Repeat visits do not count.
- Generic ambient “nothing useful” visits do not count.
- Optional: track generic visits separately as “wandering” but do not include in score initially.

This can be tuned after playtesting.

## 8. How to develop the first case in practice

Use a spreadsheet or markdown planning file before entering the editor.

Minimum planning tables:

### Locations

| ID | Name | Type | Role | Notes |
| --- | --- | --- | --- | --- |
| crime_scene | Drayton Laboratory | case_lead | critical | Body / disappearance start |
| railway_office | Charing Cross Railway Office | lead | reactive visit | Handles train ticket |
| insurance_office | Lloyd's agent | lead | reactive visit | Handles policy |

### Evidence

| ID | Found at | Domain | Interpreted by | Reveals |
| --- | --- | --- | --- | --- |
| train_ticket | crime_scene | railway_ticket | railway_office | purchase time / destination |
| policy | solicitor | insurance | insurance_office | beneficiary / motive |

### Facts

| ID | How learned | Supports |
| --- | --- | --- |
| ticket_bought_by_assistant | railway_office from train_ticket | who / when |
| beneficiary_changed | insurance_office from policy | motive |

### Solution support

| Slot | Correct answer | Critical proof |
| --- | --- | --- |
| Who | assistant | ticket + hotel witness |
| Why | formula theft / debt | bank + letter |
| How | staged disappearance | lab evidence + witness |
| Where | Limehouse warehouse | shipping ledger |
| When | Tuesday night | train timetable |

Once these tables make sense, enter them into JSON/editor.

## 9. Avoiding adventure-game problems

Bad pattern:

```text
Find key → use key on door → find crowbar → use crowbar on crate
```

Gaslights pattern:

```text
Find a lead → choose a relevant tagged POI → receive case-specific text → use it in deduction
```

Do not lock the final answer behind arbitrary object combinations. If a player has guessed the truth, the game should let them submit it. Reactive POIs should strengthen, verify, or deepen their theory, not act as mandatory puzzle locks unless narratively essential.
