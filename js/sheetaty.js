/**
 * ══════════════════════════════════════════
 *   شيتاتي — World-scoped: مواد وشيتات لكل عالم (worldId)
 *   الأدمن/الأونر: نفس واجهة المستخدم العادي + أدوات إدارة إضافية فقط.
 *
 *   ▸ المصادر:
 *       subjects/{subjectId}
 *         { id, worldId, name, code, status: active|archived,
 *           sheetsCount, createdAt, archivedAt, createdBy }
 *       sheets/{sheetId}
 *         { id, subjectId, worldId, order, page, dueDate, note, image,
 *           createdAt, createdBy }
 *       users/{uid}/sheetCompletions/{sheetId}
 *         { sheetId, subjectId, completed, completedAt }
 *
 *   ▸ World Isolation: activeWorldContext() هو المصدر الوحيد للعالم
 *     للجميع (بما فيهم الأونر) — نفس نمط js/study-schedule.js بالظبط.
 *   ▸ الصور: uploadToCloudinaryWithProgress() من js/upload-engine.js
 *     كما هي، بدون أي تعديل.
 *   ▸ ترقيم الشيتات: runTransaction حقيقي (قراءة sheetsCount + كتابة
 *     الشيت + تحديث العدّاد في نفس الـ Transaction) — لا إعادة ترقيم
 *     بعد الحذف، ولا Cloud Function لتنظيف completions اليتيمة (مقبول).
 *   ▸ إحصائيات كل مادة (المجموع/أنجزت/متبقي) بتتحسب محليًا من قراءة
 *     users/{uid}/sheetCompletions كاملة بدون فلترة — بلا composite index.
 * ══════════════════════════════════════════
 */

