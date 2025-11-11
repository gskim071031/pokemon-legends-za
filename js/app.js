/* app.js (all-in-one) */
'use strict';

/* ===========================
   0) 전역 설정/참조
   =========================== */
const LANG = 'default';          // 기본 언어 (필요시 'en' 등으로)
let I18N = {};              // i18n 사전
let collator;               // 로케일 정렬기

// 맵/레이어 전역 참조
let map;                    // L.Map
let overlay = null;         // 이미지 오버레이
let rect = null;            // 경계선(Rectangle)
let layers = new Map();     // type → L.LayerGroup
let markers = [];           // [{...s, marker, shapeLayer}]
let groupPanel = null;      // 왼쪽 아래 카테고리 패널
let TAGS = [];              // 태그 자동완성 소스

// 여러 맵 구성 (경로/크기 네 리소스에 맞춰 수정)
const MAPS = {
  main: { key:'main', labelKey:'maps.main', img:'assets/main.png', width:6144, height:6144, markers:'data/markers_main.json' },
  sub1: { key:'sub1', labelKey:'maps.sub1', img:'assets/sub1.png', width:2304, height:2304, markers:'data/markers_sub1.json' },
  sub2: { key:'sub2', labelKey:'maps.sub2', img:'assets/sub2.png', width:2304, height:2304, markers:'data/markers_sub2.json' },
  sub3: { key:'sub3', labelKey:'maps.sub3', img:'assets/sub3.png', width:2304, height:2304, markers:'data/markers_sub3.json' }
};
let ACTIVE_MAP = MAPS.main;

/* ===========================
   1) i18n
   =========================== */
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

/* ===========================
   2) 공통 유틸: 아이콘/팝업/스타일
   =========================== */
const EMOJI_BOX = 24;
const EMOJI_FONT = 20;
function icon(emoji) {
  return L.divIcon({
    className: 'emoji-pin',
    html: `<div class="emoji-box" style="font-size:${EMOJI_FONT}px">${emoji}</div>`,
    iconSize: [EMOJI_BOX, EMOJI_BOX],
    iconAnchor: [Math.round(EMOJI_BOX/2), Math.round(EMOJI_BOX/2)]
  });
}
function makePopupHtml(s) {
  return `
    <div class="gm-popup">
      <div class="gm-popup-title">${s.name}</div>
      ${s.note ? `<div class="gm-popup-note">${s.note}</div>` : ``}
      ${(s.tags && s.tags.length)
        ? `<div class="gm-popup-tags">
             ${s.tags.map(t => `<span class="tag">${t}</span>`).join('')}
           </div>` : ``}
    </div>`;
}
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
function dimShape(layer, show, s) {
  if (!layer) return;
  const base = shapeStyleOf(s);
  if (show) {
    layer.setStyle({ color: base.color, fillColor: base.fillColor, opacity: 0.9, fillOpacity: base.fillOpacity, weight: base.weight });
  } else {
    layer.setStyle({ color: base.color, fillColor: base.fillColor, opacity: 0.3, fillOpacity: Math.max(0.04, (base.fillOpacity||0.18)*0.35), weight: base.weight });
  }
}

/* ===========================
   3) 태그: 파서(AND/OR/NOT,( )) + 자동완성
   =========================== */
