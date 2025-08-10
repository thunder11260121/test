// meals-loading-helper.js — show '検索中…' while fetching
(function(){
  // We assume existing functions are defined as in your current meals.js
  const origRun = window.__MEALS_RUN__;
  async function runWithLoading(){
    const ul = document.getElementById("list");
    if(ul){ ul.innerHTML = "<li class='item'>検索中…</li>"; }
    if(typeof origRun === "function"){ return origRun(); }
    // Fallback: if no hook, simply dispatch click to existing search button
    const btn=document.getElementById("search");
    if(btn){ btn.click(); }
  }
  window.addEventListener("load", ()=>{
    // If the page already binds a run() on load, we show loading first
    runWithLoading();
  });
})();