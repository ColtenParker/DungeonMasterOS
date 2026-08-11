import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run e2e:server --workspace @dmos/api",
      cwd: repositoryRoot,
      port: 3000,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npm run dev --workspace @dmos/web -- --host 127.0.0.1",
      cwd: repositoryRoot,
      port: 5173,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
