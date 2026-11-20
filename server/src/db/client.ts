import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

const adapter = new PrismaPg({ connectionString });

/**
 * Global Prisma Client singleton instance configured with PostgreSQL driver adapter.
 */
export const db = new PrismaClient({ adapter });
