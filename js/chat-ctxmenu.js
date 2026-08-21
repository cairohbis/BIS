/* ══════════════════════════════════════════════════════════════
   CHAT CONTEXT MENU — أوامر قائمة سياق الرسائل
   ▸ منقولة حرفيًا من index.html (بدون أي تعديل منطقي)
   ▸ تعتمد على window._ctxData / window._ctxDocId (bridges قراءة-فقط
     موجودة أصلاً في index.html) — bare reads فقط، بدون أي كتابة
   ▸ _showCtxAt و showMsgCtxMenu مؤجلين (بيكتبوا على _ctxData/_ctxDocId
     وده متشابك مع startChatListener — هينتقلوا مع نفس المجموعة لاحقًا)
   ══════════════════════════════════════════════════════════════ */

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
