// Leaflet (CRS.Simple) interactive map for a custom game image
(async function () {
  const imgWidth = 6144;   // TODO: 원본 맵 이미지의 폭(px)
  const imgHeight = 6144;  // TODO: 원본 맵 이미지의 높이(px)
  const mapImage = 'assets/map.png'; // TODO: 여기에 맵 이미지 파일을 넣으세요.

  // 맵 생성
  const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -3,
    maxZoom: 4,
    zoomSnap: 0.25,
    wheelPxPerZoomLevel: 120
  });

  // 이미지 경계: [ [top, left], [bottom, right] ] = [ [0,0], [imgHeight, imgWidth] ]
  const bounds = [[0, 0], [imgHeight, imgWidth]];

  // 이미지 오버레이
  const overlay = L.imageOverlay(mapImage, bounds, { opacity: 1.0 });
  overlay.addTo(map);
  map.fitBounds(bounds);

  // 경계(디버그 가이드라인)
  const rect = L.rectangle(bounds, { className: 'bounds-rect' });
  rect.addTo(map);

  // 레이어 그룹(카테고리별)
  const layers = new Map();

  // 마커 아이콘(간단 버전)
  const icon = (emoji) => L.divIcon({
    className: 'emoji-pin',
    html: `<div style="font-size:20px;filter: drop-shadow(0 1px 2px rgba(0,0,0,.6))">${emoji}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  // 데이터 로드
  const spots = await fetch('data/markers.json').then(r => r.json());

  // 카테고리 수집
  const categories = [...new Set(spots.map(s => s.type))];

  // 카테고리 레이어 생성
  categories.forEach(cat => layers.set(cat, L.layerGroup().addTo(map)));

  // 마커 추가
  const markers = spots.map(s => {
    const marker = L.marker([s.pos[0], s.pos[1]], { icon: icon(s.emoji || '📍') })
      .bindPopup(`<b>${s.name}</b><br>${s.note || ''}<br><small>${(s.tags||[]).join(', ')}</small>`);
    layers.get(s.type)?.addLayer(marker);
    return { ...s, marker };
  });

  // 레이어 토글 UI
  const overlays = {};
  for (const cat of categories) overlays[cat] = layers.get(cat);
  L.control.layers(null, overlays, { collapsed: false }).addTo(map);

  // 검색
  const search = document.getElementById('search');
  search?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = (search.value || '').trim().toLowerCase();
      if (!q) {
        // 리셋: 전체 보이기
        markers.forEach(m => m.marker.setOpacity(1));
        return;
      }
      markers.forEach(m => {
        const hay = [m.name, m.note, ...(m.tags||[])].join(' ').toLowerCase();
        m.marker.setOpacity(hay.includes(q) ? 1 : 0.15);
      });
    }
  });

  // 경계 표시 토글
  const toggle = document.getElementById('toggle-bounds');
  toggle?.addEventListener('change', () => {
    if (toggle.checked) rect.addTo(map); else rect.removeFrom(map);
  });

  // 범례
  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'legend');
    const cats = categories.map(c => `<li>${c}</li>`).join('');
    div.innerHTML = `<h3>Categories</h3><ul>${cats}</ul>`;
    return div;
  };
  legend.addTo(map);
})();
