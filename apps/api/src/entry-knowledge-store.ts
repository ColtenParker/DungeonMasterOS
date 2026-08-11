import {
  type Entry,
  type EntryRelationship,
  Prisma,
  type PrismaClient,
  type Tag,
} from "@prisma/client";

import { type EntryRecord, validateReferenceTargets } from "./entry-store.js";
import type { ArchiveFilter } from "./world-campaign-store.js";

export interface EntrySummary {
  id: string;
  type: EntryRecord["type"];
  title: string;
  worldId: string | null;
  campaignId: string | null;
  isArchived: boolean;
}

export interface RelationshipRecord {
  id: string;
  sourceEntryId: string;
  targetEntryId: string;
  contextNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  source: EntrySummary;
  target: EntrySummary;
}

export interface InlineBacklinkRecord {
  source: EntrySummary;
}

export interface EntryKnowledge {
  outgoing: RelationshipRecord[];
  backlinks: RelationshipRecord[];
  inlineBacklinks: InlineBacklinkRecord[];
}

export interface TagRecord {
  id: string;
  worldId: string;
  name: string;
}

export type SearchScope =
  | { kind: "world"; worldId: string }
  | { kind: "campaign"; campaignId: string; worldId: string }
  | { kind: "global" };

export interface SearchFilters {
  query: string;
  archive: ArchiveFilter;
  type?: EntryRecord["type"] | undefined;
  tag?: string | undefined;
  limit: number;
}

export interface SearchResult extends EntryRecord {
  rank: number;
  tags: TagRecord[];
}

export interface EntryKnowledgeStore {
  createRelationship(
    sourceEntryId: string,
    targetEntryId: string,
    contextNote: string | null,
  ): Promise<RelationshipRecord>;
  updateRelationship(
    sourceEntryId: string,
    relationshipId: string,
    contextNote: string | null,
  ): Promise<RelationshipRecord | null>;
  deleteRelationship(
    sourceEntryId: string,
    relationshipId: string,
  ): Promise<boolean>;
  getKnowledge(entryId: string): Promise<EntryKnowledge | null>;
  listWorldTags(worldId: string, query?: string): Promise<TagRecord[]>;
  listEntryTags(entryId: string): Promise<TagRecord[] | null>;
  replaceEntryTags(
    entryId: string,
    names: string[],
  ): Promise<TagRecord[] | null>;
  search(scope: SearchScope, filters: SearchFilters): Promise<SearchResult[]>;
}

export class RelationshipAlreadyExistsError extends Error {}

const entrySummarySelect = {
  id: true,
  type: true,
  title: true,
  worldId: true,
  campaignId: true,
  isArchived: true,
} as const;

function relationshipRecord(
  relationship: EntryRelationship & { sourceEntry: Entry; targetEntry: Entry },
): RelationshipRecord {
  return {
    id: relationship.id,
    sourceEntryId: relationship.sourceEntryId,
    targetEntryId: relationship.targetEntryId,
    contextNote: relationship.contextNote,
    createdAt: relationship.createdAt,
    updatedAt: relationship.updatedAt,
    source: relationship.sourceEntry,
    target: relationship.targetEntry,
  };
}

function tagRecord(tag: Tag): TagRecord {
  return { id: tag.id, worldId: tag.worldId, name: tag.name };
}

export function normalizeTagName(name: string) {
  return name.trim().normalize("NFKC").toLowerCase();
}

async function entryWorldId(
  transaction: Prisma.TransactionClient,
  entry: Pick<Entry, "worldId" | "campaignId">,
) {
  if (entry.worldId) return entry.worldId;
  if (!entry.campaignId) return null;
  const campaign = await transaction.campaign.findUnique({
    where: { id: entry.campaignId },
    select: { worldId: true },
  });
  return campaign?.worldId ?? null;
}

interface RawSearchEntry {
  id: string;
  type: EntryRecord["type"];
  title: string;
  document: Prisma.JsonValue;
  documentVersion: number;
  documentText: string;
  worldId: string | null;
  campaignId: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  rank: number;
}

function scopeSql(scope: SearchScope) {
  if (scope.kind === "world") {
    return Prisma.sql`e."worldId" = CAST(${scope.worldId} AS uuid)`;
  }
  if (scope.kind === "campaign") {
    return Prisma.sql`(e."campaignId" = CAST(${scope.campaignId} AS uuid) OR e."worldId" = CAST(${scope.worldId} AS uuid))`;
  }
  return Prisma.sql`TRUE`;
}

