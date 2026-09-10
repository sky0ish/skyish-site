// ─── Contact 「To Me」 — 메일 앱을 열지 않고 바로 보내기 ───────
//
//  「메일 보내기를 누르면 메일이 바로 가게 해줘」
//
//  정적 사이트는 스스로 메일을 보낼 수 없어, 두 길을 함께 씁니다.
//    ① Supabase 의 messages 표에 남깁니다 (auth/messages_setup.sql) —
//       관리자가 To Me 아래 「받은 메시지」 에서 곧바로 봅니다. 로그인 없이도 누구나 남길 수 있습니다.
//    ② auth/config.js 의 FORM_ENDPOINT(Formspree 같은 메일 전달 서비스)가 있으면
//       거기로도 보내 whlove@gmail.com 메일함까지 갑니다.
//  둘 다 안 되면 예전처럼 메일 앱(mailto)을 엽니다 — 글이 사라지지는 않게.
//
//  어느 길로 갔는지는 단추 아래 글로 알려 줍니다.
import { sb, currentUser, myProfile } from "../../auth/auth.js";
import { FORM_ENDPOINT } from "../../auth/config.js";

export const OWNERS = ["whlove@gmail.com", "skyish76@gmail.com"];
export const TO = "whlove@gmail.com";
const NL = String.fromCharCode(10);

const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** 폼 값 → 보낼 것. 빈 이름·메일·내용이면 null */
export function payloadOf(v) {
  const name = String(v.name || "").trim(), email = String(v.email || "").trim();
  const subject = String(v.subject || "").trim(), message = String(v.message || "").trim();
  if (!name || !email || !message) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return { name: name.slice(0, 120), email: email.slice(0, 200),
           subject: (subject || "홈페이지에서 온 메시지").slice(0, 200), message: message.slice(0, 5000) };
}

/** 표가 아직 없을 때 나는 오류인가 */
const noTable = (e) => !!e && /does not exist|relation|schema cache|42P01|Could not find the table/i
  .test(String(e.message || e.details || e.hint || ""));

/** mailto 주소 — 마지막 수단 */
export function mailtoOf(p) {
  const body = p.message + NL + NL + "—" + NL + "From: " + p.name + NL + "Email: " + p.email;
  return "mailto:" + TO + "?subject=" + encodeURIComponent(p.subject) + "&body=" + encodeURIComponent(body);
}

/** Supabase 에 남기기 — 됐으면 true, 표가 없으면 false, 그 밖의 오류는 던집니다 */
async function keep(p) {
  const r = await sb.from("messages").insert({ name: p.name, email: p.email, subject: p.subject, message: p.message });
  if (r.error) { if (noTable(r.error)) return false; throw r.error; }
  return true;
}

/** Formspree 로 보내기 — 됐으면 true */
async function relay(p) {
  if (!FORM_ENDPOINT) return false;
  const res = await fetch(FORM_ENDPOINT, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ name: p.name, email: p.email, _replyto: p.email, subject: p.subject, message: p.message }),
  });
  return res.ok;
}

export function initContactForm(formId = "contact-form") {
  const form = document.getElementById(formId);
  if (!form) return;
  form.dataset.direct = "1";                          // main.js 의 mailto 처리를 물립니다
  const note = form.querySelector(".form__note");
  const btn = form.querySelector('button[type="submit"]');
  const say = (t, ok) => { if (note) { note.textContent = t; note.style.color = ok ? "var(--teal-text, #2f7d6f)" : ""; } };
  say("Send 를 누르면 바로 전해집니다 — 메일 앱을 열지 않습니다.");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    /* 벌레(스팸)용 숨은 칸 — 사람은 못 보니 채워져 있으면 벌레입니다 */
    if ((form.elements.website || {}).value) { say("보냈습니다.", true); form.reset(); return; }
    const p = payloadOf({
      name: (form.elements.name || {}).value, email: (form.elements.email || {}).value,
      subject: (form.elements.subject || {}).value, message: (form.elements.message || {}).value,
    });
    if (!p) { say("이름 · 메일 주소 · 내용을 적어 주세요."); return; }
    if (btn) { btn.disabled = true; }
    say("보내는 중…");
    let kept = false, sent = false, err = "";
    try { kept = await keep(p); } catch (x) { err = (x && x.message) || ""; }
    try { sent = await relay(p); } catch (x) { err = err || ((x && x.message) || ""); }
    if (btn) btn.disabled = false;
    if (sent || kept) {
      say(sent ? "보냈습니다 — 메일함으로 바로 갑니다. 고맙습니다."
               : "남겼습니다 — 남지현에게 바로 전해집니다. 고맙습니다.", true);
      form.reset();
      document.dispatchEvent(new CustomEvent("contact:sent", { detail: p }));
      return;
    }
    /* 두 길이 다 막혀 있으면 메일 앱으로 — 글은 그대로 실어 보냅니다 */
    say("바로 보내는 길이 아직 열려 있지 않아 메일 앱을 엽니다. 열리지 않으면 " + TO + " 로 보내 주세요." +
        (err ? " (" + err + ")" : ""));
    window.location.href = mailtoOf(p);
  });
}

