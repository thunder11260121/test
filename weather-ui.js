
// weather-ui.js v2 — resilient render even if #hourly/#daily are UL elements
(function(){
  function el(tag, cls){ const e=document.createElement(tag); if(cls) e.className=cls; return e; }
  function sparkline(values, w=80, h=24){
    const max = Math.max(1, ...values);
    const step = w/(values.length-1||1);
    let d = values.map((v,i)=> (i===0?'M':'L') + (i*step).toFixed(1)+','+(h-(v/max*h)).toFixed(1)).join(' ');
    const svg = `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.8"/>
    </svg>`;
    return svg;
  }
  function uvPill(uv){
    const cls = uv>=8?'uv-vhigh':uv>=6?'uv-high':uv>=3?'uv-mod':'uv-low';
    return `<span class="pill ${cls}">UV ${Math.round(uv)}</span>`;
  }

  // Expect 'hours' from weather.js: { time[], temperature_2m[], precipitation_probability[], uv_index[] }
  window.renderHourlyUI = function({containerId, hours}){
    const root = document.getElementById(containerId);
    if(!root) return;
    const wrap = el('div', 'hourly-strip');
    const pp = (hours.precipitation_probability||[]).slice(0,12);
    const spark = sparkline(pp, 86*12*0.6, 24); // long svg appended at end

    for(let i=0;i<12;i++){
      const card = el('div','hourly-card');
      const t = (hours.time||[])[i]; 
      const tmp = (hours.temperature_2m||[])[i];
      const pr = (hours.precipitation_probability||[])[i];
      const uv = (hours.uv_index||[])[i] || 0;
      card.innerHTML = `<div class="t">${t? new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}): '--:--'}</div>
        <div>${tmp!=null? Math.round(tmp)+'°' : '--'}</div>
        <div class="meta">${pr!=null? pr+'%':'--%'}</div>
        <div class="meta">${uvPill(uv)}</div>`;
      wrap.appendChild(card);
    }
    // container may be <ul>; replace its content safely
    root.innerHTML = '';
    root.appendChild(wrap);
    const g = el('div'); g.innerHTML = spark; root.appendChild(g.firstChild);
  };

  // Expect 'daily': { time[], temperature_2m_min[], temperature_2m_max[], precipitation_probability_max[], uv_index_max[] }
  window.renderDailyUI = function({containerId, daily}){
    const root = document.getElementById(containerId);
    if(!root) return;
    const table = el('div','daily-table');
    for(let i=0;i<Math.min(5, (daily.time||[]).length); i++){
      const d = new Date(daily.time[i]);
      const date = d.toLocaleDateString([], {weekday:'short', month:'numeric', day:'numeric'});
      const min = daily.temperature_2m_min?.[i]; const max = daily.temperature_2m_max?.[i];
      const pp  = daily.precipitation_probability_max?.[i] ?? 0;
      const uv  = daily.uv_index_max?.[i] ?? 0;
      const rowDate = el('div','daily-date'); rowDate.textContent = date;
      const mid = el('div');
      const range = el('div','range'); const bar = el('div','bar');
      let lo = Math.min(min,max), hi = Math.max(min,max);
      const span = Math.max(5, (hi-lo));
      bar.style.width = Math.min(100, (span*4)).toFixed(0)+'%';
      range.appendChild(bar);
      const ppBar = el('div','pp'); const ppIn = el('div','bar'); ppIn.style.width = Math.min(100, pp).toFixed(0)+'%'; ppBar.appendChild(ppIn);
      mid.appendChild(range); mid.appendChild(ppBar);
      const right = el('div'); right.innerHTML = uvPill(uv);
      table.appendChild(el('div','daily-row')); // grid row start
      table.appendChild(rowDate); table.appendChild(mid); table.appendChild(right);
    }
    root.innerHTML=''; root.appendChild(table);
  };
})();
