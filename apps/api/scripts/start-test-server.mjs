import { spawn, spawnSync } from "node:child_process";
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
const tsxCli = fileURLToPath(
  new URL("../../../node_modules/tsx/dist/cli.mjs", import.meta.url),
);
const schema = fileURLToPath(
  new URL("../prisma/schema.prisma", import.meta.url),
);
const environment = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  PORT: "3000",
};

const migration = spawnSync(
  process.execPath,
  [prismaCli, "migrate", "deploy", "--schema", schema],
  { env: environment, stdio: "inherit" },
);
if (migration.error) throw migration.error;
if (migration.status !== 0) process.exit(migration.status ?? 1);

const server = spawn(process.execPath, [tsxCli, "src/server.ts"], {
  cwd: apiDirectory,
  env: environment,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("error", (error) => {
  throw error;
});
server.on("exit", (code) => process.exit(code ?? 0));
