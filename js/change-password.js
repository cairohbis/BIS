/* ══════════════════════════════════════════
   js/change-password.js — تغيير كلمة المرور
   منقول من index.html بدون أي تغيير في المنطق —
   فقط استبدال المراجع المحلية (currentUser/toast) بمراجع window.
   ⚠️ مغلّف بـ DOMContentLoaded لأن السكربت ده بيتحمّل بدري (قبل السكربت
   الرئيسي)، على عكس مكانه الأصلي القديم حيث كان DOM جاهز فعلاً وقتها.
══════════════════════════════════════════ */
import {
  EmailAuthProvider, reauthenticateWithCredential, updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", function () {
  const btnEl = document.getElementById("changePasswordBtn");
  if (!btnEl) return;

  btnEl.addEventListener("click", async () => {
    const currentUser = window.currentUser;
    const toast = window.toast;
    if (!currentUser) return;

    const currentPw  = document.getElementById("currentPassword").value;
    const newPw      = document.getElementById("newPassword").value;
    const confirmPw  = document.getElementById("confirmPassword").value;

    if (!currentPw)              return toast("أدخل كلمة المرور الحالية", "error");
    if (!newPw)                  return toast("أدخل كلمة المرور الجديدة", "error");
    if (newPw.length < 6)        return toast("كلمة المرور الجديدة قصيرة جداً (6 أحرف على الأقل)", "error");
    if (newPw !== confirmPw)     return toast("كلمة المرور الجديدة وتأكيدها غير متطابقتين", "error");
    if (newPw === currentPw)     return toast("كلمة المرور الجديدة مطابقة للحالية", "warn");

    const btn = document.getElementById("changePasswordBtn");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> جاري التغيير...`;

    try {
      // Reauthenticate first
      const credential = EmailAuthProvider.credential(currentUser.email, currentPw);
      await reauthenticateWithCredential(currentUser, credential);
      // Update password
      await updatePassword(currentUser, newPw);
      // Clear fields
      document.getElementById("currentPassword").value = "";
      document.getElementById("newPassword").value = "";
      document.getElementById("confirmPassword").value = "";
      toast("تم تغيير كلمة المرور بنجاح ✓", "success");
    } catch(e) {
      console.error("changePassword:", e);
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        toast("كلمة المرور الحالية غير صحيحة", "error");
      } else if (e.code === "auth/too-many-requests") {
        toast("تم تجاوز عدد المحاولات، حاول لاحقاً", "error");
      } else if (e.code === "auth/weak-password") {
        toast("كلمة المرور الجديدة ضعيفة جداً", "error");
      } else if (e.code === "auth/network-request-failed") {
        toast("تحقق من اتصالك بالإنترنت", "error");
      } else {
        toast("فشل تغيير كلمة المرور", "error");
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-lock"></i> تغيير كلمة المرور`;
    }
  });
});
