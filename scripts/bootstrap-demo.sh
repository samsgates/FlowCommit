#!/usr/bin/env sh
set -eu
API="${FLOWCOMMIT_API_URL:-http://localhost:8080}"
TENANT="${FLOWCOMMIT_TENANT:-demo}"
ACTOR="${FLOWCOMMIT_ACTOR:-demo-admin}"
DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

echo "Publishing demo Business Effect Contract..."
curl -fsS -X POST "$API/api/v1/contracts" \
  -H "content-type: application/json" \
  -H "x-flowcommit-tenant: $TENANT" \
  -H "x-flowcommit-actor: $ACTOR" \
  --data-binary "@$DIR/examples/demo/demo.bec.json"

echo "\nCreating demo transaction..."
curl -fsS -X POST "$API/api/v1/transactions" \
  -H "content-type: application/json" \
  -H "x-flowcommit-tenant: $TENANT" \
  -H "x-flowcommit-actor: $ACTOR" \
  -d '{"tenantId":"demo","environmentId":"dev","contract":{"name":"demo-safe-action","version":1},"input":{"requestId":"demo-001"},"idempotencyKey":"demo-001"}'
echo
