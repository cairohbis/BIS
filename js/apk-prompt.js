import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ══════════════════════════════════════════
   APK PROMPT — اقتراح تحميل تطبيق بريق لمستخدمي المتصفح فقط
   ▸ الإعداد Global: appSettings/apkPrompt { enabled } (للمالك فقط، غير مرتبط بـ worldId)
   ▸ التثبيت بالآلية الحالية (js/pwa-install.js → installPWAFromCard / beforeinstallprompt)
   ▸ لا يعمل أي شيء قبل تسجيل الدخول؛ قراءة واحدة للإعداد عند كل تسجيل دخول من متصفح فقط
══════════════════════════════════════════ */

const TAG = "apk-prompt";
const IMG_RUN  = "images/mascot/actions/run.webp";
const IMG_SAD  = "images/mascot/emotions/sad.webp";
const IMG_LOVE = "images/mascot/emotions/love.webp";

// علامة تشغيل داخل التطبيق (TWA): الـ referrer يكون android-app:// عند الإطلاق فقط، فنحفظه للجلسة
try { if ((document.referrer || "").indexOf("android-app://") === 0) sessionStorage.setItem("__bariqApp", "1"); } catch (_) {}

let _overlay = null, _mini = null, _done = null;
let _open = false, _installing = false, _awaiting = false, _busy = false, _doneTimer = null;
let _sizeTxt = "";

/* ── Browser مقابل App (نفس فحص pwa-install.js + referrer التطبيق) ── */
function _isApp() {
  try {
    const mm = (q) => window.matchMedia && window.matchMedia(q).matches;
    if (mm("(display-mode: standalone)") || mm("(display-mode: fullscreen)") || mm("(display-mode: minimal-ui)")) return true;
    if (window.navigator.standalone === true || window.__pwaInstalled) return true;
    if (sessionStorage.getItem("__bariqApp") === "1") return true;
    if ((document.referrer || "").indexOf("android-app://") === 0) return true;
  } catch (_) {}
  return false;
}

/* ── الحجم الحقيقي: مجموع الملفات المخزّنة فعليًا في كاش التطبيق (App Shell) ── */
async function _appSizeText() {
  try {
    if (!window.caches) return "";
    const names = (await caches.keys()).filter((k) => k.indexOf("bariq-shell-") === 0).sort();
    if (!names.length) return "";
    const cache = await caches.open(names[names.length - 1]);
    const reqs = await cache.keys();
    let total = 0;
    for (const r of reqs) {
      const res = await cache.match(r);
      if (res) total += (await res.blob()).size;
    }
    if (total < 52429) return "";
    return "حجم التطبيق: " + (total / 1048576).toFixed(1) + " MB";
  } catch (_) { return ""; }
}

async function _enabled() {
  try {
    const snap = await getDoc(doc(window.db, "appSettings", "apkPrompt"));
    return snap.exists() && snap.data().enabled === true;
  } catch (_) { return false; }
}

/* ── بناء العناصر مرة واحدة (عند أول ظهور فقط) ── */
function _build() {
  if (_overlay) return;
  _overlay = document.createElement("div");
  _overlay.className = "apk-overlay";
  _overlay.innerHTML =
    '<div class="apk-card" role="dialog" aria-modal="true">' +
      '<img class="apk-img" src="' + IMG_RUN + '" alt="">' +
      '<div class="apk-title">حمّل تطبيق بريق ✨</div>' +
      '<div class="apk-text">استخدم بريق بشكل أسرع وأخف، حتى بدون إنترنت، وبدون مشاكل المتصفح.</div>' +
      '<div class="apk-size" style="display:none"></div>' +
      '<button type="button" class="apk-btn">تحميل التطبيق</button>' +
    '</div>';
  _overlay.addEventListener("click", (e) => { if (e.target === _overlay) _dismiss(); });
  _overlay.querySelector(".apk-btn").addEventListener("click", _download);
  document.body.appendChild(_overlay);
}

function _show() {
  _build();
  _hideMini();
  const sz = _overlay.querySelector(".apk-size");
  sz.textContent = _sizeTxt;
  sz.style.display = _sizeTxt ? "" : "none";
  _installing = false;
  _open = true;
  requestAnimationFrame(() => _overlay.classList.add("show"));
  if (window._navPush) window._navPush(TAG, _onBack);
}

/* إغلاق بالنقر خارج النافذة: نمرّره لسجل المتصفح (Back) إن وُجد، فيستدعي _onBack */
function _dismiss() {
  if (!_open) return;
  if (window._navGoBackIfMatches && window._navGoBackIfMatches(TAG)) return;
  _onBack();
}

/* إغلاق بدون تسجيل خروج ولا إعادة تحميل (Back أو نقر خارجي) */
function _onBack() {
  if (!_open) return;
  _open = false;
  if (_overlay) _overlay.classList.remove("show");
  if (!_installing) _showMini();
}

