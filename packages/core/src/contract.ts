import type { BusinessEffectContract } from "./types.js";

export interface ValidationIssue { path: string; message: string }

export function validateContract(contract: BusinessEffectContract): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (contract.apiVersion !== "flowcommit.io/v1") issues.push({path: "apiVersion", message: "must equal flowcommit.io/v1"});
  if (contract.kind !== "BusinessEffectContract") issues.push({path: "kind", message: "must equal BusinessEffectContract"});
  if (!contract.metadata?.name) issues.push({path: "metadata.name", message: "is required"});
  if (!Number.isInteger(contract.metadata?.version) || contract.metadata.version < 1) issues.push({path: "metadata.version", message: "must be a positive integer"});
  if (!contract.intent?.type) issues.push({path: "intent.type", message: "is required"});
  if (!contract.execution?.preferred?.length) issues.push({path: "execution.preferred", message: "must contain at least one executor"});
  if (!Array.isArray(contract.expectedEffects) || !contract.expectedEffects.length) issues.push({path: "expectedEffects", message: "must contain at least one effect"});
  if (contract.verification?.required && !contract.verification.rules?.length) issues.push({path: "verification.rules", message: "verification is required but no rules are configured"});
  if (contract.idempotency?.strategy === "REQUIRED" && !contract.idempotency.keyTemplate) issues.push({path: "idempotency.keyTemplate", message: "is required when idempotency strategy is REQUIRED"});
  const ids = new Set<string>();
  for (const effect of contract.expectedEffects ?? []) {
    if (!effect.id) issues.push({path: "expectedEffects[].id", message: "effect id is required"});
    if (ids.has(effect.id)) issues.push({path: `expectedEffects.${effect.id}`, message: "duplicate effect id"});
    ids.add(effect.id);
  }
  for (const rule of contract.verification?.rules ?? []) {
    if (rule.strength !== undefined && (rule.strength < 0 || rule.strength > 100)) issues.push({path: `verification.rules.${rule.id}.strength`, message: "must be 0..100"});
  }
  if (contract.reversibility?.score !== undefined && (contract.reversibility.score < 0 || contract.reversibility.score > 100)) {
    issues.push({path: "reversibility.score", message: "must be 0..100"});
  }
  return issues;
}

export function assertValidContract(contract: BusinessEffectContract): void {
  const issues = validateContract(contract);
  if (issues.length) throw new Error("Invalid Business Effect Contract: " + issues.map(i => `${i.path}: ${i.message}`).join("; "));
}
