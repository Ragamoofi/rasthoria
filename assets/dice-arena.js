/* RASTHOR·IA Dice Arena v2.0
 * Cinematic deterministic dice renderer.
 * Visual only: the game engine remains the authority for RNG and rules.
 */
(function(){
  'use strict';

  const VERSION='2.0.0';
  const MAX_VISUAL_DICE=12;
  const REDUCED=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
  const T=window.THREE;
  const delay=(ms)=>new Promise(r=>setTimeout(r,ms));

  function fallbackAPI(){
    window.RASTHORIA_DICE={
      ready:false,version:VERSION,
      async roll(){await delay(900)},
      async test(sides=20,value=20,count=1){await delay(900);return {sides,value,count}}
    };
  }
  if(!T||!T.WebGLRenderer){fallbackAPI();return}

  let renderer,scene,camera,floor,tableBorder,keyLight,rimLight,ambientLight;
  let overlay,canvasWrap,titleEl,notationEl,resultEl,resultMain,resultDetail,soundButton;
  let queue=Promise.resolve();
  let muted=localStorage.getItem('rasthoria-dice-muted')==='1';
  let audioCtx=null,lastImpactAt=0;
  const labelTextureCache=new Map();

  const V3=()=>new T.Vector3();
  const UP=new T.Vector3(0,1,0);
  const ZP=new T.Vector3(0,0,1);

  function createDOM(){
    overlay=document.createElement('div');
    overlay.id='ras-dice-arena';
    overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML=`
      <div class="ras-dice-canvas-wrap"></div>
      <div class="ras-dice-hud">
        <div class="ras-dice-kicker">RASTHOR·IA · EL DESTINO SE TIRA</div>
        <h2 class="ras-dice-title">Tirada</h2>
        <div class="ras-dice-notation">D20</div>
      </div>
      <div class="ras-dice-stage-spacer"></div>
      <div class="ras-dice-result-wrap">
        <div class="ras-dice-result" role="status" aria-live="polite">
          <div class="ras-dice-result-main"></div>
          <div class="ras-dice-result-detail"></div>
        </div>
      </div>
      <button class="ras-dice-sound" type="button" aria-label="Activar o silenciar sonido de dados" title="Sonido de dados">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11 5 6.7 8.5H3.8v7h2.9L11 19V5Z"></path>
          <path class="ras-sound-wave" d="M15 8.2a5 5 0 0 1 0 7.6"></path>
          <path class="ras-sound-wave" d="M17.8 5.8a8.4 8.4 0 0 1 0 12.4"></path>
          <path class="ras-sound-slash" d="m15.3 9 5 5"></path>
          <path class="ras-sound-slash" d="m20.3 9-5 5"></path>
        </svg>
      </button>`;
    document.body.appendChild(overlay);
    canvasWrap=overlay.querySelector('.ras-dice-canvas-wrap');
    titleEl=overlay.querySelector('.ras-dice-title');
    notationEl=overlay.querySelector('.ras-dice-notation');
    resultEl=overlay.querySelector('.ras-dice-result');
    resultMain=overlay.querySelector('.ras-dice-result-main');
    resultDetail=overlay.querySelector('.ras-dice-result-detail');
    soundButton=overlay.querySelector('.ras-dice-sound');
    soundButton.classList.toggle('is-muted',muted);
    soundButton.addEventListener('click',()=>{
      muted=!muted;
      localStorage.setItem('rasthoria-dice-muted',muted?'1':'0');
      soundButton.classList.toggle('is-muted',muted);
      if(!muted) playImpact(.42,true);
    });
  }

  function initScene(){
    try{
      renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
    }catch(err){console.warn('RASTHOR·IA Dice: WebGL unavailable',err);fallbackAPI();return false}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,matchMedia('(max-width:700px)').matches?1.25:1.6));
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=T.PCFSoftShadowMap;
    renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.02;
    canvasWrap.appendChild(renderer.domElement);

    scene=new T.Scene();
    camera=new T.PerspectiveCamera(31,1,.1,60);

    ambientLight=new T.HemisphereLight(0xf5d7a8,0x0a0710,1.28);
    scene.add(ambientLight);

    keyLight=new T.SpotLight(0xffd6a1,44,28,Math.PI/5,.5,1.4);
    keyLight.position.set(3.8,8.5,5.2);
    keyLight.castShadow=true;
    keyLight.shadow.mapSize.set(1024,1024);
    keyLight.shadow.bias=-.00035;
    keyLight.target.position.set(0,0,0);
    scene.add(keyLight,keyLight.target);

    rimLight=new T.PointLight(0x8b5b9f,15,20,2);
    rimLight.position.set(-5.2,3.6,-3.2);
    scene.add(rimLight);

    const floorMat=new T.MeshPhysicalMaterial({
      color:0x151215,roughness:.87,metalness:.02,clearcoat:.08,clearcoatRoughness:.8
    });
    floor=new T.Mesh(new T.PlaneGeometry(10.4,6.7),floorMat);
    floor.rotation.x=-Math.PI/2;
    floor.position.y=0;
    floor.receiveShadow=true;
    scene.add(floor);

    const borderGeo=new T.BufferGeometry();
    borderGeo.setFromPoints([
      new T.Vector3(-5.02,.014,-3.14),new T.Vector3(5.02,.014,-3.14),
      new T.Vector3(5.02,.014,3.14),new T.Vector3(-5.02,.014,3.14),
      new T.Vector3(-5.02,.014,-3.14)
    ]);
    tableBorder=new T.Line(borderGeo,new T.LineBasicMaterial({color:0x8e6840,transparent:true,opacity:.34}));
    scene.add(tableBorder);

    // Decorative inlaid lines on the table, subtle enough not to fight the dice.
    const inlayMat=new T.LineBasicMaterial({color:0x5f4936,transparent:true,opacity:.15});
    for(const z of [-2.2,2.2]){
      const g=new T.BufferGeometry().setFromPoints([new T.Vector3(-4.6,.01,z),new T.Vector3(4.6,.01,z)]);
      scene.add(new T.Line(g,inlayMat));
    }

    resize();
    window.addEventListener('resize',resize,{passive:true});
    return true;
  }

  function resize(){
    if(!renderer)return;
    const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);
    renderer.setSize(w,h,false);
    camera.aspect=w/h;
    if(w/h<.78){
      camera.position.set(0,9.1,10.8);
      camera.fov=38;
    }else{
      camera.position.set(0,7.2,9.15);
      camera.fov=31;
    }
    camera.lookAt(0,.55,0);
    camera.updateProjectionMatrix();
  }

  function makeLabelTexture(text,accent=false){
    const key=`${text}|${accent?'a':'n'}`;
    if(labelTextureCache.has(key))return labelTextureCache.get(key);
    const c=document.createElement('canvas');c.width=c.height=256;
    const x=c.getContext('2d');
    x.clearRect(0,0,256,256);
    x.textAlign='center';x.textBaseline='middle';
    const size=String(text).length>2?92:String(text).length>1?116:142;
    x.font=`700 ${size}px Georgia, serif`;
    x.lineJoin='round';
    x.shadowColor='rgba(0,0,0,.78)';x.shadowBlur=13;x.shadowOffsetY=7;
    x.strokeStyle='rgba(35,19,8,.94)';x.lineWidth=14;
    x.strokeText(String(text),128,126);
    x.shadowBlur=0;x.shadowOffsetY=0;
    x.fillStyle=accent?'#ffe1a7':'#e8c48d';
    x.fillText(String(text),128,126);
    x.strokeStyle='rgba(255,239,204,.20)';x.lineWidth=2;
    x.strokeText(String(text),128,126);
    const tex=new T.CanvasTexture(c);
    tex.colorSpace=T.SRGBColorSpace;
    tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy?.()||1);
    tex.needsUpdate=true;
    labelTextureCache.set(key,tex);
    return tex;
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

  function d10GeometryAndFaces(){
    const s5=Math.sqrt(5),C0=(s5-1)/4,C1=(s5+1)/4,C2=(s5+3)/4;
    const verts=[
      [0,C0,C1],[0,C0,-C1],[0,-C0,C1],[0,-C0,-C1],
      [.5,.5,.5],[.5,.5,-.5],[-.5,-.5,.5],[-.5,-.5,-.5],
      [C2,-C1,0],[-C2,C1,0],[C0,C1,0],[-C0,-C1,0]
    ];
    const faces=[
      [8,2,6,11],[8,11,7,3],[8,3,1,5],[8,5,10,4],[8,4,0,2],
      [9,0,4,10],[9,10,5,1],[9,1,3,7],[9,7,11,6],[9,6,2,0]
    ];
    const positions=[];
    const anchors=[];
    for(const f of faces){
      const p=f.map(i=>new T.Vector3(...verts[i]));
      positions.push(...p[0].toArray(),...p[1].toArray(),...p[2].toArray());
      positions.push(...p[0].toArray(),...p[2].toArray(),...p[3].toArray());
      const center=p.reduce((acc,v)=>acc.add(v),new T.Vector3()).multiplyScalar(.25);
      const normal=new T.Vector3().crossVectors(new T.Vector3().subVectors(p[1],p[0]),new T.Vector3().subVectors(p[2],p[0])).normalize();
      if(normal.dot(center)<0)normal.multiplyScalar(-1);
      anchors.push({normal,center,area:1,plane:normal.dot(center)});
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    g.computeVertexNormals();g.computeBoundingSphere();
    return {geometry:g,faces:anchors};
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

  function labelSizeFor(sides){return ({4:.56,6:.62,8:.52,10:.47,12:.40,20:.31})[sides]||.4}

  function makeDie({sides,target,valuesOverride=null,percentileKind=null,index=0}){
    const spec=geometryFor(sides);
    const values=valuesOverride||Array.from({length:sides},(_,i)=>i+1);
    const faces=assignValuesToFaces(spec.faces,values);
    const group=new T.Group();

    const variants=[0x32251f,0x282127,0x34291f,0x24282a];
    const bodyColor=percentileKind==='tens'?0x443020:variants[index%variants.length];
    const bodyMat=new T.MeshPhysicalMaterial({
      color:bodyColor,roughness:.24,metalness:.20,clearcoat:.92,clearcoatRoughness:.10,
      emissive:0x110b08,emissiveIntensity:.28,transparent:true,opacity:1
    });
    const mesh=new T.Mesh(spec.geometry,bodyMat);
    mesh.castShadow=true;mesh.receiveShadow=false;
    group.add(mesh);

    const edgeMat=new T.LineBasicMaterial({color:0xc09359,transparent:true,opacity:.64});
    const edges=new T.LineSegments(new T.EdgesGeometry(spec.geometry,20),edgeMat);
    edges.renderOrder=2;group.add(edges);

    const labels=[];
    const planeGeo=new T.PlaneGeometry(1,1);
    const size=labelSizeFor(sides);
    for(const face of faces){
      const labelText=percentileKind==='tens'?(Number(face.value)===0?'00':String(face.value)):String(face.value);
      const mat=new T.MeshBasicMaterial({map:makeLabelTexture(labelText),transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false});
      const plane=new T.Mesh(planeGeo,mat);
      plane.scale.setScalar(size);
      plane.position.copy(face.center).addScaledVector(face.normal,.018);
      plane.quaternion.setFromUnitVectors(ZP,face.normal);
      plane.renderOrder=3;
      group.add(plane);labels.push({mesh:plane,mat,face});
    }

    spec.geometry.computeBoundingSphere();
    const baseRadius=spec.geometry.boundingSphere?.radius||1.1;
    const scale=sides===20?.84:sides===12?.82:sides===10?.84:sides===8?.82:sides===6?.78:.82;
    group.scale.setScalar(scale);

    const face=faces.find(f=>Number(f.value)===Number(target))||faces[0];
    const vertexList=[];
    const pos=spec.geometry.getAttribute('position');
    for(let i=0;i<pos.count;i++)vertexList.push(new T.Vector3().fromBufferAttribute(pos,i));

    return {
      group,mesh,bodyMat,edgeMat,labels,planeGeo,geometry:spec.geometry,
      target,face,scale,baseRadius,collisionRadius:baseRadius*scale*.72,
      vertexList,position:new T.Vector3(),velocity:new T.Vector3(),angular:new T.Vector3(),
      targetQ:new T.Quaternion(),targetY:scale*.7,targetPos:new T.Vector3(),settleReady:false,
      discarded:false,kept:false,percentileKind
    };
  }

  function supportHeight(die,q){
    let minY=Infinity;
    const v=new T.Vector3();
    for(const raw of die.vertexList){
      v.copy(raw).applyQuaternion(q).multiplyScalar(die.scale);
      if(v.y<minY)minY=v.y;
    }
    return Math.max(.25,-minY+.022);
  }

  function prepareTarget(die){
    const current=die.group.quaternion.clone();
    const worldN=die.face.normal.clone().applyQuaternion(current).normalize();
    const align=new T.Quaternion().setFromUnitVectors(worldN,UP);
    die.targetQ.copy(align.multiply(current));
    const yaw=new T.Quaternion().setFromAxisAngle(UP,(Math.random()-.5)*1.4);
    die.targetQ.premultiply(yaw).normalize();
    die.targetY=supportHeight(die,die.targetQ);
    die.targetPos.set(die.position.x,die.targetY,die.position.z);
    die.settleReady=true;
  }

  function setDiscarded(die,discard){
    die.discarded=discard;
    if(discard){
      die.bodyMat.opacity=.34;die.edgeMat.opacity=.22;
      die.labels.forEach(x=>x.mat.opacity=.38);
    }else{
      die.bodyMat.opacity=1;die.edgeMat.opacity=.92;
      die.bodyMat.emissive.setHex(0x3a2009);die.bodyMat.emissiveIntensity=.55;
      die.labels.forEach(x=>x.mat.opacity=1);
    }
  }

  function normalizeRoll(input){
    const r=input&&typeof input==='object'?input:{};
    const sides=[4,6,8,10,12,20,100].includes(Number(r.sides))?Number(r.sides):20;
    let values=Array.isArray(r.values)?r.values.map(Number).filter(Number.isFinite):[];
    if(!values.length){
      const n=Math.max(1,Math.min(6,Number(r.count)||1));
      values=Array.from({length:n},()=>1+Math.floor(Math.random()*sides));
    }
    return {
      sides,count:Number(r.count)||values.length,values,kept:Array.isArray(r.kept)?r.kept.map(Number):values,
      modifier:Number(r.modifier)||0,total:Number.isFinite(Number(r.total))?Number(r.total):values.reduce((a,b)=>a+b,0)+(Number(r.modifier)||0),
      natural:r.natural==null?null:Number(r.natural),advantage:r.advantage||'normal',success:r.success,critical:!!r.critical,
      purpose:String(r.purpose||r.reason||'Tirada'),actor:r.actor||'player',dc:r.dc
    };
  }

  function expandVisualDice(roll){
    const specs=[];
    if(roll.sides===100){
      for(const v of roll.values){
        const value=v===100?0:v;
        const tens=value===0?0:Math.floor(value/10)*10;
        const ones=value===0?0:value%10;
        specs.push({sides:10,target:tens,valuesOverride:[0,10,20,30,40,50,60,70,80,90],percentileKind:'tens'});
        specs.push({sides:10,target:ones,valuesOverride:[0,1,2,3,4,5,6,7,8,9],percentileKind:'ones'});
      }
    }else{
      roll.values.forEach(v=>specs.push({sides:roll.sides,target:v}));
    }
    return specs.slice(0,MAX_VISUAL_DICE);
  }

  function titleFor(roll){
    const s=roll.purpose.toLocaleLowerCase('es');
    if(s.includes('iniciativa'))return 'Iniciativa';
    if(s.includes('ataque'))return 'Tirada de ataque';
    if(s.includes('daño')||s.includes('dano'))return 'Daño';
    if(s.includes('muerte'))return 'Salvación contra la muerte';
    if(s.includes('salv'))return 'Salvación';
    if(s.includes('libre'))return 'Tirada libre';
    if(s.includes('cur'))return 'Recuperación';
    return roll.purpose.length>70?'El destino decide':roll.purpose;
  }

  function signed(n){return n>0?`+${n}`:n<0?String(n):'+0'}
  function notationFor(r){
    if(r.sides===20&&r.advantage==='advantage')return `2D20 · VENTAJA · ${signed(r.modifier)}`;
    if(r.sides===20&&r.advantage==='disadvantage')return `2D20 · DESVENTAJA · ${signed(r.modifier)}`;
    return `${r.count}D${r.sides} · ${signed(r.modifier)}`;
  }

  function verdictFor(r){
    if(r.critical)return 'CRÍTICO';
    if(r.sides===20&&r.count===1&&r.natural===1)return '1 NATURAL';
    if(r.success===true)return 'ÉXITO';
    if(r.success===false)return 'FALLO';
    return '';
  }

  function showResult(r){
    const verdict=verdictFor(r);
    const shown=r.sides===20&&r.count===1&&r.natural!=null?r.natural:r.total;
    const modPart=r.modifier?` ${signed(r.modifier)}`:'';
    resultMain.innerHTML=`<span>Resultado</span><strong>${escapeHTML(String(shown))}</strong>${r.sides===20&&r.count===1&&r.natural!=null&&r.total!==r.natural?`<span>${escapeHTML(modPart)} = ${escapeHTML(String(r.total))}</span>`:''}${verdict?`<span class="ras-dice-verdict">${escapeHTML(verdict)}</span>`:''}`;
    let detail=`[${r.values.join(', ')}]`;
    if(r.advantage!=='normal'&&r.kept?.length)detail+=` → conserva ${r.kept[0]}`;
    if(!(r.sides===20&&r.count===1&&r.natural!=null))detail+=` ${signed(r.modifier)} = ${r.total}`;
    if(r.dc!=null)detail+=` · objetivo ${r.dc}`;
    resultDetail.textContent=detail;
    overlay.classList.toggle('is-critical',!!r.critical);
    overlay.classList.toggle('is-fumble',r.sides===20&&r.count===1&&r.natural===1);
    overlay.classList.add('has-result');
  }

  function escapeHTML(s){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

  function ensureAudio(){
    if(muted)return null;
    try{
      if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
      if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});
      return audioCtx;
    }catch{return null}
  }

  function playImpact(strength=.5,force=false){
    const ctx=ensureAudio();if(!ctx)return;
    const now=performance.now();
    if(!force&&now-lastImpactAt<42)return;
    lastImpactAt=now;
    try{
      const dur=.045+.035*Math.min(1,strength);
      const len=Math.max(1,Math.floor(ctx.sampleRate*dur));
      const buf=ctx.createBuffer(1,len,ctx.sampleRate),data=buf.getChannelData(0);
      for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.5);
      const src=ctx.createBufferSource();src.buffer=buf;
      const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=600+strength*1250;bp.Q.value=.7;
      const gain=ctx.createGain();gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.018+.055*strength,ctx.currentTime+.003);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+dur);
      src.connect(bp).connect(gain).connect(ctx.destination);src.start();src.stop(ctx.currentTime+dur+.01);
      const osc=ctx.createOscillator(),og=ctx.createGain();osc.type='sine';osc.frequency.value=145+strength*95;og.gain.setValueAtTime(.012*strength,ctx.currentTime);og.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.045);osc.connect(og).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.05);
    }catch{}
  }

  function playThrow(){
    const ctx=ensureAudio();if(!ctx)return;
    try{
      const osc=ctx.createOscillator(),g=ctx.createGain();osc.type='triangle';osc.frequency.setValueAtTime(92,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(58,ctx.currentTime+.16);g.gain.setValueAtTime(.0001,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.022,ctx.currentTime+.018);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.17);osc.connect(g).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.18);
    }catch{}
  }

  function spawnDice(specs,roll){
    const dice=specs.map((s,i)=>makeDie({...s,index:i}));
    const n=dice.length;
    const wide=innerWidth/innerHeight>.8;
    const xSpread=wide?Math.min(3.2,.57*n):Math.min(1.8,.45*n);
    dice.forEach((d,i)=>{
      const frac=n===1?.5:i/(n-1);
      d.position.set((frac-.5)*xSpread+(Math.random()-.5)*.52,3.9+Math.random()*1.35,-2.05+(Math.random()-.5)*.55);
      d.velocity.set((Math.random()-.5)*2.15,-.55-Math.random()*.55,3.4+Math.random()*2.15);
      d.angular.set((Math.random()-.5)*14,(Math.random()-.5)*16,(Math.random()-.5)*13);
      d.group.position.copy(d.position);
      d.group.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
      scene.add(d.group);
    });

    if(roll.sides===20&&roll.advantage!=='normal'&&dice.length>=2){
      const keep=roll.kept?.[0];
      let keptIndex=roll.values.findIndex(v=>Number(v)===Number(keep));
      if(keptIndex<0)keptIndex=0;
      dice.forEach((d,i)=>d.kept=i===keptIndex);
    }
    return dice;
  }

  function collideDice(dice){
    for(let i=0;i<dice.length;i++)for(let j=i+1;j<dice.length;j++){
      const a=dice[i],b=dice[j];
      const delta=new T.Vector3().subVectors(b.position,a.position);
      const min=a.collisionRadius+b.collisionRadius;
      const dist=delta.length();
      if(dist>0&&dist<min){
        const n=delta.multiplyScalar(1/dist);
        const penetration=min-dist;
        a.position.addScaledVector(n,-penetration*.5);b.position.addScaledVector(n,penetration*.5);
        const rel=new T.Vector3().subVectors(b.velocity,a.velocity);
        const sep=rel.dot(n);
        if(sep<0){
          const impulse=-sep*.72;
          a.velocity.addScaledVector(n,-impulse);b.velocity.addScaledVector(n,impulse);
          a.angular.add(new T.Vector3((Math.random()-.5)*2,(Math.random()-.5)*2,(Math.random()-.5)*2));
          b.angular.add(new T.Vector3((Math.random()-.5)*2,(Math.random()-.5)*2,(Math.random()-.5)*2));
          playImpact(Math.min(.65,Math.abs(sep)/7));
        }
      }
    }
  }

  function stepPhysical(dice,dt,tSec){
    const xBound=innerWidth/innerHeight<.8?2.35:4.15,zMin=-2.72,zMax=2.45;
    for(const d of dice){
      d.velocity.y-=13.8*dt;
      d.position.addScaledVector(d.velocity,dt);
      const floorY=d.collisionRadius*.72;
      if(d.position.y<floorY){
        const impact=Math.abs(d.velocity.y);
        d.position.y=floorY;
        if(d.velocity.y<0){
          d.velocity.y=-d.velocity.y*(impact>1.2?.43:.22);
          d.velocity.x*=.79;d.velocity.z*=.79;d.angular.multiplyScalar(.82);
          if(impact>.8)playImpact(Math.min(1,impact/8));
        }
      }
      if(d.position.x>xBound){d.position.x=xBound;d.velocity.x=-Math.abs(d.velocity.x)*.58;playImpact(.32)}
      if(d.position.x<-xBound){d.position.x=-xBound;d.velocity.x=Math.abs(d.velocity.x)*.58;playImpact(.32)}
      if(d.position.z>zMax){d.position.z=zMax;d.velocity.z=-Math.abs(d.velocity.z)*.55;playImpact(.28)}
      if(d.position.z<zMin){d.position.z=zMin;d.velocity.z=Math.abs(d.velocity.z)*.55;playImpact(.28)}
      const mag=d.angular.length();
      if(mag>.001){
        const dq=new T.Quaternion().setFromAxisAngle(d.angular.clone().normalize(),mag*dt);
        d.group.quaternion.premultiply(dq).normalize();
      }
      if(d.position.y<=floorY+.02){d.velocity.x*=Math.pow(.20,dt);d.velocity.z*=Math.pow(.20,dt);d.angular.multiplyScalar(Math.pow(.15,dt))}
      d.group.position.copy(d.position);
    }
    collideDice(dice);
  }

  function beginSettle(dice){
    dice.forEach((d,i)=>{
      prepareTarget(d);
      d.targetPos.x=Math.max(-3.6,Math.min(3.6,d.position.x));
      d.targetPos.z=Math.max(-2.1,Math.min(2.1,d.position.z));
      // Avoid a heap right in the exact center for multi-die rolls.
      if(dice.length>1){
        const spread=Math.min(2.8,.52*dice.length);
        d.targetPos.x+=(i-(dice.length-1)/2)*(spread/Math.max(1,dice.length-1))*.32;
      }
    });
  }

  function smoothstep(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)}

  function stepSettle(dice,p){
    const s=smoothstep(p);
    for(const d of dice){
      d.group.quaternion.slerp(d.targetQ,.09+.17*s);
      d.position.lerp(d.targetPos,.09+.17*s);
      // tiny final rocking gives a last physical-looking settle without changing the face.
      d.group.position.copy(d.position);
    }
  }

  function render(){renderer.render(scene,camera)}

  function cleanupDice(dice){
    for(const d of dice){
      scene.remove(d.group);
      d.bodyMat.dispose();d.edgeMat.dispose();d.geometry.dispose();d.planeGeo.dispose();
      d.labels.forEach(x=>x.mat.dispose());
      for(const child of d.group.children){if(child.geometry&&child.geometry!==d.geometry&&child.geometry!==d.planeGeo)child.geometry.dispose?.()}
    }
  }

  async function animateRoll(raw,opts={}){
    const roll=normalizeRoll(raw);
    ensureAudio();
    overlay.classList.remove('has-result','is-critical','is-fumble','is-closing');
    titleEl.textContent=titleFor(roll);
    notationEl.textContent=notationFor(roll);
    resultMain.textContent='';resultDetail.textContent='';
    overlay.setAttribute('aria-hidden','false');
    overlay.classList.add('is-open');
    document.documentElement.classList.add('ras-dice-cinematic');
    playThrow();

    const specs=expandVisualDice(roll);
    const dice=spawnDice(specs,roll);
    const physicalMs=REDUCED?180:1450;
    const settleMs=REDUCED?160:620;
    const holdMs=REDUCED?330:830;
    let settleStarted=false;
    const start=performance.now();
    let prev=start;

    await new Promise(resolve=>{
      function frame(now){
        const elapsed=now-start,dt=Math.min(.034,Math.max(.001,(now-prev)/1000));prev=now;
        if(elapsed<physicalMs){
          stepPhysical(dice,dt,elapsed/1000);
        }else if(elapsed<physicalMs+settleMs){
          if(!settleStarted){settleStarted=true;beginSettle(dice);playImpact(.76,true)}
          stepSettle(dice,(elapsed-physicalMs)/settleMs);
        }else{
          if(!settleStarted){settleStarted=true;beginSettle(dice)}
          dice.forEach(d=>{d.group.quaternion.copy(d.targetQ);d.position.copy(d.targetPos);d.group.position.copy(d.position)});
          render();resolve();return;
        }
        // A short critical light flare while dice are in motion.
        keyLight.intensity=roll.critical?48+Math.sin(elapsed*.025)*5:44;
        render();requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });

    if(roll.sides===20&&roll.advantage!=='normal'&&dice.length>=2){
      dice.forEach(d=>setDiscarded(d,!d.kept));
      render();
    }
    if(roll.critical){keyLight.intensity=60;setTimeout(()=>{if(keyLight)keyLight.intensity=44},180)}
    showResult(roll);
    playImpact(roll.critical?1:.68,true);
    await delay(holdMs);
    overlay.classList.add('is-closing');
    await delay(REDUCED?80:220);
    overlay.classList.remove('is-open','is-closing','has-result','is-critical','is-fumble');
    overlay.setAttribute('aria-hidden','true');
    document.documentElement.classList.remove('ras-dice-cinematic');
    cleanupDice(dice);
    keyLight.intensity=44;
    render();
    return roll;
  }

  function apiRoll(raw,opts){
    const task=()=>animateRoll(raw,opts).catch(err=>{console.error('RASTHOR·IA Dice roll failed',err);overlay?.classList.remove('is-open');document.documentElement.classList.remove('ras-dice-cinematic');return delay(650)});
    queue=queue.then(task,task);
    return queue;
  }

  function makeTestRoll(sides=20,value=null,count=1,modifier=0,advantage='normal'){
    sides=Number(sides);count=Math.max(1,Math.min(8,Number(count)||1));
    const rand=()=>1+Math.floor(Math.random()*sides);
    let values;
    if(advantage!=='normal'&&sides===20){values=[value??rand(),rand()];count=1}
    else values=Array.from({length:count},(_,i)=>i===0&&value!=null?Number(value):rand());
    const kept=advantage==='advantage'?[Math.max(...values)]:advantage==='disadvantage'?[Math.min(...values)]:values.slice();
    const natural=sides===20&&count===1?kept[0]:null;
    return {sides,count,values,kept,modifier:Number(modifier)||0,total:kept.reduce((a,b)=>a+b,0)+(Number(modifier)||0),natural,advantage,purpose:'Tirada de demostración',critical:sides===20&&natural===20,success:null,dc:null};
  }

  function boot(){
    createDOM();
    if(!initScene())return;
    document.documentElement.classList.add('ras-dice-ready');
    window.RASTHORIA_DICE={
      ready:true,version:VERSION,roll:apiRoll,
      test:(sides,value,count=1,modifier=0,advantage='normal')=>apiRoll(makeTestRoll(sides,value,count,modifier,advantage),{source:'lab'}),
      mute(v=true){muted=!!v;localStorage.setItem('rasthoria-dice-muted',muted?'1':'0');soundButton?.classList.toggle('is-muted',muted)},
      get muted(){return muted}
    };
    render();
    window.dispatchEvent(new CustomEvent('rasthoria:dice-ready',{detail:{version:VERSION}}));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
