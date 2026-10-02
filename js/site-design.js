/* ══════════════════════════════════════════
   js/site-design.js — تصميم الموقع (Site Design)
   Stored in Firestore: appSettings/themeColors
   { colors:{bg,bg2,card,card2,border,hover,hover-border,deep}, glassA,
     light:{bg,bg2,card,card2,border,text}, lightLocked, updatedBy, updatedAt }
   - الكل يقرأ ويطبّق (onSnapshot + كاش محلي)
   - المالك فقط يحفظ (نافذة "تصميم موقع" في لوحة المالك)
   - الألوان بتتطبق عبر متغيرات --t-* و --glass-a (شوف DESIGN-SYSTEM.md)
══════════════════════════════════════════ */
import { doc, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const KEYS = ["bg", "bg2", "card", "card2", "border", "hover", "hover-border", "deep"];
const LABELS = {
  "bg": "الخلفية الرئيسية",
  "bg2": "الحقول والشيتات",
  "card": "الكروت",
  "card2": "كروت العناصر",
  "border": "الحدود",
  "hover": "hover الأزرار",
  "hover-border": "hover الحدود",
  "deep": "الطبقة الغامقة"
};
const LIGHT_KEYS = ["bg", "bg2", "card", "card2", "border", "text"];
const LIGHT_LABELS = {
  "bg": "الخلفية الرئيسية",
  "bg2": "الحقول والشيتات",
  "card": "الكروت",
  "card2": "كروت العناصر",
  "border": "الحدود",
  "text": "لون النص"
};
const DEFAULTS = {
  colors: {
    "bg": "#141416", "bg2": "#18181a", "card": "#1c1c1e", "card2": "#1a1a1c",
    "border": "#242426", "hover": "#212123", "hover-border": "#2c2c2e", "deep": "#0d0d0f"
  },
  glassA: 0.72,
  glassALight: 0.72,
  lightLocked: false,
  light: { "bg": "#f5ecd4", "bg2": "#ecdfbd", "card": "#fffaf0", "card2": "#faf1da", "border": "#d4bd85", "text": "#1a1405" }
};
const CACHE_KEY = "_siteDesignCache";
const HEX = /^#[0-9a-f]{6}$/i;

const _ref = () => doc(window.db, "appSettings", "themeColors");
const _clone = (o) => JSON.parse(JSON.stringify(o));

function _hexToRgb(h) {
  return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(",");
}

function _normalize(raw) {
  const cfg = _clone(DEFAULTS);
  if (raw && raw.colors) {
    KEYS.forEach(k => { if (HEX.test(raw.colors[k] || "")) cfg.colors[k] = raw.colors[k].toLowerCase(); });
  }
  if (raw && raw.light) {
    LIGHT_KEYS.forEach(k => { if (HEX.test(raw.light[k] || "")) cfg.light[k] = raw.light[k].toLowerCase(); });
  }
  cfg.lightLocked = !!(raw && raw.lightLocked === true);
  const a = Number(raw && raw.glassA);
  if (isFinite(a) && a >= 0.3 && a <= 1) cfg.glassA = Math.round(a * 100) / 100;
  const al = Number(raw && raw.glassALight);
  if (isFinite(al) && al >= 0.3 && al <= 1) cfg.glassALight = Math.round(al * 100) / 100;
  return cfg;
}

/* يطبّق الإعداد. للموقع كله: عبر <style> على :root (مش inline) عشان html.theme-light يقدر يغلبه في الوضع الفاتح.
   للمعاينة: inline على عنصرها. */
function applyThemeColors(cfg, target) {
  if (target) {
    KEYS.forEach(k => {
      target.style.setProperty("--t-" + k, cfg.colors[k]);
      target.style.setProperty("--t-" + k + "-rgb", _hexToRgb(cfg.colors[k]));
    });
    target.style.setProperty("--glass-a", String(cfg.glassA));
    return;
  }
  let v = "--glass-a:" + cfg.glassA + ";";
  KEYS.forEach(k => { v += "--t-" + k + ":" + cfg.colors[k] + ";--t-" + k + "-rgb:" + _hexToRgb(cfg.colors[k]) + ";"; });
  let st = document.getElementById("siteDesignDarkStyle");
  if (!st) { st = document.createElement("style"); st.id = "siteDesignDarkStyle"; document.head.appendChild(st); }
  st.textContent = ":root{" + v + "}";
  _applyLight(cfg);
  _applyLock(cfg);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", cfg.colors.bg);
}

/* الوضع الفاتح: ستايل واحد في آخر الـ head يعيد تعريف متغيرات html.theme-light (أقوى من :root) */
function _shade(hex, k) { // k<0 يغمّق، k>0 يفتّح
  return "#" + [1, 3, 5].map(i => {
    const v = parseInt(hex.slice(i, i + 2), 16);
    const n = k < 0 ? v * (1 + k) : v + (255 - v) * k;
    return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  }).join("");
}
function _lightVars(cfg) {
  const L = cfg.light;
  const m = { "bg": L.bg, "bg2": L.bg2, "card": L.card, "card2": L.card2, "border": L.border,
              "hover": _shade(L.bg2, -0.06), "hover-border": _shade(L.border, -0.08), "deep": _shade(L.bg, -0.08) };
  let v = "--glass-a:" + cfg.glassALight + ";--bg:" + L.bg + ";--bg2:" + L.bg2 + ";--card:" + L.card + ";--card2:" + L.card2 + ";--border:" + L.border + ";--text:" + L.text + ";";
  Object.keys(m).forEach(k => { v += "--t-" + k + ":" + m[k] + ";--t-" + k + "-rgb:" + _hexToRgb(m[k]) + ";"; });
  return v;
}
function _applyLight(cfg) {
  let st = document.getElementById("siteDesignLightStyle");
  if (!st) { st = document.createElement("style"); st.id = "siteDesignLightStyle"; document.head.appendChild(st); }
  st.textContent = "html.theme-light{" + _lightVars(cfg) + "}";
}

/* قفل الوضع الفاتح: كاش محلي (بيقراه settings-modal.js قبل أول رسم) + تطبيق فوري لو الدالة جاهزة */
function _applyLock(cfg) {
  try { localStorage.setItem("_lightLocked", cfg.lightLocked ? "1" : "0"); } catch (e) {}
  if (window._setLightModeLocked) window._setLightModeLocked(cfg.lightLocked);
}

function _toast(msg, type) {
  try {
    if (typeof window.toast === "function") window.toast(msg, type);
    else if (typeof toast === "function") toast(msg, type);
  } catch (e) {}
}

function _cacheGet() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch (e) { return null; } }
function _cacheSet(cfg) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cfg)); } catch (e) {} }

