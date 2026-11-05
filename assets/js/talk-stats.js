/* ------------------------------------------------------------------
   발표 목록 분석 — presentations.html 아래 「주제별 통계」가 씁니다.

   ● 분야(FIELDS): 발표 제목에서 낱말을 찾아 분야를 붙입니다.
     한 발표가 여러 분야에 들 수 있습니다. 낱말을 더하려면 kw 에 [이름, 정규식] 을 넣으세요.
   ● 행사 갈래(KINDS): talks.js 의 tag 를 몇 묶음으로 모읍니다.
   ● 기관(ORGS): 주최·주관·후원·행사명과 함께한 분의 소속 글에서 기관 이름을 뽑습니다.
       1) 별칭 사전(ORG_RULES)에 맞는 것을 먼저 같은 이름으로 모으고 (예: LHI·LHRI → LH 토지주택연구원)
       2) 남은 글에서 「…대학교 · …연구원 · …학회 · …공사 · …협의회 · …재단 …」 꼴을 더 찾습니다.
     소속 기관인 경기연구원은 세지 않습니다. 발표 한 건에 같은 기관이 여러 번 나와도 한 번으로 셉니다.

   브라우저에서는 window.TalkStats, node 에서는 require() 로 씁니다.
   ------------------------------------------------------------------ */
