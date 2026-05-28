import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bindTenant } from "../../src/storage/postgres/tenant-session.js";
import { migrateDatabase, resetDatabase } from "../helpers/database.js";
import { createHarness, type TestHarness } from "../helpers/harness.js";

describe("database-level tenant isolation", () => {
  let harness: TestHarness;

  beforeAll(migrateDatabase);
  beforeEach(async () => {
    await resetDatabase();
    harness = await createHarness();
  });
  afterEach(async () => {
    await harness.close();
  });

  async function visibleUnitsFor(tenantId: string): Promise<Array<{ tenant_id: string }>> {
    const client = await harness.pools.appPool.connect();
    try {
      await client.query("BEGIN");
      await bindTenant(client, tenantId);
      const visible = await client.query("SELECT * FROM units_of_work ORDER BY created_at");
      await client.query("COMMIT");
      return visible.rows as Array<{ tenant_id: string }>;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  it("applies RLS to raw SELECT * SQL without an application WHERE clause", async () => {
    await harness.orchestrator.submitMessage({
      tenantId: "tenant-a",
      participantId: "alice",
      participantKind: "human",
      body: "hello from a",
      idempotencyKey: "a-1",
      dispatchAgent: false
    });

    await harness.orchestrator.submitMessage({
      tenantId: "tenant-b",
      participantId: "bob",
      participantKind: "human",
      body: "hello from b",
      idempotencyKey: "b-1",
      dispatchAgent: false
    });

    const tenantAUnits = await visibleUnitsFor("tenant-a");
    const tenantBUnits = await visibleUnitsFor("tenant-b");

    expect(tenantAUnits).toHaveLength(1);
    expect(tenantAUnits.every((row) => row.tenant_id === "tenant-a")).toBe(true);
    expect(tenantBUnits).toHaveLength(1);
    expect(tenantBUnits.every((row) => row.tenant_id === "tenant-b")).toBe(true);
  });
});