/* ── 1) تطبيق الكاش فورًا لمنع الوميض ── */
let _current = _normalize(_cacheGet());
if (_cacheGet()) applyThemeColors(_current);

/* ── 2) الاستماع للتغييرات من Firestore (لكل المستخدمين) ── */
let _tries = 0;
function _listen() {
  if (!window.db) {
    if (_tries++ < 60) setTimeout(_listen, 300);
    return;
  }
  onSnapshot(_ref(), (snap) => {
    if (!snap.exists()) return;
    _current = _normalize(snap.data());
    _cacheSet(_current);
    applyThemeColors(_current);
  }, () => {
    if (_tries++ < 70) setTimeout(_listen, 15000);
  });
}
_listen();

/* ── 3) نافذة "تصميم موقع" (للمالك) ── */
let _draft = null;
let _modal = null;
let _mode = "dark"; // الوضع اللي بيتم تصميمه الآن: dark | light

function _modalHTML() {
  return `
  <div class="sd-head">
    <button class="sd-x" id="sdClose" aria-label="إغلاق">×</button>
    <div class="sd-title">تصميم الموقع</div>
  </div>
  <div class="sd-body">
    <div class="sd-lock" id="sdLockBox">
      <div class="sd-lock-txt"><b>الوضع الفاتح للمستخدمين</b><span id="sdLockState"></span></div>
      <button class="sd-lockbtn" id="sdLockBtn"></button>
    </div>
    <div class="sd-modes">
      <button class="sd-mode on" id="sdModeDark" data-mode="dark">الوضع الداكن</button>
      <button class="sd-mode" id="sdModeLight" data-mode="light">الوضع الفاتح</button>
    </div>
    <div class="sd-preview" id="sdPreview">
      <div class="sd-sw" id="sdSw"></div>
      <div class="sd-glass sd-top">
        <div class="sd-av">O</div>
        <div class="sd-grow">أهلاً Oo</div>
        <div class="sd-chip">أدمن</div>
      </div>
      <div class="sd-grid">
        <div class="sd-card"><b>الشات العام</b><small>الكروت</small></div>
        <div class="sd-card"><b>المنتدى</b><small>الكروت</small></div>
        <div class="sd-glass sd-fc"><b>أخبار المعهد</b><small>زجاجي</small></div>
        <div class="sd-card2"><b>محاضرة</b><small>كروت العناصر</small></div>
      </div>
      <div class="sd-input">بحث… (حقول)</div>
      <div class="sd-glass sd-prof">
        <div class="sd-ptitle">بروفايلي</div>
        <div class="sd-btns"><span>تعيين صورة</span><span>تعديل</span><span>الإعدادات</span></div>
        <div class="sd-line"><span>الإيميل</span><span>oo@mail.com</span></div>
        <div class="sd-gold"></div>
        <div class="sd-line"><span>UID</span><span>1024</span></div>
      </div>
      <div class="sd-set"><div class="sd-set-h">الإعدادات</div><div class="sd-set-r">حسابي</div><div class="sd-set-r">المظهر</div></div>
      <div class="sd-lbl">اختبار الشفافية فوق خلفية ملونة</div>
      <div class="sd-stripes"><div class="sd-ov" style="right:8px"></div><div class="sd-ov" style="right:35%"></div><div class="sd-ov" style="right:68%"></div></div>
    </div>
    <div class="sd-sec" id="sdSecTitle">الألوان</div>
    <div id="sdRows"></div>
    <div id="sdAlphaWrap">
      <div class="sd-sec">الشفافية <span id="sdAval" dir="ltr"></span></div>
      <input type="range" id="sdAlpha" min="30" max="100" step="1" class="sd-range">
    </div>
    <div class="sd-note">المعاينة هنا فقط. زر الحفظ بيطبّق التصميم على كل الموقع لكل المستخدمين.</div>
  </div>
  <div class="sd-foot">
    <button class="sd-b sd-save" id="sdSave">حفظ وتطبيق على الموقع</button>
    <button class="sd-b" id="sdReset">الافتراضي</button>
    <button class="sd-b" id="sdCancel">إلغاء</button>
  </div>`;
}

