/* ══════════════════════════════════════════════════════════════════
   js/attendance.js — نظام الحضور والغياب (ملف مستقل بالكامل)
   ══════════════════════════════════════════════════════════════════
   موديل البيانات في Firestore:
   - attendanceSettings/config
       { enabled: boolean }
   - attendanceSchedules/{day}   (day: sunday|monday|tuesday|wednesday
                                        |thursday|friday|saturday)
       { enabled: boolean, startTime:"HH:MM", endTime:"HH:MM",
         subjects: [{ id, name, order }] }
   - users/{uid}/attendance/{YYYY-MM-DD}
       { status:"present"|"partial"|"absent",
         totalSubjects, presentSubjects, absentSubjects,
         subjects:[{name,status}], completedAt }

   قواعد أساسية (حسب التصميم المطلوب):
   - عدم الاختيار = يفضل الحالة "pending" (مفيش مستند اتكتب) —
     ومش بيتحسب غياب أبدًا إلا لو المستخدم دوس "لا" بنفسه.
   - أول ما يسجّل حالة اليوم (أي حالة) مش بيتسأل تاني في نفس اليوم.
   - الجدول (Schedule) منفصل عن السجل (Record): تعديل المالك لجدول
     يوم معين مايأثرش على سجلات قديمة اتسجلت قبل كده.
   - الوقت بيتحسب بتوقيت القاهرة دايمًا (مش وقت جهاز المستخدم).
══════════════════════════════════════════════════════════════════ */

import {
  collection, doc, getDoc, getDocs,
  writeBatch, setDoc, query, where, documentId
} from "./firestore-safe.js";

function _db() { return window.db; }

// ── World Isolation: activeWorldContext() هو المصدر الوحيد للعالم ──
function _worldId() {
  return (typeof window.activeWorldContext === "function") ? window.activeWorldContext() : null;
}

const DAY_LABELS = {
  sunday: "الأحد", monday: "الإثنين", tuesday: "الثلاثاء",
  wednesday: "الأربعاء", thursday: "الخميس", friday: "الجمعة", saturday: "السبت"
};
const DAY_ORDER = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

// ── وقت القاهرة الحالي (بغض النظر عن توقيت جهاز المستخدم) ──
function _cairoNow() {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "long"
  });
  const parts = {};
  fmt.formatToParts(new Date()).forEach(p => { parts[p.type] = p.value; });
  return {
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
    hhmm: `${parts.hour}:${parts.minute}`,
    weekday: (parts.weekday || "").toLowerCase()
  };
}

// ── ربط الجدول الدراسي (attendanceSettings.useStudySchedule === true) ──
// ▸ ربط حي وليس نسخًا: الحصص تُقرأ من studySchedule وقت الفحص، ولا يُكتب منها شيء في attendanceSchedules.
// ▸ نفس شكل مستند جدول اليوم الذي تتوقعه checkAttendancePopup: وقت ظهور واحد لليوم (= أبكر بداية حصة مفعّلة)
//   ونهاية 23:59 (نفس قيمة الحفظ اليدوي الحالي) ومواد مرتبة بوقتها (subject ثم subject2 لو موجودة، بلا تكرار).
const _WEEKDAY_TO_SS_KEY = { sunday: "sun", monday: "mon", tuesday: "tue", wednesday: "wed", thursday: "thu", friday: "fri", saturday: "sat" };

function _buildStudyDay(lectures) {
  const items = [];
  lectures.forEach(l => {
    if (l.enabled === false) return; // الحصص المتوقفة لا تدخل الحضور
    if ((l.subject || "").trim() && l.startTime) items.push({ name: l.subject.trim(), time: l.startTime });
    if ((l.subject2 || "").trim() && l.startTime2) items.push({ name: l.subject2.trim(), time: l.startTime2 });
  });
  if (!items.length) return null;
  items.sort((a, b) => a.time.localeCompare(b.time));
  const seen = new Set();
  const subjects = [];
  items.forEach(it => {
    if (seen.has(it.name)) return;
    seen.add(it.name);
    subjects.push({ id: `subject_${subjects.length + 1}`, name: it.name, order: subjects.length + 1 });
  });
  return { enabled: true, startTime: items[0].time, endTime: "23:59", subjects };
}

