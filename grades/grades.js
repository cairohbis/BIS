/**
 * ══════════════════════════════════════════
 *   GRADES MODULE — درجاتي
 *   المرحلة 0: البنية التحتية والربط
 * ══════════════════════════════════════════
 *
 *  ✅ معزولة تماماً عن بقية الموقع
 *  ✅ لا تعدل: الشات / الرسائل / الإشعارات / البروفايل / الحسابات
 *  ✅ تستخدم window.currentUser الموجود
 *  ✅ تستخدم window.db الموجود (Firebase Firestore)
 *  ✅ لا تُعدِّل تهيئة Firebase الحالية
 *
 *  هذا الملف: نقطة الدخول الوحيدة لوحدة درجاتي
 */

(function () {
  "use strict";

  /* ─────────────────────────────────────────
     0-A  حماية من التحميل المزدوج
  ───────────────────────────────────────── */
  if (window.__gradesModuleLoaded) return;
  window.__gradesModuleLoaded = true;

  /* ─────────────────────────────────────────
     0-B  واجهة عامة لوحدة درجاتي (Public API)
          ستُملأ بالدوال في المراحل القادمة
  ───────────────────────────────────────── */
  const GradesModule = {
    version: "0.1.0",  // المرحلة 0 — ربط فقط

    /**
     * فتح واجهة درجاتي
     * (يتم تعريفها بالكامل في المرحلة 1)
     */
    open: function () {
      const root = document.getElementById("grades-app-root");
      if (!root) {
        console.warn("[Grades] grades-app-root غير موجود");
        return;
      }

      // تحقق من تسجيل الدخول
      const user = window.currentUser;
      if (!user || !user.uid) {
        if (typeof window.toast === "function") {
          window.toast("يجب تسجيل الدخول أولاً", "warn");
        }
        return;
      }

      // تحقق من Firebase
      if (!window.db) {
        console.warn("[Grades] window.db غير متاح بعد");
        if (typeof window.toast === "function") {
          window.toast("جارٍ التهيئة، حاول مرة أخرى", "warn");
        }
        return;
      }

      root.classList.add("grades-open");
      root.style.display = "flex";

      // في المرحلة 0: عرض رسالة بسيطة فقط
      GradesModule._renderPlaceholder(root, user);
    },

    /**
     * إغلاق واجهة درجاتي
     */
    close: function () {
      const root = document.getElementById("grades-app-root");
      if (!root) return;
      root.classList.remove("grades-open");
      root.style.display = "none";
      root.innerHTML = "";
    },

    /**
     * عرض placeholder مؤقت (المرحلة 0 فقط)
     * سيُستبدل بالواجهة الكاملة في المرحلة 1
     */
    _renderPlaceholder: function (root, user) {
      root.innerHTML = `
        <div class="grades-overlay" onclick="window.GradesModule.close()"></div>
        <div class="grades-sheet">
          <div class="grades-sheet-header">
            <button class="grades-back-btn" onclick="window.GradesModule.close()">
              <i class="fa-solid fa-arrow-right"></i> رجوع
            </button>
            <div class="grades-sheet-title">
              <i class="fa-solid fa-graduation-cap"></i>
              درجاتي
            </div>
          </div>
          <div class="grades-sheet-body">
            <div class="grades-placeholder">
              <div class="grades-placeholder-icon">
                <i class="fa-solid fa-graduation-cap"></i>
              </div>
              <div class="grades-placeholder-title">وحدة درجاتي</div>
              <div class="grades-placeholder-sub">
                البنية التحتية جاهزة ✓<br>
                في انتظار المرحلة 1 — الواجهة الأساسية
              </div>
              <div class="grades-placeholder-info">
                <div class="grades-info-row">
                  <i class="fa-solid fa-user"></i>
                  <span>${user.uid ? "مستخدم مسجّل ✓" : "—"}</span>
                </div>
                <div class="grades-info-row">
                  <i class="fa-solid fa-database"></i>
                  <span>${window.db ? "Firebase متصل ✓" : "Firebase غير متاح"}</span>
                </div>
                <div class="grades-info-row">
                  <i class="fa-solid fa-code-branch"></i>
                  <span>الإصدار ${GradesModule.version}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    /**
     * تهيئة الوحدة — تُستدعى تلقائياً عند تحميل الملف
     */
    _init: function () {
      // التحقق من وجود grades-app-root
      const root = document.getElementById("grades-app-root");
      if (!root) {
        console.error("[Grades] grades-app-root غير موجود في الصفحة");
        return;
      }

      console.log("[Grades] ✓ وحدة درجاتي جاهزة — المرحلة 0");
    },
  };

  /* ─────────────────────────────────────────
     0-C  تعريض الوحدة على window
  ───────────────────────────────────────── */
  window.GradesModule = GradesModule;

  /* ─────────────────────────────────────────
     0-D  تشغيل التهيئة
          ننتظر DOMContentLoaded للأمان
  ───────────────────────────────────────── */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      GradesModule._init();
    });
  } else {
    GradesModule._init();
  }

})();
