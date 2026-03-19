import { createClient } from "@libsql/client/http";
import fs from "fs";
import path from "path";

const client = createClient({
  url:
    process.env.DB_URL ||
    "https://embarrassing-undertaker-afk.aws-eu-west-1.turso.io",
  authToken: process.env.DB_TOKEN,
});

async function runMigrations() {
  await client.execute({
    sql: `CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at NUMERIC
    )`,
    args: [],
  });

  const migrationsFolder = "./src/db/migrations";
  const sqlFiles = fs
    .readdirSync(migrationsFolder)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of sqlFiles) {
    const sql = fs.readFileSync(path.join(migrationsFolder, file), "utf-8");
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      try {
        await client.execute({ sql: statement + ";", args: [] });
      } catch (e: any) {
        if (e?.message?.includes("already exists")) continue;
        console.error(`Migration error in ${file}:`, e);
        throw e;
      }
    }
    console.log(`Applied migration: ${file}`);
  }

  console.log("All migrations applied.");
}

await runMigrations();
