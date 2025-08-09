// Presets
const presets={esaka:{name:"大阪・江坂",lat:34.7565,lon:135.4968},kyoto:{name:"京都市",lat:35.038,lon:135.774},kobe:{name:"神戸市",lat:34.6913,lon:135.1830},omiya:{name:"さいたま市大宮区",lat:35.906,lon:139.624},fukushima:{name:"福島市",lat:37.7608,lon:140.4747}};
function speedToKmh(p){if(p==='slow')return 25;if(p==='fast')return 50;return 35;}
function haversine(a,b,c,d){const r=x=>x*Math.PI/180,R=6371,dLat=r(c-a),dLon=r(d-b);const A=Math.sin(dLat/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dLon/2)**2;return 2*R*Math.atan2(Math.sqrt(A),Math.sqrt(1-A));}
// Overpass query for food amenities
function buildQuery(lat,lon,r){const base=`(node(around:${r*1000},${lat},${lon})[amenity~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"];way(around:${r*1000},${lat},${lon})[amenity~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"];relation(around:${r*1000},${lat},${lon})[amenity~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"];node(around:${r*1000},${lat},${lon})[shop="bakery"];way(around:${r*1000},${lat},${lon})[shop="bakery"];relation(around:${r*1000},${lat},${lon})[shop="bakery"];);`;return `[out:json][timeout:25];${base}out center 200;`;}
function cuisineList(tags){const c=(tags.cuisine||"").toLowerCase();return c.split(";").map(s=>s.trim()).filter(Boolean);}
function typeFromTags(tags){if(tags.shop==="bakery")return "bakery";return tags.amenity||"place";}
// Heuristics for pregnancy-friendly
const CUISINE_SAFE_HINTS=["udon","soba","ramen","curry","okonomiyaki","yoshoku","family","japanese","teishoku","diner","sandwich","pancake","coffee_shop","dessert","cake","ice_cream","bakery"];
const CUISINE_POTENTIAL_RISK=["sushi","sashimi","izakaya","raw","oyster","yakitori","yakiniku","bbq","buffet","tartar","ceviche","hot_pot","fondue","blue_cheese"];
function odorScore(tags){const t=typeFromTags(tags); if(t==="cafe"||t==="ice_cream"||t==="bakery")return -1; const c=cuisineList(tags); if(c.includes("yakiniku")||c.includes("bbq"))return 2; if(c.includes("yakitori"))return 1; return 0;}
function spicyScore(tags){const c=cuisineList(tags); if(c.includes("indian")||c.includes("thai")||c.includes("sichuan")||c.includes("korean"))return 1; return 0;}
function riskFlags(tags){
  const name=(tags.name||tags["name:ja"]||"").toLowerCase();
  const c=cuisineList(tags);
  return {
    raw_fish: c.includes("sushi")||c.includes("sashimi")||name.includes("寿司")||name.includes("刺身"),
    raw_egg: name.includes("生卵")||name.includes("すき焼き") || c.includes("sukiyaki"),
    alcohol: c.includes("bar")||c.includes("pub")||c.includes("izakaya")||name.includes("居酒屋"),
    soft_cheese: c.includes("cheese")||c.includes("pizza")||c.includes("italian"),
    high_mercury: c.includes("tuna")||name.includes("マグロ"),
    deli_meat: c.includes("deli")||name.includes("サブウェイ")||name.includes("ハム")||name.includes("サラミ")
  };
}
function friendlyCuisine(tags){
  const t=typeFromTags(tags);
  if(t==="bakery")return "ベーカリー/パン";
  if(tags.amenity==="cafe"||tags.amenity==="ice_cream")return "カフェ/甘味";
  const c=cuisineList(tags);
  if(c.includes("udon")||c.includes("soba"))return "麺類（うどん/そば）";
  if(c.includes("ramen"))return "ラーメン";
  if(c.includes("japanese")||c.includes("teishoku"))return "和食/定食";
  if(c.includes("family"))return "ファミレス";
  if(c.includes("sandwich")||c.includes("bakery"))return "軽食・パン";
  if(c.includes("indian")||c.includes("thai"))return "エスニック";
  if(c.includes("italian"))return "イタリアン";
  if(c.length) return c[0];
  return "飲食店";
}
function explainReason(tags,flags){const tips=[];
  if(flags.raw_fish)tips.push("生魚メニューの可能性");
  if(flags.raw_egg)tips.push("生卵/すき焼きに注意");
  if(flags.alcohol)tips.push("アルコール中心の可能性");
  if(flags.soft_cheese)tips.push("ナチュラルチーズに注意");
  if(flags.high_mercury)tips.push("マグロ等は量に注意");
  if(flags.deli_meat)tips.push("生ハム/低温調理に注意");
  if(!tips.length)tips.push("比較的選びやすいお店");
  return tips.join("・");
}
function gmapsLink(lat,lon){return `https://www.google.com/maps/search/?api=1&query=${lat}%2C${lon}`;}
function appleMapsLink(lat,lon,name){const q=encodeURIComponent(name||'目的地');return `https://maps.apple.com/?ll=${lat},${lon}&q=${q}`;}

