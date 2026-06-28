#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { URL } from "node:url";

const args = process.argv.slice(2);
const options = { port: 4179, host: "127.0.0.1" };

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--port") options.port = Number(args[++index]);
  else if (arg === "--host") options.host = args[++index];
  else if (arg === "--help" || arg === "-h") usage(0);
  else usage(1, `Unknown option: ${arg}`);
}

const repoRoot = process.cwd();
const LOCATION_SEED_PATHS = [
  "public/data/london1895/locations.seed.json",
  "public/data/london1895/locations.osm.json"
];
const LOCATION_AUTHORED_PATHS = [
  "public/data/london1895/locations.authored.json",
  "data/london1895/locations.authored.json"
];
const LOCATION_OVERRIDE_PATHS = [
  "public/data/london1895/location-overrides.json",
  "data/london1895/location-overrides.json"
];
const PEOPLE_PATHS = [
  "public/data/london1895/people.seed.json",
  "data/london1895/people.seed.json"
];
const CASE_INDEX_PATHS = [
  "public/data/cases/index.json",
  "data/cases/index.json"
];
const NEWSPAPER_INDEX_PATHS = [
  "public/data/newspapers/index.json",
  "data/newspapers/index.json"
];

const server = http.createServer(handleRequest);
server.listen(options.port, options.host, () => {
  console.log(`Editor listening on http://${options.host}:${options.port}/editor.html`);
});

async function handleRequest(req, res) {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const { pathname } = requestUrl;

    if (req.method === "OPTIONS") {
      return sendEmpty(res, 204);
    }

    if (req.method === "GET" && pathname === "/api/editor/bootstrap") {
      return sendJson(res, 200, buildBootstrapPayload());
    }

    if (req.method === "GET" && pathname === "/api/locations") {
      return sendJson(res, 200, buildLocationsPayload(requestUrl.searchParams));
    }
    if (req.method === "POST" && pathname === "/api/locations") {
      return sendJson(res, 201, createLocation((await readJsonBody(req)).location || {}));
    }
    if (req.method === "PATCH" && pathname.startsWith("/api/locations/")) {
      return sendJson(res, 200, updateLocation(decodeURIComponent(pathname.split("/").pop()), (await readJsonBody(req)).location || {}));
    }
    if (req.method === "DELETE" && pathname.startsWith("/api/locations/")) {
      return sendJson(res, 200, deleteLocation(decodeURIComponent(pathname.split("/").pop())));
    }
    if (req.method === "POST" && pathname === "/api/import/locations") {
      return sendJson(res, 200, importLocations(await readJsonBody(req)));
    }

    if (req.method === "GET" && pathname === "/api/people") {
      return sendJson(res, 200, { items: readPeople() });
    }
    if (req.method === "POST" && pathname === "/api/people") {
      return sendJson(res, 201, createPerson((await readJsonBody(req)).person || {}));
    }
    if (req.method === "PATCH" && pathname.startsWith("/api/people/")) {
      return sendJson(res, 200, updatePerson(decodeURIComponent(pathname.split("/").pop()), (await readJsonBody(req)).person || {}));
    }
    if (req.method === "DELETE" && pathname.startsWith("/api/people/")) {
      return sendJson(res, 200, deletePerson(decodeURIComponent(pathname.split("/").pop())));
    }
    if (req.method === "POST" && pathname === "/api/import/people") {
      return sendJson(res, 200, importPeople(await readJsonBody(req)));
    }

    if (req.method === "GET" && pathname === "/api/cases") {
      return sendJson(res, 200, { items: readCaseIndex() });
    }
    if (req.method === "POST" && pathname === "/api/cases") {
      return sendJson(res, 201, createCase(await readJsonBody(req)));
    }
    if (req.method === "POST" && pathname.endsWith("/duplicate")) {
      const caseId = decodeURIComponent(pathname.split("/")[3]);
      return sendJson(res, 201, duplicateCase(caseId));
    }
    if (req.method === "GET" && pathname.startsWith("/api/cases/") && pathname.endsWith("/workspace")) {
      const caseId = decodeURIComponent(pathname.split("/")[3]);
      return sendJson(res, 200, buildCaseWorkspace(caseId));
    }
    if (req.method === "PATCH" && pathname.startsWith("/api/cases/") && !pathname.endsWith("/workspace") && !pathname.endsWith("/duplicate") && !pathname.endsWith("/newspaper")) {
      const caseId = decodeURIComponent(pathname.split("/")[3]);
      return sendJson(res, 200, updateCase(caseId, (await readJsonBody(req)).caseData || {}));
    }
    if (req.method === "DELETE" && pathname.startsWith("/api/cases/") && !pathname.endsWith("/workspace")) {
      const caseId = decodeURIComponent(pathname.split("/")[3]);
      return sendJson(res, 200, deleteCase(caseId));
    }
    if (req.method === "PATCH" && pathname.startsWith("/api/cases/") && pathname.endsWith("/newspaper")) {
      const caseId = decodeURIComponent(pathname.split("/")[3]);
      return sendJson(res, 200, updateCaseNewspaper(caseId, (await readJsonBody(req)).issue || {}));
    }

    if (req.method === "GET" && pathname === "/") return serveFile(res, path.join(repoRoot, "public", "editor.html"));
    if (req.method === "GET" && (pathname === "/editor" || pathname === "/editor/")) return serveFile(res, path.join(repoRoot, "public", "editor.html"));
    if (req.method === "GET" && pathname === "/editor.html") return serveFile(res, path.join(repoRoot, "public", "editor.html"));
    if (req.method === "GET" && pathname === "/location-editor.html") return serveFile(res, path.join(repoRoot, "public", "editor.html"));
    if (req.method === "GET" && ["/assets/location-editor.js", "/editor/assets/location-editor.js"].includes(pathname)) {
      return serveFile(res, path.join(repoRoot, "public", "assets", "location-editor.js"));
    }
    if (req.method === "GET" && ["/assets/location-editor.css", "/editor/assets/location-editor.css"].includes(pathname)) {
      return serveFile(res, path.join(repoRoot, "public", "assets", "location-editor.css"));
    }
    if (req.method === "GET" && pathname.startsWith("/tiles/")) {
      return servePublicFile(res, pathname);
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    if (error?.code === "REFERENCE_BLOCKED") {
      return sendJson(res, 409, { error: error.message, references: error.references || [] });
    }
    if (error?.code === "HTTP_ERROR") {
      return sendJson(res, error.status || 500, { error: error.message || "Server error" });
    }
    return sendJson(res, 500, { error: error.message || "Server error" });
  }
}

