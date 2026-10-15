# NewTerpCat

See [newTerpCatSpec.md](newTerpCatSpec.md) for the spec.

## Run

Needs [uv](https://docs.astral.sh/uv/) and Node.js.

```sh
# Terminal 1: API on http://localhost:8000 (docs at /docs)
cd backend && uv run uvicorn app.main:app --reload --port 8000

# Terminal 2: web app on http://localhost:3100
cd frontend && npm install && npx next dev -p 3100
```

The frontend calls the API at `API_URL` (default `http://localhost:8000`).

## Test

```sh
cd backend && uv run pytest
cd frontend && npm test
```
