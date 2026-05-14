#!/usr/bin/env bash
set -euo pipefail

NODE_BASE=${NODE_BASE:-http://localhost:3001}
PY_BASE=${PY_BASE:-http://localhost:3002}
TOKEN=${TOKEN:?set TOKEN to a valid bearer token}

endpoints=(
  "GET  /health"
  "GET  /api/v1/dashboards"
  "GET  /api/v1/resources"
  "GET  /api/v1/customers"
)

for ep in "${endpoints[@]}"; do
  method=${ep%% *}
  path=${ep##* }
  node=$(curl -sS -X "$method" -H "Authorization: Bearer $TOKEN" "$NODE_BASE$path" | jq -S .)
  py=$(curl -sS -X "$method" -H "Authorization: Bearer $TOKEN" "$PY_BASE$path" | jq -S .)
  if [[ "$node" != "$py" ]]; then
    echo "DIFF on $ep"
    diff <(echo "$node") <(echo "$py")
    exit 1
  fi
  echo "OK    $ep"
done
