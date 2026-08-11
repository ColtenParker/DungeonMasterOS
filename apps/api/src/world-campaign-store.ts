import type { Campaign, PrismaClient, World } from "@prisma/client";

export type ArchiveFilter = "active" | "archived" | "all";

export interface DomainRecord {
  id: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type WorldRecord = DomainRecord;

export interface CampaignRecord extends DomainRecord {
  worldId: string;
}

export interface DomainInput {
  name: string;
  description?: string | null | undefined;
}

export interface DomainUpdate {
  name?: string | undefined;
  description?: string | null | undefined;
  isArchived?: boolean | undefined;
}

export interface WorldCampaignStore {
  createWorld(input: DomainInput): Promise<WorldRecord>;
  listWorlds(archive: ArchiveFilter): Promise<WorldRecord[]>;
  findWorld(id: string): Promise<WorldRecord | null>;
  updateWorld(id: string, input: DomainUpdate): Promise<WorldRecord | null>;
  createCampaign(worldId: string, input: DomainInput): Promise<CampaignRecord>;
  listCampaigns(
    worldId: string,
    archive: ArchiveFilter,
  ): Promise<CampaignRecord[]>;
  findCampaign(id: string): Promise<CampaignRecord | null>;
  updateCampaign(
    id: string,
    input: DomainUpdate,
  ): Promise<CampaignRecord | null>;
}

function archiveWhere(archive: ArchiveFilter) {
  if (archive === "all") return {};
  return { isArchived: archive === "archived" };
}

function byNameThenId<T extends DomainRecord>(left: T, right: T) {
  const byName = left.name.localeCompare(right.name, undefined, {
    sensitivity: "base",
  });
  return byName || left.id.localeCompare(right.id);
}

function toWorld(record: World): WorldRecord {
  return record;
}

function toCampaign(record: Campaign): CampaignRecord {
  return record;
}

function createData(input: DomainInput) {
  return {
    name: input.name,
    ...(input.description === undefined
      ? {}
      : { description: input.description }),
  };
}

function updateData(input: DomainUpdate) {
  return {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.description === undefined
      ? {}
      : { description: input.description }),
    ...(input.isArchived === undefined ? {} : { isArchived: input.isArchived }),
  };
}

export function createPrismaWorldCampaignStore(
  client: PrismaClient,
): WorldCampaignStore {
  return {
    async createWorld(input) {
      return toWorld(await client.world.create({ data: createData(input) }));
    },
    async listWorlds(archive) {
      const records = await client.world.findMany({
        where: archiveWhere(archive),
      });
      return records.map(toWorld).sort(byNameThenId);
    },
    async findWorld(id) {
      const record = await client.world.findUnique({ where: { id } });
      return record ? toWorld(record) : null;
    },
    async updateWorld(id, input) {
      const existing = await client.world.findUnique({ where: { id } });
      if (!existing) return null;
      return toWorld(
        await client.world.update({ where: { id }, data: updateData(input) }),
      );
    },
    async createCampaign(worldId, input) {
      return toCampaign(
        await client.campaign.create({
          data: {
            ...createData(input),
            worldId,
            workspace: { create: {} },
          },
        }),
      );
    },
    async listCampaigns(worldId, archive) {
      const records = await client.campaign.findMany({
        where: { worldId, ...archiveWhere(archive) },
      });
      return records.map(toCampaign).sort(byNameThenId);
    },
    async findCampaign(id) {
      const record = await client.campaign.findUnique({ where: { id } });
      return record ? toCampaign(record) : null;
    },
    async updateCampaign(id, input) {
      const existing = await client.campaign.findUnique({ where: { id } });
      if (!existing) return null;
      return toCampaign(
        await client.campaign.update({
          where: { id },
          data: updateData(input),
        }),
      );
    },
  };
}