function _rowsHTML() {
  const keys = _mode === "light" ? LIGHT_KEYS : KEYS;
  const labels = _mode === "light" ? LIGHT_LABELS : LABELS;
  return keys.map(k => `
    <div class="sd-row">
      <label for="sdh-${k}">${labels[k]}</label>
      <input type="text" class="sd-hex" id="sdh-${k}" data-k="${k}" dir="ltr" maxlength="9" spellcheck="false" autocomplete="off" autocapitalize="characters" placeholder="FCF0DA">
      <button type="button" class="sd-swatch" id="sdc-${k}" data-pick="${k}" aria-label="${labels[k]}"></button>
    </div>`).join("");
}

function _palette() { return _mode === "light" ? _draft.light : _draft.colors; }

function _refresh() {
  const pv = document.getElementById("sdPreview");
  const pal = _palette();
  if (_mode === "light") {
    const L = _draft.light;
    ["bg", "bg2", "card", "card2", "border"].forEach(k => {
      pv.style.setProperty("--t-" + k, L[k]);
      pv.style.setProperty("--t-" + k + "-rgb", [1, 3, 5].map(i => parseInt(L[k].slice(i, i + 2), 16)).join(","));
    });
    pv.style.setProperty("--sd-text", L.text);
    pv.style.setProperty("--sd-muted", "#5c4a22");
    pv.style.setProperty("--sd-glass", "rgba(0,0,0,.04)");
    pv.style.setProperty("--sd-glass-b", "rgba(0,0,0,.10)");
    pv.style.setProperty("--glass-a", String(_draft.glassALight));
  } else {
    applyThemeColors(_draft, pv);
    pv.style.setProperty("--sd-text", "#e8edf5");
    pv.style.setProperty("--sd-muted", "#5a7499");
    pv.style.setProperty("--sd-glass", "rgba(255,255,255,.07)");
    pv.style.setProperty("--sd-glass-b", "rgba(255,255,255,.12)");
  }
  Object.keys(pal).forEach(k => {
    const c = document.getElementById("sdc-" + k), h = document.getElementById("sdh-" + k);
    if (c) c.style.background = pal[k];
    if (h && document.activeElement !== h) { h.value = pal[k].toUpperCase(); h.classList.remove("bad"); }
  });
  const ga = _mode === "light" ? _draft.glassALight : _draft.glassA;
  document.getElementById("sdAlpha").value = Math.round(ga * 100);
  document.getElementById("sdAval").textContent = ga.toFixed(2);
  document.getElementById("sdSw").innerHTML = ["bg", "bg2", "card", "card2", "border"].map(k =>
    `<div style="background:var(--t-${k})"><span>${k}</span><span dir="ltr">${pal[k]}</span></div>`).join("");
}

