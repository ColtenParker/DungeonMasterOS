import {
  type Entry,
  type EntryType,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import type { JSONContent } from "@tiptap/core";

import type { ArchiveFilter } from "./world-campaign-store.js";

export interface EntryRecord {
  id: string;
  type: EntryType;
  title: string;
  document: JSONContent;
  documentVersion: number;
  worldId: string | null;
  campaignId: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type EntryScope =
  { kind: "world"; worldId: string } | { kind: "campaign"; campaignId: string };

export interface EntryInput {
  type: EntryType;
  title: string;
  document: JSONContent;
  documentVersion: number;
}

export interface EntryUpdate {
  title?: string | undefined;
  document?: JSONContent | undefined;
  documentVersion?: number | undefined;
  isArchived?: boolean | undefined;
}

export interface EntryFilters {
  archive: ArchiveFilter;
  type?: EntryType | undefined;
}

export interface EntryStore {
  createEntry(scope: EntryScope, input: EntryInput): Promise<EntryRecord>;
  listWorldEntries(
    worldId: string,
    filters: EntryFilters,
  ): Promise<EntryRecord[]>;
  listCampaignEntries(
    campaignId: string,
    worldId: string,
    filters: EntryFilters,
  ): Promise<EntryRecord[]>;
  findEntry(id: string): Promise<EntryRecord | null>;
  updateEntry(id: string, input: EntryUpdate): Promise<EntryRecord | null>;
}

function archiveWhere(archive: ArchiveFilter) {
  if (archive === "all") return {};
  return { isArchived: archive === "archived" };
}

function typeWhere(type: EntryType | undefined) {
  return type ? { type } : {};
}

function toEntry(record: Entry): EntryRecord {
  return { ...record, document: record.document as JSONContent };
}

function byTitleThenId(left: EntryRecord, right: EntryRecord) {
  const byTitle = left.title.localeCompare(right.title, undefined, {
    sensitivity: "base",
  });
  return byTitle || left.id.localeCompare(right.id);
}

function updateData(input: EntryUpdate): Prisma.EntryUpdateInput {
  return {
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.document === undefined ? {} : { document: input.document }),
    ...(input.documentVersion === undefined
      ? {}
      : { documentVersion: input.documentVersion }),
    ...(input.isArchived === undefined ? {} : { isArchived: input.isArchived }),
  };
}

export function createPrismaEntryStore(client: PrismaClient): EntryStore {
  return {
    async createEntry(scope, input) {
      const scopeData =
        scope.kind === "world"
          ? { worldId: scope.worldId }
          : { campaignId: scope.campaignId };
      return toEntry(
        await client.entry.create({
          data: {
            ...scopeData,
            type: input.type,
            title: input.title,
            document: input.document as Prisma.InputJsonValue,
            documentVersion: input.documentVersion,
          },
        }),
      );
    },
    async listWorldEntries(worldId, filters) {
      const records = await client.entry.findMany({
        where: {
          worldId,
          ...archiveWhere(filters.archive),
          ...typeWhere(filters.type),
        },
      });
      return records.map(toEntry).sort(byTitleThenId);
    },
    async listCampaignEntries(campaignId, worldId, filters) {
      const records = await client.entry.findMany({
        where: {
          OR: [{ campaignId }, { worldId }],
          ...archiveWhere(filters.archive),
          ...typeWhere(filters.type),
        },
      });
      return records.map(toEntry).sort(byTitleThenId);
    },
    async findEntry(id) {
      const record = await client.entry.findUnique({ where: { id } });
      return record ? toEntry(record) : null;
    },
    async updateEntry(id, input) {
      const existing = await client.entry.findUnique({ where: { id } });
      if (!existing) return null;
      return toEntry(
        await client.entry.update({ where: { id }, data: updateData(input) }),
      );
    },
  };
}
