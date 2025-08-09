
const presets={esaka:{name:"大阪・江坂",lat:34.7565,lon:135.4968},kyoto:{name:"京都市",lat:35.038,lon:135.774},kobe:{name:"神戸市",lat:34.6913,lon:135.1830},omiya:{name:"さいたま市大宮区",lat:35.906,lon:139.624},fukushima:{name:"福島市",lat:37.7608,lon:140.4747}};
function speedToKmh(p){if(p==='slow')return 25;if(p==='fast')return 50;return 35;}
function haversine(a,b,c,d){const r=x=>x*Math.PI/180,R=6371,dLat=r(c-a),dLon=r(d-b);const A=Math.sin(dLat/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dLon/2)**2;return 2*R*Math.atan2(Math.sqrt(A),Math.sqrt(1-A));}
function cuisineList(tags){const c=(tags.cuisine||'').toLowerCase();return c.split(';').map(s=>s.trim()).filter(Boolean);}
function typeFromTags(tags){if(tags.shop==='bakery')return 'bakery';return tags.amenity||'place';}
function odorScore(tags){const t=typeFromTags(tags); if(t==='cafe'||t==='ice_cream'||t==='bakery')return -1; const c=cuisineList(tags); if(c.includes('yakiniku')||c.includes('bbq'))return 2; if(c.includes('yakitori'))return 1; return 0;}
function spicyScore(tags){const c=cuisineList(tags); if(c.includes('indian')||c.includes('thai')||c.includes('sichuan')||c.includes('korean'))return 1; return 0;}
function riskFlags(tags){const name=(tags.name||tags['name:ja']||'').toLowerCase();const c=cuisineList(tags);return{raw_fish:c.includes('sushi')||c.includes('sashimi')||name.includes('寿司')||name.includes('刺身'),raw_egg:name.includes('生卵')||name.includes('すき焼き')||c.includes('sukiyaki'),alcohol:c.includes('bar')||c.includes('pub')||c.includes('izakaya')||name.includes('居酒屋'),soft_cheese:c.includes('cheese')||c.includes('pizza')||c.includes('italian'),high_mercury:c.includes('tuna')||name.includes('マグロ'),deli_meat:c.includes('deli')||name.includes('サブウェイ')||name.includes('ハム')||name.includes('サラミ')};}
function friendlyCuisine(tags){const t=typeFromTags(tags);if(t==='bakery')return'ベーカリー/パン';if(tags.amenity==='cafe'||tags.amenity==='ice_cream')return'カフェ/甘味';const c=cuisineList(tags);if(c.includes('udon')||c.includes('soba'))return'麺類（うどん/そば）';if(c.includes('ramen'))return'ラーメン';if(c.includes('japanese')||c.includes('teishoku'))return'和食/定食';if(c.includes('family'))return'ファミレス';if(c.includes('sandwich')||c.includes('bakery'))return'軽食・パン';if(c.includes('indian')||c.includes('thai'))return'エスニック';if(c.length) return c[0];return'飲食店';}
function explainReason(tags,flags){const tips=[];if(flags.raw_fish)tips.push('生魚メニューの可能性');if(flags.raw_egg)tips.push('生卵/すき焼きに注意');if(flags.alcohol)tips.push('アルコール中心の可能性');if(flags.soft_cheese)tips.push('ナチュラルチーズに注意');if(flags.high_mercury)tips.push('マグロ等は量に注意');if(flags.deli_meat)tips.push('生ハム/低温調理に注意');if(!tips.length)tips.push('比較的選びやすいお店');return tips.join('・');}
function gmapsLink(lat,lon){return `https://www.google.com/maps/search/?api=1&query=${lat}%2C${lon}`;}
function appleMapsLink(lat,lon,name){const q=encodeURIComponent(name||'目的地');return `https://maps.apple.com/?ll=${lat},${lon}&q=${q}`;}
// Opening hours
const DAYIDX={Su:0,Mo:1,Tu:2,We:3,Th:4,Fr:5,Sa:6};
function parseTimeHHMM(s){const m=s.match(/^(\d{1,2}):(\d{2})$/);if(!m)return null;const hh=parseInt(m[1],10),mm=parseInt(m[2],10);if(hh>23||mm>59)return null;return{hh,mm};}
function timeToMinutes(t){return t.hh*60+t.mm;}
function parseOpeningHours(oh){if(!oh||typeof oh!=='string')return{type:'unknown'};oh=oh.trim();if(oh==='24/7')return{type:'always'};const parts=oh.split(';').map(s=>s.trim());const rules=[];for(const part of parts){const m=part.match(/^([A-Za-z]{2}(?:-[A-Za-z]{2})?(?:,[A-Za-z]{2})*)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);if(!m)continue;const dayExpr=m[1],openT=parseTimeHHMM(m[2]),closeT=parseTimeHHMM(m[3]);if(!openT||!closeT)continue;const days=[];dayExpr.split(',').forEach(seg=>{if(seg.includes('-')){const [a,b]=seg.split('-');const ai=DAYIDX[a],bi=DAYIDX[b];if(ai!=null&&bi!=null){if(ai<=bi){for(let d=ai;d<=bi;d++)days.push(d);}else{for(let d=ai;d<=6;d++)days.push(d);for(let d=0;d<=bi;d++)days.push(d);}}}else{const di=DAYIDX[seg];if(di!=null)days.push(di);}});rules.push({days:Array.from(new Set(days)),openMin:timeToMinutes(openT),closeMin:timeToMinutes(closeT)});}if(!rules.length)return{type:'unknown'};return{type:'rules',rules};}
function isOpenNow(ohParsed,dt){if(ohParsed.type==='always')return{open:true,label:'営業中',today:'24時間'};if(ohParsed.type!=='rules')return{open:null,label:'営業時間情報なし'};const day=dt.getDay();const min=dt.getHours()*60+dt.getMinutes();const todays=ohParsed.rules.filter(r=>r.days.includes(day));if(!todays.length)return{open:false,label:'本日休み'};for(const r of todays){if(min>=r.openMin&&min<r.closeMin)return{open:true,label:'営業中',today:`${fmtMin(r.openMin)}–${fmtMin(r.closeMin)}`};}const r0=todays[0];return{open:false,label:'営業時間外',today:`${fmtMin(r0.openMin)}–${fmtMin(r0.closeMin)}`};}
function fmtMin(m){const hh=Math.floor(m/60),mm=m%60;return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;}

