// ─── 회의 사진 가운데 단체사진 한 장 고르기 ──────────────────
//
//  1.회의록/<회의 폴더>/사진/ 에 그날 찍은 사진이 여러 장 들어옵니다.
//  그 가운데 **얼굴이 가장 많이 나온 한 장**만 골라 그날 Schedule 글에 붙입니다.
//
//    20260831_비스트로미_이소라_김형준_신창/
//        자문회의 개최건의(8월31일)_new.pdf
//        20260831_…_회의록.pdf        ← 이것과
//        사진/                        ← 여기서 고른 단체사진 한 장을 함께 올립니다
//            IMG_0001.jpg
//            IMG_0002.jpg  ← 얼굴 일곱 — 이것이 올라갑니다
//
//  ※ 얼굴을 세는 일은 **이 브라우저 안에서만** 일어납니다.
//     사진이 얼굴 찾기 프로그램 쪽으로 나가지 않습니다 (프로그램이 내려와서
//     여기서 돕니다). 고른 한 장만 글의 붙임 파일로 올라갑니다.
//
//  얼굴 찾기가 안 되는 브라우저에서는 **가장 큰 사진**을 고르고 그렇다고 알립니다.
//
//  고르는 규칙(pickBest)은 화면이 없는 셈이라 node 로 시험할 수 있습니다
//  (tools/test/photo-pick.mjs).

/** 회의 폴더 안에서 사진이 담긴 하위 폴더 이름 */
export const PIC_DIRS = ["사진", "Pictures", "pictures", "photos", "photo", "IMG"];

/** 그림 파일인가 */
export const IMG_RE = /\.(jpe?g|png|webp|avif|heic|heif)$/i;

/** 이 폴더가 사진 폴더인가 */
export const isPicDir = (name) =>
  PIC_DIRS.some((d) => d.toLowerCase() === String(name || "").trim().toLowerCase());

/**
 * 여럿 가운데 단체사진 한 장을 고릅니다.
 *
 *   ① 얼굴이 가장 많은 것
 *   ② 같으면 **눈을 감지 않은** 것
 *   ③ 그래도 같으면 폴더에 있는 차례대로 첫 번째
 *      (아무도 얼굴을 못 셌을 때만, 그 앞에 넓은 것을 봅니다)
 *
 * faces 가 -1 이면 「못 셌다」, open 이 -1 이면 「눈을 못 봤다」 는 뜻입니다.
 * 하나라도 센 것이 있으면 못 센 것은 지게 둡니다 — 셈이 있는 쪽이 믿을 만합니다.
 *
 * 차례를 마지막 잣대로 쓰므로 **두 번 돌려도 같은 사진**이 나옵니다.
 *
 * @param list [{name, faces, open, w, h}] — 폴더에 있는 차례대로
 * @returns 고른 것, 없으면 null
 */
export function pickBest(list) {
  const L = (Array.isArray(list) ? list : []).filter((x) => x && x.name);
  if (!L.length) return null;
  const faces = (x) => (typeof x.faces === "number" ? x.faces : -1);
  const open = (x) => (typeof x.open === "number" ? x.open : -1);
  const area = (x) => (Number(x.w) || 0) * (Number(x.h) || 0);
  const counted = L.some((x) => faces(x) >= 0);
  const looked = L.some((x) => open(x) >= 0);
  const fScore = (x) => (counted ? Math.max(faces(x), -1) : 0);
  const oScore = (x) => (looked ? Math.max(open(x), -1) : 0);
  /* 얼굴을 아무도 못 셌을 때만 넓이를 봅니다 — 그때는 그것밖에 단서가 없습니다 */
  const aScore = (x) => (counted ? 0 : area(x));
  return L.map((x, i) => [x, i]).sort((A, B) =>
    fScore(B[0]) - fScore(A[0]) ||
    oScore(B[0]) - oScore(A[0]) ||
    aScore(B[0]) - aScore(A[0]) ||
    A[1] - B[1]                       // 폴더에 있는 차례대로 첫 번째
  )[0][0];
}

/** 얼굴 수가 이만큼 차이 안 나면 「비긴 것」 으로 보고 눈까지 봅니다 */
export const TIE = 1;

/** 눈을 봐야 할 사진들 — 얼굴이 가장 많은 것들 (한 장뿐이면 볼 것도 없습니다) */
export function needEyes(list) {
  const L = (Array.isArray(list) ? list : []).filter((x) => x && x.name);
  const top = Math.max(...L.map((x) => (typeof x.faces === "number" ? x.faces : -1)), -1);
  if (top <= 0) return [];
  const near = L.filter((x) => (x.faces || 0) >= top - TIE && (x.faces || 0) > 0);
  return near.length > 1 ? near : [];
}

/** 고른 까닭을 사람 말로 — 알림에 씁니다 */
export function whyPicked(best, n) {
  if (!best) return "";
  if (typeof best.faces === "number" && best.faces > 0) {
    const eyes = typeof best.open === "number" && best.open >= 0
      ? " · 눈 뜬 얼굴 " + Math.round(best.open * 100) + "%" : "";
    return best.name + " (얼굴 " + best.faces + "명" + eyes +
           (n > 1 ? " · " + n + "장 가운데" : "") + ")";
  }
  return best.name + (n > 1 ? " (" + n + "장 가운데 가장 큰 것 — 얼굴을 세지 못했습니다)" : "");
}

/* ── 여기서부터는 브라우저에서만 돕니다 ────────────────────── */

const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/" +
  "blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
