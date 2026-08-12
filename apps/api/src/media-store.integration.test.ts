import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createPrismaCampaignWorkspaceStore } from "./campaign-workspace-store.js";
import { createPrismaEntryStore } from "./entry-store.js";
import {
  createPrismaMediaStore,
  MediaDeletionBlockedError,
  MediaScopeValidationError,
} from "./media-store.js";
import { createDedicatedTestDatabase } from "./test-database.js";
import { createPrismaWorldCampaignStore } from "./world-campaign-store.js";

const database = createDedicatedTestDatabase();
const emptyDocument = { type: "doc", content: [{ type: "paragraph" }] };
let mediaRoot: string;

describe.skipIf(!database)("Media persistence and map references", () => {
  const domains = database
    ? createPrismaWorldCampaignStore(database)
    : undefined;
  const entries = database ? createPrismaEntryStore(database) : undefined;
  const workspaces = database
    ? createPrismaCampaignWorkspaceStore(database)
    : undefined;
  let mediaStore: ReturnType<typeof createPrismaMediaStore>;

  async function cleanDatabase() {
    if (!database) return;
    await database.campaignWorkspace.updateMany({
      data: { backgroundMediaId: null },
    });
    await database.mapMarker.deleteMany();
    await database.workspaceEntryWindow.deleteMany();
    await database.media.deleteMany();
    await database.campaignWorkspace.deleteMany();
    await database.entryInlineReference.deleteMany();
    await database.entryRelationship.deleteMany();
    await database.entryTag.deleteMany();
    await database.tag.deleteMany();
    await database.entry.deleteMany();
    await database.campaign.deleteMany();
    await database.world.deleteMany();
  }

  beforeAll(async () => {
    mediaRoot = await mkdtemp(path.join(tmpdir(), "dmos-media-store-"));
    if (database) mediaStore = createPrismaMediaStore(database, mediaRoot);
  });

  beforeEach(async () => {
    await cleanDatabase();
    await rm(mediaRoot, { recursive: true, force: true });
  });

  afterAll(async () => {
    await cleanDatabase();
    await database?.$disconnect();
    await rm(mediaRoot, { recursive: true, force: true });
  });

  async function fixture() {
    if (!domains || !entries) throw new Error("TEST_DATABASE_URL is required");
    const world = await domains.createWorld({ name: "Eldoria" });
    const campaign = await domains.createCampaign(world.id, { name: "Crown" });
    const otherWorld = await domains.createWorld({ name: "Elsewhere" });
    const otherCampaign = await domains.createCampaign(otherWorld.id, {
      name: "Other",
    });
    const worldEntry = await entries.createEntry(
      { kind: "world", worldId: world.id },
      {
        type: "LOCATION",
        title: "Old Keep",
        document: emptyDocument,
        documentVersion: 1,
        documentText: "",
        inlineTargetIds: [],
      },
    );
    const campaignEntry = await entries.createEntry(
      { kind: "campaign", campaignId: campaign.id },
      {
        type: "NPC",
        title: "Scout",
        document: emptyDocument,
        documentVersion: 1,
        documentText: "",
        inlineTargetIds: [],
      },
    );
    const source = path.join(mediaRoot, "upload.png");
    await mkdir(mediaRoot, { recursive: true });
    await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: { r: 40, g: 80, b: 120 },
      },
    })
      .png()
      .toFile(source);
    return {
      world,
      campaign,
      otherWorld,
      otherCampaign,
      worldEntry,
      campaignEntry,
      source,
    };
  }

  it("imports verified images into managed representations and applies visibility", async () => {
    const { world, campaign, otherCampaign, source } = await fixture();
    const imported = await mediaStore.importMedia(
      { kind: "world", worldId: world.id },
      {
        name: "Old Keep",
        type: "MAP",
        originalFilename: "../unsafe map.png",
        temporaryPath: source,
      },
    );

    expect(imported.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(imported).toMatchObject({
      width: 1200,
      height: 800,
      mimeType: "image/png",
      originalFilename: "unsafe map.png",
      isAvailable: true,
      scope: { kind: "world", id: world.id },
    });
    expect(
      await mediaStore.listMedia(
        { kind: "campaign", campaignId: campaign.id },
        "active",
      ),
    ).toHaveLength(1);
    expect(
      await mediaStore.listMedia(
        { kind: "campaign", campaignId: otherCampaign.id },
        "active",
      ),
    ).toHaveLength(0);
    expect(
      await mediaStore.getFile(
        { kind: "campaign", campaignId: campaign.id },
        imported.id,
        "thumbnail",
      ),
    ).toMatchObject({
      mimeType: "image/webp",
    });
  });

  it("persists backgrounds separately and layers valid World and Campaign markers", async () => {
    if (!workspaces) throw new Error("TEST_DATABASE_URL is required");
    const { world, campaign, worldEntry, campaignEntry, source } =
      await fixture();
    const map = await mediaStore.importMedia(
      { kind: "world", worldId: world.id },
      {
        name: "Old Keep",
        type: "MAP",
        originalFilename: "keep.png",
        temporaryPath: source,
      },
    );

    await workspaces.updateBackground(campaign.id, map.id);
    expect(await workspaces.findWorkspace(campaign.id)).toMatchObject({
      backgroundMediaId: map.id,
      windows: [],
    });

    await mediaStore.createMarker(campaign.id, map.id, {
      owner: { kind: "world", worldId: world.id },
      entryId: worldEntry.id,
      x: 0.2,
      y: 0.3,
      label: "Keep",
    });
    await mediaStore.createMarker(campaign.id, map.id, {
      owner: { kind: "campaign", campaignId: campaign.id },
      entryId: campaignEntry.id,
      x: 0.7,
      y: 0.8,
    });
    expect(await mediaStore.listMarkers(campaign.id, map.id)).toHaveLength(2);

    await expect(mediaStore.deleteMedia(map.id)).rejects.toBeInstanceOf(
      MediaDeletionBlockedError,
    );
  });

  it("rejects invalid World marker targets and preserves archived targets", async () => {
    if (!entries) throw new Error("TEST_DATABASE_URL is required");
    const { world, campaign, campaignEntry, worldEntry, source } =
      await fixture();
    const map = await mediaStore.importMedia(
      { kind: "world", worldId: world.id },
      {
        name: "Old Keep",
        type: "MAP",
        originalFilename: "keep.png",
        temporaryPath: source,
      },
    );

    await expect(
      mediaStore.createMarker(campaign.id, map.id, {
        owner: { kind: "world", worldId: world.id },
        entryId: campaignEntry.id,
        x: 0.5,
        y: 0.5,
      }),
    ).rejects.toBeInstanceOf(MediaScopeValidationError);

    await entries.updateEntry(worldEntry.id, { isArchived: true });
    await mediaStore.createMarker(campaign.id, map.id, {
      owner: { kind: "world", worldId: world.id },
      entryId: worldEntry.id,
      x: 0.5,
      y: 0.5,
    });
    expect(await mediaStore.listMarkers(campaign.id, map.id)).toHaveLength(1);
  });
});
