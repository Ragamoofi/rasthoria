(() => {
  'use strict';

  if (window.__RASTHORIA_COMPANION__) return;
  window.__RASTHORIA_COMPANION__ = true;

  const APP_VERSION = '0.1.0';
  const STORAGE_KEY = 'rasthoria_companion_state_v1';
  const SIDES = [4, 6, 8, 10, 12, 20];
  const STAT_KEYS = ['FUE', 'DES', 'CON', 'INT', 'SAB', 'CAR'];

  const memory = {
    state: null,
    tab: 'ia',
    open: false,
    lastRoll: null,
    toastTimer: null,
    speaking: false
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function uid(prefix = 'id') {
    if (crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
    const bytes = new Uint32Array(3);
    crypto.getRandomValues(bytes);
    return `${prefix}_${Array.from(bytes).map(n => n.toString(36)).join('')}`;
  }

  function nowISO() { return new Date().toISOString(); }
  function clamp(n, min, max) { return Math.min(max, Math.max(min, Number(n) || 0)); }
  function safeText(value) { return String(value ?? '').trim(); }
  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function defaultCampaign(name = 'Nueva campaña') {
    return {
      id: uid('camp'),
      name,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      character: {
        name: 'Aventurero',
        ancestry: 'Humano',
        className: 'Sin clase',
        level: 1,
        hp: 10,
        maxHp: 10,
        ac: 10,
        xp: 0,
        money: 0,
        stats: { FUE: 10, DES: 10, CON: 10, INT: 10, SAB: 10, CAR: 10 },
        conditions: []
      },
      world: {
        premise: '',
        tone: 'Aventura seria, impredecible y con consecuencias',
        day: 1,
        minutes: 8 * 60,
        weather: '',
        location: '',
        notes: ''
      },
      inventory: [],
      journal: [],
      quests: [],
      npcs: [],
      locations: [],
      diceHistory: [],
      settings: {
        autoContext: true,
        voice: true,
        strictDice: true
      }
    };
  }

  function defaultState() {
    const campaign = defaultCampaign();
    return {
      version: 1,
      activeCampaignId: campaign.id,
      campaigns: [campaign]
    };
  }

  async function loadState() {
    try {
      const out = await chrome.storage.local.get(STORAGE_KEY);
      const saved = out?.[STORAGE_KEY];
      memory.state = saved && Array.isArray(saved.campaigns) ? saved : defaultState();
    } catch (err) {
      console.warn('[RASTHOR·IA] No se pudo leer chrome.storage.local', err);
      memory.state = defaultState();
    }
  }

  async function saveState() {
    const c = activeCampaign();
    if (c) c.updatedAt = nowISO();
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: memory.state });
    } catch (err) {
      console.warn('[RASTHOR·IA] No se pudo guardar', err);
      toast('No pude guardar la campaña.');
    }
  }

  function activeCampaign() {
    if (!memory.state) return null;
    let c = memory.state.campaigns.find(x => x.id === memory.state.activeCampaignId);
    if (!c) {
      c = memory.state.campaigns[0];
      if (c) memory.state.activeCampaignId = c.id;
    }
    return c || null;
  }

  function timeLabel(c = activeCampaign()) {
    if (!c) return 'Sin campaña';
    const total = Math.max(0, Math.round(c.world.minutes || 0));
    const h = String(Math.floor(total / 60) % 24).padStart(2, '0');
    const m = String(total % 60).padStart(2, '0');
    return `Día ${c.world.day} · ${h}:${m}`;
  }

  function addMinutes(amount) {
    const c = activeCampaign();
    if (!c) return;
    let next = Math.round((c.world.minutes || 0) + amount);
    while (next >= 1440) { next -= 1440; c.world.day += 1; }
    while (next < 0) { next += 1440; c.world.day = Math.max(1, c.world.day - 1); }
    c.world.minutes = next;
  }

  function cryptoRoll(sides) {
    sides = Number(sides);
    if (!Number.isInteger(sides) || sides < 2) throw new Error('Dado inválido');
    const max = 0x100000000;
    const limit = max - (max % sides);
    const buf = new Uint32Array(1);
    let n;
    do { crypto.getRandomValues(buf); n = buf[0]; } while (n >= limit);
    return (n % sides) + 1;
  }

  async function doRoll(sides) {
    const c = activeCampaign();
    if (!c) return;
    const mod = Number($('#ria-roll-mod')?.value || 0);
    const label = safeText($('#ria-roll-label')?.value) || 'Tirada';
    const value = cryptoRoll(sides);
    const roll = {
      id: uid('roll'),
      at: nowISO(),
      sides,
      value,
      modifier: Number.isFinite(mod) ? mod : 0,
      total: value + (Number.isFinite(mod) ? mod : 0),
      label
    };
    memory.lastRoll = roll;
    c.diceHistory.unshift(roll);
    c.diceHistory = c.diceHistory.slice(0, 50);
    await saveState();

    const die = $('#ria-die');
    if (die) {
      die.classList.remove('ria-rolling');
      void die.offsetWidth;
      die.classList.add('ria-rolling');
      const num = $('span', die);
      const type = $('em', die);
      if (num) num.textContent = '•';
      if (type) type.textContent = `D${sides}`;
      setTimeout(() => {
        if (num) num.textContent = String(value);
        renderRollSummary();
        renderDiceHistory();
      }, 650);
    }
  }

  function rollText(r = memory.lastRoll) {
    if (!r) return '';
    const mod = r.modifier === 0 ? '' : (r.modifier > 0 ? ` + ${r.modifier}` : ` - ${Math.abs(r.modifier)}`);
    return `${r.label}: D${r.sides} = ${r.value}${mod} → TOTAL ${r.total}`;
  }

  function renderRollSummary() {
    const node = $('#ria-roll-summary');
    if (node) node.textContent = memory.lastRoll ? rollText(memory.lastRoll) : 'Aún no hay una tirada activa.';
  }

  function renderDiceHistory() {
    const c = activeCampaign();
    const box = $('#ria-dice-history');
    if (!box || !c) return;
    box.innerHTML = c.diceHistory.length ? c.diceHistory.slice(0, 12).map(r => `
      <div class="ria-history-item">
        <b>D${r.sides}</b>
        <span>${esc(r.label)} · ${r.value}${r.modifier ? (r.modifier > 0 ? ` + ${r.modifier}` : ` - ${Math.abs(r.modifier)}`) : ''} = <strong>${r.total}</strong></span>
      </div>`).join('') : '<div class="ria-empty">Todavía no has lanzado dados.</div>';
  }

  function createRoot() {
    const root = document.createElement('div');
    root.id = 'rasthoria-root';
    root.innerHTML = `
      <button id="rasthoria-toggle" title="Abrir RASTHOR·IA Companion">R·IA</button>
      <aside id="rasthoria-panel" aria-label="RASTHOR·IA Companion">
        <div class="ria-head">
          <div class="ria-logo">R·IA</div>
          <div class="ria-title"><strong>RASTHOR·IA Companion</strong><span id="ria-campaign-caption">Mesa de rol local</span></div>
          <button class="ria-icon-btn" data-action="speak" title="Leer última respuesta">🔊</button>
          <button class="ria-icon-btn" data-action="close" title="Cerrar">✕</button>
        </div>
        <nav class="ria-tabs">
          <button class="ria-tab" data-tab="ficha">Ficha</button>
          <button class="ria-tab" data-tab="dados">Dados</button>
          <button class="ria-tab" data-tab="mundo">Mundo</button>
          <button class="ria-tab" data-tab="diario">Diario</button>
          <button class="ria-tab" data-tab="ia">IA</button>
        </nav>
        <main id="ria-body" class="ria-body"></main>
        <div class="ria-statusbar"><i class="ria-statusdot"></i><span>Local · sin API · guardado automático</span><span style="margin-left:auto">v${APP_VERSION}</span></div>
      </aside>
      <div id="ria-toast" class="ria-toast"></div>`;
    document.documentElement.appendChild(root);
    bindRootEvents(root);
  }

  function bindRootEvents(root) {
    root.addEventListener('click', async (e) => {
      const toggle = e.target.closest('#rasthoria-toggle');
      if (toggle) { openPanel(); return; }

      const tab = e.target.closest('[data-tab]');
      if (tab) { memory.tab = tab.dataset.tab; render(); return; }

      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      try {
        if (action === 'close') closePanel();
        else if (action === 'roll') await doRoll(Number(btn.dataset.sides));
        else if (action === 'new-campaign') await newCampaign();
        else if (action === 'delete-campaign') await deleteCampaign();
        else if (action === 'export') exportCampaign();
        else if (action === 'import-click') $('#ria-import-file')?.click();
        else if (action === 'insert-bootstrap') await insertIntoChat(buildBootstrapPrompt());
        else if (action === 'insert-turn') await insertTurn();
        else if (action === 'copy-turn') await copyText(buildTurnPacket(safeText($('#ria-player-action')?.value)));
        else if (action === 'import-response') await importLatestAssistant();
        else if (action === 'add-inventory') await addSimple('inventory');
        else if (action === 'add-journal') await addSimple('journal');
        else if (action === 'add-quest') await addQuest();
        else if (action === 'add-npc') await addNPC();
        else if (action === 'add-location') await addLocation();
        else if (action === 'remove-list') await removeListItem(btn.dataset.list, btn.dataset.id);
        else if (action === 'complete-quest') await completeQuest(btn.dataset.id);
        else if (action === 'speak') speakLatest();
        else if (action === 'stop-speech') stopSpeech();
        else if (action === 'clear-roll') { memory.lastRoll = null; render(); }
      } catch (err) {
        console.error('[RASTHOR·IA]', err);
        toast('Ocurrió un error en la acción.');
      }
    });

    root.addEventListener('change', async (e) => {
      const el = e.target;
      if (el.id === 'ria-campaign-select') {
        memory.state.activeCampaignId = el.value;
        memory.lastRoll = null;
        await saveState();
        render();
        return;
      }
      if (el.id === 'ria-import-file') {
        await importCampaignFile(el.files?.[0]);
        el.value = '';
        return;
      }
      const bind = el.dataset.bind;
      if (!bind) return;
      setBoundValue(bind, el.value, el.type === 'number');
      await saveState();
      updateCaption();
    });

    root.addEventListener('input', (e) => {
      const el = e.target;
      if (!el.dataset.liveBind) return;
      setBoundValue(el.dataset.liveBind, el.value, el.type === 'number');
      saveState();
    });
  }

  function setBoundValue(path, raw, numeric = false) {
    const c = activeCampaign();
    if (!c) return;
    const parts = path.split('.');
    let obj = c;
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    const key = parts.at(-1);
    const val = numeric ? Number(raw) : raw;
    if (path === 'character.hp') obj[key] = clamp(val, 0, c.character.maxHp || 999999);
    else if (path === 'character.maxHp') {
      obj[key] = Math.max(1, Number(val) || 1);
      c.character.hp = Math.min(c.character.hp, obj[key]);
    } else if (path.startsWith('character.stats.')) obj[key] = clamp(val, 1, 30);
    else if (numeric) obj[key] = Number.isFinite(val) ? val : 0;
    else obj[key] = val;
  }

  function openPanel() {
    memory.open = true;
    $('#rasthoria-panel')?.classList.add('ria-open');
    $('#rasthoria-toggle')?.classList.add('ria-hidden');
    render();
  }

  function closePanel() {
    memory.open = false;
    $('#rasthoria-panel')?.classList.remove('ria-open');
    $('#rasthoria-toggle')?.classList.remove('ria-hidden');
  }

  function updateCaption() {
    const c = activeCampaign();
    const node = $('#ria-campaign-caption');
    if (node) node.textContent = c ? `${c.name} · ${timeLabel(c)}` : 'Sin campaña';
  }

  function render() {
    const c = activeCampaign();
    updateCaption();
    $$('.ria-tab', $('#rasthoria-root')).forEach(t => t.classList.toggle('ria-active', t.dataset.tab === memory.tab));
    const body = $('#ria-body');
    if (!body || !c) return;
    if (memory.tab === 'ficha') body.innerHTML = viewCharacter(c);
    else if (memory.tab === 'dados') body.innerHTML = viewDice(c);
    else if (memory.tab === 'mundo') body.innerHTML = viewWorld(c);
    else if (memory.tab === 'diario') body.innerHTML = viewJournal(c);
    else body.innerHTML = viewAI(c);
  }

  function viewCharacter(c) {
    return `
      <section class="ria-view ria-active">
        <div class="ria-card">
          <h3>Personaje</h3>
          <div class="ria-grid-2">
            ${field('Nombre', 'character.name', c.character.name)}
            ${field('Nivel', 'character.level', c.character.level, 'number')}
            ${field('Linaje', 'character.ancestry', c.character.ancestry)}
            ${field('Clase', 'character.className', c.character.className)}
          </div>
          <div class="ria-divider"></div>
          <div class="ria-health">
            ${field('PV actuales', 'character.hp', c.character.hp, 'number')}
            <b>/</b>
            ${field('PV máximos', 'character.maxHp', c.character.maxHp, 'number')}
          </div>
          <div class="ria-grid-3" style="margin-top:8px">
            ${field('CA', 'character.ac', c.character.ac, 'number')}
            ${field('XP', 'character.xp', c.character.xp, 'number')}
            ${field('Dinero', 'character.money', c.character.money, 'number')}
          </div>
        </div>
        <div class="ria-card"><h3>Atributos</h3><div class="ria-grid-3">${STAT_KEYS.map(k => `<div class="ria-stat"><input type="number" value="${esc(c.character.stats[k])}" data-bind="character.stats.${k}"><small>${k}</small></div>`).join('')}</div></div>
        <div class="ria-card">
          <h3>Estados</h3>
          ${c.character.conditions.length ? `<div class="ria-btn-row">${c.character.conditions.map(x => `<span class="ria-pill">${esc(x)}</span>`).join('')}</div>` : '<div class="ria-empty">Sin condiciones activas.</div>'}
        </div>
        <div class="ria-card">
          <h3>Inventario</h3>
          <div class="ria-btn-row"><input id="ria-add-inventory" class="ria-input" placeholder="Ej: Antorcha x3" style="flex:1"><button class="ria-btn" data-action="add-inventory">Añadir</button></div>
          <div style="margin-top:8px">${listItems(c.inventory, 'inventory')}</div>
        </div>
      </section>`;
  }

  function viewDice(c) {
    const r = memory.lastRoll;
    return `
      <section class="ria-view ria-active">
        <div class="ria-dice-stage"><div id="ria-die" class="ria-die"><span>${r ? r.value : '20'}</span><em>${r ? `D${r.sides}` : 'D20'}</em></div></div>
        <div id="ria-roll-summary" class="ria-roll-summary">${esc(r ? rollText(r) : 'Elige un dado para lanzar.')}</div>
        <div class="ria-dice-buttons">${SIDES.map(s => `<button class="ria-btn" data-action="roll" data-sides="${s}">D${s}</button>`).join('')}</div>
        <div class="ria-card" style="margin-top:10px">
          <h3>Detalles de la tirada</h3>
          <div class="ria-grid-2">${rawField('Motivo', 'ria-roll-label', 'Ej: Percepción')}${rawField('Modificador', 'ria-roll-mod', '0', 'number')}</div>
          <div class="ria-mini" style="margin-top:8px">El azar usa <code>crypto.getRandomValues</code> del navegador. ChatGPT no decide el resultado.</div>
          ${r ? '<div class="ria-btn-row" style="margin-top:8px"><button class="ria-btn ghost" data-action="clear-roll">Descartar tirada activa</button></div>' : ''}
        </div>
        <div class="ria-card"><h3>Historial</h3><div id="ria-dice-history" class="ria-history">${c.diceHistory.length ? c.diceHistory.slice(0, 12).map(rr => `<div class="ria-history-item"><b>D${rr.sides}</b><span>${esc(rr.label)} · ${rr.value}${rr.modifier ? (rr.modifier > 0 ? ` + ${rr.modifier}` : ` - ${Math.abs(rr.modifier)}`) : ''} = <strong>${rr.total}</strong></span></div>`).join('') : '<div class="ria-empty">Todavía no has lanzado dados.</div>'}</div></div>
      </section>`;
  }

  function viewWorld(c) {
    return `
      <section class="ria-view ria-active">
        <div class="ria-card">
          <h3>Mundo actual</h3>
          ${area('Premisa / mundo', 'world.premise', c.world.premise, 'Describe de qué trata la campaña...')}
          <div class="ria-grid-2" style="margin-top:8px">${field('Ubicación actual', 'world.location', c.world.location)}${field('Clima / ambiente', 'world.weather', c.world.weather)}</div>
          <div style="margin-top:8px">${field('Tono', 'world.tone', c.world.tone)}</div>
          <div style="margin-top:8px">${area('Notas del mundo', 'world.notes', c.world.notes, 'Facciones, reglas, conflictos, secretos conocidos...')}</div>
          <div class="ria-callout" style="margin-top:9px">${esc(timeLabel(c))}. El Dungeon Master puede avanzar este reloj mediante el bloque de estado.</div>
        </div>
        <div class="ria-card"><h3>Lugares descubiertos</h3><div class="ria-grid-2">${rawField('Lugar', 'ria-location-name', 'Nombre')}${rawField('Detalle', 'ria-location-note', 'Descripción breve')}</div><button class="ria-btn" data-action="add-location" style="margin-top:8px">Añadir lugar</button><div style="margin-top:8px">${complexItems(c.locations, 'locations')}</div></div>
        <div class="ria-card"><h3>NPC conocidos</h3><div class="ria-grid-2">${rawField('NPC', 'ria-npc-name', 'Nombre')}${rawField('Detalle', 'ria-npc-note', 'Relación, pista, actitud...')}</div><button class="ria-btn" data-action="add-npc" style="margin-top:8px">Añadir NPC</button><div style="margin-top:8px">${complexItems(c.npcs, 'npcs')}</div></div>
      </section>`;
  }

  function viewJournal(c) {
    const openQ = c.quests.filter(q => !q.done);
    const doneQ = c.quests.filter(q => q.done);
    return `
      <section class="ria-view ria-active">
        <div class="ria-card"><h3>Misiones activas</h3><div class="ria-btn-row"><input id="ria-add-quest" class="ria-input" placeholder="Nueva misión" style="flex:1"><button class="ria-btn" data-action="add-quest">Añadir</button></div><div style="margin-top:8px">${openQ.length ? openQ.map(q => `<div class="ria-list-item"><span>${esc(q.text)}</span><button class="ria-icon-btn" data-action="complete-quest" data-id="${q.id}" title="Completar">✓</button><button class="ria-icon-btn" data-action="remove-list" data-list="quests" data-id="${q.id}" title="Eliminar">×</button></div>`).join('') : '<div class="ria-empty">No hay misiones activas.</div>'}</div>${doneQ.length ? `<div class="ria-divider"></div><div class="ria-mini">Completadas</div><div style="margin-top:6px">${doneQ.slice(0,8).map(q => `<div class="ria-list-item"><span><s>${esc(q.text)}</s></span></div>`).join('')}</div>` : ''}</div>
        <div class="ria-card"><h3>Diario de campaña</h3><textarea id="ria-add-journal" class="ria-textarea" placeholder="Añade una nota manual..."></textarea><button class="ria-btn" data-action="add-journal" style="margin-top:7px">Guardar nota</button><div style="margin-top:8px">${c.journal.length ? c.journal.slice(0,40).map(j => `<div class="ria-list-item"><span>${esc(j.text)}<div class="ria-mini" style="margin-top:4px">${esc(j.when || '')}</div></span><button class="ria-icon-btn" data-action="remove-list" data-list="journal" data-id="${j.id}" title="Eliminar">×</button></div>`).join('') : '<div class="ria-empty">El diario está vacío.</div>'}</div></div>
      </section>`;
  }

  function viewAI(c) {
    const opts = memory.state.campaigns.map(x => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
    return `
      <section class="ria-view ria-active">
        <div class="ria-card">
          <h3>Campaña</h3>
          <select id="ria-campaign-select" class="ria-select">${opts}</select>
          <div class="ria-grid-2" style="margin-top:8px">${field('Nombre de campaña', 'name', c.name)}${field('Nombre del héroe', 'character.name', c.character.name)}</div>
          <div class="ria-btn-row" style="margin-top:8px"><button class="ria-btn" data-action="new-campaign">Nueva</button><button class="ria-btn" data-action="export">Exportar</button><button class="ria-btn" data-action="import-click">Importar</button>${memory.state.campaigns.length > 1 ? '<button class="ria-btn danger" data-action="delete-campaign">Eliminar</button>' : ''}</div>
          <input id="ria-import-file" type="file" accept="application/json,.json" hidden>
        </div>
        <div class="ria-card">
          <h3>1 · Preparar Dungeon Master</h3>
          <div class="ria-callout">Haz esto al comenzar un chat/campaña nueva. El mensaje explica al Dungeon Master cómo usar los dados y cómo devolver cambios de estado sin necesitar API.</div>
          <button class="ria-btn cyan" data-action="insert-bootstrap" style="margin-top:9px;width:100%">Preparar mensaje de inicio en ChatGPT</button>
        </div>
        <div class="ria-card">
          <h3>2 · Jugar turno</h3>
          <textarea id="ria-player-action" class="ria-textarea" placeholder="Ej: Me acerco a la puerta y escucho antes de abrirla."></textarea>
          ${memory.lastRoll ? `<div class="ria-callout" style="margin-top:8px">Tirada adjunta: ${esc(rollText(memory.lastRoll))}</div>` : '<div class="ria-mini" style="margin-top:7px">Si el DM pidió una tirada, lánzala primero en Dados. Si no pidió ninguna, escribe tu acción normalmente.</div>'}
          <div class="ria-btn-row" style="margin-top:9px"><button class="ria-btn primary" data-action="insert-turn">Preparar turno en ChatGPT</button><button class="ria-btn" data-action="copy-turn">Copiar turno</button></div>
        </div>
        <div class="ria-card">
          <h3>3 · Sincronizar respuesta</h3>
          <div class="ria-mini">Después de recibir la respuesta del Dungeon Master, importa la última respuesta para registrar la narración y aplicar los cambios del bloque RASTHOR·IA.</div>
          <div class="ria-btn-row" style="margin-top:9px"><button class="ria-btn" data-action="import-response">Importar última respuesta</button><button class="ria-btn ghost" data-action="speak">🔊 Narrar</button><button class="ria-btn ghost" data-action="stop-speech">■ Parar voz</button></div>
        </div>
        <div class="ria-card"><h3>Estado compacto que recibe el DM</h3><div class="ria-mini" style="white-space:pre-wrap;line-height:1.5">${esc(compactContext(c))}</div></div>
      </section>`;
  }

  function field(label, path, value, type = 'text') {
    return `<div class="ria-field"><label>${esc(label)}</label><input class="ria-input" type="${type}" value="${esc(value)}" data-bind="${esc(path)}"></div>`;
  }
  function area(label, path, value, placeholder = '') {
    return `<div class="ria-field"><label>${esc(label)}</label><textarea class="ria-textarea" data-bind="${esc(path)}" placeholder="${esc(placeholder)}">${esc(value)}</textarea></div>`;
  }
  function rawField(label, id, placeholder = '', type = 'text') {
    return `<div class="ria-field"><label>${esc(label)}</label><input id="${id}" class="ria-input" type="${type}" placeholder="${esc(placeholder)}"></div>`;
  }
  function listItems(items, listName) {
    return items.length ? items.map(x => `<div class="ria-list-item"><span>${esc(typeof x === 'string' ? x : x.text)}</span><button class="ria-icon-btn" data-action="remove-list" data-list="${listName}" data-id="${typeof x === 'string' ? esc(x) : x.id}">×</button></div>`).join('') : '<div class="ria-empty">Vacío.</div>';
  }
  function complexItems(items, listName) {
    return items.length ? items.map(x => `<div class="ria-list-item"><span><strong>${esc(x.name)}</strong>${x.note ? `<div class="ria-mini" style="margin-top:3px">${esc(x.note)}</div>` : ''}</span><button class="ria-icon-btn" data-action="remove-list" data-list="${listName}" data-id="${x.id}">×</button></div>`).join('') : '<div class="ria-empty">Aún no hay registros.</div>';
  }

  async function newCampaign() {
    const name = prompt('Nombre de la nueva campaña:', 'Nueva campaña');
    if (name === null) return;
    const c = defaultCampaign(safeText(name) || 'Nueva campaña');
    memory.state.campaigns.push(c);
    memory.state.activeCampaignId = c.id;
    memory.lastRoll = null;
    await saveState();
    memory.tab = 'ia';
    render();
    toast('Campaña creada.');
  }

  async function deleteCampaign() {
    const c = activeCampaign();
    if (!c || memory.state.campaigns.length <= 1) return;
    if (!confirm(`¿Eliminar la campaña “${c.name}”? Esta acción no se puede deshacer salvo que tengas un JSON exportado.`)) return;
    memory.state.campaigns = memory.state.campaigns.filter(x => x.id !== c.id);
    memory.state.activeCampaignId = memory.state.campaigns[0].id;
    memory.lastRoll = null;
    await saveState();
    render();
  }

  async function addSimple(kind) {
    const c = activeCampaign();
    const el = kind === 'inventory' ? $('#ria-add-inventory') : $('#ria-add-journal');
    const text = safeText(el?.value);
    if (!c || !text) return;
    if (kind === 'inventory') c.inventory.unshift({ id: uid('item'), text });
    else c.journal.unshift({ id: uid('note'), text, when: timeLabel(c) });
    await saveState();
    render();
  }

  async function addQuest() {
    const c = activeCampaign();
    const text = safeText($('#ria-add-quest')?.value);
    if (!c || !text) return;
    c.quests.unshift({ id: uid('quest'), text, done: false });
    await saveState();
    render();
  }

  async function addNPC() {
    const c = activeCampaign();
    const name = safeText($('#ria-npc-name')?.value), note = safeText($('#ria-npc-note')?.value);
    if (!c || !name) return;
    upsertNamed(c.npcs, name, note, 'npc');
    await saveState(); render();
  }

  async function addLocation() {
    const c = activeCampaign();
    const name = safeText($('#ria-location-name')?.value), note = safeText($('#ria-location-note')?.value);
    if (!c || !name) return;
    upsertNamed(c.locations, name, note, 'loc');
    await saveState(); render();
  }

  function upsertNamed(list, name, note, prefix) {
    const found = list.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (found) { if (note) found.note = note; }
    else list.unshift({ id: uid(prefix), name, note });
  }

  async function completeQuest(id) {
    const q = activeCampaign()?.quests.find(x => x.id === id);
    if (!q) return;
    q.done = true;
    await saveState(); render();
  }

  async function removeListItem(listName, id) {
    const c = activeCampaign();
    if (!c || !Array.isArray(c[listName])) return;
    c[listName] = c[listName].filter(x => (typeof x === 'string' ? x : x.id) !== id);
    await saveState(); render();
  }

  function compactContext(c) {
    const stats = STAT_KEYS.map(k => `${k} ${c.character.stats[k]}`).join(', ');
    const inv = c.inventory.slice(0, 18).map(x => x.text).join('; ') || 'vacío';
    const quests = c.quests.filter(q => !q.done).slice(0, 10).map(q => q.text).join('; ') || 'ninguna';
    const npcs = c.npcs.slice(0, 12).map(n => `${n.name}${n.note ? ` (${n.note})` : ''}`).join('; ') || 'ninguno';
    const locs = c.locations.slice(0, 10).map(l => `${l.name}${l.note ? ` (${l.note})` : ''}`).join('; ') || 'ninguno';
    const conditions = c.character.conditions.join(', ') || 'ninguno';
    return [
      `CAMPAÑA: ${c.name}`,
      `PERSONAJE: ${c.character.name}, ${c.character.ancestry}, ${c.character.className}, nivel ${c.character.level}`,
      `PV ${c.character.hp}/${c.character.maxHp} | CA ${c.character.ac} | XP ${c.character.xp} | Dinero ${c.character.money}`,
      `ATRIBUTOS: ${stats}`,
      `ESTADOS: ${conditions}`,
      `TIEMPO: ${timeLabel(c)} | Lugar actual: ${c.world.location || 'no fijado'} | Clima: ${c.world.weather || 'no fijado'}`,
      `PREMISA: ${c.world.premise || 'sin definir'}`,
      `TONO: ${c.world.tone}`,
      `INVENTARIO: ${inv}`,
      `MISIONES ACTIVAS: ${quests}`,
      `NPC RELEVANTES: ${npcs}`,
      `LUGARES CONOCIDOS: ${locs}`,
      c.world.notes ? `NOTAS DEL MUNDO: ${c.world.notes}` : ''
    ].filter(Boolean).join('\n');
  }

  function buildBootstrapPrompt() {
    const c = activeCampaign();
    if (!c) return '';
    return `Quiero jugar esta campaña usando RASTHOR·IA Companion como mesa de rol local. Tú eres el Dungeon Master.\n\nREGLAS DEL DM\n- Narra de forma dinámica, coherente e impredecible. No escribas una historia lineal predeterminada.\n- Mis decisiones deben cambiar el mundo, los NPC, las misiones y las consecuencias.\n- No decidas por mi personaje qué hace, piensa o siente.\n- Cuando una acción tenga incertidumbre importante, PIDE una tirada concreta (por ejemplo: “Tirada solicitada: Percepción, D20 + SAB”) y detén la resolución hasta que yo te entregue el resultado.\n- NUNCA inventes ni reemplaces una tirada que yo te entregue. Los dados los genera localmente RASTHOR·IA Companion.\n- Permite fracaso, lesiones, pérdida de recursos, enemigos que actúen con criterio y muerte si corresponde al mundo y a las decisiones.\n- Mantén continuidad con el estado suministrado en cada turno.\n- No necesito menús cerrados de 3 opciones: puedo intentar cualquier acción razonable. Puedes sugerir posibilidades, pero siempre puedo escribir otra cosa.\n\nPROTOCOLO RASTHOR·IA\nCuando tu respuesta cambie datos mecánicos o persistentes, añade AL FINAL un bloque de texto. No lo pongas en código Markdown. Usa solo las líneas necesarias:\n[RASTHORIA]\nhp:-4                 (también hp:+3 o hp:=12)\nxp:+50\ndinero:-10\nhora:+10min           (también +2h)\ndia:+1\ninventario:+Nombre del objeto\ninventario:-Nombre del objeto\nestado:+Envenenado\nestado:-Envenenado\ndiario:+Hecho importante para recordar\nmision:+Texto de una misión nueva\nmision_completar:Texto o parte distintiva de la misión\nnpc:+Nombre|Descripción/relación actualizada\nlugar:+Nombre|Descripción breve\n[/RASTHORIA]\nNo incluyas una línea si nada cambió. El bloque es para la herramienta; la narración principal debe seguir siendo natural.\n\nESTADO INICIAL\n${compactContext(c)}\n\nComienza presentando la situación inicial de la campaña. Si la premisa aún está vacía, antes de iniciar pregúntame qué clase de mundo o aventura quiero, o proponme una aventura completamente aleatoria si te lo pido.`;
  }

  function buildTurnPacket(action) {
    const c = activeCampaign();
    if (!c) return '';
    const cleanAction = action || '(No se escribió una acción; pregunta qué quiero hacer.)';
    const recent = c.journal.slice(0, 6).map(x => `- ${x.text}`).join('\n') || '- Sin entradas recientes.';
    const roll = memory.lastRoll ? `\nTIRADA LOCAL VALIDADA\n${rollText(memory.lastRoll)}\nEste resultado es definitivo: no vuelvas a tirar por mí ni lo sustituyas.` : '';
    return `[TURNO RASTHOR·IA]\n${compactContext(c)}\n\nRECUERDOS RECIENTES\n${recent}${roll}\n\nACCIÓN DEL JUGADOR\n${cleanAction}\n\nContinúa como Dungeon Master. Si esta acción requiere una tirada que todavía no está incluida, solicita la tirada y no resuelvas su resultado aún. Si cambian datos persistentes, usa al final el bloque [RASTHORIA] según el protocolo de esta campaña.`;
  }

  async function insertTurn() {
    const action = safeText($('#ria-player-action')?.value);
    const packet = buildTurnPacket(action);
    const ok = await insertIntoChat(packet);
    if (ok && memory.lastRoll) {
      memory.lastRoll = null;
      render();
    }
  }

  function findComposer() {
    const selectors = [
      '#prompt-textarea',
      'textarea[data-id="root"]',
      'main textarea',
      'div[contenteditable="true"][data-virtualkeyboard="true"]',
      'main div[contenteditable="true"]'
    ];
    for (const sel of selectors) {
      const nodes = $$(sel).filter(el => el.offsetParent !== null && !el.closest('#rasthoria-root'));
      if (nodes.length) return nodes.at(-1);
    }
    return null;
  }

  async function insertIntoChat(text) {
    const composer = findComposer();
    if (!composer) {
      await copyText(text);
      toast('No encontré el cuadro de ChatGPT. Dejé el turno copiado.');
      return false;
    }
    composer.focus();
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      const proto = composer instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(composer, text);
      composer.dispatchEvent(new Event('input', { bubbles: true }));
      composer.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      try {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(composer);
        sel.removeAllRanges(); sel.addRange(range);
        document.execCommand('insertText', false, text);
      } catch {
        composer.textContent = text;
      }
      composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }
    toast('Turno preparado. Revísalo y pulsa Enviar cuando quieras.');
    return true;
  }

  function latestAssistantText() {
    const selectors = [
      '[data-message-author-role="assistant"]',
      'article[data-testid^="conversation-turn-"] [data-message-author-role="assistant"]',
      'main .agent-turn'
    ];
    let nodes = [];
    for (const sel of selectors) {
      nodes = $$(sel).filter(el => !el.closest('#rasthoria-root'));
      if (nodes.length) break;
    }
    const node = nodes.at(-1);
    return safeText(node?.innerText || node?.textContent);
  }

  async function importLatestAssistant() {
    const c = activeCampaign();
    const text = latestAssistantText();
    if (!c || !text) { toast('No encontré una respuesta reciente de ChatGPT.'); return; }
    const blockMatches = [...text.matchAll(/\[RASTHORIA\]([\s\S]*?)\[\/RASTHORIA\]/gi)];
    const narrative = safeText(text.replace(/\[RASTHORIA\][\s\S]*?\[\/RASTHORIA\]/gi, ''));
    if (narrative) {
      const fingerprint = narrative.slice(0, 180);
      const duplicate = c.journal.some(j => j.source === 'assistant' && j.fingerprint === fingerprint);
      if (!duplicate) c.journal.unshift({ id: uid('note'), text: narrative.slice(0, 1400), when: timeLabel(c), source: 'assistant', fingerprint });
    }
    let changes = 0;
    for (const m of blockMatches) changes += applyDirectiveBlock(m[1]);
    await saveState();
    render();
    toast(blockMatches.length ? `Respuesta importada · ${changes} cambio(s) aplicado(s).` : 'Narración guardada. No venía bloque de estado.');
  }

  function applyDirectiveBlock(block) {
    const c = activeCampaign();
    if (!c) return 0;
    let changes = 0;
    const lines = block.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    for (const line of lines) {
      const idx = line.indexOf(':');
      if (idx < 1) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const val = line.slice(idx + 1).trim();
      if (!val) continue;
      try {
        if (key === 'hp') {
          if (val.startsWith('=')) c.character.hp = clamp(Number(val.slice(1)), 0, c.character.maxHp);
          else c.character.hp = clamp(c.character.hp + Number(val), 0, c.character.maxHp);
          changes++;
        } else if (key === 'xp') { c.character.xp = Math.max(0, c.character.xp + Number(val)); changes++; }
        else if (key === 'dinero') { c.character.money += Number(val); changes++; }
        else if (key === 'dia') { c.world.day = Math.max(1, c.world.day + Number(val)); changes++; }
        else if (key === 'hora') {
          const hm = val.match(/^([+-]?\d+(?:\.\d+)?)\s*(min|m|h|hora|horas)$/i);
          if (hm) { addMinutes(Number(hm[1]) * (/^h|hora/i.test(hm[2]) ? 60 : 1)); changes++; }
        } else if (key === 'inventario') {
          const op = val[0], item = safeText(val.slice(1));
          if (op === '+' && item) { c.inventory.unshift({ id: uid('item'), text: item }); changes++; }
          else if (op === '-' && item) {
            const i = c.inventory.findIndex(x => x.text.toLowerCase().includes(item.toLowerCase()));
            if (i >= 0) { c.inventory.splice(i, 1); changes++; }
          }
        } else if (key === 'estado') {
          const op = val[0], condition = safeText(val.slice(1));
          if (op === '+' && condition && !c.character.conditions.some(x => x.toLowerCase() === condition.toLowerCase())) { c.character.conditions.push(condition); changes++; }
          else if (op === '-' && condition) { const before = c.character.conditions.length; c.character.conditions = c.character.conditions.filter(x => x.toLowerCase() !== condition.toLowerCase()); if (before !== c.character.conditions.length) changes++; }
        } else if (key === 'diario') { c.journal.unshift({ id: uid('note'), text: val.replace(/^\+/, '').trim(), when: timeLabel(c), source: 'protocol' }); changes++; }
        else if (key === 'mision') { c.quests.unshift({ id: uid('quest'), text: val.replace(/^\+/, '').trim(), done: false }); changes++; }
        else if (key === 'mision_completar') {
          const needle = val.replace(/^\+/, '').trim().toLowerCase();
          const q = c.quests.find(x => !x.done && x.text.toLowerCase().includes(needle));
          if (q) { q.done = true; changes++; }
        } else if (key === 'npc' || key === 'lugar') {
          const body = val.replace(/^\+/, '').trim();
          const [name, ...rest] = body.split('|');
          const note = rest.join('|').trim();
          if (safeText(name)) { upsertNamed(key === 'npc' ? c.npcs : c.locations, safeText(name), note, key === 'npc' ? 'npc' : 'loc'); changes++; }
        }
      } catch (err) {
        console.warn('[RASTHOR·IA] Directiva ignorada:', line, err);
      }
    }
    return changes;
  }

  function speakLatest() {
    const text = latestAssistantText().replace(/\[RASTHORIA\][\s\S]*?\[\/RASTHORIA\]/gi, '').trim();
    if (!text) { toast('No encontré una respuesta para narrar.'); return; }
    if (!('speechSynthesis' in window)) { toast('Este navegador no ofrece narración por voz.'); return; }
    stopSpeech();
    const utter = new SpeechSynthesisUtterance(text.slice(0, 5000));
    const voices = speechSynthesis.getVoices();
    utter.voice = voices.find(v => /es-CL/i.test(v.lang)) || voices.find(v => /^es/i.test(v.lang)) || null;
    utter.lang = utter.voice?.lang || 'es-CL';
    utter.rate = 0.97;
    utter.pitch = 0.94;
    utter.onend = () => { memory.speaking = false; };
    memory.speaking = true;
    speechSynthesis.speak(utter);
    toast('Narrando la última respuesta.');
  }

  function stopSpeech() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    memory.speaking = false;
  }

  function exportCampaign() {
    const c = activeCampaign();
    if (!c) return;
    const payload = JSON.stringify({ format: 'rasthoria-companion', version: 1, exportedAt: nowISO(), campaign: c }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${c.name.replace(/[^a-z0-9áéíóúñ_-]+/gi, '_') || 'campana'}_rasthoria.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Campaña exportada.');
  }

  async function importCampaignFile(file) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const c = data?.campaign || data;
      if (!c || !c.character || !c.world) throw new Error('Formato inválido');
      c.id = uid('camp');
      c.name = `${safeText(c.name) || 'Campaña importada'} (importada)`;
      c.updatedAt = nowISO();
      c.diceHistory = Array.isArray(c.diceHistory) ? c.diceHistory : [];
      c.inventory = Array.isArray(c.inventory) ? c.inventory : [];
      c.journal = Array.isArray(c.journal) ? c.journal : [];
      c.quests = Array.isArray(c.quests) ? c.quests : [];
      c.npcs = Array.isArray(c.npcs) ? c.npcs : [];
      c.locations = Array.isArray(c.locations) ? c.locations : [];
      memory.state.campaigns.push(c);
      memory.state.activeCampaignId = c.id;
      await saveState();
      render();
      toast('Campaña importada.');
    } catch (err) {
      console.warn(err);
      toast('El archivo no parece una campaña válida de RASTHOR·IA.');
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copiado al portapapeles.');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      toast('Copiado al portapapeles.');
    }
  }

  function toast(message) {
    const node = $('#ria-toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(memory.toastTimer);
    memory.toastTimer = setTimeout(() => node.classList.remove('show'), 2600);
  }

  async function boot() {
    await loadState();
    createRoot();
    render();
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.shiftKey && e.code === 'KeyR') {
        e.preventDefault();
        memory.open ? closePanel() : openPanel();
      }
      if (e.key === 'Escape' && memory.open) closePanel();
    });
  }

  boot();
})();
