/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app.js";
import type { EntryStore } from "./entry-store.js";
import type {
  CampaignRecord,
  WorldCampaignStore,
  WorldRecord,
} from "./world-campaign-store.js";

const worldId = "0198a5d0-3d4a-7000-8000-000000000001";
const campaignId = "0198a5d0-3d4a-7000-8000-000000000002";
const timestamp = new Date("2026-08-11T16:00:00.000Z");

function world(overrides: Partial<WorldRecord> = {}): WorldRecord {
  return {
    id: worldId,
    name: "Eldoria",
    description: null,
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function campaign(overrides: Partial<CampaignRecord> = {}): CampaignRecord {
  return {
    id: campaignId,
    worldId,
    name: "The Broken Crown",
    description: null,
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function createStore(): WorldCampaignStore {
  return {
    createWorld: vi.fn(async (input) => world(input)),
    listWorlds: vi.fn(async () => [world()]),
    findWorld: vi.fn(async () => world()),
    updateWorld: vi.fn(async (_id, input) => world(input)),
    createCampaign: vi.fn(async (_worldId, input) => campaign(input)),
    listCampaigns: vi.fn(async () => [campaign()]),
    findCampaign: vi.fn(async () => campaign()),
    updateCampaign: vi.fn(async (_id, input) => campaign(input)),
  };
}

function app(store: WorldCampaignStore) {
  return createApp({
    database: { checkConnection: vi.fn() },
    worldCampaignStore: store,
    entryStore: {} as EntryStore,
  });
}

describe("World and Campaign API", () => {
  let store: WorldCampaignStore;

  beforeEach(() => {
    store = createStore();
  });

  it("creates a World from trimmed validated input", async () => {
    const response = await request(app(store))
      .post("/api/worlds")
      .send({ name: "  Eldoria  ", description: "A shared setting" });

    expect(response.status).toBe(201);
    expect(store.createWorld).toHaveBeenCalledWith({
      name: "Eldoria",
      description: "A shared setting",
    });
    expect(response.body).toMatchObject({ id: worldId, name: "Eldoria" });
    expect(response.body.createdAt).toBe(timestamp.toISOString());
  });

  it("returns field errors for invalid and unknown input", async () => {
    const response = await request(app(store))
      .post("/api/worlds")
      .send({ name: " ", unexpected: true });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
    });
    expect(response.body.error.fields).toHaveProperty("name");
    expect(response.body.error.fields).toHaveProperty("request");
  });

  it("uses the documented name and description limits", async () => {
    const response = await request(app(store))
      .post("/api/worlds")
      .send({ name: "x".repeat(121), description: "x".repeat(5001) });

    expect(response.status).toBe(400);
    expect(response.body.error.fields).toHaveProperty("name");
    expect(response.body.error.fields).toHaveProperty("description");
  });

  it("returns a sanitized malformed JSON error", async () => {
    const response = await request(app(store))
      .post("/api/worlds")
      .set("Content-Type", "application/json")
      .send('{"name":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "MALFORMED_JSON",
        message: "The request body is not valid JSON.",
      },
    });
  });

  it("lists active Worlds by default and passes explicit archive filters", async () => {
    await request(app(store)).get("/api/worlds").expect(200);
    await request(app(store)).get("/api/worlds?archive=all").expect(200);

    expect(store.listWorlds).toHaveBeenNthCalledWith(1, "active");
    expect(store.listWorlds).toHaveBeenNthCalledWith(2, "all");
  });

  it("retrieves, edits, archives, and restores a World", async () => {
    await request(app(store)).get(`/api/worlds/${worldId}`).expect(200);
    await request(app(store))
      .patch(`/api/worlds/${worldId}`)
      .send({ name: "New name" })
      .expect(200);
    await request(app(store))
      .patch(`/api/worlds/${worldId}`)
      .send({ isArchived: true })
      .expect(200);
    await request(app(store))
      .patch(`/api/worlds/${worldId}`)
      .send({ isArchived: false })
      .expect(200);

    expect(store.updateWorld).toHaveBeenNthCalledWith(2, worldId, {
      isArchived: true,
    });
    expect(store.updateWorld).toHaveBeenNthCalledWith(3, worldId, {
      isArchived: false,
    });
  });

  it("returns 404 for a missing World", async () => {
    vi.mocked(store.findWorld).mockResolvedValueOnce(null);
    const response = await request(app(store)).get(`/api/worlds/${worldId}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORLD_NOT_FOUND");
  });

  it("creates and lists Campaigns within an active World", async () => {
    await request(app(store))
      .post(`/api/worlds/${worldId}/campaigns`)
      .send({ name: "The Broken Crown" })
      .expect(201);
    await request(app(store))
      .get(`/api/worlds/${worldId}/campaigns`)
      .expect(200);

    expect(store.createCampaign).toHaveBeenCalledWith(worldId, {
      name: "The Broken Crown",
    });
    expect(store.listCampaigns).toHaveBeenCalledWith(worldId, "active");
  });

  it("blocks Campaign creation and active navigation under an archived World", async () => {
    vi.mocked(store.findWorld).mockResolvedValue(world({ isArchived: true }));

    const createResponse = await request(app(store))
      .post(`/api/worlds/${worldId}/campaigns`)
      .send({ name: "Hidden Campaign" });
    const listResponse = await request(app(store)).get(
      `/api/worlds/${worldId}/campaigns`,
    );

    expect(createResponse.status).toBe(409);
    expect(createResponse.body.error.code).toBe("WORLD_ARCHIVED");
    expect(listResponse.body).toEqual({ items: [] });
    expect(store.createCampaign).not.toHaveBeenCalled();
    expect(store.listCampaigns).not.toHaveBeenCalled();
  });

  it("allows explicit archived navigation beneath an archived World", async () => {
    vi.mocked(store.findWorld).mockResolvedValue(world({ isArchived: true }));

    await request(app(store))
      .get(`/api/worlds/${worldId}/campaigns?archive=all`)
      .expect(200);

    expect(store.listCampaigns).toHaveBeenCalledWith(worldId, "all");
  });

  it("directly retrieves and edits a Campaign regardless of parent archive state", async () => {
    await request(app(store)).get(`/api/campaigns/${campaignId}`).expect(200);
    await request(app(store))
      .patch(`/api/campaigns/${campaignId}`)
      .send({ description: "Updated", isArchived: true })
      .expect(200);

    expect(store.updateCampaign).toHaveBeenCalledWith(campaignId, {
      description: "Updated",
      isArchived: true,
    });
    expect(store.findWorld).not.toHaveBeenCalled();
  });

  it("sanitizes unexpected errors", async () => {
    vi.mocked(store.listWorlds).mockRejectedValue(
      new Error("secret database details"),
    );
    const response = await request(app(store)).get("/api/worlds");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    });
    expect(response.text).not.toContain("secret database details");
  });
});
