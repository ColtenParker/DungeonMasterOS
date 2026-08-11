import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

import { config } from "dotenv";

config({ path: new URL("../../../.env", import.meta.url), quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const developmentDatabaseUrl = process.env.DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for integration tests");
}

if (testDatabaseUrl === developmentDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL must not match DATABASE_URL");
}

const prismaCli = fileURLToPath(
  new URL("../../../node_modules/prisma/build/index.js", import.meta.url),
);
const schema = fileURLToPath(
  new URL("../prisma/schema.prisma", import.meta.url),
);
const migration = spawnSync(
  process.execPath,
  [prismaCli, "migrate", "deploy", "--schema", schema],
  {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "inherit",
  },
);

if (migration.error) throw migration.error;
if (migration.status !== 0) process.exit(migration.status ?? 1);
