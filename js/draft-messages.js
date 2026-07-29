/* ══════════════════════════════════════════
   js/draft-messages.js — نظام المسودات
   ↳ localStorage key: _draft_{uid}_{chatId}
   ↳ Saves per-chat, restores on switch,
     clears on successful send
   منقول من index.html بدون أي تغيير في المنطق —
   فقط استبدال المراجع المحلية (currentUser/_currentChatId)
   بمراجع window المكافئة (نفس القيم، نفس السلوك تماماً).
══════════════════════════════════════════ */

const _DRAFT_PREFIX = "_draft_";
let _draftSaveTimer = null;

function _draftKey(chatId) {
  const uid = window.currentUser?.uid || "anon";
  return _DRAFT_PREFIX + uid + "_" + (chatId || "public");
}

function _draftSave(chatId) {
  if (!chatId) return;
  const input = document.getElementById("chatInput");
  if (!input) return;
  // Don't save if in edit mode — that's not a draft
  const sendBtn = document.getElementById("chatSendBtn");
  if (sendBtn && sendBtn.getAttribute("data-mode") === "edit") return;
  const text = input.value; // raw (not trimmed — preserve cursor position)
  try {
    if (text) {
      localStorage.setItem(_draftKey(chatId), text);
    } else {
      localStorage.removeItem(_draftKey(chatId));
    }
  } catch(e) {}
}

function _draftRestore(chatId) {
  const input = document.getElementById("chatInput");
  if (!input) return;
  // Don't restore during edit mode
  const sendBtn = document.getElementById("chatSendBtn");
  if (sendBtn && sendBtn.getAttribute("data-mode") === "edit") return;
  try {
    const saved = localStorage.getItem(_draftKey(chatId));
    input.value = saved || "";
    _draftShowIndicator(!!saved);
    if (saved) {
      requestAnimationFrame(() => {
        input.selectionStart = input.selectionEnd = input.value.length;
      });
    }
  } catch(e) {
    input.value = "";
  }
  if (typeof window._updateSendVoiceBtns === "function") window._updateSendVoiceBtns();
}

function _draftClear(chatId) {
  if (!chatId) return;
  try { localStorage.removeItem(_draftKey(chatId)); } catch(e) {}
  _draftShowIndicator(false);
}

function _draftShowIndicator(show) {
  let ind = document.getElementById("_draftIndicator");
  if (show) {
    if (!ind) {
      ind = document.createElement("div");
      ind.id = "draftIndicator";
      ind.className = "draft-indicator";
      ind.textContent = "مسودة محفوظة";
      const inputBar = document.querySelector(".chat-input-bar");
      if (inputBar) {
        inputBar.style.position = "relative";
        inputBar.appendChild(ind);
      }
    }
    // Short flash then hide
    ind.classList.add("show");
    clearTimeout(ind._hideTimer);
    ind._hideTimer = setTimeout(() => ind.classList.remove("show"), 1800);
  } else {
    if (ind) ind.classList.remove("show");
  }
}

// ── Debounced auto-save while typing (300ms idle) ──
// ملاحظة: مغلّف بـ DOMContentLoaded لأن السكربت ده بيتحمّل بدري (قبل السكربت
// الرئيسي)، على عكس مكانه الأصلي القديم في آخر الصفحة حيث كان DOM جاهز فعلاً وقتها.
document.addEventListener("DOMContentLoaded", function _initDraftAutoSave() {
  const input = document.getElementById("chatInput");
  if (!input) return;
  input.addEventListener("input", () => {
    clearTimeout(_draftSaveTimer);
    _draftSaveTimer = setTimeout(() => {
      _draftSave(window._currentChatId);
    }, 300);
  });
  // Save on blur (e.g. user switches app)
  input.addEventListener("blur", () => {
    clearTimeout(_draftSaveTimer);
    _draftSave(window._currentChatId);
  });
});

window._draftSave = _draftSave;
window._draftRestore = _draftRestore;
window._draftClear = _draftClear;
