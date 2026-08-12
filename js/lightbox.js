/* ══════════════════════════════════════════
   js/lightbox.js — عرض الصور بالتكبير (Lightbox)
══════════════════════════════════════════ */
window.openLightbox = function(src) {
  document.getElementById("lightboxImg").src = src;
  document.getElementById("lightbox").classList.add("show");
};

/* ══════════════════════════════════════════
   هيدر الشات العائم (Floating Overlay Header)
   ملاحظة: الكود ده مالوش علاقة بالـLightbox — اتحط هنا عمدًا لأنه
   ملف موجود ومربوط أصلاً في index.html، عشان نتجنب أي تعديل في
   index.html نفسه (إضافة <script> جديد). التنسيقات المصاحبة موجودة
   في css/style.css تحت سكوب #page-chat .chat-header.
══════════════════════════════════════════ */
(function () {
  function buildFloatingChatHeader() {
    const header = document.querySelector("#page-chat .chat-header");
    if (!header) return;
    if (header.dataset.floatingHeaderBuilt === "1") return; // حماية من التكرار

    const avatarWrap = header.querySelector(".avatar-wrap");
    const infoBlock  = header.querySelector(".chat-header-info");
    const searchBtn  = header.querySelector("#chatSearchToggleBtn");
    if (!avatarWrap || !infoBlock) return; // الهيكل غير متوقع — لا تكسر الصفحة

    // 1) كبسولة (افتار + اسم + حالة)
    const infoCapsule = document.createElement("div");
    infoCapsule.className = "chat-header-capsule";
    avatarWrap.parentNode.insertBefore(infoCapsule, avatarWrap);
    infoCapsule.appendChild(avatarWrap);
    infoCapsule.appendChild(infoBlock);

    // 2) كبسولة الأزرار الشكلية (مكالمة + قائمة) — قبل كبسولة المعلومات
    const actionsCapsule = document.createElement("div");
    actionsCapsule.className = "chat-header-actions-capsule";
    actionsCapsule.innerHTML = `
      <button class="header-icon-btn" id="chatCallBtn" title="مكالمة (قريبًا)">
        <i class="fa-solid fa-phone"></i>
      </button>
      <button class="header-icon-btn" id="chatMenuBtn" title="خيارات (قريبًا)">
        <i class="fa-solid fa-ellipsis-vertical"></i>
      </button>
    `;
    header.insertBefore(actionsCapsule, infoCapsule);

    // 3) زرار البحث يبقى دائرة بيضاء مستقلة بدل شكله القديم
    if (searchBtn) searchBtn.classList.add("chat-header-search-standalone");

    // 4) مسافة حجز بعد الهيدر مباشرة — تمنع تصادم البحث/التثبيت/الإعلان معاه
    if (!header.nextElementSibling || !header.nextElementSibling.classList.contains("chat-header-spacer")) {
      const spacer = document.createElement("div");
      spacer.className = "chat-header-spacer";
      header.parentNode.insertBefore(spacer, header.nextSibling);
    }

    header.dataset.floatingHeaderBuilt = "1";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildFloatingChatHeader);
  } else {
    buildFloatingChatHeader();
  }
})();

