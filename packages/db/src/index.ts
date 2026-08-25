import pg from "pg";
import type { Transaction } from "@flowcommit/core";
const { Pool } = pg;

export class FlowCommitDb {
  readonly pool: pg.Pool;
  constructor(connectionString = process.env.DATABASE_URL) {
    if (!connectionString) throw new Error("DATABASE_URL is required");
    this.pool = new Pool({ connectionString, max: Number(process.env.DB_POOL_MAX ?? 20) });
  }

  async close(): Promise<void> { await this.pool.end(); }

  async putTransaction(tx: Transaction): Promise<void> {
    await this.pool.query(`
      INSERT INTO transactions(
        id, organization_id, workspace_id, environment_id, contract_name, contract_version,
        contract_snapshot_hash, status, actor_id, input, idempotency_key, proposal_hash,
        risk_level, risk_score, reversibility_score, policy_decision, approvals, actions,
        observations, retry_count, created_at, updated_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      ON CONFLICT(id) DO UPDATE SET
        status=EXCLUDED.status, policy_decision=EXCLUDED.policy_decision,
        approvals=EXCLUDED.approvals, actions=EXCLUDED.actions,
        observations=EXCLUDED.observations, retry_count=EXCLUDED.retry_count,
        risk_level=EXCLUDED.risk_level, risk_score=EXCLUDED.risk_score,
        updated_at=EXCLUDED.updated_at`, [
      tx.id, tx.tenantId, tx.workspaceId ?? null, tx.environmentId, tx.contract.name, tx.contract.version,
      tx.contractSnapshotHash, tx.status, tx.actorId, tx.input, tx.idempotencyKey ?? null, tx.proposalHash,
      tx.riskLevel, tx.riskScore, tx.reversibilityScore, tx.policyDecision ?? null, tx.approvals, tx.actions,
      tx.observations, tx.retryCount, tx.createdAt, tx.updatedAt
    ]);
  }

  async getTransaction(id: string, organizationId: string): Promise<Transaction | null> {
    const { rows } = await this.pool.query("SELECT * FROM transactions WHERE id=$1 AND organization_id=$2", [id, organizationId]);
    if (!rows[0]) return null;
    return mapTransaction(rows[0]);
  }

  async findByIdempotency(organizationId: string, environmentId: string, key: string): Promise<Transaction | null> {
    const { rows } = await this.pool.query(
      "SELECT * FROM transactions WHERE organization_id=$1 AND environment_id=$2 AND idempotency_key=$3",
      [organizationId, environmentId, key]
    );
    return rows[0] ? mapTransaction(rows[0]) : null;
  }

  async listTransactions(organizationId: string, limit = 100): Promise<Transaction[]> {
    const { rows } = await this.pool.query("SELECT * FROM transactions WHERE organization_id=$1 ORDER BY created_at DESC LIMIT $2", [organizationId, limit]);
    return rows.map(mapTransaction);
  }


