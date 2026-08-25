# Production Deployment Guide

The repository is a production-oriented reference implementation. Before processing real enterprise transactions, configure the following.

## Required production hardening

1. Replace development header authentication with OIDC/SAML-backed identity.
2. Disable `FLOWCOMMIT_DEV_AUTH`.
3. Define organization-specific OPA policy and default deny.
4. Store credentials in Vault or a cloud secrets manager. Persist references only.
5. Use private worker pools for privileged network zones.
6. Enable TLS and, where practical, mTLS between control plane and workers.
7. Configure PostgreSQL HA, point-in-time recovery and tested restore procedures.
8. Run Temporal in HA mode or use a managed Temporal service.
9. Configure external object storage for evidence and retention lifecycle rules.
10. Configure OpenTelemetry export to the organization's observability stack.
11. Establish emergency kill-switch and incident procedures.
12. Threat-model each adapter and MCP server before allowing write capabilities.
13. Define backup RPO/RTO and perform disaster-recovery exercises.
14. Run chaos tests for timeout-after-effect scenarios.

## Critical invariant

Never automatically retry a consequential operation after an ambiguous network failure unless the external system provides a verified idempotency guarantee.
