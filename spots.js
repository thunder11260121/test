// spots.js - with human-friendly description integrated

// Helper to describe spot
function describeSpot(s) {
  const t = (s.tags && (s.tags.amenity || s.tags.tourism || s.tags.leisure || s.tags.shop)) || "スポット";
  const feats = [];
  if(s.props && s.props.indoor) feats.push("屋内");
  if(s.props && s.props.shade) feats.push("木陰");
  if(s.props && s.props.water) feats.push("水辺");
  if(s.props && s.props.seating) feats.push("ベンチ");
  if(s.props && s.props.lowodor) feats.push("匂い少なめ");
  const featLine = feats.length ? `（${feats.join("・")}）` : "";
  return `${t}${featLine}。江坂からの距離は約${(s.distKm||0).toFixed(1)}kmです。`;
}

// Example rendering logic
function renderSpotsList(spots) {
  const list = document.getElementById("spots");
  list.innerHTML = "";
  spots.forEach(s => {
    const li = document.createElement("li");
    const desc = describeSpot(s);
    li.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:4px">
        <strong>${s.name || "名称不明"}</strong>
        <div class="meta">${desc}</div>
        <div style="display:flex;gap:4px">
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name || "")}" target="_blank" class="primary small">Google</a>
          <a href="http://maps.apple.com/?q=${encodeURIComponent(s.name || "")}" target="_blank" class="primary small">Apple</a>
        </div>
      </div>
    `;
    list.appendChild(li);
  });
}

// Dummy search trigger
document.getElementById("searchSpots").addEventListener("click", () => {
  // Replace with actual Overpass fetch and parse
  const dummy = [
    { name:"服部緑地", distKm:2.1, tags:{tourism:"park"}, props:{shade:true,water:true,seating:true} },
    { name:"江坂公園", distKm:0.5, tags:{tourism:"park"}, props:{shade:true,seating:true} }
  ];
  renderSpotsList(dummy);
});
