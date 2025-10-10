<!-- PBViews GLOBAL (Apps Script backend + fallback local) -->
<script>
(function (w) {
  const BASE  = 'https://script.google.com/macros/s/AKfycbzrMg3MWq5YT53rNweaxuFa--9CMwoz4k1PDio8y8fbl-3hSb_fk_WWYPhPaDPKe90P3g/exec'; // <- tu /exec
  const TOKEN = ''; // si pusiste APP_TOKEN en el server, colócalo aquí

  const NUM = (x)=>{ const n=parseInt(x,10); return isNaN(n)?0:n; };
  const getLS = (k)=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } };
  const setLS = (k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} };

  async function api(op, params) {
    const q = new URLSearchParams({ op, ...(params||{}) });
    if (TOKEN) q.append('token', TOKEN);
    const url = `${BASE}?${q.toString()}`;
    const res = await fetch(url, { method: 'GET' }); // GET simple
    if (!res.ok) throw new Error('fetch failed');
    return res.json();
  }
  async function bumpRemote(key, n=1) {
    try { const j = await api('inc', { key, n:String(n) }); return NUM(j.value); }
    catch { const cur = NUM(getLS(key)); const val = cur + (n|0); setLS(key, String(val)); return val; }
  }
  async function getRemote(key) {
    try { const j = await api('get', { key }); return NUM(j.value); }
    catch { return NUM(getLS(key)); }
  }

  const KEY_TOTAL = 'pb.views.total';
  const P_TOOL = (id)=> `pb.views.tool.${String(id)}`;
  const P_AREA = (id)=> `pb.views.area.${String(id)}`;

  w.PBViews = {
    bumpTotal(n=1){ return bumpRemote(KEY_TOTAL, n); },
    getTotal(){ return getRemote(KEY_TOTAL); },
    bumpTool(id, n=1){ return bumpRemote(P_TOOL(id), n); },
    getTool(id){ return getRemote(P_TOOL(id)); },
    bumpArea(id, n=1){ return bumpRemote(P_AREA(id), n); },
    getArea(id){ return getRemote(P_AREA(id)); },
    bumpCountry(n=1){ return api('inccountry', { n:String(n) }).catch(()=>null); },

    // Auto-init: suma total + área 'hub', pinta #viewInfo, actualiza badges y cuenta clicks en .tool-link
    async init({ area='hub', viewSelector='#viewInfo', masterGrid='#masterGrid' } = {}) {
      try { await w.PBViews.bumpTotal(1); await w.PBViews.bumpArea(area, 1); } catch(_){}
      // Render total
      try {
        const total = await w.PBViews.getTotal();
        const el = document.querySelector(viewSelector);
        if (el) el.textContent = `👁️ Total Views: ${Number(total||0).toLocaleString()}`;
      } catch(_){}
      // Badges por herramienta + contar al abrir
      try {
        const cards = document.querySelectorAll(`${masterGrid} .card`);
        for (const card of cards) {
          const id = card.dataset.id;
          const span = card.querySelector(`.tool-views[data-id="${id}"]`);
          if (id && span) {
            const n = await w.PBViews.getTool(id);
            span.textContent = `👁️ ${Number(n||0).toLocaleString()}`;
          }
          const open = card.querySelector('.tool-link');
          if (open && id) {
            open.addEventListener('click', ()=> { w.PBViews.bumpTool(id, 1); }, { passive:true });
          }
        }
      } catch(_){}
    }
  };

  // Arranca cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ()=> w.PBViews.init());
  } else {
    w.PBViews.init();
  }
})(window);
</script>
