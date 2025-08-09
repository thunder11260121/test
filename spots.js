// spots.js (styled cards + description + icon buttons)
(function(){
  // --- helpers reused in your project (distance etc.) ---
  function rad(x){ return x*Math.PI/180; }
  const R = 6371;
  function haversine(a,b,c,d){ const dLat=rad(c-a), dLon=rad(d-b); const A=Math.sin(dLat/2)**2 + Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dLon/2)**2; return 2*R*Math.atan2(Math.sqrt(A),Math.sqrt(1-A)); }

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
    return tags.tourism||tags.leisure||tags.amenity||'スポット';
  }

  function shortDesc(s){
    const t=s.tags||{}; const type=friendlyType(t);
    const feats=[]; const p=s.props||{};
    if(p.indoor)feats.push('屋内'); if(p.shade)feats.push('木陰'); if(p.water)feats.push('水辺'); if(p.seating)feats.push('ベンチ'); if(p.lowodor)feats.push('匂い少');
    const featLine=feats.length?`（${feats.join('・')}）`:"";
    const dist = isFinite(s.distKm) ? `・約${s.distKm.toFixed(1)}km` : "";
    return `${type}${featLine}${dist}`;
  }

  function appleMapsLink(s){ const q=encodeURIComponent((s.tags && (s.tags.name||s.tags['name:ja'])) || s.name || '目的地'); return `https://maps.apple.com/?ll=${s.lat},${s.lon}&q=${q}`; }

  function render(items){
    const ul=document.getElementById('spots'); ul.innerHTML='';
    if(!items.length){ const li=document.createElement('li'); li.className='spot'; li.textContent='見つかりませんでした。'; ul.appendChild(li); return; }
    items.forEach(s=>{
      const li=document.createElement('li'); li.className='spot';
      li.setAttribute('data-lat',s.lat); li.setAttribute('data-lon',s.lon); li.setAttribute('data-name',s.name||'');
      li.innerHTML = `<div>
        <strong>${s.name||'名称不明'}</strong>
        <div class='meta'>${shortDesc(s)}</div>
      </div>
      <div class='actions vstack'>
        <button class='iconbtn gmaps' title='Googleマップで開く' data-lat='${s.lat}' data-lon='${s.lon}' data-name='${s.name||""}'>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8z" fill="#EA4335"></path><circle cx="12" cy="10" r="5" fill="#fff"></circle><text x="12" y="13" text-anchor="middle" font-size="8" font-family="Arial" fill="#1a73e8" font-weight="700">G</text></svg>
        </button>
        <a class='iconbtn amaps' target='_blank' rel='noopener' title='Appleマップで開く' href='${appleMapsLink(s)}'>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="#e2e8f0" stroke="#cbd5e1"></rect><path d="M7 14l3-3 2 2 4-4" fill="none" stroke="#0ea5e9" stroke-width="2"></path><circle cx="16" cy="9" r="2" fill="#94a3b8"></circle></svg>
        </a>
      </div>`;
      ul.appendChild(li);
    });
  }

  // expose render for existing search logic to call
  window.renderSpotsList = render;
})();