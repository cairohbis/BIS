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

  // الزر ده أصلًا عليه listener قديم بينادي sendChatMsg()، واللي بيمسح
  // input.value بشكل متزامن (chat-send.js:27) قبل أي await — يعني وقت
  // ما دورنا في نفس click event يجي، الحقل يبقى بقى فاضي أصلاً حتى لو
  // كان فيه نص وقت الضغط. الحل: نلتقط حالة الحقل وقت الضغط نفسه
  // (pointerdown/touchstart بيسبقوا click دايمًا) بدل ما نقرأها في click.
  let hadTextAtPress = false;
  function _captureState() { hadTextAtPress = !!input.value.trim(); }
  sendBtn.addEventListener("pointerdown", _captureState);
  sendBtn.addEventListener("touchstart", _captureState, { passive: true });

  sendBtn.addEventListener("click", function () {
    if (!hadTextAtPress) camInput.click();
  });
})();
