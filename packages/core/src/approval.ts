import type { Approval, ApprovalRule } from "./types.js";

export function approvalsSatisfy(rules: ApprovalRule[], approvals: Approval[], proposalHash: string): boolean {
  const valid = approvals.filter(a => a.decision === "APPROVED" && a.proposalHash === proposalHash);
  return rules.every(rule => {
    const uniqueActors = new Set(valid.filter(a => a.role === rule.role).map(a => a.actorId));
    return uniqueActors.size >= rule.count;
  });
}

export function approvalRejected(approvals: Approval[], proposalHash: string): boolean {
  return approvals.some(a => a.proposalHash === proposalHash && a.decision === "REJECTED");
}
