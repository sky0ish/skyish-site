# -*- coding: utf-8 -*-
"""
요약 재료 만들기 — 11.해외출장보고_Data/_sum_in/<번호>.txt

  gri.json 의 글마다 (게시글 개요 + PDF 본문 앞 9,000자 + 뒤 3,000자) 를 한 파일로 묶습니다.
  요약은 Claude 요원들이 이 파일을 읽고 씁니다 (tools/travel/gri_sum_merge.py 가 gri.json 에 합칩니다).

돌리는 법 :  python tools/travel/gri_sum_prep.py      → 묶음(batch) 목록을 JSON 으로 찍습니다
"""
import io, json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
HOME = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
D = os.path.join(HOME, "11.해외출장보고_Data")
IN = os.path.join(D, "_sum_in")
HEAD, TAIL = 9000, 3000
PER_BATCH = int(sys.argv[1]) if len(sys.argv) > 1 else 13

doc = json.load(io.open(os.path.join(D, "gri.json"), encoding="utf-8"))
os.makedirs(IN, exist_ok=True)
made = []
for p in doc["posts"]:
    parts = [f"# 게시글 {p['num']}번 · {p['postTitle']}",
             f"출장명: {p['trip']}", f"기간: {p['period']}", f"지역: {p['where'] or ', '.join(p['countries'])}",
             f"출장자: {p['who'] or ', '.join(p['travelers'])}", "", "## 게시글 본문", p["body"] or "(없음)", ""]
    n_text = 0
    for f in p["files"]:
        if f["kind"] != "pdf":
            parts.append(f"## 첨부 {f['orig']} — 글자를 뽑을 수 없는 형식(hwp)")
            continue
        tp = os.path.join(D, "_text", re.sub(r"\.\w+$", "", f["file"]) + ".txt")
        t = io.open(tp, encoding="utf-8").read() if os.path.exists(tp) else ""
        t = re.sub(r"[ \t]+", " ", t)
        t = re.sub(r"\n{3,}", "\n\n", t).strip()
        n_text += len(t)
        parts.append(f"## 첨부 {f['orig']} ({'보고서' if f['main'] else '부속 자료'}, 글자 {len(t):,})")
        if len(t) < 200:
            parts.append("(글자가 거의 없습니다 — 스캔한 문서로 보입니다)")
        elif len(t) <= HEAD + TAIL:
            parts.append(t)
        else:
            parts.append(t[:HEAD] + "\n\n…(중략)…\n\n" + t[-TAIL:])
        parts.append("")
    io.open(os.path.join(IN, f"{p['num']}.txt"), "w", encoding="utf-8").write("\n".join(parts))
    made.append({"num": p["num"], "chars": n_text, "path": os.path.join(IN, f"{p['num']}.txt")})

# 묶음 — 글자 수가 고르게 되도록 큰 것부터 돌려 가며 나눕니다
made.sort(key=lambda m: -m["chars"])
k = max(1, (len(made) + PER_BATCH - 1) // PER_BATCH)
batches = [[] for _ in range(k)]
for i, m in enumerate(made):
    batches[i % k].append(m)
out = [{"batch": i + 1, "nums": [m["num"] for m in sorted(b, key=lambda m: -m["num"])],
        "files": [m["path"] for m in sorted(b, key=lambda m: -m["num"])], "chars": sum(m["chars"] for m in b)} for i, b in enumerate(batches)]
io.open(os.path.join(IN, "_batches.json"), "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
print(json.dumps({"posts": len(made), "batches": len(out), "chars": [b["chars"] for b in out],
                  "noText": [m["num"] for m in made if m["chars"] < 200]}, ensure_ascii=False))