// جداول الأسبوع كله دفعة واحدة: { sunday: sched|null, ... } — استعلام واحد للجدول الدراسي أو 7 مستندات يدوية
async function _loadScheds(wid, linked) {
  const out = {};
  if (linked) {
    const snap = await getDocs(query(collection(_db(), "studySchedule"), where("worldId", "==", wid)));
    const byDay = {};
    snap.forEach(d => { const l = d.data(); if (l.worldId === wid) (byDay[l.day] = byDay[l.day] || []).push(l); }); // عزل العالم
    DAY_ORDER.forEach(wd => { out[wd] = _buildStudyDay(byDay[_WEEKDAY_TO_SS_KEY[wd]] || []); });
  } else {
    await Promise.all(DAY_ORDER.map(async wd => {
      const sn = await getDoc(doc(_db(), "attendanceSchedules", `${wid}_${wd}`));
      out[wd] = sn.exists() ? sn.data() : null;
    }));
  }
  return out;
}

function _dateParts(dateStr) { return dateStr.split("-").map(Number); }
function _cairoDateMinus(dateStr, n) {
  const [y, m, d] = _dateParts(dateStr);
  const t = new Date(Date.UTC(y, m - 1, d - n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}
function _weekdayOf(dateStr) {
  const [y, m, d] = _dateParts(dateStr);
  return DAY_ORDER[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
function _cairoDateOf(date) {
  const parts = {};
  new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(date).forEach(p => { parts[p.type] = p.value; });
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/* ══════════════════════════════════════════
   جانب المستخدم — نافذة تسجيل الحضور اليومية
══════════════════════════════════════════ */
let _pendingDate = null;
let _pendingSubjects = [];

// ── طابور الأسئلة: أيام فاتت بلا سجل (الأقدم أولًا، حتى LOOKBACK_DAYS) ثم اليوم الحالي في معاد ظهوره ──
const LOOKBACK_DAYS = 14;
let _queue = [];          // [{ date, at, subjects }]
let _queueUid = null;     // صاحب الطابور الحالي (تبديل الحساب بدون Reload يصفّره)
let _todayTimer = null;   // setTimeout واحد فقط لمعاد اليوم الحالي — بلا Polling
let _checkedDate = null;  // تاريخ القاهرة وقت آخر فحص
let _checking = false;

function _isPopupShown() { return !!_el("attPopupBackdrop")?.classList.contains("show"); }

export async function checkAttendancePopup() {
  if (_checking) return;
  _checking = true;
  try {
    const uid = window.currentUser?.uid;
    if (!uid) return;
    if (_queueUid !== uid) {
      _queue = []; _queueUid = uid;
      if (_todayTimer) { clearTimeout(_todayTimer); _todayTimer = null; }
    }
    if (_isPopupShown()) return;

    const wid = _worldId();
    if (!wid) return; // ✅ World Isolation: بلا عالم صالح لا تُعرض أي بيانات حضور

    const cfgSnap = await getDoc(doc(_db(), "attendanceSettings", wid));
    if (!cfgSnap.exists() || cfgSnap.data().enabled !== true) { _queue = []; return; }

    const { dateStr, hhmm } = _cairoNow();
    _checkedDate = dateStr;
    let from = _cairoDateMinus(dateStr, LOOKBACK_DAYS);
    const created = window._currentUserData?.createdAt?.toDate?.();
    if (created) { const cd = _cairoDateOf(created); if (cd > from) from = cd; } // لا نسأل عن أيام قبل إنشاء الحساب

    const scheds = await _loadScheds(wid, cfgSnap.data().useStudySchedule === true);
    const recSnap = await getDocs(query(collection(_db(), "users", uid, "attendance"), where(documentId(), ">=", from)));
    const done = new Set();
    recSnap.forEach(d => done.add(d.id));

    const queue = [];
    for (let i = LOOKBACK_DAYS; i >= 0; i--) {
      const ds = _cairoDateMinus(dateStr, i);
      if (ds < from || done.has(ds)) continue;
      const sc = scheds[_weekdayOf(ds)];
      if (!sc || !sc.enabled || !Array.isArray(sc.subjects) || !sc.subjects.length) continue;
      const isToday = ds === dateStr;
      if (isToday && sc.endTime && hhmm > sc.endTime) continue;
      queue.push({
        date: ds,
        at: isToday ? (sc.startTime || "00:00") : "00:00",
        subjects: sc.subjects.slice().sort((a, b) => (a.order || 0) - (b.order || 0))
      });
    }
    _queue = queue;
    _showNext();
  } catch (e) { console.error(e); }
  finally { _checking = false; }
}

function _showNext() {
  if (_todayTimer) { clearTimeout(_todayTimer); _todayTimer = null; }
  if (!_queue.length || window.currentUser?.uid !== _queueUid || _isPopupShown()) return;
  const it = _queue[0];
  const { dateStr, hhmm } = _cairoNow();
  if (it.date === dateStr && hhmm < it.at) {
    const [h, m] = it.at.split(":").map(Number);
    const [ch, cm] = hhmm.split(":").map(Number);
    _todayTimer = setTimeout(_showNext, Math.max(1000, ((h * 60 + m) - (ch * 60 + cm)) * 60000));
    return;
  }
  _pendingDate = it.date;
  _pendingSubjects = it.subjects;
  _showMainStep();
}

function _afterSave(savedDate) {
  if (_queue[0] && _queue[0].date === savedDate) _queue.shift();
  setTimeout(_showNext, 350);
}

// بدون Polling: إعادة فحص فقط عند رجوع التبويب لو اتغيّر اليوم، أو إكمال الطابور لو معاده جه
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !_queueUid) return;
  if (_cairoNow().dateStr !== _checkedDate) { checkAttendancePopup(); return; }
  if (_queue.length) _showNext();
});

function _el(id) { return document.getElementById(id); }

function _showMainStep() {
  const bd = _el("attPopupBackdrop");
  if (!bd) return;
  const isToday = _pendingDate === _cairoNow().dateStr;
  const dayLabel = DAY_LABELS[_weekdayOf(_pendingDate)] || "";
  const titleEl = _el("attPopupStepMain").querySelector(".att-popup-title");
  const subEl = _el("attPopupStepMain").querySelector(".att-popup-sub");
  if (titleEl) titleEl.textContent = isToday ? "حضور اليوم" : `حضور يوم ${dayLabel} ${_pendingDate}`;
  if (subEl) subEl.textContent = isToday ? "هل حضرت الجامعة اليوم؟" : `هل حضرت الجامعة يوم ${dayLabel}؟`;
  _el("attPopupStepMain").style.display = "";
  _el("attPopupStepSubjects").style.display = "none";
  bd.classList.add("show");
}

function _hidePopup() {
  _el("attPopupBackdrop")?.classList.remove("show");
}

function _renderSubjectsStep() {
  _el("attPopupStepMain").style.display = "none";
  const stepEl = _el("attPopupStepSubjects");
  stepEl.style.display = "";
  const listEl = _el("attPopupSubjectsList");
  listEl.innerHTML = _pendingSubjects.map(s => `
    <label class="att-subj-row" data-name="${s.name}">
      <span class="att-subj-name">${s.name}</span>
      <span class="att-subj-toggle">
        <input type="checkbox" class="att-subj-check" checked>
        <span class="att-subj-state">حضرت</span>
      </span>
    </label>`).join("");
  listEl.querySelectorAll(".att-subj-row").forEach(row => {
    const chk = row.querySelector(".att-subj-check");
    const st  = row.querySelector(".att-subj-state");
    chk.addEventListener("change", () => {
      st.textContent = chk.checked ? "حضرت" : "غبت";
      row.classList.toggle("absent", !chk.checked);
    });
  });
}

async function _saveRecord(status, subjects) {
  const uid = window.currentUser?.uid;
  if (!uid || !_pendingDate) return;
  const present = subjects.filter(s => s.status === "present").length;
  try {
    await setDoc(doc(_db(), "users", uid, "attendance", _pendingDate), {
      status,
      totalSubjects: subjects.length,
      presentSubjects: present,
      absentSubjects: subjects.length - present,
      subjects,
      completedAt: new Date().toISOString()
    });
    window.toast?.("تم تسجيل حضورك بنجاح ✅");
    return true;
  } catch (e) {
    console.error(e);
    window.toast?.("حصل خطأ أثناء حفظ الحضور", "error");
    return false;
  }
}

window.__attAnswerNo = async () => {
  const savedDate = _pendingDate;
  const subjects = _pendingSubjects.map(s => ({ name: s.name, status: "absent" }));
  const ok = await _saveRecord("absent", subjects);
  _hidePopup();
  if (ok) _afterSave(savedDate);
};
window.__attAnswerYes = () => { _renderSubjectsStep(); };
window.__attSaveSubjects = async () => {
  const rows = document.querySelectorAll("#attPopupSubjectsList .att-subj-row");
  const subjects = Array.from(rows).map(r => ({
    name: r.dataset.name,
    status: r.querySelector(".att-subj-check").checked ? "present" : "absent"
  }));
  const presentCount = subjects.filter(s => s.status === "present").length;
  const status = presentCount === subjects.length ? "present" : (presentCount === 0 ? "absent" : "partial");
  const savedDate = _pendingDate;
  const ok = await _saveRecord(status, subjects);
  _hidePopup();
  if (ok) _afterSave(savedDate);
};

/* ══════════════════════════════════════════
   جانب المستخدم — سجل الحضور والغياب (المنتدى)
══════════════════════════════════════════ */
let _attRecordsCache = {}; // { "2026-08-06": {status, subjects,...} }
let _attCalMonth = null;   // {year, month} — 1-based month

export async function loadAttendanceHistory() {
  const uid = window.currentUser?.uid;
  const statsEl = _el("attHistStats");
  if (!uid || !statsEl) return;
  statsEl.innerHTML = `<div class="spinner"></div>`;
  try {
    const snap = await getDocs(collection(_db(), "users", uid, "attendance"));
    _attRecordsCache = {};
    snap.forEach(d => { _attRecordsCache[d.id] = d.data(); });

    const all = Object.values(_attRecordsCache);
    const presentDays = all.filter(r => r.status === "present" || r.status === "partial").length;
    const absentDays  = all.filter(r => r.status === "absent").length;
    const totalDays   = all.length;
    const pct = totalDays ? Math.round((presentDays / totalDays) * 100) : 0;

    statsEl.innerHTML = `
      <div class="att-stat-card">
        <div class="att-stat-num good">${presentDays}</div>
        <div class="att-stat-label">أيام حضور</div>
      </div>
      <div class="att-stat-card">
        <div class="att-stat-num bad">${absentDays}</div>
        <div class="att-stat-label">أيام غياب</div>
      </div>
      <div class="att-stat-card">
        <div class="att-stat-num">${pct}%</div>
        <div class="att-stat-label">نسبة الحضور</div>
      </div>`;

    const { dateStr } = _cairoNow();
    const [y, m] = dateStr.split("-").map(Number);
    _attCalMonth = { year: y, month: m };
    _renderAttCalendar();
  } catch (e) {
    statsEl.innerHTML = `<div class="empty-state">خطأ في التحميل</div>`;
    console.error(e);
  }
}

function _statusColor(status) {
  if (status === "present") return "good";
  if (status === "partial") return "mid";
  if (status === "absent")  return "bad";
  return "none";
}

function _renderAttCalendar() {
  const wrap = _el("attCalGrid");
  const label = _el("attCalMonthLabel");
  if (!wrap || !_attCalMonth) return;
  const { year, month } = _attCalMonth;
  const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  if (label) label.textContent = `${monthNames[month - 1]} ${year}`;

  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startWeekday = firstDay.getUTCDay(); // 0=Sunday

  let html = `<div class="att-cal-dow-row">` +
    ["أحد","إثن","ثلا","أرب","خمي","جمع","سبت"].map(d => `<div class="att-cal-dow">${d}</div>`).join("") +
    `</div><div class="att-cal-days">`;

  for (let i = 0; i < startWeekday; i++) html += `<div class="att-cal-cell empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const rec = _attRecordsCache[ds];
    const cls = rec ? _statusColor(rec.status) : "none";
    html += `<div class="att-cal-cell ${cls}" onclick="window.__attShowDayDetail('${ds}')">${d}</div>`;
  }
  html += `</div>`;
  wrap.innerHTML = html;
  _el("attDayDetail").innerHTML = "";
}

window.__attCalPrevMonth = () => {
  if (!_attCalMonth) return;
  _attCalMonth.month--; if (_attCalMonth.month < 1) { _attCalMonth.month = 12; _attCalMonth.year--; }
  _renderAttCalendar();
};
window.__attCalNextMonth = () => {
  if (!_attCalMonth) return;
  _attCalMonth.month++; if (_attCalMonth.month > 12) { _attCalMonth.month = 1; _attCalMonth.year++; }
  _renderAttCalendar();
};
window.__attShowDayDetail = (ds) => {
  const wrap = _el("attDayDetail");
  if (!wrap) return;
  const rec = _attRecordsCache[ds];
  if (!rec) { wrap.innerHTML = `<div class="empty-state">لا يوجد سجل لهذا اليوم</div>`; return; }
  const subjRows = (rec.subjects || []).map(s => `
    <div class="att-detail-subj ${s.status === "present" ? "good" : "bad"}">
      <i class="fa-solid ${s.status === "present" ? "fa-check" : "fa-xmark"}"></i> ${s.name}
    </div>`).join("");
  wrap.innerHTML = `
    <div class="att-detail-title">${ds}</div>
    <div class="att-detail-summary">الحضور: ${rec.presentSubjects || 0} — الغياب: ${rec.absentSubjects || 0}</div>
    <div class="att-detail-subjects">${subjRows || "<div class='empty-state'>غياب كامل هذا اليوم</div>"}</div>`;
};

/* ══════════════════════════════════════════
   جانب المالك — إعدادات نظام الحضور (جدول أسبوعي متكرر)
══════════════════════════════════════════
   الجدول (Schedule) منفصل عن السجل (Record): تعديل الجدول
   بيأثر على الأيام القادمة بس، والسجلات القديمة تفضل زي ما هي.
   يوم اتشال من الاختيار مش بيتحذف، بيتقفل (enabled:false) بس —
   عشان سجلاته القديمة تفضل محفوظة.
══════════════════════════════════════════ */
let _weeklyCache = {}; // { sunday: {enabled,startTime,subjects:[{name,order}]}, ... }
let _linkedToStudy = false; // attendanceSettings.useStudySchedule للعالم الحالي — للتنبيه في اللوحة فقط

// ── World Isolation: مجموعتا معرّفات DOM لكل لوحة (Owner/Admin) — نفس المودال مشترك بينهما ──
const _OWNER_PANEL_IDS = { switchId: "attOwnerEnableSwitch", summaryId: "attWeeklySummary", worldLabelId: "attOwnerWorldLabel" };
const _ADMIN_PANEL_IDS = { switchId: "attAdminEnableSwitch", summaryId: "attAdminWeeklySummary", worldLabelId: "attAdminWorldLabel" };
let _panelIds = _OWNER_PANEL_IDS; // آخر لوحة تم فتحها — تُستخدم لتحديث المكان الصحيح بعد الحفظ

function _renderWorldLabel(elId, wid) {
  const el = _el(elId);
  if (el) el.textContent = wid || "—";
}

async function _initPanel(panelIds) {
  _panelIds = panelIds;
  const wid = _worldId();
  _renderWorldLabel(panelIds.worldLabelId, wid);
  if (!wid) {
    const wrap = _el(panelIds.summaryId);
    if (wrap) wrap.innerHTML = `<div class="empty-state">لا يوجد عالم نشط</div>`;
    return;
  }
  try {
    const cfgSnap = await getDoc(doc(_db(), "attendanceSettings", wid));
    const enabled = cfgSnap.exists() ? !!cfgSnap.data().enabled : false;
    const sw = _el(panelIds.switchId);
    if (sw) sw.checked = enabled;
    _linkedToStudy = cfgSnap.exists() && cfgSnap.data().useStudySchedule === true;
  } catch (e) {}
  await _loadWeeklyCache(wid);
  _renderWeeklySummary(panelIds.summaryId);
}

export async function attOwnerInit() { await _initPanel(_OWNER_PANEL_IDS); }
export async function attAdminInit() { await _initPanel(_ADMIN_PANEL_IDS); }

async function _loadWeeklyCache(wid) {
  const results = await Promise.all(DAY_ORDER.map(async (k) => {
    try {
      const snap = await getDoc(doc(_db(), "attendanceSchedules", `${wid}_${k}`));
      return [k, snap.exists() ? snap.data() : null];
    } catch (e) { return [k, null]; }
  }));
  _weeklyCache = Object.fromEntries(results);
}

function _renderWeeklySummary(summaryId) {
  const wrap = _el(summaryId);
  if (!wrap) return;
  const activeDays = DAY_ORDER.filter(k => _weeklyCache[k] && _weeklyCache[k].enabled);
  const linkNote = _linkedToStudy
    ? `<div class="empty-state" style="margin-bottom:8px;">🔒 الجدول اليدوي مقفول — الحضور يعتمد الآن على الجدول الدراسي (يُدار من شاشة الجدول). يعود هذا الجدول للعمل عند إيقاف الربط.</div>`
    : "";
  // الحذف للمالك فقط (قاعدة attendanceSchedules: delete = isOwner)
  const owner = _isOwnerUser();
  const delAll = (owner && DAY_ORDER.some(k => _weeklyCache[k]))
    ? `<button type="button" class="btn btn-dark" style="width:100%;margin-top:8px;" onclick="window.__attDeleteAll()"><i class="fa-solid fa-trash"></i> حذف الجدول اليدوي كله</button>`
    : "";
  if (!activeDays.length) {
    wrap.innerHTML = linkNote + `<div class="empty-state">لا يوجد جدول حضور مفعّل حاليًا</div>` + delAll;
    return;
  }
  wrap.innerHTML = linkNote + activeDays.map(k => {
    const d = _weeklyCache[k];
    const count = (d.subjects || []).length;
    const del = owner
      ? `<button type="button" aria-label="حذف" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:4px 6px;" onclick="window.__attDeleteDay('${k}')"><i class="fa-solid fa-trash"></i></button>`
      : "";
    return `
      <div class="att-weekly-row"${_linkedToStudy ? ' style="opacity:.55;"' : ""}>
        <span class="att-weekly-day">${DAY_LABELS[k]}</span>
        <span class="att-weekly-count">${count} ${count === 1 ? "مادة" : "مواد"}</span>
        <span class="att-weekly-time">${d.startTime || ""}</span>
        ${del}
      </div>`;
  }).join("") + delAll;
}

