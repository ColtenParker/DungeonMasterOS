import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import type { EntryStore } from "./entry-store.js";
import { createDedicatedTestDatabase } from "./test-database.js";
import type { WorldCampaignStore } from "./world-campaign-store.js";

const database = createDedicatedTestDatabase();

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
      entryStore: {} as EntryStore,
    });

    const response = await request(app).get("/api/health/ready");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ready" });
  });
});
