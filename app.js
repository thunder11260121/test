// --- Regions ---
const presets = {
  esaka:     { name: "大阪・江坂", lat: 34.7565, lon: 135.4968 },
  kyoto:     { name: "京都市",     lat: 35.038,  lon: 135.774 },
  kobe:      { name: "神戸市",     lat: 34.6913, lon: 135.1830 },
  omiya:     { name: "さいたま市大宮区", lat: 35.906, lon: 139.624 },
  fukushima: { name: "福島市",     lat: 37.7608, lon: 140.4747 },
};

// --- Weather & WBGT ---
function wbgtEstimate(tempC, rh){
  const e = (rh/100) * 6.105 * Math.exp((17.27*tempC)/(237.7+tempC));
  return 0.567*tempC + 0.393*e + 3.94;
}
function heatIndexC(tempC, rh){
  const T = tempC * 9/5 + 32;
  const R = rh;
  const HI = -42.379 + 2.04901523*T + 10.14333127*R - 0.22475541*T*R
            - 0.00683783*T*T - 0.05481717*R*R
            + 0.00122874*T*T*R + 0.00085282*T*R*R - 0.00000199*T*T*R*R;
  const HIblend = T < 80 ? T + (HI - T)*Math.max(0,(T-70)/10) : HI;
  return (HIblend - 32) * 5/9;
}
function wbgtLevel(wbgt){
  if (wbgt < 25) return { label:"注意", class:"safe", icon:"🟢", advice:"水分をこまめに。短時間の屋外はOK。" };
  if (wbgt < 28) return { label:"警戒", class:"caution", icon:"⚠️", advice:"屋外は短時間に。日陰/屋内をメインに、塩分補給も。" };
  if (wbgt < 31) return { label:"厳重警戒", class:"high", icon:"🔥", advice:"長時間屋外は避ける。午前のみ短時間、午後は屋内。" };
  return { label:"危険", class:"danger", icon:"☠️", advice:"外出は最小限に。冷房の効いた室内で安静に。" };
}

async function fetchWeatherAll(lat, lon){
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
  const res = await fetch(url);
  return res.json();
}

function wmoIcon(code){
  if ([0].includes(code)) return "☀️";
  if ([1,2,3].includes(code)) return "⛅";
  if ([45,48].includes(code)) return "🌫";
  if ([51,53,55,61,63,65,80,81,82].includes(code)) return "🌧";
  if ([71,73,75,85,86].includes(code)) return "❄️";
  if ([95,96,99].includes(code)) return "⛈️";
  return "☁️";
}

function renderHourly(hourly){
  const list = document.getElementById("hourly");
  list.innerHTML = "";
  const now = new Date();
  for (let i=0; i<hourly.time.length; i++){
    const t = new Date(hourly.time[i]);
    if (t < now) continue;
    const hh = (`0${t.getHours()}`).slice(-2);
    const temp = hourly.temperature_2m[i];
    const pop = hourly.precipitation_probability?.[i];
    const icon = wmoIcon(hourly.weather_code?.[i]);
    const li = document.createElement("li");
    li.className = "hour";
    li.innerHTML = `<span class="icon">${icon}</span> <strong>${hh}時</strong>  ${temp.toFixed(0)}℃  ${pop!=null?`/ 降水${pop}%`:""}`;
    list.appendChild(li);
    if (list.children.length >= 12) break;
  }
}

function renderDaily(daily){
  const list = document.getElementById("daily");
  list.innerHTML = "";
  for (let i=0; i<daily.time.length && i<5; i++){
    const t = new Date(daily.time[i]);
    const mm = t.getMonth()+1, dd = t.getDate();
    const icon = wmoIcon(daily.weather_code?.[i]);
    const hi = daily.temperature_2m_max?.[i];
    const lo = daily.temperature_2m_min?.[i];
    const pop = daily.precipitation_probability_max?.[i];
    const li = document.createElement("li");
    li.className = "day";
    li.innerHTML = `<span class="icon">${icon}</span> <strong>${mm}/${dd}</strong>  ${Math.round(lo)}–${Math.round(hi)}℃  ${pop!=null?`/ 降水${pop}%`:""}`;
    list.appendChild(li);
  }
}

