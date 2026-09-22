import * as THREE from "./vendor/three-0.160.1.min.js";

const SUPPORTED = new Set([4,6,8,10,12,20,100]);
const instances = new Map();
const reduceMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
let reduceMotion = reduceMotionQuery.matches;
let raf = 0;
let lastFrame = 0;
let scanQueued = false;

const visibilityObserver = "IntersectionObserver" in window
  ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        const inst = instances.get(entry.target);
        if (inst) {
          inst.visible = entry.isIntersecting;
          if (inst.visible) {
            inst.dirty = true;
            requestTick();
          }
        }
      }
    }, { rootMargin: "160px" })
  : null;

function sideCount(el) {
  const m = String(el.className || "").match(/(?:^|\s)die-d(\d+)(?:\s|$)/);
  return m ? Number(m[1]) : 20;
}

function directValue(el) {
  for (const child of el.children) {
    if (child.tagName === "SPAN") return child.textContent?.trim() || "?";
  }
  return "?";
}

function advantageMode(el) {
  if (sideCount(el) !== 20) return "normal";
  const pending = el.closest(".pending-roll");
  const note = pending?.querySelector(".roll-advantage-note")?.textContent || "";
  if (/desventaja/i.test(note)) return "disadvantage";
  if (/ventaja/i.test(note)) return "advantage";

  if (el.closest(".rolling-overlay")) {
    const globalNote = document.querySelector(".pending-roll .roll-advantage-note")?.textContent || "";
    if (/desventaja/i.test(globalNote)) return "disadvantage";
    if (/ventaja/i.test(globalNote)) return "advantage";
  }

  const panel = el.closest(".dice-panel");
  if (panel) {
    const labels = [...panel.querySelectorAll("button,[role=combobox]")].map(n => n.textContent || "").join(" ");
    if (/desventaja/i.test(labels)) return "disadvantage";
    if (/ventaja/i.test(labels)) return "advantage";
  }
  return "normal";
}

