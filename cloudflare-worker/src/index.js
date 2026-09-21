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

const CHARACTER_BUILD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    classId: { type: "string", enum: ["warrior","rogue","mage","cleric"] },
    priority: {
      type: "array",
      minItems: 6,
      maxItems: 6,
      items: { type: "string", enum: ["STR","DEX","CON","INT","WIS","CHA"] }
    },
    ancestry: { type: "string", maxLength: 100 },
    background: { type: "string", maxLength: 900 },
    languages: { type: "array", maxItems: 5, items: { type: "string", maxLength: 50 } },
    reason: { type: "string", maxLength: 500 }
  },
  required: ["classId","priority","ancestry","background","languages","reason"]
};

const RANDOM_CAMPAIGN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    premise: { type: "string", maxLength: 3500 },
    genre: { type: "string", maxLength: 100 },
    setting: { type: "string", maxLength: 180 },
    era: { type: "string", maxLength: 100 },
    tone: { type: "string", maxLength: 120 },
    fantasy: { type: "string", maxLength: 80 },
    combat: { type: "integer", minimum: 0, maximum: 5 },
    exploration: { type: "integer", minimum: 0, maximum: 5 },
    conversation: { type: "integer", minimum: 0, maximum: 5 },
    mystery: { type: "integer", minimum: 0, maximum: 5 },
    difficulty: { type: "string", enum: ["amable","equilibrada","exigente"] },
    mortality: { type: "string", enum: ["permanente","consecuencias"] },
    duration: { type: "string", maxLength: 100 },
    themes: { type: "string", maxLength: 1000 }
  },
  required: ["premise","genre","setting","era","tone","fantasy","combat","exploration","conversation","mystery","difficulty","mortality","duration","themes"]
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
      mode: clip(c.config?.mode, 30),
      genre: clip(c.config?.genre, 100),
      setting: clip(c.config?.setting, 180),
      era: clip(c.config?.era, 100),
      tone: clip(c.config?.tone, 120),
      fantasy: clip(c.config?.fantasy, 80),
      combat: Number(c.config?.combat ?? 0),
      exploration: Number(c.config?.exploration ?? 0),
      conversation: Number(c.config?.conversation ?? 0),
      mystery: Number(c.config?.mystery ?? 0),
      difficulty: clip(c.config?.difficulty, 50),
      mortality: clip(c.config?.mortality, 50),
      duration: clip(c.config?.duration, 100),
      themes: clip(c.config?.themes, 1200),
      characterType: clip(c.config?.characterType, 120),
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
      reactionOffer: combat.reactionOffer,
      fled: combat.fled,
      actors: Array.isArray(combat.actors) ? combat.actors.map((a) => ({
        id:a.id,name:a.name,side:a.side,profile:a.profile,hp:a.hp,maxHp:a.maxHp,ac:a.ac,
        attack:a.attack,sides:a.sides,damage:a.damage,dex:a.dex,xp:a.xp,range:a.range,speed:a.speed,distance:a.distance,
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
Crear una campaña viva, coherente, impredecible y con consecuencias persistentes. El usuario puede proponer LITERALMENTE cualquier género, época, universo o escala: vida cotidiana, drama, deportes, crimen, terror, western, histórico, cyberpunk, ciencia ficción, superhéroes, romance, fantasía o mezclas propias. Adáptate sin imponer fantasía medieval si no corresponde.

ADAPTACIÓN DE GÉNERO
- Las cuatro clases del motor son SOLO bases mecánicas. Combatiente, Especialista, Canalizador y Protector pueden representar profesiones, entrenamiento, tecnología, mutaciones, poderes, magia, medicina, liderazgo u otras explicaciones según el mundo.
- El catálogo de armas, protecciones, curación y suministros es una abstracción mecánica. En la narración dales una apariencia coherente con la ambientación.
- En el primer turno, si el equipo genérico no encaja, usa item_rename para darle nombres apropiados al mundo sin alterar sus estadísticas.
- Una campaña realista puede no tener magia. Una campaña contemporánea no debe introducir espadas, tabernas, reinos o hechizos salvo que la premisa los pida.
- No toda historia necesita salvar el mundo. Respeta campañas íntimas, sociales, deportivas, románticas, profesionales o de investigación.

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
- combatIntent.actor debe ser EXACTAMENTE el id del actor cuyo turno muestra combat.order; target debe ser EXACTAMENTE player o el id de otro actor válido.
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

    if (request.method === "POST" && url.pathname === "/api/random-campaign") {
      let body = {};
      try { body = await request.json(); } catch {}
      const seed = clip(body?.seed, 1200);
      const prefs = body?.preferences && typeof body.preferences === "object" ? body.preferences : {};
      const randomToken = crypto.randomUUID();
      const prompt = `Inventa UNA premisa nueva y jugable para RASTHOR·IA.

Puede ser absolutamente cualquier género, época y escala. No favorezcas fantasía medieval. Alterna entre historias realistas y extraordinarias: noir, vida cotidiana, deportes, música, romance, crimen, western, guerra, espionaje, horror, ciencia ficción, cyberpunk, superhéroes, supervivencia, histórico, piratas, mitología, comedia o híbridos inesperados.

La premisa debe:
- empezar con un gancho concreto y dejar mucha libertad al jugador;
- evitar profecías del elegido y clichés obligatorios salvo que sean una elección creativa deliberada;
- incluir suficiente conflicto para una campaña reactiva;
- no decidir la profesión del personaje salvo que el usuario ya la haya sugerido;
- poder jugarse con un motor d20 aunque no exista combate;
- variar de escala: no siempre salvar el mundo.

Semilla de variedad: ${randomToken}
Idea escrita por el usuario, si existe: ${seed || "ninguna"}
Preferencias actuales: ${JSON.stringify(prefs).slice(0,2500)}

Devuelve solo el JSON solicitado.`;
      try {
        const result = await env.AI.run(MODEL, {
          messages: [
            {role:"system",content:"Eres un diseñador de campañas de rol extremadamente versátil. No asumas fantasía medieval."},
            {role:"user",content:prompt}
          ],
          response_format: { type:"json_schema", json_schema:RANDOM_CAMPAIGN_SCHEMA },
          max_tokens: 900,
          temperature: 1.0,
          top_p: 0.96
        });
        const parsed = modelResponseObject(result);
        if (!parsed) return json({error:"El Director no pudo construir una idea válida."},502,origin);
        return json({campaign:{
          premise:clip(parsed.premise,3500),
          genre:clip(parsed.genre,100),
          setting:clip(parsed.setting,180),
          era:clip(parsed.era,100),
          tone:clip(parsed.tone,120),
          fantasy:clip(parsed.fantasy,80),
          combat:Math.max(0,Math.min(5,Number(parsed.combat)||0)),
          exploration:Math.max(0,Math.min(5,Number(parsed.exploration)||0)),
          conversation:Math.max(0,Math.min(5,Number(parsed.conversation)||0)),
          mystery:Math.max(0,Math.min(5,Number(parsed.mystery)||0)),
          difficulty:["amable","equilibrada","exigente"].includes(parsed.difficulty)?parsed.difficulty:"equilibrada",
          mortality:["permanente","consecuencias"].includes(parsed.mortality)?parsed.mortality:"consecuencias",
          duration:clip(parsed.duration,100)||"Campaña abierta",
          themes:clip(parsed.themes,1000)
        }},200,origin);
      } catch (error) {
        console.error("RASTHOR·IA random campaign error",error);
        return json({error:"El Director no pudo inventar una campaña ahora. Prueba otra vez."},503,origin);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/character-build") {
      let body = {};
      try { body = await request.json(); } catch { return json({error:"Datos de personaje no válidos."},400,origin); }
      const concept = clip(body?.concept, 200);
      const premise = clip(body?.premise, 5000);
      const ancestry = clip(body?.ancestry, 100);
      const background = clip(body?.background, 1800);
      const config = body?.config && typeof body.config === "object" ? body.config : {};
      const prompt = `Diseña la base mecánica de este protagonista según lo que el jugador dijo que será.

MUNDO/PREMISA:
${premise || "El mundo todavía es abierto."}

CONFIGURACIÓN:
${JSON.stringify(config).slice(0,2500)}

CONCEPTO DEL PERSONAJE:
${concept || "No especificado; infiere una opción versátil sin imponer una profesión."}

ORIGEN/ESPECIE ESCRITO:
${ancestry || "no especificado"}

PASADO ESCRITO:
${background || "no especificado"}

El motor tiene cuatro bases MECÁNICAS, no profesiones medievales:
- warrior = Combatiente: resistencia, fuerza, combate físico, aguante.
- rogue = Especialista: destreza, sigilo, investigación, técnica, precisión.
- mage = Canalizador: poder especial, tecnología avanzada, psiónica, mutación, magia o intelecto ofensivo.
- cleric = Protector: medicina, apoyo, liderazgo, defensa, recuperación.

Elige classId por cómo funcionaría el personaje, no por estética.
priority debe contener STR, DEX, CON, INT, WIS y CHA ordenadas desde la característica más importante a la menos importante. El juego asignará 15,14,13,12,10,8 en ese orden.
Si la historia es realista, no inventes magia. ancestry debe respetar lo escrito por el usuario; solo sugiere algo si estaba genérico. background puede ampliar brevemente el concepto sin decidir eventos importantes por el jugador.
Devuelve solo el JSON solicitado.`;
      try {
        const result = await env.AI.run(MODEL, {
          messages: [
            {role:"system",content:"Eres un diseñador de personajes d20 que adapta mecánicas a cualquier género sin imponer fantasía medieval."},
            {role:"user",content:prompt}
          ],
          response_format: { type:"json_schema", json_schema:CHARACTER_BUILD_SCHEMA },
          max_tokens: 650,
          temperature: 0.55,
          top_p: 0.9
        });
        const parsed = modelResponseObject(result);
        if (!parsed) return json({error:"El Director no pudo preparar una ficha válida."},502,origin);
        const abilities=["STR","DEX","CON","INT","WIS","CHA"];
        const priority=[];
        for(const a of Array.isArray(parsed.priority)?parsed.priority:[]) if(abilities.includes(a)&&!priority.includes(a)) priority.push(a);
        for(const a of abilities) if(!priority.includes(a)) priority.push(a);
        const classId=["warrior","rogue","mage","cleric"].includes(parsed.classId)?parsed.classId:"rogue";
        return json({build:{
          classId,
          priority:priority.slice(0,6),
          ancestry:clip(parsed.ancestry,100)||ancestry||"Humano",
          background:clip(parsed.background,900),
          languages:Array.isArray(parsed.languages)?parsed.languages.slice(0,5).map(x=>clip(x,50)).filter(Boolean):[],
          reason:clip(parsed.reason,500)
        }},200,origin);
      } catch(error) {
        console.error("RASTHOR·IA character build error",error);
        return json({error:"El Director no pudo preparar tu ficha ahora. Puedes repartir las características manualmente o al azar."},503,origin);
      }
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