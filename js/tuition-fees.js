/**
 * ══════════════════════════════════════════
 *   مصروفاتي — مصروفات السنة الدراسية
 *   المالك: إضافة/تعديل/حذف بيانات مصروفات كل فرقة
 *   الطالب: استعلام عن أي فرقة يريدها، في كل مرة — بدون قفل أو حفظ اختياره
 *   (كل المستخدمين على نفس التخصص، فلا داعي لحقل تخصص منفصل)
 *
 *   ▸ مستقلة تمامًا عن درجاتي: لا قراءة ولا اعتماد على grades/ إطلاقًا
 *   ▸ لا تُضاف أو تُعدَّل أي بيانات في users/{uid}
 *   ▸ المصدر الوحيد: tuitionFees/{docId}
 *       { year, cash, installments:[{label,amount}], updatedAt, updatedBy, worldId }
 *     docId = worldId__year (World Isolation) لضمان مستند واحد لكل فرقة لكل عالم
 *   ▸ يُمنع الحفظ إذا مجموع الأقساط ≠ الكاش
 *
 *   ▸ القواعد المطلوبة في Firestore Rules (إضافة فقط):
 *       match /tuitionFees/{docId} {
 *         allow read: if isSignedIn() && resource.data.worldId == myWorldId();
 *         allow create: if isOwner() && request.resource.data.worldId is string;
 *         allow update, delete: if isOwner() && resource.data.worldId == request.resource.data.worldId;
 *       }
 * ══════════════════════════════════════════
 */

