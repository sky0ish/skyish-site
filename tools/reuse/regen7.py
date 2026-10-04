# -*- coding: utf-8 -*-
# 도시재생 노트 7 — NDSM 부지 · 암스테르담 노르트 재생 (지구 단위)
#  건물 (선박 건조 홀 · 쿤스트스타트) 설명은 리노베이션 사례 "ndsm" (reno2.py · reno_more_03.py) 참고
#  laws · funding · operation · tenants 의 마지막 원소 = 직접 열어 확인한 원문 링크
U = [
{
 "id": "ndsm-amsterdam-noord", "t": "NDSM-werf, Amsterdam-Noord", "ko": "NDSM 부지 · 암스테르담 노르트 재생 (옛 조선소 → 예술 · 창조산업 · 주거 지구)",
 "nat": "네덜란드", "city": "암스테르담 노르트 구",
 "types": ["문화 · 복합형", "주거형", "업무 · 상업형"],
 "period": "1984 조선소 파산 · 1999 문화 용도 공모 · 2013 투자결정 ~ 2034 (진행 중)",
 "wiki": "NDSM", "cat": "NDSM",
 "from": "조선소 (네덜란드 조선 · 선박회사 NDSM, 1984 파산)",
 "to": "예술가 브레드플라츠 · 창조산업 · 미디어 본사 · 축제장 + 고밀 주거 (서쪽 약 5,400호 계획)",
 "zoneFrom": "공업 (조선소 · 항만 업무)",
 "zoneTo": "주거 · 업무 혼합 (용도계획 NDSM-werf West 2014 · 2020 개정, NDSM-werf Oost)",
 "keep": [
  "선박 건조 홀 (Scheepsbouwloods) → 예술가 작업실 도시 쿤스트스타트 · 행사장 (국가 기념물)",
  "목공장 (Timmerwerkplaats) → MTV (현 파라마운트) 사옥 (국가 기념물)",
  "용접 홀 (Lasloods) → IJ 할런 행사 · 시장 공간 (국가 기념물)",
  "옛 대장간 (Smederij) → 호텔 · 창조기업 집합 건물 (국가 기념물)",
  "선대 (hellingbanen) · 크레인 궤도 → 축제 · 공연 광장 (국가 기념물)",
  "크라안스포르 (Kraanspoor, 크레인 궤도 콘크리트 구조) → 위에 지은 창조기업 사무 건물 (서쪽)",
  "IJ 칸티너 (IJ-kantine) · 아프브라메레이 (Afbramerij) · 5번 선대 일부 (서쪽)"
 ],
 "spec": [
  ["위치", "네덜란드 암스테르담 노르트 구 — IJ 강 북안, 북쪽에 정원 마을 타윈도르프 오스트잔 (Tuindorp Oostzaan), 서쪽에 산업 지역"],
  ["면적", "약 79ha (791,670㎡, 네덜란드어 위키백과) — 동쪽 「NDSM-werf Oost」 (기념물 · 브레드플라츠)와 서쪽 「NDSM-werf West」 (신규 주거 · 업무)로 나뉨"],
  ["기간", "1984 파산 → 1999 문화 용도 공모 · 2000 브레드플라츠 정책 → 2007 국가 기념물 · 쿤스트스타트 → 2013 투자결정 → 2014 · 2020 용도계획 → 2034 완료 목표"],
  ["원래 용도", "조선 — 제2차 세계대전 뒤 재건기에 크게 번성, 1953년 9,000명 넘게 고용 (용도계획 NDSM-werf West)"],
  ["변경 용도", "동쪽 — 예술가 작업실 · 극장 작업장 · 축제 · 미디어 기업 · 호텔 · 박물관, 서쪽 — 고밀 주거 · 본사 사무 · 상점 · 마리나"],
  ["원래 용도지구", "공업 — 1997년 노르트 구의회는 서쪽을 「현대적 업무 단지」로 계획"],
  ["변경 용도지구", "주거 · 업무 혼합 — 2003 구조계획에서 「주거 · 업무 혼합 도시 지역」으로 지정"],
  ["주거 규모 (서쪽)", "2014 용도계획 주거 연면적 최대 212,500㎡ → 2020 개정 414,000㎡ (약 4,800호 예상) → 2023 전망 약 5,400호, 2023.7.1 기준 2,651호 완공"],
  ["토지 소유", "부지 전체가 암스테르담시 소유 — 장기 임대 (erfpacht)로 공급, 2013년 부지 전체 장기 임차인 40곳 넘음"]
 ],
 "timeline": [
  ["1984", "조선소 (NSM · NDSM 후속 회사) 파산 — 땅과 건물은 암스테르담시 소유, 노르트 구청이 관리"],
  ["1987", "독 4곳을 선박 수리 회사 (Shipdock Amsterdam)가 사용"],
  ["1997", "노르트 구의회가 서쪽 (당시 「NDSM-werf 남부」)에 업무 단지 도시설계 · 토지 개발 회계 · 예산 결정"],
  ["1998.8", "점거 예술가 공동체 약 700명이 시의회에 \"젊은 문화 · 경제 신참\"을 위한 정착 정책을 청원"],
  ["1999", "노르트 구청의 문화 용도 공모 — 키네티스 노르트 작업 그룹 (에바 더 클러르크 등) 당선, 연말 재개발 계획 제출 · 시의회가 「브레드플라츠 암스테르담」 사업 설치 결정"],
  ["2000.6.21", "시의회가 브레드플라츠 실행계획 채택 — 구호 \"하위문화 없이는 문화도 없다\""],
  ["2001", "키네티스 노르트 재단이 여러 기관 보조금으로 시범 사용 시작"],
  ["2002", "시가 서쪽 개발 컨소시엄 XXL 과 협력 협약 체결"],
  ["2003", "암스테르담 구조계획 「도시성을 택하다 (Kiezen voor stedelijkheid)」 — NDSM 을 주거 · 업무 혼합 지역으로, 노르트 구청이 IJ 북안 문화역사 영향 평가 (CHER)"],
  ["2004", "서쪽에 임시 학생 컨테이너 주택 설치 (2020년 1월까지)"],
  ["2006", "개발사 암스테르담 워터프런트 (AWF)가 XXL 의 서쪽 B 구획 개발권 인수"],
  ["2007", "2월 MTV 네트웍스 베네룩스가 목공장으로 이전 · 8월 6일 조선소 건물 5동 국가 기념물 단지 등재 · 연말 「대도시 사업 (grootstedelijk project)」 지정"],
  ["2008", "1월 1일 재정 책임이 노르트 구청에서 중앙 시로 이관 · 시 집행부 「전략 결정」 — 비주거 55% · 주거 45% (최대 약 2,500호)"],
  ["2009~2010", "동쪽 외부 공간 관리 · 프로그램 재단 「Stichting NDSM-werf」 설립 (공식 누리집 2009, 보도 2010)"],
  ["2010", "헤마 (HEMA) · VNU 미디어 본사와 헤마 점포 개장, 임시 직업학교 (ROC) 분교"],
  ["2012", "방파제와 요트 항구 「암스테르담 마리나」 조성"],
  ["2013", "시의회 첫 투자결정 — 서쪽에 주거 허용, B 구획에 870~1,500호 (사회임대 30%)"],
  ["2014", "용도계획 「NDSM-werf West」 — 주거 최대 212,500㎡, 높이 30m · 강조 60m · 랜드마크 1곳 120m / 키네티스 노르트 재단이 선박 건조 홀 소유권 인수"],
  ["2017", "시 주택 구성 원칙 사회 · 중간 · 자유 40-40-20, 경제 정책 문서에서 NDSM 을 「창조 지구」로"],
  ["2018", "시와 B 구획 개발사의 협력 협약 갱신 (새 일정 · 단계)"],
  ["2020", "투자결정 갱신 · 용도계획 개정 — 주거 최대 85% · 주거 연면적 414,000㎡ (약 4,800호)"],
  ["2021", "STRAAT 거리예술 박물관 개관"],
  ["2023", "7월 1일 서쪽 2,651호 완공 (사회임대 444호 · 자유 부문 1,827호), 암스테르담 감사원 보고서 발간"],
  ["2022~2034", "서쪽을 최대 약 5,000호의 고층 주거지로 전환 (네덜란드어 위키백과)"]
 ],
 "problem": [
  "1984년 조선소가 파산하면서 IJ 강 북안의 넓은 부지와 거대한 건물들이 비고 낡아 갔습니다.",
  "1990년대 말 암스테르담 동부 항만 · IJ 강변 개발로 점거 예술가들의 작업 공간이 잇따라 철거될 처지가 되었습니다 (1998년 청원).",
  "땅은 중금속 · 석면 · 광유로 심하게 오염되어 있었고, 부두 벽도 낡아 정화 · 기반시설 비용이 컸습니다 (NUL20 2009 · Gebiedsontwikkeling.nu 2014).",
  "브레드플라츠로 자생적으로 커진 개발 방식은 이용 압력과 관리 비용이 늘면서 오래 버티기 어려워졌습니다 (암스테르담 감사원 2023)."
 ],
 "overview": [
  "옛 조선소 터를 \"문화가 먼저, 개발은 나중\" 순서로 바꾼 지구 재생입니다. 1999년 노르트 구청이 공모로 문화 용도를 찾았고, 당선한 예술가 단체 키네티스 노르트가 선박 건조 홀을 작업실 도시로 만들었습니다. 같은 무렵 시는 점거 예술가들의 청원을 받아 「브레드플라츠 (broedplaats, 창작 인큐베이터) 정책」을 만들어 공공 재원을 댔습니다.",
  "2007년 조선소 핵심 건물 5동이 국가 기념물로 등재되고 MTV 가 옛 목공장으로 들어오면서, 동쪽은 기념물 · 브레드플라츠 · 미디어 기업 · 축제의 \"창조 지구\"가 되었습니다. 외부 공간은 시 · 입주 운영자 · 개발사가 함께 만든 재단 「Stichting NDSM-werf」가 관리하고 프로그램을 짭니다.",
  "서쪽은 시가 땅을 소유한 채 개발사 암스테르담 워터프런트 등에 개발권 · 장기 임대로 공급하는 방식입니다. 처음에는 업무 단지 (1997)였다가 사무실 과잉으로 주거가 더해졌고 (2003 · 2007), 2013년 투자결정과 2020년 개정으로 약 5,000호 넘는 고밀 주거지로 커졌습니다. 2010년 헤마 · VNU 본사가 서쪽의 첫 대형 앵커가 되었습니다."
 ],
 "actors": [
  ["도시계획가 · 건축가", "에바 더 클러르크 (Eva de Klerk) · 키네티스 노르트 작업 그룹", "1999 문화 용도 공모 당선안 — 선박 건조 홀 「작업실 도시」 구상 (건물 개조는 리노베이션 사례 \"ndsm\" 참고)"],
  ["도시계획가 · 건축가", "암스테르담시 계획 부서 · 시 집행부 (B en W)", "2008 전략 결정, 2019 서쪽 A 구획 도시설계 틀 — 설계자 개인 이름은 확인하지 못함"],
  ["주관 기관", "노르트 구청 (Stadsdeel Amsterdam-Noord)", "1984 이후 부지 관리, 1997 업무 단지 계획, 1999 공모, 2007년까지 재정 책임"],
  ["주관 기관", "암스테르담시 (Gemeente Amsterdam) · 시의회", "토지 소유, 2000 브레드플라츠 정책, 2003 구조계획, 2008년부터 「대도시 사업」 재정 책임, 2013 · 2020 투자결정"],
  ["개발사 (서쪽)", "암스테르담 워터프런트 (Amsterdam Waterfront, AWF) — 비스테르보스 계획개발 · 레흐보르흐 부동산투자 · 헷 포르트", "2006년 컨소시엄 XXL (2002 협약)의 B 구획 개발권 인수, 2018 협약 갱신"],
  ["개발사 (동쪽)", "미디어와프 (Mediawharf B.V.)", "동쪽 개발사 — Stichting NDSM-werf 참여 (2014 보도)"],
  ["문화 운영", "키네티스 노르트 재단 (Stichting Kinetisch Noord)", "2000 설립 — 선박 건조 홀 브레드플라츠 운영, 2014년 소유권 인수"],
  ["지역 관리", "NDSM 부지 재단 (Stichting NDSM-werf)", "동쪽 외부 공간 관리 · 문화 프로그램 · 공공 예술 (2009 설립)"],
  ["시민단체", "점거 예술가 공동체 (약 700명, 1998 청원)", "브레드플라츠 정책을 끌어냄"],
  ["앵커 기업", "MTV 네트웍스 베네룩스 (현 파라마운트 베네룩스) · 헤마 · VNU 미디어", "2007 · 2010 본사 입주"]
 ],
 "laws": [
  ["브레드플라츠 실행계획 (Plan van Aanpak Broedplaats Amsterdam, 2000.6.21 시의회 채택)", "점거 예술가 청원 (1998)에 대한 응답 — 시가 예술가 · 창작자 작업 공간을 공공 재원으로 확보 (현 브레드플라츠 사무국 BBp)", "https://openresearch.amsterdam/nl/page/105183/geschiedenis-van-het-broedplaatsenbeleid"],
  ["암스테르담 구조계획 「Kiezen voor stedelijkheid」 (2003)", "NDSM 을 업무 단지에서 주거 · 업무 혼합 도시 지역으로 전환한 출발점", "https://docs.rekenkamermadata.nl/gebiedsuitbreiding%20deel%201/Onderzoeksrapport%20Gebiedsontwikkeling%20en%20betaalbare%20woningen.%20Deelonderzoek%201%20-%20NDSM-werf%20West%20DEF.pdf"],
  ["기념물법 1988 (Monumentenwet 1988) → 국가 기념물 단지 528250 「N.D.S.M.-werf」 (2007)", "선박 건조 홀 · 목공장 · 대장간 · 용접 홀 · 선대와 크레인 궤도 5개 기념물 보호", "https://monumentenregister.cultureelerfgoed.nl/complexen/528250"],
  ["문화유산법 (Erfgoedwet, 2016~)", "기념물법을 이어받은 현행 국가 기념물 보호 법률", "https://wetten.overheid.nl/BWBR0037521/"],
  ["공간계획법 (Wet ruimtelijke ordening, ~2023)", "용도계획 (bestemmingsplan)의 법적 근거 — 2024년 환경계획법 (Omgevingswet)으로 대체", "https://wetten.overheid.nl/BWBR0020449/"],
  ["용도계획 「NDSM-werf West」 (2014 · 2020 개정)", "주거 · 업무 혼합 — 주거 연면적 최대 212,500㎡ → 414,000㎡, 사무 최대 79,450㎡, 높이 30m · 60m · 120m", "https://www.planviewer.nl/imro/files/NL.IMRO.0363.N1011BPSTD-VG01/t_NL.IMRO.0363.N1011BPSTD-VG01.html"],
  ["용도계획 「NDSM-werf Oost」", "기념물 단지 중심 — 브레드플라츠 · 작업장 · 행사 · 호텔 · 창조기업 집합 건물 · 요트 수리 항구", "https://www.planviewer.nl/imro/files/NL.IMRO.0363.N1010BPSTD-VG01/t_NL.IMRO.0363.N1010BPSTD-VG01_2.1.html"]
 ],
 "lawsNote": [
  "특별법이 아니라 시의 브레드플라츠 정책 (공공 재원으로 작업 공간 확보) · 구조계획 · 용도계획 · 투자결정 (grondexploitatie)과 국가 기념물 지정의 조합으로 진행되었습니다.",
  "규제 측면의 핵심은 업무 단지 계획 (1997)을 주거 · 업무 혼합 (2003 구조계획 · 2007 지역 사무실 공급 전략 Plabeka 로 사무 14만㎡ 를 주거로 전환)으로 바꾸고, 2020년 용도계획을 고쳐 주거 연면적을 거의 두 배로 늘린 것입니다."
 ],
 "tools": [
  ["문화 용도 공모 (1999)", "구청이 공모로 빈 조선소 건물의 문화 용도를 찾고, 당선한 예술가 단체에 운영을 맡김"],
  ["브레드플라츠 보조금", "시 브레드플라츠 기금으로 작업실 조성 — 2000년 당시 중앙 시가 NDSM 에 1,500만 길더 투입 계획 (Intermediair 보도)"],
  ["공공 토지 소유 + 장기 임대", "시가 땅을 팔지 않고 장기 임대 (erfpacht)로 공급 — 임대 조건 변경 (주거 전환) 차익도 시 수입"],
  ["개발권 협약 (SOK)", "서쪽 B 구획은 한 개발사 (AWF)가 개발권 — 2002 협약 · 2018 갱신"],
  ["단계적 개발", "경제 위기 때 (2013) 적극 개발을 B 구획 일부 (「6개 항 계획」, 2025년까지)로 제한, A 구획은 수동 전략"],
  ["주택 구성 목표", "사회임대 30% (2013) → 사회 · 중간 · 자유 40-40-20 (2017) / 30-40-30 (2020, 전환 지역)"],
  ["지역 관리 부담금", "동쪽 상업 임차인이 1㎡당 연 2.5유로를 재단에 내 문화 프로그램 · 관리 재원으로"],
  ["임시 사용", "학생 컨테이너 주택 (2004~2020) · 임시 직업학교 · 축제로 개발 전 부지 활성화"]
 ],
 "zoning": [
  ["지정", "용도계획 「NDSM-werf West」 (2014, 2020 개정) · 「NDSM-werf Oost」 — 2007년 「대도시 사업」 지정"],
  ["관리 주체 · 방식", "시 (토지 소유 · 투자결정) + 노르트 구 / 동쪽 외부 공간은 Stichting NDSM-werf, 선박 건조 홀은 키네티스 노르트 재단"],
  ["보존 관리", "국가 기념물 단지 528250 (2007) — 5개 기념물, 서쪽의 크라안스포르 · IJ 칸티너 · 선대 일부는 재활용"]
 ],
 "funding": [
  ["공공 재원 (브레드플라츠)", "2000년 12월 시의회가 브레드플라츠 보조금 6,000만 길더를 논의 (PvdA · GroenLinks 는 9,000만 길더 요구) — 중앙 시가 그중 1,500만 길더를 NDSM 부지에 넣을 계획 (Intermediair 2000.12.14)", "https://www.tijsvandenboomen.nl/broeden-op-kunst/"],
  ["공공 보조금 (시 · 노르트 구)", "조선소 건물 개조 · 기반시설 정비 · 독 수복 · 토양 개량에 암스테르담시와 노르트 구가 약 1,000만 유로 보조 (국외출장 보고서)"],
  ["토지 개발 회계 (서쪽)", "2013 투자결정 때 1단계 적자 1,480만 유로 예상 → 2020 개정 뒤 전체 흑자 1억 3,140만 유로 (현재가치, 2020 가격) → 2023 재산정 1억 3,070만 유로 (2023 가격)", "https://docs.rekenkamermadata.nl/gebiedsuitbreiding%20deel%201/Onderzoeksrapport%20Gebiedsontwikkeling%20en%20betaalbare%20woningen.%20Deelonderzoek%201%20-%20NDSM-werf%20West%20DEF.pdf"],
  ["민간 투자 (서쪽)", "개발사 AWF 등 민간이 주택 · 사무 건설 — 시는 직접 짓지 않고 개발사 · 주택조합에 기댐 (금액 미공개)"],
  ["문화 시설 투자", "키네티스 노르트 재단이 2014년 홀 소유권을 넘겨받아 약 600만 유로로 보수", "https://www.gebiedsontwikkeling.nu/artikelen/werken-aan-de-self-made-future-op-de-ndsm-werf/"],
  ["지역 관리 재원", "동쪽 상업 임대 면적 1㎡당 연 2.5유로 부담금", "https://www.gebiedsontwikkeling.nu/artikelen/werken-aan-de-self-made-future-op-de-ndsm-werf/"],
  ["문화 보조금", "Stichting NDSM-werf — 2025~2028 암스테르담 예술기금 (AFK) 4년 보조금", "https://www.ndsm.nl/over/stichting-ndsm-werf"]
 ],
 "operation": [
  ["토지 · 임대 구조", "부지 전체 시 소유 · 장기 임대 — 2013년 장기 임차인 40곳 넘음, 서쪽 B 구획은 개발사 AWF 가 개발권", "https://docs.rekenkamermadata.nl/gebiedsuitbreiding%20deel%201/Onderzoeksrapport%20Gebiedsontwikkeling%20en%20betaalbare%20woningen.%20Deelonderzoek%201%20-%20NDSM-werf%20West%20DEF.pdf"],
  ["지역 관리 주체", "Stichting NDSM-werf — 외부 공간 프로그램 · 관리 · 공공 예술 · 교육, 시 (토지 소유자) · 임차 운영자 · 개발사 미디어와프가 참여", "https://www.ndsm.nl/over/stichting-ndsm-werf"],
  ["문화 앵커 운영", "키네티스 노르트 재단 — 선박 건조 홀 브레드플라츠 (작업실 임대 · 대관), 2005년 작업실 임대료 1㎡당 연 30~40유로 (NUL20 2005)", "https://www.nul20.nl/dossiers/cultuur-wonen-en-werken-hand-hand-op-ndsm-werf"],
  ["주택 공급 성과 (2023.7)", "서쪽 계획 약 5,400호 중 2,651호 완공 — 사회임대 444호 · 자유 부문 1,827호 (중간 부문 0호), 착공 157호 (중간) · 111호 (자유)", "https://docs.rekenkamermadata.nl/gebiedsuitbreiding%20deel%201/Onderzoeksrapport%20Gebiedsontwikkeling%20en%20betaalbare%20woningen.%20Deelonderzoek%201%20-%20NDSM-werf%20West%20DEF.pdf"],
  ["운영상 문제", "부두 벽 상태가 나쁘고 오염 토양 때문에 수복 비용이 큼 (재단 대표, 2014) · 녹지는 시 기준의 4분의 1뿐이라 동쪽에서 보충 검토 (감사원 2023)"]
 ],
 "operationNote": [
  "시가 땅을 소유하고 장기 임대 · 개발권으로 민간 개발을 이끄는 구조입니다. 동쪽은 문화 재단 두 곳 (선박 건조 홀 · 외부 공간)이 임대료 · 대관 · 상업 임차인 부담금 · 보조금으로 운영하고, 서쪽은 토지 개발 회계의 흑자 (약 1억 3천만 유로)를 기대하는 주거 개발입니다. 사회 · 중간 주택 목표는 2023년 기준 완공분에서 아직 못 미칩니다 (감사원)."
 ],
 "tenants": [
  ["문화 · 브레드플라츠", "쿤스트스타트 (Kunststad) — 키네티스 노르트 재단", "선박 건조 홀 안 예술가 작업실 도시 (2007) — 건물 상세는 리노베이션 사례 \"ndsm\"", "https://www.herbestemming.nl/projecten/ndsm-terrein-amsterdam"],
  ["업무 · 미디어 본사", "파라마운트 베네룩스 (옛 MTV 네트웍스 베네룩스)", "2007년 2월부터 옛 목공장 (국가 기념물)", "https://nl.wikipedia.org/wiki/NDSM-terrein"],
  ["업무 · 앵커 기업 (본사)", "헤마 (HEMA) · VNU 미디어", "2010년 서쪽 신축 본사 · 헤마 점포 (B6 구획)", "https://docs.rekenkamermadata.nl/gebiedsuitbreiding%20deel%201/Onderzoeksrapport%20Gebiedsontwikkeling%20en%20betaalbare%20woningen.%20Deelonderzoek%201%20-%20NDSM-werf%20West%20DEF.pdf"],
  ["업무 · 미디어 제작", "IDTV", "서쪽 기존 입주 기업 (용도계획 NDSM-werf West 설명서)", "https://www.planviewer.nl/imro/files/NL.IMRO.0363.N1011BPSTD-VG01/t_NL.IMRO.0363.N1011BPSTD-VG01.html"],
  ["업무 · 창조기업 집합 건물", "크라안스포르 (Kraanspoor)", "옛 크레인 궤도 위 창조기업 사무 건물 (리노베이션 사례 \"kraanspoor\")", "https://www.planviewer.nl/imro/files/NL.IMRO.0363.N1011BPSTD-VG01/t_NL.IMRO.0363.N1011BPSTD-VG01.html"],
  ["업무 · 기업", "레드불 (Red Bull)", "재생 지식은행이 주요 이용자로 꼽음 — 현재 입주 여부 · 위치는 확인하지 못함", "https://www.herbestemming.nl/projecten/ndsm-terrein-amsterdam"],
  ["상업 · 호텔", "옛 대장간 (Smederij) 호텔", "약 7,500㎡ 홀을 76실 호텔과 창조기업 공간으로 개조 — 2009년 공사 중 70% 임대 (NUL20)", "https://www.nul20.nl/dossiers/spannend-wonen-op-ndsm-werf"],
  ["상업 · 호텔", "크레인 호텔 파랄다 (Crane Hotel Faralda)", "2013년 10월 옛 크레인을 개조한 호텔", "https://nl.wikipedia.org/wiki/NDSM-terrein"],
  ["상업 · 생활", "슈퍼마켓 · 빵집 등 (B9 구획) · 헤마 점포 (B6)", "서쪽 용도계획의 상업 면적 한도가 거의 다 참 (2023)", "https://docs.rekenkamermadata.nl/gebiedsuitbreiding%20deel%201/Onderzoeksrapport%20Gebiedsontwikkeling%20en%20betaalbare%20woningen.%20Deelonderzoek%201%20-%20NDSM-werf%20West%20DEF.pdf"],
  ["상업 · 마리나", "암스테르담 마리나 (Amsterdam Marina) · 요트 건조사 레베르헌 (Rhebergen)", "2012년 방파제 · 요트 항구 조성, 동쪽 요트 수리 항구", "https://www.planviewer.nl/imro/files/NL.IMRO.0363.N1010BPSTD-VG01/t_NL.IMRO.0363.N1010BPSTD-VG01_2.1.html"],
  ["주거 · 학생", "임시 학생 컨테이너 주택", "2004~2020년 1월 — 2013년 서쪽의 유일한 주민", "https://docs.rekenkamermadata.nl/gebiedsuitbreiding%20deel%201/Onderzoeksrapport%20Gebiedsontwikkeling%20en%20betaalbare%20woningen.%20Deelonderzoek%201%20-%20NDSM-werf%20West%20DEF.pdf"],
  ["주거 · 신규 주택", "NDSM-werf West 주거 (2,651호 완공, 2023.7)", "사회임대 444호 · 자유 부문 1,827호 + B2-1 구획 380호 (자유 부문이지만 사회임대 가격)", "https://docs.rekenkamermadata.nl/gebiedsuitbreiding%20deel%201/Onderzoeksrapport%20Gebiedsontwikkeling%20en%20betaalbare%20woningen.%20Deelonderzoek%201%20-%20NDSM-werf%20West%20DEF.pdf"],
  ["문화 · 미술관", "STRAAT 박물관", "2021년 개관 — 거리예술 박물관", "https://nl.wikipedia.org/wiki/NDSM-terrein"],
  ["문화 · 축제", "DGTL (2013~) · 오버 헷 에이 (Over het IJ, 2017~) · 플레인브레이스 (Pleinvrees, 2010~2024) · 로보독 (Robodock, 2005~2010)", "부지 외부 공간의 대형 축제", "https://nl.wikipedia.org/wiki/NDSM-terrein"],
  ["업무 · 교육", "직업학교 (ROC) 임시 분교", "2010년 서쪽", "https://docs.rekenkamermadata.nl/gebiedsuitbreiding%20deel%201/Onderzoeksrapport%20Gebiedsontwikkeling%20en%20betaalbare%20woningen.%20Deelonderzoek%201%20-%20NDSM-werf%20West%20DEF.pdf"]
 ],
 "result": [
  "동쪽은 국가 기념물 · 브레드플라츠 · 미디어 기업 · 축제가 모인 암스테르담의 대표 창조 지구가 되었습니다 (용도계획 서쪽 설명서는 \"가장 큰 창작 브레드플라츠 중심지의 하나\"로 표현).",
  "서쪽은 2023년 7월까지 2,651호가 완공되어 계획 약 5,400호의 절반에 이르렀습니다 — 다만 사회 · 중간 주택 비율은 완공분 기준 20%로 목표보다 낮습니다.",
  "토지 개발 회계는 2013년 적자 전망에서 2020년 이후 약 1억 3천만 유로 흑자 전망으로 바뀌었습니다."
 ],
 "famous": [
  "점거 예술가들의 청원 (1998)이 암스테르담 「브레드플라츠 정책」 (2000)을 낳았고, NDSM 은 그 대표 현장이 되었습니다.",
  "MTV (현 파라마운트) · 헤마 본사 등 기업 이전, 크레인 호텔, DGTL 같은 축제로 국제적으로 알려졌습니다.",
  "2007년 조선소 건물 5동이 국가 기념물 단지로 등재되었습니다."
 ],
 "lesson": [
  "문화 용도 공모와 브레드플라츠 보조금으로 먼저 사람을 들이고, 나중에 주거 · 업무 개발을 붙인 \"문화 선행형\" 산단 재생 — 시가 땅을 계속 소유해 장기 임대로 개발 이익을 회수한 점이 핵심입니다.",
  "용도 전환 (업무 단지 → 주거 혼합)은 한 번이 아니라 2003 · 2007 · 2013 · 2020년 여러 차례 계획을 고쳐 가며 이루어졌습니다 — 시장 상황에 맞춰 단계와 비율을 조정하는 장치가 필요합니다.",
  "개발이 커질수록 처음 문화 주체의 자리와 사회주택 목표를 지키기 어려워집니다 — 소유권 이전 (선박 건조 홀)과 주택 구성 목표를 일찍 제도화해야 합니다."
 ],
 "missing": [
  "국외출장 보고서는 「1996년 노르트 구청 (보고서 표기 SDAN)이 NDSM 지역의 3분의 2를 매입」했다고 적었으나, 암스테르담 감사원 보고서는 1984년 파산 뒤 땅과 건물이 시 소유가 되었다고 적어 서로 다릅니다 — 매입 시기 · 범위는 확인된 자료를 찾지 못했습니다.",
  "국외출장 보고서의 시 · 노르트 구 보조금 약 1,000만 유로는 공개 원문으로 확인된 자료를 찾지 못했습니다.",
  "2000년 계획된 1,500만 길더 가운데 실제 집행액은 확인된 자료를 찾지 못했습니다.",
  "2009년 선박 건조 홀을 주택조합 계열 드 프린시팔 (De Principaal)에 매각하려던 계획 (NUL20 2009, 640만 유로)과 2014년 재단 소유권 인수 사이의 경위는 확인된 자료를 찾지 못했습니다.",
  "서쪽 마스터플랜 · 도시설계 틀 (2019)의 설계자 이름은 확인된 자료를 찾지 못했습니다.",
  "암스테르담시 공식 사업 페이지 (amsterdam.nl/projecten/ndsm-werf)와 Het Parool 기사는 자동 접속 차단으로 직접 열어 확인하지 못했습니다.",
  "레드불 · 그린피스 등 다른 기업의 현재 입주 여부는 확인된 자료를 찾지 못했습니다."
 ],
 "refs": [
  {"t": "NDSM-terrein — 네덜란드어 위키백과", "u": "https://nl.wikipedia.org/wiki/NDSM-terrein"},
  {"t": "Rekenkamer Amsterdam — Gebiedsontwikkeling en betaalbare woningen, Deelonderzoek 1: NDSM-werf West (2023.11.1)", "u": "https://docs.rekenkamermadata.nl/gebiedsuitbreiding%20deel%201/Onderzoeksrapport%20Gebiedsontwikkeling%20en%20betaalbare%20woningen.%20Deelonderzoek%201%20-%20NDSM-werf%20West%20DEF.pdf"},
  {"t": "Bestemmingsplan NDSM-werf West — Toelichting (planviewer)", "u": "https://www.planviewer.nl/imro/files/NL.IMRO.0363.N1011BPSTD-VG01/t_NL.IMRO.0363.N1011BPSTD-VG01.html"},
  {"t": "Bestemmingsplan NDSM-werf Oost — 2.1 Beschrijving van het plangebied (planviewer)", "u": "https://www.planviewer.nl/imro/files/NL.IMRO.0363.N1010BPSTD-VG01/t_NL.IMRO.0363.N1010BPSTD-VG01_2.1.html"},
  {"t": "Rijksmonumentenregister — complex 528250 N.D.S.M.-werf", "u": "https://monumentenregister.cultureelerfgoed.nl/complexen/528250"},
  {"t": "Geschiedenis van het broedplaatsenbeleid — openresearch.amsterdam", "u": "https://openresearch.amsterdam/nl/page/105183/geschiedenis-van-het-broedplaatsenbeleid"},
  {"t": "Broeden op kunst — Intermediair (2000.12.14), tijsvandenboomen.nl", "u": "https://www.tijsvandenboomen.nl/broeden-op-kunst/"},
  {"t": "NDSM-terrein, Amsterdam — Kennisbank Herbestemming", "u": "https://www.herbestemming.nl/projecten/ndsm-terrein-amsterdam"},
  {"t": "Werken aan de Self Made Future op de NDSM-werf — Gebiedsontwikkeling.nu (2014.7.4)", "u": "https://www.gebiedsontwikkeling.nu/artikelen/werken-aan-de-self-made-future-op-de-ndsm-werf/"},
  {"t": "Cultuur, wonen en werken hand in hand op NDSM-werf — NUL20 nr 21 (2005.7)", "u": "https://www.nul20.nl/dossiers/cultuur-wonen-en-werken-hand-hand-op-ndsm-werf"},
  {"t": "Spannend wonen op NDSM-werf — NUL20 nr 43 (2009.3)", "u": "https://www.nul20.nl/dossiers/spannend-wonen-op-ndsm-werf"},
  {"t": "Stichting NDSM-werf — ndsm.nl", "u": "https://www.ndsm.nl/over/stichting-ndsm-werf"},
  {"t": "Erfgoedwet — wetten.overheid.nl", "u": "https://wetten.overheid.nl/BWBR0037521/"},
  {"t": "Wet ruimtelijke ordening — wetten.overheid.nl", "u": "https://wetten.overheid.nl/BWBR0020449/"},
  {"t": "경기연구원 — [2023.5월] 네덜란드/아일랜드/영국 해외출장결과보고 (과제 「초광역 베이밸리 메가시티 기본구상」, 2023)", "u": "https://www.gri.re.kr/web/contents/managenotice07.do?schM=view&id=111842"},
  {"t": "경기연구원 — [2016. 7월] 네덜란드/프랑스/스페인 해외출장보고 (과제 「경기도 및 인천의 철로변 근대건조물 보전과 지역적 활용」, 2016)", "u": "https://www.gri.re.kr/web/contents/managenotice07.do?schM=view&id=25778"}
 ]
}
]
