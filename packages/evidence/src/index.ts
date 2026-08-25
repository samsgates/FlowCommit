import { createHash, createHmac } from "node:crypto";
import type { EvidenceEntry } from "@flowcommit/core";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as any).sort().map(k => `${JSON.stringify(k)}:${canonical((value as any)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value: unknown): string { return createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex"); }
export function hmacReceipt(value: unknown, secret: string): string { return createHmac("sha256", secret).update(canonical(value)).digest("hex"); }

export function buildEvidenceEntry(previous: EvidenceEntry | undefined, input: Omit<EvidenceEntry,"sequence"|"previousHash"|"hash">): EvidenceEntry {
  const sequence = (previous?.sequence ?? 0) + 1;
  const previousHash = previous?.hash ?? "GENESIS";
  const body = {...input, sequence, previousHash};
  return {...body, hash: sha256(body)};
}
