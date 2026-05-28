import type {
  AgentJob,
  Message,
  TenantId,
  UnitOfWorkId,
  UnitSummary
} from "../domain/models.js";
import type { SubmitMessageCommand } from "./intake-contract.js";

export interface AppendMessageResult {
  message: Message;
  unitId: UnitOfWorkId;
  duplicate: boolean;
  agentJobCreated: boolean;
}

export interface UnitStore {
  appendMessage(command: SubmitMessageCommand): Promise<AppendMessageResult>;
  listUnits(tenantId: TenantId): Promise<UnitSummary[]>;
  getHistory(tenantId: TenantId, unitId: UnitOfWorkId): Promise<Message[]>;
  recoverStaleAgentJobs(staleAfterMs: number): Promise<number>;
  leaseNextAgentJob(): Promise<AgentJob | null>;
  completeAgentJob(jobId: string, completedMessageId: string): Promise<void>;
  failAgentJob(jobId: string, error: string): Promise<void>;
}
