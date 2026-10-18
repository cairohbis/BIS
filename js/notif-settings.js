
/* ══════════════════════════════════════════
   NOTIFICATION SETTINGS SYSTEM
══════════════════════════════════════════ */
(function() {
  // All pref keys — value true = enabled, false = disabled
  const NS_KEYS = ["dm","reply","mention","vip","admin","news","lectures","exams","sections"];
  // Default: all enabled
  let _prefs = {};
  NS_KEYS.forEach(k => _prefs[k] = true);

  let _savingTimer = null;
  let _pendingSaveUid = null;    // صاحب الحفظ المعلّق (مهلة الـ 700ms) — null = لا يوجد حفظ معلّق
  const _dirty = {};             // مفاتيح غيّرها المستخدم ولسه ما اتحفظتش (تخص _prefsOwner)
  const _writing = {};           // مفاتيح قيد الكتابة حاليًا (لسه ما جاش تأكيد السيرفر)

  /* ── كاش تفضيلات المستخدم الحالي (داخل الذاكرة فقط، 5 دقائق) ── */
  const PREFS_TTL_MS = 5 * 60 * 1000;
  let _prefsOwner = null;        // الحساب اللي _prefs الحالية تخصه
  let _prefsUid = null;          // الحساب اللي اتحمّلت له التفضيلات بنجاح من السيرفر (ده اللي بيفعّل الكاش)
  let _prefsLoadedAt = 0;        // وقت آخر قراءة ناجحة من السيرفر
  let _prefsInflight = null;     // القراءة الجارية (بتتشارك بين المنادين لنفس الحساب)
  let _prefsInflightUid = null;
  let _prefsGen = 0;             // يزيد عند تبديل الحساب — أي قراءة قديمة بتتجاهل نتيجتها

  function _clearUnsaved() {
    Object.keys(_dirty).forEach(k => { delete _dirty[k]; });
    Object.keys(_writing).forEach(k => { delete _writing[k]; });
  }

  /* تبديل حساب: رجّع الافتراضيات وصفّر الكاش.
     أي حفظ معلّق للحساب السابق يُرسَل فورًا لمستنده هو — بالمفاتيح اللي غيّرها بس، وبقيمها قبل إعادة الضبط —
     ولا يُكتب أبدًا في مستند الحساب الجديد. لو الحفظ المعلّق مش تابع لصاحب _prefs (حالة غير متسقة) بيتم إسقاطه.
     المفاتيح غير المحفوظة بتتمسح هنا (مش بتتنقل لحساب تاني)؛ لو فشل الإرسال ده بيتجاهل. */
  function _resetPrefsState(oldOwner) {
    const pendingUid = _pendingSaveUid;
    let payload = null;
    if (pendingUid && pendingUid === oldOwner) {
      const keys = Object.keys(_dirty);
      if (keys.length) { payload = {}; keys.forEach(k => { payload[k] = _prefs[k]; }); }
    }
    if (pendingUid) { clearTimeout(_savingTimer); _pendingSaveUid = null; }
    _prefsGen++;
    NS_KEYS.forEach(k => { _prefs[k] = true; });
    _clearUnsaved();
    _prefsUid = null; _prefsLoadedAt = 0;
    _prefsInflight = null; _prefsInflightUid = null;
    if (payload) {
      (async () => {
        try {
          const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
          await setDoc(doc(window.db, "users", pendingUid, "settings", "notifPrefs"), payload, { merge: true });
        } catch(e) {}
        const el = document.getElementById("nsmSaving");
        if (el) { el.style.opacity = "0"; }
      })();
    } else if (pendingUid) {
      const el = document.getElementById("nsmSaving");
      if (el) { el.style.opacity = "0"; }
    }
  }

  /* قبل أي تعديل من المستخدم: لو _prefs تخص حساب تاني اتبدّل، صفّرها وابعت المعلّق لصاحبه الأول */
  function _claimOwner() {
    const cu = window.currentUser?.uid;
    if (!cu) return;
    if (_prefsOwner !== null && _prefsOwner !== cu) _resetPrefsState(_prefsOwner);
    _prefsOwner = cu;
  }
  function _markDirty(keys) {
    if (!window.currentUser?.uid || !window.db) return;
    keys.forEach(k => { _dirty[k] = true; });
  }

  /* Load prefs from Firestore for current user
     force === true → تجاهل الكاش واقرأ من السيرفر */
  async function _loadPrefs(uid, force) {
    if (!uid || !window.db) return;
    if (_prefsOwner !== null && _prefsOwner !== uid) _resetPrefsState(_prefsOwner);
    _prefsOwner = uid;

    // كاش صالح لنفس الحساب → بدون قراءة، ومزامنة مفاتيح الواجهة فقط
    if (force !== true && _prefsUid === uid) {
      const age = Date.now() - _prefsLoadedAt;
      if (age >= 0 && age < PREFS_TTL_MS) { _syncToggles(); return; }
    }

    // قراءة جارية لنفس الحساب → شاركها
    if (_prefsInflight && _prefsInflightUid === uid) {
      try { await _prefsInflight; } catch(e) {}
      _syncToggles();
      return;
    }

    const gen = _prefsGen;
    const p = (async () => {
      try {
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        const snap = await getDoc(doc(window.db, "users", uid, "settings", "notifPrefs"));
        if (gen !== _prefsGen) return;                                   // اتبدّل الحساب أثناء القراءة → تجاهل
        if (window.currentUser?.uid && window.currentUser.uid !== uid) return;
        if (snap.exists()) {
          const d = snap.data();
          // مفتاح غيّره المستخدم (أو قيد الكتابة) ما بيتكتبش فوقه بقيمة السيرفر القديمة
          NS_KEYS.forEach(k => { if (typeof d[k] === "boolean" && !_dirty[k] && !_writing[k]) _prefs[k] = d[k]; });
        }
        // مدة الكاش تبدأ فقط بعد قراءة ناجحة من السيرفر (مش من الكاش المحلي) — مستند غير موجود = نجاح (الافتراضيات)
        if (snap.metadata && snap.metadata.fromCache === false) {
          _prefsUid = uid; _prefsLoadedAt = Date.now();
        }
      } catch(e) {}
    })();
    _prefsInflight = p; _prefsInflightUid = uid;
    try { await p; } finally {
      if (_prefsInflight === p) { _prefsInflight = null; _prefsInflightUid = null; }
    }
    if (gen !== _prefsGen) return;
    _syncToggles();
  }

  /* كتابة المفاتيح المتغيرة (dirty) فعليًا — مشتركة بين المؤقّت العادي (700ms) و _notifPrefsFlush.
     بترجع true فقط لو Firestore أكّد الكتابة؛ false لو فشلت؛ null لو مفيش مفاتيح تتكتب. */
  async function _commitDirty(uid) {
    const gen = _prefsGen;
    const keys = (_prefsOwner === uid) ? Object.keys(_dirty) : [];
    if (!keys.length) return null;
    const payload = {};
    keys.forEach(k => { payload[k] = _prefs[k]; delete _dirty[k]; _writing[k] = true; });
    let ok = false;
    try {
      const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await setDoc(doc(window.db, "users", uid, "settings", "notifPrefs"), payload, { merge: true });
      ok = true;
    } catch(e) {}
    // نفس جلسة الحساب فقط: لو فشلت الكتابة نرجّع المفاتيح "غير محفوظة" (بتتحاول تاني مع أول حفظ جاي)،
    // ولو الحساب اتبدّل خلال الكتابة بنتجاهل النتيجة (مفيش تسريب لحساب تاني)
    if (gen === _prefsGen) {
      keys.forEach(k => { delete _writing[k]; if (!ok) _dirty[k] = true; });
    }
    return ok;
  }

  /* Save changed prefs only (merge) — بيكتب المفاتيح اللي غيّرها المستخدم بس */
  async function _savePrefs() {
    const uid = window.currentUser?.uid;
    if (!uid || !window.db) return;
    const el = document.getElementById("nsmSaving");
    if (el) { el.style.opacity = "1"; }
    clearTimeout(_savingTimer);
    _pendingSaveUid = uid;
    _savingTimer = setTimeout(async () => {
      _pendingSaveUid = null;
      await _commitDirty(uid);
      if (el) { el.style.opacity = "0"; }
    }, 700);
  }

  /* حفظ فوري لأي تغيير معلّق (بيتنادى من doLogout قبل ما الحساب يخرج).
     - مفيش حفظ معلّق → بترجع فورًا (null) بدون قراءة/كتابة (ونفس الشيء لو مفيش مفاتيح غير محفوظة).
     - المعلّق لازم يخص الحساب الحالي وصاحب _prefs، وإلا بتتجاهله (الحماية الحالية بتتعامل معاه).
     - بتنتظر نتيجة الكتابة بحد أقصى timeoutMs؛ بترجع true فقط لو Firestore أكّد الكتابة،
       false لو فشلت أو انتهت المهلة (الكتابة غير مؤكدة ومفاتيحها تفضل غير محفوظة)، ومبتتعطلش ولا بترمي خطأ. */
  window._notifPrefsFlush = async function (timeoutMs = 1500) {
    try {
      const uid = _pendingSaveUid;
      if (!uid || !window.db) return null;
      if (_prefsOwner !== uid || window.currentUser?.uid !== uid) return false;
      clearTimeout(_savingTimer);
      _pendingSaveUid = null;
      const t = (typeof timeoutMs === "number" && timeoutMs > 0) ? timeoutMs : 1500;
      let timer;
      const timeout = new Promise(resolve => { timer = setTimeout(() => resolve(false), t); });
      let res;
      try { res = await Promise.race([_commitDirty(uid), timeout]); }
      finally { clearTimeout(timer); }
      const el = document.getElementById("nsmSaving");
      if (el) { el.style.opacity = "0"; }
      return res === null ? null : res === true;
    } catch(e) { return false; }
  };
  window._loadPrefs = _loadPrefs;

  function _syncToggles() {
    NS_KEYS.forEach(k => {
      const inp = document.getElementById("nsPref_" + k);
      if (inp) inp.checked = _prefs[k] !== false;
    });
  }

  /* Public API */
  window.openNotifSettings = function() {
    document.getElementById("notifSettingsModal")?.classList.add("open");
    _loadPrefs(window.currentUser?.uid);
    _syncToggles();
  };
  window.closeNotifSettings = function() {
    document.getElementById("notifSettingsModal")?.classList.remove("open");
  };
  window.saveNotifPref = function(key, val) {
    _claimOwner();
    _prefs[key] = val;
    _markDirty([key]);
    _savePrefs();
  };
  window.notifSetAll = function(enable) {
    _claimOwner();
    NS_KEYS.forEach(k => { _prefs[k] = enable; });
    _markDirty(NS_KEYS);
    _syncToggles();
    _savePrefs();
  };

  /* Check if a notif type is allowed for the current user */
  window.isNotifAllowed = function(type) {
    if (!type) return true;
    return _prefs[type] !== false;
  };

  /* Load prefs when auth state changes */
  const _origStart = window._startNotifListener;
  if (typeof _origStart === "function") {
    window._startNotifListener = function(uid) {
      _loadPrefs(uid);
      return _origStart.apply(this, arguments);
    };
  }

  /* Patch showInAppNotif to respect prefs */
  const _origShow = window.showInAppNotif;
  if (typeof _origShow === "function") {
    window.showInAppNotif = function(title, body, data, onClick) {
      const type = window._ianTypeFromData ? window._ianTypeFromData(data) : "default";
      if (type !== "default" && !window.isNotifAllowed(type)) return;
      return _origShow.apply(this, arguments);
    };
  }
})();
