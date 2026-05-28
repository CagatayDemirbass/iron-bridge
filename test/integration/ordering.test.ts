import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrateDatabase, resetDatabase } from "../helpers/database.js";
import { createHarness, type TestHarness } from "../helpers/harness.js";
import { waitFor } from "../helpers/wait.js";

describe("concurrent ordering", () => {
  let harness: TestHarness;

  beforeAll(migrateDatabase);
  beforeEach(async () => {
    await resetDatabase();
    harness = await createHarness({ dispatcher: true });
  });
  afterEach(async () => {
    await harness.close();
  });

  it("assigns gap-free monotonic positions under concurrent input and agent responses", async () => {
    const seed = await harness.orchestrator.submitMessage({
      tenantId: "t1",
      participantId: "alice",
      participantKind: "human",
      body: "seed",
      idempotencyKey: "seed",
      dispatchAgent: false
    });

    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        harness.orchestrator.submitMessage({
          tenantId: "t1",
          unitId: seed.unitId,
          participantId: `human-${index}`,
          participantKind: "human",
          body: `msg-${index}`,
          idempotencyKey: `concurrent-${index}`,
          dispatchAgent: true
        })
      )
    );

    const history = await waitFor(
      () => harness.orchestrator.getHistory("t1", seed.unitId),
      (messages) =>
        messages.length === 41 &&
        messages.filter((message) => message.participantKind === "agent").length === 20
    );

    expect(history.map((message) => message.position)).toEqual(
      Array.from({ length: history.length }, (_, index) => index + 1)
    );
    expect(new Set(history.map((message) => message.position)).size).toBe(history.length);
    expect(history.filter((message) => message.body.startsWith("msg-"))).toHaveLength(20);
    expect(history.filter((message) => message.participantKind === "agent")).toHaveLength(20);
  });
});
