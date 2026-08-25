import { canonicalJson, stableHash } from "./canonical.js";

export function renderIdempotencyKey(template: string, input: Record<string, unknown>): string {
  return template.replace(/\$\{([^}]+)\}/g, (_, key: string) => {
    const path = key.split(".");
    let value: unknown = input;
    for (const part of path) {
      if (!value || typeof value !== "object") return "";
      value = (value as Record<string, unknown>)[part];
    }
    if (value === undefined || value === null) throw new Error(`Cannot render idempotency key. Missing input: ${key}`);
    return String(value);
  });
}

export function transactionFingerprint(contractName: string, contractVersion: number, input: Record<string, unknown>): string {
  return stableHash(`${contractName}@${contractVersion}:${canonicalJson(input)}`);
}
