/* ==========================================================================
   ربط واجهة الدخول الجديدة (js/auth-ui.js) مع Firebase — ملف مستقل
   يعرّف دوال window.AuthBridge التي تستدعيها الواجهة:
     loginEmail · google · sendEmailLink · resendEmailLink · checkEmailVerified
     saveProfile · signOut · onDone · needsProfile
   ويعرّف window._authHold(user) الذي يستخدمه onAuthStateChanged في index.html
   كي لا يفتح الموقع قبل ما تكتمل خطوات الدخول/التسجيل/تأكيد البريد.

   لا يغيّر أي شكل: كل الرسائل تظهر عبر نفس عناصر الواجهة.
   إنشاء وثيقة المستخدم يتم بنفس الدالة القديمة (window._bisAuthCore.createUserProfile).
   ========================================================================== */
import { getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut, GoogleAuthProvider, signInWithPopup,
  verifyPasswordResetCode, confirmPasswordReset, applyActionCode
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const UI_KEY = "bis_auth_ui";               // نفس مفتاح حالة الواجهة (js/auth-ui.js)
const core  = () => window._bisAuthCore;    // يعرّفه index.html
const auth  = () => (core() && core().auth) || getAuth(getApp());

/* ── "قيد التنفيذ": يبقى true بعد نجاح الدخول/التسجيل حتى يضغط المستخدم "الدخول إلى الموقع"
      (فيُعاد تحميل الصفحة)، ويرجع false عند أي فشل أو تسجيل خروج ── */
let busy = false;

/* فتح الصفحة من رابط في رسالة Firebase (?mode=resetPassword أو verifyEmail مع oobCode):
   نمنع فتح الموقع (حتى لو كانت هناك جلسة محفوظة) إلى أن تنتهي خطوات الرابط */
let resetHold = (() => {
  try { const q = new URLSearchParams(location.search); return (q.get("mode") === "resetPassword" || q.get("mode") === "verifyEmail") && !!q.get("oobCode"); }
  catch (e) { return false; }
})();

function verifyPending() {
  try { const s = JSON.parse(localStorage.getItem(UI_KEY) || "null"); return !!(s && s.pending); }
  catch (e) { return false; }
}
function isPasswordUser(u) { return !!u && (u.providerData || []).some(p => p.providerId === "password"); }

/* يُستدعى من onAuthStateChanged: true = لا تفتح الموقع الآن */
window._authHold = (user) =>
  busy || resetHold || (!!user && verifyPending() && isPasswordUser(user) && !user.emailVerified);

/* ── رسائل الأخطاء (نفس صياغة الموقع القديم + رسائل Google/التحقق) ── */
const ERR = {
  "auth/invalid-credential":   "بريد أو كلمة مرور غلط",
  "auth/user-not-found":       "الحساب غير موجود",
  "auth/wrong-password":       "كلمة المرور غلط",
  "auth/too-many-requests":    "محاولات كثيرة — انتظر قليلاً",
  "auth/email-already-in-use": "البريد الإلكتروني مستخدم من قبل",
  "auth/invalid-email":        "تنسيق البريد الإلكتروني غلط",
  "auth/weak-password":        "كلمة المرور ضعيفة",
  "auth/network-request-failed": "تعذّر الاتصال بالإنترنت، تأكد من الشبكة وحاول تاني",
  "auth/popup-blocked":        "المتصفح منع نافذة Google، اسمح بالنوافذ المنبثقة وحاول تاني",
  "auth/operation-not-allowed": "هذه الطريقة غير مفعّلة حاليًا",
  "auth/unauthorized-domain":  "هذا الرابط غير مسموح له بتسجيل الدخول بـ Google",
  "auth/user-disabled":        "تم إيقاف هذا الحساب — تواصل مع الإدارة",
  "auth/expired-action-code":  "انتهت صلاحية الرابط، اطلب رابطًا جديدًا",
  "auth/invalid-action-code":  "الرابط غير صالح أو تم استخدامه من قبل، اطلب رابطًا جديدًا"
};
const CANCELLED = ["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"];
const errMsg = (e) => ERR[e && e.code] || (e && e.message) || "حدث خطأ، حاول مرة أخرى.";

const NEED_VERIFY = "حسابك لم يُفعَّل بعد. أرسلنا رابط التأكيد إلى بريدك، افتحه ثم سجّل الدخول.";
const SESSION_GONE = "انتهت الجلسة، سجّل الدخول من جديد.";

/* ── تحويل بيانات الواجهة {name, gender, dept, year} إلى بيانات الموقع {name, gender, worldId} ── */
function toSite(p) {
  p = p || {};
  const worldId = (p.dept && p.year) ? `${p.dept}_${p.year}` : "";
  return { name: String(p.name || "").trim(), gender: p.gender, worldId };
}
function validSite(s) {
  if (!s.name) return "اكتب اسم المستخدم.";
  if (s.gender !== "male" && s.gender !== "female") return "اختر نوع الحساب.";
  if (!s.worldId || typeof window.isValidWorldId !== "function" || !window.isValidWorldId(s.worldId)) return "اختر الشعبة والفرقة.";
  return null;
}
function toUi(d) {
  d = d || {};
  const [dept, year] = String(d.worldId || "").split("_");
  return { name: d.name || "", gender: d.gender, dept: dept || "", year: year || "", terms: true };
}

async function userDoc(uid) {
  const snap = await getDoc(doc(window.db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

/* ينشئ وثيقة المستخدم إن لم تكن موجودة (لا يكتب فوق وثيقة قائمة أبدًا) */
async function ensureProfile(user, site) {
  const existing = await userDoc(user.uid);
  if (existing) return existing;
  await core().createUserProfile(user, site);
  core().clearPendingProfile();
  return await userDoc(user.uid);
}

/* بعد نجاح تسجيل الدخول (بريد أو Google): هل للحساب بيانات؟ */
async function afterSignIn(user, draft) {
  const data = await userDoc(user.uid);
  if (data) {
    if (data.isBanned) {
      await signOut(auth()); busy = false;
      return { status: "error", message: "تم حظر حسابك — تواصل مع الإدارة" };
    }
    return { status: "ok", profile: toUi(data) };
  }
  /* لا توجد وثيقة: بريد غير مؤكَّد = تسجيل لم يكتمل تأكيده */
  if (isPasswordUser(user) && !user.emailVerified) {
    try { await sendEmailVerification(user); } catch (e) {}
    await signOut(auth()); busy = false;
    return { status: "error", message: NEED_VERIFY };
  }
  /* تسجيل جديد بـ Google من شاشة إنشاء الحساب: نستخدم البيانات المكتوبة */
  if (draft) {
    const site = toSite(draft), bad = validSite(site);
    if (bad) { await signOut(auth()); busy = false; return { status: "error", message: bad }; }
    const created = await ensureProfile(user, site);
    return { status: "ok", profile: toUi(created) };
  }
  /* تسجيل قديم انقطع في نفس المتصفح: نكمّله تلقائيًا */
  const pending = core().readPendingProfile(user.email);
  if (pending) {
    const created = await ensureProfile(user, pending);
    return { status: "ok", profile: toUi(created) };
  }
  return { status: "incomplete", profile: { name: user.displayName || "" } };
}

const B = (window.AuthBridge = window.AuthBridge || {});

B.loginEmail = async function ({ email, password }) {
  busy = true;
  try {
    const cred = await signInWithEmailAndPassword(auth(), email, password);
    return await afterSignIn(cred.user, null);
  } catch (e) { busy = false; return { status: "error", message: errMsg(e) }; }
};

B.google = async function (draft) {
  busy = true;
  try {
    const cred = await signInWithPopup(auth(), new GoogleAuthProvider());
    /* من شاشة إنشاء الحساب: حساب Google مسجّل مسبقًا = رفض (نافذة «الحساب مسجّل بالفعل») */
    if (draft && await userDoc(cred.user.uid)) { await signOut(auth()); busy = false; return { status: "exists" }; }
    return await afterSignIn(cred.user, draft || null);
  } catch (e) {
    busy = false;
    if (CANCELLED.indexOf(e && e.code) !== -1) return { status: "cancelled" };
    return { status: "error", message: errMsg(e) };
  }
};

B.sendEmailLink = async function ({ email, password, profile }) {
  const site = toSite(profile), bad = validSite(site);
  if (bad) return { status: "error", message: bad };
  busy = true;
  try {
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth(), email, password);
    } catch (e) {
      if (e.code !== "auth/email-already-in-use") throw e;
      /* حساب يتيم من محاولة سابقة (كلمة المرور صحيحة ولا توجد وثيقة): نكمل عليه */
      let existing;
      try { existing = await signInWithEmailAndPassword(auth(), email, password); }
      catch (_) { busy = false; return { status: "exists" }; }
      if (await userDoc(existing.user.uid)) { await signOut(auth()); busy = false; return { status: "exists" }; }
      cred = existing;
    }
    core().savePendingProfile(email, site);   /* نحفظ البيانات لحين تأكيد البريد */
    if (!cred.user.emailVerified) await sendEmailVerification(cred.user);
    return { status: "sent" };
  } catch (e) { busy = false; return { status: "error", message: errMsg(e) }; }
};

/* نسيت كلمة المرور: Firebase يرسل رابط إعادة الضبط للبريد.
   لا نكشف إن كان البريد مسجّلًا أم لا (نفس الرد دائمًا) لمنع تخمين الحسابات. */
B.resetPassword = async function ({ email }) {
  try { await sendPasswordResetEmail(auth(), email); return { status: "sent" }; }
  catch (e) {
    if (e && (e.code === "auth/user-not-found" || e.code === "auth/invalid-credential")) return { status: "sent" };
    return { status: "error", message: errMsg(e) };
  }
};

/* استعادة كلمة المرور داخل الموقع: الرابط المرسل يفتح الموقع ومعه oobCode */
B.checkResetCode = async function ({ code }) {
  try { const email = await verifyPasswordResetCode(auth(), code); return { status: "ok", email }; }
  catch (e) { return { status: "error", message: errMsg(e) }; }
};
B.confirmReset = async function ({ code, password }) {
  try { await confirmPasswordReset(auth(), code, password); return { status: "ok" }; }
  catch (e) {
    if (e && (e.code === "auth/expired-action-code" || e.code === "auth/invalid-action-code")) return { status: "expired", message: errMsg(e) };
    return { status: "error", message: errMsg(e) };
  }
};
/* تأكيد البريد من رابط الرسالة (بعد ضبط Custom action URL ليشير للموقع) */
B.applyVerify = async function ({ code }) {
  try { await applyActionCode(auth(), code); return { status: "ok" }; }
  catch (e) { return { status: "error", message: errMsg(e) }; }
};
/* نهاية الاستعادة: نرفع الحجز ونُنهي أي جلسة قديمة ليكون الدخول بعدها طبيعيًا */
B.endReset = async function () {
  resetHold = false;
  try { if (auth().currentUser) await signOut(auth()); } catch (e) {}
};

B.resendEmailLink = async function () {
  const u = auth().currentUser;
  if (!u) return { status: "error", message: SESSION_GONE };
  try { await sendEmailVerification(u); return { status: "sent" }; }
  catch (e) { return { status: "error", message: errMsg(e) }; }
};

B.checkEmailVerified = async function () {
  const u = auth().currentUser;
  if (!u) return { status: "error", message: SESSION_GONE };
  try {
    await u.reload();
    if (!u.emailVerified) return { status: "pending" };
    const existing = await userDoc(u.uid);
    if (existing) return { status: "verified", profile: toUi(existing) };
    const pending = core().readPendingProfile(u.email);
    if (!pending) return { status: "incomplete", profile: { name: u.displayName || "" } };
    const created = await ensureProfile(u, pending);
    return { status: "verified", profile: toUi(created) };
  } catch (e) { return { status: "error", message: errMsg(e) }; }
};

B.saveProfile = async function (profile) {
  const u = auth().currentUser;
  if (!u) return { status: "error", message: SESSION_GONE };
  const site = toSite(profile), bad = validSite(site);
  if (bad) return { status: "error", message: bad };
  try { await ensureProfile(u, site); return { status: "ok" }; }
  catch (e) { return { status: "error", message: "تعذّر حفظ بياناتك، تأكد من الاتصال وحاول تاني" }; }
};

B.signOut = async function () {
  busy = false;
  try { core().clearPendingProfile(); } catch (e) {}
  try { await signOut(auth()); } catch (e) {}
};

/* زر "الدخول إلى الموقع": إعادة تحميل الصفحة ليكمل onAuthStateChanged بشكل طبيعي */
B.onDone = function () { busy = false; window.location.reload(); };

/* حساب موجود بدون وثيقة بيانات (يستدعيه onAuthStateChanged): افتح شاشة إكمال البيانات */
B.needsProfile = function (user) {
  busy = true;
  if (window.AuthUI && window.AuthUI.complete) window.AuthUI.complete({ name: (user && user.displayName) || "" });
};

/* الواجهة تنتظر هذا الإشعار قبل أول استدعاء (حتى لو ضغط المستخدم بسرعة) */
if (typeof window.__resolveAuthBridge === "function") window.__resolveAuthBridge();