function archiveSql(archive: ArchiveFilter) {
  if (archive === "archived") return Prisma.sql`e."isArchived" = TRUE`;
  if (archive === "all") return Prisma.sql`TRUE`;
  return Prisma.sql`
    e."isArchived" = FALSE
    AND COALESCE(w."isArchived", cw."isArchived", FALSE) = FALSE
    AND COALESCE(c."isArchived", FALSE) = FALSE
  `;
}

export function createPrismaEntryKnowledgeStore(
  client: PrismaClient,
): EntryKnowledgeStore {
  return {
    async createRelationship(sourceEntryId, targetEntryId, contextNote) {
      try {
        return await client.$transaction(async (transaction) => {
          const source = await transaction.entry.findUnique({
            where: { id: sourceEntryId },
          });
          if (!source) throw new Error("SOURCE_ENTRY_NOT_FOUND");
          await validateReferenceTargets(transaction, source, [targetEntryId]);
          const created = await transaction.entryRelationship.create({
            data: { sourceEntryId, targetEntryId, contextNote },
            include: { sourceEntry: true, targetEntry: true },
          });
          return relationshipRecord(created);
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new RelationshipAlreadyExistsError(
            "That relationship already exists.",
          );
        }
        throw error;
      }
    },
    async updateRelationship(sourceEntryId, relationshipId, contextNote) {
      const existing = await client.entryRelationship.findFirst({
        where: { id: relationshipId, sourceEntryId },
      });
      if (!existing) return null;
      return relationshipRecord(
        await client.entryRelationship.update({
          where: { id: relationshipId },
          data: { contextNote },
          include: { sourceEntry: true, targetEntry: true },
        }),
      );
    },
    async deleteRelationship(sourceEntryId, relationshipId) {
      const deleted = await client.entryRelationship.deleteMany({
        where: { id: relationshipId, sourceEntryId },
      });
      return deleted.count > 0;
    },
    async getKnowledge(entryId) {
      const entry = await client.entry.findUnique({ where: { id: entryId } });
      if (!entry) return null;
      const [outgoing, backlinks, inlineBacklinks] = await Promise.all([
        client.entryRelationship.findMany({
          where: { sourceEntryId: entryId },
          include: { sourceEntry: true, targetEntry: true },
          orderBy: [{ targetEntry: { title: "asc" } }, { id: "asc" }],
        }),
        client.entryRelationship.findMany({
          where: { targetEntryId: entryId },
          include: { sourceEntry: true, targetEntry: true },
          orderBy: [{ sourceEntry: { title: "asc" } }, { id: "asc" }],
        }),
        client.entryInlineReference.findMany({
          where: { targetEntryId: entryId },
          include: { sourceEntry: { select: entrySummarySelect } },
          orderBy: [
            { sourceEntry: { title: "asc" } },
            { sourceEntryId: "asc" },
          ],
        }),
      ]);
      return {
        outgoing: outgoing.map(relationshipRecord),
        backlinks: backlinks.map(relationshipRecord),
        inlineBacklinks: inlineBacklinks.map(({ sourceEntry }) => ({
          source: sourceEntry,
        })),
      };
    },
    async listWorldTags(worldId, query) {
      const tags = await client.tag.findMany({
        where: {
          worldId,
          ...(query
            ? { name: { contains: query, mode: "insensitive" as const } }
            : {}),
        },
        orderBy: [{ normalizedName: "asc" }, { id: "asc" }],
        take: 50,
      });
      return tags.map(tagRecord);
    },
    async listEntryTags(entryId) {
      const entry = await client.entry.findUnique({ where: { id: entryId } });
      if (!entry) return null;
      const assignments = await client.entryTag.findMany({
        where: { entryId },
        include: { tag: true },
        orderBy: [{ tag: { normalizedName: "asc" } }, { tagId: "asc" }],
      });
      return assignments.map(({ tag }) => tagRecord(tag));
    },
    async replaceEntryTags(entryId, names) {
      return client.$transaction(async (transaction) => {
        const entry = await transaction.entry.findUnique({
          where: { id: entryId },
        });
        if (!entry) return null;
        const worldId = await entryWorldId(transaction, entry);
        if (!worldId) return null;
        const uniqueNames = new Map<string, string>();
        names.forEach((name) =>
          uniqueNames.set(normalizeTagName(name), name.trim()),
        );
        const tags: Tag[] = [];
        for (const [normalizedName, name] of uniqueNames) {
          tags.push(
            await transaction.tag.upsert({
              where: { worldId_normalizedName: { worldId, normalizedName } },
              create: { worldId, normalizedName, name },
              update: {},
            }),
          );
        }
        await transaction.entryTag.deleteMany({ where: { entryId } });
        if (tags.length) {
          await transaction.entryTag.createMany({
            data: tags.map((tag) => ({ entryId, tagId: tag.id })),
          });
        }
        return tags
          .sort((left, right) =>
            left.normalizedName.localeCompare(right.normalizedName),
          )
          .map(tagRecord);
      });
    },
    async search(scope, filters) {
      const typePredicate = filters.type
        ? Prisma.sql`e."type" = CAST(${filters.type} AS "EntryType")`
        : Prisma.sql`TRUE`;
      const tagPredicate = filters.tag
        ? Prisma.sql`EXISTS (
            SELECT 1 FROM "EntryTag" et_filter
            JOIN "Tag" tag_filter ON tag_filter."id" = et_filter."tagId"
            WHERE et_filter."entryId" = e."id"
              AND tag_filter."normalizedName" = ${normalizeTagName(filters.tag)}
          )`
        : Prisma.sql`TRUE`;
      const query = filters.query;
      const rankSql = query
        ? Prisma.sql`
            CASE WHEN lower(e."title") = lower(${query}) THEN 100 ELSE 0 END +
            CASE WHEN left(lower(e."title"), length(lower(${query}))) = lower(${query}) THEN 50 ELSE 0 END +
            CASE WHEN EXISTS (
              SELECT 1 FROM "EntryTag" et_rank
              JOIN "Tag" tag_rank ON tag_rank."id" = et_rank."tagId"
              WHERE et_rank."entryId" = e."id"
                AND to_tsvector('simple', tag_rank."name") @@ websearch_to_tsquery('simple', ${query})
            ) THEN 25 ELSE 0 END +
            ts_rank(e."searchVector", websearch_to_tsquery('simple', ${query})) * 10
          `
        : Prisma.sql`0`;
      const queryPredicate = query
        ? Prisma.sql`(
            lower(e."title") = lower(${query})
            OR left(lower(e."title"), length(lower(${query}))) = lower(${query})
            OR e."searchVector" @@ websearch_to_tsquery('simple', ${query})
            OR EXISTS (
              SELECT 1 FROM "EntryTag" et_match
              JOIN "Tag" tag_match ON tag_match."id" = et_match."tagId"
              WHERE et_match."entryId" = e."id"
                AND to_tsvector('simple', tag_match."name") @@ websearch_to_tsquery('simple', ${query})
            )
          )`
        : Prisma.sql`TRUE`;
      const records = await client.$queryRaw<RawSearchEntry[]>(Prisma.sql`
        SELECT
          e."id", e."type", e."title", e."document", e."documentVersion",
          e."documentText", e."worldId", e."campaignId", e."isArchived",
          e."createdAt", e."updatedAt",
          (${rankSql})::double precision AS rank
        FROM "Entry" e
        LEFT JOIN "World" w ON w."id" = e."worldId"
        LEFT JOIN "Campaign" c ON c."id" = e."campaignId"
        LEFT JOIN "World" cw ON cw."id" = c."worldId"
        WHERE ${scopeSql(scope)}
          AND ${archiveSql(filters.archive)}
          AND ${typePredicate}
          AND ${tagPredicate}
          AND ${queryPredicate}
        ORDER BY rank DESC, lower(e."title"), e."id"
        LIMIT ${filters.limit}
      `);
      const entryIds = records.map(({ id }) => id);
      const assignments = entryIds.length
        ? await client.entryTag.findMany({
            where: { entryId: { in: entryIds } },
            include: { tag: true },
          })
        : [];
      const tagsByEntry = new Map<string, TagRecord[]>();
      assignments.forEach(({ entryId, tag }) => {
        const tags = tagsByEntry.get(entryId) ?? [];
        tags.push(tagRecord(tag));
        tagsByEntry.set(entryId, tags);
      });
      return records.map((record) => ({
        ...record,
        document: record.document as EntryRecord["document"],
        tags: (tagsByEntry.get(record.id) ?? []).sort((left, right) =>
          left.name.localeCompare(right.name, undefined, {
            sensitivity: "base",
          }),
        ),
      }));
    },
  };
}