async function _toggleSystem(switchId) {
  const sw = _el(switchId);
  if (!sw) return;
  const wid = _worldId();
  if (!wid) { window.toast?.("لا يوجد عالم نشط — تعذّر الحفظ", "error"); sw.checked = !sw.checked; return; }
  try {
    await setDoc(doc(_db(), "attendanceSettings", wid), { enabled: sw.checked }, { merge: true });
    window.toast?.(sw.checked ? "تم تفعيل نظام الحضور" : "تم إيقاف نظام الحضور");
  } catch (e) {
    console.error(e);
    window.toast?.("حصل خطأ", "error");
    sw.checked = !sw.checked;
  }
}
window.attOwnerToggleSystem = async () => { await _toggleSystem(_OWNER_PANEL_IDS.switchId); };
window.attAdminToggleSystem = async () => { await _toggleSystem(_ADMIN_PANEL_IDS.switchId); };

/* ── نافذة إعداد جدول الحضور (Modal مستقل — مشترك بين لوحتي Owner وAdmin) ── */
let _modalSelectedDays = new Set();
let _modalDayData = {}; // { sunday: { time:"15:00", subjects:["اسم1","اسم2"] } }

const _isOwnerUser = () => typeof window.isOwner === "function" && window.isOwner();

// يُستدعى من شاشة الجدول الدراسي بعد تغيير الربط ليتحدّث القفل/الملاحظة فورًا بدون قراءة جديدة
window.__attSetLinked = (v) => {
  _linkedToStudy = !!v;
  if (_panelIds) _renderWeeklySummary(_panelIds.summaryId);
};

