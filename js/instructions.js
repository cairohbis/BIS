/**
 * ══════════════════════════════════════════
 *   INSTRUCTIONS MODULE — تعليمات
 *   شروحات مميزات المنتدى — القراءة للجميع، الإنشاء/التعديل/الحذف للمالك فقط
 *
 *   ▸ ملف مستقل بالكامل — نفس معمارية military.js / grades.js
 *     (window.InstructionsModule.open/close + جذر ثابت في index.html)
 *   ▸ لا يُنشئ نسخة من الميزة: كل تعليمات مرتبطة بالميزة الأصلية عبر مفتاحها،
 *     والاسم والأيقونة تُقرأ حيّة من كارت الميزة في المنتدى (تتغير معه تلقائيًا)
 *   ▸ مجموعة Firestore: instructions/{featureKey}
 *       { featureKey, featureTitle, blocks:[{t:"h"|"p"|"img", v:string}],
 *         createdAt, updatedAt, updatedBy }
 *
 *   ▸ قواعد Firestore المطلوبة (أضفها في Rules — بدونها ستفشل الكتابة/القراءة):
 *
 *       match /instructions/{featureKey} {
 *         allow read: if isSignedIn();
 *         allow create, update, delete: if isOwner();
 *       }
 *     (أضفها قبل قاعدة match /{document=**} الأخيرة، بجوار militaryMaterials)
 * ══════════════════════════════════════════
 */

