# Game Map (Leaflet + GitHub Pages)

게임 전용 이미지(픽셀 좌표) 위에 핀/팝업/검색/카테고리 토글을 제공하는 **정적 사이트** 템플릿입니다.

## 빠른 시작
1) `assets` 폴더에 `map.png` 를 넣으세요. 원본 이미지 크기를 `js/app.js` 맨 위 `imgWidth`, `imgHeight`에 맞게 설정하세요.
2) 아래 방법으로 GitHub에 푸시 후 Pages를 켜면 곧바로 웹에서 볼 수 있습니다.

## 폴더 구조
```
.
├─ index.html          # 진입점
├─ css/style.css       # UI 스타일
├─ js/app.js           # 지도 로직(Leaflet CRS.Simple)
├─ data/markers.json   # 핀 데이터(이름/좌표/태그 등)
├─ assets/map.png      # (직접 추가) 게임 맵 이미지
└─ .github/workflows/pages.yml  # GitHub Pages 배포 워크플로우
```

### 마커 데이터 포맷
```json
[
  { "name": "보스 방", "pos": [4200, 3100], "type": "boss", "note": "주간 리젠", "tags": ["weekly","danger"], "emoji":"👹" }
]
```
- 좌표는 `[y, x]` 순서(Leaflet의 [lat, lng] 에 대응) 입니다.
- `type` 값이 레이어 그룹(토글 항목)으로 만들어집니다.
- `emoji`를 바꾸면 마커 얼굴이 바뀝니다.

## GitHub Pages 배포
- 이 레포에는 **GitHub Actions** 워크플로우(`.github/workflows/pages.yml`)가 포함되어 있습니다.
- 레포를 만든 뒤 **Settings → Pages → Source: GitHub Actions** 로 설정하세요.
- 변경사항을 푸시하면 자동으로 Pages가 업데이트됩니다.

## 라이선스
MIT
