# Pilot case runtime checklist

This checklist describes the minimum runtime behaviour needed to play **The Missing Chemist** from the JSON files.

## Files

- `data/cases/missing-chemist.case.json`
- `data/london1895/locations.seed.json`
- `data/london1895/directory.seed.json`
- `data/london1895/generic-lead-rules.seed.json`
- `data/newspapers/1894-05-17-london-evening-chronicle.json`

## Load order

1. Load locations.
2. Load directory.
3. Load newspaper issue.
4. Load case.
5. Validate references.
6. Create initial investigation state from `case.startingLocationIds`.

## Initial state

```json
{
  "caseId": "missing_chemist",
  "visitedLocationIds": [],
  "locationVisitCounts": {},
  "resolvedVisitRuleIds": [],
  "revealedLocationIds": ["harcourt_laboratory", "harcourt_home", "royal_institution"],
  "notebookEntries": [],
  "leadCount": 0,
  "genericVisitCount": 0,
  "theory": {
    "who": null,
    "why": null,
    "how": null,
    "where": null
  }
}
```

## Visit resolution order

Use this order for the pilot:

1. Find the highest-priority matching case visit rule.
2. Otherwise find a matching world visit rule.
3. Otherwise show a generic tag or type rule.
4. Otherwise show global fallback.

Rationale: if the player finds the ticket and returns to the railway office, the new expert response should appear instead of generic/repeat text.

## Counting rules

- Unvisited case lead: +1.
- First useful reactive POI response: +1.
- Repeat visit: +0.
- Generic fallback: +0.

## Critical test path

The following path should produce a solvable state:

```text
harcourt_laboratory
charing_cross_railway_office
dr_north_analytical_chemist
harcourt_home
mallory_lodgings
henley_pawnbroker
central_cab_registry
north_star_assurance
port_authority_london_docks
caledonia_warehouse_limehouse
```

At the end of this path the player should have enough evidence/facts to answer all theory fields.

## Theory comparison v0

Use exact ID matching:

```json
{
  "who": "silas_mallory",
  "why": "formula_theft_to_pay_debts",
  "how": "drugged_with_chloral_and_staged_flight",
  "where": "caledonia_warehouse_limehouse",
  "when": "1894-05-15T20:40/21:20"
}
```

Later versions can support aliases and partial credit.

## Validation requirements

Fail if:

- Any lead location is missing.
- Any visit rule location is missing.
- Any visit rule condition references missing rules or locations.
- Any `revealLocationIds` target is missing.
- Any solution slot references an option that is not in `theoryOptions`.

Warn if:

- A location has no coordinates.
- A hidden location has no reveal path.
- A case rule points at no useful tag or location type.
- A critical evidence object is not discoverable on the critical path.
