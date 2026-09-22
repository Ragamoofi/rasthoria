import { mcpHandler } from "./mcp.js";
const MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const FALLBACK_MODEL = "@cf/google/gemma-4-26b-a4b-it";
const BUILD = "2026-09-22-rules-v16-multi-ai-byok";
const ALLOWED_ORIGINS = new Set([
  "https://ragamoofi.github.io",
  "https://umbral-rpg-oscar.o-sariego.chatgpt.site",
]);

function isAllowedOrigin(origin) {
  if (!origin || origin === "null") return true; // file:// local testing
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return (url.protocol === "http:" || url.protocol === "https:")
      && ["localhost","127.0.0.1","::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

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
  const allowed = origin === "null" ? "null" : (origin && isAllowedOrigin(origin) ? origin : "https://ragamoofi.github.io");
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Rasthoria-AI-Provider, X-Rasthoria-AI-Key, X-Rasthoria-AI-Model",
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

const MOJIBAKE_REPLACEMENTS = [
  ["√°","á"],["√©","é"],["√≠","í"],["√≥","ó"],["√∫","ú"],["√±","ñ"],
  ["√Å","Á"],["√â","É"],["√ç","Í"],["√ì","Ó"],["√ö","Ú"],["√ë","Ñ"],
  ["√º","ü"],["√ú","Ü"],["¬ø","¿"],["¬°","¡"],
  ["Ã¡","á"],["Ã©","é"],["Ã­","í"],["Ã³","ó"],["Ãº","ú"],["Ã±","ñ"],
  ["Ã","Á"],["Ã‰","É"],["Ã","Í"],["Ã“","Ó"],["Ãš","Ú"],["Ã‘","Ñ"],
  ["Ã¼","ü"],["Ãœ","Ü"],["Â¿","¿"],["Â¡","¡"],["Â·","·"],
  ["â€¦","…"],["â€”","—"],["â€“","–"],["â€œ","“"],["â€","”"],["â€™","’"]
];

function repairMojibake(value) {
  let text=String(value ?? "");
  for (const [bad,good] of MOJIBAKE_REPLACEMENTS) text=text.split(bad).join(good);
  return text;
}

function clip(value, max) {
  return repairMojibake(value).slice(0, max);
}

function clipContext(value,max) {
  const text=String(value??"");
  if(text.length<=max) return text;
  const marker="\n…[memoria intermedia resumida]…\n";
  const room=Math.max(0,max-marker.length);
  const head=Math.ceil(room*.46),tail=room-head;
  return text.slice(0,head)+marker+text.slice(-tail);
}

function compactInventoryForAI(inventory) {
  return (Array.isArray(inventory)?inventory:[]).slice(0,100).map(item=>({
    id:clip(item?.id,100),
    catalog:clip(item?.catalog,100),
    name:clip(item?.name,100),
    quantity:Math.max(0,Number(item?.quantity)||0),
    description:clip(item?.description,420),
  }));
}

function compactEntitiesForAI(entities) {
  const list=Array.isArray(entities)?entities:[];
  const quests=list.filter(e=>e?.kind==="quest");
  const activeQuests=quests.filter(e=>!["completada","fallida","cancelada"].includes(plainText(e?.status)));
  const terminalQuests=quests.filter(e=>["completada","fallida","cancelada"].includes(plainText(e?.status))).slice(-10);
  const important=list.filter(e=>e?.kind!=="quest" && (
    Math.abs(Number(e?.relation)||0)>=20 ||
    ["faction","secret"].includes(e?.kind) ||
    !["","activo","activa","vivo","viva","conocido","conocida","neutral"].includes(plainText(e?.status))
  )).slice(-20);
  const recentOther=list.filter(e=>e?.kind!=="quest").slice(-28);
  const seen=new Set();
  return [...activeQuests,...important,...terminalQuests,...recentOther].filter(e=>{
    const id=String(e?.id||"");
    if(!id||seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0,60);
}

function equippedItemForAI(character, slot) {
  const inventory=Array.isArray(character?.inventory)?character.inventory:[];
  const key=character?.[slot];
  const item=inventory.find(i=>i?.id===key) || inventory.find(i=>i?.catalog===key);
  return item?{id:item.id,catalog:item.catalog,name:item.name,quantity:item.quantity}:null;
}

function publicCampaign(campaign) {
  const c = campaign && typeof campaign === "object" ? campaign : {};
  const character = c.character || {};
  const memory = c.memory || {};
  const messages = Array.isArray(c.messages) ? c.messages.slice(-10) : [];
  const rolls = Array.isArray(c.rolls) ? c.rolls.slice(-7) : [];
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
      equippedWeapon: equippedItemForAI(character,"weapon"),
      equippedArmor: equippedItemForAI(character,"armor"),
      resources: character.resources,
      inventory: compactInventoryForAI(character.inventory),
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
      summary: clipContext(memory.summary, 5600),
      entities: compactEntitiesForAI(memory.entities),
      decisions: Array.isArray(memory.decisions) ? memory.decisions.slice(-18) : [],
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
    gmVault: clipContext(c.gmVault, 9000),
    lastRestAvailable: Boolean(c.lastRestAvailable),
  };
}

const SYSTEM = `Eres el Narrador de Juego de RASTHOR·IA, un RPG narrativo reactivo inspirado en d20/SRD 5e. Tu respuesta NO es texto libre: debe cumplir exactamente el JSON solicitado.

OBJETIVO
Crear una campaña viva, coherente, impredecible y con consecuencias persistentes. El usuario puede proponer LITERALMENTE cualquier género, época, universo o escala: vida cotidiana, drama, deportes, crimen, terror, western, histórico, cyberpunk, ciencia ficción, superhéroes, romance, fantasía o mezclas propias. Adáptate sin imponer fantasía medieval si no corresponde.

ADAPTACIÓN DE GÉNERO
- Las cuatro clases del motor son SOLO bases mecánicas. Combatiente, Especialista, Canalizador y Protector pueden representar profesiones, entrenamiento, tecnología, mutaciones, poderes, magia, medicina, liderazgo u otras explicaciones según el mundo.
- El catálogo de armas, protecciones, curación y suministros es una abstracción mecánica. En la narración dales una apariencia coherente con la ambientación.
- Los nombres genéricos del inventario son SOLO marcadores mecánicos temporales. En cuanto el mundo/época permite concretarlos, usa item_rename para que el inventario muestre objetos reales del personaje (por ejemplo Pistola, Chaleco antibalas, Botiquín, Linterna), sin alterar sus estadísticas. Hazlo especialmente en la apertura y cuando el jugador pregunta qué lleva o revisa sus pertenencias.
- Si la narración establece que el personaje ya posee un objeto concreto equivalente a un objeto genérico, el inventario DEBE reflejar ese nombre en el mismo turno mediante item_rename. No digas "tienes una pistola" mientras el inventario siga diciendo "Arma a distancia".
- Una campaña realista puede no tener magia. Una campaña contemporánea no debe introducir espadas, tabernas, reinos o hechizos salvo que la premisa los pida.
- No toda historia necesita salvar el mundo. Respeta campañas íntimas, sociales, deportivas, románticas, profesionales o de investigación.

AUTORIDAD
- El jugador controla SOLO a su personaje: acciones, palabras, intenciones y decisiones.
- Tú controlas el mundo, NPC, adversarios, ambiente, información, consecuencias y ritmo.
- El motor del juego es la autoridad absoluta sobre dados, HP, AC, daño, iniciativa, inventario, condiciones y resultados ya resueltos. Nunca contradigas un resultado del motor.
- No inventes una tirada ya realizada ni cambies su resultado.
- Si el motor informa éxito, narra éxito; si informa fracaso, narra fracaso y sus consecuencias.

TIRADAS — CUÁNDO USAR D20
- Los dados aparecen cuando existe incertidumbre real, riesgo, oposición, presión o una consecuencia interesante. No conviertas cada frase o gesto en una tirada.
- La tirada base para resolver una acción incierta es un D20 Test: ability check, saving throw o attack roll. Los D4/D6/D8/D10/D12 se reservan para daño, curación, recursos o efectos que explícitamente los usen.
- ROLEO LIBRE: hablar, preguntar, responder, bromear, saludar, presentarse, expresar una opinión, mirar algo evidente, caminar por un lugar seguro o realizar una acción cotidiana sin presión NO requiere tirada por defecto. Deja que la escena y los NPC respondan naturalmente.
- Una conversación solo requiere Carisma cuando el personaje intenta CAMBIAR una decisión, engañar, intimidar, seducir con un objetivo concreto, negociar algo disputado o vencer resistencia social significativa. Una pregunta normal a un NPC no exige Persuasión.
- Una acción física o técnica solo requiere tirada cuando puede fallar de forma significativa, existe oposición, falta tiempo, hay peligro o el resultado aporta información no evidente.
- Información oculta, registrar un lugar, seguir pistas, escuchar detrás de una puerta, leer intenciones o detectar peligros pueden usar Percepción, Investigación o Perspicacia según corresponda.
- Sigilo, infiltración, robo, persecución, obstáculos difíciles, tareas técnicas bajo presión, conducción peligrosa, negociación disputada, mentira e intimidación normalmente requieren D20.
- Si una acción es automática o trivial en la situación, resuélvela narrativamente y continúa. No inventes una complicación solo para justificar un dado.
- Si el jugador escribe varias acciones, resuelve en orden y detente únicamente cuando aparezca la primera que realmente necesite una tirada.
- Consultas de estado como "¿qué llevo?", "¿dónde estoy?", "¿qué hora es?", "¿cómo estoy?" o preguntas sobre algo ya visible/conocido nunca requieren tirada.
- Una declaración hostil que inicia combate no usa un ability check previo; crea encounter y deja que el motor resuelva iniciativa, ataque y daño.
- Usa save cuando el personaje REACCIONA o RESISTE un peligro/efecto que ya le está ocurriendo. Las salvaciones usan skill=null.
- DC orientativa: 5 muy fácil, 10 fácil, 15 moderada, 20 difícil, 25 muy difícil, 30 casi imposible. No pidas una prueba DC 5 si sencillamente no hay nada interesante en juego.
- Ventaja/desventaja se usa por circunstancias claras del mundo, preparación, ayuda, posición, condiciones o herramientas.
- skill debe corresponder a ability. Si ninguna habilidad aplica, usa skill=null con la característica correcta.
- Si solicitas check, detén la narración ANTES de saber si funciona: effects debe estar vacío salvo item_rename y encounter debe ser null; las consecuencias mecánicas van en success/failure y la historia continuará después del resultado.
- Un fracaso no tiene por qué bloquear la aventura. Favorece fallo con consecuencia cuando sea apropiado.
- Nunca uses un dado para evitar responder una pregunta o sostener un intercambio de roleo que puede continuar de forma natural.

COMBATE — FLUJO DE MESA POR TEXTO
- El combate se juega principalmente escribiendo en lenguaje natural, como en una mesa de rol. El jugador describe lo que intenta hacer; NO necesita elegir una acción desde un menú táctico.
- Solo crea encounter cuando la situación realmente inicia combate. Debe incluir al menos un enemy.
- Al comenzar un enfrentamiento, el motor resuelve iniciativa: 1D20 + Destreza. El total más alto actúa primero.
- Un ataque normal se resuelve en DOS pasos mecánicos: primero 1D20 + modificador de ataque contra la CA del objetivo; si impacta, después se tira el dado de daño del arma + su modificador. El Narrador nunca debe inventar esos números.
- En un ataque, un 20 natural es crítico y duplica los dados de daño; un 1 natural falla. El resto compara TOTAL (d20 + modificador) contra la CA.
- Maniobras creativas escritas durante combate (engañar, empujar, ocultarse, desarmar, intimidar, buscar cobertura, etc.) pueden usar una prueba d20 apropiada. Explica la intención en reason con lenguaje concreto.
- El jugador puede escribir cosas como "le disparo a J", "me escondo tras la barra", "intento desarmarlo", "corro hacia la puerta" o "termino mi turno". Interpreta la intención; los dados y el motor determinan el resultado.
- Tras una tirada, narra sus consecuencias sin duplicar daño, HP, iniciativa ni efectos ya aplicados por el motor.
- REGLA CRÍTICA: si el jugador declara que intenta apuñalar, cortar, disparar, golpear, decapitar, matar o herir deliberadamente a un NPC consciente/capaz de reaccionar y todavía no existe combate, NO puedes decidir que el golpe impacta ni que el NPC muere. Debes narrar únicamente el inicio del intento y crear encounter para que el motor resuelva iniciativa y ataques con dados.
- Frases del jugador como "le corto la cabeza", "lo mato", "le disparo entre los ojos" o similares son INTENCIONES, no resultados garantizados.
- Nunca conviertas una descripción contundente escrita por el jugador en éxito automático. El jugador declara lo que intenta; los dados deciden si lo consigue.
- Si el objetivo está inequívocamente indefenso/inconsciente y eso ya está establecido en el estado, puedes resolverlo narrativamente cuando no exista incertidumbre. No inventes indefensión para evitar los dados.
- Los perfiles válidos son brute, skirmisher, ranged, guardian y minion.
- Si ya hay combate y el turno pertenece a un actor que no es player, usa combatIntent con attack, dodge o flee. No pidas check para ese turno.
- combatIntent describe SOLO la intención del actor. Si usa attack, narra que apunta, carga, dispara, golpea o inicia el movimiento, pero NO narres impacto, herida, caída, sangre, daño ni muerte: el motor todavía debe tirar ataque y, si acierta, daño.
- combatIntent.actor debe ser EXACTAMENTE el id del actor cuyo turno muestra combat.order; target debe ser EXACTAMENTE player o el id de otro actor válido.
- No otorgues XP, objetos ni dinero durante combate: el motor adjudica XP al finalizar.

INVENTARIO, DINERO Y RECURSOS — ESTADO AUTORITATIVO
- character.inventory y character.gold son la verdad mecánica. La narración NO puede inventar que el personaje posee, usa, entrega, pierde, compra o consume algo que el estado no respalda.
- equippedWeapon/equippedArmor indican qué objeto concreto está equipado. No asumas que todos los objetos del mismo tipo mecánico están equipados.
- Si el personaje obtiene, recoge, compra, recibe, fabrica o conserva físicamente un objeto nuevo, usa item_add en ese mismo turno o como consecuencia success/failure de la tirada que lo resuelve.
- Para equipo que DEBE funcionar mecánicamente, item_add.target debe ser uno de estos catálogos y item_add.text debe ser el NOMBRE REAL que verá el jugador:
  longsword = arma principal cuerpo a cuerpo STR 1D8;
  rapier = arma precisa cuerpo a cuerpo DEX 1D8;
  bow = arma a distancia DEX 1D6;
  staff = arma ligera/foco STR 1D6;
  mace = arma contundente STR 1D6;
  chain = protección pesada CA16;
  scale = protección media CA14+DEX máx2;
  leather = protección ligera CA11+DEX;
  potion = curación 2D4+2;
  rations = suministros de descanso;
  tools = herramientas;
  torch = fuente de luz.
  Ejemplo: encontrar una pistola funcional => {type:"item_add",target:"bow",amount:1,text:"Pistola Walther PPK"}. Encontrar un botiquín => target:"potion", text:"Botiquín de primeros auxilios".
- Para objetos narrativos SIN estadísticas propias (llaves, documentos, fotografías, cartas, evidencias, recuerdos, etc.), item_add.target es el nombre real del objeto y item_add.text es una descripción breve.
- Si entrega, consume, gasta, rompe, abandona, vende o pierde un objeto, usa item_remove con una cantidad válida. Nunca lo retires solo en prosa.
- item_remove/item_rename solo pueden apuntar a un objeto que realmente exista. Usa preferentemente el id exacto recibido en character.inventory.
- item_rename cambia solamente la identidad visible de un objeto mecánico ya existente; no altera sus estadísticas.
- No concedas dos veces el mismo objeto por narración y efecto. La narración describe el hecho; el efecto cambia el estado.
- Antes de afirmar "sacas", "usas", "enseñas", "entregas" o equivalentes, comprueba que ese objeto existe y hay cantidad suficiente. Si no existe, dilo naturalmente y deja al jugador buscar otra solución.
- currency representa TODO cambio real de dinero. Comprar resta; cobrar/vender/recompensa suma. Nunca cambies dinero solo en prosa.
- No conviertas equipo narrativo genérico en objetos infinitos. Consumibles, llaves, documentos, munición especial, medicinas y objetos únicos deben existir de forma explícita.

MISIONES / OBJETIVOS
- Las misiones viven en memory.entities con kind="quest". Son memoria persistente, no texto decorativo.
- Crea una quest cuando aparezca un objetivo concreto y accionable que el personaje acepte, reciba o decida perseguir. No conviertas cada conversación, pista o curiosidad en misión.
- Reutiliza SIEMPRE el mismo id para actualizar una misión existente. No crees duplicados con nombres ligeramente distintos.
- Estados canónicos: "activa", "completada", "fallida" o "cancelada".
- Una misión activa solo pasa a completada cuando los hechos de la historia confirman que su objetivo realmente se cumplió. Una intención del jugador ("entrego el paquete", "ya lo hice") no basta si todavía existe incertidumbre o falta resolver una tirada/reacción del mundo.
- "completada", "fallida" y "cancelada" son estados terminales: no vuelvas una misión a "activa" salvo que se trate explícitamente de una NUEVA misión con otro id.
- Si cambia el objetivo o aparece progreso relevante, actualiza description/status del mismo id de quest.
- Las recompensas de misión no existen hasta que se entregan realmente: objetos con item_add, dinero con currency y XP con xp.
- No borres misiones antiguas de la memoria; conserva su estado para continuidad y para que el jugador pueda revisar qué ocurrió.

EFECTOS
- Usa solo efectos mecánicos válidos: item_add, item_remove, item_rename, currency, xp, condition_add, condition_remove, wound.
- wound SOLO puede tener target="player". Nunca uses wound para NPC, enemigos ni aliados.
- condition_add/condition_remove fuera de combate SOLO pueden apuntar a "player". En combate pueden apuntar a "player" o al id exacto de un actor activo.
- Si el jugador intenta herir o matar a un NPC capaz de resistirse y todavía no hay combate, normalmente inicia un encounter en vez de aplicar wound o declarar la muerte directamente.
- No uses efectos para cosas que pueden quedar solo narrativas.
- XP fuera de combate debe ser moderada y justificada.

NARRACIÓN
- Escribe como un buen novelista y Narrador de Juego, no como un asistente que resume información.
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
- privateMemory contiene secretos del Narrador, planes, verdades ocultas, identidades secretas y consecuencias todavía no reveladas. Conserva secretos previos y añade solo lo necesario. No reveles privateMemory en narrative.

CONSULTAS DE ESTADO
- Si lastEvent es una consulta sobre inventario, equipo, dinero, misiones/objetivos, ubicación, hora, estado físico o información evidente ya presente en el estado, responde usando EXCLUSIVAMENTE esos datos y devuelve check=null, encounter=null y combatIntent=null.
- En una consulta de estado effects debe estar vacío SALVO item_rename estrictamente necesario para concretar marcadores genéricos del inventario. No cambies cantidades, dinero, XP, condiciones ni heridas por una simple consulta.
- Si preguntan "qué tengo", enumera solo character.inventory con cantidades reales y usa equippedWeapon/equippedArmor para indicar qué objeto concreto está equipado. No reconstruyas inventario desde la narración.
- Si preguntan por misiones, usa memory.entities kind="quest": indica activas y, si aporta valor, las completadas/fallidas/canceladas. No inventes objetivos que no estén registrados.
- Nunca conviertas una pregunta informativa simple en una tirada.
- Si falta un dato, dilo narrativamente sin inventar una prueba solo para obtenerlo.

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
  const source=(Array.isArray(effects)?effects:[]).slice(0,10);
  const inventory=(Array.isArray(campaign?.character?.inventory)?campaign.character.inventory:[]).map(i=>({...i}));
  const quantities=new Map(inventory.map(i=>[i.id,Number(i.quantity)||0]));
  let gold=Number(campaign?.character?.gold||0);
  const out=[];

  function resolveItem(target) {
    const key=plainText(target).trim();
    if(!key) return null;
    return inventory.find(i=>i?.id===target || i?.catalog===target || i?.name===target)
      || inventory.find(i=>plainText(i?.name)===key || plainText(i?.catalog)===key)
      || null;
  }

  for(const raw of source) {
    if(!raw || typeof raw!=="object" || !Number.isInteger(raw.amount)) continue;
    const e={...raw,text:clip(raw.text,500),target:clip(raw.target,100)};

    if(e.type==="item_remove") {
      const item=resolveItem(e.target);
      if(!item || e.amount<1 || e.amount>20) continue;
      const available=quantities.get(item.id)||0;
      if(available<e.amount) continue;
      quantities.set(item.id,available-e.amount);
      e.target=item.id;
      out.push(e);
      continue;
    }

    if(e.type==="item_rename") {
      const item=resolveItem(e.target);
      if(!item || !String(e.text||"").trim()) continue;
      e.target=item.id;
      e.amount=0;
      out.push(e);
      continue;
    }

    if(e.type==="currency") {
      if(Math.abs(e.amount)>1000 || gold+e.amount<0) continue;
      gold+=e.amount;
      out.push(e);
      continue;
    }

    if(e.type==="item_add") {
      if(e.amount<1 || e.amount>20 || !String(e.target||"").trim()) continue;
      const catalogs=new Set(["longsword","rapier","bow","staff","mace","chain","scale","leather","potion","rations","tools","torch"]);
      if(catalogs.has(e.target)) {
        e.text=clip(String(e.text||"").trim()||e.target,100);
      }
      out.push(e);
      continue;
    }

    if(validEffect(e,campaign)) out.push(e);
  }
  return out;
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

function canonicalQuestStatus(status) {
  const s=plainText(status).trim();
  if(/complet|cumplid|terminad|resuelt/.test(s)) return "completada";
  if(/fall|fracas|perdid|imposible/.test(s)) return "fallida";
  if(/cancel|abandon|rechaz/.test(s)) return "cancelada";
  return "activa";
}

function sanitizeEntities(entities,campaign) {
  const current=Array.isArray(campaign?.memory?.entities)?campaign.memory.entities:[];
  const existing=new Map(current.map(e=>[e.id,e]));
  const questByName=new Map(current.filter(e=>e?.kind==="quest").map(e=>[plainText(e.name),e]));
  const normalized=(Array.isArray(entities)?entities:[]).map(raw=>{
    if(!raw||typeof raw!=="object") return raw;
    const e={...raw};
    if(e.kind==="quest") {
      const same=questByName.get(plainText(e.name));
      if(same && !existing.has(String(e.id||"").trim())) e.id=same.id;
    }
    return e;
  });
  return normalized.filter(e=>{
    if(!e||typeof e!=="object") return false;
    const id=String(e.id||"").trim();
    const name=String(e.name||"").trim();
    if(!id||!name||["__proto__","constructor","prototype"].includes(id)) return false;
    const old=existing.get(id);
    if(old?.status==="muerto" && e.status!=="muerto") return false;
    if(old?.kind==="quest" && ["completada","fallida","cancelada"].includes(canonicalQuestStatus(old.status))) {
      if(canonicalQuestStatus(e.status)!==canonicalQuestStatus(old.status)) return false;
    }
    return true;
  }).slice(0,20).map(e=>({
    ...e,
    id:clip(e.id,100),
    name:clip(e.name,100),
    description:clip(e.description,1800),
    status:e.kind==="quest"?canonicalQuestStatus(e.status):clip(e.status,100),
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

function plainText(value) {
  return String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}

function declaredAction(campaign) {
  const event=String(campaign?.lastEvent||"");
  const match=event.match(/^ACCIÓN DECLARADA:\s*([\s\S]*)$/i);
  return (match?.[1]||"").trim();
}

function isHostileDeclaration(campaign) {
  if (campaign?.combat) return false;
  const action=plainText(declaredAction(campaign));
  if (!action) return false;
  const hostile=/\b(?:mato|matar|matand\w*|asesin\w*|apunal\w*|acuchill\w*|degoll\w*|decapit\w*|corto la cabeza|cortar la cabeza|le corto|lo corto|dispar\w*|tiro a matar|golpe\w*|pego|ataco|embisto|estrangul\w*|ahorc\w*|rompo el cuello|atravies\w*|clavo (?:la|el|mi)|hiero|herir)\b/i.test(action);
  const harmless=/\b(mato el tiempo|me mata de risa|muerto de risa)\b/i.test(action);
  return hostile && !harmless;
}

function hostileTargetName(campaign) {
  const action=plainText(declaredAction(campaign));
  const entities=Array.isArray(campaign?.memory?.entities)?campaign.memory.entities:[];
  const hit=entities.find(e=>e?.kind==="npc" && e?.name && action.includes(plainText(e.name)));
  return hit?.name || "Adversario";
}

function narrativeClaimsResolvedViolence(narrative) {
  const text=plainText((Array.isArray(narrative)?narrative:[]).map(x=>x?.text||"").join(" "));
  return /\b(le cortas la cabeza|cortas su cabeza|su cabeza cae|cae su cabeza|lo decapitas|la decapitas|lo matas|la matas|muere al instante|cae muerto|cae muerta|lo atraviesas|la atraviesas|impacta de lleno|la bala (?:le|lo|la) (?:da|impacta|alcanza)|el disparo (?:le|lo|la) (?:da|impacta|alcanza)|se desploma|cae al suelo|cae de rodillas|grita de dolor|gime de dolor|queda herido|queda herida|empieza a sangrar|sangra por|tu (?:katana|espada|cuchillo|bala|golpe) (?:le )?(?:corta|atraviesa|impacta))\b/i.test(text);
}

function narrativeClaimsCheckOutcome(narrative) {
  const text=plainText((Array.isArray(narrative)?narrative:[]).map(x=>x?.text||"").join(" "));
  return /\b(logras|consigues|fallas|fracasas|no logras|no consigues|la (?:puerta|cerradura|ventana|compuerta) (?:cede|se abre)|encuentras (?:la|el|una|un)|descubres|convences|persuades|te cree|cree tu version|acepta tu|rechaza tu|accede a|asiente|cede ante|te deja pasar|te permite pasar|te detecta|te descubre|no te detecta|no te ve|nadie te ve|pasas desapercibido|pasas sin ser visto|escapas|consigues escapar|te escondes|rompes (?:la|el)|desactivas|hackeas|descifras|fuerzas (?:la|el)|superas (?:la|el)|pierdes el equilibrio|resbalas y caes)\b/i.test(text);
}

function narrativeClaimsCombatHit(narrative) {
  const text=plainText((Array.isArray(narrative)?narrative:[]).map(x=>x?.text||"").join(" "));
  return /\b(te golpea|te alcanza|te hiere|te corta|te apunala|te atraviesa|impacta contra ti|impacta de lleno|la bala te alcanza|el disparo te alcanza|recibes (?:un|el) golpe|recibes dano|sangras|caes al suelo|hiere a|alcanza a .* con (?:el|la) (?:golpe|disparo|arma))\b/i.test(text);
}

const GENERIC_ITEM_NAMES = new Set([
  "arma principal","arma precisa","arma a distancia","foco / arma ligera","arma contundente",
  "proteccion pesada","proteccion media","proteccion ligera","ropa / proteccion basica",
  "recurso de curacion","suministros","herramientas","fuente de luz"
]);

function genericInventoryItems(campaign) {
  const inventory=Array.isArray(campaign?.character?.inventory)?campaign.character.inventory:[];
  return inventory.filter(i=>GENERIC_ITEM_NAMES.has(plainText(i?.name).trim()));
}

function isInventoryDeclaration(campaign) {
  const action=plainText(declaredAction(campaign));
  return /\b(que tengo|que llevo|inventario|bolsillo|bolsillos|mochila|pertenencias|equipo llevo|reviso mi equipo|reviso mis cosas)\b/.test(action);
}

function normalizedDeclaration(campaign) {
  return plainText(declaredAction(campaign)).trim().replace(/^[\s¿?¡!()\[\]{}"'.,;:—–-]+/,"");
}

function isInformationalOrTrivialDeclaration(campaign) {
  const action=normalizedDeclaration(campaign);
  if (!action) return true;
  if (/^(?:que|cual|cuanto|donde|como|quien|cuando|por que|para que|tengo|llevo|mi inventario|inventario|estado|hora)\b/.test(action)) return true;
  return /\b(que llevo|que tengo|donde estoy|que hora|como estoy|mi inventario|reviso (?:mi )?(?:inventario|mochila|equipo|bolsillos?)|que veo|que escucho a simple vista|quien esta aqui)\b/.test(action);
}

function isOrdinaryRoleplayDeclaration(campaign) {
  const action=normalizedDeclaration(campaign);
  if (!action) return true;
  // Conversación o gestos que no expresan un intento explícito de vencer resistencia.
  const socialPressure=/\b(?:convenc\w*|persuad\w*|negoci\w*|regate\w*|soborn\w*|intimid\w*|amenaz\w*|mient\w*|engan\w*|seduc\w*|manipul\w*|provoc\w*|interrog\w*|oblig\w*|presion\w*)\b/.test(action);
  if (socialPressure) return false;
  if (/^(?:digo|le digo|les digo|pregunto|le pregunto|les pregunto|respondo|contesto|saludo|me presento|agradezco|bromeo|rio|me rio|sonrio|susurro|grito|hablo|le hablo|converso|comento|explico|cuento|escucho|asiento|niego|me callo|guardo silencio)\b/.test(action)) return true;
  if (/\b(?:le digo|le pregunto|les pregunto|le respondo|hablo con|converso con|saludo a|me presento ante)\b/.test(action)) return true;
  return false;
}

function actionLikelyNeedsD20(campaign) {
  if (campaign?.combat || campaign?.pending) return false;
  const action=normalizedDeclaration(campaign);
  if (!action || isInformationalOrTrivialDeclaration(campaign) || isOrdinaryRoleplayDeclaration(campaign) || isHostileDeclaration(campaign)) return false;

  // Solo exigimos mecánicamente un D20 cuando el texto declara algo claramente incierto,
  // arriesgado, opuesto o técnico. El Narrador aún puede pedir una prueba en otros casos
  // si el estado del mundo justifica incertidumbre real.
  return /\b(?:busc\w*|registr\w*|investig\w*|examin\w*|inspeccion\w*|descifr\w*|hack\w*|forz\w*|cerradura\w*|ganzua\w*|rob\w*|hurt\w*|sigilo|escond\w*|infiltr\w*|persig\w*|escap\w*|huir|trep\w*|escal\w*|salt\w*|equilibr\w*|acrob\w*|empuj\w*|derrib\w*|levant\w*|romp\w*|desarm\w*|repar\w*|desactiv\w*|conduz\w*|manej\w*|pilot\w*|nad\w*|sobreviv\w*|rastreo|rastre\w*|sigo huellas|detect\w*|acech\w*|convenc\w*|persuad\w*|negoci\w*|regate\w*|soborn\w*|intimid\w*|amenaz\w*|mient\w*|engan\w*|seduc\w*|manipul\w*|provoc\w*|interrog\w*|oblig\w*|presion\w*|apuest\w*|compit\w*)\b/.test(action);
}

function combatPlayerActionLikelyNeedsD20(campaign) {
  if (!campaign?.combat || campaign?.pending) return false;
  const currentId=campaign.combat?.order?.[campaign.combat?.index]?.id;
  if (currentId!=="player") return false;
  const action=normalizedDeclaration(campaign);
  if (!action || isInformationalOrTrivialDeclaration(campaign) || isOrdinaryRoleplayDeclaration(campaign)) return false;

  // Ataques normales los resuelve el motor con attack roll + damage roll.
  if (/\b(?:dispar\w*|atac\w*|golpe\w*|pego|apunal\w*|acuchill\w*|degoll\w*|decapit\w*|mato|matar|hiero|herir|embisto|estrangul\w*|corto con|clavo)\b/.test(action)) return false;

  return /\b(?:escond\w*|sigilo|empuj\w*|derrib\w*|desarm\w*|intimid\w*|engan\w*|mient\w*|forz\w*|trep\w*|salt\w*|equilibr\w*|escap\w*|huir|corro hacia|busco cobertura|me cubro|agarr\w*|arrebat\w*|interpon\w*|protej\w*)\b/.test(action);
}

function fallbackCheckForDeclaredAction(campaign) {
  const action=plainText(declaredAction(campaign)).trim();
  let ability="WIS", skill="perception", dc=10, reason="Resolver la acción declarada";
  if (/\b(?:convenc\w*|persuad\w*|negoci\w*|dialog\w*|hablo|digo|pregunto|seduc\w*)\b/.test(action)) { ability="CHA"; skill="persuasion"; dc=10; reason="Influir en la reacción del interlocutor"; }
  else if (/\b(?:intimid\w*|amenaz\w*|asust\w*)\b/.test(action)) { ability="CHA"; skill="intimidation"; dc=10; reason="Imponer presión o intimidar"; }
  else if (/\b(?:mient\w*|engan\w*|finjo|disfraz\w*)\b/.test(action)) { ability="CHA"; skill="deception"; dc=12; reason="Engañar sin ser descubierto"; }
  else if (/\b(busco|investig|registro|examino|inspeccion|pista|municion|munición)\b/.test(action)) { ability="INT"; skill="investigation"; dc=10; reason="Buscar y obtener información o recursos"; }
  else if (/\b(observo|miro|escucho|vigilo|detecto|percib)\b/.test(action)) { ability="WIS"; skill="perception"; dc=10; reason="Percibir detalles relevantes de la escena"; }
  else if (/\b(sigilo|escond|infiltr|sin que me vean|paso desapercib)\b/.test(action)) { ability="DEX"; skill="stealth"; dc=12; reason="Actuar sin ser detectado"; }
  else if (/\b(ganzua|ganzúa|cerradura|robo|carter|manos)\b/.test(action)) { ability="DEX"; skill="sleight"; dc=12; reason="Manipular algo con precisión"; }
  else if (/\b(empuj|trep|escal|salto|romp|forz|levanto|corro|agarro)\b/.test(action)) { ability="STR"; skill="athletics"; dc=10; reason="Superar el esfuerzo físico de la acción"; }
  else if (/\b(esquiv|equilibr|acrob)\b/.test(action)) { ability="DEX"; skill="acrobatics"; dc=10; reason="Resolver la maniobra con agilidad"; }
  const difficult=/\b(muy dificil|muy difícil|extremo|casi imposible|bajo fuego|contra reloj)\b/.test(action);
  if(difficult) dc=Math.max(dc,15);
  return {kind:"check",ability,skill,dc,advantage:"normal",reason,success:[],failure:[],damage:null};
}

function semanticProblem(response,campaign) {
  if (!response) return "";
  if (campaign?.combat) {
    const currentId=campaign.combat?.order?.[campaign.combat?.index]?.id;
    if (currentId && currentId!=="player" && response.combatIntent?.action==="attack" && narrativeClaimsCombatHit(response.narrative)) {
      return "La narración dio por impactado o herido el objetivo de un ataque enemigo antes de que el motor tirara ataque/daño. Narra solo la intención y detente antes del impacto.";
    }
    if (currentId==="player") {
      if (response.check && narrativeClaimsCheckOutcome(response.narrative)) {
        return "La narración resolvió una maniobra del jugador en combate antes de lanzar el d20. Debe detenerse antes del resultado.";
      }
      if (combatPlayerActionLikelyNeedsD20(campaign) && !response.check) {
        return "La maniobra creativa declarada por el jugador durante combate tiene incertidumbre u oposición. Debe resolverse con una prueba d20 antes de narrar éxito o fracaso.";
      }
    }
    return "";
  }
  if (isHostileDeclaration(campaign)) {
    if (!response.encounter?.length) {
      return "El jugador declaró un ataque deliberado contra un personaje capaz de reaccionar. Debe abrirse un encounter y resolverse iniciativa/ataque/daño por el motor; un check de habilidad no sustituye el combate.";
    }
    if (narrativeClaimsResolvedViolence(response.narrative)) {
      return "La narración describió impacto, dolor, caída, herida o muerte antes de que el motor resolviera iniciativa/ataque/daño.";
    }
  }
  if (response.check && narrativeClaimsCheckOutcome(response.narrative)) {
    return "La narración resolvió el éxito o fracaso de una prueba antes de lanzar el d20. Debe detenerse en el intento, tensión o preparación previa.";
  }
  if (actionLikelyNeedsD20(campaign) && !response.check && !response.encounter?.length) {
    return "Regla Dice-First: toda acción del personaje que avance la ficción debe generar una prueba D20 antes de resolver sus consecuencias. Devuelve check y detén la narración antes del resultado.";
  }
  if ((isInformationalOrTrivialDeclaration(campaign) || isOrdinaryRoleplayDeclaration(campaign)) && response.check) {
    return "La entrada es una pregunta, conversación o roleo normal sin oposición significativa y no justifica una tirada. Responde y deja que la escena continúe naturalmente.";
  }

  // Los nombres genéricos de inventario son una mejora de presentación, no una razón
  // para rechazar un turno narrativo completo. El prompt sigue pidiendo concretarlos.
  return "";
}

function repairSemanticResponse(response,campaign,issue="") {
  if(!response) return response;
  const r={...response};
  const cleanMechanical=()=>{
    r.effects=(r.effects||[]).filter(e=>e.type==="item_rename");
    r.encounter=null;
    r.combatIntent=null;
  };
  if(campaign?.combat) {
    const currentId=campaign.combat?.order?.[campaign.combat?.index]?.id;
    if(currentId && currentId!=="player" && r.combatIntent?.action==="attack" && narrativeClaimsCombatHit(r.narrative)) {
      const actor=(campaign.combat.actors||[]).find(a=>a.id===currentId);
      r.narrative=[{kind:"narrator",speaker:"",text:`${actor?.name||"El adversario"} inicia el ataque. El motor resolverá primero si impacta y, solo entonces, el daño.`}];
      return r;
    }
    if(currentId==="player" && combatPlayerActionLikelyNeedsD20(campaign) && !r.check) {
      r.check=fallbackCheckForDeclaredAction(campaign);
      r.narrative=[{kind:"narrator",speaker:"",text:"La maniobra empieza, pero su resultado todavía no está decidido. La tirada resolverá si consigues lo que intentas."}];
      cleanMechanical();
      return r;
    }
    if(r.check && narrativeClaimsCheckOutcome(r.narrative)) {
      r.narrative=[{kind:"narrator",speaker:"",text:"La acción queda en el punto exacto en que puede salir bien o torcerse. La tirada decide lo que ocurre a continuación."}];
      cleanMechanical();
      return r;
    }
    return r;
  }
  if(isHostileDeclaration(campaign)) {
    if(!r.encounter?.length) r.encounter=[{name:hostileTargetName(campaign),profile:"skirmisher",side:"enemy",tactic:"Reaccionar, defenderse y buscar una posición segura.",entityId:null,distance:3}];
    r.check=null;
    r.combatIntent=null;
    r.effects=(r.effects||[]).filter(e=>e.type==="item_rename");
    r.narrative=[{kind:"narrator",speaker:"",text:"Tu acción hostil rompe el equilibrio de la escena. El objetivo reacciona de inmediato; la iniciativa decidirá quién logra actuar primero."}];
    return r;
  }
  if(actionLikelyNeedsD20(campaign) && !r.check) {
    r.check=fallbackCheckForDeclaredAction(campaign);
    r.narrative=[{kind:"narrator",speaker:"",text:"Tu intención está clara, pero el resultado todavía no. La situación queda suspendida justo antes de saber si lo consigues."}];
    cleanMechanical();
    return r;
  }
  if(r.check && narrativeClaimsCheckOutcome(r.narrative)) {
    r.narrative=[{kind:"narrator",speaker:"",text:"El intento está en marcha, pero todavía no se conoce su desenlace. La tirada decidirá la consecuencia."}];
    cleanMechanical();
    return r;
  }
  if((isInformationalOrTrivialDeclaration(campaign)||isOrdinaryRoleplayDeclaration(campaign)) && r.check) {
    r.check=null;
    r.effects=(r.effects||[]).filter(e=>e.type==="item_rename");
    r.encounter=null;
    r.combatIntent=null;
    return r;
  }
  console.warn("RASTHOR·IA semantic issue kept after deterministic repair",issue);
  return r;
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
    // Los cambios cosméticos de nombre son seguros antes de iniciativa;
    // los efectos mecánicos deben esperar a que el motor resuelva.
    out.effects=out.effects.filter(e=>e.type==="item_rename");
    out.check=null;
    out.combatIntent=null;
  }
  if (out.check) {
    // Permite contextualizar el inventario aunque la escena se detenga para tirar.
    out.effects=out.effects.filter(e=>e.type==="item_rename");
    out.encounter=null;
  }
  if (!out.narrative.length) out.narrative=[{kind:"narrator",speaker:"",text:"El mundo guarda silencio un instante, pero la situación permanece abierta. ¿Qué haces?"}];
  return out;
}

function emergencyNarradorResponse(campaign) {
  const combat=campaign?.combat||null;
  const currentId=combat?.order?.[combat?.index]?.id||null;
  let narrative=[{kind:"narrator",speaker:"",text:"La escena permanece abierta exactamente donde quedó. El Narrador no logró completar esta respuesta, pero ninguna decisión, tirada ni consecuencia se perdió."}];
  let check=null, combatIntent=null, encounter=null;

  if (combat && currentId==="player") {
    narrative=[{kind:"narrator",speaker:"",text:"Es tu turno. La situación sigue exactamente donde quedó; describe lo que intentas hacer y los dados resolverán la acción."}];
    if (combatPlayerActionLikelyNeedsD20(campaign)) check=fallbackCheckForDeclaredAction(campaign);
  } else if (combat && currentId) {
    const actor=(combat.actors||[]).find(a=>a.id===currentId);
    if (actor?.side==="enemy") {
      combatIntent={actor:currentId,action:"attack",target:"player"};
      narrative=[{kind:"narrator",speaker:"",text:`${actor.name||"El adversario"} reacciona y se prepara para atacar. El motor resolverá el intento con los dados correspondientes.`}];
    } else if (actor?.side==="ally") {
      const target=(combat.actors||[]).find(a=>a.side==="enemy"&&a.hp>0&&!(combat.fled||[]).includes(a.id));
      if (target) {
        combatIntent={actor:currentId,action:"attack",target:target.id};
        narrative=[{kind:"narrator",speaker:"",text:`${actor.name||"Tu aliado"} toma la iniciativa contra ${target.name}. El motor resolverá el ataque.`}];
      } else combatIntent={actor:currentId,action:"dodge",target:null};
    }
  } else if (isHostileDeclaration(campaign)) {
    encounter=[{name:hostileTargetName(campaign),profile:"skirmisher",side:"enemy",tactic:"Reaccionar al ataque, buscar cobertura y defenderse.",entityId:null,distance:3}];
    narrative=[{kind:"narrator",speaker:"",text:"Tu movimiento hostil rompe la calma. El objetivo reacciona de inmediato; la iniciativa decidirá quién logra actuar primero."}];
  } else if (actionLikelyNeedsD20(campaign)) {
    check=fallbackCheckForDeclaredAction(campaign);
    narrative=[{kind:"narrator",speaker:"",text:"Tu intención queda planteada. Antes de conocer el resultado, la situación depende de una tirada."}];
  }

  return normalizeResponse({
    title:null,
    narrative,
    check,
    effects:[],
    encounter,
    combatIntent,
    memory:{
      summary:campaign?.memory?.summary||"",
      entities:Array.isArray(campaign?.memory?.entities)?campaign.memory.entities:[],
      decision:null,
      flags:[],
      elapsedMinutes:0,
      location:null,
    },
    safeRest:false,
    privateMemory:campaign?.gmVault||"",
  },campaign);
}

function parseJSONLoose(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") return null;
  let text = value.trim();
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map(m=>m[1].trim()).reverse();
  for (const candidate of fenced) {
    try { return JSON.parse(candidate); } catch {}
  }
  text = text.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"").trim();
  try { return JSON.parse(text); } catch {}
  const lastEnd = text.lastIndexOf("}");
  if (lastEnd >= 0) {
    const starts=[];
    for(let i=0;i<=lastEnd;i++) if(text[i]==="{") starts.push(i);
    for(let i=starts.length-1;i>=0;i--) {
      try { return JSON.parse(text.slice(starts[i],lastEnd+1)); } catch {}
    }
  }
  return null;
}

function modelResponseObject(result) {
  if (!result) return null;
  const candidates = [
    result.response,
    result.result?.response,
    result.choices?.[0]?.message?.content,
    result.choices?.[0]?.message?.parsed,
    result.output_text,
    result.content,
  ];
  for (const candidate of candidates) {
    const parsed = parseJSONLoose(candidate);
    if (parsed) return parsed;
  }
  if (typeof result === "object" && !Array.isArray(result) && (result.narrative || result.memory || result.premise || result.classId)) return result;
  return null;
}

function aiErrorText(error) {
  try { return String(error?.message || error?.cause?.message || error || ""); } catch { return ""; }
}
function aiQuotaExceeded(error) {
  const t=aiErrorText(error).toLowerCase();
  return /(?:3036|daily free allocation|used up your daily|account limited|neuron)/.test(t);
}
function aiCapacityError(error) {
  const t=aiErrorText(error).toLowerCase();
  return /(?:3040|out of capacity|capacity temporarily exceeded|too many requests|429)/.test(t);
}
function aiTimeoutError(error) {
  return /(?:ai_timeout|timeout|timed out|3007)/i.test(aiErrorText(error));
}


const AI_PROVIDER_DEFAULTS = {
  cloudflare: { model: MODEL, label: "RASTHOR·IA Gratis" },
  openai: { model: "gpt-5.6-luna", label: "OpenAI" },
  gemini: { model: "gemini-3.8-flash", label: "Gemini" },
};

function aiContextFromRequest(request) {
  let provider=plainText(request?.headers?.get("X-Rasthoria-AI-Provider")||"cloudflare").trim();
  if(!["cloudflare","openai","gemini"].includes(provider)) provider="cloudflare";
  const rawKey=String(request?.headers?.get("X-Rasthoria-AI-Key")||"").trim();
  const requested=String(request?.headers?.get("X-Rasthoria-AI-Model")||"").trim();
  const safeModel=/^[A-Za-z0-9._:-]{2,100}$/.test(requested)?requested:"";
  return {
    provider,
    apiKey: rawKey.slice(0,500),
    model: safeModel || AI_PROVIDER_DEFAULTS[provider].model,
    label: AI_PROVIDER_DEFAULTS[provider].label,
    external: provider!=="cloudflare",
  };
}

class ProviderAIError extends Error {
  constructor(provider,status,code,message) {
    super(message||`${provider} request failed`);
    this.name="ProviderAIError";
    this.provider=provider;
    this.status=Number(status)||502;
    this.code=String(code||"provider_error");
  }
}

function externalProviderError(error) {
  return error instanceof ProviderAIError || ["openai","gemini"].includes(error?.provider);
}

function providerErrorMessage(error,ai) {
  const provider=ai?.provider||error?.provider||"IA";
  const status=Number(error?.status)||0;
  const code=String(error?.code||"").toLowerCase();
  if(status===401 || status===403 || /invalid.*key|api.?key|auth/.test(code+" "+aiErrorText(error))) {
    return provider==="openai"
      ? "La clave API de OpenAI no es válida o no tiene acceso. Revisa Narrador IA → OpenAI."
      : "La clave API de Gemini no es válida o no tiene acceso. Revisa Narrador IA → Gemini.";
  }
  if(status===429 || /quota|rate|limit|billing|insufficient/.test(code+" "+aiErrorText(error))) {
    return `Tu cuenta de ${provider==="openai"?"OpenAI":"Gemini"} alcanzó un límite de uso o facturación. La partida quedó guardada; cambia de Narrador IA o revisa la cuota de esa cuenta.`;
  }
  return `El Narrador de ${provider==="openai"?"OpenAI":"Gemini"} no pudo responder ahora. Tu turno quedó guardado; puedes reintentar o cambiar de proveedor.`;
}

async function fetchWithTimeout(url,options,timeoutMs=22000) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),Math.max(5000,Number(timeoutMs)||22000));
  try {
    return await fetch(url,{...options,signal:controller.signal});
  } catch(error) {
    if(error?.name==="AbortError") throw new ProviderAIError("external",504,"timeout","AI provider timeout");
    throw error;
  } finally { clearTimeout(timer); }
}

function extractOpenAIText(data) {
  if(typeof data?.output_text==="string" && data.output_text.trim()) return data.output_text;
  const chunks=[];
  for(const item of Array.isArray(data?.output)?data.output:[]) {
    for(const part of Array.isArray(item?.content)?item.content:[]) {
      if(typeof part?.text==="string") chunks.push(part.text);
      else if(typeof part?.content==="string") chunks.push(part.content);
    }
  }
  return chunks.join("\n").trim();
}

async function runOpenAIJSON(ai,{messages,max_tokens=900,timeoutMs=22000}) {
  if(!ai.apiKey) throw new ProviderAIError("openai",401,"missing_api_key","Falta la clave API de OpenAI.");
  const response=await fetchWithTimeout("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{"Authorization":`Bearer ${ai.apiKey}`,"Content-Type":"application/json"},
    body:JSON.stringify({
      model:ai.model||AI_PROVIDER_DEFAULTS.openai.model,
      input:withJsonInstruction(messages),
      max_output_tokens:Math.max(256,Math.min(4000,Number(max_tokens)||900)),
      text:{format:{type:"json_object"}},
    })
  },timeoutMs);
  let data={};
  try { data=await response.json(); } catch {}
  if(!response.ok) {
    const err=data?.error||{};
    throw new ProviderAIError("openai",response.status,err.code||err.type||"openai_error",err.message||`OpenAI HTTP ${response.status}`);
  }
  const parsed=parseJSONLoose(extractOpenAIText(data));
  if(!parsed) throw new ProviderAIError("openai",502,"invalid_json","OpenAI no devolvió JSON utilizable.");
  return {parsed,model:ai.model,provider:"openai"};
}

function geminiContents(messages) {
  const system=[]; const contents=[];
  for(const m of Array.isArray(messages)?messages:[]) {
    const text=String(m?.content||"");
    if(!text) continue;
    if(m.role==="system") { system.push(text); continue; }
    contents.push({role:m.role==="assistant"?"model":"user",parts:[{text}]});
  }
  return {system:system.join("\n\n"),contents};
}

async function runGeminiJSON(ai,{messages,max_tokens=900,temperature=0.5,top_p=0.9,timeoutMs=22000}) {
  if(!ai.apiKey) throw new ProviderAIError("gemini",401,"missing_api_key","Falta la clave API de Gemini.");
  const prepared=withJsonInstruction(messages);
  const parts=geminiContents(prepared);
  const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ai.model||AI_PROVIDER_DEFAULTS.gemini.model)}:generateContent`;
  const body={
    contents:parts.contents,
    generationConfig:{
      maxOutputTokens:Math.max(256,Math.min(4000,Number(max_tokens)||900)),
      temperature:Math.max(0,Math.min(1.2,Number(temperature)||0.5)),
      topP:Math.max(0.1,Math.min(1,Number(top_p)||0.9)),
      responseMimeType:"application/json",
    }
  };
  if(parts.system) body.systemInstruction={parts:[{text:parts.system}]};
  const response=await fetchWithTimeout(endpoint,{
    method:"POST",
    headers:{"x-goog-api-key":ai.apiKey,"Content-Type":"application/json"},
    body:JSON.stringify(body),
  },timeoutMs);
  let data={};
  try { data=await response.json(); } catch {}
  if(!response.ok) {
    const err=data?.error||{};
    throw new ProviderAIError("gemini",response.status,err.status||"gemini_error",err.message||`Gemini HTTP ${response.status}`);
  }
  const text=(data?.candidates?.[0]?.content?.parts||[]).map(x=>typeof x?.text==="string"?x.text:"").join("\n").trim();
  const parsed=parseJSONLoose(text);
  if(!parsed) throw new ProviderAIError("gemini",502,"invalid_json","Gemini no devolvió JSON utilizable.");
  return {parsed,model:ai.model,provider:"gemini"};
}

async function runExternalJSON(ai,args) {
  let firstError=null;
  for(let attempt=0;attempt<2;attempt++) {
    try {
      if(ai.provider==="openai") return await runOpenAIJSON(ai,{...args,temperature:attempt?0.25:args.temperature});
      if(ai.provider==="gemini") return await runGeminiJSON(ai,{...args,temperature:attempt?0.25:args.temperature});
      throw new ProviderAIError(ai.provider,400,"unsupported_provider","Proveedor no compatible.");
    } catch(error) {
      firstError ||= error;
      const status=Number(error?.status)||0;
      if([400,401,403,404,429].includes(status) || attempt===1) throw firstError;
    }
  }
  throw firstError || new ProviderAIError(ai.provider,502,"provider_error","No se pudo usar el proveedor.");
}

function withJsonInstruction(messages) {
  const rule = `\n\nFORMATO OBLIGATORIO: responde SOLO con un objeto JSON válido. Sin markdown, sin bloques de código, sin análisis visible y sin texto antes o después del JSON.`;
  const out=(Array.isArray(messages)?messages:[]).map(m=>({...m}));
  const systemIndex=out.findIndex(m=>m.role==="system");
  if(systemIndex>=0) out[systemIndex].content=String(out[systemIndex].content||"")+rule;
  else out.unshift({role:"system",content:rule.trim()});
  return out;
}

async function runModelJSON(env, {messages,max_tokens=900,temperature=0.5,top_p=0.9,timeoutMs=18000,allowFallback=true,ai=null}) {
  const provider=ai||{provider:"cloudflare",external:false,model:MODEL};
  if(provider.external) return runExternalJSON(provider,{messages,max_tokens,temperature,top_p,timeoutMs});

  const prepared=withJsonInstruction(messages);
  const models=allowFallback?[MODEL,FALLBACK_MODEL]:[MODEL];
  let firstError=null;
  for(let index=0;index<models.length;index++) {
    const model=models[index];
    try {
      const inference=env.AI.run(model,{
        messages:prepared,
        max_tokens,
        temperature:index===0?temperature:Math.min(temperature,0.48),
        top_p,
        repetition_penalty:1.04,
      });
      const result=await Promise.race([
        inference,
        new Promise((_,reject)=>setTimeout(()=>reject(new Error(`AI_TIMEOUT:${model}`)),Math.max(7000,Number(timeoutMs)||18000)))
      ]);
      const parsed=modelResponseObject(result);
      if(parsed) return {parsed,model,provider:"cloudflare"};
      throw new Error(`EMPTY_OR_INVALID_JSON:${model}`);
    } catch(error) {
      firstError ||= error;
      if(aiQuotaExceeded(error)) throw error;
      if(index===models.length-1) throw firstError || error;
    }
  }
  throw firstError || new Error("AI_JSON_FAILED");
}

async function runStructured(env, {messages,schema,max_tokens=900,temperature=0.5,top_p=0.9,attempts=1,timeoutMs=18000,ai=null}) {
  const {parsed}=await runModelJSON(env,{messages,max_tokens,temperature,top_p,timeoutMs,allowFallback:true,ai});
  return parsed;
}

async function runLooseJSON(env, {messages,max_tokens=900,temperature=0.45,top_p=0.9,timeoutMs=18000,ai=null}) {
  const {parsed}=await runModelJSON(env,{messages,max_tokens,temperature,top_p,timeoutMs,allowFallback:true,ai});
  return parsed;
}


function isCampaignOpening(campaign) {
  const messages=Array.isArray(campaign?.messages)?campaign.messages:[];
  const event=plainText(campaign?.lastEvent||"");
  return messages.length===0 || (Number(campaign?.revision||0)<=2 && /creacion de campana|primera escena|inicio de la campana/.test(event));
}

function openingFallbackTitle(campaign) {
  const genre=clip(campaign?.config?.genre,80);
  const setting=clip(campaign?.config?.setting,100);
  if(genre && !/aventura libre|hibrid/i.test(genre)) return clip(`${genre}: Primer umbral`,90);
  if(setting && !/mundo original/i.test(setting)) return clip(`El primer día en ${setting}`,90);
  return "Donde empieza la historia";
}

function fallbackOpeningEvent(campaign,name,place) {
  const genre=plainText(campaign?.config?.genre||"");
  const fantasy=plainText(campaign?.config?.fantasy||"");
  if(/superher|poder|metahuman/.test(`${genre} ${fantasy}`)) return `A pocos metros, todos los teléfonos empiezan a vibrar casi al mismo tiempo. Un video grabado hace segundos muestra algo físicamente imposible ocurriendo en ${place}. La gente se detiene, alguien grita y una sirena comienza a acercarse. Entre el ruido, hay un detalle que te resulta demasiado familiar.`;
  if(/terror|horror/.test(genre)) return `Algo pequeño rompe la normalidad: un sonido que nadie más parece querer reconocer. Se repite. Esta vez más cerca. Cuando buscas su origen, descubres una señal concreta de que no es imaginación y de que alguien —o algo— sabe que estás aquí.`;
  if(/noir|mister|crimen|detect/.test(genre)) return `Un desconocido deja algo a tu alcance y se marcha sin esperar respuesta. No parece un robo ni una amenaza improvisada. Hay un nombre, una hora y una prueba demasiado específica para ignorarla. Antes de que puedas decidir qué significa, notas que otra persona también estaba mirando.`;
  if(/ciencia fic|sci|espacial/.test(genre)) return `Las pantallas cercanas se apagan durante tres segundos. Cuando vuelven, todas muestran la misma lectura imposible antes de corregirse. Casi nadie la alcanza a notar. Tú sí. Y un dispositivo cercano acaba de registrar que estuviste presente.`;
  if(/cyber/.test(genre)) return `Una alerta privada atraviesa el ruido de la ciudad y aparece donde no debería poder aparecer. No trae remitente, pero incluye datos que solo tú reconocerías. Segundos después, alguien intenta borrar el mensaje de forma remota.`;
  if(/espion/.test(genre)) return `Una persona cruza tu camino sin mirarte y deja caer un objeto aparentemente banal. Cuando lo recoges, descubres que estaba preparado para ti. Al otro lado de la calle, un vehículo que llevaba demasiado tiempo detenido enciende el motor.`;
  if(/fantas/.test(genre)) return `Una señal imposible atraviesa la rutina del lugar: primero un silencio repentino, después una reacción en cadena entre quienes saben reconocerla. Algo que debía permanecer quieto acaba de cambiar, y varias miradas se vuelven hacia el mismo punto antes de que nadie se atreva a moverse.`;
  if(/superviv/.test(genre)) return `La primera señal de que algo va mal parece menor: un servicio que deja de responder, una ruta que se corta, una persona que no llega. Luego aparece una segunda señal, demasiado rápida para ser casualidad. La gente alrededor todavía no entiende el problema completo.`;
  if(/western/.test(genre)) return `El ruido habitual se corta cuando alguien llega con demasiada prisa y demasiado polvo encima. No viene buscando conversación: trae una noticia que cambia el equilibrio del lugar y varios presentes reaccionan antes de escucharla completa.`;
  if(/deport|carrer/.test(genre)) return `Un rumor corre más rápido que cualquier anuncio oficial. Algo ha cambiado justo antes del momento que importa, y hay dos versiones incompatibles circulando. Una de ellas te involucra directamente.`;
  return `Algo concreto rompe la rutina: una persona aparece donde no debería, trae información que te toca de cerca y se marcha antes de poder explicarla. Alrededor, el mundo sigue moviéndose como si nada, pero para ti la escena ya cambió.`;
}

function emergencyOpeningResponse(campaign, reason="") {
  const c=campaign||{};
  const ch=c.character||{};
  const cfg=c.config||{};
  const premise=clip(cfg.premise,2400) || "Algo acaba de cambiar y todavía no sabes hasta dónde llegará.";
  const setting=clip(cfg.setting,180);
  const era=clip(cfg.era,100);
  const background=clip(ch.background,600);
  const concept=clip(ch.concept,180);
  const name=clip(ch.name,70)||"Tu personaje";
  const place=(setting && !/mundo original/i.test(setting))?setting:"el lugar donde comienza todo";
  const time=(era && !/cualquier epoca/i.test(plainText(era)) && !plainText(place).includes(plainText(era)))?` en ${era}`:"";
  const first=`${name} está en ${place}${time}. La escena ya está viva antes de que hagas nada: voces, movimiento, objetos en uso y gente ocupada en sus propios problemas. Durante unos segundos parece un momento cualquiera.`;
  const second=fallbackOpeningEvent(c,name,place);
  const third=background
    ? `Tu pasado sigue contigo: ${background.slice(0,430)} Nada de eso decide tu reacción. Frente a ti, la situación acaba de abrir varias posibilidades y ninguna está elegida todavía.`
    : concept
      ? `${concept.slice(0,320)} describe de dónde partes, no lo que estás obligado a hacer. Lo que acaba de ocurrir está frente a ti y el siguiente movimiento es completamente tuyo.`
      : `No hay una acción correcta escrita de antemano. Puedes acercarte, ignorarlo, investigar, hablar, marcharte o intentar algo que nadie haya previsto.`;
  return normalizeResponse({
    title:openingFallbackTitle(c),
    narrative:[
      {kind:"narrator",speaker:"",text:first},
      {kind:"narrator",speaker:"",text:second},
      {kind:"narrator",speaker:"",text:third},
    ],
    check:null,effects:[],encounter:null,combatIntent:null,
    memory:{
      summary:`Inicio de campaña. ${premise.slice(0,900)}`,
      entities:[],decision:null,flags:[],elapsedMinutes:0,
      location:setting && !/mundo original/i.test(setting)?setting:(c?.memory?.location||"Por descubrir"),
    },
    safeRest:false,
    privateMemory:c?.gmVault||`Premisa base: ${premise.slice(0,1800)}`,
  },c);
}

async function generateOpening(env,campaign,ai=null) {
  const compact=publicCampaign(campaign);
  const prompt=`ABRE ESTA CAMPAÑA DE RASTHOR·IA COMO UN NARRADOR DE ROL EXCELENTE.\n\nESTADO:\n${JSON.stringify(compact)}\n\nEscribe una primera escena inmersiva de 180 a 420 palabras. Debe comenzar DENTRO de la acción cotidiana del mundo, usar detalles sensoriales concretos, introducir un gancho que ocurra en escena y terminar con libertad total para actuar. No decidas acciones, emociones ni pensamientos del personaje. No pidas ninguna tirada todavía y no resuelvas secretos de la premisa.\n\nDevuelve EXACTAMENTE este objeto JSON:\n{\n  "title":"título evocador de 2 a 7 palabras",\n  "narrative":[{"kind":"narrator","speaker":"","text":"..."}],\n  "summary":"resumen público compacto del punto de partida",\n  "location":"ubicación inicial concreta",\n  "privateMemory":"secretos o planes iniciales del Narrador; puede quedar vacío"\n}\nLa lista narrative puede contener entre 2 y 5 bloques; si un NPC habla puedes usar kind=\"npc\" y speaker con su nombre.`;
  const {parsed,model}=await runModelJSON(env,{
    messages:[
      {role:"system",content:"Eres el Narrador de una partida de rol abierta. Escribes español natural, cinematográfico y concreto. Nunca decides por el personaje del jugador."},
      {role:"user",content:prompt}
    ],
    max_tokens:900,temperature:0.72,top_p:0.92,timeoutMs:20000,allowFallback:true,ai
  });
  const narrative=Array.isArray(parsed?.narrative)?parsed.narrative:[];
  if(!narrative.some(x=>x&&typeof x.text==="string"&&x.text.trim())) throw new Error("OPENING_EMPTY");
  const response=normalizeResponse({
    title:clip(parsed.title,90)||openingFallbackTitle(campaign),
    narrative,
    check:null,effects:[],encounter:null,combatIntent:null,
    memory:{summary:clip(parsed.summary,8000),entities:[],decision:null,flags:[],elapsedMinutes:0,location:clip(parsed.location,150)||campaign?.memory?.location||"Por descubrir"},
    safeRest:false,
    privateMemory:clip(parsed.privateMemory,14000)||campaign?.gmVault||"",
  },campaign);
  return {response,model};
}

const CATEGORY_FALLBACKS = {
  "Fantasía": {
    setting:"Reinos de frontera, ciudades viejas y territorios donde lo sobrenatural tiene consecuencias concretas",era:"Era fantástica",tone:"Aventura con misterio y decisiones grises",fantasy:"Alta",themes:"poder, lealtad, secretos, facciones",
    premises:[
      "Una ciudad construida alrededor de un árbol petrificado despierta una mañana con todas sus campanas sonando solas. La nobleza culpa a los barrios bajos, los gremios cierran las puertas y tú recibes una llave que abre una cámara que oficialmente no existe.",
      "En la frontera entre dos reinos aparece un puente de piedra durante una sola noche cada veinte años. Esta vez regresa antes de tiempo y trae de vuelta a una expedición que partió hace décadas sin haber envejecido un día.",
      "Una feria ambulante llega a tu pueblo ofreciendo deseos pequeños y aparentemente inocentes. Al tercer día, cada deseo concedido empieza a cobrar un precio distinto y alguien cercano a ti aparece en la lista de próximos clientes."
    ]
  },
  "Noir / misterio": {
    setting:"Ciudad contemporánea densa, húmeda y llena de intereses cruzados",era:"Actualidad",tone:"Noir, tenso y humano",fantasy:"Realista o ambigua",themes:"mentiras, investigación, poder, culpa",
    premises:[
      "Una mujer te paga para encontrar a su hermano desaparecido. El problema es que él aparece esa misma noche en las cámaras de seguridad de tres lugares distintos, a la misma hora, dejando mensajes diferentes para ti.",
      "Un periodista muere en un accidente que todos llaman rutinario. Horas después, recibes un sobre que él dejó programado para enviarte: contiene fotos de personas importantes reunidas en un edificio abandonado y una sola frase escrita a mano: «uno de ellos sabe tu nombre».",
      "La policía cierra el caso de un robo sin víctimas, pero el dueño insiste en que no falta nada. Al revisar el lugar descubres que alguien entró solo para cambiar una fotografía familiar por otra casi idéntica, tomada años antes de que esa familia se conociera."
    ]
  },
  "Ciencia ficción": {
    setting:"Colonias, estaciones y rutas humanas lejos de la Tierra",era:"Futuro lejano",tone:"Ciencia ficción de aventura y misterio",fantasy:"Tecnología avanzada",themes:"identidad, exploración, tecnología, supervivencia",
    premises:[
      "Tu nave recibe una solicitud de atraque de una colonia que fue evacuada hace cuarenta años. Al aceptar, el sistema reconoce a toda tu tripulación como ciudadanos nacidos allí.",
      "Una sonda minera regresa con un fragmento de material imposible de escanear. Antes de que puedas entregarlo, tres gobiernos, una corporación y una voz desconocida dentro de la propia sonda reclaman su propiedad.",
      "En un puerto orbital, todos los relojes se adelantan exactamente nueve minutos durante una falla eléctrica. Solo tú recuerdas lo ocurrido en esos nueve minutos y sabes que alguien murió, aunque ahora esa persona sigue viva."
    ]
  },
  "Cyberpunk": {
    setting:"Megaciudad latinoamericana hiperconectada y desigual",era:"Futuro cercano",tone:"Crudo, urbano y veloz",fantasy:"Tecnología extrema",themes:"corporaciones, identidad, deuda, vigilancia",
    premises:[
      "Despiertas con una deuda que jamás pediste y un implante legalmente registrado a tu nombre que no está en tu cuerpo. Alguien lo está usando para cometer delitos y cada cámara de la ciudad cree que eres tú.",
      "Un apagón de treinta segundos borra la identidad digital de miles de personas. La tuya permanece intacta, pero ahora figura como propietaria de una empresa fantasma que acaba de comprar un distrito entero.",
      "Una empresa ofrece dinero por entregar a una IA fugitiva. Cuando logras contactarla, descubres que no vive en un servidor: está repartida entre los dispositivos domésticos de un barrio que será demolido mañana."
    ]
  },
  "Superhéroes": {
    setting:"Ciudad moderna donde los poderes todavía están cambiando la sociedad",era:"Actualidad alternativa",tone:"Épico, humano y con consecuencias",fantasy:"Poderes recientes",themes:"identidad, poder, opinión pública, responsabilidad",
    premises:[
      "Hace semanas desarrollaste una capacidad imposible que aún no controlas. Hoy aparece un video de una persona usando exactamente tu mismo poder durante un crimen, y alguien deja en tu puerta una nota: «sé que ese no eras tú».",
      "Los primeros superhumanos del país deben registrarse por ley. El día antes de que venza el plazo, tus poderes aparecen en público al salvar a alguien, pero el registro oficial ya contiene una ficha completa con tu nombre, fotografía y habilidades que tú nunca entregaste.",
      "Una figura enmascarada lleva meses salvando gente y se ha convertido en símbolo nacional. Durante un rescate, descubres que obtiene sus poderes drenando lentamente a otras personas como tú, y ahora quiere convertirte en su socio."
    ]
  },
  "Espionaje": {
    setting:"Capitales, aeropuertos y fronteras donde nadie cuenta toda la verdad",era:"Contemporánea",tone:"Thriller paranoico",fantasy:"Realista",themes:"lealtad, información, engaño, identidad",
    premises:[
      "Recibes por error una llamada cifrada destinada a un agente encubierto. La voz al otro lado te da instrucciones que describen exactamente dónde estás y termina diciendo que tienes doce minutos antes de que alguien vaya por ti.",
      "Una lista de informantes desaparece durante una cumbre internacional. Todos creen que la robaste porque las cámaras muestran tu rostro, pero tú estabas a kilómetros de distancia y solo una persona puede demostrarlo: alguien a quien juraste no volver a ver.",
      "Un diplomático desaparece en un aeropuerto sin activar ninguna alarma. Su equipaje llega a tu casa antes de que la noticia sea pública, con un pasaporte a tu nombre y una fotografía tuya tomada en un país donde nunca has estado."
    ]
  },
  "Terror": {
    setting:"Entorno cotidiano que se vuelve gradualmente imposible",era:"Actualidad",tone:"Horror progresivo y psicológico",fantasy:"Ambigua",themes:"miedo, memoria, aislamiento, verdad",
    premises:[
      "Cada noche a las 03:12 alguien toca tres veces tu puerta. La cámara nunca muestra a nadie. La cuarta noche, el video sí muestra una figura: eres tú mismo, vestido con ropa que no tienes.",
      "Un edificio entero despierta sin poder recordar al vecino del departamento 404. El problema es que todas las fotos, contratos y mensajes prueban que cada residente tenía una relación distinta con esa persona.",
      "Durante un viaje por carretera encuentras una estación de servicio abierta en medio de la nada. El dependiente te entrega el vuelto exacto de una compra que todavía no has hecho y te suplica que esta vez no entres al baño."
    ]
  },
  "Vida real": {
    setting:"Ciudad contemporánea y problemas humanos reconocibles",era:"Actualidad",tone:"Humano, íntimo y reactivo",fantasy:"Ninguna",themes:"amistad, trabajo, relaciones, dinero, decisiones",
    premises:[
      "Te ofrecen el trabajo que llevas años esperando, pero exige mudarte en una semana. Esa misma noche una persona importante para ti revela que necesita ayuda con algo que podría cambiarle la vida.",
      "Tu grupo de amigos encuentra por casualidad una vieja grabación de cuando eran adolescentes. En ella aparece una promesa que ninguno recuerda haber hecho y una persona que dejó de hablarles hace años acaba de volver a la ciudad.",
      "Un pequeño negocio familiar recibe una oferta de compra imposible de rechazar. El dinero resolvería casi todos los problemas, pero vender significa despedir a gente que conoces de toda la vida y descubrir por qué una empresa tan grande quiere precisamente ese lugar."
    ]
  },
  "Supervivencia": {
    setting:"Zona aislada con recursos limitados y ayuda incierta",era:"Actualidad",tone:"Tenso y realista",fantasy:"Ninguna",themes:"supervivencia, cooperación, moralidad, recursos",
    premises:[
      "Una tormenta destruye la única carretera que conecta un pueblo con el exterior. La ayuda tardará días y el generador del hospital solo tiene combustible para una noche. Tres grupos distintos aseguran tener derecho al último depósito de combustible cercano.",
      "Tras un accidente aéreo, un pequeño grupo queda aislado en una zona montañosa. Hay comida para pocos días y una radio que funciona solo unos minutos por jornada, pero alguien ha estado usándola a escondidas durante la noche.",
      "Un incendio forestal cambia de dirección y corta todas las rutas de evacuación. Un refugio cercano puede resistir, pero no tiene espacio para todos los que están llegando y nadie sabe si la información oficial sigue siendo válida."
    ]
  },
  "Western": {
    setting:"Frontera polvorienta donde la ley llega tarde",era:"Finales del siglo XIX",tone:"Serio, áspero y de personajes",fantasy:"Realista",themes:"ley, ambición, reputación, violencia",
    premises:[
      "Un tren llega al pueblo sin conductor y con todos sus pasajeros vivos, pero ninguno recuerda las últimas seis horas. En uno de los vagones hay una caja fuerte abierta y el mapa de una mina que oficialmente nunca existió.",
      "El nuevo juez ofrece una recompensa por un forajido al que todos creen muerto. Esa misma tarde, el supuesto cadáver aparece en tu puerta pidiéndote ayuda y afirma que el verdadero criminal lleva años viviendo bajo otro nombre.",
      "Una compañía ferroviaria compra casi todas las tierras del valle. La única familia que se niega a vender desaparece durante la noche y varias personas poderosas quieren que aceptes versiones muy distintas de lo ocurrido."
    ]
  }
};

function fallbackRandomCampaign(seed,prefs={},category="",exclude="") {
  const categoryPack=CATEGORY_FALLBACKS[category];
  if(categoryPack){
    const excluded=plainText(exclude).trim();
    let candidates=categoryPack.premises.filter(p=>plainText(p).trim()!==excluded);
    if(!candidates.length) candidates=categoryPack.premises.slice();
    const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);
    const premise=candidates[bytes[0]%candidates.length];
    return {
      premise,
      genre:category,
      setting:categoryPack.setting,
      era:categoryPack.era,
      tone:categoryPack.tone,
      fantasy:categoryPack.fantasy,
      combat:Number.isFinite(Number(prefs?.combat))?Math.max(0,Math.min(5,Number(prefs.combat))):(category==="Superhéroes"?4:2),
      exploration:Number.isFinite(Number(prefs?.exploration))?Math.max(0,Math.min(5,Number(prefs.exploration))):3,
      conversation:Number.isFinite(Number(prefs?.conversation))?Math.max(0,Math.min(5,Number(prefs.conversation))):4,
      mystery:Number.isFinite(Number(prefs?.mystery))?Math.max(0,Math.min(5,Number(prefs.mystery))):3,
      difficulty:["amable","equilibrada","exigente"].includes(prefs?.difficulty)?prefs.difficulty:"equilibrada",
      mortality:["permanente","consecuencias"].includes(prefs?.mortality)?prefs.mortality:"consecuencias",
      duration:clip(prefs?.duration,100)||"Campaña abierta",
      themes:categoryPack.themes
    };
  }
  const ideas=[
    {genre:"Misterio contemporáneo",setting:"Santiago bajo una lluvia fuera de temporada",era:"Actualidad",tone:"Tenso, humano y callejero",fantasy:"Baja o incierta",premise:"Una noche, todas las pantallas de una estación de Metro muestran durante once segundos el mismo video: tú entrando a un edificio que nunca has visitado. A la mañana siguiente, una desconocida te reconoce por ese registro y asegura que alguien desapareció allí. Nadie más parece conservar la grabación.",themes:"identidad, vigilancia, confianza, ciudad, secretos"},
    {genre:"Ciencia ficción",setting:"Puerto orbital de carga en el borde del sistema",era:"Siglo XXIV",tone:"Aventura sucia con humor y peligro",fantasy:"Tecnología avanzada",premise:"Tu turno de trabajo debía terminar con una inspección rutinaria, pero un contenedor sin propietario empieza a transmitir una señal usando tu nombre. La aduana quiere abrirlo, una tripulación rival ofrece pagarte por hacerlo desaparecer y el manifiesto oficial dice que ese contenedor no existe.",themes:"lealtad, dinero, tecnología, supervivencia"},
    {genre:"Drama criminal",setting:"Barrio costero donde todos se conocen",era:"Actualidad",tone:"Realista, íntimo y peligroso",fantasy:"Ninguna",premise:"Un amigo de años deja una mochila en tu casa y te pide que no la abras hasta mañana. Esa misma noche desaparece. Antes del amanecer llegan tres personas distintas preguntando por él, cada una con una versión incompatible de lo ocurrido.",themes:"amistad, deuda, mentira, consecuencias"},
    {genre:"Horror",setting:"Hotel cordillerano aislado por una tormenta",era:"Actualidad",tone:"Inquietante y progresivo",fantasy:"Ambigua",premise:"La carretera queda cortada y los huéspedes aceptan pasar la noche. A las 02:17, el teléfono de cada habitación suena al mismo tiempo. Al contestar, todos oyen su propia voz diciendo una frase diferente. La tuya menciona algo que nunca le contaste a nadie.",themes:"aislamiento, memoria, paranoia, verdad"},
    {genre:"Aventura deportiva",setting:"Circuito clandestino de carreras urbanas",era:"Actualidad",tone:"Enérgico, competitivo y humano",fantasy:"Ninguna",premise:"Llegas como reemplazo de última hora a una carrera que puede cambiar la temporada de tu equipo. Antes de partir descubres que el auto del favorito fue manipulado y que alguien dejó la misma pieza defectuosa dentro de tu bolso. Si denuncias, quizá suspendan la carrera; si callas, alguien puede terminar herido.",themes:"competencia, reputación, equipo, riesgo"},
    {genre:"Superhéroes",setting:"Ciudad moderna tres meses después de las primeras personas con poderes",era:"Actualidad alternativa",tone:"Crudo, impredecible y personal",fantasy:"Poderes recientes",premise:"Tu habilidad apareció en el peor momento posible y nadie sabe que la tienes. Esta mañana un video viral muestra a otra persona usando un poder idéntico al tuyo durante un delito. La policía publica una recompensa mientras alguien deja bajo tu puerta una nota: «Sé que ese no eras tú».",themes:"identidad, poder, miedo público, responsabilidad"}
  ];
  if (seed && seed.trim().length>20) {
    return {
      premise:`${seed.trim()} La historia comienza en un momento concreto en que una consecuencia inesperada obliga a actuar, pero deja abiertas varias rutas y no decide por tu personaje.`,
      genre:clip(prefs?.genre,100)||"Aventura personalizada",
      setting:clip(prefs?.setting,180)||"Según la premisa del jugador",
      era:clip(prefs?.era,100)||"Según la premisa",
      tone:clip(prefs?.tone,120)||"Reactivo y cinematográfico",
      fantasy:clip(prefs?.fantasy,80)||"Según la premisa",
      combat:Math.max(0,Math.min(5,Number(prefs?.combat)||2)),
      exploration:Math.max(0,Math.min(5,Number(prefs?.exploration)||3)),
      conversation:Math.max(0,Math.min(5,Number(prefs?.conversation)||3)),
      mystery:Math.max(0,Math.min(5,Number(prefs?.mystery)||2)),
      difficulty:["amable","equilibrada","exigente"].includes(prefs?.difficulty)?prefs.difficulty:"equilibrada",
      mortality:["permanente","consecuencias"].includes(prefs?.mortality)?prefs.mortality:"consecuencias",
      duration:clip(prefs?.duration,100)||"Campaña abierta",
      themes:clip(prefs?.themes,1000)||"decisiones, relaciones y consecuencias"
    };
  }
  const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);
  const idea=ideas[bytes[0]%ideas.length];
  return {...idea,combat:2,exploration:3,conversation:4,mystery:3,difficulty:"equilibrada",mortality:"consecuencias",duration:"Campaña abierta"};
}

