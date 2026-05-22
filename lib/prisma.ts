import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const DB_URL = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

function createPrismaClient() {
  const adapter = new PrismaLibSql({
    url: DB_URL,
    ...(AUTH_TOKEN ? { authToken: AUTH_TOKEN } : {}),
  });
  return new PrismaClient({ adapter } as never);
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