// 파서
function tokenize(expr) {
  return expr
    .replace(/\(/g, ' ( ')
    .replace(/\)/g, ' ) ')
    .trim()
    .split(/\s+/)
    .map(t => t.toLowerCase())
    .filter(Boolean);
}
function parseExpr(tokens) { // E = T (OR T)*
  let [node, rest] = parseTerm(tokens);
  while (rest[0] === 'or') {
    const [rhs, rest2] = parseTerm(rest.slice(1));
    node = { op:'or', a:node, b:rhs };
    rest = rest2;
  }
  return [node, rest];
}
function parseTerm(tokens) { // T = F (AND F)* ; AND 생략 허용
  let [node, rest] = parseFactor(tokens);
  while (rest.length && rest[0] !== ')' && rest[0] !== 'or') {
    if (rest[0] === 'and') rest = rest.slice(1);
    const [rhs, rest2] = parseFactor(rest);
    node = { op:'and', a:node, b:rhs };
    rest = rest2;
  }
  return [node, rest];
}
function parseFactor(tokens) { // F = (NOT)* P
  let notCnt = 0;
  while (tokens[0] === 'not') { notCnt++; tokens = tokens.slice(1); }
  let [node, rest] = parsePrimary(tokens);
  if (notCnt % 2 === 1) node = { op:'not', a:node };
  return [node, rest];
}
function parsePrimary(tokens) { // P = '(' E ')' | TAG
  if (!tokens.length) return [{op:'lit', tag:''}, tokens];
  const tkn = tokens[0];
  if (tkn === '(') {
    const [node, rest] = parseExpr(tokens.slice(1));
    return rest[0] === ')' ? [node, rest.slice(1)] : [node, rest];
  }
  if (tkn === ')' || tkn === 'and' || tkn === 'or' || tkn === 'not') {
    return [{op:'lit', tag:''}, tokens.slice(1)];
  }
  return [{op:'lit', tag:tkn}, tokens.slice(1)];
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

// 자동완성 (한 번만 바인딩)
let suggestIdx = -1;
const tagInput  = document.getElementById('search-tags');
const suggestEl = document.getElementById('tag-suggest');

function getCurrentTokenInfo() {
  const val = tagInput.value;
  const pos = tagInput.selectionStart ?? val.length;
  const left  = val.slice(0, pos);
  const right = val.slice(pos);
  const L = left.match(/([^\s()]+)$/);
  const R = right.match(/^([^\s()]*)/);
  const start = L ? pos - L[1].length : pos;
  const end   = pos + (R ? R[1].length : 0);
  const token = val.slice(start, end);
  return { token, start, end, pos, val };
}
function replaceCurrentToken(text) {
  const { start, end, val } = getCurrentTokenInfo();
  tagInput.value = val.slice(0, start) + text + val.slice(end);
  const newPos = start + text.length;
  tagInput.setSelectionRange(newPos, newPos);
  renderSuggest();
}
function renderSuggest(showAll = false) {
  if (!tagInput) return;
  const q = (getCurrentTokenInfo().token || '').toLowerCase();
  let items = [];
  if (showAll || !q) {
    items = TAGS.slice(0, 200);
  } else if (!['and','or','not','(',')'].includes(q)) {
    items = TAGS.filter(t => t.toLowerCase().startsWith(q)).slice(0, 50);
  }
  if (!items.length) { 
    suggestEl.style.display='none'; 
    suggestEl.innerHTML=''; 
    suggestIdx=-1; 
    return; 
  }
  const withSelected = !(showAll || !q);
  suggestEl.innerHTML = items.map((t,i)=>
    `<li role="option" data-value="${t}" ${withSelected && i===0 ? 'aria-selected="true"' : ''}>${t}</li>`
  ).join('');
  suggestEl.style.display = 'block';
  suggestIdx = withSelected ? 0 : -1;
}
function updateHighlight(nextIdx) {
  const li = [...suggestEl.querySelectorAll('li')];
  if (!li.length) return;
  suggestIdx = (nextIdx + li.length) % li.length;
  li.forEach((el,i)=> el.setAttribute('aria-selected', i===suggestIdx?'true':'false'));
}
function bindTagInputOnce() {
  if (bindTagInputOnce.done) return;
  bindTagInputOnce.done = true;

  suggestEl.addEventListener('click', (e) => {
    const li = e.target.closest('li'); if (!li) return;
    replaceCurrentToken(li.dataset.value);
    suggestEl.style.display = 'none';
  });
  tagInput.addEventListener('keydown', (e) => {
    const open = suggestEl.style.display === 'block';
    if (e.key === 'ArrowDown' && open) { 
      e.preventDefault(); 
      updateHighlight((suggestIdx < 0 ? 0 : suggestIdx + 1)); 
    }
    else if (e.key === 'ArrowUp' && open) { 
      e.preventDefault();
      updateHighlight((suggestIdx < 0 ? 0 : suggestIdx - 1));
    }
    else if ((e.key === 'Tab' || e.key === 'Enter') && open) {
      const li = suggestEl.querySelector('li[aria-selected="true"]');
      if (li) {
        e.preventDefault();
        replaceCurrentToken(li.dataset.value);
        suggestEl.style.display = 'none';
        if (e.key === 'Enter') applySearch();
      } else {
        // 선택이 없으면 자동완성 금지: Enter는 필터만 적용(또는 무시)
        if (e.key === 'Enter') {
          e.preventDefault();
          applySearch();      // 필요 없으면 이 줄 지워도 됨(Enter 무시)
        }
      }
    } else if (e.key === 'Escape') {
      suggestEl.style.display = 'none';
    } else if (e.key === 'Enter') {
      const empty = (tagInput.value.trim() === '');
      if (!open && empty) {
        e.preventDefault();
        applySearch();            // 모든 마커 다시 표시
        renderSuggest(true);      // 모든 태그 목록 열기
      }
    }
  });
  tagInput.addEventListener('input', () => {
    const empty = (tagInput.value.trim() === '');
    renderSuggest(empty);        // 비었으면 전체 태그
  });
  tagInput.addEventListener('focus', () => {
    if (tagInput.value.trim() === '') renderSuggest(true);
  });
  tagInput.addEventListener('blur', () => setTimeout(()=> suggestEl.style.display='none', 150));
  L.DomEvent.disableScrollPropagation(suggestEl);
  L.DomEvent.disableClickPropagation(suggestEl);
}

/* ===========================
   4) 검색(이름/노트/태그)
   =========================== */
function applySearch() {
  const qName = (document.getElementById('search-name')?.value || '').trim().toLowerCase();
  const qNote = (document.getElementById('search-note')?.value || '').trim().toLowerCase();
  const qTags = (document.getElementById('search-tags')?.value || '').trim();

  const hasName = !!qName, hasNote = !!qNote, hasTags = !!qTags;
  let ast = null;
  if (hasTags) { try { const tokens = tokenize(qTags); [ast] = parseExpr(tokens); } catch (_) { ast = null; } }

  if (!hasName && !hasNote && !hasTags) {
    markers.forEach(m => { m.marker.setOpacity(1); dimShape(m.shapeLayer, true, m); });
    return;
  }
  markers.forEach(m => {
    const nameOk = !hasName || (m.name || '').toLowerCase().includes(qName);
    const noteOk = !hasNote || (m.note || '').toLowerCase().includes(qNote);
    const tagOk  = !hasTags || evalAst(ast, new Set(m.tags || []));
    const show = nameOk && noteOk && tagOk;
    m.marker.setOpacity(show ? 1 : 0.15);
    dimShape(m.shapeLayer, show, m);
  });
}
document.getElementById('search-name')?.addEventListener('keydown', e => { if (e.key === 'Enter') applySearch(); });
document.getElementById('search-note')?.addEventListener('keydown', e => { if (e.key === 'Enter') applySearch(); });

/* ===========================
   5) 카테고리 패널 핸들러
   =========================== */
function bindCategoryPanelHandlers() {
  // 개별 카테고리 on/off
  document.querySelectorAll('input[data-role="cat"]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const cat = e.target.getAttribute('data-cat');
      const g = e.target.getAttribute('data-group');
      const grp = layers.get(cat);
      if (grp) { e.target.checked ? grp.addTo(map) : grp.removeFrom(map); }
      updateGroupState(g);
      updateMasterState();
    });
  });

  // 그룹 on/off
  document.querySelectorAll('input[data-role="group"]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const g = e.target.getAttribute('data-group');
      const catCbs = document.querySelectorAll(`input[data-role="cat"][data-group="${g}"]`);
      catCbs.forEach(catCb => {
        if (catCb.checked !== e.target.checked) {
          catCb.checked = e.target.checked;
          const cat = catCb.getAttribute('data-cat');
          const grp = layers.get(cat);
          if (grp) { catCb.checked ? grp.addTo(map) : grp.removeFrom(map); }
        }
      });
      updateGroupState(g);
      updateMasterState();
    });
  });

  // 전체 on/off
  const master = document.querySelector('input[data-role="master"]');
  master?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.querySelectorAll('input[data-role="group"]').forEach(gcb => { gcb.indeterminate = false; gcb.checked = checked; });
    document.querySelectorAll('input[data-role="cat"]').forEach(ccb => {
      if (ccb.checked !== checked) {
        ccb.checked = checked;
        const cat = ccb.getAttribute('data-cat');
        const grp = layers.get(cat);
        if (grp) { checked ? grp.addTo(map) : grp.removeFrom(map); }
      }
    });
    updateMasterState();
  });

  // 상태 갱신 함수
  function updateGroupState(g) {
    const catCbs = [...document.querySelectorAll(`input[data-role="cat"][data-group="${g}"]`)];
    const groupCb = document.querySelector(`input[data-role="group"][data-group="${g}"]`);
    if (!groupCb || catCbs.length === 0) return;
    const on = catCbs.filter(cb => cb.checked).length;
    groupCb.indeterminate = on > 0 && on < catCbs.length;
    groupCb.checked = on === catCbs.length;
  }
  function updateMasterState() {
    const groupCbs = [...document.querySelectorAll(`input[data-role="group"]`)];
    const master = document.querySelector(`input[data-role="master"]`);
    const fullOn = groupCbs.filter(cb => cb.checked && !cb.indeterminate).length === groupCbs.length;
    const someOn = groupCbs.some(cb => cb.checked || cb.indeterminate);
    master.indeterminate = !fullOn && someOn;
    master.checked = fullOn;
  }

  // 초기 스냅샷
  const OTHER_GROUP = t('group.other');
  const groups = [...new Set([...document.querySelectorAll('input[data-role="group"]')].map(e => e.getAttribute('data-group')))];
  groups.sort((a,b)=> (a===OTHER_GROUP)-(b===OTHER_GROUP) || collator.compare(a,b));
  groups.forEach(g => updateGroupState(g));
  updateMasterState();
}

