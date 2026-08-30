// ─── GPKG (GeoPackage) 로 내보내기 ─────────────────────────
//
//  체크한 갈래마다 레이어를 따로 만들어 파일 하나로 묶습니다.
//  QGIS 에서 열면 갈래별로 나뉘어 들어옵니다.
//
//  GPKG 는 속이 SQLite 입니다. 브라우저에는 SQLite 가 없으므로
//  sql.js (SQLite 를 웹어셈블리로 옮긴 것) 를 그때그때 받아 씁니다.
//
//  담는 규격 (OGC GeoPackage 1.3 중 점(Point)만 쓰는 최소한)
//    · SQLite 머리말의 application_id = "GPKG", user_version = 10200
//    · gpkg_spatial_ref_sys · gpkg_contents · gpkg_geometry_columns 세 표
//    · 레이어마다 표 하나, 좌표는 GeoPackage Binary (헤더 8바이트 + WKB 21바이트)
//    · 좌표계는 WGS84 경위도 (EPSG:4326)

const SQLJS = "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js";
const WASM  = "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/";

let SQL = null;
async function loadSql() {
  if (SQL) return SQL;
  if (!window.initSqlJs) {
    await new Promise((ok, no) => {
      const s = document.createElement("script");
      s.src = SQLJS;
      s.onload = ok;
      s.onerror = () => no(new Error("SQLite 꾸러미를 받지 못했습니다"));
      document.head.appendChild(s);
    });
  }
  SQL = await window.initSqlJs({ locateFile: (f) => WASM + f });
  return SQL;
}

/** 점 하나를 GeoPackage 가 알아보는 바이트로 */
export function pointBlob(lng, lat, srsId = 4326) {
  const b = new ArrayBuffer(8 + 21);
  const v = new DataView(b);
  // ── 머리말 8바이트 ──
  v.setUint8(0, 0x47);            // 'G'
  v.setUint8(1, 0x50);            // 'P'
  v.setUint8(2, 0);               // 판 0
  v.setUint8(3, 0x01);            // 작은끝(little endian) · 둘레상자 없음
  v.setInt32(4, srsId, true);     // 좌표계 번호
  // ── WKB 점 21바이트 ──
  v.setUint8(8, 1);               // 작은끝
  v.setUint32(9, 1, true);        // 1 = Point
  v.setFloat64(13, lng, true);    // 경도(x)
  v.setFloat64(21, lat, true);    // 위도(y)
  return new Uint8Array(b);
}

/** SQLite 가 쓰는 X'..' 꼴 16진 글자 */
const hex = (u8) => "X'" + [...u8].map((n) => n.toString(16).padStart(2, "0")).join("") + "'";
/** 표·칸 이름에 큰따옴표가 섞여도 깨지지 않게 */
const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
/** 값에 홑따옴표가 섞여도 깨지지 않게 */
const lit = (v) => (v == null || v === "") ? "NULL" : "'" + String(v).replace(/'/g, "''") + "'";


/**
 * 레이어 여럿을 GPKG 한 덩이로 만듭니다.
 * @param {Array} layers  [{ name, rows:[{lat,lng, ...칸}] , fields:[칸이름] }]
 * @returns {Uint8Array}  파일 내용
 */
export async function buildGpkg(layers) {
  const S = await loadSql();
  const db = new S.Database();
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  // ── SQLite 머리말 — 이게 없으면 GPKG 로 안 봅니다 ──
  db.run("PRAGMA application_id = 1196444487;");   // 'GPKG'
  db.run("PRAGMA user_version = 10200;");          // 1.2.0

  // ── 규격이 요구하는 세 표 ──
  db.run(`CREATE TABLE gpkg_spatial_ref_sys (
    srs_name TEXT NOT NULL, srs_id INTEGER PRIMARY KEY,
    organization TEXT NOT NULL, organization_coordsys_id INTEGER NOT NULL,
    definition TEXT NOT NULL, description TEXT);`);
  db.run(`CREATE TABLE gpkg_contents (
    table_name TEXT PRIMARY KEY, data_type TEXT NOT NULL,
    identifier TEXT UNIQUE, description TEXT DEFAULT '',
    last_change DATETIME NOT NULL, min_x DOUBLE, min_y DOUBLE,
    max_x DOUBLE, max_y DOUBLE, srs_id INTEGER);`);
  db.run(`CREATE TABLE gpkg_geometry_columns (
    table_name TEXT NOT NULL, column_name TEXT NOT NULL,
    geometry_type_name TEXT NOT NULL, srs_id INTEGER NOT NULL,
    z TINYINT NOT NULL, m TINYINT NOT NULL,
    CONSTRAINT pk_geom_cols PRIMARY KEY (table_name, column_name));`);

  const WGS84 = 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,' +
    'AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,' +
    'AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],' +
    'AUTHORITY["EPSG","4326"]]';
  db.run(`INSERT INTO gpkg_spatial_ref_sys VALUES
    ('Undefined cartesian SRS', -1, 'NONE', -1, 'undefined', NULL),
    ('Undefined geographic SRS', 0, 'NONE', 0, 'undefined', NULL),
    ('WGS 84 geodetic', 4326, 'EPSG', 4326, ${lit(WGS84)}, NULL);`);

  layers.forEach((L) => {
    const rows = (L.rows || []).filter((r) =>
      Number.isFinite(+r.lat) && Number.isFinite(+r.lng));
    if (!rows.length) return;

    const cols = L.fields || [];
    db.run(`CREATE TABLE ${q(L.name)} (
      fid INTEGER PRIMARY KEY AUTOINCREMENT,
      geom BLOB${cols.length ? ", " + cols.map((c) => q(c) + " TEXT").join(", ") : ""});`);

    let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
    rows.forEach((r) => {
      const lng = +r.lng, lat = +r.lat;
      x0 = Math.min(x0, lng); x1 = Math.max(x1, lng);
      y0 = Math.min(y0, lat); y1 = Math.max(y1, lat);
      const vals = [hex(pointBlob(lng, lat))].concat(cols.map((c) => lit(r[c])));
      db.run(`INSERT INTO ${q(L.name)} (geom${cols.length ? ", " + cols.map(q).join(", ") : ""})
              VALUES (${vals.join(", ")});`);
    });

    db.run(`INSERT INTO gpkg_contents VALUES (${lit(L.name)}, 'features', ${lit(L.name)},
      ${lit(L.desc || "")}, ${lit(now)}, ${x0}, ${y0}, ${x1}, ${y1}, 4326);`);
    db.run(`INSERT INTO gpkg_geometry_columns VALUES (${lit(L.name)}, 'geom', 'POINT', 4326, 0, 0);`);
  });

  const bytes = db.export();
  db.close();
  return bytes;
}

/** 만든 파일을 내려받게 합니다 */
export function saveGpkg(bytes, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes], { type: "application/geopackage+sqlite3" }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 6000);
}
