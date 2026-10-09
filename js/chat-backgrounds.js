/* ══════════════════════════════════════════
   js/chat-backgrounds.js — خلفيات الشات الديناميكية
   Stored in Firestore: appSettings/chatBackgrounds
   { public: "url", rooms: "url", private: "url" }
   منقول من index.html بدون أي تغيير في المنطق —
   فقط استبدال المراجع المحلية بمراجع window المكافئة.
   ⚠️ سطرا "تفعيل" الاستماع (selectChat hook + _listenChatBg الأولي)
   فضلوا عمداً في index.html نفسه (مش هنا) بسبب حساسية توقيت التنفيذ،
   بالضبط زي ما اتعمل مع pin-message.js.
   ✅ سطرا isAdmin/isOwner تحت اتصلّحوا (كانوا بياخدوا مرجع الدالة بدل
   نتيجة تنفيذها فيبقى الفحص دايمًا truthy ويتجاوز أي حد الصلاحية —
   شوف التعليق فوق uploadChatBg/removeChatBg بالتفصيل).
══════════════════════════════════════════ */
import { doc, onSnapshot, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let _currentBgType = "public";
let _bgThemeSel = null;   // الوضع المختار في لوحة الأدمن للرفع/الإزالة (null = وضع الواجهة الحالي)

// ── خلفيات مستقلة لكل وضع (فاتح/داكن) ──
// الحقول في appSettings/chatBackgrounds:  {type}_light  و  {type}_dark   (type = public | rooms | private)
// ▸ كل وضع يقرأ حقله هو فقط — لا يتأثر بالوضع الآخر إطلاقًا.
// ▸ حقل الوضع غير موجود (لم يُضبط أبدًا) → يُستخدم الحقل القديم المشترك {type} كافتراضي (توافق مع الخلفيات الحالية).
// ▸ "" (إزالة صريحة) → بدون خلفية في هذا الوضع ولا رجوع للحقل القديم.
const _bgTheme = () => document.documentElement.classList.contains("theme-light") ? "light" : "dark";
function _bgPick(data, type, theme) {
  const v = data ? data[type + "_" + (theme || _bgTheme())] : undefined;
  return v !== undefined ? (v || "") : ((data && data[type]) || "");
}
// تسخين صورتي الوضعين لنوع الشات الحالي (مرة واحدة لكل رابط) ليكون التبديل فوريًا بلا تحميل
const _bgWarmed = new Set();
function _bgWarm(data, type) {
  ["light", "dark"].forEach(t => {
    const u = _bgPick(data, type, t);
    if (u && !_bgWarmed.has(u)) { _bgWarmed.add(u); try { const im = new Image(); im.decoding = "async"; im.src = u; } catch (e) {} }
  });
}
const _bgSettingsRef = () => doc(window.db, "appSettings", "chatBackgrounds");

// Apply background to the visible chat container
// ⚠️ كانت بتستهدف ".chat-main" (الواجهة القديمة المخفية display:none داخل
// #oldChatMainLegacy)، فكانت الخلفية بتتطبّق فعليًا لكن على عنصر غير ظاهر
// للمستخدم أبدًا. اتغيّر الاستهداف لـ ".newchat-shell .phone" وهو العنصر
// الظاهر فعليًا في التصميم الجديد. باقي منطق الحفظ/الكاش/Firestore زي ما هو.

// ── ستايل الخلفية: طبقتين (مغبّشة للتعبئة + الصورة الأصلية كاملة فوقها) ──
function _ensureBgStyle() {
  if (document.getElementById("chatBgStyle")) return;
  const st = document.createElement("style");
  st.id = "chatBgStyle";
  st.textContent = `
.newchat-shell .phone.has-bg{
  isolation:isolate;
  background-image:none !important;
  background-color:#000;
}
.newchat-shell .phone.has-bg::before,
.newchat-shell .phone.has-bg::after{
  content:""; position:absolute; top:0; left:0; right:0;
  height:var(--chat-bg-h,100%);            /* ارتفاع الشاشة الكامل (ثابت مع الكيبورد) */
  z-index:-1; pointer-events:none;
  background-position:center; background-repeat:no-repeat;
  background-image:var(--chat-bg-url);
}
.newchat-shell .phone.has-bg::before{      /* تعبئة مغبّشة */
  top:-24px; left:-24px; right:-24px;
  height:calc(var(--chat-bg-h,100%) + 48px);
  background-size:cover;
  filter:blur(24px) brightness(.75);
}
.newchat-shell .phone.has-bg::after{       /* الصورة الأصلية كاملة */
  background-size:contain;
}`;
  document.head.appendChild(st);
}

// ── ثبات الخلفية مع الكيبورد ──
// لما الكيبورد يفتح الـ .phone بيقصر (resizes-content)، فكان contain بيصغّر الصورة.
// بنحفظ أقصى ارتفاع وصله الـ phone (من غير كيبورد) لنفس العرض، ونستخدمه كارتفاع للخلفية.
let _bgRO = null, _bgMaxH = 0, _bgW = 0;
function _trackBgHeight(el) {
  const upd = () => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    if (Math.abs(w - _bgW) > 40) { _bgW = w; _bgMaxH = 0; }   // تغيّر العرض (دوران/تغيير حجم) → ابدأ من جديد
    if (h > _bgMaxH) _bgMaxH = h;
    el.style.setProperty("--chat-bg-h", _bgMaxH + "px");
  };
  upd();
  if (_bgRO) return;
  if (window.ResizeObserver) { _bgRO = new ResizeObserver(upd); _bgRO.observe(el); }
  window.addEventListener("orientationchange", () => { _bgMaxH = 0; setTimeout(upd, 350); });
}

