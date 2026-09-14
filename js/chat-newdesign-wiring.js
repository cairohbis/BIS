/* ══════════════════════════════════════════════════════════════
   NEW CHAT UI — ربط أزرار التصميم الجديد بالأنظمة القديمة
   ▸ صفر تعديل في Firebase / appendChatMsg / chat-select.js /
     newchat-ui-script (السكريبت الأصلي بتاع مرحلة 1 واجهة فقط)
   ▸ الاعتماد الوحيد على chat-core.js: pauseVoiceRecording /
     resumeVoiceRecording (الدالتين المضافتين فقط)
   ══════════════════════════════════════════════════════════════ */
(function () {
  const shell = document.querySelector(".newchat-shell");
  if (!shell) return;

  const phone     = shell.querySelector(".phone");
  const backArrow = shell.querySelector(".back-arrow");
  const emojiIcon = shell.querySelector(".emoji-icon");
  const clipIcon  = shell.querySelector(".clip-icon");
  const micIcon   = shell.querySelector(".mic-icon");
  const inputBar  = shell.querySelector(".input-bar");

  /* ── الرجوع ── */
  if (backArrow) {
    backArrow.addEventListener("click", function () {
      if (typeof window.closeChatPage === "function") window.closeChatPage();
    });
  }

  /* ── الإيموجي: تفعيل البيكر القديم (بيكتب أصلاً في #chatInput نفسه) ── */
  if (emojiIcon) {
    emojiIcon.addEventListener("click", function (e) {
      e.stopPropagation();
      const oldBtn = document.getElementById("chatEmojiBtn");
      if (oldBtn) oldBtn.click();
    });
  }

  /* ── المشبك: نظام الملفات القديم مباشرة ── */
  if (clipIcon) {
    clipIcon.addEventListener("click", function () {
      const fileInput = document.getElementById("chatFileInput");
      if (fileInput) fileInput.click();
    });
  }

  /* ══════════════════════════════════════════
     المايك — واجهة تسجيل تطابق التصميم الجديد،
     فوق نظام التسجيل القديم في chat-core.js بدون أي تعديل فيه
  ══════════════════════════════════════════ */
  let recBarEl   = null;
  let isPaused   = false;
  let mirrorObs  = null;

  const PAUSE_SVG  = '<svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';
  const RESUME_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M7 5l12 7-12 7z"/></svg>';

  function buildRecBar() {
    if (recBarEl) return recBarEl;
    recBarEl = document.createElement("div");
    recBarEl.className = "nc-rec-bar";
    recBarEl.innerHTML =
      '<div class="nc-rec-left">' +
        '<div class="nc-rec-dot"></div>' +
        '<div class="nc-rec-timer" id="ncRecTimer">0:00</div>' +
      "</div>" +
      '<div class="nc-rec-right">' +
        '<button type="button" class="nc-rec-btn nc-rec-cancel" title="إلغاء">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        "</button>" +
        '<button type="button" class="nc-rec-btn nc-rec-pause" title="إيقاف مؤقت">' + PAUSE_SVG + "</button>" +
        '<button type="button" class="nc-rec-btn nc-rec-send" title="إرسال">' +
          '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M3 20l18-8L3 4v6l12 2-12 2z"/></svg>' +
        "</button>" +
      "</div>";
    (phone || shell).appendChild(recBarEl);

    recBarEl.querySelector(".nc-rec-cancel").addEventListener("click", function () {
      if (typeof window.cancelVoiceRecording === "function") window.cancelVoiceRecording();
      hideRecBar();
    });
    recBarEl.querySelector(".nc-rec-send").addEventListener("click", function () {
      if (typeof window.stopAndSendVoice === "function") window.stopAndSendVoice();
      hideRecBar();
    });
    recBarEl.querySelector(".nc-rec-pause").addEventListener("click", function (e) {
      const btn = e.currentTarget;
      if (!isPaused) {
        if (typeof window.pauseVoiceRecording === "function") window.pauseVoiceRecording();
        isPaused = true;
        btn.classList.add("is-resume");
        btn.title = "استئناف";
        btn.innerHTML = RESUME_SVG;
      } else {
        if (typeof window.resumeVoiceRecording === "function") window.resumeVoiceRecording();
        isPaused = false;
        btn.classList.remove("is-resume");
        btn.title = "إيقاف مؤقت";
        btn.innerHTML = PAUSE_SVG;
      }
    });

    return recBarEl;
  }

  function startTimerMirror() {
    const src = document.getElementById("voiceRecTimer");
    const dst = document.getElementById("ncRecTimer");
    if (!src || !dst) return;
    dst.textContent = src.textContent;
    mirrorObs = new MutationObserver(function () { dst.textContent = src.textContent; });
    mirrorObs.observe(src, { childList: true, characterData: true, subtree: true });
  }

  function stopTimerMirror() {
    if (mirrorObs) { mirrorObs.disconnect(); mirrorObs = null; }
  }

  function showRecBar() {
    isPaused = false;
    const bar = buildRecBar();
    const pauseBtn = bar.querySelector(".nc-rec-pause");
    pauseBtn.classList.remove("is-resume");
    pauseBtn.title = "إيقاف مؤقت";
    pauseBtn.innerHTML = PAUSE_SVG;
    bar.querySelector("#ncRecTimer").textContent = "0:00";
    bar.style.display = "flex";
    if (inputBar) inputBar.style.display = "none";
    startTimerMirror();
  }

  function hideRecBar() {
    if (recBarEl) recBarEl.style.display = "none";
    if (inputBar) inputBar.style.display = "";
    stopTimerMirror();
  }

  if (micIcon) {
    micIcon.addEventListener("click", function () {
      const oldVoiceBtn = document.getElementById("chatVoiceBtn");
      if (!oldVoiceBtn) return;
      oldVoiceBtn.click(); // يبدأ/يوقف التسجيل الفعلي داخل chat-core.js؛
      // الواجهة الجديدة تتبع class "recording" على الزرار القديم عبر
      // MutationObserver واحد بالأسفل — بدون أي تخمين توقيت
    });
  }

  /* مصدر الحقيقة الوحيد لظهور/اختفاء الواجهة الجديدة: class "recording"
     على #chatVoiceBtn نفسه (هو ده اللي chat-core.js بيضيفه/بيشيله فعليًا
     عند بداية/نهاية التسجيل الحقيقي — نفس الـ class المستخدم في
     css/style.css#chatVoiceBtn.recording). ملاحظة observer واحد بيغطي
     الحالتين (ظهور عند الإضافة، اختفاء عند الإزالة أيًا كان مصدرها:
     إرسال، إلغاء، أو auto-stop بعد 3 دقايق) */
  const oldVoiceBtnEl = document.getElementById("chatVoiceBtn");
  if (oldVoiceBtnEl) {
    new MutationObserver(function () {
      const isRecordingNow = oldVoiceBtnEl.classList.contains("recording");
      const barVisible = !!recBarEl && recBarEl.style.display === "flex";
      if (isRecordingNow && !barVisible) showRecBar();
      else if (!isRecordingNow && barVisible) hideRecBar();
    }).observe(oldVoiceBtnEl, { attributes: true, attributeFilter: ["class"] });
  }
})();
