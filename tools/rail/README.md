# 철도역 자료 만들기

지도(MAP)의 **철도역** 레이어가 쓰는 `assets/data/seoul-rail.json` 을 만드는 방법입니다.
서울과 그 언저리의 역 **440곳** 이 들어 있습니다 (31KB).

자료는 **OpenStreetMap** 에서 받습니다. 열쇠(API key)는 필요 없습니다.

## 다시 만들려면

```bash
# 1) OpenStreetMap 에서 받기
curl -s -X POST -H "Content-Type: text/plain" --data-binary @- \
  https://overpass-api.de/api/interpreter -o tools/rail/raw.json <<'EOF'
[out:json][timeout:120];
(
  node["railway"="station"](37.40,126.75,37.72,127.20);
  node["railway"="halt"](37.40,126.75,37.72,127.20);
);
out body;
EOF

# 2) 필요한 것만 추려 가볍게
python tools/rail/build_rail.py
```

네모(37.40,126.75 ~ 37.72,127.20)는 서울 전체와 인접 시 일부를 덮습니다.
더 넓히시려면 위 숫자를 고치고 두 단계를 다시 밟으시면 됩니다.

## 파일

| 파일 | 내용 |
|---|---|
| `raw.json` | 받은 원본 (381KB · 저장소에는 올리지 않습니다) |
| `build_rail.py` | 이름·좌표만 추려 정리 |
| `../../assets/data/seoul-rail.json` | 실제로 쓰는 자료 |

## 자료 모양

```json
[{"n":"서울역","a":37.55515,"o":126.97078,"l":"한국철도공사"}]
```

`n` 이름 · `a` 위도 · `o` 경도 · `l` 운영기관.
이름이 없거나 좌표가 없는 것, 같은 이름이 거의 같은 자리에 겹치는 것(환승역이
여러 점으로 잡히는 경우)은 걸러냅니다.

## 출처 표기

OpenStreetMap 자료는 ODbL 을 따릅니다. 지도 아래에 이미
`© OpenStreetMap` 표기가 들어가 있습니다.
