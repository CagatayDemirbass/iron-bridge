# Iron Bridge Orchestration Layer

This is a modular orchestration substrate for long-running human + agent work.
The agent is intentionally a stub; the important pieces are durable history,
tenant isolation, concurrent ordering, idempotent intake, and realtime observation.

## Architecture

```text
src/
  domain/                 Pure domain types and errors
  application/            Use-cases and ports, independent of HTTP/Postgres
  storage/postgres/       Durable Postgres implementation with RLS
  realtime/               Realtime publish/subscribe and SSE streaming
  intake/http/            HTTP adapter for the application core
  agent/                  100ms stub agent
```

The HTTP layer is only an intake adapter. A CLI, email poller, scheduled trigger, or
new webhook shape can submit work by constructing the same `SubmitMessageCommand`
and calling `Orchestrator.submitMessage()`.

## Key Guarantees

| Requirement | Implementation |
| --- | --- |
| Structural multi-tenancy | Postgres Row-Level Security using session-local `app.tenant_id` |
| Durable history | `units_of_work`, `messages`, `intake_requests`, and `agent_jobs` tables |
| Concurrent ordering | Transactional append with `SELECT ... FOR UPDATE` on the unit row |
| Idempotent intake | `UNIQUE (tenant_id, idempotency_key)` plus `ON CONFLICT` at storage layer |
| Realtime observers | Server-Sent Events, no polling |
| Multi-participant | Messages store `participant_id` and `participant_kind` |
| Restart recovery | Agent jobs are durable and stale running jobs are recovered |

## Run Locally

```bash
npm install
npm run db:up
npm run db:migrate
npm run dev
```

The service listens on `http://localhost:3000` by default.

Open the browser console:

```bash
open http://127.0.0.1:3000/
```

## API

Submit a message:

```bash
curl -s http://localhost:3000/messages \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo-1' \
  -d '{
    "tenant": "t1",
    "participant": "alice",
    "body": "ping"
  }'
```

Continue an existing unit:

```bash
curl -s http://localhost:3000/messages \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo-2' \
  -d '{
    "tenant": "t1",
    "participant": "alice",
    "unitId": "<unit-id>",
    "body": "again"
  }'
```

Watch a unit with SSE:

```bash
curl -N 'http://localhost:3000/units/<unit-id>/events?tenant=t1'
```

Fetch durable history:

```bash
curl -s 'http://localhost:3000/units/<unit-id>/messages?tenant=t1'
```

## Tests

```bash
npm test
```

The integration tests require Postgres on `localhost:5432`. With Docker Desktop
running, `npm run db:up` starts the expected database.

Test coverage maps directly to the hard requirements:

| Test | Proof |
| --- | --- |
| `rls.test.ts` | Raw `SELECT * FROM units_of_work` only sees the bound tenant |
| `idempotency.test.ts` | 20 concurrent retries with the same key persist one message |
| `ordering.test.ts` | 20 concurrent messages plus agent replies get gap-free positions |
| `durability.test.ts` | History and pending agent work survive service recreation |
| `realtime.test.ts` | Two SSE observers receive the same messages in the same order |
