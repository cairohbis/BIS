/* ══════════════════════════════════════════════════════════════
   CHAT REPLY SYSTEM — الرد على الرسائل
   ▸ منقولة حرفيًا من index.html (بدون أي تعديل منطقي)
   ▸ تعتمد على window._replyData (bridge get+set)، window._ctxData/
     window._ctxDocId (bridges موجودة)، window.esc، window.jumpToMsg،
     window.hideMsgCtxMenu (من js/chat-ctxmenu.js) — كلها عبر window.*
   ══════════════════════════════════════════════════════════════ */

function setReply(data) {
  _replyData = data;
  const bar  = document.getElementById("replyBar");
  const name = document.getElementById("replyBarName");
  const text = document.getElementById("replyBarText");
  if (!bar) return;
  name.textContent = data.name || "مستخدم";
  if (data.image)      text.textContent = "📷 صورة";
  else if (data.audio) text.textContent = "🎤 تسجيل صوتي";
  else if (data.pdf)   text.textContent = "📄 " + (data.fileName || "PDF");
  else if (data.file)  text.textContent = "📎 " + (data.fileName || "ملف");
  else                 text.textContent = (data.text || "").slice(0, 80);
  bar.classList.add("show");
  document.getElementById("chatInput")?.focus();
}
window.setReply = setReply;

function cancelReply() {
  _replyData = null;
  const bar = document.getElementById("replyBar");
  if (bar) bar.classList.remove("show");
}
window.cancelReply = cancelReply;

function ctxReply() {
  hideMsgCtxMenu();
  if (!_ctxData) return;
  setReply({ docId: _ctxDocId, ..._ctxData });
}
window.ctxReply = ctxReply;

function _buildReplyPreviewHTML(reply) {
  if (!reply) return "";
  let content = "";
  if (reply.image)      content = `<img class="reply-preview-img" src="${esc(reply.image)}" alt=""><span class="reply-preview-text">📷 صورة</span>`;
  else if (reply.audio) content = `<span class="reply-preview-text">🎤 تسجيل صوتي</span>`;
  else if (reply.pdf)   content = `<span class="reply-preview-text">📄 ${esc(reply.fileName||"PDF")}</span>`;
  else if (reply.file)  content = `<span class="reply-preview-text">📎 ${esc(reply.fileName||"ملف")}</span>`;
  else                  content = `<span class="reply-preview-text">${esc((reply.text||"").slice(0,80))}</span>`;
  return `<div class="reply-preview" onclick="jumpToMsg('${esc(reply.docId||"")}')">
    <div class="reply-preview-name">${esc(reply.name||"مستخدم")}</div>
    ${content}
  </div>`;
}
window._buildReplyPreviewHTML = _buildReplyPreviewHTML;