async function fetchMeals(lat,lon,minutes,profile,catSet,prefSet,avoidSet,excludeWords,limit=10){
  const kmh=speedToKmh(profile); const r=Math.max(1,(kmh*(minutes/60))*0.6);
  const q=buildQuery(lat,lon,r);
  const url="https://overpass-api.de/api/interpreter";
  const res=await fetch(url,{method:"POST",body:q,headers:{"Content-Type":"text/plain"}});
  const json=await res.json(); const elements=json.elements||[];
  const items=elements.map(e=>{
    const latc=e.lat||(e.center&&e.center.lat);
    const lonc=e.lon||(e.center&&e.center.lon);
    const tags=e.tags||{};
    const name=tags.name||tags["name:ja"]||"お店";
    return {id:e.id, lat:latc, lon:lonc, tags, name};
  }).filter(x=>x.lat&&x.lon);

  // scoring
  const results = items.map(s=>{
    const nameLower=(s.name||"").toLowerCase();
    if(excludeWords.some(w=>w && (nameLower.includes(w) || (s.tags["name:ja"]||"").includes(w)))) return null;

    const cuisines=cuisineList(s.tags);
    const t=typeFromTags(s.tags);
    const flags=riskFlags(s.tags);

    // category match
    let catScore=0;
    if(catSet.has("japanese") && (cuisines.includes("japanese")||cuisines.includes("teishoku"))) catScore-=2;
    if(catSet.has("noodles") && (cuisines.includes("udon")||cuisines.includes("soba")||cuisines.includes("ramen"))) catScore-=2;
    if(catSet.has("cafe") && (t==="cafe"||t==="ice_cream")) catScore-=2;
    if(catSet.has("bakery") && (t==="bakery"||cuisines.includes("bakery")||cuisines.includes("sandwich"))) catScore-=2;
    if(catSet.has("family") && (cuisines.includes("family"))) catScore-=2;

    // preferences
    let prefScore=0;
    if(prefSet.has("low_odor")) prefScore += odorScore(s.tags); // -1 is良い, +2は不利
    if(prefSet.has("mild_spicy")) prefScore += spicyScore(s.tags); // +1は辛め傾向で不利

    // avoid flags (strong)
    let riskScore=0;
    for(const k of avoidSet){
      if(flags[k]) riskScore += 4; // 強く不利
    }

    // distance
    const distKm=haversine(lat,lon,s.lat,s.lon);
    const distScore = distKm*0.4;

    const total = catScore + prefScore + riskScore + distScore;
    return {...s, distKm, catScore, prefScore, riskScore, total, flags};
  }).filter(Boolean).sort((a,b)=>a.total-b.total).slice(0,limit);

  return results;
}

function renderList(items){
  const ul=document.getElementById("list"); ul.innerHTML="";
  if(!items.length){const li=document.createElement("li");li.className="item";li.textContent="条件に合うお店が見つかりませんでした。条件を緩めて再検索してください。";ul.appendChild(li);return;}
  items.forEach(s=>{
    const tags=[];
    const f=s.flags;
    if(f.raw_fish)tags.push("生魚注意");
    if(f.raw_egg)tags.push("生卵注意");
    if(f.alcohol)tags.push("アルコール中心");
    if(f.soft_cheese)tags.push("チーズ注意");
    if(f.high_mercury)tags.push("水銀多注意");
    if(f.deli_meat)tags.push("デリミート注意");
    const li=document.createElement("li"); li.className="item";
    li.innerHTML=`<div>
      <strong>${s.name}</strong> <span class="badge">${friendlyCuisine(s.tags)}</span>
      <div class="meta">約${s.distKm.toFixed(1)}km／${explainReason(s.tags,s.flags)}</div>
      <div class="tags">${tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
    </div>
    <div class="actions">
      <a class="btn" target="_blank" rel="noopener" href="${gmapsLink(s.lat,s.lon)}">Googleマップ</a>
      <a class="btn" target="_blank" rel="noopener" href="${appleMapsLink(s.lat,s.lon,s.name)}">Appleマップ</a>
    </div>`;
    ul.appendChild(li);
  });
}

function getSets(){
  const cats=new Set([...document.querySelectorAll(".cat:checked")].map(x=>x.value));
  const prefs=new Set([...document.querySelectorAll(".pref:checked")].map(x=>x.value));
  const avoids=new Set([...document.querySelectorAll(".avoid:checked")].map(x=>x.value));
  const exclude=document.getElementById("exclude").value.split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
  return {cats,prefs,avoids,exclude};
}

async function run(){
  // region/geo
  const region=document.getElementById("region"); const minutes=parseInt(document.getElementById("driveMin").value,10)||15; const profile=document.getElementById("speedProfile").value;
  let lat,lon;
  if(region.value==="current"){
    try{const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:8000})); lat=pos.coords.latitude; lon=pos.coords.longitude;}
    catch(e){alert("現在地が取得できませんでした。江坂を使用します。");region.value="esaka"; lat=presets.esaka.lat; lon=presets.esaka.lon;}
  }else{ lat=presets[region.value].lat; lon=presets[region.value].lon; }

  const {cats,prefs,avoids,exclude}=getSets();
  try{
    const items=await fetchMeals(lat,lon,minutes,profile,cats,prefs,avoids,exclude,10);
    renderList(items);
  }catch(e){
    document.getElementById("list").innerHTML="<li class='item'>Overpassの取得に失敗しました。時間をおいて再試行してください。</li>";
  }
}

document.getElementById("search").addEventListener("click", run);
document.getElementById("addToHome").addEventListener("click",()=>alert("共有 → 『ホーム画面に追加』でアプリ化できます。"));
window.addEventListener("load",()=>{run(); if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js");}});