(function () {
  "use strict";

  if (window.__instructionsModuleLoaded) return;
  window.__instructionsModuleLoaded = true;

  window.InstructionsModule = window.InstructionsModule || {};

  const _FB = "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  async function _getFS() {
    const db = window.db;
    if (!db) throw new Error("Firebase غير متاح");
    return { db, ...(await import(_FB)) };
  }

  const COL           = "instructions";
  const CLOUD_NAME    = "dnbvvfita";
  const UPLOAD_PRESET = "university_upload";
  const MAX_IMG_MB    = 10;
  const MAX_BLOCKS    = 60;
  const MAX_TEXT      = 5000;

  function _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function _root() { return document.getElementById("instructions-app-root"); }
  function _isOwnerUser() { return !!(window.isOwner && window.isOwner()); }
  function _safeImg(u) { return typeof u === "string" && u.startsWith("https://res.cloudinary.com/"); }

  function _uploadImage(file, onProgress) {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); });
      xhr.addEventListener("load", () => {
        try {
          const d = JSON.parse(xhr.responseText);
          if (!d.secure_url) { reject(new Error(d?.error?.message || "فشل الرفع")); return; }
          resolve(d.secure_url);
        } catch (e) { reject(e); }
      });
      xhr.addEventListener("error", () => reject(new Error("خطأ في الشبكة")));
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);
      xhr.send(fd);
    });
  }

  /* ─────────────────────────────────────────
     المميزات: تُقرأ حيّة من كروت المنتدى الموجودة (لا نسخ، لا تعديل عليها)
  ───────────────────────────────────────── */
  function _deriveKey(card) {
    const explicit = card.getAttribute("data-feature");
    if (explicit) return explicit;
    const oc = card.getAttribute("onclick") || "";
    let m = oc.match(/openForumSection\(\s*['"]([^'"]+)['"]/);
    if (m) return m[1];
    m = oc.match(/window\.(\w+)Module/);
    if (m) return m[1].toLowerCase();
    return null;
  }

  function _features() {
    const out = [], seen = new Set();
    document.querySelectorAll("#forum-landing .forum-section-card").forEach(card => {
      if (card.hasAttribute("data-ins-self")) return;
      const key = _deriveKey(card);
      const title = card.querySelector(".forum-card-title")?.textContent.trim();
      if (!key || !title || seen.has(key)) return;
      seen.add(key);
      const icon = card.querySelector(".forum-card-icon");
      out.push({
        key, title,
        iconHTML: icon ? icon.outerHTML : `<div class="forum-card-icon"><i class="fa-solid fa-circle-info"></i></div>`
      });
    });
    return out;
  }
  function _featureByKey(key) { return _features().find(f => f.key === key) || null; }

  /* ─────────────────────────────────────────
     الحالة
  ───────────────────────────────────────── */
  let _unsub = null;
  let _docs  = {};                 // featureKey -> doc
  let _view  = "list";             // list | read | edit
  let _curKey = null;
  let _draft = null;               // { key, blocks, isNew, dirty }
  let _busy  = false;

  function _body()  { return document.getElementById("insBody"); }
  function _sortedDocs() {
    const order = _features().map(f => f.key);
    return Object.values(_docs).sort((a, b) => {
      const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
  }

  async function _startListener() {
    if (_unsub) return;
    try {
      const { db, collection, onSnapshot } = await _getFS();
      _unsub = onSnapshot(collection(db, COL), snap => {
        _docs = {};
        snap.docs.forEach(d => { _docs[d.id] = { id: d.id, ...d.data() }; });
        if (_view === "list") _renderList();
        else if (_view === "read") { if (_docs[_curKey]) _renderRead(); else _goList(); }
      }, () => _fail());
    } catch (e) { _fail(); }
  }
  function _fail() {
    const b = _body();
    if (b) b.innerHTML = `<div class="ins-empty"><div class="ins-empty-title">تعذّر تحميل التعليمات</div></div>`;
  }

  /* ─────────────────────────────────────────
     الهيكل
  ───────────────────────────────────────── */
  function _buildShell() {
    const root = _root();
    if (!root) return;
    root.innerHTML = `
      <div class="ins-overlay" onclick="window.InstructionsModule._back()"></div>
      <div class="ins-sheet">
        <div class="ins-header">
          <button class="ins-back-btn" onclick="window.InstructionsModule._back()"><i class="fa-solid fa-arrow-right"></i> رجوع</button>
          <div class="ins-title" id="insTitle"><i class="fa-solid fa-circle-info"></i> <span id="insTitleText">تعليمات</span></div>
          <button class="ins-add-btn" id="insAddBtn" onclick="window.InstructionsModule._openEditor()" style="display:none"><i class="fa-solid fa-plus"></i></button>
        </div>
        <div class="ins-body" id="insBody">
          <div class="ins-loading"><div class="ins-spinner"></div><span>جارِ التحميل...</span></div>
        </div>
      </div>`;
  }

  function _setHeader(title, showAdd) {
    const t = document.getElementById("insTitleText");
    if (t) t.textContent = title;
    const a = document.getElementById("insAddBtn");
    if (a) a.style.display = (showAdd && _isOwnerUser()) ? "" : "none";
  }

  function _goList() {
    _view = "list"; _curKey = null; _draft = null;
    _renderList();
  }

  /* ─────────────────────────────────────────
     القائمة
  ───────────────────────────────────────── */
  function _tileHTML(f, extra, cls) {
    return `<div class="ins-tile ${cls || ""}" ${extra || ""}>
      <div class="ins-tile-icon">${f.iconHTML}</div>
      <div class="ins-tile-title">${_esc(f.title)}</div>
    </div>`;
  }

  function _renderList() {
    _setHeader("تعليمات", true);
    const body = _body();
    if (!body) return;
    const owner = _isOwnerUser();
    const list = _sortedDocs();

    if (!list.length) {
      body.innerHTML = `
        <div class="ins-empty">
          <div class="ins-empty-icon"><i class="fa-solid fa-book-open"></i></div>
          <div class="ins-empty-title">لا توجد تعليمات بعد</div>
          <div class="ins-empty-sub">${owner ? "اضغط + لإضافة أول شرح" : "سيتم إضافة شروحات المميزات قريبًا"}</div>
        </div>`;
      return;
    }

    body.innerHTML = `
      <div class="ins-hint">اختر ميزة لقراءة طريقة استخدامها</div>
      <div class="ins-grid">
        ${list.map(d => {
          const f = _featureByKey(d.id) || {
            key: d.id, title: d.featureTitle || "ميزة",
            iconHTML: `<div class="forum-card-icon"><i class="fa-solid fa-circle-question"></i></div>`
          };
          const orphan = !_featureByKey(d.id);
          if (orphan && !owner) return "";
          const ownerBtns = owner ? `
            <div class="ins-tile-actions">
              <button class="ins-mini-btn" title="تعديل" onclick="event.stopPropagation();window.InstructionsModule._openEditor('${_esc(d.id)}')"><i class="fa-solid fa-pen"></i></button>
              <button class="ins-mini-btn ins-danger" title="حذف" onclick="event.stopPropagation();window.InstructionsModule._delete('${_esc(d.id)}')"><i class="fa-solid fa-trash"></i></button>
            </div>` : "";
          return `<div class="ins-tile${orphan ? " ins-orphan" : ""}" onclick="window.InstructionsModule._read('${_esc(d.id)}')">
            ${ownerBtns}
            <div class="ins-tile-icon">${f.iconHTML}</div>
            <div class="ins-tile-title">${_esc(f.title)}</div>
            ${orphan ? `<div class="ins-tile-sub">الميزة غير موجودة</div>` : `<div class="ins-tile-sub">${(d.blocks || []).length} عنصر</div>`}
          </div>`;
        }).join("")}
      </div>`;
  }

  /* ─────────────────────────────────────────
     القراءة
  ───────────────────────────────────────── */
  window.InstructionsModule._read = function (key) {
    if (!_docs[key]) return;
    _view = "read"; _curKey = key;
    _renderRead();
  };

  function _renderRead() {
    const d = _docs[_curKey];
    const body = _body();
    if (!d || !body) return;
    const f = _featureByKey(_curKey) || { title: d.featureTitle || "تعليمات", iconHTML: `<div class="forum-card-icon"><i class="fa-solid fa-circle-info"></i></div>` };
    _setHeader("تعليمات", false);
    const blocks = Array.isArray(d.blocks) ? d.blocks : [];
    body.scrollTop = 0;
    body.innerHTML = `
      <div class="ins-read">
        <div class="ins-read-hero">
          <div class="ins-tile-icon ins-hero-icon">${f.iconHTML}</div>
          <div class="ins-read-name">${_esc(f.title)}</div>
        </div>
        ${blocks.map(b => {
          if (b.t === "h")   return `<h3 class="ins-r-h">${_esc(b.v)}</h3>`;
          if (b.t === "p")   return `<p class="ins-r-p">${_esc(b.v)}</p>`;
          if (b.t === "img" && _safeImg(b.v)) return `<figure class="ins-r-fig"><img src="${_esc(b.v)}" alt="" loading="lazy" onclick="window.openLightbox && window.openLightbox(this.src)"></figure>`;
          return "";
        }).join("")}
      </div>`;
  }

  /* ─────────────────────────────────────────
     المحرر (المالك فقط)
  ───────────────────────────────────────── */
  window.InstructionsModule._openEditor = function (key) {
    if (!_isOwnerUser()) return;
    const existing = key && _docs[key];
    _draft = {
      key: key || null,
      blocks: existing ? JSON.parse(JSON.stringify(existing.blocks || [])) : [],
      isNew: !existing,
      dirty: false
    };
    _view = "edit";
    _renderEditor();
  };

  function _renderEditor() {
    if (!_isOwnerUser()) return;
    _setHeader(_draft.isNew ? "تعليمات جديدة" : "تعديل التعليمات", false);
    const body = _body();
    if (!body) return;
    const feats = _features();
    body.scrollTop = 0;
    body.innerHTML = `
      <div class="ins-editor">
        <div class="ins-step-label"><span class="ins-step-num">1</span> اختر الميزة</div>
        <div class="ins-grid ins-pick-grid" id="insPick">
          ${feats.map(f => `
            <div class="ins-tile ins-pick${_draft.key === f.key ? " selected" : ""}${_docs[f.key] ? " has-doc" : ""}" data-k="${_esc(f.key)}" onclick="window.InstructionsModule._pick('${_esc(f.key)}')">
              ${_docs[f.key] ? `<span class="ins-has-badge"><i class="fa-solid fa-check"></i></span>` : ""}
              <div class="ins-tile-icon">${f.iconHTML}</div>
              <div class="ins-tile-title">${_esc(f.title)}</div>
            </div>`).join("")}
        </div>

        <div class="ins-step-label"><span class="ins-step-num">2</span> اكتب التعليمات</div>
        <div id="insBlocks"></div>

        <div class="ins-add-bar">
          <button class="ins-add-chip" onclick="window.InstructionsModule._addBlock('h')"><i class="fa-solid fa-heading"></i> عنوان</button>
          <button class="ins-add-chip" onclick="window.InstructionsModule._addBlock('p')"><i class="fa-solid fa-align-right"></i> فقرة</button>
          <label class="ins-add-chip"><i class="fa-solid fa-image"></i> صورة
            <input type="file" accept="image/*" multiple class="ins-file-hidden" onchange="window.InstructionsModule._addImages(this)">
          </label>
        </div>
        <div class="ins-progress" id="insProg" style="display:none"><div class="ins-progress-bar" id="insProgBar"></div><span id="insProgTxt"></span></div>

        <div class="ins-actions">
          <button class="ins-btn-primary" id="insSaveBtn" onclick="window.InstructionsModule._save()"><i class="fa-solid fa-floppy-disk"></i> حفظ</button>
          <button class="ins-btn-cancel" onclick="window.InstructionsModule._cancelEdit()">إلغاء</button>
        </div>
      </div>`;
    _renderBlocks();
  }

  function _renderBlocks() {
    const wrap = document.getElementById("insBlocks");
    if (!wrap) return;
    if (!_draft.blocks.length) {
      wrap.innerHTML = `<div class="ins-blocks-empty">ابدأ بإضافة عنوان أو فقرة أو صورة من الأزرار بالأسفل</div>`;
      return;
    }
    const n = _draft.blocks.length;
    wrap.innerHTML = _draft.blocks.map((b, i) => {
      const label = b.t === "h" ? "عنوان" : b.t === "p" ? "فقرة" : "صورة";
      const icon  = b.t === "h" ? "fa-heading" : b.t === "p" ? "fa-align-right" : "fa-image";
      let content = "";
      if (b.t === "h") content = `<input type="text" class="ins-input" maxlength="200" placeholder="نص العنوان" value="${_esc(b.v)}" oninput="window.InstructionsModule._edit(${i},this.value)">`;
      else if (b.t === "p") content = `<textarea class="ins-input ins-textarea" rows="4" maxlength="${MAX_TEXT}" placeholder="اكتب الشرح هنا..." oninput="window.InstructionsModule._edit(${i},this.value);this.style.height='auto';this.style.height=this.scrollHeight+'px'">${_esc(b.v)}</textarea>`;
      else content = _safeImg(b.v) ? `<img class="ins-prev-img" src="${_esc(b.v)}" alt="">` : `<div class="ins-blocks-empty">صورة غير صالحة</div>`;
      return `<div class="ins-block">
        <div class="ins-block-head">
          <span class="ins-block-type"><i class="fa-solid ${icon}"></i> ${label}</span>
          <span class="ins-block-tools">
            <button class="ins-mini-btn" ${i === 0 ? "disabled" : ""} onclick="window.InstructionsModule._move(${i},-1)"><i class="fa-solid fa-arrow-up"></i></button>
            <button class="ins-mini-btn" ${i === n - 1 ? "disabled" : ""} onclick="window.InstructionsModule._move(${i},1)"><i class="fa-solid fa-arrow-down"></i></button>
            <button class="ins-mini-btn ins-danger" onclick="window.InstructionsModule._removeBlock(${i})"><i class="fa-solid fa-trash"></i></button>
          </span>
        </div>
        ${content}
      </div>`;
    }).join("");
    wrap.querySelectorAll("textarea.ins-textarea").forEach(t => { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; });
  }

  window.InstructionsModule._pick = function (key) {
    if (!_isOwnerUser() || !_draft || _draft.key === key) return;
    const hasContent = _draft.blocks.some(b => (b.v || "").trim());
    if (_docs[key]) {
      if (hasContent && _draft.dirty && !window.confirm("لهذه الميزة تعليمات محفوظة بالفعل. تحميلها سيستبدل ما كتبته الآن. متابعة؟")) return;
      _draft.blocks = JSON.parse(JSON.stringify(_docs[key].blocks || []));
      _draft.isNew = false;
      _draft.dirty = false;
    } else if (!_draft.isNew) {
      // كنّا نعدّل ميزة موجودة ثم اخترنا غيرها: تصبح حالة "جديد" بنفس المحتوى الحالي
      _draft.isNew = true;
    }
    _draft.key = key;
    document.querySelectorAll("#insPick .ins-pick").forEach(el => el.classList.toggle("selected", el.getAttribute("data-k") === key));
    _renderBlocks();
  };

  window.InstructionsModule._addBlock = function (t) {
    if (!_isOwnerUser() || !_draft) return;
    if (_draft.blocks.length >= MAX_BLOCKS) { window.toast?.("وصلت للحد الأقصى من العناصر", "error"); return; }
    _draft.blocks.push({ t, v: "" });
    _draft.dirty = true;
    _renderBlocks();
    const wrap = document.getElementById("insBlocks");
    const last = wrap && wrap.lastElementChild && wrap.lastElementChild.querySelector("input,textarea");
    if (last) last.focus();
  };

  window.InstructionsModule._edit = function (i, val) {
    if (!_draft || !_draft.blocks[i]) return;
    _draft.blocks[i].v = val;
    _draft.dirty = true;
  };

  window.InstructionsModule._move = function (i, dir) {
    if (!_draft) return;
    const j = i + dir;
    if (j < 0 || j >= _draft.blocks.length) return;
    const b = _draft.blocks;
    [b[i], b[j]] = [b[j], b[i]];
    _draft.dirty = true;
    _renderBlocks();
  };

  window.InstructionsModule._removeBlock = function (i) {
    if (!_draft) return;
    _draft.blocks.splice(i, 1);
    _draft.dirty = true;
    _renderBlocks();
  };

  window.InstructionsModule._addImages = async function (inp) {
    if (!_isOwnerUser() || !_draft) return;
    const files = Array.from(inp.files || []);
    inp.value = "";
    if (!files.length) return;
    const prog = document.getElementById("insProg");
    const bar  = document.getElementById("insProgBar");
    const txt  = document.getElementById("insProgTxt");
    if (prog) prog.style.display = "flex";
    _busy = true;
    for (let k = 0; k < files.length; k++) {
      const f = files[k];
      if (!f.type.startsWith("image/")) { window.toast?.("الملف ليس صورة: " + f.name, "error"); continue; }
      if (f.size > MAX_IMG_MB * 1024 * 1024) { window.toast?.(`الصورة أكبر من ${MAX_IMG_MB}MB: ${f.name}`, "error"); continue; }
      if (_draft.blocks.length >= MAX_BLOCKS) { window.toast?.("وصلت للحد الأقصى من العناصر", "error"); break; }
      try {
        const url = await _uploadImage(f, pct => {
          if (bar) bar.style.width = pct + "%";
          if (txt) txt.textContent = `صورة ${k + 1}/${files.length} — ${pct}%`;
        });
        _draft.blocks.push({ t: "img", v: url });
        _draft.dirty = true;
        _renderBlocks();
      } catch (e) {
        window.toast?.("تعذر رفع الصورة", "error");
      }
    }
    _busy = false;
    if (prog) prog.style.display = "none";
    if (bar) bar.style.width = "0%";
  };

  window.InstructionsModule._save = async function () {
    if (!_isOwnerUser() || !_draft || _busy) return;
    if (!_draft.key) { window.toast?.("اختر الميزة أولاً", "error"); return; }
    const blocks = _draft.blocks
      .map(b => ({ t: b.t, v: (b.v || "").trim() }))
      .filter(b => b.v && (b.t !== "img" || _safeImg(b.v)))
      .map(b => ({ t: b.t, v: b.t === "img" ? b.v : b.v.slice(0, MAX_TEXT) }));
    if (!blocks.length) { window.toast?.("أضف محتوى للتعليمات أولاً", "error"); return; }

    const f = _featureByKey(_draft.key);
    const btn = document.getElementById("insSaveBtn");
    if (btn) btn.disabled = true;
    try {
      const { db, doc, setDoc, serverTimestamp } = await _getFS();
      const payload = {
        featureKey:   _draft.key,
        featureTitle: f ? f.title : (_docs[_draft.key]?.featureTitle || ""),
        blocks,
        updatedAt:    serverTimestamp(),
        updatedBy:    window.currentUser?.uid || ""
      };
      if (!_docs[_draft.key]) payload.createdAt = serverTimestamp();
      await setDoc(doc(db, COL, _draft.key), payload, { merge: true });
      window.toast?.("تم الحفظ ✓");
      _goList();
    } catch (e) {
      window.toast?.("فشل الحفظ", "error");
      if (btn) btn.disabled = false;
    }
  };

  window.InstructionsModule._cancelEdit = function () {
    if (_draft && _draft.dirty && !window.confirm("تجاهل التغييرات غير المحفوظة؟")) return;
    _goList();
  };

  window.InstructionsModule._delete = async function (key) {
    if (!_isOwnerUser()) return;
    if (!window.confirm("حذف تعليمات هذه الميزة نهائيًا؟\n(الميزة نفسها لا تتأثر، والصور تبقى على Cloudinary)")) return;
    try {
      const { db, doc, deleteDoc } = await _getFS();
      await deleteDoc(doc(db, COL, key));
      window.toast?.("تم الحذف");
    } catch (e) {
      window.toast?.("فشل الحذف", "error");
    }
  };

  /* ─────────────────────────────────────────
     رجوع / فتح / إغلاق
  ───────────────────────────────────────── */
  window.InstructionsModule._back = function () {
    if (_view === "edit") { window.InstructionsModule._cancelEdit(); return; }
    if (_view === "read") { _goList(); return; }
    window.InstructionsModule.close();
  };

  window.InstructionsModule.open = function () {
    const root = _root();
    if (!root) return;
    _view = "list"; _curKey = null; _draft = null; _busy = false;
    root.classList.add("instructions-open");
    root.style.display = "flex";
    _buildShell();
    _setHeader("تعليمات", true);
    _startListener();
  };

  window.InstructionsModule.close = function () {
    const root = _root();
    if (!root) return;
    root.classList.remove("instructions-open");
    root.style.display = "none";
    root.innerHTML = "";
    if (_unsub) { _unsub(); _unsub = null; }
    _docs = {}; _draft = null; _view = "list"; _curKey = null;
  };

})();
