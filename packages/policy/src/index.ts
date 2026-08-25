import type { PolicyProvider } from "@flowcommit/sdk";

export class OpaPolicyProvider implements PolicyProvider {
  constructor(private readonly url = process.env.OPA_URL ?? "http://localhost:8181", private readonly decisionPath = "flowcommit/transaction/decision") {}
  async evaluate(input: Record<string, unknown>) {
    const response = await fetch(`${this.url}/v1/data/${this.decisionPath}`, {
      method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify({input})
    });
    if (!response.ok) throw new Error(`OPA returned ${response.status}`);
    const payload: any = await response.json();
    if (!payload.result || typeof payload.result.allow !== "boolean") throw new Error("OPA response missing result.allow");
    return payload.result;
  }
}

export class AllowAllDevPolicyProvider implements PolicyProvider {
  async evaluate() { return {allow: true as const}; }
}
