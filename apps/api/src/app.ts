import express from "express";

import { createCampaignWorkspaceRouter } from "./campaign-workspace-api.js";
import type { CampaignWorkspaceStore } from "./campaign-workspace-store.js";
import type { DatabaseHealth } from "./database.js";
import { createEntryKnowledgeRouter } from "./entry-knowledge-api.js";
import type { EntryKnowledgeStore } from "./entry-knowledge-store.js";
import { createEntryRouter } from "./entry-api.js";
import type { EntryStore } from "./entry-store.js";
import { createWorldCampaignRouter } from "./world-campaign-api.js";
import type { WorldCampaignStore } from "./world-campaign-store.js";

export interface AppDependencies {
  database: DatabaseHealth;
  worldCampaignStore: WorldCampaignStore;
  entryStore: EntryStore;
  entryKnowledgeStore?: EntryKnowledgeStore;
  campaignWorkspaceStore?: CampaignWorkspaceStore;
}

export function createApp({
  database,
  worldCampaignStore,
  entryStore,
  entryKnowledgeStore,
  campaignWorkspaceStore,
}: AppDependencies) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1100kb" }));

  app.get("/api/health/live", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/api/health/ready", async (_request, response) => {
    try {
      await database.checkConnection();
      response.json({ status: "ready" });
    } catch {
      response.status(503).json({ status: "unavailable" });
    }
  });

  app.use("/api", createWorldCampaignRouter(worldCampaignStore));
  app.use("/api", createEntryRouter(entryStore, worldCampaignStore));
  if (campaignWorkspaceStore) {
    app.use("/api", createCampaignWorkspaceRouter(campaignWorkspaceStore));
  }
  if (entryKnowledgeStore) {
    app.use(
      "/api",
      createEntryKnowledgeRouter(
        entryKnowledgeStore,
        entryStore,
        worldCampaignStore,
      ),
    );
  }

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      next: express.NextFunction,
    ) => {
      void next;
      if (error instanceof SyntaxError && "body" in error) {
        response.status(400).json({
          error: {
            code: "MALFORMED_JSON",
            message: "The request body is not valid JSON.",
          },
        });
        return;
      }

      if (
        error &&
        typeof error === "object" &&
        "type" in error &&
        error.type === "entity.too.large"
      ) {
        response.status(413).json({
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: "The request body is too large.",
          },
        });
        return;
      }

      response.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred.",
        },
      });
    },
  );

  return app;
}
