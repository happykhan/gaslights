# Gaslights data model

This document defines a first-pass JSON data model for Gaslights.

The initial goal is not perfect schema design. The goal is to make case content data-driven so the runtime and editor do not hardcode mysteries.

## 1. Entity overview

```text
Location
DirectoryEntry
NewspaperIssue
NewspaperItem
Case
Lead
Evidence
Fact
HubResponse
GenericLeadRule
InvestigationState
Theory
Solution
```

## 2. Location

A location is a persistent point of interest in Victorian London.

```json
{
  "id": "charing_cross_railway_office",
  "name": "Charing Cross Railway Office",
  "aliases": ["Charing Cross Station", "South Eastern Railway Office"],
  "type": "railway_office",
  "address": "Charing Cross, Strand",
  "district": "WC",
  "coordinates": {
    "lat": 51.5081,
    "lng": -0.1248
  },
  "tags": ["railway", "transport", "specialist_hub"],
  "hubDomains": ["railway_ticket", "timetable", "luggage"],
  "globalDescription": "A busy railway office where clerks can answer precise questions about tickets, departures, and luggage records.",
  "sourceRefs": [
    {
      "label": "manual sample data",
      "url": null,
      "license": "placeholder"
    }
  ],
  "status": "promoted"
}
```

### Required fields for v0

- `id`
- `name`
- `type`
- `coordinates`

### Useful optional fields

- `aliases`
- `address`
- `district`
- `tags`
- `hubDomains`
- `sourceRefs`
- `status`

## 3. DirectoryEntry

A directory entry links a person, business, institution, or profession to a location.

```json
{
  "id": "dir_harcourt_edwin",
  "caseIds": ["missing_chemist"],
  "displayName": "Harcourt, Edwin",
  "sortName": "Harcourt, Edwin",
  "category": "chemist",
  "occupation": "Analytical chemist",
  "locationId": "harcourt_laboratory",
  "addressText": "17 Craven Street",
  "notes": "Case-specific fictional entry for pilot.",
  "sourceRefs": []
}
```

Directory entries may be global or case-specific.

## 4. NewspaperIssue and NewspaperItem

```json
{
  "id": "times_1894_05_14",
  "title": "The London Evening Chronicle",
  "date": "1894-05-14",
  "items": ["article_missing_chemist", "advert_steamship"]
}
```

```json
{
  "id": "advert_steamship",
  "issueId": "times_1894_05_14",
  "type": "advert",
  "headline": "Passage to New York",
  "body": "Cabins available on the SS Mercia, sailing Thursday from the London Docks.",
  "tags": ["shipping", "possible_escape"],
  "linkedLocationIds": ["london_docks_shipping_office"],
  "linkedPersonIds": [],
  "caseIds": ["missing_chemist"],
  "isDirectClue": false
}
```

The newspaper should contain both clue material and noise.

## 5. Case

```json
{
  "id": "missing_chemist",
  "title": "The Missing Chemist",
  "date": "1894-05-14",
  "status": "draft",
  "summary": "A chemist disappears after a lecture, leaving behind a broken laboratory, a train ticket, and a changed insurance policy.",
  "intro": "You are asked to investigate the disappearance of Edwin Harcourt, an analytical chemist last seen near Charing Cross.",
  "startingLocationIds": ["harcourt_laboratory"],
  "activeLocationIds": [
    "harcourt_laboratory",
    "charing_cross_railway_office",
    "insurance_office",
    "london_docks_shipping_office"
  ],
  "newspaperIssueIds": ["times_1894_05_14"],
  "directoryEntryIds": ["dir_harcourt_edwin"],
  "solution": {
    "who": "assistant_mallory",
    "why": "formula_theft_and_debt",
    "how": "staged_disappearance",
    "where": "limehouse_warehouse",
    "when": "1894-05-12T21:00",
    "explanation": "The assistant staged Harcourt's disappearance after stealing the formula and arranging passage out of London."
  },
  "scoring": {
    "holmesLeadCount": 7,
    "criticalEvidenceIds": ["train_ticket", "changed_policy", "shipping_manifest"]
  }
}
```

## 6. Lead

A lead is case-specific text for visiting a location.

```json
{
  "id": "lead_harcourt_laboratory",
  "caseId": "missing_chemist",
  "locationId": "harcourt_laboratory",
  "title": "Harcourt's Laboratory",
  "kind": "case_lead",
  "countsAsLead": true,
  "text": "The laboratory is in disorder. A drawer has been forced, but the instruments are untouched. Beneath the desk you find a railway ticket half-hidden under a blotter.",
  "onVisit": {
    "discoverEvidenceIds": ["train_ticket"],
    "discoverFactIds": ["laboratory_drawer_forced"],
    "revealLocationIds": ["charing_cross_railway_office"],
    "addNotebook": "Found a railway ticket at Harcourt's laboratory."
  },
  "repeatText": "You have already searched the laboratory. The forced drawer and the railway ticket remain the most suggestive details.",
  "solutionTags": ["where", "how"]
}
```

## 7. Evidence

Evidence is first-class.