(function () {
  "use strict";
  if (window.__sheetatyModuleLoaded) return;
  window.__sheetatyModuleLoaded = true;

  const _FB = "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  const COL_SUBJECTS = "subjects";
  const COL_SHEETS = "sheets";

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
  function _fmtDate(ts) {
    try {
      const d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
      if (!d) return "";
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    } catch (e) { return ""; }
  }

  /* ─────────────────────────────────────────
     الحالة
  ───────────────────────────────────────── */
  let _view = "home";        // home | subject | subjectForm | sheetForm
  let _tab = "active";       // active | archive  (داخل home)
  let _subjects = [];        // كل مواد العالم (نشطة ومؤرشفة)
  let _sheets = [];          // شيتات المادة المفتوحة حاليًا
  let _completions = {};     // sheetId -> {completed, completedAt}
  let _loaded = false;
  let _loadedUid = null;      // الحساب اللي اتحمّلت بياناته آخر مرة — لحماية تبديل الحساب/الـWorld
  let _currentSubjectId = null;
  let _draftSubject = null;  // {id?, name, code}
  let _draftSheet = null;    // {id?, page, dueDate, note, image, _file}
  let _busy = false;

  function _root() { return document.getElementById("sheetaty-app-root"); }
  function _body() { return document.getElementById("shtBody"); }

  function _buildShell() {
    const root = _root();
    if (!root) return;
    root.innerHTML = `
      <div class="sht-overlay" onclick="window.SheetatyModule._back()"></div>
      <div class="sht-sheet">
        <div class="sht-header">
          <button class="sht-back-btn" onclick="window.SheetatyModule._back()"><i class="fa-solid fa-arrow-right"></i> رجوع</button>
          <div class="sht-title"><i class="fa-solid fa-list-check"></i> <span id="shtTitleText">شيتاتي</span></div>
          <span id="shtHeaderAction"></span>
        </div>
        <div class="sht-body" id="shtBody"><div class="sht-loading"><div class="sht-spin"></div></div></div>
      </div>`;
  }
  function _setTitle(t) { const el = document.getElementById("shtTitleText"); if (el) el.textContent = t; }
  function _setHeaderAction(html) { const el = document.getElementById("shtHeaderAction"); if (el) el.innerHTML = html || ""; }

  /* ─────────────────────────────────────────
     تحميل بيانات المواد
  ───────────────────────────────────────── */
  async function _load() {
    const body = _body();
    if (body) body.innerHTML = `<div class="sht-loading"><div class="sht-spin"></div></div>`;
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
      if (body) body.innerHTML = `<div class="sht-empty"><div class="sht-empty-title">تعذّر تحميل شيتاتي</div></div>`;
    }
  }

  /* ─────────────────────────────────────────
     الرئيسية: شبكة المواد (نشطة/أرشيف)
  ───────────────────────────────────────── */
  function _renderHome() {
    _view = "home"; _draftSubject = null; _draftSheet = null;
    _setTitle("شيتاتي");
    const admin = _isAdmin();
    _setHeaderAction(admin ? `<button class="sht-add-btn" onclick="window.SheetatyModule._newSubject()"><i class="fa-solid fa-plus"></i></button>` : "");
    const body = _body();
    if (!body) return;

    const list = _subjects.filter((s) => (_tab === "archive" ? s.status === "archived" : s.status !== "archived"));

    body.innerHTML = `
      <div class="sht-tabs">
        <button class="sht-tab ${_tab === "active" ? "on" : ""}" onclick="window.SheetatyModule._setTab('active')">المواد الحالية</button>
        <button class="sht-tab ${_tab === "archive" ? "on" : ""}" onclick="window.SheetatyModule._setTab('archive')">الأرشيف</button>
      </div>
      ${!list.length ? `
        <div class="sht-empty">
          <div class="sht-empty-icon"><i class="fa-solid fa-book-bookmark"></i></div>
          <div class="sht-empty-title">${_tab === "archive" ? "لا توجد مواد مؤرشفة" : (admin ? "لسه مفيش مواد مضافة" : "لا توجد مواد متاحة حاليًا")}</div>
          ${admin && _tab === "active" ? `<button class="sht-btn-primary" onclick="window.SheetatyModule._newSubject()"><i class="fa-solid fa-plus"></i> إضافة مادة</button>` : ""}
        </div>` : `
        <div class="sht-subjects-grid">
          ${list.map((s) => `
            <div class="sht-subject-card" onclick="window.SheetatyModule._openSubject('${s.id}')">
              <div class="sht-subject-name">${_esc(s.name)}</div>
              <div class="sht-subject-meta">كود المادة: ${_esc(s.code)}</div>
              <div class="sht-subject-count"><i class="fa-solid fa-file-lines"></i> ${_num(s.sheetsCount)} شيت</div>
            </div>`).join("")}
        </div>`}
    `;
  }
  function _num(v) { const n = Number(v); return isFinite(n) ? n : 0; }

  window.SheetatyModule = window.SheetatyModule || {};
  window.SheetatyModule._setTab = function (t) { _tab = t; _renderHome(); };

  /* ─────────────────────────────────────────
     فتح مادة: تحميل الشيتات + إنجاز المستخدم
  ───────────────────────────────────────── */
  window.SheetatyModule._openSubject = async function (subjectId) {
    _currentSubjectId = subjectId;
    _view = "subject";
    const subj = _subjects.find((s) => s.id === subjectId);
    _setTitle(subj ? subj.name : "المادة");
    const body = _body();
    if (body) body.innerHTML = `<div class="sht-loading"><div class="sht-spin"></div></div>`;
    try {
      const { db, collection, getDocs, query, where, orderBy } = await _fs();
      const sheetsSnap = await getDocs(query(collection(db, COL_SHEETS), where("subjectId", "==", subjectId), where("worldId", "==", subj.worldId), orderBy("order")));
      _sheets = [];
      sheetsSnap.forEach((d) => _sheets.push({ id: d.id, ...d.data() }));

      const uid = _uid();
      _completions = {};
      if (uid) {
        const compSnap = await getDocs(collection(db, `users/${uid}/sheetCompletions`));
        compSnap.forEach((d) => { _completions[d.id] = d.data(); });
      }
      _renderSubject();
    } catch (e) {
      if (body) body.innerHTML = `<div class="sht-empty"><div class="sht-empty-title">تعذّر تحميل شيتات المادة</div></div>`;
    }
  };

  function _renderSubject() {
    _view = "subject";
    const subj = _subjects.find((s) => s.id === _currentSubjectId);
    if (!subj) { _renderHome(); return; }
    const admin = _isAdmin();
    const archived = subj.status === "archived";
    _setTitle(subj.name);
    _setHeaderAction(admin ? `
      <div class="sht-subject-actions">
        <button class="sht-mini-btn" title="تعديل المادة" onclick="window.SheetatyModule._editSubject('${subj.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="sht-mini-btn" title="${archived ? "إعادة فتح" : "أرشفة"}" onclick="window.SheetatyModule._${archived ? "confirmReopen" : "confirmArchive"}('${subj.id}')"><i class="fa-solid ${archived ? "fa-box-open" : "fa-box-archive"}"></i></button>
      </div>` : "");

    const total = _sheets.length;
    const done = _sheets.filter((sh) => _completions[sh.id] && _completions[sh.id].completed).length;
    const remaining = total - done;

    const body = _body();
    if (!body) return;
    body.innerHTML = `
      <div class="sht-subject-head">
        <div class="sht-subject-head-title">${_esc(subj.name)}${archived ? `<span class="sht-archived-badge">مؤرشفة</span>` : ""}</div>
        <div class="sht-subject-head-sub">كود المادة: ${_esc(subj.code)}</div>
      </div>
      <div class="sht-stats">
        <div class="sht-stat"><div class="sht-stat-num">${total}</div><div class="sht-stat-label">المجموع</div></div>
        <div class="sht-stat sht-stat-done"><div class="sht-stat-num">${done}</div><div class="sht-stat-label">أنجزت</div></div>
        <div class="sht-stat sht-stat-remaining"><div class="sht-stat-num">${remaining}</div><div class="sht-stat-label">متبقي</div></div>
      </div>
      ${admin && !archived ? `<button class="sht-btn-primary sht-add-sheet-btn" onclick="window.SheetatyModule._newSheet()"><i class="fa-solid fa-plus"></i> إضافة شيت</button>` : ""}
      ${!_sheets.length ? `
        <div class="sht-empty">
          <div class="sht-empty-icon"><i class="fa-solid fa-file-circle-plus"></i></div>
          <div class="sht-empty-title">لسه مفيش شيتات في المادة دي</div>
        </div>` : `
        <div class="sht-sheets-list">
          ${_sheets.map((sh, i) => _renderSheetCard(sh, i + 1, admin, archived)).join("")}
        </div>`}
    `;
  }

  function _renderSheetCard(sh, idx, admin, archived) {
    const comp = _completions[sh.id];
    const done = !!(comp && comp.completed);
    return `
      <div class="sht-sheet-card ${done ? "sht-done" : ""}">
        <div class="sht-sheet-main" onclick="${sh.image ? `window.open('${sh.image}','_blank')` : ""}">
          <div class="sht-sheet-title">شيت رقم ${idx}</div>
          <div class="sht-sheet-line">صفحة ${_esc(sh.page)}</div>
          <div class="sht-sheet-line">التسليم: ${_esc(_fmtDate(sh.dueDate))}</div>
          ${sh.note ? `<div class="sht-sheet-note">ملاحظة: ${_esc(sh.note)}</div>` : ""}
          ${sh.image ? `<div class="sht-sheet-img-hint"><i class="fa-solid fa-image"></i> فتح صورة الشيت</div>` : ""}
        </div>
        <div class="sht-sheet-side">
          <button class="sht-check ${done ? "on" : ""}" title="اتعمل" onclick="window.SheetatyModule._toggleDone('${sh.id}','${sh.subjectId}')">
            <i class="${done ? "fa-solid fa-square-check" : "fa-regular fa-square"}"></i><span>اتعمل</span>
          </button>
          ${admin ? `
            <div class="sht-sheet-admin-actions">
              <button class="sht-mini-btn" title="تعديل" onclick="window.SheetatyModule._editSheet('${sh.id}')"><i class="fa-solid fa-pen"></i></button>
              <button class="sht-mini-btn sht-danger" title="حذف" onclick="window.SheetatyModule._deleteSheet('${sh.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>` : ""}
        </div>
      </div>`;
  }

  /* ─────────────────────────────────────────
     اتعمل / إلغاء اتعمل — شخصي لكل مستخدم
  ───────────────────────────────────────── */
  window.SheetatyModule._toggleDone = async function (sheetId, subjectId) {
    const uid = _uid();
    if (!uid) return;
    const wasDone = !!(_completions[sheetId] && _completions[sheetId].completed);
    _completions[sheetId] = { sheetId, subjectId, completed: !wasDone, completedAt: !wasDone ? new Date() : null };
    _renderSubject(); // optimistic
    try {
      const { db, doc, setDoc, serverTimestamp } = await _fs();
      await setDoc(doc(db, `users/${uid}/sheetCompletions`, sheetId), {
        sheetId, subjectId,
        completed: !wasDone,
        completedAt: !wasDone ? serverTimestamp() : null,
      }, { merge: true });
    } catch (e) {
      // تراجع عند الفشل
      _completions[sheetId] = { sheetId, subjectId, completed: wasDone, completedAt: wasDone ? new Date() : null };
      _renderSubject();
    }
  };

  /* ─────────────────────────────────────────
     نموذج مادة (إضافة/تعديل) — أدمن فقط
  ───────────────────────────────────────── */
  window.SheetatyModule._newSubject = function () {
    if (!_isAdmin()) return;
    _draftSubject = { name: "", code: "" };
    _renderSubjectForm();
  };
  window.SheetatyModule._editSubject = function (id) {
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
      <div class="sht-form">
        <label class="sht-label">اسم المادة</label>
        <input class="sht-input" id="shtFName" value="${_esc(_draftSubject.name)}" oninput="window.SheetatyModule._setSubjField('name', this.value)">
        <label class="sht-label">كود المادة</label>
        <input class="sht-input" id="shtFCode" value="${_esc(_draftSubject.code)}" oninput="window.SheetatyModule._setSubjField('code', this.value)">
        <div class="sht-form-actions">
          <button class="sht-btn-primary" onclick="window.SheetatyModule._saveSubject()"><i class="fa-solid fa-floppy-disk"></i> حفظ المادة</button>
          <button class="sht-btn-cancel" onclick="window.SheetatyModule._cancelForm()">إلغاء</button>
        </div>
      </div>`;
  }
  window.SheetatyModule._setSubjField = function (k, v) { if (_draftSubject) _draftSubject[k] = v; };
  window.SheetatyModule._cancelForm = function () {
    if (_currentSubjectId && _sheets) _renderSubject(); else _renderHome();
  };
  window.SheetatyModule._saveSubject = async function () {
    if (_busy || !_draftSubject) return;
    const name = (_draftSubject.name || "").trim();
    const code = (_draftSubject.code || "").trim();
    if (!name) return;
    _busy = true;
    try {
      const { db, doc, addDoc, updateDoc, collection, serverTimestamp } = await _fs();
      if (_draftSubject.id) {
        await updateDoc(doc(db, COL_SUBJECTS, _draftSubject.id), { name, code });
        const local = _subjects.find((s) => s.id === _draftSubject.id);
        if (local) { local.name = name; local.code = code; }
        await _load();
        window.SheetatyModule._openSubject(_draftSubject.id);
      } else {
        const wid = _worldId();
        const ref = await addDoc(collection(db, COL_SUBJECTS), {
          worldId: wid, name, code, status: "active", sheetsCount: 0,
          createdAt: serverTimestamp(), archivedAt: null, createdBy: _uid(),
        });
        await _load();
      }
    } catch (e) {
      // يفضل في الفورم لو فشل الحفظ
    } finally { _busy = false; }
  };

  /* ─────────────────────────────────────────
     نموذج شيت (إضافة/تعديل) — أدمن فقط
  ───────────────────────────────────────── */
  window.SheetatyModule._newSheet = function () {
    if (!_isAdmin() || !_currentSubjectId) return;
    _draftSheet = { page: "", dueDate: "", note: "", image: null };
    _renderSheetForm();
  };
  window.SheetatyModule._editSheet = function (id) {
    if (!_isAdmin()) return;
    const sh = _sheets.find((x) => x.id === id);
    if (!sh) return;
    let dd = "";
    try { const d = sh.dueDate && sh.dueDate.toDate ? sh.dueDate.toDate() : (sh.dueDate ? new Date(sh.dueDate) : null); if (d) dd = d.toISOString().slice(0, 10); } catch (e) {}
    _draftSheet = { id: sh.id, page: sh.page || "", dueDate: dd, note: sh.note || "", image: sh.image || null };
    _renderSheetForm();
  };
  function _renderSheetForm() {
    _view = "sheetForm";
    _setTitle(_draftSheet.id ? "تعديل شيت" : "إضافة شيت");
    _setHeaderAction("");
    const body = _body();
    if (!body) return;
    body.innerHTML = `
      <div class="sht-form">
        <label class="sht-label">صفحة الكتاب</label>
        <input class="sht-input" id="shtFPage" value="${_esc(_draftSheet.page)}" oninput="window.SheetatyModule._setSheetField('page', this.value)">
        <label class="sht-label">تاريخ التسليم</label>
        <input class="sht-input" type="date" id="shtFDue" value="${_esc(_draftSheet.dueDate)}" onchange="window.SheetatyModule._setSheetField('dueDate', this.value)">
        <label class="sht-label">ملاحظة (اختياري)</label>
        <textarea class="sht-input sht-textarea" id="shtFNote" oninput="window.SheetatyModule._setSheetField('note', this.value)">${_esc(_draftSheet.note)}</textarea>
        <label class="sht-label">صورة الشيت (اختياري)</label>
        <input type="file" accept="image/*" class="sht-file-input" onchange="window.SheetatyModule._pickImage(this.files[0])">
        <div id="shtImgProgress"></div>
        ${_draftSheet.image ? `<div class="sht-img-preview"><img src="${_draftSheet.image}" alt=""></div>` : ""}
        <div class="sht-form-actions">
          <button class="sht-btn-primary" onclick="window.SheetatyModule._saveSheet()"><i class="fa-solid fa-floppy-disk"></i> إضافة الشيت</button>
          <button class="sht-btn-cancel" onclick="window.SheetatyModule._cancelForm()">إلغاء</button>
        </div>
      </div>`;
  }
  window.SheetatyModule._setSheetField = function (k, v) { if (_draftSheet) _draftSheet[k] = v; };
  window.SheetatyModule._pickImage = function (file) {
    if (!file || !_draftSheet) return;
    const prog = document.getElementById("shtImgProgress");
    if (prog) prog.innerHTML = `<div class="sht-upload-pct">0%</div>`;
    window.uploadToCloudinaryWithProgress(file, (p) => {
      if (prog && p.pct != null) prog.innerHTML = `<div class="sht-upload-pct">${p.pct}%</div>`;
    }).then((res) => {
      _draftSheet.image = res.url;
      if (prog) prog.innerHTML = `<div class="sht-upload-pct sht-done-pct"><i class="fa-solid fa-check"></i> تم رفع الصورة</div>`;
    }).catch(() => {
      if (prog) prog.innerHTML = `<div class="sht-upload-pct sht-fail-pct">فشل رفع الصورة</div>`;
    });
  };
  window.SheetatyModule._saveSheet = async function () {
    if (_busy || !_draftSheet || !_currentSubjectId) return;
    const page = (_draftSheet.page || "").trim();
    if (!page || !_draftSheet.dueDate) return;
    _busy = true;
    try {
      const { db, doc, updateDoc, collection, runTransaction, serverTimestamp } = await _fs();
      const dueDate = new Date(_draftSheet.dueDate);
      if (_draftSheet.id) {
        await updateDoc(doc(db, COL_SHEETS, _draftSheet.id), {
          page, dueDate, note: _draftSheet.note || null, image: _draftSheet.image || null,
        });
      } else {
        const wid = _worldId();
        const subjectId = _currentSubjectId;
        await runTransaction(db, async (tx) => {
          const subjRef = doc(db, COL_SUBJECTS, subjectId);
          const subjSnap = await tx.get(subjRef);
          if (!subjSnap.exists()) throw new Error("subject-missing");
          const newOrder = (_num(subjSnap.data().sheetsCount) || 0) + 1;
          const sheetRef = doc(collection(db, COL_SHEETS));
          tx.set(sheetRef, {
            subjectId, worldId: wid, order: newOrder,
            page, dueDate, note: _draftSheet.note || null, image: _draftSheet.image || null,
            createdAt: serverTimestamp(), createdBy: _uid(),
          });
          tx.update(subjRef, { sheetsCount: newOrder });
        });
      }
      await window.SheetatyModule._openSubject(_currentSubjectId);
    } catch (e) {
      // يفضل في الفورم لو فشل الحفظ
    } finally { _busy = false; }
  };
  window.SheetatyModule._deleteSheet = async function (id) {
    if (!_isAdmin()) return;
    try {
      const { db, doc, deleteDoc } = await _fs();
      await deleteDoc(doc(db, COL_SHEETS, id));
      await window.SheetatyModule._openSubject(_currentSubjectId);
    } catch (e) {}
  };

  /* ─────────────────────────────────────────
     أرشفة / إعادة فتح — تأكيد بـ checkbox إجباري
  ───────────────────────────────────────── */
  function _confirmModal({ title, body, checkboxLabel, confirmLabel, onConfirm }) {
    const root = _root();
    if (!root) return;
    const wrap = document.createElement("div");
    wrap.className = "sht-confirm-overlay";
    wrap.innerHTML = `
      <div class="sht-confirm-box">
        <div class="sht-confirm-title">${title}</div>
        <div class="sht-confirm-body">${body}</div>
        <label class="sht-confirm-check">
          <input type="checkbox" id="shtConfirmChk"> ${checkboxLabel}
        </label>
        <div class="sht-confirm-actions">
          <button class="sht-btn-cancel" id="shtConfirmCancel">إلغاء</button>
          <button class="sht-btn-primary" id="shtConfirmOk" disabled>${confirmLabel}</button>
        </div>
      </div>`;
    root.appendChild(wrap);
    const chk = wrap.querySelector("#shtConfirmChk");
    const okBtn = wrap.querySelector("#shtConfirmOk");
    chk.addEventListener("change", () => { okBtn.disabled = !chk.checked; });
    wrap.querySelector("#shtConfirmCancel").onclick = () => wrap.remove();
    okBtn.onclick = async () => { okBtn.disabled = true; await onConfirm(); wrap.remove(); };
  }

  window.SheetatyModule._confirmArchive = function (id) {
    if (!_isAdmin()) return;
    _confirmModal({
      title: "أرشفة المادة؟",
      body: "سيتم إغلاق هذه المادة ونقلها إلى الأرشيف. ستظل جميع الشيتات والبيانات محفوظة ويمكن الوصول إليها من الأرشيف.",
      checkboxLabel: "أفهم أن المادة ستُغلق وتُنقل إلى الأرشيف",
      confirmLabel: "أرشفة المادة",
      onConfirm: async () => {
        try {
          const { db, doc, updateDoc, serverTimestamp } = await _fs();
          await updateDoc(doc(db, COL_SUBJECTS, id), { status: "archived", archivedAt: serverTimestamp() });
          await _load();
          window.SheetatyModule._openSubject(id);
        } catch (e) {}
      },
    });
  };
  window.SheetatyModule._confirmReopen = function (id) {
    if (!_isAdmin()) return;
    _confirmModal({
      title: "إعادة فتح المادة؟",
      body: "سيتم نقل المادة من الأرشيف إلى المواد الحالية، ويمكن إضافة شيتات جديدة إليها.",
      checkboxLabel: "أفهم أن المادة ستصبح نشطة من جديد",
      confirmLabel: "فتح المادة",
      onConfirm: async () => {
        try {
          const { db, doc, updateDoc } = await _fs();
          await updateDoc(doc(db, COL_SUBJECTS, id), { status: "active", archivedAt: null });
          await _load();
          window.SheetatyModule._openSubject(id);
        } catch (e) {}
      },
    });
  };

  /* ─────────────────────────────────────────
     تنقّل عام
  ───────────────────────────────────────── */
  window.SheetatyModule._back = function () {
    if (_view === "subjectForm") { _currentSubjectId ? _renderSubject() : _renderHome(); return; }
    if (_view === "sheetForm") { _renderSubject(); return; }
    if (_view === "subject") { _currentSubjectId = null; _renderHome(); return; }
    window.SheetatyModule.close();
  };

  window.SheetatyModule.open = function () {
    const root = _root();
    if (!root) return;
    root.classList.add("sht-open");
    root.style.display = "flex";
    _buildShell();
    if (_loaded) _renderHome(); else _load();
  };
  window.SheetatyModule.close = function () {
    const root = _root();
    if (!root) return;
    root.classList.remove("sht-open");
    root.style.display = "none";
    root.innerHTML = "";
    _view = "home"; _currentSubjectId = null; _draftSubject = null; _draftSheet = null;
  };

  /* ─────────────────────────────────────────
     حارس تبديل الحساب — نفس نمط window._dmsGuardUser
     (js/dms-page.js): لو الحساب اتغيّر عن الحساب اللي
     الكاش الحالي محمّل عليه، صفّر كل حالة الموديول وأغلقه
     لو كان مفتوحًا، عشان منمنعش render لبيانات World قديم.
  ───────────────────────────────────────── */
  window.SheetatyModule._resetState = function () {
    const root = _root();
    const wasOpen = !!(root && root.classList.contains("sht-open"));
    if (wasOpen) window.SheetatyModule.close();
    _loaded = false; _loadedUid = null;
    _subjects = []; _sheets = []; _completions = {};
    _view = "home"; _tab = "active";
    _currentSubjectId = null; _draftSubject = null; _draftSheet = null;
  };
  window._sheetatyGuardUser = function (uid) {
    if (_loadedUid && _loadedUid !== uid) window.SheetatyModule._resetState();
  };
})();
