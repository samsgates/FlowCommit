# Threat Model

Primary threats include excessive agent authority, prompt injection, malicious external content, credential theft, cross-tenant access, approval replay, executor compromise, SSRF, evidence tampering, plugin supply-chain compromise, and ambiguous side effects.

## Trust boundaries

- Human/API caller
- Control plane
- Durable workflow runtime
- Worker
- Executor adapter
- AI provider
- External system
- Verifier
- Evidence store

## Required defenses

- Server-side authorization and policy
- Minimum necessary capabilities
- Proposal-hash-bound approval
- Network and domain allowlists
- Credential references with just-in-time retrieval
- Independent verification
- Idempotency controls
- Explicit unknown-effect state
- Signed or hash-chained evidence
- Tenant-scoped queries
- Plugin signing and isolation for untrusted code
