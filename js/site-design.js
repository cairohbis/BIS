/* ══════════════════════════════════════════
   js/site-design.js — تصميم الموقع (Site Design)
   Stored in Firestore: appSettings/themeColors
   { colors:{bg,bg2,card,card2,border,hover,hover-border,deep}, glassA, updatedBy, updatedAt }
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
const DEFAULTS = {
  colors: {
    "bg": "#141416", "bg2": "#18181a", "card": "#1c1c1e", "card2": "#1a1a1c",
    "border": "#242426", "hover": "#212123", "hover-border": "#2c2c2e", "deep": "#0d0d0f"
  },
  glassA: 0.72
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
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", cfg.colors.bg);
  }
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

function _modalHTML() {
  const rows = KEYS.map(k => `
    <div class="sd-row">
      <label for="sdc-${k}">${LABELS[k]}</label>
      <input type="text" class="sd-hex" id="sdh-${k}" dir="ltr" readonly>
      <input type="color" id="sdc-${k}" data-k="${k}">
    </div>`).join("");
  return `
  <div class="sd-head">
    <button class="sd-x" id="sdClose" aria-label="إغلاق">×</button>
    <div class="sd-title">تصميم الموقع</div>
  </div>
  <div class="sd-body">
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
    <div class="sd-sec">الألوان</div>
    ${rows}
    <div class="sd-sec">الشفافية <span id="sdAval" dir="ltr"></span></div>
    <input type="range" id="sdAlpha" min="30" max="100" step="1" class="sd-range">
    <div class="sd-note">المعاينة هنا فقط. زر الحفظ بيطبّق التصميم على كل الموقع لكل المستخدمين.</div>
  </div>
  <div class="sd-foot">
    <button class="sd-b sd-save" id="sdSave">حفظ وتطبيق على الموقع</button>
    <button class="sd-b" id="sdReset">الافتراضي</button>
    <button class="sd-b" id="sdCancel">إلغاء</button>
  </div>`;
}

function _refresh() {
  const pv = document.getElementById("sdPreview");
  applyThemeColors(_draft, pv);
  KEYS.forEach(k => {
    document.getElementById("sdc-" + k).value = _draft.colors[k];
    document.getElementById("sdh-" + k).value = _draft.colors[k];
  });
  document.getElementById("sdAlpha").value = Math.round(_draft.glassA * 100);
  document.getElementById("sdAval").textContent = _draft.glassA.toFixed(2);
  document.getElementById("sdSw").innerHTML = ["bg", "bg2", "card", "card2", "border"].map(k =>
    `<div style="background:var(--t-${k})"><span>${k}</span><span dir="ltr">${_draft.colors[k]}</span></div>`).join("");
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
      if (t.dataset && t.dataset.k) { _draft.colors[t.dataset.k] = t.value.toLowerCase(); _refresh(); }
      else if (t.id === "sdAlpha") { _draft.glassA = Number(t.value) / 100; _refresh(); }
    });
    document.getElementById("sdClose").onclick = closeSiteDesign;
    document.getElementById("sdCancel").onclick = closeSiteDesign;
    document.getElementById("sdReset").onclick = () => { _draft = _clone(DEFAULTS); _refresh(); };
    document.getElementById("sdSave").onclick = _save;
  }
  _refresh();
  _modal.style.display = "flex";
}

function closeSiteDesign() { if (_modal) _modal.style.display = "none"; }

async function _save() {
  if (!window.isOwner?.()) return;
  const btn = document.getElementById("sdSave");
  btn.disabled = true;
  try {
    const uid = (window.currentUser && window.currentUser.uid) || null;
    await setDoc(_ref(), { colors: _draft.colors, glassA: _draft.glassA, updatedBy: uid, updatedAt: serverTimestamp() });
    _current = _clone(_draft);
    _cacheSet(_current);
    applyThemeColors(_current);
    window.toast?.("تم حفظ التصميم وتطبيقه على الموقع", "success");
    closeSiteDesign();
  } catch (e) {
    window.toast?.("تعذّر الحفظ — تأكد من صلاحية الكتابة", "error");
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
