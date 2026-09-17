// ============================================================
// "لماذا أنت هنا؟" — تكامل إضافي بس، بدون تعديل أي دالة أصلية
// بيلف goTab عشان يقفل صفحة "لماذا أنت هنا؟" تلقائيًا
// لو المستخدم اتنقل لأي تاب تاني وهي لسه فاتحة
// ============================================================
(function () {
  const _origGoTab = window.goTab;

  window.goTab = function (tabId) {
    _origGoTab(tabId);
    const whyHereEl = document.getElementById("tab-whyhere-content");
    if (whyHereEl) whyHereEl.style.display = "none";
  };
})();
