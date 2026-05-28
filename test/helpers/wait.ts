export async function waitFor<T>(
  load: () => Promise<T>,
  accept: (value: T) => boolean,
  timeoutMs = 10_000
): Promise<T> {
  const startedAt = Date.now();
  let lastValue = await load();

  while (!accept(lastValue)) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for condition. Last value: ${JSON.stringify(lastValue)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
    lastValue = await load();
  }

  return lastValue;
}
