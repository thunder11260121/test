// fav_injector.js — add ★ buttons into spots (#spots) and meals (#list) automatically
(function(){
  function ensureButton(li, kind){
    if(li.querySelector('.fav-btn')) return;
    const name = li.getAttribute('data-name');
    const lat = parseFloat(li.getAttribute('data-lat'));
    const lon = parseFloat(li.getAttribute('data-lon'));
    const id  = li.getAttribute('data-id') || ""; // optional
    if(!name || !isFinite(lat) || !isFinite(lon)) return;

    const entry = { id, name, lat, lon, kind };
    const key = Favorites.makeKey(entry);
    entry.key = key;

    const actions = li.querySelector('.actions') || li;
    const btn = document.createElement('button');
    btn.className = 'iconbtn fav-btn';
    btn.setAttribute('aria-label', 'お気に入りに追加/解除');
    btn.title = 'お気に入りに追加/解除';
    btn.textContent = Favorites.isFavorite(entry) ? '★' : '☆';
    btn.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      ev.preventDefault();
      if(Favorites.isFavorite(entry)){
        Favorites.removeFavorite(entry);
        btn.textContent = '☆';
      }else{
        Favorites.addFavorite(entry);
        btn.textContent = '★';
        btn.animate?.([{transform:'scale(1)'},{transform:'scale(1.15)'},{transform:'scale(1)'}],{duration:180});
      }
    });
    actions.appendChild(btn);
  }

  function scan(kind){
    const selector = kind === 'spot' ? '#spots > li' : '#list > li';
    document.querySelectorAll(selector).forEach(li => ensureButton(li, kind));
  }

  function observe(kind){
    const root = document.getElementById(kind === 'spot' ? 'spots' : 'list');
    if(!root) return;
    const mo = new MutationObserver(()=>scan(kind));
    mo.observe(root, {childList:true, subtree:false});
    scan(kind);
  }

  window.addEventListener('load', ()=>{
    observe('spot');
    observe('meal');
  });
})();