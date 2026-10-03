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
  if (c[type] !== undefined) _applyChatBg(type, c[type] || "");
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
    _applyChatBg(type, data[type] || "");
  }, () => {});
}

// Admin: select bg tab
function selectBgTab(btn) {
  document.querySelectorAll(".chat-bg-tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  _currentBgType = btn.dataset.bgtype;
}
window.selectBgTab = selectBgTab;

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
    await setDoc(_bgSettingsRef(), { [_currentBgType]: url }, { merge: true });
    _bgCacheSet({ ..._bgCacheGet(), [_currentBgType]: url });
    toast("✅ تم تطبيق الخلفية على الجميع");
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
    await setDoc(_bgSettingsRef(), { [_currentBgType]: "" }, { merge: true });
    _bgCacheSet({ ..._bgCacheGet(), [_currentBgType]: "" });
    toast("✅ تمت إزالة الخلفية");
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
