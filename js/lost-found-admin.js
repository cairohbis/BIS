/**
 * ══════════════════════════════════════════
 *   LOST & FOUND MODULE — راحت فين؟
 *   admin.js — طلبات المراجعة (يظهر بس لو isAdmin())
 * ══════════════════════════════════════════
 *
 *  مسؤوليته فقط:
 *   - عرض طلبات pending/rejected كاملة (وصف + صور + بيانات صاحب الطلب)
 *   - الموافقة / الرفض (بسبب) / طلب استكمال بيانات (بملاحظة)
 *   - تفويض "نشر مباشر" لـ post.openCreateForm({directPublish:true})
 *   - هو المكان الوحيد اللي بيكتب approvedBy/rejectedBy/adminNote
 *
 *  ما لا يفعله عمدًا:
 *   - لا يبني فورم نشر من جديد (نشر مباشر = post.js نفسه بـ flag)
 *   - لا يلمس حالة found (مسؤولية found.js فقط)
 *   - كل دالة كتابة بتتحقق isAdmin() بنفسها أولًا، دفاع إضافي رغم إن الملف
 *     أصلًا مش بيتحمّل غير للأدمن (loader في lost-found.js)
 */

(function () {
  "use strict";

  window.__LF = window.__LF || {};
  const core = window.__LF.core;

  let _unsubQueue = null;

  /* ─────────────────────────────────────────
     الدخول من core.switchView("admin")
  ───────────────────────────────────────── */
  function render(container) {
    container.innerHTML = `
      <div class="lf-admin-toolbar">
        <button type="button" class="lf-direct-publish-btn">
          <i class="fa-solid fa-bullhorn"></i> نشر مباشر
        </button>
      </div>
      <div class="lf-admin-queue"><div class="lf-loading"><i class="fa-solid fa-spinner fa-spin"></i></div></div>
    `;

    container.querySelector(".lf-direct-publish-btn")?.addEventListener("click", () => {
      if (window.__LF.post) window.__LF.post.openCreateForm({ directPublish: true });
    });

    startListener(container);
  }

  async function startListener(container) {
    if (_unsubQueue) { try { _unsubQueue(); } catch (e) {} _unsubQueue = null; }

    const listEl = container.querySelector(".lf-admin-queue");

    let fs;
    try {
      fs = await core.getFS();
    } catch (e) {
      renderError(listEl, "تعذر الاتصال بقاعدة البيانات");
      return;
    }
    const { db, collection, query, where, orderBy, onSnapshot } = fs;

    const worldId = (typeof window.activeWorldContext === "function") ? window.activeWorldContext() : null;

    const q = query(
      collection(db, "lostFound"),
      where("status", "in", ["pending", "rejected"]),
      where("worldId", "==", worldId),
      orderBy("createdAt", "desc")
    );

    _unsubQueue = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderQueue(listEl, docs);
      },
      (err) => {
        console.error("[LostFound:admin]", err);
        renderError(listEl, "حدث خطأ أثناء تحميل الطلبات");
      }
    );

    core.registerUnsubscribe(() => {
      if (_unsubQueue) { _unsubQueue(); _unsubQueue = null; }
    });
  }

  function renderQueue(listEl, docs) {
    if (!listEl) return;

    if (docs.length === 0) {
      listEl.innerHTML = `
        <div class="lf-empty">
          <i class="fa-solid fa-inbox"></i>
          <p>مفيش طلبات محتاجة مراجعة دلوقتي</p>
        </div>`;
      return;
    }

    listEl.innerHTML = docs.map(renderRequestCard).join("");
    wireQueueEvents(listEl);
  }

  function renderRequestCard(post) {
    const typeLabel = post.type === "lost" ? "مفقود" : "موجود";
    const isPending = post.status === "pending";
    const img =
      post.images && post.images[0]
        ? `<div class="lf-post-image"><img src="${core.escapeHtml(post.images[0])}" loading="lazy" alt=""></div>`
        : "";

    return `
      <article class="lf-admin-card" data-post-id="${post.id}">
        <div class="lf-post-header">
          ${core.getUserBadge(post.createdByName, post.createdByPhoto)}
          <span class="lf-post-time">${core.formatRelativeTime(post.createdAt)}</span>
        </div>

        <span class="lf-badge ${post.type === "lost" ? "lf-badge-lost" : "lf-badge-found"}">${typeLabel}</span>
        <span class="lf-status-chip ${isPending ? "lf-status-pending" : "lf-status-rejected"}">
          ${isPending ? "قيد المراجعة" : "مرفوض"}
        </span>

        <h3 class="lf-post-title">${core.escapeHtml(post.title)}</h3>
        ${post.location ? `<div class="lf-post-location"><i class="fa-solid fa-location-dot"></i> ${core.escapeHtml(post.location)}</div>` : ""}
        ${img}
        <p class="lf-post-desc">${core.escapeHtml(post.description)}</p>

        ${post.adminNote ? `<p class="lf-admin-note"><i class="fa-solid fa-circle-info"></i> ${core.escapeHtml(post.adminNote)}</p>` : ""}
        ${!isPending && post.rejectionReason ? `<p class="lf-rejection-reason"><i class="fa-solid fa-circle-exclamation"></i> ${core.escapeHtml(post.rejectionReason)}</p>` : ""}

        ${isPending ? `
          <div class="lf-admin-actions">
            <button type="button" class="lf-approve-btn" data-post-id="${post.id}">
              <i class="fa-solid fa-check"></i> موافقة
            </button>
            <button type="button" class="lf-request-edit-btn" data-post-id="${post.id}">
              <i class="fa-solid fa-pen"></i> طلب استكمال
            </button>
            <button type="button" class="lf-reject-btn" data-post-id="${post.id}">
              <i class="fa-solid fa-xmark"></i> رفض
            </button>
          </div>` : ""}

        <button type="button" class="lf-delete-post-btn" data-post-id="${post.id}" data-created-by="${core.escapeHtml(post.createdBy)}" data-status="${post.status}">
          <i class="fa-solid fa-trash"></i> حذف نهائي
        </button>
      </article>
    `;
  }

  function wireQueueEvents(listEl) {
    listEl.querySelectorAll(".lf-approve-btn").forEach((btn) => {
      btn.addEventListener("click", () => approve(btn.dataset.postId));
    });
    listEl.querySelectorAll(".lf-reject-btn").forEach((btn) => {
      btn.addEventListener("click", () => openReasonModal(btn.dataset.postId, "reject"));
    });
    listEl.querySelectorAll(".lf-request-edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => openReasonModal(btn.dataset.postId, "requestEdit"));
    });
    listEl.querySelectorAll(".lf-delete-post-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.postId;
        const createdBy = btn.dataset.createdBy;
        const status = btn.dataset.status;
        if (window.__LF.post) window.__LF.post.confirmDeletePost(id, createdBy, status);
      });
    });
  }

  /* ─────────────────────────────────────────
     مودال السبب/الملاحظة (رفض أو طلب استكمال) — نفس lf-modal-layer المشتركة
  ───────────────────────────────────────── */
  function openReasonModal(postId, action) {
    const isReject = action === "reject";
    core.openModal(`
      <div class="lf-modal lf-reason-modal">
        <button class="lf-modal-close" type="button" aria-label="إغلاق">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <h3>${isReject ? "سبب الرفض" : "ملاحظة استكمال البيانات"}</h3>
        <form class="lf-reason-form">
          <textarea class="lf-reason-input" placeholder="${isReject ? "اكتب سبب الرفض..." : "وضّح للطالب المطلوب استكماله..."}" maxlength="300" required></textarea>
          <button type="submit" class="lf-reason-submit-btn">${isReject ? "تأكيد الرفض" : "إرسال الملاحظة"}</button>
        </form>
      </div>
    `);

    const layer = core.state.root.querySelector(".lf-modal-layer");
    layer.querySelector(".lf-modal-close")?.addEventListener("click", () => core.closeModal());
    layer.querySelector(".lf-reason-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = layer.querySelector(".lf-reason-input").value.trim();
      if (!text) return;

      const btn = layer.querySelector(".lf-reason-submit-btn");
      if (btn) btn.disabled = true;

      if (isReject) await reject(postId, text);
      else await requestEdit(postId, text);

      core.closeModal();
    });
  }

  /* ─────────────────────────────────────────
     الكتابات — كل دالة بتتحقق isAdmin() بنفسها أولًا (دفاع إضافي)
  ───────────────────────────────────────── */
  async function approve(postId) {
    if (!core.state.isAdmin) { window.toast?.("غير مسموح", "warn"); return; }
    try {
      const fs = await core.getFS();
      const { db, doc, updateDoc, serverTimestamp } = fs;
      await updateDoc(doc(db, "lostFound", postId), {
        status: "published",
        approvedBy: window.currentUser.uid,
        approvedAt: serverTimestamp(),
      });
      window.toast?.("تم النشر ✓");
    } catch (e) {
      console.error("[LostFound:admin] فشل approve", e);
      window.toast?.("تعذر تنفيذ الموافقة", "error");
    }
  }

  async function reject(postId, reason) {
    if (!core.state.isAdmin) { window.toast?.("غير مسموح", "warn"); return; }
    try {
      const fs = await core.getFS();
      const { db, doc, updateDoc, serverTimestamp } = fs;
      await updateDoc(doc(db, "lostFound", postId), {
        status: "rejected",
        rejectedBy: window.currentUser.uid,
        rejectedAt: serverTimestamp(),
        rejectionReason: reason,
      });
      window.toast?.("تم رفض الطلب");
    } catch (e) {
      console.error("[LostFound:admin] فشل reject", e);
      window.toast?.("تعذر تنفيذ الرفض", "error");
    }
  }

  async function requestEdit(postId, note) {
    if (!core.state.isAdmin) { window.toast?.("غير مسموح", "warn"); return; }
    try {
      const fs = await core.getFS();
      const { db, doc, updateDoc } = fs;
      // الحالة تفضل pending — بس بملاحظة توضح للطالب المطلوب تعديله في "طلباتك السابقة"
      await updateDoc(doc(db, "lostFound", postId), { adminNote: note });
      window.toast?.("تم إرسال الملاحظة ✓");
    } catch (e) {
      console.error("[LostFound:admin] فشل requestEdit", e);
      window.toast?.("تعذر إرسال الملاحظة", "error");
    }
  }

  function renderError(listEl, msg) {
    if (!listEl) return;
    listEl.innerHTML = `
      <div class="lf-error">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <p>${core.escapeHtml(msg)}</p>
      </div>`;
  }

  window.__LF.admin = { render };
})();
