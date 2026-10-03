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

  /* أماكن عرض بريق خارج الإشعارات: الصورة فقط بتتغير، الحجم والحركة والمكان ثابتين.
     sel بيستهدف عنصر <img> نفسه. الأماكن بتتعرف بالحاوية (slot) اللي كل adapter بيعملها. */
  var PLACES = [
    { id: "dialog",     label: "حوار التأكيد",           defaultKey: "thinking",     size: "md", sel: ".mascot-dialog-slot .mascot__img" },
    { id: "notifPanel", label: "لوحة الإشعارات",         defaultKey: "happy",        size: "md", sel: ".mascot-notification-slot .mascot__img" },
    { id: "empty",      label: "حالة فارغة",             defaultKey: "empty",        size: "xl", sel: ".mascot-empty-state-slot .mascot[data-mood=\"empty\"] .mascot__img" },
    { id: "emptyChat",  label: "شات فارغ",               defaultKey: "emptyChat",    size: "xl", sel: ".mascot-empty-state-slot .mascot[data-mood=\"emptyChat\"] .mascot__img" },
    { id: "underdev",   label: "قيد التطوير / موقوف",    defaultKey: "construction", size: "xl", sel: ".mascot-underdev-slot .mascot__img" },
    { id: "loading",    label: "التحميل",                defaultKey: "thinking",     size: "sm", sel: ".mascot-loading-slot .mascot__img" },
    { id: "grades",     label: "الدرجات",                defaultKey: "thinking",     size: "sm", sel: ".mascot-grades-slot .mascot__img" },
    { id: "login",      label: "تسجيل الدخول",           defaultKey: "happy",        size: "sm", sel: ".mascot-login-slot .mascot__img" },
    { id: "settings",   label: "الإعدادات",              defaultKey: "happy",        size: "sm", sel: ".mascot-settings-slot .mascot__img" },
    { id: "splash",     label: "شاشة البداية",           defaultKey: "wave",         size: "lg", sel: ".mascot-splash-slot .mascot__img" },
    { id: "military",   label: "الخدمة العسكرية",        defaultKey: "salute",       size: "md", sel: ".mascot-mil-title-slot .mascot__img" },
    { id: "quickNotif", label: "إخطار سريع",             defaultKey: null,           size: "ثابت", file: "images/mascot/actions/bell-ring.webp", sel: "#qnMascotSlot img" },
    { id: "apkMain",    label: "نافذة تحميل التطبيق",    defaultKey: "run",          size: "ثابت", sel: ".apk-overlay img.apk-img" },
    { id: "apkMini",    label: "تذكير التطبيق (مصغر)",   defaultKey: "sad",          size: "ثابت", sel: "img.apk-mini" },
    { id: "apkDone",    label: "اكتمال تحميل التطبيق",   defaultKey: "love",         size: "ثابت", sel: ".apk-done img" },
    { id: "aiAssistant",label: "المساعد الذكي",          defaultKey: "sleep",        size: "ثابت", sel: "img:not(.mascot__img)[src$=\"actions/sleep.webp\"]" }
  ];
  var PLACE_BY_ID = {};
  PLACES.forEach(function (pl) { PLACE_BY_ID[pl.id] = pl; });

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
    var out = { version: VERSION, states: {}, places: {} };
    if (!raw || typeof raw !== "object") return out;
    PLACES.forEach(function (pl) {
      var r = raw.places && typeof raw.places === "object" ? raw.places[pl.id] : null;
      if (!r || typeof r !== "object") return;
      var o = {};
      if (validKey(r.imageKey)) o.imageKey = r.imageKey;
      var ci = normImg(r.customImage);
      if (ci) o.customImage = ci;
      if (Object.keys(o).length) out.places[pl.id] = o;
    });
    if (!raw.states || typeof raw.states !== "object") return out;
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

  function hasStates(c) {
    return !!(c && ((c.states && Object.keys(c.states).length) || (c.places && Object.keys(c.places).length)));
  }

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
  var _inflight = null;
  function load(force) {
    if (_loading && _inflight) return _inflight; // قراءة شغالة بالفعل: استنّى نفس النتيجة بدل null
    var pr = new Promise(function (resolve) {
      if (!force && (_loaded || _attempts >= MAX_ATTEMPTS)) { resolve(_cfg); return; }
      if (!window.db || !window.currentUser) { resolve(_cfg); return; } // لا قراءة قبل تسجيل الدخول
      _loading = true;
      _attempts++;
      getDoc(doc(window.db, COL, DOC)).then(function (snap) {
        var n = snap.exists() ? normalize(snap.data()) : null;
        _cfg = hasStates(n) ? n : null;
        _loaded = true;
        writeCache();
        syncPlaces();
      }).catch(function () {
        /* فشل/أوفلاين/Rules: نكمل بالكاش أو بالنظام الحالي */
      }).then(function () {
        _loading = false;
        _inflight = null;
        resolve(_cfg);
      });
    });
    if (_loading) _inflight = pr;
    return pr;
  }

  var _cacheT = readCache();
  if (_cacheT && (Date.now() - _cacheT) < TTL_MS) _loaded = true; // كاش طازج = مفيش قراءة شبكة خالص
  syncPlaces();

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
  /* ── أماكن العرض: تغيير src الصورة فقط (الحجم/الحركة/الحاوية من الـ adapter زي ما هي) ── */
  var _obs = null;
  function placeSrc(ov) {
    if (ov.customImage) return ov.customImage.value;
    if (ov.imageKey) return defaultFile(ov.imageKey);
    return null;
  }
  function applyPlaceImg(img, id, ov) {
    var want = placeSrc(ov);
    if (!want || img.tagName !== "IMG") return;
    if (img.getAttribute("data-mdp") === id && img.getAttribute("src") === want) return;
    if (!img.hasAttribute("data-mdp-orig")) img.setAttribute("data-mdp-orig", img.getAttribute("src") || "");
    img.setAttribute("data-mdp", id);
    var onErr = function () {
      img.removeEventListener("error", onErr);
      var o = img.getAttribute("data-mdp-orig");
      if (o) img.src = o; // fallback للصورة الأصلية
    };
    img.addEventListener("error", onErr);
    img.src = want;
  }
  function applyPlacesIn(root) {
    var pl = _cfg && _cfg.places;
    if (!pl) return;
    Object.keys(pl).forEach(function (id) {
      var def = PLACE_BY_ID[id];
      if (!def) return;
      try {
        if (root.nodeType === 1 && root.matches && root.matches(def.sel)) applyPlaceImg(root, id, pl[id]);
        var list = root.querySelectorAll ? root.querySelectorAll(def.sel) : [];
        for (var i = 0; i < list.length; i++) applyPlaceImg(list[i], id, pl[id]);
      } catch (e) {}
    });
  }
  function restorePlaces() {
    var list = document.querySelectorAll("img[data-mdp-orig]");
    for (var i = 0; i < list.length; i++) {
      var o = list[i].getAttribute("data-mdp-orig");
      if (o) list[i].src = o;
      list[i].removeAttribute("data-mdp");
      list[i].removeAttribute("data-mdp-orig");
    }
  }
  function syncPlaces() {
    var has = !!(_cfg && _cfg.places && Object.keys(_cfg.places).length);
    if (!has) {
      if (_obs) { _obs.disconnect(); _obs = null; } // مفيش Override أماكن = صفر تكلفة
      restorePlaces();
      return;
    }
    if (!document.body) return;
    if (!_obs) {
      _obs = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var added = muts[i].addedNodes;
          for (var j = 0; j < added.length; j++) if (added[j].nodeType === 1) applyPlacesIn(added[j]);
        }
      });
      _obs.observe(document.body, { childList: true, subtree: true });
    }
    applyPlacesIn(document);
    var stale = document.querySelectorAll("img[data-mdp]");
    for (var k = 0; k < stale.length; k++) {
      var pid = stale[k].getAttribute("data-mdp");
      if (!_cfg.places[pid]) { // مكان اتشال منه الـ Override
        var o = stale[k].getAttribute("data-mdp-orig");
        if (o) stale[k].src = o;
        stale[k].removeAttribute("data-mdp");
        stale[k].removeAttribute("data-mdp-orig");
      }
    }
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
    var out = { version: VERSION, states: {}, places: {} }, skipped = 0;
    PLACES.forEach(function (pl) {
      var d = draft && draft.places && draft.places[pl.id];
      if (!d) return;
      var o = {};
      if (validKey(d.imageKey)) o.imageKey = d.imageKey;
      if (d.customImage) {
        var ci = normImg(d.customImage);
        if (ci) o.customImage = ci; else skipped++;
      }
      if (Object.keys(o).length) out.places[pl.id] = o;
    });
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
        places: b.cfg.places,
        updatedBy: (window.currentUser && window.currentUser.uid) || "",
        updatedAt: serverTimestamp()
      });
      _cfg = hasStates(b.cfg) ? b.cfg : null;
      _loaded = true;
      writeCache();
      syncPlaces();
      return { ok: true, count: Object.keys(b.cfg.states).length + Object.keys(b.cfg.places).length, states: Object.keys(b.cfg.states).length, places: Object.keys(b.cfg.places).length, skipped: b.skipped };
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
      syncPlaces();
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: (e && (e.code || e.message)) || "error" };
    }
  }

  window.MascotOverride = Object.freeze({
    VERSION: VERSION,
    PATH: COL + "/" + DOC,
    STATE_IDS: STATE_IDS.slice(),
    PLACES: PLACES.map(function (p) { return { id: p.id, label: p.label, defaultKey: p.defaultKey, size: p.size, file: p.file || null }; }),
    getConfig: function () { return _cfg ? JSON.parse(JSON.stringify(_cfg)) : null; },
    load: load,
    publish: publish,
    unpublish: unpublish,
    buildPublished: buildPublished,
    normalize: normalize,
    stateFor: stateFor
  });
})();
