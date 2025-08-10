// meals.js — FULL FEATURE + region select tap hotfix
(function(){
  function speedToKmh(p){ if(p==='slow')return 25; if(p==='fast')return 50; return 35; }
  function rad(x){ return x*Math.PI/180; }
  const R=6371; function haversine(a,b,c,d){ const dLat=rad(c-a), dLon=rad(d-b); const A=Math.sin(dLat/2)**2 + Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dLon/2)**2; return 2*R*Math.atan2(Math.sqrt(A), Math.sqrt(1-A)); }
  function parseTimeHHMM(s){ const m=/^(\d{1,2}):(\d{2})$/.exec(s||""); if(!m)return null; const hh=+m[1],mm=+m[2]; if(hh>23||mm>59)return null; return {hh,mm}; }
  function timeToMin(t){ return t.hh*60+t.mm; }
  function parseOpeningHours(oh){
    if(!oh || typeof oh!=="string") return {type:"unknown"}; oh=oh.trim();
    if(oh==="24/7") return {type:"always"};
    const parts=oh.split(";").map(s=>s.trim()); const rules=[];
    for(const part of parts){
      const m=/^([A-Za-z]{2}(?:-[A-Za-z]{2})?(?:,[A-Za-z]{2})*)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(part);
      if(!m) continue;
      const map={Su:0,Mo:1,Tu:2,We:3,Th:4,Fr:5,Sa:6};
      const o=parseTimeHHMM(m[2]), c=parseTimeHHMM(m[3]); if(!o||!c) continue;
      const days=[]; m[1].split(",").forEach(seg=>{
        if(seg.includes("-")){ const [a,b]=seg.split("-"); let ai=map[a],bi=map[b]; if(ai<=bi){ for(let d=ai; d<=bi; d++) days.push(d);} else {for(let d=ai; d<7; d++) days.push(d); for(let d=0; d<=bi; d++) days.push(d);} }
        else { const di=map[seg]; if(di!=null) days.push(di); }
      });
      rules.push({days,openMin:timeToMin(o),closeMin:timeToMin(c)});
    }
    return rules.length?{type:"rules",rules}:{type:"unknown"};
  }
  function fmt(m){ const hh=String(Math.floor(m/60)).padStart(2,"0"); const mm=String(m%60).padStart(2,"0"); return hh+":"+mm; }
    function computeOpenStatus(oh, now=new Date()){
    const parsed=parseOpeningHours(oh||"");
    if(parsed.type==="always") return {open:true,label:"営業中",today:"24時間"};
    if(parsed.type!=="rules") return {open:null,label:"営業時間情報なし"};
    const d=now.getDay(), m=now.getHours()*60+now.getMinutes();
    const todays=parsed.rules.filter(r=>r.days.includes(d));
    if(!todays.length) return {open:false,label:"本日休み"};
    for(const r of todays){
      if(r.openMin>r.closeMin){
        if(m>=r.openMin || m<r.closeMin) return {open:true,label:"営業中",today:fmt(r.openMin)+"–"+fmt(r.closeMin)};
      }else{
        if(m>=r.openMin && m<r.closeMin) return {open:true,label:"営業中",today:fmt(r.openMin)+"–"+fmt(r.closeMin)};
      }
    }
    return {open:false,label:"営業時間外"};
  }
  if(typeof module!=="undefined" && module.exports){
    module.exports={parseOpeningHours,computeOpenStatus};
  }

  const PRESETS={esaka:{lat:34.7565,lon:135.4968},kyoto:{lat:35.0380,lon:135.7740},kobe:{lat:34.6913,lon:135.1830},omiya:{lat:35.9060,lon:139.6240},fukushima:{lat:37.7608,lon:140.4747}};

  function showLoading(){ const ul=document.getElementById("list"); if(ul) ul.innerHTML = "<li class='item loading'>検索中…</li>"; }
  function saveUI(){
    const st={
      region: (document.getElementById("region")||{}).value,
      driveMin: (document.getElementById("driveMin")||{}).value,
      speed: (document.getElementById("speedProfile")||{}).value,
      openOnly: !!(document.getElementById("openOnly")||{}).checked,
      sortBy: (document.getElementById("sortBy")||{}).value,
      filtersOpen: !!(document.getElementById("filters")||{open:false}).open
    };
    try{ localStorage.setItem("meals:UI", JSON.stringify(st)); }catch(_){}
  }
  function loadUI(){
    try{
      const st=JSON.parse(localStorage.getItem("meals:UI")||"{}");
      if(st.region) (document.getElementById("region")||{}).value = st.region;
      if(st.driveMin) (document.getElementById("driveMin")||{}).value = st.driveMin;
      if(st.speed) (document.getElementById("speedProfile")||{}).value = st.speed;
      if(typeof st.openOnly==="boolean") (document.getElementById("openOnly")||{}).checked = st.openOnly;
      if(st.sortBy) (document.getElementById("sortBy")||{}).value = st.sortBy;
      const det=document.getElementById("filters"); if(det && typeof st.filtersOpen==="boolean") det.open = st.filtersOpen;
    }catch(_){}
  }
  function updateSummary(){
    const sum=document.getElementById("filterSummary");
    if(!sum) return;
    const cats=[...document.querySelectorAll(".cat:checked")].length;
    const prefs=[...document.querySelectorAll(".pref:checked")].length;
    const avoids=[...document.querySelectorAll(".avoid:checked")].length;
    sum.textContent = `詳細条件（カテゴリ${cats}・配慮${prefs}・避ける${avoids}）`;
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

  function getSets(){
    const cats  = new Set([...document.querySelectorAll(".cat:checked")].map(x=>x.value));
    const prefs = new Set([...document.querySelectorAll(".pref:checked")].map(x=>x.value));
    const avoids= new Set([...document.querySelectorAll(".avoid:checked")].map(x=>x.value));
    const exEl=document.getElementById("exclude");
    const exclude=(exEl?exEl.value:"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
    return {cats,prefs,avoids,exclude};
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
    showLoading();
    const btn=document.getElementById("search"); if(btn) btn.disabled=true;
    try{
      const region=document.getElementById("region");
      const minutes=parseInt((document.getElementById("driveMin")||{}).value,10)||15;
      const profile=(document.getElementById("speedProfile")||{}).value||"normal";
      const sortBy=(document.getElementById("sortBy")||{}).value||"score";
      const openOnly= !!(document.getElementById("openOnly")||{}).checked;
      saveUI();

      let lat,lon;
      if(region && region.value==="current"){
        try{ const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:8000}));
             lat=pos.coords.latitude; lon=pos.coords.longitude;
        }catch(_){ const p=PRESETS.esaka; lat=p.lat; lon=p.lon; if(region) region.value="esaka"; }
      }else{ const p=PRESETS[region?region.value:"esaka"]||PRESETS.esaka; lat=p.lat; lon=p.lon; }

      const kmh=speedToKmh(profile);
      const radKm=Math.max(1,(kmh*(minutes/60))*0.6);

      const q=buildQuery(lat,lon,radKm);
      const json=await fetchOverpassJSON(q);

      const sets=getSets();
      const elements=(json.elements||[]).map(e=>{
        const latc=e.lat||(e.center&&e.center.lat);
        const lonc=e.lon||(e.center&&e.center.lon);
        const tags=e.tags||{};
        const name=tags.name||tags["name:ja"]||"お店";
        return {id:e.id,lat:latc,lon:lonc,tags,name};
      }).filter(x=>x.lat&&x.lon);

      let results=elements.map(s=>{
        const nameLower=(s.name||"").toLowerCase();
        if(sets.exclude.some(w=>w && (nameLower.includes(w) || ((s.tags["name:ja"]||"")+"").includes(w)))) return null;

        const cuisines=(s.tags.cuisine||"").toLowerCase().split(";").map(x=>x.trim()).filter(Boolean);
        const t=(s.tags.shop==="bakery")?"bakery":(s.tags.amenity||"place");
        const flags=riskFlags(s.tags);

        // スコア計算
        let score=0;
        if(t==="cafe"||t==="ice_cream"||t==="bakery") score-=0.4;
        if(cuisines.includes("indian")||cuisines.includes("thai")||cuisines.includes("sichuan")||cuisines.includes("korean")) score+=0.4;
        for(const k in flags){ if(flags[k]) score+=0.8; }
        const distKm=haversine(lat,lon,s.lat,s.lon);
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

        return {...s, distKm, score, flags, openStatus, type:t};
      }).filter(Boolean);

      if(openOnly){
        results = results.filter(x=>x.openStatus.open===true);
      }

      const sby=(document.getElementById("sortBy")||{}).value;
      if(sby==="distance"){
        results.sort((a,b)=>a.distKm-b.distKm);
      }else if(sby==="open"){
        results.sort((a,b)=> (b.openStatus.open===true)-(a.openStatus.open===true) || a.score-b.score );
      }else{
        results.sort((a,b)=> a.score-b.score);
      }

      results = results.slice(0,10);
      render(results);
    }catch(e){
      const ul=document.getElementById("list");
      const msg=/HTTP 429/.test(String(e))?"混雑のため取得制限中です。1–2分おいて再試行してください。":/AbortError/.test(String(e))?"タイムアウトしました。通信状況の良い場所でお試しください。":"取得に失敗しました。時間をおいて再試行してください。";
      if(ul) ul.innerHTML = `<li class="item">${msg}</li>`;
    }finally{
      const btn=document.getElementById("search"); if(btn) btn.disabled=false;
      const sel=document.getElementById("region"); if(sel){ sel.disabled=false; sel.style.pointerEvents="auto"; }
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

  function bindUI(){
    const btn=document.getElementById("search"); if(btn) btn.addEventListener("click", run);
    const det=document.getElementById("filters"); if(det){ det.addEventListener("toggle", ()=>{ saveUI(); }); }
    ["cat","pref","avoid"].forEach(cls => {
      document.querySelectorAll("."+cls).forEach(el=> el.addEventListener("change", updateSummary));
    });
    ["exclude","sortBy","openOnly","region","driveMin","speedProfile"].forEach(id=>{
      const el=document.getElementById(id); if(el){ el.addEventListener("change", ()=>{saveUI();}); }
    });
    const reset=document.getElementById("resetFilters");
    if(reset){ reset.addEventListener("click", ()=>{
      document.querySelectorAll(".cat,.pref,.avoid").forEach(el=>{
        const def = el.defaultChecked;
        el.checked = def;
      });
      const ex=document.getElementById("exclude"); if(ex) ex.value="";
      updateSummary();
    });}
    const sel=document.getElementById("region"); if(sel){ sel.addEventListener("change", run); sel.disabled=false; sel.style.pointerEvents="auto"; }
  }

  window.addEventListener("load", ()=>{
    loadUI();
    bindUI();
    updateSummary();
    run();
  });
})();