function makeD10Geometry() {
  const radius = 0.96;
  const yTop = 1.08;
  const yBottom = -1.08;
  const ringY = 0.18;
  const vertices = [0,yTop,0, 0,yBottom,0];
  for (let i=0;i<10;i++) {
    const a = Math.PI * 2 * i / 10;
    const y = i % 2 === 0 ? ringY : -ringY;
    vertices.push(Math.cos(a)*radius, y, Math.sin(a)*radius);
  }
  const indices = [];
  for (let i=0;i<10;i++) {
    const a = 2+i;
    const b = 2+((i+1)%10);
    if (i % 2 === 0) {
      indices.push(0,a,b);
      indices.push(1,b,a);
    } else {
      indices.push(0,b,a);
      indices.push(1,a,b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(vertices,3));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function geometryFor(sides) {
  switch (sides === 100 ? 10 : sides) {
    case 4: return new THREE.TetrahedronGeometry(1.18,0);
    case 6: return new THREE.BoxGeometry(1.48,1.48,1.48);
    case 8: return new THREE.OctahedronGeometry(1.16,0);
    case 10: return makeD10Geometry();
    case 12: return new THREE.DodecahedronGeometry(1.08,0);
    case 20: return new THREE.IcosahedronGeometry(1.14,0);
    default: return new THREE.IcosahedronGeometry(1.14,0);
  }
}

function stableQuaternion(sides, value, offset=0) {
  const parsed = Number(String(value).replace(/[^0-9.-]/g,""));
  const n = Number.isFinite(parsed) ? parsed : sides;
  const seed = (Math.abs(n)*9301 + sides*49297 + offset*233 + 17) % 233280;
  const a = (seed / 233280) * Math.PI * 2;
  const b = (((seed*37)%233280) / 233280) * Math.PI * 2;
  const c = (((seed*97)%233280) / 233280) * Math.PI * 2;
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(a,b,c,"XYZ"));
}

function randomSpin(mult=1) {
  return {
    x:(4.7 + Math.random()*3.2) * (Math.random()>.5?1:-1) * mult,
    y:(5.6 + Math.random()*4.0) * (Math.random()>.5?1:-1) * mult,
    z:(3.9 + Math.random()*3.0) * (Math.random()>.5?1:-1) * mult
  };
}

function buildVisual(inst) {
  const sides = inst.sides;
  inst.geometry?.dispose();
  inst.edgeGeometry?.dispose();
  inst.material?.dispose();
  inst.edgeMaterial?.dispose();

  inst.geometry = geometryFor(sides);
  inst.edgeGeometry = new THREE.EdgesGeometry(inst.geometry, sides===6 ? 10 : 18);
  inst.material = new THREE.MeshPhysicalMaterial({
    color: 0x5e432e,
    roughness: .31,
    metalness: .62,
    clearcoat: .48,
    clearcoatRoughness: .22,
    flatShading: true,
    emissive: 0x160d08,
    emissiveIntensity: .3
  });
  inst.edgeMaterial = new THREE.LineBasicMaterial({
    color: 0xd0a86d,
    transparent: true,
    opacity: .72
  });

  for (const child of [...inst.diceRoot.children]) inst.diceRoot.remove(child);
  inst.dieA = createMeshGroup(inst);
  inst.dieB = createMeshGroup(inst);
  inst.diceRoot.add(inst.dieA,inst.dieB);
  inst.spinA = randomSpin(1);
  inst.spinB = randomSpin(.92);
  layoutDice(inst);
}

function createMeshGroup(inst) {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(inst.geometry,inst.material);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  const edges = new THREE.LineSegments(inst.edgeGeometry,inst.edgeMaterial);
  edges.renderOrder = 2;
  g.add(mesh,edges);
  return g;
}

function layoutDice(inst) {
  const double = inst.double;
  inst.el.classList.toggle("ras-die3d-double",double);
  inst.dieB.visible = double;
  if (double) {
    inst.dieA.position.x = -.62;
    inst.dieB.position.x = .62;
    inst.dieA.scale.setScalar(.78);
    inst.dieB.scale.setScalar(.78);
  } else {
    inst.dieA.position.x = 0;
    inst.dieB.position.x = 0;
    inst.dieA.scale.setScalar(1);
    inst.dieB.scale.setScalar(1);
  }
}

function createInstance(el) {
  const sides = sideCount(el);
  if (!SUPPORTED.has(sides)) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:"high-performance"});
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1,1.65));
  renderer.setClearColor(0x000000,0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const canvas = renderer.domElement;
  canvas.className = "ras-die3d-canvas";
  canvas.setAttribute("aria-hidden","true");
  el.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31,1,.1,20);
  camera.position.set(0,1.25,4.45);
  camera.lookAt(0,0,0);

  scene.add(new THREE.HemisphereLight(0xf5d7a4,0x17111d,1.65));
  const key = new THREE.DirectionalLight(0xffd59a,3.0);
  key.position.set(2.8,4.3,3.5);
  key.castShadow = true;
  key.shadow.mapSize.set(512,512);
  scene.add(key);
  const rim = new THREE.PointLight(0x9e76d6,14,8,2);
  rim.position.set(-3,1.2,2);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2,5.2),
    new THREE.ShadowMaterial({color:0x000000,opacity:.28})
  );
  floor.rotation.x = -Math.PI/2;
  floor.position.y = -1.19;
  floor.receiveShadow = true;
  scene.add(floor);

  const diceRoot = new THREE.Group();
  scene.add(diceRoot);

  const inst = {
    el,canvas,renderer,scene,camera,diceRoot,floor,
    sides,double:false,rolling:false,wasRolling:false,
    visible:true,dirty:true,settleUntil:0,lastValue:directValue(el),
    geometry:null,edgeGeometry:null,material:null,edgeMaterial:null,
    dieA:null,dieB:null,spinA:randomSpin(),spinB:randomSpin(),
    targetA:new THREE.Quaternion(),targetB:new THREE.Quaternion()
  };
  buildVisual(inst);
  inst.dieA.quaternion.copy(stableQuaternion(sides,inst.lastValue,0));
  inst.dieB.quaternion.copy(stableQuaternion(sides,inst.lastValue,1));

  const resize = () => {
    const rect = el.getBoundingClientRect();
    const w = Math.max(48,Math.round(rect.width*1.36));
    const h = Math.max(48,Math.round(rect.height*1.36));
    renderer.setSize(w,h,false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
    inst.dirty = true;
    requestTick();
  };
  inst.resizeObserver = "ResizeObserver" in window ? new ResizeObserver(resize) : null;
  inst.resizeObserver?.observe(el);
  resize();

  el.classList.add("ras-die3d-ready");
  visibilityObserver?.observe(el);
  instances.set(el,inst);
  return inst;
}

