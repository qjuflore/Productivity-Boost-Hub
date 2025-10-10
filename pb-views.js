<script>
/*!
  PB Views (cliente) — v3
  - Sólo usa GET (sin CORS preflight).
  - +1 total en CADA carga (y +1 al área).
  - Click tool: +1 tool y +1 total (atómico).
  - Lectura en batch (counts) para badges.
  - Polling ligero para sincronía entre navegadores.
*/
(function (w) {
  // ==== CONFIG ====
  const BASE  = 'https://script.google.com/macros/s/AKfycbzrMg3MWq5YT53rNweaxuFa--9CMwoz4k1PDio8y8fbl-3hSb_fk_WWYPhPaDPKe90P3g/exec'; // <-- tu /exec
  const TOKEN = ''; // si activas APP_TOKEN en Code.gs, ponlo aquí
  const POLL_MS = 10000; // sincronía entre navegadores (10 s)

  // ==== KEYS ====
  const KEY_TOTAL = 'pb.views.total';
  const P_TOOL = (id)=> `pb.views.tool.${String(id)}`;
  const P_AREA = (id)=> `pb.views.area.${String(id)}`;

  // ==== Helpers HTTP (GET sin preflight) ====
  function q(params){
    const u = new URLSearchParams(params || {});
    if (TOKEN) u.append('token', TOKEN);
    u.append('t', Date.now().toString()); // anti-cache
    return u.toString();
  }
  async function api(op, params={}, opts={}){
    const url = `${BASE}?${q({ op, ...params })}`;
    const res = await fetch(url, { method:'GET', keepalive: !!opts.keepalive });
    if (!res.ok) throw new Error('fetch failed');
    return res.json();
  }
  function get(key, opts){ return api('get', { key }, opts); }
  function incMulti(keys, n=1, opts){
    const list = Array.isArray(keys) ? keys.join(',') : String(keys||'');
    return api('inc_multi', { keys: list, n:String(n) }, opts);
  }
  function counts(keys, opts){
    const list = Array.isArray(keys) ? keys.join(',') : String(keys||'');
    return api('counts', { keys: list }, opts);
  }

  // ==== DOM Helpers ====
  function setTotalUI(n){
    const el = document.getElementById('viewInfo');
    if (el && typeof n === 'number') el.textContent = `👁️ Total Views: ${n.toLocaleString()}`;
  }
  function setToolUI(id, n){
    const span = document.querySelector(`.tool-views[data-id="${id}"]`);
    if (span && typeof n === 'number') span.textContent = `👁️ ${n.toLocaleString()}`;
  }
  function listToolIds(){
    return Array.from(document.querySelectorAll('#masterGrid .card'))
      .map(card => card.dataset.id)
      .filter(Boolean);
  }

  // ==== API pública ====
  w.PBViews = {
    // +1 al total y +1 al área en cada carga (atómico)
    async bumpOnLoad(area='hub'){
      try {
        const resp = await incMulti([KEY_TOTAL, P_AREA(area)], 1);
        const total = resp && resp.values ? resp.values[KEY_TOTAL] : null;
        if (typeof total === 'number') setTotalUI(total);
      } catch(_) { /* el siguiente poll lo actualizará */ }
    },

    // Carga inicial de badges (una llamada)
    async loadToolBadges(){
      const ids = listToolIds();
      if (!ids.length) return;
      const keys = ids.map(P_TOOL);
      try {
        const resp = await counts(keys);
        const vals = (resp && resp.values) || {};
        for (const id of ids) setToolUI(id, Number(vals[P_TOOL(id)]||0));
      } catch(_) {}
    },

    // Click en herramienta: +1 tool y +1 total (atómico). No bloquea navegación.
    bumpToolAndTotalOnOpen(id){
      const keys = [P_TOOL(id), KEY_TOTAL];
      incMulti(keys, 1, { keepalive: true }).catch(()=>{});
    },

    // Poll general: refresca total + badges
    async pollAll(){
      try {
        const t = await get(KEY_TOTAL);
        if (typeof t?.value === 'number') setTotalUI(t.value);
      } catch(_){}
      try { await this.loadToolBadges(); } catch(_){}
    }
  };
})(window);
</script>
