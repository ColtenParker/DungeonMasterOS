/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app.js";
import type {
  EntryKnowledgeStore,
  RelationshipRecord,
  SearchResult,
  TagRecord,
} from "./entry-knowledge-store.js";
import {
  EntryReferenceValidationError,
  type EntryRecord,
  type EntryStore,
} from "./entry-store.js";
import type {
  CampaignRecord,
  WorldCampaignStore,
  WorldRecord,
} from "./world-campaign-store.js";

const worldId = "0198a5d0-3d4a-7000-8000-000000000001";
const campaignId = "0198a5d0-3d4a-7000-8000-000000000002";
const sourceId = "0198a5d0-3d4a-7000-8000-000000000003";
const targetId = "0198a5d0-3d4a-7000-8000-000000000004";
const relationshipId = "0198a5d0-3d4a-7000-8000-000000000005";
const tagId = "0198a5d0-3d4a-7000-8000-000000000006";
const timestamp = new Date("2026-08-11T23:00:00.000Z");

function world(): WorldRecord {
  return {
    id: worldId,
    name: "Eldoria",
    description: null,
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function campaign(): CampaignRecord {
  return { ...world(), id: campaignId, worldId, name: "Broken Crown" };
}

function entry(id = sourceId, title = "Mira Vale"): EntryRecord {
  return {
    id,
    type: "NPC",
    title,
    document: { type: "doc", content: [{ type: "paragraph" }] },
    documentVersion: 2,
    documentText: "",
    worldId,
    campaignId: null,
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function relationship(): RelationshipRecord {
  return {
    id: relationshipId,
    sourceEntryId: sourceId,
    targetEntryId: targetId,
    contextNote: "Keeps watch",
    createdAt: timestamp,
    updatedAt: timestamp,
    source: entry(sourceId),
    target: entry(targetId, "North Gate"),
  };
}

function tag(): TagRecord {
  return { id: tagId, worldId, name: "Villain" };
}

function stores() {
  const entryStore: EntryStore = {
    createEntry: vi.fn(),
    listWorldEntries: vi.fn(),
    listCampaignEntries: vi.fn(),
    findEntry: vi.fn(async () => entry()),
    updateEntry: vi.fn(),
  };
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
  const searchResult: SearchResult = {
    ...entry(),
    rank: 150,
    tags: [tag()],
  };
  const entryKnowledgeStore: EntryKnowledgeStore = {
    createRelationship: vi.fn(async () => relationship()),
    updateRelationship: vi.fn(async () => relationship()),
    deleteRelationship: vi.fn(async () => true),
    getKnowledge: vi.fn(async () => ({
      outgoing: [relationship()],
      backlinks: [relationship()],
      inlineBacklinks: [{ source: entry(targetId, "North Gate") }],
    })),
    listWorldTags: vi.fn(async () => [tag()]),
    listEntryTags: vi.fn(async () => [tag()]),
    replaceEntryTags: vi.fn(async () => [tag()]),
    search: vi.fn(async () => [searchResult]),
  };
  return { entryStore, worldCampaignStore, entryKnowledgeStore };
}

describe("Entry knowledge API", () => {
  let entryStore: EntryStore;
  let worldCampaignStore: WorldCampaignStore;
  let entryKnowledgeStore: EntryKnowledgeStore;

  beforeEach(() => {
    ({ entryStore, worldCampaignStore, entryKnowledgeStore } = stores());
  });

  function app() {
    return createApp({
      database: { checkConnection: vi.fn() },
      entryStore,
      worldCampaignStore,
      entryKnowledgeStore,
    });
  }

  it("creates directed relationships with optional context", async () => {
    const response = await request(app())
      .post(`/api/entries/${sourceId}/relationships`)
      .send({ targetEntryId: targetId, contextNote: "  Keeps watch  " });

    expect(response.status).toBe(201);
    expect(entryKnowledgeStore.createRelationship).toHaveBeenCalledWith(
      sourceId,
      targetId,
      "Keeps watch",
    );
    expect(response.body.target.title).toBe("North Gate");
  });

  it("combines relationship and inline backlinks", async () => {
    const response = await request(app()).get(
      `/api/entries/${sourceId}/knowledge`,
    );

    expect(response.status).toBe(200);
    expect(response.body.outgoing).toHaveLength(1);
    expect(
      response.body.backlinks.map((item: { kind: string }) => item.kind),
    ).toEqual(["relationship", "inline"]);
  });

  it("replaces and autocompletes World-owned tags", async () => {
    await request(app())
      .put(`/api/entries/${sourceId}/tags`)
      .send({ tags: ["Villain"] })
      .expect(200);
    await request(app()).get(`/api/worlds/${worldId}/tags?q=vill`).expect(200);

    expect(entryKnowledgeStore.replaceEntryTags).toHaveBeenCalledWith(
      sourceId,
      ["Villain"],
    );
    expect(entryKnowledgeStore.listWorldTags).toHaveBeenCalledWith(
      worldId,
      "vill",
    );
  });

  it("uses contextual Campaign and World search scopes", async () => {
    await request(app())
      .get(`/api/campaigns/${campaignId}/search?q=mira&type=NPC&limit=10`)
      .expect(200);
    await request(app())
      .get(`/api/worlds/${worldId}/search?q=mira`)
      .expect(200);

    expect(entryKnowledgeStore.search).toHaveBeenNthCalledWith(
      1,
      { kind: "campaign", campaignId, worldId },
      { query: "mira", type: "NPC", archive: "active", limit: 10 },
    );
    expect(entryKnowledgeStore.search).toHaveBeenNthCalledWith(
      2,
      { kind: "world", worldId },
      { query: "mira", archive: "active", limit: 50 },
    );
  });

  it("returns a controlled validation error for an invalid reference scope", async () => {
    vi.mocked(entryKnowledgeStore.createRelationship).mockRejectedValue(
      new EntryReferenceValidationError(
        "outside the source Entry's visible scope",
      ),
    );
    const response = await request(app())
      .post(`/api/entries/${sourceId}/relationships`)
      .send({ targetEntryId: targetId });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("REFERENCE_VALIDATION_ERROR");
  });
});
