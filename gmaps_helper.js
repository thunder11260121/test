
// Google Maps app deeplink helper + graceful fallback
(function(){
  function openGoogleMapsApp(name, lat, lon){
    var q = encodeURIComponent(name || (lat + "," + lon));
    var appUrl = "comgooglemaps://?q=" + q + "&center=" + lat + "," + lon;
    var webUrl = "https://maps.google.com/?q=" + q + "&ll=" + lat + "," + lon;
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      var t = Date.now();
      location.href = appUrl; // try app first
      setTimeout(function(){
        if (Date.now() - t < 1500) location.href = webUrl; // fallback
      }, 800);
    } else {
      window.open(webUrl, "_blank", "noopener");
    }
  }

  // Event delegation for any .iconbtn.gmaps
  function delegate(container){
    if(!container) return;
    container.addEventListener("click", function(e){
      var btn = e.target.closest(".iconbtn.gmaps, .gmaps");
      if(!btn) return;
      // Try to read dataset on the element or walk up to find data props
      var el = btn;
      var lat = el.dataset.lat, lon = el.dataset.lon, name = el.dataset.name;
      // If not present, try to resolve from the line item (script that created buttons can set data-*)
      var item = btn.closest("[data-lat][data-lon]");
      if(item){
        lat = lat || item.getAttribute("data-lat");
        lon = lon || item.getAttribute("data-lon");
        name = name || item.getAttribute("data-name");
      }
      // As a last resort, try to find text title in the same card
      if(!name){
        var strong = btn.closest("li, .spot, .item, .card");
        if(strong){
          var t = strong.querySelector("strong");
          if(t) name = t.textContent.trim();
        }
      }
      if(lat && lon){
        e.preventDefault();
        openGoogleMapsApp(name || "", lat, lon);
      }
    }, false);
  }

  // Observe dynamic lists (since items are rendered after fetch)
  var obs = new MutationObserver(function(){
    // nothing needed; we use delegation
  });

  document.addEventListener("DOMContentLoaded", function(){
    delegate(document);
    try{
      var lists = document.querySelectorAll("#spots, #list");
      lists.forEach(function(node){ obs.observe(node, {childList:true, subtree:true}); });
    }catch(_){}
  });
})();
