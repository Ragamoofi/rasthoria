const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
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
  const messages = Array.isArray(c.messages) ? c.messages.slice(-8) : [];
  const rolls = Array.isArray(c.rolls) ? c.rolls.slice(-5) : [];
  const combat = c.combat || null;
  return {
    title: clip(c.title, 120),
    revision: Number(c.revision || 0),
    phase: c.phase,
    lastEvent: clip(c.lastEvent, 2500),
    config: {
      premise: clip(c.config?.premise, 3600),
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
      background: clip(character.background, 1500),
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
      text: clip(m.text, 900),
      roll: m.roll ? {
        purpose: clip(m.roll.purpose, 300), total: m.roll.total, natural: m.roll.natural,
        success: m.roll.success, critical: m.roll.critical, values: m.roll.values,
      } : undefined,
    })),
    memory: {
      summary: clip(memory.summary, 4200),
      entities: Array.isArray(memory.entities) ? memory.entities.slice(-18) : [],
      decisions: Array.isArray(memory.decisions) ? memory.decisions.slice(-12) : [],
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
    gmVault: clip(c.gmVault, 6000),
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
- Preguntas de estado como "¿qué llevo?", "¿qué tengo encima?", "¿dónde estoy?", "¿qué hora es?", "¿cómo estoy?" o consultas equivalentes NUNCA requieren check ni save: responde usando el estado recibido.
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
- wound SOLO puede tener target="player". Nunca uses wound para NPC, enemigos ni aliados.
- condition_add/condition_remove fuera de combate SOLO pueden apuntar a "player". En combate pueden apuntar a "player" o al id exacto de un actor activo.
- item_remove/item_rename solo pueden apuntar a un objeto que realmente exista en el inventario actual.
- Si el jugador intenta herir o matar a un NPC capaz de resistirse y todavía no hay combate, normalmente inicia un encounter en vez de aplicar wound o declarar la muerte directamente.
- No uses efectos para cosas que pueden quedar solo narrativas.
- XP fuera de combate debe ser moderada y justificada.

NARRACIÓN
- Escribe como un buen novelista y Director de Juego, no como un asistente que resume información.
- Español natural, elegante, inmersivo y fácil de leer. Busca belleza y atmósfera sin caer en prosa recargada.
- Haz que el jugador SIENTA dónde está: usa de 2 a 5 detalles sensoriales concretos por escena cuando aporten algo (luz, sonido, olor, temperatura, textura, distancia, movimiento, clima, arquitectura, multitudes, silencio).
- "Muestra" antes que explicar: una sala no es "tensa"; alguien aprieta un vaso, un ventilador vibra, nadie mira a nadie. Un lugar no es "futurista"; describe qué lo vuelve futurista.
- Sitúa espacialmente la escena. Debe ser fácil imaginar qué hay cerca, qué está lejos, quién ocupa el lugar y qué está ocurriendo alrededor.
- Los lugares deben tener identidad propia. Evita escenarios genéricos llamados simplemente "laboratorio", "pueblo", "taberna" o "nave" sin rasgos memorables.
- Los NPC deben sentirse personas: voz propia, ritmo al hablar, gestos, silencios, prioridades, dudas y emociones. Evita diálogos cuya única función sea entregar una misión.
- No vuelques exposición en un solo párrafo. Revela el mundo mediante acciones, conversaciones, objetos, documentos, rumores y consecuencias.
- Usa contraste y pequeños detalles humanos. Incluso una escena épica puede tener una taza fría, una alarma molesta, una corbata torcida o alguien que intenta ocultar que tiembla.
- La escena debe avanzar. Cada respuesta debe aportar al menos UNA de estas cosas: nueva información, cambio de situación, reacción significativa, oportunidad, complicación, revelación, consecuencia o amenaza.
- No conviertas cada turno en peligro. Deja espacio para curiosidad, humor, intimidad, calma, relaciones y exploración cuando el tono lo permita.
- Normalmente 2 a 5 bloques narrativos y 160 a 420 palabras totales. En combate o acciones rápidas puede ser más breve; en aperturas y revelaciones importantes puede llegar a unas 550 palabras.
- Alterna longitudes de frase y párrafo para dar ritmo. Evita empezar todos los párrafos con "Tú", "El" o "La".
- Los diálogos de NPC van preferentemente como kind=npc con speaker real; su texto debe sonar hablado, no como narración disfrazada.
- No escribas listas de opciones salvo que la situación lo exija. Termina en una situación abierta y natural donde el jugador pueda actuar, sin cerrar siempre con la frase "¿Qué haces?".
- Nunca narres que el personaje del jugador decide, acepta, siente o actúa si el usuario no lo declaró. Puedes describir lo que percibe directamente, no imponer sus emociones.
- Nunca escribas "el jugador debe decidir", "¿qué hace el jugador?" ni hables del usuario como una entidad externa. Háblale directamente en segunda persona o usa el nombre del personaje.
- No repitas la premisa ni resumas innecesariamente lo recién ocurrido.
- Evita clichés automáticos: "algo no está bien", "un escalofrío recorre tu espalda", "nada volverá a ser igual", "el aire está cargado de tensión" y equivalentes, salvo que la escena realmente los justifique.

APERTURA DE CAMPAÑA
- La primera escena debe sentirse como el inicio de una novela o una buena sesión de rol, no como una ficha técnica.
- Presenta el lugar mediante una imagen memorable y concreta antes de explicar la situación.
- Introduce al menos un detalle cotidiano o humano que vuelva creíble el mundo.
- Presenta a los NPC gradualmente. El primer NPC importante necesita una característica reconocible además de su cargo.
- Da contexto suficiente para entender la situación, pero deja preguntas abiertas. No expliques inmediatamente todos los secretos de la premisa.
- Si la campaña todavía se titula "Una historia por comenzar" o carece de título propio, propone en title un nombre evocador de 2 a 7 palabras, apropiado al género y sin usar "RASTHOR·IA".
- El primer gancho debe nacer de algo que ocurre EN ESCENA: una llamada interrumpida, una puerta que se abre, un objeto fuera de lugar, una persona que llega tarde, una señal que cambia, una noticia, un ruido, una decisión urgente, etc. Evita simplemente decir "tu equipo ha sido seleccionado y te pregunta qué hacer".

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

function validEffect(effect,campaign) {
  if (!effect || typeof effect !== "object") return false;
  const type=effect.type;
  const character=campaign?.character || {};
  const inventory=Array.isArray(character.inventory)?character.inventory:[];
  const actors=Array.isArray(campaign?.combat?.actors)?campaign.combat.actors:[];
  if (type==="wound") return effect.target==="player";
  if (type==="condition_add" || type==="condition_remove") {
    if (effect.target==="player") return true;
    return actors.some(a=>a?.id===effect.target);
  }
  if (type==="item_remove" || type==="item_rename") {
    return inventory.some(i=>i?.id===effect.target || i?.catalog===effect.target || i?.name===effect.target);
  }
  if (type==="item_add") return Number.isInteger(effect.amount) && effect.amount>=1 && effect.amount<=20 && !!String(effect.target||"").trim();
  if (type==="currency") return Number.isInteger(effect.amount) && Math.abs(effect.amount)<=1000 && Number(character.gold||0)+effect.amount>=0;
  if (type==="xp") return Number.isInteger(effect.amount) && effect.amount>=0 && effect.amount<=500;
  return false;
}

function sanitizeEffects(effects,campaign) {
  return (Array.isArray(effects)?effects:[]).filter(e=>validEffect(e,campaign)).slice(0,10);
}

const SKILL_ABILITY = {
  athletics:"STR",
  acrobatics:"DEX", sleight:"DEX", stealth:"DEX",
  arcana:"INT", history:"INT", investigation:"INT", nature:"INT", religion:"INT",
  animal:"WIS", insight:"WIS", medicine:"WIS", perception:"WIS", survival:"WIS",
  deception:"CHA", intimidation:"CHA", performance:"CHA", persuasion:"CHA",
};

function sanitizeCheck(check,campaign) {
  if (!check || typeof check!=="object") return null;
  const clean={...check};
  if (clean.kind==="save") {
    // Las salvaciones jamás usan habilidad. Corrige silenciosamente la salida del LLM.
    clean.skill=null;
  } else if (clean.kind==="check") {
    if (clean.skill && SKILL_ABILITY[clean.skill]) {
      // La habilidad manda: corrige automáticamente la característica si el modelo se equivocó.
      clean.ability=SKILL_ABILITY[clean.skill];
    }
  } else {
    return null;
  }
  clean.success=sanitizeEffects(clean.success,campaign).slice(0,8);
  clean.failure=sanitizeEffects(clean.failure,campaign).slice(0,8);
  clean.dc=Math.max(5,Math.min(30,Number(clean.dc)||10));
  clean.advantage=["normal","advantage","disadvantage"].includes(clean.advantage)?clean.advantage:"normal";
  return clean;
}

function sanitizeCombatIntent(intent,campaign) {
  if (!intent || typeof intent!=="object" || !campaign?.combat) return null;
  const combat=campaign.combat;
  const currentId=combat.order?.[combat.index]?.id;
  if (!currentId || currentId==="player" || intent.actor!==currentId) return null;
  const actor=combat.actors?.find(a=>a.id===intent.actor);
  if (!actor || actor.hp<=0) return null;
  if (intent.action==="attack") {
    const validTargets=["player",...(combat.actors||[]).filter(a=>a.id!==actor.id&&a.hp>0).map(a=>a.id)];
    if (!validTargets.includes(intent.target)) return null;
  }
  return intent;
}

function sanitizeEntities(entities,campaign) {
  const existing=new Map((campaign?.memory?.entities||[]).map(e=>[e.id,e]));
  return (Array.isArray(entities)?entities:[]).filter(e=>{
    if(!e||typeof e!=="object") return false;
    const id=String(e.id||"").trim();
    const name=String(e.name||"").trim();
    if(!id||!name||["__proto__","constructor","prototype"].includes(id)) return false;
    const old=existing.get(id);
    if(old?.status==="muerto" && e.status!=="muerto") return false;
    return true;
  }).slice(0,20).map(e=>({
    ...e,
    id:clip(e.id,100),
    name:clip(e.name,100),
    description:clip(e.description,1800),
    status:clip(e.status,100),
    relation:Math.max(-100,Math.min(100,Number(e.relation)||0)),
  }));
}

function sanitizeEncounter(encounter,campaign) {
  if (!Array.isArray(encounter)) return null;
  const clean=encounter.filter(e=>e&&typeof e==="object"&&String(e.name||"").trim())
    .slice(0,6)
    .map(e=>({
      ...e,
      name:clip(e.name,90),
      tactic:clip(e.tactic,200),
      distance:Math.max(0,Math.min(60,Number(e.distance)||0)),
      entityId:e.entityId?clip(e.entityId,100):null,
    }));
  if(!clean.some(e=>e.side==="enemy")) return null;
  return clean;
}

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
    check: sanitizeCheck(r.check,campaign),
    effects: sanitizeEffects(r.effects,campaign),
    encounter: sanitizeEncounter(r.encounter,campaign),
    combatIntent: sanitizeCombatIntent(r.combatIntent,campaign),
    memory: {
      summary: typeof r.memory?.summary === "string" ? clip(r.memory.summary,8000) : currentSummary,
      entities: sanitizeEntities(r.memory?.entities,campaign),
      decision: typeof r.memory?.decision === "string" ? clip(r.memory.decision,700) : null,
      flags: Array.isArray(r.memory?.flags) ? r.memory.flags.slice(0,20) : [],
      elapsedMinutes: Number.isInteger(r.memory?.elapsedMinutes) ? Math.max(0,Math.min(1440,r.memory.elapsedMinutes)) : 0,
      location: typeof r.memory?.location === "string" ? clip(r.memory.location,150) : null,
    },
    safeRest: Boolean(r.safeRest),
    privateMemory: typeof r.privateMemory === "string" ? clip(r.privateMemory,14000) : currentVault,
  };
  if (out.encounter?.length) {
    out.effects=[];
    out.check=null;
    out.combatIntent=null;
  }
  if (out.check) {
    out.effects=[];
    out.encounter=null;
  }
  if (!out.narrative.length) out.narrative=[{kind:"narrator",speaker:"",text:"El mundo guarda silencio un instante, pero la situación permanece abierta. ¿Qué haces?"}];
  return out;
}

