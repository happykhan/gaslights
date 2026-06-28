#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { URL } from "node:url";

const args = process.argv.slice(2);
const options = {
  queue: "data/raw/gb1900-london-1895-six-inch.poi-review-queue.json",
  port: 4178,
  host: "127.0.0.1"
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--queue") {
    options.queue = args[++i];
  } else if (arg === "--port") {
    options.port = Number(args[++i]);
  } else if (arg === "--host") {
    options.host = args[++i];
  } else if (arg === "--help" || arg === "-h") {
    usage(0);
  } else {
    console.error(`Unknown option: ${arg}`);
    usage(1);
  }
}

if (!Number.isInteger(options.port) || options.port < 1) {
  throw new Error("--port must be a positive integer");
}

const repoRoot = process.cwd();
const queuePath = path.join(repoRoot, options.queue);
const server = http.createServer(handleRequest);

server.listen(options.port, options.host, () => {
  console.log(`POI review server listening on http://${options.host}:${options.port}`);
});

async function handleRequest(req, res) {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = requestUrl.pathname;

    if (req.method === "GET" && pathname === "/api/pois") {
      return sendJson(res, 200, buildPoiList(requestUrl.searchParams));
    }

    if (req.method === "POST" && pathname.startsWith("/api/pois/")) {
      const poiId = decodeURIComponent(pathname.split("/").pop());
      const body = await readJsonBody(req);
      const updated = applyPoiUpdate(poiId, body);
      return sendJson(res, 200, updated);
    }

    if (req.method === "GET" && pathname === "/api/map-sources") {
      return sendJson(res, 200, JSON.parse(fs.readFileSync(path.join(repoRoot, "public/data/map-sources.json"), "utf8")));
    }

    if (req.method === "GET" && pathname === "/") {
      return serveFile(res, path.join(repoRoot, "public", "poi-review.html"));
    }

    if (req.method === "GET" && pathname === "/assets/poi-review.js") {
      return serveFile(res, path.join(repoRoot, "public", "assets", "poi-review.js"));
    }

    if (req.method === "GET" && pathname === "/assets/poi-review.css") {
      return serveFile(res, path.join(repoRoot, "public", "assets", "poi-review.css"));
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: error.message || "Server error" });
  }
}

function usage(exitCode) {
  console.error(`Usage:
  node scripts/poi-review-server.mjs [options]

Options:
  --queue <path>        Review queue JSON. Default: ${options.queue}
  --port <n>            Listen port. Default: ${options.port}
  --host <host>         Listen host. Default: ${options.host}
`);
  process.exit(exitCode);
}

function buildPoiList(searchParams) {
  const items = readQueue();
  const onlyNeedsReview = searchParams.get("onlyNeedsReview") !== "false";
  const query = (searchParams.get("q") || "").trim().toLowerCase();

  return items.filter((item) => {
    if (onlyNeedsReview && ["accepted", "rejected"].includes(item.reviewStatus)) return false;
    if (!query) return true;
    return [
      item.name,
      item.canonicalName,
      item.typeGuess,
      item.confirmedType,
      item.reviewStatus,
      item.notes,
      item.osmHint?.displayName
    ].filter(Boolean).join(" ").toLowerCase().includes(query);
  });
}

function readQueue() {
  return JSON.parse(fs.readFileSync(queuePath, "utf8"));
}

function applyPoiUpdate(poiId, body) {
  const items = readQueue();
  const index = items.findIndex((item) => item.id === poiId);
  if (index === -1) throw new Error(`Unknown POI id: ${poiId}`);

  const current = items[index];
  const next = {
    ...current,
    reviewStatus: parseReviewStatus(body.reviewStatus ?? current.reviewStatus),
    canonicalName: String(body.canonicalName ?? current.canonicalName ?? "").trim(),
    confirmedType: String(body.confirmedType ?? current.confirmedType ?? "").trim(),
    defaultVisitText: String(body.defaultVisitText ?? current.defaultVisitText ?? "").trim(),
    notes: String(body.notes ?? current.notes ?? "").trim(),
    tags: normalizeStringArray(body.tags ?? current.tags)
  };

  items[index] = next;
  fs.writeFileSync(queuePath, `${JSON.stringify(items, null, 2)}\n`);
  return next;
}

function parseReviewStatus(value) {
  const normalized = String(value || "").trim();
  const allowed = new Set(["candidate", "accepted", "rejected", "needs_research"]);
  if (!allowed.has(normalized)) throw new Error(`Invalid reviewStatus: ${normalized}`);
  return normalized;
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    return sendJson(res, 404, { error: `Missing file: ${path.relative(repoRoot, filePath)}` });
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ({
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
  })[ext] || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  fs.createReadStream(filePath).pipe(res);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(`${JSON.stringify(payload)}\n`);
}
