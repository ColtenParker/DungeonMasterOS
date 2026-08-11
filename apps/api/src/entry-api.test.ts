/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import type { EntryType } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app.js";
import { EMPTY_ENTRY_DOCUMENT } from "./entry-document.js";
import type { EntryRecord, EntryStore } from "./entry-store.js";
import type {
  CampaignRecord,
  WorldCampaignStore,
  WorldRecord,
} from "./world-campaign-store.js";

const worldId = "0198a5d0-3d4a-7000-8000-000000000001";
const campaignId = "0198a5d0-3d4a-7000-8000-000000000002";
const entryId = "0198a5d0-3d4a-7000-8000-000000000003";
const timestamp = new Date("2026-08-11T19:00:00.000Z");

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
    ...world(),
    id: campaignId,
    worldId,
    name: "The Broken Crown",
    ...overrides,
  };
}

function entry(
  overrides: Partial<EntryRecord> & { type?: EntryType } = {},
): EntryRecord {
  return {
    id: entryId,
    type: "NPC",
    title: "Mira Vale",
    document: EMPTY_ENTRY_DOCUMENT,
    documentVersion: 1,
    documentText: "",
    worldId,
    campaignId: null,
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function stores() {
  const worldCampaignStore: WorldCampaignStore = {
    createWorld: vi.fn(),
    listWorlds: vi.fn(),
    findWorld: vi.fn(async () => world()),
    updateWorld: vi.fn(),
    createCampaign: vi.fn(),
    listCampaigns: vi.fn(),
    findCampaign: vi.fn(async () => campaign()),
    updateCampaign: vi.fn(),
  };
  const entryStore: EntryStore = {
    createEntry: vi.fn(async (scope, input) =>
      entry({
        ...input,
        worldId: scope.kind === "world" ? scope.worldId : null,
        campaignId: scope.kind === "campaign" ? scope.campaignId : null,
      }),
    ),
    listWorldEntries: vi.fn(async () => [entry()]),
    listCampaignEntries: vi.fn(async () => [entry()]),
    findEntry: vi.fn(async () => entry()),
    updateEntry: vi.fn(async (_id, input) => entry(input)),
  };
  return { worldCampaignStore, entryStore };
}

function app(worldCampaignStore: WorldCampaignStore, entryStore: EntryStore) {
  return createApp({
    database: { checkConnection: vi.fn() },
    worldCampaignStore,
    entryStore,
  });
}

describe("Entry API", () => {
  let worldCampaignStore: WorldCampaignStore;
  let entryStore: EntryStore;

  beforeEach(() => {
    ({ worldCampaignStore, entryStore } = stores());
  });

  it("creates a World Entry with an empty versioned document by default", async () => {
    const response = await request(app(worldCampaignStore, entryStore))
      .post(`/api/worlds/${worldId}/entries`)
      .send({ type: "NPC", title: "  Mira Vale  " });

    expect(response.status).toBe(201);
    expect(entryStore.createEntry).toHaveBeenCalledWith(
      { kind: "world", worldId },
      {
        type: "NPC",
        title: "Mira Vale",
        document: EMPTY_ENTRY_DOCUMENT,
        documentVersion: 2,
        documentText: "",
        inlineTargetIds: [],
      },
    );
    expect(response.body.scope).toEqual({ kind: "world", id: worldId });
  });

  it("defaults Campaign creation to Campaign scope and allows a World override", async () => {
    await request(app(worldCampaignStore, entryStore))
      .post(`/api/campaigns/${campaignId}/entries`)
      .send({ type: "JOURNAL", title: "Private notes" })
      .expect(201);
    await request(app(worldCampaignStore, entryStore))
      .post(`/api/campaigns/${campaignId}/entries`)
      .send({ type: "LOCATION", title: "Shared city", scope: "world" })
      .expect(201);

    expect(entryStore.createEntry).toHaveBeenNthCalledWith(
      1,
      { kind: "campaign", campaignId },
      expect.objectContaining({ title: "Private notes" }),
    );
    expect(entryStore.createEntry).toHaveBeenNthCalledWith(
      2,
      { kind: "world", worldId },
      expect.objectContaining({ title: "Shared city" }),
    );
  });

  it("lists Campaign and inherited World Entries with filters", async () => {
    await request(app(worldCampaignStore, entryStore))
      .get(`/api/campaigns/${campaignId}/entries?type=NPC&archive=all`)
      .expect(200);

    expect(entryStore.listCampaignEntries).toHaveBeenCalledWith(
      campaignId,
      worldId,
      { type: "NPC", archive: "all" },
    );
  });

  it("blocks creation and active browsing beneath archived parents", async () => {
    vi.mocked(worldCampaignStore.findWorld).mockResolvedValue(
      world({ isArchived: true }),
    );

    const createResponse = await request(app(worldCampaignStore, entryStore))
      .post(`/api/campaigns/${campaignId}/entries`)
      .send({ type: "NPC", title: "Hidden" });
    const listResponse = await request(app(worldCampaignStore, entryStore)).get(
      `/api/campaigns/${campaignId}/entries`,
    );

    expect(createResponse.status).toBe(409);
    expect(createResponse.body.error.code).toBe("WORLD_ARCHIVED");
    expect(listResponse.body).toEqual({ items: [] });
    expect(entryStore.listCampaignEntries).not.toHaveBeenCalled();
  });

  it("blocks creation beneath an archived Campaign", async () => {
    vi.mocked(worldCampaignStore.findCampaign).mockResolvedValue(
      campaign({ isArchived: true }),
    );
    const response = await request(app(worldCampaignStore, entryStore))
      .post(`/api/campaigns/${campaignId}/entries`)
      .send({ type: "NPC", title: "Hidden" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CAMPAIGN_ARCHIVED");
  });

  it("retrieves and updates an Entry without changing its scope", async () => {
    await request(app(worldCampaignStore, entryStore))
      .get(`/api/entries/${entryId}`)
      .expect(200);
    await request(app(worldCampaignStore, entryStore))
      .patch(`/api/entries/${entryId}`)
      .send({ title: "Mira Revised", isArchived: true })
      .expect(200);

    expect(entryStore.updateEntry).toHaveBeenCalledWith(entryId, {
      title: "Mira Revised",
      isArchived: true,
    });
    expect(worldCampaignStore.findWorld).not.toHaveBeenCalled();
  });

  it("validates document nodes, marks, and nesting", async () => {
    for (const document of [
      { type: "doc", content: [{ type: "image" }] },
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "x", marks: [{ type: "link" }] }],
          },
        ],
      },
      {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "paragraph" }] }],
      },
    ]) {
      const response = await request(app(worldCampaignStore, entryStore))
        .post(`/api/worlds/${worldId}/entries`)
        .send({ type: "NPC", title: "Invalid", document });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.fields).toHaveProperty("document");
    }
    expect(entryStore.createEntry).not.toHaveBeenCalled();
  });

  it("derives document text and inline dependencies when saving version 2 content", async () => {
    const targetEntryId = "0198a5d0-3d4a-7000-8000-000000000004";
    const document = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "North Gate",
              marks: [{ type: "entryLink", attrs: { entryId: targetEntryId } }],
            },
          ],
        },
      ],
    };

    await request(app(worldCampaignStore, entryStore))
      .patch(`/api/entries/${entryId}`)
      .send({ document })
      .expect(200);

    expect(entryStore.updateEntry).toHaveBeenCalledWith(entryId, {
      document,
      documentVersion: 2,
      documentText: "North Gate",
      inlineTargetIds: [targetEntryId],
    });
  });

  it("rejects document content over 1 MiB", async () => {
    const response = await request(app(worldCampaignStore, entryStore))
      .post(`/api/worlds/${worldId}/entries`)
      .send({
        type: "JOURNAL",
        title: "Too long",
        document: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "x".repeat(1024 * 1024) }],
            },
          ],
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error.fields.document[0]).toContain("1 MiB");
  });

  it("returns a controlled error when the complete request exceeds the transport limit", async () => {
    const response = await request(app(worldCampaignStore, entryStore))
      .post(`/api/worlds/${worldId}/entries`)
      .send({ padding: "x".repeat(1200 * 1024) });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});
