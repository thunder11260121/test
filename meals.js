// meals.js — refactor: use Utils, loading + disable + cache + unified errors
(function(){
  function speedToKmh(p){ if(p==='slow')return 25; if(p==='fast')return 50; return 35; }
  function rad(x){ return x*Math.PI/180; }
  function parseTimeHHMM(s){ const m=/^(\d{1,2}):(\d{2})$/.exec(s||""); if(!m)return null; const hh=+m[1],mm=+m[2]; if(hh>23||mm>59)return null; return {hh,mm}; }
  function timeToMin(t){ return t.hh*60+t.mm; }
  function parseOpeningHours(oh){
    if(!oh || typeof oh!=="string") return {type:"unknown"};
    oh = oh.trim(); if(oh==="24/7") return {type:"always"};
    const parts = oh.split(";").map(s=>s.trim()); const rules=[];
    for(const part of parts){
      const m = /^([A-Za-z]{2}(?:-[A-Za-z]{2})?(?:,[A-Za-z]{2})*)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(part);
      if(!m) continue;
      const map={Su:0,Mo:1,Tu:2,We:3,Th:4,Fr:5,Sa:6}; const segs=m[1].split(",");
      const o=parseTimeHHMM(m[2]), c=parseTimeHHMM(m[3]); if(!o||!c) continue;
      const days=[];
      for(const seg of segs){
        if(seg.includes("-")){ const[a,b]=seg.split("-"); const ai=map[a],bi=map[b]; if(ai<=bi){ for(let d=ai; d<=bi; d++) days.push(d);} else {for(let d=ai; d<7; d++) days.push(d); for(let d=0; d<=bi; d++) days.push(d);} }
        else { const di=map[seg]; if(di!=null) days.push(di); }
      }
      rules.push({days,openMin:timeToMin(o),closeMin:timeToMin(c)});
    }
    return rules.length?{type:"rules",rules}:{type:"unknown"};
  }
  function fmt(m){ const hh=String(Math.floor(m/60)).padStart(2,"0"); const mm=String(m%60).padStart(2,"0"); return hh+":"+mm; }
  function isOpenNow(p){
    if(p.type==="always") return {open:true,label:"営業中",today:"24時間"};
    if(p.type!=="rules") return {open:null,label:"営業時間情報なし"};
    const now=new Date(), day=now.getDay(), min=now.getHours()*60+now.getMinutes();
    const todays=p.rules.filter(r=>r.days.includes(day));
    if(!todays.length) return {open:false,label:"本日休み"};
    for(const r of todays){ if(min>=r.openMin && min<r.closeMin) return {open:true,label:"営業中",today:fmt(r.openMin)+"–"+fmt(r.closeMin)}; }
    return {open:false,label:"営業時間外"};
  }
  function cuisineList(tags){ const c=(tags.cuisine||"").toLowerCase(); return c.split(";").map(s=>s.trim()).filter(Boolean); }
  function typeFromTags(tags){ if(tags.shop==="bakery")return"bakery"; return tags.amenity||"place"; }
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
  function riskFlags(tags){
    const name=((tags.name||tags["name:ja"]||"")+"").toLowerCase();
    const c=cuisineList(tags);
    return {raw_fish:c.includes("sushi")||c.includes("sashimi")||name.includes("寿司")||name.includes("刺身"),
            raw_egg:name.includes("生卵")||name.includes("すき焼き")||c.includes("sukiyaki"),
            alcohol:c.includes("bar")||c.includes("pub")||c.includes("izakaya")||name.includes("居酒屋"),
            soft_cheese:c.includes("cheese")||c.includes("pizza")||c.includes("italian"),
            high_mercury:c.includes("tuna")||name.includes("マグロ"),
            deli_meat:name.includes("生ハム")||name.includes("ローストビーフ")};
  }
  function appleMapsHref(name,lat,lon){ const q=encodeURIComponent(name||"目的地"); return "https://maps.apple.com/?ll="+lat+","+lon+"&q="+q; }

  function buildQuery(lat,lon,radKm){
    const r=Math.max(1,radKm)*1000;
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

  function showLoading(){ const ul=document.getElementById("list"); if(ul) ul.innerHTML = "<li class='item loading'>検索中…</li>"; }
  function speedProfile(){ const s=(document.getElementById("speedProfile")||{}).value||"normal"; return s; }

  async function run(){
    showLoading();
    const btn=document.getElementById("search"); if(btn) btn.disabled = true;
    try{
      const region=document.getElementById("region");
      const minutes=parseInt((document.getElementById("driveMin")||{}).value,10)||15;
      let lat,lon;
      if(region && region.value==="current"){
        try{
          const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:8000}));
          lat=pos.coords.latitude; lon=pos.coords.longitude;
        }catch(_){ const p={lat:34.7565,lon:135.4968}; lat=p.lat; lon=p.lon; if(region) region.value="esaka"; }
      }else{ const m={esaka:{lat:34.7565,lon:135.4968},kyoto:{lat:35.0380,lon:135.7740},kobe:{lat:34.6913,lon:135.1830},omiya:{lat:35.9060,lon:139.6240},fukushima:{lat:37.7608,lon:140.4747}}; const p=m[region?region.value:"esaka"]||m.esaka; lat=p.lat; lon=p.lon; }

      const kmh=speedToKmh(speedProfile());
      const radKm=Math.max(1,(kmh*(minutes/60))*0.6);

      const key=Utils.cacheKey('meals',{lat,lon,radKm});
      const cached=Utils.cacheGet(key);
      let json;
      if(cached){ json=cached; } else { json = await Utils.fetchOverpassJSON(buildQuery(lat,lon,radKm)); Utils.cacheSet(key,json); }

      const elements=(json.elements||[]).map(e=>{
        const latc=e.lat||(e.center&&e.center.lat);
        const lonc=e.lon||(e.center&&e.center.lon);
        const tags=e.tags||{};
        const name=tags.name||tags["name:ja"]||"お店";
        return {id:e.id,lat:latc,lon:lonc,tags,name};
      }).filter(x=>x.lat&&x.lon);

      const results=elements.map(s=>{
        const flags=riskFlags(s.tags);
        const cuisines=cuisineList(s.tags);
        const t=(s.tags.shop==="bakery")?"bakery":(s.tags.amenity||"place");
        let score=0;
        // 軽い好み（匂い弱/辛さ控えめ）
        if(t==="cafe"||t==="ice_cream"||t==="bakery") score-=0.4;
        if(cuisines.includes("indian")||cuisines.includes("thai")||cuisines.includes("sichuan")||cuisines.includes("korean")) score+=0.4;
        // リスクは重く
        for(const k in flags){ if(flags[k]) score+=0.8; }
        const distKm=Utils.haversine(lat,lon,s.lat,s.lon);
        score += distKm*0.4;
        const openStatus=(function(oh){
          const parsed=parseOpeningHours(oh||"");
          if(parsed.type==="always") return {open:true,label:"営業中",today:"24時間"};
          if(parsed.type!=="rules") return {open:null,label:"営業時間情報なし"};
          const now=new Date(), d=now.getDay(), m=now.getHours()*60+now.getMinutes();
          const todays=parsed.rules.filter(r=>r.days.includes(d));
          if(!todays.length) return {open:false,label:"本日休み"};
          for(const r of todays){ if(m>=r.openMin && m<r.closeMin) return {open:true,label:"営業中",today:fmt(r.openMin)+"–"+fmt(r.closeMin)}; }
          return {open:false,label:"営業時間外"};
        })(s.tags.opening_hours||"");
        return {...s, distKm, score, flags, openStatus};
      }).sort((a,b)=>a.score-b.score).slice(0,10);

      render(results);
    }catch(e){
      const ul=document.getElementById("list");
      if(ul) ul.innerHTML = `<li class="item">${Utils.errorMessage(e)}</li>`;
    }finally{
      const btn=document.getElementById("search"); if(btn) btn.disabled = false;
    }
  }

  function render(items){
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
        <button class="iconbtn gmaps" aria-label="Googleマップで開く" title="Googleマップで開く">G</button>
        <a class="iconbtn amaps" aria-label="Appleマップで開く" target="_blank" rel="noopener" title="Appleマップで開く" href="${appleMapsHref(s.name,s.lat,s.lon)}"></a>
      </div>`;
      ul.appendChild(li);
    });
  }

  document.getElementById("search")?.addEventListener("click", run);
  window.addEventListener("load", run);
})();