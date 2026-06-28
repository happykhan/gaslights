# Gaslights data model

Gaslights now uses a visit-driven model. The runtime does not track evidence or interpreted facts as first-class objects. Authors write world and case visit rules; players choose places, read text, make notes through rule effects, and submit a theory.

## Entities

```text
Location
Person
WorldVisitRule
Case
CaseVisitRule
NewspaperIssue
NewspaperItem
InvestigationState
Theory
SolutionQuestion
Solution
```

## Location

A location is a persistent place in Victorian London.

```json
{
  "id": "harcourt_laboratory",
  "name": "Harcourt's Laboratory",
  "aliases": ["17 Craven Street"],
  "type": "laboratory",
  "visibility": "public",
  "address": "17 Craven Street",
  "searchPreviewText": "An analytical chemist's rooms near Charing Cross.",
  "defaultVisitText": "A private laboratory used by Dr Edwin Harcourt.",
  "coordinates": { "lat": 51.5079, "lng": -0.1246 },
  "tags": ["science", "chemist"],
  "worldVisitRules": []
}
```

Private residences should usually be address-forward in the player UI. The household identity can live in the name, aliases, or author notes, but the game should not leak unrelated case information from another case.

Use `type` for the structural noun and `tags` for small search/map facets. Tags should stay boring: `railway`, `chemist`, `insurance`, `shipping`, `cab`, `pawn`, `medical`, `law`, `police`, `press`, `finance`, `commerce`, `residence`. Do not tag plot state such as specialist, clue, important, solved, or red herring on the world location.

`searchPreviewText` is short map/search copy shown before the player visits. `defaultVisitText` is the fallback text shown on a visit when no case rule, world rule, or generic tag/type rule matches. `worldVisitRules` are reusable global visit texts for a place; case-specific clues belong in case `visitRules`.

## Person

People are global world entities. Cases choose a subset through `casePeopleIds`.

```json
{
  "id": "silas_mallory",
  "name": "Silas Mallory",
  "aliases": [],
  "kind": "suspect",
  "residenceLocationId": "mallory_lodgings",
  "workLocationIds": ["harcourt_laboratory"],
  "notes": "Assistant to Harcourt.",
  "tags": ["assistant"]
}
```

## Visit rules

Visit rules are the core content primitive. Case visit rules sit on top of world visit rules and take precedence. Runtime visit resolution checks case `visitRules`, then location `worldVisitRules`, then generic tag/type fallbacks, then `defaultVisitText`, then `searchPreviewText`, then the hardcoded final fallback.

```json
{
  "id": "hub_railway_ticket_response",
  "locationId": "charing_cross_railway_office",
  "title": "Railway Clerk",
  "kind": "lead",
  "priority": 200,
  "countsAsLead": true,
  "repeatable": false,
  "validFrom": "1894-01-01",
  "validTo": "1894-12-31",
  "text": "The clerk checks Tuesday's ledger...",
  "conditions": {
    "all": [{ "type": "resolvedRuleIds", "values": ["lead_harcourt_laboratory"] }],
    "any": [],
    "none": []
  },
  "effects": {
    "revealLocationIds": ["mallory_lodgings"],
    "addNotebook": "Railway clerk: the Brighton ticket was likely planted."
  }
}
```

Supported condition types:

- `resolvedRuleIds`
- `visitedLocationIds`
- `visitCountAtLocation`
- `globalVisitCount`

Supported effects:

- `revealLocationIds`
- `addNotebook`

## Case

A case layers a mystery over the global world.

```json
{
  "id": "missing_chemist",
  "title": "The Missing Chemist",
  "date": "1894-05-17",
  "status": "playable_draft",
  "summary": "A chemist vanishes after a lecture.",
  "intro": "Mrs Harcourt asks for help...",
  "theorySlots": ["who", "why", "how", "where"],
  "casePeopleIds": ["silas_mallory", "nathaniel_rudd"],
  "caseLocationIds": ["harcourt_laboratory", "charing_cross_railway_office"],
  "caseLocationRoles": {
    "harcourt_laboratory": ["lead"],
    "charing_cross_railway_office": ["lead"]
  },
  "startingLocationIds": ["harcourt_laboratory"],
  "hiddenLocationIds": [],
  "newspaperIssueId": "chronicle_1894_05_17",
  "visitRules": [],
  "solutionQuestions": [],
  "solution": {
    "who": "silas_mallory",
    "why": "formula_theft_to_pay_debts",
    "how": "drugged_with_chloral_and_staged_flight",
    "where": "caledonia_warehouse_limehouse",
    "explanation": "Mallory staged a false departure..."
  },
  "theoryOptions": {
    "why": ["formula_theft_to_pay_debts"],
    "how": ["drugged_with_chloral_and_staged_flight"]
  }
}
```

## Solution questions

After locking who/why/how/where, the player answers case-specific free-text questions. These are self-assessed, not auto-graded.

```json
{
  "id": "brighton_ticket",
  "prompt": "Why was the Brighton ticket planted?",
  "modelAnswer": "It made Harcourt appear to have left London voluntarily."
}
```

## Investigation state

```json
{
  "caseId": "missing_chemist",
  "visitedLocationIds": [],
  "locationVisitCounts": {},
  "resolvedVisitRuleIds": [],
  "revealedLocationIds": ["harcourt_laboratory"],
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

## Validation

Validation should fail if:

- a case uses removed `evidence`, `facts`, or `hubResponses` fields
- a visit rule references a missing location or rule
- a visit rule uses removed evidence/fact conditions or effects
- a hidden location has no reveal path
- a theory solution value is outside the allowed people, locations, or option lists
- a solution question is missing an ID or prompt
