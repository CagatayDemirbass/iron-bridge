import { Pool } from "pg";
import type { Env } from "../../config/env.js";

export interface Pools {
  appPool: Pool;
  adminPool: Pool;
}

export function createPools(env: Env): Pools {
  return {
    appPool: new Pool({ connectionString: env.databaseUrl }),
    adminPool: new Pool({ connectionString: env.adminDatabaseUrl })
  };
}

export async function closePools(pools: Pools): Promise<void> {
  await Promise.all([pools.appPool.end(), pools.adminPool.end()]);
}
