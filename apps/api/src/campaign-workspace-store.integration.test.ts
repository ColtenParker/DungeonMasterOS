import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  createPrismaCampaignWorkspaceStore,
  WorkspaceScopeValidationError,
} from "./campaign-workspace-store.js";
import { createPrismaEntryStore } from "./entry-store.js";
import { createDedicatedTestDatabase } from "./test-database.js";
import { createPrismaWorldCampaignStore } from "./world-campaign-store.js";

const database = createDedicatedTestDatabase();
const emptyDocument = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

describe.skipIf(!database)("Campaign workspace persistence", () => {
  const domains = database
    ? createPrismaWorldCampaignStore(database)
    : undefined;
  const entries = database ? createPrismaEntryStore(database) : undefined;
  const workspaces = database
    ? createPrismaCampaignWorkspaceStore(database)
    : undefined;

  async function clean() {
    await database?.workspaceEntryWindow.deleteMany();
    await database?.campaignWorkspace.deleteMany();
    await database?.entryInlineReference.deleteMany();
    await database?.entryRelationship.deleteMany();
    await database?.entryTag.deleteMany();
    await database?.tag.deleteMany();
    await database?.entry.deleteMany();
    await database?.campaign.deleteMany();
    await database?.world.deleteMany();
  }

  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await database?.$disconnect();
  });

  it("creates one empty workspace atomically with each Campaign", async () => {
    if (!domains || !workspaces)
      throw new Error("TEST_DATABASE_URL is required");
    const world = await domains.createWorld({ name: "Eldoria" });
    const campaign = await domains.createCampaign(world.id, {
      name: "The Broken Crown",
    });

    const workspace = await workspaces.findWorkspace(campaign.id);

    expect(workspace).toMatchObject({ campaignId: campaign.id, windows: [] });
    expect(workspace?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("atomically replaces Campaign and inherited World Entry windows", async () => {
    if (!domains || !entries || !workspaces) {
      throw new Error("TEST_DATABASE_URL is required");
    }
    const world = await domains.createWorld({ name: "Eldoria" });
    const campaign = await domains.createCampaign(world.id, { name: "Crown" });
    const worldEntry = await entries.createEntry(
      { kind: "world", worldId: world.id },
      {
        type: "NPC",
        title: "Mira",
        document: emptyDocument,
        documentVersion: 1,
        documentText: "",
        inlineTargetIds: [],
      },
    );
    const campaignEntry = await entries.createEntry(
      { kind: "campaign", campaignId: campaign.id },
      {
        type: "LOCATION",
        title: "Keep",
        document: emptyDocument,
        documentVersion: 1,
        documentText: "",
        inlineTargetIds: [],
      },
    );

    const replaced = await workspaces.replaceWorkspace(campaign.id, {
      windows: [
        {
          entryId: worldEntry.id,
          x: 10,
          y: 20,
          width: 640,
          height: 480,
          zOrder: 1,
          isMinimized: false,
        },
        {
          entryId: campaignEntry.id,
          x: 40,
          y: 60,
          width: 700,
          height: 520,
          zOrder: 2,
          isMinimized: true,
        },
      ],
    });

    expect(replaced?.windows.map(({ entryId }) => entryId)).toEqual([
      worldEntry.id,
      campaignEntry.id,
    ]);
    expect(
      (await workspaces.findWorkspace(campaign.id))?.windows[1],
    ).toMatchObject({
      entryId: campaignEntry.id,
      isMinimized: true,
    });

    await workspaces.replaceWorkspace(campaign.id, { windows: [] });
    expect((await workspaces.findWorkspace(campaign.id))?.windows).toEqual([]);
  });

  it("rejects unrelated and duplicate Entries without changing the snapshot", async () => {
    if (!domains || !entries || !workspaces) {
      throw new Error("TEST_DATABASE_URL is required");
    }
    const world = await domains.createWorld({ name: "Eldoria" });
    const campaign = await domains.createCampaign(world.id, { name: "Crown" });
    const otherWorld = await domains.createWorld({ name: "Elsewhere" });
    const unrelated = await entries.createEntry(
      { kind: "world", worldId: otherWorld.id },
      {
        type: "NPC",
        title: "Outsider",
        document: emptyDocument,
        documentVersion: 1,
        documentText: "",
        inlineTargetIds: [],
      },
    );
    const window = {
      entryId: unrelated.id,
      x: 0,
      y: 0,
      width: 640,
      height: 480,
      zOrder: 1,
      isMinimized: false,
    };

    await expect(
      workspaces.replaceWorkspace(campaign.id, { windows: [window] }),
    ).rejects.toBeInstanceOf(WorkspaceScopeValidationError);
    await expect(
      workspaces.replaceWorkspace(campaign.id, { windows: [window, window] }),
    ).rejects.toBeInstanceOf(WorkspaceScopeValidationError);
    expect((await workspaces.findWorkspace(campaign.id))?.windows).toEqual([]);
  });
});
