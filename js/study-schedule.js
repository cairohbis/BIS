/**
 * ══════════════════════════════════════════
 *   الجدول الدراسي — جدول واحد موحّد لكل المستخدمين
 *   المالك/الأدمن: إضافة/تعديل/حذف/تعطيل المحاضرات
 *   المستخدم العادي: قراءة فقط — يشوف الأيام اللي فيها محاضرات بس
 *
 *   ▸ المصدر الوحيد: studySchedule/{lectureId}
 *       { subject, day, startTime, endTime, reminderMinutes, enabled,
 *         createdAt, updatedAt, updatedBy }
 *     day: sat|sun|mon|tue|wed|thu|fri
 *     startTime/endTime: "HH:MM" بصيغة 24 ساعة (للفرز والحساب)
 *     reminderMinutes: قيمة تنبيه المحاضرة (0 = بدون تنبيه)
 *       — ملحوظة: التنبيه الفعلي لليوم (إشعار واحد فقط) بيتحسب من
 *         reminderMinutes الخاص بأول محاضرة مفعّلة في اليوم. حساب
 *         الوقت الفعلي وإرسال الإشعار تلقائيًا (حتى لو الموقع مقفول)
 *         محتاج Cloud Function مجدولة من السيرفر — مؤجّل حاليًا باتفاق
 *         مسبق، ومش موجود في هذا الملف. الملف ده بيبني الجدول والإدارة فقط.
 *     لا يوجد batchId ولا userId — الجدول موحّد للجميع.
 *
 *   ▸ القواعد المطلوبة في Firestore Rules (إضافة فقط):
 *       match /studySchedule/{lectureId} {
 *         allow read: if isSignedIn();
 *         allow create, update, delete: if isAdmin();
 *       }
 * ══════════════════════════════════════════
 */