```json
{
  "id": "train_ticket",
  "caseId": "missing_chemist",
  "name": "Half-hidden railway ticket",
  "type": "document",
  "summary": "A railway ticket found under the laboratory blotter.",
  "description": "The ticket is creased and smudged, but the destination and date can still be made out.",
  "discoveredAtLeadId": "lead_harcourt_laboratory",
  "domains": ["railway_ticket", "timetable"],
  "tags": ["travel", "timeline"],
  "relatedLocationIds": ["charing_cross_railway_office"],
  "supportsSolutionSlots": ["who", "when"],
  "display": {
    "showInEvidenceList": true,
    "imageUrl": null
  }
}
```

Evidence does not need to be manually “used” by the player in v0. If the player visits a relevant hub, the engine can apply it automatically.

## 8. Fact

Facts are interpreted knowledge. They may be discovered directly at leads or produced by hub responses.

```json
{
  "id": "ticket_bought_by_assistant",
  "caseId": "missing_chemist",
  "summary": "The ticket was bought by a man matching the assistant's description.",
  "source": {
    "type": "hub_response",
    "id": "hub_railway_ticket_response"
  },
  "supportsSolutionSlots": ["who", "when"],
  "tags": ["timeline", "identity"]
}
```

## 9. HubResponse

A hub response defines what happens when the player visits the right specialist location after finding evidence.

```json
{
  "id": "hub_railway_ticket_response",
  "caseId": "missing_chemist",
  "hubLocationId": "charing_cross_railway_office",
  "priority": 100,
  "trigger": {
    "evidenceAny": ["train_ticket"],
    "factsAll": []
  },
  "countsAsLead": true,
  "text": "The clerk turns the ticket over and consults a ledger. It was sold at Charing Cross shortly after seven on Tuesday evening to a young man travelling under the name Mallory.",
  "onResolve": {
    "discoverFactIds": ["ticket_bought_by_assistant"],
    "revealLocationIds": ["brighton_hotel_office"]
  },
  "repeatText": "The railway clerk has already identified the ticket as one bought at Charing Cross under the name Mallory."
}
```

## 10. GenericLeadRule

Generic rules prevent the wide city from feeling empty.

```json
{
  "id": "generic_pub_no_case_info",
  "locationTypes": ["pub"],
  "priority": 10,
  "countsAsLead": false,
  "text": "The publican has heard plenty of ordinary gossip, but nothing that appears to touch the present matter."
}
```

Expert hub without relevant evidence:

```json
{
  "id": "generic_railway_needs_specifics",
  "hubDomainsAny": ["railway_ticket", "timetable", "luggage"],
  "priority": 50,
  "countsAsLead": false,
  "text": "The clerk explains that railway records are exacting, but he needs a ticket, date, destination, or named passenger before he can help."
}
```

## 11. InvestigationState

Stored in localStorage for v0.

```json
{
  "caseId": "missing_chemist",
  "startedAt": "2026-06-24T12:00:00Z",
  "visitedLeadIds": ["lead_harcourt_laboratory"],
  "visitedLocationIds": ["harcourt_laboratory"],
  "discoveredEvidenceIds": ["train_ticket"],
  "discoveredFactIds": ["laboratory_drawer_forced"],
  "resolvedHubResponseIds": [],
  "revealedLocationIds": ["charing_cross_railway_office"],
  "notebookEntries": [
    {
      "id": "note_001",
      "createdAt": "2026-06-24T12:05:00Z",
      "text": "Found a railway ticket at Harcourt's laboratory."
    }
  ],
  "leadCount": 1,
  "genericVisitCount": 0,
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

## 12. Theory

```json
{
  "who": "assistant_mallory",
  "why": "formula_theft_and_debt",
  "how": "staged_disappearance",
  "where": "limehouse_warehouse",
  "when": "1894-05-12T21:00",
  "supportingEvidenceIds": ["train_ticket", "changed_policy", "shipping_manifest"]
}
```

The UI should allow the player to fill the theory gradually.

## 13. Solution comparison

The solution comparison should show slot-by-slot results:

```json
{
  "caseId": "missing_chemist",
  "result": {
    "who": "correct",
    "why": "correct",
    "how": "partial",
    "where": "incorrect",
    "when": "correct"
  },
  "missedCriticalEvidenceIds": ["shipping_manifest"],
  "leadCount": 12,
  "holmesLeadCount": 7
}
```

The first implementation can use exact ID matching. Later versions can support aliases, partial credit, and richer evidence reasoning.

## 14. ID conventions

Use stable, lowercase, snake_case IDs:

```text
missing_chemist
lead_harcourt_laboratory
train_ticket
ticket_bought_by_assistant
charing_cross_railway_office
```

Do not use display names as IDs.

## 15. Validation rules for v0

Validation should fail if:

- Duplicate IDs exist.
- A lead references a missing location.
- Evidence references a missing lead.
- Hub response references missing evidence or location.
- Case solution references IDs that do not exist.
- A hidden location has no reveal path.
- A required field is missing.

Validation should warn if:

- A location has no source reference.
- A case has no newspaper.
- A solution slot has no supporting evidence.
- A specialist hub domain has no generic fallback.