function _applyChatBg(type, url) {
  const el = document.querySelector(".newchat-shell .phone");
  if (!el) return;
  const currentType = window._currentChatId === "public" ? "public"
    : window._currentChatId?.startsWith("room:") ? "rooms" : "private";
  if (type !== currentType) return;
  // الرابط يُحسم هنا حسب الوضع الحالي من آخر بيانات محفوظة — فلا يتغلب عليه استدعاء قديم (من نسخة index.html قديمة) يمرّر الحقل المشترك فقط
  const _c = _bgCacheGet();
  if (_c[type] !== undefined || _c[type + "_light"] !== undefined || _c[type + "_dark"] !== undefined) url = _bgPick(_c, type);
  if (url) {
    // ✅ عرض الصورة كاملة بنسبتها الأصلية (contain) بدون قص أو تكرار أو تمدد،
    // والمساحة الفاضية حواليها بتتملي بنسخة مغبّشة من نفس الصورة (CSS تحت).
    _ensureBgStyle();
    el.style.setProperty("--chat-bg-url", `url("${String(url).replace(/"/g, "%22")}")`);
    el.classList.add("has-bg");
    _trackBgHeight(el);
  } else {
    el.style.removeProperty("--chat-bg-url");
    el.classList.remove("has-bg");
  }
}

const _BG_CACHE_KEY = "_chatBgCache";
function _bgCacheGet()     { try { return JSON.parse(localStorage.getItem(_BG_CACHE_KEY)||"{}"); } catch(e){ return {}; } }
function _bgCacheSet(data) { try { localStorage.setItem(_BG_CACHE_KEY, JSON.stringify(data)); } catch(e){} }

// Apply cached background instantly (no network needed)
function _applyChatBgFromCache(chatId) {
  const id   = chatId || window._currentChatId;
  const type = id === "public" ? "public" : id?.startsWith("room:") ? "rooms" : "private";
  const c    = _bgCacheGet();
  if (c[type] !== undefined || c[type + "_light"] !== undefined || c[type + "_dark"] !== undefined) {
    _applyChatBg(type, _bgPick(c, type));
    _bgWarm(c, type);
  }
}

// Listen for background changes in real-time
let _bgUnsub = null;
function _listenChatBg() {
  _applyChatBgFromCache();          // ── تطبيق الكاش فوراً لمنع الوميض ──
  if (_bgUnsub) { try { _bgUnsub(); } catch(e){} }
  _bgUnsub = onSnapshot(_bgSettingsRef(), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    _bgCacheSet(data);
    const type = window._currentChatId === "public" ? "public"
      : window._currentChatId?.startsWith("room:") ? "rooms" : "private";
    _applyChatBg(type, _bgPick(data, type));
    _bgWarm(data, type);
  }, () => {});
}

