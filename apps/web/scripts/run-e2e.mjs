import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, URL } from "node:url";

import { config } from "dotenv";

const webDirectory = fileURLToPath(new URL("..", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const apiDirectory = path.join(repositoryRoot, "apps", "api");
config({ path: path.join(repositoryRoot, ".env"), quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is required");
if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must not match DATABASE_URL");
}

const nodeModules = path.join(repositoryRoot, "node_modules");
const prismaCli = path.join(nodeModules, "prisma", "build", "index.js");
const tscCli = path.join(nodeModules, "typescript", "bin", "tsc");
const viteCli = path.join(nodeModules, "vite", "bin", "vite.js");
const playwrightCli = path.join(nodeModules, "@playwright", "test", "cli.js");
const mediaRoot = mkdtempSync(path.join(tmpdir(), "dmos-e2e-media-"));
const environment = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  MEDIA_ROOT: mediaRoot,
  PORT: "3000",
};
const children = [];

function checked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    ...options,
    env: environment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    ...options,
    env: environment,
    stdio: "inherit",
  });
  children.push(child);
  return child;
}

async function waitFor(url, child) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited before ${url} became ready.`);
    }
    try {
      const response = await globalThis.fetch(url);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

function stop(child) {
  if (!child.pid || child.exitCode !== null) return;
  child.kill("SIGTERM");
  child.unref();
}

try {
  checked(process.execPath, [
    prismaCli,
    "migrate",
    "deploy",
    "--schema",
    path.join(apiDirectory, "prisma", "schema.prisma"),
  ]);
  checked(process.execPath, [tscCli, "-p", "tsconfig.build.json"], {
    cwd: apiDirectory,
  });

  const api = start(process.execPath, ["dist/server.js"], {
    cwd: apiDirectory,
  });
  await waitFor("http://127.0.0.1:3000/api/health/live", api);

  const web = start(
    process.execPath,
    [viteCli, "--host", "127.0.0.1", "--port", "5173"],
    { cwd: webDirectory },
  );
  await waitFor("http://127.0.0.1:5173", web);

  checked(process.execPath, [playwrightCli, "test"], { cwd: webDirectory });
} finally {
  for (const child of children.reverse()) stop(child);
  rmSync(mediaRoot, { recursive: true, force: true });
}
