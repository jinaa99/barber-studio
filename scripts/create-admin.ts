/**
 * Creates a staff account.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' npm run admin:create
 *   npm run admin:create            (prompts for anything not set)
 *
 * Optional: ADMIN_NAME, ADMIN_ROLE=ADMIN|STAFF (default ADMIN).
 * Credentials are never stored in the repository; only a scrypt hash is saved.
 */
import { config } from "dotenv";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createStaffUser } from "../src/lib/server/accounts";
import { audit } from "../src/lib/server/audit";

config({ path: [".env.local", ".env"], quiet: true });

async function ask(question: string, hidden = false): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  const answer = rl.question(question);
  muted = hidden;
  const value = await answer;
  rl.close();
  if (hidden) process.stdout.write("\n");
  return value.trim();
}

async function main() {
  const email = process.env.ADMIN_EMAIL || (await ask("Email: "));
  const name = process.env.ADMIN_NAME || (await ask("Name: "));
  const role = process.env.ADMIN_ROLE === "STAFF" ? "STAFF" : "ADMIN";
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await ask("Password (min. 12 characters): ", true);
    if (password !== (await ask("Repeat password: ", true))) throw new Error("Passwords don't match.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    if (await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })) {
      throw new Error(`A user with ${email} already exists.`);
    }
    const user = await createStaffUser(prisma, { email, name, password, role });
    await audit(prisma, { actorId: null, action: "user.created", entityType: "User", entityId: user.id, metadata: { role, via: "cli" } });
    console.log(`Created ${role} account for ${user.email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
