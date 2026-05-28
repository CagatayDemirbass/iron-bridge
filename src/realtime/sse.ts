import type { FastifyReply, FastifyRequest } from "fastify";
import type { Orchestrator } from "../application/orchestrator.js";
import type { RealtimeBus } from "../application/realtime-port.js";
import type { Message, TenantId, UnitOfWorkId } from "../domain/models.js";

function serializeMessage(message: Message): string {
  return JSON.stringify({
    ...message,
    createdAt: message.createdAt.toISOString()
  });
}

function writeSseMessage(reply: FastifyReply, message: Message): void {
  reply.raw.write(`id: ${message.position}\n`);
  reply.raw.write("event: message\n");
  reply.raw.write(`data: ${serializeMessage(message)}\n\n`);
}

export async function streamUnitEvents(
  request: FastifyRequest,
  reply: FastifyReply,
  orchestrator: Orchestrator,
  realtime: RealtimeBus,
  tenantId: TenantId,
  unitId: UnitOfWorkId
): Promise<void> {
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });

  reply.raw.write(": connected\n\n");

  const live = realtime.subscribe(tenantId, unitId);
  const iterator = live[Symbol.asyncIterator]();
  request.raw.on("close", () => {
    void iterator.return?.();
  });

  let lastPosition = 0;
  const history = await orchestrator.getHistory(tenantId, unitId);
  for (const message of history) {
    writeSseMessage(reply, message);
    lastPosition = Math.max(lastPosition, message.position);
  }

  try {
    while (!reply.raw.destroyed) {
      const next = await iterator.next();
      if (next.done) {
        break;
      }

      if (next.value.position <= lastPosition) {
        continue;
      }

      writeSseMessage(reply, next.value);
      lastPosition = next.value.position;
    }
  } finally {
    void iterator.return?.();
    reply.raw.end();
  }
}
