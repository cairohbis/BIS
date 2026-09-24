// يجيب حسابات Firebase Auth اللي مالهاش وثيقة في users/{uid} على Firestore.
// الافتراضي: عرض فقط (Dry-run). الحذف بيحتاج --delete صريحة.
//
// التشغيل:
//   npm i firebase-admin
//   export GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
//   node cleanup-orphan-accounts.js                       # عرض فقط
//   node cleanup-orphan-accounts.js --delete --days=7     # حذف اليتيمة الأقدم من 7 أيام
//
// ملحوظة: مش بنحذف حسابات أحدث من --days عشان ناس ممكن تكون لسه بتسجّل دلوقتي،
// وبعد التعديل الجديد أي حساب يتيم بيتكمّل تلقائي عند أول دخول.

const admin = require("firebase-admin");
admin.initializeApp();

const OWNER_UID = "dKTc7vqFNGO7vqamubap5dKnn7z1";
const doDelete  = process.argv.includes("--delete");
const days      = Number((process.argv.find(a => a.startsWith("--days=")) || "--days=7").split("=")[1]);
const cutoff    = Date.now() - days * 864e5;

(async () => {
  const db = admin.firestore();
  const orphans = [];
  let pageToken, total = 0;

  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    total += page.users.length;
    const refs  = page.users.map(u => db.doc(`users/${u.uid}`));
    const snaps = refs.length ? await db.getAll(...refs) : [];
    page.users.forEach((u, i) => { if (!snaps[i].exists && u.uid !== OWNER_UID) orphans.push(u); });
    pageToken = page.pageToken;
  } while (pageToken);

  const old = orphans.filter(u => new Date(u.metadata.creationTime).getTime() < cutoff);
  console.log(`إجمالي حسابات Auth: ${total} | يتيمة: ${orphans.length} | يتيمة أقدم من ${days} يوم: ${old.length}`);
  old.forEach(u => console.log(`${u.uid}  ${u.email || "-"}  ${u.metadata.creationTime}`));

  if (!doDelete) return console.log("\nDry-run — ما اتحذفش حاجة. ضيف --delete للحذف.");
  for (let i = 0; i < old.length; i += 1000) {
    const r = await admin.auth().deleteUsers(old.slice(i, i + 1000).map(u => u.uid));
    console.log(`اتحذف ${r.successCount} | فشل ${r.failureCount}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
