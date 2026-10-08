/* ══════════════════════════════════════════
   js/mascot-designer.js — مصمم بريق (المرحلة 1: واجهة + معاينة + بنية الإعدادات)
   - نافذة للمالك فقط، نفس أسلوب نافذة "تصميم الموقع" (js/site-design.js)
   - المعاينة بتستخدم Mascot.show الحقيقي (js/mascot.js) — مفيش Mockup منفصل
   - مفيش أي تعديل على Mascot أو على window.toast أو على أي إشعار في الموقع
   - الحفظ هنا مسودة محلية فقط (localStorage) — مش مربوطة بالنظام الفعلي
   شكل الإعدادات (جاهز للمرحلة 2، مسار Firestore المحجوز: appSettings/mascotDesign):
   { version:1, states:{ <stateId>:{ imageKey:null|string,
       customImage:null|{type:"path"|"data", value:string},
       size:"sm|md|lg|xl", animation:"auto|none|pop|shake|wiggle|spin|run",
       message:string, label:string } } }
══════════════════════════════════════════ */
(function () {
  "use strict";

  if (window.__mascotDesignerLoaded) return;
  window.__mascotDesignerLoaded = true;

  var VERSION = 1;
  var DRAFT_KEY = "_mascotDesignerDraft";
  var MAX_FILE_BYTES = 1024 * 1024;

  var SIZES = { sm: "صغير (100)", md: "متوسط (150)", lg: "كبير (220)", xl: "كبير جدًا (300)" };
  var ANIMS = {
    auto: "تلقائي (حسب الحالة)", none: "بدون حركة", pop: "ظهور",
    shake: "اهتزاز", wiggle: "تمايل", spin: "دوران", run: "جري"
  };
  var KEY_LABELS = {
    happy: "سعيد", sad: "حزين", angry: "غاضب", thinking: "يفكر", surprised: "مندهش", love: "معجب",
    wave: "يحيي", celebrate: "يحتفل", run: "يجري", write: "يكتب", sleep: "نائم", salute: "تحية عسكرية",
    loading: "تحميل", success: "نجاح", error: "خطأ", offline: "بدون اتصال", empty: "فارغ",
    construction: "قيد التطوير", emptyChat: "شات فارغ"
  };
  /* صور مضافة للمشروع (images/mascot/custom/...) — بتظهر في قائمة اختيار الصور. أضف سطر لكل صورة جديدة بعد رفعها على GitHub */
  var CUSTOM_IMAGES = [
    { file: "images/mascot/ui/ai-bariq.webp", label: "بريق الذكاء الاصطناعي" }
  ];
  function customByFile(f) {
    for (var i = 0; i < CUSTOM_IMAGES.length; i++) if (CUSTOM_IMAGES[i].file === f) return CUSTOM_IMAGES[i];
    return null;
  }

  /* حالات التصميم: الافتراضي لكل حالة = نفس اللي النظام الحالي بيستخدمه (MOOD_MAP في mascot-toast-adapter.js)
     وحالات حفظ/إضافة/نسخ/حذف/تحديث حالات تصميم فقط في المحرر حاليًا (الافتراضي: success.webp) */
  var STATES = [
    { id: "success", label: "نجاح",    defaultKey: "success",  tone: "success", msg: "تمت العملية بنجاح" },
    { id: "save",    label: "حفظ",     defaultKey: "success",  tone: "success", msg: "تم الحفظ" },
    { id: "add",     label: "إضافة",   defaultKey: "success",  tone: "success", msg: "تمت الإضافة" },
    { id: "copy",    label: "نسخ",     defaultKey: "success",  tone: "success", msg: "تم النسخ" },
    { id: "delete",  label: "حذف",     defaultKey: "success",  tone: "success", msg: "تم الحذف" },
    { id: "update",  label: "تحديث",   defaultKey: "success",  tone: "success", msg: "تم التحديث" },
    { id: "error",   label: "خطأ",     defaultKey: "error",    tone: "error",   msg: "حدث خطأ" },
    { id: "warn",    label: "تحذير",   defaultKey: "surprised", tone: "warn",   msg: "تنبيه" },
    { id: "info",    label: "معلومات", defaultKey: "happy",    tone: "",        msg: "معلومة" }
  ];

  /* كتالوج الإشعارات الفعلية (js/mascot-notifs.js): كل إشعار بيظهر في الموقع كعنصر مستقل */
  var TYPE_META = {
    success: { key: "success",   tone: "success" },
    warn:    { key: "surprised", tone: "warn" },
    info:    { key: "happy",     tone: "" },
    error:   { key: "error",     tone: "error" }
  };
  var TYPE_ORDER = ["success", "warn", "info", "error"];
  var TYPE_LABELS = { success: "نجاح", error: "خطأ", warn: "تحذير", info: "معلومات" };
  var _notifCache = null;
  function notifList() {
    if (_notifCache) return _notifCache;
    var n = window.MascotNotifs, src = (n && n.items) ? n.items.slice() : [];
    src.sort(function (a, b) {
      var d = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
      return d || a.label.localeCompare(b.label, "ar");
    });
    _notifCache = src.map(function (it) {
      var m = TYPE_META[it.type] || TYPE_META.info;
      return { id: it.id, label: it.label, defaultKey: m.key, tone: m.tone, type: it.type, msg: it.label.replace(/…$/, ""), notif: true };
    });
    return _notifCache;
  }
  function allStates() { return STATES.concat(notifList()); }
  function typeOf(def) { return def.type || (def.tone === "" ? "info" : def.tone); }
  var LIMIT = 8, _q = "", _ft = "all", _expA = false, _expB = false;

  var _draft = null;
  var _sel = "success"; // "success" | ... | "place:<id>"
  var _modal = null;
  var _inst = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c];
    });
  }
  function byId(id) { return document.getElementById(id); }
  function stateById(id) {
    var all = allStates();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return STATES[0];
  }

  function validKey(k) {
    var M = window.Mascot;
    if (!M || typeof k !== "string") return false;
    return M.EMOTIONS.indexOf(k) > -1 || M.ACTIONS.indexOf(k) > -1 || M.UI_STATES.indexOf(k) > -1;
  }

  function placeList() { return (window.MascotOverride && window.MascotOverride.PLACES) || []; }
  function placeById(id) {
    var l = placeList();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  function isPlace() { return _sel.indexOf("place:") === 0; }
  function cur() { return isPlace() ? _draft.places[_sel.slice(6)] : _draft.states[_sel]; }
  function curDef() { return isPlace() ? placeById(_sel.slice(6)) : stateById(_sel); }
  function placeDefaults() { return { imageKey: null, customImage: null }; }
  function fileFor(key) {
    try { var sn = window.Mascot.getRegistrySnapshot("default"); return (sn[key] && sn[key].file) || ""; }
    catch (e) { return ""; }
  }
  function thumbOf(def) { return def.file || (def.defaultKey ? fileFor(def.defaultKey) : ""); }

  function stateDefaults(st) {
    return { imageKey: null, customImage: null, size: "sm", animation: "auto", message: st.msg, label: "" };
  }
  function getDefaults() {
    var cfg = { version: VERSION, states: {}, places: {} };
    allStates().forEach(function (st) { cfg.states[st.id] = stateDefaults(st); });
    placeList().forEach(function (pl) { cfg.places[pl.id] = placeDefaults(); });
    return cfg;
  }

  function normalizeCustom(ci) {
    if (!ci || typeof ci.value !== "string") return null;
    if (ci.type === "path") {
      if (/^[\w\-.\/]+\.(webp|png|jpe?g|gif|svg)$/i.test(ci.value) && ci.value.indexOf("..") < 0 && ci.value.charAt(0) !== "/") {
        return { type: "path", value: ci.value };
      }
      if (/^https:\/\/[^\s"'<>\\]+\.(webp|png|jpe?g|gif|svg)(\?[^\s"'<>\\]*)?$/i.test(ci.value)) {
        return { type: "path", value: ci.value };
      }
      return null;
    }
    if (ci.type === "data" && /^data:image\/(webp|png|jpeg|gif);base64,[A-Za-z0-9+\/=]+$/.test(ci.value)) {
      return { type: "data", value: ci.value };
    }
    return null;
  }

  function normalize(raw) {
    var cfg = getDefaults();
    if (!raw || typeof raw !== "object") return cfg;
    placeList().forEach(function (pl) {
      var r = raw.places && raw.places[pl.id];
      if (!r || typeof r !== "object") return;
      var d = cfg.places[pl.id];
      if (validKey(r.imageKey)) d.imageKey = r.imageKey;
      d.customImage = normalizeCustom(r.customImage);
    });
    allStates().forEach(function (st) {
      var r = raw.states && raw.states[st.id];
      if (!r || typeof r !== "object") return;
      var d = cfg.states[st.id];
      if (validKey(r.imageKey)) d.imageKey = r.imageKey;
      d.customImage = normalizeCustom(r.customImage);
      if (SIZES[r.size]) d.size = r.size;
      if (ANIMS[r.animation]) d.animation = r.animation;
      if (typeof r.message === "string" && r.message.trim()) d.message = r.message.trim().slice(0, 80);
      if (typeof r.label === "string") d.label = r.label.trim().slice(0, 60);
    });
    return cfg;
  }

  function loadDraft() {
    try { return normalize(JSON.parse(localStorage.getItem(DRAFT_KEY) || "null")); }
    catch (e) { return getDefaults(); }
  }
  function saveDraft(cfg) {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(cfg)); return true; }
    catch (e) { return false; }
  }
  /* حفظ تلقائي: أي اختيار تعمله يتحفظ في المسودة فورًا، فيرجع كما هو عند فتح المصمم تاني */
  var _dirty = false;
  function persist() { _dirty = true; if (_draft) saveDraft(_draft); if (typeof refreshChips === "function" && _modal) refreshChips(); }

  /* ── واجهة النافذة ── */
  function imageOptionsHTML() {
    var M = window.Mascot;
    if (!M) return "";
    function group(title, keys) {
      return "<optgroup label=\"" + title + "\">" + keys.map(function (k) {
        return "<option value=\"" + esc(k) + "\">" + esc(KEY_LABELS[k] || k) + " (" + esc(k) + ")</option>";
      }).join("") + "</optgroup>";
    }
    var custom = CUSTOM_IMAGES.length
      ? "<optgroup label=\"صور مضافة\">" + CUSTOM_IMAGES.map(function (c) {
          return "<option value=\"file:" + esc(c.file) + "\">" + esc(c.label) + "</option>";
        }).join("") + "</optgroup>"
      : "";
    return group("انفعالات", M.EMOTIONS) + group("حركات", M.ACTIONS) + group("واجهة", M.UI_STATES) + custom;
  }

  function modalHTML() {
    return "" +
    "<div class=\"md-head\">" +
      "<button class=\"md-x\" id=\"mdClose\" aria-label=\"إغلاق\">×</button>" +
      "<div class=\"md-title\">مصمم بريق</div>" +
    "</div>" +
    "<div class=\"md-body\">" +
      "<div class=\"md-preview md-sticky\">" +
        "<div class=\"md-stage\"><div class=\"toast show success md-toast\" id=\"mdToast\">" +
          "<span class=\"mascot-toast-slot\" id=\"mdSlot\"></span><span id=\"mdMsg\"></span>" +
        "</div>" +
        "<div class=\"md-placebox\" id=\"mdPlaceBox\" style=\"display:none\"><span id=\"mdPlaceSlot\"></span><div class=\"md-placecap\" id=\"mdPlaceCap\"></div></div></div>" +
        "<div class=\"md-cur\" id=\"mdCur\"></div>" +
      "</div>" +
      "<div class=\"md-seg\" role=\"tablist\">" +
        "<button type=\"button\" class=\"md-seg-b on\" data-tab=\"notif\">الإشعارات <i id=\"mdCntAll\"></i></button>" +
        "<button type=\"button\" class=\"md-seg-b\" data-tab=\"places\">أماكن العرض <i id=\"mdCntPl\"></i></button>" +
      "</div>" +
      "<div class=\"md-card\" id=\"mdGrpNotif\">" +
        "<div class=\"md-tools\"><input type=\"search\" class=\"md-in md-search\" id=\"mdSearch\" placeholder=\"ابحث في الإشعارات…\" autocomplete=\"off\">" +
          "<div class=\"md-flts\" id=\"mdFlts\">" +
            [["all", "الكل"], ["success", "نجاح"], ["error", "خطأ"], ["warn", "تحذير"], ["info", "معلومات"]].map(function (f) {
              return "<button type=\"button\" class=\"md-flt" + (f[0] === "all" ? " on" : "") + "\" data-f=\"" + f[0] + "\">" + f[1] + "</button>";
            }).join("") +
          "</div></div>" +
        "<div class=\"md-h\"><span>حالات شريط الإشعارات</span><b class=\"md-pill\" id=\"mdCntA\"></b></div>" +
        "<div class=\"md-nlist\" id=\"mdStates\"></div>" +
        "<div class=\"md-h md-h2\"><span>حالات شريط الإشعارات فارغة</span><b class=\"md-pill md-pill-empty\" id=\"mdCntB\"></b></div>" +
        "<div class=\"md-nlist\" id=\"mdStatesEmpty\"></div>" +
      "</div>" +
      "<div class=\"md-card\" id=\"mdGrpPlaces\" style=\"display:none\">" +
        "<div class=\"md-h\"><span>أماكن العرض</span><em>الصورة فقط — الحجم ثابت</em></div>" +
        "<div class=\"md-states two\" id=\"mdPlaces\">" +
          placeList().map(function (pl) {
            return "<button class=\"md-chip\" data-pl=\"" + pl.id + "\" data-sel=\"place:" + pl.id + "\">" + esc(pl.label) + "</button>";
          }).join("") +
        "</div>" +
      "</div>" +
      "<div class=\"md-card\">" +
        "<div class=\"md-h\"><span>صورة بريق</span></div>" +
        "<div class=\"md-row\"><label for=\"mdPick\">اختيار الصورة</label>" +
          "<select id=\"mdImg\" style=\"display:none\"></select>" +
          "<button type=\"button\" class=\"md-pick\" id=\"mdPick\"><img id=\"mdPickImg\" alt=\"\"><span id=\"mdPickTxt\"></span><i>▾</i></button>" +
          "<div class=\"md-list\" id=\"mdList\" style=\"display:none\"></div></div>" +
        "<details class=\"md-adv\"><summary>صورة مخصصة (خيارات متقدمة)</summary>" +
          "<div class=\"md-row\"><label for=\"mdFile\">صورة من الجهاز (معاينة فقط)</label>" +
            "<input type=\"file\" class=\"md-in\" id=\"mdFile\" accept=\"image/*\"></div>" +
          "<div class=\"md-row\"><label for=\"mdPath\">أو مسار صورة داخل المشروع</label>" +
            "<div class=\"md-line\"><input type=\"text\" class=\"md-in\" id=\"mdPath\" dir=\"ltr\" placeholder=\"images/mascot/actions/bell-ring.webp\">" +
            "<button class=\"md-mini\" id=\"mdPathApply\">تطبيق</button></div></div>" +
          "<div class=\"md-row\"><button class=\"md-mini danger\" id=\"mdCustomClear\" style=\"display:none\">إزالة الصورة المخصصة</button></div>" +
        "</details>" +
      "</div>" +
      "<div class=\"md-card\" id=\"mdShape\">" +
        "<div class=\"md-h\"><span>إعدادات الشكل</span><em>للإشعارات فقط</em></div>" +
        "<div class=\"md-grid2\">" +
          "<div class=\"md-row\"><label for=\"mdSize\">الحجم</label><select class=\"md-in\" id=\"mdSize\">" +
            Object.keys(SIZES).map(function (k) { return "<option value=\"" + k + "\">" + SIZES[k] + "</option>"; }).join("") +
          "</select></div>" +
          "<div class=\"md-row\"><label for=\"mdAnim\">الحركة</label><select class=\"md-in\" id=\"mdAnim\">" +
            Object.keys(ANIMS).map(function (k) { return "<option value=\"" + k + "\">" + ANIMS[k] + "</option>"; }).join("") +
          "</select></div>" +
        "</div>" +
        "<div class=\"md-row\"><label for=\"mdMsgIn\">نص المعاينة</label><input type=\"text\" class=\"md-in\" id=\"mdMsgIn\" maxlength=\"80\"></div>" +
        "<div class=\"md-row\"><label for=\"mdLabel\">وصف الصورة (إتاحة، اختياري)</label><input type=\"text\" class=\"md-in\" id=\"mdLabel\" maxlength=\"60\"></div>" +
      "</div>" +
      "<div class=\"md-card\">" +
      "<div class=\"md-h\"><span>النشر على الموقع</span></div>" +
      "<div class=\"md-pubinfo\" id=\"mdPubInfo\"></div>" +
      "<div class=\"md-line md-publine\">" +
        "<button class=\"md-mini\" id=\"mdPublish\">نشر على الموقع</button>" +
        "<button class=\"md-mini\" id=\"mdLoadPub\">تحميل المنشور</button>" +
        "<button class=\"md-mini danger\" id=\"mdUnpublish\">إلغاء النشر</button>" +
      "</div>" +
      "<div class=\"md-status\" id=\"mdStatus\"></div>" +
      "<details class=\"md-adv\"><summary>ملاحظات</summary><div class=\"md-note\">«حفظ المسودة» بيحفظ على جهازك فقط. «نشر على الموقع» بيطبّق على إشعارات كل المستخدمين الصورة والحجم والحركة ووصف الصورة، وعلى أماكن العرض الصورة فقط (الحجم ثابت)؛ صور الجهاز ونص المعاينة معاينة فقط. اضغط زر النشر مرتين للتأكيد. «إلغاء النشر» بيرجّع النظام الأصلي.</div></details>" +
      "</div>" +
    "</div>" +
    "<div class=\"md-foot\">" +
      "<button class=\"md-b md-save\" id=\"mdSaveDraft\">حفظ المسودة</button>" +
      "<button class=\"md-b\" id=\"mdReplay\">تشغيل</button>" +
      "<button class=\"md-b\" id=\"mdReset\">الافتراضي</button>" +
      "<button class=\"md-b\" id=\"mdCancel\">إغلاق</button>" +
    "</div>";
  }

  function setStatus(t) { var s = byId("mdStatus"); if (s) s.textContent = t || ""; }

  function updatePick() {
    var d = cur(), def = curDef();
    if (!d || !def) return;
    var url = d.customImage ? d.customImage.value : (d.imageKey ? fileFor(d.imageKey) : thumbOf(def));
    var cb = d.customImage && d.customImage.type === "path" ? customByFile(d.customImage.value) : null;
    var txt = cb ? cb.label : d.customImage ? "صورة مخصصة"
      : d.imageKey ? (KEY_LABELS[d.imageKey] || d.imageKey)
      : "الافتراضي" + (def.defaultKey ? " (" + (KEY_LABELS[def.defaultKey] || def.defaultKey) + ")" : (def.kind === "avatar" ? " (الأيقونة الأصلية)" : ""));
    var pi = byId("mdPickImg");
    if (url) { pi.src = url; pi.style.display = ""; } else { pi.removeAttribute("src"); pi.style.display = "none"; }
    byId("mdPickTxt").textContent = txt;
  }

  function markPublished() {
    var MO = window.MascotOverride, cfg = MO && MO.getConfig();
    Array.prototype.forEach.call(document.querySelectorAll("#mascotDesignerModal .md-chip"), function (b) {
      var sel = b.getAttribute("data-sel") || "", on = false;
      if (cfg) on = sel.indexOf("place:") === 0 ? !!(cfg.places && cfg.places[sel.slice(6)]) : !!(cfg.states && cfg.states[sel]);
      b.classList.toggle("pub", on);
    });
    var info = byId("mdPubInfo");
    if (info) {
      var ns = cfg && cfg.states ? Object.keys(cfg.states).length : 0, np = cfg && cfg.places ? Object.keys(cfg.places).length : 0;
      info.textContent = (ns + np) ? "Override منشور حالياً: " + ns + " إشعار + " + np + " مكان (النقطة على الزر = منشور)" : "لا يوجد تصميم منشور — النظام الأصلي شغال";
    }
  }

  function listHTML() {
    var M = window.Mascot, d = cur(), def = curDef();
    function opt(v, label, url) {
      var curV = d.customImage && d.customImage.type === "path" && customByFile(d.customImage.value) ? "file:" + d.customImage.value : (d.imageKey || "");
      return "<button type=\"button\" class=\"md-opt" + (curV === v && !(d.customImage && curV === "") ? " on" : "") + "\" data-v=\"" + esc(v) + "\">" +
        (url ? "<img loading=\"lazy\" decoding=\"async\" alt=\"\" src=\"" + esc(url) + "\">" : "") + "<span>" + esc(label) + "</span></button>";
    }
    function group(title, keys) {
      return "<div class=\"md-gt\">" + title + "</div>" + keys.map(function (k) {
        return opt(k, (KEY_LABELS[k] || k) + " (" + k + ")", fileFor(k));
      }).join("");
    }
    return opt("", "الافتراضي" + (def && def.defaultKey ? " (" + (KEY_LABELS[def.defaultKey] || def.defaultKey) + ")" : (def && def.kind === "avatar" ? " (الأيقونة الأصلية)" : "")), def ? thumbOf(def) : "") +
      group("انفعالات", M.EMOTIONS) + group("حركات", M.ACTIONS) + group("واجهة", M.UI_STATES) +
      (CUSTOM_IMAGES.length ? "<div class=\"md-gt\">صور مضافة</div>" + CUSTOM_IMAGES.map(function (c) { return opt("file:" + c.file, c.label, c.file); }).join("") : "");
  }
  function closeList() { var l = byId("mdList"); if (l) l.style.display = "none"; }
  function toggleList() {
    var l = byId("mdList");
    if (l.style.display !== "none") { closeList(); return; }
    l.innerHTML = listHTML();
    l.style.display = "block";
  }

  /* توزيع حالات الإشعارات: عليها صورة بريق ← "حالات شريط الإشعارات"، بدون صورة ← "حالات شريط الإشعارات فارغة" */
  function stateHasImage(id) {
    var d = _draft && _draft.states && _draft.states[id];
    return !!(d && (d.imageKey || d.customImage));
  }
  function stateChipHTML(st) {
    return "<button class=\"md-chip md-nrow\" data-st=\"" + st.id + "\" data-sel=\"" + st.id + "\">" +
      "<span class=\"md-dot t-" + typeOf(st) + "\"></span><span class=\"md-rl\">" + esc(st.label) + "</span>" +
      (st.notif ? "" : "<em>عامة</em>") + "</button>";
  }
  function passFilter(st) {
    if (_ft !== "all" && typeOf(st) !== _ft) return false;
    return !_q || (st.label + " " + (st.msg || "")).toLowerCase().indexOf(_q) > -1;
  }
  function listHTMLFor(arr, exp, key, emptyMsg) {
    if (!arr.length) return "<div class=\"md-none\">" + emptyMsg + "</div>";
    var shown = exp ? arr : arr.slice(0, LIMIT);
    if (!exp) { /* المحدّد دائمًا ظاهر حتى لو خارج أول القائمة */
      var sel = arr.filter(function (x) { return x.id === _sel; })[0];
      if (sel && shown.indexOf(sel) < 0) shown = shown.concat([sel]);
    }
    return shown.map(stateChipHTML).join("") +
      (arr.length > LIMIT ? "<button type=\"button\" class=\"md-more\" data-more=\"" + key + "\">" + (exp ? "عرض أقل" : "عرض الكل (" + arr.length + ")") + "</button>" : "");
  }
  function refreshChips() {
    var withImg = [], empty = [];
    allStates().filter(passFilter).forEach(function (st) { (stateHasImage(st.id) ? withImg : empty).push(st); });
    var a = byId("mdStates"), b = byId("mdStatesEmpty");
    if (!a || !b) return;
    var ca = byId("mdCntA"), cb2 = byId("mdCntB"), cAll = byId("mdCntAll"), cPl = byId("mdCntPl");
    if (ca) ca.textContent = withImg.length;
    if (cb2) cb2.textContent = empty.length;
    if (cAll) cAll.textContent = allStates().length;
    if (cPl) cPl.textContent = placeList().length;
    var filtered = _q || _ft !== "all";
    a.innerHTML = listHTMLFor(withImg, _expA, "a", filtered ? "لا نتائج مطابقة" : "لا توجد حالة عليها صورة بريق بعد — اختر من الفارغة بالأسفل");
    b.innerHTML = listHTMLFor(empty, _expB, "b", filtered ? "لا نتائج مطابقة" : "كل الحالات عليها صورة بريق");
    Array.prototype.forEach.call(document.querySelectorAll("#mdFlts .md-flt"), function (f) {
      f.classList.toggle("on", f.getAttribute("data-f") === _ft);
    });
    Array.prototype.forEach.call(document.querySelectorAll("#mascotDesignerModal .md-chip"), function (c) {
      c.classList.toggle("on", c.getAttribute("data-sel") === _sel);
    });
    markPublished();
  }

  /* تبويب (الإشعارات | أماكن العرض) — تقليل الزحام: مجموعة واحدة ظاهرة في كل مرة */
  function setTab(name) {
    var n = name === "places" ? "places" : "notif";
    var gn = byId("mdGrpNotif"), gp = byId("mdGrpPlaces");
    if (gn) gn.style.display = n === "notif" ? "" : "none";
    if (gp) gp.style.display = n === "places" ? "" : "none";
    Array.prototype.forEach.call(document.querySelectorAll("#mascotDesignerModal .md-seg-b"), function (b) {
      b.classList.toggle("on", b.getAttribute("data-tab") === n);
    });
  }
  function updateCur() {
    var el = byId("mdCur"), def = curDef();
    if (el && def) el.textContent = "المحدّد الآن: " + (def.label || "");
  }

  function syncControls() {
    updateCur();
    var d = cur(), def = curDef(), place = isPlace();
    if (!d || !def) return;
    closeList();
    byId("mdShape").style.display = place ? "none" : "";
    var sel = byId("mdImg");
    sel.innerHTML = "<option value=\"\">الافتراضي</option>" + imageOptionsHTML();
    sel.value = d.customImage && d.customImage.type === "path" && customByFile(d.customImage.value) ? "file:" + d.customImage.value : (d.imageKey || "");
    if (!place) {
      byId("mdSize").value = d.size;
      byId("mdAnim").value = d.animation;
      byId("mdMsgIn").value = d.message;
      byId("mdLabel").value = d.label;
    }
    byId("mdPath").value = d.customImage && d.customImage.type === "path" ? d.customImage.value : "";
    byId("mdFile").value = "";
    byId("mdCustomClear").style.display = d.customImage ? "" : "none";
    Array.prototype.forEach.call(document.querySelectorAll("#mascotDesignerModal .md-chip"), function (b) {
      b.classList.toggle("on", b.getAttribute("data-sel") === _sel);
    });
    updatePick();
  }

  /* المعاينة: Mascot.show الحقيقي. الصورة المخصصة والحركة بتتطبق على نسخة المعاينة فقط (بدون لمس Registry) */
  function renderPreview() {
    var place = isPlace(), d = cur(), def = curDef();
    var toastEl = byId("mdToast"), box = byId("mdPlaceBox");
    if (!toastEl || !d || !def) return;
    if (_inst) { _inst.destroy(); _inst = null; }
    byId("mdSlot").innerHTML = "";
    byId("mdPlaceSlot").innerHTML = "";
    if (!window.Mascot) { byId("mdMsg").textContent = "بريق غير محمّل"; return; }

    if (place) {
      toastEl.style.display = "none";
      box.style.display = "";
      if (def.kind === "avatar") {
        var aurl = d.customImage ? d.customImage.value : (d.imageKey ? fileFor(d.imageKey) : "");
        byId("mdPlaceSlot").innerHTML = "<span class=\"md-avring\"><span class=\"md-av\">" +
          (aurl ? "<img alt=\"\" src=\"" + esc(aurl) + "\">" : "<i class=\"fa-solid fa-sparkles\"></i>") + "</span></span>";
        byId("mdPlaceCap").textContent = "بتتظبط تلقائياً دائرية على مساحة صورة البروفايل (cover) — في هيدر شات المساعد وقائمة الدردشات";
        return;
      }
      var size = { sm: 1, md: 1, lg: 1, xl: 1 }[def.size] ? def.size : "md";
      _inst = window.Mascot.show({ mood: d.imageKey || def.defaultKey || "happy", size: size, container: byId("mdPlaceSlot"), decorative: true });
      var url = d.customImage ? d.customImage.value : (!d.imageKey && def.file ? def.file : null);
      if (url) {
        var pimg = _inst.el.querySelector(".mascot__img");
        if (pimg) { pimg.loading = "eager"; pimg.src = url; }
      }
      byId("mdPlaceCap").textContent = "الحجم ثابت" + (size === def.size ? " (" + def.size + ")" : "") + " — الصورة فقط بتتغير";
      return;
    }

    box.style.display = "none";
    toastEl.style.display = "";
    var st = def;
    var slot = byId("mdSlot");
    toastEl.className = "toast show md-toast" + (st.tone ? " " + st.tone : "");
    byId("mdMsg").textContent = d.message;

    _inst = window.Mascot.show({
      mood: d.imageKey || st.defaultKey,
      size: d.size,
      container: slot,
      decorative: !d.label,
      label: d.label || undefined
    });

    if (d.customImage) {
      var img = _inst.el.querySelector(".mascot__img");
      if (img) { img.loading = "eager"; img.src = d.customImage.value; }
    }
    if (d.animation !== "auto") {
      var inner = _inst.el.querySelector(".mascot__inner");
      if (inner) {
        inner.className = inner.className.replace(/\bmascot-anim-\w+\b/g, "").replace(/\s+/g, " ").trim();
        if (d.animation !== "none") inner.classList.add("mascot-anim-" + d.animation);
      }
    }
  }

  function setCustom(ci) {
    cur().customImage = ci;
    persist();
    byId("mdCustomClear").style.display = ci ? "" : "none";
    updatePick();
    renderPreview();
  }

  function applyPath() {
    var v = byId("mdPath").value.trim();
    if (!v) { setCustom(null); return; }
    var ci = normalizeCustom({ type: "path", value: v });
    if (!ci) { setStatus("المسار غير صالح — لازم مسار نسبي داخل المشروع أو رابط https بامتداد صورة"); return; }
    setStatus("");
    setCustom(ci);
  }

  function onFile(file) {
    if (!file) return;
    if (!/^image\/(webp|png|jpeg|gif)$/.test(file.type)) { setStatus("نوع الصورة غير مدعوم (webp / png / jpg / gif)"); return; }
    if (file.size > MAX_FILE_BYTES) { setStatus("الصورة أكبر من 1MB"); return; }
    var fr = new FileReader();
    fr.onload = function () {
      var ci = normalizeCustom({ type: "data", value: String(fr.result) });
      if (!ci) { setStatus("تعذّر قراءة الصورة"); return; }
      byId("mdPath").value = "";
      setStatus("");
      setCustom(ci);
    };
    fr.onerror = function () { setStatus("تعذّر قراءة الصورة"); };
    fr.readAsDataURL(file);
  }

  function open() {
    if (!(window.isOwner && window.isOwner())) return;
    var hasDraft = false;
    _dirty = false;
    try { hasDraft = !!localStorage.getItem(DRAFT_KEY); } catch (e) {}
    _draft = loadDraft();
    var pub = window.MascotOverride && window.MascotOverride.getConfig();
    if (!hasDraft && pub) _draft = normalize(pub); // مفيش مسودة محلية: ابدأ من التصميم المنشور مش من الشكل القديم
    if (!_modal) {
      _modal = document.createElement("div");
      _modal.id = "mascotDesignerModal";
      _modal.innerHTML = modalHTML();
      document.body.appendChild(_modal);

      _modal.addEventListener("click", function (e) {
        var flt = e.target.closest && e.target.closest(".md-flt");
        if (flt) { _ft = flt.getAttribute("data-f"); _expA = _expB = false; refreshChips(); return; }
        var more = e.target.closest && e.target.closest(".md-more");
        if (more) { if (more.getAttribute("data-more") === "a") _expA = !_expA; else _expB = !_expB; refreshChips(); return; }
        var seg = e.target.closest && e.target.closest(".md-seg-b");
        if (seg) { setTab(seg.getAttribute("data-tab")); return; }
        var chip = e.target.closest && e.target.closest(".md-chip");
        if (chip) { _sel = chip.getAttribute("data-sel"); setStatus(""); syncControls(); renderPreview(); return; }
        if (e.target.closest && e.target.closest("#mdPick")) { toggleList(); return; }
        var op = e.target.closest && e.target.closest(".md-opt");
        if (op) {
          var sel = byId("mdImg");
          sel.value = op.getAttribute("data-v");
          closeList();
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      _modal.addEventListener("input", function (e) {
        if (isPlace()) return;
        var id = e.target.id, d = _draft.states[_sel];
        if (id === "mdMsgIn") { d.message = e.target.value.trim().slice(0, 80) || stateById(_sel).msg; byId("mdMsg").textContent = d.message; }
        else if (id === "mdLabel") { d.label = e.target.value.trim().slice(0, 60); renderPreview(); }
      });
      _modal.addEventListener("change", function (e) {
        var id = e.target.id, d = cur();
        if (id === "mdImg") {
          var v = e.target.value;
          if (v.indexOf("file:") === 0 && customByFile(v.slice(5))) { d.imageKey = null; d.customImage = { type: "path", value: v.slice(5) }; }
          else { d.imageKey = validKey(v) ? v : null; d.customImage = null; } // الاختيار من القائمة بيلغي أي صورة مخصصة قديمة
          byId("mdPath").value = d.customImage ? d.customImage.value : "";
          byId("mdCustomClear").style.display = d.customImage ? "" : "none";
          updatePick(); renderPreview();
        }
        else if (isPlace() && id !== "mdFile") { return; }
        else if (id === "mdSize") { if (SIZES[e.target.value]) { d.size = e.target.value; renderPreview(); } }
        else if (id === "mdAnim") { if (ANIMS[e.target.value]) { d.animation = e.target.value; renderPreview(); } }
        else if (id === "mdFile") { onFile(e.target.files && e.target.files[0]); }
      });
      /* بعد معالجات التغيير الأصلية (الترتيب مهم): حفظ تلقائي للمسودة */
      _modal.addEventListener("change", function (e) { if (e.target && e.target.id === "mdSearch") return; persist(); });
      _modal.addEventListener("input", function (e) {
        if (e.target && e.target.id === "mdSearch") { _q = String(e.target.value || "").trim().toLowerCase(); _expA = _expB = false; refreshChips(); return; }
        persist();
      });
      byId("mdPathApply").onclick = applyPath;
      byId("mdCustomClear").onclick = function () { byId("mdPath").value = ""; byId("mdFile").value = ""; setCustom(null); };
      byId("mdReplay").onclick = renderPreview;
      byId("mdClose").onclick = close;
      byId("mdCancel").onclick = close;
      byId("mdReset").onclick = function () {
        if (isPlace()) _draft.places[_sel.slice(6)] = placeDefaults();
        else _draft.states[_sel] = stateDefaults(stateById(_sel));
        persist();
        setStatus("");
        syncControls();
        renderPreview();
      };
      var _armed = {};
      function arm(id, ask, run) {
        var b = byId(id);
        if (_armed[id]) { clearTimeout(_armed[id].t); b.textContent = _armed[id].orig; delete _armed[id]; run(); return; }
        _armed[id] = { orig: b.textContent, t: setTimeout(function () { b.textContent = _armed[id].orig; delete _armed[id]; }, 4000) };
        b.textContent = ask;
      }
      byId("mdPublish").onclick = function () {
        var MO = window.MascotOverride;
        if (!MO) { setStatus("طبقة التطبيق غير محمّلة"); return; }
        arm("mdPublish", "اضغط للتأكيد", async function () {
          var btn = byId("mdPublish"); btn.disabled = true;
          var r = await MO.publish(_draft);
          btn.disabled = false;
          if (r && r.ok) persist(); /* اللي اتنشر يفضل محفوظ في المصمم */
          markPublished();
          setStatus(r.ok
            ? "تم النشر وتفعيل الـ Override: " + r.states + " إشعار + " + r.places + " مكان" + (r.skipped ? " — صور الجهاز لم تُنشر (معاينة فقط)" : "")
            : "تعذّر النشر: " + (r.reason === "owner" ? "للمالك فقط" : r.reason));
        });
      };
      byId("mdLoadPub").onclick = function () {
        var MO = window.MascotOverride;
        if (!MO) { setStatus("طبقة التطبيق غير محمّلة"); return; }
        MO.load(true).then(function (cfg) {
          markPublished();
          if (!cfg) { setStatus("لا يوجد تصميم منشور"); return; }
          _draft = normalize(cfg);
          persist();
          syncControls();
          renderPreview();
          setStatus("تم تحميل التصميم المنشور");
        });
      };
      byId("mdUnpublish").onclick = function () {
        var MO = window.MascotOverride;
        if (!MO) { setStatus("طبقة التطبيق غير محمّلة"); return; }
        arm("mdUnpublish", "اضغط للتأكيد", async function () {
          var r = await MO.unpublish();
          markPublished();
          setStatus(r.ok ? "تم إلغاء النشر — بريق رجع للنظام الأصلي" : "تعذّر إلغاء النشر: " + (r.reason === "owner" ? "للمالك فقط" : r.reason));
        });
      };
      byId("mdSaveDraft").onclick = function () {
        setStatus(saveDraft(_draft) ? "تم حفظ المسودة على جهازك (غير مطبّقة على الموقع)" : "تعذّر حفظ المسودة — الصورة المخصصة كبيرة على التخزين المحلي");
      };
    }
    setStatus("");
    _q = ""; _ft = "all"; _expA = _expB = false;
    var _sb = byId("mdSearch"); if (_sb) _sb.value = "";
    setTab(isPlace() ? "places" : "notif");
    refreshChips();
    syncControls();
    markPublished();
    _modal.style.display = "flex";
    renderPreview();
    if (window.MascotOverride) window.MascotOverride.load(false).then(function (cfg) {
      markPublished();
      /* مفيش مسودة ولسه ماغيّرتش حاجة: حمّل التصميم المنشور اللي وصل متأخر بدل الشكل الافتراضي */
      if (!hasDraft && !_dirty && cfg && _modal && _modal.style.display !== "none") {
        _draft = normalize(cfg);
        refreshChips();
        syncControls();
        renderPreview();
      }
    });
  }

  function close() {
    if (_inst) { _inst.destroy(); _inst = null; }
    if (_modal) _modal.style.display = "none";
  }

  /* ── إظهار قسم "مصمم بريق" للمالك فقط (مخفي افتراضيًا لأي حد تاني) — نفس أسلوب site-design.js ── */
  function gateSection() {
    var el = byId("mascotDesignerItem");
    if (!el) return;
    var ok = !!(window.isOwner && window.isOwner());
    el.style.display = ok ? "" : "none";
    if (!ok) close();
  }
  function watchOwnerPage() {
    var pg = byId("page-owner");
    if (!pg) { setTimeout(watchOwnerPage, 500); return; }
    new MutationObserver(gateSection).observe(pg, { attributes: true, attributeFilter: ["class"] });
    gateSection();
  }
  watchOwnerPage();

  window.MascotDesigner = Object.freeze({
    VERSION: VERSION,
    DRAFT_KEY: DRAFT_KEY,
    FIRESTORE_PATH: "appSettings/mascotDesign", // محجوز للمرحلة 2 — لا يُكتب فيه الآن
    STATES: clone(STATES),
    open: open,
    close: close,
    getDefaults: getDefaults,
    normalize: normalize,
    getDraft: loadDraft
  });
  window.openMascotDesigner = open;
  window.closeMascotDesigner = close;
})();
