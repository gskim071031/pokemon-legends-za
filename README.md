# Game Map (Leaflet + GitHub Pages)

게임 전용 이미지(픽셀 좌표) 위에 핀/팝업/검색/카테고리 토글을 제공하는 **정적 사이트** 템플릿입니다.

## TODO
- [ ] 마커 텍스트 마진 조정
- [ ] 검색 세분화
- [ ] 태그 세분화
- [ ] UI 크기
- [ ] 범위 마커
- [ ] 지도 여러개

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
