/**
 * ══════════════════════════════════════════
 *   LOST & FOUND MODULE — راحت فين؟
 *   core.js — الحالة المشتركة + هيكل الواجهة
 * ══════════════════════════════════════════
 *
 *  مسؤوليته فقط:
 *   - الحالة المشتركة (state) بين كل ملفات الميزة
 *   - بناء الـ Skeleton الأساسي (tabs + toolbar + content + modal layer)
 *   - التنقل بين التابات (switchView)
 *   - طبقة المودال المشتركة (openModal/closeModal)
 *   - accessor واحد لـ Firestore (getFS) — نفس نمط grades.js بالظبط
 *   - Helpers عامة: escapeHtml / formatRelativeTime / getUserBadge
 *   - تسجيل وفكّ الـ onSnapshot listeners (registerUnsubscribe / teardown)
 *
 *  ما لا يفعله عمدًا:
 *   - لا يعرف شيئًا عن شكل بيانات "منشور" أو "تعليق"
 *   - لا يقرأ ولا يكتب في أي Firestore query مباشرة
 *   - لا يبني أي محتوى خاص بالمفقودات/الأرشيف/الإدارة (مسؤولية الملفات التانية)
 */

(function () {
  "use strict";

  if (window.__LF && window.__LF.core) return; // منع تسجيل مزدوج لو الملف اتحمّل مرتين بالغلط

  window.__LF = window.__LF || {};

  /* ─────────────────────────────────────────
     الحالة المشتركة
  ───────────────────────────────────────── */
  const state = {
    root: null,
    currentView: "feed",
    isAdmin: false,
    currentUser: null,
    unsubscribers: [],
    shellBuilt: false, // يمنع إعادة renderShell (وبالتالي تكرار الـ event listeners) لو init() اتنادت من غير إغلاق كامل قبلها
  };

  /* ─────────────────────────────────────────
     Firestore accessor — نفس نمط grades.js
  ───────────────────────────────────────── */
  const _FB = "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  async function getFS() {
    const db = window.db;
    if (!db) throw new Error("Firebase غير متاح");
    return { db, ...(await import(_FB)) };
  }

  /* ─────────────────────────────────────────
     Helpers عامة
  ───────────────────────────────────────── */
  function escapeHtml(s) {
    if (!s) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // نفس صياغة الوقت النسبي المستخدمة في notif-panel.js بالظبط، عشان الاتساق البصري مع باقي الموقع
  function formatRelativeTime(ts) {
    if (!ts) return "";
    const ms = typeof ts === "number" ? ts : (ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime());
    const diff = Date.now() - ms;
    if (diff < 60000) return "الآن";
    if (diff < 3600000) return `منذ ${Math.floor(diff / 60000)} د`;
    if (diff < 86400000) return `منذ ${Math.floor(diff / 3600000)} س`;
    if (diff < 172800000) return "أمس";
    return new Date(ms).toLocaleDateString("ar-EG", { month: "short", day: "numeric" });
  }

  function getUserBadge(name, photo) {
    const safeName = escapeHtml(name || "مستخدم");
    const avatar = photo
      ? `<img class="lf-avatar" src="${escapeHtml(photo)}" alt="">`
      : `<span class="lf-avatar lf-avatar-fallback"><i class="fa-solid fa-user"></i></span>`;
    return `<span class="lf-user-badge">${avatar}<span class="lf-user-name">${safeName}</span></span>`;
  }

  function registerUnsubscribe(fn) {
    if (typeof fn === "function") state.unsubscribers.push(fn);
  }

  function teardown() {
    state.unsubscribers.forEach((fn) => {
      try { fn(); } catch (e) { console.error("[LostFound] فشل إلغاء اشتراك:", e); }
    });
    state.unsubscribers = [];
    closeModal();
  }

  /* ─────────────────────────────────────────
     طبقة المودال المشتركة
  ───────────────────────────────────────── */
  function openModal(html) {
    const layer = state.root && state.root.querySelector(".lf-modal-layer");
    if (!layer) return;
    layer.innerHTML = html;
    layer.hidden = false;
  }

  function closeModal() {
    const layer = state.root && state.root.querySelector(".lf-modal-layer");
    if (!layer) return;
    layer.hidden = true;
    layer.innerHTML = "";
  }

  /* ─────────────────────────────────────────
     الـ Skeleton
  ───────────────────────────────────────── */
  function renderShell(root) {
    state.isAdmin = !!(window.isAdmin && window.isAdmin());

    root.innerHTML = `
      <div class="lf-sheet">
        <div class="lf-handle"></div>

        <header class="lf-header">
          <h2>راحت فين؟</h2>
          <button class="lf-close-btn" aria-label="إغلاق" type="button">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </header>

        <nav class="lf-tabs">
          <button class="lf-tab active" data-view="feed" type="button">المفقودات</button>
          <button class="lf-tab" data-view="found" type="button">لقيتها</button>
          ${state.isAdmin ? `<button class="lf-tab" data-view="admin" type="button">طلبات المراجعة</button>` : ""}
        </nav>

        <div class="lf-toolbar">
          <div class="lf-search-wrap">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="search" class="lf-search" placeholder="بحث عن مفقود أو موجود...">
          </div>
          <button class="lf-new-post-btn" type="button">
            <i class="fa-solid fa-plus"></i> نشر مفقودات
          </button>
        </div>

        <main class="lf-content">
          <section class="lf-view" data-view="feed"></section>
          <section class="lf-view" data-view="found" hidden></section>
          ${state.isAdmin ? `<section class="lf-view" data-view="admin" hidden></section>` : ""}
        </main>
      </div>

      <div class="lf-modal-layer" hidden></div>
    `;

    wireShellEvents(root);
  }

  function wireShellEvents(root) {
    root.querySelector(".lf-close-btn")?.addEventListener("click", () => {
      window.LostFoundModule && window.LostFoundModule.close();
    });

    root.querySelectorAll(".lf-tab").forEach((tab) => {
      tab.addEventListener("click", () => switchView(tab.dataset.view));
    });

    root.querySelector(".lf-new-post-btn")?.addEventListener("click", () => {
      if (window.__LF.post) window.__LF.post.openCreateForm();
    });

    root.querySelector(".lf-search")?.addEventListener("input", (e) => {
      if (window.__LF.feed) window.__LF.feed.onSearchInput(e.target.value);
    });

    // إغلاق المودال بالضغط على الخلفية بس (مش على محتواه)
    root.querySelector(".lf-modal-layer")?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
  }

  /* ─────────────────────────────────────────
     التنقل بين التابات
  ───────────────────────────────────────── */
  function switchView(viewName) {
    if (!state.root) return;
    state.currentView = viewName;

    state.root.querySelectorAll(".lf-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.view === viewName);
    });
    state.root.querySelectorAll(".lf-view").forEach((v) => {
      v.hidden = v.dataset.view !== viewName;
    });

    const toolbar = state.root.querySelector(".lf-toolbar");
    if (toolbar) toolbar.style.display = viewName === "feed" ? "" : "none";

    const container = state.root.querySelector(`.lf-view[data-view="${viewName}"]`);
    if (!container) return;

    if (viewName === "feed" && window.__LF.feed) window.__LF.feed.render(container);
    else if (viewName === "found" && window.__LF.found) window.__LF.found.render(container);
    else if (viewName === "admin" && state.isAdmin && window.__LF.admin) window.__LF.admin.render(container);
  }

  /* ─────────────────────────────────────────
     التهيئة والعرض/الإخفاء
  ───────────────────────────────────────── */
  function init(root) {
    if (!root) { console.error("[LostFound] lost-found-app-root غير موجود"); return; }
    state.root = root;
    state.currentUser = window.currentUser || null;

    // idempotent: لو الهيكل مبني بالفعل (فتح سابق لسه ما اتقفلش صح) منعيدش بناءه ولا نسجل الـ listeners تاني
    if (state.shellBuilt) return;

    renderShell(root);
    state.shellBuilt = true;
    switchView("feed");
  }

  function mountRoot() {
    if (!state.root) return;
    state.root.style.display = "flex";
  }

  function unmountRoot() {
    if (!state.root) return;
    state.root.style.display = "none";
    state.root.innerHTML = ""; // نفس نمط grades.js: تفريغ الـ DOM، الملفات نفسها تفضل محمّلة في الذاكرة
    state.shellBuilt = false; // يسمح بإعادة بناء الهيكل (ومعاه الـ listeners) بشكل نظيف في الفتحة الجاية
  }

  // الترتيب الصحيح والوحيد المعتمد للإغلاق الكامل: فكّ الـ listeners وonSnapshot أولًا (وجواها بيتقفل أي Modal مفتوح)، وبعد كده تفريغ الـ root
  // lost-found.js بينادي الدالة دي بس، مش الثلاثة لوحدهم، عشان الترتيب يفضل مضمون دايمًا مهما كان شكل ملف الدخول لاحقًا
  function shutdown() {
    teardown();
    unmountRoot();
  }

  /* ─────────────────────────────────────────
     التصدير
  ───────────────────────────────────────── */
  window.__LF.core = {
    state,
    getFS,
    escapeHtml,
    formatRelativeTime,
    getUserBadge,
    registerUnsubscribe,
    teardown,
    shutdown,
    openModal,
    closeModal,
    switchView,
    init,
    mountRoot,
    unmountRoot,
  };
})();
