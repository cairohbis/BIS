/* ══════════════════════════════════════════════════════════════
   js/other-bubble-color.js — لون مخصص لفقاعة "الطرف الآخر" (اختياري لكل مستخدم)

   ملف معزول بالكامل — نسخة موازية لـ js/bubble-color.js، بنفس
   المنطق تمامًا، بدون أي تعديل على bubble-color.js أو أي كود موجود.
   يخزّن الاختيار في نفس مستند users/{uid}/settings/appPrefs
   (حقول مختلفة: otherBubbleColor / otherBubbleColorTransparent).
   يطبّق اللون عبر متغيّر CSS واحد: --other-bubble-color
   (موجود بالفعل كـ fallback في .bubble.other من غير تغيير
   في اللون الافتراضي — لو المستخدم ما خصصش حاجة، مفيش أي فرق).
══════════════════════════════════════════════════════════════ */
(function () {
  const HEX_RE = /^#[0-9a-fA-F]{6}$/;
  const DEFAULT_HEX = "#ffffff";

  let _hex = null;
  let _transparent = true;

  function _hexToRgba(hex, alpha) {
    const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
    if (!m) return null;
    const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function _contrastText(hex) {
    const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
    if (!m) return "#ffffff";
    const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness >= 140 ? "#111111" : "#ffffff";
  }

  function _apply(hex, transparent) {
    if (!hex || !HEX_RE.test(hex)) {
      document.documentElement.style.removeProperty("--other-bubble-color");
      document.documentElement.style.removeProperty("--other-bubble-text");
      return;
    }
    const value = transparent ? (_hexToRgba(hex, 0.24) || hex) : hex;
    document.documentElement.style.setProperty("--other-bubble-color", value);
    document.documentElement.style.setProperty("--other-bubble-text", _contrastText(hex));
  }

  async function _load(uid) {
    if (!uid || !window.db) return;
    try {
      const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      const snap = await getDoc(doc(window.db, "users", uid, "settings", "appPrefs"));
      if (snap.exists()) {
        const d = snap.data();
        if (typeof d.otherBubbleColor === "string" && HEX_RE.test(d.otherBubbleColor)) {
          _hex = d.otherBubbleColor;
          _transparent = d.otherBubbleColorTransparent !== false;
          _apply(_hex, _transparent);
        }
      }
    } catch (e) {}
    _syncUI();
  }

  async function _save() {
    const uid = window.currentUser?.uid;
    if (!uid || !window.db) return;
    if (_hex && !HEX_RE.test(_hex)) return;
    try {
      const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await setDoc(doc(window.db, "users", uid, "settings", "appPrefs"),
        { otherBubbleColor: _hex, otherBubbleColorTransparent: _transparent },
        { merge: true });
    } catch (e) {}
  }

  function _syncUI() {
    const input = document.getElementById("otherBubbleColorInput");
    const toggle = document.getElementById("otherBubbleColorTransparentToggle");
    const resetBtn = document.getElementById("otherBubbleColorResetBtn");
    if (input) input.value = _hex || DEFAULT_HEX;
    if (toggle) toggle.checked = _transparent;
    if (resetBtn) resetBtn.style.display = _hex ? "" : "none";
  }

  function _buildUI() {
    const slot = document.getElementById("otherBubbleColorPickerSlot");
    if (!slot) return;
    slot.innerHTML = `
      <div class="smod-sec-label" style="margin-top:4px"><i class="fa-solid fa-droplet"></i> لون فقاعة الطرف الآخر</div>
      <div class="smod-row bcolor-row">
        <div class="smod-icon" style="background:rgba(201,169,110,.12)"><i class="fa-solid fa-palette" style="color:var(--gold)"></i></div>
        <div class="smod-info">
          <div class="smod-label">لون فقاعة الرسائل اللي بتوصلك</div>
          <div class="smod-desc">يظهر لك بس — الطرف التاني بيفضل شايف لون رسايله زي ما هو عنده</div>
        </div>
        <input type="color" id="otherBubbleColorInput" class="bcolor-input" value="${DEFAULT_HEX}">
      </div>
      <div class="smod-row bcolor-row">
        <div class="smod-icon" style="background:rgba(201,169,110,.12)"><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--gold)"></i></div>
        <div class="smod-info">
          <div class="smod-label">شفافية اللون</div>
          <div class="smod-desc">تفعيل شفافية خفيفة بدل اللون الصريح</div>
        </div>
        <label class="smod-toggle">
          <input type="checkbox" id="otherBubbleColorTransparentToggle" checked>
          <span class="smod-toggle-slider"></span>
        </label>
      </div>
      <button id="otherBubbleColorResetBtn" class="bcolor-reset-btn" style="display:none;">
        <i class="fa-solid fa-arrow-rotate-left"></i> رجوع للون الافتراضي
      </button>
    `;

    const input = document.getElementById("otherBubbleColorInput");
    const toggle = document.getElementById("otherBubbleColorTransparentToggle");
    const resetBtn = document.getElementById("otherBubbleColorResetBtn");

    input.addEventListener("input", () => {
      _hex = input.value;
      _transparent = toggle.checked;
      _apply(_hex, _transparent);
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

  const _origDmsStart = window._dmsStartListeners;
  window._dmsStartListeners = function () {
    _load(window.currentUser?.uid);
    if (typeof _origDmsStart === "function") return _origDmsStart.apply(this, arguments);
  };
})();
