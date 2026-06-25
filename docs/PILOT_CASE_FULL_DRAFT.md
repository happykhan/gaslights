# Pilot case full draft — The Missing Chemist

This is a complete, playable draft for the first Gaslights pilot case. It is intentionally small and slightly rough: the purpose is to give an implementation agent real data for the engine, editor, and runtime.

The matching machine-readable file is [`../data/cases/missing-chemist.case.json`](../data/cases/missing-chemist.case.json).

## Case metadata

| Field | Value |
| --- | --- |
| ID | `missing_chemist` |
| Title | The Missing Chemist |
| Date | 17 May 1894 |
| Target playtime | 60–120 minutes |
| Status | playable draft |
| Benchmark lead count | 9 |

## Briefing

Thursday, 17 May 1894. Mrs Agnes Harcourt asks for help in finding her husband, Dr Edwin Harcourt, an analytical chemist of Craven Street. Harcourt was last seen on Tuesday night after a lecture at the Royal Institution. By Wednesday morning his laboratory had been found in disorder. His assistant, Silas Mallory, has not returned to his lodgings.

The police have no body, no ransom note, and no clear crime. Mrs Harcourt insists that her husband would never abandon his work voluntarily: he was preparing to secure a patent for a cheap hospital disinfectant, and several commercial men had shown interest in it.

Your task is to determine who caused Harcourt's disappearance, why, how it was done, where he was taken, and when the decisive event occurred.


## The true solution

### Who?

Silas Mallory, Harcourt's assistant. Nathaniel Rudd is an accessory who intended to profit from the stolen formula.

### Why?

Mallory owed money and knew Harcourt was about to file the patent under Harcourt's sole name. Rudd & Vale were willing to pay for the formula before legal ownership was settled.

### How?

Mallory drugged Harcourt's tea with chloral hydrate, broke the drawer to imitate burglary, planted a Brighton ticket as a false trail, and moved Harcourt by cab while he appeared drunk or ill.

### Where?

Harcourt was taken to Caledonia Warehouse, Limehouse, where Rudd & Vale cargo was being prepared for the S.S. Mercia.

### When?

The decisive movement happened on Tuesday 15 May between roughly 8:40 p.m. and 9:20 p.m.; the watch was pawned at 10:20 p.m. after the transfer.

### Full explanation

Mallory created a false flight to Brighton while actually moving Harcourt east to Limehouse. The chloral cup proves incapacitation. The railway ticket proves the false trail. The cab record proves the route. The cargo policy and port manifest prove the warehouse and planned escape. The pawn receipt and debts prove Mallory's pressure and opportunity. Harcourt is recovered alive at Caledonia Warehouse before Mallory and Rudd can finish copying the formula and ship the evidence to New York.

## Intended critical route

This is not the only valid route, but it is the benchmark route used for playtesting:

```text
Harcourt's Laboratory
  → Charing Cross Railway Office
  → Dr North, Analytical Chemist
  → Mrs Harcourt
  → Mallory's Lodgings
  → Henley Pawn & Pledge
  → Central Cab Registry
  → North Star Assurance
  → Port Records Office
  → Caledonia Warehouse
```

## Alternative route

```text
Royal Institution
  → Rudd & Vale
  → Mallory's Lodgings
  → North Star Assurance
  → Port Records Office
  → Caledonia Warehouse
```

## Starting locations

- `harcourt_laboratory`
- `harcourt_home`
- `royal_institution`

## Hidden location

- `caledonia_warehouse_limehouse` should preferably be hidden until revealed by the cab registry, insurance office, port office, or Blue Anchor rumour.

## Evidence objects

