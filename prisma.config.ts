import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Same files Next.js reads, so one `.env.local` serves the app and the CLI.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Read lazily so `prisma generate` (postinstall) works without a database.
    url: process.env.DATABASE_URL ?? "",
  },
});
