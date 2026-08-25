from pathlib import Path
import json, sys
root=Path(__file__).resolve().parents[1]
required=[
 'README.md','LICENSE','package.json','docker-compose.yml','packages/core/src/runtime.ts','packages/db/schema.sql',
 'apps/api/src/server.ts','apps/studio/app/page.tsx','deploy/opa/flowcommit.rego','deploy/helm/flowcommit/Chart.yaml',
 'examples/refund/customer-refund.bec.json','docs/production.md','SECURITY.md'
]
missing=[p for p in required if not (root/p).exists()]
if missing:
 print('Missing required files:',missing);sys.exit(1)
for p in root.rglob('*.json'):
 try: json.loads(p.read_text())
 except Exception as e: print(f'Invalid JSON {p}: {e}');sys.exit(1)
print(f'Repository validation passed. Files: {sum(1 for p in root.rglob("*") if p.is_file())}')
