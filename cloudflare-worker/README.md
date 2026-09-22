# RASTHOR·IA Cloud Narrator

Backend del **Narrador** de RASTHOR·IA usando Cloudflare Workers AI y Llama 3.3 70B Fast.

## Cloudflare

- Root directory: `cloudflare-worker`
- Main: `src/index.js`
- AI binding: `AI`
- Worker esperado: `rasthoria-cloud-dm`

## Endpoints

- `GET /health`
- `GET /api/connection`
- `POST /api/random-campaign`
- `POST /api/character-build`
- `POST /api/gm`

## Resiliencia del Narrador

La versión v13 está pensada para que la campaña no se congele si Workers AI tarda o devuelve JSON imperfecto.

- La respuesta principal intenta salida estructurada y después una recuperación JSON flexible.
- El generador de campañas y el constructor de personaje tienen fallback y no deberían bloquear la creación por una caída temporal del modelo.
- El turno del jugador se conserva si la IA no responde.
- Preguntas y roleo normal continúan sin obligar una tirada D20.
- El D20 se exige cuando hay incertidumbre, riesgo, oposición o una tarea que realmente lo justifique.
- Se aceptan GitHub Pages y los orígenes locales usados para pruebas (`file://`, `localhost`, `127.0.0.1`).
