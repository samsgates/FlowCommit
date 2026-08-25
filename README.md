# FlowCommit

**FlowCommit is the open-source transaction safety layer for enterprise RPA and AI agents.**

It turns automation runs into governed business transactions with explicit contracts, policy enforcement, idempotency, independent effect verification, compensation, reconciliation, human approval, and tamper-evident evidence receipts.

## Why FlowCommit

Automation engines answer **how** to perform work. AI agents answer **what** they think should happen. FlowCommit answers the enterprise questions that remain:

- Was the action authorized?
- Did the intended business effect actually happen?
- Did it happen exactly once?
- Can we independently prove the result?
- Can it be reversed or compensated?
- What happens after a partial cross-system failure?

## Architecture

```text
Business Intent / Workflow / Agent
               |
               v
       Business Effect Contract
               |
               v
+--------------------------------------+
|              FLOWCOMMIT              |
| Policy | Risk | Idempotency | Approval|
| Routing | Verification | Compensation |
| Evidence | Reconciliation | Audit     |
+------------------+-------------------+
                   |
       +-----------+-----------+
       |           |           |
       v           v           v
      API       RPA/Browser    MCP/Agent
       |           |           |
       +-----------+-----------+
                   |
                   v
            Enterprise Systems
                   |
                   v
          Independent Verification
                   |
          +--------+--------+
          |        |        |
       COMMIT  COMPENSATE  RECONCILE
```

## Implemented in this repository

- Business Effect Contract model and validator
- Transaction and action state machines
- Versioned DAG workflow schema with cycle detection and deterministic topological ordering
- Risk and reversibility engine
- Idempotency fingerprints and deduplication primitives
- Policy decision abstraction plus OPA client integration
- Approval gate semantics
- Executor and verifier adapter SDKs
- HTTP, webhook, Playwright, MCP and human-task adapters
- Independent verification runtime
- Compensation and reconciliation transitions
- Tamper-evident chained evidence ledger
- Fastify REST API
- PostgreSQL schema and repository implementation
- Durable workflow integration boundary for Temporal
- Adapter-driven transaction execution engine and worker process
- CLI
- Next.js operator Studio
- Docker Compose local stack
- Helm chart and Kubernetes production templates
- OpenTelemetry collector configuration
- OPA starter policy
- Reference refund workflow
- Core unit/self tests

## Quick start

### 1. Prerequisites

- Node.js 20+
- npm 10+
- Docker with Docker Compose

### 2. Configure

```bash
cp .env.example .env
npm install
```

### 3. Start infrastructure

```bash
docker compose up -d
```

### 4. Initialize database

```bash
npm run db:init
```

### 5. Start API and worker

In separate terminals:

```bash
npm run dev -w @flowcommit/api
npm run dev -w @flowcommit/worker
```

### 6. Start Studio

```bash
npm run dev -w @flowcommit/studio
```

Open `http://localhost:3000`.

## Runnable local demo

Run:

```bash
./scripts/bootstrap-demo.sh
```

The script publishes `examples/demo/demo.bec.json` and creates a transaction. The bundled mock executor and independent mock verifier let the worker take the transaction from `READY` to `VERIFIED` without calling an external system.

## Example transaction

```bash
curl -X POST http://localhost:8080/api/v1/transactions \
  -H 'content-type: application/json' \
  -H 'x-flowcommit-actor: demo-user' \
  -d '{
    "tenantId": "demo",
    "environmentId": "dev",
    "contract": {
      "name": "customer-refund",
      "version": 1
    },
    "input": {
      "invoiceId": "INV-1001",
      "amount": 850
    },
    "idempotencyKey": "refund-INV-1001-850"
  }'
```

## Business Effect Contract

See [`examples/refund/customer-refund.bec.json`](examples/refund/customer-refund.bec.json).

## Status semantics

FlowCommit intentionally does not collapse uncertain execution into `SUCCESS`.

Important outcomes include:

- `VERIFIED`
- `VERIFIED_AFTER_RETRY`
- `UNKNOWN_EFFECT`
- `PARTIALLY_COMMITTED`
- `COMPENSATED`
- `RECONCILIATION_REQUIRED`
- `REJECTED_BY_POLICY`
- `HALTED_BEFORE_EFFECT`

## Design rule

> Never trust that an automation succeeded merely because it finished executing. Verify the business effect, then commit.

## Production notes

The repository contains a complete reference architecture, but deployments must still provide organization-specific identity, secrets, network policy, contract definitions, adapter credentials, policy rules, backup/restore, threat modeling, and compliance configuration before processing real regulated or financial workloads.

See [`docs/production.md`](docs/production.md) and [`SECURITY.md`](SECURITY.md).

## License

Apache-2.0
