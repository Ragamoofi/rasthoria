const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const BUILD = "2026-09-21-rules-v7-long-memory";
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

const SYSTEM = `Eres el Director de Juego de RASTHOR·IA, un RPG narrativo reactivo inspirado en d20/SRD 5e. Tu respuesta NO es texto libre: debe cumplir exactamente el JSON solicitado.

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

TIRADAS — REGLA CENTRAL D20 / SRD 5e
- Los dados son la autoridad cuando el personaje INTENTA conseguir algo y el resultado es incierto. No decidas por narración un éxito o fracaso que debería resolver el d20.
- PRESUNCIÓN A FAVOR DE TIRAR: si una acción razonablemente podría fallar Y ese fallo cambiaría la escena, pide check o save. Esto debe ocurrir con frecuencia; exploración, investigación, sigilo, interacción social con resistencia, persecuciones, obstáculos físicos, tareas técnicas bajo presión y peligros deben usar dados.
- Usa ability check cuando el personaje actúa para superar una dificultad: Fuerza/Atletismo para esfuerzo físico, Destreza/Acrobacias o Sigilo para precisión/movimiento oculto, Inteligencia/Investigación y conocimientos para deducir o estudiar, Sabiduría/Percepción-Perspicacia-Supervivencia para percibir o leer situaciones, Carisma/Engaño-Intimidación-Persuasión-Interpretación para influir en otros.
- Usa save cuando el personaje REACCIONA o RESISTE un peligro/efecto que ya le está ocurriendo: explosión, veneno, caída, miedo, derrumbe, trampa, etc. Las salvaciones usan skill=null.
- Conversar normalmente, preguntar algo, elegir entre caminos, caminar sin peligro, abrir una puerta normal, recoger un objeto visible o consultar información evidente NO requieren tirada. La ELECCIÓN no se tira; se tira el intento incierto que nace de ella.
- Tampoco tires si no existe ninguna consecuencia por fallar y el personaje puede repetir indefinidamente sin coste, riesgo ni presión.
- Interacciones sociales: no tires por decir "hola" o hacer una pregunta normal. Sí tira si el jugador intenta convencer a alguien que se resiste, mentir, intimidar, manipular, negociar algo importante, ocultar intenciones o conseguir una concesión incierta.
- Información oculta: si el jugador busca pistas, trampas, compartimentos, personas escondidas, mentiras o detalles que no son obvios, normalmente requiere Percepción, Investigación o Perspicacia.
- Sigilo/oposición: esconderse, infiltrarse, robar, seguir a alguien sin ser visto, escapar de vigilancia o realizar una maniobra contra oposición requieren tirada cuando exista posibilidad real de ser descubierto o impedido.
- Obstáculos y riesgo: forzar, romper, escalar, saltar, nadar, equilibrarse, perseguir, huir, conducir bajo peligro, desactivar, hackear, reparar o improvisar bajo presión requieren tirada cuando el resultado no sea seguro.
- DC orientativa SRD/5e: 5 muy fácil (normalmente ni tires), 10 fácil, 15 moderada, 20 difícil, 25 muy difícil, 30 casi imposible. Ajusta por contexto; evita DC arbitrarias para castigar al jugador.
- Ventaja/desventaja se usa por circunstancias claras del mundo, preparación, ayuda, posición, condiciones o herramientas; no para manipular el resultado deseado.
- skill debe corresponder a ability. Si ninguna habilidad aplica, usa skill=null con la característica correcta.
- Preguntas de estado como "¿qué llevo?", "¿qué tengo encima?", "¿dónde estoy?", "¿qué hora es?", "¿cómo estoy?" o consultas equivalentes NUNCA requieren check ni save: responde usando el estado recibido.
- Si solicitas check, detén la narración ANTES de saber si funciona: effects debe estar vacío y encounter debe ser null; las consecuencias mecánicas van en success/failure y la historia continuará después del resultado.
- Un fracaso no tiene por qué bloquear la aventura. Cuando sea apropiado, aplica fallo con consecuencia: pérdida de tiempo, ruido, sospecha, posición peor, recurso gastado, información incompleta, peligro nuevo o una complicación coherente.

COMBATE
- Solo crea encounter cuando la situación realmente inicia combate. Debe incluir al menos un enemy.
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
  const hostile=/\b(mato|matar|matand|asesin|apunal|acuchill|degoll|decapit|corto la cabeza|cortar la cabeza|le corto|lo corto|dispar|tiro a matar|golpeo|pego|ataco|embisto|estrangul|ahorc|rompo el cuello|atravies|clavo (?:la|el|mi)|hiero|herir)\b/i.test(action);
  const harmless=/\b(mato el tiempo|me mata de risa|muerto de risa)\b/i.test(action);
  return hostile && !harmless;
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

function isInformationalOrTrivialDeclaration(campaign) {
  const action=plainText(declaredAction(campaign)).trim();
  if (!action) return true;

  // Consultas de estado o acciones sin incertidumbre relevante.
  const informational=/^(?:que|qué|cual|cuál|cuanto|cuánto|donde|dónde|como|cómo|tengo|llevo|mi inventario|inventario|estado|hora)\b/.test(action)
    || /\b(que llevo|que tengo|donde estoy|que hora|como estoy|mi inventario|reviso (?:mi )?(?:inventario|mochila|equipo))\b/.test(action);
  if (informational) return true;

  const trivial=/\b(saludo|digo hola|me siento|me levanto|miro mi (?:mano|ropa|equipo)|camino hacia|voy hacia|entro por la puerta abierta|abro la puerta(?: normal)?|cierro la puerta|recojo|agarro|tomo el objeto visible|bebo agua|como |duermo|descanso)\b/.test(action);
  const pressure=/\b(rapido|rápido|antes de|sin que|a escondidas|sigilo|cerrad|bloquead|trabada|forzar|peligro|persec|mientras|bajo fuego|contra reloj|vigil|guardia|trampa|ocult|resiste|se niega)\b/.test(action);
  return trivial && !pressure;
}

function actionLikelyNeedsD20(campaign) {
  if (campaign?.combat || campaign?.pending) return false;
  const action=plainText(declaredAction(campaign)).trim();
  if (!action || isInformationalOrTrivialDeclaration(campaign) || isHostileDeclaration(campaign)) return false;

  // Acciones que en una mesa d20 normalmente se resuelven con prueba si existe oposición,
  // información oculta, peligro, presión o una consecuencia clara por fallar.
  const social=/\b(convenz|convenc|persuad|persuadir|mient|mentir|engañ|engan|intimid|amenaz|negoci|manipul|seduc|distraig|distraer|me hago pasar|finjo)\b/.test(action);
  const hidden=/\b(investig|busco (?:pistas|una pista|algo ocult|huellas|pruebas|trampas|un compartimento)|registro|examino|inspeccion|escucho|percib|detecto|rastre|sigo (?:sus|las|los) huellas|leo sus intenciones|averigu|descifro)\b/.test(action);
  const stealth=/\b(escond|sigilo|infiltr|me cuelo|robo|hurt|carter|sigo (?:a|al|la) .*sin|sin que me vean|sin ser visto|paso desapercib|escapo de la vigilancia)\b/.test(action);
  const physical=/\b(forz|romp|derrib|trep|escal|salto|saltar|nado|nadar|equilibr|cruzo .*pelig|corro para|persigo|huyo|huir|escapo|esquiv|maniobr|empujo|levanto .*pesad|aguanto|resisto)\b/.test(action);
  const technical=/\b(hack|pirate|desactiv|desarmo|reparo|reparar|improvis|manipulo (?:la|el) cerradura|ganzu|abro .*cerrad|descifro|program|sabote|falsific|oper[oa] .*bajo|conduzco|piloto)\b/.test(action);
  const uncertainty=/\b(intento|trato de|pruebo a|quiero lograr|a ver si|sin que|antes de que|bajo presion|bajo presión|contra reloj|arriesgo|dificil|difícil|peligro|ocult|cerrad|bloquead|vigil|resiste|opone)\b/.test(action);

  return social || hidden || stealth || physical || technical || uncertainty;
}

function combatPlayerActionLikelyNeedsD20(campaign) {
  if (!campaign?.combat || campaign?.pending) return false;
  const currentId=campaign.combat?.order?.[campaign.combat?.index]?.id;
  if (currentId!=="player") return false;
  const action=plainText(declaredAction(campaign)).trim();
  if (!action) return false;
  // Ataques normales deben resolverlos el motor de combate del cliente, no un ability check.
  if (/\b(dispar|ataco|golpeo|pego|apunal|acuchill|degoll|decapit|mato|matar|hiero|herir|embisto|estrangul|corto con|clavo)\b/.test(action)) return false;
  const social=/\b(convenz|convenc|persuad|mient|mentir|engan|intimid|amenaz|negoci|manipul|distraig|distraer|provoc|asust|hacer que se rinda|se rinda)\b/.test(action);
  const stealth=/\b(escond|sigilo|me ocult|paso desapercib|sin que me vean|sin ser visto|escabull)\b/.test(action);
  const physical=/\b(empujo|derrib|romp|trep|escal|salto|saltar|equilibr|maniobr|levanto .*pesad|tiro .*encima|arrojo .*encima|bloqueo .*puerta|forz)\b/.test(action);
  const technical=/\b(hack|desactiv|desarmo|reparo|improvis|manipulo|sabote|program|cierro .*mecan|abro .*mecan)\b/.test(action);
  const uncertainty=/\b(intento|trato de|pruebo a|a ver si|sin que|antes de que|bajo presion|contra reloj|arriesgo)\b/.test(action);
  return social || stealth || physical || technical || uncertainty;
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
    return "La acción declarada tiene incertidumbre, oposición, información oculta, riesgo o una consecuencia significativa por fallar. Debe resolverse con una prueba d20 antes de narrar el resultado.";
  }
  if (isInformationalOrTrivialDeclaration(campaign) && response.check) {
    return "La acción es informativa o trivial y no justifica una tirada. Resuélvela directamente sin check.";
  }

  const generic=genericInventoryItems(campaign);
  const opening=Number(campaign?.revision||0)<=1 && (Array.isArray(campaign?.messages)?campaign.messages.length:0)<=3;
  if (generic.length && (opening || isInventoryDeclaration(campaign))) {
    const renamed=new Set((response.effects||[]).filter(e=>e?.type==="item_rename").map(e=>e.target));
    const missing=generic.filter(i=>!renamed.has(i.id));
    if (missing.length) {
      return "El inventario todavía contiene nombres genéricos. Concreta todos esos objetos con item_rename antes de describir qué lleva el personaje: "+missing.map(i=>i.name).join(", ")+".";
    }
  }
  return "";
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
        return json({connected:true,model:"Llama 3.3 70B Fast · RASTHOR·IA Cloud",managed:true,canConnect:false,build:BUILD},200,origin);
      }
      return json({ok:true,service:"RASTHOR·IA Cloud DM",model:MODEL,build:BUILD},200,origin);
    }

    if (url.pathname === "/api/connection" && (request.method === "POST" || request.method === "DELETE")) {
      return json({connected:true,model:"Llama 3.3 70B Fast · RASTHOR·IA Cloud",managed:true,canConnect:false,build:BUILD},200,origin);
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
    const repairHint = clip(body?.repairHint, 700);

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
      ? "\n\nRESOLUCIÓN D20 OBLIGATORIA\nLa acción declarada contiene una incertidumbre significativa. Debes devolver check con la característica/habilidad, DC y ventaja/desventaja apropiadas. Narra solamente la preparación, intento o tensión previa; NO narres todavía si funcionó. El motor hará la tirada y después volverás a recibir el resultado para narrar la consecuencia."
      : "";

    const inventoryDirective = genericItems.length
      ? "\n\nINVENTARIO POR CONCRETAR\nEl estado aún contiene nombres mecánicos genéricos. Concrétalos según ESTE mundo y la historia ya establecida usando item_rename, sin cambiar estadísticas. Objetos: "+JSON.stringify(genericItems.map(i=>({id:i.id,catalog:i.catalog,name:i.name})))+". Si la historia ya ha establecido un equivalente concreto (por ejemplo una pistola), usa exactamente ese objeto. item_rename puede coexistir con check o encounter."
      : "";

    const repairDirective = repairHint
      ? `\n\nCORRECCIÓN DEL INTENTO ANTERIOR\nLa respuesta previa no encajó con el motor por este motivo: ${repairHint}. Corrige ese problema sin repetir el error ni cambiar hechos ya establecidos.`
      : "";

    const userPrompt = `ESTADO ACTUAL DE LA CAMPAÑA\n${JSON.stringify(compact)}\n\nDIRECTIVA DE ESCENA\n${sceneDirective}${hostilityDirective}${d20Directive}${inventoryDirective}${repairDirective}\n\nProcesa exclusivamente el siguiente turno respetando lastEvent, los resultados de dados ya presentes y el estado del motor. Devuelve solo el objeto JSON solicitado.`;

    try {
      let parsed = await runStructured(env,{
        messages:[
          {role:"system",content:SYSTEM},
          {role:"user",content:userPrompt},
        ],
        schema:RESPONSE_SCHEMA,
        max_tokens:isOpening?1250:1100,
        temperature:isOpening?0.66:0.58,
        top_p:0.91
      });
      let response = normalizeResponse(parsed,campaign);
      const semanticIssue = semanticProblem(response,campaign);
      if (semanticIssue) {
        console.warn("RASTHOR·IA semantic repair:",semanticIssue);
        const repairPrompt = userPrompt + `\n\nREPARACIÓN OBLIGATORIA\nLa respuesta anterior fue rechazada semánticamente: ${semanticIssue}\nGenera de nuevo el turno respetando el sistema d20. Si es una acción incierta no hostil, devuelve check y detén la narración antes de conocer el resultado. Si es un ataque contra alguien capaz de reaccionar y no hay combate, encounter DEBE contener al menos un adversario. Si la acción es trivial o meramente informativa, NO pidas tirada.`;
        parsed = await runStructured(env,{
          messages:[
            {role:"system",content:SYSTEM},
            {role:"user",content:repairPrompt},
          ],
          schema:RESPONSE_SCHEMA,
          max_tokens:1050,
          temperature:0.35,
          top_p:0.86
        });
        response = normalizeResponse(parsed,campaign);
        const secondIssue=semanticProblem(response,campaign);
        if(secondIssue) throw new Error("SEMANTIC_RULE_FAILURE: "+secondIssue);
      }
      return json({response,vault:response.privateMemory},200,origin);
    } catch (error) {
      console.error("RASTHOR·IA Workers AI error",error);
      return json({error:"El Director IA no pudo completar este turno. Tu acción sigue guardada: pulsa Continuar narración para reintentar."},503,origin);
    }
  }
};