/* ── 받은 메시지 — 관리자에게만 ─────────────────────────── */
export async function initInbox(mountId = "inbox") {
  const mount = document.getElementById(mountId);
  if (!mount) return false;
  const user = await currentUser();
  const me = user ? await myProfile().catch(() => null) : null;
  const mail = ((user && user.email) || "").toLowerCase();
  const isAdmin = !!(me && me.is_admin) || OWNERS.indexOf(mail) >= 0;
  if (!isAdmin) { mount.remove(); return false; }

  let rows = [];
  async function load() {
    const r = await sb.from("messages").select("*").order("created_at", { ascending: false }).limit(200);
    if (r.error) {
      if (noTable(r.error)) { mount.innerHTML = '<p class="fb-sub">받은 메시지를 모으려면 Supabase → SQL Editor 에서 <code>auth/messages_setup.sql</code> 을 한 번 돌려 주세요.</p>'; return false; }
      throw r.error;
    }
    rows = r.data || [];
    return true;
  }
  const when = (s) => { const d = new Date(s); return isNaN(d) ? "" : d.getMonth() + 1 + "." + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  function render() {
    const unread = rows.filter((x) => !x.read).length;
    mount.innerHTML =
      '<h3 class="inbox__h">받은 메시지 <small>' + rows.length + "건" + (unread ? " · 안 읽음 " + unread : "") + "</small></h3>" +
      (rows.length ? '<ul class="inbox__list">' + rows.map((x) =>
        '<li class="inbox__it' + (x.read ? "" : " is-new") + '" data-id="' + esc(x.id) + '">' +
          '<div class="inbox__meta"><b>' + esc(x.name) + "</b> · " +
            '<a href="mailto:' + esc(x.email) + '?subject=' + encodeURIComponent("Re: " + (x.subject || "")) + '">' + esc(x.email) + "</a>" +
            ' <span>' + esc(when(x.created_at)) + "</span></div>" +
          '<div class="inbox__sub">' + esc(x.subject || "") + "</div>" +
          '<div class="inbox__body">' + esc(x.message || "").split(NL).join("<br>") + "</div>" +
          '<div class="inbox__acts">' +
            '<button type="button" class="nbtn nbtn--sm" data-act="read">' + (x.read ? "안 읽음으로" : "읽음") + "</button>" +
            '<button type="button" class="nbtn nbtn--sm nbtn--del" data-act="del">지우기</button>' +
          "</div></li>").join("") + "</ul>"
      : '<p class="fb-sub">아직 받은 메시지가 없습니다.</p>');
  }
  mount.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const li = b.closest("li"); const x = rows.find((r) => r.id === li.dataset.id); if (!x) return;
    try {
      if (b.dataset.act === "read") {
        const r = await sb.from("messages").update({ read: !x.read }).eq("id", x.id);
        if (r.error) throw r.error; x.read = !x.read;
      } else if (b.dataset.act === "del") {
        if (!confirm("지울까요?" + NL + x.subject)) return;
        const r = await sb.from("messages").delete().eq("id", x.id);
        if (r.error) throw r.error; rows = rows.filter((r) => r.id !== x.id);
      }
      render();
    } catch (err) { alert("바꾸지 못했습니다 — " + (err && err.message)); }
  });
  document.addEventListener("contact:sent", async () => { try { if (await load()) render(); } catch (e) {} });
  try { if (await load()) render(); }
  catch (err) { mount.innerHTML = '<p class="fb-sub">받은 메시지를 읽지 못했습니다 — ' + esc(err && err.message) + "</p>"; }
  return true;
}