function syncInstance(inst) {
  const sides = sideCount(inst.el);
  if (!SUPPORTED.has(sides)) {
    destroyInstance(inst);
    return;
  }
  if (sides !== inst.sides) {
    inst.sides = sides;
    buildVisual(inst);
    inst.lastValue = directValue(inst.el);
    inst.dieA.quaternion.copy(stableQuaternion(sides,inst.lastValue,0));
    inst.dieB.quaternion.copy(stableQuaternion(sides,inst.lastValue,1));
    inst.dirty = true;
  }

  const mode = advantageMode(inst.el);
  const double = mode !== "normal";
  if (double !== inst.double) {
    inst.double = double;
    layoutDice(inst);
    inst.dirty = true;
  }

  const rolling = inst.el.classList.contains("is-rolling");
  const value = directValue(inst.el);

  if (rolling && !inst.rolling) {
    inst.rolling = true;
    inst.spinA = randomSpin(1);
    inst.spinB = randomSpin(.9);
    inst.settleUntil = 0;
    requestTick();
  } else if (!rolling && inst.rolling) {
    inst.rolling = false;
    inst.targetA = stableQuaternion(inst.sides,value,0);
    inst.targetB = stableQuaternion(inst.sides,value,1);
    inst.settleUntil = reduceMotion ? 0 : performance.now()+620;
    if (reduceMotion) {
      inst.dieA.quaternion.copy(inst.targetA);
      inst.dieB.quaternion.copy(inst.targetB);
      inst.dieA.position.y = inst.dieB.position.y = 0;
    }
    requestTick();
  } else if (!rolling && value !== inst.lastValue) {
    inst.targetA = stableQuaternion(inst.sides,value,0);
    inst.targetB = stableQuaternion(inst.sides,value,1);
    if (reduceMotion) {
      inst.dieA.quaternion.copy(inst.targetA);
      inst.dieB.quaternion.copy(inst.targetB);
      inst.settleUntil = 0;
    } else {
      inst.settleUntil = performance.now()+430;
    }
    requestTick();
  }

  inst.lastValue = value;
  inst.dirty = true;
}

function renderInstance(inst) {
  inst.renderer.render(inst.scene,inst.camera);
  inst.dirty = false;
}

function animateDie(group,spin,dt,time,index) {
  group.rotation.x += spin.x*dt;
  group.rotation.y += spin.y*dt;
  group.rotation.z += spin.z*dt;
  group.position.y = Math.abs(Math.sin(time*.014 + index*1.7))*.27;
  const squash = 1 - Math.abs(Math.sin(time*.014 + index))*.035;
  const base = group.visible && group.position.x !== 0 ? .78 : 1;
  group.scale.set(base*(2-squash),base*squash,base*(2-squash));
}

function settleDie(group,target,dt,baseScale) {
  group.quaternion.slerp(target,Math.min(1,dt*8.5));
  group.position.y += (0-group.position.y)*Math.min(1,dt*10);
  const s = group.scale.x + (baseScale-group.scale.x)*Math.min(1,dt*10);
  group.scale.setScalar(s);
}

