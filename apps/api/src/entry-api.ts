import { Router } from "express";
import { z, ZodError } from "zod";

import {
  EMPTY_ENTRY_DOCUMENT,
  ENTRY_DOCUMENT_VERSION,
  EntryDocumentValidationError,
  validateEntryDocument,
} from "./entry-document.js";
import type { EntryRecord, EntryStore } from "./entry-store.js";
import type { WorldCampaignStore } from "./world-campaign-store.js";

const entryType = z.enum(["NPC", "LOCATION", "JOURNAL"]);
const documentSchema = z.unknown().transform((value, context) => {
  try {
    return validateEntryDocument(value);
  } catch (error) {
    context.addIssue({
      code: "custom",
      message:
        error instanceof EntryDocumentValidationError
          ? error.message
          : "The document is invalid.",
    });
    return z.NEVER;
  }
});
const entryInput = z
  .object({
    type: entryType,
    title: z.string().trim().min(1).max(120),
    document: documentSchema.default(EMPTY_ENTRY_DOCUMENT),
  })
  .strict();
const campaignEntryInput = entryInput.extend({
  scope: z.enum(["campaign", "world"]).default("campaign"),
});
const entryUpdate = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    document: documentSchema.optional(),
    isArchived: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
const idParams = z.object({ id: z.uuid() });
const worldIdParams = z.object({ worldId: z.uuid() });
const campaignIdParams = z.object({ campaignId: z.uuid() });
const entryQuery = z.object({
  archive: z.enum(["active", "archived", "all"]).default("active"),
  type: entryType.optional(),
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

function notFound(resource: "World" | "Campaign" | "Entry") {
  return {
    error: {
      code: `${resource.toUpperCase()}_NOT_FOUND`,
      message: `${resource} was not found.`,
    },
  };
}

function archivedScope(scope: "World" | "Campaign") {
  return {
    error: {
      code: `${scope.toUpperCase()}_ARCHIVED`,
      message: `Entries cannot be created in an archived ${scope}.`,
    },
  };
}

function serialize(record: EntryRecord) {
  const scope = record.worldId
    ? { kind: "world" as const, id: record.worldId }
    : record.campaignId
      ? { kind: "campaign" as const, id: record.campaignId }
      : undefined;
  if (!scope) {
    throw new Error("Entry scope invariant was violated.");
  }
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    document: record.document,
    documentVersion: record.documentVersion,
    scope,
    isArchived: record.isArchived,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function createEntryRouter(
  entryStore: EntryStore,
  worldCampaignStore: WorldCampaignStore,
) {
  const router = Router();

  router.post("/worlds/:worldId/entries", async (request, response) => {
    try {
      const { worldId } = worldIdParams.parse(request.params);
      const input = entryInput.parse(request.body);
      const world = await worldCampaignStore.findWorld(worldId);
      if (!world) {
        response.status(404).json(notFound("World"));
        return;
      }
      if (world.isArchived) {
        response.status(409).json(archivedScope("World"));
        return;
      }
      const created = await entryStore.createEntry(
        { kind: "world", worldId },
        { ...input, documentVersion: ENTRY_DOCUMENT_VERSION },
      );
      response.status(201).json(serialize(created));
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  router.get("/worlds/:worldId/entries", async (request, response) => {
    try {
      const { worldId } = worldIdParams.parse(request.params);
      const filters = entryQuery.parse(request.query);
      const world = await worldCampaignStore.findWorld(worldId);
      if (!world) {
        response.status(404).json(notFound("World"));
        return;
      }
      const items =
        world.isArchived && filters.archive === "active"
          ? []
          : await entryStore.listWorldEntries(worldId, filters);
      response.json({ items: items.map(serialize) });
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  router.post("/campaigns/:campaignId/entries", async (request, response) => {
    try {
      const { campaignId } = campaignIdParams.parse(request.params);
      const input = campaignEntryInput.parse(request.body);
      const campaign = await worldCampaignStore.findCampaign(campaignId);
      if (!campaign) {
        response.status(404).json(notFound("Campaign"));
        return;
      }
      const world = await worldCampaignStore.findWorld(campaign.worldId);
      if (!world) {
        response.status(404).json(notFound("World"));
        return;
      }
      if (world.isArchived) {
        response.status(409).json(archivedScope("World"));
        return;
      }
      if (campaign.isArchived) {
        response.status(409).json(archivedScope("Campaign"));
        return;
      }
      const { scope, ...entryData } = input;
      const entryScope =
        scope === "world"
          ? { kind: "world" as const, worldId: world.id }
          : { kind: "campaign" as const, campaignId };
      const created = await entryStore.createEntry(entryScope, {
        ...entryData,
        documentVersion: ENTRY_DOCUMENT_VERSION,
      });
      response.status(201).json(serialize(created));
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  router.get("/campaigns/:campaignId/entries", async (request, response) => {
    try {
      const { campaignId } = campaignIdParams.parse(request.params);
      const filters = entryQuery.parse(request.query);
      const campaign = await worldCampaignStore.findCampaign(campaignId);
      if (!campaign) {
        response.status(404).json(notFound("Campaign"));
        return;
      }
      const world = await worldCampaignStore.findWorld(campaign.worldId);
      if (!world) {
        response.status(404).json(notFound("World"));
        return;
      }
      const items =
        (world.isArchived || campaign.isArchived) &&
        filters.archive === "active"
          ? []
          : await entryStore.listCampaignEntries(campaignId, world.id, filters);
      response.json({ items: items.map(serialize) });
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  router.get("/entries/:id", async (request, response) => {
    try {
      const { id } = idParams.parse(request.params);
      const entry = await entryStore.findEntry(id);
      if (!entry) {
        response.status(404).json(notFound("Entry"));
        return;
      }
      response.json(serialize(entry));
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  router.patch("/entries/:id", async (request, response) => {
    try {
      const { id } = idParams.parse(request.params);
      const input = entryUpdate.parse(request.body);
      const entry = await entryStore.updateEntry(id, {
        ...input,
        ...(input.document === undefined
          ? {}
          : { documentVersion: ENTRY_DOCUMENT_VERSION }),
      });
      if (!entry) {
        response.status(404).json(notFound("Entry"));
        return;
      }
      response.json(serialize(entry));
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