// --- Overpass Spot Search ---
const categories = {
  indoor:  ['amenity=library','amenity=arts_centre','amenity=planetarium','amenity=theatre','amenity=cinema','tourism=museum','tourism=aquarium','shop=mall'],
  shade:   ['leisure=park','leisure=garden','tourism=attraction','landuse=forest'],
  water:   ['natural=water','water=lake','water=pond','leisure=marina','waterway=riverbank','beach=yes'],
  seating: ['amenity=bench','leisure=park','tourism=attraction'],
  lowodor: ['amenity=library','tourism=museum','amenity=planetarium','amenity=arts_centre']
};

function speedToKmh(profile){
  if (profile==='slow') return 25;
  if (profile==='fast') return 50;
  return 35;
}

// Haversine distance (km)
function haversine(lat1, lon1, lat2, lon2){
  const toRad = d=>d*Math.PI/180;
  const R = 6371;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R*c;
}

function buildOverpassQuery(lat, lon, radiusKm){
  const tagSet = new Set(Object.values(categories).flat());
  const parts = [];
  tagSet.forEach(kv=>{
    const [k,v] = kv.split('=');
    parts.push(`node(around:${radiusKm*1000},${lat},${lon})[${k}=${v}];`);
    parts.push(`way(around:${radiusKm*1000},${lat},${lon})[${k}=${v}];`);
    parts.push(`relation(around:${radiusKm*1000},${lat},${lon})[${k}=${v}];`);
  });
  return `[out:json][timeout:25];
  (
  ${parts.join('\n')}
  );
  out center 200;`;
}

// Score by priority (lower is better)
function scoreSpot(spot, prio, lat, lon){
  const props = {indoor:false,shade:false,water:false,seating:false,lowodor:false};
  const tags = spot.tags||{};
  const has = (k,v)=> tags[k]===v;
  if (has('amenity','library')||has('tourism','museum')||has('amenity','planetarium')||has('amenity','arts_centre')||has('tourism','aquarium')||has('shop','mall')) props.indoor=true;
  if (has('leisure','park')||has('leisure','garden')||has('landuse','forest')) props.shade=true;
  if (has('natural','water')||has('waterway','riverbank')||has('beach','yes')) props.water=true;
  if (has('amenity','bench')||has('leisure','park')) props.seating=true;
  if (has('amenity','library')||has('tourism','museum')||has('amenity','planetarium')||has('amenity','arts_centre')) props.lowodor=true;

  const distKm = haversine(lat,lon,spot.lat,spot.lon);
  let s = 0;
  for (const k of ['indoor','shade','water','seating','lowodor']){
    const p = prio[k];
    s += (props[k] ? p : p+2);
  }
  s += distKm*0.3;
  return {score:s, props};
}

async function searchOverpass(lat, lon, minutes, profile, prio, limit=10){
  const kmh = speedToKmh(profile);
  const radiusKm = Math.max(1, (kmh * (minutes/60)) * 0.6);
  const query = buildOverpassQuery(lat, lon, radiusKm);
  const url = "https://overpass-api.de/api/interpreter";
  const res = await fetch(url, { method:"POST", body: query, headers:{ "Content-Type":"text/plain" } });
  const json = await res.json();
  const elements = json.elements||[];
  const spots = elements.map(e=>{
    const latc = e.lat || (e.center&&e.center.lat);
    const lonc = e.lon || (e.center&&e.center.lon);
    return { id:e.id, lat:latc, lon:lonc, tags:e.tags||{} };
  }).filter(s=> s.lat && s.lon);

  const scored = spots.map(s=>{
    const {score, props} = scoreSpot(s, prio, lat, lon);
    return {...s, score, props};
  }).sort((a,b)=>a.score-b.score);

  return scored.slice(0, limit);
}

