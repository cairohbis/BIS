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
  writeBatch, setDoc
} from "./firestore-safe.js";

function _db() { return window.db; }

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

/* ══════════════════════════════════════════
   جانب المستخدم — نافذة تسجيل الحضور اليومية
══════════════════════════════════════════ */
let _pendingDate = null;
let _pendingSubjects = [];

export async function checkAttendancePopup() {
  try {
    const uid = window.currentUser?.uid;
    if (!uid) return;

    const cfgSnap = await getDoc(doc(_db(), "attendanceSettings", "config"));
    if (!cfgSnap.exists() || cfgSnap.data().enabled !== true) return;

    const { dateStr, hhmm, weekday } = _cairoNow();
    const schedSnap = await getDoc(doc(_db(), "attendanceSchedules", weekday));
    if (!schedSnap.exists()) return;
    const sched = schedSnap.data();
    if (!sched.enabled) return;
    if (!Array.isArray(sched.subjects) || !sched.subjects.length) return;
    if (hhmm < (sched.startTime || "00:00")) return;
    if (sched.endTime && hhmm > sched.endTime) return;

    // لو المستخدم سجّل حالة اليوم قبل كده (أي حالة) — منسألوش تاني
    const recSnap = await getDoc(doc(_db(), "users", uid, "attendance", dateStr));
    if (recSnap.exists()) return;

    _pendingDate = dateStr;
    _pendingSubjects = sched.subjects.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    _showMainStep();
  } catch (e) { console.error(e); }
}

function _el(id) { return document.getElementById(id); }

function _showMainStep() {
  const bd = _el("attPopupBackdrop");
  if (!bd) return;
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
  } catch (e) {
    console.error(e);
    window.toast?.("حصل خطأ أثناء حفظ الحضور", "error");
  }
}

window.__attAnswerNo = async () => {
  const subjects = _pendingSubjects.map(s => ({ name: s.name, status: "absent" }));
  await _saveRecord("absent", subjects);
  _hidePopup();
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
  await _saveRecord(status, subjects);
  _hidePopup();
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

export async function attOwnerInit() {
  try {
    const cfgSnap = await getDoc(doc(_db(), "attendanceSettings", "config"));
    const enabled = cfgSnap.exists() ? !!cfgSnap.data().enabled : false;
    const sw = _el("attOwnerEnableSwitch");
    if (sw) sw.checked = enabled;
  } catch (e) {}
  await _loadWeeklyCache();
  _renderWeeklySummary();
}

async function _loadWeeklyCache() {
  const results = await Promise.all(DAY_ORDER.map(async (k) => {
    try {
      const snap = await getDoc(doc(_db(), "attendanceSchedules", k));
      return [k, snap.exists() ? snap.data() : null];
    } catch (e) { return [k, null]; }
  }));
  _weeklyCache = Object.fromEntries(results);
}

function _renderWeeklySummary() {
  const wrap = _el("attWeeklySummary");
  if (!wrap) return;
  const activeDays = DAY_ORDER.filter(k => _weeklyCache[k] && _weeklyCache[k].enabled);
  if (!activeDays.length) {
    wrap.innerHTML = `<div class="empty-state">لا يوجد جدول حضور مفعّل حاليًا</div>`;
    return;
  }
  wrap.innerHTML = activeDays.map(k => {
    const d = _weeklyCache[k];
    const count = (d.subjects || []).length;
    return `
      <div class="att-weekly-row">
        <span class="att-weekly-day">${DAY_LABELS[k]}</span>
        <span class="att-weekly-count">${count} ${count === 1 ? "مادة" : "مواد"}</span>
        <span class="att-weekly-time">${d.startTime || ""}</span>
      </div>`;
  }).join("");
}

window.attOwnerToggleSystem = async () => {
  const sw = _el("attOwnerEnableSwitch");
  if (!sw) return;
  try {
    await setDoc(doc(_db(), "attendanceSettings", "config"), { enabled: sw.checked }, { merge: true });
    window.toast?.(sw.checked ? "تم تفعيل نظام الحضور" : "تم إيقاف نظام الحضور");
  } catch (e) {
    console.error(e);
    window.toast?.("حصل خطأ", "error");
    sw.checked = !sw.checked;
  }
};

/* ── نافذة إعداد جدول الحضور (Modal مستقل) ── */
let _modalSelectedDays = new Set();
let _modalDayData = {}; // { sunday: { time:"15:00", subjects:["اسم1","اسم2"] } }

window.__attOpenScheduleModal = async (editMode) => {
  _modalSelectedDays = new Set();
  _modalDayData = {};
  if (editMode) {
    await _loadWeeklyCache();
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

window.attScheduleSave = async () => {
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
      batch.set(doc(_db(), "attendanceSchedules", k), {
        enabled: true, startTime: _modalDayData[k].time || "15:00", endTime: "23:59", subjects
      }, { merge: true });
    });
    // أي يوم كان مفعّل قبل كده وماعادش مختار دلوقتي — يتقفل بس (مش يتحذف)
    DAY_ORDER.forEach(k => {
      if (!_modalSelectedDays.has(k) && _weeklyCache[k] && _weeklyCache[k].enabled) {
        batch.set(doc(_db(), "attendanceSchedules", k), { enabled: false }, { merge: true });
      }
    });
    await batch.commit();
    window.toast?.("تم حفظ جدول الحضور ✅");
    window.__attCloseScheduleModal();
    await _loadWeeklyCache();
    _renderWeeklySummary();
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
