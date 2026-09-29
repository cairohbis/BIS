/* ══════════════════════════════════════════
   js/notif-permission.js — نظام إذن الإشعارات (FCM)
   ══════════════════════════════════════════
   منقول بالكامل من index.html لملف منفصل. مسؤول عن:
   - طلب صلاحية الإشعارات مرة واحدة بس للأبد، بنافذة من تصميم
     التطبيق (window._appConfirm) بدل نافذة المتصفح الأصلية اللي
     مش بتوصل صح لنظام أندرويد جوه تطبيق TWA.
   - التحويل المباشر لصفحة إذن الإشعارات جوه إعدادات التطبيق
     لما المستخدم يوافق، بدل ما يدور عليها بنفسه.
   - إكمال تسجيل التوكن تلقائيًا وبهدوء لما المستخدم يرجع للتطبيق
     بعد ما يفعّل الإذن من الإعدادات (من غير أي نافذة إضافية).
   - عرض إشعار Foreground لما التطبيق يكون مفتوح فعلاً وقت وصول رسالة.

   الاستخدام من index.html:
     import { initFCM, showForegroundNotif, fcmSupported } from "./js/notif-permission.js";
     ...
     initFCM(user.uid, { app, db, getCurrentChatId: () => _currentChatId });
══════════════════════════════════════════ */

import { doc, getDoc, setDoc, serverTimestamp } from "./firestore-safe.js";

const FCM_VAPID       = "BI5GZ9V3E1csXJYTFQ56brgqfZFLRJl8VksaJWVRhzHKWz1xdZ8_pe1uVwPebJsKxx4Qsx1izurSPJVT_d4ESFw";
const ANDROID_PACKAGE = "com.bariq.app";

let _fcmMessaging       = null;
let _fcmToken           = null;
let _fcmPermAsked       = localStorage.getItem("_fcmPermAsked") || "default";
let _fcmSwReg           = null;
let _fcmModRef          = null;
let _fcmUidPending      = null;
let _fcmDb              = null;
let _getCurrentChatIdRef = null;

// ── فحص دعم المتصفح الكامل ──
export function fcmSupported() {
  try {
    return (
      typeof window !== "undefined" &&
      "Notification"  in window &&
      "serviceWorker" in navigator &&
      "PushManager"   in window &&
      "indexedDB"     in window &&
      !!window.indexedDB
    );
  } catch (e) { return false; }
}

// ── إشعار وقت ما التطبيق يكون مفتوح فعلاً (foreground) ──
export function showForegroundNotif(title, body, data) {
  if (!fcmSupported()) return;
  if (window.Notification && window.Notification.permission === "granted") {
    try {
      const n = new window.Notification(title, {
        body, icon: "/favicon.ico", dir: "rtl", lang: "ar",
        tag: (data && data.tag) ? data.tag : "uni-" + Date.now(),
        requireInteraction: false
      });
      setTimeout(() => n.close(), 5000);
    } catch (e) {}
  }
}

async function _registerFcmToken(uid, fcmMod, swReg) {
  try {
    const token = await fcmMod.getToken(_fcmMessaging, { vapidKey: FCM_VAPID, serviceWorkerRegistration: swReg });
    if (!token) return;
    _fcmToken = token;
    const tokRef = doc(_fcmDb, "users", uid, "private", "fcmToken");
    const snap   = await getDoc(tokRef);
    const saved  = snap.exists() ? snap.data().token : null;
    if (saved !== token) await setDoc(tokRef, { token, updatedAt: serverTimestamp() }).catch(() => {});
    fcmMod.onMessage(_fcmMessaging, (payload) => {
      const notif = payload.notification || {};
      const data  = payload.data || {};
      if (data.senderUid && data.senderUid === window.currentUser?.uid) return;
      const curChat = _getCurrentChatIdRef ? _getCurrentChatIdRef() : null;
      if (data.chatType === "private" && data.senderUid === curChat) return;
      showForegroundNotif(notif.title || "نظام الجامعة", notif.body || "", data);
    });
  } catch (e) { /* silently ignore token/registration failures */ }
}

/**
 * initFCM(uid, { app, db, getCurrentChatId })
 * - app:              الـ Firebase app instance (initializeApp)
 * - db:               الـ Firestore instance
 * - getCurrentChatId: دالة (اختيارية) بترجع آي دي الشات المفتوح حاليًا
 */
