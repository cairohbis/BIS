/* ============================================================
   forum-badges.js — نظام تنبيهات حقيقي (Unread Badges) لكروت المنتدى
   ------------------------------------------------------------
   - ملف مستقل تمامًا: لا يعدّل أي كود موجود، بيضيف بس.
   - العداد لكل كارت = عدد العناصر الجديدة بعد آخر مرة فتح المستخدم الكارت.
   - عداد الشريط السفلي (تبويب "المنتدى") = عدد الكروت (مش العناصر) اللي فيها جديد.
   - آخر وقت قراءة بيتخزن في: users/{uid}/cardReads/{cardKey}
     (يحتاج إضافة صغيرة في firestore.rules — راجع firestore.rules.forum-badges-patch.txt)
   ============================================================ */
(function () {
  "use strict";

  // كل كارت وبياناته الحقيقية (بعد فحص كل ملف مصدره فعليًا)
  const SOURCES = [
    { key: "news",          iconClass: "forum-card-icon--news",          col: "news",              timeField: "createdAt", worldScoped: true },
    { key: "lectures",      iconClass: "forum-card-icon--lectures",      col: "lectures",           timeField: "createdAt", worldScoped: true },
    { key: "exams",         iconClass: "forum-card-icon--exams",         col: "exams",              timeField: "createdAt", worldScoped: true },
    { key: "sections",      iconClass: "forum-card-icon--sections",      col: "sections",           timeField: "createdAt", worldScoped: true },
    { key: "studyschedule", iconClass: "forum-card-icon--studyschedule", col: "studySchedule",      timeField: "createdAt", worldScoped: true },
    { key: "sheetaty",      iconClass: "forum-card-icon--sheetaty",      col: "sheets",             timeField: "createdAt", worldScoped: true },
    { key: "grades",        iconClass: "forum-card-icon--grades",        col: "records",            timeField: "updatedAt", underUser: true },
    { key: "lostfound",     iconClass: "forum-card-icon--lostfound",     col: "lostFound",          timeField: "createdAt", statusIn: ["published", "found"] },
    { key: "military",      iconClass: "forum-card-icon--military",      col: "militaryMaterials",  timeField: "createdAt" },
    { key: "instructions",  iconClass: "forum-card-icon--instructions",  col: "instructions",       timeField: "updatedAt", kind: "smallCollection" },
    { key: "tuition",       iconClass: "forum-card-icon--tuition",       col: "tuitionFees",        timeField: "updatedAt", kind: "singleDoc" },
  ];

  let _db, _fs, _uid, _worldId;
  const _counts = {};   // key -> عدد حالي
  const _unsubs = {};   // key -> دالة إلغاء الاشتراك الحالية

  // ── الشكل (badge أحمر فاتح على الكارت + badge أحمر غامق نابض على شريط "المنتدى") ──
  function _injectStyles() {
    if (document.getElementById("forumBadgeStyles")) return;
    const s = document.createElement("style");
    s.id = "forumBadgeStyles";
    s.textContent =
      ".forum-section-card{position:relative}" +
      ".fb-badge{position:absolute;top:6px;left:6px;min-width:18px;height:18px;padding:0 5px;" +
      "border-radius:999px;background:#ff6b6b;color:#fff;font-size:11px;font-weight:700;" +
      "line-height:18px;text-align:center;box-shadow:0 0 0 2px rgba(0,0,0,.15);z-index:2;direction:ltr}" +
      ".nav-item[data-nav=\"tab-forum\"]{position:relative}" +
      ".fb-nav-badge{position:absolute;top:2px;left:50%;transform:translateX(8px);min-width:16px;height:16px;" +
      "padding:0 4px;border-radius:999px;background:#b30000;color:#fff;font-size:10px;font-weight:700;" +
      "line-height:16px;text-align:center;box-shadow:0 0 0 2px rgba(0,0,0,.2);" +
      "animation:fbPulse 1.6s ease-in-out infinite;z-index:3;direction:ltr}" +
      "@keyframes fbPulse{0%,100%{transform:translateX(8px) scale(1)}50%{transform:translateX(8px) scale(1.2)}}";
    document.head.appendChild(s);
  }

  function _cardEl(src) {
    const icon = document.querySelector("." + src.iconClass);
    return icon ? icon.closest(".forum-section-card") : null;
  }

  function _renderCard(src) {
    const el = _cardEl(src);
    if (!el) return;
    const n = _counts[src.key] || 0;
    let badge = el.querySelector(":scope > .fb-badge");
    if (n <= 0) { if (badge) badge.remove(); return; }
    if (!badge) { badge = document.createElement("span"); badge.className = "fb-badge"; el.appendChild(badge); }
    badge.textContent = n > 99 ? "99+" : String(n);
  }

  function _renderNav() {
    const nav = document.querySelector('.nav-item[data-nav="tab-forum"]');
    if (!nav) return;
    let unreadCards = 0;
    SOURCES.forEach((s) => { if ((_counts[s.key] || 0) > 0) unreadCards++; });
    let badge = nav.querySelector(":scope > .fb-nav-badge");
    if (unreadCards <= 0) { if (badge) badge.remove(); return; }
    if (!badge) { badge = document.createElement("span"); badge.className = "fb-nav-badge"; nav.appendChild(badge); }
    badge.textContent = unreadCards > 99 ? "99+" : String(unreadCards);
  }

  function _renderAll() { SOURCES.forEach(_renderCard); _renderNav(); }

  // أول مرة يفتح فيها المستخدم التطبيق بعد تفعيل الميزة: نعتبر كل الموجود حاليًا "مقروء"
  // عشان محدش ياخد رقم ضخم غلط لمحتوى قديم أصلًا.
  async function _lastSeenOrInit(key) {
    const ref = _fs.doc(_db, "users", _uid, "cardReads", key);
    try {
      const snap = await _fs.getDoc(ref);
      if (snap.exists() && snap.data().lastSeenAt) return snap.data().lastSeenAt;
      const now = _fs.Timestamp.now();
      await _fs.setDoc(ref, { lastSeenAt: now }, { merge: true });
      return now;
    } catch (e) { return null; }
  }

  async function _markRead(key) {
    _counts[key] = 0;
    _renderAll();
    try {
      await _fs.setDoc(
        _fs.doc(_db, "users", _uid, "cardReads", key),
        { lastSeenAt: _fs.serverTimestamp() },
        { merge: true }
      );
    } catch (e) { /* تجاهل — هيتظبط تاني وقت أول onSnapshot جاي */ }
    // لازم نعيد بناء الاستماع بعتبة الوقت الجديدة، وإلا الاستماع القديم
    // هيفضل يعد نفس العناصر القديمة تاني (الاستماع مش بيعيد تقييم شرطه لوحده).
    const src = SOURCES.find((s) => s.key === key);
    if (src) _watch(src);
  }

  async function _watch(src) {
    if (_unsubs[src.key]) { try { _unsubs[src.key](); } catch (e) {} }

    const lastSeen = await _lastSeenOrInit(src.key);

    if (src.kind === "singleDoc") {
      const ref = _fs.doc(_db, src.col, _worldId || "_none_");
      _unsubs[src.key] = _fs.onSnapshot(ref, (snap) => {
        const t = snap.exists() ? snap.data()[src.timeField] : null;
        _counts[src.key] = (t && (!lastSeen || t.toMillis() > lastSeen.toMillis())) ? 1 : 0;
        _renderCard(src); _renderNav();
      }, () => { _counts[src.key] = 0; _renderCard(src); _renderNav(); });
      return;
    }

    if (src.kind === "smallCollection") {
      _unsubs[src.key] = _fs.onSnapshot(_fs.collection(_db, src.col), (snap) => {
        let n = 0;
        snap.forEach((d) => {
          const t = d.data()[src.timeField];
          if (t && (!lastSeen || t.toMillis() > lastSeen.toMillis())) n++;
        });
        _counts[src.key] = n;
        _renderCard(src); _renderNav();
      }, () => { _counts[src.key] = 0; _renderCard(src); _renderNav(); });
      return;
    }

    const col = src.underUser
      ? _fs.collection(_db, "grades", _uid, src.col)
      : _fs.collection(_db, src.col);

    const clauses = [];
    if (src.worldScoped) clauses.push(_fs.where("worldId", "==", _worldId));
    if (src.statusIn)    clauses.push(_fs.where("status", "in", src.statusIn));
    if (lastSeen)         clauses.push(_fs.where(src.timeField, ">", lastSeen));

    const q = clauses.length ? _fs.query(col, ...clauses) : col;

    _unsubs[src.key] = _fs.onSnapshot(q, (snap) => {
      _counts[src.key] = snap.size;
      _renderCard(src); _renderNav();
    }, () => { _counts[src.key] = 0; _renderCard(src); _renderNav(); });
  }

  function _bindResetOnClick() {
    const grid = document.getElementById("forum-landing");
    if (!grid) return;
    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".forum-section-card");
      if (!card) return;
      const src = SOURCES.find((s) => card.querySelector("." + s.iconClass));
      if (src) _markRead(src.key);
    });
  }

  async function _boot() {
    if (!window.db || !window.currentUser || !window.currentUser.uid) {
      setTimeout(_boot, 800);
      return;
    }
    _db  = window.db;
    _uid = window.currentUser.uid;
    _worldId = (typeof window.activeWorldContext === "function") ? window.activeWorldContext() : null;

    try {
      _fs = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    } catch (e) { return; }

    _injectStyles();
    _bindResetOnClick();
    SOURCES.forEach(_watch);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _boot);
  } else {
    _boot();
  }
})();
