// Regions
const presets = {
  esaka:     { name: "大阪・江坂", lat: 34.7565, lon: 135.4968 },
  kyoto:     { name: "京都市",     lat: 35.038,  lon: 135.774 },
  kobe:      { name: "神戸市",     lat: 34.6913, lon: 135.1830 },
  omiya:     { name: "さいたま市大宮区", lat: 35.906, lon: 139.624 },
  fukushima: { name: "福島市",     lat: 37.7608, lon: 140.4747 },
};

// Spots DB
const spotDB = {
  esaka: [
    { name:"神崎川・江坂側遊歩道", indoor:false, shade:true, water:true, seating:true, lowodor:true, note:"夕方の川風が心地よい。短時間散歩。" },
    { name:"服部緑地 日本庭園周辺", indoor:false, shade:true, water:false, seating:true, lowodor:true, note:"木陰とベンチで無理なく休憩。" },
    { name:"吹田市立博物館", indoor:true, shade:false, water:false, seating:true, lowodor:true, note:"静かで匂い少なめ、涼しい。" },
    { name:"大阪市立科学館（プラネタリウム）", indoor:true, shade:false, water:false, seating:true, lowodor:true, note:"座って鑑賞できる休憩スポット。" }
  ],
  kyoto: [
    { name:"京都府立植物園（北山）", indoor:false, shade:true, water:false, seating:true, lowodor:true, note:"木陰・ベンチ多数。午前に。" },
    { name:"下鴨神社・糺の森", indoor:false, shade:true, water:false, seating:true, lowodor:true, note:"森の木陰で涼しく散歩。" },
    { name:"京都市京セラ美術館（岡崎）", indoor:true, shade:false, water:false, seating:true, lowodor:true, note:"広い館内で休憩しやすい。" },
    { name:"京都国立近代美術館", indoor:true, shade:false, water:false, seating:true, lowodor:true, note:"静かな展示。匂い少なめ。" }
  ],
  kobe: [
    { name:"須磨海浜公園", indoor:false, shade:true, water:true, seating:true, lowodor:true, note:"海風が気持ちいい。日陰で休憩。" },
    { name:"兵庫県立美術館", indoor:true, shade:false, water:false, seating:true, lowodor:true, note:"館内広く涼しい。" },
    { name:"神戸布引ハーブ園（ロープウェイ上駅周辺）", indoor:false, shade:true, water:false, seating:true, lowodor:true, note:"高所で風が通る。歩きすぎ注意で短距離。" }
  ],
  omiya: [
    { name:"コクーンシティ（館内散歩）", indoor:true, shade:false, water:false, seating:true, lowodor:true, note:"冷房・トイレ完備。" },
    { name:"大宮第二・第三公園", indoor:false, shade:true, water:false, seating:true, lowodor:true, note:"木陰で短時間散歩。" },
    { name:"鉄道博物館", indoor:true, shade:false, water:false, seating:true, lowodor:true, note:"展示中心で匂い少。" }
  ],
  fukushima: [
    { name:"福島県立図書館", indoor:true, shade:false, water:false, seating:true, lowodor:true, note:"静かで休憩しやすい。" },
    { name:"四季の里（木陰ゾーン）", indoor:false, shade:true, water:true, seating:true, lowodor:true, note:"涼しい時間帯に。" },
    { name:"こむこむ館", indoor:true, shade:false, water:false, seating:true, lowodor:true, note:"屋内＆匂い少なめ。" }
  ]
};

// Checklist
const checklistItems = [
  "保冷ボトル（麦茶/スポドリ）","日傘/帽子","ネッククーラー/保冷剤","ミニ扇風機",
  "塩分タブレット","冷感タオル","小さめレジャーシート","母子手帳・保険証"
];

// UI refs
const el = {
  region: document.getElementById("region"),
  refresh: document.getElementById("refresh"),
  wbgtValue: document.getElementById("wbgtValue"),
  wbgtLevel: document.getElementById("wbgtLevel"),
  temp: document.getElementById("temp"),
  rh: document.getElementById("rh"),
  heatIndex: document.getElementById("heatIndex"),
  advice: document.getElementById("advice"),
  spots: document.getElementById("spots"),
  filterIndoor: document.getElementById("filter-indoor"),
  filterShade: document.getElementById("filter-shade"),
  filterWater: document.getElementById("filter-water"),
  filterSeating: document.getElementById("filter-seating"),
  filterLowodor: document.getElementById("filter-lowodor"),
  checklist: document.getElementById("checklist"),
  saveChecklist: document.getElementById("saveChecklist"),
  addToHome: document.getElementById("addToHome")
};

// Add-to-home hint
el.addToHome.addEventListener("click", ()=>{
  alert("Safariの共有ボタン → 『ホーム画面に追加』でアプリ化できます。");
});

