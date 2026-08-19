/* ============================================================================
   Mascot System v2 — بريق | بطة برِيق
   ============================================================================
   ملف واحد فقط (بدون Build Step / بدون ES Modules) — لكنه منظم داخليًا
   كأنه مشروع كامل، كل Manager مسؤول عن حاجة واحدة بس، ومحدش بيعرف تفاصيل
   التاني إلا عن طريق واجهة واضحة (Interface) بين المديرين.

   البنية:
     Mascot (Public API)
       ├── IdentityManager   → حارس الهوية: master reference + قفل السمات
       ├── AssetManager      → سجل الأصول: theme → category → key → url
       ├── MoodManager       → قائمة الحالات العاطفية (Emotions)
       ├── ActionManager     → قائمة الحركات/الأفعال (Actions)
       ├── ThemeManager      → قائمة الثيمات المعروفة + الثيم الافتراضي
       ├── AnimationManager  → تعيين كل حالة إلى كلاس حركة CSS
       ├── Renderer          → الوحيد المسموح له يلمس DOM
       └── InstanceManager   → تتبّع كل نسخة (instance) نشطة وحذفها بأمان

   ملاحظة صادقة عن IdentityManager: الكود مش قادر "يشوف" الصورة ويتأكد إنها
   فعلاً نفس البطة بصريًا — ده قرار بشري وقت المراجعة. اللي IdentityManager
   بيعمله فعليًا هو حارس إجرائي (Process Guard): يمنع تسجيل أي أصل نهائي
   (Asset) قبل ما يتم قفل الـ master reference رسميًا، ويحتفظ بنسخة موحدة
   من قواعد الهوية (السمات الثابتة/المسموح تغييرها) كمرجع يُستخدم مع أي
   مصمم أو أي Prompt توليد صور.
   ========================================================================= */
