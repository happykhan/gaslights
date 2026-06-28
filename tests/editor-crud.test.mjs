import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const serverScript = path.join(repoRoot, "scripts/location-editor-server.mjs");

test("world places API supports create, rename, update, and delete", async () => {
  await withEditorServer(async ({ baseUrl }) => {
    const created = await requestJson(baseUrl, "POST", "/api/locations", {
      location: {
        name: "Codex CRUD Station",
        type: "railway_station",
        address: "Waterloo Road",
        coordinates: { lat: 51.5033, lng: -0.1136 },
        searchPreviewText: "A busy railway terminus south of the Thames.",
        defaultVisitText: "Porters and passengers move through the station concourse."
      }
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.id, "codex_crud_station");
    assert.equal(created.body.visibility, "public");
    assert.deepEqual(created.body.coordinates, { lat: 51.5033, lng: -0.1136 });

    const renamed = await requestJson(baseUrl, "PATCH", `/api/locations/${created.body.id}`, {
      location: {
        ...created.body,
        id: "codex_crud_station_authoring_test",
        name: "Codex CRUD Station",
        defaultVisitText: "The station clerk checks the latest arrival boards."
      }
    });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.id, "codex_crud_station_authoring_test");
    assert.equal(renamed.body.defaultVisitText, "The station clerk checks the latest arrival boards.");

    const moved = await requestJson(baseUrl, "PATCH", `/api/locations/${renamed.body.id}`, {
      location: {
        ...renamed.body,
        lat: "51.5101",
        lng: "-0.1202"
      }
    });
    assert.equal(moved.status, 200);
    assert.deepEqual(moved.body.coordinates, { lat: 51.5101, lng: -0.1202 });

    const staleUpdate = await requestJson(baseUrl, "PATCH", `/api/locations/${created.body.id}`, {
      location: { id: created.body.id, name: "Stale location" }
    });
    assert.equal(staleUpdate.status, 404);
    assert.match(staleUpdate.body.error, /Unknown location id/);

    const bootstrap = await requestJson(baseUrl, "GET", "/api/editor/bootstrap");
    assert.equal(bootstrap.status, 200);
    assert.equal(bootstrap.body.locations.some((item) => item.id === "codex_crud_station_authoring_test"), true);
    assert.equal(bootstrap.body.locations.some((item) => item.id === created.body.id), false);

    const deleted = await requestJson(baseUrl, "DELETE", "/api/locations/codex_crud_station_authoring_test");
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.deletedId, "codex_crud_station_authoring_test");
  });
});

test("world place create generates unique ids when a requested id already exists", async () => {
  await withEditorServer(async ({ baseUrl }) => {
    const first = await requestJson(baseUrl, "POST", "/api/locations", {
      location: { id: "duplicate_place", name: "Duplicate Place", type: "other" }
    });
    const second = await requestJson(baseUrl, "POST", "/api/locations", {
      location: { id: "duplicate_place", name: "Duplicate Place", type: "other" }
    });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(first.body.id, "duplicate_place");
    assert.equal(second.body.id, "duplicate_place_2");
  });
});

test("world place rename to an existing id returns a conflict", async () => {
  await withEditorServer(async ({ baseUrl }) => {
    const first = await requestJson(baseUrl, "POST", "/api/locations", {
      location: { id: "rename_conflict_a", name: "Rename Conflict A", type: "other" }
    });
    const second = await requestJson(baseUrl, "POST", "/api/locations", {
      location: { id: "rename_conflict_b", name: "Rename Conflict B", type: "other" }
    });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    const conflict = await requestJson(baseUrl, "PATCH", `/api/locations/${second.body.id}`, {
      location: { ...second.body, id: first.body.id }
    });
    assert.equal(conflict.status, 409);
    assert.match(conflict.body.error, /Location id already exists/);
  });
});

test("world people API supports create, rename, location links, and delete", async () => {
  await withEditorServer(async ({ baseUrl }) => {
    const residence = await requestJson(baseUrl, "POST", "/api/locations", {
      location: { name: "CRUD Residence", type: "private_residence", address: "1 Test Street" }
    });
    const work = await requestJson(baseUrl, "POST", "/api/locations", {
      location: { name: "CRUD Workshop", type: "commercial_office", address: "2 Test Street" }
    });

    const created = await requestJson(baseUrl, "POST", "/api/people", {
      person: {
        name: "Ada CRUD",
        kind: "resident",
        notes: "Temporary CRUD test person."
      }
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.person.id, "ada_crud");

    const renamed = await requestJson(baseUrl, "PATCH", `/api/people/${created.body.person.id}`, {
      person: {
        ...created.body.person,
        id: "ada_crud_renamed",
        residenceLocationId: residence.body.id,
        workLocationIds: [work.body.id],
        tags: ["crud_test"]
      }
    });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.person.id, "ada_crud_renamed");
    assert.equal(renamed.body.person.residenceLocationId, residence.body.id);
    assert.deepEqual(renamed.body.person.workLocationIds, [work.body.id]);

    const staleUpdate = await requestJson(baseUrl, "PATCH", `/api/people/${created.body.person.id}`, {
      person: { id: created.body.person.id, name: "Stale person" }
    });
    assert.equal(staleUpdate.status, 404);
    assert.match(staleUpdate.body.error, /Unknown person id/);

    const deleted = await requestJson(baseUrl, "DELETE", "/api/people/ada_crud_renamed");
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.deletedId, "ada_crud_renamed");

    assert.equal((await requestJson(baseUrl, "DELETE", `/api/locations/${residence.body.id}`)).status, 200);
    assert.equal((await requestJson(baseUrl, "DELETE", `/api/locations/${work.body.id}`)).status, 200);
  });
});

async function withEditorServer(callback) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gaslights-editor-crud-"));
  fs.mkdirSync(path.join(tmpDir, "public"), { recursive: true });
  fs.cpSync(path.join(repoRoot, "public/data"), path.join(tmpDir, "public/data"), { recursive: true });
  fs.cpSync(path.join(repoRoot, "data"), path.join(tmpDir, "data"), { recursive: true });

  const port = await getFreePort();
  const child = spawn(process.execPath, [serverScript, "--port", String(port)], {
    cwd: tmpDir,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForServer(child, port, stderr);
    await callback({ baseUrl: `http://127.0.0.1:${port}`, tmpDir });
  } finally {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function waitForServer(child, port, stderr) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Editor server did not start on ${port}. ${stderr}`)), 5000);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Editor server exited before startup with code ${code}. ${stderr}`));
    });
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Editor listening")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function requestJson(baseUrl, method, pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  return {
    status: response.status,
    body: await response.json()
  };
}