/* ===========================
   6) 스위처 UI
   =========================== */
function renderSwitcher() {
  const el = document.getElementById('map-switcher');
  if (!el) return;
  el.innerHTML = '';
  Object.values(MAPS).forEach(m => {
    const btn = document.createElement('button');
    btn.textContent = t(m.labelKey);
    btn.dataset.mapKey = m.key;
    if (m.key === ACTIVE_MAP.key) btn.classList.add('active');
    btn.addEventListener('click', () => loadMap(m.key));
    el.appendChild(btn);
  });
  L.DomEvent.disableScrollPropagation(el);
  L.DomEvent.disableClickPropagation(el);
}

/* ===========================
   7) 맵 로더 (핵심)
   =========================== */
async function loadMap(mapKey) {
  ACTIVE_MAP = MAPS[mapKey] || MAPS.main;

  // 스위처 하이라이트
  document.querySelectorAll('#map-switcher button').forEach(b => {
    b.classList.toggle('active', b.dataset.mapKey === ACTIVE_MAP.key);
  });

  // 기존 정리
  layers.forEach(g => g.removeFrom(map));
  layers.clear();
  markers = [];
  if (groupPanel) { map.removeControl(groupPanel); groupPanel = null; }
  if (overlay) { map.removeLayer(overlay); overlay = null; }
  if (rect)    { map.removeLayer(rect);    rect = null; }

  // 경계/오버레이 재생성
  const imgWidth  = ACTIVE_MAP.width;
  const imgHeight = ACTIVE_MAP.height;
  const bounds = [[0,0],[imgHeight,imgWidth]];

  overlay = L.imageOverlay(ACTIVE_MAP.img, bounds, { opacity: 1.0 }).addTo(map);
  rect = L.rectangle(bounds, { className: 'bounds-rect' });
  const toggle = document.getElementById('toggle-bounds');
  if (toggle?.checked) rect.addTo(map);
  map.fitBounds(bounds);

  // 좌표표시(정수)
  map.off('mousemove');
  map.on('mousemove', (e) => {
    const coordEl = document.getElementById('cursor-pos');
    if (!coordEl) return;
    const y = Math.round(e.latlng.lat), x = Math.round(e.latlng.lng);
    const inBounds = (y >= 0 && y <= imgHeight && x >= 0 && x <= imgWidth);
    // coordEl.textContent = inBounds ? t('coord.label', { y, x }) : t('coord.label', { y:'—', x:'—' });
    coordEl.textContent = t('coord.label', { y, x });
  });

  // 데이터 로드
  const spots = await fetch(ACTIVE_MAP.markers).then(r => r.json());

  // 카테고리 레이어
  const categories = [...new Set(spots.map(s => s.type))];
  categories.forEach(cat => layers.set(cat, L.layerGroup().addTo(map)));

  // 마커 생성 (핀/다각형/원)
  spots.forEach(s => {
    const group = layers.get(s.type);
    if (!group) return;

    const popupHtml = makePopupHtml(s);
    const style = shapeStyleOf(s);

    if (s.shape === 'area') {
      let shapeLayer = null, pinCenter = null;

      if (s.area === 'circle' && Array.isArray(s.center) && typeof s.radius === 'number') {
        shapeLayer = L.circle([s.center[0], s.center[1]], { ...style, radius: s.radius });
        pinCenter  = L.latLng(s.center[0], s.center[1]);
      } else if (Array.isArray(s.poly) && s.poly.length >= 3) {
        const latlngs = s.poly.map(p => [p[0], p[1]]);
        shapeLayer = L.polygon(latlngs, style);
        pinCenter  = shapeLayer.getBounds().getCenter();
      }

      if (shapeLayer) {
        shapeLayer.bindPopup(popupHtml).addTo(group);
        const pin = L.marker([pinCenter.lat, pinCenter.lng], { icon: icon(s.emoji || '📍') })
                     .bindPopup(popupHtml, { maxWidth: 420, minWidth: 280 })
                     .addTo(group);
        shapeLayer.on('click', () => pin.openPopup());
        markers.push({ ...s, marker: pin, shapeLayer });
        return;
      }
    }

    // 기본: 핀
    const pin = L.marker([s.pos[0], s.pos[1]], { icon: icon(s.emoji || '📍') })
                 .bindPopup(popupHtml, { maxWidth: 420, minWidth: 280 })
                 .addTo(group);
    markers.push({ ...s, marker: pin, shapeLayer: null });
  });

  // 태그 소스 갱신
  const allTags = new Set();
  markers.forEach(m => (m.tags || []).forEach(t => allTags.add(t)));
  TAGS = [...allTags].sort((a,b) => collator.compare(a,b));
  if (document.activeElement === tagInput) {
    renderSuggest(tagInput.value.trim() === '');
  }

  // 그룹 패널 생성 (“기타”는 항상 뒤)
  const OTHER_GROUP = t('group.other');
  const catByGroup = new Map();
  markers.forEach(m => {
    const g = m.group || OTHER_GROUP;
    if (!catByGroup.has(g)) catByGroup.set(g, new Set());
    catByGroup.get(g).add(m.type);
  });

  const GroupPanel = L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd: function () {
      const div = L.DomUtil.create('div', 'legend-panel');

      const groups = [...catByGroup.entries()];
      groups.sort((a,b) => (a[0]===OTHER_GROUP)-(b[0]===OTHER_GROUP) || collator.compare(a[0],b[0]));

      let html = `
        <div class="panel-row panel-head">
          <label class="chk"><input type="checkbox" data-role="master" checked>${t('master.all')}</label>
        </div>`;
      for (const [g, catsSet] of groups) {
        const cats = [...catsSet].sort((x,y)=>collator.compare(x,y));
        html += `
          <div class="panel-group">
            <div class="panel-row">
              <label class="chk"><input type="checkbox" data-role="group" data-group="${g}" checked>${g}</label>
            </div>
            <ul>
              ${cats.map(c => `
                <li><label class="chk"><input type="checkbox" data-role="cat" data-group="${g}" data-cat="${c}" checked>${c}</label></li>
              `).join('')}
            </ul>
          </div>`;
      }
      div.innerHTML = html;
      L.DomEvent.disableScrollPropagation(div);
      L.DomEvent.disableClickPropagation(div);
      return div;
    }
  });
  groupPanel = new GroupPanel().addTo(map);

  // 패널 동작 바인딩
  bindCategoryPanelHandlers();

  // 경계 토글(중복 방지 위해 기존 리스너 제거 후 다시)
  const b = document.getElementById('toggle-bounds');
  b?.removeEventListener?.('_toggle', ()=>{});
  b?.addEventListener('change', () => {
    if (!rect) return;
    if (b.checked) rect.addTo(map); else rect.removeFrom(map);
  });
}