(function () {
  "use strict";
  if (window.__tuitionModuleLoaded) return;
  window.__tuitionModuleLoaded = true;

  const _FB  = "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  const COL  = "tuitionFees";
  const YEARS = ["الفرقة الأولى", "الفرقة الثانية", "الفرقة الثالثة", "الفرقة الرابعة"];
  const LAST_KEY = "bis_tuition_last_choice"; // localStorage فقط — لا علاقة له بـ Firestore أو users

  async function _fs() {
    if (!window.db) throw new Error("Firebase غير متاح");
    return { db: window.db, ...(await import(_FB)) };
  }
  function _key(year) {
    return year.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, "");
  }
  // ✅ World Isolation: docId = worldId__year — يفصل بيانات كل عالم عن الآخر
  // فعليًا على مستوى الـdocId نفسه (وليس فلترة عرض فقط).
  function _docId(worldId, year) { return `${worldId}__${_key(year)}`; }
  // المصدر الموحّد للعالم الحالي: نفس activeWorldContext() المستخدمة في
  // باقي المشروع (rooms/messages) — بترجع عالم الأونر النشط، أو عالم
  // المستخدم العادي الثابت، ولا تفترض أي قيمة افتراضية عند غياب العالم.
  function _worldId() {
    return (typeof window.activeWorldContext === "function") ? window.activeWorldContext() : null;
  }
  function _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function _isOwner() { return !!(window.isOwner && window.isOwner()); }
  function _num(v) { const n = Number(v); return isFinite(n) ? n : 0; }
  function _money(n) { return _num(n).toLocaleString("ar-EG"); }

  let _view    = "home";   // home | owner-form | student-view
  let _docs    = {};       // docId -> record (المالك فقط يحمّلها كاملة)
  let _draft   = null;     // نموذج المالك
  let _pick    = { year: "" }; // اختيار الطالب المؤقت (لا يُحفظ في Firestore)

  function _root() { return document.getElementById("tuition-app-root"); }
  function _body() { return document.getElementById("tfBody"); }

  function _buildShell() {
    const root = _root();
    if (!root) return;
    root.innerHTML = `
      <div class="tf-overlay" onclick="window.TuitionModule._back()"></div>
      <div class="tf-sheet">
        <div class="tf-header">
          <button class="tf-back-btn" onclick="window.TuitionModule._back()"><i class="fa-solid fa-arrow-right"></i> رجوع</button>
          <div class="tf-title"><i class="fa-solid fa-sack-dollar"></i> <span id="tfTitleText">مصروفاتي</span></div>
        </div>
        <div class="tf-body" id="tfBody"><div class="tf-loading"><div class="tf-spin"></div></div></div>
      </div>`;
  }
  function _setTitle(t) { const el = document.getElementById("tfTitleText"); if (el) el.textContent = t; }

  /* ─────────────────────────────────────────
     الرئيسية: توجيه بحسب الدور
  ───────────────────────────────────────── */
  function _home() {
    _view = "home"; _draft = null;
    _setTitle("مصروفاتي");
    if (_isOwner()) _ownerList(); else _studentPick();
  }

  /* ═══════════ جهة الطالب: استعلام حر، بلا حفظ اختيار ═══════════ */
  function _studentPick() {
    _view = "student-pick";
    _setTitle("مصروفات السنة الدراسية");
    let last = {};
    try { last = JSON.parse(localStorage.getItem(LAST_KEY) || "{}"); } catch (e) {}
    const body = _body();
    if (!body) return;
    body.innerHTML = `
      <div class="tf-pick">
        <div class="tf-hint">اختر الفرقة لعرض مصروفات السنة الدراسية</div>
        <label class="tf-label">الفرقة الدراسية</label>
        <select class="tf-select" id="tfPickYear">
          <option value="">— اختر الفرقة —</option>
          ${YEARS.map(y => `<option value="${_esc(y)}" ${last.year === y ? "selected" : ""}>${_esc(y)}</option>`).join("")}
        </select>
        <button class="tf-btn-primary" onclick="window.TuitionModule._studentSearch()"><i class="fa-solid fa-magnifying-glass"></i> عرض المصروفات</button>
      </div>`;
  }

  window.TuitionModule = window.TuitionModule || {};

  window.TuitionModule._studentSearch = async function () {
    const year  = (document.getElementById("tfPickYear")?.value || "").trim();
    if (!year)  { window.toast?.("اختر الفرقة الدراسية", "error"); return; }
    const worldId = _worldId();
    if (!worldId) { window.toast?.("لا يوجد عالم صالح لعرض المصروفات", "error"); return; }
    try { localStorage.setItem(LAST_KEY, JSON.stringify({ year })); } catch (e) {}
    _pick = { year };
    _view = "student-view";
    _setTitle(`مصروفات ${year}`);
    const body = _body();
    if (body) body.innerHTML = `<div class="tf-loading"><div class="tf-spin"></div></div>`;
    try {
      const { db, doc, getDoc } = await _fs();
      const snap = await getDoc(doc(db, COL, _docId(worldId, year)));
      _renderStudentResult(snap.exists() ? snap.data() : null);
    } catch (e) {
      if (body) body.innerHTML = `<div class="tf-empty"><div class="tf-empty-title">تعذّر تحميل المصروفات</div></div>`;
    }
  };

  function _renderStudentResult(d) {
    const body = _body();
    if (!body) return;
    if (!d) {
      body.innerHTML = `
        <div class="tf-empty">
          <div class="tf-empty-icon"><i class="fa-solid fa-circle-info"></i></div>
          <div class="tf-empty-title">لم تُضَف بيانات مصروفات لهذه الفرقة بعد</div>
          <button class="tf-btn-cancel" onclick="window.TuitionModule._studentPickBack()">بحث آخر</button>
        </div>`;
      return;
    }
    const installments = Array.isArray(d.installments) ? d.installments : [];
    body.innerHTML = `
      <div class="tf-result">
        <div class="tf-result-head">
          <div class="tf-result-year">${_esc(d.year)}</div>
        </div>
        <div class="tf-tabs">
          <button class="tf-tab active" data-tf-tab="cash" onclick="window.TuitionModule._tab('cash')">كاش</button>
          <button class="tf-tab" data-tf-tab="inst" onclick="window.TuitionModule._tab('inst')">تقسيط</button>
        </div>
        <div class="tf-tab-panel" id="tfPanelCash">
          <div class="tf-cash-card">
            <div class="tf-cash-label">المصروفات نقدًا</div>
            <div class="tf-cash-amount">${_money(d.cash)} <span>جنيه</span></div>
          </div>
        </div>
        <div class="tf-tab-panel" id="tfPanelInst" style="display:none">
          ${installments.length ? `
            <div class="tf-inst-list">
              ${installments.map((it, i) => `
                <div class="tf-inst-row">
                  <span class="tf-inst-label">${_esc(it.label || `القسط ${i + 1}`)}</span>
                  <span class="tf-inst-amount">${_money(it.amount)} جنيه</span>
                </div>`).join("")}
            </div>
            <div class="tf-inst-total"><span>الإجمالي</span><span>${_money(d.cash)} جنيه</span></div>
          ` : `<div class="tf-empty-sub">لا يوجد نظام تقسيط لهذه البيانات</div>`}
        </div>
        <button class="tf-btn-cancel tf-full" onclick="window.TuitionModule._studentPickBack()"><i class="fa-solid fa-arrow-right-arrow-left"></i> بحث عن فرقة أخرى</button>
      </div>`;
  }

  window.TuitionModule._tab = function (t) {
    document.querySelectorAll("#tfBody .tf-tab").forEach(b => b.classList.toggle("active", b.getAttribute("data-tf-tab") === t));
    const cash = document.getElementById("tfPanelCash"), inst = document.getElementById("tfPanelInst");
    if (cash) cash.style.display = t === "cash" ? "" : "none";
    if (inst) inst.style.display = t === "inst" ? "" : "none";
  };

  window.TuitionModule._studentPickBack = function () { _studentPick(); };

  /* ═══════════ جهة المالك: إدارة كاملة ═══════════ */
  async function _ownerList() {
    _view = "owner-list";
    _setTitle("مصروفات السنة الدراسية");
    const body = _body();
    if (body) body.innerHTML = `<div class="tf-loading"><div class="tf-spin"></div></div>`;
    const worldId = _worldId();
    if (!worldId) {
      _docs = {};
      if (body) body.innerHTML = `<div class="tf-empty"><div class="tf-empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="tf-empty-title">لا يوجد عالم نشط صالح</div></div>`;
      return;
    }
    try {
      const { db, collection, getDocs, query, where } = await _fs();
      const snap = await getDocs(query(collection(db, COL), where("worldId","==",worldId)));
      _docs = {};
      snap.docs.forEach(d => { _docs[d.id] = d.data(); });
    } catch (e) { _docs = {}; }
    _renderOwnerList();
  }

  function _renderOwnerList() {
    const body = _body();
    if (!body) return;
    const list = Object.entries(_docs).sort((a, b) => YEARS.indexOf(a[1].year) - YEARS.indexOf(b[1].year));
    body.innerHTML = `
      <div class="tf-owner-top">
        <button class="tf-btn-primary tf-full" onclick="window.TuitionModule._openForm()"><i class="fa-solid fa-plus"></i> إضافة مصروفات سنة دراسية</button>
      </div>
      ${!list.length ? `
        <div class="tf-empty">
          <div class="tf-empty-icon"><i class="fa-solid fa-sack-dollar"></i></div>
          <div class="tf-empty-title">لا توجد بيانات مصروفات بعد</div>
          <div class="tf-empty-sub">اضغط الزر بالأعلى لإضافة أول فرقة وتخصص</div>
        </div>` : `
        <div class="tf-owner-list">
          ${list.map(([id, d]) => `
            <div class="tf-owner-card">
              <div class="tf-owner-card-info">
                <div class="tf-owner-card-year">${_esc(d.year)}</div>
                <div class="tf-owner-card-cash">${_money(d.cash)} جنيه${(d.installments || []).length ? ` · ${d.installments.length} أقساط` : " · كاش فقط"}</div>
              </div>
              <div class="tf-owner-card-actions">
                <button class="tf-mini-btn" title="تعديل" onclick="window.TuitionModule._openForm('${_esc(id)}')"><i class="fa-solid fa-pen"></i></button>
                <button class="tf-mini-btn tf-danger" title="حذف" onclick="window.TuitionModule._delete('${_esc(id)}')"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>`).join("")}
        </div>`}
    `;
  }

  window.TuitionModule._openForm = function (id) {
    if (!_isOwner()) return;
    if (!_worldId()) { window.toast?.("لا يوجد عالم نشط — تعذّرت الإضافة/التعديل", "error"); return; }
    const existing = id && _docs[id];
    _draft = existing
      ? { id, year: existing.year, cash: String(existing.cash ?? ""), installments: (existing.installments || []).map(x => ({ label: x.label || "", amount: String(x.amount ?? "") })) }
      : { id: null, year: "", cash: "", installments: [] };
    _view = "owner-form";
    _setTitle(existing ? "تعديل مصروفات السنة" : "إضافة مصروفات سنة دراسية");
    _renderForm();
  };

  function _formTotals() {
    // فقط الأقساط الموجبة (> 0) تُحسب — نفس التصفية المستخدمة فعليًا عند الحفظ،
    // حتى لا يظهر المؤشر "مطابق" ثم يُرفض الحفظ بسبب قسط صفري أو سالب
    const cash = _num(_draft.cash);
    const positive = _draft.installments.filter(i => _num(i.amount) > 0);
    const sum = positive.reduce((s, i) => s + _num(i.amount), 0);
    return { cash, sum, ok: positive.length === 0 || sum === cash };
  }

  function _renderForm() {
    const body = _body();
    if (!body || !_draft) return;
    const { cash, sum, ok } = _formTotals();
    const showMismatch = _draft.installments.length > 0;
    body.innerHTML = `
      <div class="tf-form">
        <label class="tf-label">الفرقة الدراسية</label>
        <select class="tf-select" id="tfFYear" ${_draft.id ? "disabled" : ""} onchange="window.TuitionModule._setField('year', this.value)">
          <option value="">— اختر الفرقة —</option>
          ${YEARS.map(y => `<option value="${_esc(y)}" ${_draft.year === y ? "selected" : ""}>${_esc(y)}</option>`).join("")}
        </select>
        ${_draft.id ? `<div class="tf-note"><i class="fa-solid fa-lock"></i> لتغيير الفرقة، احذف هذا السجل وأنشئ سجلاً جديدًا</div>` : ""}

        <label class="tf-label">المبلغ كاش (جنيه)</label>
        <input class="tf-select" id="tfFCash" type="number" inputmode="numeric" min="0" placeholder="مثال: 25000" value="${_esc(_draft.cash)}"
          oninput="window.TuitionModule._setField('cash', this.value)">

        <div class="tf-inst-head">
          <span>نظام التقسيط (اختياري)</span>
          <button class="tf-add-chip" onclick="window.TuitionModule._addInstallment()"><i class="fa-solid fa-plus"></i> إضافة قسط</button>
        </div>
        <div id="tfInstRows">${_renderInstRows()}</div>

        ${showMismatch ? `
          <div class="tf-total-row ${ok ? "tf-ok" : "tf-bad"}">
            <span>إجمالي الأقساط: ${_money(sum)} جنيه</span>
            <span>${ok ? "مطابق للكاش ✓" : `غير مطابق — الفرق ${_money(Math.abs(sum - cash))} جنيه`}</span>
          </div>` : ""}

        <div class="tf-actions">
          <button class="tf-btn-primary" id="tfSaveBtn" ${!ok ? "disabled" : ""} onclick="window.TuitionModule._save()"><i class="fa-solid fa-floppy-disk"></i> حفظ</button>
          <button class="tf-btn-cancel" onclick="window.TuitionModule._cancelForm()">إلغاء</button>
        </div>
      </div>`;
  }

  function _renderInstRows() {
    if (!_draft.installments.length) return `<div class="tf-blocks-empty">لا توجد أقساط — اتركه فارغًا إذا كانت المصروفات كاش فقط</div>`;
    return _draft.installments.map((it, i) => `
      <div class="tf-inst-edit-row">
        <input class="tf-select tf-inst-label" type="text" placeholder="القسط ${i + 1}" value="${_esc(it.label)}"
          oninput="window.TuitionModule._setInst(${i},'label',this.value)">
        <input class="tf-select tf-inst-amt" type="number" inputmode="numeric" min="0" placeholder="المبلغ" value="${_esc(it.amount)}"
          oninput="window.TuitionModule._setInst(${i},'amount',this.value)">
        <button class="tf-mini-btn tf-danger" onclick="window.TuitionModule._removeInstallment(${i})"><i class="fa-solid fa-trash"></i></button>
      </div>`).join("");
  }

  window.TuitionModule._setField = function (k, v) { if (_draft) { _draft[k] = v; if (k === "cash") _refreshTotals(); } };
  window.TuitionModule._setInst = function (i, k, v) {
    if (!_draft?.installments[i]) return;
    if (k === "amount" && v !== "" && _num(v) <= 0) v = ""; // منع إدخال قسط سالب أو صفري
    _draft.installments[i][k] = v;
    _refreshTotals();
  };
  window.TuitionModule._addInstallment = function () {
    if (!_draft) return;
    _draft.installments.push({ label: `القسط ${_draft.installments.length + 1}`, amount: "" });
    _renderForm();
  };
  window.TuitionModule._removeInstallment = function (i) {
    if (!_draft) return;
    _draft.installments.splice(i, 1);
    _renderForm();
  };
  function _refreshTotals() {
    const rows = document.getElementById("tfInstRows"); if (!rows) return;
    const { cash, sum, ok } = _formTotals();
    const wrap = rows.parentElement;
    let bar = wrap.querySelector(".tf-total-row");
    if (_draft.installments.length) {
      const html = `<span>إجمالي الأقساط: ${_money(sum)} جنيه</span><span>${ok ? "مطابق للكاش ✓" : `غير مطابق — الفرق ${_money(Math.abs(sum - cash))} جنيه`}</span>`;
      if (!bar) {
        bar = document.createElement("div");
        bar.className = "tf-total-row";
        rows.insertAdjacentElement("afterend", bar);
      }
      bar.className = "tf-total-row " + (ok ? "tf-ok" : "tf-bad");
      bar.innerHTML = html;
    } else if (bar) bar.remove();
    const btn = document.getElementById("tfSaveBtn");
    if (btn) btn.disabled = !ok;
  }

  window.TuitionModule._save = async function () {
    if (!_isOwner() || !_draft) return;
    const worldId = _worldId();
    if (!worldId) { window.toast?.("لا يوجد عالم نشط — تعذّر الحفظ", "error"); return; }
    const year = (_draft.year || "").trim();
    const cash = _num(_draft.cash);
    if (!_draft.id) {
      if (!year)  { window.toast?.("اختر الفرقة الدراسية", "error"); return; }
    }
    if (cash <= 0) { window.toast?.("اكتب المبلغ كاش", "error"); return; }
    const installments = _draft.installments
      .map(i => ({ label: (i.label || "").trim(), amount: _num(i.amount) }))
      .filter(i => i.amount > 0);
    const sum = installments.reduce((s, i) => s + i.amount, 0);
    if (installments.length && sum !== cash) {
      window.toast?.(`مجموع الأقساط (${_money(sum)}) لا يساوي الكاش (${_money(cash)})`, "error");
      return;
    }
    const id = _draft.id || _docId(worldId, year);
    if (!_draft.id && _docs[id]) {
      window.toast?.("هذه الفرقة مضافة بالفعل — استخدم زر التعديل بدل الإضافة", "error");
      return;
    }
    const btn = document.getElementById("tfSaveBtn");
    if (btn) btn.disabled = true;
    try {
      const { db, doc, setDoc, serverTimestamp } = await _fs();
      await setDoc(doc(db, COL, id), {
        year: _draft.id ? _docs[id]?.year : year,
        cash, installments,
        worldId,
        updatedAt: serverTimestamp(),
        updatedBy: window.currentUser?.uid || ""
      }, { merge: false });
      window.toast?.("تم الحفظ بنجاح ✓");
      _ownerList();
    } catch (e) {
      window.toast?.("فشل الحفظ — حاول مرة أخرى", "error");
      if (btn) btn.disabled = false;
    }
  };

  window.TuitionModule._cancelForm = function () { _ownerList(); };

  window.TuitionModule._delete = async function (id) {
    if (!_isOwner()) return;
    const worldId = _worldId();
    if (!worldId || !id.startsWith(worldId + "__")) { window.toast?.("غير مصرح بحذف بيانات هذا العالم", "error"); return; }
    if (!window.confirm("حذف بيانات مصروفات هذه الفرقة نهائيًا؟")) return;
    try {
      const { db, doc, deleteDoc } = await _fs();
      await deleteDoc(doc(db, COL, id));
      window.toast?.("تم الحذف");
      _ownerList();
    } catch (e) { window.toast?.("فشل الحذف", "error"); }
  };

  /* ─────────────────────────────────────────
     رجوع / فتح / إغلاق
  ───────────────────────────────────────── */
  window.TuitionModule._back = function () {
    if (_view === "owner-form") { _ownerList(); return; }
    if (_view === "student-view") { _studentPick(); return; }
    window.TuitionModule.close();
  };

  window.TuitionModule.open = function () {
    const root = _root();
    if (!root) return;
    root.classList.add("tuition-open");
    root.style.display = "flex";
    _buildShell();
    _home();
  };

  window.TuitionModule.close = function () {
    const root = _root();
    if (!root) return;
    root.classList.remove("tuition-open");
    root.style.display = "none";
    root.innerHTML = "";
    _view = "home"; _draft = null; _docs = {}; _pick = { year: "" };
  };
})();