function buildQuery(lat,lon,r){const base=`(node(around:${r*1000},${lat},${lon})[amenity~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"];way(around:${r*1000},${lat},${lon})[amenity~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"];relation(around:${r*1000},${lat},${lon})[amenity~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"];node(around:${r*1000},${lat},${lon})[shop="bakery"];way(around:${r*1000},${lat},${lon})[shop="bakery"];relation(around:${r*1000},${lat},${lon})[shop="bakery"];);`;return `[out:json][timeout:25];\n${base}\nout center 200;`;}

const GOOGLE_SVG="<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8z' fill='#EA4335'/><circle cx='12' cy='10' r='5' fill='#fff'/><text x='12' y='13' text-anchor='middle' font-size='8' font-family='Arial' fill='#1a73e8' font-weight='700'>G</text></svg>";
const APPLE_SVG="<svg viewBox='0 0 24 24' aria-hidden='true'><rect x='3' y='3' width='18' height='18' rx='4' fill='#e2e8f0' stroke='#cbd5e1'/><path d='M7 14l3-3 2 2 4-4' fill='none' stroke='#0ea5e9' stroke-width='2'/><circle cx='16' cy='9' r='2' fill='#94a3b8'/></svg>";

async function fetchMeals(lat,lon,minutes,profile,catSet,prefSet,avoidSet,excludeWords,limit=10){
  const kmh=speedToKmh(profile); const r=Math.max(1,(kmh*(minutes/60))*0.6);
  const q=buildQuery(lat,lon,r);
  const url="https://overpass-api.de/api/interpreter";
  const res=await fetch(url,{method:"POST",body:q,headers:{"Content-Type":"text/plain"}});
  const json=await res.json(); const elements=json.elements||[];
  const items=elements.map(e=>{
    const latc=e.lat||(e.center&&e.center.lat); const lonc=e.lon||(e.center&&e.center.lon);
    const tags=e.tags||{}; const name=tags.name||tags["name:ja"]||"お店";
    return {id:e.id, lat:latc, lon:lonc, tags, name};
  }).filter(x=>x.lat&&x.lon);

  const results = items.map(s=>{
    const nameLower=(s.name||"").toLowerCase();
    if(excludeWords.some(w=>w && (nameLower.includes(w) || (s.tags["name:ja"]||"").includes(w)))) return null;
    const cuisines=cuisineList(s.tags); const t=typeFromTags(s.tags); const flags=riskFlags(s.tags);
    let catScore=0;
    if(catSet.has("japanese") && (cuisines.includes("japanese")||cuisines.includes("teishoku"))) catScore-=2;
    if(catSet.has("noodles") && (cuisines.includes("udon")||cuisines.includes("soba")||cuisines.includes("ramen"))) catScore-=2;
    if(catSet.has("cafe") && (t==="cafe"||t==="ice_cream")) catScore-=2;
    if(catSet.has("bakery") && (t==="bakery"||cuisines.includes("bakery")||cuisines.includes("sandwich"))) catScore-=2;
    if(catSet.has("family") && (cuisines.includes("family"))) catScore-=2;
    let prefScore=0; if(prefSet.has("low_odor")) prefScore += odorScore(s.tags); if(prefSet.has("mild_spicy")) prefScore += spicyScore(s.tags);
    let riskScore=0; for(const k of avoidSet){ if(riskFlags(s.tags)[k]) riskScore += 4; }
    const distKm=haversine(lat,lon,s.lat,s.lon); const distScore = distKm*0.4;
    const oh=parseOpeningHours(s.tags.opening_hours); const status=isOpenNow(oh,new Date());
    const total = catScore + prefScore + riskScore + distScore + (status.open===true ? -0.5 : 0);
    return {...s, distKm, total, flags, openStatus:status};
  }).filter(Boolean).sort((a,b)=>a.total-b.total).slice(0,limit);

  return results;
}

