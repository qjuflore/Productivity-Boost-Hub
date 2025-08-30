<!-- pb-views.js v2025.8.30 -->
<script>
(function(){
  // === Config (puedes sobreescribirlas antes de cargar este archivo) ===
  // Si YA tienes tu método propio, ignora esto y expón window.recordVisit / window.fetchVisitStats.
  const CFG = {
    TRACK_URL:  window.PB_TRACK_URL  || null, // e.g. Apps Script doPost
    STATS_URL:  window.PB_STATS_URL  || null, // e.g. ?op=getCounts
    SITE:       window.PB_SITE       || 'productivity-boost-hub',
    DEDUP_MIN:  Number(window.PB_DEDUP_MINUTES || 0) // 0 = sin de-dup; recomendado 10 si quieres evitar spam de refresh
  };

  function nowIso(){ try{ return new Date().toISOString(); }catch(_){ return String(Date.now()); } }
  function tryJson(res){ try{ return res.json(); }catch(_){ return null; } }
  function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

  // --- Interno: envío con sendBeacon o fetch ---
  async function postBeaconOrFetch(url, data){
    try{
      const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
      if(navigator.sendBeacon && url){
        const ok = navigator.sendBeacon(url, blob);
        if(ok) return true;
      }
    }catch(_){}
    if(!url) return false;
    try{
      await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data), mode:'cors', keepalive:true});
      return true;
    }catch(_){ return false; }
  }

  // --- Interno: de-dup por sesión/tiempo ---
  function shouldSkip(slug){
    if(!CFG.DEDUP_MIN) return false;
    try{
      const k = `pbv:${slug}`;
      const last = Number(sessionStorage.getItem(k)||0);
      const ms = CFG.DEDUP_MIN*60*1000;
      if(Date.now()-last < ms) return true;
      sessionStorage.setItem(k, String(Date.now()));
      return false;
    }catch(_){ return false; }
  }

  // === API pública: pbTrackView ===
  async function pbTrackView(slug, meta={}){
    try{
      if(!slug) return;
      if(shouldSkip(slug)) return;

      // Si tienes tu propio método, úsalo.
      if(typeof window.recordVisit === 'function'){
        try{ await window.recordVisit({site:CFG.SITE, page:slug, ts:nowIso(), ...meta}); return; }catch(_){}
      }

      // Fallback a tu endpoint configurable:
      if(CFG.TRACK_URL){
        const payload = {
          op: 'track',
          site: CFG.SITE,
          page: slug,
          ts: nowIso(),
          href: location.href,
          ref: document.referrer || '',
          lang: navigator.language || '',
          screen: (window.screen? `${screen.width}x${screen.height}` : ''),
          ua: (navigator.userAgent||'').slice(0,180),
          ...meta
        };
        await postBeaconOrFetch(CFG.TRACK_URL, payload);
      }else{
        // sin endpoint ni método propio → no romper
        // console.warn('[pb-views] No TRACK_URL / recordVisit()');
      }
    }catch(_){}
  }

  // === API pública: pbGetCounts ===
  async function pbGetCounts(slugs){
    if(!Array.isArray(slugs) || slugs.length===0) return {};
    // Método propio
    if(typeof window.fetchVisitStats === 'function'){
      try{
        const res = await window.fetchVisitStats({site:CFG.SITE, pages:slugs});
        // Normaliza resultado a {slug: number}
        if(res && typeof res==='object'){
          if(Array.isArray(res)) {
            const map={}; res.forEach(r=> map[r.page||r.slug]=Number(r.count||0));
            return map;
          }
          if(res.counts) return res.counts;
          return res;
        }
      }catch(_){}
    }
    // Fallback a STATS_URL
    if(CFG.STATS_URL){
      try{
        const url = new URL(CFG.STATS_URL, location.href);
        url.searchParams.set('op','getCounts');
        url.searchParams.set('site', CFG.SITE);
        url.searchParams.set('pages', slugs.join(','));
        const resp = await fetch(url.toString(), {method:'GET', mode:'cors'});
        const j = await tryJson(resp);
        if(j && j.counts) return j.counts;
        // Acepta formato { "<slug>": n, ... }
        if(j && typeof j==='object') return j;
      }catch(_){}
    }
    return {}; // sin datos
  }

  // === Azúcar: pbRenderInlineCounter (ej. dentro de la tool) ===
  async function pbRenderInlineCounter(slug, target){
    try{
      const el = (typeof target==='string') ? document.querySelector(target) : target;
      if(!el) return;
      const counts = await pbGetCounts([slug]);
