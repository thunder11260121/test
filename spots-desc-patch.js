// --- PATCH: human-friendly description for each spot ---
(function(){
  if(!window.__SPOTS_RENDER_PATCHED__){
    window.__SPOTS_RENDER_PATCHED__ = true;
    // Monkey-patch render if found
    const origRender = window.renderSpotsList; // if app exposes it
    // If not exposed, we won't break anything; many builds render inline. Provide a helper anyway.
    window.describeSpot = function(s){
      const t = (s.tags && (s.tags.amenity || s.tags.tourism || s.tags.leisure || s.tags.shop)) || "スポット";
      const feats = [];
      if(s.props && s.props.indoor) feats.push("屋内");
      if(s.props && s.props.shade) feats.push("木陰");
      if(s.props && s.props.water) feats.push("水辺");
      if(s.props && s.props.seating) feats.push("ベンチ");
      if(s.props && s.props.lowodor) feats.push("匂い少なめ");
      const featLine = feats.length ? `（${feats.join("・")}）` : "";
      return `${t}${featLine}。江坂からの距離は約${(s.distKm||0).toFixed(1)}kmです。`;
    };
  }
})();