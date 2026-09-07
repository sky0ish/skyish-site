// ─── 단체사진 고르기 시험 ───────────────────────────────────
//
//   돌리는 법 :  node tools/test/photo-pick.mjs
//
// 「사진중에 얼굴개수가 가장 많은 단체사진만 1장 올리면 되」
// 회의 폴더의 pictures(사진) 안에서 한 장을 고르는 규칙입니다.

import { pickBest, whyPicked, isPicDir, IMG_RE, PIC_DIRS, needEyes, TIE }
  from "../../assets/js/notes-photo-pick.js";

let bad = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { console.log("  ✓ " + name); return; }
  bad++;
  console.log("  ✗ " + name + "\n      나온 값: " + JSON.stringify(got) +
                              "\n      바란 값: " + JSON.stringify(want));
};
const P = (name, faces, w, h) => ({ name, faces, w: w || 4000, h: h || 3000 });
const E = (name, faces, open) => ({ name, faces, open, w: 4000, h: 3000 });

console.log("\n── 사진 폴더 알아보기 ──");
eq("사진·pictures 둘 다", [isPicDir("사진"), isPicDir("pictures"), isPicDir("Pictures")],
   [true, true, true]);
eq("대소문자를 안 가린다", [isPicDir("PICTURES"), isPicDir("Photos")], [true, true]);
eq("앞뒤 빈칸이 있어도", isPicDir("  사진  "), true);
eq("다른 폴더는 아니다", [isPicDir("녹음"), isPicDir("자료"), isPicDir("")],
   [false, false, false]);
eq("사진 폴더 이름들", PIC_DIRS.includes("사진") && PIC_DIRS.includes("pictures"), true);

console.log("\n── 그림 파일 ──");
eq("그림들",
   ["a.jpg", "a.JPEG", "a.png", "a.webp", "a.avif", "a.heic"].map((n) => IMG_RE.test(n)),
   [true, true, true, true, true, true]);
eq("그림이 아닌 것", ["a.pdf", "a.m4a", "a.hwpx", "a"].map((n) => IMG_RE.test(n)),
   [false, false, false, false]);

console.log("\n── 얼굴이 가장 많은 한 장 ──");
eq("얼굴이 많은 쪽",
   pickBest([P("혼자.jpg", 1), P("단체.jpg", 7), P("둘이.jpg", 2)]).name, "단체.jpg");
eq("한 장뿐이면 그것", pickBest([P("하나.jpg", 3)]).name, "하나.jpg");
eq("아무것도 없으면 null", [pickBest([]), pickBest(null)], [null, null]);
eq("이름 없는 것은 빼고 겨룬다",
   pickBest([{ faces: 9 }, P("있는것.jpg", 1)]).name, "있는것.jpg");

console.log("\n── 얼굴이 같으면 폴더 차례대로 첫 번째 ──");
/* 「눈 감지 않은 사진으로 랜덤으로 첫번째 사진」 —
   얼굴 수와 눈이 같으면 크기를 따지지 않고 **먼저 있는 것**을 씁니다.
   그래야 두 번 돌려도 같은 사진이 올라갑니다. */
eq("먼저 있는 것",
   pickBest([P("작은것.jpg", 5, 1200, 900), P("큰것.jpg", 5, 4000, 3000)]).name, "작은것.jpg");
eq("차례가 바뀌면 답도 바뀐다",
   pickBest([P("큰것.jpg", 5, 4000, 3000), P("작은것.jpg", 5, 1200, 900)]).name, "큰것.jpg");

console.log("\n── 얼굴을 못 셌을 때 ──");
/* faces 가 -1 이면 못 센 것입니다. 한 장이라도 센 것이 있으면 그쪽이 이깁니다 —
   셈이 있는 쪽이 믿을 만하니까요. */
eq("센 것이 못 센 것을 이긴다",
   pickBest([P("못셈.jpg", -1, 9000, 9000), P("셌음.jpg", 1, 100, 100)]).name, "셌음.jpg");
eq("얼굴 0명이어도 못 센 것보다는 낫다",
   pickBest([P("못셈.jpg", -1, 9000, 9000), P("사람없음.jpg", 0, 100, 100)]).name,
   "사람없음.jpg");
