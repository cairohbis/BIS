/* ══════════════════════════════════════════════════════════════
   CHAT CONTEXT MENU — أوامر قائمة سياق الرسائل
   ▸ منقولة حرفيًا من index.html (بدون أي تعديل منطقي)
   ▸ تعتمد على window._ctxData / window._ctxDocId (bridges get+set
     في index.html — لازمين لأن _showCtxAt بتكتب عليهم) و
     window.currentUser / window.isAdmin / window.isOwner
   ══════════════════════════════════════════════════════════════ */

function _showCtxAt(x, y, docId, data) {
  _ctxDocId = docId; _ctxData = data;
  const menu = document.getElementById("msgCtxMenu");
  const overlay = document.getElementById("msgCtxOverlay");
  if (!menu) return;
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
  const vw = window.innerWidth, vh = window.innerHeight;
  let cx = x || vw / 2, cy = y || vh / 2;
  menu.classList.remove("show");
  menu.style.opacity = "";
  requestAnimationFrame(() => {
    const mw = menu.offsetWidth || 220, mh = menu.offsetHeight || 160;
    if (cx + mw > vw - 10) cx = vw - mw - 10;
    if (cy + mh > vh - 10) cy = vh - mh - 10;
    if (cx < 8) cx = 8; if (cy < 8) cy = 8;
    menu.style.left = cx + "px"; menu.style.top = cy + "px";
    menu.style.opacity = "";
    menu.classList.add("show");
    window._ctxJustOpened = true;
    setTimeout(() => { window._ctxJustOpened = false; }, 350);
  });
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
  const menu = document.getElementById("msgCtxMenu");
  const overlay = document.getElementById("msgCtxOverlay");
  if (menu) menu.classList.remove("show");
  if (overlay) overlay.style.display = "none";
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
