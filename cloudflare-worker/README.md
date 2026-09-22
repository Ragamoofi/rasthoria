# RASTHOR·IA Cloud DM

Backend del Director de Juego para RASTHOR·IA usando Cloudflare Workers AI y Llama 3.3 70B Fast.

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

## Resiliencia del Director

El turno se guarda antes de consultar al Director. Para evitar esperas largas,
`/api/gm` limita la generación principal a una llamada de modelo con tiempo
máximo y, solo si la salida viola una regla semántica, permite una reparación
adicional más corta. Si Workers AI falla o se demora demasiado, el Worker usa
la respuesta de emergencia del motor sin perder el estado.

El frontend crea un AbortController nuevo por reintento. Si ambos intentos de
red fallan, conserva `awaiting_gm`: **Retomar la escena** solicita el mismo
turno ya guardado en lugar de obligar a escribir la acción otra vez.
