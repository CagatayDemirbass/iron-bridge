CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE ROLE taskiron_app LOGIN PASSWORD 'taskiron_app';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION app_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')
$$;

CREATE TABLE IF NOT EXISTS tenants (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS units_of_work (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  status text NOT NULL DEFAULT 'open',
  next_position bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (next_position >= 1)
);

CREATE TABLE IF NOT EXISTS intake_requests (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  idempotency_key text NOT NULL,
  unit_id uuid REFERENCES units_of_work(id),
  message_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  unit_id uuid NOT NULL REFERENCES units_of_work(id),
  position bigint NOT NULL,
  participant_id text NOT NULL,
  participant_kind text NOT NULL CHECK (participant_kind IN ('human', 'agent', 'system')),
  body text NOT NULL,
  causation_message_id uuid REFERENCES messages(id),
  intake_request_id uuid REFERENCES intake_requests(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, unit_id, position)
);

ALTER TABLE intake_requests
  DROP CONSTRAINT IF EXISTS intake_requests_message_id_fkey;

ALTER TABLE intake_requests
  ADD CONSTRAINT intake_requests_message_id_fkey
  FOREIGN KEY (message_id) REFERENCES messages(id);

CREATE TABLE IF NOT EXISTS agent_jobs (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  unit_id uuid NOT NULL REFERENCES units_of_work(id),
  trigger_message_id uuid NOT NULL REFERENCES messages(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  locked_at timestamptz,
  completed_message_id uuid REFERENCES messages(id),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, trigger_message_id)
);

CREATE INDEX IF NOT EXISTS units_of_work_tenant_created_idx
  ON units_of_work (tenant_id, created_at);

CREATE INDEX IF NOT EXISTS messages_tenant_unit_position_idx
  ON messages (tenant_id, unit_id, position);

CREATE INDEX IF NOT EXISTS agent_jobs_status_created_idx
  ON agent_jobs (status, created_at);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE units_of_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_jobs ENABLE ROW LEVEL SECURITY;

ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE units_of_work FORCE ROW LEVEL SECURITY;
ALTER TABLE intake_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_jobs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_tenants ON tenants;
CREATE POLICY tenant_isolation_tenants ON tenants
  USING (id = app_tenant_id())
  WITH CHECK (id = app_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_units ON units_of_work;
CREATE POLICY tenant_isolation_units ON units_of_work
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_intake_requests ON intake_requests;
CREATE POLICY tenant_isolation_intake_requests ON intake_requests
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_messages ON messages;
CREATE POLICY tenant_isolation_messages ON messages
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_agent_jobs ON agent_jobs;
CREATE POLICY tenant_isolation_agent_jobs ON agent_jobs
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

GRANT USAGE ON SCHEMA public TO taskiron_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  tenants,
  units_of_work,
  intake_requests,
  messages,
  agent_jobs
TO taskiron_app;
