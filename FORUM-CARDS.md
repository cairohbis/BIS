# دليل كروت المنتدى (FORUM-CARDS)

أي كارت جديد في المنتدى لازم يتبع الشكل ده بالظبط. التصميم كله في **ملف واحد**: `css/forum-cards-colors.css`.

## 1) المكان والترتيب
- الكروت في `index.html` جوه `#forum-landing` (`.forum-grid`)، **وترتيبها في الشاشة = ترتيبها في الـ HTML**.
- كارت جديد يتحط **بعد آخر كارت** (حاليًا "تثبيت التطبيق") **وقبل** كارت "البوابة الرسمية" (`grid-column:1/-1`)، لأن البوابة دايمًا آخر كارت.
- كارت "شارك الموقع" بيتضاف من `js/qr-share.js` قبل البوابة تلقائيًا، فما تكتبوش في الـ HTML.

## 2) الـ HTML (انسخ الشكل ده)
```html
<div class="forum-section-card" onclick="window.NameModule && window.NameModule.open()">
  <div class="forum-card-icon forum-card-icon--name"><i class="fa-solid fa-ICON"></i></div>
  <div class="forum-card-title">العنوان</div>
  <div class="forum-card-sub">وصف قصير في سطر أو سطرين</div>
</div>
```

## 3) اللون والتوهج (قاعدتين في `css/forum-cards-colors.css` فقط)
```css
.forum-card-icon--name { background: linear-gradient(160deg, #فاتح, #غامق); }
.forum-section-card:has(.forum-card-icon--name)::after {
  content: ''; position: absolute; inset: -1px; border-radius: inherit; pointer-events: none;
  background: radial-gradient(120% 120% at 20% 0%, rgba(R,G,B,.16), transparent 60%);
}
```
- `rgba(R,G,B)` = لون الجزء الغامق من التدرج، والشفافية `.16` ثابتة.
- **ممنوع** تعريف لون الكارت داخل ملف الموديول (`study-schedule.css` وغيره): كان ده سبب تشابه الألوان.

## 4) الألوان المستخدمة (اختار لون مختلف عنها)
| الكارت | اللون | الكارت | اللون |
|---|---|---|---|
| أخبار المعهد | برتقالي `#f5811f` | شيتاتي | ليموني `#65a30d` |
| المحاضرات | أزرق `#1f7fe0` | مستنداتي | وردي `#db2777` |
| الامتحانات | أحمر `#e0293f` | مصروفاتي | فوشيا `#a21caf` |
| السكاشن | بنفسجي `#8a4fe0` | درجاتي | أصفر `#f0b90b` |
| الحضور والغياب | أخضر `#1fa85b` | راحت فين؟ | فضي `#64748b` |
| الجدول الدراسي | مرجاني `#e4572e` | تعليمات | سماوي `#0891b2` |
| انت ليه هنا؟ | بنفسجي غامق `#7c3aed` | تثبيت التطبيق | نيلي `#4338ca` |

ألوان متاحة: تيل `#0d9488`، وأي درجة بعيدة عن اللي فوق بفرق واضح في اللون.

## 5) قواعد عامة
- النصوص بـ `var(--text)` و`var(--muted)` والخلفيات بمتغيرات `DESIGN-SYSTEM.md` (`--t-*`)، ولا ألوان ثابتة.
- الكارت مش بيحتاج أي كود للوضع الفاتح: الشكل الأساسي بيشتغل في الوضعين.
- لو الكارت له Badge، أضفه في `js/forum-badges.js` (`key` و`iconClass` و`col`).
- بدون `!important`، وبدون `style="color:..."` جوه الكارت.

## 6) قبل التسليم
1. الضغط على الكارت بيفتح الميزة.
2. التوهج ظاهر ومش مغطي على الضغط (`pointer-events: none`).
3. الشكل سليم في الوضع الداكن والفاتح.
4. لون الكارت مختلف عن باقي الكروت.
