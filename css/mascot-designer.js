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

  var _draft = null;
  var _sel = "success";
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
    for (var i = 0; i < STATES.length; i++) if (STATES[i].id === id) return STATES[i];
    return STATES[0];
  }

  function validKey(k) {
    var M = window.Mascot;
    if (!M || typeof k !== "string") return false;
    return M.EMOTIONS.indexOf(k) > -1 || M.ACTIONS.indexOf(k) > -1 || M.UI_STATES.indexOf(k) > -1;
  }

  function stateDefaults(st) {
    return { imageKey: null, customImage: null, size: "sm", animation: "auto", message: st.msg, label: "" };
  }
  function getDefaults() {
    var cfg = { version: VERSION, states: {} };
    STATES.forEach(function (st) { cfg.states[st.id] = stateDefaults(st); });
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
    if (!raw || typeof raw !== "object" || !raw.states) return cfg;
    STATES.forEach(function (st) {
      var r = raw.states[st.id];
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

  /* ── واجهة النافذة ── */
  function imageOptionsHTML() {
    var M = window.Mascot;
    if (!M) return "";
    function group(title, keys) {
      return "<optgroup label=\"" + title + "\">" + keys.map(function (k) {
        return "<option value=\"" + esc(k) + "\">" + esc(KEY_LABELS[k] || k) + " (" + esc(k) + ")</option>";
      }).join("") + "</optgroup>";
    }
    return group("انفعالات", M.EMOTIONS) + group("حركات", M.ACTIONS) + group("واجهة", M.UI_STATES);
  }

  function modalHTML() {
    return "" +
    "<div class=\"md-head\">" +
      "<button class=\"md-x\" id=\"mdClose\" aria-label=\"إغلاق\">×</button>" +
      "<div class=\"md-title\">مصمم بريق</div>" +
    "</div>" +
    "<div class=\"md-body\">" +
      "<div class=\"md-preview\">" +
        "<div class=\"md-stage\"><div class=\"toast show success md-toast\" id=\"mdToast\">" +
          "<span class=\"mascot-toast-slot\" id=\"mdSlot\"></span><span id=\"mdMsg\"></span>" +
        "</div></div>" +
        "<div class=\"md-lbl\">جرّب الحالات</div>" +
        "<div class=\"md-states\" id=\"mdStates\">" +
          STATES.map(function (st) {
            return "<button class=\"md-chip\" data-st=\"" + st.id + "\">" + st.label + "</button>";
          }).join("") +
        "</div>" +
      "</div>" +
      "<div class=\"md-sec\">صورة بريق</div>" +
      "<div class=\"md-row\"><label for=\"mdImg\">اختيار الصورة</label>" +
        "<select class=\"md-in\" id=\"mdImg\"></select></div>" +
      "<div class=\"md-row\"><label for=\"mdFile\">صورة مخصصة (معاينة فقط)</label>" +
        "<input type=\"file\" class=\"md-in\" id=\"mdFile\" accept=\"image/*\"></div>" +
      "<div class=\"md-row\"><label for=\"mdPath\">أو مسار صورة داخل المشروع</label>" +
        "<div class=\"md-line\"><input type=\"text\" class=\"md-in\" id=\"mdPath\" dir=\"ltr\" placeholder=\"images/mascot/actions/bell-ring.webp\">" +
        "<button class=\"md-mini\" id=\"mdPathApply\">تطبيق</button></div></div>" +
      "<div class=\"md-row\"><button class=\"md-mini danger\" id=\"mdCustomClear\" style=\"display:none\">إزالة الصورة المخصصة</button></div>" +
      "<div class=\"md-sec\">إعدادات الشكل</div>" +
      "<div class=\"md-row\"><label for=\"mdSize\">الحجم</label><select class=\"md-in\" id=\"mdSize\">" +
        Object.keys(SIZES).map(function (k) { return "<option value=\"" + k + "\">" + SIZES[k] + "</option>"; }).join("") +
      "</select></div>" +
      "<div class=\"md-row\"><label for=\"mdAnim\">الحركة</label><select class=\"md-in\" id=\"mdAnim\">" +
        Object.keys(ANIMS).map(function (k) { return "<option value=\"" + k + "\">" + ANIMS[k] + "</option>"; }).join("") +
      "</select></div>" +
      "<div class=\"md-row\"><label for=\"mdMsgIn\">نص المعاينة</label><input type=\"text\" class=\"md-in\" id=\"mdMsgIn\" maxlength=\"80\"></div>" +
      "<div class=\"md-row\"><label for=\"mdLabel\">وصف الصورة (إتاحة، اختياري)</label><input type=\"text\" class=\"md-in\" id=\"mdLabel\" maxlength=\"60\"></div>" +
      "<div class=\"md-sec\">النشر على الموقع</div>" +
      "<div class=\"md-line\">" +
        "<button class=\"md-mini\" id=\"mdPublish\">نشر على الموقع</button>" +
        "<button class=\"md-mini\" id=\"mdLoadPub\">تحميل المنشور</button>" +
        "<button class=\"md-mini danger\" id=\"mdUnpublish\">إلغاء النشر</button>" +
      "</div>" +
      "<div class=\"md-status\" id=\"mdStatus\"></div>" +
      "<div class=\"md-note\">«حفظ المسودة» بيحفظ على جهازك فقط. «نشر على الموقع» بيطبّق الصور (مسار/رابط) والحجم والحركة ووصف الصورة على إشعارات كل المستخدمين؛ صور الجهاز ونص المعاينة معاينة فقط. «إلغاء النشر» بيرجّع النظام الأصلي.</div>" +
    "</div>" +
    "<div class=\"md-foot\">" +
      "<button class=\"md-b md-save\" id=\"mdSaveDraft\">حفظ المسودة</button>" +
      "<button class=\"md-b\" id=\"mdReplay\">تشغيل</button>" +
      "<button class=\"md-b\" id=\"mdReset\">الافتراضي</button>" +
      "<button class=\"md-b\" id=\"mdCancel\">إغلاق</button>" +
    "</div>";
  }

  function setStatus(t) { var s = byId("mdStatus"); if (s) s.textContent = t || ""; }

  function syncControls() {
    var st = stateById(_sel), d = _draft.states[_sel];
    var sel = byId("mdImg");
    var defLabel = KEY_LABELS[st.defaultKey] || st.defaultKey;
    sel.innerHTML = "<option value=\"\">الافتراضي للحالة (" + esc(defLabel) + ")</option>" + imageOptionsHTML();
    sel.value = d.imageKey || "";
    byId("mdSize").value = d.size;
    byId("mdAnim").value = d.animation;
    byId("mdMsgIn").value = d.message;
    byId("mdLabel").value = d.label;
    byId("mdPath").value = d.customImage && d.customImage.type === "path" ? d.customImage.value : "";
    byId("mdFile").value = "";
    byId("mdCustomClear").style.display = d.customImage ? "" : "none";
    Array.prototype.forEach.call(document.querySelectorAll("#mdStates .md-chip"), function (b) {
      b.classList.toggle("on", b.getAttribute("data-st") === _sel);
    });
  }

  /* المعاينة: Mascot.show الحقيقي. الصورة المخصصة والحركة بتتطبق على نسخة المعاينة فقط (بدون لمس Registry) */
  function renderPreview() {
    var st = stateById(_sel), d = _draft.states[_sel];
    var slot = byId("mdSlot"), toastEl = byId("mdToast");
    if (!slot || !toastEl) return;
    if (_inst) { _inst.destroy(); _inst = null; }
    slot.innerHTML = "";
    toastEl.className = "toast show md-toast" + (st.tone ? " " + st.tone : "");
    byId("mdMsg").textContent = d.message;
    if (!window.Mascot) { byId("mdMsg").textContent = "بريق غير محمّل"; return; }

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
    _draft.states[_sel].customImage = ci;
    byId("mdCustomClear").style.display = ci ? "" : "none";
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
    _draft = loadDraft();
    if (!_modal) {
      _modal = document.createElement("div");
      _modal.id = "mascotDesignerModal";
      _modal.innerHTML = modalHTML();
      document.body.appendChild(_modal);

      _modal.addEventListener("click", function (e) {
        var chip = e.target.closest && e.target.closest(".md-chip");
        if (chip) { _sel = chip.getAttribute("data-st"); setStatus(""); syncControls(); renderPreview(); }
      });
      _modal.addEventListener("input", function (e) {
        var id = e.target.id, d = _draft.states[_sel];
        if (id === "mdMsgIn") { d.message = e.target.value.trim().slice(0, 80) || stateById(_sel).msg; byId("mdMsg").textContent = d.message; }
        else if (id === "mdLabel") { d.label = e.target.value.trim().slice(0, 60); renderPreview(); }
      });
      _modal.addEventListener("change", function (e) {
        var id = e.target.id, d = _draft.states[_sel];
        if (id === "mdImg") { d.imageKey = validKey(e.target.value) ? e.target.value : null; renderPreview(); }
        else if (id === "mdSize") { if (SIZES[e.target.value]) { d.size = e.target.value; renderPreview(); } }
        else if (id === "mdAnim") { if (ANIMS[e.target.value]) { d.animation = e.target.value; renderPreview(); } }
        else if (id === "mdFile") { onFile(e.target.files && e.target.files[0]); }
      });
      byId("mdPathApply").onclick = applyPath;
      byId("mdCustomClear").onclick = function () { byId("mdPath").value = ""; byId("mdFile").value = ""; setCustom(null); };
      byId("mdReplay").onclick = renderPreview;
      byId("mdClose").onclick = close;
      byId("mdCancel").onclick = close;
      byId("mdReset").onclick = function () {
        _draft.states[_sel] = stateDefaults(stateById(_sel));
        setStatus("");
        syncControls();
        renderPreview();
      };
      byId("mdPublish").onclick = async function () {
        var MO = window.MascotOverride;
        if (!MO) { setStatus("طبقة التطبيق غير محمّلة"); return; }
        var ok = await window.confirm("نشر تصميم بريق", "هيتم تطبيق التصميم على إشعارات الموقع لكل المستخدمين. متأكد؟");
        if (!ok) return;
        var btn = byId("mdPublish"); btn.disabled = true;
        var r = await MO.publish(_draft);
        btn.disabled = false;
        setStatus(r.ok
          ? "تم النشر (" + r.count + " حالة)" + (r.skipped ? " — صور الجهاز لم تُنشر (معاينة فقط)" : "")
          : "تعذّر النشر: " + (r.reason === "owner" ? "للمالك فقط" : r.reason));
      };
      byId("mdLoadPub").onclick = function () {
        var MO = window.MascotOverride;
        if (!MO) { setStatus("طبقة التطبيق غير محمّلة"); return; }
        MO.load(true).then(function (cfg) {
          if (!cfg) { setStatus("لا يوجد تصميم منشور"); return; }
          _draft = normalize(cfg);
          syncControls();
          renderPreview();
          setStatus("تم تحميل التصميم المنشور");
        });
      };
      byId("mdUnpublish").onclick = async function () {
        var MO = window.MascotOverride;
        if (!MO) { setStatus("طبقة التطبيق غير محمّلة"); return; }
        var ok = await window.confirm("إلغاء نشر تصميم بريق", "هيرجع بريق للنظام الأصلي لكل المستخدمين. متأكد؟");
        if (!ok) return;
        var r = await MO.unpublish();
        setStatus(r.ok ? "تم إلغاء النشر — بريق رجع للنظام الأصلي" : "تعذّر إلغاء النشر: " + (r.reason === "owner" ? "للمالك فقط" : r.reason));
      };
      byId("mdSaveDraft").onclick = function () {
        setStatus(saveDraft(_draft) ? "تم حفظ المسودة على جهازك (غير مطبّقة على الموقع)" : "تعذّر حفظ المسودة — الصورة المخصصة كبيرة على التخزين المحلي");
      };
    }
    setStatus("");
    syncControls();
    _modal.style.display = "flex";
    renderPreview();
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
