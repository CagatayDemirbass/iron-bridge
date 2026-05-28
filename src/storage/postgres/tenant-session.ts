import type { PoolClient } from "pg";
import type { TenantId } from "../../domain/models.js";

export async function bindTenant(client: PoolClient, tenantId: TenantId): Promise<void> {
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
}
