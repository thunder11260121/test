
// meals.js - fixed version with proper URL strings and Google Maps app deep linking
document.addEventListener("DOMContentLoaded", function(){
  const listEl = document.getElementById("list");
  const API_URL = "https://example.com/api/meals"; // <-- replace with your actual endpoint
  
  fetch(API_URL)
    .then(res => res.json())
    .then(data => {
      renderMeals(data);
    })
    .catch(err => {
      console.error("Error fetching meals:", err);
      listEl.innerHTML = "<li>データ取得に失敗しました</li>";
    });

  function renderMeals(items){
    listEl.innerHTML = "";
    // show only top 10
    items.slice(0, 10).forEach(s => {
      const li = document.createElement("li");
      li.setAttribute("data-lat", s.lat);
      li.setAttribute("data-lon", s.lon);
      li.setAttribute("data-name", s.name);
      
      // Opening hours badge
      let badge = "";
      if(s.opening_hours){
        const openNow = parseOpeningHours(s.opening_hours);
        badge = `<span class="badge ${openNow ? 'open' : 'closed'}">${openNow ? '開店中' : '閉店'}</span>`;
      }

      li.innerHTML = `
        <strong>${s.name}</strong> ${badge}<br>
        <small>${s.description || ""}</small><br>
        <div class="map-buttons">
          <button class="iconbtn gmaps" title="Googleマップで開く">
            <img src="google_icon.svg" alt="Google">
          </button>
          <a class="iconbtn amaps" target="_blank" rel="noopener"
             href="http://maps.apple.com/?ll=${s.lat},${s.lon}&q=${encodeURIComponent(s.name)}" title="Appleマップで開く">
            <img src="apple_icon.svg" alt="Apple">
          </a>
        </div>
      `;
      listEl.appendChild(li);
    });
  }

  function parseOpeningHours(oh){
    // Simple parser: assumes "open" boolean or similar
    if(typeof oh === "string"){
      return /open/i.test(oh);
    }
    if(typeof oh === "object" && "open_now" in oh){
      return !!oh.open_now;
    }
    return false;
  }
});
