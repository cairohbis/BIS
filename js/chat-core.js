/* ══════════════════════════════════════════════════════════════
   CHAT CORE — نواة منطق الشات (Phase 1: نقل بدون تغيير سلوك)
   ▸ منقول من index.html بالحرف (1:1) — بدون إعادة كتابة أو تحسين
   ▸ يعتمد على window.* لكل تواصل مع باقي التطبيق (نفس نمط
     pin-message.js و chat-backgrounds.js)
   ▸ دفعات النقل حتى الآن:
     1. Voice Recording        (كان index.html:5150-5414)
     2. Private Chat Identity  (privateChatId, chatColPath)
     باقي أقسام الشات لسه في index.html، هتتنقل تباعًا في دفعات لاحقة
   ══════════════════════════════════════════════════════════════ */

import { doc, addDoc, collection, updateDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ──────────────────────────────────────────────────────────────
   PRIVATE CHAT IDENTITY / PATHS
   منقولة حرفيًا من index.html — pure functions، بدون أي state
   ────────────────────────────────────────────────────────────── */
// Deterministic room ID — same for both participants, always
// chatId ثابت بين طرفين — نفس النتيجة بغض النظر عمّن يبدأ
function privateChatId(otherUid) {
  return [currentUser.uid, otherUid].sort().join("_");
}

// Collection path helper — يستخدم chatId المرتب
function chatColPath(chatId) {
  if (chatId === "public") return "messages";
  if (chatId && chatId.startsWith("room:")) {
    // ✅ Path traversal protection — only allow clean room IDs
    const roomId = chatId.slice(5);
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(roomId)) return "messages"; // fallback to public
    return `rooms/${roomId}/messages`;
  }
  // ✅ Validate uid-like chatId (Firebase UIDs are alphanumeric + underscores)
  if (chatId && !/^[a-zA-Z0-9_]{1,200}$/.test(chatId.replace('_', ''))) return "messages";
  return `privateChats/${privateChatId(chatId)}/messages`;
}
window.privateChatId = privateChatId;
window.chatColPath   = chatColPath;