| ID | Name | Domains | Supports | Found at |
| --- | --- | --- | --- | --- |
| `train_ticket_brighton` | Brighton railway ticket | `railway_ticket, timetable` | `who, how, when` | `lead_harcourt_laboratory` |
| `porcelain_cup_residue` | Porcelain cup with bitter residue | `chemical, poison, residue` | `how` | `lead_harcourt_laboratory` |
| `torn_blue_label` | Torn blue shipping label | `shipping, warehouse` | `where` | `lead_harcourt_laboratory` |
| `cab_number_317` | Cab number 317 | `cab_number, cab_journey` | `where, when, how` | `lead_harcourt_laboratory` |
| `pawn_receipt_harcourt_watch` | Pawn receipt for E.H. silver watch | `pawn_receipt, watch` | `who, when, why` | `lead_mallory_lodgings` |
| `gambling_iou` | Gambling IOU to Ezra Pike | `financial, gambling` | `why` | `lead_mallory_lodgings` |
| `steamship_advert_clipping` | S.S. Mercia advert clipping | `shipping, manifest` | `where, when` | `lead_mallory_lodgings` |
| `cargo_insurance_slip` | North Star cargo insurance slip | `insurance, cargo_policy, shipping` | `who, where, why` | `lead_mallory_lodgings` |
| `formula_priority_letter` | Patent priority letter | `legal, patent` | `why` | `lead_chancery_patent_solicitors` |
| `shipping_manifest_entry` | S.S. Mercia manifest entry | `shipping, manifest, warehouse` | `who, where, when` | `hub_port_manifest_response` |

## Facts / interpreted knowledge

| ID | Summary | Supports |
| --- | --- | --- |
| `laboratory_drawer_forced_after_search` | The laboratory drawer appears forced, but the instruments and ordinary valuables were left behind. | `how` |
| `mallory_missing_from_work` | Silas Mallory has not returned to work or to his lodgings since Tuesday night. | `who` |
| `rudd_offered_to_buy_formula` | Nathaniel Rudd had tried to buy Harcourt's disinfectant formula and was rebuffed. | `why` |
| `ticket_bought_by_mallory_not_used` | The Brighton ticket was bought by a man matching Mallory and was probably never used by Harcourt. | `who, how, when` |
| `chloral_in_cup` | The cup contains traces consistent with chloral hydrate, enough to stupefy a man but not necessarily kill him. | `how` |
| `mallory_in_debt` | Mallory owed money to Ezra Pike and needed cash by Thursday. | `why` |
| `mallory_pawned_harcourt_watch` | Mallory pawned Harcourt's watch late on Tuesday night, after the disappearance. | `who, when` |
| `cab_317_to_caledonia` | Cab 317 carried a young man and a stupefied older gentleman from Craven Street to Caledonia Wharf on Tuesday night. | `how, where, when` |
| `cargo_policy_alias_merritt` | The cargo policy names S. Merritt, an alias connected to Mallory, and Rudd & Vale chemical cargo. | `who, where, why` |
| `manifest_places_cargo_at_caledonia` | The port manifest places the insured cargo at Caledonia Warehouse before transfer to the S.S. Mercia. | `where, when` |
| `patent_excludes_mallory` | The patent draft names Harcourt alone, giving Mallory a motive to steal or sell before filing. | `why` |
| `harcourt_found_alive` | Harcourt is alive at Caledonia Warehouse, weak from confinement and drugging. | `how, where` |

## Location leads

### Harcourt's Laboratory — `harcourt_laboratory`

**Role:** who, how, where, when  
**Counts as lead:** `true`  
**Location type:** `laboratory`  

The laboratory is disorderly, though not in the manner of an ordinary burglary. A drawer has been forced, but the balances, lenses, and small silver instruments remain untouched. Under the blotter you find a second-class ticket to Brighton dated Tuesday. On the bench sits a porcelain tea cup with a bitter smell clinging to it. A torn blue cargo label has caught beneath an overturned stool: only the fragments 'RUD...' and 'CAL...' can be read. The porter recalls a cab outside after half-past eight; he is fairly sure the painted number was 317.

**On visit**

