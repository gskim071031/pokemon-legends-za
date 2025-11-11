// ===== I18N =====
const LANG = 'ko'; // 기본 언어 (스위처를 만들면 동적으로 바꾸면 됨)
let I18N = {};

async function loadI18n(lang = LANG) {
  try {
    const res = await fetch(`data/i18n/${lang}.json`);
    I18N = await res.json();
  } catch {
    I18N = {};
  }
}

function t(key, params = {}) {
  const raw = I18N[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
}


// Leaflet (CRS.Simple) interactive map for a custom game image
(async function () {
  
  await loadI18n(); // ← 번역 로드 후 아래 로직 실행
  
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

  
  // 제목/플레이스홀더/라벨 주입
  document.getElementById('i-title').textContent = t('app.title');
  document.getElementById('search-name').placeholder = t('search.name.placeholder');
  document.getElementById('search-note').placeholder = t('search.note.placeholder');
  document.getElementById('search-tags').placeholder = t('search.tags.placeholder');
  document.getElementById('tag-suggest').setAttribute('aria-label', t('tags.suggest.aria'));
  document.getElementById('i-boundary-label').textContent = t('boundary.toggle');
  
  // 좌표 초기 문구
  const coordEl = document.getElementById('cursor-pos');
  coordEl.textContent = t('coord.label', { y: '—', x: '—' });

  
  // 커서 좌표 표시 (이미지 픽셀 기준: [y, x])
  const coordEl = document.getElementById('cursor-pos');
  
  function updateCursorPos(latlng) {
    if (!coordEl) return;
    const y = latlng.lat; // CRS.Simple: lat=y, lng=x
    const x = latlng.lng;
    const inBounds = (y >= 0 && y <= imgHeight && x >= 0 && x <= imgWidth);
    // coordEl.textContent = inBounds ? t('coord.label', { y, x }) : t('coord.label', { y: '—', x: '—' });
    coordEl.textContent = t('coord.label', { y, x });
  }
  
  // 맵 위에서 마우스 움직일 때 좌표 업데이트
  map.on('mousemove', (e) => updateCursorPos(e.latlng));
  
  // 맵 밖으로 나가면 초기 상태로
  map.on('mouseout', () => {
    if (coordEl) coordEl.textContent = '좌표: — , —';
  });

  
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

  // 이모지 핀 아이콘(정중앙 정렬)
  const EMOJI_BOX = 24;   // 아이콘 박스 크기(px) → CSS와 일치해야 함
  const EMOJI_FONT = 20;  // 이모지 폰트 크기(px)
  
  const icon = (emoji) => L.divIcon({
    className: 'emoji-pin',
    html: `<div class="emoji-box" style="font-size:${EMOJI_FONT}px">${emoji}</div>`,
    iconSize: [EMOJI_BOX, EMOJI_BOX],
    iconAnchor: [Math.round(EMOJI_BOX/2), Math.round(EMOJI_BOX/2)] // 중심 기준
  });

  // 팝업 HTML 생성 함수 추가
  const makePopupHtml = (s) => `
    <div class="gm-popup">
      <div class="gm-popup-title">${s.name}</div>
      ${s.note ? `<div class="gm-popup-note">${s.note}</div>` : ``}
      ${(s.tags && s.tags.length)
        ? `<div class="gm-popup-tags">
             ${s.tags.map(t => `<span class="tag">${t}</span>`).join('')}
           </div>`
        : ``}
    </div>`;

  function shapeStyleOf(s) {
    const stroke = s.stroke || s.color || '#7aa2ff';
    return {
      className: 'area-shape',
      color: stroke,
      opacity: 0.9,
      weight: s.weight ?? 2,
      fillColor: s.fill || stroke,
      fillOpacity: (typeof s.fillOpacity === 'number') ? s.fillOpacity : 0.18
    };
  }

  // 데이터 로드
  const spots = await fetch('data/markers.json').then(r => r.json());

  // 카테고리 수집
  const categories = [...new Set(spots.map(s => s.type))];

  // 카테고리 레이어 생성
  categories.forEach(cat => layers.set(cat, L.layerGroup().addTo(map)));

  // 마커 추가
  const markers = []; // point/area 공통으로 여기 기록
  
  spots.forEach(s => {
    const layerGroup = layers.get(s.type);
    if (!layerGroup) return;
  
    const popupHtml = makePopupHtml(s);
    const style = shapeStyleOf(s);
  
    // 범위 마커
    if (s.shape === 'area') {
      let shapeLayer = null;
      let pinCenter = null;
  
      if (s.area === 'circle' && Array.isArray(s.center) && typeof s.radius === 'number') {
        // 원 (CRS.Simple이므로 radius는 px 단위)
        shapeLayer = L.circle([s.center[0], s.center[1]], { ...style, radius: s.radius });
        pinCenter = L.latLng(s.center[0], s.center[1]);
      } else if (Array.isArray(s.poly) && s.poly.length >= 3) {
        // 다각형
        const latlngs = s.poly.map(p => [p[0], p[1]]);
        shapeLayer = L.polygon(latlngs, style);
        pinCenter = shapeLayer.getBounds().getCenter();
      } else {
        // 정의가 불완전하면 포인트로 폴백
        const pin = L.marker([s.pos?.[0] ?? 0, s.pos?.[1] ?? 0], { icon: icon(s.emoji || '📍') })
                     .bindPopup(popupHtml, { maxWidth: 420, minWidth: 280 });
        layerGroup.addLayer(pin);
        markers.push({ ...s, marker: pin, shapeLayer: null });
        return;
      }
  
      // 레이어/핀 추가
      shapeLayer.bindPopup(popupHtml);
      layerGroup.addLayer(shapeLayer);
  
      const pin = L.marker([pinCenter.lat, pinCenter.lng], { icon: icon(s.emoji || '📍') })
                   .bindPopup(popupHtml, { maxWidth: 420, minWidth: 280 });
      layerGroup.addLayer(pin);
  
      // 다각형/원 클릭 시 핀 팝업 열기
      shapeLayer.on('click', () => pin.openPopup());
  
      markers.push({ ...s, marker: pin, shapeLayer });
  
    } else {
      // 핀(점) 마커
      const pin = L.marker([s.pos[0], s.pos[1]], { icon: icon(s.emoji || '📍') })
                   .bindPopup(popupHtml, { maxWidth: 420, minWidth: 280 });
      layerGroup.addLayer(pin);
      markers.push({ ...s, marker: pin, shapeLayer: null });
    }
  });
  
  // ===============================
  // 태그 자동완성 + 고급 논리 검색(AND/OR/NOT,( ))
  // ===============================
  
  // 모든 태그 수집
  const allTags = new Set();
  markers.forEach(m => (m.tags || []).forEach(t => allTags.add(t)));
  const TAGS = [...allTags].sort();
  
  const tagInput = document.getElementById('search-tags');
  const suggestEl = document.getElementById('tag-suggest');
  let suggestIdx = -1;  // 키보드 선택 인덱스
  
  // 현재 커서 기준 "편집 중 토큰" 추출
  function getCurrentTokenInfo() {
    const val = tagInput.value;
    const pos = tagInput.selectionStart ?? val.length;
    // 왼쪽으로 공백/괄호 전까지, 오른쪽으로 공백/괄호 전까지
    const left = val.slice(0, pos);
    const right = val.slice(pos);
    const leftMatch = left.match(/([^\s()]+)$/);   // 공백/괄호가 아닌 마지막 토큰
    const rightMatch = right.match(/^([^\s()]*)/);
    const start = leftMatch ? pos - leftMatch[1].length : pos;
    const end = pos + (rightMatch ? rightMatch[1].length : 0);
    const token = val.slice(start, end);
    return { token, start, end, pos, val };
  }
  
  // 토큰 치환 (자동완성 적용)
  function replaceCurrentToken(text) {
    const { start, end, val } = getCurrentTokenInfo();
    tagInput.value = val.slice(0, start) + text + val.slice(end);
    const newPos = start + text.length;
    tagInput.setSelectionRange(newPos, newPos);
    renderSuggest(); // 토큰 바뀌었으니 제안 새로고침
  }
  
  // 제안 렌더 (현재 토큰 prefix 기반)
  function renderSuggest() {
    const { token } = getCurrentTokenInfo();
    const q = (token || '').toLowerCase();
  
    // 연산자나 괄호 토큰이면 제안 숨김
    if (!q || ['and','or','not','(',')'].includes(q)) {
      suggestEl.style.display = 'none';
      suggestEl.innerHTML = '';
      suggestIdx = -1;
      return;
    }
  
    const items = TAGS.filter(t => t.toLowerCase().startsWith(q)).slice(0, 50);
    if (!items.length) {
      suggestEl.style.display = 'none';
      suggestEl.innerHTML = '';
      suggestIdx = -1;
      return;
    }
  
    suggestEl.innerHTML = items.map((t,i) =>
      `<li role="option" data-value="${t}" ${i===0?'aria-selected="true"':''}>${t}</li>`
    ).join('');
    suggestEl.style.display = 'block';
    suggestIdx = 0;
  }
  
  // 제안에서 특정 인덱스 선택 상태 업데이트
  function updateHighlight(nextIdx) {
    const li = [...suggestEl.querySelectorAll('li')];
    if (!li.length) return;
    suggestIdx = (nextIdx + li.length) % li.length;
    li.forEach((el, i) => el.setAttribute('aria-selected', i === suggestIdx ? 'true' : 'false'));
  }
  
  // 클릭으로 제안 선택
  suggestEl.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    replaceCurrentToken(li.dataset.value);
    suggestEl.style.display = 'none';
  });
  
  // 키보드: 입력/탭/화살표/엔터 처리
  tagInput.addEventListener('keydown', (e) => {
    const hasList = suggestEl.style.display === 'block';
  
    if (e.key === 'ArrowDown' && hasList) {
      e.preventDefault();
      updateHighlight(suggestIdx + 1);
    } else if (e.key === 'ArrowUp' && hasList) {
      e.preventDefault();
      updateHighlight(suggestIdx - 1);
    } else if ((e.key === 'Tab' || e.key === 'Enter') && hasList) {
      e.preventDefault();
      const li = suggestEl.querySelector('li[aria-selected="true"]');
      if (li) replaceCurrentToken(li.dataset.value);
      suggestEl.style.display = 'none';
      if (e.key === 'Enter') applySearch(); // Enter면 바로 검색
    } else if (e.key === 'Escape') {
      suggestEl.style.display = 'none';
    }
  });
  
  // 입력 변화 시 제안 갱신
  tagInput.addEventListener('input', renderSuggest);
  tagInput.addEventListener('blur', () => {
    // 포커스 아웃 시 약간의 지연 후 닫기(클릭 선택 허용)
    setTimeout(() => suggestEl.style.display = 'none', 150);
  });
  
  // 패널 내부에서 휠/클릭 전파 방지(맵 확대/드래그 방지)
  L.DomEvent.disableScrollPropagation(suggestEl);
  L.DomEvent.disableClickPropagation(suggestEl);
  
  // -------------------------------
  // 불리언 파서 (AND/OR/NOT, 괄호, 공백 AND)
  // -------------------------------
  function tokenize(expr) {
    // 괄호는 분리, 연산자는 소문자로 정규화
    const raw = expr
      .replace(/\(/g,' ( ')
      .replace(/\)/g,' ) ')
      .trim()
      .split(/\s+/)
      .map(t => t.toLowerCase());
    return raw.filter(Boolean);
  }
  
  function parseExpr(tokens) {
    // 재귀 하향식 파서: E = T (OR T)*
    let [node, rest] = parseTerm(tokens);
    while (rest[0] === 'or') {
      const [rhs, rest2] = parseTerm(rest.slice(1));
      node = { op:'or', a:node, b:rhs };
      rest = rest2;
    }
    return [node, rest];
  }
  function parseTerm(tokens) {
    // T = F (AND F)* ; AND 생략 허용(암시적 AND)
    let [node, rest] = parseFactor(tokens);
    while (rest.length && rest[0] !== ')' && rest[0] !== 'or') {
      // 'and'면 소모, 아니면 공백 AND
      if (rest[0] === 'and') rest = rest.slice(1);
      const [rhs, rest2] = parseFactor(rest);
      node = { op:'and', a:node, b:rhs };
      rest = rest2;
    }
    return [node, rest];
  }
  function parseFactor(tokens) {
    // F = (NOT)* P
    let notCnt = 0;
    while (tokens[0] === 'not') {
      notCnt++; tokens = tokens.slice(1);
    }
    let [node, rest] = parsePrimary(tokens);
    if (notCnt % 2 === 1) node = { op:'not', a:node };
    return [node, rest];
  }
  function parsePrimary(tokens) {
    // P = '(' E ')' | TAG
    if (!tokens.length) return [{op:'lit', tag:''}, tokens];
    const t = tokens[0];
    if (t === '(') {
      const [node, rest] = parseExpr(tokens.slice(1));
      if (rest[0] === ')') return [node, rest.slice(1)];
      return [node, rest]; // 괄호 짝이 안 맞아도 관대하게
    }
    if (t === ')' || t === 'and' || t === 'or' || t === 'not') {
      // 잘못된 위치의 연산자 → 빈 식
      return [{op:'lit', tag:''}, tokens.slice(1)];
    }
    return [{op:'lit', tag:t}, tokens.slice(1)];
  }
  
  function evalAst(ast, tagSet) {
    if (!ast) return true;
    switch (ast.op) {
      case 'and': return evalAst(ast.a, tagSet) && evalAst(ast.b, tagSet);
      case 'or':  return evalAst(ast.a, tagSet) || evalAst(ast.b, tagSet);
      case 'not': return !evalAst(ast.a, tagSet);
      case 'lit': return ast.tag ? tagSet.has(ast.tag) : true;
      default:    return true;
    }
  }
  
  // -------------------------------
  // applySearch() 교체: 이름/노트 + 논리 태그식
  // -------------------------------
  const DIM = 0.15;
  function dimShape(layer, show, s) {
    if (!layer) return;
    const base = shapeStyleOf(s);
    if (show) {
      layer.setStyle({ color: base.color, fillColor: base.fillColor, opacity: 0.9, fillOpacity: base.fillOpacity, weight: base.weight });
    } else {
      layer.setStyle({ color: base.color, fillColor: base.fillColor, opacity: 0.3, fillOpacity: Math.max(0.04, (base.fillOpacity||0.18) * 0.35), weight: base.weight });
    }
  }
  
  function applySearch() {
    const qName = (document.getElementById('search-name')?.value || '').trim().toLowerCase();
    const qNote = (document.getElementById('search-note')?.value || '').trim().toLowerCase();
    const qTags = (document.getElementById('search-tags')?.value || '').trim();
  
    const hasName = !!qName, hasNote = !!qNote, hasTags = !!qTags;
  
    let ast = null;
    if (hasTags) {
      try { const tokens = tokenize(qTags); [ast] = parseExpr(tokens); } catch (_) { ast = null; }
    }
  
    if (!hasName && !hasNote && !hasTags) {
      markers.forEach(m => { m.marker.setOpacity(1); dimShape(m.shapeLayer, true, m); });
      return;
    }
  
    markers.forEach(m => {
      const nameOk = !hasName || (m.name || '').toLowerCase().includes(qName);
      const noteOk = !hasNote || (m.note || '').toLowerCase().includes(qNote);
      const tagOk  = !hasTags || evalAst(ast, new Set(m.tags || []));
      const show = nameOk && noteOk && tagOk;
  
      m.marker.setOpacity(show ? 1 : DIM);
      dimShape(m.shapeLayer, show, m);
    });
  }
  
  // 이름/노트 Enter 검색 (기존처럼)
  document.getElementById('search-name')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') applySearch();
  });
  document.getElementById('search-note')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') applySearch();
  });
  // 태그 입력은 Enter로 즉시 검색
  tagInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && suggestEl.style.display !== 'block') applySearch();
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
    document.querySelector('.zoom-display').textContent = t('zoom.label', { scale: scale.toFixed(2) });
  });

  // ===============================
  // 그룹(큰 분류) + 카테고리(소분류) + 전체 토글 패널
  // ===============================
  const OTHER_GROUP = t('group.other');
  
  // 1) 그룹/카테고리 수집
  const catByGroup = new Map(); // group -> Set(categories)
  markers.forEach(m => {
    const g = m.group || OTHER_GROUP;
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
            ${t('master.all')}
          </label>
        </div>
      `;
  
      // 그룹 목록 정렬 시 "기타"를 항상 뒤로
      const groups = [...catByGroup.entries()];
      groups.sort((a, b) =>
        (a[0] === OTHER_GROUP) - (b[0] === OTHER_GROUP) ||
        a[0].localeCompare(b[0], 'ko') // 필요시 LANG 반영
      );

      // 섹션 타이틀(선택): 상단에 카테고리 제목 넣고 싶다면
      html = `<div class="panel-row panel-head"><strong>${t('categories.title')}</strong></div>` + html;
      
      for (const [g, catsSet] of groups) {
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
  for (const [g] of groups) updateGroupState(g);
  updateMasterState();

  // 패널(범례+선택창) 안에서 휠/클릭 이벤트가 맵으로 전달되지 않게
  const stopEls = document.querySelectorAll('.legend-panel, .ui-panel');
  stopEls.forEach(el => {
    if (!el) return;
    L.DomEvent.disableScrollPropagation(el); // 휠 스크롤 막기 (맵 확대/축소 방지)
    L.DomEvent.disableClickPropagation(el);  // 클릭/드래그 전파도 차단
  });

  /*
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
  */
  
})();
