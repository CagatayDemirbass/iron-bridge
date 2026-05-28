import { StubAgent } from "./agent/stub-agent.js";
import { AgentDispatcher } from "./application/agent-dispatcher.js";
import { Orchestrator } from "./application/orchestrator.js";
import { readEnv } from "./config/env.js";
import { InMemoryRealtimeBus } from "./realtime/event-bus.js";
import { buildServer } from "./intake/http/server.js";
import { createPools, closePools } from "./storage/postgres/pool.js";
import { PostgresUnitStore } from "./storage/postgres/unit-store.pg.js";

const env = readEnv();
const pools = createPools(env);
const store = new PostgresUnitStore(pools.appPool, pools.adminPool);
const realtime = new InMemoryRealtimeBus();
const orchestrator = new Orchestrator(store, realtime);
const app = await buildServer({ orchestrator, realtime });
let lastDispatcherErrorLogAt = 0;
const dispatcher = new AgentDispatcher(store, orchestrator, new StubAgent(), {
  onError: (error) => {
    const now = Date.now();
    if (now - lastDispatcherErrorLogAt < 5_000) {
      return;
    }

    lastDispatcherErrorLogAt = now;
    app.log.error({ error }, "Agent dispatcher tick failed; will retry")
  }
});

dispatcher.start();

const shutdown = async () => {
  dispatcher.stop();
  await app.close();
  await closePools(pools);
};

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

await app.listen({ port: env.port, host: "0.0.0.0" });
