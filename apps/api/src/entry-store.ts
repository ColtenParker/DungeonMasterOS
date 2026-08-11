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
  documentText: string;
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
  documentText: string;
  inlineTargetIds: string[];
}

export interface EntryUpdate {
  title?: string | undefined;
  document?: JSONContent | undefined;
  documentVersion?: number | undefined;
  documentText?: string | undefined;
  inlineTargetIds?: string[] | undefined;
  isArchived?: boolean | undefined;
}

export class EntryReferenceValidationError extends Error {}

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
    ...(input.documentText === undefined
      ? {}
      : { documentText: input.documentText }),
    ...(input.isArchived === undefined ? {} : { isArchived: input.isArchived }),
  };
}

type EntryScopeRecord = Pick<Entry, "id" | "worldId" | "campaignId">;

export async function validateReferenceTargets(
  client: Prisma.TransactionClient,
  source: EntryScopeRecord,
  targetIds: string[],
) {
  if (!targetIds.length) return;
  if (targetIds.includes(source.id)) {
    throw new EntryReferenceValidationError(
      "An Entry cannot reference itself.",
    );
  }
  const targets = await client.entry.findMany({
    where: { id: { in: targetIds } },
    select: { id: true, worldId: true, campaignId: true },
  });
  if (targets.length !== new Set(targetIds).size) {
    throw new EntryReferenceValidationError(
      "One or more referenced Entries were not found.",
    );
  }

  let campaignWorldId: string | null = null;
  if (source.campaignId) {
    const campaign = await client.campaign.findUnique({
      where: { id: source.campaignId },
      select: { worldId: true },
    });
    campaignWorldId = campaign?.worldId ?? null;
  }
  const invalid = targets.some((target) =>
    source.worldId
      ? target.worldId !== source.worldId
      : !(
          target.campaignId === source.campaignId ||
          target.worldId === campaignWorldId
        ),
  );
  if (invalid) {
    throw new EntryReferenceValidationError(
      "A referenced Entry is outside the source Entry's visible scope.",
    );
  }
}

async function synchronizeInlineReferences(
  client: Prisma.TransactionClient,
  source: EntryScopeRecord,
  targetIds: string[],
) {
  const distinctTargetIds = [...new Set(targetIds)];
  await validateReferenceTargets(client, source, distinctTargetIds);
  await client.entryInlineReference.deleteMany({
    where: { sourceEntryId: source.id },
  });
  if (distinctTargetIds.length) {
    await client.entryInlineReference.createMany({
      data: distinctTargetIds.map((targetEntryId) => ({
        sourceEntryId: source.id,
        targetEntryId,
      })),
    });
  }
}

export function createPrismaEntryStore(client: PrismaClient): EntryStore {
  return {
    async createEntry(scope, input) {
      const scopeData =
        scope.kind === "world"
          ? { worldId: scope.worldId }
          : { campaignId: scope.campaignId };
      return client.$transaction(async (transaction) => {
        const created = await transaction.entry.create({
          data: {
            ...scopeData,
            type: input.type,
            title: input.title,
            document: input.document as Prisma.InputJsonValue,
            documentVersion: input.documentVersion,
            documentText: input.documentText,
          },
        });
        await synchronizeInlineReferences(
          transaction,
          created,
          input.inlineTargetIds,
        );
        return toEntry(created);
      });
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
      return client.$transaction(async (transaction) => {
        const existing = await transaction.entry.findUnique({
          where: { id },
        });
        if (!existing) return null;
        if (input.inlineTargetIds !== undefined) {
          await synchronizeInlineReferences(
            transaction,
            existing,
            input.inlineTargetIds,
          );
        }
        return toEntry(
          await transaction.entry.update({
            where: { id },
            data: updateData(input),
          }),
        );
      });
    },
  };
}
