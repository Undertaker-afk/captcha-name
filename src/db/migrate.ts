import { createExecuteQuery } from "@kilocode/app-builder-db";
import fs from "fs";
import path from "path";

const executeQuery = createExecuteQuery();

async function runSql(sql: string) {
  await executeQuery(sql, [], "run");
}

async function runMigrations() {
  const migrationsTableSql = `CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL,
    created_at NUMERIC
  )`;

  await runSql(migrationsTableSql);

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
        await runSql(statement + ";");
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
