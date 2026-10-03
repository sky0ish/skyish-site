# -*- coding: utf-8 -*-
# 이름표가 없거나 틀린 도면 — 그림을 직접 보고 붙인 이름 (그림 주소에 든 말 → (갈래, 이름) · None 이면 뺌)
#   갈래: concept = 3) 컨셉(조감도 · 분해도 · 스케치)  plan = 4) 공간(평면 · 입면 · 단면)  build = 5) 재료 · 구조
L = {
 "Capilla_san_ignacio6": ("concept", "컨셉 스케치 — 빛의 병"),
 "5cb896e4284dd1a8120000d1": ("plan", "세대 평면 액소노메트릭 (기존 · 계획)"),
 "5cb896c6284dd1a8120000d0": ("plan", "세대 평면 액소노메트릭 (기존 · 계획)"),
 "5cb896d3284dd11447000177": None,            # 그랑 파르크 — 라카통 & 바살 홈페이지 그림과 같음
 "5cb896b8284dd11447000176": ("concept", "증축 분해도 — 겨울정원 · 발코니"),
 "b2312e3b865f951727967d1b6b3398a63f331027": None,            # 메닐 — 사진이었음
 "Harpa_sec.jpg": ("plan", "단면도 (동서)"),
 "Harpa_sec_long": ("plan", "종단면도"),
 "346-dca-neues-museum-roman-room-ceiling": ("plan", "평면 (로마 방 천장 보존 조사도)"),
 "50120d9228ba0d55810003ce": ("plan", "단면도"),
 "50120d9828ba0d55810003cf": ("plan", "단면도"),
 "50120d9c28ba0d55810003d0": ("build", "지붕 루버 상세도"),
 "50120da428ba0d55810003d1": ("plan", "1층 평면도"),
 "50120daa28ba0d55810003d2": ("plan", "지상층 평면도"),
 "50120dad28ba0d55810003d3": ("plan", "지붕 평면도"),
 "50120db228ba0d55810003d4": ("plan", "2층 평면도"),
 "50120db828ba0d55810003d5": ("plan", "배치도"),
 "50120dbe28ba0d55810003d6": ("plan", "단면도"),
 "50120dc228ba0d55810003d7": ("build", "지붕 상세도"),
 "5416ee8ac07a8016d10000b2": ("plan", "입면도 · 단면도"),
 "Parlamento.evolucion": ("concept", "설계 발전 과정 (평면)"),
 "SwissRe_Cupula_Malla": ("build", "구조 — 다이아그리드"),
 "Museo_Bregenz_sec": ("plan", "단면도"),
 "Museo_Bregenz_sop_tej_crist": ("build", "상세도 — 유리 판 고정 철물"),
 "Museo_Bregenz_esq_inst": ("concept", "단면 다이어그램 — 빛 · 공기 · 설비"),
 "Capilla_san_ignacio9": ("plan", "입면도 · 평면도"),
 "Capilla_san_ignacio3": ("concept", "컨셉 스케치 — 빛의 볼트"),
 "MAXXI_13": ("concept", "3D 렌더링"),
 "MAXXI_14": None,
 "Opera_Oslo_audit_princ": ("plan", "대극장 평면도"),
}
