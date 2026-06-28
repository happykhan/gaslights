export function createInitialState(caseData) {
  const theorySlots = getTheorySlots(caseData);
  return {
    caseId: caseData.id,
    startedAt: new Date().toISOString(),
    visitedLocationIds: [],
    locationVisitCounts: {},
    resolvedVisitRuleIds: [],
    revealedLocationIds: [...getCaseLocationIds(caseData, true)],
    notebookEntries: [],
    leadCount: 0,
    genericVisitCount: 0,
    theory: {
      ...Object.fromEntries(theorySlots.map((slot) => [slot, null]))
    }
  };
}

export function isLocationKnown(caseData, state, locationId) {
  const caseLocationIds = getCaseLocationIds(caseData);
  const hiddenLocationIds = getHiddenLocationIds(caseData);
  return caseLocationIds.includes(locationId) && (
    !hiddenLocationIds.includes(locationId) ||
    state.revealedLocationIds.includes(locationId)
  );
}

export function resolveVisit(caseData, locations, genericRules, state, locationId) {
  const location = locations.find((item) => item.id === locationId);
  if (!location) throw new Error(`Missing location: ${locationId}`);

  const visitRules = getVisitRules(caseData);
  if (visitRules.length) {
    const matchingRule = findMatchingVisitRule(caseData, state, locationId);
    if (matchingRule) {
      return {
        kind: matchingRule.kind || "visit_rule",
        id: matchingRule.id,
        title: matchingRule.title || location.name,
        text: matchingRule.text,
        countsAsLead: Boolean(matchingRule.countsAsLead),
        effects: matchingRule.effects || {}
      };
    }
  }

  const locationRule = findMatchingLocationRule(caseData, state, location);
  if (locationRule) {
    return {
      kind: locationRule.kind || "world",
      id: locationRule.id,
      title: locationRule.title || location.name,
      text: locationRule.text,
      countsAsLead: Boolean(locationRule.countsAsLead),
      effects: locationRule.effects || {}
    };
  }

  const genericRule = findGenericRule(genericRules, location);
  if (genericRule) {
    return {
      kind: "generic",
      id: genericRule.id,
      title: location.name,
      text: genericRule.text,
      countsAsLead: Boolean(genericRule.countsAsLead),
      effects: {}
    };
  }

  return {
    kind: "fallback",
    id: `fallback_${location.id}`,
    title: location.name,
    text: location.defaultVisitText || location.searchPreviewText || "This place offers no useful information for the present matter.",
    countsAsLead: false,
    effects: {}
  };
}

export function applyResolution(caseData, state, locationId, resolution) {
  const next = structuredClone(state);
  addUnique(next.visitedLocationIds, locationId);
  next.locationVisitCounts[locationId] = (next.locationVisitCounts[locationId] || 0) + 1;

  if (isVisitRuleResolution(caseData, resolution.id) || resolution.kind === "world") addUnique(next.resolvedVisitRuleIds, resolution.id);
  if (resolution.kind === "generic" || resolution.kind === "fallback") next.genericVisitCount += 1;
  if (resolution.countsAsLead) next.leadCount += 1;

  applyEffects(next, resolution.effects);
  if (resolution.effects?.addNotebook) {
    next.notebookEntries.push({
      id: `note_${Date.now()}_${next.notebookEntries.length + 1}`,
      createdAt: new Date().toISOString(),
      text: resolution.effects.addNotebook
    });
  }

  next.revealedLocationIds = next.revealedLocationIds.filter((id) => getCaseLocationIds(caseData).includes(id));
  return next;
}

export function compareTheory(caseData, state) {
  const slots = getTheorySlots(caseData);
  const result = Object.fromEntries(slots.map((slot) => [
    slot,
    state.theory[slot] === caseData.solution?.[slot] ? "correct" : "incorrect"
  ]));
  return {
    caseId: caseData.id,
    result,
    leadCount: state.leadCount,
    holmesLeadCount: caseData.scoring?.holmesLeadCount
  };
}