  async appendEvidence(input: any): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const prev = await client.query("SELECT sequence,hash FROM evidence_entries WHERE transaction_id=$1 ORDER BY sequence DESC LIMIT 1 FOR UPDATE", [input.transactionId]);
      const sequence = (prev.rows[0]?.sequence ?? 0) + 1;
      const previousHash = prev.rows[0]?.hash ?? "GENESIS";
      const { createHash } = await import("node:crypto");
      const body = JSON.stringify({sequence,transactionId:input.transactionId,type:input.type,timestamp:input.timestamp,actor:input.actor??null,payload:input.payload,previousHash});
      const hash = createHash("sha256").update(body).digest("hex");
      await client.query("INSERT INTO evidence_entries(transaction_id,sequence,type,timestamp,actor,payload,previous_hash,hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [input.transactionId,sequence,input.type,input.timestamp,input.actor??null,input.payload,previousHash,hash]);
      await client.query("COMMIT");
    } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  }

  async openReconciliation(transactionId: string, reason: string, recommendation?: Record<string, unknown>): Promise<void> {
    const id = `rec_${transactionId}`;
    await this.pool.query(`INSERT INTO reconciliation_cases(id,transaction_id,reason,recommendation) VALUES($1,$2,$3,$4)
      ON CONFLICT(id) DO UPDATE SET reason=EXCLUDED.reason,recommendation=EXCLUDED.recommendation,updated_at=now()`, [id,transactionId,reason,recommendation??null]);
  }

  async getEvidence(transactionId: string, organizationId: string): Promise<any[]> {
    const { rows } = await this.pool.query(`SELECT e.* FROM evidence_entries e JOIN transactions t ON t.id=e.transaction_id
      WHERE e.transaction_id=$1 AND t.organization_id=$2 ORDER BY e.sequence`, [transactionId,organizationId]);
    return rows;
  }


  async listContracts(organizationId: string): Promise<any[]> {
    const { rows } = await this.pool.query("SELECT name,version,state,document_hash,created_by,created_at,published_at FROM contract_versions WHERE organization_id=$1 ORDER BY name,version DESC", [organizationId]);
    return rows;
  }

  async putWorkflow(organizationId: string, actorId: string, document: any, documentHash: string, state = "published"): Promise<void> {
    await this.pool.query(`INSERT INTO workflow_versions(organization_id,name,version,state,document,document_hash,created_by,published_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,CASE WHEN $4='published' THEN now() ELSE NULL END) ON CONFLICT(organization_id,name,version) DO NOTHING`, [organizationId,document.metadata.name,document.metadata.version,state,document,documentHash,actorId]);
  }

  async getWorkflow(organizationId: string, name: string, version: number): Promise<any | null> {
    const { rows } = await this.pool.query("SELECT document FROM workflow_versions WHERE organization_id=$1 AND name=$2 AND version=$3 AND state IN ('published','deprecated')", [organizationId,name,version]);
    return rows[0]?.document ?? null;
  }

  async listWorkflows(organizationId: string): Promise<any[]> {
    const { rows } = await this.pool.query("SELECT name,version,state,document_hash,created_by,created_at,published_at FROM workflow_versions WHERE organization_id=$1 ORDER BY name,version DESC", [organizationId]);
    return rows;
  }

  async putContract(organizationId: string, actorId: string, document: any, documentHash: string, state = "published"): Promise<void> {
    await this.pool.query(`INSERT INTO contract_versions(organization_id,name,version,state,document,document_hash,created_by,published_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,CASE WHEN $4='published' THEN now() ELSE NULL END)
      ON CONFLICT(organization_id,name,version) DO NOTHING`, [organizationId, document.metadata.name, document.metadata.version, state, document, documentHash, actorId]);
  }

  async getContract(organizationId: string, name: string, version: number): Promise<any | null> {
    const { rows } = await this.pool.query("SELECT document FROM contract_versions WHERE organization_id=$1 AND name=$2 AND version=$3 AND state IN ('published','deprecated')", [organizationId, name, version]);
    return rows[0]?.document ?? null;
  }
}

function mapTransaction(r: any): Transaction {
  return {
    id:r.id, tenantId:r.organization_id, workspaceId:r.workspace_id ?? undefined, environmentId:r.environment_id,
    contract:{name:r.contract_name,version:r.contract_version}, contractSnapshotHash:r.contract_snapshot_hash,
    status:r.status, actorId:r.actor_id, input:r.input, idempotencyKey:r.idempotency_key ?? undefined,
    proposalHash:r.proposal_hash, riskLevel:r.risk_level, riskScore:r.risk_score,
    reversibilityScore:r.reversibility_score, policyDecision:r.policy_decision ?? undefined,
    approvals:r.approvals ?? [], actions:r.actions ?? [], observations:r.observations ?? [], retryCount:r.retry_count,
    createdAt:new Date(r.created_at).toISOString(), updatedAt:new Date(r.updated_at).toISOString()
  };
}
