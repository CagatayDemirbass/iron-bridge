import type { Message } from "../domain/models.js";
import type { Agent } from "../application/agent-port.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class StubAgent implements Agent {
  async respondTo(message: Message): Promise<string> {
    await sleep(100);
    return `agent echo: ${message.body}`;
  }
}
