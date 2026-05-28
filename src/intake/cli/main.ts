import { randomUUID } from "node:crypto";
import { StubAgent } from "../../agent/stub-agent.js";
import { AgentDispatcher } from "../../application/agent-dispatcher.js";
import { Orchestrator } from "../../application/orchestrator.js";
import { InMemoryRealtimeBus } from "../../realtime/event-bus.js";
import { readEnv } from "../../config/env.js";
import { closePools, createPools } from "../../storage/postgres/pool.js";
import { PostgresUnitStore } from "../../storage/postgres/unit-store.pg.js";

interface CliOptions {
  tenant?: string;
  participant?: string;
  body?: string;
  unitId?: string;
  kind: "human" | "agent" | "system";
  idempotencyKey: string;
  dispatchAgent: boolean;
  transport: "http" | "direct";
  url: string;
}

interface SubmitResponse {
  unitId: string;
  duplicate: boolean;
  agentJobCreated: boolean;
  idempotencyKey: string;
  message: {
    id: string;
    tenantId: string;
    unitId: string;
    position: number;
    participantId: string;
    participantKind: "human" | "agent" | "system";
    body: string;
    causationMessageId: string | null;
    createdAt: string;
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function usage(): string {
  return [
    "Usage:",
    "  npm run intake:cli -- --tenant t1 --participant alice --body \"hello\"",
    "",
    "Options:",
    "  --tenant <id>              Required tenant identifier",
    "  --participant <id>         Required participant identifier",
    "  --body <text>              Required message body",
    "  --unit-id <uuid>           Attach to an existing unit",
    "  --kind <human|agent|system>",
    "  --idempotency-key <key>    Defaults to cli:<uuid>",
    "  --no-agent                 Do not dispatch the agent stub",
    "  --transport <http|direct>  Defaults to http",
    "  --url <origin>             Defaults to http://127.0.0.1:3000"
  ].join("\n");
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    kind: "human",
    idempotencyKey: `cli:${randomUUID()}`,
    dispatchAgent: true,
    transport: "http",
    url: "http://127.0.0.1:3000"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${arg}`);
      }
      index += 1;
      return value;
    };

    switch (arg) {
      case "--tenant":
        options.tenant = next();
        break;
      case "--participant":
        options.participant = next();
        break;
      case "--body":
        options.body = next();
        break;
      case "--unit":
      case "--unit-id":
        options.unitId = next();
        break;
      case "--kind": {
        const kind = next();
        if (!["human", "agent", "system"].includes(kind)) {
          throw new Error("--kind must be human, agent, or system");
        }
        options.kind = kind as CliOptions["kind"];
        break;
      }
      case "--idempotency-key":
        options.idempotencyKey = next();
        break;
      case "--no-agent":
        options.dispatchAgent = false;
        break;
      case "--transport": {
        const transport = next();
        if (!["http", "direct"].includes(transport)) {
          throw new Error("--transport must be http or direct");
        }
        options.transport = transport as CliOptions["transport"];
        break;
      }
      case "--url":
        options.url = next().replace(/\/$/, "");
        break;
      case "--help":
      case "-h":
        console.log(usage());
        process.exit(0);
      default:
        throw new Error(`Unknown option ${arg}`);
    }
  }

  if (!options.tenant || !options.participant || !options.body) {
    throw new Error("Missing required --tenant, --participant, or --body");
  }

  return options;
}

async function submitViaHttp(options: CliOptions): Promise<SubmitResponse> {
  const response = await fetch(`${options.url}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": options.idempotencyKey
    },
    body: JSON.stringify({
      tenant: options.tenant,
      participant: options.participant,
      participantKind: options.kind,
      body: options.body,
      unitId: options.unitId,
      idempotencyKey: options.idempotencyKey,
      dispatchAgent: options.dispatchAgent
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`HTTP intake failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload as SubmitResponse;
}

async function submitDirect(options: CliOptions): Promise<SubmitResponse> {
  const pools = createPools(readEnv());
  const store = new PostgresUnitStore(pools.appPool, pools.adminPool);
  const realtime = new InMemoryRealtimeBus();
  const orchestrator = new Orchestrator(store, realtime);
  const dispatcher = new AgentDispatcher(store, orchestrator, new StubAgent(), {
    pollIntervalMs: 25,
    staleAfterMs: 250
  });

  try {
    dispatcher.start();
    const result = await orchestrator.submitMessage({
      tenantId: options.tenant!,
      participantId: options.participant!,
      participantKind: options.kind,
      body: options.body!,
      unitId: options.unitId,
      idempotencyKey: options.idempotencyKey,
      dispatchAgent: options.dispatchAgent
    });

    if (options.dispatchAgent && result.agentJobCreated) {
      await waitForAgentResponse(orchestrator, options.tenant!, result.unitId, result.message.id);
    }

    return {
      unitId: result.unitId,
      duplicate: result.duplicate,
      agentJobCreated: result.agentJobCreated,
      idempotencyKey: options.idempotencyKey,
      message: {
        ...result.message,
        createdAt: result.message.createdAt.toISOString()
      }
    };
  } finally {
    dispatcher.stop();
    await closePools(pools);
  }
}

async function waitForAgentResponse(
  orchestrator: Orchestrator,
  tenantId: string,
  unitId: string,
  causationMessageId: string
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 5_000) {
    const history = await orchestrator.getHistory(tenantId, unitId);
    const hasResponse = history.some(
      (message) =>
        message.participantKind === "agent" && message.causationMessageId === causationMessageId
    );
    if (hasResponse) {
      return;
    }

    await sleep(25);
  }

  throw new Error("Timed out waiting for direct agent response");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const result =
    options.transport === "http" ? await submitViaHttp(options) : await submitDirect(options);

  console.log(
    JSON.stringify(
      {
        transport: options.transport,
        unitId: result.unitId,
        position: result.message.position,
        duplicate: result.duplicate,
        agentJobCreated: result.agentJobCreated,
        idempotencyKey: result.idempotencyKey,
        participant: result.message.participantId,
        body: result.message.body
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  console.error("");
  console.error(usage());
  process.exitCode = 1;
});
