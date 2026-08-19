/* ============================================================================
   Mascot Login Adapter — طبقة تكامل، مش تعديل
   ============================================================================
   window.showPage هي الدالة العامة لكل تنقلات الصفحات في الموقع (مش خاصة
   بصفحة اللوجين بس)، فالـ Adapter بيلفها ويتأكد إن id === "page-login"
   قبل ما يعمل أي حاجة — أي صفحة تانية بتتجاهل تمامًا.

   الشخصية بتتحط جنب ".lp-box-title" (عنوان "نظام الجامعة") — بعيد تمامًا
   عن مشهد المصباح (.lp-lamp-wrap) عمدًا، عشان الشخصيتين ميتنافسوش بصريًا.
   صفر لمس لـ lamp-login.js أو أي كلاس خاص بالمصباح.
   ========================================================================= */
(function () {
  "use strict";

  if (window.__mascotLoginAdapterLoaded) return;

  if (typeof window.showPage !== "function") {
    console.warn("[Mascot/LoginAdapter] window.showPage مش معرّفة لسه — لازم السكريبت ده يتحط بعدها.");
    return;
  }

  window.__mascotLoginAdapterLoaded = true;

  var originalShowPage = window.showPage;
  var mascotInstance = null;

  function ensureMascotSlot() {
    if (mascotInstance) return mascotInstance;
    if (!window.Mascot) return null; // بتتقرا وقت الاستخدام، مش Cached

    var title = document.querySelector(".lp-box-title");
    if (!title || !title.parentNode) return null;

    var slot = document.createElement("span");
    slot.className = "mascot-login-slot";
    title.parentNode.insertBefore(slot, title);

    mascotInstance = window.Mascot.show({
      mood: "happy",
      size: "sm",
      container: slot,
      decorative: true
    });
    return mascotInstance;
  }

  window.showPage = function (id) {
    var result = originalShowPage.apply(this, arguments);

    if (id === "page-login") {
      try {
        var inst = ensureMascotSlot();
        if (inst) inst.setMood("happy");
      } catch (err) {
        console.error("[Mascot/LoginAdapter] خطأ داخلي — صفحة اللوجين اشتغلت عادي:", err);
      }
    }

    return result;
  };
})();