export async function initFCM(uid, { app, db, getCurrentChatId } = {}) {
  if (!uid) return;
  if (!fcmSupported()) return; // silently skip unsupported browsers
  _fcmDb = db;
  _getCurrentChatIdRef = getCurrentChatId || null;
  try {
    const _swBase = (function () {
      const p = location.pathname;
      const lastSlash = p.lastIndexOf("/");
      return lastSlash > 0 ? p.slice(0, lastSlash + 1) : "/";
    })();
    const _swPath = _swBase + "firebase-messaging-sw.js";
    const swReg  = await navigator.serviceWorker.register(_swPath, { scope: _swBase });
    const fcmMod = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js");
    _fcmMessaging  = fcmMod.getMessaging(app);
    _fcmSwReg      = swReg;
    _fcmModRef     = fcmMod;
    _fcmUidPending = uid;

    // ── لو الإذن ممنوح فعلاً (سواء من قبل أو دلوقتي) — نكمل تسجيل
    //    التوكن على طول من غير ما نزعج المستخدم بأي نافذة ──
    if (_fcmPermAsked === "granted" || (window.Notification && window.Notification.permission === "granted")) {
      _fcmPermAsked = "granted";
      localStorage.setItem("_fcmPermAsked", "granted");
      await _registerFcmToken(uid, fcmMod, swReg);
      return;
    }

    // ── اتسأل قبل كده ورفض صراحةً من نافذة الإذن نفسها — مانسألش تاني نهائيًا.
    //    (حالة "redirected" القديمة مش نهائية: كانت توقف المسار هنا من غير
    //    ما يتحقق الإذن فعليًا أبدًا، فبنسيبها تكمل تحت وتاخد فرصة حقيقية) ──
    if (_fcmPermAsked === "denied") return;

    // ── أول مرة بس: نافذة توضيحية بتصميم التطبيق (مش نافذة المتصفح
    //    الأصلية اللي مش بتوصل صح لنظام أندرويد جوه تطبيق TWA)، ولو
    //    وافق نستدعي إذن الإشعارات الحقيقي (Notification.requestPermission)
    //    أولاً — ده اللي فعليًا بيغيّر Notification.permission، والتحويل
    //    لإعدادات أندرويد كان ناقصها من الأساس ──
    if (_fcmPermAsked !== "redirected") {
      const agreed = await window._appConfirm(
        "تفعيل الإشعارات 🔔",
        "عشان توصلك الرسائل والتنبيهات الجديدة أول بأول، لازم تفعّل إذن الإشعارات. دوس \"تأكيد\" عشان تفعّله."
      );
      if (!agreed) return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      _fcmPermAsked = "granted";
      localStorage.setItem("_fcmPermAsked", "granted");
      await _registerFcmToken(uid, fcmMod, swReg);
      return;
    }
    if (permission === "denied") {
      _fcmPermAsked = "denied";
      localStorage.setItem("_fcmPermAsked", "denied");
      return;
    }

    // ── لسه "default" (المستخدم قفل نافذة الإذن من غير اختيار) — نفس
    //    التحويل الاحتياطي القديم لإعدادات التطبيق كخطوة إضافية ──
    _fcmPermAsked = "redirected";
    localStorage.setItem("_fcmPermAsked", "redirected");
    window.location.href =
      `intent:#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;S.android.provider.extra.APP_PACKAGE=${ANDROID_PACKAGE};end`;
  } catch (e) { /* silently ignore unsupported or SW-missing environments */ }
}

// ── لما المستخدم يرجع للتطبيق (بعد ما يفتح إعدادات أندرويد مثلاً) نتأكد
//    هل بقى الإذن ممنوح فعليًا، ولو أيوه نكمل تسجيل التوكن بهدوء من غير
//    ما نظهر أي نافذة تانية خالص ──
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (_fcmPermAsked === "granted") return;
  if (!window.Notification || window.Notification.permission !== "granted") return;
  _fcmPermAsked = "granted";
  localStorage.setItem("_fcmPermAsked", "granted");
  if (_fcmUidPending && _fcmModRef && _fcmSwReg) {
    _registerFcmToken(_fcmUidPending, _fcmModRef, _fcmSwReg);
  }
});
