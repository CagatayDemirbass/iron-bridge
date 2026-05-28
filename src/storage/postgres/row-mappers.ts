import type { AgentJob, Message } from "../../domain/models.js";

interface MessageRow {
  id: string;
  tenant_id: string;
  unit_id: string;
  position: string | number;
  participant_id: string;
  participant_kind: "human" | "agent" | "system";
  body: string;
  causation_message_id: string | null;
  created_at: Date;
}

export function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    unitId: row.unit_id,
    position: Number(row.position),
    participantId: row.participant_id,
    participantKind: row.participant_kind,
    body: row.body,
    causationMessageId: row.causation_message_id,
    createdAt: row.created_at
  };
}

export function mapAgentJob(row: MessageRow & {
  job_id: string;
  job_tenant_id: string;
  job_unit_id: string;
  trigger_message_id: string;
  attempts: number;
}): AgentJob {
  return {
    id: row.job_id,
    tenantId: row.job_tenant_id,
    unitId: row.job_unit_id,
    triggerMessageId: row.trigger_message_id,
    attempts: row.attempts,
    triggerMessage: mapMessage(row)
  };
}
