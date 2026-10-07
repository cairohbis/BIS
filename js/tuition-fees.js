/**
 * ══════════════════════════════════════════
 *   مصروفاتي — مصروفات السنة الدراسية (World-Direct)
 *   كل World من الـ16 يمثّل فرقة دراسية كاملة بذاته (قسم + سنة)،
 *   وله مستند واحد فقط — لا يوجد اختيار سنة يدوي من أي طرف.
 *
 *   المالك: يرى الـ16 World دائمًا، ويضيف/يعدّل/يحذف بيانات أي منها مباشرة.
 *   الطالب: لا يختار شيئًا — يرى بيانات عالمه (worldId الخاص بحسابه) فورًا.
 *
 *   ▸ مستقلة تمامًا عن درجاتي: لا قراءة ولا اعتماد على grades/ إطلاقًا
 *   ▸ لا تُضاف أو تُعدَّل أي بيانات في users/{uid}
 *   ▸ المصدر الوحيد: tuitionFees/{worldId}
 *       { worldId, year, cash, installments:[{label,amount}], updatedAt, updatedBy }
 *     docId === worldId مباشرة (مثال: tuitionFees/th_1) — لا بادئة ولا سنة في الـID.
 *     "year" حقل مشتق تلقائيًا من worldId (انظر _worldParts) وليس اختيارًا حرًا.
 *   ▸ يُمنع الحفظ إذا مجموع الأقساط ≠ الكاش
 *
 *   ▸ Firestore Rules الحالية (بدون تعديل — متوافقة تمامًا مع هذا الشكل
 *     لأنها تعتمد على resource.data.worldId وليس على شكل الـDocument ID):
 *       match /tuitionFees/{docId} {
 *         allow read: if isSignedIn() &&
 *           (resource == null || isOwner() ||
 *            (('worldId' in resource.data) && resource.data.worldId == myWorldId()));
 *         allow create: if isOwner() && request.resource.data.worldId is string
 *           && request.resource.data.worldId.size() > 0;
 *         allow update: if isOwner() && ('worldId' in resource.data)
 *           && request.resource.data.worldId == resource.data.worldId;
 *         allow delete: if isOwner() && ('worldId' in resource.data);
 *       }
 * ══════════════════════════════════════════
 */

