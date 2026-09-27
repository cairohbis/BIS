/* ══════════════════════════════════════════
   js/quick-notifications.js — نظام الإخطار السريع
   ══════════════════════════════════════════
   نظام مستقل بالكامل عن نظام الأخبار (news):
     • مجموعة Firestore: quickNotifications/{id}
         World-scoped:  { title, body, mascotImage, createdAt, active, worldId }
         Global (جديد): { title, body, mascotImage, createdAt, active, audience: "global" }
         قديم (قبل هذا التعديل، بلا worldId وبلا audience): يبقى Global كما كان،
         لكنه لم يعد يصل عبر الاستماع الحي الجديد (انظر تقرير التنفيذ — Firestore
         لا يمكنها استعلام "حقل غير موجود" بدون Migration؛ القراءة المباشرة بالـID
         لا تزال تعمل له عبر الـRule فقط).
     • حالة كل مستخدم: users/{uid}/quickNotificationStates/{id}
         { dismissed: true }  ← لو موجودة، مايتعرضش تاني خالص
         (عدم وجود المستند = لسه معلّق/"ذكرني" = لازم يتعرض)

   السلوك:
     - Online: onSnapshot (استماعان منفصلان: World + Global) بيمسك أي إخطار
       جديد فورًا وهو المستخدم فاتح الموقع، ومقيّد فعليًا على مستوى الـQuery
       نفسه (where) بحيث لا يصل مستند عالم آخر إطلاقًا من Firestore.
     - "ذكرني": يقفل النافذة بس من غير ما يسجل حاجة → هيظهر تاني المرة الجاية
     - "إخفاء": يسجل dismissed:true → مايتعرضش تاني أبدًا
   ══════════════════════════════════════════ */
