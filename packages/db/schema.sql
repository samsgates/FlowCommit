CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS environments (
  id text PRIMARY KEY,
  workspace_id text REFERENCES workspaces(id) ON DELETE CASCADE,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('development','test','staging','production')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contract_versions (
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','review','published','deprecated','disabled')),
  document jsonb NOT NULL,
  document_hash text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  PRIMARY KEY (organization_id, name, version)
);


CREATE TABLE IF NOT EXISTS workflow_versions (
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','review','published','deprecated','disabled')),
  document jsonb NOT NULL,
  document_hash text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  PRIMARY KEY (organization_id, name, version)
);

CREATE TABLE IF NOT EXISTS transactions (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id text,
  environment_id text NOT NULL,
  contract_name text NOT NULL,
  contract_version integer NOT NULL,
  contract_snapshot_hash text NOT NULL,
  status text NOT NULL,
  actor_id text NOT NULL,
  input jsonb NOT NULL,
  idempotency_key text,
  proposal_hash text NOT NULL,
  risk_level text NOT NULL,
  risk_score integer NOT NULL,
  reversibility_score integer NOT NULL,
  policy_decision jsonb,
  approvals jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  observations jsonb NOT NULL DEFAULT '[]'::jsonb,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (organization_id, environment_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS transactions_status_idx ON transactions (organization_id, environment_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS transactions_created_idx ON transactions (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS evidence_entries (
  transaction_id text NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  type text NOT NULL,
  timestamp timestamptz NOT NULL,
  actor text,
  payload jsonb NOT NULL,
  previous_hash text NOT NULL,
  hash text NOT NULL,
  PRIMARY KEY (transaction_id, sequence),
  UNIQUE (transaction_id, hash)
);

CREATE TABLE IF NOT EXISTS reconciliation_cases (
  id text PRIMARY KEY,
  transaction_id text NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','closed')),
  reason text NOT NULL,
  recommendation jsonb,
  resolution jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id bigserial PRIMARY KEY,
  organization_id text NOT NULL,
  actor_id text NOT NULL,
  event_type text NOT NULL,
  resource_type text,
  resource_id text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_org_created_idx ON audit_events(organization_id, created_at DESC);

INSERT INTO organizations(id,name) VALUES ('demo','Demo Organization') ON CONFLICT DO NOTHING;
INSERT INTO environments(id,organization_id,name,kind) VALUES ('dev','demo','Development','development') ON CONFLICT DO NOTHING;
