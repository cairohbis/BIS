/* ============================================================================
   Mascot Toast Adapter — طبقة تكامل، مش تعديل
   ============================================================================
   القواعد اللي الملف ده ملتزم بيها بالحرف:
   - مايفتحش جسم window.toast الأصلية ولا يقرا منه أي سطر.
   - بينفذ الأصلية الأول، بنفس الـ arguments، وبيرجّع نفس القيمة اللي هي
     كانت هترجّعها لو محدش لفّها. لو الأصلية اتغيرت بعدين (مثلاً بقت
     بترجع Promise)، الـ Adapter هيفضل يشتغل صح لأنه مش بيفترض شكل معيّن.
   - أي خطأ جوه منطق Mascot بيتلقط بـ try/catch ومايوصلش أبدًا للموقع —
     Mascot طبقة Enhancement اختيارية، مش Dependency لوظيفة الـ Toast.
   - بيتعامل بس مع العنصر الرئيسي #toast، وبيضيف جواه Container واحد
     بكلاس فريد (.mascot-toast-slot). مايلمسش ولا يفترض أي Selector تاني
     جواه، عشان لو شكل الـ Toast اتغيّر بعدين الـ Adapter مايتكسرش.
   ========================================================================= */
(function () {
  "use strict";

  if (window.__mascotToastAdapterLoaded) return; // منع اللف المزدوج

  if (typeof window.toast !== "function") {
    console.warn("[Mascot/ToastAdapter] window.toast مش معرّفة لسه — لازم السكريبت ده يتحط بعد تعريفها في index.html.");
    return;
  }
  if (!window.Mascot) {
    console.warn("[Mascot/ToastAdapter] Mascot مش محمّل — الـ Toast الأصلية هتفضل شغالة عادي بدون تحسين.");
    return;
  }

  window.__mascotToastAdapterLoaded = true;

  var originalToast = window.toast; // مرجع كامل للدالة الأصلية، محفوظ للأبد

  // type اللي مستخدم فعليًا في المشروع → أقرب mood موجود في المرحلة 2
  // (warn/info مفيش لهم حالة مستقلة لسه — قرار متفق عليه، هيتغير لما
  // مكتبة الصور تكتمل بدون أي كسر لهذا الملف)
  var MOOD_MAP = { success: "success", error: "error", warn: "surprised", info: "happy" };
  var DEFAULT_MOOD = "success"; // نفس افتراضي window.toast الأصلية (type = "success")

  var lastMascotInstance = null;

  function enhanceToastVisually(type) {
    var toastEl = document.getElementById("toast");
    if (!toastEl) return; // لو العنصر مش موجود لأي سبب، بلاش نكمل

    // window.toast الأصلية بتعمل el.textContent = msg، وده بيمسح أي
    // Child Node تاني جوه #toast (حتى لو ضفناه إحنا قبل كده) — فلازم
    // نعيد إنشاء الـ Slot من جديد بعد كل نداء، مش نحاول نلاقي القديم.
    if (lastMascotInstance) {
      lastMascotInstance.destroy(); // تنظيف كامل، صفر تسريب
      lastMascotInstance = null;
    }

    var slot = document.createElement("span");
    slot.className = "mascot-toast-slot";
    toastEl.insertBefore(slot, toastEl.firstChild);

    var mood = MOOD_MAP[type] || DEFAULT_MOOD;
    lastMascotInstance = window.Mascot.show({
      mood: mood,
      size: "sm",
      container: slot,
      decorative: true // الأيقونة زخرفية بجانب نص الـ Toast اللي بيقول نفس المعنى
    });
  }

  window.toast = function (msg, type) {
    var result = originalToast.apply(this, arguments); // الأصلية أولاً، بنفس الـ arguments بالحرف

    try {
      enhanceToastVisually(arguments.length > 1 ? type : "success");
    } catch (err) {
      console.error("[Mascot/ToastAdapter] خطأ داخلي في تحسين الشخصية — الـ Toast الأصلية اشتغلت عادي:", err);
    }

    return result; // نفس القيمة اللي الأصلية كانت هترجعها بالظبط
  };
})();
