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

/* ══════════════════════════════════════════════════════════════
   قائمة الثلاث نقاط (⋮) — البحث + المظهر
   ▸ البحث: نفس نظام js/chat-search.js بالحرف (toggleChatSearch/
     onChatSearch/...) — العنصر #chatSearchBar بينتقل لمكانه في
     التصميم الجديد (نفس id، نفس onclick attributes، بدون نسخ)
   ▸ المظهر: window.openAppearancePage() من js/appearance-page.js —
     صفحة عرض جديدة، لكنها بتستعير نفس عناصر التحكم القديمة بالحرف
   ══════════════════════════════════════════════════════════════ */
(function () {
  const shell = document.querySelector(".newchat-shell");
  if (!shell) return;

  const menuBtn = document.getElementById("chatMenuBtn");
  const phone   = shell.querySelector(".phone");
  if (!menuBtn || !phone) return;

  /* نقل بار البحث القديم بالكامل (نفس العنصر) لمكانه الصحيح داخل
     التصميم الجديد — كان جوه #oldChatMainLegacy (display:none) فمكانش
     ظاهر أبدًا حتى لو اتفتح، رغم إن نظام البحث نفسه شغال على
     #chatMessages الحقيقي أصلًا */
  const searchBar = document.getElementById("chatSearchBar");
  if (searchBar && searchBar.parentElement !== phone) {
    phone.appendChild(searchBar);
  }

  /* القائمة المنسدلة */
  const menu = document.createElement("div");
  menu.className = "nc-menu";
  menu.innerHTML =
    '<button type="button" class="nc-menu-item" id="ncMenuSearch">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      "<span>البحث</span>" +
    "</button>" +
    '<button type="button" class="nc-menu-item" id="ncMenuAppearance">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' +
      "<span>المظهر</span>" +
    "</button>";
  phone.appendChild(menu);

  function positionMenu() {
    const btnRect   = menuBtn.getBoundingClientRect();
    const phoneRect = phone.getBoundingClientRect();
    menu.style.top   = (btnRect.bottom - phoneRect.top + 8) + "px";
    // الزرار قريب من أقصى يمين الهيدر (RTL) — نثبّت حافة القائمة اليمنى
    // على حافة الزرار اليمنى بدل اليسرى، عشان متطلعش برّه حدود الشاشة
    menu.style.left  = "auto";
    menu.style.right = (phoneRect.right - btnRect.right) + "px";
  }

  function openMenu() {
    positionMenu();
    menu.classList.add("open");
  }
  function closeMenu() {
    menu.classList.remove("open");
  }

  menuBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (menu.classList.contains("open")) closeMenu();
    else openMenu();
  });

  document.addEventListener("click", function (e) {
    if (!menu.classList.contains("open")) return;
    if (e.target === menuBtn || menu.contains(e.target)) return;
    closeMenu();
  });

  menu.querySelector("#ncMenuSearch").addEventListener("click", function () {
    closeMenu();
    if (typeof window.toggleChatSearch === "function") window.toggleChatSearch();
  });

  menu.querySelector("#ncMenuAppearance").addEventListener("click", function () {
    closeMenu();
    if (typeof window.openAppearancePage === "function") window.openAppearancePage();
  });
})();