```json
{
  "discoverEvidenceIds": [
    "train_ticket_brighton",
    "porcelain_cup_residue",
    "torn_blue_label",
    "cab_number_317"
  ],
  "discoverFactIds": [
    "laboratory_drawer_forced_after_search"
  ],
  "revealLocationIds": [
    "charing_cross_railway_office",
    "dr_north_analytical_chemist",
    "central_cab_registry",
    "rudd_vale_office"
  ],
  "addNotebook": "At Harcourt's laboratory: Brighton ticket, bitter cup, torn blue label, cab number 317, staged-looking disorder."
}
```

**Repeat text:** The same details stand out: the too-neat forced drawer, the Brighton ticket, the cup residue, the torn blue label, and cab number 317.

### Mrs Harcourt — `harcourt_home`

**Role:** who, why  
**Counts as lead:** `true`  
**Location type:** `private_residence`  

Mrs Harcourt is certain her husband would not flee. He had been preparing a patent filing and had spoken of a cheap disinfectant that might make hospital wards safer. She gives you the name of his assistant, Silas Mallory, of Greek Street. Mallory had been useful but nervous of late. She also recalls the name Rudd & Vale: Harcourt had refused their offer to buy the formula outright.

**On visit**

```json
{
  "discoverFactIds": [
    "mallory_missing_from_work"
  ],
  "revealLocationIds": [
    "mallory_lodgings",
    "chancery_patent_solicitors",
    "rudd_vale_office"
  ],
  "addNotebook": "Mrs Harcourt names Silas Mallory and says Rudd & Vale wanted the formula."
}
```

**Repeat text:** Mrs Harcourt can add little beyond her certainty that Edwin would not abandon his work voluntarily.

### The Royal Institution — `royal_institution`

**Role:** why, who  
**Counts as lead:** `true`  
**Location type:** `scientific_institution`  

The lecture attendant remembers Harcourt leaving in good spirits. Mallory waited for him in the hall, pale and sharp-tempered. A commercial gentleman, Nathaniel Rudd, had pressed Harcourt after the lecture and was rebuffed: 'I shall not sell what I have not yet secured,' Harcourt said. Mallory heard every word.

**On visit**

```json
{
  "discoverFactIds": [
    "rudd_offered_to_buy_formula"
  ],
  "revealLocationIds": [
    "rudd_vale_office",
    "mallory_lodgings",
    "lady_ashcombe_house"
  ],
  "addNotebook": "At the Royal Institution: Rudd wanted the formula; Harcourt refused; Mallory heard the exchange."
}
```

**Repeat text:** The attendant repeats that Rudd pressed Harcourt and that Mallory was listening.

### Mallory's Lodgings — `mallory_lodgings`

**Role:** who, why, where  
**Counts as lead:** `true`  
**Location type:** `lodging_house`  

Mallory's room is stripped of clothing but not of haste. Behind a loose grate you find an IOU to Ezra Pike for £83, a pawn receipt for a silver watch initialled E.H., a clipped S.S. Mercia advertisement, and a North Star Assurance slip naming 'S. Merritt' alongside Rudd & Vale chemical cargo. The landlady says Mallory left before dawn with a carpet-bag and no forwarding address.

**On visit**

```json
{
  "discoverEvidenceIds": [
    "pawn_receipt_harcourt_watch",
    "gambling_iou",
    "steamship_advert_clipping",
    "cargo_insurance_slip"
  ],
  "discoverFactIds": [
    "mallory_in_debt"
  ],
  "revealLocationIds": [
    "henley_pawnbroker",
    "ezra_pike_bookmaker",
    "north_star_assurance",
    "port_authority_london_docks"
  ],
  "addNotebook": "Mallory's lodgings: IOU, pawn receipt for E.H. watch, S.S. Mercia clipping, North Star cargo slip under S. Merritt."
}
```

**Repeat text:** Mallory's room remains the strongest link between the debt, the watch, the ship, and Rudd & Vale.

### Rudd & Vale — `rudd_vale_office`

**Role:** why, where  
**Counts as lead:** `true`  
**Location type:** `commercial_office`  

Nathaniel Rudd receives you with commercial politeness and denies any special dealing with Harcourt. He admits attending the lecture, but says scientists often mistake curiosity for an offer. His office smells strongly of packing straw and carbolic spirit. A clerk entering with a blue crate label withdraws when he sees you; the colour matches the fragment from Harcourt's laboratory.

