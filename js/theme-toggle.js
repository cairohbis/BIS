/* ══════════════════════════════════════════════════════════════
   js/theme-toggle.js — مفتاح تبديل الوضع الليلي/النهاري (بديل زر الخروج بالبانر)
   المنطق الأساسي (بناء النجوم + حدث الضغط) منسوخ بالحرف من التصميم
   المُرفَق، مع ربط واحد فقط: استبدال التعليق التوضيحي الفارغ
   (اربط هنا منطق تبديل الثيم) باستدعاء window.applyTheme الحقيقية
   الموجودة بالفعل في js/settings-modal.js — بدون أي تعديل عليها.
   ⚠️ يجب تحميله بعد js/settings-modal.js في index.html — لأنه يعتمد
   على window.applyTheme المُعرَّفة هناك.
══════════════════════════════════════════════════════════════ */
(function () {
  function _buildUI() {
    const slot = document.getElementById("themeToggleSlot");
    if (!slot) return;

    slot.innerHTML = `
      <div class="ttg-mini-wrap">
        <div class="bnt-widget">
          <button class="bnt-toggle" id="bntToggle" type="button" aria-pressed="false" aria-label="تبديل الوضع الليلي والنهاري">
            <div class="bnt-stars" id="bntStars">
              <div class="bnt-meteor"></div>
              <div class="bnt-meteor bnt-m2"></div>
            </div>

            <div class="bnt-clouds">
              <div class="bnt-cloud"          style="top:36px; left:34px;"></div>
              <div class="bnt-cloud bnt-small" style="top:52px; left:78px;"></div>
              <div class="bnt-cloud"          style="top:96px; left:26px;"></div>
              <div class="bnt-cloud bnt-small" style="top:110px; left:70px;"></div>
            </div>

            <div class="bnt-thumb">
              <div class="bnt-moon">
                <div class="bnt-crater" style="width:24px; height:24px; top:16px;  left:18px;"></div>
                <div class="bnt-crater" style="width:34px; height:34px; top:58px;  left:56px;"></div>
                <div class="bnt-crater" style="width:14px; height:14px; top:82px;  left:24px;"></div>
                <div class="bnt-crater" style="width:9px;  height:9px;  top:34px;  left:78px;"></div>
              </div>

              <div class="bnt-sun-wrap">
                <div class="bnt-sun"></div>
              </div>
            </div>
          </button>
        </div>
      </div>
    `;

    const toggle = document.getElementById("bntToggle");
    const starsWrap = document.getElementById("bntStars");

    // ── نفس مواقع النجوم بالحرف من التصميم المُرفَق ──
    const starPositions = [
      {top: 42, left: 165}, {top: 70, left: 205}, {top: 100, left: 175},
      {top: 60, left: 240}, {top: 95, left: 245}, {top: 30, left: 220}
    ];
    starPositions.forEach(function (pos, i) {
      const s = document.createElement("div");
      s.className = "bnt-star";
      s.style.top = pos.top + "px";
      s.style.left = pos.left + "px";
      s.style.animationDelay = (i * 0.3) + "s";
      starsWrap.appendChild(s);
    });

    // ── الحالة الابتدائية: تطابق ثيم الموقع الحالي ──
    _syncSwitch();

    toggle.addEventListener("click", function () {
      const isLight = document.documentElement.classList.contains("theme-light");
      // الربط الفعلي بنظام الثيم الحقيقي بالموقع (بدل التعليق التوضيحي في النسخة الأصلية)
      window.applyTheme?.(isLight ? "dark" : "light");
      _syncSwitch();
    });
  }

  function _syncSwitch() {
    const toggle = document.getElementById("bntToggle");
    if (!toggle) return;
    const isLight = document.documentElement.classList.contains("theme-light");
    toggle.classList.toggle("bnt-day", isLight);
    toggle.setAttribute("aria-pressed", isLight);
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
