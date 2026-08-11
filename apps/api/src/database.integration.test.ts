import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import type { WorldCampaignStore } from "./world-campaign-store.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const developmentDatabaseUrl = process.env.DATABASE_URL;

if (testDatabaseUrl && testDatabaseUrl === developmentDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL must not match DATABASE_URL");
}

const database = testDatabaseUrl
  ? new PrismaClient({ datasourceUrl: testDatabaseUrl })
  : undefined;

describe.skipIf(!database)("PostgreSQL readiness integration", () => {
  afterAll(async () => {
    await database?.$disconnect();
  });

  it("travels through Express and Prisma to the dedicated test database", async () => {
    const app = createApp({
      database: {
        async checkConnection() {
          if (!database) {
            throw new Error("TEST_DATABASE_URL is required");
          }

          await database.$queryRaw`SELECT 1`;
        },
      },
      worldCampaignStore: {} as WorldCampaignStore,
    });

    const response = await request(app).get("/api/health/ready");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ready" });
  });
});
