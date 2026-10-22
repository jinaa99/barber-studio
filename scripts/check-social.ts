/**
 * Keeps the connected social accounts healthy. Run it daily from a scheduler
 * (cron) or by hand:
 *
 *   npm run social:check
 *
 * Refreshes the Instagram token once it is a week old (Meta's long-lived
 * tokens last 60 days and must be refreshed before they expire), then asks
 * Meta whether each stored connection still works. A connection whose token
 * expired or was revoked is flagged for reconnecting in the dashboard.
 * Prints outcomes only; tokens are never printed.
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { checkConnection, metaApi, refreshInstagramToken, socialConfig } from "../src/lib/server/social";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const settings = socialConfig();
  const api = metaApi(settings);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const refreshed = settings.instagram ? await refreshInstagramToken(prisma, api) : "not_configured";
    const facebook = settings.facebook ? await checkConnection(prisma, api, settings, "facebook") : "not_configured";
    const instagram = settings.instagram ? await checkConnection(prisma, api, settings, "instagram") : "not_configured";
    console.log("Social accounts:", { facebook, instagram, instagramTokenRefresh: refreshed });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Social check failed.");
  process.exitCode = 1;
});
