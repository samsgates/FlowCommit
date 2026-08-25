# Security Policy

FlowCommit is designed for consequential enterprise automation. Treat every executor, verifier, plugin, model provider, browser page, document, and MCP server as a separate trust boundary.

## Security invariants

1. AI output is never authoritative for authorization, commit state, idempotency, or audit integrity.
2. Unknown external effects are never silently retried unless the contract guarantees safe idempotency.
3. Credentials are referenced, not stored in Business Effect Contracts.
4. Executor-reported success is insufficient for high-risk transactions. Prefer an independent verifier.
5. Policy is enforced server-side and worker-side for consequential actions.
6. Approval binds to an immutable proposal hash. Any proposal change invalidates approval.
7. Tenant, workspace and environment IDs are required on persisted objects.
8. Evidence is append-only and hash chained.

## Reporting

Do not open a public issue for a suspected security vulnerability. Contact the project maintainers through the security contact configured for the deployment or use GitHub private vulnerability reporting when enabled.
