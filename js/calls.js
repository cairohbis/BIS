/* ==========================================================================
   js/calls.js — مكالمات صوتية عبر LiveKit (ملف مستقل، لا يعدّل أي منطق قائم)
   - التوكن يُصدر من الـ Worker الحالي: POST <worker>/livekit-token
     مع Authorization: Bearer <Firebase ID token>. لا أسرار LiveKit هنا.
   - الغرفة تُحدَّد وتُتحقق صلاحيتها في الـ Worker فقط (DM: مشارك في privateChats،
     غرفة: نفس worldId أو مالك). المتصفح يرسل peerUid/roomId فقط.
   - أي فشل يُعالَج داخليًا ولا يؤثر على بقية الموقع.
   Globals المعرّفة: window.BisCalls = { start, end, isActive }
   ========================================================================== */
(function () {
  "use strict";
  if (window.BisCalls) return;

  var TOKEN_URL = window.BIS_LIVEKIT_TOKEN_URL ||
    "https://falling-sea-c753.mrn57907.workers.dev/livekit-token";
  var SDK_URL = "https://cdn.jsdelivr.net/npm/livekit-client@2.22.4/dist/livekit-client.umd.js";

  var lkRoom = null, active = false, starting = false, timerId = null, t0 = 0, audioEls = {}, callUid = null;

  function toast(msg, type) { try { window.toast && window.toast(msg, type || "error"); } catch (e) {} }
  function $(id) { return document.getElementById(id); }

  /* ── تحميل SDK عند أول مكالمة فقط ── */
  var sdkPromise = null;
  function loadSdk() {
    if (window.LivekitClient) return Promise.resolve(window.LivekitClient);
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = SDK_URL; s.async = true;
      s.onload = function () { window.LivekitClient ? res(window.LivekitClient) : rej(new Error("sdk")); };
      s.onerror = function () { sdkPromise = null; rej(new Error("sdk-load")); };
      document.head.appendChild(s);
    });
    return sdkPromise;
  }

  /* ── الهدف الحالي من الشات المفتوح (بدون افتراض أسماء غرف) ── */
  function curUid() { var u = window.currentUser; return u && u.uid ? u.uid : null; }
  function avmOn() { return !!(window._avm && window._avm.active); } /* وضع عرض حساب مستخدم عند المالك */
  function currentTarget() {
    if (avmOn()) return null; /* _currentChatId لا يعكس المحادثة المعروضة في هذا الوضع */
    var id = window._currentChatId;
    if (!id || id === "public") return null;
    if (typeof id === "string" && id.indexOf("room:") === 0) return { kind: "room", roomId: id.slice(5) };
    return { kind: "dm", peerUid: id };
  }

  async function fetchToken(target) {
    var u = window.currentUser;
    if (!u || !u.getIdToken) throw new Error("not-signed-in");
    var idToken = await u.getIdToken();
    var r = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + idToken },
      body: JSON.stringify(target)
    });
    var data = null;
    try { data = await r.json(); } catch (e) {}
    if (!r.ok || !data || !data.token) {
      var err = new Error((data && data.error) || ("http-" + r.status));
      err.status = r.status; throw err;
    }
    return data;
  }

  function errText(e) {
    var m = e && e.message;
    if (m === "not-participant") return "لا توجد محادثة بينكما بعد. أرسل رسالة أولًا ثم حاول الاتصال"; /* DM فقط */
    if (m === "world-mismatch" || m === "room-not-accessible") return "غير مسموح لك بدخول هذه المكالمة";
    if (e && e.status === 401) return "انتهت الجلسة، سجّل الدخول من جديد";
    if (m === "livekit-not-configured") return "خدمة المكالمات غير مفعّلة بعد";
    if (m === "sdk-load") return "تعذّر تحميل مكتبة المكالمات، تأكد من الإنترنت";
    if (e && (e.name === "NotAllowedError" || /permission/i.test(m || ""))) return "اسمح للموقع باستخدام الميكروفون";
    return "تعذّر بدء المكالمة، حاول تاني";
  }

  /* ── واجهة المكالمة ── */
  function ensureOverlay() {
    if ($("bisCallOverlay")) return $("bisCallOverlay");
    var o = document.createElement("div");
    o.id = "bisCallOverlay";
    o.setAttribute("dir", "rtl");
    o.innerHTML =
      '<div class="bis-call-card">' +
      '<div class="bis-call-title" id="bisCallTitle">مكالمة</div>' +
      '<div class="bis-call-status" id="bisCallStatus">جاري الاتصال…</div>' +
      '<div class="bis-call-parts" id="bisCallParts"></div>' +
      '<div class="bis-call-actions">' +
      '<button type="button" id="bisCallMute" class="bis-call-btn" title="كتم">🎤</button>' +
      '<button type="button" id="bisCallEnd" class="bis-call-btn bis-call-end" title="إنهاء">📞</button>' +
      '</div></div>';
    document.body.appendChild(o);
    $("bisCallEnd").addEventListener("click", function () { end(); });
    $("bisCallMute").addEventListener("click", toggleMute);
    return o;
  }
  function showOverlay(show) { var o = ensureOverlay(); o.style.display = show ? "flex" : "none"; }
  function setStatus(t) { var s = $("bisCallStatus"); if (s) s.textContent = t; }

  function renderParts() {
    var box = $("bisCallParts"); if (!box || !lkRoom) return;
    var list = [lkRoom.localParticipant].concat(Array.from(lkRoom.remoteParticipants.values()));
    box.innerHTML = "";
    list.forEach(function (p) {
      var d = document.createElement("div");
      d.className = "bis-call-part" + (p.isSpeaking ? " speaking" : "");
      var nm = document.createElement("span");
      nm.textContent = (p.name || "مستخدم") + (p === lkRoom.localParticipant ? " (أنت)" : "");
      d.appendChild(nm);
      box.appendChild(d);
    });
  }

  function toggleMute() {
    if (!lkRoom) return;
    var lp = lkRoom.localParticipant;
    var on = !lp.isMicrophoneEnabled;
    lp.setMicrophoneEnabled(on).then(function () {
      var b = $("bisCallMute"); if (b) { b.textContent = on ? "🎤" : "🔇"; b.classList.toggle("off", !on); }
    }).catch(function () {});
  }

  function tick() {
    var s = Math.floor((Date.now() - t0) / 1000);
    var mm = String(Math.floor(s / 60)).padStart(2, "0"), ss = String(s % 60).padStart(2, "0");
    setStatus("متصل · " + mm + ":" + ss);
  }

  function cleanupAudio() {
    Object.keys(audioEls).forEach(function (k) { try { audioEls[k].remove(); } catch (e) {} });
    audioEls = {};
  }

  async function end() {
    if (timerId) { clearInterval(timerId); timerId = null; }
    var r = lkRoom; lkRoom = null; active = false; starting = false; callUid = null;
    try { if (r) await r.disconnect(); } catch (e) {}
    cleanupAudio();
    try { showOverlay(false); } catch (e) {}
    refreshBtn();
  }

  async function start(target) {
    if (active || starting) { showOverlay(true); return; }
    target = avmOn() ? null : (target || currentTarget());
    if (!target) { toast("المكالمات متاحة في الرسائل الخاصة والغرف فقط"); return; }
    starting = true; callUid = curUid();
    try {
      if (!callUid) throw new Error("not-signed-in");
      showOverlay(true); setStatus("جاري الاتصال…");
      var title = (document.querySelector(".chat-header .chat-header-info .name") || {}).textContent;
      $("bisCallTitle").textContent = title ? title.trim() : "مكالمة";

      var results = await Promise.all([loadSdk(), fetchToken(target)]);
      var LK = results[0], tk = results[1];
      if (!starting || curUid() !== callUid) throw new Error("user-changed"); /* أُنهيت أو تغيّر الحساب أثناء الجلب */

      var room = new LK.Room({ adaptiveStream: false, dynacast: false });
      lkRoom = room;
      room.on(LK.RoomEvent.TrackSubscribed, function (track, pub, p) {
        if (track.kind !== "audio") return;
        var el = track.attach(); el.autoplay = true; el.style.display = "none";
        document.body.appendChild(el); audioEls[track.sid || p.identity] = el;
      });
      room.on(LK.RoomEvent.TrackUnsubscribed, function (track) {
        try { track.detach().forEach(function (e) { e.remove(); }); } catch (e) {}
      });
      room.on(LK.RoomEvent.ParticipantConnected, renderParts);
      room.on(LK.RoomEvent.ParticipantDisconnected, renderParts);
      room.on(LK.RoomEvent.ActiveSpeakersChanged, renderParts);
      room.on(LK.RoomEvent.Disconnected, function () { if (active) end(); });

      await room.connect(tk.url, tk.token);
      if (lkRoom !== room) { try { await room.disconnect(); } catch (e) {} return; } /* أُنهيت أثناء الاتصال */
      if (curUid() !== callUid) throw new Error("user-changed");
      await room.localParticipant.setMicrophoneEnabled(true);
      try { await room.startAudio(); } catch (e) {}

      active = true; starting = false; t0 = Date.now();
      timerId = setInterval(tick, 1000); tick(); renderParts(); refreshBtn();

      /* رنين لطرف الـ DM عبر مسار الإشعارات الحالي (لا تعديل عليه) */
      if (target.kind === "dm" && typeof window._sendNotification === "function") {
        try {
          var me = window.currentUser, myName = (window._currentUserData && window._currentUserData.name) || (me && me.displayName) || "مستخدم";
          window._sendNotification(target.peerUid, "📞 مكالمة من " + myName, "اضغط للدخول للمحادثة والانضمام للمكالمة",
            { type: "call", chatType: "call", senderUid: me ? me.uid : "", tag: "call_" + (me ? me.uid : "") });
        } catch (e) {}
      }
    } catch (e) {
      if (!e || e.message !== "user-changed") toast(errText(e));
      await end();
    }
  }

  /* ── زر المكالمة في هيدر الشات (يُحقن بدون تعديل HTML الحالي) ── */
  function refreshBtn() {
    try {
      if ((active || starting) && curUid() !== callUid) end(); /* خروج/تبديل حساب */
      var hdr = document.querySelector(".chat-main .chat-header");
      if (!hdr) return;
      var btn = $("chatCallBtn");
      if (!btn) {
        btn = document.createElement("button");
        btn.id = "chatCallBtn"; btn.type = "button";
        btn.className = "header-icon-btn"; btn.title = "مكالمة صوتية";
        btn.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>';
        btn.addEventListener("click", function () { start(); });
        var anchor = $("chatSearchToggleBtn");
        if (anchor && anchor.parentNode === hdr) hdr.insertBefore(btn, anchor); else hdr.appendChild(btn);
      }
      btn.style.display = currentTarget() ? "" : "none";
      btn.classList.toggle("in-call", active);
    } catch (e) {}
  }

  function injectCss() {
    if ($("bisCallCss")) return;
    var st = document.createElement("style"); st.id = "bisCallCss";
    st.textContent =
      "#bisCallOverlay{position:fixed;inset:0;z-index:99990;display:none;align-items:center;justify-content:center;background:rgba(var(--t-deep-rgb,0,0,0),.6);backdrop-filter:blur(6px)}" +
      ".bis-call-card{width:min(92vw,360px);padding:20px;border-radius:18px;background:rgba(var(--t-bg-rgb,20,20,22),var(--glass-a,.72));border:1px solid var(--t-border,#333);color:var(--text,#fff);text-align:center}" +
      ".bis-call-title{font-weight:700;font-size:17px}.bis-call-status{margin:6px 0 14px;opacity:.75;font-size:13px}" +
      ".bis-call-parts{display:flex;flex-direction:column;gap:6px;max-height:36vh;overflow:auto;margin-bottom:16px}" +
      ".bis-call-part{padding:8px 12px;border-radius:12px;background:var(--t-card,#222);border:1px solid var(--t-border,#333);font-size:14px}" +
      ".bis-call-part.speaking{border-color:var(--gold,#d4af37)}" +
      ".bis-call-actions{display:flex;gap:14px;justify-content:center}" +
      ".bis-call-btn{width:52px;height:52px;border-radius:50%;border:1px solid var(--t-border,#333);background:var(--t-card2,#2a2a2a);color:inherit;font-size:20px;cursor:pointer}" +
      ".bis-call-btn.off{opacity:.6}.bis-call-end{background:#d33;border-color:#d33;color:#fff;transform:rotate(135deg)}" +
      "#chatCallBtn.in-call{color:#3ddc84}";
    document.head.appendChild(st);
  }

  window.BisCalls = { start: start, end: end, isActive: function () { return active; } };

  function init() {
    try { injectCss(); refreshBtn(); setInterval(refreshBtn, 800); } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.addEventListener("beforeunload", function () { try { lkRoom && lkRoom.disconnect(); } catch (e) {} });
})();
