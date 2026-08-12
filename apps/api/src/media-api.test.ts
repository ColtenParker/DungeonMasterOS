/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createApp } from "./app.js";
import type { EntryStore } from "./entry-store.js";
import {
  MediaDeletionBlockedError,
  type MediaRecord,
  type MediaStore,
  MediaUnavailableError,
  type MapMarkerRecord,
} from "./media-store.js";
import type { WorldCampaignStore } from "./world-campaign-store.js";

const worldId = "0198a5d0-3d4a-7000-8000-000000000001";
const campaignId = "0198a5d0-3d4a-7000-8000-000000000002";
const mediaId = "0198a5d0-3d4a-7000-8000-000000000003";
const entryId = "0198a5d0-3d4a-7000-8000-000000000004";
const markerId = "0198a5d0-3d4a-7000-8000-000000000005";
const timestamp = new Date("2026-08-12T16:30:00.000Z");
let temporaryRoot: string;
let imagePath: string;

function media(overrides: Partial<MediaRecord> = {}): MediaRecord {
  return {
    id: mediaId,
    name: "Old Keep",
    description: null,
    type: "MAP",
    originalFilename: "old-keep.png",
    mimeType: "image/png",
    byteSize: 128,
    width: 1000,
    height: 800,
    checksumSha256: "a".repeat(64),
    scope: { kind: "world", id: worldId },
    isArchived: false,
    isAvailable: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function marker(): MapMarkerRecord {
  return {
    id: markerId,
    mediaId,
    entryId,
    scope: { kind: "campaign", id: campaignId },
    x: 0.25,
    y: 0.75,
    label: "Gate",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createStore(): MediaStore {
  return {
    temporaryRoot,
    listMedia: vi.fn(async () => [media()]),
    findMedia: vi.fn(async () => media()),
    importMedia: vi.fn(async (_owner, input) => {
      await rm(input.temporaryPath, { force: true });
      return media({ name: input.name, type: input.type });
    }),
    updateMedia: vi.fn(async (_id, input) => media(input)),
    deleteMedia: vi.fn(async () => true),
    getFile: vi.fn(async () => ({
      path: imagePath,
      mimeType: "image/png",
      filename: "old-keep.png",
      etag: '"checksum-display"',
    })),
    listMarkers: vi.fn(async () => [marker()]),
    createMarker: vi.fn(async () => marker()),
    updateMarker: vi.fn(async () => marker()),
    deleteMarker: vi.fn(async () => true),
  };
}

function app(store: MediaStore) {
  return createApp({
    database: { checkConnection: vi.fn() },
    worldCampaignStore: {} as WorldCampaignStore,
    entryStore: {} as EntryStore,
    mediaStore: store,
  });
}

describe("Media API", () => {
  let store: MediaStore;

  beforeAll(async () => {
    temporaryRoot = await mkdtemp(path.join(tmpdir(), "dmos-media-api-"));
    imagePath = path.join(temporaryRoot, "served.png");
    await writeFile(imagePath, Buffer.from("test image response"));
  });

  beforeEach(() => {
    store = createStore();
  });

  afterAll(async () => {
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  it("lists context-visible Media without exposing storage keys or checksums", async () => {
    const response = await request(app(store)).get(
      `/api/campaigns/${campaignId}/media?archive=all&type=MAP`,
    );

    expect(response.status).toBe(200);
    expect(store.listMedia).toHaveBeenCalledWith(
      { kind: "campaign", campaignId },
      "all",
      "MAP",
    );
    expect(response.body.items[0]).toMatchObject({
      id: mediaId,
      scope: { kind: "world", id: worldId },
      urls: {
        display: `/api/campaigns/${campaignId}/media/${mediaId}/content/display`,
      },
    });
    expect(response.body.items[0]).not.toHaveProperty("checksumSha256");
    expect(response.body.items[0]).not.toHaveProperty("originalStorageKey");
  });

  it("accepts one multipart image with validated metadata", async () => {
    const response = await request(app(store))
      .post(`/api/worlds/${worldId}/media`)
      .field("name", "Old Keep")
      .field("type", "MAP")
      .attach("file", Buffer.from("fake image"), "old-keep.png");

    expect(response.status).toBe(201);
    expect(store.importMedia).toHaveBeenCalledWith(
      { kind: "world", worldId },
      expect.objectContaining({
        name: "Old Keep",
        type: "MAP",
        originalFilename: "old-keep.png",
      }),
    );
  });

  it("rejects invalid import metadata before calling the domain import", async () => {
    const response = await request(app(store))
      .post(`/api/worlds/${worldId}/media`)
      .field("name", "Old Keep")
      .field("type", "VIDEO")
      .attach("file", Buffer.from("fake image"), "old-keep.png");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(store.importMedia).not.toHaveBeenCalled();
  });

  it("serves controlled bytes with security and cache headers", async () => {
    const response = await request(app(store)).get(
      `/api/worlds/${worldId}/media/${mediaId}/content/display`,
    );

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch("image/png");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["cache-control"]).toMatch("private");
    expect(response.headers.etag).toBe('"checksum-display"');
  });

  it("returns a stable unavailable response without deleting metadata", async () => {
    vi.mocked(store.getFile).mockRejectedValue(
      new MediaUnavailableError("The managed media file is unavailable."),
    );
    const response = await request(app(store)).get(
      `/api/worlds/${worldId}/media/${mediaId}/content/display`,
    );
    expect(response.status).toBe(410);
    expect(response.body.error.code).toBe("MEDIA_UNAVAILABLE");
  });

  it("reports dependencies that block permanent deletion", async () => {
    vi.mocked(store.deleteMedia).mockRejectedValue(
      new MediaDeletionBlockedError([
        { kind: "workspace-background", id: campaignId, label: "Crown" },
      ]),
    );
    const response = await request(app(store)).delete(`/api/media/${mediaId}`);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("MEDIA_DELETE_BLOCKED");
    expect(response.body.error.dependencies).toHaveLength(1);
  });

  it("validates normalized markers and serializes their scope", async () => {
    const invalid = await request(app(store))
      .post(`/api/campaigns/${campaignId}/media/${mediaId}/markers`)
      .send({
        entryId,
        scope: "campaign",
        scopeId: campaignId,
        x: 1.1,
        y: 0.5,
      });
    expect(invalid.status).toBe(400);

    const response = await request(app(store))
      .post(`/api/campaigns/${campaignId}/media/${mediaId}/markers`)
      .send({
        entryId,
        scope: "campaign",
        scopeId: campaignId,
        x: 0.25,
        y: 0.75,
        label: "Gate",
      });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: markerId,
      scope: { kind: "campaign", id: campaignId },
    });
  });
});