**On visit**

```json
{
  "revealLocationIds": [
    "port_authority_london_docks"
  ],
  "addNotebook": "Rudd denies special dealings, but his office uses blue crate labels like the torn fragment."
}
```

**Repeat text:** Rudd remains smooth and unhelpful. The blue labels are still the only crack in his denial.

### Peabody & Finch — `chancery_patent_solicitors`

**Role:** why  
**Counts as lead:** `true`  
**Location type:** `solicitor`  

Mr Finch confirms that Harcourt intended to file a provisional specification by Friday. The papers name Harcourt alone as inventor. Mallory had delivered laboratory notes once or twice, but had no claim in the draft. If the formula were sold before filing, priority might become difficult to untangle.

**On visit**

```json
{
  "discoverEvidenceIds": [
    "formula_priority_letter"
  ],
  "discoverFactIds": [
    "patent_excludes_mallory"
  ],
  "addNotebook": "Patent solicitors: Harcourt alone would own the formula; Mallory had no claim."
}
```

**Repeat text:** The solicitor's papers confirm the motive: the formula was valuable, imminent, and not Mallory's.

### Bow Street Police Station — `bow_street_police_station`

**Role:** how  
**Counts as lead:** `true`  
**Location type:** `police_station`  

The inspector is willing to say only that no body has been found and no ransom note received. He considers flight, kidnapping, and misadventure all possible. He warns that a commercial dispute is not proof of a crime, but writes down Mallory's name when you mention the assistant's disappearance.

**On visit**

```json
{
  "addNotebook": "Police have no body or ransom note. Mallory's absence matters, but they need proof."
}
```

**Repeat text:** The inspector still wants evidence, not theories.

### The Blue Anchor — `blue_anchor_wapping`

**Role:** where  
**Counts as lead:** `true`  
**Location type:** `pub`  

The Blue Anchor offers three rumours, all contradictory. One sailor swears a chemist ran willingly to sea; another says Rudd & Vale are moving ordinary disinfectant; a third insists every missing Londoner turns up in America. The only useful point is that Rudd & Vale's night carts have lately been seen near Limehouse rather than Wapping proper.

**On visit**

```json
{
  "revealLocationIds": [
    "caledonia_warehouse_limehouse"
  ],
  "addNotebook": "Blue Anchor gossip is unreliable, but Rudd & Vale carts have been seen nearer Limehouse."
}
```

**Repeat text:** The pub has more confidence than evidence. Its Limehouse rumour may be worth remembering.

### The Evening Chronicle Office — `london_evening_chronicle_office`

**Role:** where, when  
**Counts as lead:** `true`  
**Location type:** `newspaper_office`  

The clerk at the Chronicle confirms that Mallory bought several copies of today's paper before noon and asked whether shipping advertisements were kept in the front office. He left no name, but the description matches him. The office has nothing beyond the printed issue, which remains the proper source for adverts and notices.

**On visit**

```json
{
  "addNotebook": "Mallory was interested in today's shipping advertisements."
}
```

**Repeat text:** The Chronicle adds no secret article. The printed paper is the useful source.

### St Bartholomew's Hospital — `st_bartholomews_hospital`

**Role:** why  
**Counts as lead:** `true`  
**Location type:** `hospital`  

A physician remembers Harcourt's disinfectant demonstration with enthusiasm. The hospital hoped to test it, but had not purchased or financed it. This weakens the idea that a hospital dispute caused the disappearance, though it confirms the formula had real commercial value.

**On visit**

```json
{
  "addNotebook": "Hospital interest confirms the formula's value, but provides no culprit."
}
```

**Repeat text:** The hospital remains an interested observer, not a likely conspirator.

### Lady Ashcombe — `lady_ashcombe_house`

**Role:** why  
**Counts as lead:** `true`  
**Location type:** `private_residence`  

