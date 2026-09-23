/**
 * ══════════════════════════════════════════
 *   LOST & FOUND MODULE — راحت فين؟
 *   found.js — أرشيف "لقيتها" + الإحصائيات + كل كتابة لحالة found
 * ══════════════════════════════════════════
 *
 *  مسؤوليته فقط:
 *   - عرض أرشيف المنشورات status=="found" (بدون تعليقات ولا تفاعل)
 *   - إحصائيات حقيقية من Firestore عبر getCountFromServer() (مش رقم ثابت)
 *   - الكتابة الوحيدة لتحويل الحالة published → found (markAsFound)
 *   - تصحيح found → published، Admin/Owner فقط (correctBack)
 *
 *  ما لا يفعله عمدًا:
 *   - لا تعليقات ولا إعجابات في الأرشيف (الأرشيف توثيقي بس)
 *   - لا يكتب أي حاجة تانية غير status/resolvedBy/resolvedAt (وresetها عند التصحيح)
 *   - إخفاء الأزرار هنا مش بديل عن التحقق — كل دالة كتابة بتتحقق بنفسها الأول
 *
 *  ⚠️ ملاحظة: الإحصائيات بتتحسب مرة واحدة عند فتح التاب (getCountFromServer قراءة
 *  لحظية، مش onSnapshot — Firestore مبيدعمش استماع مباشر لنتيجة count). قائمة
 *  الأرشيف نفسها live فعليًا عبر onSnapshot.
 */

