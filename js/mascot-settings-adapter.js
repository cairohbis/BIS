/* ============================================================================
   Mascot Settings Adapter — طبقة تكامل، مش تعديل
   ============================================================================
   نفس نمط Dialog/Notification بالظبط: لف دالة عامة واحدة
   (window.openSettingsModal)، مفيش Promise هنا.

   #settingsModal ثابت في الـ DOM طول عمر الصفحة (زي .modal وnotifPanel)،
   فالـ Slot بيتعمل مرة واحدة بس ويتعاد استخدامه، مش بيتكرر مع كل فتح.
   ========================================================================= */
(function () {
  "use strict";

  if (window.__mascotSettingsAdapterLoaded) return;

  if (typeof window.openSettingsModal !== "function") {
    console.warn("[Mascot/SettingsAdapter] window.openSettingsModal مش معرّفة لسه — لازم السكريبت ده يتحط بعد settings-modal.js.");
    return;
  }

  window.__mascotSettingsAdapterLoaded = true;

  var originalOpen = window.openSettingsModal;
  var mascotInstance = null;

  function ensureMascotSlot() {
    if (mascotInstance) return mascotInstance;
    if (!window.Mascot) return null; // بتتقرا وقت الاستخدام، مش Cached

    var titleEl = document.querySelector(".smod-title");
    if (!titleEl) return null;

    var slot = document.createElement("span");
    slot.className = "mascot-settings-slot";
    titleEl.insertBefore(slot, titleEl.firstChild);

    mascotInstance = window.Mascot.show({
      mood: "happy",
      size: "sm",
      container: slot,
      decorative: true
    });
    return mascotInstance;
  }

  window.openSettingsModal = function () {
    var result = originalOpen.apply(this, arguments); // الأصلية أولاً دايمًا

    try {
      var inst = ensureMascotSlot();
      if (inst) inst.setMood("happy");
    } catch (err) {
      console.error("[Mascot/SettingsAdapter] خطأ داخلي — Settings الأصلية اشتغلت عادي:", err);
    }

    return result;
  };
})();
