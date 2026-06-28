import fs from "node:fs";
import path from "node:path";
import {
  applyResolution,
  createInitialState,
  getTheorySlots,
  resolveVisit
} from "../public/assets/case-engine.js";

const root = process.cwd();
const publicRoot = path.join(root, "public");

const errors = [];
const warnings = [];

const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const readPublicRef = (refPath) => JSON.parse(fs.readFileSync(resolvePublicRef(refPath), "utf8"));

const seedLocations = readJson("public/data/london1895/locations.seed.json");
const osmLocations = readJson("public/data/london1895/locations.osm.json");
const authoredLocations = readJson("public/data/london1895/locations.authored.json");
const locationOverrides = readJson("public/data/london1895/location-overrides.json");
const people = readJson("public/data/london1895/people.seed.json");
const genericRules = readJson("public/data/london1895/generic-lead-rules.seed.json");
const caseIndex = readJson("public/data/cases/index.json");
const newspaperIndex = readJson("public/data/newspapers/index.json");

const locations = applyLocationOverrides(
  [...seedLocations, ...osmLocations, ...authoredLocations],
  locationOverrides
);
const locationIds = ids(locations, "location");
const peopleIds = ids(people, "person");
const caseIds = ids(caseIndex, "case index entry");
const issueIds = ids(newspaperIndex, "newspaper issue");

const issuesById = new Map();
for (const issueMeta of newspaperIndex) {
  required(issueMeta, ["id", "title", "date", "path"], `newspaper index ${issueMeta.id}`);
  const issueData = readPublicRef(issueMeta.path);
  issuesById.set(issueMeta.id, { meta: issueMeta, data: issueData });
}

const cases = caseIndex.map((caseMeta) => {
  required(caseMeta, ["id", "title", "date", "path"], `case index ${caseMeta.id}`);
  return { meta: caseMeta, data: readPublicRef(caseMeta.path) };
});

validateLocations();
validatePeople();
validateIssues();
for (const item of cases) validateCase(item.meta, item.data);

if (warnings.length) {
  console.warn(warnings.map((warning) => `Warning: ${warning}`).join("\n"));
}

if (errors.length) {
  console.error(errors.map((error) => `Error: ${error}`).join("\n"));
  process.exit(1);
}

const legacyLeadCount = cases.reduce((sum, item) => sum + (item.data.leads || []).length, 0);
const visitRuleCount = cases.reduce((sum, item) => sum + (item.data.visitRules || []).length, 0);
const issueItemCount = [...issuesById.values()].reduce((sum, item) => sum + (item.data.items || []).length, 0);

console.log(
  `Validated ${locations.length} locations, ${people.length} people, ${cases.length} cases, ${legacyLeadCount} legacy leads, ${visitRuleCount} visit rules, and ${issueItemCount} newspaper items.`
);

function validateLocations() {
  for (const location of locations) {
    required(location, ["id", "name", "type", "coordinates"], `location ${location.id}`);
    if (!Number.isFinite(location.coordinates?.lat) || !Number.isFinite(location.coordinates?.lng)) {
      warnings.push(`Location has incomplete coordinates: ${location.id}`);
    }
    for (const removedField of ["searchDescription", "globalDescription", "visitRules"]) {
      if (Object.hasOwn(location, removedField)) errors.push(`Location uses removed field ${removedField}: ${location.id}`);
    }
    if (!location.searchPreviewText && !location.defaultVisitText) {
      warnings.push(`Location has no search preview/default visit text: ${location.id}`);
    }
    if (Object.hasOwn(location, "hubDomains")) {
      errors.push(`Location uses removed field hubDomains: ${location.id}`);
    }
    if (location.tags?.includes("specialist_hub")) {
      errors.push(`Location uses removed specialist_hub tag: ${location.id}`);
    }
    const locationRuleIds = ids(location.worldVisitRules || [], `world visit rule for ${location.id}`);
    for (const rule of location.worldVisitRules || []) {
      required(rule, ["id", "title", "text"], `world visit rule ${location.id}:${rule.id}`);
      validateConditionGroup(rule.conditions?.all || [], locationRuleIds, locationIds, `world:${location.id}:${rule.id}:all`);
      validateConditionGroup(rule.conditions?.any || [], locationRuleIds, locationIds, `world:${location.id}:${rule.id}:any`);
      validateConditionGroup(rule.conditions?.none || [], locationRuleIds, locationIds, `world:${location.id}:${rule.id}:none`);
      for (const targetId of rule.effects?.revealLocationIds || []) mustHave(locationIds, targetId, `world visit rule reveal for ${rule.id}`);
      if (rule.validFrom && Number.isNaN(Date.parse(`${rule.validFrom}T00:00:00Z`))) errors.push(`Invalid validFrom date in world visit rule ${location.id}:${rule.id}`);
      if (rule.validTo && Number.isNaN(Date.parse(`${rule.validTo}T00:00:00Z`))) errors.push(`Invalid validTo date in world visit rule ${location.id}:${rule.id}`);
    }
  }
}

