/**
 * ══════════════════════════════════════════
 *   ACCOUNT ARCHIVE — أرشيف الحساب
 *   سجل تغييرات لكل مستخدم، يظهر للمالك فقط من داخل بروفايل المستخدم.
 *
 *   ▸ التسجيل: window.AccountArchive.log(uid, type, from, to)
 *     يُستدعى من نفس أماكن التغيير الموجودة (لا نظام حساب جديد)،
 *     ويُكتب وقت حدوث التغيير نفسه في: users/{uid}/archive/{id}
 *   ▸ إضافة فقط: لا تعديل ولا حذف للسجلات بعد إنشائها (من الـRules)
 *   ▸ كلمة المرور: يُسجَّل «تم تغيير كلمة المرور» فقط بلا أي قيمة
 *   ▸ فشل التسجيل لا يؤثر أبدًا على العملية الأصلية
 *
 *   ⚠️ نقطة معروفة: التسجيل يتم من جهاز المستخدم (لا Cloud Function)،
 *      فمستخدم متمرس يستطيع تجاوزه أو إضافة سجل مزيّف لأرشيفه هو فقط.
 *      الضمان الكامل يحتاج Cloud Function في مرحلة لاحقة.
 *
 *   ▸ القواعد المطلوبة في Firestore Rules (إضافة فقط):
 *       match /users/{uid}/archive/{archiveId} {
 *         allow read: if isOwner();
 *         allow create: if isSignedIn()
 *           && (request.auth.uid == uid || isAdmin())
 *           && request.resource.data.actorUid == request.auth.uid
 *           && request.resource.data.createdAt == request.time;
 *         allow update, delete: if false;
 *       }
 * ══════════════════════════════════════════
 */

