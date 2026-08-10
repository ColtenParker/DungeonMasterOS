import "dotenv/config";

import { createApp } from "./app.js";
import { databaseHealth, prisma } from "./database.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp(databaseHealth);

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