function renderList(items){
  const ul=document.getElementById("list"); ul.innerHTML="";
  if(!items.length){const li=document.createElement("li");li.className="item";li.textContent="条件に合うお店が見つかりませんでした。";ul.appendChild(li);return;}
  items.forEach(s=>{
    const f=s.flags||{}; const tags=[];
    if(f.raw_fish)tags.push("生魚注意"); if(f.raw_egg)tags.push("生卵注意"); if(f.alcohol)tags.push("アルコール中心"); if(f.soft_cheese)tags.push("チーズ注意"); if(f.high_mercury)tags.push("水銀多注意"); if(f.deli_meat)tags.push("デリミート注意");
    const badge = s.openStatus.open===true?`<span class="badge-open on">${s.openStatus.label}</span>`:s.openStatus.open===false&&s.openStatus.label==="本日休み"?`<span class="badge-open closed-today">${s.openStatus.label}</span>`:s.openStatus.open===false?`<span class="badge-open off">${s.openStatus.label}</span>`:`<span class="badge-open">${s.openStatus.label}</span>`;
    const hours = s.openStatus.today?` <span class="meta">本日 ${s.openStatus.today}</span>`:"";
    const li=document.createElement("li"); li.className="item";
    li.innerHTML=`<div>
      <strong>${s.name}</strong> <span class="badge">${friendlyCuisine(s.tags)}</span> ${badge}${hours}
      <div class="meta">約${s.distKm.toFixed(1)}km／${explainReason(s.tags,s.flags||{})}</div>
      <div class="tags">${tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
    </div>
    <div class="actions vstack">
      <a class="iconbtn gmaps" target="_blank" rel="noopener" title="Googleマップで開く" href="${gmapsLink(s.lat,s.lon)}"><svg viewBox='0 0 24 24' aria-hidden='true'><path d='M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8z' fill='#EA4335'/><circle cx='12' cy='10' r='5' fill='#fff'/><text x='12' y='13' text-anchor='middle' font-size='8' font-family='Arial' fill='#1a73e8' font-weight='700'>G</text></svg></a>
      <a class="iconbtn amaps" target="_blank" rel="noopener" title="Appleマップで開く" href="${appleMapsLink(s.lat,s.lon,s.name)}"><svg viewBox='0 0 24 24' aria-hidden='true'><rect x='3' y='3' width='18' height='18' rx='4' fill='#e2e8f0' stroke='#cbd5e1'/><path d='M7 14l3-3 2 2 4-4' fill='none' stroke='#0ea5e9' stroke-width='2'/><circle cx='16' cy='9' r='2' fill='#94a3b8'/></svg></a>
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
  const region=document.getElementById("region");
  const minutes=parseInt(document.getElementById("driveMin").value,10)||15;
  const profile=document.getElementById("speedProfile").value;
  let lat,lon;
  if(region.value==="current"){
    try{const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:8000}));lat=pos.coords.latitude;lon=pos.coords.longitude;}
    catch(e){alert("現在地が取得できませんでした。江坂を使用します。");region.value="esaka";lat=presets.esaka.lat;lon=presets.esaka.lon;}
  }else{lat=presets[region.value].lat;lon=presets[region.value].lon;}
  const {cats,prefs,avoids,exclude}=getSets();
  try{const items=await fetchMeals(lat,lon,minutes,profile,cats,prefs,avoids,exclude,10);renderList(items);}catch(e){document.getElementById("list").innerHTML="<li class='item'>Overpassの取得に失敗しました。時間をおいて再試行してください。</li>";}
}

document.getElementById("search").addEventListener("click", run);
document.getElementById("addToHome").addEventListener("click",()=>alert("共有 → 『ホーム画面に追加』でアプリ化できます。"));
window.addEventListener("load",()=>{run();if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js");}});