// Checklist init/save
function initChecklist(){
  el.checklist.innerHTML = "";
  const saved = JSON.parse(localStorage.getItem("checklist")||"{}");
  checklistItems.forEach((label, i)=>{
    const id = "item-"+i;
    const li = document.createElement("li");
    li.innerHTML = `<label><input type="checkbox" id="${id}" ${saved[id]?"checked":""}> ${label}</label>`;
    el.checklist.appendChild(li);
  });
}
el.saveChecklist.addEventListener("click", ()=>{
  const state = {};
  el.checklist.querySelectorAll("input[type=checkbox]").forEach(cb=> state[cb.id] = cb.checked );
  localStorage.setItem("checklist", JSON.stringify(state));
  alert("チェックを保存しました");
});

// Weather & WBGT
function wbgtEstimate(tempC, rh){
  const e = (rh/100) * 6.105 * Math.exp((17.27*tempC)/(237.7+tempC)); // hPa
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
  if (wbgt < 25) return { label:"注意", class:"safe", advice:"水分補給をこまめに。短時間の屋外はOK。" };
  if (wbgt < 28) return { label:"警戒", class:"caution", advice:"屋外は短時間に。日陰/屋内をメインに、塩分補給も。" };
  if (wbgt < 31) return { label:"厳重警戒", class:"high", advice:"長時間屋外は避ける。午前のみ短時間、午後は屋内。" };
  return { label:"危険", class:"danger", advice:"外出は最小限に。冷房の効いた室内で安静に。" };
}

async function fetchWeather(lat, lon){
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m&timezone=auto`;
  const res = await fetch(url);
  const data = await res.json();
  return { temp: data?.current?.temperature_2m, rh: data?.current?.relative_humidity_2m };
}

function renderSpots(regionKey){
  const items = (spotDB[regionKey]||[]).filter(s =>
    (el.filterIndoor.checked || !s.indoor) &&
    (el.filterShade.checked || !s.shade) &&
    (el.filterWater.checked || !s.water) &&
    (el.filterSeating.checked || !s.seating) &&
    (el.filterLowodor.checked || !s.lowodor)
  );
  el.spots.innerHTML = "";
  if (!items.length){
    const li = document.createElement("li");
    li.className = "spot";
    li.textContent = "条件に合う候補がありません。フィルタを緩めてください。";
    el.spots.appendChild(li);
    return;
  }
  items.forEach(s=>{
    const li = document.createElement("li");
    li.className = "spot";
    const tags = [
      s.indoor?"屋内":null,
      s.shade?"木陰":null,
      s.water?"水辺":null,
      s.seating?"ベンチ多":null,
      s.lowodor?"匂い少":null
    ].filter(Boolean).map(t=>`<span class="tag">${t}</span>`).join("");
    li.innerHTML = `<div><strong>${s.name}</strong><br><small>${s.note||""}</small></div><div>${tags}</div>`;
    el.spots.appendChild(li);
  });
}

async function update(){
  let key = el.region.value;
  let lat, lon;
  if (key==="current"){
    try{
      const pos = await new Promise((resolve, reject)=>{
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy:true, timeout:8000 });
      });
      lat = pos.coords.latitude; lon = pos.coords.longitude;
    }catch(e){
      alert("現在地が取得できませんでした。プリセット地域（江坂）を使用します。");
      key = "esaka"; lat = presets.esaka.lat; lon = presets.esaka.lon;
      el.region.value = "esaka";
    }
  }else{
    lat = presets[key].lat; lon = presets[key].lon;
  }

  try{
    const { temp, rh } = await fetchWeather(lat, lon);
    const wbgt = wbgtEstimate(temp, rh);
    const hi = heatIndexC(temp, rh);
    const lvl = wbgtLevel(wbgt);
    el.wbgtValue.textContent = wbgt.toFixed(1);
    el.wbgtLevel.textContent = lvl.label;
    el.wbgtLevel.className = "badge " + lvl.class;
    el.temp.textContent = temp.toFixed(1);
    el.rh.textContent = rh.toFixed(0);
    el.heatIndex.textContent = hi.toFixed(1);
    el.advice.textContent = lvl.advice + " 妊娠初期は無理をせず、気分が悪くなったらすぐ休憩/帰宅を。";
  }catch(e){
    el.advice.textContent = "天気データの取得に失敗しました。通信環境をご確認ください。";
  }

  const regionKey = key==="current" ? "esaka" : key;
  renderSpots(regionKey);
}

// Events
["change","click"].forEach(evt=>{
  el.filterIndoor.addEventListener(evt, ()=>renderSpots(el.region.value==="current"?"esaka":el.region.value));
  el.filterShade.addEventListener(evt, ()=>renderSpots(el.region.value==="current"?"esaka":el.region.value));
  el.filterWater.addEventListener(evt, ()=>renderSpots(el.region.value==="current"?"esaka":el.region.value));
  el.filterSeating.addEventListener(evt, ()=>renderSpots(el.region.value==="current"?"esaka":el.region.value));
  el.filterLowodor.addEventListener(evt, ()=>renderSpots(el.region.value==="current"?"esaka":el.region.value));
  el.region.addEventListener(evt, update);
});
document.getElementById("refresh").addEventListener("click", update);

window.addEventListener("load", ()=>{
  initChecklist();
  update();
  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js");
  }
});
