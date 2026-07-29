/* ══════════════════════════════════════════
   js/announcement.js — نظام الإعلانات
   منقول من index.html بدون أي تغيير في المنطق —
   فقط استبدال المراجع المحلية (isAdmin/toast/db/currentUser/currentName/confirm)
   بمراجع window المكافئة (نفس القيم، نفس السلوك تماماً).
══════════════════════════════════════════ */
import {
  doc, onSnapshot, setDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let _annUnsub = null;
let _annDismissedId = null; // تتبع الإعلان المخفي محلياً

function _annRender(data) {
  const bar  = document.getElementById("chatAnnouncementBar");
  const text = document.getElementById("annBarText");
  if (!bar || !text) return;
  if (!data || !data.text) {
    bar.classList.remove("show");
    return;
  }
  // مفتاح التمييز: وقت إنشاء الإعلان (أو النص كاحتياط)
  const annKey = (data.createdAt && data.createdAt.toMillis) ? String(data.createdAt.toMillis()) : data.text;
  // إذا أخفى المستخدم هذا الإعلان بعينه — لا تعيد عرضه
  if (_annDismissedId && _annDismissedId === annKey) return;
  text.textContent = data.text;
  bar.classList.add("show");
  bar._annKey = annKey; // store for dismiss button
}

function _annUpdatePanels(data) {
  const ids = ["oAnnCurrentWrap","aAnnCurrentWrap"];
  const txtIds = ["oAnnCurrentText","aAnnCurrentText"];
  const inpIds = ["oAnnText","aAnnText"];
  ids.forEach((id, i) => {
    const wrap = document.getElementById(id);
    const txt  = document.getElementById(txtIds[i]);
    const inp  = document.getElementById(inpIds[i]);
    if (!wrap) return;
    if (data && data.text) {
      wrap.style.display = "";
      if (txt) txt.textContent = data.text;
      if (inp && !inp.value) inp.value = data.text;
    } else {
      wrap.style.display = "none";
      if (txt) txt.textContent = "";
    }
  });
}

function _startAnnListener() {
  const db = window.db;
  if (_annUnsub) { try { _annUnsub(); } catch(e) {} _annUnsub = null; }
  _annUnsub = onSnapshot(doc(db, "config", "announcement"), (snap) => {
    const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    _annRender(data);
    _annUpdatePanels(data);
  }, () => {});
}
window._startAnnListener = _startAnnListener;

window.saveAnnouncement = async function(panel) {
  const db = window.db;
  const toast = window.toast;
  const currentUser = window.currentUser;
  if (!window.isAdmin?.()) { toast("غير مصرح", "error"); return; }
  const inpId = panel === "admin" ? "aAnnText" : "oAnnText";
  const inp   = document.getElementById(inpId);
  const text  = inp ? inp.value.trim() : "";
  if (!text) { toast("أدخل نص الإعلان", "warn"); return; }
  const btnId = panel === "admin" ? "aSaveAnnBtn" : "oSaveAnnBtn";
  const btn   = document.getElementById(btnId);
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
  try {
    await setDoc(doc(db, "config", "announcement"), {
      text,
      createdAt:  serverTimestamp(),
      authorUid:  currentUser?.uid || "",
      authorName: window.currentName || "",
    });
    _annDismissedId = null; // إعادة عرض لجميع المستخدمين
    // عرض فوري قبل وصول snapshot (للناشر نفسه)
    const bar = document.getElementById("chatAnnouncementBar");
    const annText = document.getElementById("annBarText");
    if (bar && annText) { annText.textContent = text; bar._annKey = null; bar.classList.add("show"); }
    toast("تم نشر الإعلان ✓");
  } catch(e) {
    toast("خطأ: " + (e.code || e.message), "error");
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-bullhorn"></i> نشر الإعلان'; }
  }
};

window.deleteAnnouncement = async function() {
  const db = window.db;
  const toast = window.toast;
  if (!window.isAdmin?.()) { toast("غير مصرح", "error"); return; }
  const ok = await window._appConfirm("حذف الإعلان", "سيُزال الإعلان فوراً لجميع المستخدمين. هل تريد المتابعة؟");
  if (!ok) return;
  try {
    await deleteDoc(doc(db, "config", "announcement"));
    _annDismissedId = null;
    const ids = ["oAnnText","aAnnText"];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    toast("تم حذف الإعلان");
  } catch(e) {
    toast("خطأ: " + (e.code || e.message), "error");
  }
};

// زر الإخفاء — يخفي الشريط محلياً فقط
document.addEventListener("DOMContentLoaded", function() {
  const btn = document.getElementById("annBarDismiss");
  if (btn) {
    btn.addEventListener("click", function() {
      const bar = document.getElementById("chatAnnouncementBar");
      if (bar) {
        _annDismissedId = bar._annKey || "announcement";
        bar.classList.remove("show");
      }
    });
  }
});