Lady Ashcombe is flattered to be consulted and eager to suggest scandal. She disliked Rudd and found Mallory common, but admits she knows nothing solid. Her only useful recollection is that Harcourt was cheerful after the lecture and spoke of filing his patent 'before another rogue gets wind of it.'

**On visit**

```json
{
  "addNotebook": "Lady Ashcombe confirms Harcourt intended to file his patent soon and did not seem ready to flee."
}
```

**Repeat text:** Lady Ashcombe's gossip grows more colourful but no more reliable.

### Ezra Pike — `ezra_pike_bookmaker`

**Role:** why, where  
**Counts as lead:** `true`  
**Location type:** `bookmaker`  

Pike denies threatening anyone, then admits Mallory owed him £83 and had promised repayment before Friday. He says Mallory spoke of 'a passage out' and 'a gentleman who would pay well for a secret.' Pike did not know the gentleman's name and does not care to know it.

**On visit**

```json
{
  "discoverFactIds": [
    "mallory_in_debt"
  ],
  "addNotebook": "Ezra Pike confirms Mallory's debt and mentions a passage out and a buyer for a secret."
}
```

**Repeat text:** Pike repeats that Mallory needed money by Friday and spoke of leaving.

### Caledonia Warehouse — `caledonia_warehouse_limehouse`

**Role:** who, why, how, where, when  
**Counts as lead:** `true`  
**Location type:** `warehouse`  

Caledonia Warehouse is quiet except for a night watchman who is too frightened to delay you. In an upper storeroom, behind crates marked as laboratory glass, you find Edwin Harcourt alive but weak. His notebook is on the table, half-copied. Mallory's carpet-bag lies beside a trunk labelled S. Merritt. Rudd's blue labels are stacked by the door. Harcourt says he remembers tea in the laboratory, then waking here while Mallory demanded the final cipher for the formula.

**On visit**

```json
{
  "discoverFactIds": [
    "harcourt_found_alive"
  ],
  "revealLocationIds": [],
  "addNotebook": "At Caledonia Warehouse: Harcourt alive; Mallory's alias/trunk; Rudd labels; formula theft confirmed."
}
```

**Repeat text:** The warehouse has yielded the truth: Harcourt was drugged, carried here, and held until the formula could be copied and shipped.


## Specialist hub responses

These are the evidence-interpretation moments. They are the new mechanic, but they should remain a minority of visits.

### hub_railway_ticket_response — Charing Cross Railway Office

**Trigger**

```json
{
  "evidenceAny": [
    "train_ticket_brighton"
  ],
  "factsAll": []
}
```

**Response**

The clerk turns the Brighton ticket over and consults Tuesday's unusually careful ledger. It was sold at 7:15 p.m. to a young man with a narrow face and ink-stained cuffs, not to a gentleman of Harcourt's age. The barrier record shows no matching ticket taken from Harcourt. 'Bought to be found, perhaps,' the clerk says.

**On resolve**

```json
{
  "discoverFactIds": [
    "ticket_bought_by_mallory_not_used"
  ],
  "revealLocationIds": [
    "mallory_lodgings"
  ],
  "addNotebook": "Railway clerk: Brighton ticket was likely a planted false trail bought by someone matching Mallory."
}
```

### hub_chemist_cup_response — Dr Livia North, Analytical Chemist

**Trigger**

```json
{
  "evidenceAny": [
    "porcelain_cup_residue"
  ],
  "factsAll": []
}
```

**Response**

Dr North performs two quick tests and frowns. The residue is consistent with chloral hydrate. The amount would stupefy a man and leave him docile for transport, though it need not kill him. She asks whether the missing man drank tea shortly before vanishing.

**On resolve**

```json
{
  "discoverFactIds": [
    "chloral_in_cup"
  ],
  "addNotebook": "Dr North: cup contained chloral hydrate; Harcourt was probably drugged, not killed on the spot."
}
```

### hub_pawnbroker_receipt_response — Henley Pawn & Pledge

**Trigger**

```json
{
  "evidenceAny": [
    "pawn_receipt_harcourt_watch"
  ],
  "factsAll": []
}
```

