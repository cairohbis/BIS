/**
 * ══════════════════════════════════════════
 *   QR SHARE MODULE — مشاركة رابط الموقع عبر QR
 *
 *   ▸ ملف مستقل بالكامل — لا يعدّل أي منطق في أي نظام آخر
 *   ▸ لا يلمس نظام تسجيل الدخول، ولا Firebase، ولا الرسائل إطلاقًا
 *   ▸ الرابط بيتقرأ من window.location.origin وقت الضغط على الزر
 *     (مش رابط ثابت مخزّن) — لو اتغير الدومين يومًا ما، الـQR الجديد
 *     هياخده تلقائي من غير أي تعديل في هذا الملف
 *   ▸ مكتبة توليد QR (QRious) بتتحمّل ديناميكيًا من CDN أول مرة تُفتح
 *     فيها الميزة فقط — صفر سطور CDN إضافية في index.html
 * ══════════════════════════════════════════
 */
(function () {
  "use strict";

  if (window.__qrShareModuleLoaded) return;
  window.__qrShareModuleLoaded = true;

  window.QrShareModule = window.QrShareModule || {};

  const QRIOUS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js";
  let _qriousReady = null;

  function _loadQrious() {
    if (_qriousReady) return _qriousReady;
    _qriousReady = new Promise((resolve, reject) => {
      if (window.QRious) return resolve();
      const s = document.createElement("script");
      s.src = QRIOUS_CDN;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("تعذّر تحميل مكتبة QR"));
      document.head.appendChild(s);
    });
    return _qriousReady;
  }

  let _built = false;
  function _ensureModal() {
    if (_built) return;
    _built = true;

    const overlay = document.createElement("div");
    overlay.id = "qrShareOverlay";
    overlay.className = "qrshare-backdrop";
    overlay.innerHTML =
      '<div class="qrshare-card">' +
        '<div class="qrshare-header">' +
          '<div class="qrshare-header-icon"><i class="fa-solid fa-qrcode"></i></div>' +
          '<div class="qrshare-header-texts">' +
            '<div class="qrshare-title">شارك رابط الدخول</div>' +
            '<div class="qrshare-sub">امسح الكود أو انسخ الرابط وابعته لمين ما تحب</div>' +
          '</div>' +
          '<button type="button" class="qrshare-close-btn" aria-label="إغلاق"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '<div class="qrshare-canvas-wrap"><canvas id="qrShareCanvas"></canvas></div>' +
        '<div class="qrshare-link" id="qrShareLinkText"></div>' +
        '<button type="button" class="btn" id="qrShareCopyBtn"><i class="fa-solid fa-copy"></i> نسخ الرابط</button>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.querySelector(".qrshare-close-btn").addEventListener("click", close);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    overlay.querySelector("#qrShareCopyBtn").addEventListener("click", _copyLink);
  }

  // رابط الموقع الحالي فعليًا — يُقرأ من جديد كل مرة، مفيش تخزين لرابط ثابت.
  // بيستخدم origin + pathname (مش origin بس) عشان يشتغل صح سواء الموقع
  // على جذر الدومين أو جوه مجلد فرعي (زي GitHub Pages: user.github.io/BIS-main/)
  function _currentSiteUrl() {
    let path = window.location.pathname;
    if (!path.endsWith("/")) {
      path = path.slice(0, path.lastIndexOf("/") + 1); // يشيل "index.html" لو موجودة، يسيب المجلد بس
    }
    return window.location.origin + path;
  }

  async function open() {
    _ensureModal();
    const overlay = document.getElementById("qrShareOverlay");
    overlay.classList.add("show");

    const url = _currentSiteUrl();
    document.getElementById("qrShareLinkText").textContent = url;

    const copyBtn = document.getElementById("qrShareCopyBtn");
    copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> نسخ الرابط';
    copyBtn.classList.remove("copied");

    try {
      await _loadQrious();
      new window.QRious({
        element: document.getElementById("qrShareCanvas"),
        value: url,
        size: 220,
        background: "#ffffff",
        foreground: "#0d1120",
        level: "M"
      });
    } catch (err) {
      document.getElementById("qrShareLinkText").textContent =
        url + "\n(تعذّر توليد صورة QR — تحقق من الاتصال بالإنترنت)";
      if (window.toast) window.toast("تعذّر تحميل مكتبة QR", "error");
    }
  }

  function close() {
    const overlay = document.getElementById("qrShareOverlay");
    if (overlay) overlay.classList.remove("show");
  }

  async function _copyLink() {
    const url = _currentSiteUrl();
    const btn = document.getElementById("qrShareCopyBtn");
    try {
      await navigator.clipboard.writeText(url);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e2) {}
      document.body.removeChild(ta);
    }
    btn.innerHTML = '<i class="fa-solid fa-check"></i> تم النسخ';
    btn.classList.add("copied");
    if (window.toast) window.toast("تم نسخ الرابط", "success");
    setTimeout(function () {
      btn.innerHTML = '<i class="fa-solid fa-copy"></i> نسخ الرابط';
      btn.classList.remove("copied");
    }, 1800);
  }

  window.QrShareModule.open = open;
  window.QrShareModule.close = close;
})();
