import type { BusinessEffectContract, EffectObservation } from "./types.js";

export interface VerificationSummary {
  confirmed: boolean;
  unknown: boolean;
  rejected: boolean;
  minimumStrengthMet: boolean;
  missingEffects: string[];
}

export function summarizeVerification(contract: BusinessEffectContract, observations: EffectObservation[]): VerificationSummary {
  const minimumStrength = contract.verification.minimumStrength ?? 0;
  const missingEffects: string[] = [];
  let rejected = false;
  let unknown = false;
  let minimumStrengthMet = true;

  for (const effect of contract.expectedEffects) {
    const matches = observations.filter(o => o.effectId === effect.id);
    const confirmed = matches.filter(o => o.result === "CONFIRMED");
    if (!confirmed.length) {
      missingEffects.push(effect.id);
      if (matches.some(o => o.result === "REJECTED")) rejected = true;
      else unknown = true;
      continue;
    }
    if (Math.max(...confirmed.map(o => o.strength)) < minimumStrength) minimumStrengthMet = false;
  }

  return {
    confirmed: missingEffects.length === 0 && !rejected && minimumStrengthMet,
    unknown,
    rejected,
    minimumStrengthMet,
    missingEffects
  };
}
