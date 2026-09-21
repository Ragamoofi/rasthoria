# RASTHOR·IA

**Tu historia aún no ha sido escrita.**

RPG narrativo dinámico dirigido por IA, con motor de dados, campañas libres, memoria persistente y consecuencias reales.

## Base actual

La interfaz y el motor principal fueron recuperados desde la versión original de **Umbral** generada en ChatGPT Sites y migrados a RASTHOR·IA.

- `index.html` — versión web autocontenida del juego.
- `cloudflare-worker/` — Director de Juego en la nube mediante Cloudflare Workers AI + Qwen3 30B-A3B.
- Guardados locales mediante IndexedDB.
- Motor propio para dados, combate, iniciativa, HP, condiciones, inventario y progresión.

Los jugadores no necesitan iniciar sesión en ChatGPT, pegar una API key, activar WebGPU ni descargar modelos.

RASTHOR·IA es un proyecto completamente independiente de PokéSenda.
