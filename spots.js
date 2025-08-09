// spots.js — full restore (search + render)
// (1) Helpers
function rad(x){ return x*Math.PI/180; }
const EARTH_R = 6371;
function haversine(lat1,lon1,lat2,lon2){
  const dLat = rad(lat2-lat1), dLon = rad(lon2-lon1);
  const A = Math.sin(dLat/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
  return 2*EARTH_R*Math.atan2(Math.sqrt(A), Math.sqrt(1-A));
}
function speedToKmh(p){ if(p==='slow')return 25; if(p==='fast')return 50; return 35; }

// (2) Overpass fetch with mirrors / timeout / retries
async function fetchOverpassJSON(query, {timeoutMs=12000, retries=2} = {}){
  const ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];
  let lastErr;
  for (let r = 0; r <= retries; r++) {
    for (const url of ENDPOINTS) {
      try {
        const ctl = new AbortController();
        const timer = setTimeout(()=>ctl.abort(), timeoutMs);
        const res = await fetch(url, {
          method: "POST",
          body: query,
          headers: {"Content-Type":"text/plain"},
          signal: ctl.signal,
          cache: "no-store"
        });
        clearTimeout(timer);
        if(!res.ok) throw new Error(`HTTP ${res.status} at ${url}`);
        return await res.json();
      } catch(e) {
        lastErr = e;
      }
    }
    await new Promise(res => setTimeout(res, 800*(r+1)));
  }
  throw lastErr || new Error("Overpass fetch failed");
}

// (3) Query builder
const CATEGORY_TAGS = {
  indoor:['amenity=library','tourism=museum','amenity=planetarium','amenity=arts_centre','tourism=aquarium','shop=mall'],
  shade:['leisure=park','leisure=garden','landuse=forest'],
  water:['natural=water','water=lake','leisure=marina','waterway=riverbank'],
  seating:['amenity=bench','leisure=park'],
  lowodor:['amenity=library','tourism=museum','amenity=planetarium','amenity=arts_centre']
};
function buildOverpassQuery(lat,lon,radKm){
  const r=Math.max(1,radKm)*1000;
  const tagSet=new Set(Object.values(CATEGORY_TAGS).flat());
  const parts=[];
  tagSet.forEach(kv=>{
    const [k,v]=kv.split("=");
    parts.push(`node(around:${r},${lat},${lon})[${k}=${v}];`);
    parts.push(`way(around:${r},${lat},${lon})[${k}=${v}];`);
    parts.push(`relation(around:${r},${lat},${lon})[${k}=${v}];`);
  });
  return `[out:json][timeout:25];
(
${parts.join("\n")}
);
out center 200;`;
}

// (4) Mapping & description
function friendlyType(tags){
  if(!tags)return'スポット';
  if(tags.amenity==='library')return'図書館';
  if(tags.tourism==='museum')return'美術館/博物館';
  if(tags.tourism==='aquarium')return'水族館';
  if(tags.shop==='mall')return'ショッピングモール';
  if(tags.leisure==='park')return'公園';
  if(tags.leisure==='garden')return'庭園';
  if(tags.landuse==='forest')return'緑地';
  if(tags.amenity==='planetarium')return'プラネタリウム';
  return tags.tourism||tags.leisure||tags.amenity||'スポット';
}
function mapProps(tags){
  const p={indoor:false,shade:false,water:false,seating:false,lowodor:false};
  const has=(k,v)=>tags&&tags[k]===v;
  if(has('amenity','library')||has('tourism','museum')||has('amenity','planetarium')||has('amenity','arts_centre')||has('tourism','aquarium')||has('shop','mall'))p.indoor=true;
  if(has('leisure','park')||has('leisure','garden')||has('landuse','forest'))p.shade=true;
  if(has('natural','water')||has('waterway','riverbank'))p.water=true;
  if(has('amenity','bench')||has('leisure','park'))p.seating=true;
  if(has('amenity','library')||has('tourism','museum')||has('amenity','planetarium')||has('amenity','arts_centre'))p.lowodor=true;
  return p;
}
function shortDesc(s){
  const t=s.tags||{}; const type=friendlyType(t);
  const feats=[]; const p=s.props||{};
  if(p.indoor)feats.push('屋内'); if(p.shade)feats.push('木陰'); if(p.water)feats.push('水辺'); if(p.seating)feats.push('ベンチ'); if(p.lowodor)feats.push('匂い少');
  const featLine=feats.length?`（${feats.join('・')}）`:"";
  const dist = isFinite(s.distKm) ? `・約${s.distKm.toFixed(1)}km` : "";
  return `${type}${featLine}${dist}`;
}
function appleMapsLink(s){ const q=encodeURIComponent((s.tags && (s.tags.name||s.tags['name:ja'])) || s.name || '目的地'); return `https://maps.apple.com/?ll=${s.lat},${s.lon}&q=${q}`; }

