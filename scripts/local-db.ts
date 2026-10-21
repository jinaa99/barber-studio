/**
 * Development-only PostgreSQL server, for machines without Postgres or Docker.
 *
 *   npm run db:local
 *
 * Starts PostgreSQL from the `embedded-postgres` binaries on port 5433, with
 * data kept in `.data/postgres` (git-ignored) between runs. It creates the
 * `studio08` and `studio08_test` databases on first start and never deletes
 * anything. Stop it with Ctrl-C. Credentials are local placeholders: never
 * reuse them for a real deployment.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const port = Number(process.env.LOCAL_DB_PORT ?? 5433);
const databaseDir = path.resolve(".data/postgres");
const firstRun = !existsSync(path.join(databaseDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir,
  port,
  user: "studio08",
  password: "studio08-local",
  persistent: true,
  onLog: () => {},
});

async function main() {
  if (firstRun) await pg.initialise();
  await pg.start();

  const client = pg.getPgClient("postgres");
  await client.connect();
  for (const name of ["studio08", "studio08_test"]) {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (!rowCount) await pg.createDatabase(name);
  }
  await client.end();

  console.log(`PostgreSQL is running on port ${port}.`);
  console.log(`  DATABASE_URL=postgresql://studio08:studio08-local@localhost:${port}/studio08`);
  console.log(`  TEST_DATABASE_URL=postgresql://studio08:studio08-local@localhost:${port}/studio08_test`);
  console.log("Press Ctrl-C to stop.");

  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch(async (error) => {
  console.error(error);
  await pg.stop().catch(() => {});
  process.exit(1);
});
