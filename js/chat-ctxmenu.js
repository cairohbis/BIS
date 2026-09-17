/* ══════════════════════════════════════════════════════════════
   CHAT CONTEXT MENU — أوامر قائمة سياق الرسائل
   ▸ منقولة حرفيًا من index.html (بدون أي تعديل منطقي)
   ▸ تعتمد على window._ctxData / window._ctxDocId (bridges get+set
     في index.html — لازمين لأن _showCtxAt بتكتب عليهم) و
     window.currentUser / window.isAdmin / window.isOwner
   ══════════════════════════════════════════════════════════════ */

function _showCtxAt(x, y, docId, data) {
  _ctxDocId = docId; _ctxData = data;
  const overlay = document.getElementById("msgCtxOverlay");
  const isMe = data.uid === currentUser?.uid;
  const delBtn = document.getElementById("ctxDeleteBtn");
  if (delBtn) delBtn.style.display = (isMe || isAdmin()) ? "" : "none";
  const editBtn = document.getElementById("ctxEditBtn");
  const editSep = document.getElementById("ctxEditSep");
  const _editAge = data.createdAt?.toMillis ? (Date.now() - data.createdAt.toMillis()) : Infinity;
  const canEdit = isMe && !data.deleted && !data.image && !data.audio && !data.pdf && !data.file && data.text && _editAge < 15 * 60 * 1000;
  if (editBtn) editBtn.style.display = canEdit ? "" : "none";
  if (editSep) editSep.style.display = canEdit ? "" : "none";
  // Report button — only for others' messages, not deleted
  const rptBtn = document.getElementById("ctxReportBtn");
  const rptSep = document.getElementById("ctxReportSep");
  const showRpt = !isMe && !data.deleted;
  if (rptBtn) rptBtn.style.display = showRpt ? "" : "none";
  if (rptSep) rptSep.style.display = showRpt ? "" : "none";
  // Forward button — hide for deleted messages
  const fwdBtn = document.getElementById("ctxForwardBtn");
  if (fwdBtn) fwdBtn.style.display = data.deleted ? "none" : "";
  // Pin button — only admins/owner can pin, hide for deleted
  const pinBtn = document.getElementById("ctxPinBtn");
  if (pinBtn) {
    const canPin = (isAdmin() || isOwner()) && !data.deleted;
    pinBtn.style.display = canPin ? "" : "none";
    // Show thumbtack-slash if already pinned
    const isPinned = window._pinnedMsgId && window._pinnedMsgId === docId;
    pinBtn.innerHTML = isPinned
      ? '<i class="fa-solid fa-thumbtack-slash" style="color:var(--gold)"></i>'
      : '<i class="fa-solid fa-thumbtack"></i>';
    pinBtn.title = isPinned ? "إلغاء التثبيت" : "تثبيت الرسالة";
  }
  const copyBtn = document.getElementById("ctxCopyBtn");
  if (copyBtn) copyBtn.style.display = (data.text && !data.deleted) ? "" : "none";
  const _ctxFileUrl = data.image || data.pdf || data.audio || data.fileUrl || data.url || null;
  const copyLinkBtn = document.getElementById("ctxCopyLinkBtn");
  const copyLinkSep = document.getElementById("ctxCopyLinkSep");
  if (copyLinkBtn) copyLinkBtn.style.display = (_ctxFileUrl && !data.deleted) ? "" : "none";
  if (copyLinkSep) copyLinkSep.style.display = (_ctxFileUrl && !data.deleted) ? "" : "none";
  // ── Highlight current user's reaction ──
  const myUid = currentUser?.uid;
  const reactions = data.reactions || {};
  document.querySelectorAll("#ctxReactionBar .reaction-btn").forEach(btn => {
    const emoji = btn.dataset.emoji;
    const voters = reactions[emoji] || [];
    btn.classList.toggle("my-pick", Array.isArray(voters) && voters.includes(myUid));
  });
  if (overlay) overlay.style.display = "block";

  // ── الهيدر العادي يختفي وتظهر بدله قائمة أوامر بنفس تصميم الـ glass pill،
  //    وصف الإيموجي ينزل تحت الرسالة نفسها من غير أي بطاقة/خلفية ──
  const ncHeader   = document.querySelector(".nc-header");
  const headerPill = document.getElementById("ctxHeaderPill");
  const closeBtn   = document.getElementById("ctxHeaderCloseBtn");
  const actionRow  = document.querySelector(".ctx-action-row");
  const reactBar   = document.getElementById("ctxReactionBar");
  const msgsWrap   = document.querySelector(".newchat-shell .messages");
  const targetRow  = document.getElementById(`msg-${docId}`);

  if (ncHeader && headerPill && actionRow) {
    headerPill.insertBefore(actionRow, closeBtn || null);
    ncHeader.classList.add("ctx-mode");
    headerPill.classList.add("show");
  }
  if (msgsWrap) msgsWrap.classList.add("ctx-active");
  document.querySelectorAll(".msg-row.ctx-target").forEach(el => el.classList.remove("ctx-target"));
  if (targetRow && reactBar) {
    reactBar.classList.add("emoji-picker-inline");
    targetRow.appendChild(reactBar);
    targetRow.classList.add("ctx-target");
  }

  window._ctxJustOpened = true;
  setTimeout(() => { window._ctxJustOpened = false; }, 350);
}
window._showCtxAt = _showCtxAt;

