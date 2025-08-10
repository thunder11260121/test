// weather.js — Open‑Meteo + UX+ (rain prob, UV, cache, retry, abort)
(function(){
  const PRESETS={
    esaka:{lat:34.7565, lon:135.4968, label:"大阪・江坂"},
    kyoto:{lat:35.0380, lon:135.7740, label:"京都市"},
    kobe:{lat:34.6913, lon:135.1830, label:"神戸市"},
    omiya:{lat:35.9060, lon:139.6240, label:"さいたま市大宮区"},
    fukushima:{lat:37.7608, lon:140.4747, label:"福島市"}
  };

  let ctl=null;

  function announce(msg){ const el=document.getElementById('sr-live'); if(el) el.textContent=msg; }
  function setText(id, v){ const el=document.getElementById(id); if(el) el.textContent=v; }
  function kmToDeg(km){ return km/111; }

  function heatIndex(T, RH){
    // Rothfusz regression (approx). T in °C, RH in %
    if(T==null||RH==null) return null;
    const Tc=T, R=RH;
    const T_F = Tc*9/5+32;
    let HI = -42.379 + 2.04901523*T_F + 10.14333127*R
      - 0.22475541*T_F*R - 6.83783e-3*T_F*T_F - 5.481717e-2*R*R
      + 1.22874e-3*T_F*T_F*R + 8.5282e-4*T_F*R*R - 1.99e-6*T_F*T_F*R*R;
    // Adjustments (ignored for simplicity)
    const HIc = (HI-32)*5/9;
    return Math.round(HIc*10)/10;
  }
  function wbgtEstimate(T, RH){
    if(T==null||RH==null) return null;
    // Simple approx (not official)
    const wbgt = 0.7*(RH/100*T) + 0.3*T - 0.003*RH + 2;
    return Math.round(wbgt*10)/10;
  }
  function wbgtLevel(w){
    if(w==null) return {level:'--', cls:'', advice:''};
    if(w<21) return {level:'安全', cls:'safe', advice:'通常の活動でOK。水分を忘れずに。'};
    if(w<25) return {level:'注意', cls:'caution', advice:'こまめに休憩と水分補給。'};
    if(w<28) return {level:'警戒', cls:'high', advice:'長時間の屋外活動は控えめに。日陰を活用。'};
    if(w<31) return {level:'厳重警戒', cls:'danger', advice:'屋外は短時間に。涼しい場所へ。'};
    return {level:'危険', cls:'danger', advice:'屋外活動を中止。涼しい屋内で休息を。'};
  }
  function uvAdvice(u){
    if(u==null) return '';
    if(u<3) return 'UV弱め：帽子あると安心。';
    if(u<6) return 'UV中：帽子＋日陰推奨。';
    if(u<8) return 'UV強：日焼け止め・日陰・休憩。';
    return 'UV非常に強：屋内/日陰で。';
  }

  function beginLoading(){
    announce('天気を取得中です');
    document.getElementById('hourly')?.replaceChildren();
    document.getElementById('daily')?.replaceChildren();
    setText('wbgtValue','--'); setText('wbgtLevel','--');
    setText('temp','--'); setText('rh','--'); setText('heatIndex','--');
    const adv=document.getElementById('advice'); if(adv) adv.textContent='';
  }
  function endLoading(){ announce('天気の取得が完了しました'); }

  function cacheKey(lat,lon){ return 'wx:'+lat.toFixed(3)+','+lon.toFixed(3); }
  function readCache(lat,lon){
    try{
      const raw=sessionStorage.getItem(cacheKey(lat,lon));
      if(!raw) return null;
      const obj=JSON.parse(raw);
      if(Date.now()-obj.t > 10*60*1000) return null; // 10min TTL
      return obj.d;
    }catch(e){ return null; }
  }
  function writeCache(lat,lon,data){
    try{ sessionStorage.setItem(cacheKey(lat,lon), JSON.stringify({t:Date.now(), d:data})); }catch(e){}
  }

  function getRegionKey(){
    const el=document.getElementById('region');
    if(!el) return 'esaka';
    if(el.tagName==='SELECT') return el.value||'esaka';
    const val=(el.value||'').trim();
    if(['current','esaka','kyoto','kobe','omiya','fukushima'].includes(val)) return val;
    return 'esaka';
  }
  function setRegionKey(key){
    const el=document.getElementById('region');
    if(!el) return;
    if(el.tagName==='SELECT') el.value=key;
    else el.value=PRESETS[key]?.label||key;
  }

  async function georesolve(){
    const key=getRegionKey();
    if(key==='current'){
      try{
        const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:8000}));
        return {lat:pos.coords.latitude, lon:pos.coords.longitude};
      }catch(e){
        setRegionKey('esaka');
        return {lat:PRESETS.esaka.lat, lon:PRESETS.esaka.lon};
      }
    }
    const p=PRESETS[key]||PRESETS.esaka; return {lat:p.lat, lon:p.lon};
  }

  function buildUrl(lat,lon){
    const params=new URLSearchParams({
      latitude: lat, longitude: lon,
      hourly: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,uv_index,is_day",
      daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max",
      timezone: "auto"
    });
    return "https://api.open-meteo.com/v1/forecast?"+params.toString();
  }

  function render(data){
    // current from hourly[0]
    const h=data.hourly;
    if(!h || !h.time || h.time.length===0) throw new Error("no hourly");
    const nowIdx=0;
    const T = h.temperature_2m[nowIdx];
    const RH = h.relative_humidity_2m[nowIdx];
    const HI = heatIndex(T,RH);
    const W = wbgtEstimate(T,RH);
    setText('temp', Math.round(T));
    setText('rh', Math.round(RH));
    setText('heatIndex', HI!=null? HI : '--');
    setText('wbgtValue', W!=null? W : '--');
    const lv=wbgtLevel(W);
    const levelEl=document.getElementById('wbgtLevel');
    if(levelEl){ levelEl.textContent=lv.level; levelEl.className='badge '+(lv.cls||''); }
    const adv=document.getElementById('advice');
    const uv = h.uv_index[nowIdx];
    const rain=h.precipitation_probability[nowIdx];
    if(adv){
      adv.innerHTML = `${lv.advice} ／ 降水確率${rain!=null?rain+'%':'--'} ／ ${uvAdvice(uv)}`;
    }

    // hourly next 12h
    const ulH=document.getElementById('hourly');
    if(ulH){
      ulH.innerHTML='';
      const fmt=(s)=> new Date(s).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      for(let i=0;i<Math.min(12,h.time.length);i++){
        const li=document.createElement('li');
        const temp=Math.round(h.temperature_2m[i]);
        const pop=h.precipitation_probability[i]??'--';
        const uv=h.uv_index[i]??'--';
        li.innerHTML=`<div class="row"><span>${fmt(h.time[i])}</span><span class="meta">気温 ${temp}℃／降水 ${pop}%／UV ${uv}</span></div>`;
        ulH.appendChild(li);
      }
    }
    // daily 5 days
    const d=data.daily;
    const ulD=document.getElementById('daily');
    if(ulD && d && d.time){
      ulD.innerHTML='';
      for(let i=0;i<Math.min(5,d.time.length);i++){
        const li=document.createElement('li');
        const date=new Date(d.time[i]).toLocaleDateString([], {month:'numeric', day:'numeric', weekday:'short'});
        const tmax=Math.round(d.temperature_2m_max[i]);
        const tmin=Math.round(d.temperature_2m_min[i]);
        const pop=d.precipitation_probability_max[i]??'--';
        const uvm=d.uv_index_max[i]??'--';
        li.innerHTML=`<div class="row"><strong>${date}</strong><span class="meta"> ${tmin}–${tmax}℃／降水 ${pop}%／UV ${uvm}</span></div>`;
        ulD.appendChild(li);
      }
    }
  }

  function renderError(err){
    const card=document.querySelector('.card'); // first card
    const hourly=document.getElementById('hourly');
    const ul = hourly || document.getElementById('daily');
    if(ul){
      ul.innerHTML = `<li class="item">取得に失敗しました。<button class="primary" id="retryWx">再試行</button></li>`;
      const b=document.getElementById('retryWx'); if(b) b.onclick=()=>run();
    }
  }

  async function run(){
    beginLoading();
    if(ctl){ try{ctl.abort();}catch(_){}} 
    ctl=new AbortController();
    try{
      const {lat,lon}=await georesolve();
      // cache
      const cached=readCache(lat,lon);
      if(cached){ render(cached); endLoading(); return; }

      const url=buildUrl(lat,lon);
      const res=await fetch(url,{signal:ctl.signal, cache:'no-store'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      const json=await res.json();
      writeCache(lat,lon,json);
      render(json);
    }catch(e){
      if(e.name!=='AbortError') renderError(e);
    }finally{
      endLoading();
      ctl=null;
    }
  }

  function bind(){
    const sel=document.getElementById('region');
    const btn=document.getElementById('refresh');
    if(sel){
      sel.addEventListener('change', run);
      sel.addEventListener('input', ()=>{ clearTimeout(sel._t); sel._t=setTimeout(run,120); });
    }
    if(btn) btn.addEventListener('click', run);
  }

  window.addEventListener('load', ()=>{ bind(); run(); });
})();