function usage(exitCode, message = "") {
  if (message) console.error(message);
  console.error("Usage: node scripts/location-editor-server.mjs [--port <n>] [--host <host>]");
  process.exit(exitCode);
}

function buildBootstrapPayload() {
  return {
    locations: buildLocationsPayload(new URLSearchParams()).items,
    people: readPeople(),
    cases: readCaseIndex(),
    currentCaseId: readCaseIndex()[0]?.id || null
  };
}

function buildLocationsPayload(searchParams) {
  const query = String(searchParams.get("q") || "").trim().toLowerCase();
  const category = String(searchParams.get("category") || "").trim();
  const items = mergeLocations()
    .map((location) => ({
      ...location,
      category: categorizeLocation(location)
    }))
    .filter((location) => {
      if (category && location.category !== category) return false;
      if (!query) return true;
      return [
        location.name,
        location.aliases?.join(" "),
        location.type,
        location.address,
        location.searchPreviewText || location.defaultVisitText || ""
      ].join(" ").toLowerCase().includes(query);
    });
  return {
    items,
    categories: [...new Set(items.map((item) => item.category))].sort()
  };
}

function buildCaseWorkspace(caseId) {
  const caseData = adaptCaseForEditor(readCaseById(caseId));
  const issue = readIssueById(caseData.newspaperIssueId);
  return {
    caseData,
    issue,
    locations: buildLocationsPayload(new URLSearchParams()).items,
    people: readPeople()
  };
}

function createLocation(input) {
  const authored = readJsonOrDefault(LOCATION_AUTHORED_PATHS[0], []);
  const existingIds = new Set(mergeLocations().map((item) => item.id));
  const nextId = uniqueId(slugify(input.id || input.name || "location"), existingIds, "location");
  const next = normalizeLocationRecord({ ...input, id: nextId, visibility: input.visibility ?? "public" }, { existingIds, sourceKind: "authored" });
  authored.push(stripLocationMeta(next));
  writeJsonOutputs(LOCATION_AUTHORED_PATHS, authored);
  return next;
}

function updateLocation(locationId, input) {
  const authored = readJsonOrDefault(LOCATION_AUTHORED_PATHS[0], []);
  const authoredIndex = authored.findIndex((item) => item.id === locationId);
  if (authoredIndex >= 0) {
    const nextId = String(input.id || locationId).trim();
    const existingIds = new Set(mergeLocations().map((item) => item.id));
    if (nextId !== locationId) {
      if (existingIds.has(nextId)) throw httpError(409, `Location id already exists: ${nextId}`);
      const references = findEntityReferences("location", locationId);
      if (references.length) throw referenceBlocked(`Location ${locationId} is still referenced`, references);
    }
    const updated = normalizeLocationRecord({ ...authored[authoredIndex], ...input, id: nextId }, {
      existingIds,
      sourceKind: "authored"
    });
    authored[authoredIndex] = stripLocationMeta(updated);
    writeJsonOutputs(LOCATION_AUTHORED_PATHS, authored);
    return updated;
  }

  const current = mergeLocations().find((location) => location.id === locationId);
  if (!current) throw httpError(404, `Unknown location id: ${locationId}`);
  const requestedId = String(input.id || locationId).trim();
  if (requestedId && requestedId !== locationId) throw httpError(409, "Seed and imported locations cannot be renamed. Duplicate the place or create a new authored place.");

  const overrides = readOverrides();
  const patches = { ...(overrides.patches || {}) };
  patches[locationId] = pruneEmptyPatch({
    ...(patches[locationId] || {}),
    name: stringOr(current.name, input.name, current.name),
    aliases: normalizeStringArray(input.aliases, current.aliases || []),
    type: stringOr(current.type, input.type, current.type),
    visibility: stringOr(current.visibility || "", input.visibility, current.visibility || ""),
    address: stringOr(current.address || "", input.address, current.address || ""),
    searchPreviewText: stringOr(current.searchPreviewText || current.defaultVisitText || "", input.searchPreviewText, current.searchPreviewText || current.defaultVisitText || ""),
    defaultVisitText: stringOr(current.defaultVisitText || "", input.defaultVisitText, current.defaultVisitText || ""),
    tags: normalizeStringArray(input.tags, current.tags || []),
    worldVisitRules: normalizeVisitRules(input.worldVisitRules || current.worldVisitRules || []),
    coordinates: {
      lat: numberOr(input.lat, current.coordinates?.lat),
      lng: numberOr(input.lng, current.coordinates?.lng)
    }
  });
  writeJsonOutputs(LOCATION_OVERRIDE_PATHS, {
    ...overrides,
    patches
  });
  return mergeLocations().find((location) => location.id === locationId);
}

