/* ============================================================================
   Mascot Loading Adapter — طبقة تكامل، مش تعديل
   ============================================================================
   نفس تصميم Empty State Adapter بالحرف — .spinner مجرد كلاس CSS بيتكرر
   كتابته يدويًا في index.html + 5 ملفات JS (attendance, audit-log, library,
   members-list, report)، صفر Factory مركزي. الحل: MutationObserver.

   مهم: skeleton-loader.js نظام منفصل تمامًا (كلاسات .msg-skel-*, .dm-skeleton
   إلخ)، مش .spinner — صفر تداخل، صفر لمس ليه.

   القرار المعتمد: نسيب الـ .spinner الأصلي زي ما هو تمامًا (شكله، حركته،
   وظيفته) ونضيف بريق جنبه بس — إضافة صرفة، مفيش أي إخفاء أو استبدال.
   ========================================================================= */
(function () {
  "use strict";

  if (window.__mascotLoadingAdapterLoaded) return;
  window.__mascotLoadingAdapterLoaded = true;

  var PROCESSED_ATTR = "data-mascot-enhanced";

  function enhance(el) {
    if (!el || el.hasAttribute(PROCESSED_ATTR)) return;
    if (el.classList.contains("mascot-loading-slot")) return; // احتراز ذاتي

    if (!window.Mascot) return; // بتتقرا وقت الاستخدام، مش Cached

    el.setAttribute(PROCESSED_ATTR, "1");

    try {
      var slot = document.createElement("span");
      slot.className = "mascot-loading-slot";
      // مسافة بسيطة + تصغير خفيف — Inline بس، صفر CSS جديد لحد ما نتأكد
      // بصريًا إنه كافي (لو مش كافي، هوقف وأبعت تقرير قبل أي ملف CSS)
      slot.style.marginInlineStart = "8px";
      slot.style.display = "inline-flex";
      slot.style.transform = "scale(0.75)";
      slot.style.transformOrigin = "center";
      // بعد الـ Spinner الأصلي مباشرة — صفر لمس له، بس إضافة جنبه
      if (el.nextSibling) {
        el.parentNode.insertBefore(slot, el.nextSibling);
      } else {
        el.parentNode.appendChild(slot);
      }

      window.Mascot.show({
        mood: "thinking",
        size: "sm",
        container: slot,
        decorative: true
      });
    } catch (err) {
      console.error("[Mascot/LoadingAdapter] خطأ داخلي — الـ Spinner الأصلي فضل زي ما هو:", err);
    }
  }

  function scanAll() {
    var els = document.querySelectorAll(".spinner");
    for (var i = 0; i < els.length; i++) enhance(els[i]);
  }

  scanAll();

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType !== 1) continue;
        if (node.classList && node.classList.contains("spinner")) {
          enhance(node);
        }
        if (node.querySelectorAll) {
          var inner = node.querySelectorAll(".spinner");
          for (var k = 0; k < inner.length; k++) enhance(inner[k]);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
