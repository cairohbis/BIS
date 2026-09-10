/* ══════════════════════════════════════════════════════════════
   CHAT HEADER v2 — ملف مستقل بالكامل (نفس نمط dm-extras.js)
   ▸ بيتحكم في القائمة المنسدلة (تلات نقط) وزر المكالمة في هيدر
     #page-chat بس. صفر تعديل على أي منطق موجود فعليًا —
     بيستخدم toggleChatSearch()/toast() الموجودين زي ما هما.
   ▸ لا يعدّل أي شيء في صفحة المساعد الذكي (#page-ai-chat).
══════════════════════════════════════════════════════════════ */

(function () {
  let _qcMenuOpen = false;

  function _qcMenuEl() { return document.getElementById("qcHeaderMenu"); }

  window._qcToggleHeaderMenu = function () {
    const menu = _qcMenuEl();
    if (!menu) return;
    _qcMenuOpen ? window._qcCloseHeaderMenu() : window._qcOpenHeaderMenu();
  };

  window._qcOpenHeaderMenu = function () {
    const menu = _qcMenuEl();
    if (!menu) return;
    menu.classList.add("qc-open");
    _qcMenuOpen = true;
  };

  window._qcCloseHeaderMenu = function () {
    const menu = _qcMenuEl();
    if (!menu) return;
    menu.classList.remove("qc-open");
    _qcMenuOpen = false;
  };

  window._qcCallComingSoon = function () {
    if (typeof window.toast === "function") {
      window.toast("خاصية المكالمات قريبًا", "info");
    }
  };

  // إغلاق القائمة لما تدوس في أي مكان تاني في الصفحة
  document.addEventListener("click", function (e) {
    if (!_qcMenuOpen) return;
    const anchor = document.getElementById("qcHeaderMenuAnchor");
    if (anchor && !anchor.contains(e.target)) {
      window._qcCloseHeaderMenu();
    }
  });

  // إغلاق القائمة بزرار Escape
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && _qcMenuOpen) window._qcCloseHeaderMenu();
  });
})();