function validatePeople() {
  for (const person of people) {
    required(person, ["id", "name", "kind"], `person ${person.id}`);
    if (person.residenceLocationId) mustHave(locationIds, person.residenceLocationId, `person residence for ${person.id}`);
    for (const locationId of person.workLocationIds || []) {
      mustHave(locationIds, locationId, `person workplace for ${person.id}`);
    }
  }
}

function validateIssues() {
  for (const [issueId, issueRecord] of issuesById) {
    const { meta, data } = issueRecord;
    required(data, ["title", "date"], `newspaper issue ${issueId}`);
    if (data.title !== meta.title) warnings.push(`Newspaper title mismatch for ${issueId}: index="${meta.title}" file="${data.title}"`);
    if (data.date !== meta.date) warnings.push(`Newspaper date mismatch for ${issueId}: index="${meta.date}" file="${data.date}"`);
    for (const item of data.items || []) {
      required(item, ["id", "type", "headline", "body"], `newspaper item ${item.id}`);
      for (const locationId of item.linkedLocationIds || []) mustHave(locationIds, locationId, `newspaper linked location for ${item.id}`);
      for (const personId of item.linkedPersonIds || []) mustHave(peopleIds, personId, `newspaper linked person for ${item.id}`);
    }
    for (const caseId of meta.caseIds || []) {
      mustHave(caseIds, caseId, `newspaper linked case for ${issueId}`);
    }
  }
}

function validateCase(caseMeta, caseData) {
  required(caseData, ["id", "title", "intro"], `case ${caseMeta.id}`);
  if (caseData.id !== caseMeta.id) errors.push(`Case id mismatch: index="${caseMeta.id}" file="${caseData.id}"`);
  if (caseData.title !== caseMeta.title) warnings.push(`Case title mismatch for ${caseMeta.id}: index="${caseMeta.title}" file="${caseData.title}"`);

  const caseLocationIds = getCaseLocationIds(caseData);
  const hiddenLocationIds = getHiddenLocationIds(caseData);
  const casePeopleIds = getCasePeopleIds(caseData);
  const issueId = caseData.newspaperIssueId || caseData.newspaperIssueIds?.[0] || null;
  const caseLeads = caseData.leads || [];
  const caseVisitRules = caseData.visitRules || [];
  const caseGenericRules = [...genericRules, ...(caseData.genericLeadRules || [])];

  const caseLeadIds = ids(caseLeads, `lead in case ${caseData.id}`);
  const caseVisitRuleIds = ids(caseVisitRules, `visit rule in case ${caseData.id}`);
  const embeddedPeopleIds = new Set((caseData.people || []).map((person) => person.id).filter(Boolean));
  const allowedWhoIds = new Set([...casePeopleIds, ...embeddedPeopleIds]);

  for (const legacyField of ["evidence", "facts", "hubResponses"]) {
    if (Object.hasOwn(caseData, legacyField)) errors.push(`Case uses removed field ${legacyField}: ${caseData.id}`);
  }
  for (const [locationId, roles] of Object.entries(caseData.caseLocationRoles || {})) {
    if ((roles || []).includes("specialist_hub")) {
      errors.push(`Case uses removed specialist_hub role in ${caseData.id}: ${locationId}`);
    }
  }
  for (const rule of caseGenericRules) {
    if (Object.hasOwn(rule, "hubDomainsAny")) errors.push(`Generic lead rule uses removed hubDomainsAny field: ${rule.id}`);
  }

  if (!caseLocationIds.length) errors.push(`Case has no case locations: ${caseData.id}`);
  for (const locationId of caseData.startingLocationIds || []) mustHave(locationIds, locationId, `starting location for ${caseData.id}`);
  for (const locationId of caseLocationIds) mustHave(locationIds, locationId, `case location for ${caseData.id}`);
  for (const locationId of hiddenLocationIds) mustHave(locationIds, locationId, `hidden location for ${caseData.id}`);

  for (const personId of casePeopleIds) {
    if (!peopleIds.has(personId)) errors.push(`Unknown case person for ${caseData.id}: ${personId}`);
  }

  if (!issueId) {
    errors.push(`Case has no linked newspaper issue: ${caseData.id}`);
  } else if (!issueIds.has(issueId)) {
    errors.push(`Case references missing newspaper issue ${issueId}: ${caseData.id}`);
  } else {
    const issueMeta = issuesById.get(issueId)?.meta;
    if (issueMeta && !(issueMeta.caseIds || []).includes(caseData.id)) {
      warnings.push(`Case ${caseData.id} uses issue ${issueId} but that issue index does not list the case`);
    }
  }

  for (const lead of caseLeads) {
    required(lead, ["id", "locationId", "title", "text"], `lead ${lead.id}`);
    mustHave(locationIds, lead.locationId, `lead location for ${lead.id}`);
    for (const locationId of lead.onVisit?.revealLocationIds || []) mustHave(locationIds, locationId, `lead reveal for ${lead.id}`);
  }

  for (const rule of caseVisitRules) {
    required(rule, ["id", "locationId", "title", "text"], `visit rule ${rule.id}`);
    if (!caseLocationIds.includes(rule.locationId)) {
      errors.push(`Visit rule references location outside caseLocationIds in ${caseData.id}: ${rule.id} -> ${rule.locationId}`);
    }
    validateConditionGroup(rule.conditions?.all || [], caseVisitRuleIds, caseLocationIds, `${caseData.id}:${rule.id}:all`);
    validateConditionGroup(rule.conditions?.any || [], caseVisitRuleIds, caseLocationIds, `${caseData.id}:${rule.id}:any`);
    validateConditionGroup(rule.conditions?.none || [], caseVisitRuleIds, caseLocationIds, `${caseData.id}:${rule.id}:none`);
    if (rule.effects?.discoverEvidenceIds?.length || rule.effects?.discoverFactIds?.length) {
      errors.push(`Visit rule uses removed discovery effects in ${caseData.id}: ${rule.id}`);
    }
    for (const locationId of rule.effects?.revealLocationIds || []) mustHave(locationIds, locationId, `visit rule reveal for ${rule.id}`);
  }

  for (const question of caseData.solutionQuestions || []) {
    required(question, ["id", "prompt"], `solution question ${question.id}`);
  }

  validateTheory(caseData, caseLocationIds, allowedWhoIds);
  validateRevealPaths(caseData, hiddenLocationIds);
  validateTaggedFallbackCoverage(caseData, caseGenericRules);
  validateCriticalPath(caseData, caseGenericRules);
  validateVisitRuleReachability(caseData);
}

