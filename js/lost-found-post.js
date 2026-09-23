/**
 * ══════════════════════════════════════════
 *   LOST & FOUND MODULE — راحت فين؟
 *   post.js — فورم إنشاء/تعديل طلب نشر + رفع صورة + الإرسال بحالة pending
 * ══════════════════════════════════════════
 *
 *  مسؤوليته فقط:
 *   - فورم النشر (مفقود/موجود) + رفع صورة عبر uploadToCloudinaryWithProgress()
 *   - إرسال الطلب دايمًا بحالة pending (أو published لو directPublish من admin.js)
 *   - قسم "طلباتك السابقة" (pending/rejected) داخل الفورم — تعديل وإعادة إرسال المرفوض
 *
 *  ما لا يفعله عمدًا:
 *   - لا يعرف شيئًا عن الموافقة/الرفض بعد الإرسال (مسؤولية admin.js)
 *   - لا يستخدم _buildUploadCard() لأنها مربوطة صراحةً بـ #chatMessages
 *   - لا يعتبر إخفاء أي زرار هنا حماية — الحماية الحقيقية في Firestore Rules
 */

(function () {
  "use strict";

  window.__LF = window.__LF || {};
  const core = window.__LF.core;

  let _selectedFile = null;
  let _uploadedUrl = null;
  let _editingPostId = null;
  let _directPublish = false;

  /* ─────────────────────────────────────────
     الدخول: زرار "+ نشر مفقودات" (core.js) أو admin.js (نشر مباشر)
  ───────────────────────────────────────── */
  async function openCreateForm(opts = {}) {
    const currentUser = window.currentUser;
    if (!currentUser?.uid) {
      window.toast?.("يجب تسجيل الدخول أولاً", "warn");
      return;
    }

    _directPublish = !!opts.directPublish;
    _editingPostId = opts.existingPostId || null;
    _selectedFile = null;
    _uploadedUrl = null;

    let editingData = null;
    if (_editingPostId) {
      try {
        const fs = await core.getFS();
        const snap = await fs.getDoc(fs.doc(fs.db, "lostFound", _editingPostId));
        if (snap.exists()) editingData = snap.data();
      } catch (e) {
        console.error("[LostFound:post] فشل تحميل بيانات الطلب", e);
        window.toast?.("تعذر تحميل بيانات الطلب", "error");
        return;
      }
    }

    // "طلباتك السابقة" تظهر بس في الفورم الفاضي (مش وقت التعديل نفسه، ومش في النشر المباشر للأدمن)
    let myRequestsHtml = "";
    if (!_directPublish && !_editingPostId) {
      myRequestsHtml = await buildMyRequestsSection(currentUser.uid);
    }

    renderForm(editingData, myRequestsHtml);
  }

  /* ─────────────────────────────────────────
     طلباتك السابقة (pending/rejected بس — المنشورة أصلًا موجودة في الفيد)
  ───────────────────────────────────────── */
  async function buildMyRequestsSection(uid) {
    try {
      const fs = await core.getFS();
      const { db, collection, query, where, getDocs } = fs;
      const q = query(
        collection(db, "lostFound"),
        where("createdBy", "==", uid),
        where("status", "in", ["pending", "rejected"])
      );
      const snap = await getDocs(q);
      if (snap.empty) return "";

      const items = snap.docs
        .map((d) => {
          const p = d.data();
          const statusLabel = p.status === "pending" ? "قيد المراجعة" : "مرفوض";
          const statusClass = p.status === "pending" ? "lf-status-pending" : "lf-status-rejected";
          const editBtn =
            p.status === "rejected"
              ? `<button type="button" class="lf-edit-request-btn" data-id="${d.id}">تعديل وإعادة الإرسال</button>`
              : "";
          return `
            <div class="lf-my-request-item">
              <div class="lf-my-request-top">
                <span class="lf-status-chip ${statusClass}">${statusLabel}</span>
                <span class="lf-my-request-title">${core.escapeHtml(p.title)}</span>
              </div>
              ${p.rejectionReason ? `<p class="lf-rejection-reason"><i class="fa-solid fa-circle-exclamation"></i> ${core.escapeHtml(p.rejectionReason)}</p>` : ""}
              ${p.adminNote ? `<p class="lf-admin-note"><i class="fa-solid fa-circle-info"></i> ${core.escapeHtml(p.adminNote)}</p>` : ""}
              ${editBtn}
            </div>`;
        })
        .join("");

      return `<div class="lf-my-requests"><h4>طلباتك السابقة</h4>${items}</div>`;
    } catch (e) {
      console.error("[LostFound:post] فشل تحميل طلباتك السابقة", e);
      return ""; // فشل القسم ده لا يمنع فتح الفورم نفسه
    }
  }

  /* ─────────────────────────────────────────
     بناء الفورم
  ───────────────────────────────────────── */
  function renderForm(editingData, myRequestsHtml) {
    const isEdit = !!_editingPostId;
    const title = editingData?.title || "";
    const description = editingData?.description || "";
    const location = editingData?.location || "";
    const type = editingData?.type || "lost";
    _uploadedUrl = (editingData?.images && editingData.images[0]) || null;

    const heading = _directPublish ? "نشر مباشر" : isEdit ? "تعديل وإعادة الإرسال" : "نشر مفقودات";
    const submitLabel = _directPublish ? "نشر" : isEdit ? "إعادة الإرسال" : "طلب نشر";

    core.openModal(`
      <div class="lf-modal lf-post-form">
        <button class="lf-modal-close" type="button" aria-label="إغلاق">
          <i class="fa-solid fa-xmark"></i>
        </button>

        <h3>${heading}</h3>

        ${myRequestsHtml || ""}

        <form class="lf-form">
          <div class="lf-type-toggle">
            <label><input type="radio" name="lf-type" value="lost" ${type === "lost" ? "checked" : ""}> مفقود</label>
            <label><input type="radio" name="lf-type" value="found" ${type === "found" ? "checked" : ""}> موجود</label>
          </div>

          <input type="text" class="lf-input" name="lf-title" placeholder="العنوان (مثال: محفظة سوداء)"
                 value="${core.escapeHtml(title)}" required maxlength="80">

          <textarea class="lf-textarea" name="lf-description" placeholder="الوصف..."
                    maxlength="500">${core.escapeHtml(description)}</textarea>

          <input type="text" class="lf-input" name="lf-location" placeholder="أقرب مكان (اختياري)"
                 value="${core.escapeHtml(location)}" maxlength="80">

          <div class="lf-image-picker">
            <input type="file" accept="image/*" class="lf-image-input" hidden>
            <button type="button" class="lf-image-pick-btn">
              <i class="fa-solid fa-camera"></i> إضافة صورة (اختياري)
            </button>
            <div class="lf-image-preview-wrap">
              ${_uploadedUrl ? `<img class="lf-image-preview" src="${core.escapeHtml(_uploadedUrl)}" alt="">` : ""}
            </div>
            <div class="lf-upload-progress" hidden>
              <div class="lf-upload-progress-track"><div class="lf-upload-progress-fill"></div></div>
            </div>
          </div>

          <button type="submit" class="lf-submit-btn">${submitLabel}</button>
        </form>
      </div>
    `);

    wireFormEvents();
  }

  function wireFormEvents() {
    const layer = core.state.root.querySelector(".lf-modal-layer");

    layer.querySelector(".lf-modal-close")?.addEventListener("click", closeForm);

    layer.querySelectorAll(".lf-edit-request-btn").forEach((btn) => {
      btn.addEventListener("click", () => openCreateForm({ existingPostId: btn.dataset.id }));
    });

    const fileInput = layer.querySelector(".lf-image-input");
    layer.querySelector(".lf-image-pick-btn")?.addEventListener("click", () => fileInput?.click());
    fileInput?.addEventListener("change", (e) => handleImageSelect(e.target.files[0]));

    layer.querySelector(".lf-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      submitPost(e.target);
    });
  }

  /* ─────────────────────────────────────────
     رفع الصورة — uploadToCloudinaryWithProgress() الجاهزة زي ما هي، من غير أي تعديل
  ───────────────────────────────────────── */
  async function handleImageSelect(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.toast?.("الملف المختار مش صورة", "warn");
      return;
    }

    const layer = core.state.root.querySelector(".lf-modal-layer");
    const progressWrap = layer.querySelector(".lf-upload-progress");
    const progressFill = layer.querySelector(".lf-upload-progress-fill");
    const previewWrap = layer.querySelector(".lf-image-preview-wrap");

    _selectedFile = file;
    progressWrap.hidden = false;
    progressFill.style.width = "0%";

    try {
      const result = await uploadToCloudinaryWithProgress(file, (prog) => {
        progressFill.style.width = (prog.pct || 0) + "%";
      });
      // ⚠️ uploadToCloudinaryWithProgress بترجع {url, data} مش رابط مباشر
      _uploadedUrl = result.url;
      previewWrap.innerHTML = `<img class="lf-image-preview" src="${core.escapeHtml(_uploadedUrl)}" alt="">`;
    } catch (e) {
      console.error("[LostFound:post] فشل رفع الصورة", e);
      window.toast?.("تعذر رفع الصورة، حاول تاني", "error");
      _uploadedUrl = null;
    } finally {
      progressWrap.hidden = true;
    }
  }

  /* ─────────────────────────────────────────
     الإرسال — دايمًا pending (إلا لو directPublish من admin.js)
     ملاحظة: التحقق هنا للـ UX بس. الحماية الحقيقية النهائية هي Firestore Rules
     (create لازم createdBy==uid وstatus=="pending"، وupdate بترجع الحالة pending دايمًا لغير الأدمن).
  ───────────────────────────────────────── */
  async function submitPost(formEl) {
    const currentUser = window.currentUser;
    if (!currentUser?.uid) {
      window.toast?.("يجب تسجيل الدخول أولاً", "warn");
      return;
    }

    const title = formEl.querySelector('[name="lf-title"]').value.trim();
    const description = formEl.querySelector('[name="lf-description"]').value.trim();
    const location = formEl.querySelector('[name="lf-location"]').value.trim();
    const type = formEl.querySelector('[name="lf-type"]:checked')?.value || "lost";

    if (!title) {
      window.toast?.("العنوان مطلوب", "warn");
      return;
    }

    const submitBtn = formEl.querySelector(".lf-submit-btn");
    const originalBtnLabel = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    try {
      const fs = await core.getFS();
      const { db, collection, doc, getDoc, addDoc, updateDoc, serverTimestamp } = fs;

      const basePayload = {
        type,
        title,
        description,
        location,
        images: _uploadedUrl ? [_uploadedUrl] : [],
      };

      if (_editingPostId) {
        const postRef = doc(db, "lostFound", _editingPostId);

        // ✅ Admin Isolation: تحقق مباشر من عالم المنشور قبل أي تعديل — دايمًا
        // صاحب المنشور بس اللي بيعدّل (زي ما هو أصلًا)، بس لازم كمان عالمه الحالي
        // يطابق worldId المنشور. الأونر Global، ومنشور بلا worldId ممنوع على غير الأونر.
        const existSnap = await getDoc(postRef);
        const existing = existSnap.exists() ? existSnap.data() : null;
        const isOwnerOfPost = !!(existing && currentUser.uid === existing.createdBy);
        const isGlobalOwner = !!(window.isOwner && window.isOwner());
        const _myWorld = (typeof window.currentUserWorldId === "function") ? window.currentUserWorldId() : null;
        const worldOk = isGlobalOwner || (existing && existing.worldId && existing.worldId === _myWorld);

        if (!existing || !(isGlobalOwner || (isOwnerOfPost && worldOk))) {
          window.toast?.("غير مسموح لك بهذا الإجراء", "warn");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnLabel;
          }
          return;
        }

        // إعادة إرسال بعد رفض: الحالة ترجع pending دايمًا، وcreatedBy ثابت (الـ Rules بتتأكد برضه)
        await updateDoc(postRef, {
          ...basePayload,
          status: "pending",
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
          adminNote: null,
        });
        window.toast?.("تم إعادة إرسال الطلب للمراجعة ✓");
      } else {
        const payload = {
          ...basePayload,
          status: _directPublish ? "published" : "pending",
          createdBy: currentUser.uid,
          createdByName: window.getCurrentName?.() || "مستخدم",
          createdByPhoto: window.currentPhoto || "",
          // ✅ Admin Isolation: كل منشور جديد يُختم بعالم منشئه (الفيد العام يفضل
          // بلا فلترة — worldId هنا للعزل الإداري بس، مش لإخفاء المنشور عن باقي العوالم)
          worldId: (typeof window.activeWorldContext === "function") ? window.activeWorldContext() : null,
          createdAt: serverTimestamp(),
          approvedBy: _directPublish ? currentUser.uid : null,
          approvedAt: _directPublish ? serverTimestamp() : null,
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
          adminNote: null,
          resolvedBy: null,
          resolvedAt: null,
        };
        await addDoc(collection(db, "lostFound"), payload);
        window.toast?.(_directPublish ? "تم النشر ✓" : "تم إرسال طلبك للمراجعة ✓");
      }

      closeForm();
    } catch (e) {
      console.error("[LostFound:post] فشل إرسال الطلب", e);
      window.toast?.("حصل خطأ، حاول تاني", "error");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnLabel;
      }
    }
  }

  function closeForm() {
    _selectedFile = null;
    _uploadedUrl = null;
    _editingPostId = null;
    _directPublish = false;
    core.closeModal();
  }

  /* ─────────────────────────────────────────
     حذف منشور — الأدمن من أي حالة، صاحب المنشور من أي حالة ما عدا found
     (مطابق تمامًا لـ Firestore Rule: isAdmin() || (uid==createdBy && status != "found"))
     تحقق فعلي هنا قبل الكتابة، لكن الـ Rules هي الحماية النهائية دايمًا
  ───────────────────────────────────────── */
  function confirmDeletePost(postId, createdBy, status) {
    const currentUser = window.currentUser;
    const isOwner = currentUser && currentUser.uid === createdBy;
    const allowed = core.state.isAdmin || (isOwner && status !== "found");

    if (!allowed) {
      window.toast?.("غير مسموح لك بهذا الإجراء", "warn");
      return;
    }

    core.openModal(`
      <div class="lf-modal lf-confirm-delete">
        <button class="lf-modal-close" type="button" aria-label="إغلاق">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <h3>حذف المنشور</h3>
        <p class="lf-confirm-text">هتحذف المنشور نهائيًا ومش هيرجع تاني. متأكد؟</p>
        <div class="lf-confirm-actions">
          <button type="button" class="lf-confirm-cancel-btn">إلغاء</button>
          <button type="button" class="lf-confirm-delete-btn">حذف نهائي</button>
        </div>
      </div>
    `);

    const layer = core.state.root.querySelector(".lf-modal-layer");
    layer.querySelector(".lf-modal-close")?.addEventListener("click", () => core.closeModal());
    layer.querySelector(".lf-confirm-cancel-btn")?.addEventListener("click", () => core.closeModal());
    layer.querySelector(".lf-confirm-delete-btn")?.addEventListener("click", async (e) => {
      e.currentTarget.disabled = true;
      await deletePost(postId);
    });
  }

  async function deletePost(postId) {
    try {
      const fs = await core.getFS();
      const { db, doc, getDoc, deleteDoc } = fs;
      const postRef = doc(db, "lostFound", postId);

      // ✅ Admin Isolation: تحقق نهائي قبل أي حذف — الحذف بصلاحية صاحب المنشور
      // يفضل زي ما هو، وحذف الأدمن يحتاج worldId المنشور == عالمه (الأونر Global،
      // ومنشور بلا worldId ممنوع على أي أدمن غير الأونر لأن عالمه غير معروف)
      const currentUser = window.currentUser;
      const snap = await getDoc(postRef);
      const post = snap.exists() ? snap.data() : null;
      const isOwnerOfPost = !!(post && currentUser && currentUser.uid === post.createdBy);
      const isGlobalOwner = !!(window.isOwner && window.isOwner());
      const _myWorld = (typeof window.currentUserWorldId === "function") ? window.currentUserWorldId() : null;
      const adminAllowed = core.state.isAdmin && (isGlobalOwner || (post && post.worldId && post.worldId === _myWorld));
      const allowed = adminAllowed || (isOwnerOfPost && post && post.status !== "found");

      if (!allowed) {
        window.toast?.("غير مسموح لك بهذا الإجراء", "warn");
        return;
      }

      await deleteDoc(postRef);
      window.toast?.("تم حذف المنشور ✓");
      core.closeModal();
    } catch (e) {
      console.error("[LostFound:post] فشل حذف المنشور", e);
      window.toast?.("تعذر حذف المنشور", "error");
    }
  }

  window.__LF.post = { openCreateForm, closeForm, confirmDeletePost };
})();
