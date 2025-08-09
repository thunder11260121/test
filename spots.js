
(function(){
  const presets={esaka:{name:"大阪・江坂",lat:34.7565,lon:135.4968},kyoto:{name:"京都市",lat:35.0380,lon:135.7740},kobe:{name:"神戸市",lat:34.6913,lon:135.1830},omiya:{name:"さいたま市大宮区",lat:35.9060,lon:139.6240},fukushima:{name:"福島市",lat:37.7608,lon:140.4747}};

  
// ---- Overpass fetch with mirrors / timeout / retries ----
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
        // try next endpoint
      }
    }
    // backoff before next retry round
    await new Promise(res => setTimeout(res, 800*(r+1)));
  }
  throw lastErr || new Error("Overpass fetch failed");
}

// ---- Small utils ----
function rad(x){ return x*Math.PI/180; }
const EARTH_R = 6371;
function haversine(lat1,lon1,lat2,lon2){
  const dLat = rad(lat2-lat1), dLon = rad(lon2-lon1);
  const A = Math.sin(dLat/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
  return 2*EARTH_R*Math.atan2(Math.sqrt(A), Math.sqrt(1-A));
}
function speedToKmh(p){ if(p==='slow')return 25; if(p==='fast')return 50; return 35; }


  const categories={
    indoor:['amenity=library','tourism=museum','amenity=planetarium','amenity=arts_centre','tourism=aquarium','shop=mall'],
    shade:['leisure=park','leisure=garden','landuse=forest'],
    water:['natural=water','water=lake','leisure=marina','waterway=riverbank'],
    seating:['amenity=bench','leisure=park'],
    lowodor:['amenity=library','tourism=museum','amenity=planetarium','amenity=arts_centre']
  };
  function buildOverpassQuery(lat,lon,radKm){
    const r=Math.max(1,radKm)*1000;
    const tagSet=new Set(Object.values(categories).flat());
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
  function shortDesc(s){
    const t=s.tags||{}; const type=friendlyType(t);
    const dist=`約${(s.distKm).toFixed(1)}km`; const feats=[];
    if(s.props.indoor)feats.push('屋内'); if(s.props.shade)feats.push('木陰'); if(s.props.water)feats.push('水辺'); if(s.props.seating)feats.push('ベンチ'); if(s.props.lowodor)feats.push('匂い少');
    const featLine=feats.length?`（${feats.join('・')}）`:"";
    return `${type}・${dist}${featLine}`;
  }
  function appleMapsLink(s){ const q=encodeURIComponent((s.tags && (s.tags.name||s.tags['name:ja'])) || '目的地'); return `https://maps.apple.com/?ll=${s.lat},${s.lon}&q=${q}`; }

  async function search(lat,lon,minutes,profile,limit=10){
    const kmh=speedToKmh(profile); const radKm=Math.max(1,(kmh*(minutes/60))*0.6);
    const q=buildOverpassQuery(lat,lon,radKm);
    const json = await fetchOverpassJSON(q);
    const es=(json.elements||[]).map(e=>{
      const latc=e.lat||(e.center&&e.center.lat);
      const lonc=e.lon||(e.center&&e.center.lon);
      const tags=e.tags||{};
      const name=tags.name||tags['name:ja']||tags['name:en']||"スポット";
      return {id:e.id,lat:latc,lon:lonc,tags,name};
    }).filter(x=>x.lat&&x.lon);
    const items=es.map(s=>{const props=mapProps(s.tags); const distKm=haversine(lat,lon,s.lat,s.lon); return {...s,props,distKm};}).sort((a,b)=>a.distKm-b.distKm).slice(0,limit);
    return items;
  }

  function render(items){
    const ul=document.getElementById('spots'); ul.innerHTML='';
    if(!items.length){ const li=document.createElement('li'); li.className='spot'; li.textContent='見つかりませんでした。'; ul.appendChild(li); return; }
    items.forEach(s=>{
      const li=document.createElement('li'); li.className='spot';
      li.setAttribute('data-lat',s.lat); li.setAttribute('data-lon',s.lon); li.setAttribute('data-name',s.name);
      li.innerHTML = `<div><strong>${s.name}</strong><div class='meta'>${shortDesc(s)}</div></div>
        <div class='actions vstack'>
          <button class='iconbtn gmaps' title='Googleマップで開く'>G</button>
          <a class='iconbtn amaps' target='_blank' rel='noopener' title='Appleマップで開く' href='${appleMapsLink(s)}'></a>
        </div>`;
      ul.appendChild(li);
    });
  }

  async function run(){
    let lat=34.7565, lon=135.4968;
    try{
      const items=await search(lat,lon,20,'normal',10);
      render(items);
    }catch(e){
      console.error(e);
      const ul=document.getElementById('spots');
      if(ul){
        const msg = /HTTP 429/.test(String(e)) ? "混雑のため取得制限中です。1–2分おいて再試行してください。" :
                    /AbortError/.test(String(e)) ? "タイムアウトしました。通信状況の良い場所でお試しください。" :
                    "取得に失敗しました。時間をおいて再試行してください。";
        ul.innerHTML = `<li class='spot'>${msg}</li>`;
      }
    }
  }
  window.addEventListener('load', run);
})();
