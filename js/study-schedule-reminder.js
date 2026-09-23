/**
 * ══════════════════════════════════════════
 *   تنبيه الجدول الدراسي — داخل الموقع (المرحلة الحالية)
 *   ══════════════════════════════════════════
 *   مستقل تمامًا عن موديول العرض/الإدارة (js/study-schedule.js)،
 *   بيشتغل تلقائيًا بعد تسجيل الدخول (زي js/quick-notifications.js بالظبط)
 *   عشان التنبيه يوصل للمستخدم حتى لو مفتحش كارت "الجدول الدراسي" أبدًا.
 *
 *   القاعدة: تنبيه واحد فقط لكل يوم دراسي، مبني على أول محاضرة
 *   مفعّلة في اليوم + reminderMinutes الخاص بيها (اللي الأدمن/المالك
 *   بيتحكموا فيه من نموذج الإضافة/التعديل في study-schedule.js).
 *
 *   ▸ المرحلة دي: تنبيه محلي (in-app toast) فقط، ومحسوب بالكامل
 *     من طرف العميل (Client) طول ما التبويب مفتوح — مفيش أي كتابة
 *     في fcmNotifications ولا أي Push حقيقي هنا.
 *   ▸ المرحلة القادمة (لاحقًا): نفس منطق الحساب ده (أول محاضرة +
 *     reminderMinutes) هيتنقل لـ Cloud Function مجدولة تستخدم نظام
 *     FCM الموجود بالفعل في الموقع، عشان يوصل الإشعار حتى لو الموقع
 *     مقفول. علشان كده كل منطق "حساب موعد التنبيه" هنا معزول في
 *     دالة واحدة (_computeTodayReminder) قابلة لإعادة الاستخدام/النقل
 *     زي ما هي بدون تعديل باقي الملف.
 *   ▸ لا يوجد تعديل على js/study-schedule.js ولا firestore.rules —
 *     بيستخدم نفس مجموعة studySchedule بقاعدة القراءة الموجودة بالفعل.
 * ══════════════════════════════════════════
 */

(function () {
  "use strict";
  if (window.__ssReminderLoaded) return;
  window.__ssReminderLoaded = true;

  const _FB = "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  const COL = "studySchedule";
  // Date.getDay(): 0=الأحد … 6=السبت
  const JS_DAY_TO_KEY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  let _lectures = [];
  let _timer = null;
  let _dayWatcherStarted = false;

  function _num(v) { const n = Number(v); return isFinite(n) ? n : 0; }
  function _todayKey() { return JS_DAY_TO_KEY[new Date().getDay()]; }
  function _todayDateStr() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function _storageKey() { return "bis_ss_reminder_shown_" + _todayDateStr(); }
  function _alreadyShownToday() {
    try { return localStorage.getItem(_storageKey()) === "1"; } catch (e) { return false; }
  }
  function _markShownToday() {
    try { localStorage.setItem(_storageKey(), "1"); } catch (e) {}
  }
  function _fmtTime12(hhmm) {
    if (!hhmm || hhmm.indexOf(":") === -1) return "";
    const [hStr, mStr] = hhmm.split(":");
    let h = _num(hStr), m = _num(mStr);
    const isPM = h >= 12;
    let h12 = h % 12; if (h12 === 0) h12 = 12;
    return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${isPM ? "مساءً" : "صباحًا"}`;
  }

  /* ─────────────────────────────────────────
     منطق حساب تنبيه اليوم — معزول عمدًا هنا
     عشان ينتقل زي ما هو لـ Cloud Function لاحقًا
  ───────────────────────────────────────── */
  function _computeTodayReminder(lectures, now) {
    const key = JS_DAY_TO_KEY[now.getDay()];
    const todays = lectures
      .filter((l) => l.day === key && l.enabled !== false && l.startTime)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (!todays.length) return null;
    const first = todays[0];
    const reminderMinutes = _num(first.reminderMinutes);
    if (!reminderMinutes) return null; // بدون تنبيه لهذا اليوم

    const [sh, sm] = first.startTime.split(":").map(Number);
    const startDate = new Date(now);
    startDate.setHours(sh, sm, 0, 0);
    const reminderDate = new Date(startDate.getTime() - reminderMinutes * 60000);

    return { first, count: todays.length, startDate, reminderDate };
  }

  function _scheduleCheck() {
    if (_timer) { clearTimeout(_timer); _timer = null; }
    const now = new Date();
    const info = _computeTodayReminder(_lectures, now);
    if (!info) return;
    if (now >= info.startDate) return;      // المحاضرة الأولى بدأت خلاص — فات الأوان
    if (_alreadyShownToday()) return;        // إشعار اليوم اتعرض قبل كده

    if (now >= info.reminderDate) {
      _fire(info);
      return;
    }
    const delay = info.reminderDate.getTime() - now.getTime();
    _timer = setTimeout(_scheduleCheck, Math.min(delay, 2147483000));
  }

  function _fire(info) {
    _markShownToday();
    const timeLabel = _fmtTime12(info.first.startTime);
    const title = "الجدول الدراسي";
    const body = info.count > 1
      ? `لديك ${info.count} محاضرات اليوم. تبدأ أول محاضرة الساعة ${timeLabel}.`
      : `لديك محاضرة اليوم. تبدأ الساعة ${timeLabel}.`;
    if (typeof window.showInAppNotif === "function") {
      window.showInAppNotif(title, body, { type: "studySchedule" }, function () {
        window.StudyScheduleModule && window.StudyScheduleModule.open();
      });
    }
  }

  /* ─────────────────────────────────────────
     الاستماع الحي لمجموعة studySchedule
  ───────────────────────────────────────── */
  function _startListening() {
    import(_FB).then(function (mod) {
      try {
        var _worldId = (typeof window.activeWorldContext === "function") ? window.activeWorldContext() : null;
        mod.onSnapshot(mod.query(mod.collection(window.db, COL), mod.where("worldId", "==", _worldId)), function (snap) {
          // ✅ World Isolation: نفس مصدر العالم الموحّد — activeWorldContext(). لا تنبيه من عالم آخر.
          var _worldId = (typeof window.activeWorldContext === "function") ? window.activeWorldContext() : null;
          _lectures = [];
          snap.forEach(function (d) {
            var data = d.data();
            if (_worldId && data.worldId === _worldId) _lectures.push({ id: d.id, ...data });
          });
          _scheduleCheck();
        });
      } catch (e) { console.error("[StudyScheduleReminder] تعذّر بدء الاستماع:", e); }
    }).catch(function (e) { console.error("[StudyScheduleReminder] فشل تحميل Firestore:", e); });
  }

  // إعادة الحساب تلقائيًا لو عدّى نصف الليل والتبويب لسه مفتوح (يوم دراسي جديد)
  function _startDayWatcher() {
    if (_dayWatcherStarted) return;
    _dayWatcherStarted = true;
    let lastDate = _todayDateStr();
    setInterval(function () {
      const d = _todayDateStr();
      if (d !== lastDate) { lastDate = d; _scheduleCheck(); }
    }, 60000);
  }

  function _waitForUserThenStart() {
    if (window.currentUser && window.db) {
      _startListening();
      _startDayWatcher();
    } else {
      setTimeout(_waitForUserThenStart, 400);
    }
  }
  _waitForUserThenStart();
})();
