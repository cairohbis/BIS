/**
 * ══════════════════════════════════════════
 *   LOST & FOUND MODULE — راحت فين؟
 *   feed.js — تبويب "المفقودات" (منشورات published) + البحث + تفاصيل المنشور
 * ══════════════════════════════════════════
 *
 *  مسؤوليته فقط:
 *   - realtime listener على lostFound حيث status == "published"
 *   - بناء كروت المنشورات + الفلترة المحلية عند البحث
 *   - فتح مودال "تفاصيل المنشور" ويستدعي comments.render() جواه
 *
 *  ما لا يفعله عمدًا:
 *   - لا يكتب أي شيء في Firestore (قراءة فقط)
 *   - لا يغيّر حالة المنشور لـ found — بيفوّض لـ found.markAsFound()
 *   - لا يبني أي منطق تعليقات — بيفوّض لـ comments.render()
 */

(function () {
  "use strict";

  window.__LF = window.__LF || {};
  const core = window.__LF.core;

  let _unsubFeed = null;
  let _allDocs = [];      // آخر نسخة من المنشورات المنشورة (للفلترة المحلية عند البحث)
  let _searchTerm = "";
  let _containerEl = null;

  /* ─────────────────────────────────────────
     الدخول من core.switchView("feed")
  ───────────────────────────────────────── */
  function render(container) {
    _containerEl = container;
    _containerEl.innerHTML = `<div class="lf-loading"><i class="fa-solid fa-spinner fa-spin"></i></div>`;
    startListener();
  }

  async function startListener() {
    // يمنع تكرار الاشتراك لو render() اتنادت تاني من غير إغلاق كامل (مثلاً ضغط التاب أكتر من مرة)
    if (_unsubFeed) { try { _unsubFeed(); } catch (e) {} _unsubFeed = null; }

    let fs;
    try {
      fs = await core.getFS();
    } catch (e) {
      renderError("تعذر الاتصال بقاعدة البيانات");
      return;
    }
    const { db, collection, query, where, orderBy, onSnapshot } = fs;

    // ⚠️ عمدًا من غير limit(): البحث المحلي في renderList() بيفترض إن _allDocs = كل
    // المنشورات المنشورة فعلًا، مش صفحة أولى بس. لو اتضاف limit()/pagination مستقبلًا،
    // لازم البحث يتحول لـ query على السيرفر (where على title/description) بدل الفلترة المحلية،
    // وإلا هيوهم المستخدم إن النتائج شاملة وهي مش كده.
    const q = query(
      collection(db, "lostFound"),
      where("status", "==", "published"),
      orderBy("createdAt", "desc")
    );

    _unsubFeed = onSnapshot(
      q,
      (snap) => {
        _allDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderList();
      },
      (err) => {
        console.error("[LostFound:feed]", err);
        renderError("حدث خطأ أثناء تحميل المنشورات");
      }
    );

    core.registerUnsubscribe(() => {
      if (_unsubFeed) { _unsubFeed(); _unsubFeed = null; }
    });
  }

  /* ─────────────────────────────────────────
     البحث (بينادى من core.js عند الكتابة في lf-search)
  ───────────────────────────────────────── */
  function onSearchInput(term) {
    _searchTerm = (term || "").trim().toLowerCase();
    renderList();
  }

  function renderList() {
    if (!_containerEl) return;

    const docs = _searchTerm
      ? _allDocs.filter(
          (p) =>
            (p.title || "").toLowerCase().includes(_searchTerm) ||
            (p.description || "").toLowerCase().includes(_searchTerm)
        )
      : _allDocs;

    if (docs.length === 0) {
      _containerEl.innerHTML = `
        <div class="lf-empty">
          <i class="fa-solid fa-box-open"></i>
          <p>${_searchTerm ? "مفيش نتائج مطابقة" : "لسه مفيش منشورات"}</p>
        </div>`;
      return;
    }

    _containerEl.innerHTML = `<div class="lf-feed-list">${docs.map(renderPostCard).join("")}</div>`;
    wireCardEvents();
    loadCommentCounts(docs);
  }

  // عدد التعليقات الحقيقي — نفس تقنية getCountFromServer() المستخدمة في إحصائيات found.js،
  // بدل حقل commentsCount مخزّن كان محتاج حماية Rules معقّدة (تعارض تم حله بإلغاء العداد نفسه)
  async function loadCommentCounts(docs) {
    let fs;
    try {
      fs = await core.getFS();
    } catch (e) {
      return; // فشل تحميل الأعداد لا يمنع عرض الفيد نفسه
    }
    const { db, collection, getCountFromServer } = fs;

    docs.forEach(async (post) => {
      try {
        const snap = await getCountFromServer(collection(db, "lostFound", post.id, "comments"));
        const el = _containerEl && _containerEl.querySelector(`.lf-comments-count[data-post-id="${post.id}"]`);
        if (el) el.textContent = `${snap.data().count} تعليق`;
      } catch (e) {
        // فشل عد تعليقات منشور واحد لا يوقف باقي الأعداد
      }
    });
  }

  function renderPostCard(post) {
    const typeLabel = post.type === "lost" ? "مفقود" : "موجود";
    const typeClass = post.type === "lost" ? "lf-badge-lost" : "lf-badge-found";
    const img =
      post.images && post.images[0]
        ? `<div class="lf-post-image"><img src="${core.escapeHtml(post.images[0])}" loading="lazy" alt=""></div>`
        : "";

    return `
      <article class="lf-post-card" data-post-id="${post.id}">
        <div class="lf-post-header">
          ${core.getUserBadge(post.createdByName, post.createdByPhoto)}
          <span class="lf-post-time">${core.formatRelativeTime(post.createdAt)}</span>
        </div>

        <span class="lf-badge ${typeClass}">${typeLabel}</span>
        <h3 class="lf-post-title">${core.escapeHtml(post.title)}</h3>

        ${img}

        <p class="lf-post-desc">${core.escapeHtml(post.description)}</p>

        <div class="lf-post-footer">
          <button class="lf-post-comments-btn" type="button">
            <i class="fa-regular fa-comment"></i>
            <span class="lf-comments-count" data-post-id="${post.id}">…</span>
          </button>
        </div>
      </article>
    `;
  }

  function wireCardEvents() {
    _containerEl.querySelectorAll(".lf-post-card").forEach((card) => {
      card.addEventListener("click", () => openPostDetail(card.dataset.postId));
    });
  }

  /* ─────────────────────────────────────────
     تفاصيل المنشور (مودال) + تحميل التعليقات
  ───────────────────────────────────────── */
  function openPostDetail(postId) {
    const post = _allDocs.find((p) => p.id === postId);
    if (!post) return;

    const typeLabel = post.type === "lost" ? "مفقود" : "موجود";
    const typeClass = post.type === "lost" ? "lf-badge-lost" : "lf-badge-found";
    const img =
      post.images && post.images[0]
        ? `<div class="lf-post-image lf-post-image--full"><img src="${core.escapeHtml(post.images[0])}" alt=""></div>`
        : "";

    const uid = core.state.currentUser && core.state.currentUser.uid;
    const isOwner = uid && uid === post.createdBy;
    const canMarkFound = isOwner || core.state.isAdmin;

    core.openModal(`
      <div class="lf-modal lf-post-detail">
        <button class="lf-modal-close" type="button" aria-label="إغلاق">
          <i class="fa-solid fa-xmark"></i>
        </button>

        <div class="lf-post-header">
          ${core.getUserBadge(post.createdByName, post.createdByPhoto)}
          <span class="lf-post-time">${core.formatRelativeTime(post.createdAt)}</span>
        </div>

        <span class="lf-badge ${typeClass}">${typeLabel}</span>
        <h3 class="lf-post-title">${core.escapeHtml(post.title)}</h3>
        ${post.location ? `<div class="lf-post-location"><i class="fa-solid fa-location-dot"></i> ${core.escapeHtml(post.location)}</div>` : ""}

        ${img}

        <p class="lf-post-desc">${core.escapeHtml(post.description)}</p>

        ${canMarkFound ? `
          <button class="lf-mark-found-btn" type="button" data-post-id="${post.id}">
            <i class="fa-solid fa-circle-check"></i> لقيتها
          </button>` : ""}

        <div class="lf-comments-mount" data-post-id="${post.id}"></div>
      </div>
    `);

    const layer = core.state.root.querySelector(".lf-modal-layer");
    layer.querySelector(".lf-modal-close")?.addEventListener("click", () => core.closeModal());

    layer.querySelector(".lf-mark-found-btn")?.addEventListener("click", (e) => {
      // ملاحظة: إخفاء الزرار هنا (isOwner/isAdmin) واجهة مستخدم بس وليس حماية.
      // التحقق الفعلي من الصلاحية إجباري داخل found.markAsFound() نفسها قبل أي updateDoc،
      // والـ Firestore Rules هي خط الدفاع النهائي بغض النظر عن حالة الزرار هنا.
      const id = e.currentTarget.dataset.postId;
      if (window.__LF.found) window.__LF.found.markAsFound(id);
    });

    const commentsMount = layer.querySelector(".lf-comments-mount");
    if (commentsMount && window.__LF.comments) {
      window.__LF.comments.render(post.id, commentsMount);
    }
  }

  function renderError(msg) {
    if (!_containerEl) return;
    _containerEl.innerHTML = `
      <div class="lf-error">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <p>${core.escapeHtml(msg)}</p>
      </div>`;
  }

  window.__LF.feed = { render, onSearchInput };
})();
