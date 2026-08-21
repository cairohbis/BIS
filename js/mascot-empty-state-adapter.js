/* ============================================================================
   Mascot Empty State Adapter — طبقة تكامل، مش تعديل
   ============================================================================
   بعكس Toast/Dialog/Notification، مفيش دالة واحدة نلفها هنا — .empty-state
   مجرد كلاس CSS بيتكرر كتابته يدويًا في 7 مصادر مختلفة (index.html نفسه +
   6 ملفات JS بتوقيتات تحميل مختلفة: classic/defer/module). الحل الوحيد
   اللي بيغطي الكل من غير ما نلمس ولا سطر في أي منهم هو MutationObserver.

   استثناء متفق عليه: عناصر نصها بادئ بـ "جاري" (زي "جاري التحميل...")
   بتتجاهل عمدًا — دي حالات تحميل مؤقتة هتتستبدل خلال ثواني، مش حالات
   فارغة حقيقية تستاهل شخصية كاملة جواها.
   ========================================================================= */
(function () {
  "use strict";

  // منع التحميل المزدوج للسكريبت نفسه
  if (window.__mascotEmptyStateAdapterLoaded) return;
  window.__mascotEmptyStateAdapterLoaded = true;

  var PROCESSED_ATTR = "data-mascot-enhanced";
  var LOADING_PREFIX = "جاري"; // استثناء حالات التحميل المؤقتة

  function isLoadingText(text) {
    return (text || "").trim().indexOf(LOADING_PREFIX) === 0;
  }

  function enhance(el) {
    // منع معالجة نفس العنصر مرتين (Idempotent على مستوى العنصر، مش بس
    // على مستوى تحميل السكريبت)
    if (!el || el.hasAttribute(PROCESSED_ATTR)) return;

    // احتراز صريح: منتعالجش عناصرنا إحنا نفسها (Slots بتوع Adapters
    // تانية) حتى لو حصل أي تداخل غير متوقع
    if (el.classList.contains("mascot-empty-state-slot")) return;

    if (isLoadingText(el.textContent)) {
      el.setAttribute(PROCESSED_ATTR, "skipped-loading");
      return;
    }

    if (!window.Mascot) return; // بتتقرا وقت الاستخدام، مش Cached من التحميل

    el.setAttribute(PROCESSED_ATTR, "1");

    try {
      // لو العنصر جواه أيقونة قديمة (زي fa-comment-dots في .dms-empty)
      // نشيلها عشان بريق يحل محلها، مش يتضاف جنبها
      var oldIcon = el.querySelector("i.fa-regular, i.fa-solid");
      if (oldIcon) oldIcon.remove();

      var slot = document.createElement("span");
      slot.className = "mascot-empty-state-slot";
      el.insertBefore(slot, el.firstChild);

      window.Mascot.show({
        mood: "empty",
        size: "sm",
        container: slot,
        decorative: true
      });
    } catch (err) {
      console.error("[Mascot/EmptyStateAdapter] خطأ داخلي — العنصر الأصلي فضل زي ما هو:", err);
    }
  }

  // الكلاسات المستهدفة: .empty-state (الأصلي) + .dms-empty (أرشيف/قائمة
  // الدردشات) + .dm-empty (نتائج بحث المستخدمين/الأعضاء)
  var TARGET_SELECTOR = ".empty-state, .dms-empty, .dm-empty";

  function scanAll() {
    var els = document.querySelectorAll(TARGET_SELECTOR);
    for (var i = 0; i < els.length; i++) enhance(els[i]);
  }

  // مسح أولي لأي عناصر موجودة بالفعل وقت ما السكريبت يشتغل (زي العناصر
  // الثابتة المكتوبة مباشرة في index.html)
  scanAll();

  // مراقبة مستمرة لأي عنصر جديد يتضاف لاحقًا (من أي من الملفات السبعة)
  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType !== 1) continue; // Element nodes بس
        if (node.classList && (node.classList.contains("empty-state") || node.classList.contains("dms-empty") || node.classList.contains("dm-empty"))) {
          enhance(node);
        }
        // العنصر المضاف ممكن يكون Container فيه .empty-state جواه
        if (node.querySelectorAll) {
          var inner = node.querySelectorAll(TARGET_SELECTOR);
          for (var k = 0; k < inner.length; k++) enhance(inner[k]);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
