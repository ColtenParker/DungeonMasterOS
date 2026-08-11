import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "./app.js";
import type { DatabaseHealth } from "./database.js";
import type { WorldCampaignStore } from "./world-campaign-store.js";

const worldCampaignStore = {} as WorldCampaignStore;

describe("health endpoints", () => {
  it("reports liveness without querying the database", async () => {
    const database: DatabaseHealth = { checkConnection: vi.fn() };
    const response = await request(
      createApp({ database, worldCampaignStore }),
    ).get("/api/health/live");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(database.checkConnection).not.toHaveBeenCalled();
  });

  it("reports readiness when PostgreSQL responds", async () => {
    const database: DatabaseHealth = {
      checkConnection: vi.fn().mockResolvedValue(undefined),
    };
    const response = await request(
      createApp({ database, worldCampaignStore }),
    ).get("/api/health/ready");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ready" });
  });

  it("returns a sanitized response when PostgreSQL is unavailable", async () => {
    const database: DatabaseHealth = {
      checkConnection: vi
        .fn()
        .mockRejectedValue(new Error("secret database details")),
    };
    const response = await request(
      createApp({ database, worldCampaignStore }),
    ).get("/api/health/ready");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "unavailable" });
    expect(response.text).not.toContain("secret database details");
  });
});
