(() => {
  if (window.__rasthoriaMultiAIv16) return;
  window.__rasthoriaMultiAIv16 = true;

  const WORKER = "https://rasthoria-cloud-dm.o-sariego.workers.dev";
  const PREF_KEY = "rasthoria.ai.provider.v16";
  const LOCAL_KEY = "rasthoria.ai.apiKey.v16";
  const SESSION_KEY = "rasthoria.ai.apiKey.session.v16";
  const nativeFetch = window.fetch.bind(window);
  const defaults = {
    cloudflare: { model: "@cf/qwen/qwen3-30b-a3b-fp8", label: "RASTHOR·IA Gratis" },
    openai: { model: "gpt-5.6-luna", label: "OpenAI" },
    gemini: { model: "gemini-3.8-flash", label: "Gemini" },
  };
  const modelOptions = {
    openai: [
      ["gpt-5.6-luna","GPT-5.6 Luna · económico y rápido"],
      ["gpt-5.6-terra","GPT-5.6 Terra · equilibrio"],
      ["gpt-5.6-sol","GPT-5.6 Sol · máxima calidad"],
    ],
    gemini: [
      ["gemini-3.8-flash","Gemini 3.8 Flash · recomendado"],
      ["gemini-3.6-flash","Gemini 3.6 Flash"],
      ["gemini-2.5-flash-lite","Gemini 2.5 Flash-Lite · económico"],
    ],
  };

  function readPrefs() {
    let p={};
    try { p=JSON.parse(localStorage.getItem(PREF_KEY)||"{}"); } catch {}
    const provider=["cloudflare","openai","gemini"].includes(p.provider)?p.provider:"cloudflare";
    return {provider,model:String(p.model||defaults[provider].model),remember:p.remember!==false};
  }
  function readKey(prefs=readPrefs()) {
    if(prefs.provider==="cloudflare") return "";
    try {
      const value=prefs.remember?localStorage.getItem(LOCAL_KEY):sessionStorage.getItem(SESSION_KEY);
      return String(value||"");
    } catch { return ""; }
  }
  function writeConfig({provider,model,key,remember}) {
    const prefs={provider,model:model||defaults[provider].model,remember:Boolean(remember)};
    try {
      localStorage.setItem(PREF_KEY,JSON.stringify(prefs));
      if(provider==="cloudflare") {
        localStorage.removeItem(LOCAL_KEY);sessionStorage.removeItem(SESSION_KEY);
      } else if(remember) {
        localStorage.setItem(LOCAL_KEY,key||"");sessionStorage.removeItem(SESSION_KEY);
      } else {
        sessionStorage.setItem(SESSION_KEY,key||"");localStorage.removeItem(LOCAL_KEY);
      }
    } catch {}
    updateBadge();
    window.dispatchEvent(new CustomEvent("rasthoria-ai-provider-changed",{detail:{provider:prefs.provider,model:prefs.model}}));
  }
  function workerUrl(input) {
    try { return new URL(typeof input==="string"?input:input?.url,location.href); } catch { return null; }
  }
  function isWorkerRequest(input) {
    const u=workerUrl(input);
    return !!u && u.origin===WORKER;
  }
  function configHeaders(baseHeaders) {
    const prefs=readPrefs();
    const headers=new Headers(baseHeaders||{});
    headers.set("X-Rasthoria-AI-Provider",prefs.provider);
    headers.set("X-Rasthoria-AI-Model",prefs.model||defaults[prefs.provider].model);
    const key=readKey(prefs);
    if(key && prefs.provider!=="cloudflare") headers.set("X-Rasthoria-AI-Key",key);
    else headers.delete("X-Rasthoria-AI-Key");
    return headers;
  }

  let toastTimer=0;
  function toast(message) {
    let el=document.querySelector(".ras-ai-toast");
    if(!el){el=document.createElement("div");el.className="ras-ai-toast";document.body.appendChild(el)}
    el.textContent=String(message||"El Narrador no pudo responder.");
    el.classList.add("is-visible");
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("is-visible"),6500);
    const btn=document.querySelector(".ras-ai-provider-button");if(btn) btn.classList.add("is-error");
  }

  window.fetch = async function(input, init={}) {
    let nextInit=init||{};
    if(isWorkerRequest(input)) {
      const existing=input instanceof Request?input.headers:undefined;
      const merged=new Headers(existing||{});
      new Headers(nextInit.headers||{}).forEach((v,k)=>merged.set(k,v));
      nextInit={...nextInit,headers:configHeaders(merged)};
    }
    const response=await nativeFetch(input,nextInit);
    if(isWorkerRequest(input)) {
      response.clone().json().then(data=>{
        if(!response.ok && data?.error) toast(data.error);
        else if(response.ok && data?.degradedReason==="quota" && readPrefs().provider==="cloudflare") toast("La cuota del Narrador gratuito se agotó. Puedes continuar ahora mismo cambiando a OpenAI o Gemini desde Narrador IA.");
      }).catch(()=>{});
    }
    return response;
  };

  function labelFor(provider) { return defaults[provider]?.label||"Narrador IA"; }
  function updateBadge() {
    const btn=document.querySelector(".ras-ai-provider-button"); if(!btn) return;
    const prefs=readPrefs();
    btn.dataset.provider=prefs.provider;
    btn.classList.remove("is-error");
    const short=prefs.provider==="cloudflare"?"Gratis":prefs.provider==="openai"?"OpenAI":"Gemini";
    btn.innerHTML=`<span class="ras-ai-dot"></span><span>Narrador IA</span><small>${short}</small>`;
    btn.title=`Narrador actual: ${labelFor(prefs.provider)} · ${prefs.model}`;
  }

  function createDialog() {
    let back=document.querySelector(".ras-ai-backdrop"); if(back) return back;
    back=document.createElement("div");back.className="ras-ai-backdrop";back.hidden=true;
    back.innerHTML=`
      <section class="ras-ai-dialog" role="dialog" aria-modal="true" aria-labelledby="ras-ai-title">
        <header class="ras-ai-dialog-header"><div><h2 id="ras-ai-title">Narrador IA</h2><p>Elige qué inteligencia escribe tu aventura. El mundo, los dados y los guardados siguen siendo de RASTHOR·IA.</p></div><button class="ras-ai-close" type="button" aria-label="Cerrar">×</button></header>
        <div class="ras-ai-body">
          <div class="ras-ai-provider-list">
            <button class="ras-ai-card" type="button" data-ai-card="cloudflare"><em>sin clave</em><b>RASTHOR·IA Gratis</b><span>Usa Workers AI de la página. Fácil, pero comparte una cuota diaria limitada.</span></button>
            <button class="ras-ai-card" type="button" data-ai-card="openai"><b>OpenAI</b><span>Usa tu propia clave de OpenAI API. El consumo corresponde a tu cuenta de API.</span></button>
            <button class="ras-ai-card" type="button" data-ai-card="gemini"><b>Gemini</b><span>Usa tu propia clave de Gemini API / Google AI Studio y sus límites.</span></button>
          </div>
          <div class="ras-ai-fields">
            <div class="ras-ai-field" data-ai-model-field><label>Modelo</label><select data-ai-model></select></div>
            <div class="ras-ai-field" data-ai-key-field><label>Clave API</label><div class="ras-ai-key-wrap"><input data-ai-key type="password" autocomplete="off" spellcheck="false" placeholder="Pega aquí tu clave API"><button type="button" data-ai-reveal title="Mostrar / ocultar">◉</button></div><div class="ras-ai-help" data-ai-help></div></div>
            <label class="ras-ai-remember"><input data-ai-remember type="checkbox"> Guardar la clave en este dispositivo</label>
            <div class="ras-ai-privacy"><b>Privacidad:</b> la clave queda en tu navegador si eliges guardarla. RASTHOR·IA la envía cifrada por HTTPS al Worker únicamente para reenviar cada solicitud al proveedor elegido; el Worker no la guarda en base de datos ni la escribe en las respuestas.</div>
            <div class="ras-ai-status" data-ai-status>Selecciona un proveedor. Puedes probarlo antes de guardar.</div>
            <div class="ras-ai-actions"><button class="ras-ai-test" type="button" data-ai-test>Probar conexión</button><button class="ras-ai-save" type="button" data-ai-save>Guardar y usar</button></div>
          </div>
        </div>
      </section>`;
    document.body.appendChild(back);
    const close=()=>{back.hidden=true;document.body.style.overflow=""};
    back.querySelector(".ras-ai-close").addEventListener("click",close);
    back.addEventListener("click",e=>{if(e.target===back)close()});
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!back.hidden)close()},true);
    back.querySelectorAll("[data-ai-card]").forEach(b=>b.addEventListener("click",()=>{back.dataset.provider=b.dataset.aiCard;refreshDialog(back)}));
    back.querySelector("[data-ai-reveal]").addEventListener("click",()=>{const i=back.querySelector("[data-ai-key]");i.type=i.type==="password"?"text":"password"});
    back.querySelector("[data-ai-test]").addEventListener("click",()=>testFromDialog(back));
    back.querySelector("[data-ai-save]").addEventListener("click",()=>saveFromDialog(back,close));
    return back;
  }

  function fillModelSelect(back,provider,current) {
    const select=back.querySelector("[data-ai-model]");select.textContent="";
    if(provider==="cloudflare") {
      const o=document.createElement("option");o.value=defaults.cloudflare.model;o.textContent="Qwen3 30B-A3B · gestionado por RASTHOR·IA";select.appendChild(o);select.disabled=true;return;
    }
    select.disabled=false;
    for(const [value,label] of modelOptions[provider]) {const o=document.createElement("option");o.value=value;o.textContent=label;select.appendChild(o)}
    if([...select.options].some(o=>o.value===current)) select.value=current; else select.value=defaults[provider].model;
  }
  function refreshDialog(back) {
    const prefs=readPrefs(); const provider=back.dataset.provider||prefs.provider;
    back.querySelectorAll("[data-ai-card]").forEach(x=>x.classList.toggle("is-selected",x.dataset.aiCard===provider));
    const keyField=back.querySelector("[data-ai-key-field]");
    const remember=back.querySelector("[data-ai-remember]");
    const rememberRow=remember.closest(".ras-ai-remember");
    keyField.style.display=provider==="cloudflare"?"none":"grid";rememberRow.style.display=provider==="cloudflare"?"none":"flex";
    const desiredModel=(provider===prefs.provider?prefs.model:defaults[provider].model);
    fillModelSelect(back,provider,desiredModel);
    const help=back.querySelector("[data-ai-help]");
    if(provider==="openai") help.innerHTML='Necesitas una clave de <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">OpenAI API</a>. ChatGPT Plus/Pro y la API se facturan por separado.';
    else if(provider==="gemini") help.innerHTML='Puedes crear una clave en <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">Google AI Studio</a>. Se aplican los límites de tu proyecto de Gemini API.';
    else help.textContent="No necesitas configurar nada. Esta opción depende de la cuota gratuita compartida de RASTHOR·IA.";
  }

  function openDialog() {
    const back=createDialog(); const prefs=readPrefs();back.dataset.provider=prefs.provider;
    const key=back.querySelector("[data-ai-key]");key.value=readKey(prefs);key.type="password";
    back.querySelector("[data-ai-remember]").checked=prefs.remember;
    const status=back.querySelector("[data-ai-status]");status.className="ras-ai-status";status.textContent=prefs.provider==="cloudflare"?"Actual: RASTHOR·IA Gratis. Puedes cambiar cuando quieras sin perder la campaña.":`Actual: ${labelFor(prefs.provider)} · ${prefs.model}`;
    refreshDialog(back);back.hidden=false;document.body.style.overflow="hidden";
  }

  async function testFromDialog(back) {
    const provider=back.dataset.provider||"cloudflare";
    const model=back.querySelector("[data-ai-model]").value||defaults[provider].model;
    const key=back.querySelector("[data-ai-key]").value.trim();
    const status=back.querySelector("[data-ai-status]");const button=back.querySelector("[data-ai-test]");
    if(provider!=="cloudflare"&&!key){status.className="ras-ai-status is-error";status.textContent="Pega primero una clave API.";return}
    button.disabled=true;status.className="ras-ai-status";status.textContent="Probando el Narrador…";
    try {
      const headers={"Content-Type":"application/json","X-Rasthoria-AI-Provider":provider,"X-Rasthoria-AI-Model":model};
      if(key) headers["X-Rasthoria-AI-Key"]=key;
      const res=await nativeFetch(WORKER+"/api/provider-test",{method:"POST",headers,body:"{}"});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.ok) throw new Error(data.error||"No se pudo conectar.");
      status.className="ras-ai-status is-ok";status.textContent=`Conexión correcta · ${labelFor(provider)} · ${data.model||model}`;
    } catch(error) {status.className="ras-ai-status is-error";status.textContent=error?.message||"No se pudo conectar."}
    finally{button.disabled=false}
  }

  function saveFromDialog(back,close) {
    const provider=back.dataset.provider||"cloudflare";
    const model=back.querySelector("[data-ai-model]").value||defaults[provider].model;
    const key=back.querySelector("[data-ai-key]").value.trim();
    const remember=back.querySelector("[data-ai-remember]").checked;
    const status=back.querySelector("[data-ai-status]");
    if(provider!=="cloudflare"&&!key){status.className="ras-ai-status is-error";status.textContent="Necesitas una clave API para usar este proveedor.";return}
    writeConfig({provider,model,key,remember});close();toast(`Narrador cambiado a ${labelFor(provider)}.`);
    const btn=document.querySelector(".ras-ai-provider-button");if(btn)btn.classList.remove("is-error");
  }

  function ensureButton() {
    if(document.querySelector(".ras-ai-provider-button")) return;
    const btn=document.createElement("button");btn.type="button";btn.className="ras-ai-provider-button";btn.addEventListener("click",openDialog);document.body.appendChild(btn);updateBadge();
  }
  const boot=()=>{ensureButton();new MutationObserver(ensureButton).observe(document.body,{childList:true,subtree:true})};
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot,{once:true}); else boot();
})();