function _refreshLock() {
  const locked = !!_current.lightLocked;
  document.getElementById("sdLockState").textContent = locked ? "مقفول مؤقتًا: كل المستخدمين على الوضع الداكن" : "مفتوح: المستخدم يختار الداكن أو الفاتح";
  const b = document.getElementById("sdLockBtn");
  b.textContent = locked ? "فتح الوضع الفاتح" : "قفل الوضع الفاتح";
  b.classList.toggle("locked", locked);
  document.getElementById("sdLockBox").classList.toggle("locked", locked);
}

async function _toggleLock() {
  if (!window.isOwner?.()) return;
  const v = !_current.lightLocked;
  const msg = v ? "هيتم قفل الوضع الفاتح وإرجاع كل المستخدمين للوضع الداكن فورًا. متأكد؟"
                : "هيتم فتح الوضع الفاتح لكل المستخدمين. متأكد؟";
  if (!window.confirm(msg)) return;
  const btn = document.getElementById("sdLockBtn");
  btn.disabled = true;
  try {
    const uid = (window.currentUser && window.currentUser.uid) || null;
    await setDoc(_ref(), { lightLocked: v, updatedBy: uid, updatedAt: serverTimestamp() }, { merge: true });
    _current.lightLocked = v;
    if (_draft) _draft.lightLocked = v;
    _cacheSet(_current);
    applyThemeColors(_current);
    _toast(v ? "تم قفل الوضع الفاتح" : "تم فتح الوضع الفاتح", "success");
  } catch (e) {
    _toast("تعذّر الحفظ — تأكد من صلاحية الكتابة", "error");
  }
  btn.disabled = false;
  _refreshLock();
}

/* ── منتقي الألوان الحديث (زجاجي): مربع التشبّع/السطوع + شريط الدرجة + كود HEX + ألوان جاهزة ── */
function _parseHex(str) {
  let h = String(str || "").trim().replace(/^#/, "").replace(/\s+/g, "");
  if (!/^[0-9a-fA-F]+$/.test(h)) return null;
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  else if (h.length === 8) h = h.slice(0, 6); // نتجاهل قناة الشفافية في الكود
  if (h.length !== 6) return null;
  return "#" + h.toLowerCase();
}
function _rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h: h, s: mx ? d / mx : 0, v: mx };
}
function _hsvToHex(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return "#" + [r, g, b].map(n => Math.round((n + m) * 255).toString(16).padStart(2, "0")).join("");
}
const PRESETS = {
  dark: ["#0d0d0f", "#141416", "#18181a", "#1a1a1c", "#1c1c1e", "#212123", "#242426", "#2c2c2e", "#3a3a3c", "#48484a", "#1a1405", "#c9a96e"],
  light: ["#ffffff", "#fffaf0", "#faf1da", "#f5ecd4", "#ecdfbd", "#e6d7aa", "#d4bd85", "#c4a96a", "#1a1405", "#5c4a22", "#0d1f3c", "#b08a3e"]
};
let _pk = { k: null, h: 0, s: 0, v: 0, old: "#000000" };
let _pkEl = null;