/* ══════════════════════════════════════════
   CHAT — VOICE RECORDING SYSTEM
   ▸ MediaRecorder → Blob → Cloudinary → Firestore
   ▸ Native <audio controls> display only — no JS injected into bubble
══════════════════════════════════════════ */
(function() {
  let _mediaRecorder = null;
  let _audioChunks   = [];
  let _recTimer      = null;
  let _recSeconds    = 0;
  let _isRecording   = false;

  const voiceBtn   = document.getElementById("chatVoiceBtn");
  const recBar     = document.getElementById("voiceRecBar");
  const inputBar   = document.getElementById("chatInputBar");
  const timerEl    = document.getElementById("voiceRecTimer");

  function _fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, "0");
    return m + ":" + sec;
  }

  function _startTimer() {
    _recSeconds = 0;
    if (timerEl) timerEl.textContent = "0:00";
    _recTimer = setInterval(function() {
      _recSeconds++;
      if (timerEl) timerEl.textContent = _fmtTime(_recSeconds);
      // Auto stop at 3 min
      if (_recSeconds >= 180) stopAndSendVoice();
    }, 1000);
  }

  function _stopTimer() {
    clearInterval(_recTimer);
    _recTimer = null;
  }

  function _showRecBar() {
    if (inputBar) inputBar.style.display = "none";
    if (recBar)   recBar.style.display   = "flex";
  }

  function _hideRecBar() {
    if (recBar)   recBar.style.display   = "none";
    if (inputBar) inputBar.style.display = "";
  }

  async function startVoiceRecording() {
    if (_isRecording) return;
    if (window._isChatBanned) { toast("أنت محظور من إرسال الرسائل", "error"); return; }
    if (window._avm && window._avm.active) { toast("⛔ لا يمكن الإرسال في وضع المشاهدة", "error"); return; }
    if (!currentUser) { toast("يجب تسجيل الدخول أولاً", "error"); return; }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch(e) {
      toast("لا يمكن الوصول إلى الميكروفون", "error");
      return;
    }

    _audioChunks = [];
    _isRecording = true;
    window._dmExtrasSetRecording?.(true);
    voiceBtn.classList.add("recording");

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : MediaRecorder.isTypeSupported("audio/m4a")
      ? "audio/m4a"
      : "audio/ogg";

    console.log("[VoiceRec] Selected mimeType:", mimeType);

    _mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });

    _mediaRecorder.addEventListener("dataavailable", function(e) {
      if (e.data && e.data.size > 0) _audioChunks.push(e.data);
    });

    _mediaRecorder.addEventListener("stop", function() {
      stream.getTracks().forEach(function(t) { t.stop(); });
    });

    _mediaRecorder.start(200);
    _showRecBar();
    _startTimer();
  }

  window.stopAndSendVoice = async function() {
    if (!_isRecording || !_mediaRecorder) return;
    _isRecording = false;
    window._dmExtrasSetRecording?.(false);
    _stopTimer();
    voiceBtn.classList.remove("recording");
    _hideRecBar();

    // Capture mimeType BEFORE stopping (before _mediaRecorder is nulled)
    const capturedMimeType = _mediaRecorder.mimeType || "audio/webm";
    const capturedRecorder = _mediaRecorder;

    capturedRecorder.stop();

    await new Promise(function(resolve) {
      capturedRecorder.addEventListener("stop", resolve, { once: true });
      setTimeout(resolve, 800);
    });

    const mimeType = capturedMimeType;
    const blob = new Blob(_audioChunks, { type: mimeType });
    _audioChunks = [];
    _mediaRecorder = null;

    // ── DEBUG: فحص الملف قبل الرفع ──
    console.log("[VoiceRec] blob.type:", blob.type);
    console.log("[VoiceRec] blob.size:", blob.size);

    if (blob.size < 500) { toast("التسجيل قصير جداً", "warn"); return; }

    const ext = mimeType.includes("ogg")
      ? ".ogg"
      : (mimeType.includes("mp4") || mimeType.includes("m4a"))
      ? ".mp4"
      : ".webm";
    const fileName = "voice_" + Date.now() + ext;

    // تحويل Blob إلى File بشكل صحيح
    const fileType = mimeType.includes("mp4") || mimeType.includes("m4a")
      ? "audio/mp4"
      : mimeType.includes("ogg")
      ? "audio/ogg"
      : mimeType;
    const file = new File([blob], fileName, { type: fileType });

    // ── DEBUG: فحص File قبل الرفع ──
    console.log("[VoiceRec] file.name:", file.name);
    console.log("[VoiceRec] file.type:", file.type);
    console.log("[VoiceRec] file.size:", file.size);
    console.log("[VoiceRec] file.size > 0:", file.size > 0);

    let upCard = null;
    try {
      upCard = (typeof _buildUploadCard === "function" ? _buildUploadCard : window._buildUploadCard)(file);

      console.log("[VoiceRec] ── بدء الرفع إلى Cloudinary ──");
      console.log("[VoiceRec] file.name:", file.name, "| file.type:", file.type, "| file.size:", file.size);

      let result;
      try {
        result = await uploadToCloudinaryWithProgress(file, function(prog) {
          if (upCard) upCard.update(prog);
        });
      } catch(uploadErr) {
        console.error("[VoiceRec] ✖ فشل الرفع إلى Cloudinary:");
        console.error("[VoiceRec] error.name:", uploadErr.name);
        console.error("[VoiceRec] error.message:", uploadErr.message);
        console.error("[VoiceRec] error.code:", uploadErr.code);
        console.error("[VoiceRec] error.stack:", uploadErr.stack);
        console.error("[VoiceRec] full error object:", uploadErr);
        throw uploadErr;
      }

      console.log("[VoiceRec] ── انتهى الرفع ──");
      console.log("[VoiceRec] result:", result);

      const url = result.url;
      console.log("[VoiceRec] ── تم استلام رابط Cloudinary ──", url);

      const isPrivate = _currentChatId !== "public";
      const colPath   = chatColPath(_currentChatId);

      const msgData = {
        uid:       currentUser.uid,
        name:      currentName,
        photo:     currentPhoto || "",
        createdAt: serverTimestamp(),
        audio:     url,
        fileName:  fileName,
        fileSize:  blob.size,
        ...(isPrivate ? {
          senderId:  currentUser.uid,
          delivered: false,
          seen:      false
        } : {
          time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
        })
      };

      console.log("[VoiceRec] ── قبل addDoc ──");
      console.log("[VoiceRec] colPath:", colPath);
      console.log("[VoiceRec] isPrivate:", isPrivate);
      console.log("[VoiceRec] msgData:", JSON.stringify(msgData, function(k, v) {
        // serverTimestamp غير قابل للتحويل JSON — نعرضه كنص
        if (v && typeof v === "object" && v.constructor && v.constructor.name === "Fb") return "[serverTimestamp]";
        return v;
      }, 2));

      try {
        await addDoc(collection(db, colPath), msgData);
      } catch(addErr) {
        console.error("[VoiceRec] ✖ فشل addDoc:");
        console.error("[VoiceRec] error.name:", addErr.name);
        console.error("[VoiceRec] error.message:", addErr.message);
        console.error("[VoiceRec] error.code:", addErr.code);
        console.error("[VoiceRec] error.stack:", addErr.stack);
        console.error("[VoiceRec] full error object:", addErr);
        console.error("[VoiceRec] msgData at failure:", msgData);
        throw addErr;
      }

      console.log("[VoiceRec] ── addDoc نجح ──");

      _awardXP(currentUser.uid, isPrivate ? XP_PER_DM_MSG : XP_PER_PUBLIC_MSG);

      if (isPrivate) {
        const _isTrueDMVoice = !_currentChatId.startsWith("room:");
        if (_isTrueDMVoice) {
          _notifyPrivateMsg(_currentChatId, currentName, "🎤 أرسل لك رسالة صوتية").catch(() => {});
        }
        const roomRef = doc(db, "privateChats", privateChatId(_currentChatId));
        updateDoc(roomRef, {
          lastMessage:   "🎤 صوت",
          lastMessageAt: serverTimestamp(),
          lastSenderId:  currentUser.uid
        }).catch(function() {});
      }

      if (upCard) upCard.markDone();
    } catch(e) {
      console.error("VOICE SEND ERROR", e);
      console.error("VOICE SEND ERROR MESSAGE", e && e.message);
      console.error("VOICE SEND ERROR NAME", e && e.name);
      console.error("VOICE SEND ERROR CODE", e && e.code);
      let _reason = (e && e.message) || (e && e.name);
      if (!_reason) {
        try { _reason = JSON.stringify(e); } catch(_j) { _reason = String(e); }
      }
      if (upCard) upCard.markFailed(_reason);
    }
  };

  window.cancelVoiceRecording = function() {
    if (!_isRecording) return;
    _isRecording = false;
    window._dmExtrasSetRecording?.(false);
    _stopTimer();
    voiceBtn.classList.remove("recording");
    _hideRecBar();
    if (_mediaRecorder) {
      try { _mediaRecorder.stop(); } catch(e) {}
    }
    _audioChunks = [];
    _mediaRecorder = null;
  };

  if (voiceBtn) {
    voiceBtn.addEventListener("click", function() {
      if (_isRecording) {
        stopAndSendVoice();
      } else {
        startVoiceRecording();
      }
    });
  }
})();