(function () {
  "use strict";
  if (window.__tuitionModuleLoaded) return;
  window.__tuitionModuleLoaded = true;

  const _FB  = "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  const COL  = "tuitionFees";

  // ✅ منطق مركزي وحيد لتحويل worldId إلى (قسم + فرقة) — لا مكان آخر
  // في الملف يجب أن يحسب هذا التحويل بشكل منفصل.
  const SECTIONS = { is: "نظم معلومات", lt: "لغات وترجمة", th: "سياحة وفنادق", ba: "علوم إدارية" };
  const YEAR_BY_SUFFIX = { "1": "الفرقة الأولى", "2": "الفرقة الثانية", "3": "الفرقة الثالثة", "4": "الفرقة الرابعة" };
  function _worldParts(worldId) {
    const m = /^([a-z]+)_([1-4])$/.exec(worldId || "");
    return m ? { section: SECTIONS[m[1]] || m[1], year: YEAR_BY_SUFFIX[m[2]] } : null;
  }
  function _worldYear(worldId) { const p = _worldParts(worldId); return p ? p.year : ""; }
  function _worldLabel(worldId) { const p = _worldParts(worldId); return p ? `${p.section} — ${p.year}` : (worldId || ""); }

  async function _fs() {
    if (!window.db) throw new Error("Firebase غير متاح");
    return { db: window.db, ...(await import(_FB)) };
  }
  function _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function _isOwner() { return !!(window.isOwner && window.isOwner()); }
  function _num(v) { const n = Number(v); return isFinite(n) ? n : 0; }
  function _money(n) { return _num(n).toLocaleString("ar-EG"); }

  let _view    = "home";   // home | owner-form | student-view
  let _docs    = {};       // worldId -> record (المالك فقط يحمّلها كاملة، لكل الـ16 عالم)
  let _draft   = null;     // نموذج المالك
  let _studentUnsub = null; // دالة إلغاء اشتراك onSnapshot الخاصة بشاشة نتيجة الطالب فقط

  // ✅ يوقف أي اشتراك onSnapshot سابق خاص بشاشة الطالب، ويمنع تراكم أكثر
  // من listener واحد لنفس الشاشة (إعادة فتح/مغادرة الشاشة).
  function _stopStudentListener() {
    if (typeof _studentUnsub === "function") {
      try { _studentUnsub(); } catch (e) {}
    }
    _studentUnsub = null;
  }

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
    if (_isOwner()) _ownerList(); else _studentView();
  }

  window.TuitionModule = window.TuitionModule || {};

  /* ═══════════ جهة الطالب: عرض مباشر لعالمه فقط، بلا أي اختيار ═══════════ */
  async function _studentView() {
    _stopStudentListener();
    _view = "student-view";
    const worldId = (typeof window.currentUserWorldId === "function") ? window.currentUserWorldId() : null;
    if (!worldId) {
      _setTitle("مصروفات السنة الدراسية");
      const body = _body();
      if (body) body.innerHTML = `<div class="tf-empty"><div class="tf-empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="tf-empty-title">لا يوجد عالم صالح لعرض المصروفات</div></div>`;
      return;
    }
    _setTitle(`مصروفات ${_worldLabel(worldId)}`);
    const body = _body();
    if (body) body.innerHTML = `<div class="tf-loading"><div class="tf-spin"></div></div>`;
    try {
      const { db, doc, onSnapshot } = await _fs();
      _studentUnsub = onSnapshot(
        doc(db, COL, worldId),
        (snap) => {
          // ✅ لو الشاشة اتغيرت (المستخدم رجع/أغلق) قبل ما يوصل أي تحديث لاحق، تجاهله
          if (_view !== "student-view") return;
          // ✅ نعرض أول snapshot يصل فورًا (من الكاش أو الخادم) — لا داعي لانتظار
          // تأكيد الخادم حصريًا (إعادة الاشتراك على نفس المستند قد لا يُسلّم حدثًا
          // تاليًا إن لم يتغيّر شيء، فينتج عنه تعليق أبدي على شاشة التحميل).
          _renderStudentResult(snap.exists() ? snap.data() : null);
        },
        (err) => {
          if (_view !== "student-view") return;
          const b = _body();
          if (b) b.innerHTML = `<div class="tf-empty"><div class="tf-empty-title">تعذّر تحميل المصروفات</div></div>`;
        }
      );
    } catch (e) {
      if (body) body.innerHTML = `<div class="tf-empty"><div class="tf-empty-title">تعذّر تحميل المصروفات</div></div>`;
    }
  }

  function _renderStudentResult(d) {
    const body = _body();
    if (!body) return;
    if (!d) {
      body.innerHTML = `
        <div class="tf-empty">
          <div class="tf-empty-icon"><i class="fa-solid fa-circle-info"></i></div>
          <div class="tf-empty-title">لم تُضَف بيانات مصروفات لهذه الفرقة بعد</div>
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
      </div>`;
  }

  window.TuitionModule._tab = function (t) {
    document.querySelectorAll("#tfBody .tf-tab").forEach(b => b.classList.toggle("active", b.getAttribute("data-tf-tab") === t));
    const cash = document.getElementById("tfPanelCash"), inst = document.getElementById("tfPanelInst");
    if (cash) cash.style.display = t === "cash" ? "" : "none";
    if (inst) inst.style.display = t === "inst" ? "" : "none";
  };

  /* ═══════════ جهة المالك: إدارة الـ16 World دائمًا ═══════════ */
  async function _ownerList() {
    _view = "owner-list";
    _setTitle("مصروفات السنة الدراسية");
    const body = _body();
    if (body) body.innerHTML = `<div class="tf-loading"><div class="tf-spin"></div></div>`;
    try {
      // ✅ المالك يرى كل الـ16 عالم دائمًا (isOwner() في الـRule يتجاوز شرط
      // تطابق worldId) — لا فلترة بـactiveWorldContext() هنا إطلاقًا.
      const { db, collection, getDocs } = await _fs();
      const snap = await getDocs(collection(db, COL));
      _docs = {};
      snap.docs.forEach(d => { _docs[d.id] = d.data(); });
    } catch (e) { _docs = {}; }
    _renderOwnerList();
  }

  function _renderOwnerList() {
    const body = _body();
    if (!body) return;
    const worlds = Array.isArray(window.WORLDS) ? window.WORLDS : [];
    body.innerHTML = `
      <div class="tf-owner-list">
        ${worlds.map(wid => {
          const d = _docs[wid];
          return `
            <div class="tf-owner-card">
              <div class="tf-owner-card-info">
                <div class="tf-owner-card-year">${_esc(_worldLabel(wid))}</div>
                <div class="tf-owner-card-cash">${d
                  ? `${_money(d.cash)} جنيه${(d.installments || []).length ? ` · ${d.installments.length} أقساط` : " · كاش فقط"}`
                  : "لا توجد بيانات بعد"}</div>
              </div>
              <div class="tf-owner-card-actions">
                ${d
                  ? `<button class="tf-mini-btn" title="تعديل" onclick="window.TuitionModule._openForm('${_esc(wid)}')"><i class="fa-solid fa-pen"></i></button>
                     <button class="tf-mini-btn tf-danger" title="حذف" onclick="window.TuitionModule._delete('${_esc(wid)}')"><i class="fa-solid fa-trash"></i></button>`
                  : `<button class="tf-mini-btn" title="إضافة" onclick="window.TuitionModule._openForm('${_esc(wid)}')"><i class="fa-solid fa-plus"></i></button>`}
              </div>
            </div>`;
        }).join("")}
      </div>
    `;
  }

  window.TuitionModule._openForm = function (worldId) {
    if (!_isOwner() || !worldId) return;
    const existing = _docs[worldId];
    _draft = existing
      ? { worldId, cash: String(existing.cash ?? ""), installments: (existing.installments || []).map(x => ({ label: x.label || "", amount: String(x.amount ?? "") })) }
      : { worldId, cash: "", installments: [] };
    _view = "owner-form";
    _setTitle(existing ? `تعديل مصروفات ${_worldLabel(worldId)}` : `إضافة مصروفات ${_worldLabel(worldId)}`);
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
        <div class="tf-note"><i class="fa-solid fa-lock"></i> ${_esc(_worldLabel(_draft.worldId))}</div>

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
    const worldId = _draft.worldId;
    if (!worldId) { window.toast?.("عالم غير صالح — تعذّر الحفظ", "error"); return; }
    const cash = _num(_draft.cash);
    if (cash <= 0) { window.toast?.("اكتب المبلغ كاش", "error"); return; }
    const installments = _draft.installments
      .map(i => ({ label: (i.label || "").trim(), amount: _num(i.amount) }))
      .filter(i => i.amount > 0);
    const sum = installments.reduce((s, i) => s + i.amount, 0);
    if (installments.length && sum !== cash) {
      window.toast?.(`مجموع الأقساط (${_money(sum)}) لا يساوي الكاش (${_money(cash)})`, "error");
      return;
    }
    const btn = document.getElementById("tfSaveBtn");
    if (btn) btn.disabled = true;
    try {
      const { db, doc, setDoc, serverTimestamp } = await _fs();
      await setDoc(doc(db, COL, worldId), {
        worldId,
        year: _worldYear(worldId), // ✅ مُشتق تلقائيًا من worldId — ليس اختيارًا حرًا
        cash, installments,
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

  window.TuitionModule._delete = async function (worldId) {
    if (!_isOwner() || !worldId) return;
    try {
      const { db, doc, getDoc, deleteDoc } = await _fs();
      const ref = doc(db, COL, worldId);
      const snap = await getDoc(ref);
      // ✅ نفس شرط الـRule بالضبط (isOwner() && 'worldId' in resource.data) —
      // بدون أي مقارنة بعالم نشط، لأن المالك يدير الـ16 عالم كلهم بالتساوي.
      if (!snap.exists() || !snap.data()?.worldId) {
        window.toast?.("لا توجد بيانات لحذفها", "error");
        return;
      }
      if (!window.confirm(`حذف بيانات مصروفات ${_worldLabel(worldId)} نهائيًا؟`)) return;
      await deleteDoc(ref);
      window.toast?.("تم الحذف");
      _ownerList();
    } catch (e) { window.toast?.("فشل الحذف", "error"); }
  };

  /* ─────────────────────────────────────────
     رجوع / فتح / إغلاق
  ───────────────────────────────────────── */
  window.TuitionModule._back = function () {
    if (_view === "owner-form") { _ownerList(); return; }
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
    _stopStudentListener(); // ✅ إغلاق الوحدة بالكامل يجب أن يوقف أي listener شغال أيضًا
    const root = _root();
    if (!root) return;
    root.classList.remove("tuition-open");
    root.style.display = "none";
    root.innerHTML = "";
    _view = "home"; _draft = null; _docs = {};
  };
})();
