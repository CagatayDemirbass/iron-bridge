import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { StubAgent } from "../../src/agent/stub-agent.js";
import { AgentDispatcher } from "../../src/application/agent-dispatcher.js";
import { Orchestrator } from "../../src/application/orchestrator.js";
import { readEnv } from "../../src/config/env.js";
import { buildServer } from "../../src/intake/http/server.js";
import { InMemoryRealtimeBus } from "../../src/realtime/event-bus.js";
import { closePools, createPools, type Pools } from "../../src/storage/postgres/pool.js";
import { PostgresUnitStore } from "../../src/storage/postgres/unit-store.pg.js";

interface HarnessOptions {
  http?: boolean;
  dispatcher?: boolean;
}

export interface TestHarness {
  pools: Pools;
  store: PostgresUnitStore;
  realtime: InMemoryRealtimeBus;
  orchestrator: Orchestrator;
  dispatcher: AgentDispatcher;
  app?: FastifyInstance;
  baseUrl?: string;
  close(): Promise<void>;
}

export async function createHarness(options: HarnessOptions = {}): Promise<TestHarness> {
  const pools = createPools(readEnv());
  const store = new PostgresUnitStore(pools.appPool, pools.adminPool);
  const realtime = new InMemoryRealtimeBus();
  const orchestrator = new Orchestrator(store, realtime);
  const dispatcher = new AgentDispatcher(store, orchestrator, new StubAgent(), {
    pollIntervalMs: 25,
    staleAfterMs: 250,
    concurrency: 8
  });
  const app = options.http ? await buildServer({ orchestrator, realtime }) : undefined;

  let baseUrl: string | undefined;
  if (app) {
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  if (options.dispatcher) {
    dispatcher.start();
  }

  return {
    pools,
    store,
    realtime,
    orchestrator,
    dispatcher,
    app,
    baseUrl,
    async close() {
      dispatcher.stop();
      if (app) {
        await app.close();
      }
      await closePools(pools);
    }
  };
}