**Response**

Henley identifies the receipt at once. The watch was pledged at 10:20 on Tuesday by Silas Mallory, whom he knows by sight. The watch bore the initials E.H. Mallory's hands shook so badly that Henley assumed drink or fear.

**On resolve**

```json
{
  "discoverFactIds": [
    "mallory_pawned_harcourt_watch"
  ],
  "addNotebook": "Henley: Mallory pawned Harcourt's watch at 10:20 p.m. Tuesday."
}
```

### hub_cab_registry_response — Central Cab Registry

**Trigger**

```json
{
  "evidenceAny": [
    "cab_number_317"
  ],
  "factsAll": []
}
```

**Response**

Cab 317 belongs to Thomas Smee. The registry sends a boy to fetch him. Smee remembers the fare: a young man hired him near Craven Street at about twenty minutes to nine and helped a heavy, half-conscious gentleman into the cab, saying his uncle was overcome. They drove east to Caledonia Wharf, Limehouse.

**On resolve**

```json
{
  "discoverFactIds": [
    "cab_317_to_caledonia"
  ],
  "revealLocationIds": [
    "caledonia_warehouse_limehouse"
  ],
  "addNotebook": "Cab 317 carried a young man and stupefied older gentleman from Craven Street to Caledonia Wharf."
}
```

### hub_insurance_policy_response — North Star Assurance Office

**Trigger**

```json
{
  "evidenceAny": [
    "cargo_insurance_slip"
  ],
  "factsAll": []
}
```

**Response**

The assurance clerk copies the policy number and becomes suddenly careful. It covers one crate of laboratory glass and chemical samples, insured by Rudd & Vale for shipment to New York under the name S. Merritt. The crate is listed for temporary storage at Caledonia Warehouse before transfer to the S.S. Mercia.

**On resolve**

```json
{
  "discoverFactIds": [
    "cargo_policy_alias_merritt"
  ],
  "revealLocationIds": [
    "port_authority_london_docks",
    "caledonia_warehouse_limehouse"
  ],
  "addNotebook": "North Star: cargo policy links S. Merritt, Rudd & Vale, New York shipment, and Caledonia Warehouse."
}
```

### hub_port_manifest_response — Port Records Office, London Docks

**Trigger**

```json
{
  "evidenceAny": [
    "cargo_insurance_slip",
    "steamship_advert_clipping",
    "torn_blue_label"
  ],
  "factsAny": [
    "cargo_policy_alias_merritt"
  ]
}
```

**Response**

With either the policy number, the Mercia clipping, or the torn blue label, the dock clerk can search the manifest. He finds the entry: Rudd & Vale, one crate laboratory glass and samples, alias S. Merritt, Caledonia Warehouse, transfer to S.S. Mercia before nine tonight. A note in the margin says: 'Do not open. Private chemical samples.'

**On resolve**

```json
{
  "discoverEvidenceIds": [
    "shipping_manifest_entry"
  ],
  "discoverFactIds": [
    "manifest_places_cargo_at_caledonia"
  ],
  "revealLocationIds": [
    "caledonia_warehouse_limehouse"
  ],
  "addNotebook": "Port manifest: Rudd & Vale cargo under S. Merritt is at Caledonia Warehouse before sailing on the S.S. Mercia."
}
```


## Newspaper issue

**Issue:** The London Evening Chronicle, 1894-05-17

### Analytical Chemist Missing After Albemarle Street Lecture

**Type:** `news`  
**Tags:** `case, hints_start`  
**Direct clue:** `true`

Dr Edwin Harcourt of Craven Street has not been seen since Tuesday evening, after delivering a lecture on hospital disinfectants at the Royal Institution. His rooms were later found in disorder. Police state that no body has been discovered and that enquiries continue.

### Passage to New York — S.S. Mercia

**Type:** `advert`  
**Tags:** `shipping, possible_escape, indirect_clue`  
**Direct clue:** `false`

Berths and limited cargo space remain available on the S.S. Mercia, sailing Thursday evening from the London Docks. Apply to the dock agents before four o'clock.