function showMsgCtxMenu(e, docId, data) {
  e.preventDefault(); e.stopPropagation();
  const x = e.clientX || e.touches?.[0]?.clientX || window.innerWidth/2;
  const y = e.clientY || e.touches?.[0]?.clientY || window.innerHeight/2;
  _showCtxAt(x, y, docId, data);
}
window.showMsgCtxMenu = showMsgCtxMenu;

function hideMsgCtxMenu() {
  const overlay = document.getElementById("msgCtxOverlay");
  if (overlay) overlay.style.display = "none";

  const ncHeader   = document.querySelector(".nc-header");
  const headerPill = document.getElementById("ctxHeaderPill");
  const msgsWrap   = document.querySelector(".newchat-shell .messages");
  const ctxMenu    = document.getElementById("msgCtxMenu");
  const reactBar   = document.getElementById("ctxReactionBar");
  if (ncHeader) ncHeader.classList.remove("ctx-mode");
  if (headerPill) headerPill.classList.remove("show");
  if (msgsWrap) msgsWrap.classList.remove("ctx-active");
  document.querySelectorAll(".msg-row.ctx-target").forEach(el => el.classList.remove("ctx-target"));
  if (reactBar && ctxMenu) {
    reactBar.classList.remove("emoji-picker-inline");
    ctxMenu.insertBefore(reactBar, ctxMenu.firstChild);
  }
}
window.hideMsgCtxMenu = hideMsgCtxMenu;

function ctxDelete() {
  hideMsgCtxMenu();
  if (!_ctxDocId) return;
  if (typeof adminDeleteMsg === "function") adminDeleteMsg(_ctxDocId);
}
window.ctxDelete = ctxDelete;

function ctxForward() {
  hideMsgCtxMenu();
  if (!_ctxData) return;
  openFwdModal(_ctxData);
}
window.ctxForward = ctxForward;

function ctxCopy() {
  hideMsgCtxMenu();
  if (!_ctxData?.text) return;
  navigator.clipboard?.writeText(_ctxData.text).then(() => toast("تم النسخ","success")).catch(() => toast("فشل النسخ","error"));
}
window.ctxCopy = ctxCopy;

function ctxCopyLink() {
  hideMsgCtxMenu();
  if (!_ctxData) return;
  const url = _ctxData.image || _ctxData.pdf || _ctxData.audio || _ctxData.fileUrl || _ctxData.url || null;
  if (!url) return;
  navigator.clipboard?.writeText(url).then(() => toast("تم نسخ الرابط","success")).catch(() => toast("فشل نسخ الرابط","error"));
}
window.ctxCopyLink = ctxCopyLink;
