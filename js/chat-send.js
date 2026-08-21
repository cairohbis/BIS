/* ══════════════════════════════════════════════════════════════
   CHAT SEND — sendChatMsg (النسخة الـ authoritative)
   ▸ منقولة حرفيًا من index.html (بدون أي تعديل منطقي)
   ▸ _isSending/_lastSendTime: لا يوجد bridge — المستخدم الوحيد التاني
     كان نسخة sendChatMsg القديمة الميتة (بدون أي استدعاء) في index.html
   ▸ _replyData: bridge قراءة-فقط (لا كتابة هنا) — Reply System نفسه
     لسه في index.html (setReply/cancelReply لم تُنقل)
   ══════════════════════════════════════════════════════════════ */

import { addDoc, collection, doc, serverTimestamp, updateDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── sendChatMsg with reply support (single authoritative version) ──
window.sendChatMsg = async function() {
  if (!currentUser) return;
  if (_avm.active) { toast("⛔ لا يمكن الإرسال في وضع المشاهدة","error"); return; }
  if (_isChatBanned) { toast("أنت محظور من إرسال الرسائل","error"); return; }
  if (_isSending) return;
  const now = Date.now();
  if (now - _lastSendTime < SPAM_INTERVAL_MS) { toast("انتظر قليلاً","warn"); return; }
  const input = document.getElementById("chatInput");
  const text  = input.value.trim();
  if (!text) return;
  _isSending = true; _lastSendTime = now;
  const sendBtn = document.getElementById("chatSendBtn");
  sendBtn.disabled = true;
  input.value = ""; input.focus();
  const isPrivate = _currentChatId !== "public";
  const colPath   = chatColPath(_currentChatId);
  try {
    const msgData = {
      text, uid: currentUser.uid, name: currentName, photo: currentPhoto,
      createdAt: serverTimestamp(),
      ...(isPrivate ? { senderId: currentUser.uid, delivered: false, seen: false }
                    : { time: new Date().toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"}) })
    };
    if (_replyData) msgData.reply = {
      docId: _replyData.docId || "",
      name:  _replyData.name  || "",
      text:  _replyData.text  || "",
      ..._replyData.image ? { image: _replyData.image } : {},
      ..._replyData.audio ? { audio: true, fileName: _replyData.fileName||"" } : {},
      ..._replyData.pdf   ? { pdf:   true, fileName: _replyData.fileName||"" } : {},
      ..._replyData.file  ? { file:  true, fileName: _replyData.fileName||"" } : {},
    };
    await addDoc(collection(db, colPath), msgData);
    _awardXP(currentUser.uid, isPrivate ? XP_PER_DM_MSG : XP_PER_PUBLIC_MSG);
    const _isTrueDM2 = isPrivate && !_currentChatId.startsWith("room:");
    if (_isTrueDM2) {
      _notifyPrivateMsg(_currentChatId, currentName, text).catch(() => {});
    } else {
      if (_replyData) _notifyReply(_replyData, currentName, text).catch(() => {});
      _notifyMentions(text, currentName).catch(() => {});
    }
    if (isPrivate) {
      const roomRef = doc(db, "privateChats", privateChatId(_currentChatId));
      updateDoc(roomRef, {
        lastMessage: text.length>60?text.slice(0,60)+"…":text,
        lastMessageAt: serverTimestamp(), lastSenderId: currentUser.uid
      }).catch(e=>{ if(e.code!=="permission-denied") console.warn("lastMsg update:",e.code); });
    }
  } catch(e) {
    toast("فشل إرسال الرسالة","error"); console.error(e); input.value = text;
  } finally {
    _isSending = false; sendBtn.disabled = false;
    cancelReply(); input.focus();
  }
};
