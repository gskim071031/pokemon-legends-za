# Pokémon Legends Z-A Interactive Map

> **Pokémon Legends: Z-A**를 위한 **인터랙티브 맵(Interactive Map)** 프로젝트 \
> 메인 맵과 서브 맵, 핀/구역 마커, 태그 검색, 다국어 등 기능 지원

[사이트 링크](https://gskim071031.github.io/Pokemon-Legends-ZA/)

---

## 주요 기능

| 기능               | 설명                                     |
|:------------------:|:-----------------------------------------|
| **맵 전환**        | 메인 맵과 3개의 서브 맵 전환              |
| **핀/구역 마커**   | 핀과 다각형/원형 구역 마커                |
| **마커 검색**      | 이름, 노트, 태그별 검색                   |
| **다중 태그 검색** | 다중 태그 검색, 논리식 지원               |
| **자동 완성**      | 태그 입력 시 자동 제안 및 자동 완성 선택  |
| **다국어(i18n)**   | JSON 기반 번역 파일로 언어별 UI 전환      |
| **좌표 표시**      | 마우스 커서 좌표 표시 (핀 추가 시 참고용) |
| **카테고리 패널**  | 마커 그룹별 토글 가능                     |
| **배율 표시**      | 우하단에 현재 배율 표시                   |
| **커스터마이징**   | 다른 게임으로 커스터마이징 가능           |

---

## 프로젝트 구조

```
pokemon-legends-za/
│
├─ README.md                  # 프로젝트 설명 마크다운 (현재 문서)
├─ index.html                 # 메인 페이지 (UI 구성)
│
├─ assets/
│  ├─ main.png                # 메인 맵 이미지
│  ├─ sub1.png                # 서브 맵 1 이미지
│  ├─ sub2.png                # 서브 맵 2 이미지
│  ├─ sub3.png                # 서브 맵 3 이미지
│  └─ za_icon.webp            # 사이트 파비콘
│
├─ css/
│  └─ style.css               # 스타일 시트
│
├─ data/
│  ├─ markers_main.json       # 메인 맵 마커 데이터
│  ├─ markers_sub1.json       # 서브 맵 1 마커 데이터
│  ├─ markers_sub2.json       # 서브 맵 2 마커 데이터
│  ├─ markers_sub3.json       # 서브 맵 3 마커 데이터
│  └─ i18n/
│      └─ default.json        # 기본 언어 UI
│
└─ js/
   └─ app.js                  # 전체 기능 구현 (Leaflet 기반)
```

---

## 데이터 구조

### JSON 마커 데이터

#### 핀 마커
```
{
  "name": marker_name,

  "shape": "point",
  "pos": [x, y],
  "emoji": emoji,

  "group": group_name,
  "type": type_name,
  "note": note_content,
  "tags": [tag_name, ...]
}
```

#### 다각형 구역 마커
```
{
  "name": marker_name,

  "shape": "area",
  "area": "polygon",
  "poly": [[x, y], ...],
  "emoji": emoji,
  "stroke": "hex_color_code",
  "fill": "hex_color_code",
  "fillOpacity": opacity,
  "weight": weight,

  "group": group_name,
  "type": type_name,
  "note": note_content,
  "tags": [tag_name, ...]
}
```

#### 원형 구역 마커
```
{
  "name": marker_name,

  "shape": "area",
  "area": "circle",
  "center": [x, y],
  "radius": radius,
  "emoji": emoji,
  "stroke": "hex_color_code",
  "fill": "hex_color_code",
  "fillOpacity": opacity,
  "weight": weight,

  "group": group_name,
  "type": type_name,
  "note": note_content,
  "tags": [tag_name, ...]
}
```

---

## 다국어(i18n)

`data/i18n/default.json` 파일로 UI 텍스트 관리

새 언어 추가 시 `data/i18n/<언어코드>.json` 추가 
`js/app.js` 파일 내 `LANG` 변수를 해당 언어 코드로 설정

---

## 기술 스택

- **Leaflet.js** – 맵 인터랙션 엔진  
- **Vanilla JS** – 순수 자바스크립트로 UI/기능 구현  
- **CSS (Flex + Grid)** – 반응형 인터페이스  
- **i18n JSON** – 다국어 번역 관리  
- **GitHub Pages** – 정적 호스팅

---

## 개발자 가이드

| 항목             | 설명                                                |
|:----------------:|:----------------------------------------------------|
| **마커 추가**    | `data/markers_*.json`에 새 항목 추가 후 새로고침     |
| **맵 추가**      | `assets`에 이미지 추가 → `MAPS` 객체에 정의          |
| **언어 추가**    | `data/i18n/<언어코드>.json` 추가 후 `LANG` 변수 수정 |
| **아이콘 변경**  | `<link rel="icon" href="assets/favicon.png">` 변경  |
| **탭 제목 변경** | `index.html`의 `<title>` 수정                       |

---

## 라이선스
이 프로젝트는 **비상업적 개인 연구/게임 보조용**으로 제작되었습니다.  
Pokémon 및 관련 저작권은 Nintendo / Game Freak / The Pokémon Company에 귀속됩니다.