(function (window, document) {
  "use strict";

  if (window.Mascot) return; // منع التحميل المزدوج

  // قفل عام على أي تعديل في الـ Registry (يُفعّل عبر Mascot.lock())
  // بيتفحص جوه AssetManager وThemeManager وIdentityManager.setMasterReference
  var systemLocked = false;

  // وضع التشخيص (Mascot.debug(true/false)) — يطبع في الـ Console كل قرار
  // بيتاخد وقت الرسم: الحالة المطلوبة، الثيم، الأصل اللي اتاختار وسبب
  // الاختيار (مباشر/Fallback/Placeholder)، ووقت اكتمال تحميل الصورة
  var debugEnabled = false;

  // =========================================================================
  // IdentityManager — حارس الهوية
  // =========================================================================
  var IdentityManager = (function () {
    var identity = {
      version: "1.0",
      masterReferencePath: null,
      lockedAt: null,
      // مطابق لملف mascot-style-spec.md — مرجع سريع داخل الكود نفسه
      lockedAttributes: [
        "shape_head", "shape_eyes", "eyes_size", "shape_beak", "face_proportions",
        "shape_smile", "shape_body", "wings_size", "tail", "cap_style",
        "cap_direction", "cap_color", "hoodie_style", "hoodie_color",
        "hoodie_logo", "character_colors", "art_style", "line_thickness",
        "shading_style", "body_proportions"
      ],
      allowedVariance: [
        "facial_expression", "body_pose", "hands_or_wings_position",
        "gaze_direction", "temporary_accessories"
      ]
    };

    function setMasterReference(path) {
      if (systemLocked) {
        console.warn("[Mascot/Identity] النظام مقفول (Mascot.lock() اتنادى) — مينفعش تغيّر master reference.");
        return false;
      }
      if (!path) {
        console.warn("[Mascot/Identity] لازم تمرر مسار صورة صحيح لـ master reference.");
        return false;
      }
      identity.masterReferencePath = path;
      identity.lockedAt = new Date().toISOString();
      return true;
    }

    function isLocked() {
      return !!identity.masterReferencePath;
    }

    // يُستدعى داخليًا من AssetManager قبل أي تسجيل أصل حقيقي
    function validateAssetRegistration(theme, category, key) {
      if (!isLocked()) {
        return {
          valid: false,
          reason: "لا يمكن تسجيل أي أصل نهائي قبل قفل master reference عبر Mascot.setMasterReference()."
        };
      }
      if (!category || !key) {
        return { valid: false, reason: "لازم category و key صحيحين." };
      }
      return { valid: true, reason: null };
    }

    function getIdentity() {
      // نسخة معزولة، عشان محدش يعدّل القواعد من برّه بالغلط
      return JSON.parse(JSON.stringify(identity));
    }

    return {
      setMasterReference: setMasterReference,
      isLocked: isLocked,
      validateAssetRegistration: validateAssetRegistration,
      getIdentity: getIdentity
    };
  })();

  // =========================================================================
  // MoodManager — الحالات العاطفية (emotions/)
  // =========================================================================
  var MoodManager = (function () {
    var EMOTIONS = {
      happy:     { color: "#c9a96e", icon: "smile" },
      sad:       { color: "#5a7499", icon: "frown" },
      angry:     { color: "#ef4444", icon: "angry" },
      thinking:  { color: "#3b82f6", icon: "bulb" },
      surprised: { color: "#f59e0b", icon: "surprised" },
      love:      { color: "#ec4899", icon: "heart" }
    };
    function has(key) { return Object.prototype.hasOwnProperty.call(EMOTIONS, key); }
    function get(key) { return EMOTIONS[key] || null; }
    function list() { return Object.keys(EMOTIONS); }
    return { has: has, get: get, list: list, CATEGORY: "emotions" };
  })();

  // =========================================================================
  // ActionManager — الحركات/الأفعال (actions/)
  // =========================================================================
  var ActionManager = (function () {
    var ACTIONS = {
      wave:      { color: "#c9a96e", icon: "hand" },
      celebrate: { color: "#f59e0b", icon: "star" },
      run:       { color: "#14b8a6", icon: "run" },
      write:     { color: "#3b82f6", icon: "write" },
      sleep:     { color: "#5a7499", icon: "moon" }
    };
    function has(key) { return Object.prototype.hasOwnProperty.call(ACTIONS, key); }
    function get(key) { return ACTIONS[key] || null; }
    function list() { return Object.keys(ACTIONS); }
    return { has: has, get: get, list: list, CATEGORY: "actions" };
  })();

  // =========================================================================
  // حالات الواجهة (ui/) — مش عندها Manager مستقل لأنها ملحقة مباشرة
  // بمفهوم "الأصل" نفسه، لكنها معزولة كفئة (category) واضحة زي الباقي
  // =========================================================================
  var UI_STATES = {
    loading: { color: "#3b82f6", icon: "spinner" },
    success: { color: "#22c55e", icon: "check" },
    error:   { color: "#ef4444", icon: "x" },
    offline: { color: "#5a7499", icon: "offline" },
    empty:   { color: "#5a7499", icon: "box" }
  };
  var UiStates = {
    has: function (key) { return Object.prototype.hasOwnProperty.call(UI_STATES, key); },
    get: function (key) { return UI_STATES[key] || null; },
    list: function () { return Object.keys(UI_STATES); },
    CATEGORY: "ui"
  };

  // يبحث عن أي key في المديرين التلاتة ويرجّع فئته (category) وإعداداته
  function resolveKey(key) {
    if (MoodManager.has(key))  return { category: MoodManager.CATEGORY, config: MoodManager.get(key) };
    if (ActionManager.has(key)) return { category: ActionManager.CATEGORY, config: ActionManager.get(key) };
    if (UiStates.has(key))     return { category: UiStates.CATEGORY, config: UiStates.get(key) };
    return null; // key غير معروف → fallback في الـ Renderer
  }
  var FALLBACK_KEY = "happy";

  // =========================================================================
  // ThemeManager — الثيمات المعروفة (default / ramadan / eid / graduation...)
  // =========================================================================
  var ThemeManager = (function () {
    var knownThemes = { "default": true };
    var defaultTheme = "default";

    function register(theme) {
      if (systemLocked) {
        console.warn("[Mascot/Theme] النظام مقفول — مينفعش تسجّل ثيم جديد (" + theme + ").");
        return false;
      }
      knownThemes[theme] = true;
      return true;
    }
    function has(theme) { return !!knownThemes[theme]; }
    function list() { return Object.keys(knownThemes); }
    function getDefaultTheme() { return defaultTheme; }

    return { register: register, has: has, list: list, getDefaultTheme: getDefaultTheme };
  })();

  // =========================================================================
  // AssetManager — سجل الأصول: theme → category → key → url
  // بيسأل IdentityManager قبل أي تسجيل، وده أهم نقطة تكامل بين المديرين
  // =========================================================================
  var AssetManager = (function () {
    var registry = {}; // registry[theme][category][key] = url

    // عرض موحّد بالشكل المطلوب: { happy: {type:"emotion", file:"..."} }
    // ملاحظة: التخزين الداخلي الفعلي مقسّم بين المديرين (Mood/Action/UI
    // بيملكوا الـ type، وAssetManager بيملك الـ file) عن قصد — فصل
    // المسؤوليات ده بيسهّل التوسعة. الدالة دي بترجّع Snapshot للقراءة
    // فقط بنفس الشكل اللي طلبته، من غير ما نغيّر البنية الداخلية.
    function getSnapshot(theme) {
      var snap = {};
      function fill(keys, typeName, category) {
        keys.forEach(function (key) {
          snap[key] = {
            type: typeName,
            file: (registry[theme] && registry[theme][category] && registry[theme][category][key]) || null
          };
        });
      }
      fill(MoodManager.list(), "emotion", MoodManager.CATEGORY);
      fill(ActionManager.list(), "action", ActionManager.CATEGORY);
      fill(UiStates.list(), "ui", UiStates.CATEGORY);
      return snap;
    }

    function registerAsset(theme, key, url) {
      if (systemLocked) {
        console.warn("[Mascot/Asset] النظام مقفول (Mascot.lock() اتنادى) — مينفعش تسجّل أصول جديدة.");
        return false;
      }
      var resolved = resolveKey(key);
      var category = resolved ? resolved.category : null;

      var check = IdentityManager.validateAssetRegistration(theme, category, key);
      if (!check.valid) {
        console.warn("[Mascot/Asset] رُفض تسجيل الأصل (" + theme + "/" + key + "): " + check.reason);
        return false;
      }

      ThemeManager.register(theme);
      if (!registry[theme]) registry[theme] = {};
      if (!registry[theme][category]) registry[theme][category] = {};
      registry[theme][category][key] = url;
      InstanceManager.rerenderAll();
      return true;
    }

    // النسخة الكاملة (للاستخدام الداخلي/التشخيص) — بترجع مصدر القرار
    // بدل ما ترجع الرابط بس، عشان Debug Mode يقدر يشرح "ليه الصورة دي؟"
    function resolveAssetInfo(theme, key) {
      var resolved = resolveKey(key);
      var category = resolved ? resolved.category : null;
      if (!category) return { url: null, sourceTheme: null, reason: "key غير معروف" };

      if (registry[theme] && registry[theme][category] && registry[theme][category][key]) {
        return { url: registry[theme][category][key], sourceTheme: theme, reason: "مباشر من " + theme };
      }
      var fallbackTheme = ThemeManager.getDefaultTheme();
      if (theme !== fallbackTheme &&
          registry[fallbackTheme] && registry[fallbackTheme][category] && registry[fallbackTheme][category][key]) {
        return { url: registry[fallbackTheme][category][key], sourceTheme: fallbackTheme, reason: "Fallback: " + theme + " مفيهوش " + key + " → استُخدم " + fallbackTheme };
      }
      return { url: null, sourceTheme: null, reason: "مفيش أصل مسجل في " + theme + " ولا في " + fallbackTheme + " → Placeholder" };
    }

    function resolveAsset(theme, key) {
      return resolveAssetInfo(theme, key).url;
    }

    return { registerAsset: registerAsset, resolveAsset: resolveAsset, resolveAssetInfo: resolveAssetInfo, getSnapshot: getSnapshot };
  })();

  // =========================================================================
  // AnimationManager — كل حالة (mood/action/ui) لها كلاس حركة CSS معيّن
  // نقطة تعديل واحدة لو حبينا نضيف حركة جديدة لحالة موجودة
  // =========================================================================
  var AnimationManager = (function () {
    var ANIMATION_MAP = {
      celebrate: "mascot-anim-pop",
      success:   "mascot-anim-pop",
      angry:     "mascot-anim-shake",
      error:     "mascot-anim-shake",
      wave:      "mascot-anim-wiggle",
      loading:   "mascot-anim-spin",
      run:       "mascot-anim-run"
    };
    function classFor(key) {
      return ANIMATION_MAP[key] || "";
    }
    return { classFor: classFor };
  })();

  // =========================================================================
  // Renderer — الوحيد المسموح له يلمس DOM أو يقرأ الأصول/الأيقونات
  // =========================================================================
  // تسميات إتاحة عربية لكل حالة — تُستخدم كـ alt/aria-label افتراضيًا
  var MOOD_LABELS = {
    happy: "بريق سعيد", sad: "بريق حزين", angry: "بريق غاضب",
    thinking: "بريق يفكر", surprised: "بريق مندهش", love: "بريق معجب",
    wave: "بريق يحيي", celebrate: "بريق يحتفل", run: "بريق يجري",
    write: "بريق يكتب", sleep: "بريق نائم",
    loading: "جاري التنفيذ", success: "تمت العملية بنجاح",
    error: "حدث خطأ", offline: "لا يوجد اتصال بالإنترنت",
    empty: "لا توجد بيانات لعرضها"
  };

  var ICONS = {
    smile:     '<path d="M12 3a9 9 0 100 18 9 9 0 000-18z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.7" cy="10" r="1.15" fill="currentColor"/><circle cx="15.3" cy="10" r="1.15" fill="currentColor"/><path d="M7.5 14.2c1 1.4 2.6 2.2 4.5 2.2s3.5-.8 4.5-2.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    frown:     '<path d="M12 3a9 9 0 100 18 9 9 0 000-18z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.7" cy="10" r="1.15" fill="currentColor"/><circle cx="15.3" cy="10" r="1.15" fill="currentColor"/><path d="M7.5 16.3c1-1.4 2.6-2.2 4.5-2.2s3.5.8 4.5 2.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    angry:     '<path d="M12 3a9 9 0 100 18 9 9 0 000-18z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6.8 8.6l3.2 1.3M17.2 8.6l-3.2 1.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8 15.5c1.2-1 2.6-1.4 4-1.4s2.8.4 4 1.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    surprised: '<path d="M12 3a9 9 0 100 18 9 9 0 000-18z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.7" cy="9.5" r="1" fill="currentColor"/><circle cx="15.3" cy="9.5" r="1" fill="currentColor"/><circle cx="12" cy="15" r="2.1" fill="none" stroke="currentColor" stroke-width="1.7"/>',
    star:      '<path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.4l-6.1 3.5 1.5-6.8L2.2 9.5l6.9-.7L12 2.5z" fill="currentColor"/>',
    check:     '<path d="M4 12.5l5 5L20 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    x:         '<path d="M5.5 5.5l13 13M18.5 5.5l-13 13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    bulb:      '<path d="M9 18.5h6M10 21h4M12 3a6.2 6.2 0 00-3 11.6c.6.5 1 1.2 1 2h4c0-.8.4-1.5 1-2A6.2 6.2 0 0012 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    spinner:   '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="34 60"/>',
    moon:      '<path d="M20 14.2A8.3 8.3 0 119.9 3.1 6.7 6.7 0 0020 14.2z" fill="currentColor"/>',
    hand:      '<path d="M8 12.3V5.3a1.5 1.5 0 013 0v5M11 10.3V4.3a1.5 1.5 0 013 0v6M14 10.3V6.5a1.5 1.5 0 013 0v6.8M8 12.3l-1.6-1.5a1.4 1.4 0 00-2 2l3.6 3.7a6 6 0 006 6h.5a6 6 0 006-6v-2.3a2 2 0 00-2-2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    heart:     '<path d="M12 20s-7-4.3-9.4-8.4C.9 8 2.5 4.6 6 4.6c2 0 3.3 1 4 2 .7-1 2-2 4-2 3.5 0 5.1 3.4 3.4 7C19 15.7 12 20 12 20z" fill="currentColor"/>',
    box:       '<path d="M3 8l9-5 9 5-9 5-9-5zm0 0v8l9 5 9-5V8M12 13v8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    run:       '<path d="M5 19l4-3 3 1 3-4M15 13l3-2M9 8a1.7 1.7 0 100-3.4A1.7 1.7 0 009 8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    write:     '<path d="M4 20l1-4 11-11 3 3-11 11-4 1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
    offline:   '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  };

  var Renderer = {
    create: function (size, className) {
      var el = document.createElement("div");
      el.className = "mascot mascot--" + size + (className ? " " + className : "");
      var inner = document.createElement("div");
      inner.className = "mascot__inner";
      el.appendChild(inner);
      return el;
    },
    // a11y = { decorative: bool, label: string|null }
    // decorative=true (افتراضي) → aria-hidden، مناسب لما الشخصية جنب نص
    // بيقول نفس المعنى أصلاً (زي Toast). decorative=false → aria-label
    // حقيقي، مناسب لما الشخصية هي المحتوى نفسه (زي Splash Screen).
    update: function (el, key, theme, a11y) {
      var inner = el.querySelector(".mascot__inner");
      if (!inner) return;

      var t0 = debugEnabled ? performance.now() : 0;
      var resolved = resolveKey(key) || resolveKey(FALLBACK_KEY);
      var effectiveKey = MoodManager.has(key) || ActionManager.has(key) || UiStates.has(key) ? key : FALLBACK_KEY;
      var assetInfo = AssetManager.resolveAssetInfo(theme, effectiveKey);
      var assetUrl = assetInfo.url;
      var animClass = AnimationManager.classFor(effectiveKey);
      var label = (a11y && a11y.label) || MOOD_LABELS[effectiveKey] || effectiveKey;

      if (debugEnabled) {
        console.groupCollapsed("[Mascot/Debug] " + effectiveKey + " @ " + theme);
        console.log("Mood/Key المطلوب:", key, key !== effectiveKey ? "(غير معروف → استُخدم fallback: " + effectiveKey + ")" : "");
        console.log("Theme المطلوب:", theme);
        console.log("Asset:", assetUrl || "(مفيش — Placeholder)");
        console.log("السبب:", assetInfo.reason);
        console.log("وقت اتخاذ القرار:", (performance.now() - t0).toFixed(2) + "ms");
        console.groupEnd();
      }

      el.setAttribute("data-mood", effectiveKey);
      el.setAttribute("data-category", resolved.category);
      el.setAttribute("data-theme", theme);

      if (!a11y || a11y.decorative !== false) {
        el.setAttribute("aria-hidden", "true");
        el.removeAttribute("aria-label");
        el.removeAttribute("role");
      } else {
        el.removeAttribute("aria-hidden");
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", label);
      }

      if (assetUrl) {
        inner.className = "mascot__inner mascot__inner--image" + (animClass ? " " + animClass : "");
        inner.innerHTML = "";
        var img = document.createElement("img");
        img.className = "mascot__img";
        img.alt = label;
        img.loading = "lazy"; // ما يتحملش إلا وقت الحاجة الفعلية له
        if (debugEnabled) {
          var loadStart = performance.now();
          img.onload = function () {
            console.log("[Mascot/Debug] اكتمل تحميل " + effectiveKey + " فعليًا خلال " + (performance.now() - loadStart).toFixed(1) + "ms");
          };
        }
        img.src = assetUrl;
        inner.appendChild(img);
      } else {
        var cfg = resolved.config;
        inner.className = "mascot__inner mascot__inner--placeholder" + (animClass ? " " + animClass : "");
        inner.style.setProperty("--mascot-color", cfg.color);
        // نفس صندوق الأبعاد بالظبط اللي هيتاخد بعدين من <img> (شوف
        // mascot.css: padding موحد على mascot__inner لكل من الاتنين)
        inner.innerHTML =
          '<svg class="mascot__icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          (ICONS[cfg.icon] || ICONS.smile) +
          "</svg>";
      }
    }
  };

  // =========================================================================
  // InstanceManager — تتبّع كل نسخة نشطة (لأغراض إعادة الرسم عند تغيّر
  // Default/تسجيل أصل جديد، ولمنع تسريبات الذاكرة عند الحذف)
  // =========================================================================
  var InstanceManager = (function () {
    var active = new Set();
    function add(instance) { active.add(instance); }
    function remove(instance) { active.delete(instance); }
    function rerenderAll() { active.forEach(function (inst) { inst._render(); }); }
    function rerenderFollowers(field) {
      active.forEach(function (inst) {
        if (!inst[field]) inst._render();
      });
    }
    function count() { return active.size; }
    return { add: add, remove: remove, rerenderAll: rerenderAll, rerenderFollowers: rerenderFollowers, count: count };
  })();

  // =========================================================================
  // الحالة العامة الافتراضية (لشخصية ثابتة زي Splash/Home)
  // =========================================================================
  var globalState = {
    defaultMood: FALLBACK_KEY,
    defaultTheme: ThemeManager.getDefaultTheme()
  };

  function resolveContainer(container) {
    if (!container) return null;
    if (typeof container === "string") return document.querySelector(container);
    return container;
  }

  function createInstance(options) {
    options = options || {};
    var size = options.size || "md";
    var container = resolveContainer(options.container);

    var el = Renderer.create(size, options.className);

    var instance = {
      el: el,
      _destroyed: false,
      _mood: options.mood || null,
      _theme: options.theme || null,
      _a11y: { decorative: options.decorative !== false, label: options.label || null },
      _listeners: { onShow: [], onHide: [], onMoodChange: [], onThemeChange: [], onDestroy: [] }
    };

    function fire(evt, payload) {
      instance._listeners[evt].forEach(function (cb) {
        try { cb(payload); } catch (e) { console.error("[Mascot] خطأ داخل مستمع " + evt, e); }
      });
    }

    instance.on = function (evt, cb) {
      if (instance._listeners[evt] && typeof cb === "function") instance._listeners[evt].push(cb);
      return instance;
    };

    function currentMood() { return instance._mood || globalState.defaultMood; }
    function currentTheme() { return instance._theme || globalState.defaultTheme; }

    function render() {
      if (instance._destroyed) return;
      Renderer.update(el, currentMood(), currentTheme(), instance._a11y);
    }

    instance.setMood = function (key) {
      if (instance._destroyed) return instance;
      instance._mood = key;
      render();
      fire("onMoodChange", { mood: key });
      return instance;
    };
    // أسماء بديلة أوضح دلاليًا حسب الفئة، كلها بترجع لنفس المنطق
    instance.setEmotion = instance.setMood;
    instance.setAction = instance.setMood;
    instance.setUiState = instance.setMood;

    instance.setTheme = function (theme) {
      if (instance._destroyed) return instance;
      instance._theme = theme;
      render();
      fire("onThemeChange", { theme: theme });
      return instance;
    };

    instance.followDefaultMood = function () { instance._mood = null; render(); return instance; };
    instance.followDefaultTheme = function () { instance._theme = null; render(); return instance; };

    // إخفاء/إظهار بدون تدمير النسخة (مفيد لـ Toast بيختفي ويرجع يظهر)
    instance.hide = function () {
      if (instance._destroyed) return instance;
      el.style.display = "none";
      fire("onHide", {});
      return instance;
    };
    instance.show = function () {
      if (instance._destroyed) return instance;
      el.style.display = "";
      fire("onShow", { mood: currentMood(), theme: currentTheme() });
      return instance;
    };

    instance.destroy = function () {
      if (instance._destroyed) return;
      fire("onDestroy", {});
      instance._destroyed = true;
      InstanceManager.remove(instance);
      if (el.parentNode) el.parentNode.removeChild(el);
      instance.el = null;
      instance.setMood = instance.setEmotion = instance.setAction = instance.setUiState = function () { return instance; };
      instance.setTheme = function () { return instance; };
      instance.followDefaultMood = instance.followDefaultTheme = function () { return instance; };
      instance.hide = instance.show = function () { return instance; };
      instance.on = function () { return instance; };
      // تفريغ المستمعين لمنع أي تسريب ذاكرة عبر Closures محتفظة بمراجع خارجية
      instance._listeners = { onShow: [], onHide: [], onMoodChange: [], onThemeChange: [], onDestroy: [] };
    };

    instance._render = render; // استخدام داخلي فقط

    InstanceManager.add(instance);
    render();

    if (container) container.appendChild(el);
    fire("onShow", { mood: currentMood(), theme: currentTheme() });

    return instance;
  }

  // =========================================================================
  // Public API — السطح الوحيد اللي التطبيق (Toast/Loading/Dialog...) يتعامل
  // معاه. أي تغيير جوّه أي Manager فوق متحمي ومحدش برّه بيحس بيه.
  //
  // ── API FREEZE (v1.0) ────────────────────────────────────────────────
  // السطح ده معتمد ومجمّد بداية من نهاية المرحلة 2. أي تعديل/حذف اسم من
  // القايمة دي بعد كده يعتبر Breaking Change ولازم تبرير قوي:
  //
  //   Mascot.show(options) → instance
  //   Mascot.setDefaultMood(key)
  //   Mascot.setDefaultTheme(theme)
  //   Mascot.registerAsset(theme, key, url)
  //   Mascot.setMasterReference(path)
  //   Mascot.getIdentity()
  //   Mascot.registerTheme(theme)
  //   Mascot.getRegistrySnapshot(theme)
  //   Mascot.lock() / Mascot.isLocked()
  //   Mascot.debug(bool)
  //   Mascot.EMOTIONS / Mascot.ACTIONS / Mascot.UI_STATES / Mascot.THEMES()
  //
  //   instance.setMood(key) / setEmotion / setAction / setUiState (aliases)
  //   instance.setTheme(theme)
  //   instance.followDefaultMood() / followDefaultTheme()
  //   instance.hide() / instance.show()
  //   instance.on(event, callback)
  //   instance.destroy()
  //   instance.el (خاصية للقراءة، مش method)
  // ─────────────────────────────────────────────────────────────────────
  // =========================================================================
  var Mascot = {
    show: createInstance,

    setDefaultMood: function (key) {
      globalState.defaultMood = key;
      InstanceManager.rerenderFollowers("_mood");
    },
    setDefaultTheme: function (theme) {
      globalState.defaultTheme = theme;
      InstanceManager.rerenderFollowers("_theme");
    },

    registerAsset: AssetManager.registerAsset,
    getRegistrySnapshot: AssetManager.getSnapshot,
    setMasterReference: IdentityManager.setMasterReference,
    getIdentity: IdentityManager.getIdentity,
    registerTheme: ThemeManager.register,

    // Registry Lock — بعد النداء، أي registerAsset/registerTheme/
    // setMasterReference بترفض وترجع false مع تحذير في الـ Console
    lock: function () { systemLocked = true; },
    isLocked: function () { return systemLocked; },

    // Debug Mode — يطبع كل قرار Render في الـ Console (الحالة/الثيم/
    // الأصل المختار/سبب الاختيار/وقت التحميل الفعلي)
    debug: function (enabled) { debugEnabled = !!enabled; },

    EMOTIONS: MoodManager.list(),
    ACTIONS: ActionManager.list(),
    UI_STATES: UiStates.list(),
    THEMES: ThemeManager.list,

    API_VERSION: "1.0.0",

    _debug: {
      instanceCount: InstanceManager.count,
      resolveKey: resolveKey
    }
  };

  window.Mascot = Mascot;
  // تجميد سطح الكائن نفسه (منع إضافة/حذف/استبدال أي method من برّه بالغلط)
  // — الكائنات الداخلية (Managers) لسه قابلة للتوسعة داخليًا وقت الحاجة
  Object.freeze(Mascot);
})(window, document);
