# Adapter SDK

Executor adapters implement capability discovery, validation, prepare, execute, optional cancel/status/compensate, and health checks.

The critical adapter requirement is honest side-effect classification:

- `EXECUTED`: the adapter has sufficient evidence the request was accepted. This is still not equivalent to business verification.
- `FAILED`: the adapter knows the side effect did not occur or can safely be retried.
- `UNKNOWN_EFFECT`: the adapter cannot determine whether the side effect occurred. FlowCommit must verify/reconcile before retrying.

Verifier adapters return `CONFIRMED`, `REJECTED`, `INCONCLUSIVE`, or `TIMEOUT` plus confidence and verification strength.
