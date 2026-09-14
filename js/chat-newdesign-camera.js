/* ══════════════════════════════════════════════════════════════
   NEW CHAT UI — زرار الكاميرا (وقت ما #chatSendBtn يبقى فاضي)
   ▸ ملف مستقل تمامًا عن index.html — عشان منكبرش الملف الجذري
   ▸ مفيش نظام رفع جديد: بيفتح الكاميرا بس، وبعدين بيسلّم
     الصورة لنفس #chatFileInput (نفس نظام الملفات القديم بالحرف)
     عن طريق DataTransfer + إعادة إطلاق حدث change عليه
   ══════════════════════════════════════════════════════════════ */
(function () {
  const shell = document.querySelector(".newchat-shell");
  if (!shell) return;

  const sendBtn = shell.querySelector("#chatSendBtn");
  const input   = shell.querySelector(".placeholder-text");
  if (!sendBtn || !input) return;

  const camInput = document.createElement("input");
  camInput.type = "file";
  camInput.accept = "image/*";
  camInput.capture = "environment";
  camInput.style.display = "none";
  document.body.appendChild(camInput);

  camInput.addEventListener("change", function () {
    const file = camInput.files[0];
    camInput.value = "";
    if (!file) return;

    const oldFileInput = document.getElementById("chatFileInput");
    if (!oldFileInput) return;

    try {
      const dt = new DataTransfer();
      dt.items.add(file);
      oldFileInput.files = dt.files;
      oldFileInput.dispatchEvent(new Event("change"));
    } catch (e) {
      console.error("[NewChatCamera] failed to hand off file:", e);
    }
  });

  // الزر ده أصلًا عليه listener قديم بينادي sendChatMsg() (بيرجع فورًا لو النص فاضي)
  // الإضافة دي مستقلة تمامًا: لو الحقل فاضي، افتح الكاميرا بدل ما محدش يعمل حاجة
  sendBtn.addEventListener("click", function () {
    if (!input.value.trim()) camInput.click();
  });
})();
