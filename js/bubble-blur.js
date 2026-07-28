/* ══════════════════════════════════════════════════════════════
   js/bubble-blur.js — الشفافية (ضبابية فقاعة الشات، تؤثر على الفقاعتين معاً)

   ملف معزول بالكامل عن index.html و style.css الأصليين.
   يخزّن الاختيار في users/{uid}/settings/appPrefs (نفس مستند
   bubbleColor/theme/chatFontSize الموجود بالفعل).
   يطبّق القيمة عبر متغيّر CSS واحد: --user-bubble-blur
   (موجود بالفعل كـ fallback في قاعدتي .bubble.me و .bubble.other،
   بدون أي تغيير في الشكل الافتراضي الحالي).
══════════════════════════════════════════════════════════════ */
(function () {
  const MIN_BLUR = 0;    // شفاف جداً — بدون أي تشويش
  const MAX_BLUR = 30;   // ضبابية عالية — تأثير زجاج مصنفر قوي
  const DEFAULT_SLIDER = 60; // موضع افتراضي للسلايدر (يقابل تقريباً القيم الحالية 8-20px)

  let _value = null; // null = لا يوجد تخصيص، يرجع لقيم كل فقاعة الافتراضية

  function _sliderToBlurPx(sliderVal) {
    const v = Math.max(0, Math.min(100, Number(sliderVal) || 0));
    return MIN_BLUR + (v / 100) * (MAX_BLUR - MIN_BLUR);
  }

  function _apply(sliderVal) {
    if (sliderVal === null || sliderVal === undefined) {
      document.documentElement.style.removeProperty("--user-bubble-blur");
      return;
    }
    const px = _sliderToBlurPx(sliderVal);
    document.documentElement.style.setProperty("--user-bubble-blur", `${px.toFixed(1)}px`);
  }

  async function _load(uid) {
    if (!uid || !window.db) return;
    try {
      const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      const snap = await getDoc(doc(window.db, "users", uid, "settings", "appPrefs"));
      if (snap.exists()) {
        const d = snap.data();
        if (typeof d.bubbleBlur === "number" && d.bubbleBlur >= 0 && d.bubbleBlur <= 100) {
          _value = d.bubbleBlur;
          _apply(_value);
        }
      }
    } catch (e) {}
    _syncUI();
  }

  async function _save() {
    const uid = window.currentUser?.uid;
    if (!uid || !window.db) return;
    if (_value !== null && (typeof _value !== "number" || _value < 0 || _value > 100)) return; // تحقق أمان
    try {
      const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await setDoc(doc(window.db, "users", uid, "settings", "appPrefs"),
        { bubbleBlur: _value },
        { merge: true });
    } catch (e) {}
  }

  function _syncUI() {
    const input = document.getElementById("bubbleBlurInput");
    const resetBtn = document.getElementById("bubbleBlurResetBtn");
    if (input) input.value = _value !== null ? _value : DEFAULT_SLIDER;
    if (resetBtn) resetBtn.style.display = _value !== null ? "" : "none";
  }

  function _buildUI() {
    const slot = document.getElementById("bubbleBlurPickerSlot");
    if (!slot) return;
    slot.innerHTML = `
      <div class="smod-sec-label" style="margin-top:4px"><i class="fa-solid fa-water"></i> الشفافية</div>
      <div class="smod-row bblur-row">
        <div class="smod-icon" style="background:rgba(201,169,110,.12)"><i class="fa-solid fa-sliders" style="color:var(--gold)"></i></div>
        <div class="smod-info">
          <div class="smod-label">ضبابية فقاعة الشات (المرسلة والمستقبلة)</div>
          <div class="smod-desc">من شفاف جداً إلى ضبابية عالية (تأثير زجاجي)</div>
        </div>
      </div>
      <div class="bblur-slider-wrap">
        <span class="bblur-edge-label"><i class="fa-solid fa-droplet-slash"></i></span>
        <input type="range" id="bubbleBlurInput" class="bblur-input" min="0" max="100" step="1" value="${DEFAULT_SLIDER}">
        <span class="bblur-edge-label"><i class="fa-solid fa-water"></i></span>
      </div>
      <button id="bubbleBlurResetBtn" class="bcolor-reset-btn" style="display:none;">
        <i class="fa-solid fa-arrow-rotate-left"></i> رجوع للضبابية الافتراضية
      </button>
    `;

    const input = document.getElementById("bubbleBlurInput");
    const resetBtn = document.getElementById("bubbleBlurResetBtn");

    input.addEventListener("input", () => {
      _value = Number(input.value);
      _apply(_value);   // معاينة حية فورية
      if (resetBtn) resetBtn.style.display = "";
    });
    input.addEventListener("change", _save);

    resetBtn.addEventListener("click", () => {
      _value = null;
      _apply(null);
      _syncUI();
      _save();
    });

    _syncUI();
  }

  document.addEventListener("DOMContentLoaded", _buildUI);

  /* ── ربط مع جاهزية المصادقة — نفس آلية bubble-color.js تماماً
     (window._dmsStartListeners بيتنادى فعلياً عبر window، على عكس _startNotifListener) ── */
  const _origDmsStart = window._dmsStartListeners;
  window._dmsStartListeners = function () {
    _load(window.currentUser?.uid);
    if (typeof _origDmsStart === "function") return _origDmsStart.apply(this, arguments);
  };
})();
