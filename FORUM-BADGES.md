# تعليمات تنبيهات كروت المنتدى (Unread Badges)

الملف المسؤول: `js/forum-badges.js`
الدايرة الحمرا على كل كارت = عدد العناصر الجديدة بعد آخر مرة فتح فيها المستخدم الكارت.
آخر وقت قراءة متخزن في `users/{uid}/cardReads/{cardKey}` (حقل `lastSeenAt`).

---

## القاعدة الأساسية

**أي كارت جديد فيه `worldId` لازم يتعمل له فهرس جديد في Firestore، وإلا التنبيه مش هيشتغل.**

السبب: العدّاد بيعمل استعلام `worldId == العالم` + `createdAt > آخر قراءة`، واستعلام زي ده بيحتاج فهرس مركّب.
لو الفهرس مش موجود، الاستعلام بيفشل بـ `failed-precondition` والكود بيبلع الخطأ ويحط العدّاد صفر
**من غير أي رسالة ظاهرة** — فالكارت ببساطة مش هيعرض أي دايرة.

---

## خطوات إضافة كارت جديد له تنبيهات (بالترتيب)

### 1) الكارت في `index.html`
لازم يكون جواه أيقونة بالكلاس `forum-card-icon--<key>`، لأن العدّاد بيلاقي الكارت من خلالها.

### 2) سطر جديد في `SOURCES` داخل `js/forum-badges.js`
```js
{ key: "mykey", iconClass: "forum-card-icon--mykey", col: "myCollection", timeField: "createdAt", worldScoped: true },
```
- `worldScoped: true` لو المجموعة فيها `worldId`.
- `statusIn: [...]` لو محتاج تفلتر بحالة (زي راحت فين؟).
- `underUser: true` لو البيانات تحت `grades/{uid}/...`.
- `kind: "singleDoc"` أو `"smallCollection"` للحالات الخاصة (مصروفاتي / تعليمات).

### 3) الفهرس في `firestore.indexes.json`
لكل كارت `worldScoped`، أضف:
```json
{
  "collectionGroup": "myCollection",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "worldId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "ASCENDING" }
  ]
}
```
- الاتجاه لازم **Ascending** للحقلين. فهرس `createdAt` تنازلي (اللي بيستخدمه عرض الصفحة) **مش بيخدم العدّاد**.
- لو الكارت بيفلتر بـ `status`: الفهرس `status` ↑ + `createdAt` ↑.
- اسم الحقل الزمني لازم يطابق `timeField` في `SOURCES`.
- بعد الإضافة: `firebase deploy --only firestore:indexes`، أو Create index يدويًا من Firebase Console،
  واستنى لحد ما الحالة تبقى **Enabled**.

### 4) شروط البيانات
- الحقل الزمني لازم يتكتب بـ `serverTimestamp()` (نوع Timestamp)، مش رقم ولا نص.
- كل مستند جديد لازم يتكتب فيه `worldId` (القيمة من `activeWorldContext()`).

### 5) قواعد Firestore (`firestore.rules`)
- الاستعلام لازم تسمح له قاعدة القراءة، وفي كروت العوالم بتشترط `resource.data.worldId == myWorldId()`.
- القاعدة `users/{uid}/cardReads/{cardKey}` موجودة بالفعل ومش محتاجة تعديل لكل كارت جديد.

### 6) نسخة الكاش (`firebase-messaging-sw.js`)
ملفات الـJS بتتقدّم من الكاش أولًا. بعد أي تعديل في `forum-badges.js` زوّد `CACHE_VERSION`
عشان المستخدمين ياخدوا النسخة الجديدة بسرعة.

---

## الفهارس الحالية المطلوبة للعدّاد

| الكارت | Collection | الحقول (كلها Ascending) |
|---|---|---|
| أخبار المعهد | `news` | `worldId` + `createdAt` |
| المحاضرات | `lectures` | `worldId` + `createdAt` |
| الامتحانات | `exams` | `worldId` + `createdAt` |
| السكاشن | `sections` | `worldId` + `createdAt` |
| الجدول الدراسي | `studySchedule` | `worldId` + `createdAt` |
| شيتاتي | `sheets` | `worldId` + `createdAt` |
| راحت فين؟ | `lostFound` | `status` + `createdAt` |

بدون فهرس مركّب (الفهرس التلقائي بيكفي): الدرجات `grades/{uid}/records`، الخدمة العسكرية `militaryMaterials`،
التعليمات `instructions`، مصروفاتي `tuitionFees`.

---

## كروت مش مغطّاة بالعدّاد
- **الحضور والغياب**: مستندات `attendanceSchedules` مفيهاش حقل وقت (`createdAt`/`updatedAt`)، فمفيش حاجة تتقارن بيها.
- **مستنداتي** (`docItems`): الحقول موجودة (`worldId` + `createdAt`) لكن الكارت لسه مش مضاف في `SOURCES`، ولا الفهرس اتعمل.
- **انت ليه هنا؟** و**تثبيت التطبيق** و**البوابة الرسمية**: مش كروت بيانات.

---

## اختبار سريع لأي كارت (Console، قبل إضافة الداتا)
```js
(async () => {
  const fs = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const db = window.db, w = window.activeWorldContext(), t0 = fs.Timestamp.fromMillis(0);
  const un = fs.onSnapshot(
    fs.query(fs.collection(db, "myCollection"), fs.where("worldId","==",w), fs.where("createdAt",">",t0)),
    s => { console.log("OK", s.size); un(); },
    e => console.error("ERR", e.code, e.message));
})();
```
- `OK` = الفهرس سليم.
- `ERR failed-precondition` = الفهرس ناقص؛ الرسالة فيها رابط إنشاؤه، افتحه واضغط Create.

---

## ملاحظات
- بصمة `uid|worldId` متراقبة تلقائيًا: لو الحساب أو العالم اتغيّر، الاستماعات القديمة بتتوقف وبتبدأ جديدة.
- أول مرة يفتح فيها المستخدم بعد تفعيل الميزة، كل الموجود يتحسب "مقروء".
