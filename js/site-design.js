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
  return cfg;
}

/* يطبّق الإعداد على عنصر (الافتراضي: الموقع كله). المعاينة بتستعمل نفس الدالة على عنصرها. */
function applyThemeColors(cfg, target) {
  const el = target || document.documentElement;
  KEYS.forEach(k => {
    el.style.setProperty("--t-" + k, cfg.colors[k]);
    el.style.setProperty("--t-" + k + "-rgb", _hexToRgb(cfg.colors[k]));
  });
  el.style.setProperty("--glass-a", String(cfg.glassA));
  if (!target) {
    _applyLight(cfg);
    _applyLock(cfg);
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", cfg.colors.bg);
  }
}

/* الوضع الفاتح: ستايل واحد في آخر الـ head يعيد تعريف متغيرات html.theme-light (نفس الـ specificity فيكسب بالترتيب) */
function _shade(hex, k) { // k<0 يغمّق، k>0 يفتّح
  return "#" + [1, 3, 5].map(i => {
    const v = parseInt(hex.slice(i, i + 2), 16);
    const n = k < 0 ? v * (1 + k) : v + (255 - v) * k;
    return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  }).join("");
}
function _lightVars(L) {
  const m = { "bg": L.bg, "bg2": L.bg2, "card": L.card, "card2": L.card2, "border": L.border,
              "hover": _shade(L.bg2, -0.06), "hover-border": _shade(L.border, -0.08), "deep": _shade(L.bg, -0.08) };
  let v = "--bg:" + L.bg + ";--bg2:" + L.bg2 + ";--card:" + L.card + ";--card2:" + L.card2 + ";--border:" + L.border + ";--text:" + L.text + ";";
  Object.keys(m).forEach(k => { v += "--t-" + k + ":" + m[k] + ";--t-" + k + "-rgb:" + _hexToRgb(m[k]) + ";"; });
  return v;
}
function _applyLight(cfg) {
  let st = document.getElementById("siteDesignLightStyle");
  if (!st) { st = document.createElement("style"); st.id = "siteDesignLightStyle"; document.head.appendChild(st); }
  st.textContent = "html.theme-light{" + _lightVars(cfg.light) + "}";
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
      <label for="sdc-${k}">${labels[k]}</label>
      <input type="text" class="sd-hex" id="sdh-${k}" dir="ltr" readonly>
      <input type="color" id="sdc-${k}" data-k="${k}">
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
    pv.style.setProperty("--glass-a", "1");
  } else {
    applyThemeColors(_draft, pv);
    pv.style.setProperty("--sd-text", "#e8edf5");
    pv.style.setProperty("--sd-muted", "#5a7499");
    pv.style.setProperty("--sd-glass", "rgba(255,255,255,.07)");
    pv.style.setProperty("--sd-glass-b", "rgba(255,255,255,.12)");
  }
  Object.keys(pal).forEach(k => {
    const c = document.getElementById("sdc-" + k), h = document.getElementById("sdh-" + k);
    if (c) c.value = pal[k];
    if (h) h.value = pal[k];
  });
  document.getElementById("sdAlphaWrap").style.display = _mode === "light" ? "none" : "";
  document.getElementById("sdAlpha").value = Math.round(_draft.glassA * 100);
  document.getElementById("sdAval").textContent = _draft.glassA.toFixed(2);
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
      if (t.dataset && t.dataset.k) { _palette()[t.dataset.k] = t.value.toLowerCase(); _refresh(); }
      else if (t.id === "sdAlpha") { _draft.glassA = Number(t.value) / 100; _refresh(); }
    });
    document.getElementById("sdClose").onclick = closeSiteDesign;
    document.getElementById("sdCancel").onclick = closeSiteDesign;
    document.getElementById("sdReset").onclick = () => {
      if (_mode === "light") _draft.light = _clone(DEFAULTS.light);
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

function closeSiteDesign() { if (_modal) _modal.style.display = "none"; }

async function _save() {
  if (!window.isOwner?.()) return;
  const btn = document.getElementById("sdSave");
  btn.disabled = true;
  try {
    const uid = (window.currentUser && window.currentUser.uid) || null;
    await setDoc(_ref(), { colors: _draft.colors, glassA: _draft.glassA, light: _draft.light, lightLocked: !!_current.lightLocked, updatedBy: uid, updatedAt: serverTimestamp() });
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