### Night Porter Wanted

**Type:** `advert`  
**Tags:** `rudd_vale, warehouse, indirect_clue`  
**Direct clue:** `false`

Rudd & Vale require a sober man accustomed to chemical cargo, for night work at their eastern warehouse. References essential. Apply Fenchurch Street before noon.

### Turf Agent Fined

**Type:** `court_report`  
**Tags:** `gambling, debt, indirect_clue`  
**Direct clue:** `false`

Ezra Pike, a turf commission agent of Cranbourn Street, was fined for keeping disorderly books. Several young clerks and assistants were said to have lost heavily in recent weeks.

### Science and Society

**Type:** `society`  
**Tags:** `society, scientific_patron, rudd_vale_interest`  
**Direct clue:** `false`

Lady Ashcombe entertained a small party after Tuesday's lecture at the Royal Institution. Dr Harcourt's remarks on cheap antiseptic vapours were said to have excited commercial attention.

### Shipping Intelligence

**Type:** `shipping_notice`  
**Tags:** `shipping, cargo, indirect_clue`  
**Direct clue:** `false`

The S.S. Mercia takes manufactured goods, laboratory glass, and two crates of chemical samples for New York, weather permitting. Final manifests close this afternoon.

### Charing Cross Ticket Office Crowded

**Type:** `transport_notice`  
**Tags:** `railway, ledger, indirect_clue`  
**Direct clue:** `false`

A temporary alteration of counters at Charing Cross has obliged clerks to keep unusually exact ticket ledgers during the present week.

### Letter: The Smoke Evil

**Type:** `letter`  
**Tags:** `ambient, science, public_health`  
**Direct clue:** `false`

Sir,—London cannot hope to breathe cleanly while every factory chimney pours its filth above the poorer streets. If science can help, Parliament should not be slow to listen.

### At the Lyceum

**Type:** `entertainment`  
**Tags:** `ambient, theatre`  
**Direct clue:** `false`

The Lyceum announces a crowded house for Saturday. Gentlemen are requested not to obstruct the carriage entrance after the performance.

### Lost or Mislaid

**Type:** `notice`  
**Tags:** `watch, pawn, indirect_clue`  
**Direct clue:** `false`

A silver watch, plain case, initials E.H., is reported missing from rooms near the Strand. Pawnbrokers are requested to communicate with the owner.

### Lightermen's Dispute at Wapping

**Type:** `news`  
**Tags:** `ambient, dock, wapping`  
**Direct clue:** `false`

Minor delays affected several warehouses east of the Tower yesterday, though cargo for foreign steamers continues to be accepted under special arrangement.

### Births, Deaths, and Marriages

**Type:** `notices`  
**Tags:** `ambient`  
**Direct clue:** `false`

Ordinary notices of the day, including one long announcement from Kensington and three births in Clapham. None appears to concern the present matter.


## Directory entries

