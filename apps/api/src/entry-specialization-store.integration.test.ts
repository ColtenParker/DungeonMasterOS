import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { EMPTY_ENTRY_DOCUMENT } from "./entry-document.js";
import { EntrySpecializationValidationError } from "./entry-specialization.js";
import { createPrismaEntryStore } from "./entry-store.js";
import { createDedicatedTestDatabase } from "./test-database.js";

const database = createDedicatedTestDatabase();
const base = {
  document: EMPTY_ENTRY_DOCUMENT,
  documentVersion: 2,
  documentText: "",
  inlineTargetIds: [] as string[],
};

describe.skipIf(!database)("specialized Entry persistence", () => {
  const store = database ? createPrismaEntryStore(database) : undefined;

  async function clean() {
    await database?.inventoryLine.deleteMany();
    await database?.inventory.deleteMany();
    await database?.factionLeader.deleteMany();
    await database?.questObjective.deleteMany();
    await database?.npcDetails.deleteMany();
    await database?.locationDetails.deleteMany();
    await database?.factionDetails.deleteMany();
    await database?.questDetails.deleteMany();
    await database?.entry.deleteMany();
    await database?.campaign.deleteMany();
    await database?.world.deleteMany();
  }

  beforeEach(async () => {
    await clean();
  });

  afterAll(async () => {
    await clean();
    await database?.$disconnect();
  });

  async function hierarchy() {
    if (!database) throw new Error("TEST_DATABASE_URL is required");
    const world = await database.world.create({ data: { name: "Eldoria" } });
    const campaign = await database.campaign.create({
      data: { name: "Crown", worldId: world.id },
    });
    return { world, campaign };
  }

  it("round-trips NPC sections and scope-safe typed references", async () => {
    if (!store) throw new Error("TEST_DATABASE_URL is required");
    const { world, campaign } = await hierarchy();
    const location = await store.createEntry(
      { kind: "world", worldId: world.id },
      {
        ...base,
        type: "LOCATION",
        title: "Market",
        sections: ["hierarchy"],
        specialization: {
          type: "LOCATION",
          parentLocationId: null,
          sortOrder: 0,
          inventories: [],
        },
      },
    );
    const item = await store.createEntry(
      { kind: "world", worldId: world.id },
      {
        ...base,
        type: "ITEM",
        title: "Rope",
        sections: [],
        specialization: { type: "ITEM" },
      },
    );
    const lineId = randomUUID();
    const inventoryId = randomUUID();
    const npc = await store.createEntry(
      { kind: "campaign", campaignId: campaign.id },
      {
        ...base,
        type: "NPC",
        title: "Mira",
        sections: ["status", "currentLocation", "inventory"],
        specialization: {
          type: "NPC",
          portraitMediaId: null,
          status: " Active ",
          currentLocationId: location.id,
          inventories: [
            {
              id: inventoryId,
              name: "Pack",
              lines: [
                { id: lineId, itemId: item.id, quantity: 2, note: "Silk" },
              ],
            },
          ],
        },
      },
    );
    expect(npc.sections).toEqual(["status", "currentLocation", "inventory"]);
    expect(npc.specialization).toMatchObject({
      type: "NPC",
      status: "Active",
      currentLocationId: location.id,
    });
    const npcDetails = npc.specialization;
    expect(
      npcDetails?.type === "NPC"
        ? npcDetails.inventories[0]?.lines[0]
        : undefined,
    ).toMatchObject({ id: lineId, itemId: item.id, quantity: 2 });
  });

  it("rejects hierarchy cycles and rolls back the complete Entry Save", async () => {
    if (!store) throw new Error("TEST_DATABASE_URL is required");
    const { world } = await hierarchy();
    const root = await store.createEntry(
      { kind: "world", worldId: world.id },
      {
        ...base,
        type: "LOCATION",
        title: "Root",
        sections: ["hierarchy"],
        specialization: {
          type: "LOCATION",
          parentLocationId: null,
          sortOrder: 0,
          inventories: [],
        },
      },
    );
    const child = await store.createEntry(
      { kind: "world", worldId: world.id },
      {
        ...base,
        type: "LOCATION",
        title: "Child",
        sections: ["hierarchy"],
        specialization: {
          type: "LOCATION",
          parentLocationId: root.id,
          sortOrder: 0,
          inventories: [],
        },
      },
    );
    await expect(
      store.updateEntry(root.id, {
        title: "Changed but invalid",
        sections: ["hierarchy"],
        specialization: {
          type: "LOCATION",
          parentLocationId: child.id,
          sortOrder: 0,
          inventories: [],
        },
      }),
    ).rejects.toBeInstanceOf(EntrySpecializationValidationError);
    expect((await store.findEntry(root.id))?.title).toBe("Root");
  });

  it("removes Inventory references without deleting Item definitions", async () => {
    if (!store) throw new Error("TEST_DATABASE_URL is required");
    const { world } = await hierarchy();
    const item = await store.createEntry(
      { kind: "world", worldId: world.id },
      { ...base, type: "ITEM", title: "Torch", sections: [] },
    );
    const npc = await store.createEntry(
      { kind: "world", worldId: world.id },
      {
        ...base,
        type: "NPC",
        title: "Keeper",
        sections: ["inventory"],
        specialization: {
          type: "NPC",
          portraitMediaId: null,
          status: null,
          currentLocationId: null,
          inventories: [
            {
              id: randomUUID(),
              name: "Stock",
              lines: [
                { id: randomUUID(), itemId: item.id, quantity: 4, note: null },
              ],
            },
          ],
        },
      },
    );
    await store.updateEntry(npc.id, {
      sections: [],
      specialization: {
        type: "NPC",
        portraitMediaId: null,
        status: null,
        currentLocationId: null,
        inventories: [],
      },
    });
    expect(await store.findEntry(item.id)).not.toBeNull();
    expect(await database?.inventoryLine.count()).toBe(0);
  });
});
