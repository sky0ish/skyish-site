# 침수흔적도 × 반지하 — 데이터 만들기

`pictures.html` 의 게시물 **[침수흔적도와 반지하]** → `flood-basement.html` 이 읽는 자료를 만드는 코드입니다.
사이트 배포에는 포함되지 않습니다(`netlify.toml` 에서 `/tools/*` 는 404).

## 만들어지는 파일

| 파일 | 내용 |
|---|---|
| `assets/data/flood/basement-points.json` | 반지하 좌표(정수 인코딩) — 출처와 무관하게 1개 |
| `assets/data/flood/source-mois.json` | 행정안전부 침수흔적도 폴리곤 + 내/외 플래그 + 통계 |
| `assets/data/flood/source-safemap.json` | 경기도 배포 SHP 기준 같은 내용 |
| `assets/data/flood/gg-ref-layers.json` | 지도 ②의 참고 레이어(경기 재해위험 구역) |
| `assets/img/flood-basement-cover.jpg` | 게시물 커버(지도+파이) |
| `assets/img/flood-basement-card.jpg` | 목록 카드 썸네일 |

지도 ②(침수심·시기별 레이어)는 **별도 자료를 쓰지 않습니다.** 지도 ①이 읽은
`source-<src>.json` 의 경기도 폴리곤을 브라우저에서 침수심/연도 구간으로 나눠 그립니다.

`source-<src>.json` 에는 지도 ②용으로 다음이 함께 들어갑니다.

| 키 | 내용 |
|---|---|
| `bandSpec` | 구간 정의(라벨·색). 파이썬과 자바스크립트가 같은 정의를 공유하도록 서버에서 내보냅니다 |
| 폴리곤 속성 `db` / `yb` | 각 침수구역이 속한 침수심 / 시기 구간 번호 |
| `bandFlags` | 반지하 점마다 걸린 구간 번호 한 글자(`.` = 흔적도 밖). 켠 구간만으로 비율을 즉시 다시 셉니다 |
| `byBand` | 구간별 반지하 수 |

한 점이 여러 침수구역에 걸치면 **더 깊은 쪽 / 더 최근 쪽**을 대표 구간으로 삼습니다.
그래서 모든 구간을 켜면 지도 ②의 합계가 지도 ①의 `inside` 와 정확히 일치합니다.

## 원본 자료

| | 경로 |
|---|---|
| 반지하 추정치 (135,847호) | `D:\0.DATA\4.반지하\건축물대장_층별개요\SHP\반지하추정치_GG_wgs.shp` |
| 침수우려 실태조사 (9,494호) | `D:\0.DATA\4.반지하\1_경기도침수데이터_건축디자인과\SHP\반지하침수데이터_건축디자인과_wgs.shp` |
| 침수흔적도 ① 행정안전부 | safetydata.go.kr OpenAPI `DSSP-IF-00117` (재난안전데이터공유플랫폼) |
| 침수흔적도 — 원 계보 | safemap.go.kr `objtId=212`, WMS 레이어 `A2SM_FLUDMARKS` / 스타일 `A2SM_FludMarks`.<br>`3_MAP/1_침수흔적도_반지하/5.침수흔적도/침수피해도_API_arcmap연동.ipynb` 가 쓰던 경로.<br>래스터(WMS)라 포함관계 판정 불가 + 저장된 인증키 만료. 페이지 '자료 출처'에 계보로 기록. |
| 침수흔적도 ② 경기도 SHP | 내려받은 파일 경로를 `--shp` 로 지정 |
| 참고 — 자연재해 위험개선지구(경기) | `D:/0.GIS/1GIS_침수흔적도/202308_자연재해_재해위험지구/자연재해_재해위험지구_경기` |
| 참고 — 급경사지 붕괴위험지역(경기) | `D:/0.GIS/1GIS_침수흔적도/202308_급경사재해예방_붕괴위험지역/급경사재해예방_붕괴위험지역-경기` |

경로가 바뀌면 `build_flood_basement.py` 위쪽 `DATASETS` 를 고치세요.

## 실행

```bash
pip install geopandas pyogrio shapely pandas matplotlib pillow
```

### ① 행정안전부 침수흔적도 (API)

```bash
python tools/flood/fetch_mois_flood.py
```

인증키는 소스에 넣지 말고 환경변수로 넘깁니다 (PowerShell: `$env:SAFETYDATA_KEY = "..."`).
전국 약 38,000건을 1,000건씩 39회 호출해 `tools/flood/cache/mois_flood_raw.json` 에 저장합니다.
**일일 호출 한도가 100회**이므로 한 번 받아 두고 캐시를 재사용하세요.

```bash
python tools/flood/build_flood_basement.py --src mois
python tools/flood/make_cover.py mois
python tools/flood/build_gg_ref_layers.py     # 지도 ② 참고 레이어 (한 번만)
```

### ② 경기도 침수흔적도 SHP

```bash
python tools/flood/build_flood_basement.py --src safemap --shp "D:/받은경로/침수흔적도.shp" --label "경기도 침수흔적도 (2023 배포)" --skip-points
```

`--skip-points` 는 반지하 좌표 파일을 다시 쓰지 않는다는 뜻입니다(①에서 이미 만들었으므로).

## 판정 방법

지오코딩된 반지하 좌표가 침수흔적 폴리곤 **안에 들어가는지**(point-in-polygon)로만 판정합니다.
좌표계는 EPSG:5179(UTM-K)로 맞춘 뒤 **단순화하지 않은 원본 폴리곤**으로 계산합니다.
표시용 폴리곤만 8 m 허용오차로 단순화하고 좌표를 소수 5자리로 줄이며, 이 과정에서
1 m 미만의 아주 작은 조각 2개가 빠져 화면 표시는 6,728개(판정은 6,730개 전부)입니다.
