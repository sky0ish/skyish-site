/* =============================================================
   나의 연구 — 논문 / 연구보고서 데이터
   -------------------------------------------------------------
   파일명에서 자동 추출한 초안입니다. 제목·연월·저자순위는
   본인 확인 후 확정하세요. 새 실적은 배열에 한 줄 추가하면 됩니다.

   필드:
     date   화면 표시용 (예 "2024.12" / "2015")
     sort   정렬용 숫자 (클수록 최신). 논문=YYYYMM, 보고서=YYYY*100+연번
     title  제목
     venue  저널/발행처
     role   저자·역할 (1저자 / 교신저자 / 책임 / 공동 / 위탁 등)
     tier   등급 태그 (SCIE / SCOPUS / KCI 등) — 없으면 생략
     link   공식 페이지 URL (비워두면 제목 검색 링크로 자동 연결)
   ============================================================= */
window.RESEARCH = {
  papers: [
    { date: "2024.12", sort: 202412, title: "공동체주택 공유공간 계획 특성 및 사회적 역할 연구", venue: "KCI 등재지", role: "교신저자", tier: "KCI" },
    { date: "2023.06", sort: 202306, title: "Conditions on the Sustainable Housing of Foreign Workers: A Case Study of Gyeonggi Province, South Korea", venue: "Sustainability", role: "1저자", tier: "SCIE" },
    { date: "2023.03", sort: 202303, title: "경기도 외국인 근로자 주거시설의 현황 고찰", venue: "KCI 등재지", role: "1저자", tier: "KCI" },
    { date: "2022.06", sort: 202206, title: "Diachronic Changes and Factors Influencing the Exterior Design of High-rise Apartment Buildings", venue: "Buildings (MDPI)", role: "교신저자", tier: "SCIE" },
    { date: "2022.06", sort: 202205, title: "전문성과 현장성 강화를 위한 건설기능 교육시설의 수요 및 교육프로그램에 관한 연구", venue: "KCI 등재지", role: "1저자", tier: "KCI" },
    { date: "2019.12", sort: 201912, title: "빈 상가의 규모별 발생 현황과 대응방안에 관한 연구", venue: "KCI 등재지", role: "1저자", tier: "KCI" },
    { date: "2019.11", sort: 201911, title: "조선왕릉 주변지역의 관리와 활용을 위한 도시환경 분석 및 평가 — 경기도 소재 조선왕릉을 중심으로", venue: "KCI 등재지", role: "1저자", tier: "KCI" },
    { date: "2019.10", sort: 201910, title: "생활SOC의 범위 및 시설의 유형별·지역별 특성 연구 — 경기도 생활SOC 현황 및 개선방안을 중심으로", venue: "KCI 등재지", role: "교신저자", tier: "KCI" },
    { date: "2019.10", sort: 201909, title: "재난대비 방재도로 선정을 위한 방향 설정 연구", venue: "KCI 등재지", role: "2저자", tier: "KCI" },
    { date: "2019.06", sort: 201906, title: "지자체의 근대건조물 조사 및 활용을 위한 평가기준 개발", venue: "KCI 등재지", role: "1저자", tier: "KCI" },
    { date: "2019.03", sort: 201903, title: "국내외 건축센터의 운영주체별 역할 및 프로그램에 관한 연구", venue: "KCI 등재지", role: "1저자", tier: "KCI" },
    { date: "2019.02", sort: 201902, title: "경기 및 인천 지역 철로변 근대건조물의 분포현황 및 지역별 특성 연구", venue: "KCI 등재지", role: "1저자", tier: "KCI" },
    { date: "2018.05", sort: 201805, title: "GIS 기반 경기도 광역영역의 부지지진응답 특성 및 연계 지진취약지역 분석", venue: "KCI 등재지", role: "4저자", tier: "KCI" },
    { date: "2016.08", sort: 201608, title: "Factors Contributing to Residential Vacancy and Some Approaches to Management in Gyeonggi Province, Korea", venue: "Sustainability", role: "1저자", tier: "SCIE" },
    { date: "2015.08", sort: 201508, title: "Main Agents, Programmes, and Systems for Resolving the Abandoned House Phenomenon", venue: "SPACE (공간)", role: "1저자", tier: "SCIE" },
    { date: "2015.05", sort: 201505, title: "The Representation of Ambiguity in the Spaces of Luis Barragán House and Studio", venue: "JAABE", role: "교신저자", tier: "SCIE" },
    { date: "2014.12", sort: 201412, title: "일본 빈집 대처와 방안", venue: "한국지역사회학회", role: "1저자", tier: "KCI" },
    { date: "2014.11", sort: 201411, title: "빈집을 활용한 지역커뮤니티 거점 만들기 — 세타가야구의 지역공생의집을 대상으로", venue: "KCI 등재지", role: "1저자", tier: "KCI" },
    { date: "2014.10", sort: 201410, title: "재해시 임시대피거점으로서의 학교 계획지침에 관한 연구", venue: "한국방재학회", role: "1저자", tier: "KCI" },
    { date: "2014.04", sort: 201404, title: "인천 정미업을 중심으로 한 산업유산군의 형성에 관한 연구", venue: "한국건축역사학회", role: "1저자", tier: "KCI" },
    { date: "2014.04", sort: 201403, title: "일본 큐슈·야마구치 일원 근대화 산업유산군의 세계문화유산 등재에 대한 비판적 고찰", venue: "대한국토·도시계획학회", role: "2저자", tier: "KCI" },
    { date: "2012", sort: 201200, title: "도시의 빈공간을 활용한 지역공동체 활동거점 만들기 — 도쿄의 빈건물 활용사례를 중심으로", venue: "서울연구원 '작은연구 좋은 서울' 정책연구보고서", role: "1저자" },
    { date: "2011.05", sort: 201105, title: "Thresholds in the Pluralistic Architecture of Tadao Ando", venue: "JAABE", role: "교신저자", tier: "SCIE" },
    { date: "2009.09", sort: 200909, title: "산업유산군의 공생의 의미와 지역 연계적 가치", venue: "대한건축학회 논문집", role: "1저자", tier: "KCI" },
    { date: "2009.05", sort: 200905, title: "Comparison of In-between Concepts by Aldo van Eyck and Kisho Kurokawa", venue: "JAABE", role: "2저자", tier: "SCIE" }
  ],

  /* 학위논문 — 박사/석사 (별도 탭) */
  theses: [
    { date: "2015.02", sort: 201502, title: "도쿄도 역세권의 지역적 공공공간 형성과 관리에 관한 연구", venue: "서울대학교 대학원 · 박사학위논문", tier: "박사학위논문" },
    { date: "2012.03", sort: 201203, title: "개항도시의 산업유산과 재활을 통한 도시보존 수법과 연계적 역사경관 형성에 관한 연구 — 인천 구 제물포(중구·동구)의 갈등을 중심으로", venue: "도쿄대학교 대학원 · 박사학위논문", tier: "박사학위논문" },
    { date: "2004.02", sort: 200402, title: "CIAM 이후 아방가르드 도시주거이론에서 나타나는 '네트워크를 통한 성장 개념' — Team X, GEAM, Archigram의 '자율성'과 '가변성'의 비교연구를 중심으로", venue: "서울대학교 대학원 건축학과 · 석사학위논문", tier: "석사학위논문" },
    { date: "2001.09", sort: 200109, title: "Processing Line — 가리봉역 방직공장 리노베이션", venue: "서울대학교 공과대학 건축학과 졸업작품전 · 은상", tier: "학사 졸업작품", nolink: true },
  ],

  reports: [
    { date: "2026", sort: 202615909, title: "2030 새로운 경기도를 위한 정책제안", venue: "경기연구원", role: "공동" },
    { date: "2026", sort: 202615890, title: "경기북부 신성장거점 구축을 위한 발전전략 연구", venue: "경기연구원", role: "공동" },
    { date: "2025", sort: 202515882, title: "경기도형 도시·건축 민간전문가 제도 도입 방안", venue: "경기연구원", role: "책임" },
    { date: "2024", sort: 202415630, title: "경기도 지역균형발전 기본계획(2025~2029)", venue: "경기연구원", role: "책임" },
    { date: "2024", sort: 202415583, title: "뉴 컴팩트시티를 위한 경기도 역세권의 입체복합화 방안", venue: "경기연구원", role: "책임" },
    { date: "2024", sort: 202415561, title: "경기도 철도 지하화 사업 개발 전략 수립", venue: "경기연구원", role: "공동" },
    { date: "2024", sort: 202415512, title: "경기북부 드론규제 현황 및 완화전략 연구", venue: "경기연구원", role: "공동" },
    { date: "2024", sort: 202415439, title: "연천군 생활인구 산정에 따른 대응방안", venue: "경기연구원", role: "공동" },
    { date: "2024", sort: 202400001, title: "제1차 경기도 탄소중립 녹색성장 기본계획 (2024–2033)", venue: "경기연구원", role: "공동" },
    { date: "2023", sort: 202315663, title: "초광역 베이밸리 메가시티 기본구상", venue: "경기연구원", role: "책임" },
    { date: "2023", sort: 202315611, title: "제1차 지방시대 종합계획(2023~2027) : 경기도 지방시대 계획", venue: "경기연구원", role: "공동" },
    { date: "2023", sort: 202315327, title: "경기도 인구감소·관심 지역의 원인분석과 대응방안 연구: 균형발전 측면에서", venue: "경기연구원", role: "공동" },
    { date: "2023", sort: 202315311, title: "삶의 질 확충을 위한 경기도형 생활SOC 복합화 방안", venue: "경기연구원", role: "책임" },
    { date: "2023", sort: 202315310, title: "양주시 미활용 군용지 활용방안", venue: "경기연구원", role: "책임" },
    { date: "2023", sort: 202315222, title: "포천역세권 신구도심 통합 발전방안", venue: "경기연구원", role: "책임" },
    { date: "2022", sort: 202215693, title: "경기도 종합계획(2021~2040)", venue: "경기연구원", role: "공동" },
    { date: "2022", sort: 202215024, title: "스마트 축소를 위한 쇠퇴도시 유형과 도시관리 전략 — 해외사례를 중심으로", venue: "경기연구원", role: "책임" },
    { date: "2021", sort: 202114785, title: "경기도 균형발전정책의 효율적 추진방안 연구", venue: "경기연구원", role: "공동" },
    { date: "2021", sort: 202114780, title: "지역경쟁력 강화를 위한 경기도 특별건축구역 운영방안", venue: "경기연구원", role: "책임" },
    { date: "2021", sort: 202114726, title: "경기도 농어촌 외국인 노동자 주거시설 모델개발을 위한 정책연구", venue: "경기연구원", role: "책임" },
    { date: "2020", sort: 202014695, title: "반지하의 거주환경 개선방안", venue: "경기연구원", role: "책임" },
    { date: "2020", sort: 202014646, title: "스마트 축소로서의 역세권 지역관리에 관한 연구", venue: "경기연구원", role: "책임" },
    { date: "2020", sort: 202014629, title: "경기도 산업안전 트레이닝센터 건립방안", venue: "경기연구원", role: "책임" },
    { date: "2020", sort: 202014574, title: "경기도 건설기능학교 설립 타당성 연구", venue: "경기연구원", role: "책임" },
    { date: "2019", sort: 201914401, title: "광명시 도덕산 천문과학관 건립 기본구상", venue: "경기연구원", role: "책임" },
    { date: "2019", sort: 201913121, title: "2030 경기도 온실가스 감축 로드맵 수립 연구 용역", venue: "경기연구원", role: "공동" },
    { date: "2018", sort: 201813021, title: "경기도 발전계획(2018~2022)", venue: "경기연구원", role: "공동" },
    { date: "2018", sort: 201812381, title: "건설산업 공정성 강화 방안 마련을 위한 기초연구", venue: "경기연구원", role: "공동" },
    { date: "2018", sort: 201812324, title: "4차 산업혁명 시대의 스마트시티 전략", venue: "경기연구원", role: "공동" },
    { date: "2018", sort: 201811161, title: "평택시 지역발전 전략 연구", venue: "경기연구원", role: "책임" },
    { date: "2018", sort: 201810581, title: "경기도 광역건축기본계획 (2018)", venue: "경기연구원", role: "책임" },
    { date: "2018", sort: 201810101, title: "경기도 발전 전략과제", venue: "경기연구원", role: "공동" },
    { date: "2017", sort: 201709443, title: "양주시 2025 중장기 종합발전계획 수립", venue: "경기연구원", role: "공동" },
    { date: "2017", sort: 201709442, title: "경기 중부내륙지역 종합발전계획", venue: "경기연구원", role: "공동" },
    { date: "2017", sort: 201709301, title: "지진에 대비한 경기도 내진대책과 정책개선", venue: "경기연구원", role: "책임" },
    { date: "2017", sort: 201708942, title: "경기도 공공건축물 친환경기술 도입 활성화 방안", venue: "경기연구원", role: "공동" },
    { date: "2017", sort: 201708561, title: "일본 사회의 明과 暗, 그리고 교훈", venue: "경기연구원", role: "공동" },
    { date: "2017", sort: 201707661, title: "경기도 에너지 저감형 녹색건축물 조성 및 운영방안", venue: "경기연구원", role: "책임" },
    { date: "2017", sort: 201707441, title: "국가발전을 위한 전략과제", venue: "경기연구원", role: "공동" },
    { date: "2017", sort: 201707440, title: "과천시 비전 2040", venue: "경기연구원", role: "공동" },
    { date: "2017", sort: 201707301, title: "경기도 노후지역 맞춤형 정비사업의 활성화 방안", venue: "경기연구원", role: "공동" },
    { date: "2017", sort: 201706999, title: "수인선변 공동체문화 연구", venue: "경기연구원", role: "위탁" },
    { date: "2017", sort: 201700001, title: "저출산·고령화에 따른 지역소멸 대응방안 연구", venue: "경기연구원", role: "공동" },
    { date: "2016", sort: 201606880, title: "2040 평택시 장기발전종합계획 수립 연구", venue: "경기연구원", role: "공동" },
    { date: "2016", sort: 201606662, title: "경기도 및 인천의 철도변 근대건조물 보전과 지역적 활용방안", venue: "경기연구원", role: "책임" },
    { date: "2016", sort: 201605889, title: "도시계획과 커뮤니티계획의 융합방향 연구", venue: "경기연구원", role: "공동" },
    { date: "2016", sort: 201605885, title: "경기도 한옥 등 건축자산 진흥을 위한 기초연구", venue: "경기연구원", role: "책임" },
    { date: "2016", sort: 201605880, title: "경기도 따복공동체 기본계획 수립 연구", venue: "경기연구원", role: "공동" },
    { date: "2016", sort: 201605482, title: "경기도 건설공사 부실방지에 관한 제도개선 방안", venue: "경기연구원", role: "책임" },
    { date: "2016", sort: 201605468, title: "경인고속도로 지하화에 따른 상부공간 활용방안 사전 연구용역", venue: "경기연구원", role: "책임" },
    { date: "2016", sort: 201605436, title: "경기도 소재 조선왕릉의 관리체계 개선방안", venue: "경기연구원", role: "책임" },
    { date: "2015", sort: 201505338, title: "경기도 광역건축기본계획의 성과와 발전방안", venue: "경기연구원 (정책연구 2015-77)", role: "책임" },
    { date: "2015", sort: 201505337, title: "경기도 근대건조물의 조사 및 관리방안", venue: "경기연구원", role: "책임" }
  ],

  /* 이슈 대응 — 기고·칼럼·이슈&진단 등 (날짜는 확인 필요) */
  issues: [
    { date: "2018.06", sort: 201806, title: "일본에서는 빈집을 어떻게 활용하고 있나", venue: "서울연구원 「세계와 도시」 22호", role: "기고" },
    { date: "2016", sort: 201600, title: "빈집도 지역자산이다", venue: "경기연구원 「이슈 & 진단」 제206호", role: "기고" },
    { date: "2016", sort: 201599, title: "빈집 문제와 지역자산화", venue: "서울연구원 세계도시연구", role: "기고" }
  ]
};
