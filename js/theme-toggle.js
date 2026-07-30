/* ══════════════════════════════════════════════════════════════
   js/theme-toggle.js — مفتاح تبديل الوضع الليلي/النهاري (بديل زر الخروج بالبانر)
   ملف معزول بالكامل — يستخدم window.applyTheme الموجودة بالفعل
   (js/settings-modal.js) بدون أي تعديل عليها.
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
        <span class="ttg-thumb"></span>
      </button>
    `;
    const btn = document.getElementById("themeToggleBtn");
    btn.addEventListener("click", () => {
      const isLight = document.documentElement.classList.contains("theme-light");
      window.applyTheme?.(isLight ? "dark" : "light");
      // معاينة فورية (مش هننتظر أي حاجة تانية) — applyTheme نفسها هتحدّث الكلاس فوراً
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
