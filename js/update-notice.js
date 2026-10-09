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
      '<img class="upd-img" src="images/mascot/ui/loading.webp" alt="">' +
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

/* ══════════════════════════════════════════
   احتياطي لو نسخة index.html قديمة/مخزّنة (تفتقد كارت الأونر أو استدعاءات التشغيل)
   ▸ كارت «نشر تحديث» يُضاف تلقائيًا بعد «وضع الصيانة» إن لم يكن موجودًا (مرة واحدة، بلا تكرار).
   ▸ التشغيل/الإيقاف يتبع حالة الدخول بنفسه (idempotent: لا مستمع ثانٍ لو index.html يستدعيه أيضًا).
══════════════════════════════════════════ */
const _OWNER_CARD_HTML =
  '<div class="owner-collapse-item" style="margin-top:10px;">' +
    '<div class="owner-collapse-header" onclick="ownerToggleSection(this)">' +
      '<div class="owner-collapse-icon-wrap"><i class="fa-solid fa-arrows-rotate"></i></div>' +
      '<div class="owner-collapse-body-text">' +
        '<div class="owner-collapse-title">نشر تحديث</div>' +
        '<div class="owner-collapse-sub">إشعار تحديث لجميع المستخدمين</div>' +
      '</div>' +
      '<i class="fa-solid fa-chevron-down owner-collapse-arrow"></i>' +
    '</div>' +
    '<div class="owner-collapse-panel"><div class="owner-collapse-inner"><div class="panel-sec">' +
      '<div class="label">رقم التحديث التالي: <span id="updNextNum" style="font-weight:800;">—</span></div>' +
      '<div id="updLastInfo" style="font-size:12px;color:var(--muted);margin-top:4px;">—</div>' +
      '<textarea class="inp" id="updMsg" rows="4" maxlength="500" placeholder="اكتب ما الجديد في هذا التحديث…" style="margin-top:8px;resize:vertical;"></textarea>' +
      '<button class="btn" id="updPublishBtn" style="width:100%;margin-top:8px;" onclick="publishAppUpdate()"><i class="fa-solid fa-paper-plane"></i> نشر تحديث</button>' +
      '<div style="font-size:12px;color:var(--muted);margin-top:10px;line-height:1.6;">يظهر الإشعار لجميع المستخدمين (بمن فيهم أنت). انشره بعد وصول النسخة الجديدة للموقع بدقائق.</div>' +
    '</div></div></div>' +
  '</div>';

function _ensureOwnerCard() {
  if (document.getElementById("updPublishBtn")) return;
  const body = document.querySelector("#page-owner .panel-body");
  if (!body) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = _OWNER_CARD_HTML;
  const card = wrap.firstChild;
  if (!card) return;
  let anchor = null;
  body.querySelectorAll(".owner-collapse-title").forEach((t) => {
    if (!anchor && (t.textContent || "").trim() === "وضع الصيانة") anchor = t.closest(".owner-collapse-item");
  });
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(card, anchor.nextSibling);
  else body.appendChild(card);
}
try { _ensureOwnerCard(); } catch (e) {}

function _autoStart(n) {
  if (window.db) { window.__updateNoticeStart(); return; }
  if (n < 10) setTimeout(() => _autoStart(n + 1), 500);
}
(async () => {
  try {
    const a = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    a.onAuthStateChanged(a.getAuth(), (u) => { if (u) _autoStart(0); else window.__updateNoticeStop(); });
  } catch (e) {}
})();
