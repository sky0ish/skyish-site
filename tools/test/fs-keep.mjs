// ─── 고른 폴더 기억하기 시험 ─────────────────────────────
//   돌리는 법 :  node tools/test/fs-keep.mjs
// 「한번 세팅하면 계속 유지되게 해줄수없을까?」 — 허락 상태를 어떻게 보는지 봅니다.

import { usable, pick } from "../../assets/js/fs-keep.js";

let bad = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { console.log("  ✓ " + name); return; }
  bad++;
  console.log("  ✗ " + name + "\n      나온 값: " + JSON.stringify(got) +
                              "\n      바란 값: " + JSON.stringify(want));
};
const H = (query, request) => ({
  name: "1.세미나_토론",
  queryPermission: async () => query,
  requestPermission: async () => (request || query),
});

console.log("허락 보기");
eq("허락이 살아 있으면 그대로", await usable(H("granted"), "readwrite", true), "granted");
eq("잠들었고 안 여쭈면 prompt", await usable(H("prompt"), "readwrite", false), "prompt");
eq("★ 잠들었어도 여쭈어 허락하면 granted", await usable(H("prompt", "granted"), "readwrite", true), "granted");
eq("여쭈었는데 막으면 denied", await usable(H("prompt", "denied"), "readwrite", true), "denied");
eq("손잡이가 없으면 none", await usable(null, "read", true), "none");
eq("손잡이 꼴이 아니면 none", await usable({}, "read", true), "none");

console.log("폴더 고르기");
let asked = 0;
const picker = async () => { asked++; return H("granted"); };
const got = await pick("시험", { mode: "readwrite", picker });
eq("★ 기억이 없으면 고르게 한다", [got.from, asked], ["picked", 1]);
const none = await pick("시험", { mode: "readwrite", picker: async () => { throw new Error("닫음"); } });
eq("고르다 닫으면 빈손", [none.handle, none.from], [null, null]);
eq("고를 수단이 없으면 빈손", (await pick("시험", { picker: null })).handle, null);

console.log(bad ? `\n✗ ${bad} 군데 어긋납니다\n` : "\n✓ 모두 지납니다\n");
process.exit(bad ? 1 : 0);
