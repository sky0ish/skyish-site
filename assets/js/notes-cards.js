// ─── 일정에 적힌 사람 ↔ 명함첩 짝짓기 ───────────────────────
//
//  Schedule·Diary 글의 「만난 사람」 칸에 적힌 이름을,
//  내 명함첩(리멤버에서 내보낸 엑셀)의 사람과 맞춰 봅니다.
//  맞으면 달력에 그 사람의 명함을 얹습니다.
//
//  ※ 명함첩은 개인정보입니다. 이 모듈은 자료를 어디로도 보내지 않습니다.
//     명함첩 엑셀은 내 컴퓨터에 있고, 브라우저가 직접 읽어 화면에만 씁니다.
//     GitHub 에도 Supabase 에도 한 글자도 올라가지 않습니다.
//
//  ※ 리멤버가 내보내는 엑셀에는 **명함 사진이 들어 있지 않습니다**
//     (칸은 회사·이름·부서·직함·이메일·주소·전화·팩스·휴대폰·등록일·
//      명함첩이름·그룹·메모 열셋뿐입니다). 그래서 글자로 명함 꼴을
//      그립니다. 뒷날 스캔 그림이 생기면 card.image 에 주소만 넣으면
//      그 자리에 그대로 들어갑니다.
//
//  화면이 없는 셈 모듈입니다 — node 로 곧바로 시험할 수 있습니다
//  (tools/test/cards.mjs).
import { justName } from "./notes-stats.js?v=202609010300";

/** 이름을 맞대볼 열쇠로 — 사이 띄기를 없애고 소문자로 */
export const keyOf = (name) =>
  String(name || "").replace(/\s+/g, "").toLowerCase();

/** 「이석준 (이천시청), 남지현 경기연구원 선임연구위원」 → ["이석준","남지현"]
 *  쉼표·가운뎃점으로 끊고, 토막마다 사람 이름만 골라냅니다.
 *  같은 사람이 두 번 적혀 있으면 한 번만 돌려줍니다. */
export function splitPeople(text) {
  const out = [];
  const seen = new Set();
  String(text || "")
    .split(/\s*[,、·;/]\s*|\n+/)
    .forEach((part) => {
      const n = justName(part);
      if (!n || n.length < 2) return;
      const k = keyOf(n);
      if (seen.has(k)) return;
      seen.add(k);
      out.push(n);
    });
  return out;
}

/** 명함 목록 → 이름으로 찾는 표.
 *  동명이인이 있으므로 열쇠 하나에 여러 장이 달릴 수 있습니다.
 *  @param cards  addressbook.js 의 fromRemember() 가 낸 것들
 *  @returns Map<열쇠, card[]>
 */
export function buildIndex(cards) {
  const m = new Map();
  (Array.isArray(cards) ? cards : []).forEach((c) => {
    if (!c || !c.name) return;
    if (c.src && c.src !== "card") return;      // 명함첩만 (동문 명부는 뺍니다)
    const k = keyOf(c.name);
    if (!k) return;
    const l = m.get(k) || [];
    l.push(c);
    m.set(k, l);
  });
  return m;
}

/** 글 하나의 「만난 사람」 을 명함과 맞춥니다.
 *  @returns [{name, cards:[…], one:card|null}]
 *           one — 딱 한 장만 걸렸을 때 그 장 (동명이인이면 null)
 *           걸린 것이 없는 사람은 아예 빼고 돌려줍니다.
 */
export function matchPeople(peopleText, index) {
  if (!index || !index.size) return [];
  return splitPeople(peopleText)
    .map((name) => {
      const cards = index.get(keyOf(name)) || [];
      return { name, cards, one: cards.length === 1 ? cards[0] : null };
    })
    .filter((x) => x.cards.length);
}

/** 여러 글에서 한 번에 — 그날 만난 사람의 명함을 모읍니다.
 *  같은 사람이 여러 글에 나와도 한 번만 나옵니다.
 *  @param rows  그날의 글들 ({people} 칸을 봅니다)
 */
export function cardsForDay(rows, index) {
  const out = [];
  const seen = new Set();
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    matchPeople(r && r.people, index).forEach((hit) => {
      const k = keyOf(hit.name);
      if (seen.has(k)) return;
      seen.add(k);
      out.push(hit);
    });
  });
  return out;
}

/** 명함에 찍을 줄들 — 없는 칸은 알아서 빠집니다.
 *  @returns {name, title, company, dept, lines:[…]}
 */
export function cardFace(c) {
  const t = (v) => String(v == null ? "" : v).trim();
  return {
    name: t(c && c.name),
    title: t(c && c.title),
    company: t(c && c.company),
    dept: t(c && c.orgDept),
    lines: [t(c && c.mobile), t(c && c.phone), t(c && c.email)].filter(Boolean),
    image: t(c && c.image),          // 뒷날 스캔 그림이 생기면 여기에
  };
}

/** 자세히 볼 때 보여줄 칸들 — [이름표, 값] 짝으로 */
export function cardDetail(c) {
  const t = (v) => String(v == null ? "" : v).trim();
  return [
    ["회사", t(c && c.company)],
    ["부서", t(c && c.orgDept)],
    ["직함", t(c && c.title)],
    ["휴대폰", t(c && c.mobile)],
    ["직통", t(c && c.phone)],
    ["메일", t(c && c.email)],
    ["주소", t(c && c.addr)],
    ["그룹", t(c && c.tag)],
    ["명함 받은 날", t(c && c.at)],
  ].filter(([, v]) => v);
}
