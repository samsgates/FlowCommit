import type { Approval, BusinessEffectContract, EffectObservation, PolicyDecision, Transaction, TransactionStatus } from "./types.js";
import { assertValidContract } from "./contract.js";
import { calculateRisk, defaultReversibilityScore } from "./risk.js";
import { stableHash, canonicalJson } from "./canonical.js";
import { transactionFingerprint } from "./idempotency.js";
import { assertTransactionTransition } from "./state-machine.js";
import { approvalRejected, approvalsSatisfy } from "./approval.js";
import { summarizeVerification } from "./verification.js";

export function createTransaction(params: {
  id: string;
  tenantId: string;
  workspaceId?: string;
  environmentId: string;
  actorId: string;
  contract: BusinessEffectContract;
  input: Record<string, unknown>;
  idempotencyKey?: string;
  now?: string;
}): Transaction {
  assertValidContract(params.contract);
  const now = params.now ?? new Date().toISOString();
  const risk = calculateRisk(params.contract, { production: params.environmentId.toLowerCase() === "production" });
  const contractHash = stableHash(canonicalJson(params.contract));
  const proposalHash = stableHash(canonicalJson({ contract: contractHash, input: params.input }));
  return {
    id: params.id,
    tenantId: params.tenantId,
    workspaceId: params.workspaceId,
    environmentId: params.environmentId,
    contract: { name: params.contract.metadata.name, version: params.contract.metadata.version },
    contractSnapshotHash: contractHash,
    status: "CREATED",
    actorId: params.actorId,
    input: params.input,
    idempotencyKey: params.idempotencyKey ?? transactionFingerprint(params.contract.metadata.name, params.contract.metadata.version, params.input),
    proposalHash,
    riskLevel: risk.level,
    riskScore: risk.score,
    reversibilityScore: defaultReversibilityScore(params.contract),
    approvals: [],
    actions: [],
    observations: [],
    createdAt: now,
    updatedAt: now,
    retryCount: 0
  };
}

export function transitionTransaction(tx: Transaction, to: TransactionStatus, now = new Date().toISOString()): Transaction {
  assertTransactionTransition(tx.status, to);
  return { ...tx, status: to, updatedAt: now };
}

export function applyPolicy(tx: Transaction, decision: PolicyDecision, now = new Date().toISOString()): Transaction {
  if (tx.status !== "POLICY_EVALUATION") throw new Error("Transaction must be in POLICY_EVALUATION");
  if (!decision.allow) return { ...tx, policyDecision: decision, status: "REJECTED_BY_POLICY", updatedAt: now };
  const requiredApprovals = decision.requiredApprovals ?? [];
  return {
    ...tx,
    policyDecision: decision,
    riskLevel: decision.risk ?? tx.riskLevel,
    riskScore: decision.riskScore ?? tx.riskScore,
    status: requiredApprovals.length ? "AWAITING_APPROVAL" : "PREPARING",
    updatedAt: now
  };
}

export function recordApproval(tx: Transaction, approval: Approval, now = new Date().toISOString()): Transaction {
  if (tx.status !== "AWAITING_APPROVAL") throw new Error("Transaction is not awaiting approval");
  if (approval.proposalHash !== tx.proposalHash) throw new Error("Approval proposal hash does not match transaction");
  const approvals = [...tx.approvals, approval];
  if (approvalRejected(approvals, tx.proposalHash)) return { ...tx, approvals, status: "REJECTED_BY_POLICY", updatedAt: now };
  const rules = tx.policyDecision?.requiredApprovals ?? [];
  const status = approvalsSatisfy(rules, approvals, tx.proposalHash) ? "READY" : "AWAITING_APPROVAL";
  return { ...tx, approvals, status, updatedAt: now };
}

export function addObservation(tx: Transaction, observation: EffectObservation, now = new Date().toISOString()): Transaction {
  return { ...tx, observations: [...tx.observations, observation], updatedAt: now };
}

export function decideVerificationOutcome(tx: Transaction, contract: BusinessEffectContract, now = new Date().toISOString()): Transaction {
  if (tx.status !== "VERIFYING") throw new Error("Transaction must be VERIFYING");
  const summary = summarizeVerification(contract, tx.observations);
  if (summary.confirmed) return { ...tx, status: "COMMITTING", updatedAt: now };
  if (summary.rejected) {
    const canCompensate = contract.reversibility.type !== "IRREVERSIBLE" && contract.compensation !== undefined;
    return { ...tx, status: canCompensate ? "COMPENSATING" : "RECONCILIATION_REQUIRED", updatedAt: now };
  }
  return { ...tx, status: "UNKNOWN_EFFECT", updatedAt: now };
}
