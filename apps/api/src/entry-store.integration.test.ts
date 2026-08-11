import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { EMPTY_ENTRY_DOCUMENT } from "./entry-document.js";
import { createPrismaEntryStore } from "./entry-store.js";
import { createDedicatedTestDatabase } from "./test-database.js";

const database = createDedicatedTestDatabase();

describe.skipIf(!database)("Entry persistence", () => {
  const store = database ? createPrismaEntryStore(database) : undefined;

  beforeEach(async () => {
    await database?.entry.deleteMany();
    await database?.campaign.deleteMany();
    await database?.world.deleteMany();
  });

  afterAll(async () => {
    await database?.entry.deleteMany();
    await database?.campaign.deleteMany();
    await database?.world.deleteMany();
    await database?.$disconnect();
  });

  async function createHierarchy() {
    if (!database) throw new Error("TEST_DATABASE_URL is required");
    const world = await database.world.create({ data: { name: "Eldoria" } });
    const firstCampaign = await database.campaign.create({
      data: { name: "First", worldId: world.id },
    });
    const secondCampaign = await database.campaign.create({
      data: { name: "Second", worldId: world.id },
    });
    return { world, firstCampaign, secondCampaign };
  }

  const input = {
    type: "NPC" as const,
    title: "Mira Vale",
    document: EMPTY_ENTRY_DOCUMENT,
    documentVersion: 1,
    documentText: "",
    inlineTargetIds: [] as string[],
  };

  it("creates UUIDv7 Entries and round-trips versioned JSON", async () => {
    if (!store) throw new Error("TEST_DATABASE_URL is required");
    const { world } = await createHierarchy();

    const created = await store.createEntry(
      { kind: "world", worldId: world.id },
      input,
    );

    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(created.document).toEqual(EMPTY_ENTRY_DOCUMENT);
    expect(created.documentVersion).toBe(1);
    expect(created.isArchived).toBe(false);
  });

  it("enforces exactly one valid scope and restricts parent deletion", async () => {
    if (!database || !store) throw new Error("TEST_DATABASE_URL is required");
    const { world, firstCampaign } = await createHierarchy();

    await expect(
      database.entry.create({
        data: {
          ...input,
          document: EMPTY_ENTRY_DOCUMENT,
        },
      }),
    ).rejects.toThrow();
    await expect(
      database.entry.create({
        data: {
          ...input,
          document: EMPTY_ENTRY_DOCUMENT,
          worldId: world.id,
          campaignId: firstCampaign.id,
        },
      }),
    ).rejects.toThrow();

    await store.createEntry({ kind: "world", worldId: world.id }, input);
    await expect(
      database.world.delete({ where: { id: world.id } }),
    ).rejects.toThrow();
  });

  it("combines inherited World Entries with only the selected Campaign", async () => {
    if (!store) throw new Error("TEST_DATABASE_URL is required");
    const { world, firstCampaign, secondCampaign } = await createHierarchy();
    await store.createEntry(
      { kind: "world", worldId: world.id },
      { ...input, title: "World NPC" },
    );
    await store.createEntry(
      { kind: "campaign", campaignId: firstCampaign.id },
      { ...input, title: "First NPC" },
    );
    await store.createEntry(
      { kind: "campaign", campaignId: secondCampaign.id },
      { ...input, title: "Second NPC" },
    );

    const entries = await store.listCampaignEntries(
      firstCampaign.id,
      world.id,
      { archive: "active" },
    );

    expect(entries.map(({ title }) => title)).toEqual([
      "First NPC",
      "World NPC",
    ]);
  });

  it("filters type and archive state and permits duplicate titles", async () => {
    if (!store) throw new Error("TEST_DATABASE_URL is required");
    const { world } = await createHierarchy();
    const active = await store.createEntry(
      { kind: "world", worldId: world.id },
      input,
    );
    const archived = await store.createEntry(
      { kind: "world", worldId: world.id },
      input,
    );
    await store.createEntry(
      { kind: "world", worldId: world.id },
      { ...input, type: "JOURNAL" },
    );
    await store.updateEntry(archived.id, { isArchived: true });

    expect(
      await store.listWorldEntries(world.id, {
        archive: "active",
        type: "NPC",
      }),
    ).toMatchObject([{ id: active.id }]);
    expect(
      await store.listWorldEntries(world.id, {
        archive: "archived",
        type: "NPC",
      }),
    ).toMatchObject([{ id: archived.id }]);
  });
});
