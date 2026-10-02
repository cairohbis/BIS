/* ══════════════════════════════════════════
   js/mascot-override.js — طبقة Override مستقلة لإعدادات بريق (مصمم بريق — المرحلة 2)
   ▸ الإعداد المركزي: appSettings/mascotDesign (مرجع صور فقط — لا Base64 ولا رفع صور)
       { version:1, states:{ <stateId>:{ imageKey?, customImage?:{type:"path",value}, size?, animation?, label? } },
         updatedBy, updatedAt }   ← sparse: الحالات اللي اتغيرت فقط
   ▸ المنطق: الحالة ← Override لو موجود ← وإلا النظام الأصلي بدون أي تدخل (success.webp يفضل fallback)
   ▸ مفيش تعديل على js/mascot.js ولا window.toast الأصلية ولا Mascot.registerAsset — بنلف window.toast (اللي
     لفّها mascot-toast-adapter.js) لفة إضافية، وبنعيد رسم بريق جوه نفس #toast بـ Mascot.show فقط لو فيه Override
   ▸ الأداء: قراءة واحدة لكل جلسة كحد أقصى (+ كاش محلي TTL 10 دقايق)، بعد تسجيل الدخول، في الخلفية —
     الـ Toast مابيستناش Firestore أبدًا؛ أي فشل/أوفلاين/مفيش مستند = النظام الحالي فورًا
   ▸ الحفظ: المالك فقط (فحص isOwner + Firestore Rules الحالية — مفيش تعديل على Rules)
   ▸ حالات جديدة (save/add/copy/delete/update): إما toast(msg, type, "save") كمعامل ثالث اختياري،
     أو استنتاج محافظ من بداية نص الرسالة (تم حفظ… / تم نسخ… / تم حذف… / تمت إضافة… / تم تحديث…) لنوع success فقط
══════════════════════════════════════════ */
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

