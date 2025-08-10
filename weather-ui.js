
// weather-ui.js - independent renderer for hourly/daily sections
(function(){
  const PRESETS={esaka:{lat:34.7565,lon:135.4968},kyoto:{lat:35.038,lon:135.774},kobe:{lat:34.6913,lon:135.183},omiya:{lat:35.906,lon:139.624},fukushima:{lat:37.7608,lon:140.4747}};

  function getRegion(){ const el=document.getElementById('region'); if(!el) return 'esaka'; return el.value||'esaka'; }
  function geoloc(){ return new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:8000})) }
  async function getCoords(){
    const key=getRegion();
    if(key==='current'){ try{ const p=await geoloc(); return {lat:p.coords.latitude,lon:p.coords.longitude}; }catch(_){} }
    return PRESETS[key]||PRESETS.esaka;
  }

  function wbgtApprox(t,rh){ // very rough
    const hi = -8.784695 + 1.61139411*t + 2.338549*rh/100 - 0.14611605*t*rh/100 - 0.012308094*(t*t) - 0.016424828*((rh/100)*(rh/100)) + 0.002211732*(t*t)*(rh/100) + 0.00072546*t*((rh/100)*(rh/100)) - 0.000003582*(t*t)*((rh/100)*(rh/100));
    // map heat index to WBGT-ish
    const wb = 0.7*(rh/100*t) + 0.3*hi*0.9;
    return wb;
  }
  function uvClass(u){ if(u<3) return 'uv-low'; if(u<6) return 'uv-mod'; if(u<8) return 'uv-high'; return 'uv-vhigh'; }

  function svgSparkline(arr){
    const w=120,h=22; if(!arr||!arr.length) return `<svg class="spark" viewBox="0 0 ${w} ${h}"></svg>`;
    const max=Math.max(...arr,1), step=w/(arr.length-1||1);
    let d=`M0 ${h - (arr[0]/max)*h}`;
    for(let i=1;i<arr.length;i++){ const y=h-(arr[i]/max)*h; d+=` L${(i*step).toFixed(1)} ${y.toFixed(1)}`; }
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.6"/>
    </svg>`;
  }

  async function render(){
    const hourlyUL=document.getElementById('hourly');
    const dailyUL=document.getElementById('daily');
    if(!hourlyUL||!dailyUL) return;

    // state
    hourlyUL.innerHTML = '<li class="loading">取得中…</li>';
    dailyUL.innerHTML  = '';

    const {lat,lon}=await getCoords();
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,uv_index&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto`;
    let json; try{ const r=await fetch(url,{cache:'no-store'}); json=await r.json(); }catch(_){ hourlyUL.innerHTML='<li class="loading">取得に失敗</li>'; return; }

    // === Hourly (next 12 hours)
    const H=json.hourly||{};
    const nowIndex = 0; // assuming first is current hour
    const hours=[];
    for(let i=nowIndex;i<nowIndex+12 && i<(H.time||[]).length;i++){
      const t=H.time[i].slice(11,16);
      const temp=H.temperature_2m?.[i];
      const rh=H.relative_humidity_2m?.[i];
      const uv=H.uv_index?.[i] ?? 0;
      const pp=H.precipitation_probability?.[i] ?? 0;
      const wb= (temp!=null && rh!=null) ? wbgtApprox(temp,rh) : null;
      hours.push({t,temp,pp,uv,wb});
    }

    hourlyUL.innerHTML = `<div class="hourly-strip">`+hours.map(h=>{
      const pill = `<span class="pill ${uvClass(h.uv||0)}">UV ${Math.round(h.uv||0)}</span>`;
      return `<div class="hourly-card">
        <div class="p">${h.t}</div>
        <div class="t">${Math.round(h.temp)}°</div>
        <div class="p">${h.pp||0}%</div>
        ${pill}
      </div>`;
    }).join('')+`</div>`;

    // sparkline of next 12h precip at tail
    const precipArr = hours.map(h=>h.pp||0);
    const strip = hourlyUL.querySelector('.hourly-strip');
    if(strip){ const wrap=document.createElement('div'); wrap.style.flex='0 0 100%'; wrap.style.padding='4px 6px'; wrap.innerHTML=svgSparkline(precipArr); strip.appendChild(wrap); }

    // === Daily (5 days)
    const D=json.daily||{};
    dailyUL.innerHTML = '<div class="daily-rows"></div>';
    const cont = dailyUL.querySelector('.daily-rows');
    const days = Math.min((D.time||[]).length, 5);
    // find global min/max for range width normalization
    let gmin=  999, gmax= -999;
    for(let i=0;i<days;i++){ gmin=Math.min(gmin, D.temperature_2m_min[i]); gmax=Math.max(gmax, D.temperature_2m_max[i]); }
    const span = Math.max(1, gmax-gmin);
    for(let i=0;i<days;i++){
      const dt=D.time[i]; const mmdd=dt.slice(5), wd=new Date(dt).toLocaleDateString('ja-JP',{weekday:'short'});
      const tmin=D.temperature_2m_min[i], tmax=D.temperature_2m_max[i];
      const pmax=D.precipitation_probability_max?.[i]??0;
      const uvmax=D.uv_index_max?.[i]??0;
      const left = ((tmin-gmin)/span)*100, width=((tmax-tmin)/span)*100;
      const row = document.createElement('li'); row.className='daily-row';
      row.innerHTML = `
        <div>${mmdd}（${wd}）</div>
        <div>
          <div class="range"><div class="bar" style="left:${left}%;width:${width}%"></div></div>
          <div class="rainbar"><div class="fill" style="width:${pmax}%"></div></div>
        </div>
        <div><span class="pill ${uvClass(uvmax)}">UV ${Math.round(uvmax)}</span></div>
      `;
      cont.appendChild(row);
    }
  }

  function bind(){
    const r=document.getElementById('region');
    const btn=document.getElementById('refresh');
    if(r){ r.addEventListener('change', render); }
    if(btn){ btn.addEventListener('click', render); }
    render();
  }
  window.addEventListener('load', bind);
})();
