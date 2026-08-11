/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app.js";
import {
  type CampaignWorkspaceRecord,
  type CampaignWorkspaceStore,
  WorkspaceScopeValidationError,
} from "./campaign-workspace-store.js";
import type { EntryStore } from "./entry-store.js";
import type { WorldCampaignStore } from "./world-campaign-store.js";

const campaignId = "0198a5d0-3d4a-7000-8000-000000000002";
const workspaceId = "0198a5d0-3d4a-7000-8000-000000000003";
const entryId = "0198a5d0-3d4a-7000-8000-000000000004";
const timestamp = new Date("2026-08-11T23:45:00.000Z");

function workspace(
  overrides: Partial<CampaignWorkspaceRecord> = {},
): CampaignWorkspaceRecord {
  return {
    id: workspaceId,
    campaignId,
    createdAt: timestamp,
    updatedAt: timestamp,
    windows: [],
    ...overrides,
  };
}

function createStore(): CampaignWorkspaceStore {
  return {
    findWorkspace: vi.fn(async () => workspace()),
    replaceWorkspace: vi.fn(async (_campaignId, input) =>
      workspace({ windows: input.windows }),
    ),
  };
}

function app(store: CampaignWorkspaceStore) {
  return createApp({
    database: { checkConnection: vi.fn() },
    worldCampaignStore: {} as WorldCampaignStore,
    entryStore: {} as EntryStore,
    campaignWorkspaceStore: store,
  });
}

describe("Campaign workspace API", () => {
  let store: CampaignWorkspaceStore;

  beforeEach(() => {
    store = createStore();
  });

  it("returns a Campaign workspace with serialized timestamps", async () => {
    const response = await request(app(store)).get(
      `/api/campaigns/${campaignId}/workspace`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: workspaceId,
      campaignId,
      createdAt: timestamp.toISOString(),
      updatedAt: timestamp.toISOString(),
      windows: [],
    });
  });

  it("replaces a complete validated workspace snapshot", async () => {
    const window = {
      entryId,
      x: 24,
      y: 32,
      width: 720,
      height: 560,
      zOrder: 3,
      isMinimized: false,
    };
    const response = await request(app(store))
      .put(`/api/campaigns/${campaignId}/workspace`)
      .send({ windows: [window] });

    expect(response.status).toBe(200);
    expect(store.replaceWorkspace).toHaveBeenCalledWith(campaignId, {
      windows: [window],
    });
    expect(response.body.windows).toEqual([window]);
  });

  it("rejects undersized geometry and unknown fields", async () => {
    const invalidWindow = {
      entryId,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      zOrder: 0,
      isMinimized: false,
      unexpected: true,
    };
    const response = await request(app(store))
      .put(`/api/campaigns/${campaignId}/workspace`)
      .send({ windows: [invalidWindow] });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.fields).toHaveProperty("windows.0.width");
    expect(store.replaceWorkspace).not.toHaveBeenCalled();
  });

  it("rejects duplicate Entry windows", async () => {
    const validWindow = {
      entryId,
      x: 0,
      y: 0,
      width: 640,
      height: 480,
      zOrder: 1,
      isMinimized: false,
    };
    const response = await request(app(store))
      .put(`/api/campaigns/${campaignId}/workspace`)
      .send({ windows: [validWindow, validWindow] });

    expect(response.status).toBe(400);
    expect(response.body.error.fields).toHaveProperty("windows.1.entryId");
    expect(store.replaceWorkspace).not.toHaveBeenCalled();
  });

  it("returns 404 when the Campaign workspace does not exist", async () => {
    vi.mocked(store.findWorkspace).mockResolvedValue(null);
    vi.mocked(store.replaceWorkspace).mockResolvedValue(null);

    await request(app(store))
      .get(`/api/campaigns/${campaignId}/workspace`)
      .expect(404);
    await request(app(store))
      .put(`/api/campaigns/${campaignId}/workspace`)
      .send({ windows: [] })
      .expect(404);
  });

  it("maps invalid Entry scope to an actionable response", async () => {
    vi.mocked(store.replaceWorkspace).mockRejectedValue(
      new WorkspaceScopeValidationError(
        "One or more Entry windows are outside the Campaign workspace scope.",
      ),
    );

    const response = await request(app(store))
      .put(`/api/campaigns/${campaignId}/workspace`)
      .send({
        windows: [
          {
            entryId,
            x: 0,
            y: 0,
            width: 640,
            height: 480,
            zOrder: 1,
            isMinimized: false,
          },
        ],
      });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("INVALID_WORKSPACE_ENTRY");
  });
});
