/* ══════════════════════════════════════════════════════════════
   CHAT SELECT — selectChat (الأساسية، بداية سلسلة الـ wrappers)
   ▸ منقولة حرفيًا من index.html (بدون أي تعديل منطقي)
   ▸ ⚠️ مكان تحميل هذا الملف حساس جدًا: لازم يكون قبل السكريبت
     الرئيسي في index.html (نفس مكان pin-message.js/chat-backgrounds.js)
     — لأن سلسلة الـ wrapper (hook الخلفيات + hook التثبيت) بتعمل
     capture مباشر (bare reference) لـ selectChat وقت تحميل السكريبت
     الرئيسي نفسه، مش وقت التشغيل. لو الملف ده اتحمّل بعد السكريبت
     الرئيسي، هيرمي ReferenceError فورًا ويكسر باقي الموقع كله.
   ▸ صفر تعديل على سطور الـ wrapper الموجودة في index.html
   ══════════════════════════════════════════════════════════════ */

function selectChat(chatId, chatName, chatPhoto) {
  // ── حفظ مسودة المحادثة الحالية قبل التبديل ──
  _draftSave(_currentChatId);

  // للمحادثات الخاصة: إذا كانت name أو photo ناقصة، أكملها من الكاش مباشرة
  if (chatId && chatId !== "public" && !chatId.startsWith("room:")) {
    const _c = _userCache[chatId]?.data || _userCache[chatId];
    if (_c) {
      chatName  = chatName  || _c.name  || "مستخدم";
      chatPhoto = chatPhoto !== undefined ? chatPhoto : (_c.photo || "");
    }
  }

  _currentChatId   = chatId;
  _currentChatName = chatName   || (chatId === "public" ? "الشات العام" : "مستخدم");
  _currentChatPhoto= chatPhoto  || "";

  // تحديث الهيدر
  const _chatTopNameEl = document.getElementById("chatTopName");
  if (chatId && chatId !== "public" && !chatId.startsWith("room:")) {
    const _u = _userCache[chatId]?.data || _userCache[chatId] || {};
    let _badgesHTML = "";
    if (typeof window._chatListBadgesHTML === "function") {
      try { _badgesHTML = window._chatListBadgesHTML({ uid: chatId, role: _u.role }) || ""; } catch (e) {}
    }
    _chatTopNameEl.innerHTML = `<span dir="auto">${esc(_currentChatName)}${_badgesHTML}</span>`;
  } else {
    _chatTopNameEl.textContent = _currentChatName;
  }
  const topAvatar = document.getElementById("chatTopAvatar");
  if (_currentChatPhoto) topAvatar.innerHTML = `<img src="${esc(_currentChatPhoto)}" alt="">`;
  else topAvatar.innerHTML = chatId === "public" ? "<i class=\"fa-solid fa-graduation-cap\"></i>" : (chatId.startsWith("room:") ? esc(_currentChatName.charAt(0)) : _defaultAvatarHTML(_userCache[chatId]?.data?.gender, 40));

  // تحديث الحالة في الهيدر (نص + نقطة الحضور Online/Offline)
  _updateChatHeaderPresence(chatId);

  // تحديث active في قائمة DM
  document.querySelectorAll(".dm-item").forEach(el => el.classList.remove("active"));
  const activeEl = chatId === "public"
    ? document.getElementById("dm-public")
    : document.getElementById(`dm-${chatId}`);
  activeEl?.classList.add("active");

  // مسح unread badge عند فتح المحادثة
  if (chatId !== "public") {
    const roomId = privateChatId(chatId);
    if (_dmMeta[roomId]) {
      _dmMeta[roomId].unread = 0;
      _updateDmItemUI(chatId);
    }
    // تصفير فوري لعداد صفحة "المحادثات" وزر التنقل السفلي
    window._dmsMarkRead?.(chatId);
    // تشغيل إضافات المحادثة (فاصل غير مقروء + مؤشر تسجيل صوتي) إن وُجد الملف المستقل
    window._dmExtrasOnChatOpen?.(chatId);
    // إعادة تعيين onscroll سيتم داخل startChatListener
  }

  // إغلاق الـ Sidebar على الموبايل
  closeSidebar();

  // ── الانتقال لصفحة الشات إذا لم نكن فيها ──
  if (!document.getElementById("page-chat")?.classList.contains("active")) {
    showPage("page-chat");
  }

  // ── استعادة مسودة المحادثة الجديدة ──
  _draftRestore(chatId);

  // تشغيل مستمع هذه الغرفة
  startChatListener(chatId);
}
window.selectChat = selectChat;
