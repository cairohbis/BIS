/* ══════════════════════════════════════════
   js/firestore-safe.js — طبقة قراءة آمنة للعمل بدون إنترنت
   ══════════════════════════════════════════
   المشكلة: getDoc / getDocs الأصليين من Firebase بيحاولوا يوصلوا
   للسيرفر أولاً، ولو الجهاز أوفلاين (خصوصاً وقت فتح التطبيق من جديد
   وهو مقفول عليه فعلاً/TWA) بيفشلوا برسالة خطأ بدل ما يرجعوا فورًا
   للنسخة المخزّنة محليًا في الكاش (IndexedDB) — رغم إن الكاش
   (persistentLocalCache) مفعّل ومتوفر فيه البيانات فعلاً.
   النتيجة: محتوى بيختفي/يبقى غير مستقر وقت انقطاع النت.

   الحل: هذا الملف بيعيد تصدير (re-export) كل حاجة من firebase-firestore
   زي ما هي بالظبط، ما عدا getDoc و getDocs اللي بيستبدلهم بنسخة "آمنة":
   تحاول من السيرفر، ولو فشلت بترجع تلقائيًا للكاش المحلي بدل ما توقف.

   الاستخدام: بدّل مصدر الاستيراد من رابط فايربيز المباشر لهذا الملف —
   باقي الكود (doc/collection/query/...) هيفضل شغال زي ما هو بدون
   أي تعديل تاني.
══════════════════════════════════════════ */

export * from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getDoc as _rawGetDoc,
  getDocs as _rawGetDocs,
  getDocFromCache,
  getDocsFromCache
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export async function getDoc(ref) {
  try {
    return await _rawGetDoc(ref);
  } catch (e) {
    // فشل الوصول للسيرفر (غالبًا بسبب انقطاع النت) — نرجع للكاش المحلي
    try {
      return await getDocFromCache(ref);
    } catch (_e2) {
      throw e; // لا يوجد كاش أيضاً — نرفع الخطأ الأصلي
    }
  }
}

export async function getDocs(q) {
  try {
    return await _rawGetDocs(q);
  } catch (e) {
    try {
      return await getDocsFromCache(q);
    } catch (_e2) {
      throw e;
    }
  }
}