function parseJSONLoose(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") return null;
  let text = value.trim();
  text = text.replace(/^\`\`\`(?:json)?\s*/i,"").replace(/\s*\`\`\`$/,"").trim();
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start,end+1)); } catch {}
  }
  return null;
}

function modelResponseObject(result) {
  if (!result) return null;
  const candidates = [
    result.response,
    result.result?.response,
    result.choices?.[0]?.message?.parsed,
    result.choices?.[0]?.message?.content,
    result.output_text
  ];
  for (const candidate of candidates) {
    const parsed = parseJSONLoose(candidate);
    if (parsed) return parsed;
  }
  if (typeof result === "object" && !Array.isArray(result) && (result.narrative || result.memory)) return result;
  return null;
}

async function runStructured(env, {messages,schema,max_tokens=900,temperature=0.5,top_p=0.9}) {
  const request = {
    messages,
    response_format: { type:"json_schema", json_schema:schema },
    max_tokens,
    temperature,
    top_p,
    repetition_penalty: 1.05,
  };
  let firstError = null;
  for (let attempt=0; attempt<2; attempt++) {
    try {
      const result = await env.AI.run(MODEL, {
        ...request,
        temperature: attempt === 0 ? temperature : 0.25,
        max_tokens: attempt === 0 ? max_tokens : Math.min(max_tokens,760),
      });
      const parsed = modelResponseObject(result);
      if (parsed) return parsed;
      firstError ||= new Error("EMPTY_OR_INVALID_JSON");
    } catch (error) {
      firstError ||= error;
    }
  }
  throw firstError || new Error("STRUCTURED_OUTPUT_FAILED");
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
        return json({connected:true,model:"Llama 3.3 70B Fast · RASTHOR·IA Cloud",managed:true,canConnect:false},200,origin);
      }
      return json({ok:true,service:"RASTHOR·IA Cloud DM",model:MODEL},200,origin);
    }

    if (url.pathname === "/api/connection" && (request.method === "POST" || request.method === "DELETE")) {
      return json({connected:true,model:"Llama 3.3 70B Fast · RASTHOR·IA Cloud",managed:true,canConnect:false},200,origin);
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
- tener identidad visual, social o sensorial propia; evita mundos genéricos de una sola frase;
- incluir al menos una particularidad memorable del lugar, sociedad, época o situación que luego pueda aparecer en escena;
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
        const parsed = await runStructured(env,{
          messages:[
            {role:"system",content:"Eres un diseñador de campañas de rol extremadamente versátil. No asumas fantasía medieval."},
            {role:"user",content:prompt}
          ],
          schema:RANDOM_CAMPAIGN_SCHEMA,
          max_tokens:720,
          temperature:0.82,
          top_p:0.94
        });
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
        const parsed = await runStructured(env,{
          messages:[
            {role:"system",content:"Eres un diseñador de personajes d20 que adapta mecánicas a cualquier género sin imponer fantasía medieval."},
            {role:"user",content:prompt}
          ],
          schema:CHARACTER_BUILD_SCHEMA,
          max_tokens:480,
          temperature:0.45,
          top_p:0.88
        });
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
    const isOpening = Number(compact.revision||0) <= 1 && (compact.messages?.length||0) <= 3;
    const sceneDirective = isOpening
      ? "ESTE ES EL INICIO DE LA CAMPAÑA. Construye una apertura evocadora y cinematográfica siguiendo estrictamente APERTURA DE CAMPAÑA. Prioriza atmósfera, lugar, humanidad y un gancho que ocurra en escena."
      : "CONTINÚA LA ESCENA. Mantén el mismo nivel de calidad literaria, continuidad, espacialidad y voz de personajes. Reacciona exactamente a lo que acaba de hacer o decir el personaje.";

    const userPrompt = `ESTADO ACTUAL DE LA CAMPAÑA\n${JSON.stringify(compact)}\n\nDIRECTIVA DE ESCENA\n${sceneDirective}\n\nProcesa exclusivamente el siguiente turno respetando lastEvent, los resultados de dados ya presentes y el estado del motor. Devuelve solo el objeto JSON solicitado.`;

    try {
      const parsed = await runStructured(env,{
        messages:[
          {role:"system",content:SYSTEM},
          {role:"user",content:userPrompt},
        ],
        schema:RESPONSE_SCHEMA,
        max_tokens:isOpening?1250:1100,
        temperature:isOpening?0.66:0.58,
        top_p:0.91
      });
      const response = normalizeResponse(parsed,campaign);
      return json({response,vault:response.privateMemory},200,origin);
    } catch (error) {
      console.error("RASTHOR·IA Workers AI error",error);
      return json({error:"El Director IA no pudo completar este turno. Tu acción sigue guardada: pulsa Continuar narración para reintentar."},503,origin);
    }
  }
};