| ID | Display name | Category | Location | Address |
| --- | --- | --- | --- | --- |
| `dir_harcourt_edwin` | Harcourt, Edwin, D.Sc. | chemist | `harcourt_laboratory` | 17 Craven Street, Strand |
| `dir_harcourt_agnes` | Harcourt, Mrs Agnes | private_residence | `harcourt_home` | 23 Gower Street |
| `dir_mallory_silas` | Mallory, Silas | laboratory assistant | `mallory_lodgings` | 9 Greek Street, Soho |
| `dir_rudd_vale` | Rudd & Vale Chemical Importers | chemical importer | `rudd_vale_office` | Fenchurch Street |
| `dir_north_star` | North Star Assurance Office | insurance | `north_star_assurance` | Lombard Street |
| `dir_chx_railway` | Charing Cross Railway Office | railway | `charing_cross_railway_office` | Charing Cross Station, Strand |
| `dir_dr_north` | North, Dr Livia | chemist | `dr_north_analytical_chemist` | Great Russell Street |
| `dir_henley_pawn` | Henley Pawn & Pledge | pawnbroker | `henley_pawnbroker` | Little Newport Street |
| `dir_cab_registry` | Central Cab Registry | cab | `central_cab_registry` | Great Queen Street |
| `dir_port_records` | Port Records Office, London Docks | shipping | `port_authority_london_docks` | London Docks, Wapping |
| `dir_caledonia` | Caledonia Warehouse | warehouse | `caledonia_warehouse_limehouse` | Caledonia Wharf, Limehouse |
| `dir_peabody_finch` | Peabody & Finch | solicitor | `chancery_patent_solicitors` | Chancery Lane |
| `dir_bow_street` | Bow Street Police Station | police | `bow_street_police_station` | Bow Street |
| `dir_blue_anchor` | The Blue Anchor | pub | `blue_anchor_wapping` | Wapping High Street |
| `dir_chronicle` | London Evening Chronicle | newspaper | `london_evening_chronicle_office` | Fleet Street |
| `dir_st_barts` | St Bartholomew's Hospital | hospital | `st_bartholomews_hospital` | Smithfield |
| `dir_lady_ashcombe` | Ashcombe, Lady Eleanor | society | `lady_ashcombe_house` | Grosvenor Square |
| `dir_ezra_pike` | Pike, Ezra | bookmaker | `ezra_pike_bookmaker` | Cranbourn Street |
| `dir_royal_institution` | Royal Institution | scientific institution | `royal_institution` | Albemarle Street |
| `dir_post_office` | General Post Office Telegraph Counter | telegraph | `general_post_office_telegraph` | St Martin's-le-Grand |
| `dir_british_museum` | British Museum Reading Room | library | `british_museum_reading_room` | Great Russell Street |
| `dir_bank_england` | Bank of England | bank | `bank_of_england` | Threadneedle Street |
| `dir_somerset` | Somerset House Registry | registry | `somerset_house_registry` | Strand |

## Theory options for v0 UI

```json
{
  "who": [
    "silas_mallory",
    "nathaniel_rudd",
    "edwin_harcourt",
    "lady_ashcombe",
    "unknown"
  ],
  "why": [
    "formula_theft_to_pay_debts",
    "insurance_fraud",
    "romantic_revenge",
    "professional_jealousy",
    "voluntary_escape"
  ],
  "how": [
    "drugged_with_chloral_and_staged_flight",
    "murdered_in_laboratory",
    "voluntary_train_departure",
    "kidnapped_by_sailors",
    "unknown"
  ],
  "where": [
    "caledonia_warehouse_limehouse",
    "brighton",
    "rudd_vale_office",
    "royal_institution",
    "unknown"
  ],
  "when": [
    "1894-05-15T20:40/21:20",
    "1894-05-15T18:00",
    "1894-05-16T09:00",
    "unknown"
  ]
}
```

## Scoring / comparison

```json
{
  "benchmarkLeadCount": 9,
  "criticalEvidenceIds": [
    "train_ticket_brighton",
    "porcelain_cup_residue",
    "cab_number_317",
    "pawn_receipt_harcourt_watch",
    "cargo_insurance_slip",
    "shipping_manifest_entry"
  ],
  "criticalLocationIds": [
    "harcourt_laboratory",
    "charing_cross_railway_office",
    "dr_north_analytical_chemist",
    "mallory_lodgings",
    "henley_pawnbroker",
    "central_cab_registry",
    "north_star_assurance",
    "port_authority_london_docks",
    "caledonia_warehouse_limehouse"
  ],
  "slotPoints": {
    "who": 20,
    "why": 20,
    "how": 20,
    "where": 20,
    "when": 20
  }
}
```

## Notes for implementation agents

- This case should be loadable without a backend.
- Exact-match theory checking is acceptable for v0.
- Generic visits should not count as leads.
- First useful specialist hub responses should count as leads.
- Repeat visits should not count.
- Do not expose an inventory menu for the hub responses. The player’s decision to visit the expert location is the interaction.
- This is draft prose. Keep the content editable from JSON and do not hardcode strings into the runtime.
