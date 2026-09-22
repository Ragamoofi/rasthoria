# RASTHOR·IA Narrador — Cloudflare Worker

Build v16: `2026-09-22-rules-v16-multi-ai-byok`

El Worker cumple dos funciones:

1. Narrador gratuito mediante Cloudflare Workers AI.
2. Relay sin persistencia para claves BYOK de OpenAI o Gemini.

## Cabeceras del frontend

- `X-Rasthoria-AI-Provider`: `cloudflare`, `openai` o `gemini`.
- `X-Rasthoria-AI-Model`: modelo elegido.
- `X-Rasthoria-AI-Key`: solo para OpenAI/Gemini.

La clave se usa únicamente en memoria durante la petición para llamar al proveedor y no se incluye en logs explícitos, respuestas, guardados ni base de datos.

## Rutas

- `GET /health`
- `GET /api/connection`
- `POST /api/provider-test`
- `POST /api/random-campaign`
- `POST /api/character-build`
- `POST /api/gm`

## Modelos por defecto

- Cloudflare: `@cf/qwen/qwen3-30b-a3b-fp8`, con Gemma como fallback del modo gratuito.
- OpenAI: `gpt-5.6-luna`.
- Gemini: `gemini-3.8-flash`.

El modo OpenAI/Gemini no llama a `env.AI`, por lo que una cuota agotada de Workers AI no interrumpe esas partidas.