(function (root) {
  "use strict";

  var FIELDS = [
    { id: "usfk", name: "반환공여지·군사시설", kw: [
      ["반환공여지", /반환\s*공여|공여\s*구역|공여지|미군/],
      ["군용지·군부대", /군용|군부대|군사/],
      ["캠프·관군협력", /캠프|관\s*·\s*군|관군/] ] },
    { id: "defense", name: "방위산업·국방 AI", kw: [
      ["방산클러스터", /방산|방위산업/],
      ["국방·피지컬 AI", /국방|피지컬\s*AI|AI\s*안전/],
      ["드론·로봇", /드론|로봇/] ] },
    { id: "north", name: "균형발전·경기북부·접경", kw: [
      ["균형발전", /균형\s*발전|균형\s*성장|5극\s*3특|균형/],
      ["경기북부", /경기\s*북부|북부/],
      ["접경·DMZ·평화", /접경|DMZ|평화/],
      ["도농복합", /도농|농촌/],
      ["수도권–지방 상생", /수도권|국가\s*경쟁력|상생/] ] },
    { id: "heritage", name: "산업유산·건축자산·문화", kw: [
      ["산업유산", /산업\s*유산|산업\s*자산/],
      ["근대유산·건조물", /근대|건조물/],
      ["보존·복원", /보존|복원/],
      ["건축·역사·문화유산", /건축\s*자산|역사\s*자산|문화\s*유산|세계\s*유산|유산/],
      ["노동문화", /노동자의 길|동일방직|노동\s*문화/],
      ["문화·관광·케이컬처", /케이\s*컬|K-?컬처|관광/] ] },
    { id: "regen", name: "빈집·도시재생·쇠퇴", kw: [
      ["빈집·빈 공간", /빈집|빈\s*공간|유휴|미활용/],
      ["도시재생", /재생|리모델링/],
      ["쇠퇴·축소·소멸", /쇠퇴|축소|소멸|인구\s*감소|인구\s*문제/],
      ["원도심·상권", /원도심|구도심|노후\s*도시|중심\s*상권|재래\s*상권|신구\s*도심/] ] },
    { id: "station", name: "역세권·철도·항만", kw: [
      ["역세권", /역세권/],
      ["철도", /철도|철길/],
      ["환승·교통시설", /환승|교통\s*시설/],
      ["항만", /항만|평택항/] ] },
    { id: "housing", name: "주거·주택", kw: [
      ["반지하", /반지하/],
      ["외국인 노동자 주거", /외국인\s*노동자/],
      ["공공·임대주택", /매입\s*임대|공공\s*주택|임대/],
      ["주거환경·주택공급", /주거|주택/] ] },
    { id: "soc", name: "생활SOC·학교복합화", kw: [
      ["학교복합화", /학교|교육\s*시설|교육\s*환경/],
      ["생활SOC", /생활\s*SOC/],
      ["복합화", /복합화/] ] },
    { id: "machi", name: "마을만들기·지역관리", kw: [
      ["마을만들기", /마을\s*만들기|마치즈쿠리|마을\s*공동체/],
      ["지역관리", /지역\s*관리|에리어|타운\s*매니지먼트/] ] },
    { id: "policy", name: "도시정책·제도·신도시", kw: [
      ["규제·특구·특별건축구역", /규제|특별\s*건축\s*구역|공간\s*혁신\s*구역|도시\s*혁신|특구/],
      ["신도시·자족·도시개발", /신도시|자족|도시\s*개발|메가시티|베이밸리|정주\s*여건/],
      ["국공유지·법·제도", /국공유지|공유지|법령|제도|특별법|조례|장기\s*임대/],
      ["도시관리·방재·경관", /도시\s*관리|방재|도시\s*정책|경관/] ] },
    { id: "data", name: "인구·데이터·스마트시티", kw: [
      ["데이터·통계", /데이터|통계|지표/],
      ["스마트·AI 도시", /스마트\s*시티|Smart City|AI\s*City|AI\s*시티/],
      ["인구", /인구/] ] }
  ];

  /* 일본 사례는 분야를 가로지르는 렌즈라 따로 셉니다 */
  var LENS = [
    ["일본 사례", /일본|마치즈쿠리|동경대|도쿄/]
  ];

  var KINDS = [
    { id: "nat",   name: "국회",          tags: ["국회"] },
    { id: "pol",   name: "정책토론회",     tags: ["정책토론회", "토론회", "공론장", "정책엑스포", "특별위"] },
    { id: "aca",   name: "학회·심포지엄",  tags: ["학회", "학술세미나", "심포지엄", "콜로퀴움", "컨퍼런스"] },
    { id: "sem",   name: "세미나·포럼",    tags: ["세미나", "포럼", "워크숍", "성과공유"] },
    { id: "edu",   name: "특강·교육",      tags: ["특강", "교육", "강연"] },
    { id: "adv",   name: "자문·간담회",    tags: ["자문", "간담회", "보고회", "참관"] },
    { id: "etc",   name: "발표·기타",      tags: [] }
  ];
  function kindOf(tag) {
    for (var i = 0; i < KINDS.length; i++) if (KINDS[i].tags.indexOf(tag) >= 0) return KINDS[i].id;
    return "etc";
  }

  /* ── 기관 ─────────────────────────────────────────────────── */
  var TYPES = [
    { id: "par", name: "국회·의회" },
    { id: "gov", name: "중앙·지방정부" },
    { id: "res", name: "연구기관" },
    { id: "uni", name: "대학·학회" },
    { id: "pub", name: "공기업·공공기관" },
    { id: "civ", name: "시민·민간·언론" }
  ];

  /* [정규식, 이름, 갈래] — 위에서부터 차례로 찾고, 찾은 글은 지워 두 번 세지 않습니다 */
  var ORG_RULES = [
    [/경기연구원|GRI\b/g, null, null],                       /* 소속 기관 — 세지 않음 */
    [/LH\s*토지주택연구원|토지주택연구원|LHRI|LHI\b/g, "LH 토지주택연구원", "res"],
    [/한국토지주택공사|\bLH\b/g, "한국토지주택공사(LH)", "pub"],
    [/경기주택도시공사|\bGH\b/g, "경기주택도시공사(GH)", "pub"],
    [/서울주택도시(개발)?공사|SH공사|\bSH\b(?!도시연구원)/g, "서울주택도시공사(SH)", "pub"],
    [/SH\s*도시연구원/g, "SH도시연구원", "res"],
    [/인천도시공사|\biH\b/g, "인천도시공사(iH)", "pub"],
    [/건축공간연구원|AURI/g, "건축공간연구원(AURI)", "res"],
    [/한국국방연구원|KIDA/g, "한국국방연구원", "res"],
    [/한국교육개발원|KEDI/g, "한국교육개발원(KEDI)", "res"],
    [/KAIST|카이스트/g, "KAIST", "uni"],
    [/서울대학교|서울대(?!학)/g, "서울대학교", "uni"],
    [/서울시립대(학교)?/g, "서울시립대학교", "uni"],
    [/(국립)?공주대학교/g, "국립공주대학교", "uni"],
    [/고양(시정)?연구원/g, "고양연구원", "res"],
    [/평택(시)?발전협의회/g, "(사)평택시발전협의회", "civ"],
    [/서울부동산포럼|경기미래포럼|한국철도건축포럼|건설주택포럼|평택소통상생포럼|평택로컬포럼/g, "$&", "civ"],
    [/(대한)?국토\s*[·ㆍ]?\s*도시계획학회/g, "대한국토·도시계획학회", "uni"],
    [/한국전과정(평가)?학회/g, "한국전과정평가학회", "uni"],
    [/도코모모(\s*코리아)?|근대도시건축연구소/g, "도코모모 코리아", "civ"],
    [/이코모스|ICOMOS/g, "ICOMOS Korea", "uni"],
    [/유네스코/g, "유네스코", "gov"],
    [/국회의원회관|국회의사당|국회의원|국회|이재강|박지혜|송영길|이재정\s*(국회)?의원/g, "국회", "par"],
    [/경기도의회/g, "경기도의회", "par"],
    [/인천광역시의회|인천시의회/g, "인천광역시의회", "par"],
    [/의왕시의회/g, "의왕시의회", "par"],
    [/국토교통부|국토부/g, "국토교통부", "gov"],
    [/교육부/g, "교육부", "gov"],
    [/행정안전부|행안부/g, "행정안전부", "gov"],
    [/문화재청|국가유산청/g, "국가유산청(문화재청)", "gov"],
    [/지방시대위원회/g, "지방시대위원회", "gov"],
    [/국방기술품질원/g, "국방기술품질원", "gov"],
    [/지상작전사령부|육군본부|합참/g, "군(지작사·육군)", "gov"],
    [/경기도교육청/g, "경기도교육청", "gov"],
    [/경기도인재개발원|인재개발원/g, "경기도인재개발원", "gov"],
    [/경기도청|(^|[\s,·(（])경기도(?=$|[\s,·)）]|청)/g, "경기도", "gov"],
    [/평택시청|평택시(?!발전|남부|정)/g, "평택시", "gov"],
    [/양주시청|양주시(?!정)/g, "양주시", "gov"],
    [/파주시/g, "파주시", "gov"],
    [/의정부시(?!미군)/g, "의정부시", "gov"],
    [/수원특례시|수원시(?!정연구원)/g, "수원시", "gov"],
    [/안양시/g, "안양시", "gov"],
    [/고양시(?!정)/g, "고양시", "gov"],
    [/포천시/g, "포천시", "gov"],
    [/이천시/g, "이천시", "gov"],
    [/인천광역시(?!\s*의회)|인천시(?!의회)/g, "인천광역시", "gov"],
    [/서울시(?!립)|서울특별시|서초구/g, "서울특별시", "gov"],
    [/부평구/g, "인천 부평구", "gov"],
    [/전라남도|전남도/g, "전라남도", "gov"],
    [/경상북도|경북도/g, "경상북도", "gov"],
    [/한국수자원공사|K-?water/g, "한국수자원공사", "pub"],
    [/한국농어촌공사|농어촌공사/g, "한국농어촌공사", "pub"],
    [/한국감정원|한국부동산원/g, "한국부동산원(감정원)", "pub"],
    [/캠코|한국자산관리공사/g, "한국자산관리공사(캠코)", "pub"],
    [/한국철도공사|코레일/g, "한국철도공사", "pub"],
    [/경기문화재단/g, "경기문화재단", "pub"],
    [/경기창조경제혁신센터/g, "경기창조경제혁신센터", "pub"],
    [/산동사회과학원/g, "산동사회과학원(중국)", "res"],
    [/서울신문|MBN|언론인클럽/g, "언론", "civ"],
    [/한국모빌리티고(등학교)?/g, "한국모빌리티고", "civ"],
    [/미군반환공여지\s*시민참여위원회|시민참여위원회/g, "의정부 시민참여위원회(CRC)", "civ"]
  ];

  /* 별칭에 없던 기관 — 끝말로 찾습니다 */
  var GENERIC = /(?:\(사\)\s*|（사）\s*)?([가-힣A-Za-z]{2,14}(?:대학교|연구원|학회|공사|협의회|협회|재단|연구소))/g;
  function typeBySuffix(n) {
    if (/대학교|학회/.test(n)) return "uni";
    if (/금융연구소/.test(n)) return "civ";
    if (/연구원|연구소/.test(n)) return "res";
    if (/공사|재단/.test(n)) return "pub";
    return "civ";
  }
  var DROP = /^(전문가|정책|발전|세미나|연구|미래|학술|공동|도시|지역|건축|시도)$/;

  /* 글 하나에서 기관을 찾아 [{at, name, type}] 로 — 별칭 먼저, 그다음 끝말 */
  function scan(txt) {
    var hits = [];
    txt = " " + String(txt || "") + " ";
    ORG_RULES.forEach(function (r) {
      txt = txt.replace(r[0], function (m) {
        var at = arguments[arguments.length - 2];
        if (r[1]) hits.push({ at: at, name: r[1] === "$&" ? m.trim() : r[1], type: r[2] });
        return new Array(m.length + 1).join(" ");      /* 자리는 그대로 두고 지웁니다 */
      });
    });
    var m;
    GENERIC.lastIndex = 0;
    while ((m = GENERIC.exec(txt))) {
      var n = m[1].replace(/^(前|現)\s*/, "");
      var stem = n.replace(/(대학교|연구원|학회|공사|협의회|협회|재단|연구소)$/, "");
      if (DROP.test(stem) || stem.length < 2) continue;
      hits.push({ at: m.index, name: n, type: typeBySuffix(n), sub: /연구소$/.test(n) });
    }
    return hits.sort(function (a, b) { return a.at - b.at; });
  }

  function orgsOf(t, info) {
    var found = {}, list = [];
    function add(h) {
      if (!h || !h.name || found[h.name]) return;
      found[h.name] = 1;
      list.push({ name: h.name, type: h.type });
    }
    var texts = [t.host || ""];
    if (info) texts.push(info.event || "", info.host || "", info.org || "", info.support || "");
    texts.forEach(function (txt) {
      var hs = scan(txt);
      /* 대학 안 연구소처럼 다른 기관과 같이 적힌 「…연구소」 는 빼고 */
      var main = hs.filter(function (h) { return !h.sub; });
      (main.length ? main : hs).forEach(add);
    });
    /* 함께한 분의 소속은 맨 앞 기관 하나만 (「고려대학교 정부학연구소」 → 고려대학교) */
    ((info && info.people) || []).forEach(function (p) {
      if (p.name === "남지현") return;
      add(scan(p.org)[0]);
    });
    return list;
  }

  /* 제목으로 먼저 보고, 제목에 아무 낱말도 없으면 행사명·주최까지 봅니다 */
  function fieldsOf(t, info) {
    function pick(text) {
      var out = [];
      FIELDS.forEach(function (f) {
        var kws = [];
        f.kw.forEach(function (k, i) { if (k[1].test(text)) kws.push(i); });
        if (kws.length) out.push({ id: f.id, kws: kws });
      });
      return out;
    }
    var out = pick(String(t.title || ""));
    if (!out.length) out = pick([t.host, info && info.event].filter(Boolean).join(" "));
    return out;
  }

  function lensOf(t) {
    var s = (t.title || "") + " " + (t.host || "");
    return LENS.filter(function (l) { return l[1].test(s); }).map(function (l) { return l[0]; });
  }

  /* 그 발표에서 맡은 역할 — 행사 개요의 role(발표 형식)에서 처음 나오는 낱말로.
     적힌 것이 없으면 제목(「— 지정토론」 등)과 갈래(특강·교육)로 짐작하고, 그래도 없으면 발표. */
  var ROLES = [
    { id: "chair",   name: "좌장",     re: /좌장/ },
    { id: "keynote", name: "기조발제", re: /기조/ },
    { id: "talk",    name: "발표",     re: /발표|발제/ },
    { id: "disc",    name: "토론",     re: /토론|패널|토의/ },
    { id: "lect",    name: "강연",     re: /특강|강의|강연/ },
    { id: "adv",     name: "자문",     re: /자문|위원/ },
    { id: "host",    name: "주관",     re: /주관/ },
    { id: "attend",  name: "참석",     re: /참관|참석/ }
  ];
  var ROLE = {};
  ROLES.forEach(function (r) { ROLE[r.id] = r; });
  function roleOf(t, info) {
    var s = String((info && info.role) || "");
    var best = null, at = 1e9;
    ROLES.forEach(function (r) {
      var m = r.re.exec(s);
      if (m && m.index < at) { at = m.index; best = r; }
    });
    if (best) return best;
    if (/(지정|종합|패널)?토론$/.test(String(t.title || ""))) return ROLE.disc;
    if (/^(특강|교육|강연)$/.test(t.tag || "")) return ROLE.lect;
    if (/^(참관)$/.test(t.tag || "")) return ROLE.attend;
    if (/^(자문)$/.test(t.tag || "")) return ROLE.adv;
    return ROLE.talk;
  }

  /* 소속 글 → 대표 기관 이름 하나 (별칭으로 모은 이름, 없으면 글 그대로) */
  function orgName(txt) {
    var h = scan(txt)[0];
    return h ? h.name : String(txt || "").replace(/\s+/g, " ").trim();
  }

  var api = { FIELDS: FIELDS, KINDS: KINDS, TYPES: TYPES, LENS: LENS,
              kindOf: kindOf, fieldsOf: fieldsOf, orgsOf: orgsOf, lensOf: lensOf, orgName: orgName,
              ROLES: ROLES, roleOf: roleOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TalkStats = api;
})(typeof window !== "undefined" ? window : this);
