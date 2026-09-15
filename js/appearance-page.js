/* ══════════════════════════════════════════════════════════════
   APPEARANCE PAGE — js
   ▸ صفر state/دوال جديدة: كل كارت بيستعير العنصر الحقيقي من
     قسم الإعدادات القديم (نفس الـ id بالحرف) وقت الفتح، ويرجّعه
     لمكانه بالظبط وقت القفل — عشان Settings → المظهر يفضل شغال
     طبيعي زي ما هو من غير أي تغيير فيه
   ══════════════════════════════════════════════════════════════ */
(function () {
  const shell = document.querySelector(".newchat-shell");
  if (!shell) return;
  const phone = shell.querySelector(".phone");
  if (!phone) return;

  /* ── تعريف الكروت: كل كارت = أيقونة + لون + العنصر القديم المطلوب نقله ── */
  const CARDS = [
    {
      key: "fontsize",
      title: "حجم الخط",
      color: "#5aa9ff",
      bg: "rgba(90,169,255,0.16)",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v12"/><path d="M4 14h6"/><path d="M15 20V10a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v10"/><path d="M15 15h3"/></svg>',
      controlId: "apFontSizeRow"
    },
    {
      key: "fontweight",
      title: "سُمك الخط",
      color: "#a78bfa",
      bg: "rgba(167,139,250,0.16)",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 0 8H6z"/><path d="M6 12h9a4 4 0 0 1 0 8H6z"/></svg>',
      controlId: "apFontWeightRow"
    },
    {
      key: "mycolor",
      title: "لون فقاعة رسائلك",
      color: "#c9a96e",
      bg: "rgba(201,169,110,0.16)",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.5 7.06a7 7 0 1 1-11 0z"/></svg>',
      controlId: "bubbleColorPickerSlot"
    },
    {
      key: "othercolor",
      title: "لون فقاعة الطرف الآخر",
      color: "#14b8a6",
      bg: "rgba(20,184,166,0.16)",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".6"/><circle cx="17.5" cy="10.5" r=".6"/><circle cx="8.5" cy="7.5" r=".6"/><circle cx="6.5" cy="12.5" r=".6"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
      controlId: "otherBubbleColorPickerSlot"
    },
    {
      key: "blur",
      title: "الشفافية",
      color: "#22d3ee",
      bg: "rgba(34,211,238,0.16)",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l7 5-7 5-7-5z"/><path d="M5 12l7 5 7-5"/><path d="M5 17l7 5 7-5"/></svg>',
      controlId: "bubbleBlurPickerSlot"
    }
  ];

  /* ── بناء هيكل الصفحة مرة واحدة ── */
  const page = document.createElement("div");
  page.className = "nc-ap-page";
  page.id = "ncAppearancePage";

  const cardsHtml = CARDS.map(function (c) {
    return (
      '<div class="nc-ap-card" data-key="' + c.key + '">' +
        '<button type="button" class="nc-ap-card-head">' +
          '<div class="nc-ap-card-icon" style="--ic:' + c.color + ';--ic-bg:' + c.bg + '">' + c.icon + "</div>" +
          '<div class="nc-ap-card-title">' + c.title + "</div>" +
          '<svg class="nc-ap-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>' +
        "</button>" +
        '<div class="nc-ap-card-body"><div class="nc-ap-card-body-inner"></div></div>' +
      "</div>"
    );
  }).join("");

  page.innerHTML =
    '<div class="nc-ap-header">' +
      '<button type="button" class="nc-ap-back" id="ncApBackBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>' +
      '<div class="nc-ap-title">المظهر</div>' +
    "</div>" +
    '<div class="nc-ap-body">' + cardsHtml + "</div>";

  phone.appendChild(page);

  /* ── منطق نقل العناصر القديمة ذهابًا وإيابًا ── */
  const _originals = {}; // key -> {el, parent, next}

  function _capture(card) {
    if (_originals[card.key]) return _originals[card.key];
    const el = document.getElementById(card.controlId);
    if (!el) return null;
    const orig = { el: el, parent: el.parentNode, next: el.nextSibling };
    _originals[card.key] = orig;
    return orig;
  }

  function moveIn(card, bodyInner) {
    const orig = _capture(card);
    if (!orig) return;
    bodyInner.appendChild(orig.el);
  }

  function moveBack(card) {
    const orig = _originals[card.key];
    if (!orig) return;
    orig.parent.insertBefore(orig.el, orig.next);
  }

  /* ── فتح/قفل الصفحة ── */
  function openPage() {
    page.classList.add("open");
    CARDS.forEach(function (c) {
      const cardEl = page.querySelector('.nc-ap-card[data-key="' + c.key + '"]');
      const bodyInner = cardEl.querySelector(".nc-ap-card-body-inner");
      moveIn(c, bodyInner);
    });
    document.body.style.overflow = "hidden";
    window._navPush?.("appearance-page", closePage);
  }

  function closePage() {
    if (window._navGoBackIfMatches?.("appearance-page")) return;
    page.classList.remove("open");
    CARDS.forEach(function (c) { moveBack(c); });
    // اقفل أي كارت مفتوح استعدادًا للفتح الجاي
    page.querySelectorAll(".nc-ap-card.open").forEach(function (el) { el.classList.remove("open"); });
    document.body.style.overflow = "";
  }

  window.openAppearancePage = openPage;
  window.closeAppearancePage = closePage;

  document.getElementById("ncApBackBtn").addEventListener("click", closePage);

  /* ── أكورديون: كارت واحد مفتوح في نفس الوقت ── */
  page.querySelectorAll(".nc-ap-card-head").forEach(function (head) {
    head.addEventListener("click", function () {
      const card = head.closest(".nc-ap-card");
      const wasOpen = card.classList.contains("open");
      page.querySelectorAll(".nc-ap-card.open").forEach(function (el) { el.classList.remove("open"); });
      if (!wasOpen) card.classList.add("open");
    });
  });

  /* ── لو حد فتح Settings ← المظهر القديم عادي، رجّع أي عنصر لسه
     مستعار عندنا لمكانه الأصلي، عشان القسم القديم يفضل شغال طبيعي ── */
  const _origSwitchTab = window.switchSettingsTab;
  if (typeof _origSwitchTab === "function") {
    window.switchSettingsTab = function (tab) {
      if (tab === "appearance") {
        CARDS.forEach(function (c) { moveBack(c); });
      }
      return _origSwitchTab.apply(this, arguments);
    };
  }
})();
