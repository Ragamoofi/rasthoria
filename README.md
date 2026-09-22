# RASTHOR·IA

**Tu historia aún no ha sido escrita.**

RPG narrativo dinámico con campañas libres, memoria persistente, consecuencias, combate d20, dados tipo ruleta interna y un Narrador IA intercambiable.

## Narrador IA v16

RASTHOR·IA ya no depende de un único modelo. Cada navegador puede elegir:

- **RASTHOR·IA Gratis** — Cloudflare Workers AI administrado por el proyecto. No requiere clave, pero comparte una cuota diaria.
- **OpenAI** — el jugador usa su propia clave de OpenAI API. Modelo recomendado por defecto: `gpt-5.6-luna`.
- **Gemini** — el jugador usa su propia clave de Gemini API / Google AI Studio. Modelo recomendado por defecto: `gemini-3.8-flash`.

El selector aparece como **Narrador IA** dentro del juego. La campaña, los guardados, el motor de dados y las reglas no dependen del proveedor elegido y se puede cambiar de IA entre turnos.

Las claves no se escriben en los guardados ni en el repositorio. Si el jugador decide recordarlas, se almacenan únicamente en el navegador; el Worker las recibe por HTTPS para reenviar la petición al proveedor seleccionado.

## Archivos principales

- `index.html` — juego web autocontenido.
- `assets/dice-roulette.css` / `assets/dice-roulette.js` — dados 2D con ruleta interna.
- `assets/ai-provider.css` / `assets/ai-provider.js` — selector multiproveedor del Narrador.
- `cloudflare-worker/` — proxy/orquestador del Narrador y modo gratuito de Workers AI.

Worker de producción:

`https://rasthoria-cloud-dm.o-sariego.workers.dev`

Los proveedores externos no consumen la cuota de Workers AI: el Worker funciona únicamente como relay sin persistir la clave en la aplicación.
