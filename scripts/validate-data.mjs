import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

const locations = readJson("public/data/london1895/locations.seed.json");
const directory = readJson("public/data/london1895/directory.seed.json");
const genericRules = readJson("public/data/london1895/generic-lead-rules.seed.json");
const newspaper = readJson("public/data/newspapers/1894-05-17-london-evening-chronicle.json");
const caseData = readJson("public/data/cases/missing-chemist.case.json");

const errors = [];
const warnings = [];

const locationIds = ids(locations, "location");
const leadIds = ids(caseData.leads, "lead");
const evidenceIds = ids(caseData.evidence, "evidence");
const factIds = ids(caseData.facts, "fact");
const hubResponseIds = ids(caseData.hubResponses, "hub response");
const directoryIds = ids(directory, "directory entry");
const newspaperItemIds = ids(newspaper.items, "newspaper item");

required(caseData, ["id", "title", "intro", "startingLocationIds", "activeLocationIds", "leads", "evidence", "facts", "hubResponses", "solution", "theoryOptions"], "case");

for (const location of locations) {
  required(location, ["id", "name", "type", "coordinates"], `location ${location.id}`);
  if (!location.sourceRefs?.length) warnings.push(`Location has no sourceRefs: ${location.id}`);
  if (!location.coordinates?.lat || !location.coordinates?.lng) warnings.push(`Location has incomplete coordinates: ${location.id}`);
}

for (const id of caseData.startingLocationIds) mustHave(locationIds, id, "starting location");
for (const id of caseData.activeLocationIds) mustHave(locationIds, id, "active location");
for (const id of caseData.hiddenLocationIds || []) mustHave(locationIds, id, "hidden location");
for (const id of caseData.directoryEntryIds || []) mustHave(directoryIds, id, "case directory entry");

for (const entry of directory) {
  required(entry, ["id", "displayName"], `directory ${entry.id}`);
  if (entry.locationId) mustHave(locationIds, entry.locationId, `directory location for ${entry.id}`);
}

for (const item of newspaper.items) {
  required(item, ["id", "type", "headline", "body"], `newspaper item ${item.id}`);
  for (const id of item.linkedLocationIds || []) mustHave(locationIds, id, `newspaper linked location for ${item.id}`);
}

for (const lead of caseData.leads) {
  required(lead, ["id", "locationId", "title", "text"], `lead ${lead.id}`);
  mustHave(locationIds, lead.locationId, `lead location for ${lead.id}`);
  for (const id of lead.onVisit?.discoverEvidenceIds || []) mustHave(evidenceIds, id, `lead evidence for ${lead.id}`);
  for (const id of lead.onVisit?.discoverFactIds || []) mustHave(factIds, id, `lead fact for ${lead.id}`);
  for (const id of lead.onVisit?.revealLocationIds || []) mustHave(locationIds, id, `lead reveal for ${lead.id}`);
}

for (const evidence of caseData.evidence) {
  required(evidence, ["id", "name", "discoveredAtLeadId", "domains"], `evidence ${evidence.id}`);
  if (!leadIds.has(evidence.discoveredAtLeadId) && !hubResponseIds.has(evidence.discoveredAtLeadId)) {
    errors.push(`Missing referenced evidence discoveredAtLeadId for ${evidence.id}: ${evidence.discoveredAtLeadId}`);
  }
  if (!evidence.domains?.length) warnings.push(`Evidence has no specialist domain: ${evidence.id}`);
}

for (const response of caseData.hubResponses) {
  required(response, ["id", "hubLocationId", "trigger", "text"], `hub response ${response.id}`);
  mustHave(locationIds, response.hubLocationId, `hub response location for ${response.id}`);
  for (const id of response.trigger?.evidenceAny || []) mustHave(evidenceIds, id, `hub response trigger evidence for ${response.id}`);
  for (const id of response.trigger?.evidenceAll || []) mustHave(evidenceIds, id, `hub response trigger evidence for ${response.id}`);
  for (const id of response.trigger?.factsAny || []) mustHave(factIds, id, `hub response trigger fact for ${response.id}`);
  for (const id of response.trigger?.factsAll || []) mustHave(factIds, id, `hub response trigger fact for ${response.id}`);
  for (const id of response.onResolve?.discoverEvidenceIds || []) mustHave(evidenceIds, id, `hub response resolved evidence for ${response.id}`);
  for (const id of response.onResolve?.discoverFactIds || []) mustHave(factIds, id, `hub response resolved fact for ${response.id}`);
  for (const id of response.onResolve?.revealLocationIds || []) mustHave(locationIds, id, `hub response reveal for ${response.id}`);
}

for (const rule of [...genericRules, ...(caseData.genericLeadRules || [])]) {
  required(rule, ["id", "text"], `generic rule ${rule.id}`);
}

for (const [slot, value] of Object.entries(caseData.solution)) {
  if (!["who", "why", "how", "where", "when"].includes(slot)) continue;
  if (!caseData.theoryOptions?.[slot]?.includes(value)) {
    errors.push(`Solution slot ${slot} is not present in theoryOptions: ${value}`);
  }
}

const revealedByEffects = new Set(caseData.startingLocationIds);
for (const lead of caseData.leads) for (const id of lead.onVisit?.revealLocationIds || []) revealedByEffects.add(id);
for (const response of caseData.hubResponses) for (const id of response.onResolve?.revealLocationIds || []) revealedByEffects.add(id);
for (const id of caseData.hiddenLocationIds || []) {
  if (!revealedByEffects.has(id)) errors.push(`Hidden location has no reveal path: ${id}`);
}

for (const id of caseData.scoring?.criticalEvidenceIds || []) {
  if (!evidenceIds.has(id)) errors.push(`Critical evidence is missing: ${id}`);
}

if (warnings.length) {
  console.warn(warnings.map((warning) => `Warning: ${warning}`).join("\n"));
}

if (errors.length) {
  console.error(errors.map((error) => `Error: ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Validated ${locations.length} locations, ${caseData.leads.length} leads, ${caseData.evidence.length} evidence objects, ${caseData.hubResponses.length} hub responses, ${directory.length} directory entries, and ${newspaper.items.length} newspaper items.`);

function ids(items, label) {
  const seen = new Set();
  for (const item of items || []) {
    if (!item.id) {
      errors.push(`Missing id in ${label}`);
      continue;
    }
    if (seen.has(item.id)) errors.push(`Duplicate ${label} id: ${item.id}`);
    seen.add(item.id);
  }
  return seen;
}

function required(object, fields, label) {
  for (const field of fields) {
    if (object?.[field] === undefined || object?.[field] === null || object?.[field] === "") {
      errors.push(`Missing required field ${field} in ${label}`);
    }
  }
}

function mustHave(set, id, label) {
  if (!set.has(id)) errors.push(`Missing referenced ${label}: ${id}`);
}
