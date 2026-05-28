import type { Message, TenantId, UnitOfWorkId } from "../domain/models.js";

export interface RealtimeBus {
  publish(message: Message): void;
  subscribe(tenantId: TenantId, unitId: UnitOfWorkId): AsyncIterable<Message>;
}
