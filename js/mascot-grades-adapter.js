/* ============================================================================
   Mascot Grades Adapter — طبقة تكامل، مش تعديل
   ============================================================================
   grades.js بترندر .grades-sheet-header/.grades-sheet-title من جديد بالكامل
   مع كل تنقل داخلي (home/stats/index...)، فمفيش دالة واحدة تكفي نلفها زي
   Settings. الحل: MutationObserver مقيّد بـ #grades-app-root بس (مش الصفحة
   كلها) بيحقن الشخصية تلقائيًا كل ما .grades-sheet-title جديدة تتضاف.
   ========================================================================= */
(function () {
  "use strict";

  if (window.__mascotGradesAdapterLoaded) return;
  window.__mascotGradesAdapterLoaded = true;

  var PROCESSED_ATTR = "data-mascot-enhanced";

  function enhance(titleEl) {
    if (!titleEl || titleEl.hasAttribute(PROCESSED_ATTR)) return;
    if (!window.Mascot) return; // بتتقرا وقت الاستخدام، مش Cached

    titleEl.setAttribute(PROCESSED_ATTR, "1");

    try {
      var slot = document.createElement("span");
      slot.className = "mascot-grades-slot";
      titleEl.insertBefore(slot, titleEl.firstChild);

      window.Mascot.show({
        mood: "thinking",
        size: "sm",
        container: slot,
        decorative: true
      });
    } catch (err) {
      console.error("[Mascot/GradesAdapter] خطأ داخلي — Grades الأصلية فضلت شغالة عادي:", err);
    }
  }

  function start() {
    var root = document.getElementById("grades-app-root");
    if (!root) return;

    var existing = root.querySelector(".grades-sheet-title");
    if (existing) enhance(existing);

    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType !== 1) continue;
          if (node.classList && node.classList.contains("grades-sheet-title")) {
            enhance(node);
          }
          if (node.querySelectorAll) {
            var inner = node.querySelectorAll(".grades-sheet-title");
            for (var k = 0; k < inner.length; k++) enhance(inner[k]);
          }
        }
      }
    });

    observer.observe(root, { childList: true, subtree: true });
  }

  start();
})();
