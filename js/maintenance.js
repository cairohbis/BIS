import { doc, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ══════════════════════════════════════════
   MAINTENANCE MODE SYSTEM
   ▸ يقرأ config/maintenance من Firestore عبر onSnapshot
   ▸ المالك فقط يتجاوز وضع الصيانة
   ▸ لا يسجل خروج المستخدمين ولا يحذف أي بيانات
══════════════════════════════════════════ */

const OWNER_UID = "dKTc7vqFNGO7vqamubap5dKnn7z1";

let _maintEnabled = false;

/* ── تطبيق حالة الصيانة على الواجهة ── */
function _applyMaintenance() {
  const overlay = document.getElementById("maintenanceOverlay");
  if (!overlay) return;

  const uid    = window.currentUser?.uid;
  const bypass = uid === OWNER_UID;

  if (_maintEnabled && !bypass) {
    overlay.style.display = "block";
    document.body.style.overflow = "hidden";
  } else {
    overlay.style.display = "none";
    document.body.style.overflow = "";
  }

  _updateOwnerBadge(bypass);
}

/* ── شريط تنبيه صغير للمالك فقط عند تفعيل الصيانة ── */
function _updateOwnerBadge(isOwnerUser) {
  let badge = document.getElementById("maintenanceOwnerBadge");
  if (_maintEnabled && isOwnerUser) {
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "maintenanceOwnerBadge";
      badge.style.cssText = "position:fixed;bottom:14px;inset-inline-start:14px;z-index:999998;background:#dc2626;color:#fff;padding:8px 14px;border-radius:10px;font-size:13px;font-family:'Cairo',sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.3);";
      badge.textContent = "⚠️ وضع الصيانة مُفعّل — الموقع مغلق عن المستخدمين";
      document.body.appendChild(badge);
    }
  } else if (badge) {
    badge.remove();
  }
}

/* ── تحديث واجهة لوحة المالك (الحالة والأزرار) ── */
function _updateMaintToggleUI() {
  const statusEl = document.getElementById("maintStatusText");
  const onBtn    = document.getElementById("maintOnBtn");
  const offBtn   = document.getElementById("maintOffBtn");

  if (statusEl) {
    statusEl.textContent = _maintEnabled ? "مُفعّل" : "غير مُفعّل";
    statusEl.style.color = _maintEnabled ? "#dc2626" : "#16a34a";
  }
  if (onBtn)  onBtn.disabled  = _maintEnabled;
  if (offBtn) offBtn.disabled = !_maintEnabled;
}

/* ── إعادة فحص الحالة (يُستدعى من index.html عند تغيّر المستخدم) ── */
window._maintenanceApply = _applyMaintenance;

/* ── تفعيل/إيقاف وضع الصيانة — للمالك فقط ── */
window.toggleMaintenance = async function(enable) {
  if (!window.isOwner || !window.isOwner()) {
    window.toast?.("غير مصرح", "error");
    return;
  }
  try {
    await setDoc(doc(window.db, "config", "maintenance"), {
      enabled:   !!enable,
      updatedAt: serverTimestamp(),
      updatedBy: window.currentUser?.uid || ""
    });
    window.toast?.(enable ? "تم تفعيل وضع الصيانة ✓" : "تم إيقاف وضع الصيانة ✓");
  } catch (e) {
    window.toast?.("خطأ: " + (e.code || e.message), "error");
  }
};

/* ── بدء المستمع — ينتظر window.db إن لم يكن جاهزاً بعد ── */
function _start() {
  if (!window.db) { setTimeout(_start, 100); return; }

  onSnapshot(doc(window.db, "config", "maintenance"), (snap) => {
    _maintEnabled = snap.exists() && snap.data().enabled === true;
    _applyMaintenance();
    _updateMaintToggleUI();
  }, () => {});
}

_start();
