// Google Maps app deeplink helper + fallback (safe)
(function(){
  function openGoogleMapsApp(name, lat, lon){
    try{
      var q = encodeURIComponent((name||'').trim() || (lat + "," + lon));
      var appUrl = "comgooglemaps://?q=" + q + "&center=" + lat + "," + lon;
      var webUrl = "https://maps.google.com/?q=" + q + "&ll=" + lat + "," + lon;
      var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        var t = Date.now();
        location.href = appUrl;
        setTimeout(function(){
          if (Date.now() - t < 1500) location.href = webUrl;
        }, 800);
      } else {
        window.open(webUrl, "_blank", "noopener");
      }
    }catch(e){ console.error(e); }
  }
  window.openGoogleMapsApp = openGoogleMapsApp;
  document.addEventListener("click", function(e){
    var btn = e.target.closest(".iconbtn.gmaps, .gmaps");
    if(!btn) return;
    var lat = btn.dataset.lat, lon = btn.dataset.lon, name = btn.dataset.name;
    var item = btn.closest("[data-lat][data-lon]");
    if(item){ lat = lat || item.getAttribute("data-lat"); lon = lon || item.getAttribute("data-lon"); name = name || item.getAttribute("data-name"); }
    if(!name){
      var strong = btn.closest("li, .spot, .item, .card"); if(strong){ var t = strong.querySelector("strong"); if(t) name = t.textContent.trim(); }
    }
    if(lat && lon){ e.preventDefault(); openGoogleMapsApp(name||"", lat, lon); }
  }, false);
})();
