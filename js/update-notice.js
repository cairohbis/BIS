import { doc, onSnapshot, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ══════════════════════════════════════════
   UPDATE NOTICE — إشعار نشر تحديث عالمي
   ▸ المستند: config/appUpdate { number, updateId, message, publishedAt, by } — Global بلا worldId
   ▸ مستمع واحد بعد الدخول (يُوقف عند الخروج) — بدون Polling وبدون قراءات إضافية عند الإغلاق/الضغط
   ▸ الضغط على «تحديث» يستدعي window._checkForUpdates() الموجودة (js/updates-check.js) كما هي
   ▸ منع التكرار: localStorage["bariq_last_seen_update"] = آخر رقم تم الضغط على «تحديث» له
══════════════════════════════════════════ */

const TAG = "update-notice";
const LS_KEY = "bariq_last_seen_update";

let _unsub = null;
let _cur = null;            // { num, message } آخر حالة وصلت من المستمع
let _dismissedNum = null;   // أُغلقت بالنقر الخارجي في هذه الجلسة (لا تُسجَّل كمعالَجة)
let _open = false, _pending = false;
let _overlay = null;

function _lastSeen() { try { return localStorage.getItem(LS_KEY); } catch (_) { return null; } }
function _markSeen(n) { try { localStorage.setItem(LS_KEY, String(n)); } catch (_) {} }

/* Chrome يتخطّى عند زر Back أي سجل pushState أُنشئ بدون تفاعل المستخدم → لا نعرض النافذة قبل أول تفاعل */
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

function _build() {
  if (_overlay) return;
  _overlay = document.createElement("div");
  _overlay.className = "upd-overlay";
  _overlay.innerHTML =
    '<div class="upd-card" role="dialog" aria-modal="true">' +
      '<div class="upd-icon"><i class="fa-solid fa-arrows-rotate"></i></div>' +
      '<div class="upd-title">تحديث جديد <span class="upd-num"></span></div>' +
      '<div class="upd-msg"></div>' +
      '<button type="button" class="upd-btn">تحديث</button>' +
    '</div>';
  _overlay.addEventListener("click", (e) => { if (e.target === _overlay) _dismiss(); });
  _overlay.querySelector(".upd-btn").addEventListener("click", _doUpdate);
  document.body.appendChild(_overlay);
}

function _show() {
  if (!_cur || _open) return;
  _build();
  _overlay.querySelector(".upd-num").textContent = "#" + _cur.num;
  _overlay.querySelector(".upd-msg").textContent = _cur.message || "";
  _open = true;
  requestAnimationFrame(() => _overlay.classList.add("show"));
  if (window._navPush) window._navPush(TAG, _onBack);
}

function _scheduleShow() {
  if (_open || _pending) return;
  _pending = true;
  _whenActive(() => {
    _pending = false;
    if (_cur && !_open && String(_cur.num) !== _lastSeen() && _dismissedNum !== _cur.num) _show();
  });
}

/* إغلاق بالنقر الخارجي: عبر سجل المتصفح إن وُجد (نفس نمط بقية النوافذ) — لا يُسجَّل كتحديث تمت معالجته */
function _dismiss() {
  if (!_open) return;
  if (window._navGoBackIfMatches && window._navGoBackIfMatches(TAG)) return;
  _onBack();
}
function _onBack() {
  if (!_open) return;
  _open = false;
  if (_cur) _dismissedNum = _cur.num;
  if (_overlay) _overlay.classList.remove("show");
}
function _hide() {
  _open = false;
  if (_overlay) _overlay.classList.remove("show");
}

/* «تحديث»: نسجّل أن الرقم عولج ثم نشغّل النظام الحالي كما هو */
function _doUpdate() {
  if (!_cur) return;
  if (typeof window._checkForUpdates !== "function") { window.toast?.("نظام التحديث غير متاح حاليًا", "error"); return; }
  if (navigator.onLine === false) { window.toast?.("لا يوجد اتصال بالإنترنت — حاول مرة أخرى عند عودته", "warn"); return; }
  _markSeen(_cur.num);
  _hide();
  if (window._navGoBackIfMatches) window._navGoBackIfMatches(TAG);
  window._checkForUpdates();
}

/* ── المستمع الوحيد ── */
window.__updateNoticeStart = function () {
  if (_unsub || !window.db) return;
  _unsub = onSnapshot(doc(window.db, "config", "appUpdate"), (snap) => {
    if (!snap.exists()) { _cur = null; _ownerUI(0, null); _hide(); return; }
    const d = snap.data() || {};
    const num = Number(d.number);
    if (!num) { _cur = null; _ownerUI(0, null); _hide(); return; }
    _cur = { num, message: d.message || "" };
    _ownerUI(num, d);
    if (String(num) === _lastSeen()) { _hide(); return; }
    _scheduleShow();
  }, () => {});
};

window.__updateNoticeStop = function () {
  if (_unsub) { try { _unsub(); } catch (_) {} _unsub = null; }
  _cur = null; _dismissedNum = null; _pending = false;
  _hide();
};

/* ══════════════ لوحة المالك ══════════════ */
function _ownerUI(num, d) {
  const nx = document.getElementById("updNextNum");
  const last = document.getElementById("updLastInfo");
  if (nx) nx.textContent = "#" + (num + 1);
  if (last) last.textContent = num ? ("آخر تحديث منشور: #" + num) : "لا يوجد تحديث منشور بعد";
}

window.publishAppUpdate = async function () {
  if (!window.isOwner || !window.isOwner()) { window.toast?.("غير مصرح", "error"); return; }
  const inp = document.getElementById("updMsg");
  const msg = inp ? inp.value.trim() : "";
  if (!msg) { window.toast?.("اكتب رسالة التحديث أولًا", "warn"); return; }
  if (navigator.onLine === false) { window.toast?.("لا يوجد اتصال بالإنترنت", "warn"); return; }
  const ok = window._appConfirm ? await window._appConfirm("نشر تحديث", "سيظهر إشعار التحديث لجميع المستخدمين. هل تريد المتابعة؟") : true;
  if (!ok) return;
  const btn = document.getElementById("updPublishBtn");
  if (btn) btn.disabled = true;
  try {
    const ref = doc(window.db, "config", "appUpdate");
    const num = await runTransaction(window.db, async (tx) => {
      const s = await tx.get(ref);
      const n = (s.exists() ? Number(s.data().number) || 0 : 0) + 1;
      tx.set(ref, {
        number: n,
        updateId: n + "-" + Date.now().toString(36),
        message: msg,
        publishedAt: serverTimestamp(),
        by: window.currentUser?.uid || ""
      });
      return n;
    });
    if (inp) inp.value = "";
    window.toast?.("تم نشر التحديث #" + num + " ✓");
  } catch (e) {
    window.toast?.("خطأ: " + (e.code || e.message), "error");
  } finally {
    if (btn) btn.disabled = false;
  }
};
