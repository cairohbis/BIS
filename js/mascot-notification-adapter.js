/* ============================================================================
   Mascot Notification Panel Adapter — طبقة تكامل، مش تعديل
   ============================================================================
   نفس نمط Dialog Adapter بالظبط: لف دالة عامة واحدة (window.openNotifPanel)،
   من غير Promise هنا (الدالة الأصلية مالهاش قيمة رجوع أصلاً).

   الـ Slot بيتحط جوه .np-header-left مرة واحدة بس ويتعاد استخدامه — بعكس
   Toast، الـ Backdrop هنا ثابت في الـ DOM طول عمر الصفحة (زي .modal بتاع
   Dialog)، فمحتاجين إنشاء واحد بس مدى العمر مش مع كل فتح.
   ========================================================================= */
(function () {
  "use strict";

  // منع اللف المزدوج
  if (window.__mascotNotificationAdapterLoaded) return;

  // اعتمادية: window.openNotifPanel لازم تكون معرّفة بالفعل (من
  // notif-panel.js). مفيش تحقق من window.Mascot هنا وقت التحميل عمدًا —
  // بنقراها وقت الاستخدام الفعلي بس (جوه wrappedOpen)، مش بنعملها Cache
  if (typeof window.openNotifPanel !== "function") {
    console.warn("[Mascot/NotificationAdapter] window.openNotifPanel مش معرّفة لسه — لازم السكريبت ده يتحط بعد notif-panel.js.");
    return;
  }

  window.__mascotNotificationAdapterLoaded = true;

  var originalOpen = window.openNotifPanel;
  var mascotInstance = null;

  function ensureMascotSlot() {
    if (mascotInstance) return mascotInstance;
    if (!window.Mascot) return null; // بتتقرا هنا وقت الاستخدام، مش Cached من التحميل

    var headerLeft = document.querySelector(".np-header-left");
    if (!headerLeft) return null;

    var slot = document.createElement("div");
    slot.className = "mascot-notification-slot";
    headerLeft.insertBefore(slot, headerLeft.firstChild);

    mascotInstance = window.Mascot.show({
      mood: "happy",
      size: "md",
      container: slot,
      decorative: true
    });
    return mascotInstance;
  }

  window.openNotifPanel = function () {
    var result = originalOpen.apply(this, arguments); // الأصلية أولاً دايمًا

    try {
      var inst = ensureMascotSlot();
      if (inst) inst.setMood("happy");
    } catch (err) {
      console.error("[Mascot/NotificationAdapter] خطأ داخلي — الـ Panel الأصلي اشتغل عادي:", err);
    }

    return result;
  };
})();
