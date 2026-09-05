// ─── 얼굴 잘라 이름 달기 시험 ───────────────────────────────
//
//   돌리는 법 :  node tools/test/facetag.mjs

import { boxFromDrag, cropRect, fitSize, nameHints, tagLine }
  from "../../assets/js/notes-facetag.js";
import { splitPeople } from "../../assets/js/notes-cards.js";

let bad = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { console.log("  ✓ " + name); return; }
  bad++;
  console.log("  ✗ " + name + "\n      나온 값: " + JSON.stringify(got) +
                              "\n      바란 값: " + JSON.stringify(want));
};

console.log("\n── 끈 자리를 비율 네모로 ──");
eq("가운데 네 몫의 한",
   boxFromDrag({ x: 100, y: 50 }, { x: 300, y: 250 }, 400, 400),
   { x: 0.25, y: 0.125, w: 0.5, h: 0.5 });
eq("거꾸로 끌어도 같다",
   boxFromDrag({ x: 300, y: 250 }, { x: 100, y: 50 }, 400, 400),
   { x: 0.25, y: 0.125, w: 0.5, h: 0.5 });
eq("그림 밖으로 나가면 가둔다",
   boxFromDrag({ x: -50, y: -50 }, { x: 500, y: 500 }, 400, 400),
   { x: 0, y: 0, w: 1, h: 1 });
eq("손이 미끄러진 정도는 안 봅니다",
   boxFromDrag({ x: 10, y: 10 }, { x: 13, y: 13 }, 400, 400), null);
eq("점을 안 찍었으면", boxFromDrag(null, { x: 1, y: 1 }, 400, 400), null);
eq("크기를 모르면", boxFromDrag({ x: 0, y: 0 }, { x: 9, y: 9 }, 0, 0), null);

console.log("\n── 진짜 그림에서 자를 자리 ──");
/* 1000x800 그림의 한가운데 20% 네모, 둘레 18% 여유 */
const box = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 };
eq("여유를 두고 자른다", cropRect(box, 1000, 800),
   { x: 364, y: 291, w: 272, h: 218 });
eq("여유 없이도", cropRect(box, 1000, 800, 0),
   { x: 400, y: 320, w: 200, h: 160 });
eq("왼위 모서리에서는 밖으로 안 나간다",
   cropRect({ x: 0, y: 0, w: 0.2, h: 0.2 }, 1000, 800, 0.5),
   { x: 0, y: 0, w: 300, h: 240 });
eq("오른아래 모서리에서도",
   cropRect({ x: 0.8, y: 0.8, w: 0.2, h: 0.2 }, 1000, 800, 0.5),
   { x: 700, y: 560, w: 300, h: 240 });
eq("네모가 없으면", cropRect(null, 100, 100), null);
eq("그림 크기를 모르면", cropRect(box, 0, 0), null);

console.log("\n── 담을 크기 ──");
eq("큰 것은 줄인다", fitSize(1600, 1200, 480), { w: 480, h: 360 });
eq("세로가 길면 세로를 맞춘다", fitSize(600, 1200, 480), { w: 240, h: 480 });
eq("작은 것은 그대로", fitSize(200, 150, 480), { w: 200, h: 150 });
eq("험한 값", fitSize(0, 0, 480), { w: 1, h: 1 });

console.log("\n── 이름 고르기 ──");
const CARDS = ["김철수", "박영희", "서민호"];
const P = "서민호 (국토연구원), 김고은";
eq("그 자리에 있던 사람이 먼저",
   nameHints(P, splitPeople, CARDS, "").map((x) => x.name),
   ["서민호", "김고은", "김철수", "박영희"]);
eq("여기 있던 사람 표시",
   nameHints(P, splitPeople, CARDS, "").map((x) => x.here),
   [true, true, false, false]);
eq("치는 대로 좁혀진다",
   nameHints(P, splitPeople, CARDS, "김").map((x) => x.name), ["김고은", "김철수"]);
eq("같은 이름은 한 번만",
   nameHints("서민호", splitPeople, ["서민호"], "").map((x) => x.name), ["서민호"]);
eq("만난 사람이 비어도 명함첩은 나온다",
   nameHints("", splitPeople, CARDS, "박").map((x) => x.name), ["박영희"]);
eq("아무것도 없으면", nameHints("", splitPeople, [], ""), []);

console.log("\n── 본문에 남길 한 줄 ──");
eq("이름을 모아 적는다",
   tagLine([{ name: "서민호" }, { name: "김고은" }]), "사진 속 사람: 서민호, 김고은");
eq("이름 없는 것은 뺀다", tagLine([{ name: "" }, { name: "가" }]), "사진 속 사람: 가");
eq("하나도 없으면 빈 줄", tagLine([]), "");
eq("아무것도 아닌 것", tagLine(null), "");

console.log(bad ? `\n✗ ${bad} 군데 어긋납니다\n` : "\n✓ 모두 지납니다\n");
process.exit(bad ? 1 : 0);
