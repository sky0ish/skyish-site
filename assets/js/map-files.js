// ─── 지도에 내 파일 얹기 ────────────────────────────────────
//
//  KML · KMZ · GeoJSON · SHP(zip) 를 지도 위에 그대로 얹습니다.
//
//  ※ 파일은 어디로도 올라가지 않습니다.
//     브라우저가 읽어 화면에만 그립니다. 새로고침하면 사라집니다.
//     (계속 두고 보시려면 말씀해 주세요 — 보관함에 담는 길도 있습니다.)
//
//  SHP 는 .shp 하나만으로는 못 읽습니다.
//  .shp · .dbf · .prj 를 한 폴더에 넣고 zip 으로 묶어 올려 주세요.

const LIB = {
  togeo: "https://cdn.jsdelivr.net/npm/@tmcw/togeojson@5.8.1/+esm",
  zip:   "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm",
  shp:   "https://cdn.jsdelivr.net/npm/shpjs@6.1.1/+esm",
};

/** 파일 이름으로 갈래를 봅니다 */
export function kindOf(name) {
  const n = String(name || "").toLowerCase();
  if (n.endsWith(".kml")) return "kml";
  if (n.endsWith(".kmz")) return "kmz";
  if (n.endsWith(".geojson") || n.endsWith(".json")) return "geojson";
  if (n.endsWith(".zip")) return "shp";      // SHP 묶음
  if (n.endsWith(".shp")) return "shponly";  // 혼자서는 못 읽습니다
  return "";
}

const readText = (f) => new Promise((ok, no) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result || ""));
  r.onerror = () => no(new Error("파일을 읽지 못했습니다"));
  r.readAsText(f, "utf-8");
});

/** KML 글을 GeoJSON 으로 */
async function fromKmlText(text) {
  const { kml } = await import(/* @vite-ignore */ LIB.togeo);
  const doc = new DOMParser().parseFromString(text, "text/xml");
  const bad = doc.querySelector("parsererror");
  if (bad) throw new Error("KML 을 읽지 못했습니다");
  return kml(doc);
}

/**
 * 파일 하나를 GeoJSON 으로 바꿉니다.
 * @returns {Promise<{name:string, geojson:object, count:number}>}
 */
export async function toGeoJson(file) {
  const k = kindOf(file.name);
  if (k === "shponly") {
    throw new Error(".shp 하나만으로는 읽을 수 없습니다. " +
      ".shp · .dbf · .prj 를 함께 zip 으로 묶어 올려 주세요.");
  }
  if (!k) throw new Error("KML · KMZ · GeoJSON · SHP(zip) 만 읽습니다.");

  let gj;
  if (k === "geojson") {
    gj = JSON.parse(await readText(file));
  } else if (k === "kml") {
    gj = await fromKmlText(await readText(file));
  } else if (k === "kmz") {
    const JSZip = (await import(/* @vite-ignore */ LIB.zip)).default;
    const z = await JSZip.loadAsync(await file.arrayBuffer());
    const entry = Object.keys(z.files).find((n) => /\.kml$/i.test(n));
    if (!entry) throw new Error("KMZ 안에서 KML 을 찾지 못했습니다");
    gj = await fromKmlText(await z.files[entry].async("string"));
  } else if (k === "shp") {
    const shp = (await import(/* @vite-ignore */ LIB.shp)).default;
    gj = await shp(await file.arrayBuffer());
    // shpjs 는 zip 안에 여러 벌이 있으면 배열로 돌려줍니다 — 하나로 합칩니다
    if (Array.isArray(gj)) {
      gj = { type: "FeatureCollection",
             features: gj.flatMap((g) => (g && g.features) || []) };
    }
  }

  if (!gj || !gj.type) throw new Error("읽을 만한 도형이 없습니다");
  const count = gj.type === "FeatureCollection" ? (gj.features || []).length : 1;
  if (!count) throw new Error("도형이 하나도 없습니다");
  return { name: file.name.replace(/\.[^.]+$/, ""), geojson: gj, count };
}

/** 도형에 붙은 이름표를 찾아냅니다 */
export function labelOf(props) {
  if (!props) return "";
  for (const k of ["name", "Name", "NAME", "이름", "title", "제목",
                   "LABEL", "label", "SIG_KOR_NM", "EMD_KOR_NM", "ADM_NM"]) {
    if (props[k]) return String(props[k]);
  }
  const first = Object.values(props).find((v) => typeof v === "string" && v.trim());
  return first ? String(first) : "";
}

/** 속성을 사람이 읽을 표로 (너무 길면 자릅니다) */
export function propTable(props, max = 12) {
  const rows = Object.entries(props || {})
    .filter(([, v]) => v != null && v !== "")
    .slice(0, max);
  if (!rows.length) return "";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return '<table class="fprops">' + rows.map(([k, v]) =>
    `<tr><th>${esc(k)}</th><td>${esc(String(v).slice(0, 120))}</td></tr>`).join("") + "</table>";
}
