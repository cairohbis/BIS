/* ══════════════════════════════════════════
   js/chat-backgrounds.js — خلفيات الشات الديناميكية
   Stored in Firestore: appSettings/chatBackgrounds
   { public: "url", rooms: "url", private: "url" }
   منقول من index.html بدون أي تغيير في المنطق —
   فقط استبدال المراجع المحلية بمراجع window المكافئة.
   ⚠️ سطرا "تفعيل" الاستماع (selectChat hook + _listenChatBg الأولي)
   فضلوا عمداً في index.html نفسه (مش هنا) بسبب حساسية توقيت التنفيذ،
   بالضبط زي ما اتعمل مع pin-message.js.
   🐛 ملاحظة: `if (!isAdmin && !isOwner)` تحت من غير قوسين استدعاء —
   ده Bug موجود في الكود الأصلي قبل النقل، اتنقل بالحرف بدون تصليح.
══════════════════════════════════════════ */
import { doc, onSnapshot, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let _currentBgType = "public";
const _bgSettingsRef = () => doc(window.db, "appSettings", "chatBackgrounds");

// Apply background to chat-main element
function _applyChatBg(type, url) {
  const el = document.querySelector(".chat-main");
  if (!el) return;
  const currentType = window._currentChatId === "public" ? "public"
    : window._currentChatId?.startsWith("room:") ? "rooms" : "private";
  if (type !== currentType) return;
  if (url) {
    el.style.backgroundImage = `url('${url}')`;
    el.classList.add("has-bg");
  } else {
    el.style.backgroundImage = "";
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
  const isAdmin = window.isAdmin;
  const isOwner = window.isOwner;
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
  const isAdmin = window.isAdmin;
  const isOwner = window.isOwner;
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
