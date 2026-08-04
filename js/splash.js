/* ==========================================================================
   شاشة التحميل (Splash Screen) - نظام الجامعة
   ملف مستقل: splash.js

   طريقة الربط بالموقع (جذع index.html):
   1) ضيف سطر واحد فقط في <head> عشان الأيقونات:
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
   2) ضيف سطرين قبل إغلاق </body>:
      <link rel="stylesheet" href="splash.css">
      <script src="splash.js"></script>
   3) الملف بيبني شاشة التحميل تلقائي، مفيش أي تعديل تاني مطلوب في index.html.
   4) لما يكون عندك مكان في كودك بيتأكد فيه إن البيانات الحقيقية
      (Firebase / أول تحميل للبيانات) خلصت، نادي على السطر ده:
         window.dispatchEvent(new Event('uniAppReady'));
      لو معملتش كده، الشاشة هتقفل تلقائي بمجرد ما المتصفح يخلص تحميل
      الصفحة (حدث window.onload) أو لما تنتهي دورة الكلام، أيهما أسرع.
   ========================================================================== */

(function () {
    "use strict";

    // الكلمات: كل كلمة ليها لون خاص بيها + أيقونة تشابه معناها
    var WORDS = [
        { text: "منتدى جامعي",        color: "#4dabf7", icon: "fa-solid fa-comments" },
        { text: "دردشة سريعة",        color: "#ffd43b", icon: "fa-solid fa-bolt" },
        { text: "سجل مسيرتك",         color: "#69db7c", icon: "fa-solid fa-route" },
        { text: "سرعة استجابة",       color: "#ff922b", icon: "fa-solid fa-gauge-high" },
        { text: "أمان الخصوصية",      color: "#845ef7", icon: "fa-solid fa-user-shield" },
        { text: "تشفير تام",          color: "#20c997", icon: "fa-solid fa-lock" },
        { text: "تواصل مع أصدقائك",   color: "#ff6b6b", icon: "fa-solid fa-user-group" },
        { text: "احفظ درجاتك",        color: "#e8b923", icon: "fa-solid fa-graduation-cap" }
    ];

    var MS_PER_WORD = 1000;               // كل كلمة تفضل ثانية واحدة
    var TOTAL_DURATION = WORDS.length * MS_PER_WORD;

    var RADIUS = 48;
    var CIRCUMFERENCE = 2 * Math.PI * RADIUS;

    var startTime = null;
    var rafId = null;
    var currentWordIndex = -1;
    var closed = false;
    var forceComplete = false; // يتفعل لما التحميل الحقيقي يخلص قبل انتهاء الكلام

    function buildSplash() {
        var splash = document.createElement("div");
        splash.id = "uni-splash-screen";
        splash.innerHTML =
            '<div class="uni-splash-ring-wrap">' +
                '<svg viewBox="0 0 110 110">' +
                    '<circle class="uni-splash-ring-bg" cx="55" cy="55" r="' + RADIUS + '"></circle>' +
                    '<circle class="uni-splash-ring-fill" id="uni-splash-ring-fill" cx="55" cy="55" r="' + RADIUS + '" ' +
                        'stroke-dasharray="' + CIRCUMFERENCE + '" stroke-dashoffset="' + CIRCUMFERENCE + '"></circle>' +
                '</svg>' +
                '<div class="uni-splash-percent" id="uni-splash-percent">0%</div>' +
            '</div>' +
            '<div class="uni-splash-word" id="uni-splash-word">' +
                '<i id="uni-splash-word-icon"></i>' +
                '<span id="uni-splash-word-text"></span>' +
            '</div>' +
            '<div class="uni-splash-title">نظام الجامعة</div>';
        document.body.appendChild(splash);
        return splash;
    }

    function showWord(index) {
        var wordEl = document.getElementById("uni-splash-word");
        var iconEl = document.getElementById("uni-splash-word-icon");
        var textEl = document.getElementById("uni-splash-word-text");
        var w = WORDS[index % WORDS.length];

        wordEl.classList.remove("uni-splash-word-visible");

        setTimeout(function () {
            iconEl.className = w.icon;
            textEl.textContent = w.text;
            wordEl.style.color = w.color;
            iconEl.style.color = w.color;
            wordEl.classList.add("uni-splash-word-visible");
        }, 60);
    }

    function setPercent(p) {
        p = Math.max(0, Math.min(100, p));
        var fillEl = document.getElementById("uni-splash-ring-fill");
        var percentEl = document.getElementById("uni-splash-percent");
        var offset = CIRCUMFERENCE - (p / 100) * CIRCUMFERENCE;
        fillEl.style.strokeDashoffset = offset;
        percentEl.textContent = Math.round(p) + "%";
    }

    function closeSplash() {
        if (closed) return;
        closed = true;
        var splash = document.getElementById("uni-splash-screen");
        if (!splash) return;
        splash.classList.add("uni-splash-hidden");
        setTimeout(function () {
            if (splash && splash.parentNode) {
                splash.parentNode.removeChild(splash);
            }
        }, 550);
    }

    function tick(timestamp) {
        if (closed) return;
        if (startTime === null) startTime = timestamp;
        var elapsed = timestamp - startTime;

        // إذا التحميل الحقيقي خلص، اقفز فورًا لـ 100% وافتح الموقع
        if (forceComplete) {
            setPercent(100);
            closeSplash();
            return;
        }

        var percent = Math.min(100, (elapsed / TOTAL_DURATION) * 100);
        setPercent(percent);

        var wordIndex = Math.min(WORDS.length - 1, Math.floor(elapsed / MS_PER_WORD));
        if (wordIndex !== currentWordIndex) {
            currentWordIndex = wordIndex;
            showWord(currentWordIndex);
        }

        if (percent >= 100) {
            closeSplash();
            return;
        }

        rafId = requestAnimationFrame(tick);
    }

    function markReady() {
        // يتنادى إما من تحميل المتصفح الفعلي أو من حدث uniAppReady المخصص
        if (closed) return;
        forceComplete = true;
        // ما نستناش الـ rAF التالي، نقفل فورًا لو الأنيميشن لسه بادئ
        if (!rafId) {
            setPercent(100);
            closeSplash();
        }
    }

    function init() {
        buildSplash();
        showWord(0);
        currentWordIndex = 0;
        rafId = requestAnimationFrame(tick);

        // لما المتصفح يخلص تحميل كل الموارد فعليًا
        if (document.readyState === "complete") {
            markReady();
        } else {
            window.addEventListener("load", markReady, { once: true });
        }

        // حدث مخصص ينده منه الموقع نفسه لما بياناته الحقيقية (Firebase مثلاً) تخلص
        window.addEventListener("uniAppReady", markReady, { once: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
