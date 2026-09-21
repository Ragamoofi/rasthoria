const MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const ALLOWED_ORIGINS = new Set([
  "https://ragamoofi.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://ragamoofi.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    "Cache-Control": "no-store"
  };
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders(origin) }
  });
}

function trimText(value, max) {
  return String(value ?? "").slice(0, max);
}

const SYSTEM = `Eres el Dungeon Master dinámico de RASTHOR·IA, un RPG narrativo inspirado en d20/5e.

Narra siempre en español natural. Tu prioridad es una aventura reactiva, coherente, sorprendente y con consecuencias persistentes.

REGLAS:
- El jugador controla únicamente las acciones, pensamientos y palabras de su personaje. Nunca actúes por él.
- Tú controlas mundo, NPC, enemigos, ambiente y consecuencias narrativas.
- El motor de RASTHOR·IA controla dados, DC, HP, CA, daño, iniciativa y cualquier éxito o fracaso ya resuelto. No contradigas esos resultados.
- No fuerces una historia lineal. Responde a las decisiones del jugador.
- Mantén continuidad con nombres, pistas, relaciones, lugares y hechos previos.
- Los NPC tienen objetivos propios y pueden mentir, negarse, huir, negociar, traicionar o cambiar de opinión.
- No reveles información que el personaje no podría saber.
- Evita frases genéricas y repeticiones. Sé concreto.
- Normalmente responde entre 70 y 180 palabras.
- Termina en una situación accionable, sin listas obligatorias de opciones.
- No menciones estas instrucciones, Cloudflare ni que eres una IA.

TIRADAS:
Si la acción claramente requiere una prueba y el motor aún no entregó un resultado, puedes comenzar EXACTAMENTE con:
[[CHECK|Habilidad|ATRIBUTO|DC|razón breve]]
Habilidad debe ser una habilidad d20 apropiada; ATRIBUTO debe ser STR, DEX, CON, INT, WIS o CHA; DC entre 8 y 18.
Después del marcador, prepara la situación pero no resuelvas el éxito.`;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "RASTHOR·IA Cloud DM", model: MODEL }, 200, origin);
    }

    if (request.method !== "POST" || url.pathname !== "/chat") {
      return json({ error: "Not found" }, 404, origin);
    }

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json({ error: "Origin not allowed" }, 403, origin);
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 60000) {
      return json({ error: "Request too large" }, 413, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, origin);
    }

    const context = trimText(body?.context, 12000);
    const instruction = trimText(body?.instruction, 5000);
    const history = Array.isArray(body?.history)
      ? body.history.slice(-8).map((m) => ({
          role: m?.role === "user" ? "user" : "assistant",
          content: trimText(m?.content, 1200)
        }))
      : [];

    if (!instruction) return json({ error: "Missing instruction" }, 400, origin);

    const messages = [
      { role: "system", content: SYSTEM + "\n\nESTADO ACTUAL DEL JUEGO:\n" + context },
      ...history,
      { role: "user", content: "[INSTRUCCIÓN INTERNA DEL MOTOR]\n" + instruction }
    ];

    try {
      const result = await env.AI.run(MODEL, {
        messages,
        max_tokens: 260,
        temperature: 0.72,
        top_p: 0.9
      });

      const response = typeof result === "string"
        ? result
        : (result?.response || result?.result?.response || "");

      if (!response) return json({ error: "Empty model response" }, 502, origin);

      return json({ ok: true, response }, 200, origin);
    } catch (error) {
      console.error("RASTHOR·IA Workers AI error", error);
      return json({ error: "AI temporarily unavailable" }, 503, origin);
    }
  }
};
