# RASTHOR·IA

**Tu historia aún no ha sido escrita.**

RPG narrativo dinámico con campañas libres, memoria persistente, consecuencias, combate d20 y un Narrador IA en la nube.

## Archivos principales

- `index.html` — juego web autocontenido.
- `assets/dice-roulette.css` — aspecto visual de los dados tipo ruleta interna.
- `assets/dice-roulette.js` — animación de números y sincronización con el resultado real del motor.
- `DADOS_RULETA_LAB.html` — laboratorio visual para probar D4, D6, D8, D10, D12, D20, ventaja y varias tiradas.
- `cloudflare-worker/` — backend del Narrador mediante Cloudflare Workers AI.

## Narrador IA

Worker de producción:

`https://rasthoria-cloud-dm.o-sariego.workers.dev`

Modelo actual: **Llama 3.3 70B Fast** mediante Workers AI.

La versión v13 del Worker añade:

- compatibilidad con pruebas locales (`file://`, localhost y 127.0.0.1);
- generación de campaña con dos rutas de IA y un fallback para no bloquear la creación;
- creación de ficha con fallback;
- respuestas del Narrador con salida estructurada y recuperación JSON flexible;
- roleo y preguntas normales sin tiradas D20 obligatorias;
- D20 reservado para incertidumbre, riesgo, oposición o tareas realmente resolubles por dados;
- recuperación segura del turno cuando el modelo no responde.

Los jugadores no necesitan iniciar sesión en ChatGPT ni pegar una API key.