function _pkApply(hex) {
  _palette()[_pk.k] = hex;
  _refresh();
}
function _pkRender(fromHex) {
  const hex = fromHex || _hsvToHex(_pk.h, _pk.s, _pk.v);
  document.getElementById("sdPkSV").style.background =
    "linear-gradient(to top,#000,rgba(0,0,0,0)),linear-gradient(to right,#fff,hsl(" + Math.round(_pk.h) + ",100%,50%))";
  const th = document.getElementById("sdPkThumb");
  th.style.left = (_pk.s * 100) + "%"; th.style.top = ((1 - _pk.v) * 100) + "%"; th.style.background = hex;
  document.getElementById("sdPkHue").value = Math.round(_pk.h);
  document.getElementById("sdPkNew").style.background = hex;
  const hi = document.getElementById("sdPkHex");
  if (document.activeElement !== hi) { hi.value = hex.toUpperCase(); hi.classList.remove("bad"); }
}
function _openPicker(k) {
  _pk.k = k; _pk.old = _palette()[k];
  const rgb = [1, 3, 5].map(i => parseInt(_pk.old.slice(i, i + 2), 16));
  const hsv = _rgbToHsv(rgb[0], rgb[1], rgb[2]); _pk.h = hsv.h; _pk.s = hsv.s; _pk.v = hsv.v;
  if (!_pkEl) {
    _pkEl = document.createElement("div");
    _pkEl.id = "sdPicker";
    _pkEl.innerHTML = `
      <div class="sd-pk-card" role="dialog" aria-label="اختيار اللون">
        <div class="sd-pk-head"><b id="sdPkTitle"></b><button type="button" class="sd-x" id="sdPkX" aria-label="إغلاق">×</button></div>
        <div class="sd-pk-sv" id="sdPkSV"><div class="sd-pk-thumb" id="sdPkThumb"></div></div>
        <input type="range" class="sd-pk-hue" id="sdPkHue" min="0" max="360" step="1" aria-label="درجة اللون">
        <div class="sd-pk-row">
          <div class="sd-pk-prev"><span id="sdPkOld" title="اللون الحالي"></span><span id="sdPkNew" title="اللون الجديد"></span></div>
          <input type="text" class="sd-hex sd-pk-hex" id="sdPkHex" dir="ltr" maxlength="9" spellcheck="false" autocomplete="off" autocapitalize="characters" placeholder="FCF0DA">
        </div>
        <div class="sd-pk-presets" id="sdPkPresets"></div>
        <button type="button" class="sd-b sd-save" id="sdPkDone">تم</button>
      </div>`;
    _modal.appendChild(_pkEl);
    const sv = _pkEl.querySelector("#sdPkSV");
    const move = (e) => {
      const r = sv.getBoundingClientRect();
      _pk.s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      _pk.v = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      const hx = _hsvToHex(_pk.h, _pk.s, _pk.v); _pkApply(hx); _pkRender(hx);
    };
    sv.addEventListener("pointerdown", (e) => { sv.setPointerCapture(e.pointerId); sv._drag = true; move(e); });
    sv.addEventListener("pointermove", (e) => { if (sv._drag) move(e); });
    sv.addEventListener("pointerup", () => { sv._drag = false; });
    sv.addEventListener("pointercancel", () => { sv._drag = false; });
    _pkEl.querySelector("#sdPkHue").addEventListener("input", (e) => {
      _pk.h = Number(e.target.value);
      const hx = _hsvToHex(_pk.h, _pk.s, _pk.v); _pkApply(hx); _pkRender(hx);
    });
    const hi = _pkEl.querySelector("#sdPkHex");
    hi.addEventListener("input", () => {
      const hx = _parseHex(hi.value);
      hi.classList.toggle("bad", !hx);
      if (hx) {
        const rgb2 = [1, 3, 5].map(i => parseInt(hx.slice(i, i + 2), 16));
        const hv = _rgbToHsv(rgb2[0], rgb2[1], rgb2[2]); _pk.h = hv.h; _pk.s = hv.s; _pk.v = hv.v;
        _pkApply(hx); _pkRender(hx);
      }
    });
    hi.addEventListener("blur", () => { hi.value = _palette()[_pk.k].toUpperCase(); hi.classList.remove("bad"); });
    _pkEl.querySelector("#sdPkPresets").addEventListener("click", (e) => {
      const b = e.target.closest("[data-c]"); if (!b) return;
      const hx = b.dataset.c, rgb2 = [1, 3, 5].map(i => parseInt(hx.slice(i, i + 2), 16));
      const hv = _rgbToHsv(rgb2[0], rgb2[1], rgb2[2]); _pk.h = hv.h; _pk.s = hv.s; _pk.v = hv.v;
      _pkApply(hx); _pkRender(hx);
    });
    _pkEl.querySelector("#sdPkDone").onclick = _closePicker;
    _pkEl.querySelector("#sdPkX").onclick = _closePicker;
    _pkEl.addEventListener("click", (e) => { if (e.target === _pkEl) _closePicker(); });
  }
  const labels = _mode === "light" ? LIGHT_LABELS : LABELS;
  document.getElementById("sdPkTitle").textContent = labels[k];
  document.getElementById("sdPkOld").style.background = _pk.old;
  document.getElementById("sdPkPresets").innerHTML = PRESETS[_mode].map(c => `<button type="button" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join("");
  _pkEl.style.display = "flex";
  _pkRender(_pk.old);
}
function _closePicker() { if (_pkEl) _pkEl.style.display = "none"; }

function _setMode(m) {
  _mode = m;
  document.getElementById("sdModeDark").classList.toggle("on", m === "dark");
  document.getElementById("sdModeLight").classList.toggle("on", m === "light");
  document.getElementById("sdRows").innerHTML = _rowsHTML();
  document.getElementById("sdSecTitle").textContent = m === "light" ? "ألوان الوضع الفاتح" : "ألوان الوضع الداكن";
  _refresh();
}

function openSiteDesign() {
  if (!window.isOwner?.()) return;
  _draft = _clone(_current);
  if (!_modal) {
    _modal = document.createElement("div");
    _modal.id = "siteDesignModal";
    _modal.innerHTML = _modalHTML();
    document.body.appendChild(_modal);
    _modal.addEventListener("input", (e) => {
      const t = e.target;
      if (t.classList && t.classList.contains("sd-hex")) {
        const hx = _parseHex(t.value);
        t.classList.toggle("bad", !hx);
        if (hx) { _palette()[t.dataset.k] = hx; _refresh(); }
      }
      else if (t.id === "sdAlpha") { _draft[_mode === "light" ? "glassALight" : "glassA"] = Number(t.value) / 100; _refresh(); }
    });
    _modal.addEventListener("focusout", (e) => {
      const t = e.target;
      if (t.classList && t.classList.contains("sd-hex")) { t.value = _palette()[t.dataset.k].toUpperCase(); t.classList.remove("bad"); }
    });
    _modal.addEventListener("click", (e) => {
      const b = e.target.closest && e.target.closest("[data-pick]");
      if (b) _openPicker(b.dataset.pick);
    });
    document.getElementById("sdClose").onclick = closeSiteDesign;
    document.getElementById("sdCancel").onclick = closeSiteDesign;
    document.getElementById("sdReset").onclick = () => {
      if (_mode === "light") { _draft.light = _clone(DEFAULTS.light); _draft.glassALight = DEFAULTS.glassALight; }
      else { _draft.colors = _clone(DEFAULTS.colors); _draft.glassA = DEFAULTS.glassA; }
      _refresh();
    };
    document.getElementById("sdLockBtn").onclick = _toggleLock;
    document.getElementById("sdModeDark").onclick = () => _setMode("dark");
    document.getElementById("sdModeLight").onclick = () => _setMode("light");
    document.getElementById("sdSave").onclick = _save;
  }
  _setMode(_mode);
  _refreshLock();
  _modal.style.display = "flex";
}

function closeSiteDesign() { _closePicker(); if (_modal) _modal.style.display = "none"; }

async function _save() {
  if (!window.isOwner?.()) return;
  const btn = document.getElementById("sdSave");
  btn.disabled = true;
  try {
    const uid = (window.currentUser && window.currentUser.uid) || null;
    await setDoc(_ref(), { colors: _draft.colors, glassA: _draft.glassA, glassALight: _draft.glassALight, light: _draft.light, lightLocked: !!_current.lightLocked, updatedBy: uid, updatedAt: serverTimestamp() });
    _current = _clone(_draft);
    _cacheSet(_current);
    applyThemeColors(_current);
    _toast("تم حفظ التصميم وتطبيقه على الموقع", "success");
    closeSiteDesign();
  } catch (e) {
    _toast("تعذّر الحفظ — تأكد من صلاحية الكتابة", "error");
  }
  btn.disabled = false;
}

/* ── 4) إظهار قسم "تصميم موقع" للمالك فقط (مخفي افتراضيًا لأي حد تاني) ── */
function _gateSection() {
  const el = document.getElementById("siteDesignItem");
  if (!el) return;
  const ok = !!(window.isOwner && window.isOwner());
  el.style.display = ok ? "" : "none";
  if (!ok) closeSiteDesign();
}
function _watchOwnerPage() {
  const pg = document.getElementById("page-owner");
  if (!pg) { setTimeout(_watchOwnerPage, 500); return; }
  new MutationObserver(_gateSection).observe(pg, { attributes: true, attributeFilter: ["class"] });
  _gateSection();
}
_watchOwnerPage();

window.applyThemeColors = applyThemeColors;
window.openSiteDesign = openSiteDesign;
window.closeSiteDesign = closeSiteDesign;
