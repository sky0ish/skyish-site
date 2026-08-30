// ─── MAP — 서울 지도 ─────────────────────────────────────────
// u-tokyo.kr 의 도쿄 지도를 서울판으로 옮긴 것입니다.
// 화면은 map.html, 장소 자료는 Supabase 의 map_places 표에 쌓입니다.
//
// 지도는 세 갈래로 나뉩니다 — 핫플 · 도시건축 · 부동산.
// 주소 뒤에 ?g=hot / ?g=urban / ?g=estate 를 붙여 갈래를 고릅니다.
// 화면 구성은 셋이 같고, 올린 장소만 갈래별로 따로 쌓입니다.
import { sb, currentUser, myProfile } from "../../auth/auth.js";

export const GROUPS = {
  hot:    { name: "핫플",     en: "Hot Places",     first: "hot",
            lead: "요즘 사람들이 모이는 곳 — 맛집 · 카페 · 거리 · 새로 생긴 공간을 모았습니다." },
  urban:  { name: "도시건축", en: "Urban & Architecture", first: "arch",
            lead: "눈여겨본 건축물과 도시공간 — 설계와 배치, 주변과의 관계를 기록합니다." },
  estate: { name: "부동산",   en: "Real Estate",    first: "apt",
            lead: "아파트 · 주거단지 · 개발지 — 위치와 여건을 지도 위에 정리합니다." },
  trip:   { name: "여행",     en: "Travel",         first: "hot",
            lead: "다녀온 곳과 다시 가고 싶은 곳 — 출장과 여행에서 만난 장소들입니다." },
  food:   { name: "맛집",     en: "Good Food",      first: "food",
            lead: "다시 갈 만한 곳만 남깁니다 — 밥집 · 카페 · 술집." },
  /* 종합 — 여러 갈래를 한 지도에 얹어 봅니다.
     grps 가 있는 갈래는 그 목록을 한꺼번에 읽고, 갈래마다 켜고 끌 수 있습니다. */
  all:    { name: "종합",     en: "All",            first: "hot",
            grps: ["hot", "food", "estate", "trip"],
            lead: "핫플 · 맛집 · 부동산 · 여행을 한 지도에서 함께 봅니다." },
  etc:    { name: "기타",     en: "Etc",            first: "hot",
            lead: "어느 갈래에도 넣기 어려운 곳들을 모아둡니다." },
};

/** 종합 화면에서 갈래마다 쓰는 빛깔 */
export const GRP_COLOR = {
  hot: "#e6398b", food: "#e8590c", estate: "#2a5fa8",
  trip: "#4f9d92", urban: "#8a6bb0", etc: "#7d7768",
};

/** 첫 화면이 담을 자리 — 서울 중구에서 양재까지.
    여기서부터 전국 어디로든 옮겨 보실 수 있습니다. */
export const HOME_BOUNDS = [[37.4620, 126.9080], [37.5950, 127.1050]];
export const GROUP_KEYS = Object.keys(GROUPS);

/** 지금 보고 있는 갈래 (주소에 없거나 모르는 값이면 핫플) */
export function currentGroup() {
  const g = new URLSearchParams(location.search).get("g");
  return GROUPS[g] ? g : "hot";
}

/** 배너 제목·안내글·탭 제목을 지금 갈래에 맞춥니다 */
function applyGroupChrome(key) {
  const g = GROUPS[key];
  const en   = document.querySelector(".banner .en");
  const h1   = document.querySelector(".banner h1");
  const lead = document.getElementById("mapLead");
  if (en)   en.textContent   = g.en;
  if (h1)   h1.textContent   = "서울 " + g.name;
  if (lead) lead.textContent = g.lead;
  document.title = `MAP · ${g.name} — Jee-Hyun NAM`;
  document.body.dataset.mapGroup = key;

  /* 갈래 사이를 오갈 수 있게 지도 위에 작은 단추줄을 둡니다 */
  const row = document.getElementById("mapGroups");
  if (row) {
    row.innerHTML = GROUP_KEYS.map(k =>
      `<a href="map.html?g=${k}"${k === key ? ' class="on" aria-current="page"' : ""}>${GROUPS[k].name}</a>`
    ).join("");
  }
}

/* 분류 — 세 번째 값이 있으면 그 분류의 아래 갈래입니다.
   맛집 아래로 한식·일식·중식·기타·카페를 둡니다. */
export const CATS = [
  ["food",  "맛집"],
  ["kfood", "한식",   "food"],
  ["jfood", "일식",   "food"],
  ["cfood", "중식",   "food"],
  ["efood", "기타",   "food"],
  ["cafe",  "카페",   "food"],
  ["apt",     "APT"],
  ["myhome",  "My Home",    "apt"],
  ["remodel", "Remodeling", "apt"],
  ["intr",    "Interior",   "apt"],
  ["arch",  "건축물"],
  ["farch", "유명건축",   "arch"],
  ["udev",  "도시개발",   "arch"],
  ["urgn",  "도시재생",   "arch"],
  ["tod",   "역세권개발", "arch"],
  ["harch", "역사건축",   "arch"],
  ["hot",   "핫플"],
];
/** 그 분류의 아래 갈래들 */
export const kidsOf = (k) => CATS.filter(([, , p]) => p === k).map(([c]) => c);
export const CAT_NAME = Object.fromEntries(CATS);

/** 철도역 자료 — 서울과 그 언저리 440곳 (OpenStreetMap 에서 받아 정리) */
const RAIL_URL = "assets/data/seoul-rail.json";

/** 분류별 지도 표시 모양과 안내 문구 */
export const CAT_INFO = {
  food: { shape: "star", mark: "빨간 별",
    desc: "다시 찾고 싶은 <b>서울의 맛집</b>입니다. 표시를 누르면 주소와 그곳의 특징, 얽힌 기억이 열립니다." },
  kfood: { shape: "star", mark: "빨간 별",
    desc: "<b>한식</b> — 밥집·고깃집·국숫집처럼 다시 갈 만한 곳입니다." },
  jfood: { shape: "star", mark: "초록 별",
    desc: "<b>일식</b> — 초밥·라멘·이자카야 같은 곳입니다." },
  cfood: { shape: "star", mark: "주황 별",
    desc: "<b>중식</b> — 중국집과 중화요리 집입니다." },
  efood: { shape: "star", mark: "보라 별",
    desc: "<b>그 밖의 맛집</b> — 양식·아시아·분식처럼 위에 없는 곳입니다." },
  cafe: { shape: "star", mark: "노란 별",
    desc: "일하기 좋은 곳, 이야기 나누기 좋은 곳 — <b>서울의 카페</b>를 모았습니다." },
  apt:  { shape: "dot",  mark: "파란 동그라미",
    desc: "눈여겨본 <b>아파트·주거단지</b>입니다. 배치와 외관, 주변 환경을 함께 적어두면 좋습니다." },
  myhome:  { shape: "dot", mark: "하늘색 동그라미",
    desc: "<b>살았거나 살고 싶은 집</b> — 직접 살아 본 곳, 눈여겨보는 곳입니다." },
  remodel: { shape: "dot", mark: "청보라 동그라미",
    desc: "<b>리모델링</b> — 고쳐 쓴 집·건물. 전후와 손댄 곳을 적어 둡니다." },
  intr:    { shape: "dot", mark: "분홍 동그라미",
    desc: "<b>인테리어</b> — 마감·가구·조명처럼 안쪽을 눈여겨본 곳입니다." },
  arch: { shape: "dot",  mark: "주황 동그라미",
    desc: "<b>가 볼 만한 건축물</b>입니다. 설계자와 특징을 함께 적어주시면 좋습니다." },
  farch: { shape: "dot", mark: "짙은 주황 동그라미",
    desc: "<b>이름난 건축물</b> — 설계자와 지어진 해, 눈여겨본 대목을 적어 둡니다." },
  udev:  { shape: "dot", mark: "남색 동그라미",
    desc: "<b>도시개발</b> — 택지·신도시·복합개발처럼 새로 짓는 곳입니다." },
  urgn:  { shape: "dot", mark: "초록 동그라미",
    desc: "<b>도시재생</b> — 있던 것을 고쳐 쓰는 곳입니다." },
  tod:   { shape: "dot", mark: "청록 동그라미",
    desc: "<b>역세권개발</b> — 역을 낀 복합개발·고밀개발입니다." },
  harch: { shape: "dot", mark: "고동색 동그라미",
    desc: "<b>역사건축</b> — 근대건축·문화재처럼 오래된 것입니다." },
  hot:  { shape: "dot",  mark: "핫핑크 동그라미",
    desc: "요즘 사람들이 모이는 <b>핫플레이스</b> — 거리, 상권, 새로 생긴 공간을 기록합니다." },
};