(function () {
  "use strict";
  if (window.AccountArchive) return;

  const _FB  = "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  const MAX  = 500;
  const LIMIT = 200;

  async function _fs() {
    if (!window.db) throw new Error("Firebase غير متاح");
    return { db: window.db, ...(await import(_FB)) };
  }
  function _clip(v) { return v == null ? null : String(v).slice(0, MAX); }
  function _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function _isOwner() { return !!(window.isOwner && window.isOwner()); }
  function _safeImg(u) { return typeof u === "string" && u.startsWith("https://res.cloudinary.com/"); }

  const ROLE_LBL = { owner: "مالك", admin: "أدمن", user: "مستخدم" };
  const STATE_LBL = { banned: "محظور", unbanned: "غير محظور", active: "نشط" };
  const TYPES = {
    name:     { icon: "fa-signature",   title: () => "تغيير الاسم" },
    bio:      { icon: "fa-align-right", title: () => "تعديل النبذة" },
    photo:    { icon: "fa-image",       title: () => "تغيير الصورة الشخصية" },
    password: { icon: "fa-key",         title: () => "تم تغيير كلمة المرور" },
    role:     { icon: "fa-user-shield", title: () => "تغيير الصلاحية" },
    ban:      { icon: "fa-ban",         title: e => e.to === "banned" ? "حظر الحساب" : "رفع حظر الحساب" },
    chatBan:  { icon: "fa-comment-slash", title: e => e.to === "banned" ? "حظر من الشات" : "رفع حظر الشات" }
  };

  /* ─────────────────────────────────────────
     التسجيل
  ───────────────────────────────────────── */
  async function log(uid, type, from, to) {
    try {
      const cu = window.currentUser;
      if (!uid || !type || !cu || !TYPES[type]) return;
      const { db, collection, addDoc, serverTimestamp } = await _fs();
      const rec = {
        type,
        actorUid:  cu.uid,
        actorName: _clip(window._currentUserData?.name || ""),
        source:    cu.uid === uid ? "self" : (_isOwner() ? "owner" : "admin"),
        createdAt: serverTimestamp()
      };
      if (type !== "password") { rec.from = _clip(from); rec.to = _clip(to); }
      await addDoc(collection(db, "users", uid, "archive"), rec);
    } catch (e) { /* غير حرج — لا يؤثر على العملية الأصلية */ }
  }

  /* ─────────────────────────────────────────
     العرض (للمالك فقط)
  ───────────────────────────────────────── */
  function _valHTML(type, v) {
    if (v == null || v === "") return `<span class="aa-empty">— فارغ —</span>`;
    if (type === "photo") return _safeImg(v) ? `<img class="aa-thumb" src="${_esc(v)}" alt="" loading="lazy">` : `<span class="aa-val">${_esc(v)}</span>`;
    if (type === "role")  return `<span class="aa-val">${_esc(ROLE_LBL[v] || v)}</span>`;
    if (type === "ban" || type === "chatBan") return `<span class="aa-val">${_esc(STATE_LBL[v] || v)}</span>`;
    return `<span class="aa-val">${_esc(v)}</span>`;
  }

  function _dayBucket(d) {
    const now = new Date();
    const sod = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((sod(now) - sod(d)) / 86400000);
    if (diff <= 0) return "اليوم";
    if (diff === 1) return "أمس";
    if (diff < 7)  return "هذا الأسبوع";
    return "أقدم";
  }
  function _ago(d) {
    const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (s < 60) return "الآن";
    if (s < 3600) return `منذ ${Math.floor(s / 60)} دقيقة`;
    if (s < 86400) return `منذ ${Math.floor(s / 3600)} ساعة`;
    return `منذ ${Math.floor(s / 86400)} يوم`;
  }
  function _fmt(d) {
    const day = d.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
    const tm  = d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    return `${day} — ${tm}`;
  }

  function _card(e) {
    const T = TYPES[e.type];
    const d = e.createdAt && e.createdAt.toDate ? e.createdAt.toDate() : null;
    const src = e.source === "self" ? "بواسطة صاحب الحساب" : `بواسطة ${e.source === "owner" ? "المالك" : "أدمن"}${e.actorName ? " — " + _esc(e.actorName) : ""}`;
    const body = e.type === "password"
      ? `<div class="aa-note">لم يتم حفظ أي كلمة مرور</div>`
      : `<div class="aa-change">
           <div class="aa-side"><span class="aa-lbl">من</span>${_valHTML(e.type, e.from)}</div>
           <i class="fa-solid fa-arrow-left aa-arrow"></i>
           <div class="aa-side"><span class="aa-lbl">إلى</span>${_valHTML(e.type, e.to)}</div>
         </div>`;
    return `<div class="aa-card" onclick="this.classList.toggle('open')">
      <div class="aa-dot"><i class="fa-solid ${T.icon}"></i></div>
      <div class="aa-card-head">
        <span class="aa-card-title">${_esc(T.title(e))}</span>
        <span class="aa-time">${d ? d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
      </div>
      ${body}
      <div class="aa-details">
        <div>${d ? _esc(_fmt(d)) : ""}</div>
        <div>${src}</div>
      </div>
    </div>`;
  }

  function _root() {
    let r = document.getElementById("account-archive-root");
    if (!r) {
      r = document.createElement("div");
      r.id = "account-archive-root";
      document.body.appendChild(r);
    }
    return r;
  }

  async function open(uid, name) {
    if (!_isOwner() || !uid) return;
    const root = _root();
    root.classList.add("aa-open");
    root.innerHTML = `
      <div class="aa-overlay" onclick="window.AccountArchive.close()"></div>
      <div class="aa-sheet">
        <div class="aa-header">
          <button class="aa-back" onclick="window.AccountArchive.close()"><i class="fa-solid fa-xmark"></i></button>
          <div class="aa-titles">
            <div class="aa-title"><i class="fa-solid fa-clock-rotate-left"></i> أرشيف ${_esc(name || "الحساب")}</div>
            <div class="aa-sub" id="aaSub">جارِ التحميل...</div>
          </div>
        </div>
        <div class="aa-body" id="aaBody"><div class="aa-loading"><div class="aa-spin"></div></div></div>
      </div>`;

    try {
      const { db, collection, query, orderBy, limit, getDocs } = await _fs();
      const snap = await getDocs(query(collection(db, "users", uid, "archive"), orderBy("createdAt", "desc"), limit(LIMIT)));
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => TYPES[e.type]);
      const body = document.getElementById("aaBody");
      const sub  = document.getElementById("aaSub");
      if (!body) return;
      if (!items.length) {
        if (sub) sub.textContent = "لا توجد سجلات";
        body.innerHTML = `<div class="aa-emptybox"><div class="aa-empty-ic"><i class="fa-solid fa-box-archive"></i></div><div>لا توجد تغييرات مسجّلة لهذا الحساب بعد</div></div>`;
        return;
      }
      const first = items[0].createdAt && items[0].createdAt.toDate ? items[0].createdAt.toDate() : null;
      if (sub) sub.textContent = first ? `آخر تحديث ${_ago(first)} · ${items.length} سجل` : `${items.length} سجل`;

      const groups = [], order = ["اليوم", "أمس", "هذا الأسبوع", "أقدم"], map = {};
      items.forEach(e => {
        const d = e.createdAt && e.createdAt.toDate ? e.createdAt.toDate() : new Date(0);
        const b = _dayBucket(d);
        (map[b] = map[b] || []).push(e);
      });
      order.forEach(b => { if (map[b]) groups.push(b); });
      body.innerHTML = groups.map(b => `
        <div class="aa-group">
          <div class="aa-group-title">${b}</div>
          <div class="aa-tl">${map[b].map(_card).join("")}</div>
        </div>`).join("");
    } catch (e) {
      const body = document.getElementById("aaBody");
      const sub  = document.getElementById("aaSub");
      if (sub) sub.textContent = "";
      if (body) body.innerHTML = `<div class="aa-emptybox"><div>تعذّر تحميل الأرشيف</div></div>`;
    }
  }

  function close() {
    const r = document.getElementById("account-archive-root");
    if (r) { r.classList.remove("aa-open"); r.innerHTML = ""; }
  }

  window.AccountArchive = { log, open, close };
})();
