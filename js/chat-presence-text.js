/* ══════════════════════════════════════════════════════════════
   CHAT HEADER PRESENCE TEXT — نص هيدر الشات لمحادثات الـ DM
   ▸ يربط #chatTopOnline بنظام الحضور/آخر ظهور الموجودين بالفعل
     (window._isOnlineVisible + window._userCache من index.html)
   ▸ لا يقرأ ولا يكتب أي شيء في Firestore — تنسيق نص + مؤقّت محلي فقط
   ▸ لا يتحكم إلا في المسار الخاص بالـ DM. حالات "مباشر — الجميع" /
     "غرفة عامة" / "يكتب الآن..." يبقى التحكم فيها كما هو في index.html
   ▸ نقاط الوصول (window._isOnlineVisible, window._userCache) بيُقرأوا
     وقت التشغيل فقط (lazy)، فترتيب تحميل هذا الملف نسبةً لسكريبت
     index.html الرئيسي غير حساس — يكفي تحميله بعد dm-extras.js
   ══════════════════════════════════════════════════════════════ */

// تنسيق قيمة lastSeen (Firestore Timestamp أو {seconds}) إلى نص عربي
// مطابق لشكل الـ placeholder الأصلي في index.html: "آخر ظهور HH:MM الساعة D شهر"
function formatLastSeen(lastSeen) {
  const ms = lastSeen?.toMillis?.() || (lastSeen?.seconds ? lastSeen.seconds * 1000 : 0);
  if (!ms) return "آخر ظهور غير معروف";

  const d   = new Date(ms);
  const now = new Date();
  const time = d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: true });

  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth()    === now.getMonth()    &&
    d.getDate()     === now.getDate();
  if (isToday) return `آخر ظهور ${time}`;

  const day   = d.toLocaleDateString("ar-EG", { day: "numeric" });
  const month = d.toLocaleDateString("ar-EG", { month: "long" });
  return `آخر ظهور ${time} الساعة ${day} ${month}`;
}
window.formatLastSeen = formatLastSeen;

// النص الحقيقي لحالة مستخدم DM معيّن: "متصل" أو "آخر ظهور ..."
// (بدون أي علاقة بحالة الكتابة — دي مسؤولية _startTypingListener في index.html)
function _dmPresenceText(chatId) {
  const cached = window._userCache?.[chatId];
  const u = cached?.data || cached || {};
  const isOnline = typeof window._isOnlineVisible === "function" ? window._isOnlineVisible(u) : false;
  return isOnline ? "متصل" : formatLastSeen(u.lastSeen);
}
window._dmPresenceText = _dmPresenceText;

// إعادة رسم #chatTopOnline بالحالة الحقيقية لمحادثة DM معيّنة.
// تُستدعى من _updateChatHeaderPresence() عند فتح المحادثة، ومن
// _startTypingListener() عند توقف الكتابة، ومن المؤقّت الدوري أدناه.
function _renderDmHeaderPresence(chatId) {
  const statusEl = document.getElementById("chatTopOnline");
  if (!statusEl) return;
  statusEl.textContent = _dmPresenceText(chatId);
}
window._renderDmHeaderPresence = _renderDmHeaderPresence;

/* ── مؤقّت محلي خفيف لتحديث نص "آخر ظهور" مع مرور الوقت ──────────
   - لا يقرأ Firestore إطلاقًا: بيعيد بس تنسيق lastSeen الموجود
     بالفعل في _userCache (نفس الكاش اللي بيحدّثه الـ VIP listener).
   - مؤقّت واحد فقط في أي وقت (window._dmHeaderRefreshTimer)، بيتم
     مسحه قبل ما يتعمل واحد جديد → مفيش تكرار عند فتح أكتر من DM.
   - بيتوقف تلقائيًا عند الانتقال لمحادثة عامة/غرفة (عبر
     _stopDmHeaderPresenceRefresh من _updateChatHeaderPresence).
   - بيتجاهل نفسه أثناء عرض "يكتب الآن..." (window._headerTypingNow)
     عشان مايكتبش فوق نص الكتابة.
   ────────────────────────────────────────────────────────────── */
window._dmHeaderRefreshChatId = null;

function _startDmHeaderPresenceRefresh(chatId) {
  window._dmHeaderRefreshChatId = chatId;
  if (window._dmHeaderRefreshTimer) clearInterval(window._dmHeaderRefreshTimer);
  window._dmHeaderRefreshTimer = setInterval(() => {
    if (window._currentChatId !== window._dmHeaderRefreshChatId) return; // انتقل لمحادثة تانية
    if (window._headerTypingNow) return; // typing listener هو المتحكم في النص حاليًا
    _renderDmHeaderPresence(window._dmHeaderRefreshChatId);
  }, 2000);
}
window._startDmHeaderPresenceRefresh = _startDmHeaderPresenceRefresh;

function _stopDmHeaderPresenceRefresh() {
  if (window._dmHeaderRefreshTimer) clearInterval(window._dmHeaderRefreshTimer);
  window._dmHeaderRefreshTimer  = null;
  window._dmHeaderRefreshChatId = null;
}
window._stopDmHeaderPresenceRefresh = _stopDmHeaderPresenceRefresh;
