/* ══════════════════════════════════════════════════════════════
   CHAT REACTIONS — Double-tap reaction system
   ▸ منقولة حرفيًا من index.html (بدون أي تعديل منطقي)
   ▸ تعتمد على window.toggleReaction (js/poll.js) و window._currentChatId
     (bridge موجود في index.html) — كلاهما عبر window.* فقط
   ▸ نفس نمط pin-message.js / chat-backgrounds.js
   ══════════════════════════════════════════════════════════════ */

const _DT_REACTION  = "❤️";   // الـ Reaction الافتراضي
const _DT_DELAY     = 300;     // ms — نافذة الضغطتين

function _initDoubleTapReaction(container) {
  if (!container || container._dtDelegated) return;
  container._dtDelegated = true;

  // ── Animation flash helper ──
  function _flashReaction(bubble, emoji) {
    const fl = document.createElement("div");
    fl.className = "dt-reaction-flash";
    fl.textContent = emoji;
    bubble.style.position = "relative";
    bubble.appendChild(fl);
    // Remove after animation
    fl.addEventListener("animationend", () => fl.remove(), { once: true });
  }

  function _handleDoubleTap(row) {
    if (!row) return;
    const docId = row.id?.replace("msg-", "");
    if (!docId) return;
    // Don't fire if message is deleted
    if (row.querySelector(".bubble-text[style*='color:var(--muted)']")) return;
    const bubble = row.querySelector(".bubble");
    if (bubble) _flashReaction(bubble, _DT_REACTION);
    navigator.vibrate?.(18);
    window.toggleReaction(docId, _DT_REACTION, _currentChatId);
  }

  // ── MOBILE: touchend-based double-tap ──
  let _dtLastTap = 0;
  let _dtLastRow = null;

  container.addEventListener("touchend", e => {
    // Ignore if a swipe was in progress (check swipe state via data attribute)
    const row = e.target.closest(".msg-row");
    if (!row) return;

    // Ignore taps on interactive elements
    const tag = e.target.tagName;
    if (tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "AUDIO") return;
    if (e.target.closest("button, a, .reaction-chip, .msg-reply-btn, .reply-preview, .poll-option")) return;

    const now = Date.now();
    const gap = now - _dtLastTap;
    const sameRow = _dtLastRow === row;

    if (sameRow && gap < _DT_DELAY && gap > 30) {
      // Double-tap confirmed
      e.preventDefault();
      _dtLastTap = 0;
      _dtLastRow = null;
      _handleDoubleTap(row);
    } else {
      _dtLastTap = now;
      _dtLastRow = row;
    }
  }, { passive: false });

  // ── DESKTOP: native dblclick ──
  container.addEventListener("dblclick", e => {
    const row = e.target.closest(".msg-row");
    if (!row) return;
    if (e.target.closest("button, a, .reaction-chip, .msg-reply-btn, .reply-preview, .poll-option")) return;
    _handleDoubleTap(row);
  });
}
window._initDoubleTapReaction = _initDoubleTapReaction;
