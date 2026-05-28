import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { readEnv } from "../../src/config/env.js";

const env = readEnv();

export async function migrateDatabase(): Promise<void> {
  const pool = new Pool({ connectionString: env.adminDatabaseUrl });
  try {
    const sql = await readFile(resolve("sql/001_init.sql"), "utf8");
    await pool.query(sql);
  } finally {
    await pool.end();
  }
}

export async function resetDatabase(): Promise<void> {
  const pool = new Pool({ connectionString: env.adminDatabaseUrl });
  try {
    await pool.query(
      "TRUNCATE agent_jobs, messages, intake_requests, units_of_work, tenants CASCADE"
    );
  } finally {
    await pool.end();
  }
}
