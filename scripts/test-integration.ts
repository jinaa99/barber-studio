/**
 * Runs tests/integration against a dedicated PostgreSQL database.
 *
 *   TEST_DATABASE_URL=postgresql://…/studio08_test npm run test:integration
 *
 * The tests empty every table between cases, so this refuses to run unless
 * the database name contains "test" and differs from DATABASE_URL. Pending
 * migrations are applied first with `prisma migrate deploy` (never a reset).
 */
import { config } from "dotenv";
import { spawnSync } from "node:child_process";

config({ path: [".env.local", ".env"], quiet: true });

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("TEST_DATABASE_URL is not set. Run `npm run db:local` for a local server, or point it at an empty test database.");
  process.exit(1);
}
const name = new URL(url).pathname.slice(1);
if (!/test/i.test(name) || url === process.env.DATABASE_URL) {
  console.error(`Refusing to run: "${name}" doesn't look like a dedicated test database.`);
  process.exit(1);
}

const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: url, NODE_ENV: "test" };
const run = (command: string, args: string[]) => {
  const result = spawnSync(command, args, { stdio: "inherit", env, shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["tsx", "--conditions=react-server", "--test", "--test-concurrency=1", "tests/integration/*.test.ts"]);
