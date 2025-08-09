async function getWeatherAndWBGT(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weathercode&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo`;
  const res = await fetch(url);
  const data = await res.json();
  const temp = data.hourly.temperature_2m[0];
  const rh = data.hourly.relative_humidity_2m[0];
  const wbgt = Math.round(0.7*temp + 0.3*rh); // 簡易計算
  document.getElementById('weather').innerHTML = `現在気温: ${temp}℃ 湿度: ${rh}%`;
  document.getElementById('wbgt').innerHTML = `推定WBGT: ${wbgt}`;
}

const spots = [
  { name: "江坂公園", indoor: false, shade: true },
  { name: "江坂イオン", indoor: true, shade: false },
  { name: "京都水族館", indoor: true, shade: false }
];

function filterSpots(filters) {
  return spots.filter(s => {
    for (const key in filters) {
      if (filters[key] && !s[key]) return false;
    }
    return true;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  getWeatherAndWBGT(34.75, 135.50);
  const filtered = filterSpots({ indoor: true });
  document.getElementById('spots').innerHTML = filtered.map(s=>s.name).join('<br>');
});