const MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const ALLOWED_ORIGINS = new Set([
  "https://ragamoofi.github.io",
  "https://umbral-rpg-oscar.o-sariego.chatgpt.site",
]);

const EFFECT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: { type: "string", enum: ["item_add","item_remove","item_rename","currency","xp","condition_add","condition_remove","wound"] },
    target: { type: "string", maxLength: 100 },
    amount: { type: "integer", minimum: -10000, maximum: 10000 },
    text: { type: "string", maxLength: 500 },
  },
  required: ["type","target","amount","text"],
};

const NULLABLE = (schema) => ({ anyOf: [schema, { type: "null" }] });
const CHECK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: ["check","save"] },
    ability: { type: "string", enum: ["STR","DEX","CON","INT","WIS","CHA"] },
    skill: NULLABLE({ type: "string", enum: ["athletics","acrobatics","sleight","stealth","arcana","history","investigation","nature","religion","animal","insight","medicine","perception","survival","deception","intimidation","performance","persuasion"] }),
    dc: { type: "integer", minimum: 5, maximum: 30 },
    advantage: { type: "string", enum: ["normal","advantage","disadvantage"] },
    reason: { type: "string", maxLength: 300 },
    success: { type: "array", maxItems: 8, items: EFFECT_SCHEMA },
    failure: { type: "array", maxItems: 8, items: EFFECT_SCHEMA },
    damage: NULLABLE({
      type: "object",
      additionalProperties: false,
      properties: {
        sides: { type: "integer", enum: [4,6,8,10,12] },
        count: { type: "integer", minimum: 1, maximum: 6 },
        modifier: { type: "integer", minimum: 0, maximum: 10 },
        onSuccess: { type: "string", enum: ["half","none"] },
      },
      required: ["sides","count","modifier","onSuccess"],
    }),
  },
  required: ["kind","ability","skill","dc","advantage","reason","success","failure","damage"],
};

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: NULLABLE({ type: "string", maxLength: 90 }),
    narrative: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: { type: "string", enum: ["narrator","npc"] },
          speaker: { type: "string", maxLength: 80 },
          text: { type: "string", maxLength: 3500 },
        },
        required: ["kind","speaker","text"],
      },
    },
    check: NULLABLE(CHECK_SCHEMA),
    effects: { type: "array", maxItems: 10, items: EFFECT_SCHEMA },
    encounter: NULLABLE({
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", maxLength: 90 },
          profile: { type: "string", enum: ["brute","skirmisher","ranged","guardian","minion"] },
          side: { type: "string", enum: ["enemy","ally"] },
          tactic: { type: "string", maxLength: 200 },
          entityId: NULLABLE({ type: "string", maxLength: 100 }),
          distance: { type: "number", minimum: 0, maximum: 60 },
        },
        required: ["name","profile","side","tactic","entityId","distance"],
      },
    }),
    combatIntent: NULLABLE({
      type: "object",
      additionalProperties: false,
      properties: {
        actor: { type: "string", maxLength: 100 },
        action: { type: "string", enum: ["attack","dodge","flee"] },
        target: NULLABLE({ type: "string", maxLength: 100 }),
      },
      required: ["actor","action","target"],
    }),
    memory: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string", maxLength: 8000 },
        entities: {
          type: "array",
          maxItems: 20,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string", maxLength: 100 },
              kind: { type: "string", enum: ["npc","place","quest","faction","secret","event"] },
              name: { type: "string", maxLength: 100 },
              description: { type: "string", maxLength: 1800 },
              status: { type: "string", maxLength: 100 },
              relation: { type: "integer", minimum: -100, maximum: 100 },
            },
            required: ["id","kind","name","description","status","relation"],
          },
        },
        decision: NULLABLE({ type: "string", maxLength: 700 }),
        flags: {
          type: "array",
          maxItems: 20,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              key: { type: "string", maxLength: 80 },
              value: { type: "string", maxLength: 300 },
            },
            required: ["key","value"],
          },
        },
        elapsedMinutes: { type: "integer", minimum: 0, maximum: 1440 },
        location: NULLABLE({ type: "string", maxLength: 150 }),
      },
      required: ["summary","entities","decision","flags","elapsedMinutes","location"],
    },
    safeRest: { type: "boolean" },
    privateMemory: { type: "string", maxLength: 14000 },
  },
  required: ["title","narrative","check","effects","encounter","combatIntent","memory","safeRest","privateMemory"],
};