eq("아무도 못 셌으면 큰 것으로",
   pickBest([P("작은것.jpg", -1, 100, 100), P("큰것.jpg", -1, 4000, 3000)]).name, "큰것.jpg");
eq("크기도 모르면 차례대로",
   pickBest([P("IMG_0009.jpg", -1, 0, 0), P("IMG_0002.jpg", -1, 0, 0)]).name, "IMG_0009.jpg");

console.log("\n── 얼굴 수가 같으면 눈 뜬 사진으로 ──");
/* 「얼굴 개수가 많은 사진이 여러개있을 때..
    눈 감지 않은 사진으로 랜덤으로 첫번째 사진 올려주」 */
eq("눈 뜬 쪽",
   pickBest([E("감음.jpg", 7, 0.2), E("떴음.jpg", 7, 1)]).name, "떴음.jpg");
eq("얼굴이 더 많으면 눈보다 얼굴이 먼저",
   pickBest([E("많음_감음.jpg", 9, 0), E("적음_떴음.jpg", 3, 1)]).name, "많음_감음.jpg");
eq("눈까지 같으면 폴더 차례대로 첫 번째",
   pickBest([E("두번째.jpg", 7, 1), E("첫번째.jpg", 7, 1)]).name, "두번째.jpg");
eq("눈을 못 본 것은 본 것에 진다",
   pickBest([E("못봄.jpg", 7, -1), E("봤음.jpg", 7, 0.5)]).name, "봤음.jpg");
eq("아무도 눈을 못 봤으면 차례대로",
   pickBest([E("가.jpg", 7, -1), E("나.jpg", 7, -1)]).name, "가.jpg");

console.log("\n── 눈까지 볼 사진 고르기 ──");
/* 눈 보는 셈은 무거워서(3.7MB 모델) 겨룰 때만 씁니다 */
eq("얼굴이 가장 많은 것이 하나뿐이면 볼 것 없다",
   needEyes([P("단체.jpg", 9), P("혼자.jpg", 1)]).length, 0);
eq("비슷하게 많은 것이 둘이면 둘 다 본다",
   needEyes([P("가.jpg", 9), P("나.jpg", 9), P("다.jpg", 1)]).map((x) => x.name),
   ["가.jpg", "나.jpg"]);
eq("한 명 차이까지는 겨루는 것으로 본다",
   needEyes([P("가.jpg", 9), P("나.jpg", 8)]).length, 2);
eq("두 명 넘게 차이 나면 안 겨룬다",
   needEyes([P("가.jpg", 9), P("나.jpg", 5)]).length, 0);
eq("얼굴을 아무도 못 셌으면 볼 것 없다",
   needEyes([P("가.jpg", -1), P("나.jpg", -1)]).length, 0);
eq("얼굴이 0명뿐이면 볼 것 없다", needEyes([P("가.jpg", 0), P("나.jpg", 0)]).length, 0);
eq("빈 목록", [needEyes([]).length, needEyes(null).length], [0, 0]);
eq("겨루는 폭", TIE, 1);

console.log("\n── 고른 까닭을 말로 ──");
eq("얼굴을 세었으면 몇 명인지",
   whyPicked(P("단체.jpg", 7), 5), "단체.jpg (얼굴 7명 · 5장 가운데)");
eq("눈까지 봤으면 그것도",
   whyPicked(E("단체.jpg", 7, 0.75), 5), "단체.jpg (얼굴 7명 · 눈 뜬 얼굴 75% · 5장 가운데)");
eq("한 장뿐이면 그 말은 뺀다", whyPicked(P("단체.jpg", 7), 1), "단체.jpg (얼굴 7명)");
eq("못 셌으면 그렇다고 말한다",
   whyPicked(P("어떤것.jpg", -1), 4),
   "어떤것.jpg (4장 가운데 가장 큰 것 — 얼굴을 세지 못했습니다)");
eq("얼굴이 0명이어도 못 센 것처럼 말한다",
   whyPicked(P("풍경.jpg", 0), 1), "풍경.jpg");
eq("고른 것이 없으면 빈 글자", whyPicked(null, 3), "");

console.log(bad ? `\n✗ ${bad} 군데 어긋납니다\n` : "\n✓ 모두 지납니다\n");
process.exit(bad ? 1 : 0);
