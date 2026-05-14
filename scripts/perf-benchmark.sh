#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${BASE_URL:-http://localhost:3001}
TOKEN=${TOKEN:-}
TOOL=${TOOL:-}
REQUESTS=${REQUESTS:-200}
CONNECTIONS=${CONNECTIONS:-20}
DURATION=${DURATION:-30s}

endpoints=(
  "GET /health"
  "GET /api/v1/dashboards"
  "POST /api/v1/execute"
  "POST /api/v1/assistant/chat"
)

auth_args=()
if [[ -n "$TOKEN" ]]; then
  auth_args=(-H "Authorization: Bearer $TOKEN")
fi

if [[ -z "$TOOL" ]]; then
  if command -v bombardier >/dev/null 2>&1; then
    TOOL=bombardier
  elif command -v wrk >/dev/null 2>&1; then
    TOOL=wrk
  else
    echo "Install bombardier or wrk, or set TOOL=bombardier|wrk" >&2
    exit 1
  fi
fi

for ep in "${endpoints[@]}"; do
  method=${ep%% *}
  path=${ep##* }
  url="$BASE_URL$path"
  echo
  echo "== $method $url =="
  if [[ "$TOOL" == "bombardier" ]]; then
    bombardier -m "$method" -n "$REQUESTS" -c "$CONNECTIONS" "${auth_args[@]}" "$url"
  elif [[ "$TOOL" == "wrk" ]]; then
    wrk -t2 -c"$CONNECTIONS" -d"$DURATION" "$url"
  else
    echo "Unknown TOOL=$TOOL" >&2
    exit 1
  fi
done