function cors(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://ragamoofi.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...cors(origin) },
  });
}

function clip(value, max) {
  return String(value ?? "").slice(0, max);
}

function publicCampaign(campaign) {
  const c = campaign && typeof campaign === "object" ? campaign : {};
  const character = c.character || {};
  const memory = c.memory || {};
  const messages = Array.isArray(c.messages) ? c.messages.slice(-14) : [];
  const rolls = Array.isArray(c.rolls) ? c.rolls.slice(-8) : [];
  const combat = c.combat || null;
  return {
    title: clip(c.title, 120),
    revision: Number(c.revision || 0),
    phase: c.phase,
    lastEvent: clip(c.lastEvent, 2500),
    config: {
      premise: clip(c.config?.premise, 6000),
      genre: clip(c.config?.genre, 100),
      tone: clip(c.config?.tone, 100),
      difficulty: clip(c.config?.difficulty, 50),
      mortality: clip(c.config?.mortality, 50),
      notes: clip(c.config?.notes, 2500),
    },
    character: {
      name: clip(character.name, 100),
      concept: clip(character.concept, 180),
      ancestry: clip(character.ancestry, 120),
      background: clip(character.background, 2500),
      classId: character.classId,
      level: character.level,
      xp: character.xp,
      hp: character.hp,
      maxHp: character.maxHp,
      speed: character.speed,
      stats: character.stats,
      skills: character.skills,
      languages: character.languages,
      traits: character.traits,
      conditions: character.conditions,
      wounds: character.wounds,
      gold: character.gold,
      weapon: character.weapon,
      armor: character.armor,
      resources: character.resources,
      inventory: Array.isArray(character.inventory) ? character.inventory.slice(0, 40) : [],
    },
    messages: messages.map((m) => ({
      role: m.role,
      speaker: clip(m.speaker, 80),
      text: clip(m.text, 1600),
      roll: m.roll ? {
        purpose: clip(m.roll.purpose, 300), total: m.roll.total, natural: m.roll.natural,
        success: m.roll.success, critical: m.roll.critical, values: m.roll.values,
      } : undefined,
    })),
    memory: {
      summary: clip(memory.summary, 8000),
      entities: Array.isArray(memory.entities) ? memory.entities.slice(-30) : [],
      decisions: Array.isArray(memory.decisions) ? memory.decisions.slice(-20) : [],
      flags: memory.flags || {},
      day: memory.day,
      minute: memory.minute,
      location: clip(memory.location, 150),
    },
    pending: c.pending,
    combat: combat ? {
      round: combat.round,
      order: combat.order,
      index: combat.index,
      action: combat.action,
      bonus: combat.bonus,
      reaction: combat.reaction,
      movement: combat.movement,
      dodging: combat.dodging,
      shield: combat.shield,
      fled: combat.fled,
      actors: Array.isArray(combat.actors) ? combat.actors.map((a) => ({
        id:a.id,name:a.name,side:a.side,profile:a.profile,hp:a.hp,maxHp:a.maxHp,ac:a.ac,
        attack:a.attack,damage:a.damage,range:a.range,speed:a.speed,distance:a.distance,
        conditions:a.conditions,tactic:a.tactic,entityId:a.entityId,
      })) : [],
    } : null,
    rolls,
    gmVault: clip(c.gmVault, 10000),
    lastRestAvailable: Boolean(c.lastRestAvailable),
  };
}