// تبديل الوضع (يدوي/تلقائي): أعد تطبيق خلفية الوضع الجديد فورًا من الكاش المحلي (بدون شبكة ولا قراءة Firestore)
let _bgLastTheme = null;
// لو index.html لا يحوي صف «فاتح / داكن» (نسخة قديمة/مخزّنة) يُضاف هنا مرة واحدة فقط
function _ensureBgThemeTabs() {
  if (document.querySelector("[data-bgtheme]")) return;
  const panel = document.querySelector("#chatBgSec .chat-bg-panel");
  if (!panel) return;
  const labels = panel.querySelectorAll(".label");
  const anchor = labels.length ? labels[labels.length - 1] : null;   // «رفع خلفية جديدة»
  const wrap = document.createElement("div");
  wrap.innerHTML = '<div class="label">الوضع (خلفية مستقلة لكل وضع)</div>' +
    '<div class="chat-bg-tabs">' +
    '<button class="chat-bg-tab" data-bgtheme="light" onclick="selectBgTheme(this)">☀️ فاتح</button>' +
    '<button class="chat-bg-tab" data-bgtheme="dark" onclick="selectBgTheme(this)">🌙 داكن</button></div>';
  while (wrap.firstChild) panel.insertBefore(wrap.firstChild, anchor);
}
function _syncBgThemeTabs() {
  try { _ensureBgThemeTabs(); } catch (e) {}
  const t = _bgThemeSel || _bgTheme();
  document.querySelectorAll("[data-bgtheme]").forEach(b => b.classList.toggle("active", b.dataset.bgtheme === t));
}
try {
  _bgLastTheme = _bgTheme();
  new MutationObserver(() => {
    const t = _bgTheme();
    if (t === _bgLastTheme) return;
    _bgLastTheme = t;
    _applyChatBgFromCache();
    _syncBgThemeTabs();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  _syncBgThemeTabs();
} catch (e) {}

// Admin: select bg tab
function selectBgTab(btn) {
  btn.parentElement.querySelectorAll(".chat-bg-tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  _currentBgType = btn.dataset.bgtype;
}
window.selectBgTab = selectBgTab;

// Admin: اختيار الوضع (فاتح/داكن) المراد رفع/إزالة خلفيته
function selectBgTheme(btn) {
  _bgThemeSel = btn.dataset.bgtheme;
  _syncBgThemeTabs();
}
window.selectBgTheme = selectBgTheme;

// Admin: upload background
async function uploadChatBg() {
  // 🐛→✅ كانت "window.isAdmin" و"window.isOwner" (مرجع الدالة نفسه، مش
  // نتيجة تنفيذها) — وأي مرجع دالة في JS دايمًا truthy، فكان الشرط تحت
  // ماينفّذش أبدًا مهما كان المستخدم مش أدمن ولا أونر. اتصلّحت بإضافة
  // الاستدعاء الفعلي "?.()" (زي باقي استخدامات isAdmin()/isOwner() في
  // index.html) عشان فحص الصلاحية يشتغل فعليًا.
  const isAdmin = window.isAdmin?.();
  const isOwner = window.isOwner?.();
  const toast = window.toast;
  if (!isAdmin && !isOwner) { toast("غير مصرح","error"); return; }
  const file = document.getElementById("chatBgFileInput")?.files[0];
  if (!file) { toast("اختر صورة أولاً","warn"); return; }
  if (!file.type.startsWith("image/")) { toast("يجب أن يكون ملف صورة","error"); return; }
  if (file.size > 5*1024*1024) { toast("الصورة أكبر من 5MB","error"); return; }
  const btn = document.getElementById("chatBgUploadBtn");
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جارٍ الرفع...';
  try {
    const { url } = await window.uploadToCloudinaryWithProgress(file, ()=>{});
    const key = _currentBgType + "_" + (_bgThemeSel || _bgTheme());
    await setDoc(_bgSettingsRef(), { [key]: url }, { merge: true });
    _bgCacheSet({ ..._bgCacheGet(), [key]: url });
    toast("✅ تم تطبيق خلفية الوضع " + ((_bgThemeSel || _bgTheme()) === "light" ? "الفاتح" : "الداكن") + " على الجميع");
  } catch(e) {
    toast("فشل رفع الخلفية","error"); console.error(e);
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-upload"></i> رفع وتطبيق';
    const fi = document.getElementById("chatBgFileInput");
    if (fi) fi.value = "";
  }
}
window.uploadChatBg = uploadChatBg;

// Admin: remove background
async function removeChatBg() {
  // 🐛→✅ نفس تصحيح uploadChatBg أعلاه: استدعاء فعلي للدالة بدل مرجعها
  const isAdmin = window.isAdmin?.();
  const isOwner = window.isOwner?.();
  const toast = window.toast;
  if (!isAdmin && !isOwner) { toast("غير مصرح","error"); return; }
  try {
    const key = _currentBgType + "_" + (_bgThemeSel || _bgTheme());
    await setDoc(_bgSettingsRef(), { [key]: "" }, { merge: true });
    _bgCacheSet({ ..._bgCacheGet(), [key]: "" });
    toast("✅ تمت إزالة خلفية الوضع " + ((_bgThemeSel || _bgTheme()) === "light" ? "الفاتح" : "الداكن"));
  } catch(e) {
    toast("فشل إزالة الخلفية","error");
  }
}
window.removeChatBg = removeChatBg;

window._applyChatBg = _applyChatBg;
window._applyChatBgFromCache = _applyChatBgFromCache;
window._listenChatBg = _listenChatBg;
window._bgCacheGet = _bgCacheGet;
window._bgCacheSet = _bgCacheSet;
window._chatBgPick = _bgPick;
