import type { TransactionStatus, ActionStatus } from "./types.js";

const transactionTransitions: Record<TransactionStatus, TransactionStatus[]> = {
  CREATED: ["VALIDATING", "CANCELLED"],
  VALIDATING: ["POLICY_EVALUATION", "HALTED_BEFORE_EFFECT", "FAILED_INFRASTRUCTURE", "CANCELLED"],
  POLICY_EVALUATION: ["PREPARING", "AWAITING_APPROVAL", "REJECTED_BY_POLICY", "FAILED_INFRASTRUCTURE", "CANCELLED"],
  PREPARING: ["AWAITING_APPROVAL", "READY", "HALTED_BEFORE_EFFECT", "FAILED_INFRASTRUCTURE", "CANCELLED"],
  AWAITING_APPROVAL: ["READY", "REJECTED_BY_POLICY", "CANCELLED"],
  READY: ["EXECUTING", "CANCELLED"],
  EXECUTING: ["VERIFYING", "UNKNOWN_EFFECT", "PARTIALLY_COMMITTED", "COMPENSATING", "FAILED_INFRASTRUCTURE"],
  VERIFYING: ["COMMITTING", "UNKNOWN_EFFECT", "PARTIALLY_COMMITTED", "COMPENSATING", "RECONCILIATION_REQUIRED", "FAILED_INFRASTRUCTURE"],
  COMMITTING: ["VERIFIED", "VERIFIED_AFTER_RETRY", "UNKNOWN_EFFECT", "FAILED_INFRASTRUCTURE"],
  VERIFIED: [],
  VERIFIED_AFTER_RETRY: [],
  REJECTED_BY_POLICY: [],
  HALTED_BEFORE_EFFECT: [],
  UNKNOWN_EFFECT: ["VERIFYING", "RECONCILIATION_REQUIRED", "COMPENSATING", "VERIFIED_AFTER_RETRY"],
  PARTIALLY_COMMITTED: ["COMPENSATING", "RECONCILIATION_REQUIRED", "VERIFYING"],
  COMPENSATING: ["COMPENSATED", "RECONCILIATION_REQUIRED", "FAILED_INFRASTRUCTURE"],
  COMPENSATED: [],
  RECONCILIATION_REQUIRED: ["VERIFYING", "COMPENSATING", "VERIFIED_AFTER_RETRY", "COMPENSATED"],
  FAILED_INFRASTRUCTURE: ["VALIDATING", "PREPARING", "EXECUTING", "VERIFYING", "RECONCILIATION_REQUIRED"],
  CANCELLED: []
};

const actionTransitions: Record<ActionStatus, ActionStatus[]> = {
  PLANNED: ["AUTHORIZED", "FAILED"],
  AUTHORIZED: ["PREPARED", "EXECUTING", "FAILED"],
  PREPARED: ["EXECUTING", "FAILED"],
  EXECUTING: ["EXECUTED", "EFFECT_UNKNOWN", "FAILED"],
  EXECUTED: ["EFFECT_VERIFIED", "EFFECT_UNKNOWN", "FAILED", "COMPENSATING"],
  EFFECT_UNKNOWN: ["EFFECT_VERIFIED", "FAILED", "COMPENSATING"],
  EFFECT_VERIFIED: ["COMMITTED", "COMPENSATING"],
  COMMITTED: ["COMPENSATING"],
  FAILED: ["EXECUTING", "COMPENSATING"],
  COMPENSATING: ["COMPENSATED", "FAILED"],
  COMPENSATED: []
};

export function canTransitionTransaction(from: TransactionStatus, to: TransactionStatus): boolean {
  return transactionTransitions[from].includes(to);
}

export function assertTransactionTransition(from: TransactionStatus, to: TransactionStatus): void {
  if (!canTransitionTransaction(from, to)) throw new Error(`Invalid transaction transition ${from} -> ${to}`);
}

export function canTransitionAction(from: ActionStatus, to: ActionStatus): boolean {
  return actionTransitions[from].includes(to);
}

export function assertActionTransition(from: ActionStatus, to: ActionStatus): void {
  if (!canTransitionAction(from, to)) throw new Error(`Invalid action transition ${from} -> ${to}`);
}
