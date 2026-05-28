import type { Message } from "../domain/models.js";

export interface Agent {
  respondTo(message: Message): Promise<string>;
}
