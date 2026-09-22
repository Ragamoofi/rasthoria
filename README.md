# RASTHOR·IA

**Tu historia aún no ha sido escrita.**

RPG narrativo dinámico con campañas libres, memoria persistente, consecuencias, combate d20 y un **Narrador IA** en la nube.

## Archivos principales

- `index.html` — juego web autocontenido.
- `assets/dice-roulette.css` — aspecto visual de los dados tipo ruleta interna.
- `assets/dice-roulette.js` — animación de números sincronizada con el resultado real del motor.
- `DADOS_RULETA_LAB.html` — laboratorio visual de dados.
- `cloudflare-worker/` — backend del Narrador mediante Cloudflare Workers AI.

## Narrador IA v15

Worker de producción:

`https://rasthoria-cloud-dm.o-sariego.workers.dev`

Modelos configurados:

- principal: **Qwen3 30B-A3B FP8**;
- respaldo de capacidad/JSON: **Gemma 4 26B A4B**.

La v15 está enfocada en que una caída o demora de Workers AI no deje la campaña muda:

- la primera escena usa una ruta propia, más corta y robusta;
- si toda la IA falla al abrir una campaña, se genera una apertura contextual de respaldo en vez del mensaje genérico de espera;
- las respuestas JSON se validan localmente sin depender del modo JSON estricto de un único modelo;
- se evita gastar otra llamada de IA solo para reparar errores semánticos sencillos;
- el frontend muestra si el problema fue cuota, capacidad o timeout en vez de ocultarlo;
- preguntas y roleo normal no fuerzan D20; el dado se reserva para incertidumbre, riesgo, oposición o tareas técnicas;
- el turno del jugador se conserva si la IA no responde.

Los jugadores no necesitan iniciar sesión en ChatGPT ni pegar una API key.
