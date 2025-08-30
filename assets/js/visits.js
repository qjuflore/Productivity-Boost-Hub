<script>
// PBHVisits v2.0 — Count total visits + per-country, show top countries
(function (w) {
  const NS = 'qjuflore-productivity-boost-hub'; 
  const KEYS = { total: 'total-site-visits' };
  const COUNTRY_CANDIDATES = [
    'US','MX','ES','AR','CO','PE','CL','BR','CA','GB',
    'DE','FR','IT','NL','PT','AU','IN','PH','NG','VE',
    'UY','EC','BO','PY','CR','GT','SV','HN','DO'
  ];

  const fmt = n => Number(String(n||'0').replace(/[^\d]/g,'')||0).toLocaleString();

  async function countapi(path) {
    const r = await fetch(`https://api.countapi.xyz/${path}`, {cache:'no-store'});
    if (!r.ok) throw new Error('CountAPI error');
    return r.json();
  }
  async function hitTotal() { return (await countapi(`hit/${NS}/${KEYS.total}`)).value; }
  async function getTotal() { return (await countapi(`get/${NS}/${KEYS.total}`)).value; }
  async function hitCountry(code){ return (await countapi(`hit/${NS}/country-${code}`)).value; }
  async function getCountry(code){ return (await countapi(`get/${NS}/country-${code}`)).value; }

  async function detectCountryCode() {
    try {
      const r = await fetch('https://ipapi.co/country/', {cache:'no-store'});
      const t = (await r.text()).trim();
      return /^[A-Z]{2}$/.test(t) ? t : '??';
    } catch { return '??'; }
  }

  async function getTopCountries(limit=3) {
    const pairs = [];
    await Promise.all(COUNTRY_CANDIDATES.map(async code=>{
      try { const v = await getCountry(code).catch(()=>0); pairs.push([code, Number(v||0)]); }
      catch { pairs.push([code, 0]); }
    }));
    pairs.sort((a,b)=> b[1]-a[1]);
    return pairs.slice(0, limit).filter(([,v])=>v>0);
  }

  function flag(code){
    if (!/^[A-Z]{2}$/.test(code)) return '🏳️';
    return String.fromCodePoint(...[...code].map(c=>0x1F1E6 + (c.charCodeAt(0)-65)));
  }

  w.PBHVisits = {
    async attach({ totalSelector='#visitInfo', countriesSelector='#countryStats', increment=true } = {}) {
      try {
        const code = await detectCountryCode();
        let total;
        if (increment) {
          total = await hitTotal();
          if (code !== '??') await hitCountry(code);
        } else total = await getTotal();

        // Render total
        const totalEl = document.querySelector(totalSelector);
        if (totalEl) {
          totalEl.title = `${fmt(total)} total visits`;
          totalEl.setAttribute('data-count', total);
        }
        localStorage.setItem('pbh.totalVisits', String(total));

        // Render top countries
        const top = await getTopCountries(3);
        const cEl = document.querySelector(countriesSelector);
        if (cEl) {
          const txt = top.map(([c,v])=>`${flag(c)} ${c} ${fmt(v)}`).join(' · ');
          cEl.title = txt || 'No data';
        }
        localStorage.setItem('pbh.countryTop', JSON.stringify(top));
      } catch (e) {
        // fallback
        const raw = localStorage.getItem('pbh.totalVisits')||'0';
        const totalEl = document.querySelector(totalSelector);
        if (totalEl) totalEl.title = `${fmt(raw)} total visits`;
        const top = JSON.parse(localStorage.getItem('pbh.countryTop')||'[]');
        const cEl = document.querySelector(countriesSelector);
        if (cEl) {
          const txt = top.map(([c,v])=>`${flag(c)} ${c} ${fmt(v)}`).join(' · ');
          cEl.title = txt || 'No data';
        }
      }
    }
  };
})(window);
</script>
