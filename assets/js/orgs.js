// ─── 활동기관 — 내가 몸담고 있는 곳 ─────────────────────────
//
//  CONTACT 화면의 「활동기관」 갈래입니다.
//  배너를 누르면 그 기관 홈페이지로 곧바로 갑니다.
//
//  · 자료는 아래 ORGS 에 그대로 적어 둡니다 — Supabase 도, SQL 도 필요 없습니다.
//    기관을 더하거나 고치시려면 이 목록만 손보면 됩니다.
//  · 누구나 볼 수 있는 갈래입니다 (주소록·Sites 와 달리 관리자 전용이 아닙니다).
//  · 마크 그림은 바깥에서 불러오지 않습니다 — 보는 분이 어느 기관 쪽에
//    들렀는지 그 기관 서버에 알려지지 않도록. 파일을 넣어 두면 그때 씁니다.

/** 배너 하나 = { key, name, en, url, note, color, mark }
 *    key    : 로고 파일 이름에 씁니다 (assets/img/orgs/<key>.png)
 *    name   : 배너에 크게 나오는 이름
 *    en     : 그 아래 작은 영문 이름 (없으면 빈 글)
 *    url    : 누르면 갈 곳
 *    note   : 내가 그곳에서 무엇을 하는지 한 줄
 *    color  : 배너 왼쪽 띠와 글자에 쓰는 그 기관의 빛깔
 *    mark   : 로고가 없을 때 대신 쓰는 두 글자
 */
export const ORGS = [
  {
    key: "gri", name: "경기연구원",
    en: "Gyeonggi Research Institute",
    url: "https://www.gri.re.kr",
    note: "선임연구위원 — 도시·공간 정책 연구",
    color: "#004b8d", mark: "경기",
  },
  {
    key: "ggedc", name: "경기도 지역균형발전지원센터",
    en: "Gyeonggi Regional Balanced Development Support Center",
    url: "https://gri.re.kr/ggedc/",
    note: "지역균형발전사업 평가·모니터링 · Equity Map",
    color: "#0f8a97", mark: "균형",
  },
  {
    key: "utokyo", name: "재한 도쿄대학 총동문회",
    en: "The University of Tokyo Alumni Association in Korea",
    url: "https://u-tokyo.kr/OB/",
    note: "동문 모임 — 2011년 창립",
    color: "#a8842f", mark: "東大",
  },
  {
    key: "krda", name: "한국지역개발학회",
    en: "Korean Regional Development Association",
    url: "https://krda.org",
    note: "학회 활동 — 지역개발·균형발전",
    color: "#253d86", mark: "지역",
  },
  {
    key: "ggic", name: "경기도 산업단지계획심의위원회",
    en: "Gyeonggi Industrial Complex Planning Committee",
    url: "https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=1839135",
    note: "심의위원 — 설치·운영 조례",
    color: "#6a5a9a", mark: "심의",
  },
];

/* 마크 그림을 넣어 두신 기관만 여기 적습니다.
   assets/img/orgs/gri.png 처럼 파일을 두고 key 를 이 줄에 더하면 그림이 뜹니다.
   (없는 파일을 부르면 화면마다 헛걸음이 생기므로 있는 것만 적습니다.) */
export const HAS_LOGO = new Set([]);

const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** 주소에서 보기 좋은 이름만 — https://www.gri.re.kr/… → gri.re.kr */
export function host(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); }
  catch (e) { return String(u || "").replace(/^https?:\/\//, "").split("/")[0]; }
}

/** 배너 한 장 */
export function bannerHtml(o) {
  const logo = HAS_LOGO.has(o.key) ? "assets/img/orgs/" + o.key + ".png" : "";
  return `<a class="obanner" href="${esc(o.url)}" target="_blank" rel="noopener"` +
    ` style="--c:${esc(o.color || "#4f9d92")}">` +
      '<span class="obanner__mark">' +
        (logo
          ? `<img src="${esc(logo)}" alt="" width="52" height="52" loading="lazy" decoding="async">`
          : `<b>${esc(o.mark || o.name.slice(0, 2))}</b>`) +
      "</span>" +
      '<span class="obanner__txt">' +
        `<b class="obanner__ko">${esc(o.name)}</b>` +
        (o.en ? `<span class="obanner__en">${esc(o.en)}</span>` : "") +
        (o.note ? `<span class="obanner__note">${esc(o.note)}</span>` : "") +
      "</span>" +
      `<span class="obanner__go"><span>${esc(host(o.url))}</span>↗</span>` +
    "</a>";
}

/**
 * 활동기관 갈래를 그립니다.
 * @returns 늘 true — 누구나 보는 갈래라 지워지는 일이 없습니다.
 */
export function initOrgs(mountId = "orgsapp") {
  const mount = document.getElementById(mountId);
  if (!mount) return false;
  mount.innerHTML = '<div class="ogrid">' + ORGS.map(bannerHtml).join("") + "</div>";
  return true;
}