const SYSTEM = `Eres el Director de Juego de RASTHOR·IA, un RPG narrativo reactivo inspirado en d20/SRD 5e. Tu respuesta NO es texto libre: debe cumplir exactamente el JSON solicitado.

OBJETIVO
Crear una campaña viva, coherente, impredecible y con consecuencias persistentes. El usuario puede proponer cualquier género y premisa. Adáptate sin imponer fantasía medieval si no corresponde.

AUTORIDAD
- El jugador controla SOLO a su personaje: acciones, palabras, intenciones y decisiones.
- Tú controlas el mundo, NPC, adversarios, ambiente, información, consecuencias y ritmo.
- El motor del juego es la autoridad absoluta sobre dados, HP, AC, daño, iniciativa, inventario, condiciones y resultados ya resueltos. Nunca contradigas un resultado del motor.
- No inventes una tirada ya realizada ni cambies su resultado.
- Si el motor informa éxito, narra éxito; si informa fracaso, narra fracaso y sus consecuencias.

TIRADAS
- Pide check solo cuando exista incertidumbre significativa y el resultado importe.
- No pidas tiradas para acciones triviales, información obvia ni decisiones puramente narrativas.
- skill debe corresponder a ability. Las salvaciones usan skill=null.
- DC orientativa: 8 fácil, 10 normal, 12 moderada, 15 difícil, 18 muy difícil, 20+ excepcional.
- Si solicitas check, effects debe estar vacío y encounter debe ser null; las consecuencias mecánicas van en success/failure.

COMBATE
- Solo crea encounter cuando la situación realmente inicia combate. Debe incluir al menos un enemy.
- Los perfiles válidos son brute, skirmisher, ranged, guardian y minion.
- Si ya hay combate y el turno pertenece a un actor que no es player, usa combatIntent con attack, dodge o flee. No pidas check para ese turno.
- No otorgues XP, objetos ni dinero durante combate: el motor adjudica XP al finalizar.

EFECTOS
- Usa solo efectos mecánicos válidos: item_add, item_remove, item_rename, currency, xp, condition_add, condition_remove, wound.
- No uses efectos para cosas que pueden quedar solo narrativas.
- XP fuera de combate debe ser moderada y justificada.

NARRACIÓN
- Español natural, inmersivo y concreto.
- Normalmente 1 a 4 bloques narrativos; 80 a 280 palabras totales salvo que la escena necesite más.
- Los diálogos de NPC pueden ir como kind=npc con speaker real.
- No escribas listas de opciones salvo que la situación lo exija. Termina en un punto donde el jugador pueda actuar.
- Nunca narres que el personaje del jugador decide, acepta, siente o actúa si el usuario no lo declaró.
- No repitas la premisa ni resumas innecesariamente lo recién ocurrido.

MEMORIA
- memory.summary es un resumen compacto de hechos públicos y persistentes necesarios para continuar la campaña. Actualízalo, no lo conviertas en una novela.
- memory.entities incluye SOLO entidades que deban crearse o actualizarse este turno. Reutiliza IDs existentes exactamente cuando actualices algo.
- Nunca resucites una entidad cuyo estado irreversible indique muerte.
- memory.decision registra una decisión importante del jugador solo cuando realmente la haya.
- flags guarda hechos simples útiles para lógica futura.
- elapsedMinutes debe reflejar el tiempo narrativo razonable transcurrido este turno; durante combate normalmente 0.
- location cambia solo cuando realmente cambia la ubicación.
- privateMemory contiene secretos del Director, planes, verdades ocultas, identidades secretas y consecuencias todavía no reveladas. Conserva secretos previos y añade solo lo necesario. No reveles privateMemory en narrative.

CONTINUIDAD
Respeta nombres, relaciones, heridas, recursos, lugares, secretos y decisiones ya establecidos. Los NPC tienen objetivos propios, pueden mentir, negarse, huir, negociar, traicionar, perdonar o cambiar según lo ocurrido. No reveles conocimiento que el personaje no puede tener.`;

