import type { BusinessEffectContract, RiskLevel, ReversibilityType } from "./types.js";

export interface RiskContext {
  amount?: number;
  containsSensitiveData?: boolean;
  production?: boolean;
  aiExecutor?: boolean;
  executorTrust?: number;
  verificationStrength?: number;
  historicalSuccessRate?: number;
}

const baseByLevel: Record<RiskLevel, number> = { LOW: 15, MEDIUM: 40, HIGH: 70, CRITICAL: 90 };
const reverseScore: Record<ReversibilityType, number> = {
  FULLY_REVERSIBLE: 100,
  COMPENSATABLE: 80,
  PARTIALLY_REVERSIBLE: 55,
  TIME_LIMITED_REVERSIBLE: 50,
  IRREVERSIBLE: 0,
  UNKNOWN: 20
};

export function defaultReversibilityScore(contract: BusinessEffectContract): number {
  return contract.reversibility.score ?? reverseScore[contract.reversibility.type];
}

export function calculateRisk(contract: BusinessEffectContract, context: RiskContext = {}): { score: number; level: RiskLevel } {
  let score = contract.risk.baseScore ?? baseByLevel[contract.risk.level];
  const reversibility = defaultReversibilityScore(contract);
  score += Math.round((100 - reversibility) * 0.18);
  if (context.production) score += 5;
  if (context.aiExecutor) score += 7;
  if (context.containsSensitiveData) score += 6;
  if (context.amount !== undefined) {
    if (context.amount >= 100000) score += 15;
    else if (context.amount >= 10000) score += 10;
    else if (context.amount >= 1000) score += 4;
  }
  if (context.executorTrust !== undefined) score += Math.round((100 - context.executorTrust) * 0.1);
  if (context.verificationStrength !== undefined) score += Math.round((100 - context.verificationStrength) * 0.08);
  if (context.historicalSuccessRate !== undefined) score += Math.round((100 - context.historicalSuccessRate) * 0.1);
  score = Math.max(0, Math.min(100, score));
  const level: RiskLevel = score >= 85 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW";
  return { score, level };
}

export function requiredAutonomy(level: RiskLevel): "AUTONOMOUS" | "VERIFIED_AUTONOMOUS" | "APPROVAL_REQUIRED" | "MULTI_APPROVAL_REQUIRED" {
  if (level === "LOW") return "AUTONOMOUS";
  if (level === "MEDIUM") return "VERIFIED_AUTONOMOUS";
  if (level === "HIGH") return "APPROVAL_REQUIRED";
  return "MULTI_APPROVAL_REQUIRED";
}
