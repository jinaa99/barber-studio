import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/*
 * One Prisma client per server process. In development the module is
 * re-evaluated on every edit, so the instance is parked on globalThis to
 * avoid opening a new connection pool each time.
 */

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and point it at PostgreSQL.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const globalForPrisma = globalThis as unknown as { studio08Prisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.studio08Prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.studio08Prisma = db;

export type Db = PrismaClient;
