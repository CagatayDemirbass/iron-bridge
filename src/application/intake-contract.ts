import type {
  IdempotencyKey,
  MessageId,
  ParticipantId,
  ParticipantKind,
  TenantId,
  UnitOfWorkId
} from "../domain/models.js";

export interface SubmitMessageCommand {
  tenantId: TenantId;
  participantId: ParticipantId;
  participantKind: ParticipantKind;
  body: string;
  unitId?: UnitOfWorkId;
  idempotencyKey?: IdempotencyKey;
  causationMessageId?: MessageId;
  dispatchAgent?: boolean;
}
