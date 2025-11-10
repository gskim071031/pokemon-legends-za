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
    wheelPxPerZoomLevel: 120,
    zoomControl: false         // 기본 줌 컨트롤 끄기 (나중에 수동 추가)
  });

  // 이미지 경계: [ [top, left], [bottom, right] ] = [ [0,0], [imgHeight, imgWidth] ]
  const bounds = [[0, 0], [imgHeight, imgWidth]];

  // 이미지 오버레이
  const overlay = L.imageOverlay(mapImage, bounds, { opacity: 1.0 });
  overlay.addTo(map);
  map.fitBounds(bounds);

  // 기본 줌 버튼을 bottomright로 추가
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // 경계(디버그 가이드라인)
  const rect = L.rectangle(bounds, { className: 'bounds-rect' });
  // 기본값: 체크박스 꺼짐 → 초기에는 추가하지 않음
  
  // 토글 엘리먼트
  const toggle = document.getElementById('toggle-bounds');
  
  // 초기 상태 반영 (기본 꺼짐이므로 보통은 실행되지 않음)
  if (toggle && toggle.checked) {
    rect.addTo(map);
  }
  
  // 변경 시 반영
  toggle?.addEventListener('change', () => {
    if (toggle.checked) rect.addTo(map);
    else rect.removeFrom(map);
  });

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

  // 현재 배율 표시 컨트롤
  const zoomDisplay = L.control({ position: 'bottomright' });
  
  zoomDisplay.onAdd = function () {
    const div = L.DomUtil.create('div', 'zoom-display');
    const zoom = map.getZoom();
    const scale = Math.pow(2, zoom);  // 로그 스케일 → 실제 배율
    div.innerHTML = `×${scale.toFixed(2)}`;
    return div;
  };
  
  zoomDisplay.addTo(map);
  
  // 줌이 바뀔 때마다 갱신
  map.on('zoomend', () => {
  const zoom = map.getZoom();
  const scale = Math.pow(2, zoom);  // 로그 스케일 → 실제 배율
  document.querySelector('.zoom-display').innerHTML =
    `×${scale.toFixed(2)}`;
  });

  // ===============================
  // 범례(레이아웃) + 선택창(기능) 통합 패널
  // ===============================
  const CombinedPanel = L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd: function () {
      const div = L.DomUtil.create('div', 'legend-panel');
      // 레이아웃은 범례 스타일
      let html = '<h3>Categories</h3><ul>';
      categories.forEach(cat => {
        // 기능은 선택창(체크박스)로
        html += `
          <li>
            <label>
              <input type="checkbox" data-cat="${cat}" checked>
              ${cat}
            </label>
          </li>`;
      });
      html += '</ul>';
      div.innerHTML = html;
  
      // 패널 클릭이 맵 드래그/줌에 영향 주지 않도록
      L.DomEvent.disableClickPropagation(div);
      return div;
    }
  });
  
  // 패널 생성/표시
  const combinedPanel = new CombinedPanel().addTo(map);
  
  // 체크박스 → 레이어 on/off
  document
    .querySelectorAll('.legend-panel input[type="checkbox"]')
    .forEach(cb => {
      cb.addEventListener('change', (e) => {
        const cat = e.target.getAttribute('data-cat');
        const group = layers.get(cat);
        if (!group) return;
        if (e.target.checked) group.addTo(map);
        else group.removeFrom(map);
      });
    });
  
})();
