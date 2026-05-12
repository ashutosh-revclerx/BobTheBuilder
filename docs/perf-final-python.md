# Python Backend Performance Validation

Status: pending live-stack run.

Use the migrated Python backend with the same database, same data, and warmed JWKS/LLM caches as the Node baseline:

```bash
BASE_URL=http://localhost:3001 TOKEN=<valid-token> ./scripts/perf-benchmark.sh
```

Acceptance criteria from `MIGRATION_PLAN.md`:

| Endpoint | Target |
| --- | --- |
| `GET /health` | p99 <= 10 ms |
| `GET /api/v1/dashboards` | p99 <= 1.10x Node baseline |
| `POST /api/v1/execute` | p99 <= 1.10x Node baseline |
| `POST /api/v1/assistant/chat` | p99 <= 0.95x Node baseline |

Results:

| Endpoint | p99 | Pass |
| --- | --- | --- |
| `GET /health` | TBD | TBD |
| `GET /api/v1/dashboards` | TBD | TBD |
| `POST /api/v1/execute` | TBD | TBD |
| `POST /api/v1/assistant/chat` | TBD | TBD |