function validateTheory(caseData, caseLocationIds, allowedWhoIds) {
  const theorySlots = getTheorySlots(caseData);
  for (const slot of theorySlots) {
    const solutionValue = caseData.solution?.[slot];
    if (slot === "who") {
      if (!allowedWhoIds.size) errors.push(`Theory slot "who" has no case people: ${caseData.id}`);
      if (!solutionValue) errors.push(`Theory slot "who" has no solution value: ${caseData.id}`);
      else if (!allowedWhoIds.has(solutionValue)) errors.push(`Theory solution "who" is not a case person: ${caseData.id} -> ${solutionValue}`);
      continue;
    }
    if (slot === "where") {
      if (!caseLocationIds.length) errors.push(`Theory slot "where" has no case locations: ${caseData.id}`);
      if (!solutionValue) errors.push(`Theory slot "where" has no solution value: ${caseData.id}`);
      else if (!caseLocationIds.includes(solutionValue)) errors.push(`Theory solution "where" is not a case location: ${caseData.id} -> ${solutionValue}`);
      continue;
    }
    const options = caseData.theoryOptions?.[slot] || [];
    if (!options.length) errors.push(`Theory slot "${slot}" has no options: ${caseData.id}`);
    if (!solutionValue) errors.push(`Theory slot "${slot}" has no solution value: ${caseData.id}`);
    else if (!options.includes(solutionValue)) errors.push(`Theory solution "${slot}" is not present in theoryOptions for ${caseData.id}: ${solutionValue}`);
  }
}

function validateRevealPaths(caseData, hiddenLocationIds) {
  if (!hiddenLocationIds.length) return;
  const revealedByEffects = new Set(caseData.startingLocationIds || []);
  for (const lead of caseData.leads || []) for (const locationId of lead.onVisit?.revealLocationIds || []) revealedByEffects.add(locationId);
  for (const rule of caseData.visitRules || []) for (const locationId of rule.effects?.revealLocationIds || []) revealedByEffects.add(locationId);
  for (const locationId of hiddenLocationIds) {
    if (!revealedByEffects.has(locationId)) errors.push(`Hidden location has no reveal path in ${caseData.id}: ${locationId}`);
  }
}

function validateTaggedFallbackCoverage(caseData, allGenericRules) {
  const taggedLocations = locations.filter((location) =>
    getCaseLocationIds(caseData).includes(location.id) &&
    Array.isArray(location.tags) &&
    location.tags.length
  );
  for (const location of taggedLocations) {
    const hasCaseLead = (caseData.leads || []).some((lead) => lead.locationId === location.id);
    const hasVisitRule = (caseData.visitRules || []).some((rule) => rule.locationId === location.id);
    const hasGenericFallback = allGenericRules.some((rule) =>
      rule.tagsAny?.some((tag) => location.tags.includes(tag)) ||
      rule.locationTypes?.includes(location.type)
    );
    if (!hasCaseLead && !hasVisitRule && !hasGenericFallback) {
      warnings.push(`Tagged case location has no lead, visit rule, or generic fallback in ${caseData.id}: ${location.id}`);
    }
  }
}

