# Node Backend Performance Baseline

Status: not captured in this workspace.

The migration plan requires this file to contain the Node/Express baseline before cutover. The old Node backend has now been removed from this working tree, so capture the baseline from the pre-cutover branch or `node-backend-final` tag if a final audit is needed.

Use:

```bash
BASE_URL=http://localhost:3001 TOKEN=<valid-token> ./scripts/perf-benchmark.sh
```

Record p99 latency for:

| Endpoint | p99 |
| --- | --- |
| `GET /health` | TBD |
| `GET /api/v1/dashboards` | TBD |
| `POST /api/v1/execute` | TBD |
| `POST /api/v1/assistant/chat` | TBD |
