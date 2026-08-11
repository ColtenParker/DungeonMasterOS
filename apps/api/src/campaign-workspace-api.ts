import { Router } from "express";
import { z, ZodError } from "zod";

import {
  MAX_WINDOW_GEOMETRY,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  type CampaignWorkspaceRecord,
  type CampaignWorkspaceStore,
  WorkspaceScopeValidationError,
} from "./campaign-workspace-store.js";

const campaignParams = z.object({ campaignId: z.uuid() });
const windowInput = z
  .object({
    entryId: z.uuid(),
    x: z.int().min(0).max(MAX_WINDOW_GEOMETRY),
    y: z.int().min(0).max(MAX_WINDOW_GEOMETRY),
    width: z.int().min(MIN_WINDOW_WIDTH).max(MAX_WINDOW_GEOMETRY),
    height: z.int().min(MIN_WINDOW_HEIGHT).max(MAX_WINDOW_GEOMETRY),
    zOrder: z.int().min(0).max(2_147_483_647),
    isMinimized: z.boolean(),
  })
  .strict();
const workspaceInput = z
  .object({ windows: z.array(windowInput) })
  .strict()
  .superRefine(({ windows }, context) => {
    const seen = new Set<string>();
    windows.forEach(({ entryId }, index) => {
      if (seen.has(entryId)) {
        context.addIssue({
          code: "custom",
          message: "An Entry can appear only once in a Campaign workspace.",
          path: ["windows", index, "entryId"],
        });
      }
      seen.add(entryId);
    });
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

function serialize(record: CampaignWorkspaceRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function notFound() {
  return {
    error: {
      code: "CAMPAIGN_NOT_FOUND",
      message: "Campaign was not found.",
    },
  };
}

export function createCampaignWorkspaceRouter(store: CampaignWorkspaceStore) {
  const router = Router();

  router.get("/campaigns/:campaignId/workspace", async (request, response) => {
    try {
      const { campaignId } = campaignParams.parse(request.params);
      const workspace = await store.findWorkspace(campaignId);
      if (!workspace) {
        response.status(404).json(notFound());
        return;
      }
      response.json(serialize(workspace));
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      throw error;
    }
  });

  router.put("/campaigns/:campaignId/workspace", async (request, response) => {
    try {
      const { campaignId } = campaignParams.parse(request.params);
      const input = workspaceInput.parse(request.body);
      const workspace = await store.replaceWorkspace(campaignId, input);
      if (!workspace) {
        response.status(404).json(notFound());
        return;
      }
      response.json(serialize(workspace));
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(validationError(error));
        return;
      }
      if (error instanceof WorkspaceScopeValidationError) {
        response.status(422).json({
          error: {
            code: "INVALID_WORKSPACE_ENTRY",
            message: error.message,
          },
        });
        return;
      }
      throw error;
    }
  });

  return router;
}
