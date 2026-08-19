/* ============================================================================
   Mascot Assets Registration — طبقة تسجيل بيانات، مش تعديل
   ============================================================================
   بينادي Mascot.setMasterReference() أولاً (شرط أساسي في IdentityManager
   قبل أي تسجيل)، وبعدها Mascot.registerAsset() لكل الـ16 صورة المعتمدة.
   بعد التسجيل، كل التسعة Adapters بتستخدم الصور الحقيقية تلقائيًا في أي
   Mascot.show() جديد — صفر تعديل عليهم مطلوب.
   ========================================================================= */
(function () {
  "use strict";

  if (window.__mascotAssetsRegistered) return;

  if (!window.Mascot) {
    console.warn("[Mascot/AssetsRegistration] Mascot مش محمّلة لسه — الصور مش هتتسجل، والنظام هيفضل شغال بالـ Placeholder.");
    return;
  }

  window.__mascotAssetsRegistered = true;

  var locked = window.Mascot.setMasterReference("images/mascot/master/master-reference.webp");
  if (!locked) {
    console.warn("[Mascot/AssetsRegistration] فشل قفل الهوية — الصور مش هتتسجل.");
    return;
  }

  var THEME = "default";
  var assets = {
    // Emotions
    happy: "images/mascot/emotions/happy.webp",
    sad: "images/mascot/emotions/sad.webp",
    angry: "images/mascot/emotions/angry.webp",
    thinking: "images/mascot/emotions/thinking.webp",
    surprised: "images/mascot/emotions/surprised.webp",
    love: "images/mascot/emotions/love.webp",
    // Actions
    wave: "images/mascot/actions/wave.webp",
    celebrate: "images/mascot/actions/celebrate.webp",
    run: "images/mascot/actions/run.webp",
    write: "images/mascot/actions/write.webp",
    sleep: "images/mascot/actions/sleep.webp",
    // UI States
    loading: "images/mascot/ui/loading.webp",
    success: "images/mascot/ui/success.webp",
    error: "images/mascot/ui/error.webp",
    offline: "images/mascot/ui/offline.webp",
    empty: "images/mascot/ui/empty.webp"
  };

  for (var key in assets) {
    if (Object.prototype.hasOwnProperty.call(assets, key)) {
      window.Mascot.registerAsset(THEME, key, assets[key]);
    }
  }
})();
