// تثبيت التطبيق: حفظ حدث beforeinstallprompt (يُطلق مرة واحدة أثناء التحميل) لاستدعائه من بطاقة المنتدى فقط
window.__pwaInstallEvt = null;
window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); window.__pwaInstallEvt = e; });
window.addEventListener("appinstalled", function () {
  window.__pwaInstallEvt = null; window.__pwaInstalled = true;
  var sub = document.getElementById("pwaInstallCardSub");
  if (sub) sub.textContent = "التطبيق مثبت على جهازك";
});
window.installPWAFromCard = async function () {
  var standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  if (standalone || window.__pwaInstalled) { window.toast && window.toast("التطبيق مثبت بالفعل", "info"); return; }
  var evt = window.__pwaInstallEvt;
  if (!evt) { window.toast && window.toast("التثبيت غير متاح حاليًا من هذا المتصفح", "error"); return; }
  window.__pwaInstallEvt = null;
  try { evt.prompt(); await evt.userChoice; } catch (e) {}
};
document.addEventListener("DOMContentLoaded", function () {
  var sub = document.getElementById("pwaInstallCardSub");
  if (sub && ((window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true)) sub.textContent = "التطبيق مثبت على جهازك";
});
