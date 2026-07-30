/* ══════════════════════════════════════════════════════════════
   js/theme-toggle.js — مفتاح تبديل الوضع الليلي/النهاري
   نفس منطق النسخة القديمة الشغالة 100%، مع إضافة عناصر الشهب/الغيوم
   في الـ markup بس (الأساس والسلوك زي ما كان بالحرف).
   ⚠️ يجب تحميله بعد js/settings-modal.js — يعتمد على window.applyTheme.
══════════════════════════════════════════════════════════════ */
(function () {
  function _syncSwitch() {
    const btn = document.getElementById("themeToggleBtn");
    if (!btn) return;
    const isLight = document.documentElement.classList.contains("theme-light");
    btn.classList.toggle("is-light", isLight);
  }

  function _buildUI() {
    const slot = document.getElementById("themeToggleSlot");
    if (!slot) return;
    slot.innerHTML = `
      <button type="button" id="themeToggleBtn" class="theme-toggle-switch" aria-label="تبديل الوضع الليلي/النهاري" title="الوضع الليلي/النهاري">
        <span class="ttg-star"></span>
        <span class="ttg-star"></span>
        <span class="ttg-star"></span>
        <span class="ttg-meteor"></span>
        <span class="ttg-meteor ttg-m2"></span>
        <span class="ttg-cloud ttg-c1"></span>
        <span class="ttg-cloud ttg-c2"></span>
        <span class="ttg-thumb"></span>
      </button>
    `;
    const btn = document.getElementById("themeToggleBtn");
    btn.addEventListener("click", () => {
      const isLight = document.documentElement.classList.contains("theme-light");
      window.applyTheme?.(isLight ? "dark" : "light");
      _syncSwitch();
    });
    _syncSwitch();
  }

  document.addEventListener("DOMContentLoaded", _buildUI);

  // ── مزامنة شكل المفتاح لو الثيم اتغيّر من مكان تاني (الأزرار التلاتة في الإعدادات / تلقائي) ──
  const _origApplyTheme = window.applyTheme;
  window.applyTheme = async function (theme) {
    let result;
    if (typeof _origApplyTheme === "function") result = await _origApplyTheme.apply(this, arguments);
    _syncSwitch();
    return result;
  };
})();
