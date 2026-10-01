/**
 * ══════════════════════════════════════════
 *   مستنداتي — World-scoped: مواد + عناصر متنوعة لكل عالم (worldId)
 *   صلاحيات مطابقة لشيتاتي بالحرف: الأدمن/الأونر فقط يكتبون،
 *   المستخدم العادي قراءة/تصفح فقط — بدون أي كتابة.
 *
 *   ▸ المصادر:
 *       docSubjects/{subjectId}
 *         { id, worldId, name, code, status: active|archived,
 *           itemsCount, createdAt, archivedAt, createdBy }
 *       docItems/{itemId}
 *         { id, subjectId, worldId, order,
 *           type: image|pdf|voice|link|text,
 *           url, text, fileName, duration, createdAt, createdBy }
 *
 *   ▸ World Isolation: كل Query هنا يحمل where("worldId", ...) صراحة
 *     من أول سطر — الدرس المستفاد من شيتاتي (الاستعلام الناقص كان
 *     سبب ظهور/اختفاء البيانات بين الحسابات).
 *   ▸ الصور/PDF/الصوت: uploadToCloudinaryWithProgress() من
 *     js/upload-engine.js كما هي — بدون أي تعديل على الملف.
 *   ▸ تسجيل الصوت: نفس منطق MediaRecorder من js/chat-core.js
 *     (تفاوض mimeType + إيقاف تلقائي بعد 3 دقائق) — منسوخ هنا
 *     كوحدة مستقلة بدون أي تعديل أو استيراد من chat-core.js.
 *   ▸ الترقيم: runTransaction حقيقي (itemsCount + order)، بدون
 *     إعادة ترقيم بعد الحذف — نفس نمط شيتاتي بالحرف.
 *   ▸ الفلاتر (الكل/صور/PDF/صوتيات/روابط/الأحدث/الأقدم) محسومة
 *     كلها بـ Composite Indexes معروفة سلفًا في firestore.indexes.json
 *     قبل أي اختبار — مش بالتجربة والخطأ.
 * ══════════════════════════════════════════
 */

