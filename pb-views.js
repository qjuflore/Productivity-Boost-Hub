<script>
/*!
  PB Views (cliente) — v3
  - Sólo usa GET (sin CORS preflight).
  - +1 total en CADA carga.
  - Click tool: +1 tool y +1 total (atómico).
  - Batch para leer múltiples keys.
*/
(function (w) {
  // ==== CONFIG ====
  const BASE  = 'https://script.google.com/macros/s/AKfycbzrMg3MWq5YT53rNweaxuFa--9CMwoz4k1PDio8y8fbl-3hSb_fk_WWYPhPaDPKe90P3g/exec'; // <-- tu /exec
  const TOKEN = ''; // si pones token en Code.gs, colócalo aquí
  const POLL_MS = 10000; // sincronía entre navegadores

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
  function inc(key, n=1, opts){ return api('inc', { key, n:String(n) }, opts); }
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
    // Suma +1 al total y +1 al área en cada refresh (atómico)
    async bumpOnLoad(area='hub'){
      try {
        const resp = await incMulti([KEY_TOTAL, P_AREA(area)], 1);
        const total = resp && resp.values ? resp.values[KEY_TOTAL] : null;
        if (typeof total === 'number') setTotalUI(total);
      } catch(_) {
        // deja "Loading…" hasta el próximo poll/focus
      }
    },

    // Carga badges de todas las herramientas en una llamada
    async loadToolBadges(){
      const ids = listToolIds();
      if (!ids.length) return;
      const keys = ids.map(P_TOOL);
      try {
        const resp = await counts(keys);
        const vals = (resp && resp.values) || {};
        for (const id of ids) {
          setToolUI(id, Number(vals[P_TOOL(id)] || 0));
        }
      } catch(_){}
    },

    // Click herramienta: +1 tool y +1 total (atómico). No bloquea navegación.
    bumpToolAndTotalOnOpen(id){
      const keys = [P_TOOL(id), KEY_TOTAL];
      // Dispara GET con keepalive; el UI se actualizará en el siguiente poll
      incMulti(keys, 1, { keepalive: true }).catch(()=>{});
    },

    // Poll: refresca total y badges (servidor autoritativo)
    async pollAll(){
      try {
        const t = await get(KEY_TOTAL);
        if (typeof t?.value === 'number') setTotalUI(t.value);
      } catch(_){}
      try {
        await this.loadToolBadges();
      } catch(_){}
    }
  };
})(window);
</script>
