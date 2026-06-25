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
});

test("visiting the laboratory records evidence, facts, notebook, and revealed hubs", () => {
  let state = createInitialState(caseData);
  const resolution = resolveVisit(caseData, locations, allGenericRules, state, "harcourt_laboratory");
  assert.equal(resolution.kind, "case_lead");

  state = applyResolution(caseData, state, "harcourt_laboratory", resolution);
  assert.equal(state.leadCount, 1);
  assert.ok(state.visitedLeadIds.includes("lead_harcourt_laboratory"));
  assert.ok(state.discoveredEvidenceIds.includes("train_ticket_brighton"));
  assert.ok(state.discoveredEvidenceIds.includes("porcelain_cup_residue"));
  assert.ok(state.discoveredFactIds.includes("laboratory_drawer_forced_after_search"));
  assert.ok(state.revealedLocationIds.includes("charing_cross_railway_office"));
  assert.equal(state.notebookEntries.length, 1);
});

test("railway office interprets the ticket automatically after discovery", () => {
  let state = createInitialState(caseData);
  state = visit(state, "harcourt_laboratory").state;

  const visitResult = visit(state, "charing_cross_railway_office");
  assert.equal(visitResult.resolution.kind, "hub_response");
  assert.equal(visitResult.resolution.id, "hub_railway_ticket_response");
  assert.ok(visitResult.state.discoveredFactIds.includes("ticket_bought_by_mallory_not_used"));
  assert.ok(visitResult.state.resolvedHubResponseIds.includes("hub_railway_ticket_response"));
  assert.equal(visitResult.state.leadCount, 2);
});

test("hub without relevant evidence falls back to generic text", () => {
  const state = createInitialState(caseData);
  const resolution = resolveVisit(caseData, locations, allGenericRules, state, "charing_cross_railway_office");
  assert.equal(resolution.kind, "generic");
  assert.match(resolution.text, /needs a ticket|ticket/i);
});

test("critical path reaches solvable state and reveals Caledonia Warehouse", () => {
  let state = createInitialState(caseData);
  for (const locationId of [
    "harcourt_laboratory",
    "charing_cross_railway_office",
    "dr_north_analytical_chemist",
    "harcourt_home",
    "mallory_lodgings",
    "henley_pawnbroker",
    "central_cab_registry",
    "north_star_assurance",
    "port_authority_london_docks",
    "caledonia_warehouse_limehouse"
  ]) {
    state = visit(state, locationId).state;
  }

  for (const id of [
    "ticket_bought_by_mallory_not_used",
    "chloral_in_cup",
    "mallory_pawned_harcourt_watch",
    "cab_317_to_caledonia",
    "cargo_policy_alias_merritt",
    "manifest_places_cargo_at_caledonia",
    "harcourt_found_alive"
  ]) {
    assert.ok(state.discoveredFactIds.includes(id), `missing fact ${id}`);
  }
  assert.ok(state.revealedLocationIds.includes("caledonia_warehouse_limehouse"));
  assert.ok(state.discoveredEvidenceIds.includes("shipping_manifest_entry"));
});

test("theory comparison marks exact matches and missed evidence", () => {
  const state = createInitialState(caseData);
  state.theory = {
    who: "silas_mallory",
    why: "formula_theft_to_pay_debts",
    how: "drugged_with_chloral_and_staged_flight",
    where: "brighton",
    when: "1894-05-15T20:40/21:20",
    supportingEvidenceIds: []
  };

  const comparison = compareTheory(caseData, state);
  assert.equal(comparison.result.who, "correct");
  assert.equal(comparison.result.where, "incorrect");
  assert.ok(comparison.missedCriticalEvidenceIds.includes("train_ticket_brighton"));
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
