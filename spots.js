// spots.js — refactor: use Utils, disable button, cache, unnamed bench exclude
(function(){
  const PRESETS={esaka:{lat:34.7565,lon:135.4968},kyoto:{lat:35.0380,lon:135.7740},kobe:{lat:34.6913,lon:135.1830},omiya:{lat:35.9060,lon:139.6240},fukushima:{lat:37.7608,lon:140.4747}};
  const EXCLUDE_UNNAMED_ATTRACTION = false; // 任意で true にすると無名 attraction も除外

  function featureChips(p){ const a=[]; if(p.indoor)a.push("屋内"); if(p.shade)a.push("木陰"); if(p.water)a.push("水辺"); if(p.seating)a.push("ベンチ"); if(p.lowodor)a.push("匂い少"); return a; }
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
      'natural=water','waterway=riverbank','water=lake',
      'amenity=bench'
    ];
    const Q=TAGS.map(kv=>{
      const [k,v]=kv.split("=");
      return `node(around:${r},${lat},${lon})[${k}=${v}];way(around:${r},${lat},${lon})[${k}=${v}];relation(around:${r},${lat},${lon})[${k}=${v}];`;
    }).join("\n");
    return `[out:json][timeout:25];(${Q});out center 200;`;
  }

  function setLoading(){ const ul=document.getElementById('spots'); if(ul) ul.innerHTML='<li class="spot loading">検索中…</li>'; }
  function setMessage(msg){ const ul=document.getElementById('spots'); if(ul) ul.innerHTML=`<li class="spot">${msg}</li>`; }

  function speedToKmh(p){ if(p==='slow')return 25; if(p==='fast')return 50; return 35; }

  async function run(){
    const region=document.getElementById('region');
    const minutes=parseInt((document.getElementById('driveMin')||{}).value,10)||20;
    const profile=(document.getElementById('speedProfile')||{}).value||'normal';
    const btn=document.getElementById('searchSpots');
    if(btn) btn.disabled = true;

    try{
      setLoading();
      let lat,lon;
      if(region && region.value==='current'){
        try{
          const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:8000}));
          lat=pos.coords.latitude; lon=pos.coords.longitude;
        }catch(_){ const p=PRESETS.esaka; lat=p.lat; lon=p.lon; if(region) region.value='esaka'; }
      }else{ const p=PRESETS[region?region.value:'esaka']||PRESETS.esaka; lat=p.lat; lon=p.lon; }

      const kmh=speedToKmh(profile);
      const radKm=Math.max(1,(kmh*(minutes/60))*0.6);

      const key=Utils.cacheKey('spots',{lat,lon,radKm});
      const cached=Utils.cacheGet(key);
      let json;
      if(cached){ json = cached; } else { json = await Utils.fetchOverpassJSON(buildOverpassQuery(lat,lon,radKm)); Utils.cacheSet(key,json); }

      const elements=(json.elements||[]).map(e=>{
        const latc=e.lat||(e.center&&e.center.lat);
        const lonc=e.lon||(e.center&&e.center.lon);
        const tags=e.tags||{};
        const hasName = !!(tags.name || tags['name:ja'] || tags['name:en']);
        const type    = friendlyType(tags);
        const name    = hasName ? (tags.name || tags['name:ja'] || tags['name:en']) : type;
        const props   = mapProps(tags);
        const distKm  = Utils.haversine(lat,lon,latc,lonc);
        const isUnnamed = !hasName;
        const exclude = (isUnnamed && (tags.amenity==='bench' || type==='ベンチ')) ||
                        (EXCLUDE_UNNAMED_ATTRACTION && isUnnamed && tags.tourism==='attraction');
        return exclude ? null : {id:e.id,lat:latc,lon:lonc,tags,name,props,distKm,type};
      }).filter(Boolean);

      const items=elements.sort((a,b)=>a.distKm-b.distKm).slice(0,10);

      const ul=document.getElementById('spots'); ul.innerHTML='';
      if(!items.length){ setMessage('見つかりませんでした。'); return; }
      items.forEach(s=>{
        const feats=featureChips(s.props||{});
        const li=document.createElement('li'); li.className='spot';
        li.setAttribute('data-lat',s.lat); li.setAttribute('data-lon',s.lon); li.setAttribute('data-name',s.name||'');
        li.innerHTML=`<div>
          <strong>${s.name}</strong> <span class="badge">${s.type||""}</span>
          <div class='meta'>約${s.distKm.toFixed(1)}km／${feats.length?feats.join('・'):'特徴情報なし'}</div>
        </div>
        <div class='actions vstack'>
          <button class='iconbtn gmaps' aria-label='Googleマップで開く' title='Googleマップで開く' data-lat='${s.lat}' data-lon='${s.lon}' data-name='${s.name}'>G</button>
          <a class='iconbtn amaps' aria-label='Appleマップで開く' target='_blank' rel='noopener' title='Appleマップで開く' href='https://maps.apple.com/?ll=${s.lat},${s.lon}&q=${encodeURIComponent(s.name)}'></a>
        </div>`;
        ul.appendChild(li);
      });
    }catch(e){
      setMessage(Utils.errorMessage(e));
    }finally{
      if(btn) btn.disabled = false;
    }
  }

  window.runSpots = run;
  window.addEventListener('load', ()=>{
    setLoading();
    const btn=document.getElementById('searchSpots'); if(btn) btn.addEventListener('click', run);
    const reset=document.getElementById('resetFilters'); if(reset) reset.addEventListener('click', ()=>{
      ['prio-indoor','prio-shade','prio-water','prio-seating','prio-lowodor'].forEach(id=>{
        const el=document.getElementById(id); if(el) el.value = el.getAttribute('value') || el.defaultValue || 1;
      });
    });
    run();
  });
})();