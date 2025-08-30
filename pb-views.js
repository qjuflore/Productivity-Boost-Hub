<!-- pb-views.js -->
<script>
/*!
  PB Views — lightweight page views tracker (Hub + Tools)
  Author: qjuflore | Juan-ready
  v2025.08.30
*/
(function(global){
  const NS = 'pb.views';
  const CFG_KEY = NS + '.cfg';          // { endpoint, site, cooldownMins }
  const UID_KEY = NS + '.uid';          // anon uid
  const LOC_KEY = NS + '.local';        // { [pageId]: count }
  const LST_HIT = NS + '.last.';        // per-page ts
  const DEF_COOLDOWN = 30;              // minutes
  const LISTENERS = new Map();          // pageId -> Set(fn)
  const CACHE = new Map();              // pageId -> number

  function readJSON(key, def){ try{ return JSON.parse(localStorage.getItem(key) || JSON.stringify(def||null)); }catch(_){ return def||null; } }
  function writeJSON(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch(_){ } }
  function uid(){
    let id = localStorage.getItem(UID_KEY);
    if(!id){ id = 'u_' + Math.random().toString(36).slice(2) + Date.now(); localStorage.setItem(UID_KEY, id); }
    return id;
  }
  function now(){ return Date.now(); }

  function getCfg(){
    const cfg = readJSON(CFG_KEY, {}) || {};
    // auto-descubrir si el Hub expone global
    const glob = (global.PB_VIEWS_ENDPOINT || global.PB_VIEWS_CFG);
    if(glob){
      if(typeof glob === 'string') cfg.endpoint = glob;
      else if(typeof glob === 'object') Object.assign(cfg, glob);
    }
    // también permitir vía <meta name="pb-views-endpoint">
    if(!cfg.endpoint){
      const m = document.querySelector('meta[name="pb-views-endpoint"]');
      if(m && m.content) cfg.endpoint = m.content.trim();
    }
    cfg.site = cfg.site || 'PBH';
    cfg.cooldownMins = Number(cfg.cooldownMins||DEF_COOLDOWN);
    return cfg;
  }
  function saveCfg(partial){ const cur=getCfg(); writeJSON(CFG_KEY, Object.assign(cur, partial||{})); }

  function publish(pageId, count){
    CACHE.set(pageId, count);
    const set = LISTENERS.get(pageId);
    if(set) set.forEach(fn=>{ try{ fn(count); }catch(_){ } });
  }
  function onCount(pageId, fn){
    if(!LISTENERS.has(pageId)) LISTENERS.set(pageId, new Set());
    LISTENERS.get(pageId).add(fn);
    return ()=> LISTENERS.get(pageId).delete(fn);
  }

  function localAdd(pageId, inc=1){
    const store = readJSON(LOC_KEY, {}) || {};
    store[pageId] = Number(store[pageId]||0) + inc;
    writeJSON(LOC_KEY, store);
    publish(pageId, store[pageId]);
    return store[pageId];
  }
  function localGet(pageId){
    const store = readJSON(LOC_KEY, {}) || {};
    return Number(store[pageId]||0);
  }

  function shouldCooldown(pageId, mins){
    const k = LST_HIT + pageId;
    const last = Number(sessionStorage.getItem(k)||0);
    if(!last){ sessionStorage.setItem(k, String(now())); return false; }
    const diffMin = (now() - last)/60000;
    if(diffMin >= (mins||DEF_COOLDOWN)){
      sessionStorage.setItem(k, String(now()));
      return false;
    }
    return true;
  }

  async function postJSON(url, body){
    const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    // tolerante a respuestas simples
    let data=null; try{ data = await r.json(); }catch(_){}
    return data;
  }
  async function getJSON(url){
    const r = await fetch(url, { method:'GET' });
    let data=null; try{ data = await r.json(); }catch(_){}
    return data;
  }

  function normalizeCountResp(pageId, resp){
    // intentamos varias formas comunes
    if(!resp) return null;
    if(typeof resp === 'number') return resp;
    if(typeof resp === 'string' && /^\d+$/.test(resp)) return Number(resp);
    if(resp.count != null) return Number(resp.count);
    if(resp.views != null) return Number(resp.views);
    if(resp.total != null) return Number(resp.total);
    if(resp.counts && resp.counts[pageId] != null) return Number(resp.counts[pageId]);
    return null;
  }

  async function remoteHit(pageId, opts){
    const cfg=getCfg();
    const ep = (opts && opts.endpoint) || cfg.endpoint;
    if(!ep) return null;
    const payload = {
      action: 'hit',
      site: cfg.site,
      page: pageId,
      url: location.href,
      title: (opts && opts.title) || document.title || '',
      ref: document.referrer || '',
      uid: uid(),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      ua: navigator.userAgent || ''
    };
    try{
      const data = await postJSON(ep, payload);
      return normalizeCountResp(pageId, data);
    }catch(_){
      return null;
    }
  }

  async function remoteGet(pageId){
    const cfg=getCfg();
    const ep = cfg.endpoint;
    if(!ep) return null;
    // Probar GET con querystring; si tu backend usa POST, puede ignorar GET y responder vacío (caerá a local)
    const url = ep + (ep.includes('?')?'&':'?') + 'action=count&site=' + encodeURIComponent(cfg.site) + '&page=' + encodeURIComponent(pageId);
    try{
      const data = await getJSON(url);
      return normalizeCountResp(pageId, data);
    }catch(_){
      return null;
    }
  }

  async function remoteGetMany(pages){
    const cfg=getCfg();
    const ep = cfg.endpoint;
    if(!ep) return {};
    try{
      const data = await postJSON(ep, { action:'counts', site:cfg.site, pages: pages });
      if(data && data.counts) return data.counts;
      // fallback: pedir de a una (menos óptimo)
      const out={};
      for(const p of pages){
        const c = await remoteGet(p);
        if(c!=null) out[p]=c;
      }
      return out;
    }catch(_){
      return {};
    }
  }

  async function hit(pageId, opts){
    const cfg=getCfg();
    if(shouldCooldown(pageId, cfg.cooldownMins)) return CACHE.get(pageId) || localGet(pageId);

    // Primero: remoto
    const remote = await remoteHit(pageId, opts);
    if(remote!=null){
      publish(pageId, remote);
      return remote;
    }
    // Fallback: local
    return localAdd(pageId, 1);
  }

  async function get(pageId){
    // Si en cache, devolver
    if(CACHE.has(pageId)) return CACHE.get(pageId);
    const remote = await remoteGet(pageId);
    if(remote!=null){ publish(pageId, remote); return remote; }
    const local = localGet(pageId);
    publish(pageId, local);
    return local;
  }

  async function getMany(pageIds){
    const counts = await remoteGetMany(pageIds);
    const out={};
    for(const p of pageIds){
      const v = (counts && counts[p]!=null) ? Number(counts[p]) : localGet(p);
      out[p]=v;
      publish(p, v);
    }
    return out;
  }

  function render(target, pageId, formatter){
    const el = (typeof target==='string') ? document.querySelector(target) : target;
    if(!el) return;
    const fmt = formatter || ((n)=> `👁 ${Number(n||0).toLocaleString()}`);
    // attach listener
    onCount(pageId, (n)=>{ el.textContent = fmt(n); });
    // primer valor
    get(pageId);
  }

  const API = {
    init: (cfg)=> saveCfg(cfg||{}),  // { endpoint, site, cooldownMins }
    setEndpoint: (url)=> saveCfg({endpoint:url}),
    setSite: (site)=> saveCfg({site}),
    hit,
    get,
    getMany,
    render,
    // util: acceso cfg/uid por si lo necesitas
    _cfg: getCfg,
    _uid: uid
  };

  global.PBViews = API;
})(window);
</script>
