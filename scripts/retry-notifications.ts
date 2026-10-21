/**
 * Retries confirmation emails that failed or were skipped because no provider
 * was configured at the time. Run it from a scheduler (cron) or by hand:
 *
 *   npm run notifications:retry
 *
 * Only appointments that haven't started yet are retried, and each
 * notification is attempted at most 5 times in total.
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { deliverNotification, emailProviderFromEnv } from "../src/lib/server/notifications";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const provider = emailProviderFromEnv();
  if (!provider) {
    console.log("No email provider is configured (EMAIL_PROVIDER, RESEND_API_KEY, EMAIL_FROM). Nothing to do.");
    return;
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const due = await prisma.notification.findMany({
      where: {
        status: { in: ["PENDING", "FAILED", "SKIPPED"] },
        attempts: { lt: 5 },
        appointment: { startsAt: { gt: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } },
      },
      select: { id: true },
    });
    const outcomes: Record<string, number> = {};
    for (const { id } of due) {
      const status = await deliverNotification(prisma, id, provider);
      outcomes[status] = (outcomes[status] ?? 0) + 1;
    }
    console.log(`Processed ${due.length} notifications`, outcomes);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
