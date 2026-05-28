import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrateDatabase, resetDatabase } from "../helpers/database.js";
import { createHarness, type TestHarness } from "../helpers/harness.js";
import { openSse, type SseClient } from "../helpers/sse-client.js";

interface PostedMessageResponse {
  unitId: string;
}

async function postMessage(
  baseUrl: string,
  payload: Record<string, unknown>
): Promise<PostedMessageResponse> {
  const response = await fetch(`${baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`POST /messages failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as PostedMessageResponse;
}

describe("server-sent event observers", () => {
  let harness: TestHarness;
  let observers: SseClient[] = [];

  beforeAll(migrateDatabase);
  beforeEach(async () => {
    await resetDatabase();
    harness = await createHarness({ http: true });
  });
  afterEach(async () => {
    for (const observer of observers) {
      observer.close();
    }
    observers = [];
    await harness.close();
  });

  it("delivers every unit message to two observers in the same order", async () => {
    const baseUrl = harness.baseUrl!;
    const seed = await postMessage(baseUrl, {
      tenant: "t1",
      participant: "alice",
      body: "seed",
      idempotencyKey: "seed",
      dispatchAgent: false
    });

    const observerA = await openSse(`${baseUrl}/units/${seed.unitId}/events?tenant=t1`);
    const observerB = await openSse(`${baseUrl}/units/${seed.unitId}/events?tenant=t1`);
    observers.push(observerA, observerB);

    await postMessage(baseUrl, {
      tenant: "t1",
      unitId: seed.unitId,
      participant: "alice",
      body: "first live",
      idempotencyKey: "live-1",
      dispatchAgent: false
    });
    await postMessage(baseUrl, {
      tenant: "t1",
      unitId: seed.unitId,
      participant: "bob",
      body: "second live",
      idempotencyKey: "live-2",
      dispatchAgent: false
    });

    const aMessages = await Promise.all([
      observerA.nextMessage(),
      observerA.nextMessage(),
      observerA.nextMessage()
    ]);
    const bMessages = await Promise.all([
      observerB.nextMessage(),
      observerB.nextMessage(),
      observerB.nextMessage()
    ]);

    const aPositions = aMessages.map((message) => Number((message.data as { position: number }).position));
    const bPositions = bMessages.map((message) => Number((message.data as { position: number }).position));
    const aBodies = aMessages.map((message) => (message.data as { body: string }).body);
    const bBodies = bMessages.map((message) => (message.data as { body: string }).body);

    expect(aPositions).toEqual([1, 2, 3]);
    expect(bPositions).toEqual([1, 2, 3]);
    expect(aBodies).toEqual(["seed", "first live", "second live"]);
    expect(bBodies).toEqual(aBodies);
  });
});
