import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { readEnv } from "../src/config/env.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(here, "../sql/001_init.sql");
const sql = await readFile(migrationPath, "utf8");
const env = readEnv();
const pool = new Pool({ connectionString: env.adminDatabaseUrl });

try {
  await pool.query(sql);
  console.log("Database migration completed.");
} finally {
  await pool.end();
}
