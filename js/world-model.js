/* ══════════════════════════════════════════════════════════════
   js/world-model.js — نموذج الـ16 عالمًا (World Model)
   ▸ Phase 1 — خطوة 1 فقط: تعريف + دوال قراءة، بدون أي تغيير في
     سلوك الموقع الحالي. الملف ده لسه مش مستخدم من أي كود تاني.
   ▸ لا يكتب أي بيانات على Firebase إطلاقًا.
   ▸ لا يغيّر أي Read أو Write موجود.
   ▸ مفيش أي مستخدم حاليًا عنده حقل worldId (لغاية الـBackfill
     اللي هيتم في خطوة منفصلة لاحقًا) — currentUserWorldId() هترجع
     null لكل المستخدمين دلوقتي، وده متوقّع وطبيعي في هذه المرحلة.
   ══════════════════════════════════════════════════════════════ */

// ── قائمة الـ16 عالم الثابتة (شعبة × فرقة) ──
const WORLDS = Object.freeze([
  "is_1", "is_2", "is_3", "is_4",   // نظم المعلومات
  "lt_1", "lt_2", "lt_3", "lt_4",   // اللغات والترجمة
  "th_1", "th_2", "th_3", "th_4",   // سياحة وفنادق
  "ba_1", "ba_2", "ba_3", "ba_4",   // علوم إدارية
]);

// ── تحقق: هل القيمة دي worldId صحيح ضمن الـ16؟ ──
function isValidWorldId(worldId) {
  return WORLDS.includes(worldId);
}

// ── عالم المستخدم الحالي (من بيانات المستخدم المحمّلة بالفعل بالذاكرة) ──
// بيقرأ من window._currentUserData (نفس المتغيّر اللي بيتحمّل فيه
// مستند users/{uid} حاليًا عند تسجيل الدخول — index.html)، بدون أي
// طلب Firestore إضافي وبدون أي تعديل على المتغيّر ده نفسه.
function currentUserWorldId() {
  const w = window._currentUserData?.worldId;
  return isValidWorldId(w) ? w : null;
}

// ── هل المستخدم الحالي Owner؟ (بالاعتماد على window.isOwner()
//    الموجودة بالفعل في index.html — بدون تكرار منطقها هنا) ──
function _isOwnerNow() {
  return !!(window.isOwner && window.isOwner());
}

// ── السياق الفعلي للعالم اللي إحنا "شغالين" بيه دلوقتي ──
// - Owner: مفروض يرجع activeWorld (سياق واجهة فقط) — لسه العلم ده
//   مش متفعّل في هذه الخطوة، فبترجع null لحد ما يتضاف window._activeWorld
//   في خطوة منفصلة لاحقًا (بموافقة صريحة).
// - أي حد تاني: عالمه الشخصي الثابت (worldId بتاعه).
// ⚠️ الدالة دي مصدر موحّد للقراءة فقط — لسه مفيش أي كود بينادي عليها.
function activeWorldContext() {
  if (_isOwnerNow()) {
    return isValidWorldId(window._activeWorld) ? window._activeWorld : null;
  }
  return currentUserWorldId();
}

// ── تصدير على window — بنفس نمط باقي ملفات المشروع
//    (زي window.chatColPath في js/chat-core.js) ──
window.WORLDS             = WORLDS;
window.isValidWorldId     = isValidWorldId;
window.currentUserWorldId = currentUserWorldId;
window.activeWorldContext = activeWorldContext;