(function () {
  "use strict";
  if (window.__myDocsModuleLoaded) return;
  window.__myDocsModuleLoaded = true;

  const _FB = "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  const COL_SUBJECTS = "docSubjects";
  const COL_ITEMS = "docItems";

  async function _fs() {
    if (!window.db) throw new Error("Firebase غير متاح");
    return { db: window.db, ...(await import(_FB)) };
  }
  function _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function _isAdmin() { return !!(window.isAdmin && window.isAdmin()); }
  function _uid() { return window.currentUser?.uid || (window.auth && window.auth.currentUser && window.auth.currentUser.uid) || ""; }
  function _worldId() { return (typeof window.activeWorldContext === "function") ? window.activeWorldContext() : null; }
  function _num(v) { const n = Number(v); return isFinite(n) ? n : 0; }
  function _fmtDateTime(ts) {
    try {
      const d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
      if (!d) return "";
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    } catch (e) { return ""; }
  }
  function _fmtDuration(s) {
    s = Math.round(_num(s));
    const m = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
  }
  function _linkIcon(url) {
    try {
      const h = new URL(url).hostname.replace("www.", "");
      if (/youtube\.com|youtu\.be/.test(h)) return { icon: "fa-brands fa-youtube", color: "#ff4444" };
      if (/drive\.google\.com/.test(h)) return { icon: "fa-brands fa-google-drive", color: "#34a853" };
      if (/docs\.google\.com/.test(h)) return { icon: "fa-brands fa-google", color: "#4285f4" };
      if (/github\.com/.test(h)) return { icon: "fa-brands fa-github", color: "#e8edf5" };
      if (/t\.me|telegram\.me/.test(h)) return { icon: "fa-brands fa-telegram", color: "#26a5e4" };
      return { icon: "fa-solid fa-link", color: "#60a5fa" };
    } catch (e) { return { icon: "fa-solid fa-link", color: "#60a5fa" }; }
  }
  const TYPE_LABEL = { image: "صورة", pdf: "PDF", voice: "تسجيل صوتي", link: "رابط", text: "ملاحظة" };

  /* ─────────────────────────────────────────
     الحالة
  ───────────────────────────────────────── */
  let _view = "home";        // home | subject | subjectForm | itemForm
  let _tab = "active";       // active | archive (داخل home)
  let _filter = "all";       // all | image | pdf | voice | link | newest | oldest
  let _subjects = [];
  let _items = [];
  let _loaded = false;
  let _loadedUid = null;     // الحساب اللي اتحمّلت بياناته آخر مرة
  let _currentSubjectId = null;
  let _draftSubject = null;  // {id?, name, code}
  let _draftItem = null;     // {type, text, url, fileName, duration, _uploading}
  let _busy = false;

  function _root() { return document.getElementById("mydocs-app-root"); }
  function _body() { return document.getElementById("mdBody"); }

  function _buildShell() {
    const root = _root();
    if (!root) return;
    root.innerHTML = `
      <div class="md-overlay" onclick="window.MyDocsModule._back()"></div>
      <div class="md-sheet">
        <div class="md-header">
          <button class="md-back-btn" onclick="window.MyDocsModule._back()"><i class="fa-solid fa-arrow-right"></i> رجوع</button>
          <div class="md-title"><i class="fa-solid fa-folder-open"></i> <span id="mdTitleText">مستنداتي</span></div>
          <span id="mdHeaderAction"></span>
        </div>
        <div class="md-body" id="mdBody"><div class="md-loading"><div class="md-spin"></div></div></div>
      </div>`;
  }
  function _setTitle(t) { const el = document.getElementById("mdTitleText"); if (el) el.textContent = t; }
  function _setHeaderAction(html) { const el = document.getElementById("mdHeaderAction"); if (el) el.innerHTML = html || ""; }

  /* ─────────────────────────────────────────
     تحميل المواد
  ───────────────────────────────────────── */
  async function _load() {
    const body = _body();
    if (body) body.innerHTML = `<div class="md-loading"><div class="md-spin"></div></div>`;
    try {
      const { db, collection, getDocs, query, where } = await _fs();
      const wid = _worldId();
      const snap = await getDocs(query(collection(db, COL_SUBJECTS), where("worldId", "==", wid)));
      _subjects = [];
      snap.forEach((d) => { const data = d.data(); if (wid && data.worldId === wid) _subjects.push({ id: d.id, ...data }); });
      _loaded = true;
      _loadedUid = _uid();
      _renderHome();
    } catch (e) {
      if (body) body.innerHTML = `<div class="md-empty"><div class="md-empty-title">تعذّر تحميل مستنداتي</div></div>`;
    }
  }

  function _renderHome() {
    _view = "home"; _draftSubject = null; _draftItem = null;
    _setTitle("مستنداتي");
    const admin = _isAdmin();
    _setHeaderAction(admin ? `<button class="md-add-btn" onclick="window.MyDocsModule._newSubject()"><i class="fa-solid fa-plus"></i></button>` : "");
    const body = _body();
    if (!body) return;
    const list = _subjects.filter((s) => (_tab === "archive" ? s.status === "archived" : s.status !== "archived"));
    body.innerHTML = `
      <div class="md-tabs">
        <button class="md-tab ${_tab === "active" ? "on" : ""}" onclick="window.MyDocsModule._setTab('active')">المواد الحالية</button>
        <button class="md-tab ${_tab === "archive" ? "on" : ""}" onclick="window.MyDocsModule._setTab('archive')">الأرشيف</button>
      </div>
      ${!list.length ? `
        <div class="md-empty">
          <div class="md-empty-icon"><i class="fa-solid fa-folder"></i></div>
          <div class="md-empty-title">${_tab === "archive" ? "لا توجد مواد مؤرشفة" : (admin ? "لسه مفيش مواد مضافة" : "لا توجد مواد متاحة حاليًا")}</div>
          ${admin && _tab === "active" ? `<button class="md-btn-primary" onclick="window.MyDocsModule._newSubject()"><i class="fa-solid fa-plus"></i> إضافة مادة</button>` : ""}
        </div>` : `
        <div class="md-subjects-grid">
          ${list.map((s) => `
            <div class="md-subject-card" onclick="window.MyDocsModule._openSubject('${s.id}')">
              <div class="md-subject-name">${_esc(s.name)}</div>
              <div class="md-subject-meta">كود المادة: ${_esc(s.code)}</div>
              <div class="md-subject-count"><i class="fa-solid fa-layer-group"></i> ${_num(s.activeItemsCount)} عنصر</div>
            </div>`).join("")}
        </div>`}
    `;
  }
  window.MyDocsModule = window.MyDocsModule || {};
  window.MyDocsModule._setTab = function (t) { _tab = t; _renderHome(); };

  /* ─────────────────────────────────────────
     استعلام العناصر — كل الفروع فيها worldId صراحة
  ───────────────────────────────────────── */
  async function _queryItems(db, { collection, getDocs, query, where, orderBy }, subjectId, worldId, filter) {
    const base = [where("subjectId", "==", subjectId), where("worldId", "==", worldId)];
    if (filter === "image" || filter === "pdf" || filter === "voice" || filter === "link") {
      base.push(where("type", "==", filter));
      base.push(orderBy("order", "asc"));
    } else if (filter === "newest") {
      base.push(orderBy("order", "desc"));
    } else {
      // "all" | "oldest"
      base.push(orderBy("order", "asc"));
    }
    const snap = await getDocs(query(collection(db, COL_ITEMS), ...base));
    const out = [];
    snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
    return out;
  }

  window.MyDocsModule._openSubject = async function (subjectId) {
    _currentSubjectId = subjectId;
    _filter = "all";
    _view = "subject";
    const subj = _subjects.find((s) => s.id === subjectId);
    _setTitle(subj ? subj.name : "المادة");
    const body = _body();
    if (body) body.innerHTML = `<div class="md-loading"><div class="md-spin"></div></div>`;
    try {
      const fns = await _fs();
      const subjNow = _subjects.find((s) => s.id === subjectId);
      _items = await _queryItems(fns.db, fns, subjectId, subjNow ? subjNow.worldId : _worldId(), _filter);
      _renderSubject();
    } catch (e) {
      if (body) body.innerHTML = `<div class="md-empty"><div class="md-empty-title">تعذّر تحميل محتوى المادة</div></div>`;
    }
  };

  window.MyDocsModule._setFilter = async function (f) {
    if (!_currentSubjectId) return;
    _filter = f;
    const body = _body();
    if (body) body.innerHTML = `<div class="md-loading"><div class="md-spin"></div></div>`;
    try {
      const fns = await _fs();
      const subj = _subjects.find((s) => s.id === _currentSubjectId);
      _items = await _queryItems(fns.db, fns, _currentSubjectId, subj ? subj.worldId : _worldId(), _filter);
      _renderSubject();
    } catch (e) {
      if (body) body.innerHTML = `<div class="md-empty"><div class="md-empty-title">تعذّر تحميل محتوى المادة</div></div>`;
    }
  };

  const FILTERS = [
    ["all", "الكل"], ["image", "صور"], ["pdf", "PDF"], ["voice", "صوتيات"],
    ["link", "روابط"], ["newest", "الأحدث"], ["oldest", "الأقدم"],
  ];

  function _renderSubject() {
    _view = "subject";
    const subj = _subjects.find((s) => s.id === _currentSubjectId);
    if (!subj) { _renderHome(); return; }
    const admin = _isAdmin();
    const archived = subj.status === "archived";
    _setTitle(subj.name);
    _setHeaderAction(admin ? `
      <div class="md-subject-actions">
        <button class="md-mini-btn" title="تعديل المادة" onclick="window.MyDocsModule._editSubject('${subj.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="md-mini-btn" title="${archived ? "إعادة فتح" : "أرشفة"}" onclick="window.MyDocsModule._${archived ? "confirmReopen" : "confirmArchive"}('${subj.id}')"><i class="fa-solid ${archived ? "fa-box-open" : "fa-box-archive"}"></i></button>
      </div>` : "");

    const body = _body();
    if (!body) return;
    body.innerHTML = `
      <div class="md-subject-head">
        <div class="md-subject-head-title">${_esc(subj.name)}${archived ? `<span class="md-archived-badge">مؤرشفة</span>` : ""}</div>
        <div class="md-subject-head-sub">كود المادة: ${_esc(subj.code)}</div>
      </div>
      <div class="md-filters">
        ${FILTERS.map(([k, label]) => `<button class="md-filter-chip ${_filter === k ? "on" : ""}" onclick="window.MyDocsModule._setFilter('${k}')">${label}</button>`).join("")}
      </div>
      ${admin && !archived ? `<button class="md-btn-primary md-add-item-btn" onclick="window.MyDocsModule._newItem()"><i class="fa-solid fa-plus"></i> إضافة عنصر</button>` : ""}
      ${!_items.length ? `
        <div class="md-empty">
          <div class="md-empty-icon"><i class="fa-solid fa-inbox"></i></div>
          <div class="md-empty-title">لا يوجد محتوى هنا</div>
        </div>` : `
        <div class="md-items-list">
          ${_items.map((it) => _renderItemCard(it, admin)).join("")}
        </div>`}
    `;
  }

  function _renderItemCard(it, admin) {
    let body = "";
    if (it.type === "image") {
      body = `
        <div class="md-item-thumb" onclick="window.open('${it.url}','_blank')"><img src="${it.url}" alt=""></div>
        ${it.text ? `<div class="md-item-caption">${_esc(it.text)}</div>` : ""}`;
    } else if (it.type === "pdf") {
      body = `
        <div class="md-item-file" onclick="window.open('${it.url}','_blank')">
          <div class="md-item-file-icon md-pdf"><i class="fa-solid fa-file-pdf"></i></div>
          <div class="md-item-file-info">
            <div class="md-item-file-name">${_esc(it.fileName || "ملف PDF")}</div>
            <div class="md-item-file-hint">فتح / تحميل</div>
          </div>
        </div>`;
    } else if (it.type === "voice") {
      body = `
        <div class="md-item-voice">
          <audio controls src="${it.url}"></audio>
          <div class="md-item-voice-dur">${_fmtDuration(it.duration)}</div>
        </div>`;
    } else if (it.type === "link") {
      const li = _linkIcon(it.url);
      body = `
        <div class="md-item-file" onclick="window.open('${it.url}','_blank')">
          <div class="md-item-file-icon" style="color:${li.color}"><i class="${li.icon}"></i></div>
          <div class="md-item-file-info">
            <div class="md-item-file-name">${_esc(it.text || it.url)}</div>
            <div class="md-item-file-hint">فتح الرابط</div>
          </div>
        </div>`;
    } else {
      body = `<div class="md-item-text">${_esc(it.text)}</div>`;
    }
    return `
      <div class="md-item-card">
        <div class="md-item-type-tag">${TYPE_LABEL[it.type] || it.type}</div>
        ${body}
        ${admin ? `<button class="md-mini-btn md-danger md-item-delete" title="حذف" onclick="window.MyDocsModule._deleteItem('${it.id}')"><i class="fa-solid fa-trash"></i></button>` : ""}
      </div>`;
  }

  /* ─────────────────────────────────────────
     نموذج مادة (إضافة/تعديل) — أدمن فقط
  ───────────────────────────────────────── */
  window.MyDocsModule._newSubject = function () {
    if (!_isAdmin()) return;
    _draftSubject = { name: "", code: "" };
    _renderSubjectForm();
  };
  window.MyDocsModule._editSubject = function (id) {
    if (!_isAdmin()) return;
    const s = _subjects.find((x) => x.id === id);
    if (!s) return;
    _draftSubject = { id: s.id, name: s.name, code: s.code };
    _renderSubjectForm();
  };
  function _renderSubjectForm() {
    _view = "subjectForm";
    _setTitle(_draftSubject.id ? "تعديل مادة" : "إضافة مادة");
    _setHeaderAction("");
    const body = _body();
    if (!body) return;
    body.innerHTML = `
      <div class="md-form">
        <label class="md-label">اسم المادة</label>
        <input class="md-input" value="${_esc(_draftSubject.name)}" oninput="window.MyDocsModule._setSubjField('name', this.value)">
        <label class="md-label">كود المادة</label>
        <input class="md-input" value="${_esc(_draftSubject.code)}" oninput="window.MyDocsModule._setSubjField('code', this.value)">
        <div class="md-form-actions">
          <button class="md-btn-primary" onclick="window.MyDocsModule._saveSubject()"><i class="fa-solid fa-floppy-disk"></i> حفظ المادة</button>
          <button class="md-btn-cancel" onclick="window.MyDocsModule._cancelForm()">إلغاء</button>
        </div>
      </div>`;
  }
  window.MyDocsModule._setSubjField = function (k, v) { if (_draftSubject) _draftSubject[k] = v; };
  window.MyDocsModule._cancelForm = function () {
    if (_currentSubjectId) _renderSubject(); else _renderHome();
  };
  window.MyDocsModule._saveSubject = async function () {
    if (_busy || !_draftSubject) return;
    const name = (_draftSubject.name || "").trim();
    const code = (_draftSubject.code || "").trim();
    if (!name) return;
    _busy = true;
    try {
      const { db, doc, addDoc, updateDoc, collection, serverTimestamp } = await _fs();
      if (_draftSubject.id) {
        await updateDoc(doc(db, COL_SUBJECTS, _draftSubject.id), { name, code });
      } else {
        const wid = _worldId();
        await addDoc(collection(db, COL_SUBJECTS), {
          worldId: wid, name, code, status: "active", itemsCount: 0, activeItemsCount: 0,
          createdAt: serverTimestamp(), archivedAt: null, createdBy: _uid(),
        });
      }
      const savedId = _draftSubject.id;
      await _load();
      if (savedId) window.MyDocsModule._openSubject(savedId);
    } catch (e) {
    } finally { _busy = false; }
  };

  /* ─────────────────────────────────────────
     نموذج عنصر (إضافة) — أدمن فقط
  ───────────────────────────────────────── */
  window.MyDocsModule._newItem = function () {
    if (!_isAdmin() || !_currentSubjectId) return;
    _draftItem = { type: null, text: "", url: "", fileName: "", duration: 0 };
    _renderItemForm();
  };

  function _renderItemForm() {
    _view = "itemForm";
    _setTitle("إضافة عنصر");
    _setHeaderAction("");
    const body = _body();
    if (!body) return;
    if (!_draftItem.type) {
      body.innerHTML = `
        <div class="md-type-picker">
          <button class="md-type-btn" onclick="window.MyDocsModule._pickType('image')"><i class="fa-solid fa-image"></i> صورة</button>
          <button class="md-type-btn" onclick="window.MyDocsModule._pickType('pdf')"><i class="fa-solid fa-file-pdf"></i> PDF</button>
          <button class="md-type-btn" onclick="window.MyDocsModule._pickType('link')"><i class="fa-solid fa-link"></i> رابط</button>
          <button class="md-type-btn" onclick="window.MyDocsModule._pickType('text')"><i class="fa-solid fa-note-sticky"></i> نص</button>
          <button class="md-type-btn" onclick="window.MyDocsModule._pickType('voice')"><i class="fa-solid fa-microphone"></i> تسجيل صوتي</button>
        </div>
        <div class="md-form-actions"><button class="md-btn-cancel" onclick="window.MyDocsModule._cancelForm()">إلغاء</button></div>`;
      return;
    }
    if (_draftItem.type === "image" || _draftItem.type === "pdf") {
      body.innerHTML = `
        <div class="md-form">
          <label class="md-label">${_draftItem.type === "image" ? "اختر صورة" : "اختر ملف PDF"}</label>
          <input type="file" class="md-file-input" accept="${_draftItem.type === "image" ? "image/*" : "application/pdf"}" onchange="window.MyDocsModule._pickFile(this.files[0])">
          ${_draftItem.type === "image" ? `
            <label class="md-label">تعليق (اختياري)</label>
            <input class="md-input" oninput="window.MyDocsModule._setItemField('text', this.value)">` : ""}
          <div id="mdUploadProgress"></div>
          ${_draftItem.url ? `<div class="md-upload-ok"><i class="fa-solid fa-check"></i> تم الرفع</div>` : ""}
          <div class="md-form-actions">
            <button class="md-btn-primary" onclick="window.MyDocsModule._saveItem()"><i class="fa-solid fa-floppy-disk"></i> إضافة</button>
            <button class="md-btn-cancel" onclick="window.MyDocsModule._cancelForm()">إلغاء</button>
          </div>
        </div>`;
    } else if (_draftItem.type === "link") {
      body.innerHTML = `
        <div class="md-form">
          <label class="md-label">الرابط</label>
          <input class="md-input" dir="ltr" oninput="window.MyDocsModule._setItemField('url', this.value)">
          <label class="md-label">عنوان (اختياري)</label>
          <input class="md-input" oninput="window.MyDocsModule._setItemField('text', this.value)">
          <div class="md-form-actions">
            <button class="md-btn-primary" onclick="window.MyDocsModule._saveItem()"><i class="fa-solid fa-floppy-disk"></i> إضافة</button>
            <button class="md-btn-cancel" onclick="window.MyDocsModule._cancelForm()">إلغاء</button>
          </div>
        </div>`;
    } else if (_draftItem.type === "text") {
      body.innerHTML = `
        <div class="md-form">
          <label class="md-label">نص الملاحظة</label>
          <textarea class="md-input md-textarea" oninput="window.MyDocsModule._setItemField('text', this.value)"></textarea>
          <div class="md-form-actions">
            <button class="md-btn-primary" onclick="window.MyDocsModule._saveItem()"><i class="fa-solid fa-floppy-disk"></i> إضافة</button>
            <button class="md-btn-cancel" onclick="window.MyDocsModule._cancelForm()">إلغاء</button>
          </div>
        </div>`;
    } else if (_draftItem.type === "voice") {
      body.innerHTML = `
        <div class="md-form">
          <div class="md-rec-box">
            <button class="md-rec-btn" id="mdRecBtn" onclick="window.MyDocsModule._toggleRecording()"><i class="fa-solid fa-microphone"></i></button>
            <div class="md-rec-timer" id="mdRecTimer">0:00</div>
          </div>
          <div id="mdUploadProgress"></div>
          ${_draftItem.url ? `<div class="md-upload-ok"><i class="fa-solid fa-check"></i> تم رفع التسجيل (${_fmtDuration(_draftItem.duration)})</div>` : ""}
          <div class="md-form-actions">
            <button class="md-btn-primary" onclick="window.MyDocsModule._saveItem()"><i class="fa-solid fa-floppy-disk"></i> إضافة</button>
            <button class="md-btn-cancel" onclick="window.MyDocsModule._cancelForm()">إلغاء</button>
          </div>
        </div>`;
    }
  }
  window.MyDocsModule._pickType = function (t) { _draftItem.type = t; _renderItemForm(); };
  window.MyDocsModule._setItemField = function (k, v) { if (_draftItem) _draftItem[k] = v; };

  window.MyDocsModule._pickFile = function (file) {
    if (!file || !_draftItem) return;
    const prog = document.getElementById("mdUploadProgress");
    if (prog) prog.innerHTML = `<div class="md-upload-pct">0%</div>`;
    _draftItem.fileName = file.name;
    window.uploadToCloudinaryWithProgress(file, (p) => {
      if (prog && p.pct != null) prog.innerHTML = `<div class="md-upload-pct">${p.pct}%</div>`;
    }).then((res) => {
      _draftItem.url = res.url;
      if (prog) prog.innerHTML = `<div class="md-upload-pct md-ok-pct"><i class="fa-solid fa-check"></i> تم الرفع</div>`;
    }).catch(() => {
      if (prog) prog.innerHTML = `<div class="md-upload-pct md-fail-pct">فشل الرفع</div>`;
    });
  };

  /* ─────────────────────────────────────────
     تسجيل صوتي — نفس منطق chat-core.js (MediaRecorder)
     منسوخ هنا كوحدة مستقلة، بدون أي تعديل أو استيراد
     من js/chat-core.js.
  ───────────────────────────────────────── */
  let _mediaRecorder = null;
  let _audioChunks = [];
  let _recStream = null;
  let _recTimerHandle = null;
  let _recSeconds = 0;
  let _isRecording = false;

  function _recFmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
  }
  function _recStartTimer() {
    _recSeconds = 0;
    const t = document.getElementById("mdRecTimer");
    if (t) t.textContent = "0:00";
    _recTimerHandle = setInterval(() => {
      _recSeconds++;
      const el = document.getElementById("mdRecTimer");
      if (el) el.textContent = _recFmtTime(_recSeconds);
      if (_recSeconds >= 180) window.MyDocsModule._toggleRecording(); // إيقاف تلقائي بعد 3 دقائق
    }, 1000);
  }
  function _recStopTimer() { clearInterval(_recTimerHandle); _recTimerHandle = null; }

  window.MyDocsModule._toggleRecording = async function () {
    const btn = document.getElementById("mdRecBtn");
    if (!_isRecording) {
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (e) { return; }
      _recStream = stream;
      _audioChunks = [];
      _isRecording = true;
      if (btn) btn.classList.add("recording");
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4"
        : "audio/ogg";
      _mediaRecorder = new MediaRecorder(stream, { mimeType });
      _mediaRecorder.addEventListener("dataavailable", (e) => { if (e.data && e.data.size > 0) _audioChunks.push(e.data); });
      _mediaRecorder.addEventListener("stop", () => { stream.getTracks().forEach((t) => t.stop()); });
      _mediaRecorder.start(200);
      _recStartTimer();
    } else {
      _isRecording = false;
      if (btn) btn.classList.remove("recording");
      _recStopTimer();
      const finalSeconds = _recSeconds;
      const capturedMime = _mediaRecorder.mimeType || "audio/webm";
      const capturedRecorder = _mediaRecorder;
      await new Promise((resolve) => {
        capturedRecorder.addEventListener("stop", resolve, { once: true });
        capturedRecorder.stop();
      });
      const blob = new Blob(_audioChunks, { type: capturedMime });
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: capturedMime });
      _draftItem.duration = finalSeconds;
      const prog = document.getElementById("mdUploadProgress");
      if (prog) prog.innerHTML = `<div class="md-upload-pct">0%</div>`;
      try {
        const res = await window.uploadToCloudinaryWithProgress(file, (p) => {
          if (prog && p.pct != null) prog.innerHTML = `<div class="md-upload-pct">${p.pct}%</div>`;
        });
        _draftItem.url = res.url;
        _renderItemForm();
      } catch (e) {
        if (prog) prog.innerHTML = `<div class="md-upload-pct md-fail-pct">فشل رفع التسجيل</div>`;
      }
    }
  };

  window.MyDocsModule._saveItem = async function () {
    if (_busy || !_draftItem || !_currentSubjectId) return;
    const type = _draftItem.type;
    if ((type === "image" || type === "pdf" || type === "voice") && !_draftItem.url) return;
    if (type === "link" && !(_draftItem.url || "").trim()) return;
    if (type === "text" && !(_draftItem.text || "").trim()) return;
    _busy = true;
    try {
      const { db, doc, collection, runTransaction, serverTimestamp, increment } = await _fs();
      const wid = _worldId();
      const subjectId = _currentSubjectId;
      await runTransaction(db, async (tx) => {
        const subjRef = doc(db, COL_SUBJECTS, subjectId);
        const subjSnap = await tx.get(subjRef);
        if (!subjSnap.exists()) throw new Error("subject-missing");
        // itemsCount هنا عدّاد ترقيم فقط (order) ولا يُنقَص أبدًا — نفس انضباط
        // شيتاتي بالحرف. activeItemsCount عدّاد منفصل للعرض الحي بس، بيزيد
        // وينقص مع الإضافة/الحذف، وما له أي علاقة بتوليد order.
        const newOrder = (_num(subjSnap.data().itemsCount) || 0) + 1;
        const itemRef = doc(collection(db, COL_ITEMS));
        tx.set(itemRef, {
          subjectId, worldId: wid, order: newOrder, type,
          url: _draftItem.url || null,
          text: _draftItem.text || null,
          fileName: _draftItem.fileName || null,
          duration: _draftItem.duration || null,
          createdAt: serverTimestamp(), createdBy: _uid(),
        });
        tx.update(subjRef, { itemsCount: newOrder, activeItemsCount: increment(1) });
      });
      await _load();
      await window.MyDocsModule._openSubject(subjectId);
    } catch (e) {
    } finally { _busy = false; }
  };

  window.MyDocsModule._deleteItem = async function (id) {
    if (!_isAdmin() || !_currentSubjectId) return;
    try {
      const { db, doc, deleteDoc, updateDoc, increment } = await _fs();
      await deleteDoc(doc(db, COL_ITEMS, id));
      // activeItemsCount فقط بينقص هنا — itemsCount (عدّاد الترقيم) يفضل زي ما هو
      await updateDoc(doc(db, COL_SUBJECTS, _currentSubjectId), { activeItemsCount: increment(-1) });
      await _load();
      await window.MyDocsModule._setFilter(_filter);
    } catch (e) {}
  };

  /* ─────────────────────────────────────────
     أرشفة / إعادة فتح — تأكيد بـ checkbox إجباري
  ───────────────────────────────────────── */
  function _confirmModal({ title, body, checkboxLabel, confirmLabel, onConfirm }) {
    const root = _root();
    if (!root) return;
    const wrap = document.createElement("div");
    wrap.className = "md-confirm-overlay";
    wrap.innerHTML = `
      <div class="md-confirm-box">
        <div class="md-confirm-title">${title}</div>
        <div class="md-confirm-body">${body}</div>
        <label class="md-confirm-check"><input type="checkbox" id="mdConfirmChk"> ${checkboxLabel}</label>
        <div class="md-confirm-actions">
          <button class="md-btn-cancel" id="mdConfirmCancel">إلغاء</button>
          <button class="md-btn-primary" id="mdConfirmOk" disabled>${confirmLabel}</button>
        </div>
      </div>`;
    root.appendChild(wrap);
    const chk = wrap.querySelector("#mdConfirmChk");
    const okBtn = wrap.querySelector("#mdConfirmOk");
    chk.addEventListener("change", () => { okBtn.disabled = !chk.checked; });
    wrap.querySelector("#mdConfirmCancel").onclick = () => wrap.remove();
    okBtn.onclick = async () => { okBtn.disabled = true; await onConfirm(); wrap.remove(); };
  }
  window.MyDocsModule._confirmArchive = function (id) {
    if (!_isAdmin()) return;
    _confirmModal({
      title: "أرشفة المادة؟",
      body: "سيتم إغلاق هذه المادة ونقلها إلى الأرشيف. سيظل كل المحتوى محفوظًا ويمكن الوصول إليه من الأرشيف.",
      checkboxLabel: "أفهم أن المادة ستُغلق وتُنقل إلى الأرشيف",
      confirmLabel: "أرشفة المادة",
      onConfirm: async () => {
        try {
          const { db, doc, updateDoc, serverTimestamp } = await _fs();
          await updateDoc(doc(db, COL_SUBJECTS, id), { status: "archived", archivedAt: serverTimestamp() });
          await _load();
          window.MyDocsModule._openSubject(id);
        } catch (e) {}
      },
    });
  };
  window.MyDocsModule._confirmReopen = function (id) {
    if (!_isAdmin()) return;
    _confirmModal({
      title: "إعادة فتح المادة؟",
      body: "سيتم نقل المادة من الأرشيف إلى المواد الحالية، ويمكن إضافة محتوى جديد إليها.",
      checkboxLabel: "أفهم أن المادة ستصبح نشطة من جديد",
      confirmLabel: "فتح المادة",
      onConfirm: async () => {
        try {
          const { db, doc, updateDoc } = await _fs();
          await updateDoc(doc(db, COL_SUBJECTS, id), { status: "active", archivedAt: null });
          await _load();
          window.MyDocsModule._openSubject(id);
        } catch (e) {}
      },
    });
  };

  /* ─────────────────────────────────────────
     تنقّل عام
  ───────────────────────────────────────── */
  window.MyDocsModule._back = function () {
    if (_view === "subjectForm" || _view === "itemForm") { _currentSubjectId ? _renderSubject() : _renderHome(); return; }
    if (_view === "subject") { _currentSubjectId = null; _renderHome(); return; }
    window.MyDocsModule.close();
  };
  window.MyDocsModule.open = function () {
    const root = _root();
    if (!root) return;
    root.classList.add("md-open");
    root.style.display = "flex";
    _buildShell();
    if (_loaded) _renderHome(); else _load();
  };
  window.MyDocsModule.close = function () {
    const root = _root();
    if (!root) return;
    root.classList.remove("md-open");
    root.style.display = "none";
    root.innerHTML = "";
    _view = "home"; _currentSubjectId = null; _draftSubject = null; _draftItem = null;
  };

  /* ─────────────────────────────────────────
     حارس تبديل الحساب — نفس نمط window._dmsGuardUser
     / window._sheetatyGuardUser. مفيش listeners دائمة في
     هذا الموديول (getDocs مش onSnapshot)، فالحراسة هنا بتقتصر
     على تصفير الكاش ومنع عرضه بعد تبديل الحساب.
  ───────────────────────────────────────── */
  window.MyDocsModule._resetState = function () {
    const root = _root();
    const wasOpen = !!(root && root.classList.contains("md-open"));
    if (wasOpen) window.MyDocsModule.close();
    _loaded = false; _loadedUid = null;
    _subjects = []; _items = [];
    _view = "home"; _tab = "active"; _filter = "all";
    _currentSubjectId = null; _draftSubject = null; _draftItem = null;
    if (_isRecording && _mediaRecorder) { try { _mediaRecorder.stop(); } catch (e) {} _isRecording = false; }
    _recStopTimer();
  };
  window._mydocsGuardUser = function (uid) {
    if (_loadedUid && _loadedUid !== uid) window.MyDocsModule._resetState();
  };
})();
