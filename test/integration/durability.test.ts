import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrateDatabase, resetDatabase } from "../helpers/database.js";
import { createHarness } from "../helpers/harness.js";
import { waitFor } from "../helpers/wait.js";

describe("durability across process restarts", () => {
  beforeAll(migrateDatabase);
  beforeEach(resetDatabase);

  it("recovers persisted history and pending agent work after recreating the service", async () => {
    const first = await createHarness();
    const submitted = await first.orchestrator.submitMessage({
      tenantId: "t1",
      participantId: "alice",
      participantKind: "human",
      body: "survive restart",
      idempotencyKey: "before-restart",
      dispatchAgent: true
    });
    await first.close();

    const restarted = await createHarness({ dispatcher: true });
    try {
      const recovered = await waitFor(
        () => restarted.orchestrator.getHistory("t1", submitted.unitId),
        (messages) => messages.length === 2
      );

      expect(recovered.map((message) => message.position)).toEqual([1, 2]);
      expect(recovered[0].body).toBe("survive restart");
      expect(recovered[1].participantKind).toBe("agent");

      const next = await restarted.orchestrator.submitMessage({
        tenantId: "t1",
        unitId: submitted.unitId,
        participantId: "alice",
        participantKind: "human",
        body: "continue",
        idempotencyKey: "after-restart",
        dispatchAgent: false
      });

      expect(next.message.position).toBe(3);
    } finally {
      await restarted.close();
    }
  });
});
