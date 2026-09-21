# RASTHOR·IA Cloud DM

Backend de prueba para RASTHOR·IA usando **Cloudflare Workers AI** y el modelo **Qwen3 30B-A3B**.

## Despliegue rápido

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Ragamoofi/rasthoria/tree/main/cloudflare-worker)

Cloudflare detectará automáticamente el binding `AI` definido en `wrangler.jsonc`.

Cuando termine el despliegue, copia la URL del Worker, que será parecida a:

`https://rasthoria-cloud-dm.<tu-subdominio>.workers.dev`

Prueba primero:

`https://TU-WORKER.workers.dev/health`

Debe responder con un JSON que incluya `"ok": true`.

## Conectar RASTHOR·IA para la prueba

Abre RASTHOR·IA con:

`https://ragamoofi.github.io/rasthoria/?api=https://TU-WORKER.workers.dev`

RASTHOR·IA guardará ese endpoint en el navegador y empezará a usar la IA en la nube sin descargar modelos locales.
