# Pokémon Legends Z-A Interactive Map

> **Pokémon Legends: Z-A** 오픈월드 게임을 위한 **인터랙티브 맵(Interactive Map)** 프로젝트입니다.  
> 메인 맵과 서브 맵을 전환하며, 위치 마커·구역 범위·태그 기반 검색·다국어(i18n) 지원 기능을 제공합니다.

---

## 🗺️ 주요 기능

| 기능 | 설명 |
|------|------|
| 🔁 **맵 전환** | 메인 맵 + 3개의 서브 맵을 전환할 수 있는 버튼 UI (오른쪽 중앙) |
| 📍 **핀 마커 / 구역 마커** | 개별 위치(핀) 또는 건물·영역(다각형/원형 범위) 표시 |
| 🏷️ **태그 검색** | 이름·노트·태그별 검색 가능. `and / or / not / ( )` 논리식 지원 |
| 💬 **자동완성** | 태그 입력 시 자동 제안 및 클릭/키보드 선택 지원 |
| 🌍 **다국어(i18n)** | JSON 기반 번역 파일로 언어별 UI 전환 지원 |
| 📏 **좌표 표시** | 마우스 커서 좌표를 이미지 기준으로 표시 (핀 추가 시 참고) |
| 🔎 **범례 / 카테고리 패널** | 마커 그룹별(예: 몬스터·아이템 등) 토글 가능 |
| 🔍 **줌/배율 표시** | 우하단에 현재 배율(Zoom ×n.xx) 표시 |
| 🎨 **커스터마이징 용이** | `markers_*.json`, `assets/` 이미지, `data/i18n/*.json`만 교체하면 새 맵 가능 |

---

## 🗂️ 프로젝트 구조

```
pokemon-legends-za-main/
├─ index.html                 # 메인 페이지 (UI 구성)
├─ style.css                  # 스타일 시트
├─ app.js                     # 전체 기능 구현 (Leaflet 기반)
│
├─ assets/
│  ├─ main.png                # 메인 맵 이미지
│  ├─ sub1.png                # 서브 맵 1
│  ├─ sub2.png                # 서브 맵 2
│  ├─ sub3.png                # 서브 맵 3
│  └─ favicon.png             # 사이트 파비콘
│
├─ data/
│  ├─ markers_main.json       # 메인 맵 마커 데이터
│  ├─ markers_sub1.json       # 서브 맵 1 마커
│  ├─ markers_sub2.json       # 서브 맵 2 마커
│  ├─ markers_sub3.json       # 서브 맵 3 마커
│  └─ i18n/
│      ├─ ko.json             # 한국어 UI 번역
│      └─ en.json             # 영어 UI 번역
│
└─ README.md                  # 프로젝트 설명 파일 (이 문서)
```

---

## ⚙️ 실행 방법

### 1️⃣ 로컬에서 실행
1. 프로젝트 전체를 다운로드하거나 ZIP을 해제합니다.  
2. 브라우저로 `index.html`을 직접 엽니다.  
   (Leaflet은 CDN으로 불러오기 때문에 별도 빌드/서버 필요 없음)

### 2️⃣ GitHub Pages 배포
1. 레포지토리 루트에 위 파일들을 올립니다.  
2. GitHub Pages 설정 → **Source: `main` branch / root** 선택  
3. URL: `https://<GitHubID>.github.io/<repo-name>/`

---

## 🧩 주요 데이터 구조

### 📌 마커 JSON 예시
```json
{
  "name": "보스 방",
  "pos": [4200, 3100],
  "type": "boss",
  "group": "몬스터",
  "note": "주간 리젠",
  "tags": ["weekly", "danger"],
  "emoji": "👹",
  "shape": "point"
}
```

### 📐 범위 마커 예시 (다각형/원)
```json
{
  "name": "금고 구역",
  "shape": "area",
  "area": "polygon",
  "poly": [[1800,6900],[2500,7100],[2550,7600],[1900,7500]],
  "emoji": "🧰",
  "stroke": "#3fb950",
  "fill": "#3fb950",
  "fillOpacity": 0.2,
  "weight": 2
}
```

```json
{
  "name": "보안 구역",
  "shape": "area",
  "area": "circle",
  "center": [3000, 5200],
  "radius": 350,
  "emoji": "🚨",
  "stroke": "#e11d48",
  "fill": "#e11d48",
  "fillOpacity": 0.15,
  "weight": 3
}
```

---

## 🌐 다국어(i18n)

`data/i18n/ko.json`, `data/i18n/en.json` 파일로 UI 텍스트를 관리합니다.

```json
{
  "app.title": "Pokémon Legends: ZA 맵",
  "maps.main": "메인 맵",
  "maps.sub1": "서브 맵 1",
  "maps.sub2": "서브 맵 2",
  "maps.sub3": "서브 맵 3",
  "boundary.toggle": "경계 보기",
  "coord.label": "좌표: {y}, {x}",
  "zoom.label": "배율 ×{scale}",
  "group.other": "기타"
}
```

새 언어를 추가하려면 `data/i18n/<언어코드>.json`을 추가하고  
`LANG` 변수를 해당 언어 코드로 설정합니다.

---

## 🧠 기술 스택

- **Leaflet.js** – 맵 인터랙션 엔진  
- **Vanilla JS** – 순수 자바스크립트로 UI/기능 구현  
- **CSS (Flex + Grid)** – 반응형 인터페이스  
- **i18n JSON** – 다국어 번역 관리  
- **GitHub Pages** – 정적 호스팅

---

## 🚀 개발자 가이드

| 항목 | 설명 |
|------|------|
| **마커 추가** | `data/markers_*.json`에 새 항목 추가 후 새로고침 |
| **맵 추가** | `assets`에 이미지 추가 → `MAPS` 객체에 정의 |
| **언어 추가** | `data/i18n/<언어>.json` 추가 후 `LANG` 변수 수정 |
| **아이콘 변경** | `<link rel="icon" href="assets/favicon.png">` 변경 |
| **탭 제목 변경** | `index.html`의 `<title>` 수정 |

---

## 📜 라이선스
이 프로젝트는 **비상업적 개인 연구/게임 보조용**으로 제작되었습니다.  
Pokémon 및 관련 저작권은 Nintendo / Game Freak / The Pokémon Company에 귀속됩니다.

---

## 🧑‍💻 제작자 메모
> 이 프로젝트는 GitHub Pages 환경에서 Leaflet을 이용해  
> “데이터 기반 인터랙티브 게임 맵”을 만드는 예시입니다.  
> 단일 HTML/JS/CSS로 동작하므로 별도 서버가 필요 없으며,  
> 단순히 이미지와 JSON만 교체해 다른 게임에도 재활용할 수 있습니다.
