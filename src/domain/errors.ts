export class UnitNotFoundError extends Error {
  constructor(unitId: string) {
    super(`Unit of work not found: ${unitId}`);
    this.name = "UnitNotFoundError";
  }
}

export class IncompleteIdempotencyRecordError extends Error {
  constructor(idempotencyKey: string) {
    super(`Idempotency record has no persisted message: ${idempotencyKey}`);
    this.name = "IncompleteIdempotencyRecordError";
  }
}
