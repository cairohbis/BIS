/* ══════════════════════════════════════════════════════════════
   CHAT REPLY SYSTEM — الرد على الرسائل
   ▸ منقولة حرفيًا من index.html (بدون أي تعديل منطقي)
   ▸ تعتمد على window._replyData (bridge get+set)، window._ctxData/
     window._ctxDocId (bridges موجودة)، window.esc، window.jumpToMsg،
     window.hideMsgCtxMenu (من js/chat-ctxmenu.js) — كلها عبر window.*
   ══════════════════════════════════════════════════════════════ */

// خاص/غرفة/عام — بنفس منطق isPrivateChat المستخدَم في chat-core.js
function _isPrivateDMChat() {
  const id = window._currentChatId;
  return !!(id && id !== "public" && !id.startsWith("room:"));
}
window._isPrivateDMChat = _isPrivateDMChat;

function setReply(data) {
  _replyData = data;
  const bar  = document.getElementById("replyBar");
  const name = document.getElementById("replyBarName");
  const text = document.getElementById("replyBarText");
  if (!bar) return;
  // في الشات الخاص: بدون اسم (الغرف/العام: يظهر الاسم كالمعتاد)
  if (_isPrivateDMChat()) {
    name.textContent = "";
    name.style.display = "none";
  } else {
    name.style.display = "";
    name.textContent = data.name || "مستخدم";
  }
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
  // في الشات الخاص: بدون اسم فوق محتوى الرد (الغرف/العام: يظهر الاسم كالمعتاد)
  const nameHTML = _isPrivateDMChat() ? "" : `<div class="reply-preview-name">${esc(reply.name||"مستخدم")}</div>`;
  return `<div class="reply-preview" onclick="jumpToMsg('${esc(reply.docId||"")}')">
    ${nameHTML}
    ${content}
  </div>`;
}
window._buildReplyPreviewHTML = _buildReplyPreviewHTML;
