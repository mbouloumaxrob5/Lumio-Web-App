# Local Embeddings Proxy (OpenAI-compatible)

This small proxy provides a local endpoint POST /embed that returns an embedding vector.

Behavior:
- If OPENAI_API_KEY is set, the proxy calls OpenAI's Embeddings API (model configurable via OPENAI_MODEL) and returns the vector (padded/truncated to EMBEDDING_DIM if needed).
- If OPENAI_API_KEY is not set, the proxy returns a deterministic pseudo-embedding based on the input (useful for local development and tests).

Environment variables:
- PORT (default 8080)
- OPENAI_API_KEY (optional)
- OPENAI_MODEL (optional, default text-embedding-3-small)
- EMBEDDING_DIM (optional, default 1536)

Run locally:

1. cd services/embeddings-proxy
2. npm install
3. OPENAI_API_KEY=sk-... EMBEDDING_DIM=1536 npm start

Example request:

curl -X POST http://localhost:8080/embed -H "Content-Type: application/json" -d '{"text":"A calm forest at golden hour"}'

Response:
{ "embedding": [0.123, -0.45, ...] }
