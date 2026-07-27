/* ══════════════════════════════════════════════════════════════
   js/bubble-color.js — لون مخصص لفقاعة "أنا" (اختياري لكل مستخدم)

   ملف معزول بالكامل عن index.html و style.css الأصليين.
   يخزّن الاختيار في users/{uid}/settings/appPrefs (نفس مستند
   theme/chatFontSize/chatPrefs الموجود بالفعل، بنفس نمط setDoc merge).
   يطبّق اللون عبر متغيّر CSS واحد: --user-bubble-color
   (المتغيّر ده هو نقطة الاتصال الوحيدة مع style.css، وموجود بالفعل
   كـ fallback في قاعدة .bubble.me من غير أي تغيير في اللون الافتراضي).
══════════════════════════════════════════════════════════════ */
(function () {
  const HEX_RE = /^#[0-9a-fA-F]{6}$/;
  const DEFAULT_HEX = "#ffffff"; // يطابق rgba(255,255,255,0.24) الافتراضي — قيمة بداية للـ picker بس، مش تغيير فعلي

  let _hex = null;          // null = لا يوجد تخصيص (يرجع للـ fallback الافتراضي)
  let _transparent = true;

  /* تحويل HEX إلى rgba بنسبة شفافية معيّنة */
  function _hexToRgba(hex, alpha) {
    const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
    if (!m) return null;
    const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* تطبيق اللون فوراً (معاينة حية + بعد القراءة من Firestore) */
  function _apply(hex, transparent) {
    if (!hex || !HEX_RE.test(hex)) {
      document.documentElement.style.removeProperty("--user-bubble-color");
      return;
    }
    const value = transparent ? (_hexToRgba(hex, 0.24) || hex) : hex;
    document.documentElement.style.setProperty("--user-bubble-color", value);
  }

  /* قراءة الاختيار المحفوظ (مرة واحدة بس عند التحميل) */
  async function _load(uid) {
    if (!uid || !window.db) return;
    try {
      const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      const snap = await getDoc(doc(window.db, "users", uid, "settings", "appPrefs"));
      if (snap.exists()) {
        const d = snap.data();
        if (typeof d.bubbleColor === "string" && HEX_RE.test(d.bubbleColor)) {
          _hex = d.bubbleColor;
          _transparent = d.bubbleColorTransparent !== false;
          _apply(_hex, _transparent);
        }
      }
    } catch (e) {}
    _syncUI();
  }

  /* حفظ الاختيار (merge — بدون التأثير على باقي حقول appPrefs) */
  async function _save() {
    const uid = window.currentUser?.uid;
    if (!uid || !window.db) return;
    if (_hex && !HEX_RE.test(_hex)) return; // تحقق أمان قبل أي كتابة
    try {
      const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await setDoc(doc(window.db, "users", uid, "settings", "appPrefs"),
        { bubbleColor: _hex, bubbleColorTransparent: _transparent },
        { merge: true });
    } catch (e) {}
  }

  /* مزامنة عناصر الواجهة مع الحالة الحالية */
  function _syncUI() {
    const input = document.getElementById("bubbleColorInput");
    const toggle = document.getElementById("bubbleColorTransparentToggle");
    const resetBtn = document.getElementById("bubbleColorResetBtn");
    if (input) input.value = _hex || DEFAULT_HEX;
    if (toggle) toggle.checked = _transparent;
    if (resetBtn) resetBtn.style.display = _hex ? "" : "none";
  }

  /* بناء واجهة الـ Picker داخل الحاوية الفاضية */
  function _buildUI() {
    const slot = document.getElementById("bubbleColorPickerSlot");
    if (!slot) return;
    slot.innerHTML = `
      <div class="smod-sec-label" style="margin-top:4px"><i class="fa-solid fa-droplet"></i> لون فقاعة رسائلك</div>
      <div class="smod-row bcolor-row">
        <div class="smod-icon" style="background:rgba(201,169,110,.12)"><i class="fa-solid fa-palette" style="color:var(--gold)"></i></div>
        <div class="smod-info">
          <div class="smod-label">لون فقاعتك ("أنا") في كل محادثاتك</div>
          <div class="smod-desc">يظهر لك بس — الطرف التاني بيفضل شايف لونه هو</div>
        </div>
        <input type="color" id="bubbleColorInput" class="bcolor-input" value="${DEFAULT_HEX}">
      </div>
      <div class="smod-row bcolor-row">
        <div class="smod-icon" style="background:rgba(201,169,110,.12)"><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--gold)"></i></div>
        <div class="smod-info">
          <div class="smod-label">شفافية اللون</div>
          <div class="smod-desc">تفعيل شفافية خفيفة بدل اللون الصريح</div>
        </div>
        <label class="smod-toggle">
          <input type="checkbox" id="bubbleColorTransparentToggle" checked>
          <span class="smod-toggle-slider"></span>
        </label>
      </div>
      <button id="bubbleColorResetBtn" class="bcolor-reset-btn" style="display:none;">
        <i class="fa-solid fa-arrow-rotate-left"></i> رجوع للون الافتراضي
      </button>
    `;

    const input = document.getElementById("bubbleColorInput");
    const toggle = document.getElementById("bubbleColorTransparentToggle");
    const resetBtn = document.getElementById("bubbleColorResetBtn");

    input.addEventListener("input", () => {
      _hex = input.value;
      _transparent = toggle.checked;
      _apply(_hex, _transparent);   // معاينة حية فورية
      if (resetBtn) resetBtn.style.display = "";
    });
    input.addEventListener("change", _save);

    toggle.addEventListener("change", () => {
      _transparent = toggle.checked;
      if (_hex) { _apply(_hex, _transparent); _save(); }
    });

    resetBtn.addEventListener("click", () => {
      _hex = null;
      _transparent = true;
      _apply(null, true);
      _syncUI();
      _save();
    });

    _syncUI();
  }

  document.addEventListener("DOMContentLoaded", _buildUI);

  /* ── ربط مع جاهزية المصادقة — window._dmsStartListeners بيتنادى فعلياً
     عبر window مباشرة عند اكتمال تسجيل الدخول (على عكس _startNotifListener
     اللي بتوليها index.html بشكل محلي، فتغليفها الخارجي ما بيتنفذش) ── */
  const _origDmsStart = window._dmsStartListeners;
  window._dmsStartListeners = function () {
    _load(window.currentUser?.uid);
    if (typeof _origDmsStart === "function") return _origDmsStart.apply(this, arguments);
  };
})();
