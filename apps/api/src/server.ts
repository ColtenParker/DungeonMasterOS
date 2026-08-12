import { config } from "dotenv";

config({ path: new URL("../../../.env", import.meta.url) });

import { createApp } from "./app.js";
import { createPrismaCampaignWorkspaceStore } from "./campaign-workspace-store.js";
import { databaseHealth, prisma } from "./database.js";
import { createPrismaEntryKnowledgeStore } from "./entry-knowledge-store.js";
import { createPrismaEntryStore } from "./entry-store.js";
import { createPrismaMediaStore } from "./media-store.js";
import { createPrismaWorldCampaignStore } from "./world-campaign-store.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp({
  database: databaseHealth,
  worldCampaignStore: createPrismaWorldCampaignStore(prisma),
  entryStore: createPrismaEntryStore(prisma),
  entryKnowledgeStore: createPrismaEntryKnowledgeStore(prisma),
  campaignWorkspaceStore: createPrismaCampaignWorkspaceStore(prisma),
  mediaStore: createPrismaMediaStore(prisma),
});

const server = app.listen(port, () => {
  console.log(`Dungeon Master OS API listening on http://localhost:${port}`);
});

let shuttingDown = false;

function shutDown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const forceExit = setTimeout(() => process.exit(1), 5_000);
  forceExit.unref();
  server.closeAllConnections();
  server.close(() => {
    void prisma.$disconnect().finally(() => {
      clearTimeout(forceExit);
      process.exit(0);
    });
  });
}

process.on("SIGINT", shutDown);
process.on("SIGTERM", shutDown);