/* ===========================
   8) 부트스트랩(IIFE)
   =========================== */
(async function () {
  await loadI18n();

  // UI 텍스트 주입
  document.getElementById('i-title').textContent = t('app.title');
  document.getElementById('search-name').placeholder = t('search.name.placeholder');
  document.getElementById('search-note').placeholder = t('search.note.placeholder');
  document.getElementById('search-tags').placeholder = t('search.tags.placeholder');
  document.getElementById('tag-suggest').setAttribute('aria-label', t('tags.suggest.aria'));
  document.getElementById('i-boundary-label').textContent = t('boundary.toggle');

  // 좌표 초기 문구
  const coordEl = document.getElementById('cursor-pos');
  if (coordEl) coordEl.textContent = t('coord.label', { y:'—', x:'—' });

  // 로케일 정렬기
  const LOCALE = I18N.__locale || LANG || navigator.language || 'en';
  collator = new Intl.Collator([LOCALE, 'en'], { usage:'sort', sensitivity:'base', numeric:true, ignorePunctuation:true });

  // 맵 생성
  map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -3,
    maxZoom: 4,
    zoomSnap: 0.25,
    wheelPxPerZoomLevel: 120,
    zoomControl: false,
    attributionControl: false
  });
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // 스위처/태그입력 바인딩
  renderSwitcher();
  bindTagInputOnce();

  // 첫 맵 로드
  await loadMap('main');
})();
