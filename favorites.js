// favorites.js — localStorage-based favorites manager
(function(global){
  const KEY = "favorites_v1";

  function _load(){
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch(e){ return []; }
  }
  function _save(list){
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch(e){}
  }
  function makeKey(entry){
    const id = entry.id || "";
    const name = entry.name || "";
    const lat = entry.lat!=null ? Number(entry.lat).toFixed(5) : "";
    const lon = entry.lon!=null ? Number(entry.lon).toFixed(5) : "";
    const kind = entry.kind || "";
    return id ? `${kind}:${id}` : `${kind}:${name}|${lat},${lon}`;
  }

  function addFavorite(entry){
    const list = _load();
    const key = entry.key || makeKey(entry);
    if(!list.find(x => (x.key||makeKey(x)) === key)){
      list.push({...entry, key, addedAt: Date.now()});
      _save(list);
    }
    return list;
  }
  function removeFavorite(keyOrEntry){
    const key = typeof keyOrEntry === "string" ? keyOrEntry : (keyOrEntry.key || makeKey(keyOrEntry));
    const list = _load().filter(x => (x.key||makeKey(x)) !== key);
    _save(list);
    return list;
  }
  function getFavorites(){ return _load(); }
  function isFavorite(entry){
    const key = entry.key || makeKey(entry);
    return !!_load().find(x => (x.key||makeKey(x)) === key);
  }

  // map helpers
  function gmapsHref(name,lat,lon){
    const q = encodeURIComponent(name||"目的地");
    return `https://maps.google.com/?q=${q}&ll=${lat},${lon}&z=17`;
  }
  function amapsHref(name,lat,lon){
    const q = encodeURIComponent(name||"目的地");
    return `https://maps.apple.com/?ll=${lat},${lon}&q=${q}`;
  }

  global.Favorites = { addFavorite, removeFavorite, getFavorites, isFavorite, makeKey, gmapsHref, amapsHref };
})(window);