function renderSpotsList(items){
  const list = document.getElementById("spots");
  list.innerHTML = "";
  if (!items.length){
    const li = document.createElement("li"); li.className="spot"; li.textContent="見つかりませんでした。条件を緩めて再検索してください。";
    list.appendChild(li);
    return;
  }
  items.forEach(s=>{
    const name = s.tags.name || s.tags["name:ja"] || s.tags.amenity || s.tags.leisure || s.tags.tourism || "スポット";
    const tags = [];
    if (s.props.indoor) tags.push("屋内");
    if (s.props.shade) tags.push("木陰");
    if (s.props.water) tags.push("水辺");
    if (s.props.seating) tags.push("ベンチ");
    if (s.props.lowodor) tags.push("匂い少");
    const li = document.createElement("li");
    li.className = "spot";
    li.innerHTML = `<div><strong>${name}</strong><br><small>${(s.tags.website||s.tags.operator||"")}</small></div><div>${tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>`;
    list.appendChild(li);
  });
}

// --- Main update & events ---
async function updateWeatherAndWBGT(lat, lon){
  const data = await fetchWeatherAll(lat, lon);
  const temp = data?.current?.temperature_2m;
  const rh   = data?.current?.relative_humidity_2m;
  const wbgt = wbgtEstimate(temp, rh);
  const hi   = heatIndexC(temp, rh);
  const lvl  = wbgtLevel(wbgt);
  document.getElementById("wbgtValue").textContent = wbgt.toFixed(1);
  const lbl = document.getElementById("wbgtLevel");
  lbl.textContent = `${lvl.icon} ${lvl.label}`; lbl.className = "badge " + lvl.class;
  document.getElementById("temp").textContent = temp.toFixed(1);
  document.getElementById("rh").textContent = rh.toFixed(0);
  document.getElementById("heatIndex").textContent = hi.toFixed(1);
  document.getElementById("advice").textContent = lvl.advice + " 体調が悪くなったら無理せず休憩/帰宅を。";

  renderHourly(data.hourly||{});
  renderDaily(data.daily||{});
}

async function runUpdate(){
    let key = Utils.resolveRegionKey(document.getElementById("region").value);
  let lat, lon;
  if (key==="current"){
    try{
      const pos = await new Promise((resolve, reject)=>{
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy:true, timeout:8000 });
      });
      lat = pos.coords.latitude; lon = pos.coords.longitude;
    }catch(e){
      alert("現在地が取得できませんでした。プリセット地域（江坂）を使用します。");
        key="esaka"; lat=presets.esaka.lat; lon=presets.esaka.lon;
        document.getElementById("region").value = document.querySelector('#region-options option[data-key="esaka"]').value;
    }
  }else{
    lat = presets[key].lat; lon = presets[key].lon;
  }

  await updateWeatherAndWBGT(lat, lon);

  const minutes = parseInt(document.getElementById("driveMin").value,10)||20;
  const profile = document.getElementById("speedProfile").value;
  const prio = {
    indoor:  parseInt(document.getElementById("prio-indoor").value,10)||1,
    shade:   parseInt(document.getElementById("prio-shade").value,10)||2,
    water:   parseInt(document.getElementById("prio-water").value,10)||3,
    seating: parseInt(document.getElementById("prio-seating").value,10)||2,
    lowodor: parseInt(document.getElementById("prio-lowodor").value,10)||1,
  };
  try{
    const results = await searchOverpass(lat, lon, minutes, profile, prio, 10);
    renderSpotsList(results);
  }catch(e){
    const list = document.getElementById("spots");
    list.innerHTML = "<li class='spot'>Overpassの取得に失敗しました。時間をおいて再試行してください。</li>";
  }
}

window.addEventListener("load", ()=>{
  runUpdate();
  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js");
  }
});

document.getElementById("refresh").addEventListener("click", runUpdate);
document.getElementById("addToHome").addEventListener("click", ()=>{
  alert("Safariの共有 → 『ホーム画面に追加』でアプリ化できます。");
});
document.getElementById("searchSpots").addEventListener("click", runUpdate);
