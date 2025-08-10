// weather.js — robust fetch + UX polish + WBGT/HeatIndex
(function(){
  const PRESETS = {
    esaka:{lat:34.7565, lon:135.4968, label:"大阪・江坂"},
    kyoto:{lat:35.0380, lon:135.7740, label:"京都市"},
    kobe:{lat:34.6913, lon:135.1830, label:"神戸市"},
    omiya:{lat:35.9060, lon:139.6240, label:"さいたま市大宮区"},
    fukushima:{lat:37.7608, lon:140.4747, label:"福島市"}
  };

  let ctl = null;

  function $(id){ return document.getElementById(id); }
  function announce(msg){ const el=$('sr-live'); if(el){ el.textContent=msg; } }
  function begin(){ announce('天気を取得中です'); $('hourly').innerHTML=''; $('daily').innerHTML=''; }
  function done(){ announce('天気の取得が完了しました'); }

  function heatIndexC(T, RH){
    // Rothfusz regression (approx), input C/%, output C
    const Tc = T, Tf = Tc * 9/5 + 32;
    const HI_f = -42.379 + 2.04901523*Tf + 10.14333127*RH - 0.22475541*Tf*RH - 6.83783e-3*Tf*Tf - 5.481717e-2*RH*RH + 1.22874e-3*Tf*Tf*RH + 8.5282e-4*Tf*RH*RH - 1.99e-6*Tf*Tf*RH*RH;
    return (HI_f - 32)*5/9;
  }
  function wbgtSimple(T, RH){
    // simple outdoor approximation from T and RH
    // WBGT ≈ 0.567*T + 0.393*e + 3.94, where e is vapor pressure (hPa)
    const e = RH/100 * 6.105 * Math.exp((17.27*T)/(237.7+T));
    return 0.567*T + 0.393*e + 3.94;
  }
  function wbgtLevel(w){
    if(w<21) return {level:'安全', cls:'safe', advice:'通常の活動でOK'};
    if(w<25) return {level:'注意', cls:'caution', advice:'こまめな水分補給・適宜休憩'};
    if(w<28) return {level:'警戒', cls:'high', advice:'激しい運動を避け、日陰で休憩'};
    if(w<31) return {level:'厳重警戒', cls:'danger', advice:'長時間の屋外活動は避ける'};
    return {level:'危険', cls:'danger', advice:'外出は最小限に。冷房環境で休息'};
  }

  function regionKey(){
    const el=$('region');
    if(!el) return 'esaka';
    return el.value || 'esaka';
  }
  function setRegion(key){ const el=$('region'); if(el) el.value=key; }

  async function fetchWeather(lat, lon){
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation&daily=temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_sum&timezone=auto`;
    if(ctl){ try{ ctl.abort(); }catch(_){}} ctl = new AbortController();
    const res = await fetch(url, {signal: ctl.signal, cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const j = await res.json(); ctl=null; return j;
  }

  function renderNow(T, RH){
    const WBGT = wbgtSimple(T, RH);
    const L = wbgtLevel(WBGT);
    $('temp').textContent = T.toFixed(1);
    $('rh').textContent = Math.round(RH);
    const HI = heatIndexC(T, RH);
    $('heatIndex').textContent = HI.toFixed(1);
    $('wbgtValue').textContent = WBGT.toFixed(1);
    const badge = $('wbgtLevel'); badge.textContent = L.level; badge.className = 'badge '+L.cls;
    $('advice').textContent = '妊婦さんへ：' + L.advice + '／無理はせず、気分が悪い時はすぐ休みましょう。';
  }

  function renderHourly(hourly){
    const ul = $('hourly'); ul.innerHTML='';
    const now = new Date();
    const idxNow = hourly.time.findIndex(t => new Date(t) >= now);
    const start = Math.max(0, idxNow);
    for(let i=start; i<Math.min(start+12, hourly.time.length); i++){
      const t = new Date(hourly.time[i]);
      const item = document.createElement('li');
      item.className = 'item';
      const T = hourly.temperature_2m[i];
      const RH = hourly.relative_humidity_2m[i];
      const pop = hourly.precipitation_probability?.[i] ?? null;
      item.innerHTML = `<div><strong>${t.getHours()}時</strong> <span class="meta">体感 ${Math.round(hourly.apparent_temperature[i])}℃${pop!=null?`／雨${pop}%`:''}</span></div>
      <div class="meta">${T.toFixed(1)}℃・湿度${RH}%</div>`;
      ul.appendChild(item);
    }
  }

  function renderDaily(daily){
    const ul = $('daily'); ul.innerHTML='';
    for(let i=0;i<Math.min(5, daily.time.length); i++){
      const d = new Date(daily.time[i]);
      const item = document.createElement('li'); item.className='item';
      item.innerHTML = `<div><strong>${d.getMonth()+1}/${d.getDate()}(${['日','月','火','水','木','金','土'][d.getDay()]})</strong>
        <span class="meta">最高${Math.round(daily.temperature_2m_max[i])}℃／最低${Math.round(daily.temperature_2m_min[i])}℃ ／ UV${Math.round(daily.uv_index_max[i]||0)}</span></div>`;
      ul.appendChild(item);
    }
  }

  async function run(){
    try{
      begin();
      let lat, lon;
      const key = regionKey();
      if(key==='current'){
        try{
          const pos = await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:8000}));
          lat = pos.coords.latitude; lon = pos.coords.longitude;
        }catch(e){
          const p = PRESETS.esaka; lat=p.lat; lon=p.lon; setRegion('esaka');
        }
      }else{
        const p = PRESETS[key] || PRESETS.esaka; lat=p.lat; lon=p.lon;
      }
      const j = await fetchWeather(lat, lon);
      // prefer the first current-ish index
      const h = j.hourly;
      const now = new Date();
      let idx = 0;
      for(let i=0;i<h.time.length;i++){ if(new Date(h.time[i]) >= now){ idx=i; break; } }
      renderNow(h.temperature_2m[idx], h.relative_humidity_2m[idx]);
      renderHourly(h);
      renderDaily(j.daily);
    }catch(e){
      const ul1=$('hourly'); const ul2=$('daily');
      if(ul1) ul1.innerHTML = `<li class="item">天気の取得に失敗しました。時間をおいて再試行してください。</li>`;
      if(ul2) ul2.innerHTML = '';
      const a=$('advice'); if(a) a.textContent='通信状態をご確認のうえ、更新をお試しください。';
      console.error(e);
    }finally{
      done();
    }
  }

  function bind(){
    const btn = $('refresh'); if(btn) btn.addEventListener('click', run);
    const sel = $('region'); if(sel){ sel.addEventListener('change', run); }
    run();
  }

  window.addEventListener('load', bind);
})();
