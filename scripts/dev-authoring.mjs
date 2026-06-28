#!/usr/bin/env node
import net from "node:net";
import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;

await main();

async function main() {
  const appInUse = await isPortInUse(3000, "127.0.0.1");
  const editorInUse = await isPortInUse(4179, "127.0.0.1");

  if (appInUse) {
    console.log("App port 3000 already in use; reusing existing app server.");
  } else {
    startProcess("app", "npx", ["--yes", "serve", "public", "-l", "3000"]);
  }

  if (editorInUse) {
    console.log("Editor port 4179 already in use; reusing existing editor server.");
  } else {
    startProcess("editor", "node", ["scripts/location-editor-server.mjs"]);
  }

  console.log("Gaslights authoring dev");
  console.log("App:    http://localhost:3000/");
  console.log("Editor: http://localhost:4179/editor/");

  if (!children.length) {
    console.log("Nothing started because both services already appear to be running.");
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function startProcess(label, command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: false
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`${label} exited unexpectedly (${signal || code})`);
    shutdown();
  });
  children.push(child);
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) child.kill("SIGKILL");
    }
    process.exit(0);
  }, 500);
}

function isPortInUse(port, host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}
