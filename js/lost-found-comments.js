/**
 * ══════════════════════════════════════════
 *   LOST & FOUND MODULE — راحت فين؟
 *   comments.js — تعليقات وردود على منشور published فقط
 * ══════════════════════════════════════════
 *
 *  مسؤوليته فقط:
 *   - realtime listener على lostFound/{postId}/comments
 *   - إضافة تعليق/رد (مستوى واحد) + حذف تعليق — addDoc/deleteDoc بسيطين
 *
 *  ملاحظة: مفيش أي عداد commentsCount مخزّن هنا ولا في lostFound نفسها.
 *  عدد التعليقات المعروض في كارت الفيد بيتحسب live عبر getCountFromServer()
 *  في feed.js مباشرة من الـ subcollection — نفس تقنية إحصائيات found.js.
 *  ده تم اعتماده بدل تخزين عداد لأن حمايته من التلاعب كانت محتاجة إما حقول
 *  إضافية على مستند البوست أو Cloud Functions، والاتنين خارج نطاق "إضافة Rule".
 *
 *  ما لا يفعله عمدًا:
 *   - لا يعرف شيئًا عن حالة المنشور نفسه (pending/published/found)
 *   - لا يسمح بأكتر من مستوى رد واحد (تعليق → رد، مش رد على رد)
 *   - إخفاء زرار الحذف هنا واجهة بس، الحماية الحقيقية في الـ Rules
 */

