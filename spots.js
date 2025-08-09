// spots.js hotfix v1 — always autorun + loading indicator
(function(){
  console.log("spots.js hotfix v1 loaded");
  function rad(x){ return x*Math.PI/180; }
  const R = 6371;
  function haversine(a,b,c,d){ const dLat=rad(c-a), dLon=rad(d-b); const A=Math.sin(dLat/2)**2 + Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dLon/2)**2; return 2*R*Math.atan2(Math.sqrt(A),Math.sqrt(1-A)); }
  function speedToKmh(p){ if(p==='slow')return 25; if(p==='fast')return 50; return 35; }

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
          const res = await fetch(url, { method: "POST", body: query, headers: {"Content-Type":"text/plain"}, signal: ctl.signal, cache:"no-store" });
          clearTimeout(timer);
          if(!res.ok) throw new Error(`HTTP ${res.status} at ${url}`);
          return await res.json();
        } catch(e) { lastErr = e; }
      }
      await new Promise(res => setTimeout(res, 800*(r+1)));
    }
    throw lastErr || new Error("Overpass fetch failed");
  }

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
  function featureChips(p){
    const chips=[];
    if(p.indoor) chips.push("屋内");
    if(p.shade)  chips.push("木陰");
    if(p.water)  chips.push("水辺");
    if(p.seating)chips.push("ベンチ");
    if(p.lowodor)chips.push("匂い少");
    return chips;
  }

  const PRESETS={esaka:{lat:34.7565,lon:135.4968},kyoto:{lat:35.0380,lon:135.7740},kobe:{lat:34.6913,lon:135.1830},omiya:{lat:35.9060,lon:139.6240},fukushima:{lat:37.7608,lon:140.4747}};

  function setLoading(){ const ul=document.getElementById('spots'); if(ul) ul.innerHTML="<li class='spot'>検索中…</li>"; }

  async function runSearch(){
    try{
      setLoading();
      const region=document.getElementById('region');
      const minutes=parseInt((document.getElementById('driveMin')||{}).value,10)||20;
      const profile=(document.getElementById('speedProfile')||{}).value||'normal';

      let lat,lon;
      if(region && region.value==='current'){
        try{
          const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:8000}));
          lat=pos.coords.latitude; lon=pos.coords.longitude;
        }catch(_){ const p=PRESETS.esaka; lat=p.lat; lon=p.lon; if(region) region.value='esaka'; }
      }else{
        const key=region?region.value:'esaka'; const p=PRESETS[key]||PRESETS.esaka; lat=p.lat; lon=p.lon;
      }

      const kmh = (profile==='slow'?25:profile==='fast'?50:35);
      const radKm=Math.max(1,(kmh*(minutes/60))*0.6);
      const q=buildOverpassQuery(lat,lon,radKm);

      const json = await fetchOverpassJSON(q);
      const es=(json.elements||[]).map(e=>{
        const latc=e.lat||(e.center&&e.center.lat);
        const lonc=e.lon||(e.center&&e.center.lon);
        const tags=e.tags||{};
        const hasName = !!(tags.name || tags['name:ja'] || tags['name:en']);
        const type    = friendlyType(tags);
        const name    = hasName ? (tags.name || tags['name:ja'] || tags['name:en']) : type;
        const props   = mapProps(tags);
        const distKm  = haversine(lat,lon,latc,lonc);
        const isUnnamed = !hasName;
        const exclude = isUnnamed && (tags.amenity==='bench' || type==='ベンチ');
        return exclude ? null : {id:e.id,lat:latc,lon:lonc,tags,name,props,distKm,type,isUnnamed};
      }).filter(Boolean);

      const items = es.sort((a,b)=>a.distKm-b.distKm).slice(0,10);
      const ul=document.getElementById('spots'); ul.innerHTML='';
      if(!items.length){ ul.innerHTML="<li class='spot'>見つかりませんでした。</li>"; return; }
      items.forEach(s=>{
        const feats = featureChips(s.props||{});
        const li=document.createElement('li'); li.className='spot';
        li.setAttribute('data-lat',s.lat); li.setAttribute('data-lon',s.lon); li.setAttribute('data-name',s.name||'');
        li.innerHTML = `<div>
          <strong>${s.name}</strong> <span class="badge">${s.type||""}</span>
          <div class='meta'>約${s.distKm.toFixed(1)}km／${feats.length?feats.join('・'):'特徴情報なし'}</div>
        </div>
        <div class='actions vstack'>
          <button class='iconbtn gmaps' title='Googleマップで開く' data-lat='${s.lat}' data-lon='${s.lon}' data-name='${s.name}'>G</button>
          <a class='iconbtn amaps' target='_blank' rel='noopener' title='Appleマップで開く' href='https://maps.apple.com/?ll=${s.lat},${s.lon}&q=${encodeURIComponent(s.name)}'></a>
        </div>`;
        ul.appendChild(li);
      });
    }catch(e){
      console.error(e);
      const ul=document.getElementById('spots');
      if(ul){ ul.innerHTML = `<li class='spot'>取得に失敗しました。時間をおいて再試行してください。</li>`; }
    }
  }

  // export & autorun hooks
  window.runSpots = runSearch;
  window.addEventListener('load', ()=>{
    setLoading();
    const btn=document.getElementById('searchSpots'); if(btn) btn.addEventListener('click', runSearch);
    const reset=document.getElementById('resetFilters'); if(reset) reset.addEventListener('click', ()=>{
      ['prio-indoor','prio-shade','prio-water','prio-seating','prio-lowodor'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value = el.getAttribute('value') || el.defaultValue || 1; });
    });
    // always kick once
    setTimeout(runSearch, 0);
  });
})();