export function getTheorySlots(caseData) {
  return Array.isArray(caseData?.theorySlots) && caseData.theorySlots.length
    ? caseData.theorySlots
    : ["who", "why", "how", "where", "when"];
}

function getCaseLocationIds(caseData, startingOnly = false) {
  if (startingOnly) return caseData.startingLocationIds || [];
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

function getVisitRules(caseData) {
  return Array.isArray(caseData.visitRules) ? caseData.visitRules : [];
}

function isVisitRuleResolution(caseData, resolutionId) {
  return getVisitRules(caseData).some((rule) => rule.id === resolutionId);
}

function findMatchingVisitRule(caseData, state, locationId) {
  return getVisitRules(caseData)
    .filter((rule) => rule.locationId === locationId)
    .filter((rule) => rule.repeatable || !state.resolvedVisitRuleIds.includes(rule.id))
    .sort((a, b) => (Number(b.priority || 0) - Number(a.priority || 0)))
    .find((rule) => visitRuleMatches(rule, state));
}

function findMatchingLocationRule(caseData, state, location) {
  return (location.worldVisitRules || [])
    .filter((rule) => rule.repeatable || !state.resolvedVisitRuleIds.includes(rule.id))
    .filter((rule) => dateMatches(rule, caseData.date))
    .sort((a, b) => (Number(b.priority || 0) - Number(a.priority || 0)))
    .find((rule) => visitRuleMatches(rule, state));
}

function dateMatches(rule, dateValue) {
  if (!rule.validFrom && !rule.validTo) return true;
  const date = Date.parse(`${dateValue || ""}T00:00:00Z`);
  if (!Number.isFinite(date)) return true;
  if (rule.validFrom && date < Date.parse(`${rule.validFrom}T00:00:00Z`)) return false;
  if (rule.validTo && date > Date.parse(`${rule.validTo}T00:00:00Z`)) return false;
  return true;
}

function visitRuleMatches(rule, state) {
  const conditions = rule.conditions || {};
  return groupMatches(conditions.all || [], state, "all")
    && groupMatches(conditions.any || [], state, "any")
    && groupMatches(conditions.none || [], state, "none");
}

function groupMatches(group, state, mode) {
  if (!group.length) return true;
  if (mode === "all") return group.every((condition) => conditionMatches(condition, state));
  if (mode === "any") return group.some((condition) => conditionMatches(condition, state));
  return group.every((condition) => !conditionMatches(condition, state));
}

function conditionMatches(condition, state) {
  const values = condition.values || [];
  switch (condition.type) {
    case "resolvedRuleIds":
      return values.every((id) => state.resolvedVisitRuleIds.includes(id));
    case "visitedLocationIds":
      return values.every((id) => state.visitedLocationIds.includes(id));
    case "visitCountAtLocation":
      return visitCountWithin(values[0], state, condition.min, condition.max);
    case "globalVisitCount":
      return numberWithin(state.genericVisitCount + state.leadCount, condition.min, condition.max);
    default:
      return false;
  }
}

function visitCountWithin(locationId, state, min, max) {
  const count = state.locationVisitCounts?.[locationId] || 0;
  return numberWithin(count, min, max);
}

function numberWithin(value, min, max) {
  if (Number.isFinite(min) && value < min) return false;
  if (Number.isFinite(max) && value > max) return false;
  return true;
}

function findGenericRule(genericRules, location) {
  return [...genericRules]
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .find((rule) => {
      if (rule.tagsAny?.length && location.tags?.some((tag) => rule.tagsAny.includes(tag))) return true;
      if (rule.locationTypes?.length && rule.locationTypes.includes(location.type)) return true;
      return false;
    });
}

function applyEffects(state, effects = {}) {
  for (const id of effects.revealLocationIds || []) addUnique(state.revealedLocationIds, id);
}

function addUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}