/* 눈을 떴는지 보려면 얼굴 표정까지 읽어야 합니다 — 이 모델이 더 큽니다(3.7MB).
   그래서 **얼굴 수가 비긴 사진들에만** 씁니다. */
const EYE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/" +
  "face_landmarker/float16/1/face_landmarker.task";
/* 이 값을 넘으면 감은 눈으로 봅니다 (0=완전히 뜸, 1=완전히 감음) */
const BLINK = 0.5;

let detJob = null;          // 얼굴 찾기 프로그램 — 한 번만 내려받습니다

/** 얼굴 찾는 이를 준비합니다. 못 하면 null (그때는 큰 사진으로 고릅니다). */
export function faceFinder() {
  if (detJob) return detJob;
  detJob = (async () => {
    /* ① 브라우저가 이미 가지고 있으면 그것을 씁니다 (안드로이드 크롬 등) */
    try {
      if (typeof window !== "undefined" && typeof window.FaceDetector === "function") {
        const d = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 64 });
        const got = async (img) => (await d.detect(img)).length;
        await got(new ImageData(8, 8));            // 정말 도는지 한 번 봅니다
        return got;
      }
    } catch (e) { /* 없거나 안 되면 아래로 */ }
    /* ② 없으면 구글 얼굴 찾기(MediaPipe)를 내려받습니다 — 500KB 남짓, 한 번만.
       사진은 이 브라우저 밖으로 안 나갑니다. 프로그램이 여기로 내려옵니다. */
    try {
      const m = await import(/* @vite-ignore */ MP + "/vision_bundle.mjs");
      const fileset = await m.FilesetResolver.forVisionTasks(MP + "/wasm");
      const det = await m.FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.35,
      });
      return async (img) => ((det.detect(img) || {}).detections || []).length;
    } catch (e) { return null; }
  })();
  return detJob;
}

let eyeJob = null;

/** 눈 뜬 얼굴을 세는 이를 준비합니다. 못 하면 null. */
export function eyeFinder() {
  if (eyeJob) return eyeJob;
  eyeJob = (async () => {
    try {
      const m = await import(/* @vite-ignore */ MP + "/vision_bundle.mjs");
      const fileset = await m.FilesetResolver.forVisionTasks(MP + "/wasm");
      const lm = await m.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: EYE_MODEL },
        runningMode: "IMAGE",
        numFaces: 32,
        outputFaceBlendshapes: true,
      });
      /** @returns 눈 뜬 얼굴의 비율 (0~1), 얼굴을 못 찾으면 -1 */
      return (img) => {
        const r = lm.detect(img) || {};
        const shapes = r.faceBlendshapes || [];
        if (!shapes.length) return -1;
        let open = 0;
        shapes.forEach((f) => {
          const cat = (f && f.categories) || [];
          const val = (nm) => {
            const c = cat.find((x) => x.categoryName === nm);
            return c ? c.score : 0;
          };
          /* 두 눈 다 떠 있어야 「눈 뜬 얼굴」 로 셉니다 */
          if (val("eyeBlinkLeft") < BLINK && val("eyeBlinkRight") < BLINK) open++;
        });
        return open / shapes.length;
      };
    } catch (e) { return null; }
  })();
  return eyeJob;
}

/** 그림을 적당한 크기로 줄여 그립니다 — 큰 사진을 그대로 넣으면 느립니다 */
async function toCanvas(blob, max) {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, (max || 1024) / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * s));
  const h = Math.max(1, Math.round(bmp.height * s));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").drawImage(bmp, 0, 0, w, h);
  const out = { canvas: c, w: bmp.width, h: bmp.height };
  try { bmp.close(); } catch (e) {}
  return out;
}

/**
 * 사진들을 훑어 단체사진 한 장을 고릅니다.
 * @param files [{name, file}]  — file 은 진짜 File/Blob
 * @param onStep 몇 장째인지 알려 줍니다 (화면에 씁니다)
 * @returns {best, list} — best 는 {name, file, faces, w, h}, 없으면 null
 */
export async function bestPhoto(files, onStep) {
  const L = (Array.isArray(files) ? files : []).filter((x) => x && x.name && x.file);
  if (!L.length) return { best: null, list: [] };
  const find = await faceFinder();
  const list = [];
  let i = 0;
  for (const it of L) {
    i++;
    if (typeof onStep === "function") onStep(i, L.length);
    let faces = -1, w = 0, h = 0;
    try {
      const { canvas, w: ow, h: oh } = await toCanvas(it.file, 1024);
      w = ow; h = oh;
      if (find) {
        try { faces = await find(canvas); } catch (e) { faces = -1; }
      }
    } catch (e) { /* 못 읽는 그림은 크기 0 으로 두고 겨루게 합니다 */ }
    list.push({ name: it.name, file: it.file, faces, w, h, open: -1 });
  }

  /* 얼굴이 가장 많은 사진이 **여러 장**일 때만 눈까지 봅니다 —
     눈을 보는 셈은 무겁습니다(3.7MB 모델). 한 장뿐이면 볼 것도 없습니다. */
  const tie = needEyes(list);
  if (tie.length > 1) {
    const eyes = await eyeFinder();
    if (eyes) {
      let k = 0;
      for (const it of tie) {
        k++;
        if (typeof onStep === "function") onStep(k, tie.length, "eyes");
        try {
          const { canvas } = await toCanvas(it.file, 1024);
          it.open = eyes(canvas);
        } catch (e) { it.open = -1; }
      }
    }
  }
  return { best: pickBest(list), list };
}
