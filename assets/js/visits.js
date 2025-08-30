<script>
// PBHVisits v1.0 — Shared visits + top countries (CountAPI + geo)
(function (w) {
  const NS = 'qjuflore-productivity-boost-hub'; // <- puedes cambiar namespace
  const KEYS = {
    total: 'total-site-visits'
  };
  // Lista de países candidatos (ISO-2). Amplíala cuando veas tráfico nuevo.
  const COUNTRY_CANDIDATES = [
    'US','MX','ES','AR','CO','PE','CL','BR','CA',
    'GB','DE','FR','IT','NL','PT','AU','IN','PH',
    'NG','VE','UY','EC','BO','PY','CR','GT','SV','HN','DO'
  ];

  // --- Utils ---
  const $ = (s, r=document)=>r.querySelector(s);
  const fmt = n => Number(String(n||'0').replace(/[^\d]/g,'')||0).toLocaleString();

  async function countapi(path) {
    const url = `https://api.countapi.xyz/${path}`;
    const r = await fetch(url, {cache:'no-store'});
    if (!r.ok) throw new Error('CountAPI error');
    return r.json();
  }
  async function hitTotal() {
    const { value } = await countapi(`hit/${NS}/${KEYS.total}`);
    return value;
  }
  async function getTotal() {
    const { value } = await countapi(`get/${NS}/${KEYS.total}`);
    return value;
  }
  async function hitCountry(code) {
    const { value } = await countapi(`hit/${NS}/country-${code}`);
    return value;
  }
  async function getCountry(code) {
    const { value } = await countapi(`get/${NS}/country-${code}`);
    return value;
  }
  async function detectCountryCode() {
    // Geo API simple (gratuita). Si falla, devuelve "??"
    try {
      const r = await fetch('https://ipapi.co/country/', {cache:'no-store'});
      const t = (await r.text()).trim();
      return /^[A-Z]{2}$/.test(t) ? t : '??';
    } catch { return '??'; }
  }

  async function getTopCountries(limit=3) {
    // Lee la lista candidata y arma el top. Si un país no existe aun, CountAPI devuelve 0.
    const pairs = [];
    await Promise.all(COUNTRY_CANDIDATES.map(async code=>{
      try {
        const v = await getCountry(code).catch(()=>0);
        pairs.push([code, Number(v||0)]);
      } catch { pairs.push([code, 0]); }
    }));
    pairs.sort((a,b)=> b[1]-a[1]);
    return pairs.slice(0, limit).filter(([,v])=>v>0);
  }

  function renderTotal(selector, total) {
    const el = $(selector);
    if (!el) return;
    el.textContent = `👁️ Total Visits: ${fmt(total)}`;
  }
  function renderTopCountries(selector, list) {
    const el = $(selector);
    if (!el) return;
    if (!list || !list.length) { el.textContent = '🌍 Top Countries: —'; return; }
    const chips = list.map(([code, v])=> `${flag(code)} ${code} ${fmt(v)}`).join(' · ');
    el.textContent = `🌍 Top Countries: ${chips}`;
  }
  // Mini bandera aproximada por emoji (fallback simple)
  function flag(code) {
    if (!/^[A-Z]{2}$/.test(code)) return '🏳️';
    return String.fromCodePoint(...[...code].map(c=>0x1F1E6 + (c.charCodeAt(0)-65)));
  }

  // API pública
  w.PBHVisits = {
    /**
     * Attach shared visits to a page
     * @param {object} opt
     * @param {string} opt.totalSelector - CSS selector for total badge
     * @param {string} opt.countriesSelector - CSS selector for countries badge
     * @param {boolean} opt.increment - Whether this page should increment visits (true = every page)
     */
    async attach({ totalSelector = '#visitInfo', countriesSelector = '#countryStats', increment = true } = {}) {
      try {
        // Detect country first
        const code = await detectCountryCode();

        // Increment if required (now we want to increment on all pages)
        let total;
        if (increment) {
          // Hit global total
          total = await hitTotal();
          // Hit country-specific key (ignore if code unknown)
          if (code !== '??') { await hitCountry(code); }
        } else {
          total = await getTotal();
        }

        // Render total + store locally (so other scripts can read)
        renderTotal(totalSelector, total);
        try { localStorage.setItem('pbh.totalVisits', String(total)); } catch {}

        // Render top countries
        const top = await getTopCountries(3);
        renderTopCountries(countriesSelector, top);
        try { localStorage.setItem('pbh.countryTop', JSON.stringify(top)); } catch {}

      } catch (e) {
        // Fallback from localStorage
        const raw = localStorage.getItem('pbh.totalVisits');
        renderTotal(totalSelector, raw || 0);
        const top = JSON.parse(localStorage.getItem('pbh.countryTop')||'[]');
        renderTopCountries(countriesSelector, top);
      }
    }
  };
})(window);
</script>
