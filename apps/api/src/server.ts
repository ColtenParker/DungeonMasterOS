import { config } from "dotenv";

config({ path: new URL("../../../.env", import.meta.url) });

import { createApp } from "./app.js";
import { databaseHealth, prisma } from "./database.js";
import { createPrismaEntryKnowledgeStore } from "./entry-knowledge-store.js";
import { createPrismaEntryStore } from "./entry-store.js";
import { createPrismaWorldCampaignStore } from "./world-campaign-store.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp({
  database: databaseHealth,
  worldCampaignStore: createPrismaWorldCampaignStore(prisma),
  entryStore: createPrismaEntryStore(prisma),
  entryKnowledgeStore: createPrismaEntryKnowledgeStore(prisma),
});

const server = app.listen(port, () => {
  console.log(`Dungeon Master OS API listening on http://localhost:${port}`);
});

function shutDown() {
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on("SIGINT", shutDown);
process.on("SIGTERM", shutDown);
