import express from "express";

import type { DatabaseHealth } from "./database.js";

export function createApp(database: DatabaseHealth) {
  const app = express();

  app.disable("x-powered-by");

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

  return app;
}