(function () {
  "use strict";
  if (window.__studyScheduleModuleLoaded) return;
  window.__studyScheduleModuleLoaded = true;

  const _FB = "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  const COL = "studySchedule";

  const DAYS = [
    { key: "sat", label: "السبت" },
    { key: "sun", label: "الأحد" },
    { key: "mon", label: "الاثنين" },
    { key: "tue", label: "الثلاثاء" },
    { key: "wed", label: "الأربعاء" },
    { key: "thu", label: "الخميس" },
    { key: "fri", label: "الجمعة" },
  ];
  const DAY_LABEL = Object.fromEntries(DAYS.map((d) => [d.key, d.label]));

  const REMINDER_OPTIONS = [
    { value: 0, label: "بدون تنبيه" },
    { value: 15, label: "قبل 15 دقيقة" },
    { value: 30, label: "قبل 30 دقيقة" },
    { value: 60, label: "قبل ساعة" },
    { value: 120, label: "قبل ساعتين" },
    { value: 180, label: "قبل 3 ساعات" },
    { value: 240, label: "قبل 4 ساعات" },
    { value: "custom", label: "وقت مخصص" },
  ];

  async function _fs() {
    if (!window.db) throw new Error("Firebase غير متاح");
    return { db: window.db, ...(await import(_FB)) };
  }
  function _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function _isAdmin() { return !!(window.isAdmin && window.isAdmin()); }
  function _num(v) { const n = Number(v); return isFinite(n) ? n : 0; }

  function _fmtTime(hhmm) {
    if (!hhmm || hhmm.indexOf(":") === -1) return "";
    const [hStr, mStr] = hhmm.split(":");
    let h = _num(hStr), m = _num(mStr);
    const period = h >= 12 ? "م" : "ص";
    let h12 = h % 12; if (h12 === 0) h12 = 12;
    return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period === "ص" ? "صباحًا" : "مساءً"}`;
  }
  function _reminderLabel(mins) {
    mins = _num(mins);
    if (!mins) return "بدون تنبيه";
    const known = REMINDER_OPTIONS.find((o) => o.value === mins);
    if (known) return known.label;
    const h = Math.floor(mins / 60), m = mins % 60;
    if (h && m) return `قبل ${h} ساعة و${m} دقيقة`;
    if (h) return `قبل ${h} ساعة`;
    return `قبل ${m} دقيقة`;
  }

  let _view = "home";      // home | form
  let _lectures = [];      // كل المحاضرات (زي ما هي في Firestore)
  let _draft = null;       // نموذج الإضافة/التعديل
  let _loaded = false;

  function _root() { return document.getElementById("study-schedule-app-root"); }
  function _body() { return document.getElementById("ssBody"); }

  function _buildShell() {
    const root = _root();
    if (!root) return;
    root.innerHTML = `
      <div class="ss-overlay" onclick="window.StudyScheduleModule._back()"></div>
      <div class="ss-sheet">
        <div class="ss-header">
          <button class="ss-back-btn" onclick="window.StudyScheduleModule._back()"><i class="fa-solid fa-arrow-right"></i> رجوع</button>
          <div class="ss-title"><i class="fa-solid fa-calendar-week"></i> <span id="ssTitleText">الجدول الدراسي</span></div>
          ${_isAdmin() ? `<button class="ss-add-btn" onclick="window.StudyScheduleModule._newLecture()"><i class="fa-solid fa-plus"></i></button>` : ""}
        </div>
        <div class="ss-body" id="ssBody"><div class="ss-loading"><div class="ss-spin"></div></div></div>
      </div>`;
  }
  function _setTitle(t) { const el = document.getElementById("ssTitleText"); if (el) el.textContent = t; }
  function _syncAddBtn() {
    const wrap = document.querySelector(".ss-header");
    if (!wrap) return;
    let btn = wrap.querySelector(".ss-add-btn");
    if (_isAdmin() && _view === "home") {
      if (!btn) {
        btn = document.createElement("button");
        btn.className = "ss-add-btn";
        btn.innerHTML = '<i class="fa-solid fa-plus"></i>';
        btn.onclick = () => window.StudyScheduleModule._newLecture();
        wrap.appendChild(btn);
      }
    } else if (btn) btn.remove();
  }

  /* ─────────────────────────────────────────
     تحميل البيانات
  ───────────────────────────────────────── */
  async function _load() {
    const body = _body();
    if (body) body.innerHTML = `<div class="ss-loading"><div class="ss-spin"></div></div>`;
    try {
      const { db, collection, getDocs } = await _fs();
      const snap = await getDocs(collection(db, COL));
      _lectures = [];
      snap.forEach((d) => _lectures.push({ id: d.id, ...d.data() }));
      _loaded = true;
      _renderHome();
    } catch (e) {
      if (body) body.innerHTML = `<div class="ss-empty"><div class="ss-empty-title">تعذّر تحميل الجدول الدراسي</div></div>`;
    }
  }

  function _groupByDay(list) {
    const map = {};
    DAYS.forEach((d) => (map[d.key] = []));
    list.forEach((l) => { if (map[l.day]) map[l.day].push(l); });
    DAYS.forEach((d) => map[d.key].sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")));
    return DAYS.filter((d) => map[d.key].length).map((d) => ({ key: d.key, label: d.label, lectures: map[d.key] }));
  }

  /* ─────────────────────────────────────────
     الرئيسية: عرض الجدول (للجميع) + أدوات الإدارة (للأدمن فقط)
  ───────────────────────────────────────── */
  function _renderHome() {
    _view = "home"; _draft = null;
    _setTitle("الجدول الدراسي");
    _syncAddBtn();
    const body = _body();
    if (!body) return;
    const admin = _isAdmin();
    // المستخدم العادي يشوف المحاضرات المفعّلة فقط — الأدمن يشوف الكل (مع حالة كل محاضرة)
    const visible = admin ? _lectures : _lectures.filter((l) => l.enabled !== false);
    const grouped = _groupByDay(visible);

    if (!grouped.length) {
      body.innerHTML = `
        <div class="ss-empty">
          <div class="ss-empty-icon"><i class="fa-solid fa-calendar-xmark"></i></div>
          <div class="ss-empty-title">${admin ? "لسه مفيش محاضرات مضافة" : "لا يوجد جدول دراسي متاح حاليًا"}</div>
          ${admin ? `<button class="ss-btn-primary" onclick="window.StudyScheduleModule._newLecture()"><i class="fa-solid fa-plus"></i> إضافة محاضرة</button>` : ""}
        </div>`;
      return;
    }

    body.innerHTML = `
      <div class="ss-days">
        ${grouped.map((g) => `
          <div class="ss-day-block">
            <div class="ss-day-title">${_esc(g.label)}</div>
            <div class="ss-lect-list">
              ${g.lectures.map((l) => _renderLectureRow(l, admin)).join("")}
            </div>
          </div>`).join("")}
      </div>`;
  }

  function _renderLectureRow(l, admin) {
    const paused = l.enabled === false;
    return `
      <div class="ss-lect-row ${paused ? "ss-paused" : ""}">
        <div class="ss-lect-time">${_esc(_fmtTime(l.startTime))}${l.endTime ? ` – ${_esc(_fmtTime(l.endTime))}` : ""}</div>
        <div class="ss-lect-main">
          <div class="ss-lect-subject">${_esc(l.subject)}</div>
          ${admin ? `<div class="ss-lect-reminder"><i class="fa-solid fa-bell"></i> تنبيه اليوم: ${_esc(_reminderLabel(l.reminderMinutes))}${paused ? " · متوقفة" : ""}</div>` : ""}
        </div>
        ${admin ? `
          <div class="ss-lect-actions">
            <button class="ss-mini-btn" title="تعديل" onclick="window.StudyScheduleModule._editLecture('${l.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="ss-mini-btn" title="${paused ? "تفعيل" : "إيقاف"}" onclick="window.StudyScheduleModule._toggle('${l.id}')"><i class="fa-solid ${paused ? "fa-play" : "fa-pause"}"></i></button>
            <button class="ss-mini-btn ss-danger" title="حذف" onclick="window.StudyScheduleModule._delete('${l.id}')"><i class="fa-solid fa-trash"></i></button>
          </div>` : ""}
      </div>`;
  }

  /* ─────────────────────────────────────────
     نموذج الإضافة / التعديل (أدمن/مالك فقط)
  ───────────────────────────────────────── */
  window.StudyScheduleModule = window.StudyScheduleModule || {};

  window.StudyScheduleModule._newLecture = function () {
    if (!_isAdmin()) return;
    _draft = { id: null, subject: "", day: "sat", startTime: "", endTime: "", reminderMinutes: 0, reminderCustomH: "", reminderCustomM: "", enabled: true };
    _view = "form";
    _setTitle("إضافة محاضرة");
    _syncAddBtn();
    _renderForm();
  };

  window.StudyScheduleModule._editLecture = function (id) {
    if (!_isAdmin()) return;
    const l = _lectures.find((x) => x.id === id);
    if (!l) return;
    const known = REMINDER_OPTIONS.some((o) => o.value === _num(l.reminderMinutes));
    _draft = {
      id: l.id, subject: l.subject || "", day: l.day || "sat",
      startTime: l.startTime || "", endTime: l.endTime || "",
      reminderMinutes: known ? _num(l.reminderMinutes) : "custom",
      reminderCustomH: known ? "" : String(Math.floor(_num(l.reminderMinutes) / 60) || ""),
      reminderCustomM: known ? "" : String(_num(l.reminderMinutes) % 60 || ""),
      enabled: l.enabled !== false,
    };
    _view = "form";
    _setTitle("تعديل محاضرة");
    _syncAddBtn();
    _renderForm();
  };

  function _renderForm() {
    const body = _body();
    if (!body || !_draft) return;
    const isCustom = _draft.reminderMinutes === "custom";
    body.innerHTML = `
      <div class="ss-form">
        <label class="ss-label">اسم المادة</label>
        <input class="ss-select" id="ssFSubject" type="text" placeholder="مثال: برمجة" value="${_esc(_draft.subject)}"
          oninput="window.StudyScheduleModule._setField('subject', this.value)">

        <label class="ss-label">اليوم</label>
        <select class="ss-select" id="ssFDay" onchange="window.StudyScheduleModule._setField('day', this.value)">
          ${DAYS.map((d) => `<option value="${d.key}" ${_draft.day === d.key ? "selected" : ""}>${d.label}</option>`).join("")}
        </select>

        <div class="ss-row2">
          <div>
            <label class="ss-label">وقت البداية</label>
            <input class="ss-select" id="ssFStart" type="time" value="${_esc(_draft.startTime)}"
              onchange="window.StudyScheduleModule._setField('startTime', this.value)">
          </div>
          <div>
            <label class="ss-label">وقت النهاية (اختياري)</label>
            <input class="ss-select" id="ssFEnd" type="time" value="${_esc(_draft.endTime)}"
              onchange="window.StudyScheduleModule._setField('endTime', this.value)">
          </div>
        </div>

        <label class="ss-label">تنبيه اليوم <span class="ss-hint-inline">(بيتحسب على أول محاضرة مفعّلة في اليوم)</span></label>
        <select class="ss-select" id="ssFReminder" onchange="window.StudyScheduleModule._setReminderPreset(this.value)">
          ${REMINDER_OPTIONS.map((o) => `<option value="${o.value}" ${String(_draft.reminderMinutes) === String(o.value) ? "selected" : ""}>${o.label}</option>`).join("")}
        </select>
        ${isCustom ? `
          <div class="ss-row2">
            <div>
              <label class="ss-label">ساعات</label>
              <input class="ss-select" type="number" inputmode="numeric" min="0" placeholder="0" value="${_esc(_draft.reminderCustomH)}"
                oninput="window.StudyScheduleModule._setField('reminderCustomH', this.value)">
            </div>
            <div>
              <label class="ss-label">دقائق</label>
              <input class="ss-select" type="number" inputmode="numeric" min="0" max="59" placeholder="0" value="${_esc(_draft.reminderCustomM)}"
                oninput="window.StudyScheduleModule._setField('reminderCustomM', this.value)">
            </div>
          </div>` : ""}

        <label class="ss-toggle-row">
          <span>حالة المحاضرة</span>
          <span class="ss-toggle-switch ${_draft.enabled ? "on" : ""}" onclick="window.StudyScheduleModule._toggleDraftEnabled()">
            <span class="ss-toggle-knob"></span>
          </span>
          <span class="ss-toggle-label">${_draft.enabled ? "مفعّلة" : "متوقفة"}</span>
        </label>

        <div class="ss-actions">
          <button class="ss-btn-primary" onclick="window.StudyScheduleModule._save()"><i class="fa-solid fa-floppy-disk"></i> حفظ</button>
          <button class="ss-btn-cancel" onclick="window.StudyScheduleModule._cancelForm()">إلغاء</button>
        </div>
      </div>`;
  }

  window.StudyScheduleModule._setField = function (k, v) { if (_draft) _draft[k] = v; };
  window.StudyScheduleModule._setReminderPreset = function (v) {
    if (!_draft) return;
    _draft.reminderMinutes = v === "custom" ? "custom" : _num(v);
    _renderForm();
  };
  window.StudyScheduleModule._toggleDraftEnabled = function () {
    if (!_draft) return;
    _draft.enabled = !_draft.enabled;
    _renderForm();
  };

  window.StudyScheduleModule._save = async function () {
    if (!_isAdmin() || !_draft) return;
    const subject = (_draft.subject || "").trim();
    if (!subject) { window.toast?.("اكتب اسم المادة", "error"); return; }
    if (!_draft.day) { window.toast?.("اختر اليوم", "error"); return; }
    if (!_draft.startTime) { window.toast?.("اختر وقت البداية", "error"); return; }
    if (_draft.endTime && _draft.endTime <= _draft.startTime) {
      window.toast?.("وقت النهاية لازم يكون بعد وقت البداية", "error"); return;
    }
    let reminderMinutes = _draft.reminderMinutes;
    if (reminderMinutes === "custom") {
      const h = _num(_draft.reminderCustomH), m = _num(_draft.reminderCustomM);
      reminderMinutes = h * 60 + m;
      if (reminderMinutes <= 0) { window.toast?.("حدّد وقت تنبيه مخصص صحيح", "error"); return; }
    }
    const payload = {
      subject, day: _draft.day, startTime: _draft.startTime, endTime: _draft.endTime || "",
      reminderMinutes: _num(reminderMinutes), enabled: !!_draft.enabled,
      updatedAt: undefined, updatedBy: window.currentUser?.uid || "",
    };
    const btn = document.querySelector(".ss-btn-primary");
    if (btn) btn.disabled = true;
    try {
      const { db, doc, addDoc, updateDoc, collection, serverTimestamp } = await _fs();
      payload.updatedAt = serverTimestamp();
      if (_draft.id) {
        await updateDoc(doc(db, COL, _draft.id), payload);
      } else {
        payload.createdAt = serverTimestamp();
        payload.createdBy = window.currentUser?.uid || "";
        await addDoc(collection(db, COL), payload);
      }
      window.toast?.("تم الحفظ بنجاح ✓");
      await _load();
    } catch (e) {
      window.toast?.("فشل الحفظ — حاول مرة أخرى", "error");
      if (btn) btn.disabled = false;
    }
  };

  window.StudyScheduleModule._cancelForm = function () { _renderHome(); };

  window.StudyScheduleModule._toggle = async function (id) {
    if (!_isAdmin()) return;
    const l = _lectures.find((x) => x.id === id);
    if (!l) return;
    try {
      const { db, doc, updateDoc, serverTimestamp } = await _fs();
      await updateDoc(doc(db, COL, id), { enabled: l.enabled === false, updatedAt: serverTimestamp(), updatedBy: window.currentUser?.uid || "" });
      await _load();
    } catch (e) { window.toast?.("تعذّر تحديث الحالة", "error"); }
  };

  window.StudyScheduleModule._delete = async function (id) {
    if (!_isAdmin()) return;
    if (!window.confirm("حذف هذه المحاضرة نهائيًا؟")) return;
    try {
      const { db, doc, deleteDoc } = await _fs();
      await deleteDoc(doc(db, COL, id));
      window.toast?.("تم الحذف");
      await _load();
    } catch (e) { window.toast?.("فشل الحذف", "error"); }
  };

  /* ─────────────────────────────────────────
     رجوع / فتح / إغلاق
  ───────────────────────────────────────── */
  window.StudyScheduleModule._back = function () {
    if (_view === "form") { _renderHome(); return; }
    window.StudyScheduleModule.close();
  };

  window.StudyScheduleModule.open = function () {
    const root = _root();
    if (!root) return;
    root.classList.add("ss-open");
    root.style.display = "flex";
    _buildShell();
    if (_loaded) _renderHome(); else _load();
  };

  window.StudyScheduleModule.close = function () {
    const root = _root();
    if (!root) return;
    root.classList.remove("ss-open");
    root.style.display = "none";
    root.innerHTML = "";
    _view = "home"; _draft = null;
  };
})();
