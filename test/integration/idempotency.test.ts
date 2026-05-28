import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrateDatabase, resetDatabase } from "../helpers/database.js";
import { createHarness, type TestHarness } from "../helpers/harness.js";
import { waitFor } from "../helpers/wait.js";

describe("intake idempotency", () => {
  let harness: TestHarness;

  beforeAll(migrateDatabase);
  beforeEach(async () => {
    await resetDatabase();
    harness = await createHarness({ http: true, dispatcher: true });
  });
  afterEach(async () => {
    await harness.close();
  });

  it("persists exactly one message for a concurrent HTTP burst with the same idempotency key", async () => {
    const baseUrl = harness.baseUrl!;
    const idempotencyKey = "same-http-retry-key";
    const attempts = await Promise.all(
      Array.from({ length: 20 }, async () => {
        const response = await fetch(`${baseUrl}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey
          },
          body: JSON.stringify({
            tenant: "t1",
            participant: "alice",
            body: "retry me",
            idempotencyKey,
            dispatchAgent: true
          })
        });

        if (!response.ok) {
          throw new Error(`POST /messages failed: ${response.status} ${await response.text()}`);
        }

        return (await response.json()) as {
          unitId: string;
          duplicate: boolean;
        };
      })
    );

    const unitIds = new Set(attempts.map((attempt) => attempt.unitId));
    const persisted = await waitFor(
      () => harness.orchestrator.getHistory("t1", attempts[0].unitId),
      (messages) =>
        messages.length === 2 &&
        messages.filter((message) => message.participantKind === "human").length === 1 &&
        messages.filter((message) => message.participantKind === "agent").length === 1
    );

    expect(unitIds.size).toBe(1);
    expect(attempts.filter((attempt) => !attempt.duplicate)).toHaveLength(1);
    expect(persisted).toHaveLength(2);
    expect(persisted[0].position).toBe(1);
    expect(persisted[0].body).toBe("retry me");
    expect(persisted[1].position).toBe(2);
    expect(persisted[1].participantKind).toBe("agent");
    expect(persisted[1].body).toBe("agent echo: retry me");
  });
});
