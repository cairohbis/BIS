/* ============================================================================
   Mascot Splash Adapter — طبقة تكامل، مش تعديل
   ============================================================================
   بعكس Toast/Dialog Adapters، هنا مفيش أي "لف" لدالة — splash.js بيبني
   الشاشة فورًا ومتزامن (مش سكريبت مؤجل)، فالملف ده لازم يشتغل فورًا كمان
   (بدون defer)، فوراً بعد splash.js، عشان يمسك #uni-splash-screen وهو
   لسه في أول ثانية من عمره قبل ما يقفل.

   الاعتماد الوحيد: window.Mascot (من mascot.js، المحمّل قبل الملف ده
   مباشرة وبدون defer كمان). صفر اعتماد على أي حاجة تانية في المشروع.
   ========================================================================= */
(function () {
  "use strict";

  // منع الإضافة المزدوجة — لو الملف ده اتحمّل تاني لأي سبب
  if (window.__mascotSplashAdapterLoaded) return;

  if (!window.Mascot) {
    console.warn("[Mascot/SplashAdapter] Mascot مش محمّل — الـ Splash الأصلي هيفضل شغال عادي بدون تحسين.");
    return;
  }

  var splashEl = document.getElementById("uni-splash-screen");
  if (!splashEl) {
    console.warn("[Mascot/SplashAdapter] #uni-splash-screen مش موجود لسه — لازم الملف ده يتحط بعد splash.js مباشرة.");
    return;
  }

  window.__mascotSplashAdapterLoaded = true;

  try {
    var slot = document.createElement("div");
    slot.className = "mascot-splash-slot";

    // نحطها بعد حلقة التقدم وقبل الكلمة المتغيرة — نفس ترتيب flex-column
    // الموجود أصلاً في splash.css، من غير ما نلمس أي كلاس أو عنصر موجود
    var ringWrap = splashEl.querySelector(".uni-splash-ring-wrap");
    if (ringWrap && ringWrap.parentNode === splashEl) {
      splashEl.insertBefore(slot, ringWrap.nextSibling);
    } else {
      splashEl.appendChild(slot);
    }

    window.Mascot.show({
      mood: "wave",
      size: "lg",
      container: slot,
      decorative: true
    });
  } catch (err) {
    console.error("[Mascot/SplashAdapter] خطأ داخلي — الـ Splash الأصلي اشتغل عادي:", err);
  }
})();
