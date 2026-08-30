// ─── 달력 겹침 걷어내기 ─────────────────────────────────────
//
//  여기서 쓴 일정은 「구글 캘린더에도 넣기」 로 구글에도 들어갑니다.
//  그러면 달력에 같은 일이 두 번 그려집니다 —
//  내 글로 한 번, 구글에서 받아 온 것으로 또 한 번.
//
//  ■ 짐작하지 않습니다
//  처음에는 「같은 날 같은 시각이면 같은 일」 로 보려 했는데,
//  그러면 구글에만 적어 둔 진짜 약속이 소리 없이 사라집니다.
//  (10시에 「치과」 라고 게시판에 적어 두면, 같은 10시의 구글 일정
//   「아이 학교 상담」 이 달력에서 지워졌습니다.)
//  없는 겹침을 남기는 것보다 있는 약속을 지우는 쪽이 훨씬 큰일이라,
//  확실한 것 두 가지만 봅니다.
//
//    ⓪ 구글이 돌려준 일정 번호가 같다   ← 가장 확실합니다
//       글을 구글로 보낼 때 받은 번호(gcal_id)를 글에 적어 둡니다.
//       이름을 고치든 시각을 옮기든 끝까지 따라갑니다.
//    ① 같은 날, 제목이 글자 그대로 같다
//       번호를 적어 두기 전에 보낸 옛 글을 위한 길입니다.
//       구글로 보낼 때 제목을 그대로 쓰므로 어긋날 일이 없습니다.
//
//  이 둘에 안 걸리는 것은 「따로 적으신 다른 일」 로 보고 그대로 둡니다.
//
//  화면이 없는 셈 모듈입니다 — node 로 곧바로 시험할 수 있습니다
//  (tools/test/cal-merge.mjs).

/** 견주기 좋게 다듬습니다 — 사이 띄개·점·괄호를 털고 소문자로 */
export function norm(s) {
  return String(s == null ? "" : s)
    .toLowerCase()
    .replace(/[\s.,·・…\-_/\\()[\]{}<>「」『』〈〉"'`!?~:;|+*&#@]+/g, "");
}

const day = (v) => String(v == null ? "" : v).slice(0, 10);

/**
 * 구글 일정 가운데 「내가 여기서 쓴 글이 구글로 넘어간 것」 만 걸러 냅니다.
 *
 * @param notes    내 글 [{ event_date, title, tag, gcal_id }]
 * @param gEvents  구글 일정 [{ date, title, gid }]
 * @returns        남길 구글 일정 (들어온 차례 그대로)
 *
 * 한 글은 한 번만 짝지어집니다 — 글 하나에 구글 일정 둘이 몰려도
 * 하나만 걷히고 나머지는 남습니다.
 */
export function dropMirrors(notes, gEvents) {
  const G = Array.isArray(gEvents) ? gEvents : [];
  if (!G.length) return [];

  const N = (Array.isArray(notes) ? notes : []).map((n, i) => ({
    i,
    gid: (n && n.gcal_id) ? String(n.gcal_id) : "",
    d: day(n && n.event_date),
    // 구글로 보낼 때 말머리를 앞에 붙이므로, 붙인 꼴과 안 붙인 꼴을 다 봅니다
    full: norm(((n && n.tag) ? "[" + n.tag + "] " : "") + ((n && n.title) || "")),
    bare: norm((n && n.title) || ""),
  }));
  if (!N.length) return G.slice();

  const gs = G.map((e, i) => ({
    i,
    gid: (e && e.gid) ? String(e.gid) : "",
    d: day(e && e.date),
    k: norm(e && e.title),
  }));

  const usedNote = new Set();
  const mirrored = new Set();

  const pass = (same) => {
    gs.forEach((g) => {
      if (mirrored.has(g.i)) return;
      const hit = N.find((n) => !usedNote.has(n.i) && same(n, g));
      if (hit) { usedNote.add(hit.i); mirrored.add(g.i); }
    });
  };

  // ⓪ 구글 일정 번호가 같다 — 날짜·이름이 바뀌어도 따라갑니다
  pass((n, g) => !!n.gid && n.gid === g.gid);
  // ① 같은 날, 제목이 글자 그대로 같다
  pass((n, g) => !!n.d && n.d === g.d && !!g.k && (n.full === g.k || n.bare === g.k));

  return G.filter((_, i) => !mirrored.has(i));
}
