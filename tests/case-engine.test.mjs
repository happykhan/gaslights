import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  applyResolution,
  compareTheory,
  createInitialState,
  isLocationKnown,
  resolveVisit
} from "../public/assets/case-engine.js";

const locations = readJson("public/data/london1895/locations.seed.json");
const genericRules = readJson("public/data/london1895/generic-lead-rules.seed.json");
const caseData = readJson("public/data/cases/missing-chemist.case.json");
const allGenericRules = [...caseData.genericLeadRules, ...genericRules];

test("initial state exposes only starting locations", () => {
  const state = createInitialState(caseData);
  assert.equal(isLocationKnown(caseData, state, "harcourt_laboratory"), true);
  assert.equal(isLocationKnown(caseData, state, "harcourt_home"), true);
  assert.equal(isLocationKnown(caseData, state, "caledonia_warehouse_limehouse"), false);
  assert.equal("discoveredEvidenceIds" in state, false);
  assert.equal("discoveredFactIds" in state, false);
});

test("visiting the laboratory records a visit rule, notebook entry, and revealed locations", () => {
  let state = createInitialState(caseData);
  const resolution = resolveVisit(caseData, locations, allGenericRules, state, "harcourt_laboratory");
  assert.equal(resolution.kind, "lead");

  state = applyResolution(caseData, state, "harcourt_laboratory", resolution);
  assert.equal(state.leadCount, 1);
  assert.ok(state.resolvedVisitRuleIds.includes("lead_harcourt_laboratory"));
  assert.ok(state.revealedLocationIds.includes("charing_cross_railway_office"));
  assert.ok(state.revealedLocationIds.includes("dr_north_analytical_chemist"));
  assert.equal(state.notebookEntries.length, 1);
});

test("railway office responds automatically after the laboratory visit", () => {
  let state = createInitialState(caseData);
  state = visit(state, "harcourt_laboratory").state;

  const visitResult = visit(state, "charing_cross_railway_office");
  assert.equal(visitResult.resolution.kind, "lead");
  assert.equal(visitResult.resolution.id, "hub_railway_ticket_response");
  assert.ok(visitResult.state.resolvedVisitRuleIds.includes("hub_railway_ticket_response"));
  assert.equal(visitResult.state.leadCount, 2);
});

test("tagged office without the prior visit falls back to generic text", () => {
  const state = createInitialState(caseData);
  const resolution = resolveVisit(caseData, locations, allGenericRules, state, "charing_cross_railway_office");
  assert.equal(resolution.kind, "generic");
  assert.match(resolution.text, /ticket|destination|passenger/i);
});

test("critical path reaches solvable visit state and reveals Caledonia Warehouse", () => {
  let state = createInitialState(caseData);
  for (const locationId of caseData.scoring.criticalLocationIds) {
    state = visit(state, locationId).state;
  }

  for (const id of [
    "lead_harcourt_laboratory",
    "hub_railway_ticket_response",
    "hub_chemist_cup_response",
    "lead_mallory_lodgings",
    "hub_pawnbroker_receipt_response",
    "hub_cab_registry_response",
    "hub_insurance_policy_response",
    "hub_port_manifest_response",
    "lead_caledonia_warehouse"
  ]) {
    assert.ok(state.resolvedVisitRuleIds.includes(id), `missing rule ${id}`);
  }
  assert.ok(state.revealedLocationIds.includes("caledonia_warehouse_limehouse"));
});

test("location world visit rules can be gated by case date and repeat state", () => {
  const worldLocations = structuredClone(locations);
  const lab = worldLocations.find((item) => item.id === "harcourt_laboratory");
  lab.worldVisitRules = [
    {
      id: "world_lab_1894",
      title: "Laboratory in 1894",
      kind: "world",
      priority: 50,
      countsAsLead: false,
      repeatable: false,
      validFrom: "1894-01-01",
      validTo: "1894-12-31",
      text: "The laboratory is open to visitors by appointment in 1894.",
      conditions: { all: [], any: [], none: [] },
      effects: { addNotebook: "World laboratory visit." }
    }
  ];
  const worldCase = { ...caseData, visitRules: [], startingLocationIds: ["harcourt_laboratory"], hiddenLocationIds: [] };
  let state = createInitialState(worldCase);
  const result = resolveVisit(worldCase, worldLocations, allGenericRules, state, "harcourt_laboratory");
  assert.equal(result.kind, "world");
  state = applyResolution(worldCase, state, "harcourt_laboratory", result);
  assert.ok(state.resolvedVisitRuleIds.includes("world_lab_1894"));
});

test("visit resolution prefers case, world, generic, default, preview, then final fallback", () => {
  const baseLocation = {
    id: "fallback_lab",
    name: "Fallback Laboratory",
    type: "office",
    tags: [],
    searchPreviewText: "Preview copy.",
    defaultVisitText: "Default visit copy.",
    worldVisitRules: [
      {
        id: "world_fallback_lab",
        title: "World rule",
        kind: "world",
        priority: 50,
        repeatable: true,
        text: "World rule copy.",
        conditions: { all: [], any: [], none: [] },
        effects: {}
      }
    ]
  };
  const baseCase = {
    ...caseData,
    date: "1894-05-17",
    caseLocationIds: ["fallback_lab"],
    startingLocationIds: ["fallback_lab"],
    hiddenLocationIds: [],
    visitRules: [
      {
        id: "case_fallback_lab",
        locationId: "fallback_lab",
        title: "Case rule",
        kind: "lead",
        priority: 100,
        repeatable: true,
        text: "Case rule copy.",
        conditions: { all: [], any: [], none: [] },
        effects: {}
      }
    ]
  };
  const state = createInitialState(baseCase);

  assert.equal(resolveVisit(baseCase, [baseLocation], [], state, "fallback_lab").text, "Case rule copy.");
  assert.equal(resolveVisit({ ...baseCase, visitRules: [] }, [baseLocation], [], state, "fallback_lab").text, "World rule copy.");
  assert.equal(resolveVisit({ ...baseCase, visitRules: [] }, [{ ...baseLocation, worldVisitRules: [] }], [{ id: "generic_office", locationTypes: ["office"], text: "Generic copy." }], state, "fallback_lab").text, "Generic copy.");
  assert.equal(resolveVisit({ ...baseCase, visitRules: [] }, [{ ...baseLocation, worldVisitRules: [], tags: [] }], [], state, "fallback_lab").text, "Default visit copy.");
  assert.equal(resolveVisit({ ...baseCase, visitRules: [] }, [{ ...baseLocation, worldVisitRules: [], defaultVisitText: "" }], [], state, "fallback_lab").text, "Preview copy.");
  assert.equal(resolveVisit({ ...baseCase, visitRules: [] }, [{ ...baseLocation, worldVisitRules: [], defaultVisitText: "", searchPreviewText: "" }], [], state, "fallback_lab").text, "This place offers no useful information for the present matter.");
});

test("theory comparison marks exact matches without missed-evidence output", () => {
  const state = createInitialState(caseData);
  state.theory = {
    who: "silas_mallory",
    why: "formula_theft_to_pay_debts",
    how: "drugged_with_chloral_and_staged_flight",
    where: "brighton"
  };

  const comparison = compareTheory(caseData, state);
  assert.equal(comparison.result.who, "correct");
  assert.equal(comparison.result.where, "incorrect");
  assert.equal("missedCriticalEvidenceIds" in comparison, false);
});

function visit(state, locationId) {
  const resolution = resolveVisit(caseData, locations, allGenericRules, state, locationId);
  return {
    resolution,
    state: applyResolution(caseData, state, locationId, resolution)
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
