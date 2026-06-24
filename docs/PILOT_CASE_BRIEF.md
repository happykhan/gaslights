# Pilot case brief — v0.1

## Working title

**The Missing Chemist**

This is a working title only. It exists to test the Gaslights engine, not to be final marketing copy.

## Pilot goal

Build one complete playable mystery that proves the core product:

- Historical London map exploration.
- Directory and newspaper research.
- Static location leads.
- Evidence discovery.
- Evidence interpretation at specialist POIs.
- Theory submission.
- End-of-case comparison.

## Target playtime

60–120 minutes for a first-time player.

## Mystery complexity

Moderate. The case does not need a genius twist.

The challenge should come from:

- Finding the right leads in a large city.
- Knowing which specialist POI can interpret which evidence.
- Connecting timeline, motive, and opportunity.
- Filtering noise from newspaper/directory material.

## Proposed premise

London, 1894.

An analytical chemist disappears after giving a lecture. His laboratory is found in disorder. A drawer has been forced, an assistant is missing, and an apparently irrelevant railway ticket is discovered beneath a blotter.

The truth involves stolen formulae, debt, a staged disappearance, and an attempted escape through the docks.

## Core solution slots

| Slot | Target answer type |
| --- | --- |
| Who | Named suspect |
| Why | Motive: theft/debt/insurance/formula |
| How | Staged disappearance / false trail |
| Where | Warehouse/dock-related location |
| When | Night of disappearance, pinned by railway/timetable evidence |

## Required mechanics to demonstrate

### 1. Static lead

Example:

```text
Visit laboratory → discover train ticket and forced drawer.
```

### 2. Specialist hub with automatic interpretation

Example:

```text
Find train ticket → visit railway office → clerk automatically interprets ticket.
```

No explicit “use ticket” menu.

### 3. Hub without evidence

Example:

```text
Visit railway office before finding ticket → clerk says he needs a ticket, date, destination, or passenger name.
```

### 4. Directory lead

Example:

```text
Search assistant's name → find address / employer / profession.
```

### 5. Newspaper clue hidden in noise

Example:

```text
Shipping advert or society notice becomes meaningful only after another clue.
```

### 6. Generic ambient location

Example:

```text
Visit random pub → plausible non-critical text; does not count as lead.
```

### 7. Endgame comparison

Player submits:

```text
Who?
Why?
How?
Where?
When?
```

The game compares their theory to the solution and shows missed critical evidence.

## Suggested POI counts

For the pilot:

- 50–100 visible POIs.
- 20–30 case-specific leads.
- 5–8 specialist hubs.
- 8–12 evidence objects.
- 8–12 interpreted facts.
- 1 newspaper issue with 15–25 items.
- 30–60 directory entries.

## Suggested specialist hubs

- Railway office.
- Coroner.
- Chemist / analyst.
- Insurance office.
- Bank.
- Port authority / shipping office.
- Newspaper archive.
- Police station.

## Suggested lead categories

| Category | Count | Purpose |
| --- | ---: | --- |
| Critical | 3–5 | Required to fully prove solution |
| Important | 6–10 | Strongly supports the correct path |
| Optional | 6–10 | Adds context or partial confirmation |
| Red herring | 3–5 | Plausible but fair misdirection |
| Ambient | many | City texture, generic fallbacks |

## First playable slice

Implement only this mini-chain first:

```text
Briefing
  → Laboratory
  → train_ticket evidence
  → Railway Office
  → interpreted ticket fact
  → Theory board updated manually by player
```

This slice proves the evidence-hub mechanic. Build it before writing the full case.

## Playtest questions

After the first test, ask:

1. Did the player understand that the map was the main interaction?
2. Did the player naturally think to take the train ticket to the railway office?
3. Did the automatic interpretation feel magical rather than hidden UI?
4. Did generic locations feel atmospheric or annoying?
5. Did the newspaper feel like a real paper or an obvious clue list?
6. Did the player feel blocked by the game state despite having guessed the truth?
7. Was the haystack interesting or just frustrating?

## Content warning for authors

Do not spend too long making the first mystery brilliant. The pilot is testing the format.

A simple, fair, grounded mystery is better than a clever but fragile plot.
