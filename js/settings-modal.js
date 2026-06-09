(function() {
  /* ── THEME SYSTEM (with Auto / prefers-color-scheme) ── */
  const THEME_KEY   = "app_theme";
  const FS_KEY      = "chat_font_size";
  const CHAT_KEY    = "chat_prefs";
  const PRIV_KEY    = "privacy_prefs";
  let _currentTheme = "dark";   // actual applied theme: "dark" | "light"
  let _themeChoice  = "auto";   // user's stored choice: "dark" | "light" | "auto"
  let _chatPrefs    = { enterSend: false, sound: true };
  let _privPrefs    = { showOnline: true, readReceipts: true };

  /* ── Resolve effective theme from choice ── */
  function _resolveTheme(choice) {
    if (choice === "light") return "light";
    if (choice === "dark")  return "dark";
    // "auto" or anything else → follow system
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  /* Apply theme immediately from localStorage (before auth) */
  (function _initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || "auto";
    _themeChoice = saved;
    _applyThemeDOM(_resolveTheme(saved));
  })();

  function _applyThemeDOM(theme) {
    _currentTheme = theme;
    if (theme === "light") {
      document.documentElement.classList.add("theme-light");
    } else {
      document.documentElement.classList.remove("theme-light");
    }
    /* sync buttons */
    document.querySelectorAll(".smod-theme-btn").forEach(b => {
      // active if: (dark btn & theme is dark & choice is dark) etc.
      // auto btn active when choice is "auto"
      if (b.id === "themeBtn-auto") {
        b.classList.toggle("active", _themeChoice === "auto");
      } else {
        b.classList.toggle("active", b.id === "themeBtn-" + theme && _themeChoice !== "auto");
      }
    });
  }

  /* ── Listen for OS-level theme changes (only when choice is "auto") ── */
  const _mq = window.matchMedia("(prefers-color-scheme: light)");
  function _onSystemThemeChange() {
    if (_themeChoice === "auto") {
      _applyThemeDOM(_resolveTheme("auto"));
    }
  }
  try {
    _mq.addEventListener("change", _onSystemThemeChange);
  } catch(e) {
    try { _mq.addListener(_onSystemThemeChange); } catch(e2) {}
  }

  window.applyTheme = async function(theme) {
    // theme: "dark" | "light" | "auto"
    _themeChoice = theme;
    localStorage.setItem(THEME_KEY, theme);
    _applyThemeDOM(_resolveTheme(theme));
    /* Also persist to Firestore if user is logged in */
    const uid = window.currentUser?.uid;
    if (uid && window.db) {
      try {
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await setDoc(doc(window.db, "users", uid, "settings", "appPrefs"), { theme }, { merge: true });
      } catch(e) {}
    }
  };

  /* Load theme from Firestore after login (overrides localStorage) */
  window._loadAppPrefs = async function(uid) {
    if (!uid || !window.db) return;
    try {
      const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      const snap = await getDoc(doc(window.db, "users", uid, "settings", "appPrefs"));
      if (snap.exists()) {
        const d = snap.data();
        if (d.theme) {
          _themeChoice = d.theme;
          localStorage.setItem(THEME_KEY, d.theme);
          _applyThemeDOM(_resolveTheme(d.theme));
        }
        if (typeof d.chatFontSize === "number") { localStorage.setItem(FS_KEY, d.chatFontSize); _applyChatFontSizeDOM(d.chatFontSize); }
        if (d.chatPrefs)   { _chatPrefs = { ..._chatPrefs, ...d.chatPrefs }; _syncChatPrefs(); }
        if (d.privPrefs)   { _privPrefs = { ..._privPrefs, ...d.privPrefs }; _syncPrivPrefs(); }
      } else {
        /* Load from localStorage fallback */
        const lt = localStorage.getItem(THEME_KEY) || "auto";
        _themeChoice = lt;
        _applyThemeDOM(_resolveTheme(lt));
      }
    } catch(e) {
      const lt = localStorage.getItem(THEME_KEY) || "auto";
      _themeChoice = lt;
      _applyThemeDOM(_resolveTheme(lt));
    }
  };

  /* ── CHAT FONT SIZE ── */
  function _applyChatFontSizeDOM(size) {
    document.querySelectorAll(".bubble-text, .poll-question, .poll-opt-label").forEach(el => {
      el.style.fontSize = size + "px";
    });
    /* Inject persistent style */
    let styleEl = document.getElementById("_chatFontStyle");
    if (!styleEl) { styleEl = document.createElement("style"); styleEl.id = "_chatFontStyle"; document.head.appendChild(styleEl); }
    styleEl.textContent = `.bubble-text { font-size: ${size}px !important; } .poll-opt-label { font-size: ${size}px !important; }`;
    const sel = document.getElementById("chatFontSize");
    if (sel) sel.value = String(size);
  }

  window.applyChatFontSize = async function(val) {
    const size = parseInt(val, 10);
    localStorage.setItem(FS_KEY, size);
    _applyChatFontSizeDOM(size);
    const uid = window.currentUser?.uid;
    if (uid && window.db) {
      try {
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await setDoc(doc(window.db, "users", uid, "settings", "appPrefs"), { chatFontSize: size }, { merge: true });
      } catch(e) {}
    }
  };

  /* ── CHAT PREFS ── */
  function _syncChatPrefs() {
    const el1 = document.getElementById("sChat_enterSend");
    const el2 = document.getElementById("sChat_sound");
    if (el1) el1.checked = !!_chatPrefs.enterSend;
    if (el2) el2.checked = _chatPrefs.sound !== false;
  }

  window.saveChatPref = async function(key, val) {
    _chatPrefs[key] = val;
    localStorage.setItem(CHAT_KEY, JSON.stringify(_chatPrefs));
    const uid = window.currentUser?.uid;
    if (uid && window.db) {
      try {
        const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await setDoc(doc(window.db, "users", uid, "settings", "appPrefs"), { chatPrefs: _chatPrefs }, { merge: true });
      } catch(e) {}
    }
  };

  /* ── PRIVACY PREFS ── */
  function _syncPrivPrefs() {
    const el1 = document.getElementById("sPriv_showOnline");
    const el2 = document.getElementById("sPriv_readReceipts");
    if (el1) el1.checked = _privPrefs.showOnline !== false;
    if (el2) el2.checked = _privPrefs.readReceipts !== false;
  }

  window.savePrivacyPref = async function(key, val) {
    _privPrefs[key] = val;
    localStorage.setItem(PRIV_KEY, JSON.stringify(_privPrefs));
    const uid = window.currentUser?.uid;
    if (uid && window.db) {
      try {
        const { doc, setDoc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await setDoc(doc(window.db, "users", uid, "settings", "appPrefs"), { privPrefs: _privPrefs }, { merge: true });
        // إذا تغيّر showOnline: حدّث حقل showOnline في وثيقة المستخدم فوراً
        if (key === "showOnline") {
          await updateDoc(doc(window.db, "users", uid), { showOnline: val }).catch(() => {});
        }
      } catch(e) {}
    }
  };

  /* ── SETTINGS MODAL OPEN/CLOSE ── */
  window.openSettingsModal = function() {
    const modal = document.getElementById("settingsModal");
    if (!modal) return;
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
    /* Sync all toggles */
    _applyThemeDOM(_currentTheme);
    _syncChatPrefs();
    _syncPrivPrefs();
    const savedFs = parseInt(localStorage.getItem(FS_KEY) || "14", 10);
    const sel = document.getElementById("chatFontSize");
    if (sel) sel.value = String(savedFs);
    /* Sync notif toggles in settings panel */
    _syncSettingsNotifToggles();
    /* Load prefs from Firestore if needed */
    if (window.currentUser?.uid) {
      if (typeof window._loadPrefs === "function") window._loadPrefs(window.currentUser.uid);
    }
    switchSettingsTab("appearance");
  };

  window.closeSettingsModal = function() {
    const modal = document.getElementById("settingsModal");
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
  };

  /* ESC to close */
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") window.closeSettingsModal();
  });

  /* ── TABS ── */
  window.switchSettingsTab = function(tab) {
    document.querySelectorAll(".smod-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".smod-panel").forEach(p => p.classList.remove("active"));
    const tb = document.getElementById("stab-" + tab);
    const pn = document.getElementById("spanel-" + tab);
    if (tb) tb.classList.add("active");
    if (pn) pn.classList.add("active");
    if (tab === "notifications") _syncSettingsNotifToggles();
  };

  /* ── NOTIF PREFS SYNC to settings panel toggles ── */
  /* The existing saveNotifPref & isNotifAllowed live in the original NS system.
     We mirror their state into our sPref_ toggles. */
  const NS_KEYS = ["dm","reply","mention","vip","admin","news","lectures","exams","sections"];

  function _syncSettingsNotifToggles() {
    NS_KEYS.forEach(k => {
      const inp = document.getElementById("sPref_" + k);
      if (inp) inp.checked = window.isNotifAllowed ? window.isNotifAllowed(k) : true;
    });
    /* Also show saving indicator hidden */
    const sv = document.getElementById("smodSaving");
    if (sv) sv.style.opacity = "0";
  }

  /* Patch saveNotifPref to also sync our new toggles */
  document.addEventListener("DOMContentLoaded", function() {
    const _origSave = window.saveNotifPref;
    if (typeof _origSave === "function") {
      window.saveNotifPref = function(key, val) {
        /* Sync both sets of toggles */
        const old = document.getElementById("nsPref_" + key);
        if (old) old.checked = val;
        const newInp = document.getElementById("sPref_" + key);
        if (newInp) newInp.checked = val;
        /* Show saving in settings modal */
        const sv = document.getElementById("smodSaving");
        if (sv) { sv.style.opacity = "1"; setTimeout(() => { sv.style.opacity = "0"; }, 1200); }
        return _origSave.call(this, key, val);
      };
    }

    /* Also patch notifSetAll */
    const _origAll = window.notifSetAll;
    if (typeof _origAll === "function") {
      window.notifSetAll = function(enable) {
        _origAll.call(this, enable);
        _syncSettingsNotifToggles();
        /* Sync old panel too */
        NS_KEYS.forEach(k => {
          const old = document.getElementById("nsPref_" + k);
          if (old) old.checked = enable;
        });
      };
    }

    /* Init localStorage prefs */
    try { _chatPrefs = { ..._chatPrefs, ...JSON.parse(localStorage.getItem(CHAT_KEY) || "{}") }; } catch(e) {}
    try { _privPrefs = { ..._privPrefs, ...JSON.parse(localStorage.getItem(PRIV_KEY) || "{}") }; } catch(e) {}
    const savedFs = parseInt(localStorage.getItem(FS_KEY) || "14", 10);
    _applyChatFontSizeDOM(savedFs);
  });

  /* ── Hook into auth to load Firestore prefs after login ── */
  /* We patch onAuthStateChanged completion by overriding _startNotifListener
     since it's called after currentUser is set */
  const _origStartNotif = window._startNotifListener;
  window._startNotifListener = function(uid) {
    /* Load app prefs from Firestore */
    window._loadAppPrefs(uid);
    if (typeof _origStartNotif === "function") return _origStartNotif.apply(this, arguments);
  };

})();
