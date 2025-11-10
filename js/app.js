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

  // 맵 초기화/fitBounds 이후 아무 곳에
  const uiPanel = document.querySelector('.ui-panel');
  if (uiPanel) {
    L.DomEvent.disableClickPropagation(uiPanel); // 패널 안 클릭/스크롤이 맵에 전달되지 않게
  }

  // 헤더 실제 높이를 읽어서 CSS 변수로 반영 (헤더가 1줄/2줄이어도 정확히 맞춤)
  const headerEl = document.querySelector('.header');
  const headerH = headerEl ? Math.round(headerEl.getBoundingClientRect().height) : 92;
  document.documentElement.style.setProperty('--header-h', `${headerH}px`);

  // 기본 줌 버튼을 bottomright로 추가
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // 경계(디버그 가이드라인)
  const rect = L.rectangle(bounds, { className: 'bounds-rect' });  // 기본값: 체크박스 꺼짐 → 초기에는 추가하지 않음
  const toggle = document.getElementById('toggle-bounds');         // 토글 엘리먼트
  if (toggle && toggle.checked) rect.addTo(map);                   // 초기 상태 반영 (기본 꺼짐이므로 보통은 실행되지 않음)
  toggle?.addEventListener('change', () => {                       // 변화 시 반영
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
  // 그룹(큰 분류) + 카테고리(소분류) + 전체 토글 패널
  // ===============================
  
  // 1) 그룹/카테고리 수집
  const catByGroup = new Map(); // group -> Set(categories)
  markers.forEach(m => {
    const g = m.group || '기타';
    if (!catByGroup.has(g)) catByGroup.set(g, new Set());
    catByGroup.get(g).add(m.type);
  });
  
  // 2) 패널 클래스
  const GroupPanel = L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd: function () {
      const div = L.DomUtil.create('div', 'legend-panel');
  
      // 전체 토글
      let html = `
        <div class="panel-row panel-head">
          <label class="chk">
            <input type="checkbox" data-role="master" checked>
            전체
          </label>
        </div>
      `;
  
      // 그룹별 섹션
      for (const [g, catsSet] of catByGroup) {
        const cats = [...catsSet].sort();
        html += `
          <div class="panel-group">
            <div class="panel-row">
              <label class="chk">
                <input type="checkbox" data-role="group" data-group="${g}" checked>
                ${g}
              </label>
            </div>
            <ul>
              ${cats.map(c => `
                <li>
                  <label class="chk">
                    <input type="checkbox" data-role="cat" data-group="${g}" data-cat="${c}" checked>
                    ${c}
                  </label>
                </li>
              `).join('')}
            </ul>
          </div>
        `;
      }
  
      div.innerHTML = html;
      // 패널 내 이벤트가 맵으로 전파되지 않게
      L.DomEvent.disableScrollPropagation(div);
      L.DomEvent.disableClickPropagation(div);
      return div;
    }
  });
  
  const groupPanel = new GroupPanel().addTo(map);
  
  // 3) 유틸: 레이어 on/off
  function setCategoryVisible(cat, visible) {
    const grp = layers.get(cat);
    if (!grp) return;
    if (visible) grp.addTo(map);
    else grp.removeFrom(map);
  }
  
  // 4) 상태 반영 도우미들(✔/—/□)
  function updateGroupState(g) {
    const catCbs = [...document.querySelectorAll(`input[data-role="cat"][data-group="${g}"]`)];
    const groupCb = document.querySelector(`input[data-role="group"][data-group="${g}"]`);
    if (!groupCb || catCbs.length === 0) return;
    const checkedCnt = catCbs.filter(cb => cb.checked).length;
    groupCb.indeterminate = checkedCnt > 0 && checkedCnt < catCbs.length;
    groupCb.checked = checkedCnt === catCbs.length;
  }
  
  function updateMasterState() {
    const groupCbs = [...document.querySelectorAll(`input[data-role="group"]`)];
    const master = document.querySelector(`input[data-role="master"]`);
    const checkedCnt = groupCbs.filter(cb => cb.checked && !cb.indeterminate).length;
    const allCnt = groupCbs.length;
    // master는 "모든 그룹이 전부 on"이면 체크, 일부면 indeterminate
    master.indeterminate = checkedCnt > 0 && checkedCnt < allCnt;
    master.checked = checkedCnt === allCnt;
  }
  
  // 5) 이벤트 바인딩
  // 5-1) 카테고리 체크 → 해당 레이어 on/off, 그룹/마스터 상태 갱신
  document.querySelectorAll('input[data-role="cat"]').forEach(cb => {
    cb.addEventListener('change', e => {
      const cat = e.target.getAttribute('data-cat');
      setCategoryVisible(cat, e.target.checked);
      const g = e.target.getAttribute('data-group');
      updateGroupState(g);
      updateMasterState();
    });
  });
  
  // 5-2) 그룹 체크 → 소속 카테고리 일괄 on/off
  document.querySelectorAll('input[data-role="group"]').forEach(cb => {
    cb.addEventListener('change', e => {
      const g = e.target.getAttribute('data-group');
      const catCbs = document.querySelectorAll(`input[data-role="cat"][data-group="${g}"]`);
      catCbs.forEach(catCb => {
        if (catCb.checked !== e.target.checked) {
          catCb.checked = e.target.checked;
          const cat = catCb.getAttribute('data-cat');
          setCategoryVisible(cat, catCb.checked);
        }
      });
      updateGroupState(g);
      updateMasterState();
    });
  });
  
  // 5-3) 마스터 체크 → 모든 그룹/카테고리 일괄 on/off
  const masterCb = document.querySelector('input[data-role="master"]');
  masterCb?.addEventListener('change', e => {
    const checked = e.target.checked;
    // 그룹
    document.querySelectorAll('input[data-role="group"]').forEach(gcb => {
      gcb.indeterminate = false;
      gcb.checked = checked;
    });
    // 카테고리
    document.querySelectorAll('input[data-role="cat"]').forEach(ccb => {
      if (ccb.checked !== checked) {
        ccb.checked = checked;
        const cat = ccb.getAttribute('data-cat');
        setCategoryVisible(cat, checked);
      }
    });
    updateMasterState();
  });
  
  // 초기 indeterminate 정돈
  for (const [g] of catByGroup) updateGroupState(g);
  updateMasterState();
  
  // 패널 생성/표시
  const combinedPanel = new CombinedPanel().addTo(map);

  // 패널(범례+선택창) 안에서 휠/클릭 이벤트가 맵으로 전달되지 않게
  const stopEls = document.querySelectorAll('.legend-panel, .ui-panel');
  stopEls.forEach(el => {
    if (!el) return;
    L.DomEvent.disableScrollPropagation(el); // 휠 스크롤 막기 (맵 확대/축소 방지)
    L.DomEvent.disableClickPropagation(el);  // 클릭/드래그 전파도 차단
  });
  
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
