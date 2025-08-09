
(function(){
  function loadFavs(){try{return JSON.parse(localStorage.getItem("favorites")||"[]");}catch(_){return[];}}
  function render(){const list=document.getElementById("favList");const favs=loadFavs();list.innerHTML="";if(!favs.length){const li=document.createElement("li");li.className="item";li.textContent="お気に入りはまだありません。";list.appendChild(li);return;}favs.forEach(s=>{const li=document.createElement("li");li.className="item";li.innerHTML=`<div><strong>${s.name||'スポット'}</strong><div class="meta">${(s.lat||0).toFixed(4)}, ${(s.lon||0).toFixed(4)}</div></div>`;list.appendChild(li);});}
  window.addEventListener("load", render);
})();
