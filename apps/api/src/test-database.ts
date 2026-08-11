import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: new URL("../../../.env", import.meta.url), quiet: true });

export function createDedicatedTestDatabase() {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  const developmentDatabaseUrl = process.env.DATABASE_URL;

  if (testDatabaseUrl && testDatabaseUrl === developmentDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL must not match DATABASE_URL");
  }

  return testDatabaseUrl
    ? new PrismaClient({ datasourceUrl: testDatabaseUrl })
    : undefined;
}