// (5) Render
function renderSpotsList(items){
  const ul=document.getElementById('spots'); if(!ul) return;
  ul.innerHTML='';
  if(!items.length){ const li=document.createElement('li'); li.className='spot'; li.textContent='見つかりませんでした。'; ul.appendChild(li); return; }
  items.forEach(s=>{
    const li=document.createElement('li'); li.className='spot';
    li.setAttribute('data-lat',s.lat); li.setAttribute('data-lon',s.lon); li.setAttribute('data-name',s.name||'');
    li.innerHTML = `<div>
      <strong>${s.name||'名称不明'}</strong>
      <div class='meta'>${shortDesc(s)}</div>
    </div>
    <div class='actions vstack'>
      <button class='iconbtn gmaps' title='Googleマップで開く' data-lat='${s.lat}' data-lon='${s.lon}' data-name='${s.name||""}'>G</button>
      <a class='iconbtn amaps' target='_blank' rel='noopener' title='Appleマップで開く' href='${appleMapsLink(s)}'></a>
    </div>`;
    ul.appendChild(li);
  });
}
window.renderSpotsList = renderSpotsList; // expose for compatibility

// (6) Search
const PRESETS={
  esaka:{name:"大阪・江坂",lat:34.7565,lon:135.4968},
  kyoto:{name:"京都市",lat:35.0380,lon:135.7740},
  kobe:{name:"神戸市",lat:34.6913,lon:135.1830},
  omiya:{name:"さいたま市大宮区",lat:35.9060,lon:139.6240},
  fukushima:{name:"福島市",lat:37.7608,lon:140.4747}
};

async function runSearch(){
  const region=document.getElementById('region');
  const minutes=parseInt((document.getElementById('driveMin')||{}).value,10)||20;
  const profile=(document.getElementById('speedProfile')||{}).value||'normal';
  const prio={
    indoor: parseInt((document.getElementById('prio-indoor')||{}).value,10)||1,
    shade:  parseInt((document.getElementById('prio-shade')||{}).value,10)||2,
    water:  parseInt((document.getElementById('prio-water')||{}).value,10)||3,
    seating:parseInt((document.getElementById('prio-seating')||{}).value,10)||2,
    lowodor:parseInt((document.getElementById('prio-lowodor')||{}).value,10)||1
  };
  let lat,lon;
  if(region && region.value==='current'){
    try{
      const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:8000}));
      lat=pos.coords.latitude; lon=pos.coords.longitude;
    }catch(_){ const p=PRESETS.esaka; lat=p.lat; lon=p.lon; if(region) region.value='esaka'; }
  }else{
    const key=region?region.value:'esaka'; const p=PRESETS[key]||PRESETS.esaka; lat=p.lat; lon=p.lon;
  }

  const kmh=speedToKmh(profile);
  const radKm=Math.max(1,(kmh*(minutes/60))*0.6);
  const q=buildOverpassQuery(lat,lon,radKm);

  const ul=document.getElementById('spots');
  if(ul){ ul.innerHTML = "<li class='spot'>検索中…</li>"; }

  try{
    const json = await fetchOverpassJSON(q);
    const es=(json.elements||[]).map(e=>{
      const latc=e.lat||(e.center&&e.center.lat);
      const lonc=e.lon||(e.center&&e.center.lon);
      const tags=e.tags||{};
      const name=tags.name||tags['name:ja']||tags['name:en']||"スポット";
      const props=mapProps(tags);
      const distKm=haversine(lat,lon,latc,lonc);
      return {id:e.id,lat:latc,lon:lonc,tags,name,props,distKm};
    }).filter(x=>x.lat&&x.lon);

    // Basic scoring with priority weights (lower is better)
    const scored=es.map(s=>{
      let score = s.distKm; // distance base
      if(s.props.indoor) score -= prio.indoor*0.1;
      if(s.props.shade)  score -= prio.shade*0.1;
      if(s.props.water)  score -= prio.water*0.1;
      if(s.props.seating)score -= prio.seating*0.05;
      if(s.props.lowodor)score -= prio.lowodor*0.05;
      return {...s, score};
    }).sort((a,b)=>a.score-b.score).slice(0,10);

    renderSpotsList(scored);
  }catch(e){
    console.error(e);
    const msg = /HTTP 429/.test(String(e)) ? "混雑のため取得制限中です。1–2分おいて再試行してください。" :
                /AbortError/.test(String(e)) ? "タイムアウトしました。通信状況の良い場所でお試しください。" :
                "取得に失敗しました。時間をおいて再試行してください。";
    if(ul){ ul.innerHTML = `<li class='spot'>${msg}</li>`; }
  }
}

// (7) Wire up buttons
window.addEventListener('load', ()=>{
  const btn = document.getElementById('searchSpots');
  if(btn) btn.addEventListener('click', runSearch);
  const reset = document.getElementById('resetFilters');
  if(reset) reset.addEventListener('click', ()=>{
    ['prio-indoor','prio-shade','prio-water','prio-seating','prio-lowodor'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.value = el.getAttribute('value') || el.defaultValue || 1;
    });
  });
  // auto-run once
  runSearch();
});