function deleteLocation(locationId) {
  const current = mergeLocations().find((location) => location.id === locationId);
  if (!current) throw httpError(404, `Unknown location id: ${locationId}`);
  const references = findEntityReferences("location", locationId);
  if (references.length) throw referenceBlocked(`Location ${locationId} is still referenced`, references);

  const authored = readJsonOrDefault(LOCATION_AUTHORED_PATHS[0], []);
  const authoredIndex = authored.findIndex((item) => item.id === locationId);
  if (authoredIndex >= 0) {
    authored.splice(authoredIndex, 1);
    writeJsonOutputs(LOCATION_AUTHORED_PATHS, authored);
    return { deletedId: locationId, mode: "hard_delete" };
  }

  const overrides = readOverrides();
  const retiredLocationIds = new Set(overrides.retiredLocationIds || []);
  retiredLocationIds.add(locationId);
  writeJsonOutputs(LOCATION_OVERRIDE_PATHS, {
    ...overrides,
    retiredLocationIds: [...retiredLocationIds].sort()
  });
  return { deletedId: locationId, mode: "retired" };
}

function importLocations(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  const seedIds = new Set(LOCATION_SEED_PATHS
    .flatMap((file) => readJsonOrDefault(file, []))
    .map((location) => location.id)
    .filter(Boolean));
  const authoredById = new Map();
  for (const location of readJsonOrDefault(LOCATION_AUTHORED_PATHS[0], [])) {
    if (location?.id) authoredById.set(location.id, location);
  }
  const overrides = readOverrides();
  const patches = { ...(overrides.patches || {}) };
  const retiredLocationIds = new Set(overrides.retiredLocationIds || []);
  const existingIds = new Set([
    ...seedIds,
    ...authoredById.keys()
  ]);
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const locationId = String(item?.id || "").trim();
    if (!locationId) {
      skipped += 1;
      continue;
    }
    const existed = existingIds.has(locationId) || retiredLocationIds.has(locationId) || Boolean(patches[locationId]);
    const normalized = normalizeLocationRecord({ ...item, id: locationId }, {
      existingIds,
      sourceKind: seedIds.has(locationId) ? inferLocationSourceKind(locationId) : "authored"
    });

    if (seedIds.has(locationId)) {
      patches[locationId] = pruneEmptyPatch({
        ...(patches[locationId] || {}),
        ...locationPatchFromImport(normalized)
      });
    } else {
      authoredById.set(locationId, stripLocationMeta(normalized));
      existingIds.add(locationId);
    }
    retiredLocationIds.delete(locationId);
    if (existed) updated += 1;
    else created += 1;
  }

  writeJsonOutputs(LOCATION_AUTHORED_PATHS, [...authoredById.values()].sort((a, b) => a.name.localeCompare(b.name)));
  writeJsonOutputs(LOCATION_OVERRIDE_PATHS, {
    ...overrides,
    patches,
    retiredLocationIds: [...retiredLocationIds].sort()
  });
  return {
    ...buildLocationsPayload(new URLSearchParams()),
    importSummary: { created, updated, skipped }
  };
}

function importPeople(body) {
  const current = readPeople();
  const existingIds = new Set(current.map((item) => item.id));
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of Array.isArray(body.items) ? body.items : []) {
    if (!item?.id) continue;
    const normalized = normalizePerson(
      existingIds.has(item.id) ? { ...byId.get(item.id), ...item } : item,
      { existingIds }
    );
    byId.set(normalized.id, normalized);
    existingIds.add(normalized.id);
  }
  const next = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  writeJsonOutputs(PEOPLE_PATHS, next);
  return { items: next };
}

function createPerson(input) {
  const items = readPeople();
  const existingIds = new Set(items.map((item) => item.id));
  const person = normalizePerson({
    ...input,
    id: uniqueId(slugify(input.id || input.name || "person"), existingIds, "person")
  }, existingIds);
  items.push(person);
  writeJsonOutputs(PEOPLE_PATHS, items);
  return { person, items };
}

function updatePerson(personId, input) {
  const items = readPeople();
  const index = items.findIndex((item) => item.id === personId);
  if (index < 0) throw httpError(404, `Unknown person id: ${personId}`);
  const nextId = String(input.id || personId).trim();
  const existingIds = new Set(items.map((item) => item.id));
  if (nextId !== personId) {
    if (existingIds.has(nextId)) throw httpError(409, `Person id already exists: ${nextId}`);
    const references = findEntityReferences("person", personId);
    if (references.length) throw referenceBlocked(`Person ${personId} is still referenced`, references);
  }
  items[index] = normalizePerson({ ...items[index], ...input, id: nextId }, existingIds);
  writeJsonOutputs(PEOPLE_PATHS, items);
  return { person: items[index], items };
}

function deletePerson(personId) {
  const references = findEntityReferences("person", personId);
  if (references.length) throw referenceBlocked(`Person ${personId} is still referenced`, references);
  const items = readPeople();
  const index = items.findIndex((item) => item.id === personId);
  if (index < 0) throw httpError(404, `Unknown person id: ${personId}`);
  items.splice(index, 1);
  writeJsonOutputs(PEOPLE_PATHS, items);
  return { deletedId: personId, items };
}

