/* RASTHOR·IA Dice Arena 3.0 — presentation only.
 * Local Three.js 0.160.1 + cannon-es 0.20.0. No game state/RNG access.
 * Simulate first, orient the numbered shell by a polyhedron symmetry, then replay.
 * The result is supplied by the caller; physical randomness never chooses it.
 */
(function () {
  'use strict';
  const T = window.THREE, C = window.CANNON, VERSION = '3.0.0';
  const DT = 1 / 120, UP = T && new T.Vector3(0, 1, 0);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // Separate visual PRNG. Game dice use their unchanged crypto rejection sampler.
  let seed = (Date.now() ^ 0x9e3779b9) >>> 0;
  try { const a = new Uint32Array(1); crypto.getRandomValues(a); seed = a[0] || seed; } catch (_) {}
  function random() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }
  let muted = false;
  try { muted = localStorage.getItem('rasthoria-dice-muted') === '1'; } catch (_) {}
  let overlay, stage, caption, status, fallback, sound, renderer, scene, camera, tray;
  let audio, lastImpact = 0, queue = Promise.resolve(), active = null, lost = false;
  let lastReport = null, frameCount = 0;
  const textures = new Map(), shapes = new Map(), inFlight = new WeakMap();
  const v = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);

  function createDOM() {
    overlay = document.createElement('section');
    overlay.id = 'ras-dice-arena';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `<div class="ras-dice-table" role="dialog" aria-modal="true" aria-label="Mesa de dados">
      <header class="ras-dice-heading"><span class="ras-dice-kicker">RASTHOR·IA · MESA DE ROL</span><h2 class="ras-dice-title">Tirada</h2><p class="ras-dice-notation"></p></header>
      <div class="ras-dice-canvas-wrap" aria-hidden="true"></div>
      <div class="ras-dice-fallback" hidden></div>
      <footer class="ras-dice-footer"><p class="ras-dice-status" role="status" aria-live="polite"></p><button type="button" class="ras-dice-sound" aria-label="Silenciar dados">Sonido</button></footer>
    </div>`;
    document.body.appendChild(overlay);
    stage = overlay.querySelector('.ras-dice-canvas-wrap');
    caption = overlay.querySelector('.ras-dice-notation');
    status = overlay.querySelector('.ras-dice-status');
    fallback = overlay.querySelector('.ras-dice-fallback');
    sound = overlay.querySelector('.ras-dice-sound');
    sound.onclick = () => setMuted(!muted);
    setMuted(muted);
  }
  function setMuted(value) {
    muted = !!value;
    try { localStorage.setItem('rasthoria-dice-muted', muted ? '1' : '0'); } catch (_) {}
    if (sound) { sound.textContent = muted ? 'Sonido: apagado' : 'Sonido: activado'; sound.setAttribute('aria-pressed', String(muted)); sound.setAttribute('aria-label', muted ? 'Activar sonido de dados' : 'Silenciar dados'); }
  }
  function unlockAudio() {
    if (muted) return;
    try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume().catch(() => {}); } catch (_) {}
  }
  function impact(strength) {
    if (muted || !audio || audio.state !== 'running' || performance.now() - lastImpact < 65 || strength < .8) return;
    lastImpact = performance.now();
    try {
      const len = Math.floor(audio.sampleRate * .045), buffer = audio.createBuffer(1, len, audio.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (random() * 2 - 1) * (1 - i / len) ** 3;
      const source = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
      source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = 1700;
      gain.gain.value = Math.min(.05, .012 + strength * .005);
      source.connect(filter).connect(gain).connect(audio.destination); source.start();
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    } catch (_) {}
  }
  function initScene() {
    if (!T || !C) return false;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
      stage.appendChild(renderer.domElement);
      renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; active?.cancel?.(); });
      renderer.domElement.addEventListener('webglcontextrestored', () => { lost = false; });
      scene = new T.Scene(); camera = new T.PerspectiveCamera(34, 1, .1, 80);
      scene.add(new T.HemisphereLight(0xffebd0, 0x25252e, 2.4));
      const key = new T.DirectionalLight(0xffe0b2, 3.4); key.position.set(-3, 8, 5); key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = key.shadow.camera.bottom = -9; key.shadow.camera.right = key.shadow.camera.top = 9;
      key.shadow.camera.near = .1; key.shadow.camera.far = 24; key.shadow.normalBias = .025; key.shadow.bias = -.0001;
      scene.add(key);
      const fill = new T.DirectionalLight(0xc8d9ef, 1.3); fill.position.set(5, 4, -4); scene.add(fill);
      window.addEventListener('resize', () => { if (active?.dice) { resize(); render(); } }, { passive: true });
      return true;
    } catch (error) { console.warn('Dados: usando resultado accesible.', error); return false; }
  }
  function render() { if (renderer && !lost) { renderer.render(scene, camera); frameCount++; } }
  function resize() {
    if (!renderer || !active?.layout) return;
    const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight), l = active.layout;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    // Fit all four tray corners and launch height; portrait gets a taller tray.
    const fov = camera.fov * Math.PI / 180, vertical = (l.depth * .8 + 2.1) / 2;
    const distance = Math.max(vertical / Math.tan(fov / 2), (l.width / 2 + .48) / (Math.tan(fov / 2) * camera.aspect));
    camera.position.set(.10 * distance, .83 * distance, .55 * distance);
    camera.lookAt(0, .20, 0); camera.updateProjectionMatrix();
    const points = [];
    for (const x of [-l.width / 2 - .3, l.width / 2 + .3]) for (const z of [-l.depth / 2 - .3, l.depth / 2 + .3]) points.push(v(x, .24, z));
    for (const d of active.dice || []) for (let i = 0; i < d.frames.length; i += 12) for (const vert of d.shape.verts) points.push(vert.clone().applyQuaternion(d.frames[i].q).add(d.frames[i].p));
    for (let i = 0; i < 20; i++) {
      camera.updateMatrixWorld();
      if (points.every(p => { const a = p.clone().project(camera); return Math.abs(a.x) < .96 && Math.abs(a.y) < .96; })) break;
      camera.position.multiplyScalar(1.035); camera.lookAt(0, .20, 0);
    }
    camera.updateMatrixWorld();
  }
  function makeTray(layout) {
    tray = new T.Group(); scene.add(tray);
    const { width: w, depth: d } = layout;
    const floorMat = new T.MeshStandardMaterial({ color: 0x192b29, roughness: .96, metalness: .02 });
    const floor = new T.Mesh(new T.BoxGeometry(w, .16, d), floorMat); floor.position.y = -.08; floor.receiveShadow = true; tray.add(floor);
    const wood = new T.MeshStandardMaterial({ color: 0x39271d, roughness: .55, metalness: .10 });
    const brass = new T.MeshStandardMaterial({ color: 0xa7824b, roughness: .42, metalness: .65 });
    for (const [x, z, sx, sz] of [[-w / 2 - .12, 0, .24, d + .48], [w / 2 + .12, 0, .24, d + .48], [0, -d / 2 - .12, w, .24], [0, d / 2 + .12, w, .24]]) {
      const rail = new T.Mesh(new T.BoxGeometry(sx, .38, sz), wood); rail.position.set(x, .05, z); rail.castShadow = rail.receiveShadow = true; tray.add(rail);
      const inlay = new T.Mesh(new T.BoxGeometry(sx > .3 ? sx : .035, .012, sz > .3 ? sz : .035), brass); inlay.position.set(x, .247, z); tray.add(inlay);
    }
    // Quiet stitched border, in world space, within the felt.
    const pts = [v(-w / 2 + .13, .006, -d / 2 + .13), v(w / 2 - .13, .006, -d / 2 + .13), v(w / 2 - .13, .006, d / 2 - .13), v(-w / 2 + .13, .006, d / 2 - .13), v(-w / 2 + .13, .006, -d / 2 + .13)];
    tray.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0x68716a, transparent: true, opacity: .45 })));
  }
  function triangleFaceGroups(geometry){
    const g=geometry.index?geometry.toNonIndexed():geometry.clone();
    const a=g.getAttribute('position');
    const groups=[];
    const va=new T.Vector3(),vb=new T.Vector3(),vc=new T.Vector3(),ab=new T.Vector3(),ac=new T.Vector3();
    for(let i=0;i<a.count;i+=3){
      va.fromBufferAttribute(a,i);vb.fromBufferAttribute(a,i+1);vc.fromBufferAttribute(a,i+2);
      ab.subVectors(vb,va);ac.subVectors(vc,va);
      const cross=new T.Vector3().crossVectors(ab,ac);
      const area=cross.length()/2;
      const n=cross.normalize();
      const ctr=new T.Vector3().add(va).add(vb).add(vc).multiplyScalar(1/3);
      if(n.dot(ctr)<0)n.multiplyScalar(-1);
      const plane=n.dot(ctr);
      let group=groups.find(q=>q.normal.dot(n)>.9985&&Math.abs(q.plane-plane)<.025);
      if(!group){group={normal:n.clone(),plane,area:0,center:new T.Vector3(),triangles:0};groups.push(group)}
      group.center.addScaledVector(ctr,area);group.area+=area;group.triangles++;
    }
    for(const q of groups)q.center.multiplyScalar(1/Math.max(.0001,q.area));
    return groups;
  }

  function d10GeometryAndFaces() {
    // Symmetric pentagonal trapezohedron; ten coplanar kite faces, two poles.
    // h and a satisfy coplanarity a = h * tan(pi/10)^2.
    const h = 1.15, a = h * Math.tan(Math.PI / 10) ** 2;
    const verts = [v(0, h, 0), v(0, -h, 0)];
    for (let i = 0; i < 10; i++) verts.push(v(Math.cos(i * Math.PI / 5), i % 2 ? a : -a, Math.sin(i * Math.PI / 5)));
    const polygons = [];
    for (let i = 0; i < 5; i++) {
      polygons.push([0, 2 + (2 * i + 9) % 10, 2 + 2 * i, 2 + (2 * i + 1) % 10]);
      polygons.push([1, 2 + 2 * i, 2 + (2 * i + 1) % 10, 2 + (2 * i + 2) % 10]);
    }
    const positions = [], faces = [];
    for (const polygon of polygons) {
      const p = polygon.map(i => verts[i]), center = p.reduce((sum, point) => sum.add(point), v()).multiplyScalar(.25);
      let normal = v().crossVectors(p[1].clone().sub(p[0]), p[2].clone().sub(p[0])).normalize();
      if (normal.dot(center) < 0) { p.reverse(); normal.negate(); }
      positions.push(...p[0].toArray(), ...p[1].toArray(), ...p[2].toArray(), ...p[0].toArray(), ...p[2].toArray(), ...p[3].toArray());
      faces.push({ normal, center, plane: normal.dot(center), area: 1 });
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingSphere(); return { geometry, faces };
  }

  function geometryFor(sides){
    if(sides===10)return d10GeometryAndFaces();
    let geometry;
    switch(sides){
      case 4:geometry=new T.TetrahedronGeometry(1.12,0);break;
      case 6:geometry=new T.BoxGeometry(1.38,1.38,1.38);break;
      case 8:geometry=new T.OctahedronGeometry(1.12,0);break;
      case 12:geometry=new T.DodecahedronGeometry(1.03,0);break;
      case 20:default:geometry=new T.IcosahedronGeometry(1.08,0);break;
    }
    geometry.computeBoundingSphere();
    return {geometry,faces:triangleFaceGroups(geometry)};
  }

  function assignValuesToFaces(faces,values){
    const out=faces.map((f,i)=>({...f,index:i,value:null,label:null}));
    if(values.length!==out.length){
      // Defensive fallback: deterministic sequential assignment.
      for(let i=0;i<out.length;i++){out[i].value=values[i%values.length];out[i].label=String(values[i%values.length])}
      return out;
    }
    if(values.length>=6&&values.length%2===0){
      const remaining=new Set(out.map((_,i)=>i));
      const pairs=[];
      while(remaining.size){
        const i=[...remaining][0];remaining.delete(i);
        let best=null,bestDot=2;
        for(const j of remaining){const d=out[i].normal.dot(out[j].normal);if(d<bestDot){bestDot=d;best=j}}
        if(best!==null){remaining.delete(best);pairs.push([i,best])}else pairs.push([i]);
      }
      pairs.sort((a,b)=>{
        const na=out[a[0]].normal,nb=out[b[0]].normal;
        return nb.y-na.y||nb.z-na.z||nb.x-na.x;
      });
      const lo=values.slice().sort((a,b)=>Number(a)-Number(b));
      for(let p=0;p<pairs.length;p++){
        const [i,j]=pairs[p],v1=lo[p],v2=lo[lo.length-1-p];
        out[i].value=v1;out[i].label=String(v1);
        if(j!==undefined){out[j].value=v2;out[j].label=String(v2)}
      }
    }else{
      const sorted=out.slice().sort((a,b)=>b.normal.y-a.normal.y||b.normal.z-a.normal.z||b.normal.x-a.normal.x);
      values.forEach((v,i)=>{sorted[i].value=v;sorted[i].label=String(v)});
    }
    return out;
  }

  function shapeFor(sides) {
    if (shapes.has(sides)) return shapes.get(sides);
    const { geometry, faces } = geometryFor(sides);
    const radius = geometry.boundingSphere.radius, scale = .66 / radius;
    geometry.scale(scale, scale, scale);
    const verts = [], attr = geometry.getAttribute('position');
    for (let i = 0; i < attr.count; i++) { const p = v().fromBufferAttribute(attr, i); if (!verts.some(q => q.distanceTo(p) < 1e-5)) verts.push(p); }
    faces.forEach(f => {
      f.center.multiplyScalar(scale); f.plane *= scale;
      f.indices = verts.map((p, i) => Math.abs(p.dot(f.normal) - f.plane) < 1e-4 ? i : -1).filter(i => i >= 0);
      const x = verts[f.indices[0]].clone().sub(f.center).normalize(), y = v().crossVectors(f.normal, x);
      f.indices.sort((a, b) => Math.atan2(verts[a].clone().sub(f.center).dot(y), verts[a].clone().sub(f.center).dot(x)) - Math.atan2(verts[b].clone().sub(f.center).dot(y), verts[b].clone().sub(f.center).dot(x)));
    });
    const positions = [];
    function polygon(points, outward) {
      if (v().crossVectors(points[1].clone().sub(points[0]), points[2].clone().sub(points[0])).dot(outward) < 0) points.reverse();
      for (let i = 1; i < points.length - 1; i++) positions.push(...points[0].toArray(), ...points[i].toArray(), ...points[i + 1].toArray());
    }
    const inset = faces.map(f => new Map(f.indices.map(i => [i, f.center.clone().lerp(verts[i], .94)])));
    faces.forEach((f, i) => polygon(f.indices.map(k => inset[i].get(k)), f.normal));
    const done = new Set();
    faces.forEach((f, i) => f.indices.forEach((a, k) => {
      const b = f.indices[(k + 1) % f.indices.length], key = [a, b].sort((x, y) => x - y).join(',');
      if (done.has(key)) return; done.add(key);
      const j = faces.findIndex((g, n) => n !== i && g.indices.includes(a) && g.indices.includes(b));
      if (j >= 0) polygon([inset[i].get(a), inset[i].get(b), inset[j].get(b), inset[j].get(a)], verts[a].clone().add(verts[b]));
    }));
    verts.forEach((p, k) => {
      const points = inset.filter(m => m.has(k)).map(m => m.get(k));
      const n = p.clone().normalize(), x = points[0].clone().sub(p).addScaledVector(n, -points[0].clone().sub(p).dot(n)).normalize(), y = v().crossVectors(n, x);
      points.sort((a, b) => Math.atan2(a.clone().sub(p).dot(y), a.clone().sub(p).dot(x)) - Math.atan2(b.clone().sub(p).dot(y), b.clone().sub(p).dot(x)));
      polygon(points, n);
    });
    const chamfered = new T.BufferGeometry(); chamfered.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); chamfered.computeVertexNormals();
    geometry.dispose();
    const shape = { sides, geometry: chamfered, faces, verts, hull: new C.ConvexPolyhedron({ vertices: verts.map(p => new C.Vec3(p.x, p.y, p.z)), faces: faces.map(f => f.indices) }) };
    shapes.set(sides, shape); return shape;
  }
  function layoutFor(n) {
    const portrait = innerWidth < 600;
    const cols = Math.min(n, portrait ? 2 : 4), rows = Math.ceil(n / cols);
    return { cols, rows, width: Math.max(4.2, cols * 2.15 + .5), depth: Math.max(3.5, rows * 2.3 + .9) };
  }
  function support(shape, q) { let low = Infinity; for (const p of shape.verts) low = Math.min(low, p.clone().applyQuaternion(q).y); return -low; }
  function snapshot(b) { return { p: v(b.position.x, b.position.y, b.position.z), q: new T.Quaternion(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w) }; }
  function simulate(specs, layout) {
    const world = new C.World({ gravity: new C.Vec3(0, -20, 0), allowSleep: true });
    world.solver.iterations = 16; world.solver.tolerance = 1e-7;
    world.defaultContactMaterial.friction = .58; world.defaultContactMaterial.restitution = .28;
    world.defaultContactMaterial.contactEquationStiffness = 1e8; world.defaultContactMaterial.contactEquationRelaxation = 4;
    const floor = new C.Body({ mass: 0, shape: new C.Plane() }); floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(floor);
    for (const [x, z, sx, sz] of [[-layout.width / 2 - .1, 0, .1, layout.depth / 2 + .2], [layout.width / 2 + .1, 0, .1, layout.depth / 2 + .2], [0, -layout.depth / 2 - .1, layout.width / 2, .1], [0, layout.depth / 2 + .1, layout.width / 2, .1]]) {
      const wall = new C.Body({ mass: 0, shape: new C.Box(new C.Vec3(sx, 2, sz)), position: new C.Vec3(x, 1, z) }); world.addBody(wall);
    }
    const impacts = []; let step = 0;
    const dice = specs.map((spec, i) => {
      const shape = shapeFor(spec.sides), col = i % layout.cols, row = Math.floor(i / layout.cols);
      const x = (col - (Math.min(layout.cols, specs.length - row * layout.cols) - 1) / 2) * 2.15;
      const z = (row - (layout.rows - 1) / 2) * 2.3;
      const body = new C.Body({ mass: .14, shape: new C.ConvexPolyhedron({ vertices: shape.verts.map(p => new C.Vec3(p.x, p.y, p.z)), faces: shape.faces.map(f => f.indices.slice()) }), position: new C.Vec3(x + (random() - .5) * .12, 1.6 + random() * .35, z - .5), linearDamping: .25, angularDamping: .28, sleepSpeedLimit: .13, sleepTimeLimit: .20 });
      body.quaternion.setFromEuler(random() * 6.28, random() * 6.28, random() * 6.28);
      body.velocity.set((random() - .5) * .6, -.3, .9 + random() * .5);
      body.angularVelocity.set((random() - .5) * 16, (random() - .5) * 14, (random() - .5) * 16);
      body.addEventListener('collide', e => { const strength = Math.abs(e.contact.getImpactVelocityAlongNormal()); if (strength > .8) impacts.push({ step, strength }); });
      world.addBody(body); return { spec, shape, body, frames: [snapshot(body)] };
    });
    // Bounded precomputation, independent of rendering speed or tab visibility.
    for (step = 1; step <= 540; step++) {
      world.step(DT);
      for (const d of dice) d.frames.push(snapshot(d.body));
      if (step > 144 && dice.every(d => d.body.sleepState === C.Body.SLEEPING)) break;
    }
    const steps = Math.min(step, 540);
    // Micro-settle onto the nearest support face, never toward the requested value.
    // Contact height is recomputed from EVERY vertex on every displayed pose.
    for (const d of dice) {
      const end = d.frames.at(-1), bottom = d.shape.faces.reduce((a, b) => a.normal.clone().applyQuaternion(end.q).y < b.normal.clone().applyQuaternion(end.q).y ? a : b);
      const normal = bottom.normal.clone().applyQuaternion(end.q);
      const correction = alignDirections(normal, v(0, -1, 0));
      const target = correction.multiply(end.q).normalize();
      d.correction = end.q.angleTo(target);
      for (let j = 1; j <= 30; j++) {
        const t = j / 30, s = t * t * (3 - 2 * t), q = end.q.clone().slerp(target, s);
        d.frames.push({ p: v(end.p.x, support(d.shape, q) + .003, end.p.z), q });
      }
      // Lift only solver tolerances; no rounded proxy collider and no submerged vertices.
      for (const f of d.frames) f.p.y = Math.max(f.p.y, support(d.shape, f.q) + .003);
      d.end = d.frames.at(-1);
    }
    return { dice, impacts, steps: steps + 30 };
  }
  // Rotate the fixed numbered shell onto an equivalent geometric orientation.
  // All labels are assigned BEFORE the first visible frame and stay on their faces.
  function alignDirections(from, to) {
    const a = from.clone().normalize(), b = to.clone().normalize();
    if (a.dot(b) < -1 + 1e-8) {
      const axis = v().crossVectors(a, Math.abs(a.x) < .8 ? v(1, 0, 0) : v(0, 1, 0)).normalize();
      return new T.Quaternion().setFromAxisAngle(axis, Math.PI);
    }
    return new T.Quaternion().setFromUnitVectors(a, b);
  }
  function shellRotation(shape, from, to) {
    from = from.clone().normalize(); to = to.clone().normalize();
    const align = alignDirections(from, to);
    let best = null, error = Infinity;
    for (let i = 0; i < 120; i++) {
      const q = new T.Quaternion().setFromAxisAngle(to, i * Math.PI / 60).multiply(align);
      const e = Math.max(...shape.verts.map(p => Math.min(...shape.verts.map(w => p.clone().applyQuaternion(q).distanceTo(w)))));
      if (e < error) { error = e; best = q; }
    }
    // General face axes are not multiples of 3 degrees: derive exact candidates.
    for (const a of shape.verts) for (const b of shape.verts) {
      const ra = a.clone().applyQuaternion(align), pa = ra.clone().addScaledVector(to, -ra.dot(to)), pb = b.clone().addScaledVector(to, -b.dot(to));
      if (pa.length() < 1e-5 || pb.length() < 1e-5 || Math.abs(ra.dot(to) - b.dot(to)) > 1e-4) continue;
      pa.normalize(); pb.normalize();
      const angle = Math.atan2(to.dot(v().crossVectors(pa, pb)), pa.dot(pb));
      const q = new T.Quaternion().setFromAxisAngle(to, angle).multiply(align);
      const e = Math.max(...shape.verts.map(p => Math.min(...shape.verts.map(w => p.clone().applyQuaternion(q).distanceTo(w)))));
      if (e < error) { error = e; best = q; }
    }
    if (from.clone().applyQuaternion(best).distanceTo(to) > 1e-5) throw new Error("Shell axis mismatch");
    if (error > 1e-4) throw new Error('No se encontró simetría del dado');
    return best;
  }
  function numberTexture(text) {
    if (textures.has(text)) return textures.get(text);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `600 ${text.length > 1 ? 76 : 88}px Georgia,serif`;
    ctx.fillStyle = '#f8dfae'; ctx.fillText(text, 64, 66);
    if (text === '6' || text === '9') { ctx.fillRect(48, 105, 32, 3); }
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    textures.set(text, texture); return texture;
  }
  function label(group, text, position, normal, size, upHint) {
    const material = new T.MeshBasicMaterial({ map: numberTexture(text), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, toneMapped: false });
    const mesh = new T.Mesh(new T.PlaneGeometry(size, size), material);
    mesh.position.copy(position).addScaledVector(normal, .0015);
    const y = upHint.clone().addScaledVector(normal, -upHint.dot(normal)).normalize();
    const x = v().crossVectors(y, normal).normalize();
    mesh.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, normal));
    group.add(mesh); return mesh;
  }
  function makeDie(d, index) {
    const { shape, spec, end } = d;
    const outer = new T.Group(), shell = new T.Group(); outer.add(shell); scene.add(outer);
    d.group = outer; d.shell = shell; d.labels = [];
    const material = new T.MeshStandardMaterial({ color: spec.kind === 'tens' ? 0x67503a : [0x3b4849, 0x514554, 0x3d514b, 0x594335][index % 4], roughness: .42, metalness: .12 });
    d.material = material;
    const body = new T.Mesh(shape.geometry, material); body.castShadow = true; body.receiveShadow = true; shell.add(body);
    const edges = new T.LineSegments(new T.EdgesGeometry(shape.geometry, 24), new T.LineBasicMaterial({ color: 0xb79862, transparent: true, opacity: .28 })); shell.add(edges); d.edges = edges;
    const values = spec.values || Array.from({ length: spec.sides }, (_, i) => i + 1);
    const numbered = assignValuesToFaces(shape.faces, values);
    if (spec.sides === 4) {
      // A real tetrahedron rests on a face and has a VERTEX on top.
      // Standard top-reading D4: repeat the vertex value on its three incident faces.
      const top = shape.verts.reduce((a, b) => a.clone().applyQuaternion(end.q).y > b.clone().applyQuaternion(end.q).y ? a : b).clone().normalize();
      const targetVertex = shape.verts[spec.target - 1].clone().normalize();
      shell.quaternion.copy(shellRotation(shape, targetVertex, top));
      d.readAxis = targetVertex; d.displayed = spec.target;
      shape.faces.forEach(f => f.indices.forEach(i => {
        const vertex = shape.verts[i], pos = f.center.clone().lerp(vertex, .49), up = vertex.clone().sub(f.center).normalize();
        d.labels.push(label(shell, String(i + 1), pos, f.normal, .245, up));
      }));
    } else {
      const topFace = shape.faces.reduce((a, b) => a.normal.clone().applyQuaternion(end.q).y > b.normal.clone().applyQuaternion(end.q).y ? a : b);
      const targetFace = numbered.find(f => f.value === spec.target);
      if (!targetFace) throw new Error('Resultado fuera de las caras');
      shell.quaternion.copy(shellRotation(shape, targetFace.normal, topFace.normal));
      d.topAxis = topFace.normal.clone(); d.readAxis = targetFace.normal.clone(); d.displayed = targetFace.value;
      const size = ({ 6: .60, 8: .42, 10: .36, 12: .35, 20: .29 })[spec.sides];
      // Select a physical in-plane inscription direction before launch for easy final reading.
      const finalQ = end.q.clone().multiply(shell.quaternion), inv = finalQ.clone().invert();
      const cameraUp = v(0, 0, -1).applyQuaternion(inv);
      numbered.forEach(f => {
        let up = cameraUp.clone().addScaledVector(f.normal, -cameraUp.dot(f.normal));
        if (up.lengthSq() < .01) up = shape.verts[f.indices[0]].clone().sub(f.center);
        const text = spec.kind === 'tens' && f.value === 0 ? '00' : String(f.value);
        d.labels.push(label(shell, text, f.center, f.normal, size, up));
      });
    }
    const alignment = d.readAxis.clone().applyQuaternion(shell.quaternion).applyQuaternion(end.q).dot(UP);
    if (alignment < .9999) throw new Error('La cara final no coincide con el resultado');
    // A ring on the felt identifies the KEPT die without obscuring any numeral.
    const ring = new T.Mesh(new T.RingGeometry(.76, .79, 64), new T.MeshBasicMaterial({ color: 0xd1b078, transparent: true, opacity: .8, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(end.p.x, .012, end.p.z); ring.visible = false; scene.add(ring); d.ring = ring;
    return d;
  }
  function expand(r) {
    return r.values.flatMap(value => r.sides === 100 ? [
      { sides: 10, target: Math.floor((value % 100) / 10) * 10, values: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90], kind: 'tens' },
      { sides: 10, target: value % 10, values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], kind: 'ones' }
    ] : [{ sides: r.sides, target: value }]);
  }
  function normalize(raw) {
    if (!raw || ![4, 6, 8, 10, 12, 20, 100].includes(+raw.sides) || !Array.isArray(raw.values) || !raw.values.length) throw new Error('La tirada no contiene valores del motor');
    const sides = +raw.sides, values = raw.values.map(Number);
    if (values.some(n => !Number.isInteger(n) || n < 1 || n > sides)) throw new Error('Valores de dado no válidos');
    return { ...raw, sides, values, kept: raw.kept?.map(Number) || values.slice(), advantage: raw.advantage || 'normal', modifier: +raw.modifier || 0, purpose: String(raw.purpose || raw.reason || 'Tirada'), count: +raw.count || values.length };
  }
  function finalText(r) {
    const special = r.sides === 20 && r.advantage !== 'normal' && r.values.length === 2;
    if (special) return `Se conserva ${r.kept[0]} · dado marcado en bronce`;
    if (r.sides === 100) return 'Decenas + unidades · 00 y 0 representan 100';
    if (r.sides === 4) return 'D4 · lee el número junto a la punta superior';
    return r.modifier ? `Modificador ${r.modifier > 0 ? '+' : ''}${r.modifier} · total ${r.total}` : 'Tirada completada';
  }
  function open(r) {
    overlay.querySelector('.ras-dice-title').textContent = r.purpose;
    caption.textContent = r.sides === 20 && r.advantage !== 'normal' ? `2D20 · ${r.advantage === 'advantage' ? 'Ventaja' : 'Desventaja'}` : `${r.count}D${r.sides}${r.sides === 100 ? ' · dos D10 por resultado' : ''}`;
    status.textContent = ''; fallback.hidden = true; stage.hidden = false;
    overlay.classList.add('is-open'); overlay.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('ras-dice-cinematic');
  }
  async function showFallback(r) {
    stage.hidden = true; fallback.hidden = false;
    fallback.textContent = `${r.values.map(x => `D${r.sides}: ${x}`).join(' · ')}${Number.isFinite(+r.total) ? ` — Total: ${r.total}` : ''}`;
    status.textContent = 'Resultado de la tirada'; await wait(reduced() ? 450 : 1100);
  }
  function disposeGroup(group, skipGeometry) {
    if (!group) return;
    scene.remove(group);
    const materials = new Set();
    group.traverse(o => { if (o.geometry && o.geometry !== skipGeometry) o.geometry.dispose(); if (o.material) materials.add(o.material); });
    materials.forEach(m => m.dispose());
  }
  function finish() {
    if (active?.dice) for (const d of active.dice) { disposeGroup(d.group, d.shape.geometry); disposeGroup(d.ring); }
    disposeGroup(tray); tray = null; active = null;
    overlay.classList.remove('is-open'); overlay.setAttribute('aria-hidden', 'true'); document.documentElement.classList.remove('ras-dice-cinematic');
    // No idle render loop. Cached geometries/textures are bounded by the supported faces.
  }
  function displayFrame(d, t) {
    t = Math.max(0, Math.min(t, d.frames.length - 1));
    const lo = Math.min(Math.floor(t), d.frames.length - 1), hi = Math.min(lo + 1, d.frames.length - 1), f = t - lo;
    d.group.position.copy(d.frames[lo].p).lerp(d.frames[hi].p, f);
    d.group.quaternion.copy(d.frames[lo].q).slerp(d.frames[hi].q, f);
    d.group.position.y = Math.max(d.group.position.y, support(d.shape, d.group.quaternion) + .003);
  }
  function play(sim, duration) {
    return new Promise(resolve => {
      let raf = 0, timer = 0, complete = false, lastStep = -1;
      const start = performance.now();
      function stop() {
        if (complete) return; complete = true; cancelAnimationFrame(raf); clearTimeout(timer); document.removeEventListener('visibilitychange', visibility);
        sim.dice.forEach(d => displayFrame(d, d.frames.length - 1)); render(); resolve();
      }
      function visibility() { if (document.hidden) stop(); }
      active.cancel = stop;
      document.addEventListener('visibilitychange', visibility);
      function frame(now) {
        if (complete) return;
        const progress = Math.max(0, Math.min(1, (now - start) / duration)), at = progress * sim.steps;
        for (const d of sim.dice) displayFrame(d, at);
        for (const event of sim.impacts) if (event.step > lastStep && event.step <= at) impact(event.strength);
        lastStep = at; render();
        if (progress >= 1) stop(); else raf = requestAnimationFrame(frame);
      }
      // Timed completion also handles throttled/background RAF and lost context.
      timer = setTimeout(stop, duration + 160); raf = requestAnimationFrame(frame);
    });
  }
  function report(sim, r, duration) {
    return {
      version: VERSION, requested: r.values.slice(), durationMs: duration,
      dice: sim.dice.map(d => ({ sides: d.spec.sides, target: d.spec.target, displayed: d.displayed,
        alignment: d.readAxis.clone().applyQuaternion(d.shell.quaternion).applyQuaternion(d.end.q).dot(UP),
        minClearance: Math.min(...d.frames.map(f => f.p.y - support(d.shape, f.q))),
        correctionDegrees: d.correction * 180 / Math.PI, position: d.end.p.toArray(), frames: d.frames.length,
        retained: d.ring.visible, faceCount: d.shape.faces.length, labelCount: d.labels.length,
        projected: (() => { const box = new T.Box3().setFromObject(d.group); return [box.min, box.max].map(p => p.clone().project(camera).toArray()); })()
      })), steps: sim.steps, frameCount
    };
  }
  async function animate(raw, opts) {
    let r;
    try { r = normalize(raw); } catch (error) { console.warn('Dados: presentación omitida.', error); return raw; }
    open(r);
    try {
      if (!renderer || lost || expand(r).length > 12) { await showFallback(r); return raw; }
      const specs = expand(r), layout = layoutFor(specs.length);
      let sim;
      // Reject rare cocked/stacked poses before they can be shown.
      for (let attempt = 0; attempt < 5; attempt++) {
        sim = simulate(specs, layout);
        const separated = sim.dice.every((d, i) => sim.dice.slice(i + 1).every(e => Math.hypot(d.end.p.x - e.end.p.x, d.end.p.z - e.end.p.z) > 1.36));
        if (separated && sim.dice.every(d => d.correction < .15)) break;
        if (attempt === 4) throw new Error('La trayectoria no termina despejada');
      }
      active = { dice: sim.dice, layout };
      makeTray(layout); resize();
      sim.dice.forEach(makeDie);
      const duration = Math.min(2350, Math.max(1450, sim.steps * DT * 1000));
      if (reduced()) { sim.dice.forEach(d => displayFrame(d, d.frames.length - 1)); render(); }
      else await play(sim, duration);
      if (lost) { await showFallback(r); return raw; }
      if (r.sides === 20 && r.advantage !== 'normal' && sim.dice.length === 2) {
        const keep = r.values.indexOf(r.kept[0]);
        sim.dice.forEach((d, i) => { d.ring.visible = i === keep; if (i !== keep) { d.material.color.multiplyScalar(.60); d.edges.material.opacity = .25; d.labels.forEach(l => { l.material.opacity = .50; }); } });
      }
      status.textContent = finalText(r); render();
      lastReport = report(sim, r, reduced() ? 0 : duration);
      window.dispatchEvent(new CustomEvent('rasthoria:dice-settled', { detail: lastReport }));
      await wait(reduced() ? 650 : 800);
      return raw;
    } catch (error) {
      console.warn('Dados: resultado simple tras fallo visual.', error); await showFallback(r); return raw;
    } finally { finish(); }
  }
  function apiRoll(raw, opts = {}) {
    // Returning the same in-flight presentation prevents double animations, not game rolls.
    if (raw && typeof raw === 'object' && inFlight.has(raw)) return inFlight.get(raw);
    unlockAudio();
    const task = () => animate(raw, opts), promise = queue.then(task, task);
    queue = promise.catch(() => {});
    if (raw && typeof raw === 'object') { inFlight.set(raw, promise); promise.finally(() => inFlight.delete(raw)).catch(() => {}); }
    return promise;
  }
  function test(sides = 20, value = sides, count = 1, modifier = 0, advantage = 'normal') {
    const values = Array.from({ length: advantage === 'normal' ? count : 2 }, (_, i) => i ? 1 + Math.floor(random() * sides) : value);
    const kept = advantage === 'advantage' ? [Math.max(...values)] : advantage === 'disadvantage' ? [Math.min(...values)] : values.slice();
    return apiRoll({ sides, values, kept, count, modifier, advantage, total: kept.reduce((a, b) => a + b, 0) + modifier, purpose: 'Prueba de dados' });
  }
  function boot() {
    createDOM(); initScene();
    // ready also means the functional fallback is ready; callers never need to branch.
    document.documentElement.classList.add('ras-dice-ready');
    window.RASTHORIA_DICE = { ready: true, version: VERSION, roll: apiRoll, test, mute: setMuted,
      get muted() { return muted; }, get lastReport() { return lastReport; },
      get diagnostics() { return { active: !!active, frameCount, webgl: !!renderer && !lost, textures: textures.size }; } };
    window.dispatchEvent(new CustomEvent('rasthoria:dice-ready', { detail: { version: VERSION } }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
