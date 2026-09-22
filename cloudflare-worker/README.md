# RASTHOR·IA Cloud Narrator

Backend del **Narrador** de RASTHOR·IA usando Cloudflare Workers AI.

## Cloudflare

- Root directory: `cloudflare-worker`
- Main: `src/index.js`
- AI binding: `AI`
- Worker esperado: `rasthoria-cloud-dm`

## Modelos v15

- principal: `@cf/qwen/qwen3-30b-a3b-fp8`
- fallback: `@cf/google/gemma-4-26b-a4b-it`

El Narrador solicita JSON por instrucciones y lo valida/normaliza localmente. Esto permite cambiar de modelo cuando hay timeout, capacidad temporal o JSON imperfecto.

## Endpoints

- `GET /health`
- `GET /api/connection`
- `POST /api/random-campaign`
- `POST /api/character-build`
- `POST /api/gm`

## Resiliencia v15

- Apertura de campaña con prompt y contrato reducidos, separados del turno normal.
- Fallback contextual de apertura si Workers AI falla, para que la campaña nunca empiece con una pantalla vacía.
- Detección de cuota (`3036`), capacidad (`3040`) y timeout.
- No se lanza un segundo modelo cuando la cuenta ya agotó su cuota diaria, porque compartiría la misma cuota.
- Reparaciones mecánicas sencillas se hacen determinísticamente, sin gastar otra inferencia.
- Campaña aleatoria y constructor de personaje mantienen fallbacks locales.
- Se aceptan GitHub Pages, `file://`, localhost y 127.0.0.1 para pruebas.

Cloudflare Workers AI aplica una cuota gratuita diaria compartida por cuenta. Si se agota, el juego mantiene un respaldo contextual hasta que la cuota se renueve.
