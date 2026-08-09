/* ══════════════════════════════════════════
   طبقة تبديل اللغة (Default / Egyptian / English)
   إضافية بالكامل — لا تعدّل ولا تحذف ولا تعيد تسمية أي كود موجود.
   تعمل فوق الصفحة: تستبدل النصوص وقت العرض فقط بناءً على قاموس
   مطابقة نص كامل (exact match)، وترجع النص الأصلي عند اختيار "افتراضي".
══════════════════════════════════════════ */
(function () {
  "use strict";

  var STORAGE_KEY = "bis-lang";
  var VALID_LANGS = ["default", "egyptian", "english"];

  /* حاويات لا تُترجم أبدًا — محتوى ديناميكي/رسائل مستخدمين */
  var EXCLUDE_IDS = [
    "chatMessages", "dmList", "roomsList", "membersList",
    "grades-app-root", "military-app-root"
  ];
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1 };
  var ATTRS_TO_TRANSLATE = ["placeholder", "title", "aria-label"];

  var _originalsText = new WeakMap();   // text node -> original text
  var _observer = null;

  function getDict(lang) {
    if (lang === "egyptian") return window.BIS_LANG_EGYPTIAN || {};
    if (lang === "english") return window.BIS_LANG_ENGLISH || {};
    return null;
  }

  function isExcluded(el) {
    while (el) {
      if (el.id && EXCLUDE_IDS.indexOf(el.id) !== -1) return true;
      if (el.hasAttribute && el.hasAttribute("data-no-i18n")) return true;
      el = el.parentElement;
    }
    return false;
  }

  function translateTextNode(node, dict) {
    var parent = node.parentElement;
    if (!parent || SKIP_TAGS[parent.tagName]) return;
    if (isExcluded(parent)) return;

    if (!_originalsText.has(node)) {
      var raw = node.nodeValue;
      if (!raw || !raw.trim()) return;
      _originalsText.set(node, raw);
    }
    var original = _originalsText.get(node);
    var key = original.trim();
    if (!key) return;

    if (dict === null) {
      node.nodeValue = original;
      return;
    }
    if (Object.prototype.hasOwnProperty.call(dict, key)) {
      /* نحافظ على أي مسافات بيضاء محيطة بالنص الأصلي */
      var leading = original.match(/^\s*/)[0];
      var trailing = original.match(/\s*$/)[0];
      node.nodeValue = leading + dict[key] + trailing;
    } else {
      node.nodeValue = original;
    }
  }

  function translateAttr(el, attr, dict) {
    if (isExcluded(el)) return;
    var mapKey = "_i18nOrig_" + attr;
    var current = el.getAttribute(attr);
    if (current === null) return;

    if (!el[mapKey]) {
      if (!current.trim()) return;
      el[mapKey] = current;
    }
    var original = el[mapKey];
    var key = original.trim();

    if (dict === null) {
      el.setAttribute(attr, original);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(dict, key)) {
      el.setAttribute(attr, dict[key]);
    } else {
      el.setAttribute(attr, original);
    }
  }

  function walkAndTranslate(root, dict) {
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root, dict);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      translateTextNode(node, dict);
    }

    var attrRoots = root.nodeType === Node.ELEMENT_NODE ? [root] : [];
    var elems = attrRoots.concat(
      Array.prototype.slice.call(root.querySelectorAll ? root.querySelectorAll("*") : [])
    );
    elems.forEach(function (el) {
      ATTRS_TO_TRANSLATE.forEach(function (attr) {
        if (el.hasAttribute && el.hasAttribute(attr)) translateAttr(el, attr, dict);
      });
    });
  }

  function applyLanguage(lang) {
    if (VALID_LANGS.indexOf(lang) === -1) lang = "default";
    var dict = getDict(lang);
    if (document.body) walkAndTranslate(document.body, dict);
    localStorage.setItem(STORAGE_KEY, lang);
    document.dispatchEvent(new CustomEvent("bis-lang-changed", { detail: { lang: lang } }));
  }

  function getLanguage() {
    var saved = localStorage.getItem(STORAGE_KEY);
    return VALID_LANGS.indexOf(saved) !== -1 ? saved : "default";
  }

  function startObserver() {
    if (_observer) return;
    _observer = new MutationObserver(function (mutations) {
      var lang = getLanguage();
      if (lang === "default") return;
      var dict = getDict(lang);
      mutations.forEach(function (m) {
        m.addedNodes && m.addedNodes.forEach(function (n) {
          if (n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE) {
            walkAndTranslate(n, dict);
          }
        });
      });
    });
    _observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    startObserver();
    applyLanguage(getLanguage());
  }

  window.BISLang = {
    setLanguage: applyLanguage,
    getLanguage: getLanguage
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
