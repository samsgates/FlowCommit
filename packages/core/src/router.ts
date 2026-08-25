export type ExecutorKind = "API" | "CONNECTOR" | "STRUCTURED_BROWSER" | "RPA" | "AI_ASSISTED" | "VISION_AGENT" | "HUMAN";

export interface ExecutorCandidate {
  name: string;
  kind: ExecutorKind;
  healthy: boolean;
  trustScore: number;
  successRate: number;
  verificationStrength: number;
  estimatedCost: number;
  latencyMs: number;
  allowed: boolean;
}

const kindSafety: Record<ExecutorKind, number> = {
  API: 100,
  CONNECTOR: 95,
  STRUCTURED_BROWSER: 82,
  RPA: 78,
  AI_ASSISTED: 62,
  VISION_AGENT: 48,
  HUMAN: 70
};

export function rankExecutors(candidates: ExecutorCandidate[]): Array<ExecutorCandidate & { score: number }> {
  return candidates
    .filter(c => c.healthy && c.allowed)
    .map(c => ({
      ...c,
      score: Math.round(
        kindSafety[c.kind] * 0.25 +
        c.trustScore * 0.25 +
        c.successRate * 0.2 +
        c.verificationStrength * 0.2 -
        Math.min(c.estimatedCost, 100) * 0.05 -
        Math.min(c.latencyMs / 1000, 100) * 0.05
      )
    }))
    .sort((a, b) => b.score - a.score);
}