function createCase(body) {
  const caseIndex = readCaseIndex();
  const currentIds = new Set(caseIndex.map((item) => item.id));
  const caseId = uniqueId(slugify(body.id || body.title || "new_case"), currentIds, "case");
  const issueIndex = readNewspaperIndex();
  const issueId = uniqueId(`issue_${caseId}`, new Set(issueIndex.map((item) => item.id)), "issue");
  const issuePath = `./data/newspapers/${issueId}.issue.json`;

  const caseData = createDefaultCase(caseId, issueId, body);
  const issue = createDefaultIssue(issueId, caseId, body.date || caseData.date);
  writeCaseFile(caseId, caseData);
  writeIssueFile(issueId, issuePath, issue);

  caseIndex.push({
    id: caseId,
    title: caseData.title,
    date: caseData.date,
    summary: caseData.summary,
    path: `./data/cases/${caseId}.case.json`,
    status: caseData.status || "draft"
  });
  writeJsonOutputs(CASE_INDEX_PATHS, caseIndex);

  issueIndex.push({
    id: issueId,
    title: issue.title,
    date: issue.date,
    path: issuePath,
    caseIds: [caseId]
  });
  writeJsonOutputs(NEWSPAPER_INDEX_PATHS, issueIndex);

  return buildCaseWorkspace(caseId);
}

function duplicateCase(caseId) {
  const source = adaptCaseForEditor(readCaseById(caseId));
  const sourceIssue = readIssueById(source.newspaperIssueId);
  return createCase({
    id: `${caseId}_copy`,
    title: `${source.title} Copy`,
    date: source.date,
    status: "draft",
    summary: source.summary,
    intro: source.intro,
    seedCaseData: {
      ...source,
      id: undefined,
      title: `${source.title} Copy`,
      newspaperIssueId: undefined
    },
    seedIssue: {
      ...sourceIssue,
      id: undefined,
      title: sourceIssue.title
    }
  });
}

function updateCase(caseId, input) {
  const current = adaptCaseForEditor(readCaseById(caseId));
  const next = normalizeCaseForStorage({
    ...current,
    ...input,
    id: caseId,
    caseLocationIds: dedupeStrings(input.caseLocationIds ?? current.caseLocationIds ?? []),
    casePeopleIds: dedupeStrings(input.casePeopleIds ?? current.casePeopleIds ?? []),
    theorySlots: dedupeStrings(input.theorySlots ?? current.theorySlots ?? ["who", "why", "how", "where"]),
    theoryOptions: {
      why: normalizeStringArray(input.theoryOptions?.why, current.theoryOptions?.why || []),
      how: normalizeStringArray(input.theoryOptions?.how, current.theoryOptions?.how || [])
    },
    visitRules: normalizeVisitRules(input.visitRules ?? current.visitRules ?? []),
    solution: normalizeSolution(input.solution ?? current.solution ?? {}),
    solutionQuestions: normalizeSolutionQuestions(input.solutionQuestions ?? current.solutionQuestions ?? [])
  });

  validateCaseReferences(next);
  writeCaseFile(caseId, next);
  syncCaseIndexEntry(next);
  return buildCaseWorkspace(caseId);
}

function updateCaseNewspaper(caseId, issueInput) {
  const caseData = adaptCaseForEditor(readCaseById(caseId));
  const issueEntry = readNewspaperIndex().find((item) => item.id === caseData.newspaperIssueId);
  if (!issueEntry) throw new Error(`Unknown newspaper issue for case ${caseId}`);
  const nextIssue = normalizeIssue({
    ...readIssueFile(issueEntry.path),
    ...issueInput,
    id: caseData.newspaperIssueId,
    caseIds: [caseId]
  });
  writeIssueFile(caseData.newspaperIssueId, issueEntry.path, nextIssue);
  syncNewspaperIndexEntry(nextIssue, issueEntry.path, caseId);
  return buildCaseWorkspace(caseId);
}

function deleteCase(caseId) {
  const caseIndex = readCaseIndex();
  const caseEntry = caseIndex.find((item) => item.id === caseId);
  if (!caseEntry) throw new Error(`Unknown case id: ${caseId}`);
  const caseData = adaptCaseForEditor(readCaseById(caseId));
  const issueEntry = readNewspaperIndex().find((item) => item.id === caseData.newspaperIssueId);

  removeFileIfExists(resolveRelative(caseEntry.path));
  removeFileIfExists(resolveDataMirror(caseEntry.path));
  writeJsonOutputs(CASE_INDEX_PATHS, caseIndex.filter((item) => item.id !== caseId));

  if (issueEntry) {
    removeFileIfExists(resolveRelative(issueEntry.path));
    removeFileIfExists(resolveDataMirror(issueEntry.path));
    writeJsonOutputs(NEWSPAPER_INDEX_PATHS, readNewspaperIndex().filter((item) => item.id !== issueEntry.id));
  }
  return { deletedId: caseId };
}

function readCaseIndex() {
  return readJsonOrDefault(CASE_INDEX_PATHS[0], []);
}

function readNewspaperIndex() {
  return readJsonOrDefault(NEWSPAPER_INDEX_PATHS[0], []);
}

function readCaseById(caseId) {
  const entry = readCaseIndex().find((item) => item.id === caseId);
  if (!entry) throw new Error(`Unknown case id: ${caseId}`);
  return readJsonOrDefault(relativeToPublicPath(entry.path), {});
}

function readIssueById(issueId) {
  const entry = readNewspaperIndex().find((item) => item.id === issueId);
  if (!entry) throw new Error(`Unknown newspaper issue id: ${issueId}`);
  return normalizeIssue(readIssueFile(entry.path));
}

function readIssueFile(relativePath) {
  return readJsonOrDefault(relativeToPublicPath(relativePath), {});
}

function readPeople() {
  return readJsonOrDefault(PEOPLE_PATHS[0], []).map((item) => normalizePerson(item, new Set()));
}

function readOverrides() {
  const overrides = readJsonOrDefault(LOCATION_OVERRIDE_PATHS[0], {});
  return {
    patches: overrides.patches || {},
    retiredLocationIds: overrides.retiredLocationIds || []
  };
}

