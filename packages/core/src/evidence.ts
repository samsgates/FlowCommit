import { stableHash, canonicalJson } from "./canonical.js";
import type { EvidenceEntry } from "./types.js";

export function appendEvidence(
  chain: EvidenceEntry[],
  entry: Omit<EvidenceEntry, "sequence" | "previousHash" | "hash">
): EvidenceEntry {
  const previousHash = chain.length ? chain[chain.length - 1].hash : "GENESIS";
  const sequence = chain.length + 1;
  const body = { sequence, ...entry, previousHash };
  const hash = stableHash(canonicalJson(body));
  return { ...body, hash };
}

export function verifyEvidenceChain(chain: EvidenceEntry[]): boolean {
  let previousHash = "GENESIS";
  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];
    if (entry.sequence !== i + 1 || entry.previousHash !== previousHash) return false;
    const { hash, ...body } = entry;
    if (stableHash(canonicalJson(body)) !== hash) return false;
    previousHash = hash;
  }
  return true;
}
