/* ══════════════════════════════════════════════════════════════
   js/bubble-gradient-scroll.js — جريديانت متحرك لفقاعات "أنا" مع السكرول
   (بنفسجي فوق ← أزرق تحت، بالظبط زي ملف الاختبار المتفق عليه)

   ملف معزول بالكامل — مفيش أي تعديل على css/chat-bubbles.css أو
   js/bubble-color.js أو أي ملف تاني. الشكل/الحجم/الشادو لفقاعة
   .bubble.me فاضل زي ما هو تمامًا — الملف ده بيغيّر اللون بس.

   بيشتغل على #chatMessages فقط (الشات العادي/الخاص) — مش صفحة
   AI Chat (#aiChatBody)، دي فضلت بألوانها الأصلية زي ما هي.

   الطريقة: بيحط اللون كـ CSS variable محلي (inline) على كل فقاعة
   .bubble.me بنفسها — وده بيغلب أي لون مخصص متحط من بابيكر
   js/bubble-color.js (اللي بيحطه على مستوى الصفحة كلها)، فالجريديانت
   الجديد بيطبق دايمًا زي ما هو متفق عليه، من غير ما نلمس كود
   البابيكر نفسه أو نمسحه.
══════════════════════════════════════════════════════════════ */
(function () {
  const PURPLE = [184, 79, 232];  // #B84FE8 — أقدم رسالة (فوق)
  const BLUE   = [74, 126, 251];  // #4A7EFB — أحدث رسالة (تحت)
  const CONTAINER_ID = "chatMessages";

  function _mix(t) {
    const r = Math.round(PURPLE[0] + (BLUE[0] - PURPLE[0]) * t);
    const g = Math.round(PURPLE[1] + (BLUE[1] - PURPLE[1]) * t);
    const b = Math.round(PURPLE[2] + (BLUE[2] - PURPLE[2]) * t);
    return `rgb(${r},${g},${b})`;
  }

  function _update() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.height <= 0) return;

    const bubbles = container.querySelectorAll(".bubble.me");
    bubbles.forEach((el) => {
      const br = el.getBoundingClientRect();
      const center = br.top + br.height / 2;
      let t = (center - rect.top) / rect.height; // 0 فوق الحاوية → 1 تحت
      t = Math.max(0, Math.min(1, t));
      el.style.setProperty("--user-bubble-color", _mix(t));
    });
  }

  let _raf = null;
  function _schedule() {
    if (_raf) return;
    _raf = requestAnimationFrame(() => {
      _raf = null;
      _update();
    });
  }

  function _bind() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container || container._bubbleGradientBound) return;
    container._bubbleGradientBound = true;

    container.addEventListener("scroll", _schedule, { passive: true });
    window.addEventListener("resize", _schedule);

    // رسائل جديدة بتتضاف بالـ DOM (وارد/مرسل) → إعادة حساب
    const mo = new MutationObserver(_schedule);
    mo.observe(container, { childList: true, subtree: true });

    _schedule();
  }

  document.addEventListener("DOMContentLoaded", () => {
    _bind();
    // #chatMessages ممكن يتعمله render بعد التحميل الأول (فتح شات)،
    // فبنحاول نربط تاني كل شوية لحد ما يبقى موجود
    const retry = setInterval(() => {
      if (document.getElementById(CONTAINER_ID)) _bind();
    }, 1000);
  });
})();
