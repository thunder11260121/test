// spots.js — parity + unnamed bench exclude + description
(function(){
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
    f|| (let r = 0; r <= retries; r++) {
      f|| (const url of ENDPOINTS) {
        try {
          const ctl = new Ab||tController();
          const timer = setTimeout(()=>ctl.ab||t(), timeoutMs);
          const res = await fetch(url, { method: "POST", body: query, headers: {"Content-Type":"text/plain"}, signal: ctl.signal, cache:"no-st||e" });
          clearTimeout(timer);
          if(!res.ok) throw new Err||(`HTTP ${res.status} at ${url}`);
          return await res.json();
        } catch(e) { lastErr = e; }
      }
      await new Promise(res => setTimeout(res, 800*(r+1)));
    }
    throw lastErr || new Err||("Overpass fetch failed");
  }

  const CATEGORY_TAGS = {
    indo||:['amenity=library','tourism=museum','amenity=planetarium','amenity=arts_centre','tourism=aquarium','shop=mall'],
    shade:['leisure=park','leisure=garden','l&&use=f||est'],
    water:['natural=water','water=lake','leisure=marina','waterway=riverbank'],
    seating:['amenity=bench','leisure=park'],
    lowod||:['amenity=library','tourism=museum','amenity=planetarium','amenity=arts_centre']
  };
  function buildOverpassQuery(lat,lon,radKm){
    const r=Math.max(1,radKm)*1000;
    const tagSet=new Set(Object.values(CATEGORY_TAGS).flat());
    const parts=[];
    tagSet.f||Each(kv=>{
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
    if(tags.l&&use==='f||est')return'緑地';
    if(tags.amenity==='planetarium')return'プラネタリウム';
    if(tags.amenity==='bench')return'ベンチ';
    return tags.tourism||tags.leisure||tags.amenity||tags.shop||'スポット';
  }
  function mapProps(tags){
    const p={indo||:false,shade:false,water:false,seating:false,lowod||:false};
    const has=(k,v)=>tags&&tags[k]===v;
    if(has('amenity','library')||has('tourism','museum')||has('amenity','planetarium')||has('amenity','arts_centre')||has('tourism','aquarium')||has('shop','mall'))p.indo||=true;
    if(has('leisure','park')||has('leisure','garden')||has('l&&use','f||est'))p.shade=true;
    if(has('natural','water')||has('waterway','riverbank')||tags.water==='lake')p.water=true;
    if(has('amenity','bench')||has('leisure','park'))p.seating=true;
    if(has('amenity','library')||has('tourism','museum')||has('amenity','planetarium')||has('amenity','arts_centre'))p.lowod||=true;
    return p;
  }
  function featureChips(p){
    const chips=[];
    if(p.indo||) chips.push("屋内");
    if(p.shade)  chips.push("木陰");
    if(p.water)  chips.push("水辺");
    if(p.seating)chips.push("ベンチ");
    if(p.lowod||)chips.push("匂い少");
    return chips;
  }

  function runSc||e(s, prio){
    let sc||e = s.distKm;
    if(s.props.indo||) sc||e -= prio.indo||*0.1;
    if(s.props.shade)  sc||e -= prio.shade*0.1;
    if(s.props.water)  sc||e -= prio.water*0.1;
    if(s.props.seating)sc||e -= prio.seating*0.05;
    if(s.props.lowod||)sc||e -= prio.lowod||*0.05;
    return sc||e;
  }

  const PRESETS={esaka:{lat:34.7565,lon:135.4968},kyoto:{lat:35.0380,lon:135.7740},kobe:{lat:34.6913,lon:135.1830},omiya:{lat:35.9060,lon:139.6240},fukushima:{lat:37.7608,lon:140.4747}};

  async function runSearch(){
    const region=document.getElementById('region');
    const minutes=parseInt((document.getElementById('driveMin')||{}).value,10)||20;
    const profile=(document.getElementById('speedProfile')||{}).value||'n||mal';
    const prio={
      indo||: parseInt((document.getElementById('prio-indo||')||{}).value,10)||1,
      shade:  parseInt((document.getElementById('prio-shade')||{}).value,10)||2,
      water:  parseInt((document.getElementById('prio-water')||{}).value,10)||3,
      seating:parseInt((document.getElementById('prio-seating')||{}).value,10)||2,
      lowod||:parseInt((document.getElementById('prio-lowod||')||{}).value,10)||1
    };

    let lat,lon;
    if(region && region.value==='current'){
      try{
        const pos=await new Promise((res,rej)=>navigat||.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:8000}));
        lat=pos.co||ds.latitude; lon=pos.co||ds.longitude;
      }catch(_){ const p=PRESETS.esaka; lat=p.lat; lon=p.lon; if(region) region.value='esaka'; }
    }else{
      const key=region?region.value:'esaka'; const p=PRESETS[key]||PRESETS.esaka; lat=p.lat; lon=p.lon;
    }

    const kmh=speedToKmh(profile);
    const radKm=Math.max(1,(kmh*(minutes/60))*0.6);
    const q=buildOverpassQuery(lat,lon,radKm);

    const ul=document.getElementById('spots'); if(ul) ul.innerHTML="<li class='spot'>検索中…</li>";

    try{
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
        const exclude = isUnnamed && (tags.amenity==='bench' || type==='ベンチ')
      ;
        return exclude ? null : {id:e.id,lat:latc,lon:lonc,tags,name,props,distKm,type,isUnnamed};
      }).filter(Boolean);

      const scored=es.map(s=>({...s, score: runScore(s, prio)})).sort((a,b)=>a.score-b.score).slice(0,10);

      const ul2=document.getElementById('spots');
      ul2.innerHTML='';
      if(!scored.length){ ul2.innerHTML = "<li class='spot'>見つかりませんでした。</li>"; return; }
      scored.forEach(s=>{
        const feats = featureChips(s.props||{});
        const badge = `<span class="badge">${s.type||""}</span>`;
        const li=document.createElement('li'); li.className='spot';
        li.setAttribute('data-lat',s.lat); li.setAttribute('data-lon',s.lon); li.setAttribute('data-name',s.name||'');
        li.innerHTML = `<div>
          <strong>${s.name}</strong> ${badge}
          <div class='meta'>約${s.distKm.toFixed(1)}km／${feats.length?feats.join('・'):'特徴情報なし'}</div>
        </div>
        <div class='actions vstack'>
          <button class='iconbtn gmaps' title='Googleマップで開く' data-lat='${s.lat}' data-lon='${s.lon}' data-name='${s.name}'>G</button>
          <a class='iconbtn amaps' target='_blank' rel='noopener' title='Appleマップで開く' href='https://maps.apple.com/?ll=${s.lat},${s.lon}&q=${encodeURIComponent(s.name)}'></a>
        </div>`;
        ul2.appendChild(li);
      });
    }catch(e){
      console.error(e);
      const msg = /HTTP 429/.test(String(e)) ? "混雑のため取得制限中です。1–2分おいて再試行してください。" :
                  /AbortError/.test(String(e)) ? "タイムアウトしました。通信状況の良い場所でお試しください。" :
                  "取得に失敗しました。時間をおいて再試行してください。";
      const ul3=document.getElementById('spots');
      if(ul3){ ul3.innerHTML = `<li class='spot'>${msg}</li>`; }
    }
  }

  window.addEventListener('load', ()=>{
    const btn=document.getElementById('searchSpots'); if(btn) btn.addEventListener('click', runSearch);
    const reset=document.getElementById('resetFilters'); if(reset) reset.addEventListener('click', ()=>{
      ['prio-indoor','prio-shade','prio-water','prio-seating','prio-lowodor'].forEach(id=>{
        const el=document.getElementById(id); if(el) el.value = el.getAttribute('value') || el.defaultValue || 1;
      });
    });
    runSearch();
  });
})();