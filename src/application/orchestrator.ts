import type { Message, TenantId, UnitOfWorkId, UnitSummary } from "../domain/models.js";
import type { SubmitMessageCommand } from "./intake-contract.js";
import type { RealtimeBus } from "./realtime-port.js";
import type { AppendMessageResult, UnitStore } from "./unit-store.js";

export class Orchestrator {
  constructor(
    private readonly store: UnitStore,
    private readonly realtime: RealtimeBus
  ) {}

  async submitMessage(command: SubmitMessageCommand): Promise<AppendMessageResult> {
    const result = await this.store.appendMessage(command);

    if (!result.duplicate) {
      this.realtime.publish(result.message);
    }

    return result;
  }

  getHistory(tenantId: TenantId, unitId: UnitOfWorkId): Promise<Message[]> {
    return this.store.getHistory(tenantId, unitId);
  }

  listUnits(tenantId: TenantId): Promise<UnitSummary[]> {
    return this.store.listUnits(tenantId);
  }
}
