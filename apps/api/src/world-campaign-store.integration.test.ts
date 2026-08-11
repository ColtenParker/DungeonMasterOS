import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createDedicatedTestDatabase } from "./test-database.js";
import { createPrismaWorldCampaignStore } from "./world-campaign-store.js";

const database = createDedicatedTestDatabase();

describe.skipIf(!database)("World and Campaign persistence", () => {
  const store = database ? createPrismaWorldCampaignStore(database) : undefined;

  beforeEach(async () => {
    await database?.campaign.deleteMany();
    await database?.world.deleteMany();
  });

  afterAll(async () => {
    await database?.campaign.deleteMany();
    await database?.world.deleteMany();
    await database?.$disconnect();
  });

  it("creates UUIDv7 Worlds with the documented defaults", async () => {
    if (!store) throw new Error("TEST_DATABASE_URL is required");

    const created = await store.createWorld({ name: "Eldoria" });

    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(created.description).toBeNull();
    expect(created.isArchived).toBe(false);
  });

  it("allows duplicate names and orders them case-insensitively with ID ties", async () => {
    if (!store) throw new Error("TEST_DATABASE_URL is required");

    const later = await store.createWorld({ name: "eldoria" });
    const earlier = await store.createWorld({ name: "Eldoria" });
    await store.createWorld({ name: "Avernus" });

    const worlds = await store.listWorlds("active");

    expect(worlds.map(({ name }) => name)).toEqual([
      "Avernus",
      earlier.id < later.id ? "Eldoria" : "eldoria",
      earlier.id < later.id ? "eldoria" : "Eldoria",
    ]);
  });

  it("filters archive state independently", async () => {
    if (!store) throw new Error("TEST_DATABASE_URL is required");

    const active = await store.createWorld({ name: "Active" });
    const archived = await store.createWorld({ name: "Archived" });
    await store.updateWorld(archived.id, { isArchived: true });

    expect((await store.listWorlds("active")).map(({ id }) => id)).toEqual([
      active.id,
    ]);
    expect((await store.listWorlds("archived")).map(({ id }) => id)).toEqual([
      archived.id,
    ]);
    expect(await store.listWorlds("all")).toHaveLength(2);
  });

  it("requires a valid World and restricts World deletion while Campaigns exist", async () => {
    if (!store || !database) throw new Error("TEST_DATABASE_URL is required");

    const parent = await store.createWorld({ name: "Parent" });
    const child = await store.createCampaign(parent.id, { name: "Child" });

    await expect(
      store.createCampaign("0198a5d0-3d4a-7000-8000-000000000099", {
        name: "Orphan",
      }),
    ).rejects.toThrow();
    await expect(
      database.world.delete({ where: { id: parent.id } }),
    ).rejects.toThrow();
    expect(await store.findCampaign(child.id)).toMatchObject({
      worldId: parent.id,
    });
  });

  it("does not mutate Campaign archive state when its World is archived", async () => {
    if (!store) throw new Error("TEST_DATABASE_URL is required");

    const parent = await store.createWorld({ name: "Parent" });
    const child = await store.createCampaign(parent.id, { name: "Child" });
    await store.updateWorld(parent.id, { isArchived: true });

    expect(await store.findCampaign(child.id)).toMatchObject({
      isArchived: false,
      worldId: parent.id,
    });
  });
});