(function () {
  "use strict";

  window.__LF = window.__LF || {};
  const core = window.__LF.core;

  let _unsubComments = null;

  /* ─────────────────────────────────────────
     الدخول من feed.openPostDetail()
  ───────────────────────────────────────── */
  function render(postId, container) {
    container.innerHTML = `
      <div class="lf-comments">
        <div class="lf-comments-list">
          <div class="lf-loading"><i class="fa-solid fa-spinner fa-spin"></i></div>
        </div>
        <form class="lf-comment-form lf-comment-form--main">
          <input type="text" class="lf-comment-input" placeholder="اكتب تعليق..." maxlength="300">
          <button type="submit" class="lf-comment-send-btn" aria-label="إرسال">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </form>
      </div>
    `;

    const mainForm = container.querySelector(".lf-comment-form--main");
    wireSingleCommentForm(mainForm, postId, null);
    startListener(postId, container);
  }

  async function startListener(postId, container) {
    // يمنع تكرار الاشتراك لو render() اتنادت تاني على نفس المنشور من غير إغلاق كامل
    if (_unsubComments) { try { _unsubComments(); } catch (e) {} _unsubComments = null; }

    let fs;
    try {
      fs = await core.getFS();
    } catch (e) {
      renderError(container, "تعذر تحميل التعليقات");
      return;
    }
    const { db, collection, query, orderBy, onSnapshot } = fs;

    const q = query(collection(db, "lostFound", postId, "comments"), orderBy("createdAt", "asc"));

    _unsubComments = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderList(container, postId, all);
      },
      (err) => {
        console.error("[LostFound:comments]", err);
        renderError(container, "حدث خطأ أثناء تحميل التعليقات");
      }
    );

    core.registerUnsubscribe(() => {
      if (_unsubComments) { _unsubComments(); _unsubComments = null; }
    });
  }

  /* ─────────────────────────────────────────
     العرض — مستوى واحد فقط (تعليق + ردوده)
  ───────────────────────────────────────── */
  function renderList(container, postId, all) {
    const listEl = container.querySelector(".lf-comments-list");
    if (!listEl) return;

    const topLevel = all.filter((c) => !c.parentId);
    const repliesByParent = {};
    all.filter((c) => c.parentId).forEach((c) => {
      (repliesByParent[c.parentId] = repliesByParent[c.parentId] || []).push(c);
    });

    listEl.innerHTML = topLevel.length
      ? topLevel.map((c) => renderComment(c, repliesByParent[c.id] || [])).join("")
      : `<p class="lf-no-comments">لسه مفيش تعليقات</p>`;

    wireListEvents(listEl, container, postId);
  }

  function renderComment(comment, replies) {
    return `
      <div class="lf-comment" data-comment-id="${comment.id}">
        <div class="lf-comment-header">
          ${core.getUserBadge(comment.createdByName, comment.createdByPhoto)}
          <span class="lf-comment-time">${core.formatRelativeTime(comment.createdAt)}</span>
        </div>
        <p class="lf-comment-text">${core.escapeHtml(comment.text)}</p>
        <div class="lf-comment-actions">
          <button type="button" class="lf-reply-btn" data-parent-id="${comment.id}">رد</button>
          ${canDeleteComment(comment) ? `<button type="button" class="lf-delete-comment-btn" data-comment-id="${comment.id}">حذف</button>` : ""}
        </div>
        <div class="lf-reply-form-mount" data-parent-id="${comment.id}" hidden></div>
        ${replies.length ? `<div class="lf-replies">${replies.map(renderReply).join("")}</div>` : ""}
      </div>
    `;
  }

  function renderReply(reply) {
    return `
      <div class="lf-comment lf-reply" data-comment-id="${reply.id}">
        <div class="lf-comment-header">
          ${core.getUserBadge(reply.createdByName, reply.createdByPhoto)}
          <span class="lf-comment-time">${core.formatRelativeTime(reply.createdAt)}</span>
        </div>
        <p class="lf-comment-text">${core.escapeHtml(reply.text)}</p>
        ${canDeleteComment(reply) ? `<div class="lf-comment-actions"><button type="button" class="lf-delete-comment-btn" data-comment-id="${reply.id}">حذف</button></div>` : ""}
      </div>
    `;
  }

  // واجهة فقط — الحماية الحقيقية دايمًا في الـ Rules (isAdmin() || uid == createdBy)
  function canDeleteComment(comment) {
    const uid = core.state.currentUser && core.state.currentUser.uid;
    return !!core.state.isAdmin || (!!uid && uid === comment.createdBy);
  }

  function wireListEvents(listEl, container, postId) {
    listEl.querySelectorAll(".lf-reply-btn").forEach((btn) => {
      btn.addEventListener("click", () => toggleReplyBox(container, postId, btn.dataset.parentId));
    });
    listEl.querySelectorAll(".lf-delete-comment-btn").forEach((btn) => {
      btn.addEventListener("click", () => deleteComment(postId, btn.dataset.commentId));
    });
  }

  function toggleReplyBox(container, postId, parentId) {
    const mount = container.querySelector(`.lf-reply-form-mount[data-parent-id="${parentId}"]`);
    if (!mount) return;

    if (!mount.hidden) {
      mount.hidden = true;
      mount.innerHTML = "";
      return;
    }

    mount.hidden = false;
    mount.innerHTML = `
      <form class="lf-comment-form lf-reply-inline-form">
        <input type="text" class="lf-comment-input" placeholder="اكتب ردك..." maxlength="300">
        <button type="submit" class="lf-comment-send-btn" aria-label="إرسال">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </form>
    `;
    const replyForm = mount.querySelector(".lf-reply-inline-form");
    wireSingleCommentForm(replyForm, postId, parentId, () => {
      mount.hidden = true;
      mount.innerHTML = "";
    });
  }

  function wireSingleCommentForm(formEl, postId, parentId, onSent) {
    if (!formEl) return;
    formEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = formEl.querySelector(".lf-comment-input");
      const text = input.value.trim();
      if (!text) return;

      const btn = formEl.querySelector(".lf-comment-send-btn");
      if (btn) btn.disabled = true;

      const ok = await addComment(postId, text, parentId);

      if (btn) btn.disabled = false;
      if (ok) {
        input.value = "";
        if (onSent) onSent();
      }
    });
  }

  /* ─────────────────────────────────────────
     الإضافة — addDoc بسيط، مفيش عداد مخزّن نحميه (عدد التعليقات بيتحسب live في feed.js)
  ───────────────────────────────────────── */
  async function addComment(postId, text, parentId) {
    const currentUser = window.currentUser;
    if (!currentUser?.uid) {
      window.toast?.("يجب تسجيل الدخول أولاً", "warn");
      return false;
    }

    try {
      const fs = await core.getFS();
      const { db, collection, addDoc, serverTimestamp } = fs;

      await addDoc(collection(db, "lostFound", postId, "comments"), {
        text,
        createdBy: currentUser.uid,
        createdByName: window.getCurrentName?.() || "مستخدم",
        createdByPhoto: window.currentPhoto || "",
        parentId: parentId || null,
        createdAt: serverTimestamp(),
      });

      return true;
    } catch (e) {
      console.error("[LostFound:comments] فشل إضافة تعليق", e);
      window.toast?.("تعذر إرسال التعليق", "error");
      return false;
    }
  }

  /* ─────────────────────────────────────────
     الحذف — deleteDoc بسيط، مفيش عداد نحدّثه
  ───────────────────────────────────────── */
  async function deleteComment(postId, commentId) {
    try {
      const fs = await core.getFS();
      const { db, doc, getDoc, deleteDoc } = fs;
      const commentRef = doc(db, "lostFound", postId, "comments", commentId);

      // ✅ Admin Isolation: صاحب التعليق يحذف تعليقه زي ما هو دايمًا. حذف الأدمن
      // إجراء إداري ويحتاج تحقق من عالم المنشور الأب (post.worldId) — الأونر
      // يتجاوز، ومنشور بلا worldId ممنوع على أي أدمن غير الأونر.
      const currentUser = window.currentUser;
      const commentSnap = await getDoc(commentRef);
      const comment = commentSnap.exists() ? commentSnap.data() : null;
      const isOwnerOfComment = !!(comment && currentUser && currentUser.uid === comment.createdBy);

      let adminAllowed = false;
      if (core.state.isAdmin && !isOwnerOfComment) {
        const isGlobalOwner = !!(window.isOwner && window.isOwner());
        if (isGlobalOwner) {
          adminAllowed = true;
        } else {
          const postSnap = await getDoc(doc(db, "lostFound", postId));
          const post = postSnap.exists() ? postSnap.data() : null;
          const _myWorld = (typeof window.currentUserWorldId === "function") ? window.currentUserWorldId() : null;
          adminAllowed = !!(post && post.worldId && post.worldId === _myWorld);
        }
      }

      if (!isOwnerOfComment && !adminAllowed) {
        window.toast?.("غير مسموح لك بهذا الإجراء", "warn");
        return;
      }

      await deleteDoc(commentRef);
    } catch (e) {
      console.error("[LostFound:comments] فشل حذف التعليق", e);
      window.toast?.("تعذر حذف التعليق", "error");
    }
  }

  function renderError(container, msg) {
    const listEl = container.querySelector(".lf-comments-list") || container;
    listEl.innerHTML = `
      <div class="lf-error">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <p>${core.escapeHtml(msg)}</p>
      </div>`;
  }

  window.__LF.comments = { render };
})();
