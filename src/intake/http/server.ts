import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { UnitNotFoundError } from "../../domain/errors.js";
import type { Orchestrator } from "../../application/orchestrator.js";
import type { RealtimeBus } from "../../application/realtime-port.js";
import { streamUnitEvents } from "../../realtime/sse.js";
import { renderDashboard } from "./dashboard.js";
import {
  submitMessageBodySchema,
  tenantQuerySchema,
  unitParamsSchema
} from "./validation.js";

interface ServerDeps {
  orchestrator: Orchestrator;
  realtime: RealtimeBus;
}

export async function buildServer(deps: ServerDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
    disableRequestLogging: true
  });
  await app.register(cors);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      void reply.status(400).send({
        error: "InvalidRequest",
        issues: error.issues
      });
      return;
    }

    if (error instanceof UnitNotFoundError) {
      void reply.status(404).send({
        error: "UnitNotFound",
        message: error.message
      });
      return;
    }

    app.log.error(error);
    void reply.status(500).send({
      error: "InternalServerError"
    });
  });

  app.get("/health", async () => ({ ok: true }));

  app.get("/", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderDashboard());
  });

  app.post("/messages", async (request, reply) => {
    const body = submitMessageBodySchema.parse(request.body);
    const headerKey = request.headers["idempotency-key"];
    const idempotencyKey =
      body.idempotencyKey ??
      (Array.isArray(headerKey) ? headerKey[0] : headerKey) ??
      `generated:${randomUUID()}`;

    const dispatchAgent =
      body.dispatchAgent ?? (body.participantKind === "human" ? true : false);

    const result = await deps.orchestrator.submitMessage({
      tenantId: body.tenant,
      participantId: body.participant,
      participantKind: body.participantKind,
      body: body.body,
      unitId: body.unitId,
      idempotencyKey,
      dispatchAgent
    });

    return reply.status(result.duplicate ? 200 : 201).send({
      unitId: result.unitId,
      message: {
        ...result.message,
        createdAt: result.message.createdAt.toISOString()
      },
      duplicate: result.duplicate,
      agentJobCreated: result.agentJobCreated,
      idempotencyKey
    });
  });

  app.get("/units", async (request) => {
    const query = tenantQuerySchema.parse(request.query);
    const units = await deps.orchestrator.listUnits(query.tenant);
    return {
      units: units.map((unit) => ({
        ...unit,
        createdAt: unit.createdAt.toISOString(),
        updatedAt: unit.updatedAt.toISOString(),
        lastMessageAt: unit.lastMessageAt?.toISOString() ?? null
      }))
    };
  });

  app.get("/units/:unitId/messages", async (request) => {
    const params = unitParamsSchema.parse(request.params);
    const query = tenantQuerySchema.parse(request.query);
    const messages = await deps.orchestrator.getHistory(query.tenant, params.unitId);
    return {
      messages: messages.map((message) => ({
        ...message,
        createdAt: message.createdAt.toISOString()
      }))
    };
  });

  app.get("/units/:unitId/events", async (request, reply) => {
    const params = unitParamsSchema.parse(request.params);
    const query = tenantQuerySchema.parse(request.query);
    await streamUnitEvents(
      request,
      reply,
      deps.orchestrator,
      deps.realtime,
      query.tenant,
      params.unitId
    );
  });

  return app;
}
