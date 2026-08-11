import { Router } from "express";
import { z, ZodError } from "zod";

import type {
  DomainRecord,
  WorldCampaignStore,
} from "./world-campaign-store.js";

const resourceInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(5000).nullable().optional(),
  })
  .strict();

const resourceUpdate = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(5000).nullable().optional(),
    isArchived: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

const idParams = z.object({ id: z.uuid() });
const worldIdParams = z.object({ worldId: z.uuid() });
const archiveQuery = z.object({
  archive: z.enum(["active", "archived", "all"]).default("active"),
});

interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  };
}

function validationError(error: ZodError): ApiErrorBody {
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

function notFound(resource: "World" | "Campaign"): ApiErrorBody {
  return {
    error: {
      code: `${resource.toUpperCase()}_NOT_FOUND`,
      message: `${resource} was not found.`,
    },
  };
}

function serialize<T extends DomainRecord>(record: T) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}

export function createWorldCampaignRouter(store: WorldCampaignStore) {
  const router = Router();

  router.post("/worlds", async (request, response) => {
    try {
      const input = parse(resourceInput, request.body);
      response.status(201).json(serialize(await store.createWorld(input)));
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  router.get("/worlds", async (request, response) => {
    try {
      const { archive } = parse(archiveQuery, request.query);
      const worlds = await store.listWorlds(archive);
      response.json({ items: worlds.map(serialize) });
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  router.get("/worlds/:id", async (request, response) => {
    try {
      const { id } = parse(idParams, request.params);
      const world = await store.findWorld(id);
      if (!world) {
        response.status(404).json(notFound("World"));
        return;
      }
      response.json(serialize(world));
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  router.patch("/worlds/:id", async (request, response) => {
    try {
      const { id } = parse(idParams, request.params);
      const input = parse(resourceUpdate, request.body);
      const world = await store.updateWorld(id, input);
      if (!world) {
        response.status(404).json(notFound("World"));
        return;
      }
      response.json(serialize(world));
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  router.post("/worlds/:worldId/campaigns", async (request, response) => {
    try {
      const { worldId } = parse(worldIdParams, request.params);
      const input = parse(resourceInput, request.body);
      const world = await store.findWorld(worldId);
      if (!world) {
        response.status(404).json(notFound("World"));
        return;
      }
      if (world.isArchived) {
        response.status(409).json({
          error: {
            code: "WORLD_ARCHIVED",
            message: "Campaigns cannot be created in an archived World.",
          },
        });
        return;
      }
      response
        .status(201)
        .json(serialize(await store.createCampaign(worldId, input)));
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  router.get("/worlds/:worldId/campaigns", async (request, response) => {
    try {
      const { worldId } = parse(worldIdParams, request.params);
      const { archive } = parse(archiveQuery, request.query);
      const world = await store.findWorld(worldId);
      if (!world) {
        response.status(404).json(notFound("World"));
        return;
      }
      const campaigns =
        world.isArchived && archive === "active"
          ? []
          : await store.listCampaigns(worldId, archive);
      response.json({ items: campaigns.map(serialize) });
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  router.get("/campaigns/:id", async (request, response) => {
    try {
      const { id } = parse(idParams, request.params);
      const campaign = await store.findCampaign(id);
      if (!campaign) {
        response.status(404).json(notFound("Campaign"));
        return;
      }
      response.json(serialize(campaign));
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  router.patch("/campaigns/:id", async (request, response) => {
    try {
      const { id } = parse(idParams, request.params);
      const input = parse(resourceUpdate, request.body);
      const campaign = await store.updateCampaign(id, input);
      if (!campaign) {
        response.status(404).json(notFound("Campaign"));
        return;
      }
      response.json(serialize(campaign));
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