function tick(now) {
  raf = 0;
  const dt = Math.min(.04,Math.max(.001,(now-(lastFrame||now))/1000));
  lastFrame = now;
  let keep = false;

  for (const inst of instances.values()) {
    if (!inst.el.isConnected) {
      destroyInstance(inst);
      continue;
    }
    if (!inst.visible && !inst.dirty) continue;

    if (inst.rolling && !reduceMotion) {
      animateDie(inst.dieA,inst.spinA,dt,now,0);
      if (inst.double) animateDie(inst.dieB,inst.spinB,dt,now,1);
      renderInstance(inst);
      keep = true;
      continue;
    }

    if (inst.settleUntil && now < inst.settleUntil && !reduceMotion) {
      settleDie(inst.dieA,inst.targetA,dt,inst.double?.78:1);
      if (inst.double) settleDie(inst.dieB,inst.targetB,dt,.78);
      renderInstance(inst);
      keep = true;
      continue;
    }

    if (inst.settleUntil) {
      inst.settleUntil = 0;
      inst.dieA.quaternion.copy(inst.targetA);
      inst.dieB.quaternion.copy(inst.targetB);
      inst.dieA.position.y = inst.dieB.position.y = 0;
      layoutDice(inst);
      inst.dirty = true;
    }
    if (inst.dirty && inst.visible) renderInstance(inst);
  }
  if (keep) requestTick();
}

function requestTick() {
  if (!raf) raf = requestAnimationFrame(tick);
}

function destroyInstance(inst) {
  if (!inst || !instances.has(inst.el)) return;
  instances.delete(inst.el);
  visibilityObserver?.unobserve(inst.el);
  inst.resizeObserver?.disconnect();
  inst.geometry?.dispose();
  inst.edgeGeometry?.dispose();
  inst.material?.dispose();
  inst.edgeMaterial?.dispose();
  inst.floor?.geometry?.dispose();
  inst.floor?.material?.dispose();
  inst.renderer?.dispose();
  inst.canvas?.remove();
  inst.el.classList.remove("ras-die3d-ready","ras-die3d-double");
}

function scan() {
  for (const el of document.querySelectorAll(".die-shape")) {
    let inst = instances.get(el);
    if (!inst) inst = createInstance(el);
    if (inst) syncInstance(inst);
  }
  for (const inst of [...instances.values()]) if (!inst.el.isConnected) destroyInstance(inst);
  requestTick();
}

function queueScan() {
  if (scanQueued) return;
  scanQueued = true;
  requestAnimationFrame(() => {
    scanQueued = false;
    scan();
  });
}

const mutationObserver = new MutationObserver(queueScan);
function boot() {
  mutationObserver.observe(document.body,{
    subtree:true,
    childList:true,
    characterData:true,
    attributes:true,
    attributeFilter:["class","aria-pressed"]
  });
  scan();
}

reduceMotionQuery.addEventListener?.("change",e=>{
  reduceMotion = e.matches;
  for (const inst of instances.values()) {
    if (reduceMotion) {
      inst.dieA.quaternion.copy(stableQuaternion(inst.sides,inst.lastValue,0));
      inst.dieB.quaternion.copy(stableQuaternion(inst.sides,inst.lastValue,1));
      inst.rolling = false;
      inst.settleUntil = 0;
    }
    inst.dirty = true;
  }
  requestTick();
});

document.addEventListener("visibilitychange",()=>{
  lastFrame = performance.now();
  if (!document.hidden) {
    for (const inst of instances.values()) inst.dirty = true;
    requestTick();
  }
});

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",boot,{once:true});
else boot();

window.addEventListener("pagehide",()=>{
  mutationObserver.disconnect();
  for (const inst of [...instances.values()]) destroyInstance(inst);
},{once:true});
