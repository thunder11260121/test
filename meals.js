
(function(){
  // Presets (same as before)
  const presets = {
    esaka:{name:"大阪・江坂",lat:34.7565,lon:135.4968},
    kyoto:{name:"京都市",lat:35.0380,lon:135.7740},
    kobe:{name:"神戸市",lat:34.6913,lon:135.1830},
    omiya:{name:"さいたま市大宮区",lat:35.9060,lon:139.6240},
    fukushima:{name:"福島市",lat:37.7608,lon:140.4747}
  };

  
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


  // ---- opening_hours (simple) ----
  function parseTimeHHMM(s){ const m=/^(\d{1,2}):(\d{2})$/.exec(s||""); if(!m)return null; const hh=+m[1],mm=+m[2]; if(hh>23||mm>59)return null; return {hh,mm}; }
  function timeToMin(t){ return t.hh*60+t.mm; }
  function parseOpeningHours(oh){
    if(!oh || typeof oh!=="string") return {type:"unknown"};
    oh = oh.trim();
    if(oh==="24/7") return {type:"always"};
    const parts = oh.split(";").map(s=>s.trim());
    const rules = [];
    for(const part of parts){
      const m = /^([A-Za-z]{2}(?:-[A-Za-z]{2})?(?:,[A-Za-z]{2})*)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(part);
      if(!m) continue;
      const map={Su:0,Mo:1,Tu:2,We:3,Th:4,Fr:5,Sa:6};
      const segs=m[1].split(",");
      const openT=parseTimeHHMM(m[2]), closeT=parseTimeHHMM(m[3]);
      if(!openT||!closeT) continue;
      const days=[];
      for(const seg of segs){
        if(seg.includes("-")){
          const [a,b]=seg.split("-"); const ai=map[a], bi=map[b];
          if(ai<=bi){ for(let d=ai; d<=bi; d++) days.push(d); }
          else { for(let d=ai; d<7; d++) days.push(d); for(let d=0; d<=bi; d++) days.push(d); }
        }else{ const di=map[seg]; if(di!=null) days.push(di); }
      }
      rules.push({days, openMin:timeToMin(openT), closeMin:timeToMin(closeT)});
    }
    return rules.length?{type:"rules",rules}:{type:"unknown"};
  }
  function isOpenNow(p){
    if(p.type==="always") return {open:true,label:"営業中",today:"24時間"};
    if(p.type!=="rules") return {open:null,label:"営業時間情報なし"};
    const now=new Date(), day=now.getDay(), min=now.getHours()*60+now.getMinutes();
    const todays=p.rules.filter(r=>r.days.includes(day));
    if(!todays.length) return {open:false,label:"本日休み"};
    for(const r of todays){ if(min>=r.openMin && min<r.closeMin) return {open:true,label:"営業中",today:fmt(r.openMin)+"–"+fmt(r.closeMin)}; }
    return {open:false,label:"営業時間外"};
  }
  function fmt(m){ const hh=String(Math.floor(m/60)).padStart(2,"0"); const mm=String(m%60).padStart(2,"0"); return hh+":"+mm; }

  // ---- cuisine / flags ----
  function cuisineList(tags){ const c=(tags.cuisine||"").toLowerCase(); return c.split(";").map(s=>s.trim()).filter(Boolean); }
  function typeFromTags(tags){ if(tags.shop==="bakery") return "bakery"; return tags.amenity || "place"; }
  function odorScore(tags){ const t=typeFromTags(tags); if(t==="cafe"||t==="ice_cream"||t==="bakery") return -1; const c=cuisineList(tags); if(c.includes("yakiniku")||c.includes("bbq")) return 2; if(c.includes("yakitori")) return 1; return 0; }
  function spicyScore(tags){ const c=cuisineList(tags); if(c.includes("indian")||c.includes("thai")||c.includes("sichuan")||c.includes("korean")) return 1; return 0; }
  function riskFlags(tags){
    const name=((tags.name||tags["name:ja"]||"")+"").toLowerCase();
    const c=cuisineList(tags);
    return {
      raw_fish: c.includes("sushi")||c.includes("sashimi")||name.includes("寿司")||name.includes("刺身"),
      raw_egg: name.includes("生卵")||name.includes("すき焼き")||c.includes("sukiyaki"),
      alcohol: c.includes("bar")||c.includes("pub")||c.includes("izakaya")||name.includes("居酒屋"),
      soft_cheese: c.includes("cheese")||c.includes("pizza")||c.includes("italian"),
      high_mercury: c.includes("tuna")||name.includes("マグロ"),
      deli_meat: name.includes("生ハム")||name.includes("ローストビーフ")
    };
  }
  function friendlyCuisine(tags){
    const t=typeFromTags(tags), c=cuisineList(tags);
    if(t==="bakery"||c.includes("bakery")||c.includes("sandwich")) return "ベーカリー/軽食";
    if(t==="cafe"||t==="ice_cream") return "カフェ/甘味";
    if(c.includes("udon")||c.includes("soba")) return "麺類（うどん/そば）";
    if(c.includes("ramen")) return "ラーメン";
    if(c.includes("japanese")||c.includes("teishoku")) return "和食/定食";
    if(c.includes("family")) return "ファミレス";
    if(c.includes("indian")||c.includes("thai")) return "エスニック";
    return t;
  }
  function explainReason(tags,flags){
    const tips=[];
    if(flags.raw_fish) tips.push("生魚メニューの可能性");
    if(flags.raw_egg) tips.push("生卵/すき焼きに注意");
    if(flags.alcohol) tips.push("アルコール中心の可能性");
    if(flags.soft_cheese) tips.push("ナチュラルチーズに注意");
    if(flags.high_mercury) tips.push("マグロ等は量に注意");
    if(flags.deli_meat) tips.push("デリミートに注意");
    if(!tips.length) tips.push("比較的選びやすいお店");
    return tips.join("・");
  }
  function appleMapsHref(name,lat,lon){
    const q = encodeURIComponent(name||"目的地");
    return "https://maps.apple.com/?ll="+lat+","+lon+"&q="+q;
  }

  // ---- Overpass query (restaurants + bakery) ----
  function buildQuery(lat,lon,radKm){
    const r = Math.max(1, radKm)*1000;
    return `[out:json][timeout:25];
(
  node(around:${r},${lat},${lon})[amenity~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"];
  way(around:${r},${lat},${lon})[amenity~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"];
  relation(around:${r},${lat},${lon})[amenity~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"];
  node(around:${r},${lat},${lon})[shop="bakery"];
  way(around:${r},${lat},${lon})[shop="bakery"];
  relation(around:${r},${lat},${lon})[shop="bakery"];
);
out center 200;`;
  }

  // ---- UI helpers ----
  function getSets(){
    const cats  = new Set([...document.querySelectorAll(".cat:checked")].map(x=>x.value));
    const prefs = new Set([...document.querySelectorAll(".pref:checked")].map(x=>x.value));
    const avoids= new Set([...document.querySelectorAll(".avoid:checked")].map(x=>x.value));
    const exEl=document.getElementById("exclude");
    const exclude=(exEl?exEl.value:"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
    return {cats,prefs,avoids,exclude};
  }

  async function fetchMeals(lat,lon,minutes,profile,sets,limit=10){
    const kmh=speedToKmh(profile);
    const radKm=Math.max(1,(kmh*(minutes/60))*0.6);
    const q=buildQuery(lat,lon,radKm);
    const json = await fetchOverpassJSON(q);
    const elements=(json.elements||[]).map(e=>{
      const latc=e.lat||(e.center&&e.center.lat);
      const lonc=e.lon||(e.center&&e.center.lon);
      const tags=e.tags||{};
      const name=tags.name||tags["name:ja"]||"お店";
      return {id:e.id,lat:latc,lon:lonc,tags,name};
    }).filter(x=>x.lat&&x.lon);

    const results=elements.map(s=>{
      const nameLower=(s.name||"").toLowerCase();
      if(sets.exclude.some(w=>w && (nameLower.includes(w) || ((s.tags["name:ja"]||"")+"").includes(w)))) return null;

      const cuisines=cuisineList(s.tags);
      const t=typeFromTags(s.tags);
      const flags=riskFlags(s.tags);

      let catScore=0;
      if(sets.cats.has("japanese")&&(cuisines.includes("japanese")||cuisines.includes("teishoku"))) catScore-=2;
      if(sets.cats.has("noodles")&&(cuisines.includes("udon")||cuisines.includes("soba")||cuisines.includes("ramen"))) catScore-=2;
      if(sets.cats.has("cafe")&&(t==="cafe"||t==="ice_cream")) catScore-=2;
      if(sets.cats.has("bakery")&&(t==="bakery")) catScore-=2;
      if(sets.cats.has("family")&&(cuisines.includes("family"))) catScore-=2;

      let prefScore=0;
      if(sets.prefs.has("low_odor"))  prefScore+=odorScore(s.tags);
      if(sets.prefs.has("mild_spicy"))prefScore+=spicyScore(s.tags);

      let riskScore=0; for(const k of sets.avoids){ if(flags[k]) riskScore+=4; }

      const distKm=haversine(lat,lon,s.lat,s.lon);
      const distScore=distKm*0.4;

      const oh=s.tags.opening_hours||"";
      const status=isOpenNow(parseOpeningHours(oh));

      const total=catScore+prefScore+riskScore+distScore+(status.open===true?-0.5:0);
      return {...s, distKm, total, flags, openStatus:status};
    }).filter(Boolean).sort((a,b)=>a.total-b.total).slice(0,limit);

    return results;
  }

  function renderList(items){
    const ul=document.getElementById("list"); ul.innerHTML="";
    if(!items.length){ const li=document.createElement("li"); li.className="item"; li.textContent="条件に合うお店が見つかりませんでした。"; ul.appendChild(li); return; }
    items.forEach(s=>{
      const f=s.flags||{}; const tags=[];
      if(f.raw_fish)tags.push("生魚注意"); if(f.raw_egg)tags.push("生卵注意"); if(f.alcohol)tags.push("アルコール中心"); if(f.soft_cheese)tags.push("チーズ注意"); if(f.high_mercury)tags.push("水銀多注意"); if(f.deli_meat)tags.push("デリミート注意");
      const badge = s.openStatus.open===true?`<span class="badge-open on">${s.openStatus.label}</span>`:s.openStatus.open===false?`<span class="badge-open off">${s.openStatus.label}</span>`:`<span class="badge-open">${s.openStatus.label}</span>`;
      const hours = s.openStatus.today?` <span class="meta">本日 ${s.openStatus.today}</span>`:"";
      const li=document.createElement("li"); li.className="item";
      li.setAttribute("data-lat",s.lat); li.setAttribute("data-lon",s.lon); li.setAttribute("data-name",s.name);
      li.innerHTML=`<div>
        <strong>${s.name}</strong> <span class="badge">${friendlyCuisine(s.tags)}</span> ${badge}${hours}
        <div class="meta">約${s.distKm.toFixed(1)}km／${explainReason(s.tags,s.flags||{})}</div>
        <div class="tags">${tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
      </div>
      <div class="actions vstack">
        <button class="iconbtn gmaps" title="Googleマップで開く">G</button>
        <a class="iconbtn amaps" target="_blank" rel="noopener" title="Appleマップで開く" href="${appleMapsHref(s.name,s.lat,s.lon)}"></a>
      </div>`;
      ul.appendChild(li);
    });
  }

  async function run(){
    const region=document.getElementById("region");
    const minutes=parseInt((document.getElementById("driveMin")||{}).value,10)||15;
    const profile=(document.getElementById("speedProfile")||{}).value||"normal";
    let lat,lon;
    if(region && region.value==="current"){
      try{
        const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:8000}));
        lat=pos.coords.latitude; lon=pos.coords.longitude;
      }catch(_){ const p=presets.esaka; lat=p.lat; lon=p.lon; if(region) region.value="esaka"; }
    }else{ const key=region?region.value:"esaka"; const p=presets[key]||presets.esaka; lat=p.lat; lon=p.lon; }

    const sets=getSets();
    try{
      const items=await fetchMeals(lat,lon,minutes,profile,sets,10);
      renderList(items);
    }catch(e){
      console.error(e);
      const ul=document.getElementById("list");
      const msg = /HTTP 429/.test(String(e)) ? "混雑のため取得制限中です。1–2分おいて再試行してください。" :
                  /AbortError/.test(String(e)) ? "タイムアウトしました。通信状況の良い場所でお試しください。" :
                  "取得に失敗しました。時間をおいて再試行してください。";
      if(ul) ul.innerHTML = `<li class="item">${msg}</li>`;
    }
  }

  const btn=document.getElementById("search"); if(btn) btn.addEventListener("click", run);
  window.addEventListener("load", run);
})();