function _download() {
  _installing = true;
  _awaiting = true;
  _open = false;
  _overlay.classList.remove("show");
  _hideMini();
  if (window._navGoBackIfMatches) window._navGoBackIfMatches(TAG);
  try { window.installPWAFromCard && window.installPWAFromCard(); } catch (_) {}
}

function _showMini() {
  if (!_mini) {
    _mini = document.createElement("img");
    _mini.className = "apk-mini";
    _mini.src = IMG_SAD;
    _mini.alt = "";
    _mini.addEventListener("click", () => { if (!_open) _show(); });
    document.body.appendChild(_mini);
  }
  requestAnimationFrame(() => _mini.classList.add("show"));
}
function _hideMini() { if (_mini) _mini.classList.remove("show"); }

/* ── اكتمال التثبيت: الحدث الموثوق الوحيد هو appinstalled ── */
function _showDone() {
  if (!_done) {
    _done = document.createElement("div");
    _done.className = "apk-done";
    _done.innerHTML =
      '<img src="' + IMG_LOVE + '" alt="">' +
      '<div><div class="apk-done-title">تم تحميل التطبيق ❤️</div>' +
      '<div class="apk-done-text">تطبيق بريق أصبح جاهزًا للاستخدام.</div></div>';
    _done.addEventListener("click", () => _done.classList.remove("show"));
    document.body.appendChild(_done);
  }
  requestAnimationFrame(() => _done.classList.add("show"));
  clearTimeout(_doneTimer);
  _doneTimer = setTimeout(() => { if (_done) _done.classList.remove("show"); }, 7000);
}
window.addEventListener("appinstalled", () => {
  if (!_awaiting) return;
  _awaiting = false;
  _showDone();
});

/* ── إخفاء كل شيء (تسجيل الخروج / إيقاف الميزة) ── */
window.__apkPromptHide = function () {
  _scheduled = false;
  _open = false; _installing = true;
  if (_overlay) _overlay.classList.remove("show");
  _hideMini();
};

/* ── نقطة الدخول: تُستدعى بعد نجاح تسجيل الدخول فقط (لا تعمل أي شيء ثقيل هنا) ── */
/* Chrome يتخطّى عند زر Back أي سجل (pushState) أُنشئ بدون تفاعل المستخدم، فيخرج الرجوع من الصفحة.
   لذلك لا تُعرض النافذة (ولا تُسجَّل خطوتها) إلا بعد أول تفاعل فعلي. */
function _whenActive(fn) {
  const ua = navigator.userActivation;
  if (!ua || ua.hasBeenActive) { fn(); return; }
  const evs = ["pointerup", "keydown", "touchend", "click"];
  let done = false;
  const go = () => setTimeout(() => {
    if (done || !ua.hasBeenActive) return;
    done = true;
    evs.forEach((t) => window.removeEventListener(t, go, true));
    fn();
  }, 0);
  evs.forEach((t) => window.addEventListener(t, go, { capture: true, passive: true }));
}

let _scheduled = false;
window.__apkPromptAfterLogin = function () {
  if (_scheduled || _isApp()) return;
  _scheduled = true;
  setTimeout(async () => {
    if (_busy || _open) return;
    _busy = true;
    try {
      if (_isApp() || !window.currentUser || !window.db) return;
      if (!(await _enabled())) return;
      _sizeTxt = await _appSizeText();
      if (window.currentUser) _whenActive(() => { if (window.currentUser && !_open) _show(); });
    } finally { _busy = false; }
  }, 1500);
};

/* ══════════════ لوحة المالك ══════════════ */
function _ownerUI(on) {
  const st = document.getElementById("apkPromptStatusText");
  const onB = document.getElementById("apkPromptOnBtn");
  const offB = document.getElementById("apkPromptOffBtn");
  if (st) { st.textContent = on ? "مُفعّلة" : "متوقفة"; st.style.color = on ? "#16a34a" : "#dc2626"; }
  if (onB) onB.disabled = on;
  if (offB) offB.disabled = !on;
}

window.setApkPromptEnabled = async function (enable) {
  if (!window.isOwner || !window.isOwner()) { window.toast?.("غير مصرح", "error"); return; }
  try {
    await setDoc(doc(window.db, "appSettings", "apkPrompt"), {
      enabled: !!enable,
      updatedAt: serverTimestamp(),
      updatedBy: window.currentUser?.uid || ""
    });
    _ownerUI(!!enable);
    if (!enable) window.__apkPromptHide();
    window.toast?.(enable ? "تم تشغيل نافذة تحميل التطبيق ✓" : "تم إيقاف نافذة تحميل التطبيق ✓");
  } catch (e) {
    window.toast?.("خطأ: " + (e.code || e.message), "error");
  }
};

/* قراءة واحدة لحالة الإعداد عند فتح قسم المالك فقط */
const _hdr = document.getElementById("apkPromptOwnerHeader");
if (_hdr) _hdr.addEventListener("click", async () => {
  if (!window.isOwner || !window.isOwner() || !window.db) return;
  _ownerUI(await _enabled());
});
