# Business Effect Contract Specification

A Business Effect Contract is an immutable declaration of business intent and safety semantics, not a sequence of UI steps.

Required fields:

- `metadata.name` and `metadata.version`
- `intent.type`
- `risk.level`
- `execution.preferred`
- at least one `expectedEffects` item
- `verification`
- `reversibility`

Contracts may declare idempotency, approval, compensation, evidence retention and executor fallbacks.

The contract version used by a transaction is immutable and its snapshot hash is recorded on the transaction.
