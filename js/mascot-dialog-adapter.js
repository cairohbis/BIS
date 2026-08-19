/* ============================================================================
   Mascot Dialog Adapter — طبقة تكامل، مش تعديل
   ============================================================================
   نفس قواعد Toast Adapter بالحرف، زائد نقطتين خاصتين بـ Dialog:

   1) confirm() بترجع Promise<boolean> — الـ Adapter بيرجّع نفس الـ Promise
      اللي originalConfirm بترجعه بالظبط، مفيش أي لمس لقيمة الـ resolve.

   2) فيه طريقتين استدعاء في المشروع: window.confirm (Bare، 8 استدعاء جوه
      index.html) وwindow._appConfirm (3 ملفات خارجية: announcement.js,
      attendance.js, notif-permission.js). الاتنين بيشاوروا على نفس الدالة
      الأصلية وقت التحميل، فالـ Adapter بيلف الاتنين معًا بنفس المنطق،
      وإلا الملفات الخارجية مش هتستفيد من التحسين.
   ========================================================================= */
(function () {
  "use strict";

  // منع اللف المزدوج — لو الملف ده اتحمّل تاني لأي سبب (إعادة تحميل جزئي،
  // تضمين مكرر، إلخ) العملية كلها بتتجاهل فورًا
  if (window.__mascotDialogAdapterLoaded) return;

  // اعتمادية 1: نظام الـ Dialog نفسه لازم يكون جاهز قبل ما نلف حاجة.
  // وجود window._appConfirm دليل مباشر إن index.html خلّص تعريف confirm()
  // وعمل الـ Alias بالفعل (بيحصل مرة واحدة وقت تحميل الصفحة، سطر 2714).
  if (typeof window._appConfirm !== "function") {
    console.warn("[Mascot/DialogAdapter] window._appConfirm مش معرّفة لسه — لازم السكريبت ده يتحط بعد تعريفها في index.html.");
    return;
  }

  // اعتمادية 2: mascot.js لازم يكون اتحمّل واشتغل قبل الملف ده
  if (!window.Mascot) {
    console.warn("[Mascot/DialogAdapter] Mascot مش محمّل — الـ Dialog الأصلي هيفضل شغال عادي بدون تحسين.");
    return;
  }

  window.__mascotDialogAdapterLoaded = true;

  // نفس القيمة اللي window._appConfirm بيشاور عليها حاليًا (نسخة واحدة أصلية)
  var originalConfirm = window.confirm;

  var mascotInstance = null;

  // الـ Slot بيتعمل مرة واحدة بس ويتعاد استخدامه — بعكس #toast، عناصر
  // .modal (h3#modalTitle, p#modalBody) بتتحدث بـ textContent الخاص بيها
  // بس، مش بتمسح إخوتها، فمحتاجين ننشئ الـ Slot مرة واحدة بس مدى العمر
  function ensureMascotSlot() {
    if (mascotInstance) return mascotInstance;
    var modal = document.querySelector(".modal");
    if (!modal) return null;

    var slot = document.createElement("div");
    slot.className = "mascot-dialog-slot";
    modal.insertBefore(slot, modal.firstChild);

    mascotInstance = window.Mascot.show({
      mood: "thinking",
      size: "md",
      container: slot,
      decorative: true // زخرفية بجانب نص العنوان اللي بيقول نفس المعنى
    });
    return mascotInstance;
  }

  function wrappedConfirm(title, body) {
    // الأصلية أولاً وبنفس الـ arguments بالحرف — الـ Promise ده اللي هيترجع
    var resultPromise = originalConfirm.apply(this, arguments);

    try {
      var inst = ensureMascotSlot();
      if (inst) inst.setMood("thinking");
    } catch (err) {
      console.error("[Mascot/DialogAdapter] خطأ داخلي في تحسين الشخصية — الـ Dialog الأصلي اشتغل عادي:", err);
    }

    return resultPromise; // نفس الـ Promise اللي originalConfirm كانت هترجعه بالظبط
  }

  // نلف الاتنين معًا — window.confirm (للاستدعاءات المباشرة جوه index.html)
  // وwindow._appConfirm (للملفات الخارجية التلاتة)
  window.confirm = wrappedConfirm;
  window._appConfirm = wrappedConfirm;
})();
