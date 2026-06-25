export function createInitialState(caseData) {
  return {
    caseId: caseData.id,
    startedAt: new Date().toISOString(),
    visitedLeadIds: [],
    visitedLocationIds: [],
    discoveredEvidenceIds: [],
    discoveredFactIds: [],
    resolvedHubResponseIds: [],
    revealedLocationIds: [...caseData.startingLocationIds],
    notebookEntries: [],
    leadCount: 0,
    genericVisitCount: 0,
    theory: {
      who: null,
      why: null,
      how: null,
      where: null,
      when: null,
      supportingEvidenceIds: []
    }
  };
}

export function isLocationKnown(caseData, state, locationId) {
  return caseData.activeLocationIds.includes(locationId) && (
    !caseData.hiddenLocationIds.includes(locationId) ||
    state.revealedLocationIds.includes(locationId)
  );
}

export function resolveVisit(caseData, locations, genericRules, state, locationId) {
  const location = locations.find((item) => item.id === locationId);
  if (!location) throw new Error(`Missing location: ${locationId}`);

  const hubResponse = findTriggeredHubResponse(caseData, state, locationId);
  if (hubResponse) {
    return {
      kind: "hub_response",
      id: hubResponse.id,
      title: location.name,
      text: hubResponse.text,
      repeatText: hubResponse.repeatText,
      countsAsLead: Boolean(hubResponse.countsAsLead),
      effects: hubResponse.onResolve || {}
    };
  }

  const lead = caseData.leads.find((item) => item.locationId === locationId);
  if (lead && !state.visitedLeadIds.includes(lead.id)) {
    return {
      kind: "case_lead",
      id: lead.id,
      title: lead.title,
      text: lead.text,
      repeatText: lead.repeatText,
      countsAsLead: Boolean(lead.countsAsLead),
      effects: lead.onVisit || {}
    };
  }

  if (lead) {
    return {
      kind: "repeat",
      id: lead.id,
      title: lead.title,
      text: lead.repeatText || lead.text,
      countsAsLead: false,
      effects: {}
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
    text: location.globalDescription || "This place offers no useful information for the present matter.",
    countsAsLead: false,
    effects: {}
  };
}

export function applyResolution(caseData, state, locationId, resolution) {
  const next = structuredClone(state);
  addUnique(next.visitedLocationIds, locationId);

  if (resolution.kind === "case_lead") addUnique(next.visitedLeadIds, resolution.id);
  if (resolution.kind === "hub_response") addUnique(next.resolvedHubResponseIds, resolution.id);
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

  next.revealedLocationIds = next.revealedLocationIds.filter((id) => caseData.activeLocationIds.includes(id));
  return next;
}

export function compareTheory(caseData, state) {
  const slots = ["who", "why", "how", "where", "when"];
  const result = Object.fromEntries(slots.map((slot) => [
    slot,
    state.theory[slot] === caseData.solution[slot] ? "correct" : "incorrect"
  ]));
  const missedCriticalEvidenceIds = (caseData.scoring?.criticalEvidenceIds || caseData.solution.supportingEvidenceIds || [])
    .filter((id) => !state.discoveredEvidenceIds.includes(id));
  return {
    caseId: caseData.id,
    result,
    missedCriticalEvidenceIds,
    leadCount: state.leadCount,
    holmesLeadCount: caseData.scoring?.holmesLeadCount
  };
}

function findTriggeredHubResponse(caseData, state, locationId) {
  return caseData.hubResponses
    .filter((response) => response.hubLocationId === locationId)
    .filter((response) => !state.resolvedHubResponseIds.includes(response.id))
    .filter((response) => triggerMatches(response.trigger || {}, state))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
}

function triggerMatches(trigger, state) {
  const evidenceAny = trigger.evidenceAny || [];
  const evidenceAll = trigger.evidenceAll || [];
  const factsAny = trigger.factsAny || [];
  const factsAll = trigger.factsAll || [];

  if (evidenceAny.length && !evidenceAny.some((id) => state.discoveredEvidenceIds.includes(id))) return false;
  if (evidenceAll.length && !evidenceAll.every((id) => state.discoveredEvidenceIds.includes(id))) return false;
  if (factsAny.length && !factsAny.some((id) => state.discoveredFactIds.includes(id))) return false;
  if (factsAll.length && !factsAll.every((id) => state.discoveredFactIds.includes(id))) return false;
  return true;
}

function findGenericRule(genericRules, location) {
  return [...genericRules]
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .find((rule) => {
      if (rule.hubDomainsAny?.length && location.hubDomains?.some((domain) => rule.hubDomainsAny.includes(domain))) {
        return true;
      }
      if (rule.locationTypes?.length && rule.locationTypes.includes(location.type)) return true;
      return false;
    });
}

function applyEffects(state, effects = {}) {
  for (const id of effects.discoverEvidenceIds || []) addUnique(state.discoveredEvidenceIds, id);
  for (const id of effects.discoverFactIds || []) addUnique(state.discoveredFactIds, id);
  for (const id of effects.revealLocationIds || []) addUnique(state.revealedLocationIds, id);
}

function addUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}
