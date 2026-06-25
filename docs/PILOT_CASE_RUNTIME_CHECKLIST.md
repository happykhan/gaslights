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
  "visitedLeadIds": [],
  "visitedLocationIds": [],
  "discoveredEvidenceIds": [],
  "discoveredFactIds": [],
  "resolvedHubResponseIds": [],
  "revealedLocationIds": ["harcourt_laboratory", "harcourt_home", "royal_institution"],
  "leadCount": 0,
  "theory": {
    "who": null,
    "why": null,
    "how": null,
    "where": null,
    "when": null,
    "supportingEvidenceIds": []
  }
}
```

## Visit resolution order

Use this order for the pilot:

1. Find triggered hub responses at the visited location.
2. If any triggered unresolved hub response exists, show it and resolve it.
3. Otherwise, if an unvisited case lead exists, show it.
4. Otherwise, if a visited case lead exists, show repeat text.
5. Otherwise, show a generic hub rule.
6. Otherwise, show a generic type rule.
7. Otherwise, show global fallback.

Rationale: if the player finds the ticket and returns to the railway office, the new expert response should appear instead of generic/repeat text.

## Counting rules

- Unvisited case lead: +1.
- First useful specialist hub response: +1.
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
- Any evidence `discoveredAtLeadId` is missing.
- Any hub response location is missing.
- Any hub response trigger references missing evidence/facts.
- Any `revealLocationIds` target is missing.
- Any solution slot references an option that is not in `theoryOptions`.

Warn if:

- A location has no coordinates.
- A hidden location has no reveal path.
- An evidence object has no specialist domain.
- A critical evidence object is not discoverable on the critical path.