function mergeLocations() {
  const sources = LOCATION_SEED_PATHS.flatMap((file) => readJsonOrDefault(file, []));
  const authored = readJsonOrDefault(LOCATION_AUTHORED_PATHS[0], []);
  const overrides = readOverrides();
  const retired = new Set(overrides.retiredLocationIds || []);
  return [
    ...sources.map((location) => normalizeLocationRecord(location, { sourceKind: inferLocationSourceKind(location.id) })),
    ...authored.map((location) => normalizeLocationRecord(location, { sourceKind: "authored" }))
  ]
    .filter((location) => !retired.has(location.id))
    .map((location) => applyLocationPatch(location, overrides.patches[location.id]))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function applyLocationPatch(location, patch = {}) {
  if (!patch) return location;
  return normalizeLocationRecord({
    ...location,
    ...patch,
    coordinates: {
      lat: numberOr(patch.coordinates?.lat, location.coordinates?.lat),
      lng: numberOr(patch.coordinates?.lng, location.coordinates?.lng)
    }
  }, { sourceKind: location.sourceKind });
}

function adaptCaseForEditor(caseData) {
  const current = structuredClone(caseData);
  const people = current.casePeopleIds?.length
    ? current.casePeopleIds
    : (current.people || []).map((item) => item.id);
  const caseLocationIds = current.caseLocationIds?.length
    ? current.caseLocationIds
    : (current.activeLocationIds || []);

  const caseLocationRoles = current.caseLocationRoles || buildLocationRoles(current, caseLocationIds);
  const visitRules = current.visitRules || [];

  return normalizeCaseForStorage({
    ...current,
    casePeopleIds: people,
    caseLocationIds,
    caseLocationRoles,
    newspaperIssueId: current.newspaperIssueId || current.newspaperIssueIds?.[0] || null,
    theorySlots: current.theorySlots?.length ? current.theorySlots : ["who", "why", "how", "where"],
    theoryOptions: {
      why: current.theoryOptions?.why || [],
      how: current.theoryOptions?.how || []
    },
    solution: normalizeSolution(current.solution || {}),
    visitRules,
    solutionQuestions: normalizeSolutionQuestions(current.solutionQuestions || [])
  });
}

function buildLocationRoles(caseData, caseLocationIds) {
  const roles = {};
  const hidden = new Set(caseData.hiddenLocationIds || []);
  const leadLocations = new Set((caseData.leads || []).map((item) => item.locationId));
  for (const locationId of caseLocationIds) {
    const locationRoles = [];
    if (leadLocations.has(locationId)) locationRoles.push("lead");
    if (hidden.has(locationId)) locationRoles.push("hidden");
    if (!locationRoles.length) locationRoles.push("ambient");
    roles[locationId] = locationRoles;
  }
  return roles;
}

function normalizeCaseForStorage(caseData) {
  return {
    id: String(caseData.id || "").trim(),
    title: String(caseData.title || "Untitled Case").trim(),
    date: String(caseData.date || "").trim(),
    status: String(caseData.status || "draft").trim(),
    summary: String(caseData.summary || "").trim(),
    intro: String(caseData.intro || "").trim(),
    theorySlots: dedupeStrings(caseData.theorySlots || ["who", "why", "how", "where"]),
    theoryOptions: {
      why: normalizeStringArray(caseData.theoryOptions?.why, []),
      how: normalizeStringArray(caseData.theoryOptions?.how, [])
    },
    casePeopleIds: dedupeStrings(caseData.casePeopleIds || []),
    caseLocationIds: dedupeStrings(caseData.caseLocationIds || []),
    caseLocationRoles: normalizeCaseLocationRoles(caseData.caseLocationRoles || {}),
    newspaperIssueId: String(caseData.newspaperIssueId || "").trim(),
    startingLocationIds: dedupeStrings(caseData.startingLocationIds || []),
    hiddenLocationIds: dedupeStrings(caseData.hiddenLocationIds || []),
    visitRules: normalizeVisitRules(caseData.visitRules || []),
    solution: normalizeSolution(caseData.solution || {}),
    solutionQuestions: normalizeSolutionQuestions(caseData.solutionQuestions || []),
    scoring: caseData.scoring || {},
    genericLeadRules: caseData.genericLeadRules || []
  };
}

function normalizeCaseLocationRoles(roles) {
  return Object.fromEntries(
    Object.entries(roles || {}).map(([locationId, roleList]) => [locationId, dedupeStrings(roleList || [])])
  );
}

function normalizeVisitRules(rules) {
  return (rules || []).map((rule, index) => pruneEmptyRuleFields({
    id: String(rule.id || `rule_${index + 1}`).trim(),
    locationId: String(rule.locationId || "").trim(),
    title: String(rule.title || "Untitled Rule").trim(),
    kind: String(rule.kind || "lead").trim(),
    priority: Number.isFinite(Number(rule.priority)) ? Number(rule.priority) : 100,
    countsAsLead: Boolean(rule.countsAsLead),
    repeatable: Boolean(rule.repeatable),
    validFrom: String(rule.validFrom || "").trim(),
    validTo: String(rule.validTo || "").trim(),
    text: String(rule.text || "").trim(),
    conditions: normalizeConditions(rule.conditions || {}),
    effects: normalizeEffects(rule.effects || {})
  }));
}

function pruneEmptyRuleFields(rule) {
  if (!rule.locationId) delete rule.locationId;
  if (!rule.validFrom) delete rule.validFrom;
  if (!rule.validTo) delete rule.validTo;
  if (!rule.effects.revealLocationIds.length) delete rule.effects.revealLocationIds;
  if (!rule.effects.addNotebook) delete rule.effects.addNotebook;
  if (!Object.keys(rule.effects).length) delete rule.effects;
  return rule;
}

function normalizeConditions(conditions) {
  return {
    all: normalizeConditionGroup(conditions.all || []),
    any: normalizeConditionGroup(conditions.any || []),
    none: normalizeConditionGroup(conditions.none || [])
  };
}

function normalizeConditionGroup(group) {
  return (group || [])
    .map((condition) => ({
      type: String(condition.type || "").trim(),
      values: dedupeStrings(condition.values || []),
      min: optionalNumber(condition.min),
      max: optionalNumber(condition.max)
    }))
    .filter((condition) => condition.type);
}

function normalizeEffects(effects) {
  return {
    revealLocationIds: dedupeStrings(effects.revealLocationIds || []),
    addNotebook: String(effects.addNotebook || "").trim()
  };
}

function optionalNumber(value) {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function normalizeSolution(solution) {
  return {
    who: String(solution.who || "").trim(),
    why: String(solution.why || "").trim(),
    how: String(solution.how || "").trim(),
    where: String(solution.where || "").trim(),
    explanation: String(solution.explanation || "").trim()
  };
}

function normalizeSolutionQuestions(items) {
  return (items || []).map((item, index) => ({
    id: String(item.id || `question_${index + 1}`).trim(),
    prompt: String(item.prompt || "").trim(),
    modelAnswer: String(item.modelAnswer || "").trim()
  })).filter((item) => item.id && item.prompt);
}

function normalizeIssue(issue) {
  return {
    id: String(issue.id || "").trim(),
    title: String(issue.title || "The Daily Telegraph").trim(),
    date: String(issue.date || "").trim(),
    caseIds: dedupeStrings(issue.caseIds || []),
    items: (issue.items || []).map((item) => normalizeNewspaperItem(item, issue.items || []))
  };
}

function validateCaseReferences(caseData) {
  const locationIds = new Set(mergeLocations().map((item) => item.id));
  const peopleIds = new Set(readPeople().map((item) => item.id));

  for (const id of caseData.caseLocationIds) if (!locationIds.has(id)) throw new Error(`Unknown case location: ${id}`);
  for (const id of caseData.casePeopleIds) if (!peopleIds.has(id)) throw new Error(`Unknown case person: ${id}`);
  for (const id of caseData.startingLocationIds) if (!locationIds.has(id)) throw new Error(`Unknown starting location: ${id}`);
  for (const id of caseData.hiddenLocationIds) if (!locationIds.has(id)) throw new Error(`Unknown hidden location: ${id}`);

  const ruleIds = new Set(caseData.visitRules.map((item) => item.id));
  for (const rule of caseData.visitRules) {
    if (!locationIds.has(rule.locationId)) throw new Error(`Visit rule references unknown location: ${rule.locationId}`);
    validateConditionGroup(rule.conditions.all, { ruleIds, locationIds });
    validateConditionGroup(rule.conditions.any, { ruleIds, locationIds });
    validateConditionGroup(rule.conditions.none, { ruleIds, locationIds });
    for (const id of rule.effects?.revealLocationIds || []) if (!locationIds.has(id)) throw new Error(`Visit rule effect references unknown location: ${id}`);
  }
}

function validateConditionGroup(group, refs) {
  for (const condition of group || []) {
    const values = condition.values || [];
    if (condition.type === "resolvedRuleIds") values.forEach((id) => { if (!refs.ruleIds.has(id)) throw new Error(`Unknown rule in condition: ${id}`); });
    if (condition.type === "visitedLocationIds") values.forEach((id) => { if (!refs.locationIds.has(id)) throw new Error(`Unknown location in condition: ${id}`); });
  }
}

function syncCaseIndexEntry(caseData) {
  const index = readCaseIndex();
  const next = index.map((item) => item.id === caseData.id ? {
    ...item,
    title: caseData.title,
    date: caseData.date,
    summary: caseData.summary,
    status: caseData.status,
    path: `./data/cases/${caseData.id}.case.json`
  } : item);
  writeJsonOutputs(CASE_INDEX_PATHS, next);
}

function syncNewspaperIndexEntry(issue, issuePath, caseId) {
  const next = readNewspaperIndex().map((item) => item.id === issue.id ? {
    ...item,
    title: issue.title,
    date: issue.date,
    path: issuePath,
    caseIds: [caseId]
  } : item);
  writeJsonOutputs(NEWSPAPER_INDEX_PATHS, next);
}

function writeCaseFile(caseId, caseData) {
  writeJsonOutputs([
    `public/data/cases/${caseId}.case.json`,
    `data/cases/${caseId}.case.json`
  ], caseData);
}

function writeIssueFile(issueId, issuePath, issueData) {
  writeJsonOutputs([
    relativeToPublicPath(issuePath),
    resolveDataMirror(issuePath)
  ], normalizeIssue({ ...issueData, id: issueId }));
}

function createDefaultCase(caseId, issueId, body) {
  const seed = body.seedCaseData || {};
  const date = String(body.date || seed.date || "1894-05-17");
  return normalizeCaseForStorage({
    id: caseId,
    title: String(body.title || seed.title || "New Case"),
    date,
    status: String(body.status || seed.status || "draft"),
    summary: String(body.summary || seed.summary || ""),
    intro: String(body.intro || seed.intro || ""),
    theorySlots: seed.theorySlots || ["who", "why", "how", "where"],
    theoryOptions: seed.theoryOptions || { why: [], how: [] },
    casePeopleIds: seed.casePeopleIds || [],
    caseLocationIds: seed.caseLocationIds || [],
    caseLocationRoles: seed.caseLocationRoles || {},
    newspaperIssueId: issueId,
    startingLocationIds: seed.startingLocationIds || [],
    hiddenLocationIds: seed.hiddenLocationIds || [],
    visitRules: seed.visitRules || [],
    solution: seed.solution || { who: "", why: "", how: "", where: "", explanation: "" },
    solutionQuestions: seed.solutionQuestions || [],
    scoring: seed.scoring || {},
    genericLeadRules: seed.genericLeadRules || []
  });
}

function createDefaultIssue(issueId, caseId, date) {
  return normalizeIssue({
    id: issueId,
    title: "The Daily Telegraph",
    date,
    caseIds: [caseId],
    items: []
  });
}

function readJsonOrDefault(relativePath, fallback) {
  const absolutePath = path.isAbsolute(relativePath) ? relativePath : path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) return structuredClone(fallback);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function writeJsonOutputs(outputs, payload) {
  for (const relativePath of outputs) {
    const absolutePath = path.isAbsolute(relativePath) ? relativePath : path.join(repoRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }
}

function normalizeLocationRecord(location, context = {}) {
  const sourceKind = context.sourceKind || location.sourceKind || inferLocationSourceKind(location.id);
  return {
    id: String(location.id || uniqueId(slugify(location.name || "location"), context.existingIds || new Set(), "location")).trim(),
    name: String(location.name || "Untitled place").trim(),
    aliases: normalizeStringArray(location.aliases, []),
    type: String(location.type || "other").trim(),
    visibility: String(location.visibility || "").trim(),
    address: String(location.address || "").trim(),
    searchPreviewText: String(location.searchPreviewText || "").trim(),
    defaultVisitText: String(location.defaultVisitText || "").trim(),
    coordinates: {
      lat: numberOr(location.lat ?? location.coordinates?.lat, 51.5079),
      lng: numberOr(location.lng ?? location.coordinates?.lng, -0.1246)
    },
    tags: normalizeStringArray(location.tags, []),
    worldVisitRules: normalizeVisitRules(location.worldVisitRules || []),
    sourceKind
  };
}

function stripLocationMeta(location) {
  return {
    id: location.id,
    name: location.name,
    aliases: location.aliases,
    type: location.type,
    visibility: location.visibility,
    address: location.address,
    searchPreviewText: location.searchPreviewText,
    defaultVisitText: location.defaultVisitText,
    coordinates: location.coordinates,
    tags: location.tags,
    worldVisitRules: location.worldVisitRules
  };
}

function locationPatchFromImport(location) {
  return {
    name: location.name,
    aliases: location.aliases,
    type: location.type,
    visibility: location.visibility,
    address: location.address,
    searchPreviewText: location.searchPreviewText,
    defaultVisitText: location.defaultVisitText,
    coordinates: location.coordinates,
    tags: location.tags,
    worldVisitRules: location.worldVisitRules
  };
}

function normalizePerson(person, existingIds) {
  const nextId = String(person.id || uniqueId(slugify(person.name || "person"), existingIds, "person")).trim();
  return {
    id: nextId,
    name: String(person.name || "Unnamed person").trim(),
    aliases: normalizeStringArray(person.aliases, []),
    kind: String(person.kind || "resident").trim(),
    residenceLocationId: String(person.residenceLocationId || "").trim(),
    workLocationIds: dedupeStrings(person.workLocationIds || []),
    notes: String(person.notes || "").trim(),
    tags: dedupeStrings(person.tags || [])
  };
}

function normalizeNewspaperItem(rawItem, existingItems) {
  const existingIds = new Set((existingItems || []).map((item) => item.id));
  let nextId = String(rawItem.id || "").trim();
  if (!nextId) nextId = uniqueId(slugify(rawItem.headline || "article"), existingIds, "article");
  return {
    id: nextId,
    type: stringOr("", rawItem.type, "news"),
    headline: stringOr("", rawItem.headline, "New Article"),
    body: stringOr("", rawItem.body, ""),
    format: normalizeArticleFormat(rawItem.format, rawItem.type),
    tags: normalizeStringArray(rawItem.tags, []),
    linkedLocationIds: normalizeStringArray(rawItem.linkedLocationIds, []),
    linkedPersonIds: normalizeStringArray(rawItem.linkedPersonIds, []),
    isDirectClue: Boolean(rawItem.isDirectClue)
  };
}

function normalizeArticleFormat(rawFormat, type) {
  const next = rawFormat && typeof rawFormat === "object" ? { ...rawFormat } : {};
  return {
    headlineMode: ["standard", "inline", "hidden"].includes(next.headlineMode) ? next.headlineMode : inferDefaultHeadlineMode(type),
    underlineHeadline: Boolean(next.underlineHeadline),
    dropCap: typeof next.dropCap === "boolean" ? next.dropCap : type === "notices",
    indentFirstParagraph: typeof next.indentFirstParagraph === "boolean" ? next.indentFirstParagraph : type !== "notices"
  };
}

function inferDefaultHeadlineMode(type) {
  if (["notice", "shipping_notice", "transport_notice", "entertainment"].includes(type)) return "inline";
  if (type === "notices") return "hidden";
  return "standard";
}

function normalizeStringArray(value, fallback = []) {
  if (Array.isArray(value)) return dedupeStrings(value);
  if (value === undefined || value === null) return [...fallback];
  return dedupeStrings(String(value).split(/\n|,|\|/));
}

function dedupeStrings(values) {
  return [...new Set((values || []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function stringOr(fallback, candidate, current) {
  if (candidate === undefined || candidate === null) return current ?? fallback;
  const next = String(candidate).trim();
  return next === "" ? fallback : next;
}

function numberOr(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function categorizeLocation(location) {
  if (["railway_office", "railway_station", "cab_registry", "port_authority", "telegraph_office"].includes(location.type) || location.tags?.includes("transport")) return "transport";
  if (["police_station", "solicitor", "registry_office", "bank", "insurance_office"].includes(location.type)) return "civic_records";
  if (["hospital", "chemist_analyst", "laboratory", "scientific_institution"].includes(location.type)) return "science_medicine";
  if (["commercial_office", "warehouse", "pawnbroker", "bookmaker"].includes(location.type)) return "commerce";
  if (["private_residence", "lodging_house"].includes(location.type)) return "residences";
  if (["pub", "newspaper_office", "library", "theatre"].includes(location.type)) return "public_life";
  return "other";
}

function inferLocationSourceKind(locationId) {
  if (String(locationId || "").startsWith("osm_")) return "osm";
  return "seed";
}

function pruneEmptyPatch(patch) {
  const next = { ...patch };
  if (!next.visibility) delete next.visibility;
  if (!next.address) delete next.address;
  if (!next.searchPreviewText) delete next.searchPreviewText;
  if (!next.defaultVisitText) delete next.defaultVisitText;
  if (!next.aliases?.length) delete next.aliases;
  if (!next.tags?.length) delete next.tags;
  if (!next.worldVisitRules?.length) delete next.worldVisitRules;
  if (next.coordinates && (!Number.isFinite(next.coordinates.lat) || !Number.isFinite(next.coordinates.lng))) delete next.coordinates;
  return next;
}

function findEntityReferences(kind, id) {
  const refs = [];
  for (const person of readPeople()) {
    if (kind === "location" && (person.residenceLocationId === id || (person.workLocationIds || []).includes(id))) {
      refs.push({ kind: "person", id: person.id, label: person.name });
    }
  }
  for (const caseEntry of readCaseIndex()) {
    const caseData = adaptCaseForEditor(readCaseById(caseEntry.id));
    if (kind === "location") {
      if ((caseData.caseLocationIds || []).includes(id)) refs.push({ kind: "case_location", id: caseData.id, label: caseData.title });
      if ((caseData.startingLocationIds || []).includes(id)) refs.push({ kind: "case_start", id: caseData.id, label: caseData.title });
      if ((caseData.hiddenLocationIds || []).includes(id)) refs.push({ kind: "case_hidden", id: caseData.id, label: caseData.title });
      for (const rule of caseData.visitRules || []) {
        if (rule.locationId === id) refs.push({ kind: "visit_rule", id: rule.id, label: `${caseData.title}: ${rule.title}` });
        if ((rule.effects?.revealLocationIds || []).includes(id)) refs.push({ kind: "visit_rule_effect", id: rule.id, label: `${caseData.title}: ${rule.title}` });
      }
    }
    if (kind === "person") {
      if ((caseData.casePeopleIds || []).includes(id)) refs.push({ kind: "case_person", id: caseData.id, label: caseData.title });
    }
    const issue = readIssueById(caseData.newspaperIssueId);
    for (const item of issue.items || []) {
      if (kind === "location" && (item.linkedLocationIds || []).includes(id)) refs.push({ kind: "article", id: item.id, label: `${issue.title}: ${item.headline}` });
      if (kind === "person" && (item.linkedPersonIds || []).includes(id)) refs.push({ kind: "article", id: item.id, label: `${issue.title}: ${item.headline}` });
    }
  }
  return refs;
}

function referenceBlocked(message, references) {
  const error = new Error(message);
  error.code = "REFERENCE_BLOCKED";
  error.references = references;
  return error;
}

function httpError(status, message) {
  const error = new Error(message);
  error.code = "HTTP_ERROR";
  error.status = status;
  return error;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function uniqueId(base, existingIds, prefix) {
  let candidate = String(base || "").trim() || `${prefix}_${Date.now()}`;
  if (!/^[a-z0-9_]+$/i.test(candidate)) candidate = slugify(candidate);
  if (!candidate) candidate = `${prefix}_${Date.now()}`;
  let next = candidate;
  let suffix = 2;
  while (existingIds.has(next)) {
    next = `${candidate}_${suffix}`;
    suffix += 1;
  }
  return next;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function relativeToPublicPath(relativePath) {
  const stripped = String(relativePath || "").replace(/^\.\//, "");
  return path.join("public", stripped.replace(/^data\//, "data/"));
}

function resolveRelative(relativePath) {
  return path.join(repoRoot, relativeToPublicPath(relativePath));
}

function resolveDataMirror(relativePath) {
  const stripped = String(relativePath || "").replace(/^\.\//, "");
  if (!stripped.startsWith("data/")) return path.join("data", stripped.replace(/^public\//, ""));
  return path.join(repoRoot, stripped);
}

function removeFileIfExists(filePath) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath)) return sendJson(res, 404, { error: `Missing file: ${path.relative(repoRoot, filePath)}` });
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ({
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".json": "application/json; charset=utf-8"
  })[ext] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  fs.createReadStream(filePath).pipe(res);
}

function servePublicFile(res, pathname) {
  const publicRoot = path.join(repoRoot, "public");
  const relativePath = decodeURIComponent(pathname.replace(/^\/+/, ""));
  const filePath = path.normalize(path.join(publicRoot, relativePath));
  if (!filePath.startsWith(publicRoot + path.sep)) return sendJson(res, 403, { error: "Forbidden" });
  return serveFile(res, filePath);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"
  });
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendEmpty(res, statusCode) {
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"
  });
  res.end();
}