import {
  collection, query, where, orderBy, limit, onSnapshot,
  doc, getDoc, setDoc, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

(function () {
  "use strict";

  // صورة بريق ثابتة لكل الإخطارات — مش بتتغيّر من إخطار للتاني، عشان
  // الشكل يفضل موحّد دايمًا (نفس التصميم في كل مرة)
  var FIXED_MASCOT_IMAGE = "images/mascot/actions/bell-ring.webp";

  var _queue = [];        // إخطارات لسه منتظرة تتعرض للمستخدم الحالي
  var _showing = false;   // فيه نافذة معروضة دلوقتي؟
  var _seenIds = {};      // منع تكرار نفس الإخطار في نفس الجلسة
  var _unsubWorld  = null; // اشتراك onSnapshot الخاص بإخطارات عالم المستخدم فقط
  var _unsubGlobal = null; // اشتراك onSnapshot الخاص بالإخطارات العامة (audience=="global") فقط
  var _listening   = false; // true بين qnStartListening وqnStopListening — يمنع أي محاولة بدء بعد إيقاف صريح
  var _worldRetryTries = 0; // عدّاد محاولات محدود لبدء استماع العالم لو currentUserWorldId() لسه null (فجوة توقيت بعد Login)

  function _qnRef(id) {
    return doc(window.db, "quickNotifications", id);
  }
  function _qnStateRef(uid, id) {
    return doc(window.db, "users", uid, "quickNotificationStates", id);
  }

  async function _isDismissed(uid, id) {
    try {
      var snap = await getDoc(_qnStateRef(uid, id));
      return snap.exists() && snap.data().dismissed === true;
    } catch (e) {
      console.error("[QuickNotif] تعذّر فحص الحالة:", e);
      return false; // في حالة الشك، نعرض بدل ما نخفي بالغلط
    }
  }

  function _buildOverlay() {
    var existing = document.getElementById("qnOverlay");
    if (existing) return existing;
    var overlay = document.createElement("div");
    overlay.id = "qnOverlay";
    overlay.className = "qn-overlay";
    overlay.innerHTML =
      '<div class="qn-card">' +
        '<button class="qn-close-btn" id="qnCloseBtn"><i class="fa-solid fa-xmark"></i></button>' +
        '<div class="qn-mascot-slot" id="qnMascotSlot"></div>' +
        '<div class="qn-title" id="qnTitle"></div>' +
        '<div class="qn-body" id="qnBody"></div>' +
        '<div class="qn-actions">' +
          '<button class="qn-btn qn-btn-dismiss" id="qnDismissBtn"><i class="fa-solid fa-eye-slash"></i> إخفاء</button>' +
          '<button class="qn-btn qn-btn-remind" id="qnRemindBtn"><i class="fa-solid fa-bell"></i> ذكرني</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function _showNext() {
    if (_showing) return;
    var item = _queue.shift();
    if (!item) return;
    _showing = true;

    var overlay = _buildOverlay();
    document.getElementById("qnTitle").textContent = item.title || "";
    document.getElementById("qnBody").textContent = item.body || "";

    var slot = document.getElementById("qnMascotSlot");
    slot.innerHTML = "";
    var img = document.createElement("img");
    img.src = FIXED_MASCOT_IMAGE;
    img.alt = "بريق";
    slot.appendChild(img);

    requestAnimationFrame(function () { overlay.classList.add("show"); });

    function close() {
      overlay.classList.remove("show");
      _showing = false;
      setTimeout(_showNext, 260); // نعرض اللي بعده لو فيه أكتر من إخطار معلّق
    }

    document.getElementById("qnCloseBtn").onclick = close; // زي "ذكرني" بالظبط
    document.getElementById("qnRemindBtn").onclick = close;

    document.getElementById("qnDismissBtn").onclick = async function () {
      var confirmed = true;
      if (window._appConfirm) {
        confirmed = await window._appConfirm(
          "إخفاء الإخطار نهائيًا",
          "لن يظهر لك هذا الإخطار مرة أخرى أبدًا. متأكد؟"
        );
      }
      if (!confirmed) return;
      try {
        var uid = window.currentUser && window.currentUser.uid;
        if (uid) {
          await setDoc(_qnStateRef(uid, item.id), {
            dismissed: true,
            dismissedAt: serverTimestamp()
          });
        }
      } catch (e) {
        console.error("[QuickNotif] تعذّر حفظ حالة الإخفاء:", e);
      }
      close();
    };
  }

  function _enqueue(item) {
    if (_seenIds[item.id]) return;
    _seenIds[item.id] = true;
    _queue.push(item);
    _showNext();
  }

  async function _checkNotification(docSnap) {
    var uid = window.currentUser && window.currentUser.uid;
    if (!uid) return; // لسه المستخدم مش عامل تسجيل دخول
    var d = docSnap.data();
    if (d.active === false) return;
    // ✅ Admin Isolation: إخطار قديم/عام (بلا worldId) يصل للجميع كما كان تمامًا —
    // بدون Migration ولا تعديل. إخطار مربوط بعالم يصل فقط لمستخدمي نفس العالم.
    if (d.worldId) {
      var _myWorld = (typeof window.currentUserWorldId === "function") ? window.currentUserWorldId() : null;
      if (d.worldId !== _myWorld) return;
    }
    var _uca = window._currentUserData && window._currentUserData.createdAt;
    var userMs = _uca && _uca.toMillis ? _uca.toMillis()
      : (window.currentUser.metadata && window.currentUser.metadata.creationTime
          ? new Date(window.currentUser.metadata.creationTime).getTime() : 0);
    var notifMs = d.createdAt && d.createdAt.toMillis ? d.createdAt.toMillis() : 0;
    if (userMs && notifMs && notifMs < userMs) return;
    var dismissed = await _isDismissed(uid, docSnap.id);
    if (dismissed) return;
    _enqueue({ id: docSnap.id, title: d.title, body: d.body, mascotImage: d.mascotImage });
  }

  function _attachSnapshot(q) {
    return onSnapshot(q, function (snap) {
      snap.docChanges().forEach(function (change) {
        if (change.type === "added" || change.type === "modified") {
          _checkNotification(change.doc);
        }
      });
    }, function (err) {
      console.error("[QuickNotif] خطأ في الاستماع:", err);
    });
  }

  // ✅ World Isolation حقيقي على مستوى Firestore: الاستعلام نفسه مقيّد بـ
  // where("worldId","==", myWorld) — لا يوجد شكل من أشكال الكود يمكن أن
  // يطلب أو يستلم مستند عالم آخر، والـRule ترفض أي محاولة مخالفة من الأساس.
  // تُنفَّذ بإعادة محاولة محدودة فقط لأن currentUserWorldId() قد يرجع null
  // لحظيًا بعد Login (قبل اكتمال تحميل window._currentUserData) — وهذا ليس
  // polling عام لبدء الوحدة (ذاك أُلغي سابقًا)، بل حارس ضيّق ضد فقدان إشعار
  // عالم صحيح بسبب هذه الفجوة الزمنية المعروفة فقط.
  function _tryAttachWorldListener() {
    if (!_listening || _unsubWorld) return;
    var worldId = (typeof window.currentUserWorldId === "function") ? window.currentUserWorldId() : null;
    if (!worldId) {
      if (_worldRetryTries++ < 15) setTimeout(_tryAttachWorldListener, 400);
      return;
    }
    try {
      var qWorld = query(collection(window.db, "quickNotifications"),
        where("worldId", "==", worldId), orderBy("createdAt", "desc"), limit(10));
      _unsubWorld = _attachSnapshot(qWorld);
    } catch (e) {
      console.error("[QuickNotif] تعذّر بدء استماع العالم:", e);
    }
  }

  // ✅ Lifecycle: يمنع أكثر من listener شغال في نفس الوقت (Logout بدون
  // إيقاف صريح، أو استدعاء متكرر) — ولا يبدأ إلا لو فيه مستخدم مسجّل
  // دخول فعليًا وwindow.db متاح، حتى لا يبدأ باكر جدًا.
  function _startListening() {
    if (_listening) return; // شغّال بالفعل — لا تنشئ نسخة تانية
    if (!window.currentUser || !window.db) return;
    _listening = true;
    _worldRetryTries = 0;
    try {
      // ✅ استماع الإخطارات العامة — مقيّد بـ where(audience=="global")،
      // مقتصر على الإخطارات الجديدة الموسومة صراحةً (انظر qnPublish).
      var qGlobal = query(collection(window.db, "quickNotifications"),
        where("audience", "==", "global"), orderBy("createdAt", "desc"), limit(10));
      _unsubGlobal = _attachSnapshot(qGlobal);
    } catch (e) {
      console.error("[QuickNotif] تعذّر بدء استماع Global:", e);
    }
    _tryAttachWorldListener();
  }

  // ✅ يوقف كلا الاشتراكين (إن وُجدا) ويصفّر كل المراجع — يُستدعى عند
  // Logout قبل إبطال الجلسة، لمنع "Missing or insufficient permissions"
  // على listener قديم بعد تسجيل الخروج. تصفير _listening يمنع أيضًا أي
  // محاولة retry معلّقة من _tryAttachWorldListener من إنشاء اشتراك متأخر.
  function _stopListening() {
    _listening = false;
    if (typeof _unsubWorld === "function") { try { _unsubWorld(); } catch (e) {} }
    if (typeof _unsubGlobal === "function") { try { _unsubGlobal(); } catch (e) {} }
    _unsubWorld = null;
    _unsubGlobal = null;
  }

  // ✅ تُستدعى من نقطة الـAuth المركزية في index.html (onAuthStateChanged)
  // بدل الاعتماد على polling داخلي — بدء عند تسجيل الدخول، إيقاف عند الخروج.
  window.qnStartListening = _startListening;
  window.qnStopListening  = _stopListening;

  // ────────────────────────────────────────────
  // دالة النشر — بتتنادى من لوحة الأونر/الأدمن
  // ────────────────────────────────────────────
  window.qnPublish = async function (title, body) {
    if (!title || !title.trim()) { window.toast && window.toast("اكتب عنوان الإخطار", "error"); return; }
    // ✅ Admin Isolation + World Isolation: كل إخطار جديد له Audience صريح
    // واحد فقط — الأونر ينشر audience:"global" (يصل للجميع فعليًا عبر
    // Firestore Rule)، والأدمن العادي يُختم إخطاره بـworldId عالمه النشط
    // فقط (لا يُسمح له بالنشر بدون عالم صالح)، ولا تُنشأ أي وثيقة بدون
    // أحد الحقلين — هذا هو ما يجعل عزل الاستماع لاحقًا مضمونًا.
    var _isOwnerNow = !!(window.isOwner && window.isOwner());
    var _payload = {
      title: title.trim(),
      body: (body || "").trim(),
      active: true,
      createdAt: serverTimestamp()
    };
    if (_isOwnerNow) {
      _payload.audience = "global";
    } else {
      var _worldId = (typeof window.activeWorldContext === "function") ? window.activeWorldContext() : null;
      if (!_worldId) { window.toast && window.toast("لا يوجد عالم نشط حاليًا — لا يمكن نشر الإخطار", "error"); return; }
      _payload.worldId = _worldId;
    }
    try {
      await addDoc(collection(window.db, "quickNotifications"), _payload);
      window.toast && window.toast("تم نشر الإخطار للجميع", "success");
    } catch (e) {
      console.error("[QuickNotif] فشل النشر:", e);
      window.toast && window.toast("فشل نشر الإخطار", "error");
    }
  };
})();