function fallbackCharacterBuild({concept="",premise="",ancestry="",background=""}={}) {
  const text=plainText(`${concept} ${background} ${premise}`);
  let classId="rogue",priority=["DEX","INT","WIS","CHA","CON","STR"];
  if(/\b(?:medic\w*|doctor\w*|enfermer\w*|paramedic\w*|sanador\w*|terapeut\w*|protector\w*|lider\w*|diplomatic\w*)\b/.test(text)) {
    classId="cleric"; priority=["WIS","CHA","CON","INT","DEX","STR"];
  } else if(/\b(?:mago\w*|hechicer\w*|brujo\w*|psionic\w*|telepat\w*|mutan\w*|superpoder\w*|poderes?\b|energia\w*|sobrehuman\w*)/.test(text)) {
    classId="mage"; priority=["INT","WIS","CON","DEX","CHA","STR"];
  } else if(/\b(?:soldad\w*|militar\w*|boxe\w*|luchador\w*|peleador\w*|guerrer\w*|guardia\w*|fuerte\b|fisic\w*|atleta\w*|rugby\w*)/.test(text)) {
    classId="warrior"; priority=["STR","CON","DEX","WIS","CHA","INT"];
  } else if(/\b(?:detective\w*|investigador\w*|periodista\w*|cientific\w*|academ\w*|profesor\w*)/.test(text)) {
    classId="rogue"; priority=["INT","WIS","DEX","CHA","CON","STR"];
  } else if(/\b(?:hacker\w*|programador\w*|ingenier\w*|mecanic\w*|tecnic\w*|piloto\w*)/.test(text)) {
    classId="rogue"; priority=["INT","DEX","WIS","CON","CHA","STR"];
  } else if(/\b(?:ladron\w*|espia\w*|agente\w*|tirador\w*|francotirador\w*|acrobata\w*|sigil\w*)/.test(text)) {
    classId="rogue"; priority=["DEX","WIS","INT","CON","CHA","STR"];
  } else if(/\b(?:actor\w*|cantante\w*|musico\w*|vendedor\w*|politic\w*|influencer\w*|negociador\w*)/.test(text)) {
    classId="rogue"; priority=["CHA","WIS","DEX","INT","CON","STR"];
  }
  return {classId,priority,ancestry:ancestry||"Humano",background:background||concept||"Una historia todavía por definir.",languages:["Común"],reason:"Asignación de respaldo basada en profesión, entrenamiento, pasado y lógica de atributos de juegos de rol."};
}


