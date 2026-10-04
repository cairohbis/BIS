/* ==========================================================================
   واجهة الدخول وإنشاء الحساب — المنطق (js/auth-ui.js)
   يحلّ بالكامل محل واجهة الدخول القديمة + js/lamp-login.js.
   الربط مع Firebase يتم في js/auth-bridge.js عبر window.AuthBridge.
   ========================================================================== */
(function () {
(function() {
  var scene    = document.getElementById('lpScene');
  var cord     = document.getElementById('lpCord');
  var lampWrap = document.getElementById('lpLampWrap');
  var hint     = document.getElementById('lpHint');
  var isOn     = false;
  var busy     = false;

  function toggle() {
    if (busy) return;
    busy = true;

    /* 1 — اهتزاز الحبل */
    cord.classList.add('pulled');
    setTimeout(function() { cord.classList.remove('pulled'); }, 220);

    /* 2 — رجّة المصباح */
    lampWrap.style.animation = 'none';
    lampWrap.style.transform = 'rotate(-5deg)';
    setTimeout(function() {
      lampWrap.style.transform = 'rotate(4deg)';
      setTimeout(function() {
        lampWrap.style.transform = '';
        lampWrap.style.animation = '';
      }, 110);
    }, 110);

    /* 3 — تشغيل / إطفاء */
    setTimeout(function() {
      isOn = !isOn;
      scene.classList.toggle('on', isOn);
      hint.textContent = isOn ? 'طفي الأباجورة' : 'دوس ع الأباجورة';
      busy = false;
    }, 200);
  }

  cord.addEventListener('click', function(e) { e.stopPropagation(); toggle(); });
  lampWrap.addEventListener('click', toggle);
})();

;
function _maleSVG(size) {
  // Premium Male Avatar — Deep blue theme with gold accent
  return `<svg width="${size}" height="${size}" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style="border-radius:50%;display:block;">
    <defs>
      <radialGradient id="mgBg${size}" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#0f2044"/>
        <stop offset="100%" stop-color="#060d1a"/>
      </radialGradient>
      <radialGradient id="mgSkin${size}" cx="45%" cy="35%" r="60%">
        <stop offset="0%" stop-color="#e8c97a"/>
        <stop offset="100%" stop-color="#c9a557"/>
      </radialGradient>
      <linearGradient id="mgShirt${size}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1d4ed8"/>
        <stop offset="100%" stop-color="#1e3a8a"/>
      </linearGradient>
      <radialGradient id="mgGlow${size}" cx="50%" cy="45%" r="50%">
        <stop offset="0%" stop-color="rgba(59,130,246,0.18)"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>
    </defs>
    <!-- Background -->
    <circle cx="40" cy="40" r="40" fill="url(#mgBg${size})"/>
    <circle cx="40" cy="40" r="40" fill="url(#mgGlow${size})"/>
    <!-- Body / Shirt -->
    <path d="M13 80 Q14 54 40 50 Q66 54 67 80Z" fill="url(#mgShirt${size})"/>
    <!-- Collar & tie detail -->
    <path d="M34 51 L40 56 L46 51 L42 51 L40 53 L38 51Z" fill="#93c5fd"/>
    <path d="M38.5 53 L40 70 L41.5 53 L40 56Z" fill="#bfdbfe" opacity="0.6"/>
    <!-- Neck -->
    <rect x="35" y="43" width="10" height="10" rx="4" fill="url(#mgSkin${size})"/>
    <!-- Head -->
    <ellipse cx="40" cy="30" rx="14" ry="15" fill="url(#mgSkin${size})"/>
    <!-- Hair — short masculine -->
    <path d="M26 29 Q26 14 40 13 Q54 14 54 29 Q52 20 40 19 Q28 20 26 29Z" fill="#2d1810"/>
    <!-- Ear left -->
    <ellipse cx="26.5" cy="30" rx="2" ry="3" fill="#c9a557"/>
    <!-- Ear right -->
    <ellipse cx="53.5" cy="30" rx="2" ry="3" fill="#c9a557"/>
    <!-- Eye Left -->
    <ellipse cx="34.5" cy="29" rx="2.2" ry="2" fill="#1a0e00"/>
    <circle cx="35" cy="28.5" r=".7" fill="white" opacity=".5"/>
    <!-- Eye Right -->
    <ellipse cx="45.5" cy="29" rx="2.2" ry="2" fill="#1a0e00"/>
    <circle cx="46" cy="28.5" r=".7" fill="white" opacity=".5"/>
    <!-- Eyebrows -->
    <path d="M32 26 Q34.5 24.8 37 26" stroke="#2d1810" stroke-width="1.2" stroke-linecap="round" fill="none"/>
    <path d="M43 26 Q45.5 24.8 48 26" stroke="#2d1810" stroke-width="1.2" stroke-linecap="round" fill="none"/>
    <!-- Nose -->
    <path d="M39 31 Q38.5 35 39.5 36 Q40.5 36 41.5 35 Q42.5 34 40 31" stroke="#b8883d" stroke-width=".8" fill="none" opacity=".6"/>
    <!-- Smile -->
    <path d="M35.5 38 Q40 41.5 44.5 38" stroke="#8b5e24" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <!-- Cheek blush -->
    <circle cx="30" cy="35" r="3.5" fill="rgba(255,200,100,0.15)"/>
    <circle cx="50" cy="35" r="3.5" fill="rgba(255,200,100,0.15)"/>
  </svg>`;
}

function _femaleSVG(size) {
  // Premium Female Avatar — Rose-navy theme with warm pink accent
  return `<svg width="${size}" height="${size}" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style="border-radius:50%;display:block;">
    <defs>
      <radialGradient id="fgBg${size}" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#1a0a2e"/>
        <stop offset="100%" stop-color="#0d0618"/>
      </radialGradient>
      <radialGradient id="fgSkin${size}" cx="45%" cy="35%" r="60%">
        <stop offset="0%" stop-color="#f0c987"/>
        <stop offset="100%" stop-color="#d4a055"/>
      </radialGradient>
      <linearGradient id="fgShirt${size}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#be185d"/>
        <stop offset="100%" stop-color="#831843"/>
      </linearGradient>
      <radialGradient id="fgGlow${size}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgba(236,72,153,0.14)"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>
      <radialGradient id="fgHair${size}" cx="50%" cy="20%" r="70%">
        <stop offset="0%" stop-color="#3d1a1a"/>
        <stop offset="100%" stop-color="#1a0a0a"/>
      </radialGradient>
    </defs>
    <!-- Background -->
    <circle cx="40" cy="40" r="40" fill="url(#fgBg${size})"/>
    <circle cx="40" cy="40" r="40" fill="url(#fgGlow${size})"/>
    <!-- Body -->
    <path d="M11 80 Q13 52 40 49 Q67 52 69 80Z" fill="url(#fgShirt${size})"/>
    <!-- Neckline detail -->
    <path d="M33 50 Q40 53 47 50 Q43 55 40 55 Q37 55 33 50Z" fill="#fb7185" opacity=".6"/>
    <!-- Neck -->
    <rect x="35.5" y="43" width="9" height="9" rx="4" fill="url(#fgSkin${size})"/>
    <!-- Long hair behind (back layer) -->
    <path d="M22 30 Q21 48 26 62 Q30 70 35 72 Q38 73 40 73 Q42 73 45 72 Q50 70 54 62 Q59 48 58 30 Q55 40 40 41 Q25 40 22 30Z" fill="url(#fgHair${size})"/>
    <!-- Head -->
    <ellipse cx="40" cy="28" rx="13.5" ry="14.5" fill="url(#fgSkin${size})"/>
    <!-- Hair top -->
    <path d="M27 27 Q27 13 40 12 Q53 13 53 27 Q51 18 40 17 Q29 18 27 27Z" fill="url(#fgHair${size})"/>
    <!-- Hair side sweeps -->
    <path d="M26.5 25 Q24 30 25 38 Q27 26 29 24Z" fill="url(#fgHair${size})"/>
    <path d="M53.5 25 Q56 30 55 38 Q53 26 51 24Z" fill="url(#fgHair${size})"/>
    <!-- Small curls / fringe -->
    <path d="M28 20 Q30 15 33 17" stroke="#3d1a1a" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M47 17 Q50 15 52 20" stroke="#3d1a1a" stroke-width="2" fill="none" stroke-linecap="round"/>
    <!-- Ears -->
    <ellipse cx="26.5" cy="28.5" rx="2.2" ry="2.8" fill="#d4a055"/>
    <ellipse cx="53.5" cy="28.5" rx="2.2" ry="2.8" fill="#d4a055"/>
    <!-- Ear rings -->
    <circle cx="26.5" cy="31" r="1.2" fill="#f9a8d4" opacity=".9"/>
    <circle cx="53.5" cy="31" r="1.2" fill="#f9a8d4" opacity=".9"/>
    <!-- Eye Left -->
    <ellipse cx="34" cy="27.5" rx="2.5" ry="2.2" fill="#1a0e00"/>
    <circle cx="34.6" cy="27" r=".8" fill="white" opacity=".5"/>
    <!-- Eye Right -->
    <ellipse cx="46" cy="27.5" rx="2.5" ry="2.2" fill="#1a0e00"/>
    <circle cx="46.6" cy="27" r=".8" fill="white" opacity=".5"/>
    <!-- Lashes upper left -->
    <path d="M31.5 25.5 Q34 24 36.5 25.5" stroke="#1a0e00" stroke-width="1.2" stroke-linecap="round" fill="none"/>
    <!-- Lashes upper right -->
    <path d="M43.5 25.5 Q46 24 48.5 25.5" stroke="#1a0e00" stroke-width="1.2" stroke-linecap="round" fill="none"/>
    <!-- Eyebrow Left (arched) -->
    <path d="M31 23.5 Q34 21.5 37 23.5" stroke="#3d1a1a" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <!-- Eyebrow Right (arched) -->
    <path d="M43 23.5 Q46 21.5 49 23.5" stroke="#3d1a1a" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <!-- Nose -->
    <path d="M39 31 Q38.5 34 39.5 35 Q40.5 35.2 41.5 34 Q42.5 33 40 31" stroke="#b8883d" stroke-width=".8" fill="none" opacity=".5"/>
    <!-- Smile with lipstick -->
    <path d="M35.5 37.5 Q40 41 44.5 37.5" stroke="#c2185b" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    <path d="M35.5 37.5 Q40 38.5 44.5 37.5" stroke="#e91e8c" stroke-width=".6" fill="none" opacity=".4"/>
    <!-- Cheek blush -->
    <ellipse cx="29" cy="33" rx="4" ry="2.5" fill="rgba(236,72,153,0.2)"/>
    <ellipse cx="51" cy="33" rx="4" ry="2.5" fill="rgba(236,72,153,0.2)"/>
  </svg>`;
}
/* منطق واجهة الدخول وإنشاء الحساب — الربط مع Firebase عبر window.AuthBridge (التفاصيل أدناه) */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  var SV = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  var ICON_ALERT = '<svg ' + SV + ' width="16" height="16"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/></svg>';
  var ICON_OK = '<svg ' + SV + ' width="16" height="16"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg>';
  var ICON_EYE = '<svg ' + SV + '><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var ICON_EYE_OFF = '<svg ' + SV + '><path d="M3 3l18 18M10.6 6.2A9.7 9.7 0 0112 6c6.4 0 10 6 10 6a17 17 0 01-3.2 3.9M6.5 7.6C3.9 9.4 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1M9.9 10a3 3 0 004.1 4.1"/></svg>';
  var ICON_USER = '<svg ' + SV + ' width="13" height="13" style="color:var(--gold)"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18c1.5-3 9.5-3 11 0"/></svg>';

  /* ══ أدوات واجهة ══ */
  function setAlert(id, msg, kind) {
    var el = $(id); if (!el) return;
    var ok = kind === "ok";
    el.className = "av-alert" + (ok ? " ok" : "");
    el.setAttribute("role", ok ? "status" : "alert");
    el.innerHTML = (ok ? ICON_OK : ICON_ALERT) + '<span class="av-alert-msg"></span>';
    el.querySelector(".av-alert-msg").textContent = msg;
    el.hidden = false;
  }
  function clearAlert(id) { var el = $(id); if (el) { el.hidden = true; el.innerHTML = ""; } }
  function markInvalid() { for (var i = 0; i < arguments.length; i++) { var e = $(arguments[i]); if (e) e.classList.add("is-invalid"); } }
  function clearInvalid() { document.querySelectorAll(".is-invalid").forEach(function (e) { e.classList.remove("is-invalid"); }); }

  /* ══ قوائم مخصصة للشعبة والفرقة (بدل قائمة المتصفح) ══ */
  function enhanceSelects() {
    var sheet = document.createElement("div"); sheet.className = "av-sheet"; sheet.hidden = true;
    sheet.innerHTML = '<div class="av-sheet-bd"></div><div class="av-sheet-panel" role="dialog" aria-modal="true"><div class="av-sheet-grip"></div><div class="av-sheet-title"></div><div class="av-sheet-list" role="listbox"></div></div>';
    document.body.appendChild(sheet);
    var list = sheet.querySelector(".av-sheet-list"), ttl = sheet.querySelector(".av-sheet-title"), cur = null, tmr = null;
    var vd = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    function close() {
      if (!cur) return; var b = cur.btn; cur = null; b.setAttribute("aria-expanded", "false");
      sheet.classList.remove("open"); clearTimeout(tmr); tmr = setTimeout(function () { if (!sheet.classList.contains("open")) sheet.hidden = true; }, 240); b.focus();
    }
    function open(o) {
      cur = o; ttl.textContent = o.title; list.innerHTML = "";
      o.items.forEach(function (it) {
        var on = it.value === vd.get.call(o.sel), b = document.createElement("button");
        b.type = "button"; b.className = "av-opt" + (on ? " on" : ""); b.setAttribute("role", "option"); b.setAttribute("aria-selected", on ? "true" : "false");
        b.innerHTML = '<span class="av-opt-t"></span><span class="av-opt-ck" aria-hidden="true"></span>'; b.firstChild.textContent = it.text;
        b.addEventListener("click", function () { o.sel.value = it.value; o.sel.dispatchEvent(new Event("input", { bubbles: true })); o.sel.dispatchEvent(new Event("change", { bubbles: true })); close(); });
        list.appendChild(b);
      });
      clearTimeout(tmr); sheet.hidden = false; o.btn.setAttribute("aria-expanded", "true");
      requestAnimationFrame(function () { sheet.classList.add("open"); var on = list.querySelector(".on") || list.firstChild; if (on) on.focus({ preventScroll: true }); });
    }
    sheet.querySelector(".av-sheet-bd").addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (!cur) return;
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); var bs = [].slice.call(list.children), i = bs.indexOf(document.activeElement); bs[Math.max(0, Math.min(bs.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))].focus(); }
    });
    ["regDept", "regYear", "cpDept", "cpYear"].forEach(function (id) {
      var sel = $(id); if (!sel) return;
      var items = [].slice.call(sel.options).filter(function (op) { return op.value; }).map(function (op) { return { value: op.value, text: op.textContent.trim() }; });
      var ph = sel.options[0] ? sel.options[0].textContent.trim() : "";
      var wrap = document.createElement("div"); wrap.className = "av-sel-wrap"; sel.parentNode.insertBefore(wrap, sel);
      var btn = document.createElement("button"); btn.type = "button"; btn.className = "inp av-sel"; btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
      btn.innerHTML = '<span class="av-sel-t"></span><span class="av-sel-ch" aria-hidden="true"></span>';
      wrap.appendChild(btn); wrap.appendChild(sel); sel.classList.add("av-native"); sel.tabIndex = -1; sel.setAttribute("aria-hidden", "true");
      var o = { sel: sel, btn: btn, items: items, title: "اختر " + ph };
      function sync() { var v = vd.get.call(sel), it = items.filter(function (x) { return x.value === v; })[0]; btn.firstChild.textContent = it ? it.text : ph; btn.classList.toggle("has", !!it); }
      Object.defineProperty(sel, "value", { get: function () { return vd.get.call(this); }, set: function (v) { vd.set.call(this, v); sync(); }, configurable: true });
      sel.addEventListener("change", sync);
      new MutationObserver(function () { btn.classList.toggle("is-invalid", sel.classList.contains("is-invalid")); }).observe(sel, { attributes: true, attributeFilter: ["class"] });
      btn.addEventListener("click", function () { open(o); });
      sync();
    });
  }
  var EMAIL_RE = /^\S+@\S+\.\S+$/;

  /* ══════════════════════════════════════════════════════════════════════
     ربط نظام المصادقة — كل ما يخص Firebase يُنفَّذ داخل window.AuthBridge
     عرّفه في موقعك قبل هذا السكربت. كل دالة ترجع Promise (أو قيمة مباشرة):
       loginEmail({email, password})   → {status:"ok"|"incomplete"|"error", profile?, message?}
       google(draft | null)            → {status:"ok"|"incomplete"|"cancelled"|"error", profile?, message?}
                                         (draft = بيانات التسجيل عند الإنشاء، و null عند تسجيل الدخول)
       sendEmailLink({email, password, profile}) → {status:"sent"|"exists"|"error", message?}
       resendEmailLink({email})        → {status:"sent"|"error", message?}
       checkEmailVerified({email})     → {status:"verified"|"pending"|"error", profile?, message?}
       saveProfile(profile)            → {status:"ok"|"error", message?}
       onDone(profile)  [اختياري]      → الانتقال للصفحة الرئيسية بعد النجاح
       signOut()        [اختياري]
     profile = {name, gender:"male"|"female", dept, year, terms}
     ويمكن لموقعك استدعاء AuthUI.emailVerified(profile) عند اكتشاف التحقق خارج هذه الصفحة.
     ══════════════════════════════════════════════════════════════════════ */
  var NOT_CONNECTED = "لم يتم ربط نظام المصادقة بعد.";
  var bridge = window.AuthBridge = window.AuthBridge || {};
  ["loginEmail", "google", "sendEmailLink", "resendEmailLink", "checkEmailVerified", "saveProfile", "resetPassword"].forEach(function (m) {
    if (typeof bridge[m] !== "function") bridge[m] = function () { return { status: "error", message: NOT_CONNECTED }; };
  });
  var bridgeReady = new Promise(function (res) { window.__resolveAuthBridge = res; });
  function invoke(method, payload) {
    var wait = Promise.race([bridgeReady, new Promise(function (res) { setTimeout(res, 8000); })]);
    var p = wait.then(function () { return bridge[method](payload); });
    return p.then(function (r) { return r || { status: "error" }; }, function (e) { return { status: "error", message: (e && e.message) || "" }; });
  }
  function call(method, payload, label) { go("loading", { label: label }); return invoke(method, payload); }

  /* حالة الواجهة فقط (مسودة التسجيل + تحقق البريد المعلّق) — تبقى بعد إغلاق الصفحة */
  var KEY = "bis_auth_ui", S = { draft: null, pending: null }, profile = null, pendingMethod = null;
  try { var raw = JSON.parse(localStorage.getItem(KEY)); if (raw) S = { draft: raw.draft || null, pending: raw.pending || null }; } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function readDraft() { S.draft = { name: $("loginName").value.trim(), gender: gender.reg.get(), dept: $("regDept").value, year: $("regYear").value, terms: $("agreeTermsCheck").checked }; save(); }
  function regComplete() { return !!($("loginName").value.trim() && gender.reg && gender.reg.get() && $("regDept").value && $("regYear").value && $("agreeTermsCheck").checked); }
  function syncMethods() {
    if (!gender.reg) return;
    var ok = regComplete();
    ["methodGoogle", "methodMail"].forEach(function (id) { var b = $(id); if (!b) return; b.classList.toggle("av-incomplete", !ok); b.setAttribute("aria-disabled", String(!ok)); });
    var al = $("regAlert"); if (ok && al && al.dataset.inc) { delete al.dataset.inc; clearAlert("regAlert"); }
  }
  function restoreDraft() { var d = S.draft; if (!d) return; $("loginName").value = d.name || ""; if (d.gender) gender.reg.set(d.gender); $("regDept").value = d.dept || ""; $("regYear").value = d.year || ""; $("agreeTermsCheck").checked = !!d.terms; }
  function prefillComplete() { var u = profile; if (!u) return; $("cpName").value = u.name || ""; if (u.gender) gender.cp.set(u.gender); $("cpDept").value = u.dept || ""; $("cpYear").value = u.year || ""; $("cpTerms").checked = !!u.terms; }
  function openVerify() { openScreen("Verify"); if (S.pending) $("verifyEmail").textContent = S.pending.email; var r = S.pending ? Math.ceil((S.pending.cdEnd - Date.now()) / 1000) : 0; startCooldown(r > 0 ? r : 0); }
  function afterAuth(r, onFail) {
    if (r.status === "ok") { profile = r.profile || profile; S.draft = null; save(); return go("success"); }
    if (r.status === "incomplete") { profile = r.profile || {}; return go("complete"); }
    onFail(r);
  }
  function fail(view, alertId, r, fields) {
    go(view);
    if (r.status === "cancelled") return;
    setAlert(alertId, r.message || "حدث خطأ، حاول مرة أخرى."); if (fields) markInvalid.apply(null, fields);
  }

  function inAuth(t) { return !!(t && t.closest && t.closest("#page-login, .av-screen")); }
  document.addEventListener("input", function (e) { if (inAuth(e.target)) e.target.classList.remove("is-invalid"); });
  document.addEventListener("change", function (e) { if (inAuth(e.target)) e.target.classList.remove("is-invalid"); });

  /* زر إظهار/إخفاء كلمة المرور */
  function wireEyes() {
    document.querySelectorAll(".av-eye").forEach(function (b) {
      b.innerHTML = ICON_EYE;
      b.addEventListener("click", function () {
        var inp = $(b.getAttribute("data-eye")); if (!inp) return;
        var show = inp.type === "password";
        inp.type = show ? "text" : "password";
        b.innerHTML = show ? ICON_EYE_OFF : ICON_EYE;
        b.setAttribute("aria-pressed", String(show));
        b.setAttribute("aria-label", show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
      });
    });
  }

  /* SVG الأفاتار فيها ids (gradients/clipPath) — لازم تكون فريدة لكل نسخة، وإلا النسخة المخفية (display:none) بتكسر الباقي */
  function uniq(svg, sfx) {
    var ids = []; svg.replace(/id="([^"]+)"/g, function (m, id) { ids.push(id); return m; });
    ids.forEach(function (id) {
      var re = new RegExp('id="' + id + '"', "g"); svg = svg.replace(re, 'id="' + id + '-' + sfx + '"');
      svg = svg.split("url(#" + id + ")").join("url(#" + id + "-" + sfx + ")");
      svg = svg.split('href="#' + id + '"').join('href="#' + id + '-' + sfx + '"');
    });
    return svg;
  }

  /* اختيار النوع (نفس classes الأصل: gender-seg-*) */
  function makeGender(host, blank) {
    host.innerHTML =
      '<div class="gender-seg-header">' + ICON_USER + ' نوع الحساب</div>' +
      '<div class="gender-seg-track"><div class="gender-seg-thumb male-active"></div>' +
      '<button type="button" class="gender-seg-opt active-male" data-g="male"><div class="gender-avatar-preview">' + uniq(_maleSVG(36), host.id) + '</div><div><div class="gender-type-label">طالب</div><div class="av-en">Male</div></div></button>' +
      '<button type="button" class="gender-seg-opt" data-g="female"><div class="gender-avatar-preview">' + uniq(_femaleSVG(36), host.id) + '</div><div><div class="gender-type-label">طالبة</div><div class="av-en">Female</div></div></button></div>';
    var thumb = host.querySelector(".gender-seg-thumb"), m = host.querySelector('[data-g="male"]'), f = host.querySelector('[data-g="female"]'), cur = blank ? null : "male";
    var mid = document.createElement("div"); mid.setAttribute("aria-hidden", "true"); host.querySelector(".gender-seg-track").appendChild(mid);
    function paint(g) { if (!g) { mid.className = "gender-mid none"; mid.innerHTML = ""; return; } mid.className = "gender-mid " + g; mid.innerHTML = uniq(g === "male" ? _maleSVG(44) : _femaleSVG(44), host.id + "mid"); }
    paint(blank ? null : "male");
    if (blank) { m.className = "gender-seg-opt"; thumb.className = "gender-seg-thumb none"; }
    function set(g) {
      cur = g; paint(g); host.classList.remove("is-invalid");
      m.className = "gender-seg-opt" + (g === "male" ? " active-male" : "");
      f.className = "gender-seg-opt" + (g === "female" ? " active-female" : "");
      thumb.className = "gender-seg-thumb " + (g === "male" ? "male-active" : "female-active");
    }
    m.onclick = function () { set("male"); }; f.onclick = function () { set("female"); };
    return { set: set, get: function () { return cur; } };
  }

  /* ══ المصباح ══ */
  function lampIsOn() { return $("lpScene").classList.contains("on"); }
  function ensureLamp(on) { if (lampIsOn() !== !!on) $("lpCord").click(); }

  /* ══ العروض والشاشات ══ */
  function setView(v) {
    var box = v === "login" ? "login" : "register";
    $("lpBox").dataset.view = box; $("lpScene").dataset.view = box;
    ["Login", "Register"].forEach(function (n) { $("view" + n).hidden = v !== n.toLowerCase(); });
    clearAlert("loginAlert"); clearAlert("regAlert"); clearAlert("mailAlert"); clearInvalid(); syncMethods();
  }
  function closeScreens() {
    document.querySelectorAll(".av-screen").forEach(function (s) { s.hidden = true; });
    document.body.classList.remove("av-screen-open");
    clearAlert("cpAlert"); clearAlert("verifyAlert");
  }
  function openScreen(name) {
    closeScreens();
    document.body.classList.add("av-screen-open");
    var s = $("screen" + name); s.hidden = false; s.scrollTop = 0;
  }

  /* ══ Loading — نفس Splash الموقع (الحلقة + الكلمات) + ماسكوت + نص الحالة ══ */
  var WORDS = [
    { text: "منتدى جامعي", color: "#4dabf7", icon: "fa-solid fa-comments" },
    { text: "دردشة سريعة", color: "#ffd43b", icon: "fa-solid fa-bolt" },
    { text: "سجل مسيرتك", color: "#69db7c", icon: "fa-solid fa-route" },
    { text: "سرعة استجابة", color: "#ff922b", icon: "fa-solid fa-gauge-high" },
    { text: "أمان الخصوصية", color: "#845ef7", icon: "fa-solid fa-user-shield" },
    { text: "تشفير تام", color: "#20c997", icon: "fa-solid fa-lock" },
    { text: "تواصل مع أصدقائك", color: "#ff6b6b", icon: "fa-solid fa-user-group" },
    { text: "احفظ درجاتك", color: "#e8b923", icon: "fa-solid fa-graduation-cap" }
  ];
  var RADIUS = 48, CIRC = 2 * Math.PI * RADIUS, splashTimer = null, splashT0 = 0, splashNext = null, splashFixed = null;
  function stopSplash() { if (splashTimer) { cancelAnimationFrame(splashTimer); splashTimer = null; } }
  function removeLoading() { var sp = $("avLoading"); if (sp) { stopSplash(); sp.remove(); } }
  function showLoading(o) {
    o = o || {}; removeLoading();
    var sp = document.createElement("div");
    sp.id = "avLoading";
    sp.setAttribute("role", "status"); sp.setAttribute("aria-live", "polite");
    sp.innerHTML =
      '<div class="uni-splash-ring-wrap"><svg viewBox="0 0 110 110"><circle class="uni-splash-ring-bg" cx="55" cy="55" r="' + RADIUS + '"></circle>' +
      '<circle class="uni-splash-ring-fill" id="av-ring-fill" cx="55" cy="55" r="' + RADIUS + '" stroke-dasharray="' + CIRC + '" stroke-dashoffset="' + CIRC + '"></circle></svg>' +
      '<div class="uni-splash-percent" id="av-ring-pct">0%</div></div>' +
      '<div class="uni-splash-status" id="avLoadStatus"></div>' +
      '<div class="uni-splash-word" id="av-word"><i id="av-word-icon"></i><span id="av-word-text"></span></div>' +
      '<div class="uni-splash-title">منتدى الجامعة</div>';
    document.body.appendChild(sp);
    $("avLoadStatus").textContent = o.label || "جارٍ التحميل…";
    splashNext = o.next || null; splashFixed = o.fixed == null ? null : o.fixed; splashT0 = 0;
    var idx = -1;
    function setP(p) { p = Math.max(0, Math.min(100, p)); $("av-ring-fill").style.strokeDashoffset = CIRC - (p / 100) * CIRC; $("av-ring-pct").textContent = Math.round(p) + "%"; }
    function word(i) {
      var w = WORDS[i % WORDS.length], we = $("av-word"); we.classList.remove("uni-splash-word-visible");
      setTimeout(function () {
        var ic = $("av-word-icon"), tx = $("av-word-text"); if (!ic) return;
        ic.className = w.icon; tx.textContent = w.text; we.style.color = w.color; ic.style.color = w.color; we.classList.add("uni-splash-word-visible");
      }, 60);
    }
    function tick(ts) {
      if (!$("av-ring-fill")) return;
      if (!splashT0) splashT0 = ts;
      var el = ts - splashT0;
      var pct = splashFixed != null ? splashFixed : Math.min(100, el / 1500 * 100);
      setP(pct);
      var wi = splashFixed != null ? 2 : Math.min(WORDS.length - 1, Math.floor(el / 400));
      if (wi !== idx) { idx = wi; word(idx); }
      if (splashNext && el > 1500) { var n = splashNext; splashNext = null; go(n); return; }
      splashTimer = requestAnimationFrame(tick);
    }
    splashTimer = requestAnimationFrame(tick);
  }

  /* ══ تأكيد البريد: cooldown ══ */
  var CD_TOTAL = 45, cd = 0, cdTimer = null;
  function fmt(s) { var m = Math.floor(s / 60), r = s % 60; return m + ":" + (r < 10 ? "0" : "") + r; }
  function renderCd() {
    var on = cd > 0, b = $("resendBtn");
    b.disabled = on; b.setAttribute("aria-disabled", String(on));
    $("cdNote").hidden = !on;
    if (on) { $("cdTime").textContent = fmt(cd); $("cdBar").style.width = (cd / CD_TOTAL * 100) + "%"; }
  }
  function startCooldown(sec) {
    cd = sec; renderCd(); clearInterval(cdTimer);
    cdTimer = setInterval(function () { cd--; renderCd(); if (cd <= 0) { clearInterval(cdTimer); cdTimer = null; } }, 1000);
  }
  function stopCooldown() { clearInterval(cdTimer); cdTimer = null; }

  /* ══ التنقل بين الشاشات ══ */
  var gender = {};
  var SCREENS = {
    "lamp-off": function () { setView("login"); ensureLamp(false); },
    login: function () { setView("login"); ensureLamp(true); },
    register: function () { setView("register"); ensureLamp(true); },
    complete: function () { openScreen("Complete"); prefillComplete(); },
    verify: openVerify,
    success: function () { openScreen("Success"); },
    loading: function (o) { showLoading({ label: o.label || "جارٍ التحميل…", next: o.next, fixed: o.next ? null : 62 }); }
  };
  function go(id, opts) {
    var fn = SCREENS[id]; if (!fn) return;
    removeLoading(); stopSplash(); stopCooldown(); closeScreens();
    fn(opts || {});
  }

  /* يشغّل فحص نموذج التسجيل مباشرة (requestSubmit يتعطل داخل المعاينات المقيّدة) */
  function submitReg() { $("regForm").dispatchEvent(new Event("submit", { cancelable: true, bubbles: true })); }

  /* ══ ربط الأحداث ══ */
  function wire() {
    document.addEventListener("click", function (e) {
      var g = e.target.closest && e.target.closest("[data-go]"); if (g) { e.preventDefault(); go(g.getAttribute("data-go")); }
      var a = e.target.closest && e.target.closest("[data-noop]"); if (a) e.preventDefault();
    });

    $("loginForm").addEventListener("submit", function (e) {
      e.preventDefault(); clearAlert("loginAlert"); clearInvalid();
      var em = $("loginEmail").value.trim(), pw = $("loginPass").value;
      if (!em || !pw) { setAlert("loginAlert", "اكتب البريد الإلكتروني وكلمة المرور."); if (!em) markInvalid("loginEmail"); if (!pw) markInvalid("loginPass"); return; }
      if (!EMAIL_RE.test(em)) { setAlert("loginAlert", "صيغة البريد الإلكتروني غير صحيحة."); markInvalid("loginEmail"); return; }
      call("loginEmail", { email: em, password: pw }, "جارٍ تسجيل الدخول…").then(function (r) {
        afterAuth(r, function (x) { fail("login", "loginAlert", x, ["loginEmail", "loginPass"]); });
      });
    });
    /* زر الدخول يشغّل الفحص مباشرة (إرسال النموذج يتعطل داخل المعاينات المقيّدة) */
    $("mainAuthBtn").addEventListener("click", function (e) { e.preventDefault(); $("loginForm").dispatchEvent(new Event("submit", { cancelable: true, bubbles: true })); });
    /* نسيت كلمة المرور: يرسل رابط إعادة الضبط على البريد المكتوب في خانة الدخول (sendPasswordResetEmail عبر الربط) */
    $("forgotBtn").addEventListener("click", function () {
      var btn = $("forgotBtn"); if (btn.disabled) return;
      clearAlert("loginAlert"); clearInvalid();
      var em = $("loginEmail").value.trim();
      if (!em) { setAlert("loginAlert", "اكتب بريدك الإلكتروني أولًا ثم اضغط «نسيت كلمة المرور»."); markInvalid("loginEmail"); $("loginEmail").focus(); return; }
      if (!EMAIL_RE.test(em)) { setAlert("loginAlert", "صيغة البريد الإلكتروني غير صحيحة."); markInvalid("loginEmail"); return; }
      btn.disabled = true;                              /* يمنع الإرسال المتكرر */
      invoke("resetPassword", { email: em }).then(function (r) {
        if (r.status === "sent") {
          setAlert("loginAlert", "إذا كان هذا البريد مسجّلًا لدينا، أرسلنا إليه رابط إعادة ضبط كلمة المرور. افحص الوارد والرسائل غير المرغوبة.", "ok");
          setTimeout(function () { btn.disabled = false; }, 45000);
        } else {
          btn.disabled = false;
          setAlert("loginAlert", r.message || "تعذّر إرسال الرابط، حاول مرة أخرى.");
        }
      });
    });
    $("googleBtn").addEventListener("click", function () {
      call("google", null, "جارٍ الاتصال بحساب Google…").then(function (r) { afterAuth(r, function (x) { fail("login", "loginAlert", x); }); });
    });

    $("regForm").addEventListener("input", readDraft); $("regForm").addEventListener("change", readDraft); $("regGender").addEventListener("click", readDraft); ["input", "change"].forEach(function (ev) { $("regForm").addEventListener(ev, syncMethods); }); $("regGender").addEventListener("click", syncMethods);
    $("methodGoogle").addEventListener("click", function () {
      pendingMethod = function () {
        call("google", S.draft, "جارٍ ربط بياناتك بحساب Google…").then(function (r) { afterAuth(r, function (x) { fail("register", "regAlert", x); }); });
      };
      submitReg();
    });
    $("methodMail").addEventListener("click", function () {
      if (!$("mailBox").hidden) {            /* ضغطة ثانية على البريد → إخفاء الحقول والرجوع للأصل */
        $("mailBox").hidden = true; pendingMethod = null;
        $("mailEmail").value = ""; $("mailPass").value = ""; $("mailPass").type = "password";
        var eb = document.querySelector('[data-eye="mailPass"]'); if (eb) { eb.innerHTML = ICON_EYE; eb.setAttribute("aria-pressed", "false"); }
        clearAlert("mailAlert"); $("mailEmail").classList.remove("is-invalid"); $("mailPass").classList.remove("is-invalid");
        return;
      }
      pendingMethod = null;
      if (!regComplete()) { submitReg(); return; }   /* بيانات ناقصة: ما نفتحش حقول البريد */
      $("mailBox").hidden = false; submitReg(); $("mailEmail").focus();
    });
    ["mailEmail", "mailPass"].forEach(function (id) { $(id).addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $("mailSend").click(); } }); });
    function sendMail() {
      clearAlert("mailAlert");
      var em = $("mailEmail").value.trim().toLowerCase();
      if (!em || !EMAIL_RE.test(em)) { setAlert("mailAlert", "اكتب بريدًا إلكترونيًا صحيحًا."); markInvalid("mailEmail"); return; }
      var pw = $("mailPass").value;
      if (!pw) { setAlert("mailAlert", "اكتب كلمة المرور."); markInvalid("mailPass"); return; }
      if (pw.length < 6) { setAlert("mailAlert", "كلمة المرور يجب ألا تقل عن 6 أحرف."); markInvalid("mailPass"); return; }
      call("sendEmailLink", { email: em, password: pw, profile: S.draft }, "جارٍ إرسال رابط التحقق…").then(function (r) {
        $("mailPass").value = "";
        if (r.status === "sent") { S.pending = { email: em, cdEnd: Date.now() + CD_TOTAL * 1000 }; save(); return go("verify"); }
        go("register"); $("mailBox").hidden = false; $("mailEmail").value = em; markInvalid("mailEmail");
        setAlert("mailAlert", r.status === "exists" ? "هذا البريد الإلكتروني مسجّل بالفعل. جرّب تسجيل الدخول بدلًا من ذلك." : (r.message || "تعذّر إرسال رابط التحقق، حاول مرة أخرى."));
      });
    }
    $("mailSend").addEventListener("click", function () { pendingMethod = sendMail; submitReg(); });

    $("regForm").addEventListener("submit", function (e) {
      e.preventDefault(); clearAlert("regAlert"); clearInvalid();
      var miss = [];
      if (!$("loginName").value.trim()) miss.push("loginName");
      if (!gender.reg.get()) miss.push("regGender");
      if (!$("regDept").value) miss.push("regDept");
      if (!$("regYear").value) miss.push("regYear");
      if (!$("agreeTermsCheck").checked) miss.push("agreeTermsCheck");
      if (miss.length) {
        pendingMethod = null;
        setAlert("regAlert", "كمّل البيانات المطلوبة."); $("regAlert").dataset.inc = "1";
        markInvalid.apply(null, miss); syncMethods(); return;
      }
      readDraft(); var cb = pendingMethod; pendingMethod = null; if (cb) cb();
    });

    $("cpForm").addEventListener("submit", function (e) {
      e.preventDefault(); clearAlert("cpAlert"); clearInvalid();
      var bad = function (msg, id) { setAlert("cpAlert", msg); markInvalid(id); };
      if (!$("cpName").value.trim()) return bad("اكتب اسم المستخدم.", "cpName");
      if (!$("cpDept").value || !$("cpYear").value) { setAlert("cpAlert", "اختر الشعبة والفرقة لإكمال حسابك."); if (!$("cpDept").value) markInvalid("cpDept"); if (!$("cpYear").value) markInvalid("cpYear"); return; }
      if (!$("cpTerms").checked) return bad("يجب الموافقة على شروط الاستخدام وسياسة الخصوصية.", "cpTerms");
      profile = { name: $("cpName").value.trim(), gender: gender.cp.get(), dept: $("cpDept").value, year: $("cpYear").value, terms: true };
      call("saveProfile", profile, "جارٍ حفظ بياناتك…").then(function (r) {
        if (r.status === "ok") return go("success");
        go("complete"); setAlert("cpAlert", r.message || "تعذّر حفظ بياناتك، حاول مرة أخرى.");
      });
    });
    $("cpLogout").addEventListener("click", function () { try { if (typeof bridge.signOut === "function") bridge.signOut(); } catch (e) {} go("login"); });

    function verified(p) { profile = p || S.draft || profile; S.pending = null; S.draft = null; save(); go("success"); }
    window.AuthUI = {
      show: go, emailVerified: verified,
      /* إكمال بيانات حساب موجود بدون ملف بيانات (يُستدعى من الموقع) */
      complete: function (p) { profile = p || {}; go("complete"); },
      /* بعد تسجيل الخروج: تفريغ الحقول والرجوع لعرض الدخول (بدون تغيير حالة المصباح) */
      reset: function () {
        ["loginEmail", "loginPass", "loginName", "mailEmail", "mailPass"].forEach(function (id) { var e = $(id); if (e) e.value = ""; });
        removeLoading(); stopSplash(); stopCooldown(); closeScreens(); setView("login");
      },
      /* انتهت الجلسة أثناء انتظار تأكيد البريد */
      sessionEnded: function () { if (S.pending) { S.pending = null; save(); if (!$("screenVerify").hidden) go("login"); } }
    };
    $("verifyOk").addEventListener("click", function () {
      if (!S.pending) return go("register");
      call("checkEmailVerified", { email: S.pending.email }, "جارٍ التحقق من البريد…").then(function (r) {
        if (r.status === "verified") return verified(r.profile);
        if (r.status === "incomplete") { S.pending = null; save(); profile = r.profile || {}; return go("complete"); }
        go("verify");
        setAlert("verifyAlert", r.status === "pending" ? "لم يتم التحقق من البريد الإلكتروني بعد. افتح الرسالة واضغط على الرابط." : (r.message || "تعذّر التحقق، حاول مرة أخرى."));
      });
    });
    $("resendBtn").addEventListener("click", function () {
      if (cd > 0 || !S.pending) return;
      invoke("resendEmailLink", { email: S.pending.email }).then(function (r) {
        if (r.status !== "sent") return setAlert("verifyAlert", r.message || "تعذّر إرسال الرابط، حاول مرة أخرى.");
        setAlert("verifyAlert", "تم إرسال رابط تأكيد جديد إلى بريدك الإلكتروني.", "ok");
        S.pending.cdEnd = Date.now() + CD_TOTAL * 1000; save(); startCooldown(CD_TOTAL);
      });
    });
    $("verifyLogout").addEventListener("click", function () {
      S.pending = null; save();
      try { if (typeof bridge.signOut === "function") bridge.signOut(); } catch (e) {}
      go("login");
    });
    $("successBtn").addEventListener("click", function () { if (typeof bridge.onDone === "function") bridge.onDone(profile); else go("login"); });
  }

  function boot() {
    gender.reg = makeGender($("regGender"), true); gender.cp = makeGender($("cpGender"));
    wireEyes(); wire(); enhanceSelects(); restoreDraft(); syncMethods();
    go(S.pending ? "verify" : "lamp-off");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();


})();
