# Architecture

FlowCommit separates **control plane**, **durable orchestration**, **execution workers**, **policy**, **verification**, and **evidence**.

## Control plane

Stores immutable contract/workflow versions, creates transactions, evaluates authorization, exposes approvals and reconciliation, and provides operator APIs.

## Durable execution

Temporal is the recommended production scheduler. FlowCommit's authoritative business state is still represented using the core transaction state machine. A workflow engine crash must never change business semantics.

## Workers

Workers are capability-bearing execution hosts. Private workers can run inside enterprise networks with outbound-only connectivity.

## Executor adapters

Adapters prepare and execute side effects. Adapters must differentiate `FAILED` from `UNKNOWN_EFFECT`. If a request may have reached an external system before a connection failure, return `UNKNOWN_EFFECT`.

## Verifiers

Verifiers independently observe expected business effects. High-risk contracts should avoid using the same channel for execution and verification.

## Evidence

Every consequential state transition can be represented as an append-only, SHA-256-chained evidence event. Deployments may additionally sign receipts and archive them to WORM storage.