window.__attOpenScheduleModal = async (editMode) => {
  if (_linkedToStudy) {
    window.toast?.("الجدول اليدوي مقفول — الحضور يعتمد على الجدول الدراسي. أوقف الربط من شاشة الجدول الدراسي لتعديله", "info");
    return;
  }
  const wid = _worldId();
  if (!wid) { window.toast?.("لا يوجد عالم نشط", "error"); return; }
  _modalSelectedDays = new Set();
  _modalDayData = {};
  if (editMode) {
    await _loadWeeklyCache(wid);
    DAY_ORDER.forEach(k => {
      const d = _weeklyCache[k];
      if (d && d.enabled) {
        _modalSelectedDays.add(k);
        _modalDayData[k] = {
          time: d.startTime || "15:00",
          subjects: (d.subjects || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map(s => s.name)
        };
      }
    });
  }
  _renderModalDayPills();
  _renderModalDaysConfig();
  _el("attScheduleModalBackdrop")?.classList.add("show");
};

window.__attCloseScheduleModal = () => {
  _el("attScheduleModalBackdrop")?.classList.remove("show");
};

function _renderModalDayPills() {
  const wrap = _el("attModalDayPills");
  if (!wrap) return;
  wrap.innerHTML = DAY_ORDER.map(k => `
    <button type="button" class="att-day-pill ${_modalSelectedDays.has(k) ? "active" : ""}" onclick="window.__attModalToggleDay('${k}')">
      ${DAY_LABELS[k]}
    </button>`).join("");
  const countEl = _el("attSelectedCount");
  if (countEl) countEl.textContent = _modalSelectedDays.size;
}

window.__attModalToggleDay = (dayKey) => {
  if (_modalSelectedDays.has(dayKey)) {
    _modalSelectedDays.delete(dayKey);
    delete _modalDayData[dayKey];
  } else {
    _modalSelectedDays.add(dayKey);
    if (!_modalDayData[dayKey]) _modalDayData[dayKey] = { time: "15:00", subjects: [""] };
  }
  _renderModalDayPills();
  _renderModalDaysConfig();
};

function _renderModalDaysConfig() {
  const wrap = _el("attModalDaysConfig");
  if (!wrap) return;
  const days = DAY_ORDER.filter(k => _modalSelectedDays.has(k));
  if (!days.length) { wrap.innerHTML = ""; return; }
  wrap.innerHTML = days.map(k => {
    const data = _modalDayData[k];
    const count = data.subjects.length;
    const subjInputs = data.subjects.map((name, i) => `
      <div style="margin-top:8px;">
        <div class="label">المادة ${i + 1}</div>
        <input class="inp" value="${(name || "").replace(/"/g, "&quot;")}"
          oninput="window.__attModalSubjNameChange('${k}',${i},this.value)" placeholder="اسم المادة">
      </div>`).join("");
    return `
      <div class="att-modal-day-block">
        <div class="att-modal-day-title">${DAY_LABELS[k]}</div>
        <div class="att-day-row">
          <div style="flex:1">
            <div class="label">وقت ظهور الحضور</div>
            <input class="inp" type="time" value="${data.time}" onchange="window.__attModalTimeChange('${k}',this.value)">
          </div>
          <div style="flex:1">
            <div class="label">عدد المواد</div>
            <input class="inp" type="number" min="1" max="12" value="${count}" onchange="window.__attModalCountChange('${k}',this.value)">
          </div>
        </div>
        ${subjInputs}
      </div>`;
  }).join("");
}

window.__attModalTimeChange = (dayKey, val) => {
  if (_modalDayData[dayKey]) _modalDayData[dayKey].time = val;
};
window.__attModalSubjNameChange = (dayKey, idx, val) => {
  if (_modalDayData[dayKey]) _modalDayData[dayKey].subjects[idx] = val;
};
window.__attModalCountChange = async (dayKey, val) => {
  const data = _modalDayData[dayKey];
  if (!data) return;
  const newCount = Math.max(1, Math.min(12, parseInt(val, 10) || 1));
  const oldSubjects = data.subjects;
  if (newCount < oldSubjects.length) {
    const removed = oldSubjects.slice(newCount);
    const hasData = removed.some(s => (s || "").trim());
    if (hasData) {
      const ok = await window._appConfirm("تقليل عدد المواد", "فيه مواد مكتوبة هتتحذف من الشاشة، متأكد؟");
      if (!ok) { _renderModalDaysConfig(); return; } // نرجّع القيمة القديمة زي ما هي
    }
  }
  data.subjects = Array.from({ length: newCount }, (_, i) => oldSubjects[i] || "");
  _renderModalDaysConfig();
};

/* ── حذف جداول الحضور اليدوية (المالك فقط، لعالمه النشط فقط) — سجلات users/{uid}/attendance لا تُمس ── */
async function _deleteDays(dayKeys, title, msg) {
  if (!_isOwnerUser()) return;
  const wid = _worldId();
  if (!wid) { window.toast?.("لا يوجد عالم نشط — تعذّر الحذف", "error"); return; }
  const keys = dayKeys.filter(k => DAY_ORDER.includes(k) && _weeklyCache[k]);
  if (!keys.length) return;
  const ok = await window._appConfirm(title, msg);
  if (!ok) return;
  try {
    const batch = writeBatch(_db());
    keys.forEach(k => batch.delete(doc(_db(), "attendanceSchedules", `${wid}_${k}`)));
    await batch.commit();
    window.toast?.("تم الحذف ✅");
    await _loadWeeklyCache(wid);
    _renderWeeklySummary(_panelIds.summaryId);
  } catch (e) {
    console.error(e);
    window.toast?.("حصل خطأ أثناء الحذف", "error");
  }
}
window.__attDeleteDay = (dayKey) => _deleteDays([dayKey], `حذف جدول ${DAY_LABELS[dayKey] || ""}`, "هيتحذف جدول الحضور اليدوي لليوم ده نهائيًا. سجلات حضور الطلبة السابقة مش هتتأثر. متأكد؟");
window.__attDeleteAll = () => _deleteDays(DAY_ORDER, "حذف الجدول اليدوي كله", "هيتحذف جدول الحضور اليدوي لكل الأيام نهائيًا. سجلات حضور الطلبة السابقة مش هتتأثر. متأكد؟");

window.attScheduleSave = async () => {
  const wid = _worldId();
  if (!wid) { window.toast?.("لا يوجد عالم نشط — تعذّر الحفظ", "error"); return; }
  const days = Array.from(_modalSelectedDays);
  if (!days.length) { window.toast?.("اختر يوم واحد على الأقل", "error"); return; }
  for (const k of days) {
    const names = _modalDayData[k].subjects.map(s => (s || "").trim()).filter(Boolean);
    if (!names.length) { window.toast?.(`اكتب مواد ${DAY_LABELS[k]} الأول`, "error"); return; }
  }
  const btn = _el("attScheduleSaveBtn");
  if (btn) { btn.disabled = true; btn.textContent = "جاري الحفظ..."; }
  try {
    const batch = writeBatch(_db());
    days.forEach(k => {
      const names = _modalDayData[k].subjects.map(s => (s || "").trim()).filter(Boolean);
      const subjects = names.map((name, i) => ({ id: `subject_${i + 1}`, name, order: i + 1 }));
      batch.set(doc(_db(), "attendanceSchedules", `${wid}_${k}`), {
        worldId: wid, enabled: true, startTime: _modalDayData[k].time || "15:00", endTime: "23:59", subjects
      }, { merge: true });
    });
    // أي يوم كان مفعّل قبل كده وماعادش مختار دلوقتي — يتقفل بس (مش يتحذف)
    DAY_ORDER.forEach(k => {
      if (!_modalSelectedDays.has(k) && _weeklyCache[k] && _weeklyCache[k].enabled) {
        batch.set(doc(_db(), "attendanceSchedules", `${wid}_${k}`), { worldId: wid, enabled: false }, { merge: true });
      }
    });
    await batch.commit();
    window.toast?.("تم حفظ جدول الحضور ✅");
    window.__attCloseScheduleModal();
    await _loadWeeklyCache(wid);
    _renderWeeklySummary(_panelIds.summaryId);
  } catch (e) {
    console.error(e);
    window.toast?.("حصل خطأ أثناء الحفظ", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "حفظ الجدول"; }
  }
};

// ── ربط الدوال بـ window عشان onclick=".." جوه الـ HTML وكود index.html يقدروا يستخدموها ──
window.checkAttendancePopup  = checkAttendancePopup;
window.loadAttendanceHistory = loadAttendanceHistory;
window.attOwnerInit          = attOwnerInit;
window.attAdminInit          = attAdminInit;
