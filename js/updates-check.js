/* ══════════════════════════════════════════
   updates-check.js
   ملف مستقل — زر "التحديثات" في الإعدادات

   بيسحب آخر نسخة من الموقع من GitHub Pages يدويًا:
   - يمسح نسخة ملفات الواجهة (HTML/CSS/JS) المخزنة محليًا
     عن طريق Service Worker (bariq-shell-*)
   - يجبر المتصفح يعيد تحميل الصفحة بأحدث نسخة فعليًا

   الربط: ضيف السطر ده في index.html بعد firebase-messaging-sw.js
   registration مباشرة (أو في أي مكان قبل إغلاق </body>):
     <script src="js/updates-check.js"></script>

   الاستخدام: onclick="window._checkForUpdates()" من أي زرار
══════════════════════════════════════════ */

window._checkForUpdates = async function () {
  const btn = event?.currentTarget;
  const label = btn?.querySelector(".smod-label");
  const originalText = label?.textContent;
  if (label) label.textContent = "جاري البحث عن تحديثات...";
  if (typeof window.toast === "function") window.toast("جاري البحث عن آخر تحديث...", "info");

  try {
    // 1. اطلب من الـ Service Worker يتأكد فيه إصدار أحدث ولا لأ
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update().catch(() => {})));
    }
    // 2. امسح نسخة ملفات الواجهة المخزنة محليًا عشان تتجدد بالكامل
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("bariq-shell-")).map((k) => caches.delete(k))
      );
    }
  } catch (e) {
    console.error("checkForUpdates:", e);
  }

  if (typeof window.toast === "function") window.toast("تم التحديث — جاري إعادة التحميل...", "success");
  if (label) label.textContent = originalText || "التحديثات";

  setTimeout(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("_refresh", Date.now());
    window.location.replace(url.toString());
  }, 600);
};
