import { Router } from "express";
import { z, ZodError } from "zod";

import {
  RelationshipAlreadyExistsError,
  type EntryKnowledgeStore,
  type EntrySummary,
  type RelationshipRecord,
  type SearchResult,
  type TagRecord,
} from "./entry-knowledge-store.js";
import {
  EntryReferenceValidationError,
  type EntryStore,
} from "./entry-store.js";
import type { WorldCampaignStore } from "./world-campaign-store.js";

const entryType = z.enum([
  "NPC",
  "LOCATION",
  "JOURNAL",
  "QUEST",
  "FACTION",
  "ITEM",
]);
const entryIdParams = z.object({ entryId: z.uuid() });
const relationshipParams = z.object({
  entryId: z.uuid(),
  relationshipId: z.uuid(),
});
const worldIdParams = z.object({ worldId: z.uuid() });
const campaignIdParams = z.object({ campaignId: z.uuid() });
const relationshipInput = z
  .object({
    targetEntryId: z.uuid(),
    contextNote: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();
const relationshipUpdate = z
  .object({ contextNote: z.string().trim().max(1000).nullable() })
  .strict();
const tagName = z.string().trim().min(1).max(50);
const tagCollection = z.object({ tags: z.array(tagName) }).strict();
const tagQuery = z.object({ q: z.string().trim().max(50).optional() });
const searchQuery = z
  .object({
    q: z.string().trim().max(200).default(""),
    archive: z.enum(["active", "archived", "all"]).default("active"),
    type: entryType.optional(),
    tag: tagName.optional(),
    status: z.string().trim().min(1).max(80).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((value) => value.q.length > 0 || value.tag !== undefined, {
    message: "A search query or tag filter is required.",
  });

function validationError(error: ZodError) {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "request";
    (fields[key] ??= []).push(issue.message);
  }
  return {
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      fields,
    },
  };
}

function notFound(resource: "World" | "Campaign" | "Entry" | "Relationship") {
  return {
    error: {
      code: `${resource.toUpperCase()}_NOT_FOUND`,
      message: `${resource} was not found.`,
    },
  };
}

function serializeSummary(entry: EntrySummary) {
  const scope = entry.worldId
    ? { kind: "world" as const, id: entry.worldId }
    : { kind: "campaign" as const, id: entry.campaignId as string };
  return {
    id: entry.id,
    type: entry.type,
    title: entry.title,
    scope,
    isArchived: entry.isArchived,
  };
}

function serializeRelationship(relationship: RelationshipRecord) {
  return {
    id: relationship.id,
    sourceEntryId: relationship.sourceEntryId,
    targetEntryId: relationship.targetEntryId,
    contextNote: relationship.contextNote,
    source: serializeSummary(relationship.source),
    target: serializeSummary(relationship.target),
    createdAt: relationship.createdAt.toISOString(),
    updatedAt: relationship.updatedAt.toISOString(),
  };
}

function serializeTag(tag: TagRecord) {
  return { id: tag.id, worldId: tag.worldId, name: tag.name };
}

function serializeSearchResult(result: SearchResult) {
  return {
    id: result.id,
    type: result.type,
    title: result.title,
    document: result.document,
    documentVersion: result.documentVersion,
    scope: result.worldId
      ? { kind: "world" as const, id: result.worldId }
      : { kind: "campaign" as const, id: result.campaignId as string },
    isArchived: result.isArchived,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
    rank: result.rank,
    tags: result.tags.map(serializeTag),
  };
}

export function createEntryKnowledgeRouter(
  knowledgeStore: EntryKnowledgeStore,
  entryStore: EntryStore,
  worldCampaignStore: WorldCampaignStore,
) {
  const router = Router();

  router.post("/entries/:entryId/relationships", async (request, response) => {
    try {
      const { entryId } = entryIdParams.parse(request.params);
      const input = relationshipInput.parse(request.body);
      if (!(await entryStore.findEntry(entryId))) {
        response.status(404).json(notFound("Entry"));
        return;
      }
      const relationship = await knowledgeStore.createRelationship(
        entryId,
        input.targetEntryId,
        input.contextNote || null,
      );
      response.status(201).json(serializeRelationship(relationship));
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      if (error instanceof EntryReferenceValidationError) {
        response.status(400).json({
          error: { code: "REFERENCE_VALIDATION_ERROR", message: error.message },
        });
        return;
      }
      if (error instanceof RelationshipAlreadyExistsError) {
        response.status(409).json({
          error: { code: "RELATIONSHIP_EXISTS", message: error.message },
        });
        return;
      }
      throw error;
    }
  });

  router.patch(
    "/entries/:entryId/relationships/:relationshipId",
    async (request, response) => {
      try {
        const { entryId, relationshipId } = relationshipParams.parse(
          request.params,
        );
        const input = relationshipUpdate.parse(request.body);
        const updated = await knowledgeStore.updateRelationship(
          entryId,
          relationshipId,
          input.contextNote || null,
        );
        if (!updated) {
          response.status(404).json(notFound("Relationship"));
          return;
        }
        response.json(serializeRelationship(updated));
      } catch (error) {
        if (error instanceof ZodError) {
          response.status(400).json(validationError(error));
          return;
        }
        throw error;
      }
    },
  );

  router.delete(
    "/entries/:entryId/relationships/:relationshipId",
    async (request, response) => {
      try {
        const { entryId, relationshipId } = relationshipParams.parse(
          request.params,
        );
        if (
          !(await knowledgeStore.deleteRelationship(entryId, relationshipId))
        ) {
          response.status(404).json(notFound("Relationship"));
          return;
        }
        response.status(204).send();
      } catch (error) {
        if (error instanceof ZodError) {
          response.status(400).json(validationError(error));
          return;
        }
        throw error;
      }
    },
  );

  router.get("/entries/:entryId/knowledge", async (request, response) => {
    try {
      const { entryId } = entryIdParams.parse(request.params);
      const knowledge = await knowledgeStore.getKnowledge(entryId);
      if (!knowledge) {
        response.status(404).json(notFound("Entry"));
        return;
      }
      response.json({
        outgoing: knowledge.outgoing.map(serializeRelationship),
        backlinks: [
          ...knowledge.backlinks.map((relationship) => ({
            kind: "relationship" as const,
            relationship: serializeRelationship(relationship),
            source: serializeSummary(relationship.source),
          })),
          ...knowledge.inlineBacklinks.map(({ source }) => ({
            kind: "inline" as const,
            source: serializeSummary(source),
          })),
          ...(knowledge.typedBacklinks ?? []).map(({ source, label }) => ({
            kind: "specialized" as const,
            source: serializeSummary(source),
            label,
          })),
        ],
      });
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  router.get("/worlds/:worldId/tags", async (request, response) => {
    try {
      const { worldId } = worldIdParams.parse(request.params);
      const { q } = tagQuery.parse(request.query);
      if (!(await worldCampaignStore.findWorld(worldId))) {
        response.status(404).json(notFound("World"));
        return;
      }
      const tags = await knowledgeStore.listWorldTags(worldId, q);
      response.json({ items: tags.map(serializeTag) });
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  router.get("/entries/:entryId/tags", async (request, response) => {
    try {
      const { entryId } = entryIdParams.parse(request.params);
      const tags = await knowledgeStore.listEntryTags(entryId);
      if (!tags) {
        response.status(404).json(notFound("Entry"));
        return;
      }
      response.json({ items: tags.map(serializeTag) });
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  router.put("/entries/:entryId/tags", async (request, response) => {
    try {
      const { entryId } = entryIdParams.parse(request.params);
      const { tags: names } = tagCollection.parse(request.body);
      const tags = await knowledgeStore.replaceEntryTags(entryId, names);
      if (!tags) {
        response.status(404).json(notFound("Entry"));
        return;
      }
      response.json({ items: tags.map(serializeTag) });
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  router.get("/worlds/:worldId/search", async (request, response) => {
    try {
      const { worldId } = worldIdParams.parse(request.params);
      const { q, ...filters } = searchQuery.parse(request.query);
      if (!(await worldCampaignStore.findWorld(worldId))) {
        response.status(404).json(notFound("World"));
        return;
      }
      const items = await knowledgeStore.search(
        { kind: "world", worldId },
        { query: q, ...filters },
      );
      response.json({ items: items.map(serializeSearchResult) });
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  router.get("/campaigns/:campaignId/search", async (request, response) => {
    try {
      const { campaignId } = campaignIdParams.parse(request.params);
      const { q, ...filters } = searchQuery.parse(request.query);
      const campaign = await worldCampaignStore.findCampaign(campaignId);
      if (!campaign) {
        response.status(404).json(notFound("Campaign"));
        return;
      }
      const items = await knowledgeStore.search(
        { kind: "campaign", campaignId, worldId: campaign.worldId },
        { query: q, ...filters },
      );
      response.json({ items: items.map(serializeSearchResult) });
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  router.get("/search", async (request, response) => {
    try {
      const { q, ...filters } = searchQuery.parse(request.query);
      const items = await knowledgeStore.search(
        { kind: "global" },
        { query: q, ...filters },
      );
      response.json({ items: items.map(serializeSearchResult) });
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  return router;
}
