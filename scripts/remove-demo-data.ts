/**
 * Removes the seed's sample appointments and demo customers, leaving every
 * real booking, customer, service and barber untouched.
 *
 *   npm run db:remove-demo -- --yes
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  if (!process.argv.includes("--yes")) {
    console.log("This deletes sample appointments (isDemo) and demo customers. Re-run with --yes to confirm.");
    return;
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const appointments = await prisma.appointment.deleteMany({ where: { isDemo: true } });
    const customers = await prisma.customer.deleteMany({ where: { isDemo: true, appointments: { none: {} } } });
    console.log(`Removed ${appointments.count} sample appointments and ${customers.count} demo customers.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
