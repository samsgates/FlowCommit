export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ReversibilityType =
  | "FULLY_REVERSIBLE"
  | "COMPENSATABLE"
  | "PARTIALLY_REVERSIBLE"
  | "TIME_LIMITED_REVERSIBLE"
  | "IRREVERSIBLE"
  | "UNKNOWN";

export type TransactionStatus =
  | "CREATED"
  | "VALIDATING"
  | "POLICY_EVALUATION"
  | "PREPARING"
  | "AWAITING_APPROVAL"
  | "READY"
  | "EXECUTING"
  | "VERIFYING"
  | "COMMITTING"
  | "VERIFIED"
  | "VERIFIED_AFTER_RETRY"
  | "REJECTED_BY_POLICY"
  | "HALTED_BEFORE_EFFECT"
  | "UNKNOWN_EFFECT"
  | "PARTIALLY_COMMITTED"
  | "COMPENSATING"
  | "COMPENSATED"
  | "RECONCILIATION_REQUIRED"
  | "FAILED_INFRASTRUCTURE"
  | "CANCELLED";

export type ActionStatus =
  | "PLANNED"
  | "AUTHORIZED"
  | "PREPARED"
  | "EXECUTING"
  | "EXECUTED"
  | "EFFECT_UNKNOWN"
  | "EFFECT_VERIFIED"
  | "COMMITTED"
  | "FAILED"
  | "COMPENSATING"
  | "COMPENSATED";

export type VerificationResult = "CONFIRMED" | "REJECTED" | "INCONCLUSIVE" | "TIMEOUT";

export interface ContractRef { name: string; version: number }

export interface ApprovalRule {
  when?: string;
  role: string;
  count: number;
}

export interface VerificationRule {
  id: string;
  verifier: string;
  effectId?: string;
  strength?: number;
  required?: boolean;
  config?: Record<string, unknown>;
}

export interface BusinessEffectContract {
  apiVersion: "flowcommit.io/v1";
  kind: "BusinessEffectContract";
  metadata: {
    name: string;
    version: number;
    description?: string;
    labels?: Record<string, string>;
  };
  intent: {
    type: string;
    description?: string;
  };
  risk: {
    category?: string;
    level: RiskLevel;
    baseScore?: number;
  };
  inputs?: Record<string, {
    type: "string" | "number" | "boolean" | "object" | "array";
    required?: boolean;
    sensitive?: boolean;
  }>;
  preconditions?: Array<{ id: string; expression: string; description?: string }>;
  idempotency?: {
    strategy: "NONE" | "OPTIONAL" | "REQUIRED" | "EXTERNAL" | "FLOWCOMMIT_MANAGED" | "CUSTOM";
    keyTemplate?: string;
    ttlSeconds?: number;
  };
  execution: {
    preferred: string[];
    fallback?: string[];
    timeoutMs?: number;
  };
  expectedEffects: Array<{
    id: string;
    type: string;
    resource?: string;
    expected?: Record<string, unknown>;
  }>;
  verification: {
    required: boolean;
    minimumStrength?: number;
    rules: VerificationRule[];
  };
  approval?: {
    rules: ApprovalRule[];
  };
  reversibility: {
    type: ReversibilityType;
    score?: number;
    timeLimitSeconds?: number;
  };
  compensation?: {
    contract?: ContractRef;
    strategy?: "ROLLBACK_ALL" | "ROLLBACK_FAILED_BRANCH" | "KEEP_COMPLETED" | "RETRY_THEN_ROLLBACK" | "RECONCILE" | "HUMAN_DECISION";
  };
  evidence?: {
    retentionDays?: number;
    capture?: string[];
  };
}

export interface PolicyDecision {
  allow: boolean;
  reason?: string;
  risk?: RiskLevel;
  riskScore?: number;
  requiredApprovals?: ApprovalRule[];
  allowedExecutors?: string[];
  requiredVerifiers?: string[];
}

export interface Approval {
  id: string;
  role: string;
  actorId: string;
  decision: "APPROVED" | "REJECTED";
  proposalHash: string;
  createdAt: string;
  reason?: string;
}

export interface EffectObservation {
  effectId: string;
  result: VerificationResult;
  confidence: number;
  strength: number;
  source: string;
  observed?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
  observedAt: string;
}

export interface TransactionAction {
  id: string;
  contractActionId?: string;
  executor: string;
  status: ActionStatus;
  attempts: number;
  startedAt?: string;
  finishedAt?: string;
  externalReference?: string;
  output?: Record<string, unknown>;
  error?: { code: string; message: string; retryable?: boolean };
}

export interface Transaction {
  id: string;
  tenantId: string;
  workspaceId?: string;
  environmentId: string;
  contract: ContractRef;
  contractSnapshotHash: string;
  status: TransactionStatus;
  actorId: string;
  input: Record<string, unknown>;
  idempotencyKey?: string;
  proposalHash: string;
  riskLevel: RiskLevel;
  riskScore: number;
  reversibilityScore: number;
  policyDecision?: PolicyDecision;
  approvals: Approval[];
  actions: TransactionAction[];
  observations: EffectObservation[];
  createdAt: string;
  updatedAt: string;
  retryCount: number;
}

export interface EvidenceEntry {
  sequence: number;
  transactionId: string;
  type: string;
  timestamp: string;
  actor?: string;
  payload: Record<string, unknown>;
  previousHash: string;
  hash: string;
}
