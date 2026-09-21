# RASTHOR·IA Cloud DM

Backend del Director de Juego para RASTHOR·IA usando Cloudflare Workers AI y Qwen3 30B-A3B.

## Cloudflare

- Root directory: `cloudflare-worker`
- Build command: vacío
- Deploy command: `npm run deploy`
- Worker name: `rasthoria-cloud-dm`

El Worker expone:

- `GET /health`
- `GET /api/connection`
- `POST /api/gm`

Después del primer deploy, abre una vez el juego con:

`https://ragamoofi.github.io/rasthoria/?api=https://TU-WORKER.workers.dev`

El endpoint queda guardado localmente y el parámetro `api` desaparece de la URL.