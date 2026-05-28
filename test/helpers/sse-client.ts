interface SseMessage {
  event: string;
  data: unknown;
  id?: string;
}

export interface SseClient {
  nextMessage(): Promise<SseMessage>;
  close(): void;
}

export async function openSse(url: string): Promise<SseClient> {
  const controller = new AbortController();
  const response = await fetch(url, { signal: controller.signal });
  if (!response.ok || !response.body) {
    throw new Error(`Unable to open SSE stream: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const queue: SseMessage[] = [];
  const waiters: Array<(message: SseMessage) => void> = [];
  let buffer = "";

  const enqueue = (message: SseMessage) => {
    const waiter = waiters.shift();
    if (waiter) {
      waiter(message);
      return;
    }
    queue.push(message);
  };

  const pump = async () => {
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) {
          break;
        }

        buffer += decoder.decode(chunk.value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");

          const lines = rawEvent.split("\n");
          const event = lines.find((line) => line.startsWith("event: "))?.slice(7) ?? "message";
          const id = lines.find((line) => line.startsWith("id: "))?.slice(4);
          const dataLines = lines
            .filter((line) => line.startsWith("data: "))
            .map((line) => line.slice(6));

          if (dataLines.length === 0) {
            continue;
          }

          enqueue({
            event,
            id,
            data: JSON.parse(dataLines.join("\n"))
          });
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        throw error;
      }
    }
  };

  void pump();

  return {
    nextMessage() {
      const message = queue.shift();
      if (message) {
        return Promise.resolve(message);
      }

      return new Promise<SseMessage>((resolve) => {
        waiters.push(resolve);
      });
    },
    close() {
      controller.abort();
    }
  };
}
