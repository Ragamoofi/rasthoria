
(() => {
  if (window.__rasthoriaDiceRouletteV1) return;
  window.__rasthoriaDiceRouletteV1 = true;

  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STATES = new WeakMap();
  const observer = new MutationObserver(queueScan);
  let scanQueued = false;

  function sidesOf(el){
    const m = String(el.className || '').match(/(?:^|\s)die-d(\d+)(?:\s|$)/i);
    return m ? Number(m[1]) : 20;
  }
  function labelFor(sides){
    return sides === 100 ? 'D100' : `D${sides}`;
  }
  function collectOriginalValue(el){
    const span = [...el.children].find(ch => ch.tagName === 'SPAN');
    return span ? String(span.textContent || '').trim() : '';
  }
  function parseValue(raw){
    if (!raw) return null;
    const cleaned = String(raw).replace(/[^0-9-]/g,'');
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  function formattedValue(n){
    if (!Number.isFinite(n)) return '?';
    return String(n);
  }
  function randomFace(sides, avoid){
    const max = sides === 100 ? 100 : Math.max(2, sides);
    let n = Math.floor(Math.random()*max) + 1;
    if (max > 2 && Number.isFinite(avoid) && n === avoid) {
      n = (n % max) + 1;
    }
    return n;
  }

  function build(el){
    if (el.classList.contains('ras-roulette-ready')) return STATES.get(el);
    const ui = document.createElement('div');
    ui.className = 'ras-dice-ui';
    ui.innerHTML = `
      <div class="ras-dice-frame"></div>
      <div class="ras-dice-face"></div>
      <div class="ras-dice-inner"></div>
      <div class="ras-dice-ornament"></div>
      <div class="ras-dice-window">
        <div class="ras-dice-track">
          <div class="ras-dice-cell is-prev">?</div>
          <div class="ras-dice-cell is-next">?</div>
        </div>
      </div>
      <div class="ras-dice-flare"></div>
      <div class="ras-dice-caption"></div>
    `;
    el.appendChild(ui);
    el.classList.add('ras-roulette-ready');
    const state = {
      el,
      sides: sidesOf(el),
      caption: ui.querySelector('.ras-dice-caption'),
      track: ui.querySelector('.ras-dice-track'),
      prev: ui.querySelector('.ras-dice-cell.is-prev'),
      next: ui.querySelector('.ras-dice-cell.is-next'),
      current: null,
      rolling: false,
      finishing: false,
      tickTimer: 0,
      resetTimer: 0,
      stopTimers: [],
      scanVersion: 0,
    };
    state.caption.textContent = labelFor(state.sides);
    const initial = parseValue(collectOriginalValue(el));
    setStatic(state, Number.isFinite(initial) ? initial : 1);
    STATES.set(el, state);
    return state;
  }

  function clearTimers(state){
    clearTimeout(state.tickTimer);
    clearTimeout(state.resetTimer);
    state.stopTimers.forEach(t => clearTimeout(t));
    state.stopTimers = [];
  }

  function setStatic(state, num){
    const txt = formattedValue(num);
    state.current = Number.isFinite(num) ? num : state.current;
    state.prev.textContent = txt;
    state.next.textContent = txt;
    state.track.classList.remove('is-animating');
    state.track.style.transitionDuration = '0ms';
    state.track.style.transform = 'translateY(0)';
    decorateResult(state, num);
  }

  function decorateResult(state, value){
    const el = state.el;
    el.classList.remove('ras-result-min','ras-result-max','ras-result-highlight');
    if (!Number.isFinite(value)) return;
    if (value === 1) el.classList.add('ras-result-min');
    if (value === state.sides || (state.sides === 100 && value === 100)) el.classList.add('ras-result-max','ras-result-highlight');
  }

  function animateTo(state, num, duration){
    const txt = formattedValue(num);
    if (REDUCED) {
      setStatic(state, num);
      return;
    }
    clearTimeout(state.resetTimer);
    state.prev.textContent = formattedValue(Number.isFinite(state.current) ? state.current : num);
    state.next.textContent = txt;
    state.track.classList.remove('is-animating');
    state.track.style.transitionDuration = '0ms';
    state.track.style.transform = 'translateY(0)';
    // force reflow
    void state.track.offsetHeight;
    state.track.style.transitionDuration = `${duration}ms`;
    state.track.classList.add('is-animating');
    state.track.style.transform = 'translateY(-50%)';
    state.current = Number.isFinite(num) ? num : state.current;
    state.resetTimer = window.setTimeout(() => {
      state.track.classList.remove('is-animating');
      state.track.style.transitionDuration = '0ms';
      state.track.style.transform = 'translateY(0)';
      state.prev.textContent = txt;
      state.next.textContent = txt;
      decorateResult(state, num);
    }, duration + 24);
  }

  function rollingTick(state){
    if (!state.rolling) return;
    const nextNum = randomFace(state.sides, state.current);
    const duration = 72 + Math.floor(Math.random()*24);
    animateTo(state, nextNum, duration);
    state.tickTimer = window.setTimeout(() => rollingTick(state), duration + 22);
  }

  function startRolling(state){
    if (state.rolling) return;
    clearTimers(state);
    state.el.classList.add('ras-rolling');
    state.el.classList.remove('ras-result-min','ras-result-max','ras-result-highlight');
    state.rolling = true;
    state.finishing = false;
    if (!Number.isFinite(state.current)) setStatic(state, randomFace(state.sides));
    rollingTick(state);
  }

  function stopRolling(state, forcedValue){
    if (state.finishing) return;
    state.rolling = false;
    state.finishing = true;
    clearTimeout(state.tickTimer);
    const target = Number.isFinite(forcedValue) ? forcedValue : parseValue(collectOriginalValue(state.el)) || state.current || 1;
    const steps = REDUCED ? [target] : [
      randomFace(state.sides, state.current),
      randomFace(state.sides, target),
      randomFace(state.sides, target),
      randomFace(state.sides, target),
      target
    ];
    const delays = REDUCED ? [0] : [70, 95, 125, 170, 235];
    let acc = 0;
    steps.forEach((num, index) => {
      const dur = REDUCED ? 0 : Math.min(180, Math.max(70, delays[index]-12));
      const t = window.setTimeout(() => animateTo(state, num, dur), acc);
      state.stopTimers.push(t);
      acc += delays[index];
    });
    const finalTimer = window.setTimeout(() => {
      setStatic(state, target);
      state.el.classList.remove('ras-rolling');
      state.finishing = false;
    }, acc + 36);
    state.stopTimers.push(finalTimer);
  }

  function sync(el){
    const state = build(el);
    const newSides = sidesOf(el);
    if (newSides !== state.sides) {
      state.sides = newSides;
      state.caption.textContent = labelFor(newSides);
    }
    const rolling = el.classList.contains('is-rolling');
    const currentVal = parseValue(collectOriginalValue(el));
    if (rolling) {
      startRolling(state);
      return;
    }
    if (state.rolling || state.finishing) {
      stopRolling(state, currentVal);
      return;
    }
    if (Number.isFinite(currentVal) && currentVal !== state.current) {
      setStatic(state, currentVal);
    }
  }

  function scan(){
    document.querySelectorAll('.die-shape').forEach(sync);
  }
  function queueScan(){
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => {
      scanQueued = false;
      scan();
    });
  }

  if (document.body) {
    observer.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['class']});
    scan();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['class']});
      scan();
    }, {once:true});
  }

  window.addEventListener('pagehide', () => observer.disconnect(), {once:true});
})();
