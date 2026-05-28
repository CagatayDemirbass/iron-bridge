import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { IncompleteIdempotencyRecordError, UnitNotFoundError } from "../../domain/errors.js";
import type {
  AgentJob,
  Message,
  TenantId,
  UnitOfWorkId,
  UnitSummary
} from "../../domain/models.js";
import type { SubmitMessageCommand } from "../../application/intake-contract.js";
import type { AppendMessageResult, UnitStore } from "../../application/unit-store.js";
import { bindTenant } from "./tenant-session.js";
import { mapAgentJob, mapMessage } from "./row-mappers.js";

const MAX_GENERATED_ID_ATTEMPTS = 5;

interface IntakeRow {
  id: string;
  unit_id: string | null;
  message_id: string | null;
}

interface UnitRow {
  id: string;
  next_position: string | number;
}

interface UnitSummaryRow {
  id: string;
  tenant_id: string;
  status: "open";
  message_count: string | number;
  last_message_body: string | null;
  last_message_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class PostgresUnitStore implements UnitStore {
  constructor(
    private readonly appPool: Pool,
    private readonly adminPool: Pool
  ) {}

  async appendMessage(command: SubmitMessageCommand): Promise<AppendMessageResult> {
    const client = await this.appPool.connect();

    try {
      await client.query("BEGIN");
      await bindTenant(client, command.tenantId);
      await this.ensureTenant(client, command.tenantId);

      const intake = command.idempotencyKey
        ? await this.claimIdempotencyKey(client, command.tenantId, command.idempotencyKey)
        : null;

      if (intake?.message_id) {
        const message = await this.getMessageById(client, intake.message_id);
        await client.query("COMMIT");
        return {
          message,
          unitId: message.unitId,
          duplicate: true,
          agentJobCreated: false
        };
      }

      if (intake && !intake.id) {
        throw new IncompleteIdempotencyRecordError(command.idempotencyKey ?? "");
      }

      const unit = command.unitId
        ? await this.lockExistingUnit(client, command.unitId)
        : await this.createUnit(client, command.tenantId);

      const position = Number(unit.next_position);
      const messageId = randomUUID();
      const intakeRequestId = intake?.id ?? null;

      const inserted = await client.query(
        `
        INSERT INTO messages (
          id,
          tenant_id,
          unit_id,
          position,
          participant_id,
          participant_kind,
          body,
          causation_message_id,
          intake_request_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING
          id,
          tenant_id,
          unit_id,
          position,
          participant_id,
          participant_kind,
          body,
          causation_message_id,
          created_at
        `,
        [
          messageId,
          command.tenantId,
          unit.id,
          position,
          command.participantId,
          command.participantKind,
          command.body,
          command.causationMessageId ?? null,
          intakeRequestId
        ]
      );

      await client.query(
        `
        UPDATE units_of_work
        SET next_position = next_position + 1,
            updated_at = now()
        WHERE id = $1
        `,
        [unit.id]
      );

      if (intakeRequestId) {
        await client.query(
          `
          UPDATE intake_requests
          SET unit_id = $1,
              message_id = $2
          WHERE id = $3
          `,
          [unit.id, messageId, intakeRequestId]
        );
      }

      const shouldCreateAgentJob =
        command.dispatchAgent === true && command.participantKind === "human";

      let agentJobCreated = false;
      if (shouldCreateAgentJob) {
        const job = await client.query(
          `
          INSERT INTO agent_jobs (id, tenant_id, unit_id, trigger_message_id)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (tenant_id, trigger_message_id) DO NOTHING
          RETURNING id
          `,
          [randomUUID(), command.tenantId, unit.id, messageId]
        );
        agentJobCreated = job.rowCount === 1;
      }

      await client.query("COMMIT");

      return {
        message: mapMessage(inserted.rows[0]),
        unitId: unit.id,
        duplicate: false,
        agentJobCreated
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async listUnits(tenantId: TenantId): Promise<UnitSummary[]> {
    const client = await this.appPool.connect();

    try {
      await client.query("BEGIN");
      await bindTenant(client, tenantId);
      const result = await client.query<UnitSummaryRow>(
        `
        SELECT
          u.id,
          u.tenant_id,
          u.status,
          COUNT(message.id)::integer AS message_count,
          latest.body AS last_message_body,
          latest.created_at AS last_message_at,
          u.created_at,
          u.updated_at
        FROM units_of_work AS u
        LEFT JOIN messages AS message ON message.unit_id = u.id
        LEFT JOIN LATERAL (
          SELECT body, created_at
          FROM messages
          WHERE unit_id = u.id
          ORDER BY position DESC
          LIMIT 1
        ) AS latest ON true
        GROUP BY
          u.id,
          u.tenant_id,
          u.status,
          u.created_at,
          u.updated_at,
          latest.body,
          latest.created_at
        ORDER BY COALESCE(latest.created_at, u.updated_at) DESC, u.created_at DESC
        LIMIT 25
        `
      );
      await client.query("COMMIT");
      return result.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        status: row.status,
        messageCount: Number(row.message_count),
        lastMessageBody: row.last_message_body,
        lastMessageAt: row.last_message_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async getHistory(tenantId: TenantId, unitId: UnitOfWorkId): Promise<Message[]> {
    const client = await this.appPool.connect();

    try {
      await client.query("BEGIN");
      await bindTenant(client, tenantId);
      const result = await client.query(
        `
        SELECT
          id,
          tenant_id,
          unit_id,
          position,
          participant_id,
          participant_kind,
          body,
          causation_message_id,
          created_at
        FROM messages
        WHERE unit_id = $1
        ORDER BY position ASC
        `,
        [unitId]
      );
      await client.query("COMMIT");
      return result.rows.map(mapMessage);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async recoverStaleAgentJobs(staleAfterMs: number): Promise<number> {
    const result = await this.adminPool.query(
      `
      UPDATE agent_jobs
      SET status = 'pending',
          locked_at = NULL,
          updated_at = now()
      WHERE status = 'running'
        AND locked_at < now() - ($1::integer * interval '1 millisecond')
      `,
      [staleAfterMs]
    );
    return result.rowCount ?? 0;
  }

  async leaseNextAgentJob(): Promise<AgentJob | null> {
    const result = await this.adminPool.query(
      `
      WITH picked AS (
        SELECT id
        FROM agent_jobs
        WHERE status = 'pending'
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      ),
      leased AS (
        UPDATE agent_jobs AS job
        SET status = 'running',
            attempts = attempts + 1,
            locked_at = now(),
            updated_at = now()
        FROM picked
        WHERE job.id = picked.id
        RETURNING
          job.id AS job_id,
          job.tenant_id AS job_tenant_id,
          job.unit_id AS job_unit_id,
          job.trigger_message_id,
          job.attempts
      )
      SELECT
        leased.*,
        msg.id,
        msg.tenant_id,
        msg.unit_id,
        msg.position,
        msg.participant_id,
        msg.participant_kind,
        msg.body,
        msg.causation_message_id,
        msg.created_at
      FROM leased
      JOIN messages AS msg ON msg.id = leased.trigger_message_id
      `
    );

    return result.rowCount === 1 ? mapAgentJob(result.rows[0]) : null;
  }

  async completeAgentJob(jobId: string, completedMessageId: string): Promise<void> {
    await this.adminPool.query(
      `
      UPDATE agent_jobs
      SET status = 'completed',
          completed_message_id = $2,
          updated_at = now()
      WHERE id = $1
      `,
      [jobId, completedMessageId]
    );
  }

  async failAgentJob(jobId: string, error: string): Promise<void> {
    await this.adminPool.query(
      `
      UPDATE agent_jobs
      SET status = 'failed',
          last_error = $2,
          updated_at = now()
      WHERE id = $1
      `,
      [jobId, error.slice(0, 1000)]
    );
  }

  private async ensureTenant(client: PoolClient, tenantId: TenantId): Promise<void> {
    await client.query(
      `
      INSERT INTO tenants (id)
      VALUES ($1)
      ON CONFLICT (id) DO NOTHING
      `,
      [tenantId]
    );
  }

  private async claimIdempotencyKey(
    client: PoolClient,
    tenantId: TenantId,
    idempotencyKey: string
  ): Promise<IntakeRow> {
    const result = await client.query<IntakeRow>(
      `
      INSERT INTO intake_requests (id, tenant_id, idempotency_key)
      VALUES ($1, $2, $3)
      ON CONFLICT (tenant_id, idempotency_key)
      DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
      RETURNING id, unit_id, message_id
      `,
      [randomUUID(), tenantId, idempotencyKey]
    );

    return result.rows[0];
  }

  private async createUnit(client: PoolClient, tenantId: TenantId): Promise<UnitRow> {
    for (let attempt = 0; attempt < MAX_GENERATED_ID_ATTEMPTS; attempt += 1) {
      const result = await client.query<UnitRow>(
        `
        INSERT INTO units_of_work (id, tenant_id)
        VALUES ($1, $2)
        ON CONFLICT (id) DO NOTHING
        RETURNING id, next_position
        `,
        [randomUUID(), tenantId]
      );

      if (result.rowCount === 1) {
        return result.rows[0];
      }
    }

    throw new Error("Unable to generate a unique unit id");
  }

  private async lockExistingUnit(client: PoolClient, unitId: UnitOfWorkId): Promise<UnitRow> {
    const result = await client.query<UnitRow>(
      `
      SELECT id, next_position
      FROM units_of_work
      WHERE id = $1
      FOR UPDATE
      `,
      [unitId]
    );

    if (result.rowCount !== 1) {
      throw new UnitNotFoundError(unitId);
    }

    return result.rows[0];
  }

  private async getMessageById(client: PoolClient, messageId: string): Promise<Message> {
    const result = await client.query(
      `
      SELECT
        id,
        tenant_id,
        unit_id,
        position,
        participant_id,
        participant_kind,
        body,
        causation_message_id,
        created_at
      FROM messages
      WHERE id = $1
      `,
      [messageId]
    );

    if (result.rowCount !== 1) {
      throw new Error(`Idempotent message not visible: ${messageId}`);
    }

    return mapMessage(result.rows[0]);
  }
}
