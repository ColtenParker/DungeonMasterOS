import { PrismaClient } from "@prisma/client";

export interface DatabaseHealth {
  checkConnection: () => Promise<void>;
}

export const prisma = new PrismaClient();

export const databaseHealth: DatabaseHealth = {
  async checkConnection() {
    await prisma.$queryRaw`SELECT 1`;
  },
};
