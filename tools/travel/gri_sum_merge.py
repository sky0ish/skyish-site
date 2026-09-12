# -*- coding: utf-8 -*-
"""
요약 합치기 — 11.해외출장보고_Data/_sum/summaries.json → gri.json

  summaries.json 은 [{num, summary, points, basis}, …] 꼴입니다 (Claude 요원들이 쓴 것).
  gri.json 의 같은 번호 글에 summary · points · basis 를 넣습니다. 그 밖의 칸은 손대지 않습니다.

돌리는 법 :  python tools/travel/gri_sum_merge.py [summaries.json 경로]
"""
import io, json, os, sys, re
sys.stdout.reconfigure(encoding="utf-8")
HOME = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
D = os.path.join(HOME, "11.해외출장보고_Data")
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(D, "_sum", "summaries.json")

def tidy(s):
    s = str(s or "").replace("\r", "").strip()
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s

items = json.load(io.open(SRC, encoding="utf-8"))
if isinstance(items, dict):
    items = items.get("items") or items.get("posts") or []
by = {int(it["num"]): it for it in items if it and "num" in it}

gp = os.path.join(D, "gri.json")
doc = json.load(io.open(gp, encoding="utf-8"))
n = 0; empty = []; missing = []
for p in doc["posts"]:
    it = by.get(int(p["num"]))
    if not it:
        missing.append(p["num"]); continue
    p["summary"] = tidy(it.get("summary"))
    p["points"] = [tidy(x) for x in (it.get("points") or []) if tidy(x)]
    p["basis"] = it.get("basis") or ("보고서" if p["summary"] else "없음")
    if p["summary"]:
        n += 1
    else:
        empty.append(p["num"])
io.open(gp, "w", encoding="utf-8").write(json.dumps(doc, ensure_ascii=False, indent=1))
print(f"요약 넣음 {n}건 · 빈 요약 {len(empty)}건 {empty} · 요약 없는 글 {len(missing)}건 {missing}")
lens = sorted(len(p["summary"]) for p in doc["posts"] if p["summary"])
if lens:
    print(f"요약 길이 최소 {lens[0]} · 중간 {lens[len(lens)//2]} · 최대 {lens[-1]}")
