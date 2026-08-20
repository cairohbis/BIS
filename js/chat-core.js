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

/* ──────────────────────────────────────────────────────────────
   MESSAGE RENDERING — appendChatMsg
   منقولة حرفيًا من index.html (بدون أي تعديل منطقي)
   الاعتمادات (OWNER_UID, _userCache) بقت عبر window.* — bridges
   مضافة في index.html جنب تعريفاتها الأصلية
   ────────────────────────────────────────────────────────────── */
/* ══════════════════════════════════════════
   CHAT — APPEND MESSAGE
══════════════════════════════════════════ */
function appendChatMsg(container, docId, d, prevDate, setDate, prevSenderUid, setSenderUid) {
  // ✅ Soft Delete — اعرض placeholder للأدمن، أخفِ عن المستخدم العادي
  if (d.deleted === true) {
    if (!isAdmin()) return; // المستخدم العادي لا يرى شيئاً
    // الأدمن يرى placeholder
    d = {
      ...d,
      text:  '🗑 [محذوفة] ' + (d.text || '').slice(0, 40),
      image: null,
    };
  }
  const isMe  = d.uid === currentUser?.uid;
  const msgTs = d.createdAt?.toDate?.() || new Date();
  const dateStr = msgTs.toLocaleDateString("ar-EG", {weekday:"long", day:"numeric", month:"long"});

  // خاص/عام/غرفة — نفس المتغيّر المستخدَم فعلياً لهذا الغرض في باقي الدالة (سطر statusTick)
  const isPrivateChat = !!(_currentChatId && _currentChatId !== "public" && !_currentChatId.startsWith("room:"));

  // تجميع الرسائل المتتالية من نفس المُرسِل (تباعد أقل، زي واتساب) —
  // يُقارَن بقيمة prevDate/prevSenderUid كما وصلت (أي قبل تحديثها بهذه الرسالة)
  const isGrouped = !!(prevSenderUid !== undefined && prevSenderUid === d.uid && prevDate === dateStr);

  // Date divider — بدون أي تغيير
  if (prevDate !== dateStr) {
    setDate(dateStr);
    const divider = document.createElement("div");
    divider.className = "date-divider";
    divider.innerHTML = `<span>${dateStr}</span>`;
    container.appendChild(divider);
  }
  setSenderUid?.(d.uid);

  const timeStr = msgTs.toLocaleTimeString("ar-EG", {hour:"2-digit", minute:"2-digit"});

  const row = document.createElement("div");
  row.className = `msg-row ${isMe ? "me" : "other"}${isGrouped ? " grouped" : ""}`;
  row.id = `msg-${docId}`;

  // Avatar (only for "other") — نفس المنطق، فقط المقاس اتغيّر لـ 18 ليطابق التصميم
  let avatarHtml = "";
  if (!isMe) {
    const _msgGender = (() => {
      if (d.uid && _userCache[d.uid]) {
        const c = _userCache[d.uid]; return (c?.data || c)?.gender;
      }
      return d.gender;
    })();
    avatarHtml = `<div class="msg-avatar-sm" data-avatar-uid="${esc(d.uid)}">${d.photo ? `<img src="${esc(d.photo)}" alt="">` : _defaultAvatarHTML(_msgGender, 18)}</div>`;
  }

  // Bubble content — بدون أي تغيير (كل الفروع: نص/صورة/صوت/ملف/PDF/استطلاع)
  let bubbleContent = "";
  let isImageBubble = false;
  if (d.deleted) {
    bubbleContent = `<div class="bubble-text" style="color:var(--muted);font-style:italic;font-size:12px;">🗑 [محذوفة]</div>`;
  } else if (d.pdf) {
    bubbleContent = `<div class="bubble-text"><a href="${esc(d.pdf)}" target="_blank" rel="noopener" style="color:var(--gold);display:flex;align-items:center;gap:6px;"><i class="fa-solid fa-file-pdf"></i> ${esc(d.fileName||"ملف PDF")} <i class="fa-solid fa-arrow-up-right-from-square fa-xs"></i></a></div>`;
  } else if (d.audio) {
    const safeSrc = typeof d.audio === "string" && d.audio.startsWith("https://res.cloudinary.com") ? d.audio : "";
    bubbleContent = safeSrc
      ? `<div class="bubble-text" style="display:flex;flex-direction:column;gap:6px;">
           <div style="display:flex;align-items:center;gap:7px;">
             <i class="fa-solid fa-microphone" style="color:var(--gold)"></i>
             <span style="font-size:12px;font-weight:700;">${esc(d.fileName||"تسجيل صوتي")}</span>
           </div>
           <audio controls style="width:100%;max-width:240px;height:32px;" src="${esc(safeSrc)}"></audio>
         </div>`
      : `<div class="bubble-text" style="color:var(--muted);font-size:12px;"><i class="fa-solid fa-microphone"></i> صوت</div>`;
  } else if (d.file) {
    const safeSrc = typeof d.file === "string" && d.file.startsWith("https://res.cloudinary.com") ? d.file : "";
    const ext = (d.fileName||"").split(".").pop().toUpperCase();
    const fIcon = ext === "ZIP" || ext === "RAR" || ext === "7Z" ? "fa-file-zipper"
      : ext === "DOC" || ext === "DOCX" ? "fa-file-word"
      : ext === "XLS" || ext === "XLSX" ? "fa-file-excel"
      : ext === "PPT" || ext === "PPTX" ? "fa-file-powerpoint"
      : "fa-file";
    bubbleContent = safeSrc
      ? `<div class="bubble-text"><a href="${esc(safeSrc)}" target="_blank" rel="noopener" style="color:var(--gold);display:flex;align-items:center;gap:7px;">
           <i class="fa-solid ${fIcon}"></i>
           <span>${esc(d.fileName||"ملف")}</span>
           ${d.fileSize ? `<span style="font-size:10px;color:var(--muted);">${_formatSize(d.fileSize)}</span>` : ""}
           <i class="fa-solid fa-arrow-up-right-from-square fa-xs"></i>
         </a></div>`
      : `<div class="bubble-text" style="color:var(--muted);font-size:12px;"><i class="fa-solid fa-file"></i> ملف</div>`;
  } else if (d.image) {
    const _safeImg = (typeof d.image === 'string' &&
      (d.image.startsWith('https://firebasestorage.googleapis.com') ||
       d.image.startsWith('https://storage.googleapis.com') ||
       d.image.startsWith('https://res.cloudinary.com')))
      ? d.image : '';
    if (_safeImg) {
      bubbleContent = `<div class="bubble-image"><img src="${esc(_safeImg)}" alt="صورة" onclick="openLightbox('${esc(_safeImg)}')"></div>`;
      isImageBubble = true;
    } else {
      bubbleContent = `<div class="bubble-text" style="color:var(--muted);font-size:12px;"><i class="fa-solid fa-image"></i> صورة غير صالحة</div>`;
    }
  } else if (d.poll) {
    bubbleContent = window._buildPollHTML(docId, d.poll, currentUser?.uid);
  } else {
    bubbleContent = `<div class="bubble-text">${esc(d.text||"")}</div>`;
  }

  // ═══ تغيير 3: أيقونات SVG بدل يونيكود، نفس الشروط بالظبط ═══
  const _checkSvg2 = `<svg width="14" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 5l3 3 5-7"/><path d="M6 5l3 3 6-7"/></svg>`;
  const _checkSvg1 = `<svg width="12" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 5l3 3 8-9"/></svg>`;

  let statusTick = "";
  if (isMe && _currentChatId !== "public") {
    if (d.seen)           statusTick = `<span class="bubble-status seen">${_checkSvg2}</span>`;
    else if (d.delivered) statusTick = `<span class="bubble-status">${_checkSvg2}</span>`;
    else                  statusTick = `<span class="bubble-status">${_checkSvg1}</span>`;
  } else if (isMe) {
    statusTick = `<span class="bubble-status seen">${_checkSvg2}</span>`;
  }

  // بيانات صلاحيات الحذف/الحظر — تُقرأ لاحقاً من صندوق الضغط المطوّل العائم
  // (لا أزرار مضمَّنة في تخطيط الرسالة إطلاقاً بعد الآن — صفر تأثير على المساحات)
  let canDelete = false, canBan = false;
  if (isAdmin() && !isMe) {
    canDelete = true;
    canBan = d.uid !== OWNER_UID;
  } else if (isMe) {
    canDelete = true;
  }

  // Sender name with badges — بدون أي تغيير
  const _msgUser = (() => {
    if (d.uid && _userCache[d.uid]) {
      const cached = _userCache[d.uid];
      return cached?.data || cached;
    }
    return { uid: d.uid, name: d.name, photo: d.photo, role: d.role, isVerified: d.isVerified, level: d.level, xp: d.xp };
  })();

  if (canDelete) row.dataset.canDelete = "1";
  if (canBan) {
    row.dataset.canBan = "1";
    row.dataset.senderUid  = d.uid || "";
    row.dataset.senderName = d.name || "";
  }

  const metaHTML = `<span class="bubble-time-in${isImageBubble ? " on-image" : ""}"><span class="bubble-time">${timeStr}</span>${d.edited ? `<span class="edited-label" style="font-size:10px;color:var(--muted);font-style:italic;margin-inline-start:3px;">تم التعديل</span>` : ""}${statusTick}</span>`;

  // ═══ تغيير 1 + 2: إعادة توزيع نفس العناصر داخل الهيكل الجديد ═══
  row.innerHTML = `
    ${(!isMe && !isPrivateChat) ? `<div class="msg-sender">${avatarHtml}<div class="msg-sender-name" data-sender-uid="${esc(d.uid)}">${renderUserDisplay(d.name||"", _msgUser, d.uid)}</div></div>` : ""}
    <div class="msg-bubble-group">
      <div class="msg-line">
        <div class="bubble ${isMe ? "me" : "other"}">
          ${bubbleContent}${metaHTML}
        </div>
      </div>
    </div>
  `;

  container.appendChild(row);

  // ── Poll: بدون أي تغيير ──
  if (d.poll && typeof window._ensurePollListener === "function") window._ensurePollListener(docId);

  // ── Reaction chips: بدون أي تغيير ──
  if (d.reactions && Object.keys(d.reactions).length) {
    if (typeof _updateReactionChips === "function") _updateReactionChips(row, docId, d.reactions);
  }

  // ── VIP listener: بدون أي تغيير ──
  if (d.uid && d.uid !== currentUser?.uid) _ensureVipListener(d.uid);

  // ── Reply preview: بدون أي تغيير (row.querySelector(".bubble") لسه بيلاقيها) ──
  if (d.reply) {
    const bubble = row.querySelector(".bubble");
    if (bubble) bubble.insertAdjacentHTML("afterbegin", _buildReplyPreviewHTML ? _buildReplyPreviewHTML(d.reply) : "");
  }

  // ── Forwarded label: بدون أي تغيير ──
  if (d.forwarded) {
    const bubble = row.querySelector(".bubble");
    if (bubble) bubble.insertAdjacentHTML("afterbegin", `<div class="fwd-label"><i class="fa-solid fa-share"></i> تمت إعادة التوجيه</div>`);
  }

  // ── Long-press / Swipe-to-reply: بدون أي تغيير ──
  if (typeof _attachLongPress === "function") _attachLongPress(row, docId, d);
  if (typeof _attachSwipeReply === "function") _attachSwipeReply(row, docId, d);

  // ── زر الرد الدائم — التعديل الوحيد على الـ IIFE: المكان بقى .msg-line ──
  (function() {
    const _line = row.querySelector(".msg-line");
    const _bub  = _line && _line.querySelector(".bubble");
    if (_line && _bub && !_line.querySelector(".msg-reply-btn")) {
      const _btn = document.createElement("button");
      _btn.className = "msg-reply-btn";
      _btn.title = "رد";
      _btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 015 5v2"/></svg>`;
      _btn.addEventListener("click", function(e) {
        e.stopPropagation();
        setReply({ docId: docId, name: d.name||"", text: d.text||"", image: d.image||"", audio: d.audio||false, pdf: d.pdf||false, file: d.file||false, fileName: d.fileName||"" });
      });
      _line.appendChild(_btn);
    }
  })();

  // ── Swipe delegation / double-tap reaction: بدون أي تغيير ──
  const _realCont = document.getElementById("chatMessages");
  if (_realCont && typeof _initSwipeDelegation === "function") _initSwipeDelegation(_realCont);
  if (_realCont && typeof _initDoubleTapReaction === "function") _initDoubleTapReaction(_realCont);
}

window.appendChatMsg = appendChatMsg;