function normalizeResponse(raw, campaign) {
  const currentSummary = clip(campaign?.memory?.summary, 8000);
  const currentVault = clip(campaign?.gmVault, 14000);
  const r = raw && typeof raw === "object" ? raw : {};
  const out = {
    title: typeof r.title === "string" ? clip(r.title,90) : null,
    narrative: Array.isArray(r.narrative) ? r.narrative.slice(0,12).filter(x=>x&&typeof x.text==="string").map(x=>({
      kind: x.kind === "npc" ? "npc" : "narrator",
      speaker: clip(x.speaker,80),
      text: clip(x.text,3500),
    })) : [],
    check: r.check ?? null,
    effects: Array.isArray(r.effects) ? r.effects.slice(0,10) : [],
    encounter: Array.isArray(r.encounter) ? r.encounter.slice(0,6) : null,
    combatIntent: r.combatIntent ?? null,
    memory: {
      summary: typeof r.memory?.summary === "string" ? clip(r.memory.summary,8000) : currentSummary,
      entities: Array.isArray(r.memory?.entities) ? r.memory.entities.slice(0,20) : [],
      decision: typeof r.memory?.decision === "string" ? clip(r.memory.decision,700) : null,
      flags: Array.isArray(r.memory?.flags) ? r.memory.flags.slice(0,20) : [],
      elapsedMinutes: Number.isInteger(r.memory?.elapsedMinutes) ? Math.max(0,Math.min(1440,r.memory.elapsedMinutes)) : 0,
      location: typeof r.memory?.location === "string" ? clip(r.memory.location,150) : null,
    },
    safeRest: Boolean(r.safeRest),
    privateMemory: typeof r.privateMemory === "string" ? clip(r.privateMemory,14000) : currentVault,
  };
  if (!out.narrative.length) out.narrative=[{kind:"narrator",speaker:"",text:"El mundo guarda silencio un instante, pero la situación permanece abierta. ¿Qué haces?"}];
  return out;
}

function modelResponseObject(result) {
  if (!result) return null;
  if (result.response && typeof result.response === "object") return result.response;
  if (typeof result.response === "string") {
    try { return JSON.parse(result.response); } catch {}
  }
  if (typeof result === "object" && !Array.isArray(result) && (result.narrative || result.memory)) return result;
  return null;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response(null,{status:403});
      return new Response(null,{status:204,headers:cors(origin)});
    }
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({error:"Origin not allowed"},403,origin);

    const url = new URL(request.url);
    if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/connection")) {
      if (url.pathname === "/api/connection") {
        return json({connected:true,model:"Qwen3 30B · RASTHOR·IA Cloud",managed:true,canConnect:false},200,origin);
      }
      return json({ok:true,service:"RASTHOR·IA Cloud DM",model:MODEL},200,origin);
    }

    if (url.pathname === "/api/connection" && (request.method === "POST" || request.method === "DELETE")) {
      return json({connected:true,model:"Qwen3 30B · RASTHOR·IA Cloud",managed:true,canConnect:false},200,origin);
    }

    if (request.method !== "POST" || url.pathname !== "/api/gm") return json({error:"Not found"},404,origin);

    const len = Number(request.headers.get("content-length") || 0);
    if (len > 250000) return json({error:"Campaign payload too large"},413,origin);

    let body;
    try { body = await request.json(); } catch { return json({error:"Invalid JSON"},400,origin); }
    const campaign = body?.campaign;
    if (!campaign || typeof campaign !== "object") return json({error:"Missing campaign"},400,origin);

    const compact = publicCampaign(campaign);
    const userPrompt = `ESTADO ACTUAL DE LA CAMPAÑA\n${JSON.stringify(compact)}\n\nProcesa exclusivamente el siguiente turno respetando lastEvent, los resultados de dados ya presentes y el estado del motor. Devuelve solo el objeto JSON solicitado.`;

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          { role:"system", content:SYSTEM },
          { role:"user", content:userPrompt },
        ],
        response_format: { type:"json_schema", json_schema: RESPONSE_SCHEMA },
        max_tokens: 1800,
        temperature: 0.72,
        top_p: 0.9,
        repetition_penalty: 1.08,
      });

      const parsed = modelResponseObject(result);
      if (!parsed) return json({error:"El Director IA devolvió una respuesta no válida."},502,origin);
      const response = normalizeResponse(parsed,campaign);
      return json({response,vault:response.privateMemory},200,origin);
    } catch (error) {
      console.error("RASTHOR·IA Workers AI error",error);
      return json({error:"El Director IA está temporalmente ocupado. Reintenta en unos segundos."},503,origin);
    }
  }
};