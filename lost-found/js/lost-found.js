/**
 * ══════════════════════════════════════════
 *   LOST & FOUND MODULE — راحت فين؟
 *   lost-found.js — نقطة الدخول الوحيدة (Loader)
 * ══════════════════════════════════════════
 *
 *  المسؤولية الوحيدة لهذا الملف:
 *   - تسجيل window.LostFoundModule = { open, close } فورًا عند التحميل
 *   - تحميل باقي ملفات js/ بشكل lazy عند أول open() بس، بالترتيب الصحيح:
 *       1) core.js  (إجباري، الكل بيعتمد عليه)
 *       2) feed.js + post.js + comments.js + found.js  (متوازي)
 *       3) admin.js  (بالتوازي مع 2، بس لو isAdmin() فقط)
 *   - ضمان ترتيب الإغلاق الصحيح عبر core.shutdown() (بدل ما ننده دوال منفصلة بترتيب معين)
 *
 *  هذا الملف الوحيد اللي بيعرف بترتيب تحميل الملفات — باقي الملفات مايعرفوش عن
 *  بعض إلا عن طريق window.__LF بعد ما يكونوا اتحملوا كلهم.
 */

(function () {
  "use strict";

  if (window.__lostFoundModuleLoaded) return;
  window.__lostFoundModuleLoaded = true;

  const SCRIPT_CORE = "lost-found/js/lost-found-core.js";
  const SCRIPTS_PARALLEL = [
    "lost-found/js/lost-found-feed.js",
    "lost-found/js/lost-found-post.js",
    "lost-found/js/lost-found-comments.js",
    "lost-found/js/lost-found-found.js",
  ];
  const SCRIPT_ADMIN = "lost-found/js/lost-found-admin.js";

  let _loaded = false;
  let _loadingPromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("فشل تحميل: " + src));
      document.body.appendChild(s);
    });
  }

  function ensureLoaded() {
    if (_loaded) return Promise.resolve();
    if (_loadingPromise) return _loadingPromise; // يمنع تحميل مزدوج لو open() اتنادت مرتين بسرعة

    _loadingPromise = (async () => {
      await loadScript(SCRIPT_CORE);

      const tasks = SCRIPTS_PARALLEL.map(loadScript);
      if (window.isAdmin && window.isAdmin()) {
        tasks.push(loadScript(SCRIPT_ADMIN)); // المستخدم العادي محملّش السطر ده أبدًا
      }
      await Promise.all(tasks);

      _loaded = true;
    })();

    // فشل التحميل يسمح بإعادة المحاولة في فتحة جاية (مش عالق في وعد مرفوض للأبد)
    _loadingPromise.catch(() => { _loadingPromise = null; });

    return _loadingPromise;
  }

  async function open() {
    if (!window.currentUser?.uid) {
      window.toast?.("يجب تسجيل الدخول أولاً", "warn");
      return;
    }

    try {
      await ensureLoaded();
    } catch (e) {
      console.error("[LostFound] فشل تحميل الميزة", e);
      window.toast?.("تعذر تحميل الميزة، حاول مرة أخرى", "error");
      return;
    }

    const root = document.getElementById("lost-found-app-root");
    if (!root) {
      console.error("[LostFound] lost-found-app-root غير موجود في index.html");
      return;
    }

    window.__LF.core.init(root);
    window.__LF.core.mountRoot();
  }

  // الترتيب الصحيح للإغلاق مضمون جوه core.shutdown() نفسها (teardown ثم unmountRoot)
  function close() {
    if (window.__LF && window.__LF.core) window.__LF.core.shutdown();
  }

  window.LostFoundModule = { open, close };
})();
