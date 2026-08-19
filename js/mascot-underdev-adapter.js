/* ============================================================================
   Mascot UnderDev Adapter — طبقة تكامل، مش تعديل
   ============================================================================
   بيستهدف كل عنصر بكلاس .dms-under-dev (شاشتي "الحالات" و"المكالمات"
   حاليًا، وأي شاشة "قيد التطوير" تتضاف لاحقًا بنفس الكلاس تلقائيًا).

   بيشيل الأيقونة الصغيرة (<i class="fa-solid ...">) خالص، وبيحط بريق
   بحجم كامل (xl) مكانها فوق العنوان مباشرة — مفيش أي لمس لـ .dms-ud-title
   أو .dms-ud-sub أو أي كلاس تاني.
   ========================================================================= */
(function () {
  "use strict";

  if (window.__mascotUnderDevAdapterLoaded) return;
  window.__mascotUnderDevAdapterLoaded = true;

  var PROCESSED_ATTR = "data-mascot-enhanced";

  function enhance(el) {
    if (!el || el.hasAttribute(PROCESSED_ATTR)) return;
    if (!window.Mascot) return; // بتتقرا وقت الاستخدام، مش Cached من التحميل

    el.setAttribute(PROCESSED_ATTR, "1");

    try {
      // شيل الأيقونة القديمة (fa-solid) خالص — القرار المعتمد
      var oldIcon = el.querySelector("i");
      if (oldIcon) oldIcon.remove();

      var slot = document.createElement("div");
      slot.className = "mascot-underdev-slot";
      el.insertBefore(slot, el.firstChild);

      window.Mascot.show({
        mood: "construction",
        size: "xl",
        container: slot,
        decorative: true
      });
    } catch (err) {
      console.error("[Mascot/UnderDevAdapter] خطأ داخلي — الشاشة الأصلية فضلت شغالة عادي:", err);
    }
  }

  function scanAll() {
    var els = document.querySelectorAll(".dms-under-dev");
    for (var i = 0; i < els.length; i++) enhance(els[i]);
  }

  scanAll();

  // مراقبة مستمرة — الشاشات دي جوه صفحة الشاتات اللي ممكن تتبني/تتفتح
  // ديناميكيًا حسب باقي كود الموقع، فمحتاجين نمسك أي عنصر جديد يتضاف
  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType !== 1) continue;
        if (node.classList && node.classList.contains("dms-under-dev")) {
          enhance(node);
        }
        if (node.querySelectorAll) {
          var inner = node.querySelectorAll(".dms-under-dev");
          for (var k = 0; k < inner.length; k++) enhance(inner[k]);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
