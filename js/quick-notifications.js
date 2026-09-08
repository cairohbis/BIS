/* ══════════════════════════════════════════
   js/quick-notifications.js — نظام الإخطار السريع
   ══════════════════════════════════════════
   نظام مستقل بالكامل عن نظام الأخبار (news):
     • مجموعة Firestore: quickNotifications/{id}
         { title, body, mascotImage, createdAt, active }
     • حالة كل مستخدم: users/{uid}/quickNotificationStates/{id}
         { dismissed: true }  ← لو موجودة، مايتعرضش تاني خالص
         (عدم وجود المستند = لسه معلّق/"ذكرني" = لازم يتعرض)

   السلوك:
     - Online: onSnapshot بيمسك أي إخطار جديد فورًا وهو المستخدم فاتح الموقع
     - Offline: أول تحميل للصفحة، الفحص الأول بيجيب كل الإخطارات النشطة
       ويعرض أي واحد لسه مش "dismissed" لهذا المستخدم
     - "ذكرني": يقفل النافذة بس من غير ما يسجل حاجة → هيظهر تاني المرة الجاية
     - "إخفاء": يسجل dismissed:true → مايتعرضش تاني أبدًا
   ══════════════════════════════════════════ */
import {
  collection, query, orderBy, limit, onSnapshot,
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
    var dismissed = await _isDismissed(uid, docSnap.id);
    if (dismissed) return;
    _enqueue({ id: docSnap.id, title: d.title, body: d.body, mascotImage: d.mascotImage });
  }

  function _startListening() {
    try {
      var q = query(collection(window.db, "quickNotifications"), orderBy("createdAt", "desc"), limit(10));
      onSnapshot(q, function (snap) {
        snap.docChanges().forEach(function (change) {
          if (change.type === "added" || change.type === "modified") {
            _checkNotification(change.doc);
          }
        });
      });
    } catch (e) {
      console.error("[QuickNotif] تعذّر بدء الاستماع:", e);
    }
  }

  // نبدأ الاستماع بس بعد ما يكون فيه مستخدم مسجّل دخول (currentUser بيتظبط
  // بعد onAuthStateChanged في index.html) — نستنى شوية ونتأكد
  function _waitForUserThenStart() {
    if (window.currentUser && window.db) {
      _startListening();
    } else {
      setTimeout(_waitForUserThenStart, 400);
    }
  }
  _waitForUserThenStart();

  // ────────────────────────────────────────────
  // دالة النشر — بتتنادى من لوحة الأونر/الأدمن
  // ────────────────────────────────────────────
  window.qnPublish = async function (title, body) {
    if (!title || !title.trim()) { window.toast && window.toast("اكتب عنوان الإخطار", "error"); return; }
    try {
      await addDoc(collection(window.db, "quickNotifications"), {
        title: title.trim(),
        body: (body || "").trim(),
        active: true,
        createdAt: serverTimestamp()
      });
      window.toast && window.toast("تم نشر الإخطار للجميع", "success");
    } catch (e) {
      console.error("[QuickNotif] فشل النشر:", e);
      window.toast && window.toast("فشل نشر الإخطار", "error");
    }
  };
})();
