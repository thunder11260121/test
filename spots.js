// spots.js — filters summary + closed by default + persist UI + loading
(function(){
  const PRESETS={esaka:{lat:34.7565,lon:135.4968},kyoto:{lat:35.0380,lon:135.7740},kobe:{lat:34.6913,lon:135.1830},omiya:{lat:35.9060,lon:139.6240},fukushima:{lat:37.7608,lon:140.4747}};
  const EXCLUDE_UNNAMED_ATTRACTION=false;
  const R=6371; function rad(x){return x*Math.PI/180;} function dist(a,b,c,d){const dLat=rad(c-a),dLon=rad(d-b);const A=Math.sin(dLat/2)**2 + Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dLon/2)**2;return 2*R*Math.atan2(Math.sqrt(A),Math.sqrt(1-A));}
  function speedToKmh(p){ if(p==='slow')return 25; if(p==='fast')return 50; return 35; }

  function setLoading(){ const ul=document.getElementById('spots'); if(ul) ul.innerHTML='<li class="spot loading">検索中…</li>'; }
  function setMessage(msg){ const ul=document.getElementById('spots'); if(ul) ul.innerHTML=`<li class="spot">${msg}</li>`; }

  function updateSummary(){
    const sum=document.getElementById('filterSummary');
    if(!sum) return;
    const minutes=(document.getElementById('driveMin')||{}).value||20;
    const speed=(document.getElementById('speedProfile')||{}).value||'normal';
    const map={slow:'ゆっくり',normal:'普通',fast:'速め'};
    const pv=(id)=>Number((document.getElementById(id)||{}).value||0);
    sum.textContent=`条件：車で${minutes}分・${map[speed]||speed}｜優先 屋内${pv('prio-indoor')} 木陰${pv('prio-shade')} 水辺${pv('prio-water')} ベンチ${pv('prio-seating')} 匂い${pv('prio-lowodor')}`;
  }

  function saveUI(){
    const st={
      region:(document.getElementById('region')||{}).value,
      driveMin:(document.getElementById('driveMin')||{}).value,
      speedProfile:(document.getElementById('speedProfile')||{}).value,
      prio:{indoor:(document.getElementById('prio-indoor')||{}).value,
            shade:(document.getElementById('prio-shade')||{}).value,
            water:(document.getElementById('prio-water')||{}).value,
            seating:(document.getElementById('prio-seating')||{}).value,
            lowodor:(document.getElementById('prio-lowodor')||{}).value},
      filtersOpen: !!(document.getElementById('filters')||{open:false}).open
    };
    try{ localStorage.setItem('spots:UI', JSON.stringify(st)); }catch(_){}
  }
  function loadUI(){
    try{
      const st=JSON.parse(localStorage.getItem('spots:UI')||'{}');
      if(st.region) (document.getElementById('region')||{}).value=st.region;
      if(st.driveMin) (document.getElementById('driveMin')||{}).value=st.driveMin;
      if(st.speedProfile) (document.getElementById('speedProfile')||{}).value=st.speedProfile;
      if(st.prio){ for(const k in st.prio){ const el=document.getElementById('prio-'+k); if(el) el.value=st.prio[k]; } }
      const det=document.getElementById('filters'); if(det && typeof st.filtersOpen==='boolean') det.open=st.filtersOpen;
    }catch(_){}
  }

  function friendlyType(tags){
    if(!tags) return "スポット";
    if(tags.amenity==='library')return'図書館';
    if(tags.tourism==='museum')return'美術館/博物館';
    if(tags.tourism==='aquarium')return'水族館';
    if(tags.shop==='mall')return'ショッピングモール';
    if(tags.leisure==='park')return'公園';
    if(tags.leisure==='garden')return'庭園';
    if(tags.landuse==='forest')return'緑地';
    if(tags.amenity==='planetarium')return'プラネタリウム';
    if(tags.amenity==='bench')return'ベンチ';
    if(tags.tourism==='attraction')return'見どころ';
    return tags.tourism||tags.leisure||tags.amenity||tags.shop||'スポット';
  }
  function mapProps(tags){
    const p={indoor:false,shade:false,water:false,seating:false,lowodor:false};
    const has=(k,v)=>tags&&tags[k]===v;
    if(has('amenity','library')||has('tourism','museum')||has('amenity','planetarium')||has('amenity','arts_centre')||has('tourism','aquarium')||has('shop','mall'))p.indoor=true;
    if(has('leisure','park')||has('leisure','garden')||has('landuse','forest'))p.shade=true;
    if(has('natural','water')||has('waterway','riverbank')||tags.water==='lake')p.water=true;
    if(has('amenity','bench')||has('leisure','park'))p.seating=true;
    if(has('amenity','library')||has('tourism','museum')||has('amenity','planetarium')||has('amenity','arts_centre'))p.lowodor=true;
    return p;
  }

  function buildOverpassQuery(lat,lon,radKm){
    const r=Math.max(1,radKm)*1000;
    const TAGS=[
      'amenity=library','tourism=museum','amenity=planetarium','amenity=arts_centre','tourism=aquarium','shop=mall',
      'leisure=park','leisure=garden','landuse=forest',
      'natural=water','waterway=riverbank','water=lake','amenity=bench'
    ];
    const Q=TAGS.map(kv=>{ const [k,v]=kv.split("="); return `node(around:${r},${lat},${lon})[${k}=${v}];way(around:${r},${lat},${lon})[${k}=${v}];relation(around:${r},${lat},${lon})[${k}=${v}];`; }).join("\n");
    return `[out:json][timeout:25];(${Q});out center 200;`;
  }

  async function fetchOverpassJSON(query, {timeoutMs=12000, retries=2} = {}){
    const ENDPOINTS=["https://overpass-api.de/api/interpreter","https://z.overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter"];
    let lastErr;
    for(let r=0;r<=retries;r++){
      for(const url of ENDPOINTS){
        try{
          const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(), timeoutMs);
          const res=await fetch(url,{method:"POST",body:query,headers:{"Content-Type":"text/plain"},signal:ctl.signal,cache:"no-store"});
          clearTimeout(timer);
          if(!res.ok) throw new Error(`HTTP ${res.status} at ${url}`);
          return await res.json();
        }catch(e){ lastErr=e; }
      }
      await new Promise(res=>setTimeout(res,800*(r+1)));
    }
    throw lastErr||new Error("Overpass fetch failed");
  }

  async function run(){
    setLoading();
    const btn=document.getElementById('searchSpots'); if(btn) btn.disabled=true;
    try{
      const region=document.getElementById('region');
      const minutes=parseInt((document.getElementById('driveMin')||{}).value,10)||20;
      const profile=(document.getElementById('speedProfile')||{}).value||'normal';
      saveUI(); updateSummary();

      let lat,lon;
      if(region && region.value==='current'){
        try{ const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:8000}));
             lat=pos.coords.latitude; lon=pos.coords.longitude;
        }catch(_){ const p=PRESETS.esaka; lat=p.lat; lon=p.lon; if(region) region.value='esaka'; }
      }else{ const p=PRESETS[region?region.value:'esaka']||PRESETS.esaka; lat=p.lat; lon=p.lon; }

      const kmh=speedToKmh(profile);
      const radKm=Math.max(1,(kmh*(minutes/60))*0.6);

      const json=await fetchOverpassJSON(buildOverpassQuery(lat,lon,radKm));

      const elements=(json.elements||[]).map(e=>{
        const latc=e.lat||(e.center&&e.center.lat);
        const lonc=e.lon||(e.center&&e.center.lon);
        const tags=e.tags||{};
        const hasName = !!(tags.name || tags['name:ja'] || tags['name:en']);
        const type    = friendlyType(tags);
        const name    = hasName ? (tags.name || tags['name:ja'] || tags['name:en']) : type;
        const props   = mapProps(tags);
        const distKm  = dist(lat,lon,latc,lonc);
        const isUnnamed = !hasName;
        const exclude = (isUnnamed && (tags.amenity==='bench' || type==='ベンチ')) ||
                        (EXCLUDE_UNNAMED_ATTRACTION && isUnnamed && tags.tourism==='attraction');
        return exclude ? null : {id:e.id,lat:latc,lon:lonc,tags,name,props,distKm,type};
      }).filter(Boolean);

      const items=elements.sort((a,b)=>a.distKm-b.distKm).slice(0,10);

      const ul=document.getElementById('spots'); ul.innerHTML='';
      if(!items.length){ setMessage('見つかりませんでした。'); return; }
      items.forEach(s=>{
        const feats=[]; if(s.props.indoor)feats.push('屋内'); if(s.props.shade)feats.push('木陰'); if(s.props.water)feats.push('水辺'); if(s.props.seating)feats.push('ベンチ'); if(s.props.lowodor)feats.push('匂い少');
        const li=document.createElement('li'); li.className='spot';
        li.setAttribute('data-id',s.id); li.setAttribute('data-lat',s.lat); li.setAttribute('data-lon',s.lon); li.setAttribute('data-name',s.name||'');
        li.innerHTML=`<div>
          <strong>${s.name}</strong> <span class="badge">${s.type||""}</span>
          <div class='meta'>約${s.distKm.toFixed(1)}km／${feats.length?feats.join('・'):'特徴情報なし'}</div>
        </div>
        <div class='actions vstack'>
          <button class='iconbtn gmaps' aria-label='Googleマップで開く' title='Googleマップで開く'>G</button>
          <a class='iconbtn amaps' aria-label='Appleマップで開く' target='_blank' rel='noopener' title='Appleマップで開く' href='https://maps.apple.com/?ll=${s.lat},${s.lon}&q=${encodeURIComponent(s.name)}'></a>
        </div>`;
        ul.appendChild(li);
      });
    }catch(e){
      setMessage(/HTTP 429/.test(String(e))?"混雑のため取得制限中です。1–2分おいて再試行してください。":/AbortError/.test(String(e))?"タイムアウトしました。通信状況の良い場所でお試しください。":"取得に失敗しました。時間をおいて再試行してください。");
    }finally{
      const btn=document.getElementById('searchSpots'); if(btn) btn.disabled=false;
    }
  }

  function bindUI(){
    const btn=document.getElementById('searchSpots'); if(btn) btn.addEventListener('click', run);
    const det=document.getElementById('filters'); if(det){ det.open=false; det.addEventListener('toggle', ()=>{ saveUI(); }); }
    ['region','driveMin','speedProfile','prio-indoor','prio-shade','prio-water','prio-seating','prio-lowodor'].forEach(id=>{
      const el=document.getElementById(id); if(el){ el.addEventListener('change', ()=>{ saveUI(); updateSummary(); }); }
    });
    const reset=document.getElementById('resetFilters'); if(reset) reset.addEventListener('click', ()=>{
      ['prio-indoor','prio-shade','prio-water','prio-seating','prio-lowodor'].forEach(id=>{
        const el=document.getElementById(id); if(el) el.value = el.getAttribute('value') || el.defaultValue || 1;
      });
      updateSummary();
    });
  }

  window.addEventListener('load', ()=>{
    loadUI();
    updateSummary();
    bindUI();
    run();
  });
})();