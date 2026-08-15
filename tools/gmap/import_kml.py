"""Google 내 지도(My Maps) 에서 내보낸 KML/KMZ 를 지도에 넣을 SQL 로 바꿉니다.

쓰는 법
    python tools/gmap/import_kml.py 주차장.kmz --grp daily  --cat food
    python tools/gmap/import_kml.py 일본출장.kmz --grp trip --cat hot

    갈래(--grp) : hot(핫플) urban(도시건축) estate(부동산)
                  trip(여행) daily(일상) etc(기타)
    분류(--cat) : food(맛집) cafe(카페) apt(아파트) arch(건축물) hot(핫플)

결과 : 같은 이름의 .sql 파일이 옆에 만들어집니다.
       Supabase → SQL Editor 에 붙여넣고 Run 하시면 지도에 올라갑니다.

주의 : created_by 는 올리는 분의 계정 번호가 필요합니다.
       아래 SQL 이 스스로 찾아 넣도록 되어 있으니, 이메일만 맞춰 주세요.
"""
import argparse
import io
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {"k": "http://www.opengis.net/kml/2.2"}


def read_kml(path):
    """kmz 면 안에서 kml 을 꺼내고, kml 이면 그대로 읽습니다."""
    if path.lower().endswith(".kmz"):
        with zipfile.ZipFile(path) as z:
            name = next((n for n in z.namelist() if n.lower().endswith(".kml")), None)
            if not name:
                sys.exit("kmz 안에 kml 이 없습니다: " + path)
            return z.read(name).decode("utf-8", "replace")
    with io.open(path, encoding="utf-8", errors="replace") as f:
        return f.read()


def strip_html(s):
    s = re.sub(r"<br\s*/?>", "\n", s or "", flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    s = s.replace("&quot;", '"').replace("&#39;", "'").replace("&nbsp;", " ")
    return re.sub(r"[ \t]*\n[ \t]*", "\n", s).strip()


def places(kml):
    root = ET.fromstring(kml)
    out = []
    for pm in root.iter("{http://www.opengis.net/kml/2.2}Placemark"):
        name = pm.findtext("k:name", "", NS).strip()
        desc = strip_html(pm.findtext("k:description", "", NS))
        pt = pm.find(".//k:Point/k:coordinates", NS)
        if pt is None or not (pt.text or "").strip():
            continue                       # 선·면은 건너뜁니다 (장소만 가져옵니다)
        bits = pt.text.strip().split(",")
        try:
            lng, lat = float(bits[0]), float(bits[1])
        except (ValueError, IndexError):
            continue
        # 설명의 첫 줄은 '특징', 나머지는 '기억' 으로 나눠 담습니다
        head, _, rest = desc.partition("\n")
        out.append({
            "name": name or "이름 없는 장소",
            "note": head.strip()[:200],
            "memory": rest.strip()[:600],
            "lat": lat, "lng": lng,
        })
    return out


def q(s):
    """SQL 홑따옴표 감싸기"""
    return "'" + (s or "").replace("'", "''") + "'"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path", help="내보낸 .kml 또는 .kmz")
    ap.add_argument("--grp", default="etc",
                    choices=["hot", "urban", "estate", "trip", "daily", "etc"])
    ap.add_argument("--cat", default="hot",
                    choices=["food", "cafe", "apt", "arch", "hot"])
    ap.add_argument("--email", default="whlove@gmail.com",
                    help="올리는 분의 로그인 이메일")
    a = ap.parse_args()

    rows = places(read_kml(a.path))
    if not rows:
        sys.exit("가져올 장소가 없습니다. (선·면만 있는 지도일 수 있습니다)")

    dst = os.path.splitext(a.path)[0] + ".sql"
    with io.open(dst, "w", encoding="utf-8") as f:
        f.write("-- %s 에서 가져온 장소 %d곳\n" % (os.path.basename(a.path), len(rows)))
        f.write("-- 갈래: %s · 분류: %s\n" % (a.grp, a.cat))
        f.write("-- Supabase → SQL Editor 에 붙여넣고 Run 하세요.\n\n")
        f.write("insert into public.map_places\n"
                "  (grp, category, name, address, note, memory, lat, lng,\n"
                "   owner_name, owner_admin, created_by)\n"
                "select %s, %s, v.name, '', nullif(v.note,''), nullif(v.memory,''),\n"
                "       v.lat, v.lng,\n"
                "       '', coalesce(p.is_admin,false), p.id\n"
                "  from (values\n" % (q(a.grp), q(a.cat)))
        vals = []
        for r in rows:
            vals.append("    (%s, %s, %s, %r::double precision, %r::double precision)"
                        % (q(r["name"]), q(r["note"]), q(r["memory"]),
                           r["lat"], r["lng"]))
        f.write(",\n".join(vals))
        f.write("\n  ) as v(name, note, memory, lat, lng)\n")
        f.write("  cross join (select id, is_admin from public.profiles\n"
                "               where email = %s limit 1) p;\n" % q(a.email))

    print("saved %d places -> %s" % (len(rows), dst))


if __name__ == "__main__":
    main()
