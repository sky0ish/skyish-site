# -*- coding: utf-8 -*-
"""
출장지 뽑기 — gri.json 의 글마다 구체적인 방문 장소·기관 목록(places)을 넣습니다.

  재료: 요약(summary)·요점(points) 가운데 방문·답사·면담 문장,  PDF 글(_text/*.txt)의 「출장지 / 방문기관 / 방문지」 항목,
        그리고 본문에서 기관·도시처럼 보이는 낱말(…시, …대학, …청, …센터, University, Authority …).
  홈페이지(assets/js/travel-gri.js)는 places 를 「출장지」 줄로 보여 주고 찾기에도 씁니다.

돌리는 법 :  python tools/travel/gri_places.py         → gri.json 을 고쳐 씁니다 (다른 칸은 손대지 않음)
"""
import io, json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
HOME = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
D = os.path.join(HOME, "11.해외출장보고_Data")

SUFFIX = r"(시|구|현|주|市|省|県|대학교|대학|연구소|연구원|연구센터|센터|청|공사|공단|협회|박물관|미술관|공원|역|공항|항|위원회|기구|재단|지구|단지|타워|파크|갤러리|전시관|본부|사무소|시청|구청|도서관|병원|캠퍼스|스퀘어|타운|플라자|광장|시티|마을|마켓|시장|거리|성|궁|사원|대성당|성당|교회|캠프|기지|은행|거래소|회사|기업|공장|스테이션|터미널|부두|항만|댐|발전소|농장|주택단지|빌리지|국립공원|Park|Center|Centre|Authority|Council|University|Institute|Agency|Ministry|City|Museum|Lab|Laboratory|Office|Corporation|Company|Bureau|Department|Tech|Hall|Station|District|Zone|Campus|Foundation|Association|School|College|Library|Hospital|Airport|Port|Bank|Tower|Square|Market|Village|Garden|Gallery)"
VISIT = re.compile(r"방문|답사|견학|면담|시찰|조사|참관|탐방|현장")
STOP = {"경기연구원", "경기개발연구원", "경기도", "한국", "우리나라", "국내", "해외", "현지", "출장", "연구원", "연구위원", "경기도청", "본원", "센터", "시청", "대학"}
SPLIT = re.compile(r"\s*(?:,|·|ㆍ|/|및|과|와|등을|등|을|를|에서|에|의)\s+|\s*(?:,|·|ㆍ|/)\s*|\(|\)")

def cands_from(text):
    out = []
    for sent in re.split(r"(?<=[.。])\s+|\n", text or ""):
        if not VISIT.search(sent): continue
        for tok in SPLIT.split(sent):
            tok = (tok or "").strip(" .:;'\"「」『』[]")
            tok = re.sub(r"(을|를|에서|에|의|은|는|도)$", "", tok).strip()
            if not (2 <= len(tok) <= 40): continue
            if tok in STOP: continue
            kor = re.fullmatch(r"[가-힣A-Za-z0-9&\-\s]+", tok)
            if not kor: continue
            if re.search(SUFFIX + r"$", tok) or re.fullmatch(r"(?:[A-Z][A-Za-z&\-]+\s?){2,6}", tok) or re.fullmatch(r"[A-Z]{2,6}", tok):
                out.append(tok)
    return out

def section_from(text):
    m = re.search(r"(출장\s*지역?|방문\s*기관|방문\s*지|방문처|방문\s*장소|출장\s*장소)\s*[:：]?\s*(.{0,400})", text or "")
    if not m: return []
    seg = re.split(r"\n\s*\n|◦\s*출\s*장\s*자|출장자|기간|일정\s*[:：]", m.group(2))[0]
    toks = [t.strip(" .:;'\"「」『』[]") for t in re.split(r"[,、·ㆍ/()\n]|\s및\s|\s등\s?", seg)]
    return [t for t in toks if 2 <= len(t) <= 40 and re.fullmatch(r"[가-힣A-Za-z0-9&\-\s]+", t) and t not in STOP]

BAD = re.compile(r"면담|답사|방문|조사|내용|개요|특성|현황|사항|가능성|토론|교육|반성|자주|비슷|같은|주요|주 요|일정|기간|출장|보고|참석|관련|우리|저희|이번|해당|다음|각종|전역|글로벌|양 지역|육성|^근 |^[가-힣]+기업$|추진|계획$|방안$")
LEAD = re.compile(r"^(?:\S+(?:고|해|하고|하여|해서|따라|위해|통해|매년|및|근|양|에서는|에서|는|은|이|가)\s+)+")
GENERIC = {"지역", "도시", "시장", "시청", "센터", "대학", "공원", "공항", "역", "항", "청", "구", "시", "본부", "회사", "기업", "단지", "마을", "거리", "성", "구청"}
def clean(tok, names):
    t = LEAD.sub("", tok).strip()
    t = re.sub(r"^(?:독일|일본|중국|미국|영국|프랑스|대만|싱가포르|말레이시아|인도네시아|베트남|태국|호주|캐나다|네덜란드|스웨덴|덴마크|핀란드|노르웨이|스페인|이탈리아|오스트리아|스위스|체코|폴란드|헝가리|벨기에|아랍에미리트|라오스|몽골|필리핀|인도|브라질|멕시코|러시아|터키|튀르키예|이스라엘|홍콩|마카오)(?:의|에서|에서는)?\s+", "", t)
    if BAD.search(t) or t in GENERIC or t in names: return ""
    if re.search(r"\s[가-힣]\s[가-힣]", t): return ""          # "주 요 내 용" 같은 띄어쓴 낱글자
    if len(t) < 2 or len(t) > 32: return ""
    if re.fullmatch(r"[가-힣]{2,3}", t) and not re.search(SUFFIX + r"$", t): return ""
    return t

def main():
    doc = json.load(io.open(os.path.join(D, "gri.json"), encoding="utf-8"))
    n = 0
    for p in doc["posts"]:
        places = []
        for src in [p.get("summary") or "", " ".join(p.get("points") or [])]:
            places += cands_from(src)
        for f in p.get("files") or []:
            tp = os.path.join(D, "_text", re.sub(r"\.\w+$", "", f["file"]) + ".txt")
            if os.path.exists(tp):
                t = io.open(tp, encoding="utf-8").read()
                places += section_from(t[:20000])
                if len(places) < 4:
                    places += cands_from(t[:15000])
        seen, out = set(), []
        names = set(p.get("travelers") or [])
        for x in places:
            x = clean(x, names)
            if not x: continue
            k = re.sub(r"\s+", "", x).lower()
            if k in seen or any(k in re.sub(r"\s+", "", c).lower() for c in (p.get("countries") or [])): continue
            seen.add(k); out.append(x)
        p["places"] = out[:12]
        if out: n += 1
    json.dump(doc, io.open(os.path.join(D, "gri.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"출장지 있음 {n}/{len(doc['posts'])}건")
    for p in doc["posts"][:6]: print(p["num"], p["countries"], p["places"])

if __name__ == "__main__":
    main()
