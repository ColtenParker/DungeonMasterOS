import express from "express";

import type { DatabaseHealth } from "./database.js";
import { createWorldCampaignRouter } from "./world-campaign-api.js";
import type { WorldCampaignStore } from "./world-campaign-store.js";

export interface AppDependencies {
  database: DatabaseHealth;
  worldCampaignStore: WorldCampaignStore;
}

export function createApp({ database, worldCampaignStore }: AppDependencies) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));

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
