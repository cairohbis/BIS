/* ══════════════════════════════════════════
   js/disclaimer-consent.js — تنبيه رسمي وإخلاء مسؤولية
   ══════════════════════════════════════════
   نظام مستقل بالكامل، لا يلمس كود تسجيل الدخول ولا أي نظام آخر.

   السلوك:
     - بعد تسجيل دخول أي مستخدم (قديم أو جديد، بغض النظر عن تاريخ إنشاء
       الحساب) يُفحص الحقل users/{uid}.disclaimerAcceptedAt
     - لو الحقل غير موجود → تظهر النافذة تلقائيًا
     - لو موجود → لا تظهر أبدًا
     - الخيار الوحيد "موافق": يكتب الحقل في Firestore (serverTimestamp)
       ولا تُغلق النافذة إلا بعد نجاح الكتابة
     - لا X، لا إغلاق، لا "لاحقًا"، النقر خارجها وEscape لا يفعلان شيئًا
     - لو أُغلق الموقع بدون موافقة → لا شيء يُكتب → تظهر عند الدخول التالي
     - لو تعذّر التحقق من السيرفر (أوفلاين) → لا تظهر الآن، وتظهر في أول
       دخول متصل
   ══════════════════════════════════════════ */
import { doc, getDoc, updateDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

(function () {
  "use strict";

  var FIELD = "disclaimerAcceptedAt";
  var SAVE_TIMEOUT_MS = 15000;

  var TITLE = "تنبيه رسمي وإخلاء مسؤولية";

  // النص حرفيًا — h اختياري (عنوان فرعي)، t هو نص الفقرة
  var BLOCKS = [
    { t: "هذا الموقع مشروع واجتهاد طلابي مستقل يهدف إلى تسهيل التواصل وتبادل المعلومات والموارد بين الطلاب، ولا يمثل إدارة المعهد أو أي جهة رسمية تابعة له، ولا يعمل تحت إشرافها أو بتكليف رسمي منها." },
    { t: "يوفر الموقع مساحة وأدوات مساندة للطلاب، وقد يتضمن محتوى أو معلومات مقدمة من المستخدمين، ولا تمثل بالضرورة رأي أو اعتماد إدارة المعهد." },
    { h: "وبخصوص نظام الحضور والغياب:",
      t: "فهو مجرد أداة شخصية لتنظيم وتسجيل أيام الحضور والغياب على هيئة تقويم، ولا يُعد سجلًا رسميًا أو معتمدًا من المعهد، ولا يمكن استخدامه كإثبات رسمي للحضور أو الغياب." },
    { h: "مسؤولية المستخدم:",
      t: "يتحمل المستخدم مسؤولية التحقق من صحة المعلومات التي يعتمد عليها، ومسؤولية أي بيانات أو محتوى يقوم بإدخاله أو نشره عبر الموقع، كما يلتزم باستخدام الموقع بصورة قانونية ومسؤولة، وعدم استخدامه بما يخالف الأنظمة أو حقوق الآخرين." },
    { t: "يُرجى الرجوع إلى المصادر والقنوات الرسمية للمعهد عند الحاجة إلى أي معلومات أو بيانات أو قرارات رسمية." },
    { t: "باستخدام الموقع، فإنك تقر بفهم طبيعته كمنصة طلابية مستقلة، وأن ما يقدمه من معلومات وأدوات مخصص للمساعدة والتنظيم والتواصل، وليس بديلًا عن الجهات أو السجلات الرسمية." }
  ];

  var _lastUid = null;        // آخر مستخدم تم التعامل معه (لاكتشاف تبديل الحساب)
  var _agreed = {};           // مستخدمون وافقوا في هذه الجلسة
  var _prevBodyOverflow = "";
  var _saving = false;

  function _overlayEl() { return document.getElementById("dcOverlay"); }

  // ── منع الإغلاق بـ Escape وإبقاء التركيز على زر "موافق" ──
  function _onKeyDown(e) {
    if (!_overlayEl()) return;
    if (e.key === "Escape" || e.key === "Esc") {
      e.preventDefault();
      e.stopImmediatePropagation();
    } else if (e.key === "Tab") {
      e.preventDefault();
      var b = document.getElementById("dcAgreeBtn");
      if (b && !b.disabled) b.focus();
    }
  }
  document.addEventListener("keydown", _onKeyDown, true);

  function _removeOverlay(immediate) {
    var ov = _overlayEl();
    if (!ov) return;
    document.body.style.overflow = _prevBodyOverflow;
    if (immediate) {
      _saving = false;
      ov.remove();
      return;
    }
    ov.id = ""; // يتحرر الـ id فورًا، والحذف الفعلي بعد انتهاء الـ fade
    ov.classList.remove("show");
    setTimeout(function () { ov.remove(); }, 260);
  }

  function _showError(msg) {
    var el = document.getElementById("dcError");
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? "block" : "none";
  }

  function _withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error("timeout")); }, ms);
      promise.then(function (v) { clearTimeout(t); resolve(v); },
                   function (e) { clearTimeout(t); reject(e); });
    });
  }

  async function _onAgree(uid) {
    if (_saving) return;
    var btn = document.getElementById("dcAgreeBtn");
    _saving = true;
    if (btn) { btn.disabled = true; btn.textContent = "جارٍ الحفظ..."; }
    _showError("");
    try {
      var payload = {};
      payload[FIELD] = serverTimestamp();
      await _withTimeout(updateDoc(doc(window.db, "users", uid), payload), SAVE_TIMEOUT_MS);
      _agreed[uid] = true;
      // لو المستخدم اتبدّل أثناء الحفظ، الفحص الدوري هو اللي يتولى النافذة
      if (window.currentUser && window.currentUser.uid === uid) _removeOverlay();
    } catch (err) {
      console.error("[Disclaimer] تعذّر حفظ الموافقة:", err);
      _showError("تعذّر حفظ الموافقة. تأكد من اتصالك بالإنترنت ثم اضغط «موافق» مرة أخرى.");
      if (btn) { btn.disabled = false; btn.textContent = "موافق"; }
    } finally {
      _saving = false;
    }
  }

  function _showOverlay(uid) {
    if (_overlayEl()) return;

    var ov = document.createElement("div");
    ov.id = "dcOverlay";
    ov.className = "dc-overlay";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-labelledby", "dcTitle");

    var card = document.createElement("div");
    card.className = "dc-card";
    card.setAttribute("dir", "rtl");

    var title = document.createElement("div");
    title.className = "dc-title";
    title.id = "dcTitle";
    title.textContent = TITLE;

    var body = document.createElement("div");
    body.className = "dc-body";
    body.id = "dcBody";
    body.tabIndex = 0;
    BLOCKS.forEach(function (b) {
      if (b.h) {
        var h = document.createElement("div");
        h.className = "dc-subtitle";
        h.textContent = b.h;
        body.appendChild(h);
      }
      var p = document.createElement("p");
      p.className = "dc-text";
      p.textContent = b.t;
      body.appendChild(p);
    });

    var footer = document.createElement("div");
    footer.className = "dc-footer";

    var err = document.createElement("div");
    err.className = "dc-error";
    err.id = "dcError";
    err.style.display = "none";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "dcAgreeBtn";
    btn.className = "dc-agree-btn";
    btn.textContent = "موافق";
    btn.addEventListener("click", function () { _onAgree(uid); });

    footer.appendChild(err);
    footer.appendChild(btn);
    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(footer);
    ov.appendChild(card);

    _prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.appendChild(ov);

    requestAnimationFrame(function () {
      ov.classList.add("show");
      try { btn.focus({ preventScroll: true }); } catch (e) { btn.focus(); }
    });
  }

  // ── فحص المستخدم: هل وافق أم لا؟ ──
  async function _evaluate(uid) {
    // مسار سريع: بيانات المستخدم اللي حمّلها index.html فيها الحقل → وافق
    var cd = window._currentUserData;
    if (cd && cd.uid === uid && cd[FIELD]) return;
    if (_agreed[uid]) return;

    // تأكيد من السيرفر (عشان مانعرضش النافذة بالغلط لو البيانات ناقصة)
    var snap;
    try {
      snap = await getDoc(doc(window.db, "users", uid));
    } catch (e) {
      console.warn("[Disclaimer] تعذّر التحقق من الموافقة الآن:", e);
      return;
    }
    if (snap.metadata && snap.metadata.fromCache) return; // مش بيانات مؤكدة من السيرفر
    if (!snap.exists()) return;
    if (snap.data()[FIELD]) return;

    // نتأكد إن المستخدم لسه هو نفسه بعد الانتظار
    if (!window.currentUser || window.currentUser.uid !== uid) return;
    _showOverlay(uid);
  }

  // ننتظر لحد ما index.html يخلّص تحميل بيانات نفس المستخدم، وبعدها نفحص
  function _waitThenEvaluate(uid) {
    var tries = 0;
    (function poll() {
      if (_lastUid !== uid) return; // المستخدم اتغيّر أو خرج
      var cd = window._currentUserData;
      if (window.db && cd && cd.uid === uid) { _evaluate(uid); return; }
      if (++tries > 50) return;     // ~15 ثانية، وبعدها نكتفي بدخول لاحق
      setTimeout(poll, 300);
    })();
  }

  // فحص دوري خفيف لاكتشاف تسجيل الدخول/الخروج/تبديل الحساب
  setInterval(function () {
    var uid = (window.currentUser && window.currentUser.uid) || null;
    if (uid === _lastUid) return;
    _lastUid = uid;
    _removeOverlay(true); // أي نافذة ظاهرة تخص مستخدم سابق تُزال فورًا
    if (uid) _waitThenEvaluate(uid);
  }, 1000);
})();
