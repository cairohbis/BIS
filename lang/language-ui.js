/* ══════════════════════════════════════════
   واجهة اختيار اللغة داخل الإعدادات — إضافية بالكامل
══════════════════════════════════════════ */
(function () {
  "use strict";

  var OPTIONS = [
    { value: "default", icon: "fa-solid fa-star", label: "افتراضي" },
    { value: "egyptian", icon: "fa-solid fa-comment", label: "المصرية" },
    { value: "english", icon: "fa-solid fa-globe", label: "English" }
  ];

  function render() {
    var wrap = document.getElementById("bisLangOptions");
    if (!wrap) return;
    var current = window.BISLang ? window.BISLang.getLanguage() : "default";
    wrap.innerHTML = "";
    OPTIONS.forEach(function (opt) {
      var row = document.createElement("div");
      row.className = "smod-row";
      row.style.cursor = "pointer";
      row.innerHTML =
        '<div class="smod-icon" style="background:rgba(245,158,11,.15)"><i class="' + opt.icon + '" style="color:#f59e0b"></i></div>' +
        '<div class="smod-info"><div class="smod-label">' + opt.label + "</div></div>" +
        (opt.value === current
          ? '<i class="fa-solid fa-circle-check" style="color:#22c55e;font-size:18px"></i>'
          : '<i class="fa-regular fa-circle" style="color:var(--muted);font-size:18px"></i>');
      row.addEventListener("click", function () {
        if (window.BISLang) window.BISLang.setLanguage(opt.value);
        render();
      });
      wrap.appendChild(row);
    });
  }

  document.addEventListener("bis-lang-changed", render);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }

  /* إعادة الرسم أيضًا عند فتح الإعدادات، لضمان مزامنة الحالة */
  var _origOpen = window.openSettingsModal;
  if (typeof _origOpen === "function") {
    window.openSettingsModal = function () {
      _origOpen.apply(this, arguments);
      render();
    };
  }
})();
