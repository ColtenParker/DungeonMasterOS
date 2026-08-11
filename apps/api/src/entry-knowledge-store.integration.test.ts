import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { EMPTY_ENTRY_DOCUMENT } from "./entry-document.js";
import { createPrismaEntryKnowledgeStore } from "./entry-knowledge-store.js";
import {
  createPrismaEntryStore,
  EntryReferenceValidationError,
} from "./entry-store.js";
import { createDedicatedTestDatabase } from "./test-database.js";

const database = createDedicatedTestDatabase();

describe.skipIf(!database)("Entry knowledge persistence", () => {
  const entryStore = database ? createPrismaEntryStore(database) : undefined;
  const knowledgeStore = database
    ? createPrismaEntryKnowledgeStore(database)
    : undefined;

  beforeEach(async () => {
    await database?.workspaceEntryWindow.deleteMany();
    await database?.campaignWorkspace.deleteMany();
    await database?.entryInlineReference.deleteMany();
    await database?.entryRelationship.deleteMany();
    await database?.entryTag.deleteMany();
    await database?.tag.deleteMany();
    await database?.entry.deleteMany();
    await database?.campaign.deleteMany();
    await database?.world.deleteMany();
  });

  afterAll(async () => {
    await database?.workspaceEntryWindow.deleteMany();
    await database?.campaignWorkspace.deleteMany();
    await database?.entryInlineReference.deleteMany();
    await database?.entryRelationship.deleteMany();
    await database?.entryTag.deleteMany();
    await database?.tag.deleteMany();
    await database?.entry.deleteMany();
    await database?.campaign.deleteMany();
    await database?.world.deleteMany();
    await database?.$disconnect();
  });

  const baseInput = {
    type: "NPC" as const,
    title: "Mira Vale",
    document: EMPTY_ENTRY_DOCUMENT,
    documentVersion: 2,
    documentText: "",
    inlineTargetIds: [] as string[],
  };

  async function hierarchy() {
    if (!database) throw new Error("TEST_DATABASE_URL is required");
    const world = await database.world.create({ data: { name: "Eldoria" } });
    const campaign = await database.campaign.create({
      data: { worldId: world.id, name: "Broken Crown" },
    });
    const siblingCampaign = await database.campaign.create({
      data: { worldId: world.id, name: "Other Crown" },
    });
    const otherWorld = await database.world.create({
      data: { name: "Elsewhere" },
    });
    return { world, campaign, siblingCampaign, otherWorld };
  }

  it("enforces directed relationship scope and derives backlinks", async () => {
    if (!entryStore || !knowledgeStore) throw new Error("database required");
    const { world, campaign, siblingCampaign } = await hierarchy();
    const worldEntry = await entryStore.createEntry(
      { kind: "world", worldId: world.id },
      { ...baseInput, title: "North Gate" },
    );
    const campaignEntry = await entryStore.createEntry(
      { kind: "campaign", campaignId: campaign.id },
      baseInput,
    );
    const siblingEntry = await entryStore.createEntry(
      { kind: "campaign", campaignId: siblingCampaign.id },
      { ...baseInput, title: "Sibling Secret" },
    );

    await knowledgeStore.createRelationship(
      campaignEntry.id,
      worldEntry.id,
      "Keeps watch",
    );
    await expect(
      knowledgeStore.createRelationship(
        campaignEntry.id,
        siblingEntry.id,
        null,
      ),
    ).rejects.toBeInstanceOf(EntryReferenceValidationError);

    const knowledge = await knowledgeStore.getKnowledge(worldEntry.id);
    expect(knowledge?.backlinks[0]?.source.id).toBe(campaignEntry.id);
  });

  it("synchronizes inline references and document text transactionally", async () => {
    if (!entryStore || !database) throw new Error("database required");
    const { world, otherWorld } = await hierarchy();
    const source = await entryStore.createEntry(
      { kind: "world", worldId: world.id },
      baseInput,
    );
    const target = await entryStore.createEntry(
      { kind: "world", worldId: world.id },
      { ...baseInput, title: "North Gate" },
    );
    const invalidTarget = await entryStore.createEntry(
      { kind: "world", worldId: otherWorld.id },
      { ...baseInput, title: "Other World" },
    );

    await entryStore.updateEntry(source.id, {
      document: EMPTY_ENTRY_DOCUMENT,
      documentVersion: 2,
      documentText: "North Gate",
      inlineTargetIds: [target.id],
    });
    expect(
      await database.entryInlineReference.findUnique({
        where: {
          sourceEntryId_targetEntryId: {
            sourceEntryId: source.id,
            targetEntryId: target.id,
          },
        },
      }),
    ).not.toBeNull();

    await expect(
      entryStore.updateEntry(source.id, {
        document: EMPTY_ENTRY_DOCUMENT,
        documentVersion: 2,
        documentText: "Should roll back",
        inlineTargetIds: [invalidTarget.id],
      }),
    ).rejects.toBeInstanceOf(EntryReferenceValidationError);
    expect((await entryStore.findEntry(source.id))?.documentText).toBe(
      "North Gate",
    );
  });

  it("shares case-insensitive tags within a World", async () => {
    if (!entryStore || !knowledgeStore || !database) {
      throw new Error("database required");
    }
    const { world, campaign } = await hierarchy();
    const worldEntry = await entryStore.createEntry(
      { kind: "world", worldId: world.id },
      baseInput,
    );
    const campaignEntry = await entryStore.createEntry(
      { kind: "campaign", campaignId: campaign.id },
      { ...baseInput, title: "Campaign NPC" },
    );

    const first = await knowledgeStore.replaceEntryTags(worldEntry.id, [
      "Villain",
    ]);
    const second = await knowledgeStore.replaceEntryTags(campaignEntry.id, [
      "villain",
    ]);

    expect(first?.[0]?.id).toBe(second?.[0]?.id);
    expect(await database.tag.count({ where: { worldId: world.id } })).toBe(1);
  });

  it("ranks title matches and respects World versus Campaign scope", async () => {
    if (!entryStore || !knowledgeStore) throw new Error("database required");
    const { world, campaign, siblingCampaign } = await hierarchy();
    const titleMatch = await entryStore.createEntry(
      { kind: "world", worldId: world.id },
      { ...baseInput, title: "Dragon" },
    );
    await entryStore.createEntry(
      { kind: "campaign", campaignId: campaign.id },
      { ...baseInput, title: "Notes", documentText: "dragon beneath the keep" },
    );
    await entryStore.createEntry(
      { kind: "campaign", campaignId: siblingCampaign.id },
      { ...baseInput, title: "Sibling Dragon" },
    );

    const worldResults = await knowledgeStore.search(
      { kind: "world", worldId: world.id },
      { query: "dragon", archive: "active", limit: 100 },
    );
    const campaignResults = await knowledgeStore.search(
      { kind: "campaign", campaignId: campaign.id, worldId: world.id },
      { query: "dragon", archive: "active", limit: 100 },
    );

    expect(worldResults.map(({ id }) => id)).toEqual([titleMatch.id]);
    expect(campaignResults.map(({ title }) => title)).toEqual([
      "Dragon",
      "Notes",
    ]);
  });
});
