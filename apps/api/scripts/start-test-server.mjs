import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

import { config } from "dotenv";

config({ path: new URL("../../../.env", import.meta.url), quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const developmentDatabaseUrl = process.env.DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for browser tests");
}
if (testDatabaseUrl === developmentDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL must not match DATABASE_URL");
}

const apiDirectory = fileURLToPath(new URL("..", import.meta.url));
const prismaCli = fileURLToPath(
  new URL("../../../node_modules/prisma/build/index.js", import.meta.url),
);
const tscCli = fileURLToPath(
  new URL("../../../node_modules/typescript/bin/tsc", import.meta.url),
);
const schema = fileURLToPath(
  new URL("../prisma/schema.prisma", import.meta.url),
);
const testMediaRoot = mkdtempSync(path.join(tmpdir(), "dmos-e2e-media-"));
const environment = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  PORT: "3000",
  MEDIA_ROOT: testMediaRoot,
};

const migration = spawnSync(
  process.execPath,
  [prismaCli, "migrate", "deploy", "--schema", schema],
  { env: environment, stdio: "inherit" },
);
if (migration.error) throw migration.error;
if (migration.status !== 0) process.exit(migration.status ?? 1);

const build = spawnSync(
  process.execPath,
  [tscCli, "-p", "tsconfig.build.json"],
  {
    cwd: apiDirectory,
    env: environment,
    stdio: "inherit",
  },
);
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

process.on("exit", () => {
  rmSync(testMediaRoot, { recursive: true, force: true });
});
Object.assign(process.env, environment);
await import(new URL("../dist/server.js", import.meta.url));
