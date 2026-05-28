export type TenantId = string;
export type ParticipantId = string;
export type UnitOfWorkId = string;
export type MessageId = string;
export type IdempotencyKey = string;

export type ParticipantKind = "human" | "agent" | "system";

export interface UnitOfWork {
  id: UnitOfWorkId;
  tenantId: TenantId;
  status: "open";
  nextPosition: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UnitSummary {
  id: UnitOfWorkId;
  tenantId: TenantId;
  status: "open";
  messageCount: number;
  lastMessageBody: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: MessageId;
  tenantId: TenantId;
  unitId: UnitOfWorkId;
  position: number;
  participantId: ParticipantId;
  participantKind: ParticipantKind;
  body: string;
  causationMessageId: MessageId | null;
  createdAt: Date;
}

export interface AgentJob {
  id: string;
  tenantId: TenantId;
  unitId: UnitOfWorkId;
  triggerMessageId: MessageId;
  triggerMessage: Message;
  attempts: number;
}