(function () {
  "use strict";

  if (window.__mascotOverrideLoaded) return;
  window.__mascotOverrideLoaded = true;

  var VERSION = 1;
  var COL = "appSettings";
  var DOC = "mascotDesign";
  var CACHE_KEY = "_mascotOverrideCache";
  var TTL_MS = 10 * 60 * 1000;
  var MAX_ATTEMPTS = 4;

  var STATE_IDS = ["success", "save", "add", "copy", "delete", "update", "error", "warn", "info"];
  /* نفس MOOD_MAP في mascot-toast-adapter.js؛ الحالات الجديدة افتراضيها success */
  var DEFAULT_KEY = {
    success: "success", save: "success", add: "success", copy: "success", delete: "success", update: "success",
    error: "error", warn: "surprised", info: "happy"
  };
  var SIZES = { sm: 1, md: 1, lg: 1, xl: 1 };
  var ANIMS = { none: 1, pop: 1, shake: 1, wiggle: 1, spin: 1, run: 1 };
  var IMG_REL = /^images\/[\w\-.\/]+\.(webp|png|jpe?g|gif|svg)$/i;
  var IMG_HTTPS = /^https:\/\/[^\s"'<>\\]+\.(webp|png|jpe?g|gif|svg)(\?[^\s"'<>\\]*)?$/i;

  var _cfg = null;        // الإعداد الفعّال في الذاكرة (null = مفيش Override)
  var _loaded = false;    // اتحمّل من كاش طازج أو من Firestore في الجلسة دي
  var _loading = false;
  var _attempts = 0;
  var _mine = null;       // نسخة بريق الخاصة بالـ Override داخل #toast (بتتنضف مع كل نداء)

  function validKey(k) {
    var M = window.Mascot;
    if (!M || typeof k !== "string") return false;
    return M.EMOTIONS.indexOf(k) > -1 || M.ACTIONS.indexOf(k) > -1 || M.UI_STATES.indexOf(k) > -1;
  }

  function normImg(ci) {
    if (!ci || typeof ci.value !== "string") return null;
    var v = ci.value;
    if (ci.type !== "path") return null; // Base64 مرفوض عمدًا
    if (v.indexOf("..") > -1) return null;
    if (IMG_REL.test(v) || IMG_HTTPS.test(v)) return { type: "path", value: v };
    return null;
  }

  function normalize(raw) {
    var out = { version: VERSION, states: {} };
    if (!raw || typeof raw !== "object" || !raw.states || typeof raw.states !== "object") return out;
    STATE_IDS.forEach(function (id) {
      var r = raw.states[id];
      if (!r || typeof r !== "object") return;
      var o = {};
      if (validKey(r.imageKey)) o.imageKey = r.imageKey;
      var ci = normImg(r.customImage);
      if (ci) o.customImage = ci;
      if (SIZES[r.size]) o.size = r.size;
      if (ANIMS[r.animation]) o.animation = r.animation;
      if (typeof r.label === "string" && r.label.trim()) o.label = r.label.trim().slice(0, 60);
      if (Object.keys(o).length) out.states[id] = o;
    });
    return out;
  }

  function hasStates(c) { return !!(c && c.states && Object.keys(c.states).length); }

  /* ── كاش محلي ── */
  function readCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (c && typeof c === "object") {
        var n = c.cfg ? normalize(c.cfg) : null;
        _cfg = hasStates(n) ? n : null;
        return Number(c.t) || 0;
      }
    } catch (e) {}
    return 0;
  }
  function writeCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), cfg: _cfg })); } catch (e) {}
  }

  /* ── تحميل مرة واحدة (في الخلفية — مفيش حاجة بتستناه) ── */
  function load(force) {
    return new Promise(function (resolve) {
      if (_loading) { resolve(_cfg); return; }
      if (!force && (_loaded || _attempts >= MAX_ATTEMPTS)) { resolve(_cfg); return; }
      if (!window.db || !window.currentUser) { resolve(_cfg); return; } // لا قراءة قبل تسجيل الدخول
      _loading = true;
      _attempts++;
      getDoc(doc(window.db, COL, DOC)).then(function (snap) {
        var n = snap.exists() ? normalize(snap.data()) : null;
        _cfg = hasStates(n) ? n : null;
        _loaded = true;
        writeCache();
      }).catch(function () {
        /* فشل/أوفلاين/Rules: نكمل بالكاش أو بالنظام الحالي */
      }).then(function () {
        _loading = false;
        resolve(_cfg);
      });
    });
  }

  var _cacheT = readCache();
  if (_cacheT && (Date.now() - _cacheT) < TTL_MS) _loaded = true; // كاش طازج = مفيش قراءة شبكة خالص

  if (!_loaded) {
    var _polls = 0;
    var _iv = setInterval(function () {
      if (_loaded || ++_polls > 90) { clearInterval(_iv); return; }
      if (window.db && window.currentUser) { clearInterval(_iv); load(false); }
    }, 2000);
  }

  /* ── تحديد حالة الاستدعاء الحالي ── */
  var INFER = [
    [/^(تم|تمت)\s+(حفظ|الحفظ)/, "save"],
    [/^(تم|تمت)\s+(نسخ|النسخ)/, "copy"],
    [/^(تم|تمت)\s+(حذف|الحذف)/, "delete"],
    [/^(تم|تمت)\s+(إضافة|اضافة|الإضافة|الاضافة)/, "add"],
    [/^(تم|تمت)\s+(تحديث|التحديث|تعديل|التعديل)/, "update"]
  ];
  function infer(msg) {
    if (typeof msg !== "string") return null;
    var m = msg.replace(/^[^\u0621-\u064A]+/, "");
    for (var i = 0; i < INFER.length; i++) if (INFER[i][0].test(m)) return INFER[i][1];
    return null;
  }
  function stateFor(msg, type, explicit) {
    if (typeof explicit === "string" && STATE_IDS.indexOf(explicit) > -1) return explicit;
    if (type === "error") return "error";
    if (type === "warn") return "warn";
    if (type === "info") return "info";
    return infer(msg) || "success"; // أي نوع تاني = success (نفس سلوك الـ adapter)
  }

  /* ── تطبيق الـ Override على #toast (بعد ما الأصلية والـ adapter خلصوا) ── */
  function defaultFile(key) {
    try { var s = window.Mascot.getRegistrySnapshot("default"); return (s[key] && s[key].file) || null; } catch (e) { return null; }
  }
  function applyToToast(msg, type, explicit) {
    if (!_cfg || !window.Mascot) return;
    var id = stateFor(msg, type, explicit);
    var ov = _cfg.states[id];
    if (!ov) return; // مفيش Override للحالة دي = النظام الأصلي زي ما هو
    var toastEl = document.getElementById("toast");
    var slot = toastEl && toastEl.querySelector(".mascot-toast-slot");
    if (!slot) return;

    if (_mine) { _mine.destroy(); _mine = null; }
    var key = ov.imageKey || DEFAULT_KEY[id];
    slot.innerHTML = "";
    _mine = window.Mascot.show({
      mood: key,
      size: ov.size || "sm",
      container: slot,
      decorative: !ov.label,
      label: ov.label || undefined
    });

    if (ov.customImage) {
      var img = _mine.el.querySelector(".mascot__img");
      if (img) {
        var fb = defaultFile(key);
        if (fb) img.onerror = function () { img.onerror = null; img.src = fb; }; // fallback للصورة الافتراضية
        img.loading = "eager";
        img.src = ov.customImage.value;
      }
    }
    if (ov.animation) {
      var inner = _mine.el.querySelector(".mascot__inner");
      if (inner) {
        inner.className = inner.className.replace(/\bmascot-anim-\w+\b/g, "").replace(/\s+/g, " ").trim();
        if (ov.animation !== "none") inner.classList.add("mascot-anim-" + ov.animation);
      }
    }
  }

  /* ── لفّة window.toast (فوق لفّة mascot-toast-adapter.js) — الأصلية أولًا وبنفس الـ arguments ── */
  if (typeof window.toast === "function") {
    var _origToastMO = window.toast;
    window.toast = function (msg, type, state) {
      var result = _origToastMO.apply(this, arguments);
      try {
        if (!_loaded && !_loading) load(false); // خلفية، بدون انتظار
        if (_cfg) applyToToast(msg, arguments.length > 1 ? type : "success", state);
      } catch (err) {
        console.error("[Mascot/Override] خطأ داخلي — الـ Toast اشتغل بالنظام الحالي:", err);
      }
      return result;
    };
  } else {
    console.warn("[Mascot/Override] window.toast مش معرّفة — الـ Override متوقف والنظام الحالي شغال.");
  }

  /* ── النشر (المالك فقط) ── */
  function buildPublished(draft) {
    var out = { version: VERSION, states: {} }, skipped = 0;
    STATE_IDS.forEach(function (id) {
      var d = draft && draft.states && draft.states[id];
      if (!d) return;
      var o = {};
      if (validKey(d.imageKey)) o.imageKey = d.imageKey;
      if (d.customImage) {
        var ci = normImg(d.customImage);
        if (ci) o.customImage = ci; else skipped++; // صور الجهاز (Base64) مابتتنشرش
      }
      if (SIZES[d.size] && d.size !== "sm") o.size = d.size;
      if (ANIMS[d.animation]) o.animation = d.animation;
      if (typeof d.label === "string" && d.label.trim()) o.label = d.label.trim().slice(0, 60);
      if (Object.keys(o).length) out.states[id] = o;
    });
    return { cfg: out, skipped: skipped };
  }

  function isOwner() { return !!(window.isOwner && window.isOwner()); }

  async function publish(draft) {
    if (!isOwner()) return { ok: false, reason: "owner" };
    if (!window.db) return { ok: false, reason: "db" };
    var b = buildPublished(draft);
    try {
      await setDoc(doc(window.db, COL, DOC), {
        version: VERSION,
        states: b.cfg.states,
        updatedBy: (window.currentUser && window.currentUser.uid) || "",
        updatedAt: serverTimestamp()
      });
      _cfg = hasStates(b.cfg) ? b.cfg : null;
      _loaded = true;
      writeCache();
      return { ok: true, count: Object.keys(b.cfg.states).length, skipped: b.skipped };
    } catch (e) {
      return { ok: false, reason: (e && (e.code || e.message)) || "error" };
    }
  }

  async function unpublish() {
    if (!isOwner()) return { ok: false, reason: "owner" };
    if (!window.db) return { ok: false, reason: "db" };
    try {
      await deleteDoc(doc(window.db, COL, DOC));
      _cfg = null;
      _loaded = true;
      writeCache();
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: (e && (e.code || e.message)) || "error" };
    }
  }

  window.MascotOverride = Object.freeze({
    VERSION: VERSION,
    PATH: COL + "/" + DOC,
    STATE_IDS: STATE_IDS.slice(),
    getConfig: function () { return _cfg ? JSON.parse(JSON.stringify(_cfg)) : null; },
    load: load,
    publish: publish,
    unpublish: unpublish,
    buildPublished: buildPublished,
    normalize: normalize,
    stateFor: stateFor
  });
})();
