import type { Agent } from "./agent-port.js";
import type { Orchestrator } from "./orchestrator.js";
import type { UnitStore } from "./unit-store.js";

interface AgentDispatcherOptions {
  pollIntervalMs?: number;
  staleAfterMs?: number;
  concurrency?: number;
  agentParticipantId?: string;
  onError?: (error: unknown) => void;
}

export class AgentDispatcher {
  private timer: NodeJS.Timeout | null = null;
  private active = 0;
  private ticking = false;

  constructor(
    private readonly store: UnitStore,
    private readonly orchestrator: Orchestrator,
    private readonly agent: Agent,
    private readonly options: AgentDispatcherOptions = {}
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }

    void this.safeTick();
    this.timer = setInterval(() => void this.safeTick(), this.options.pollIntervalMs ?? 50);
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    if (this.ticking) {
      return;
    }

    this.ticking = true;
    try {
      await this.store.recoverStaleAgentJobs(this.options.staleAfterMs ?? 2_000);

      const concurrency = this.options.concurrency ?? 4;
      while (this.active < concurrency) {
        const job = await this.store.leaseNextAgentJob();
        if (!job) {
          break;
        }

        this.active += 1;
        void this.handleJob(job).finally(() => {
          this.active -= 1;
        });
      }
    } finally {
      this.ticking = false;
    }
  }

  async safeTick(): Promise<void> {
    try {
      await this.tick();
    } catch (error) {
      this.options.onError?.(error);
    }
  }

  private async handleJob(job: Awaited<ReturnType<UnitStore["leaseNextAgentJob"]>>): Promise<void> {
    if (!job) {
      return;
    }

    try {
      const body = await this.agent.respondTo(job.triggerMessage);
      const result = await this.orchestrator.submitMessage({
        tenantId: job.tenantId,
        unitId: job.unitId,
        participantId: this.options.agentParticipantId ?? "agent-stub",
        participantKind: "agent",
        body,
        causationMessageId: job.triggerMessageId,
        idempotencyKey: `agent-job:${job.id}`,
        dispatchAgent: false
      });
      await this.store.completeAgentJob(job.id, result.message.id);
    } catch (error) {
      await this.store.failAgentJob(job.id, error instanceof Error ? error.message : String(error));
    }
  }
}