function providerConnectionPayload(ai) {
  if(ai.external) {
    return {connected:Boolean(ai.apiKey),model:ai.model,provider:ai.provider,providerLabel:ai.label,managed:false,canConnect:true,build:BUILD};
  }
  return {connected:true,model:"Qwen3 30B-A3B · RASTHOR·IA Gratis",provider:"cloudflare",providerLabel:"RASTHOR·IA Gratis",managed:true,canConnect:true,build:BUILD};
}

async function testProvider(ai,env) {
  if(ai.provider==="cloudflare") return {ok:true,provider:"cloudflare",model:MODEL,label:"RASTHOR·IA Gratis"};
  const probe=[
    {role:"system",content:"Responde únicamente JSON."},
    {role:"user",content:'Devuelve exactamente {"ok":true}.'}
  ];
  const {parsed,model}=await runModelJSON(env,{messages:probe,max_tokens:80,temperature:0,top_p:1,timeoutMs:12000,allowFallback:false,ai});
  if(parsed?.ok!==true && String(parsed?.ok)!=="true") throw new ProviderAIError(ai.provider,502,"probe_failed","El proveedor respondió, pero no completó la prueba correctamente.");
  return {ok:true,provider:ai.provider,model,label:ai.label};
}

export default {
  async fetch(request, env) {
    const urlForMcp = new URL(request.url);
    if (urlForMcp.pathname === "/mcp") return mcpHandler.fetch(request);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      if (origin && !isAllowedOrigin(origin)) return new Response(null,{status:403});
      return new Response(null,{status:204,headers:cors(origin)});
    }
    if (origin && !isAllowedOrigin(origin)) return json({error:"Origin not allowed"},403,origin);

    const url = new URL(request.url);
    const ai = aiContextFromRequest(request);
    if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/connection")) {
      if (url.pathname === "/api/connection") return json(providerConnectionPayload(ai),200,origin);
      return json({ok:true,service:"RASTHOR·IA Narrador",model:MODEL,build:BUILD,providers:["cloudflare","openai","gemini"]},200,origin);
    }

    if (url.pathname === "/api/connection" && (request.method === "POST" || request.method === "DELETE")) {
      return json(providerConnectionPayload(ai),200,origin);
    }

    if (request.method === "POST" && url.pathname === "/api/provider-test") {
      try {
        const result=await testProvider(ai,env);
        return json(result,200,origin);
      } catch(error) {
        if(externalProviderError(error)) return json({ok:false,error:providerErrorMessage(error,ai),provider:ai.provider,code:error.code||"provider_error"},Math.max(400,Math.min(599,Number(error.status)||502)),origin);
        return json({ok:false,error:"El Narrador gratuito no está disponible ahora.",provider:"cloudflare"},503,origin);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/random-campaign") {
      let body = {};
      try { body = await request.json(); } catch {}
      const seed = clip(body?.seed, 1200);
      const category = clip(body?.category, 80);
      const exclude = clip(body?.exclude, 3500);
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
Categoría obligatoria si se indicó: ${category || "ninguna; tienes libertad total"}
Idea escrita por el usuario, si existe: ${seed || "ninguna"}
Idea anterior que NO debes continuar, ampliar ni repetir: ${exclude || "ninguna"}
Preferencias actuales: ${JSON.stringify(prefs).slice(0,2500)}

REGLA DE VARIEDAD: si existe una idea anterior, crea otra aventura realmente distinta. No hagas una secuela, no agregues párrafos al texto anterior y no recicles el mismo gancho cambiando nombres. Si hay categoría obligatoria, mantente dentro de ella pero cambia conflicto, lugar, escala y tipo de problema.
Devuelve solo el JSON solicitado.`;
      let parsed=null, degraded=false;
      const campaignMessages=[
        {role:"system",content:"Eres un diseñador de campañas de rol extremadamente versátil. No asumas fantasía medieval."},
        {role:"user",content:prompt}
      ];
      try {
        parsed = await runLooseJSON(env,{messages:campaignMessages,max_tokens:720,temperature:0.82,top_p:0.94,timeoutMs:22000,ai});
      } catch (error) {
        if(ai.external && externalProviderError(error)) return json({error:providerErrorMessage(error,ai),provider:ai.provider,code:error.code||"provider_error"},Math.max(400,Math.min(599,Number(error.status)||502)),origin);
        console.warn("RASTHOR·IA random campaign local fallback",error);
        parsed=fallbackRandomCampaign(seed,prefs,category,exclude);
        degraded=true;
      }
      if (!parsed || typeof parsed!=="object") { parsed=fallbackRandomCampaign(seed,prefs,category,exclude); degraded=true; }
      return json({campaign:{
        premise:clip(parsed.premise,3500),
        genre:category || clip(parsed.genre,100),
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
      },degraded},200,origin);
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

Elige classId por cómo funcionaría el personaje, no por estética. Esta base es INTERNA y el jugador no la elige ni tiene por qué verla.

Para priority compórtate como un diseñador veterano de RPG de mesa y d20:
- usa STR para fuerza física, potencia corporal y atletismo;
- DEX para reflejos, precisión, sigilo, coordinación y manejo fino;
- CON para resistencia, dureza, salud y aguante;
- INT para conocimiento, investigación, lógica, ciencia y técnica;
- WIS para percepción, intuición, lectura de personas, criterio y supervivencia;
- CHA para presencia, liderazgo, persuasión, engaño y actuación.

Lee con atención oficio/concepto, entrenamiento, poderes, personalidad y PASADO. Prioriza las características que de verdad explican cómo ese personaje resolvería problemas. Un detective suele valorar INT/WIS; un boxeador STR/CON; un piloto DEX/INT o DEX/WIS; un médico WIS/INT; un hacker INT/DEX; un líder CHA/WIS. Un personaje con poderes no debe recibir automáticamente INT alta: depende de cómo funcionen sus poderes y de su historia.
priority debe contener STR, DEX, CON, INT, WIS y CHA una sola vez, ordenadas desde la más importante a la menos importante. El juego asignará 15,14,13,12,10,8 en ese orden.
Si la historia es realista, no inventes magia. ancestry debe respetar lo escrito por el usuario; solo sugiere algo si estaba genérico. background puede completar un campo vacío, pero nunca reescribas ni contradigas un pasado que el jugador ya escribió.
Devuelve solo el JSON solicitado.`;
      let parsed=null,degraded=false;
      const buildMessages=[
        {role:"system",content:"Eres un diseñador de personajes d20 que adapta mecánicas a cualquier género sin imponer fantasía medieval."},
        {role:"user",content:prompt}
      ];
      try {
        parsed=await runLooseJSON(env,{messages:buildMessages,max_tokens:480,temperature:0.45,top_p:0.88,timeoutMs:20000,ai});
      } catch(error) {
        if(ai.external && externalProviderError(error)) return json({error:providerErrorMessage(error,ai),provider:ai.provider,code:error.code||"provider_error"},Math.max(400,Math.min(599,Number(error.status)||502)),origin);
        console.warn("RASTHOR·IA character local fallback",error);
        parsed=fallbackCharacterBuild({concept,premise,ancestry,background});
        degraded=true;
      }
      if(!parsed||typeof parsed!=="object") { parsed=fallbackCharacterBuild({concept,premise,ancestry,background}); degraded=true; }
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
      },degraded},200,origin);
    }

    if (request.method !== "POST" || url.pathname !== "/api/gm") return json({error:"Not found"},404,origin);

    const len = Number(request.headers.get("content-length") || 0);
    if (len > 250000) return json({error:"Campaign payload too large"},413,origin);

    let body;
    try { body = await request.json(); } catch { return json({error:"Invalid JSON"},400,origin); }
    const campaign = body?.campaign;
    if (!campaign || typeof campaign !== "object") return json({error:"Missing campaign"},400,origin);
    const repairHint = clip(body?.repairHint, 700);

    if (isCampaignOpening(campaign)) {
      try {
        const opening=await generateOpening(env,campaign,ai);
        return json({response:opening.response,vault:opening.response.privateMemory,model:opening.model,opening:true},200,origin);
      } catch (openingError) {
        console.error("RASTHOR·IA opening generation error",openingError);
        if(ai.external && externalProviderError(openingError)) return json({error:providerErrorMessage(openingError,ai),provider:ai.provider,code:openingError.code||"provider_error"},Math.max(400,Math.min(599,Number(openingError.status)||502)),origin);
        const fallback=emergencyOpeningResponse(campaign,aiErrorText(openingError));
        return json({response:fallback,vault:fallback.privateMemory,degraded:true,degradedReason:aiQuotaExceeded(openingError)?"quota":aiCapacityError(openingError)?"capacity":aiTimeoutError(openingError)?"timeout":"opening_error",opening:true},200,origin);
      }
    }

    const compact = publicCampaign(campaign);
    const isOpening = Number(compact.revision||0) <= 1 && (compact.messages?.length||0) <= 3;
    const hostileTurn = isHostileDeclaration(campaign);
    const d20Turn = actionLikelyNeedsD20(campaign) || combatPlayerActionLikelyNeedsD20(campaign);
    const genericItems = genericInventoryItems(campaign);
    const sceneDirective = isOpening
      ? "ESTE ES EL INICIO DE LA CAMPAÑA. Construye una apertura evocadora y cinematográfica siguiendo estrictamente APERTURA DE CAMPAÑA. Prioriza atmósfera, lugar, humanidad y un gancho que ocurra en escena."
      : "CONTINÚA LA ESCENA. Mantén el mismo nivel de calidad literaria, continuidad, espacialidad y voz de personajes. Reacciona exactamente a lo que acaba de hacer o decir el personaje.";

    const hostilityDirective = hostileTurn
      ? "\n\nACCIÓN HOSTIL DETECTADA\nEl jugador ha declarado un INTENTO de violencia. Si el objetivo puede reaccionar y aún no hay combate, está TERMINANTEMENTE PROHIBIDO narrar que el ataque impacta, hiere, decapita o mata. Narra solo el inicio del movimiento/reacción del mundo y devuelve encounter con al menos un enemy para que el motor lance iniciativa. La redacción del jugador describe intención, NO éxito automático."
      : "";

    const d20Directive = d20Turn
      ? "\n\nRESOLUCIÓN D20 NECESARIA\nEsta acción contiene incertidumbre real, oposición, riesgo o una tarea técnica que debe resolverse con D20. Devuelve check con característica/habilidad, DC y ventaja/desventaja apropiadas. Narra solo el intento o tensión previa; NO narres todavía éxito o fracaso. El motor continuará después de la tirada."
      : "";

    const inventoryDirective = genericItems.length
      ? "\n\nINVENTARIO POR CONCRETAR\nEl estado aún contiene nombres mecánicos genéricos. Concrétalos según ESTE mundo y la historia ya establecida usando item_rename, sin cambiar estadísticas. Objetos: "+JSON.stringify(genericItems.map(i=>({id:i.id,catalog:i.catalog,name:i.name})))+". Si la historia ya ha establecido un equivalente concreto (por ejemplo una pistola), usa exactamente ese objeto. item_rename puede coexistir con check o encounter."
      : "";

    const repairDirective = repairHint
      ? `\n\nCORRECCIÓN DEL INTENTO ANTERIOR\nLa respuesta previa no encajó con el motor por este motivo: ${repairHint}. Corrige ese problema sin repetir el error ni cambiar hechos ya establecidos.`
      : "";

    const userPrompt = `ESTADO ACTUAL DE LA CAMPAÑA\n${JSON.stringify(compact)}\n\nDIRECTIVA DE ESCENA\n${sceneDirective}${hostilityDirective}${d20Directive}${inventoryDirective}${repairDirective}\n\nProcesa exclusivamente el siguiente turno respetando lastEvent, los resultados de dados ya presentes y el estado del motor. Devuelve solo el objeto JSON solicitado.`;

    try {
      const turnMessages=[
        {role:"system",content:SYSTEM},
        {role:"user",content:userPrompt},
      ];
      let parsed = await runLooseJSON(env,{messages:turnMessages,max_tokens:isOpening?950:900,temperature:isOpening?0.66:0.58,top_p:0.91,timeoutMs:24000,ai});
      let response = normalizeResponse(parsed,campaign);
      const semanticIssue = semanticProblem(response,campaign);
      if (semanticIssue) {
        console.warn("RASTHOR·IA semantic repair:",semanticIssue);
        response=repairSemanticResponse(response,campaign,semanticIssue);
        response=normalizeResponse(response,campaign);
      }
      return json({response,vault:response.privateMemory},200,origin);
    } catch (error) {
      console.error("RASTHOR·IA Narrador error",error);
      if(ai.external && externalProviderError(error)) return json({error:providerErrorMessage(error,ai),provider:ai.provider,code:error.code||"provider_error"},Math.max(400,Math.min(599,Number(error.status)||502)),origin);
      try {
        const fallback=emergencyNarradorResponse(campaign);
        const degradedReason=aiQuotaExceeded(error)?"quota":aiCapacityError(error)?"capacity":aiTimeoutError(error)?"timeout":"ai_error";
        console.warn("RASTHOR·IA emergency Narrador fallback active",degradedReason);
        return json({response:fallback,vault:fallback.privateMemory,degraded:true,degradedReason},200,origin);
      } catch (fallbackError) {
        console.error("RASTHOR·IA emergency fallback error",fallbackError);
        return json({error:"El Narrador no pudo completar este turno. Tu acción sigue guardada para reintentar."},503,origin);
      }
    }
  }
};