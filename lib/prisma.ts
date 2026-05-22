import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const DB_URL = process.env.DATABASE_URL ?? "file:///home/user/cesam/dev.db";

function createPrismaClient() {
  const adapter = new PrismaLibSql({ url: DB_URL });
  return new PrismaClient({ adapter } as Parameters<typeof PrismaClient>[0]);
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
