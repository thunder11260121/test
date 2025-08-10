// utils.js — shared helpers (2-min cache, fetch with mirrors, errors, distance)
(function (global) {
  const MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];

  function rad(x) { return x * Math.PI / 180; }
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371, dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
    const A = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A));
  }

  async function fetchOverpassJSON(query, { timeoutMs = 12000, retries = 2 } = {}) {
    let lastErr;
    for (let r = 0; r <= retries; r++) {
      for (const url of MIRRORS) {
        try {
          const ctl = new AbortController();
          const timer = setTimeout(() => ctl.abort(), timeoutMs);
          const res = await fetch(url, {
            method: "POST",
            body: query,
            headers: { "Content-Type": "text/plain" },
            signal: ctl.signal,
            cache: "no-store"
          });
          clearTimeout(timer);
          if (!res.ok) throw new Error(`HTTP ${res.status} at ${url}`);
          return await res.json();
        } catch (e) {
          lastErr = e;
        }
      }
      await new Promise(res => setTimeout(res, 800 * (r + 1)));
    }
    throw lastErr || new Error("Overpass fetch failed");
  }

  function errorMessage(e) {
    const s = String(e || "");
    if (/HTTP 429/.test(s)) return "混雑のため取得制限中です。1–2分おいて再試行してください。";
    if (/AbortError/.test(s)) return "タイムアウトしました。通信状況の良い場所でお試しください。";
    return "取得に失敗しました。時間をおいて再試行してください。";
  }

  const TTL = 120000; // 2min
  function cacheKey(kind, params) {
    return `wbgt:${kind}:${btoa(unescape(encodeURIComponent(JSON.stringify(params))))}`;
  }

  function cacheGet(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (Date.now() - o.t > TTL) return null;
      return o.v;
    } catch (_) {
      return null;
    }
  }

  function cacheSet(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value }));
    } catch (_) { }
  }

  global.Utils = { haversine, fetchOverpassJSON, errorMessage, cacheKey, cacheGet, cacheSet };
})(window);