(function () {
  "use strict";

  window.__LF = window.__LF || {};
  const core = window.__LF.core;

  let _unsubFound = null;

  /* ─────────────────────────────────────────
     الدخول من core.switchView("found")
  ───────────────────────────────────────── */
  function render(container) {
    container.innerHTML = `
      <div class="lf-found-stats">
        <div class="lf-stat"><span class="lf-stat-num">—</span><span class="lf-stat-label">تم العثور عليها</span></div>
      </div>
      <div class="lf-found-list"><div class="lf-loading"><i class="fa-solid fa-spinner fa-spin"></i></div></div>
    `;

    renderStats(container.querySelector(".lf-found-stats"));
    startListener(container);
  }

  /* ─────────────────────────────────────────
     الإحصائية — رقم "تم العثور عليها" بس، من غير أي عد لمنشورات لسه مفتوحة (published)
     عشان صفحة الأرشيف تفضل توثيقية 100% لحاجات اتلقت، مفيهاش أي إشارة لحاجات لسه بتتدور عليها
  ───────────────────────────────────────── */
  async function renderStats(statsEl) {
    if (!statsEl) return;
    try {
      const fs = await core.getFS();
      const { db, collection, query, where, getCountFromServer } = fs;

      const foundQ = query(collection(db, "lostFound"), where("status", "==", "found"));
      const foundSnap = await getCountFromServer(foundQ);

      const nums = statsEl.querySelectorAll(".lf-stat-num");
      if (nums[0]) nums[0].textContent = foundSnap.data().count;
    } catch (e) {
      console.error("[LostFound:found] فشل تحميل الإحصائيات", e);
      // فشل الإحصائيات لا يمنع عرض الأرشيف نفسه — قسم اختياري
    }
  }

  /* ─────────────────────────────────────────
     قائمة الأرشيف — live فعليًا
  ───────────────────────────────────────── */
  async function startListener(container) {
    if (_unsubFound) { try { _unsubFound(); } catch (e) {} _unsubFound = null; }

    const listEl = container.querySelector(".lf-found-list");

    let fs;
    try {
      fs = await core.getFS();
    } catch (e) {
      renderError(listEl, "تعذر الاتصال بقاعدة البيانات");
      return;
    }
    const { db, collection, query, where, orderBy, onSnapshot } = fs;

    const q = query(
      collection(db, "lostFound"),
      where("status", "==", "found"),
      orderBy("resolvedAt", "desc")
    );

    _unsubFound = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderList(listEl, docs);
      },
      (err) => {
        console.error("[LostFound:found]", err);
        renderError(listEl, "حدث خطأ أثناء تحميل الأرشيف");
      }
    );

    core.registerUnsubscribe(() => {
      if (_unsubFound) { _unsubFound(); _unsubFound = null; }
    });
  }

  function renderList(listEl, docs) {
    if (!listEl) return;

    if (docs.length === 0) {
      listEl.innerHTML = `
        <div class="lf-empty">
          <i class="fa-solid fa-box-open"></i>
          <p>لسه مفيش حاجة اتلقيت</p>
        </div>`;
      return;
    }

    listEl.innerHTML = docs.map(renderArchiveItem).join("");

    // زرار التصحيح (found → published) للأدمن/الأونر بس — تحقق واجهة، والدالة نفسها بتتحقق تاني
    if (core.state.isAdmin) {
      listEl.querySelectorAll(".lf-correct-back-btn").forEach((btn) => {
        btn.addEventListener("click", () => correctBack(btn.dataset.postId));
      });
      // الحذف من الأرشيف للأدمن/الأونر بس (صاحب المنشور ممنوع يحذف حاجة اتلقت — الـ Rule بتتأكد كمان)
      listEl.querySelectorAll(".lf-delete-post-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.postId;
          const createdBy = btn.dataset.createdBy;
          if (window.__LF.post) window.__LF.post.confirmDeletePost(id, createdBy, "found");
        });
      });
    }
  }

  function renderArchiveItem(post) {
    const typeLabel = post.type === "lost" ? "مفقود" : "موجود";
    return `
      <div class="lf-archive-item" data-post-id="${post.id}">
        <span class="lf-badge lf-badge-done"><i class="fa-solid fa-circle-check"></i></span>
        <div class="lf-archive-info">
          <span class="lf-archive-title">${core.escapeHtml(post.title)}</span>
          <span class="lf-archive-meta">${typeLabel} · تم العثور عليها ${core.formatRelativeTime(post.resolvedAt)}</span>
        </div>
        ${core.state.isAdmin ? `
          <button type="button" class="lf-correct-back-btn" data-post-id="${post.id}" title="تراجع عن الحالة">تراجع</button>
          <button type="button" class="lf-delete-post-btn" data-post-id="${post.id}" data-created-by="${core.escapeHtml(post.createdBy)}" title="حذف نهائي" aria-label="حذف">
            <i class="fa-solid fa-trash"></i>
          </button>` : ""}
      </div>
    `;
  }

  function renderError(listEl, msg) {
    if (!listEl) return;
    listEl.innerHTML = `
      <div class="lf-error">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <p>${core.escapeHtml(msg)}</p>
      </div>`;
  }

  /* ─────────────────────────────────────────
     الكتابة الوحيدة لـ published → found
     تحقق فعلي قبل الكتابة (مش بس إخفاء زرار) — لكن الـ Rules تظل الحماية النهائية
  ───────────────────────────────────────── */
  async function markAsFound(postId) {
    const currentUser = window.currentUser;
    if (!currentUser?.uid) {
      window.toast?.("يجب تسجيل الدخول أولاً", "warn");
      return;
    }

    try {
      const fs = await core.getFS();
      const { db, doc, getDoc, updateDoc, serverTimestamp } = fs;
      const postRef = doc(db, "lostFound", postId);

      const snap = await getDoc(postRef);
      if (!snap.exists()) {
        window.toast?.("المنشور غير موجود", "error");
        return;
      }
      const post = snap.data();

      if (post.status !== "published") {
        window.toast?.("تم التعامل مع هذا المنشور بالفعل", "warn");
        return;
      }

      const isOwner = currentUser.uid === post.createdBy;
      // ✅ Admin Isolation: صاحب المنشور يقفل منشوره بنفسه بغض النظر عن عزل العالم.
      // أدمن (مش صاحب المنشور) يحتاج worldId المنشور == عالمه؛ الأونر Global،
      // ومنشور بلا worldId ممنوع على أي أدمن غير الأونر.
      const isGlobalOwner = !!(window.isOwner && window.isOwner());
      const _myWorld = (typeof window.currentUserWorldId === "function") ? window.currentUserWorldId() : null;
      const adminAllowed = core.state.isAdmin && (isGlobalOwner || (post.worldId && post.worldId === _myWorld));
      if (!isOwner && !adminAllowed) {
        window.toast?.("غير مسموح لك بهذا الإجراء", "warn");
        return;
      }

      await updateDoc(postRef, {
        status: "found",
        resolvedBy: currentUser.uid,
        resolvedAt: serverTimestamp(),
      });

      window.toast?.("تم تسجيلها كـ (لقيتها) ✓");
      core.closeModal(); // كانت مفتوحة من تفاصيل المنشور في feed.js
    } catch (e) {
      console.error("[LostFound:found] فشل markAsFound", e);
      window.toast?.("تعذر إتمام العملية", "error");
    }
  }

  /* ─────────────────────────────────────────
     التصحيح — Admin/Owner فقط (وليس صاحب المنشور)، زي ما اتفقنا
     ⚠️ لسه ما اتأكدناش إن الـ Rules الحالية بتسمح بالانتقال ده فعليًا (found → published).
     هذا الافتراض غير مؤكد بعد — التأكيد النهائي في خطوة مراجعة Firestore Rules القادمة.
     لو محتاج صلاحية إضافية تتعارض مع "ممنوع تعديل Rule موجودة"، هنوقف ونراجعها قبل أي حل.
  ───────────────────────────────────────── */
  async function correctBack(postId) {
    if (!core.state.isAdmin) {
      window.toast?.("غير مسموح لك بهذا الإجراء", "warn");
      return;
    }

    try {
      const fs = await core.getFS();
      const { db, doc, getDoc, updateDoc } = fs;
      const postRef = doc(db, "lostFound", postId);

      // ✅ Admin Isolation: التصحيح إجراء إداري بحت — يحتاج تحقق من عالم المنشور.
      // الأونر يتجاوز، ومنشور بلا worldId ممنوع على أي أدمن غير الأونر.
      const isGlobalOwner = !!(window.isOwner && window.isOwner());
      if (!isGlobalOwner) {
        const snap = await getDoc(postRef);
        const post = snap.exists() ? snap.data() : null;
        const _myWorld = (typeof window.currentUserWorldId === "function") ? window.currentUserWorldId() : null;
        if (!post || !post.worldId || post.worldId !== _myWorld) {
          window.toast?.("غير مسموح لك بهذا الإجراء", "warn");
          return;
        }
      }

      await updateDoc(postRef, {
        status: "published",
        resolvedBy: null,
        resolvedAt: null,
      });

      window.toast?.("تم التراجع، رجع للمنشورات ✓");
    } catch (e) {
      console.error("[LostFound:found] فشل correctBack", e);
      window.toast?.("تعذر التراجع عن الحالة", "error");
    }
  }

  window.__LF.found = { render, markAsFound, correctBack };
})();