function validateCriticalPath(caseData, allGenericRules) {
  const pathIds = caseData.scoring?.criticalLocationIds || [];
  if (!pathIds.length) return;
  const caseLocations = locations.filter((location) => getCaseLocationIds(caseData).includes(location.id));
  let state = createInitialState(caseData);
  for (const locationId of pathIds) {
    try {
      const resolution = resolveVisit(caseData, caseLocations, allGenericRules, state, locationId);
      state = applyResolution(caseData, state, locationId, resolution);
    } catch (error) {
      errors.push(`Critical path failed in ${caseData.id} at ${locationId}: ${error.message}`);
      return;
    }
  }
  for (const locationId of pathIds) {
    if (!state.visitedLocationIds.includes(locationId)) warnings.push(`Critical location not visited on critical path in ${caseData.id}: ${locationId}`);
  }
}

function validateVisitRuleReachability(caseData) {
  const rulesByLocation = new Map();
  for (const rule of caseData.visitRules || []) {
    if (!rulesByLocation.has(rule.locationId)) rulesByLocation.set(rule.locationId, []);
    rulesByLocation.get(rule.locationId).push(rule);
  }
  for (const [locationId, rules] of rulesByLocation) {
    const sorted = [...rules].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
    let hasRepeatableCatchAll = false;
    for (const rule of sorted) {
      if (hasRepeatableCatchAll) {
        warnings.push(`Visit rule may be unreachable in ${caseData.id} at ${locationId} because a higher-priority repeatable catch-all exists: ${rule.id}`);
      }
      if (rule.repeatable && isCatchAllRule(rule)) {
        hasRepeatableCatchAll = true;
      }
    }
  }
}

function isCatchAllRule(rule) {
  const all = rule.conditions?.all || [];
  const any = rule.conditions?.any || [];
  const none = rule.conditions?.none || [];
  return all.length === 0 && any.length === 0 && none.length === 0;
}

function validateConditionGroup(group, ruleIds, caseLocationIds, label) {
  for (const condition of group) {
    switch (condition.type) {
      case "resolvedRuleIds":
        for (const id of condition.values || []) mustHave(ruleIds, id, `${label} resolved rule`);
        break;
      case "visitedLocationIds":
        for (const id of condition.values || []) {
          if (!caseLocationIds.includes(id)) errors.push(`Condition references location outside case in ${label}: ${id}`);
        }
        break;
      case "visitCountAtLocation":
        if (!condition.values?.[0]) errors.push(`visitCountAtLocation condition missing location in ${label}`);
        else if (!caseLocationIds.includes(condition.values[0])) errors.push(`visitCountAtLocation references location outside case in ${label}: ${condition.values[0]}`);
        break;
      case "globalVisitCount":
        break;
      default:
        warnings.push(`Unknown visit-rule condition type in ${label}: ${condition.type}`);
        break;
    }
  }
}

function ids(items, label) {
  const seen = new Set();
  for (const item of items || []) {
    if (!item?.id) {
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

function resolvePublicRef(refPath) {
  return path.join(publicRoot, String(refPath || "").replace(/^\.\//, ""));
}

function applyLocationOverrides(locationList, overrides) {
  const retiredIds = new Set([...(overrides?.hiddenLocationIds || []), ...(overrides?.retiredLocationIds || [])]);
  const patches = overrides?.patches || {};
  return locationList
    .filter((location) => !retiredIds.has(location.id))
    .map((location) => {
      const patch = patches[location.id];
      if (!patch) return location;
      return {
        ...location,
        ...patch,
        coordinates: patch.coordinates ? {
          ...location.coordinates,
          ...patch.coordinates
        } : location.coordinates
      };
    });
}

function getCaseLocationIds(caseData) {
  return caseData.caseLocationIds || caseData.activeLocationIds || [];
}

function getHiddenLocationIds(caseData) {
  if (Array.isArray(caseData.hiddenLocationIds)) return caseData.hiddenLocationIds;
  if (caseData.caseLocationRoles) {
    return Object.entries(caseData.caseLocationRoles)
      .filter(([, roles]) => (roles || []).includes("hidden"))
      .map(([locationId]) => locationId);
  }
  return [];
}

function getCasePeopleIds(caseData) {
  if (Array.isArray(caseData.casePeopleIds) && caseData.casePeopleIds.length) return caseData.casePeopleIds;
  return (caseData.people || []).map((person) => person.id).filter(Boolean);
}
