import type { Message, TenantId, UnitOfWorkId } from "../domain/models.js";
import type { RealtimeBus } from "../application/realtime-port.js";

class AsyncMessageQueue implements AsyncIterable<Message> {
  private readonly buffered: Message[] = [];
  private readonly waiters: Array<(value: IteratorResult<Message>) => void> = [];
  private closed = false;

  push(message: Message): void {
    if (this.closed) {
      return;
    }

    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value: message, done: false });
      return;
    }

    this.buffered.push(message);
  }

  close(): void {
    this.closed = true;
    for (const waiter of this.waiters.splice(0)) {
      waiter({ value: undefined, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<Message> {
    return {
      next: () => {
        const message = this.buffered.shift();
        if (message) {
          return Promise.resolve({ value: message, done: false });
        }

        if (this.closed) {
          return Promise.resolve({ value: undefined, done: true });
        }

        return new Promise<IteratorResult<Message>>((resolve) => {
          this.waiters.push(resolve);
        });
      },
      return: () => {
        this.close();
        return Promise.resolve({ value: undefined, done: true });
      }
    };
  }
}

export class InMemoryRealtimeBus implements RealtimeBus {
  private readonly subscribers = new Map<string, Set<AsyncMessageQueue>>();

  publish(message: Message): void {
    const subscribers = this.subscribers.get(this.key(message.tenantId, message.unitId));
    if (!subscribers) {
      return;
    }

    for (const subscriber of subscribers) {
      subscriber.push(message);
    }
  }

  subscribe(tenantId: TenantId, unitId: UnitOfWorkId): AsyncIterable<Message> {
    const key = this.key(tenantId, unitId);
    const queue = new AsyncMessageQueue();
    const subscribers = this.subscribers.get(key) ?? new Set<AsyncMessageQueue>();
    subscribers.add(queue);
    this.subscribers.set(key, subscribers);

    return {
      [Symbol.asyncIterator]: async function* () {
        try {
          for await (const message of queue) {
            yield message;
          }
        } finally {
          queue.close();
          subscribers.delete(queue);
        }
      }
    };
  }

  private key(tenantId: TenantId, unitId: UnitOfWorkId): string {
    return `${tenantId}:${unitId}`;
  }
}
