# LLM service

FastAPI microservice that wraps Gemini and returns dashboard configs to the
Node backend. Lives in its own service so prompt iteration and Python deps
don't touch the main app.

## Run via docker-compose (preferred)

From the repo root:

```
docker compose up -d --build
```

Verify:

```
curl http://localhost:8000/health
```

Should return `{"status":"ok","model":"gemini-2.5-flash","has_api_key":true}`.

## Run locally for prompt iteration

```
cd services/llm
python -m venv .venv
.venv\Scripts\activate          # Windows; use source .venv/bin/activate elsewhere
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Smoke test the /generate endpoint

```
curl -X POST http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Show me a dashboard with the total user count and a table of users",
    "resources": [{
      "id": "stub",
      "name": "jsonph",
      "type": "REST",
      "base_url": "https://jsonplaceholder.typicode.com",
      "endpoints": [
        { "method": "GET", "path": "/users", "summary": "List users" }
      ]
    }],
    "variantCount": 4
  }'
```

Expect `success: true` and 4 variants (the LLM-generated original + 3 palette swaps).

## File map

```
app/
  main.py            FastAPI entry; /health, /generate
  schemas.py         Pydantic models — request, response, dashboard schema
  prompts.py         System prompt + per-request user-prompt builder
  gemini_client.py   Gemini SDK wrapper + 1-shot retry on schema failure
  variants.py        Programmatic palette-swap variant generator
```

## Env vars

| Var | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | (required) | Gemini API key |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Model id; bump to `gemini-2.5-pro` for harder prompts |
| `LLM_SERVICE_PORT` | `8000` | Uvicorn port |