/** 바탕지도 — 열쇠(API key) 없이 쓸 수 있는 것들 */
export const BASEMAPS = [
  { k: "osm", n: "기본", sub: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    att: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
  /* CARTO 는 2026년부터 열쇠 없이 쓰면 타일에 「API KEY REQUIRED」 를 찍어 보냅니다.
     막힌 것이 아니라 글자가 박혀 오는 것이라 더 나쁩니다 — Esri 로 갈아탔습니다.
     Esri 는 {s} 를 쓰지 않고 칸 순서가 {z}/{y}/{x} 입니다. */
  { k: "street", n: "부드러운 컬러", sub: "Esri Street",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    sd: false, att: 'Tiles &copy; Esri' },
  { k: "positron", n: "밝은 회색", sub: "Esri Light Gray",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    sd: false, att: 'Tiles &copy; Esri' },
  { k: "dark", n: "어두운", sub: "Esri Dark Gray",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    sd: false, att: 'Tiles &copy; Esri' },
  { k: "topo", n: "지형", sub: "OpenTopoMap",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", maxZoom: 17,
    att: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)' },
  { k: "sat", n: "위성사진", sub: "Esri World Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    sd: false, att: 'Tiles &copy; Esri' },
];

/** OpenStreetMap 이 알려주는 장소 종류를 우리말 한 마디로 */
const KIND = {
  cafe:"카페", coffee_shop:"카페", restaurant:"음식점", fast_food:"간이음식점", bar:"바",
  pub:"펍", bakery:"빵집", confectionery:"과자점", ice_cream:"아이스크림", food_court:"푸드코트",
  museum:"박물관", gallery:"미술관", artwork:"예술작품", theatre:"극장", cinema:"영화관",
  library:"도서관", university:"대학", college:"단과대", school:"학교", research_institute:"연구소",
  park:"공원", garden:"정원", viewpoint:"전망대", attraction:"명소", memorial:"기념물",
  monument:"기념비", castle:"성", ruins:"유적", temple:"절", shrine:"신사", place_of_worship:"사찰·교회",
  station:"역", subway:"지하철역", bus_stop:"버스정류장", hotel:"호텔", hostel:"게스트하우스",
  department_store:"백화점", supermarket:"마트", convenience:"편의점", books:"서점",
  clothes:"옷가게", bank:"은행", hospital:"병원", pharmacy:"약국", sports_centre:"체육관",
  stadium:"경기장", zoo:"동물원", aquarium:"수족관", bridge:"다리", tower:"타워",
  apartments:"아파트", house:"주택", commercial:"상업건물", public:"공공건물",
};
const CUISINE = {
  ramen:"라멘", sushi:"스시", japanese:"일식", korean:"한식", chinese:"중식", italian:"이탈리안",
  french:"프렌치", curry:"카레", udon:"우동", soba:"소바", yakiniku:"야키니쿠", izakaya:"이자카야",
  tonkatsu:"돈카츠", coffee_shop:"커피", burger:"버거", pizza:"피자", thai:"태국식", indian:"인도식",
};

/** 장소 종류를 한 단어로 (주소는 따로 있으니 동네 이름은 넣지 않는다) */
function kindOf(h) {
  const t = (h.type || "").toLowerCase();
  const c = (h.class || "").toLowerCase();
  if (KIND[t]) return KIND[t];
  if (KIND[c]) return KIND[c];
  const ex = h.extratags || {};
  for (const x of (ex.cuisine || "").split(";")) {
    const k = CUISINE[x.trim().toLowerCase()];
    if (k) return k;
  }
  return "";
}

/** 위키백과에서 「무엇을 하는 곳인지」 한 문장을 찾아온다 */
async function describeFromWiki(name) {
  if (!name) return "";
  const get = (host, path) => fetch(`https://${host}/api/rest_v1/page/summary/${encodeURIComponent(path)}`)
                                .then(r => r.ok ? r.json() : null).catch(() => null);
  const find = async (host) => {
    try {
      const sr = await fetch(`https://${host}/w/api.php?origin=*&format=json&action=query&list=search`
                           + `&srlimit=1&srsearch=${encodeURIComponent(name)}`)
                       .then(r => r.json());
      const hit = sr && sr.query && sr.query.search && sr.query.search[0];
      return hit ? hit.title : null;
    } catch (e) { return null; }
  };
  for (const host of ["ko.wikipedia.org", "en.wikipedia.org"]) {
    const title = await find(host);
    if (!title) continue;
    const sum = await get(host, title);
    const tx = sum && (sum.extract || "");
    if (!tx) continue;
    // 첫 문장만, 괄호 안 설명은 덜어낸다
    let one = tx.split(/(?<=[.。])\s/)[0] || tx;
    one = one.replace(/\([^)]*\)/g, "").replace(/（[^）]*）/g, "").replace(/\s{2,}/g, " ").trim();
    if (one.length > 90) one = one.slice(0, 88).trim() + "…";
    if (one.length >= 8) return one;
  }
  return "";
}

const esc = s => String(s == null ? "" : s)
  .replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const SHELL = `
  <div class="mapwrap">
    <div class="maprow">
      <div class="mapbox"><div id="cmap"></div></div>
      <aside class="mapside">
        <div class="layers" id="mlayers">
          <span class="lytitle lygrp" id="lyGrpTtl" hidden>갈래 선택</span>
          <span class="lyboxes" id="lyGrps" hidden></span>
          <span class="lytitle">레이어 선택</span>
          <span class="lyboxes" id="lyBoxes"></span>
          <button type="button" class="lyall" id="lyAll">전체 켜기 / 끄기</button>
          <label class="ly lyfav" id="lyFavBox" hidden><input type="checkbox" id="lyFav"><span class="lydot"><i style="background:#e8a33d"></i></span>My Favorite 만</label>
          <button type="button" class="lyall" id="lyFit">◎ 올린 곳 전체 보기</button>
          <button type="button" class="lyall lygpkg" id="lyGpkg" hidden>⤓ GPKG 로 받기</button>
          <span class="lytitle lybase">내 파일</span>
          <label class="lyall lyfile" id="lyFileBtn">＋ KML · SHP 불러오기
            <input type="file" id="lyFile" accept=".kml,.kmz,.geojson,.json,.zip,.shp" multiple hidden></label>
          <span class="lyboxes" id="lyFiles"></span>
          <span class="lytitle lybase">맛집지도</span>
          <span class="lyboxes" id="lyFood"></span>
          <span class="lytitle lybase">바탕지도 선택</span>
          <select class="lysel" id="lyBase"></select>
        </div>
        <div class="plist" id="plist"></div>
      </aside>
    </div>
    <div class="maptip">
      <span>지도를 <b>끌어서 이동</b>, <b>마우스 휠 또는 + / −</b> 로 확대·축소.
        지도 위 <b>표시를 누르면</b> 그 장소 안내가 크게 열립니다.</span>
      <a class="down" id="mapDown" href="#addplace">▼ 아래에서 내가 아는 곳을 올려보세요</a>
    </div>
  </div>

  <div class="addplace" id="addplace">
    <div class="apttl">＋ 이 분류에 장소 추가</div>
    <div class="apcats" id="apCats"></div>
    <div class="apfields aprow">
      <div class="apcell">
        <input type="text" id="apName" maxlength="60" autocomplete="off"
               placeholder="장소 이름 * (예: 익선동 골목 커피집) — 상호를 적으면 아래에 주소 후보가 뜹니다">
        <div class="apsug" id="apSug"></div>
      </div>
      <input type="text" id="apAddr" maxlength="160" placeholder="주소 * (예: 서울 종로구 사직로 161)">
      <button type="button" class="appin" id="apFind">🔎 주소로 찾기</button>
      <button type="button" class="appin" id="apPin">📍 지도에서 찍기</button>
    </div>
    <div class="apfields">
      <input type="text" id="apNote" maxlength="200"
             placeholder="이곳의 특징 — 주소를 고르면 자동으로 채워집니다 (고치셔도 됩니다)">
    </div>
    <div class="apfields">
      <textarea id="apMemo" maxlength="600" rows="1"
        placeholder="추천 이유와 얽힌 기억&#10;예시) 답사 갔다 들른 집 / 설계가 인상 깊었던 곳 / 자주 가던 자리 / 처음 서울 왔을 때 밥 먹은 집  (안 적으셔도 됩니다)"></textarea>
    </div>
    <div class="apfields">
      <label class="apdrop" id="apDrop">
        <b>사진</b>
        <span id="apImgMsg">여기에 <b>붙여넣기(Ctrl+V)</b> 하거나, 사진을 <b>끌어다 놓으세요</b>. 눌러서 고르셔도 됩니다.</span>
        <input type="file" id="apImg" accept="image/*" hidden>
        <img id="apPrev" alt="" style="display:none;">
      </label>
      <button class="apbtn" id="apGo">지도에 올리기</button>
    </div>
    <div class="apmsg" id="apMsg">주소를 적으면 위치를 찾아 지도 위에 표시로 올려드립니다.</div>
  </div>

  <div class="movebar" id="moveBar">
    <b id="moveName"></b>
    <span>표시를 끌어서 옮긴 뒤 저장하세요.</span>
    <button type="button" class="mvok" id="moveOk">이 자리로 저장</button>
    <button type="button" class="mvno" id="moveNo">취소</button>
  </div>

  <div class="pmodal" id="pmodal">
    <div class="pbox">
      <button class="px" id="pClose">✕</button>
      <div class="pcatrow">
        <span class="pcat" id="pCat"></span>
        <select class="pcatsel" id="pCatSel" style="display:none;" title="분류 바꾸기"></select>
      </div>
      <h3 id="pName"></h3>
      <div class="paddr" id="pAddr"></div>
      <div class="pjp" id="pJp"></div>
      <img class="pimg" id="pImg" alt="" style="display:none;">
      <div class="pblock" id="pNoteBox" style="display:none;">
        <div class="plab">이곳의 특징</div>
        <div class="pnote" id="pNote"></div>
      </div>
      <div class="pblock" id="pMemoBox" style="display:none;">
        <div class="plab">추천사유 및 추억</div>
        <div class="pnote" id="pMemo"></div>
      </div>

      <!-- 내용 고치기 — 올린 본인과 운영자에게만 보입니다 -->
      <div class="pedit" id="pEdit" style="display:none;">
        <label class="plab" for="eName">이름</label>
        <input type="text" id="eName" maxlength="60">
        <label class="plab" for="eNote">이곳의 특징</label>
        <input type="text" id="eNote" maxlength="200" placeholder="어떤 곳인지 한 줄로">
        <label class="plab" for="eMemo">추천사유 및 추억</label>
        <textarea id="eMemo" maxlength="600" rows="3" placeholder="왜 좋았는지, 어떤 기억이 있는지"></textarea>
        <div class="peditfoot">
          <button class="pbtn" id="eCancel" type="button">그만두기</button>
          <button class="pbtn save" id="eSave" type="button">저장하기</button>
        </div>
        <div class="pemsg" id="eMsg"></div>
      </div>

      <ul class="mways" id="pWays"></ul>
      <div class="pfoot" id="pFoot">
        <a class="pbtn" id="pMap" href="#" target="_blank" rel="noopener">구글 지도에서 보기</a>
        <a class="pbtn line" id="pDir" href="#" target="_blank" rel="noopener">길찾기 →</a>
        <a class="pbtn line" id="pPost" href="#" style="display:none;">관련 글 보기</a>
        <button class="pbtn fav" id="pFav" style="display:none;">☆ My Favorite</button>
        <button class="pbtn edit" id="pEditBtn" style="display:none;">✎ 내용 고치기</button>
        <button class="pbtn move" id="pMove" style="display:none;">📍 위치 옮기기</button>
        <button class="pbtn del" id="pDel" style="display:none;">이 장소 지우기</button>
      </div>
      <div class="pwho" id="pWho"></div>
    </div>
  </div>`;

/**
 * MAP 화면을 그린다.
 * @param {string} mountId 지도를 넣을 칸의 id
 */
export async function initMap(mountId = "mapapp") {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  mount.innerHTML = SHELL;

  const GRP = currentGroup();               // hot · urban · estate
  applyGroupChrome(GRP);

  // 주소에 분류가 없으면 그 갈래에 가장 어울리는 분류로 시작합니다
  let cur = new URLSearchParams(location.search).get("cat");
  if (!CAT_NAME[cur]) cur = GROUPS[GRP].first;

  const map = L.map("cmap", { scrollWheelZoom: true, zoomControl: true, minZoom: 5 })
               .setView([37.5665, 126.9780], 11);
  // ── 바탕지도 고르기 ──
  let baseLayer = null;
  function setBase(k) {
    const b = BASEMAPS.find(x => x.k === k) || BASEMAPS[0];
    if (baseLayer) map.removeLayer(baseLayer);
    baseLayer = L.tileLayer(b.url, {
      maxZoom: b.maxZoom || 19,
      subdomains: b.sd === false ? [] : ["a", "b", "c"],
      attribution: b.att,
    }).addTo(map);
    baseLayer.bringToBack();
    try { localStorage.setItem("skyish-basemap", b.k); } catch (e) {}
  }
  const baseSel = document.getElementById("lyBase");
  baseSel.innerHTML = BASEMAPS.map(b => `<option value="${b.k}">${b.n}</option>`).join("");
  let saved = "osm";
  try { saved = localStorage.getItem("skyish-basemap") || "osm"; } catch (e) {}
  if (saved === "voyager") saved = "street";   // CARTO 시절 이름을 이어 받습니다
  baseSel.value = BASEMAPS.some(b => b.k === saved) ? saved : "osm";
  baseSel.addEventListener("change", () => setBase(baseSel.value));
  setBase(baseSel.value);

  // ── 로그인 상태 ──
  const user = await currentUser();
  const me = user ? await myProfile() : null;
  // 이 홈페이지는 승인 여부를 profiles.analysis_access 로 관리합니다
  const canAdd = !!(me && (me.analysis_access || me.is_admin));
  const isAdmin = !!(me && me.is_admin);
  document.getElementById("addplace").classList.toggle("on", canAdd);
  const down = document.getElementById("mapDown");
  down.classList.toggle("on", canAdd);
  down.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("addplace").scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("apName").focus({ preventScroll: true });
  });

  let places = [];                          // 지도에 그려진 장소들
  let loadError = "";                       // 불러오기가 실패했을 때 알려줄 말
  let markers = [];                         // 그 장소들의 지도 표시
  const shown = new Set(CATS.map(([k]) => k));   // 지도에 보이는 분류 (처음엔 모두)
  const MULTI = !!GROUPS[GRP].grps;              // 종합처럼 여러 갈래를 겹쳐 보는가
  const shownGrp = new Set(GROUPS[GRP].grps || [GRP]);   // 종합에서 켜진 갈래
  let firstFit = true;                           // 첫 그리기에만 자리를 맞춥니다
  let fitTries = 0;
  let layer = L.layerGroup().addTo(map);

  // ── 레이어 체크박스 ──
  //    회원이 올린 분류 다섯 + 기본으로 깔리는 철도역(초록)
  /* ── 종합 갈래 : 어느 갈래를 겹쳐 볼지 고릅니다 ── */
  if (MULTI) {
    document.getElementById("lyGrpTtl").hidden = false;
    const gb = document.getElementById("lyGrps");
    gb.hidden = false;
    gb.innerHTML = GROUPS[GRP].grps.map((g) =>
      `<label class="ly"><input type="checkbox" data-g="${g}" checked>` +
      `<span class="lydot"><i style="background:${GRP_COLOR[g] || "#888"}"></i></span>` +
      `${esc(GROUPS[g].name)}</label>`).join("") +
      '<button type="button" class="lyall" id="lyGrpAll">갈래 전체 켜기 / 끄기</button>';

    gb.querySelectorAll("input[data-g]").forEach((c) =>
      c.addEventListener("change", () => {
        c.checked ? shownGrp.add(c.dataset.g) : shownGrp.delete(c.dataset.g);
        c.closest(".ly").classList.toggle("off", !c.checked);
        draw();
      }));
    document.getElementById("lyGrpAll").addEventListener("click", () => {
      const anyOff = GROUPS[GRP].grps.some((g) => !shownGrp.has(g));
      gb.querySelectorAll("input[data-g]").forEach((c) => {
        c.checked = anyOff;
        c.checked ? shownGrp.add(c.dataset.g) : shownGrp.delete(c.dataset.g);
        c.closest(".ly").classList.toggle("off", !c.checked);
      });
      draw();
    });
  }

  const boxes = document.getElementById("lyBoxes");
  const LEG = CATS.slice();
  boxes.innerHTML = LEG.map(([k, v, parent]) =>
    `<label class="ly c-${k}${parent ? " lykid" : ""}"><input type="checkbox" data-c="${k}" checked>` +
    `<span class="lydot ${(CAT_INFO[k] || {}).shape || "dot"}"><i></i></span>${v}</label>`).join("")
    + `<label class="ly c-rail off"><input type="checkbox" data-rail="1">` +
      `<span class="lydot rail c-rail"><i></i></span>철도역</label>`;

  boxes.querySelectorAll("input[data-c]").forEach(c => c.addEventListener("change", () => {
    const set = (key, on) => {
      const box = boxes.querySelector(`input[data-c="${key}"]`);
      if (box) { box.checked = on; box.closest(".ly").classList.toggle("off", !on); }
      on ? shown.add(key) : shown.delete(key);
    };
    set(c.dataset.c, c.checked);
    // 「맛집」을 끄면 그 아래 한식·일식·… 도 함께 접습니다
    kidsOf(c.dataset.c).forEach((kid) => set(kid, c.checked));
    draw();
  }));
  /* 종합 갈래에서만 — My Favorite 만 골라 봅니다 */
  let favOnly = false;
  if (MULTI) {
    document.getElementById("lyFavBox").hidden = false;
    document.getElementById("lyFav").addEventListener("change", (e) => {
      favOnly = e.target.checked;
      e.target.closest(".ly").classList.toggle("off", !favOnly);
      draw();
    });
  }

  /* 올린 곳을 모두 담아 보여 줍니다 (전국으로 퍼져 있어도) */
  document.getElementById("lyFit").addEventListener("click", () => {
    const pts = places.filter((p) => p.lat && p.lng).map((p) => [p.lat, p.lng]);
    if (!pts.length) { map.fitBounds(HOME_BOUNDS); return; }
    if (pts.length === 1) map.setView(pts[0], 15);
    else map.fitBounds(pts, { padding: [50, 50] });
  });

  /* ── GPKG 로 받기 — 종합 갈래에서만 ──
     켜 둔 갈래마다 레이어를 따로 만들어 파일 하나로 묶습니다.
     QGIS 에서 열면 갈래별로 나뉘어 들어옵니다. */
  const gpkgBtn = document.getElementById("lyGpkg");
  if (MULTI) {
    gpkgBtn.hidden = false;
    gpkgBtn.addEventListener("click", async () => {
      const on = [...shownGrp];
      if (!on.length) { alert("켜 둔 갈래가 없습니다."); return; }
      const picked = places.filter((p) => on.indexOf(p.grp) >= 0 && p.lat && p.lng);
      if (!picked.length) { alert("담을 장소가 없습니다."); return; }

      const was = gpkgBtn.textContent;
      gpkgBtn.disabled = true;
      gpkgBtn.textContent = "만드는 중…";
      try {
        const G = await import("./gpkg.js?v=202608312100");
        const FIELDS = ["name", "category", "address", "note", "memory", "created_at"];
        const layers = on.map((g) => ({
          name: GROUPS[g].name,
          desc: GROUPS[g].lead || "",
          fields: FIELDS,
          rows: picked.filter((p) => p.grp === g),
        })).filter((L) => L.rows.length);

        const bytes = await G.buildGpkg(layers);
        const t = new Date();
        G.saveGpkg(bytes, "지도_" + t.getFullYear() +
          String(t.getMonth() + 1).padStart(2, "0") +
          String(t.getDate()).padStart(2, "0") + ".gpkg");
        alert(layers.map((L) => L.name + " " + L.rows.length + "곳").join(" · ") +
              String.fromCharCode(10) + "레이어 " + layers.length + "개로 담았습니다.");
      } catch (e) {
        alert("GPKG 를 만들지 못했습니다 — " + (e && e.message ? e.message : e));
      } finally {
        gpkgBtn.disabled = false;
        gpkgBtn.textContent = was;
      }
    });
  }

  const railBox = boxes.querySelector("input[data-rail]");
  railBox.addEventListener("change", () => {
    railBox.closest(".ly").classList.toggle("off", !railBox.checked);
    setRail(railBox.checked);
  });

  document.getElementById("lyAll").addEventListener("click", () => {
    const on = shown.size < CATS.length;                 // 하나라도 꺼져 있으면 전체 켜기
    boxes.querySelectorAll("input[data-c]").forEach(c => {
      c.checked = on;
      c.closest(".ly").classList.toggle("off", !on);
      on ? shown.add(c.dataset.c) : shown.delete(c.dataset.c);
    });
    draw();
  });

  /* ── 내 파일 얹기 (KML · KMZ · GeoJSON · SHP) ────────────────
     파일은 어디로도 올라가지 않습니다. 브라우저가 읽어 화면에만 그립니다. */
  const fileBox = document.getElementById("lyFiles");
  const myFiles = [];   // { name, layer, on, n }
  const FCOLORS = ["#2a5fa8", "#d63a2f", "#0f9d58", "#8a6bb0", "#e65100", "#2b8f8f"];

  function drawFileList() {
    fileBox.innerHTML = myFiles.map((f, i) =>
      `<label class="ly${f.on ? "" : " off"}"><input type="checkbox" data-f="${i}"${f.on ? " checked" : ""}>` +
      `<span class="lydot"><i style="background:${f.color}"></i></span>` +
      `${esc(f.name)}<em class="lyn">${f.n}</em>` +
      `<button type="button" class="lyx" data-x="${i}" title="빼기">✕</button></label>`).join("");

    fileBox.querySelectorAll("input[data-f]").forEach((c) =>
      c.addEventListener("change", () => {
        const f = myFiles[+c.dataset.f];
        f.on = c.checked;
        c.closest(".ly").classList.toggle("off", !c.checked);
        if (f.on) f.layer.addTo(map); else map.removeLayer(f.layer);
      }));
    fileBox.querySelectorAll("button[data-x]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.preventDefault();
        const i = +b.dataset.x;
        map.removeLayer(myFiles[i].layer);
        myFiles.splice(i, 1);
        drawFileList();
      }));
  }

  async function addFiles(list) {
    const MF = await import("./map-files.js?v=202608312100");
    for (const file of [...list]) {
      const btn = document.getElementById("lyFileBtn");
      const was = btn.firstChild.nodeValue;
      btn.firstChild.nodeValue = file.name + " 읽는 중…";
      try {
        const r = await MF.toGeoJson(file);
        const color = FCOLORS[myFiles.length % FCOLORS.length];
        const layer = L.geoJSON(r.geojson, {
          style: { color, weight: 2, opacity: .9, fillColor: color, fillOpacity: .18 },
          pointToLayer: (ft, ll) => L.circleMarker(ll,
            { radius: 5, color, weight: 2, fillColor: color, fillOpacity: .75 }),
          onEachFeature: (ft, ly) => {
            const t = MF.labelOf(ft.properties);
            ly.bindPopup('<div class="fpop"><b>' + esc(t || r.name) + "</b>" +
              MF.propTable(ft.properties) + "</div>");
          },
        });
        layer.addTo(map);
        myFiles.push({ name: r.name, layer, on: true, n: r.count, color });
        drawFileList();
        try { map.fitBounds(layer.getBounds(), { padding: [40, 40] }); } catch (e) {}
      } catch (e) {
        alert(file.name + " — " + (e && e.message ? e.message : e));
      } finally {
        btn.firstChild.nodeValue = was;
      }
    }
  }

  document.getElementById("lyFile").addEventListener("change", (e) => {
    const f = e.target.files; e.target.value = "";
    if (f && f.length) addFiles(f);
  });

  /* ── 맛집지도 레이어 ────────────────────────────────────────
     구글 마이맵에서 내보낸 KMZ 를 옮겨 담은 것입니다.
     한식·양식·중식·일식·까페·BAR·셔핑·태국&기타 여덟 갈래를
     하나씩 켜고 끌 수 있습니다. */
  const foodBox = document.getElementById("lyFood");
  let foodData = null, foodOn = {}, foodLayers = {};

  async function foodLoad() {
    if (foodData) return foodData;
    const r = await fetch("assets/data/seoul-food.json", { cache: "force-cache" });
    if (!r.ok) throw new Error("맛집 자료를 받지 못했습니다");
    foodData = await r.json();
    return foodData;
  }

  function foodDraw(L2) {
    if (foodLayers[L2.key]) return foodLayers[L2.key];
    const g = L.layerGroup();
    L2.places.forEach((p) => {
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: "",
          html: '<div class="cmark foodmark"><i style="background:' + L2.color + '"></i>' +
                "<b>" + esc(p.n) + "</b></div>",
          iconSize: [0, 0], iconAnchor: [0, 0],
        }),
      }).bindPopup(
        '<div class="fpop"><b>' + esc(p.n) + "</b>" +
        '<span class="fpcat" style="color:' + L2.color + '">' + esc(L2.name) + "</span>" +
        (p.d ? "<p>" + esc(p.d) + "</p>" : "") +
        '<a href="https://map.naver.com/p/search/' + encodeURIComponent(p.n) +
        '" target="_blank" rel="noopener">네이버 지도에서 보기 →</a></div>').addTo(g);
    });
    foodLayers[L2.key] = g;
    return g;
  }

  async function foodInit() {
    let d;
    try { d = await foodLoad(); }
    catch (e) { foodBox.innerHTML = '<span class="lyerr">맛집 자료 없음</span>'; return; }

    foodBox.innerHTML = d.layers.map((L2) =>
      '<label class="ly off"><input type="checkbox" data-food="' + esc(L2.key) + '">' +
      '<span class="lydot"><i style="background:' + L2.color + '"></i></span>' +
      esc(L2.name) + '<em class="lyn">' + L2.places.length + "</em></label>").join("") +
      '<button type="button" class="lyall lyfoodall" id="lyFoodAll">맛집 전체 켜기 / 끄기</button>';

    foodBox.querySelectorAll("input[data-food]").forEach((c) =>
      c.addEventListener("change", () => {
        const L2 = d.layers.find((x) => x.key === c.dataset.food);
        const g = foodDraw(L2);
        foodOn[L2.key] = c.checked;
        c.closest(".ly").classList.toggle("off", !c.checked);
        if (c.checked) g.addTo(map); else map.removeLayer(g);
      }));

    document.getElementById("lyFoodAll").addEventListener("click", () => {
      const anyOff = d.layers.some((L2) => !foodOn[L2.key]);
      foodBox.querySelectorAll("input[data-food]").forEach((c) => {
        c.checked = anyOff;
        c.dispatchEvent(new Event("change"));
      });
    });
  }
  foodInit();

  /* ── 철도역 레이어 ────────────────────────────────────────
     assets/data/seoul-rail.json 의 역들을 초록 점으로 깝니다.
     회원이 올린 장소와 섞이지 않도록 따로 둡니다.
     처음에는 꺼져 있고, 체크하면 그때 한 번만 자료를 받아 옵니다. */
  let railLayer = null, railLoading = false;
  async function setRail(on) {
    if (!on) { if (railLayer) map.removeLayer(railLayer); return; }
    if (railLayer) { railLayer.addTo(map); return; }
    if (railLoading) return;
    railLoading = true;
    railBox.disabled = true;
    try {
      const rows = await fetch(RAIL_URL).then(r => {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      });
      railLayer = L.layerGroup();
      rows.forEach(s => {
        const lines = s.L || [];
        // 세모는 첫 호선 색으로, 이름 옆에는 호선 번호를 그 색 배지로 붙입니다
        const head = lines[0] ? lines[0][1] : "#2f9e44";
        const tags = lines.map(([lab, col]) =>
          `<em class="rl" style="background:${col}">${esc(lab)}</em>`).join("");
        L.marker([s.a, s.o], {
          zIndexOffset: -400,               // 회원이 올린 장소보다 아래에
          icon: L.divIcon({
            className: "", iconSize: [0, 0],
            html: `<div class="cmark railmark">` +
                  `<i style="border-bottom-color:${head}"></i>` +
                  `<b>${tags}${esc(s.n)}</b></div>`,
          }),
        }).bindTooltip(
          lines.length ? `${esc(s.n)} · ${lines.map(l => l[0]).join(" · ")}호선`
                       : esc(s.n)
        ).addTo(railLayer);
      });
      railLayer.addTo(map);
    } catch (e) {
      railBox.checked = false;
      railBox.closest(".ly").classList.add("off");
      alert("철도역 자료를 불러오지 못했습니다. 잠시 뒤 다시 눌러주세요.");
    } finally {
      railLoading = false;
      railBox.disabled = false;
    }
  }

  function tabHtml() {
    const pick = document.getElementById("apCats");
    pick.innerHTML = CATS.map(([k, v]) =>
      `<button type="button" class="apcat c-${k}${k === cur ? " on" : ""}" data-c="${k}">` +
      `<span class="apdot ${(CAT_INFO[k] || {}).shape || "dot"}"><i></i></span>${v}</button>`).join("");
    pick.querySelectorAll(".apcat").forEach(b => b.addEventListener("click", () => {
      cur = b.dataset.c;
      // 갈래(g)는 그대로 두고 분류(cat)만 바꿉니다 — 주소를 통째로 바꾸면
      // ?g= 가 사라져 새로고침·공유했을 때 엉뚱한 갈래로 열립니다.
      const q = new URLSearchParams(location.search);
      q.set("g", GRP); q.set("cat", cur);
      history.replaceState(null, "", "?" + q.toString());
      tabHtml(); draw();
    }));
  }

  async function load() {
    const list = [...shown];
    const base = [];   // 기본 제공 장소 없음 — 모두 회원이 등록합니다
    let rows = [];
    loadError = "";
    if (list.length) {
      try {
        /* 종합 갈래는 grps 에 적힌 여러 갈래를 함께 읽습니다.
           그중 체크가 켜진 것만 봅니다. */
        let qy = sb.from("map_places").select("*")
                   .in("category", list)
                   .order("created_at", { ascending: false });
        qy = MULTI ? qy.in("grp", [...shownGrp]) : qy.eq("grp", GRP);
        // fav 칸이 아직 없는 DB 라면 이 조건에서 오류가 납니다 — 아래에서 알려 줍니다
        if (favOnly) qy = qy.eq("fav", true);
        const r = await qy;
        // supabase 는 조회 실패를 예외로 던지지 않고 error 로 돌려줍니다.
        // 이걸 안 보면 표가 없어도 "장소 0곳" 으로만 보여 원인을 알 수 없습니다.
        if (r.error) {
          const m = r.error.message || "";
          loadError = /fav/.test(m) && /column|schema cache/i.test(m)
            ? "My Favorite 칸이 아직 없습니다 — auth/map_fav.sql 을 한 번 실행해주세요."
            : /schema cache|does not exist|relation/i.test(m)
            ? "지도 자료칸이 아직 준비되지 않았습니다 — auth/map_setup.sql 을 한 번 실행해주세요."
            : "장소를 불러오지 못했습니다: " + m;
          rows = [];
        } else {
          rows = r.data || [];
        }
      } catch (e) {
        loadError = "장소를 불러오지 못했습니다: " + (e && e.message ? e.message : e);
        rows = [];
      }
    }
    places = base.concat(rows);
  }

  /** 서울 중구~양재를 담아 보여 줍니다. 지도 크기가 아직이면 잠깐 기다립니다. */
  function fitHome() {
    map.invalidateSize();
    if (map.getSize().y < 60 && fitTries++ < 25) { setTimeout(fitHome, 160); return; }
    map.fitBounds(HOME_BOUNDS, { padding: [20, 20], maxZoom: 14 });
    firstFit = false;
  }

  function draw() {
    layer.clearLayers();
    load().then(() => {
      layer.clearLayers();
      const pts = [];
      markers = [];
      places.forEach((p, i) => {
        pts.push([p.lat, p.lng]);
        markers[i] = L.marker([p.lat, p.lng], {
          icon: L.divIcon({ className: "", iconSize: [0, 0],
            html: `<div class="cmark c-${p.category} ${(CAT_INFO[p.category] || {}).shape || "dot"}" data-i="${i}">`
                + `<i></i><b>${esc(p.name.split(" (")[0])}</b></div>` }),
        }).addTo(layer).on("click", () => open(i));
      });
      drawList();
      /* 처음 한 번만 서울 중구~양재를 담아 보여 드립니다.
         자료가 전국으로 퍼지면 자동으로 전부 맞추는 것이 오히려 불편합니다 —
         보시던 자리를 지키고, 전체를 보고 싶으실 땐 「전체 보기」를 누르시면 됩니다. */
      /* 지도 크기가 0 일 때 fitBounds 를 부르면 줌이 0(세계 전체)으로 떨어지고,
         그 줌에는 상세 타일이 없어 「Map data not yet available」 만 깔립니다.
         크기가 잡힐 때까지 기다렸다 맞춥니다. */
      if (firstFit) fitHome();
      setTimeout(() => map.invalidateSize(), 100);
    });
  }

  /** 오른쪽 목록 — 분류별로 묶어서 보여준다 */
  function drawList() {
    const box = document.getElementById("plist");
    const listed = places.filter(p => !p.builtin);
    const total = listed.length;
    if (!total) {
      box.innerHTML = '<div class="pltitle">회원이 올린 장소 0곳</div>' +
        '<div class="plempty">' + (loadError
          ? esc(loadError)
          : "아직 없습니다.<br>아래에서 올려주세요.") + "</div>";
      return;
    }
    const canAny = places.some(p => !p.builtin && ((user && p.created_by === user.id) || isAdmin));
    let html = '<div class="pltitle">회원이 올린 장소 ' + total + '곳'
             + '</div><div class="plbody">';
    for (const [k, v] of CATS) {
      const rows = places.map((p, i) => ({ p, i }))
                         .filter(x => !x.p.builtin && x.p.category === k);
      if (!rows.length) continue;
      html += `<div class="plcat c-${k}" data-c="${k}">
        <span class="lydot ${(CAT_INFO[k] || {}).shape || "dot"} c-${k}"><i></i></span>
        ${v}<em>${rows.length}</em></div>`;
      html += rows.map(({ p, i }) => {
        const mine = !p.builtin && user && p.created_by === user.id;
        const can = mine || (isAdmin && !p.builtin);
        const dot = `<span class="lydot ${(CAT_INFO[k] || {}).shape || "dot"} c-${k}"><i></i></span>`;
        return `<div class="plitem">
          <div class="plrow" data-i="${i}"${can ? ' draggable="true"' : ""}>
            ${can ? `<button class="plmark" data-i="${i}" title="분류 바꾸기">${dot}</button>` : dot}
            <button class="plname" data-i="${i}" title="${esc(p.name)}">${esc(p.name)}</button>
            ${can ? `<button class="pldel" data-i="${i}" title="이 장소 지우기">✕</button>` : ""}
          </div>
          ${can ? `<div class="plpick" data-i="${i}">` + CATS.map(([ck, cv]) =>
            `<button class="plchip c-${ck}${ck === k ? " on" : ""}" data-i="${i}" data-c="${ck}">` +
            `<span class="lydot ${(CAT_INFO[ck] || {}).shape || "dot"} c-${ck}"><i></i></span>${cv}</button>`
          ).join("") + `</div>` : ""}
        </div>`;
      }).join("");
    }
    box.innerHTML = html + '</div><button type="button" class="plmore" id="plMore">▼ 길게 보기</button>';
    const more = document.getElementById("plMore");
    const row = document.querySelector(".maprow");
    const sync = () => { more.textContent = row.classList.contains("tall") ? "▲ 접기" : "▼ 길게 보기"; };
    sync();
    more.addEventListener("click", () => {
      row.classList.toggle("tall");
      sync();
      setTimeout(() => map.invalidateSize(), 150);
    });

    box.querySelectorAll(".plname").forEach(b => b.addEventListener("click", () => {
      const p = places[+b.dataset.i];
      map.setView([p.lat, p.lng], 16);
      open(+b.dataset.i);
    }));
    // 앞의 표시를 누르면 분류 고르는 칸이 바로 열립니다
    box.querySelectorAll(".plmark").forEach(b => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const wrap = b.closest(".plitem");
      const open = wrap.classList.contains("picking");
      box.querySelectorAll(".plitem").forEach(x => x.classList.remove("picking"));
      if (!open) wrap.classList.add("picking");
    }));
    box.querySelectorAll(".plchip").forEach(b => b.addEventListener("click", async (e) => {
      e.stopPropagation();
      const p = places[+b.dataset.i];
      const to = b.dataset.c;
      if (!p || p.category === to) { b.closest(".plitem").classList.remove("picking"); return; }
      b.disabled = true;
      const { error } = await sb.from("map_places").update({ category: to }).eq("id", p.id);
      b.disabled = false;
      if (error) { alert("옮기기 실패: " + error.message); return; }
      p.category = to;
      if (!shown.has(to)) {
        shown.add(to);
        const c = boxes.querySelector(`input[data-c="${to}"]`);
        if (c) { c.checked = true; c.closest(".ly").classList.remove("off"); }
      }
      draw();
    }));

    // 줄을 끌어다 분류 머리줄에 놓아도 됩니다
    let dragI = null;
    box.querySelectorAll('.plrow[draggable="true"]').forEach(row => {
      row.addEventListener("dragstart", (e) => {
        dragI = +row.dataset.i;
        row.classList.add("dragging");
        try { e.dataTransfer.setData("text/plain", String(dragI)); } catch (err) {}
        e.dataTransfer.effectAllowed = "move";
      });
      row.addEventListener("dragend", () => {
        row.classList.remove("dragging");
        box.querySelectorAll(".plcat").forEach(c => c.classList.remove("over"));
        dragI = null;
      });
    });
    box.querySelectorAll(".plcat").forEach(head => {
      head.addEventListener("dragover", (e) => {
        e.preventDefault(); e.dataTransfer.dropEffect = "move";
        head.classList.add("over");
      });
      head.addEventListener("dragleave", () => head.classList.remove("over"));
      head.addEventListener("drop", async (e) => {
        e.preventDefault();
        head.classList.remove("over");
        const i = dragI != null ? dragI : +(e.dataTransfer.getData("text/plain") || -1);
        const p = places[i];
        const to = head.dataset.c;
        if (!p || !to || p.category === to) return;
        const { error } = await sb.from("map_places").update({ category: to }).eq("id", p.id);
        if (error) { alert("옮기기 실패: " + error.message); return; }
        p.category = to;
        if (!shown.has(to)) {
          shown.add(to);
          const c = boxes.querySelector(`input[data-c="${to}"]`);
          if (c) { c.checked = true; c.closest(".ly").classList.remove("off"); }
        }
        draw();
      });
    });

    box.querySelectorAll(".pldel").forEach(b => b.addEventListener("click", async () => {
      const p = places[+b.dataset.i];
      if (!confirm(`「${p.name}」 을 지도에서 지울까요?`)) return;
      b.disabled = true;
      if (p.storage_path) await sb.storage.from("map").remove([p.storage_path]);
      const { error } = await sb.from("map_places").delete().eq("id", p.id);
      if (error) { alert("지우기 실패: " + error.message); b.disabled = false; return; }
      draw();
    }));
  }

  // ── 장소 안내 창 ──
  const modal = document.getElementById("pmodal");
  const close = () => modal.classList.remove("on");
  document.getElementById("pClose").addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  function open(i) {
    const p = places[i];
    if (!p) return;
    document.getElementById("pCat").textContent = CAT_NAME[p.category] || "";
    document.getElementById("pName").textContent = p.name;
    document.getElementById("pAddr").textContent = p.address || "";
    document.getElementById("pJp").textContent = p.jp || "";
    const img = document.getElementById("pImg");
    if (p.image_url) { img.src = p.image_url; img.style.display = ""; } else img.style.display = "none";
    document.getElementById("pNote").textContent = p.note || "";
    document.getElementById("pNoteBox").style.display = p.note ? "" : "none";
    document.getElementById("pMemo").textContent = p.memory || "";
    document.getElementById("pMemoBox").style.display = p.memory ? "" : "none";
    document.getElementById("pWays").innerHTML =
      (p.ways || []).map(w => `<li>${w}</li>`).join("");
    // 이름으로 찾아야 구글 지도에 가게 정보·메뉴·사진·후기가 함께 나옵니다
    const gq = [p.name, (p.address || "").split(",").slice(0, 3).join(" ")]
                 .filter(Boolean).join(" ").trim();
    const gmap = gq
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gq)}`
      : `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
    document.getElementById("pMap").href = gmap;
    document.getElementById("pDir").href = gq
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(gq)}`
      : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
    const post = document.getElementById("pPost");
    if (false) { /* 연결할 게시판이 없습니다 */ }
    else post.style.display = "none";
    const who = document.getElementById("pWho");
    const when = p.created_at ? String(p.created_at).slice(0, 10).replace(/-/g, ".") : "";
    who.innerHTML = p.builtin ? ""
      : p.owner_admin ? `<b>관리자</b>${when ? " · " + when : ""} 가 올린 장소입니다`
      : p.owner_name ? `<b>공유자(${esc(p.owner_name)})</b>${when ? " · " + when : ""} 가 올린 장소입니다`
      : (when ? when + " 에 올라온 장소입니다" : "");
    /* ── My Favorite ──
       올린 사람이나 관리자만 켜고 끕니다.
       종합 갈래에서 「My Favorite 만」 으로 골라 볼 수 있습니다. */
    const fav = document.getElementById("pFav");
    const canFav = !p.builtin && ((user && p.created_by === user.id) || isAdmin);
    fav.style.display = canFav ? "" : (p.fav ? "" : "none");
    fav.classList.toggle("on", !!p.fav);
    fav.textContent = (p.fav ? "★" : "☆") + " My Favorite";
    fav.disabled = !canFav;
    fav.onclick = async () => {
      if (!canFav) return;
      const next = !p.fav;
      fav.disabled = true;
      const { error } = await sb.from("map_places").update({ fav: next }).eq("id", p.id);
      fav.disabled = false;
      if (error) {
        alert(/column|schema cache/i.test(error.message || "")
          ? "My Favorite 칸이 아직 없습니다 — auth/map_fav.sql 을 한 번 돌려 주세요."
          : "바꾸지 못했습니다: " + error.message);
        return;
      }
      p.fav = next;
      fav.classList.toggle("on", next);
      fav.textContent = (next ? "★" : "☆") + " My Favorite";
      draw();
    };

    // 분류 바꾸기 — 바꾸면 지도 표시도 그 분류의 기호로 바뀝니다
    const sel = document.getElementById("pCatSel");
    const canCat = !p.builtin && ((user && p.created_by === user.id) || isAdmin);
    sel.style.display = canCat ? "" : "none";
    if (canCat) {
      sel.innerHTML = CATS.map(([k, v]) =>
        `<option value="${k}"${k === p.category ? " selected" : ""}>${v}</option>`).join("");
      sel.onchange = async () => {
        const to = sel.value;
        if (to === p.category) return;
        sel.disabled = true;
        const { error } = await sb.from("map_places").update({ category: to }).eq("id", p.id);
        sel.disabled = false;
        if (error) { alert("분류 바꾸기 실패: " + error.message); sel.value = p.category; return; }
        p.category = to;
        if (!shown.has(to)) {                       // 꺼둔 분류로 옮겼으면 켜 준다
          shown.add(to);
          const c = boxes.querySelector(`input[data-c="${to}"]`);
          if (c) { c.checked = true; c.closest(".ly").classList.remove("off"); }
        }
        close();
        draw();
      };
    }
    const mv = document.getElementById("pMove");
    const canEdit = !p.builtin && ((user && p.created_by === user.id) || isAdmin);
    mv.style.display = canEdit ? "" : "none";
    mv.onclick = () => startMove(i);

    /* ── 내용 고치기 (이름 · 특징 · 추천사유) ── */
    const editWrap = document.getElementById("pEdit");
    const editBtn  = document.getElementById("pEditBtn");
    const eMsg     = document.getElementById("eMsg");
    editBtn.style.display = canEdit ? "" : "none";
    editWrap.style.display = "none";           // 열 때는 늘 접힌 채로
    eMsg.textContent = "";

    function showEdit(on) {
      editWrap.style.display = on ? "" : "none";
      // 고치는 동안에는 읽는 칸과 아래 단추줄을 감춥니다
      document.getElementById("pNoteBox").style.display = on ? "none" : (p.note ? "" : "none");
      document.getElementById("pMemoBox").style.display = on ? "none" : (p.memory ? "" : "none");
      document.getElementById("pFoot").style.display = on ? "none" : "";
      document.getElementById("pName").style.display = on ? "none" : "";
      if (on) {
        document.getElementById("eName").value = p.name || "";
        document.getElementById("eNote").value = p.note || "";
        document.getElementById("eMemo").value = p.memory || "";
        eMsg.textContent = "";
        document.getElementById("eName").focus();
      }
    }
    editBtn.onclick = () => showEdit(true);
    document.getElementById("eCancel").onclick = () => showEdit(false);

    document.getElementById("eSave").onclick = async (ev) => {
      const name = document.getElementById("eName").value.trim();
      const note = document.getElementById("eNote").value.trim();
      const memo = document.getElementById("eMemo").value.trim();
      if (!name) { eMsg.textContent = "이름은 비워둘 수 없습니다."; return; }
      ev.target.disabled = true;
      eMsg.textContent = "저장하는 중…";
      const { error } = await sb.from("map_places")
        .update({ name, note: note || null, memory: memo || null })
        .eq("id", p.id);
      ev.target.disabled = false;
      if (error) {
        const m = error.message || "";
        eMsg.textContent = /row-level security|policy/i.test(m)
          ? "고칠 권한이 없습니다. 본인이 올린 장소만 고칠 수 있습니다."
          : "저장하지 못했습니다: " + m;
        return;
      }
      // 화면에 바로 반영합니다 (다시 불러오지 않아도 되도록)
      p.name = name; p.note = note || null; p.memory = memo || null;
      document.getElementById("pName").textContent = p.name;
      document.getElementById("pNote").textContent = p.note || "";
      document.getElementById("pMemo").textContent = p.memory || "";
      showEdit(false);
      draw();                                   // 지도 표시의 이름표도 새로
    };
    const del = document.getElementById("pDel");
    const mine = !p.builtin && user && p.created_by === user.id;
    del.style.display = (mine || (isAdmin && !p.builtin)) ? "" : "none";
    del.onclick = async () => {
      if (!confirm(`「${p.name}」 을 지도에서 지울까요?`)) return;
      if (p.storage_path) await sb.storage.from("map").remove([p.storage_path]);
      const { error } = await sb.from("map_places").delete().eq("id", p.id);
      if (error) { alert("지우기 실패: " + error.message); return; }
      close(); draw();
    };
    modal.classList.add("on");
  }

  /** 한국 주소는 도로명·지번이 섞여 들어오므로, 여러 형태로 바꿔가며 찾아본다 */
  async function geocode(raw) {
    const one = async (q, extra = "") => {
      try {
        const u = "https://nominatim.openstreetmap.org/search?format=json&limit=1"
                + "&addressdetails=1&extratags=1&namedetails=1&accept-language=ko"
                + "&countrycodes=kr" + extra + "&q=" + encodeURIComponent(q);
        const j = await fetch(u, { headers: { Accept: "application/json" } }).then(r => r.json());
        return (j && j[0]) || null;
      } catch (e) { return null; }
    };
    const base = String(raw || "").trim();
    if (!base) return null;
    const tries = [base];
    // 우편번호(06236 / 서울 06236)는 빼고
    const nozip = base.replace(/\b\d{5}\b/g, "").trim();
    if (nozip && nozip !== base) tries.push(nozip);
    // 괄호 안 참고사항 (예: "…로 12 (역삼동, 대륭빌딩)") 은 빼고
    const noparen = nozip.replace(/[([（][^)\]）]*[)\]）]/g, "").trim();
    if (noparen && noparen !== nozip) tries.push(noparen);
    // 층·호·동 표기 (3층, 201호, 101동) 는 빼고
    const nofloor = noparen.replace(/\s*\d+\s*(층|호|동)\b/g, "").trim();
    if (nofloor && nofloor !== noparen) tries.push(nofloor);
    // 건물번호를 뒤에서부터 덜어내며 (…대로 123-4 → …대로 123 → …대로)
    let cut = nofloor || noparen || nozip;
    for (let i = 0; i < 3; i++) {
      const m = cut.match(/^(.*?)[\s]*\d+(-\d+)?$/);
      if (!m || !m[1]) break;
      cut = m[1].trim();
      if (cut.length > 3) tries.push(cut);
    }
    // 서울이 안 적혀 있으면 붙여서도 한 번
    if (!/서울/.test(base)) tries.push("서울 " + base);

    for (const q of [...new Set(tries)].filter(Boolean)) {
      const hit = await one(q);
      if (hit) return hit;
    }
    // 그래도 없으면 자동완성 검색으로 한 번 더 — 서울 도심 쪽을 우선으로
    try {
      const u = "https://photon.komoot.io/api/?limit=1&lang=en&lat=37.5665&lon=126.9780"
              + "&location_bias_scale=0.6&q=" + encodeURIComponent(base);
      const j = await fetch(u, { headers: { Accept: "application/json" } }).then(r => r.json());
      const ft = (j.features || []).find(f => (f.properties || {}).countrycode === "KR")
              || (j.features || [])[0];
      if (ft && (ft.properties || {}).countrycode === "KR") {
        const c = ft.geometry.coordinates;
        return { lat: c[1], lon: c[0], display_name: base, extratags: {},
                 class: ft.properties.osm_key, type: ft.properties.osm_value, address: {} };
      }
    } catch (e) {}
    return null;
  }

  // ── 지도를 눌러 위치를 직접 찍기 ──
  //    주소 검색이 잘 안 될 때 지도를 확대해 원하는 자리를 찍으시면 됩니다.
  let pinMode = false, pin = null;
  {
    const btn = document.getElementById("apPin");
    const msgEl = () => document.getElementById("apMsg");
    const setMode = (on) => {
      pinMode = on;
      btn.classList.toggle("on", on);
      btn.textContent = on ? "📍 지도를 누르세요 (끄기)" : "📍 지도에서 찍기";
      document.getElementById("cmap").style.cursor = on ? "crosshair" : "";
      if (on) {
        msgEl().textContent = "지도를 확대해서 원하는 자리를 누르세요. 표시를 끌어 옮길 수도 있습니다.";
        document.querySelector(".mapbox").scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    btn.addEventListener("click", () => setMode(!pinMode));

    // 적어 넣은 주소로 찾아 지도에 찍기
    document.getElementById("apFind").addEventListener("click", async () => {
      const addrEl = document.getElementById("apAddr");
      const q = addrEl.value.trim();
      if (!q) { msgEl().textContent = "먼저 주소를 적어주세요."; return; }
      const fb = document.getElementById("apFind");
      fb.disabled = true; msgEl().textContent = "주소로 위치를 찾는 중…";
      const hit = await geocode(q);
      fb.disabled = false;
      if (!hit) {
        msgEl().textContent = "그 주소를 찾지 못했습니다. ［📍 지도에서 찍기］ 로 직접 눌러주세요.";
        setMode(true);
        return;
      }
      const ll = { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) };
      picked = { lat: ll.lat, lon: ll.lng };
      map.setView([ll.lat, ll.lng], 17);
      if (pin) pin.setLatLng(ll);
      else {
        pin = L.marker(ll, { draggable: true, zIndexOffset: 900,
          icon: L.divIcon({ className: "", iconSize: [0, 0],
            html: '<div class="cmark pinmark"><i></i><b>여기</b></div>' }) }).addTo(map);
        pin.on("dragend", () => {
          const p = pin.getLatLng();
          picked = { lat: p.lat, lon: p.lng };
          reverse(p.lat, p.lng);
        });
      }
      const noteEl = document.getElementById("apNote");
      const kind = kindOf(hit);
      if (kind && !noteEl.value.trim()) noteEl.value = `(${kind})`;
      msgEl().textContent = "지도에 찍었습니다. 자리가 다르면 표시를 끌어 옮기거나 ［📍 지도에서 찍기］ 로 다시 눌러주세요.";
      document.querySelector(".mapbox").scrollIntoView({ behavior: "smooth", block: "center" });
    });

    async function reverse(lat, lng) {
      const addrEl = document.getElementById("apAddr");
      const noteEl = document.getElementById("apNote");
      addrEl.value = "위치를 확인하는 중…";
      try {
        const u = "https://nominatim.openstreetmap.org/reverse?format=json&zoom=18"
                + "&addressdetails=1&extratags=1&namedetails=1&accept-language=ko"
                + `&lat=${lat}&lon=${lng}`;
        const h = await fetch(u, { headers: { Accept: "application/json" } }).then(r => r.json());
        addrEl.value = (h && h.display_name) || `위도 ${lat.toFixed(5)}, 경도 ${lng.toFixed(5)}`;
        const kind = h ? kindOf(h) : "";
        if (kind && !noteEl.value.trim()) noteEl.value = `(${kind})`;
      } catch (e) {
        addrEl.value = `위도 ${lat.toFixed(5)}, 경도 ${lng.toFixed(5)}`;
      }
      msgEl().textContent = "위치를 찍었습니다. 이름과 추천사유를 적고 ［지도에 올리기］ 를 눌러주세요.";
    }

    window.__utkSetPin = (ll) => {
      picked = { lat: ll.lat, lon: ll.lng };
      if (pin) pin.setLatLng(ll);
      else {
        pin = L.marker(ll, { draggable: true, zIndexOffset: 900,
          icon: L.divIcon({ className: "", iconSize: [0, 0],
            html: '<div class="cmark pinmark"><i></i><b>여기</b></div>' }) }).addTo(map);
        pin.on("dragend", () => {
          const p = pin.getLatLng();
          picked = { lat: p.lat, lon: p.lng };
          reverse(p.lat, p.lng);
        });
      }
      reverse(ll.lat, ll.lng);
    };
    window.__utkClearPin = () => {
      if (pin) { map.removeLayer(pin); pin = null; }
      setMode(false);
    };
    map.on("click", (e) => { if (pinMode) window.__utkSetPin(e.latlng); });
  }

  // ── 상호명을 적으면 주소 후보를 보여준다 ──
  let picked = null;                     // 후보에서 고른 위치 (있으면 다시 찾지 않습니다)
  {
    const nameEl = document.getElementById("apName");
    const addrEl = document.getElementById("apAddr");
    const sug = document.getElementById("apSug");
    // 서울과 그 언저리 — 이 네모 안에서 먼저 찾습니다
    const SEOUL = "&viewbox=126.55,37.85,127.35,37.35&bounded=1";
    let timer = null, lastQ = "";

    const hide = () => { sug.classList.remove("on"); sug.innerHTML = ""; };
    addrEl.addEventListener("input", () => { picked = null; });      // 직접 고치면 다시 찾습니다
    document.addEventListener("click", (e) => { if (!sug.contains(e.target) && e.target !== nameEl) hide(); });

    /** OpenStreetMap 에 없는 이름은 위키백과에서 좌표(또는 영어 이름)를 얻어 다시 찾습니다 */
    async function viaWiki(q) {
      const api = (host, p) => fetch(`https://${host}/w/api.php?origin=*&format=json&` + p)
                                 .then(r => r.json()).catch(() => null);
      const sr = await api("ko.wikipedia.org",
        "action=query&list=search&srlimit=3&srsearch=" + encodeURIComponent(q));
      const hits = (sr && sr.query && sr.query.search) || [];
      if (!hits.length) return [];
      const titles = hits.map(h => h.title);
      const info = await api("ko.wikipedia.org",
        "action=query&prop=coordinates|langlinks&lllang=en&lllimit=1&titles="
        + encodeURIComponent(titles.join("|")));
      const pages = (info && info.query && info.query.pages) || {};
      const out = [];
      for (const key of Object.keys(pages)) {
        const p = pages[key];
        const en = p.langlinks && p.langlinks[0] && p.langlinks[0]["*"];
        const co = p.coordinates && p.coordinates[0];
        out.push({ ko: p.title, alt: en, lat: co && co.lat, lon: co && co.lon });
      }
      return out.filter(x => x.alt || (x.lat && x.lon));
    }

    /** Photon — 일부만 쳐도 찾아주는 자동완성 검색 */
    async function photon(q) {
      try {
        const u = "https://photon.komoot.io/api/?limit=8&lang=en"
                + "&lat=37.5665&lon=126.9780&location_bias_scale=0.6"
                + "&q=" + encodeURIComponent(q);
        const j = await fetch(u, { headers: { Accept: "application/json" } }).then(r => r.json());
        return (j.features || []).filter(ft => (ft.properties || {}).countrycode === "KR").map(ft => {
          const p = ft.properties || {};
          const c = (ft.geometry && ft.geometry.coordinates) || [];
          const line = [p.housenumber, p.street, p.district, p.city, p.state, p.country]
                         .filter(Boolean).join(", ");
          return {
            lat: c[1], lon: c[0],
            name: p.name || p.street || "",
            display_name: [p.name, line].filter(Boolean).join(", "),
            class: p.osm_key, type: p.osm_value,
            address: { suburb: p.district, city: p.city },
            namedetails: { name: p.name },
            extratags: {},
            _photon: true,
          };
        }).filter(x => x.lat && x.lon && x.display_name);
      } catch (e) { return []; }
    }

    async function nomi(q) {
      const u = "https://nominatim.openstreetmap.org/search?format=json&limit=6"
              + "&addressdetails=1&extratags=1&namedetails=1&accept-language=ko"
              + SEOUL + "&q=" + encodeURIComponent(q);
      try { return await fetch(u, { headers: { Accept: "application/json" } }).then(r => r.json()); }
      catch (e) { return []; }
    }

    async function look(q) {
      if (q.length < 2 || q === lastQ) return;
      lastQ = q;
      sug.innerHTML = '<div class="apsmsg">주소를 찾는 중…</div>';
      sug.classList.add("on");
      let list = await photon(q);            // 일부만 쳐도 찾아주는 검색
      if (!list.length) list = await nomi(q);  // 그래도 없으면 정밀 검색
      // 한글로 적으셨는데 못 찾으면 위키백과로 다른 이름·좌표를 찾아 다시 검색합니다
      if ((!list || !list.length) && /[가-힣]/.test(q)) {
        sug.innerHTML = '<div class="apsmsg">다른 이름으로 다시 찾는 중…</div>';
        const wk = await viaWiki(q);
        for (const w of wk) {
          if (w.alt) {
            const r = await nomi(w.alt);
            if (r && r.length) { list = r; break; }
          }
        }
        // 그래도 없으면 위키백과 좌표로 주소를 되찾습니다
        if ((!list || !list.length) && wk.length) {
          const w = wk.find(x => x.lat && x.lon);
          if (w) {
            try {
              const ru = "https://nominatim.openstreetmap.org/reverse?format=json&zoom=18"
                       + "&addressdetails=1&extratags=1&accept-language=ko"
                       + `&lat=${w.lat}&lon=${w.lon}`;
              const rv = await fetch(ru, { headers: { Accept: "application/json" } }).then(r => r.json());
              if (rv && rv.display_name) {
                rv.name = w.ko;
                list = [rv];
              }
            } catch (e) {}
          }
        }
      }
      if (!list || !list.length) {
        sug.innerHTML = '<div class="apsmsg">찾지 못했습니다.<br>' +
          '도로명 주소로 적어보시거나(예: 서울 종로구 사직로 161), ' +
          '아래 <b>📍 지도에서 찍기</b> 로 자리를 직접 짚어주세요.</div>';
        return;
      }
      sug.innerHTML = list.map((h, i) => {
        const head = (h.name || h.display_name.split(",")[0]).trim();
        return `<button type="button" class="apsitem" data-i="${i}">` +
               `<b>${esc(head)}</b><span>${esc(h.display_name)}</span></button>`;
      }).join("");
      sug.querySelectorAll(".apsitem").forEach(b => b.addEventListener("click", async () => {
        const h = list[+b.dataset.i];
        addrEl.value = h.display_name;
        picked = { lat: parseFloat(h.lat), lon: parseFloat(h.lon) };
        // 「이곳의 특징」을 채워드립니다 (고치셔도 됩니다)
        const noteEl = document.getElementById("apNote");
        let kind = kindOf(h);
        const already = noteEl.value.trim();
        let tags = h.extratags || {};
        if (h._photon) {                      // 자세한 정보를 한 번 더 확인
          try {
            const ru = "https://nominatim.openstreetmap.org/reverse?format=json&zoom=18"
                     + "&addressdetails=1&extratags=1&namedetails=1&accept-language=ko"
                     + `&lat=${h.lat}&lon=${h.lon}`;
            const rv = await fetch(ru, { headers: { Accept: "application/json" } }).then(r => r.json());
            if (rv && !rv.error) { tags = rv.extratags || {}; kind = kindOf(rv) || kind; }
          } catch (e) {}
        }
        const osmDesc = tags["description:ko"] || tags["description"] || "";
        if (!already) noteEl.value = osmDesc || (kind ? `(${kind})` : "");   // 우선 종류만이라도
        hide();
        msgSafe("주소를 넣었습니다. 어떤 곳인지 찾아보는 중…");
        if (!already && !osmDesc) {
          const nm = (h.namedetails && (h.namedetails["name:ko"] || h.namedetails.name))
                   || h.name || (h.display_name || "").split(",")[0];
          describeFromWiki(nm).then(d => {
            const now = noteEl.value.trim();
            if (d && (now === "" || now === kind || now === `(${kind})`)) {   // 손대지 않으셨을 때만
              noteEl.value = kind ? `(${kind}) ${d}` : d;
            }
            msgSafe("특징을 채웠습니다. 맞지 않으면 고쳐주세요. 추억은 원하실 때만 적으시면 됩니다.");
          });
        } else {
          msgSafe("주소를 넣었습니다. 추억은 원하실 때만 적으시면 됩니다.");
        }
      }));
    }
    const msgSafe = (t) => { const m = document.getElementById("apMsg"); if (m) m.textContent = t; };
    nameEl.addEventListener("input", () => {
      clearTimeout(timer);
      const q = nameEl.value.trim();
      if (q.length < 2) { hide(); return; }
      timer = setTimeout(() => look(q), 550);        // 타이핑이 멈추면 찾습니다
    });
  }

  // ── 사진 붙여넣기 · 끌어놓기 ──
  {
    const zone = document.getElementById("apDrop");
    const input = document.getElementById("apImg");
    const prev = document.getElementById("apPrev");
    const note = document.getElementById("apImgMsg");
    const setFile = (file) => {
      if (!file || !/^image\//.test(file.type)) return false;
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      prev.src = URL.createObjectURL(file);
      prev.style.display = "";
      note.innerHTML = "사진 1장이 준비됐습니다. <b>다시 붙여넣으면 바뀝니다.</b>";
      return true;
    };
    input.addEventListener("change", () => setFile(input.files[0]));
    // 끌어놓기
    ["dragenter", "dragover"].forEach(ev => zone.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation(); zone.classList.add("on");
    }));
    ["dragleave", "drop"].forEach(ev => zone.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation(); zone.classList.remove("on");
    }));
    zone.addEventListener("drop", (e) => setFile((e.dataTransfer?.files || [])[0]));
    // 붙여넣기 (화면 어디서 눌러도 이 칸에 들어갑니다)
    window.addEventListener("paste", (e) => {
      const items = [...(e.clipboardData?.items || [])];
      const it = items.find(x => x.kind === "file" && /^image\//.test(x.type));
      if (!it) return;
      const f = it.getAsFile();
      if (f && setFile(f)) {
        e.preventDefault();
        zone.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }

  // ── 올린 장소의 위치를 마우스로 옮기기 ──
  let moving = null;                       // { i, marker, from }
  function startMove(i) {
    const p = places[i], mk = markers[i];
    if (!p || !mk) return;
    close();
    moving = { i, marker: mk, from: mk.getLatLng() };
    mk.dragging && mk.dragging.enable();
    mk.setZIndexOffset(1000);
    const el = mk.getElement && mk.getElement();
    if (el) el.querySelector(".cmark")?.classList.add("moving");
    document.getElementById("moveName").textContent = p.name;
    document.getElementById("moveBar").classList.add("on");
    map.setView(mk.getLatLng(), Math.max(map.getZoom(), 16));
  }
  function endMove(keep) {
    if (!moving) return;
    const { marker, from } = moving;
    marker.dragging && marker.dragging.disable();
    const el = marker.getElement && marker.getElement();
    if (el) el.querySelector(".cmark")?.classList.remove("moving");
    document.getElementById("moveBar").classList.remove("on");
    if (!keep) marker.setLatLng(from);
    moving = null;
  }
  document.getElementById("moveNo").addEventListener("click", () => endMove(false));
  document.getElementById("moveOk").addEventListener("click", async () => {
    if (!moving) return;
    const { i, marker } = moving;
    const p = places[i];
    const ll = marker.getLatLng();
    const btn = document.getElementById("moveOk");
    btn.disabled = true; btn.textContent = "저장 중…";
    const { error } = await sb.from("map_places")
      .update({ lat: ll.lat, lng: ll.lng }).eq("id", p.id);
    btn.disabled = false; btn.textContent = "이 자리로 저장";
    if (error) { alert("위치 저장 실패: " + error.message); return; }
    endMove(true);
    draw();
  });

  // ── 장소 추가 (주소 → 위치 찾기) ──
  const msg = document.getElementById("apMsg");
  document.getElementById("apGo").addEventListener("click", async () => {
    const name = document.getElementById("apName").value.trim();
    const addr = document.getElementById("apAddr").value.trim();
    const note = document.getElementById("apNote").value.trim();
    const memo = document.getElementById("apMemo").value.trim();
    const file = document.getElementById("apImg").files[0] || null;
    if (!name) { msg.textContent = "장소 이름을 적어주세요."; return; }
    if (!addr) { msg.textContent = "주소를 적어주세요."; return; }
    const btn = document.getElementById("apGo");
    btn.disabled = true;
    let hit = picked ? { lat: picked.lat, lon: picked.lon } : null;
    if (hit) msg.textContent = "올리는 중…";
    else {
      msg.textContent = "주소로 위치를 찾는 중…";
      hit = await geocode(addr);
    }
    if (!hit) {
      btn.disabled = false;
      msg.textContent = "그 주소를 찾지 못했습니다. 위 ［📍 지도에서 찍기］ 로 위치를 직접 눌러주세요.";
      return;
    }
    // 사진이 있으면 먼저 올린다
    let image_url = null, storage_path = null;
    if (file) {
      msg.textContent = "사진을 올리는 중…";
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      storage_path = `map/${GRP}/${cur}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const up = await sb.storage.from("map").upload(storage_path, file, { cacheControl: "3600" });
      if (up.error) {
        btn.disabled = false; msg.textContent = "사진 올리기 실패: " + up.error.message;
        return;
      }
      image_url = sb.storage.from("map").getPublicUrl(storage_path).data.publicUrl;
    }
    const { error } = await sb.from("map_places").insert({
      grp: GRP,
      category: cur, name, address: addr, note: note || null,
      memory: memo || null, image_url, storage_path,
      lat: parseFloat(hit.lat), lng: parseFloat(hit.lon),
      owner_name: (me && me.is_admin) ? "" : ((me && me.name) || ""),
      owner_admin: !!(me && me.is_admin),
      created_by: user.id,
    });
    btn.disabled = false;
    if (error) {
      const m = error.message || "";
      msg.textContent =
        /schema cache|does not exist/i.test(m)
          ? "지도 기능이 아직 켜지지 않았습니다 — auth/map_setup.sql 을 한 번 실행해주세요."
        : /row-level security|policy/i.test(m)
          ? "승인된 회원만 올릴 수 있습니다. 운영진 승인 후 다시 시도해주세요."
        : "올리기 실패: " + m;
      return;
    }
    picked = null;
    if (window.__utkClearPin) window.__utkClearPin();
    document.getElementById("apName").value = "";
    document.getElementById("apAddr").value = "";
    document.getElementById("apNote").value = "";
    document.getElementById("apMemo").value = "";
    document.getElementById("apImg").value = "";
    document.getElementById("apPrev").style.display = "none";
    document.getElementById("apImgMsg").innerHTML =
      "여기에 <b>붙여넣기(Ctrl+V)</b> 하거나, 사진을 <b>끌어다 놓으세요</b>. 눌러서 고르셔도 됩니다.";
    msg.textContent = `「${name}」 을 지도에 올렸습니다.`;
    if (!shown.has(cur)) {                       // 꺼둔 분류에 올렸으면 켜서 보여준다
      shown.add(cur);
      const c = boxes.querySelector(`input[data-c="${cur}"]`);
      if (c) { c.checked = true; c.closest(".ly").classList.remove("off"); }
    }
    draw();
  });

  window.addEventListener("resize", () => setTimeout(() => map.invalidateSize(), 120));
  tabHtml();
  draw();
}
