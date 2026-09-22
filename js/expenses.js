/**
 * ══════════════════════════════════════════
 *   مصروفاتي — الجزء 2: احسب فلوسك ومواصلاتك
 *   مصروفات يومية شخصية + ميزانية + تقدير تكلفة المواصلات
 *
 *   ▸ مستقلة تمامًا عن tuition-fees.js (مصروفات السنة الدراسية):
 *     لا كود مشترك، ولا قراءة لبياناته، ولا ربط بالفرقة/التخصص.
 *   ▸ بيانات شخصية بالكامل لكل مستخدم:
 *       users/{uid}/expenses/{expenseId}
 *         { amount, category, date, time, note,
 *           from, to, transportType, direction, tripCount, pricePerTrip, createdAt }
 *       users/{uid}/expensesMeta/settings
 *         { monthlyBudget, transportEstimate:{goCost,returnCost,daysPerWeek} }
 *
 *   ▸ القواعد المطلوبة في Firestore Rules (إضافة فقط):
 *       match /users/{uid}/expenses/{expenseId} {
 *         allow read, write: if isSignedIn() && request.auth.uid == uid;
 *       }
 *       match /users/{uid}/expensesMeta/{docId} {
 *         allow read, write: if isSignedIn() && request.auth.uid == uid;
 *       }
 * ══════════════════════════════════════════
 */

(function () {
  "use strict";
  if (window.__expensesModuleLoaded) return;
  window.__expensesModuleLoaded = true;

  const _FB = "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

  const CATS = [
    { id: "transport", label: "مواصلات",       icon: "fa-bus",              color: "#38bdf8" },
    { id: "food",      label: "أكل وشرب",       icon: "fa-utensils",         color: "#fb923c" },
    { id: "study",     label: "دراسة",          icon: "fa-book",             color: "#a78bfa" },
    { id: "tools",     label: "أدوات",          icon: "fa-toolbox",          color: "#facc15" },
    { id: "phone",     label: "هاتف وإنترنت",   icon: "fa-mobile-screen",    color: "#34d399" },
    { id: "fun",       label: "ترفيه",          icon: "fa-gamepad",          color: "#f472b6" },
    { id: "other",     label: "أخرى",           icon: "fa-ellipsis",         color: "#94a3b8" },
  ];
  const PERIODS = [
    { id: "day",   label: "اليوم" },
    { id: "week",  label: "هذا الأسبوع" },
    { id: "month", label: "هذا الشهر" },
    { id: "year",  label: "هذه السنة" },
  ];

  async function _fs() {
    if (!window.db) throw new Error("Firebase غير متاح");
    return { db: window.db, ...(await import(_FB)) };
  }
  function _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function _num(v) { const n = Number(v); return isFinite(n) ? n : 0; }
  function _money(n) { return _num(n).toLocaleString("ar-EG"); }
  function _uid() { return window.currentUser?.uid || ""; }
  function _cat(id) { return CATS.find(c => c.id === id) || CATS[CATS.length - 1]; }

  function _fmtDate(d) { const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
  function _parseDate(s) { const [y, m, d] = String(s || "").split("-").map(Number); return (y && m && d) ? new Date(y, m - 1, d) : null; }
  function _todayStr() { return _fmtDate(new Date()); }
  function _dayLabel(dk) {
    const today = _todayStr();
    const yest = _fmtDate(new Date(Date.now() - 86400000));
    if (dk === today) return "اليوم";
    if (dk === yest) return "أمس";
    const d = _parseDate(dk);
    if (!d) return dk;
    const p = n => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}`;
  }
  function _inPeriod(dateStr, period) {
    if (!dateStr) return false;
    const today = _todayStr();
    if (period === "day") return dateStr === today;
    if (period === "week") {
      const d = _parseDate(dateStr), t = _parseDate(today);
      if (!d || !t) return false;
      const diff = Math.floor((t - d) / 86400000);
      return diff >= 0 && diff < 7;
    }
    if (period === "month") return dateStr.slice(0, 7) === today.slice(0, 7);
    if (period === "year") return dateStr.slice(0, 4) === today.slice(0, 4);
    return true;
  }

  let _view     = "home"; // home | add-form | budget-form | transport-calc
  let _all      = [];     // كل مصروفات المستخدم (محمّلة عند الفتح)
  let _settings = { monthlyBudget: 0, transportEstimate: null };
  let _period   = "month";
  let _draft    = null;

  function _root() { return document.getElementById("expenses-app-root"); }
  function _body() { return document.getElementById("exBody"); }

  function _buildShell() {
    const root = _root();
    if (!root) return;
    root.innerHTML = `
      <div class="tf-overlay" onclick="window.ExpensesModule._back()"></div>
      <div class="tf-sheet">
        <div class="tf-header">
          <button class="tf-back-btn" onclick="window.ExpensesModule._back()"><i class="fa-solid fa-arrow-right"></i> رجوع</button>
          <div class="tf-title"><i class="fa-solid fa-wallet"></i> <span id="exTitleText">احسب فلوسك ومواصلاتك</span></div>
        </div>
        <div class="tf-body" id="exBody"><div class="tf-loading"><div class="tf-spin"></div></div></div>
      </div>`;
  }
  function _setTitle(t) { const el = document.getElementById("exTitleText"); if (el) el.textContent = t; }

  window.ExpensesModule = window.ExpensesModule || {};

  window.ExpensesModule.open = async function () {
    if (!_uid()) { window.toast?.("سجّل الدخول أولاً", "error"); return; }
    const root = _root();
    if (!root) return;
    root.classList.add("expenses-open");
    root.style.display = "flex";
    _buildShell();
    _view = "home"; _draft = null;
    _setTitle("احسب فلوسك ومواصلاتك");
    await _loadAll();
    _renderHome();
  };

  window.ExpensesModule.close = function () {
    const root = _root();
    if (!root) return;
    root.classList.remove("expenses-open");
    root.style.display = "none";
    root.innerHTML = "";
    _view = "home"; _draft = null;
  };

  window.ExpensesModule._back = function () {
    if (_view === "add-form" || _view === "budget-form" || _view === "transport-calc") {
      _view = "home"; _setTitle("احسب فلوسك ومواصلاتك"); _renderHome(); return;
    }
    window.ExpensesModule.close();
  };

  async function _loadAll() {
    const uid = _uid();
    try {
      const { db, collection, getDocs, doc, getDoc } = await _fs();
      const snap = await getDocs(collection(db, "users", uid, "expenses"));
      _all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { _all = []; }
    try {
      const { db, doc, getDoc } = await _fs();
      const s = await getDoc(doc(db, "users", uid, "expensesMeta", "settings"));
      _settings = s.exists() ? Object.assign({ monthlyBudget: 0, transportEstimate: null }, s.data()) : { monthlyBudget: 0, transportEstimate: null };
    } catch (e) { _settings = { monthlyBudget: 0, transportEstimate: null }; }
  }

  /* ═══════════ الرئيسية: ملخص + ميزانية + تبويبات + إحصائيات + سجل ═══════════ */
  function _renderHome() {
    const body = _body();
    if (!body) return;
    const today = _todayStr();
    const monthPrefix = today.slice(0, 7);
    const todayTotal = _all.filter(e => e.date === today).reduce((s, e) => s + _num(e.amount), 0);
    const monthList = _all.filter(e => (e.date || "").slice(0, 7) === monthPrefix);
    const monthTotal = monthList.reduce((s, e) => s + _num(e.amount), 0);
    const budget = _num(_settings.monthlyBudget);
    const remaining = budget - monthTotal;
    const pct = budget > 0 ? Math.min(100, Math.round((monthTotal / budget) * 100)) : 0;
    const daysElapsed = new Date().getDate();
    const dailyAvg = daysElapsed > 0 ? monthTotal / daysElapsed : 0;
    const weeklyAvg = dailyAvg * 7;

    const periodList = _all.filter(e => _inPeriod(e.date, _period))
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.time || "").localeCompare(a.time || ""));
    const groups = {};
    periodList.forEach(e => { (groups[e.date] = groups[e.date] || []).push(e); });
    const dateKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    const catTotals = {};
    periodList.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + _num(e.amount); });

    body.innerHTML = `
      <div class="ex-summary-grid">
        <div class="ex-stat-card"><div class="ex-stat-label">إجمالي مصروفات الشهر</div><div class="ex-stat-value">${_money(monthTotal)}<span>ج.م</span></div></div>
        <div class="ex-stat-card"><div class="ex-stat-label">مصروفات اليوم</div><div class="ex-stat-value">${_money(todayTotal)}<span>ج.م</span></div></div>
        <div class="ex-stat-card ${remaining < 0 ? "ex-stat-bad" : ""}"><div class="ex-stat-label">المتبقي من الميزانية</div><div class="ex-stat-value">${_money(remaining)}<span>ج.م</span></div></div>
      </div>

      ${budget > 0 ? `
      <div class="ex-budget-box">
        <div class="ex-budget-row"><span>ميزانيتك الشهرية: ${_money(budget)} ج.م</span><button class="ex-edit-link" onclick="window.ExpensesModule._openBudgetForm()">تعديل</button></div>
        <div class="ex-budget-bar"><div class="ex-budget-fill ${pct >= 100 ? "ex-bad" : ""}" style="width:${pct}%"></div></div>
        <div class="ex-budget-sub">${pct}% من الميزانية · متوسط يومي ${_money(dailyAvg)} ج.م · أسبوعي ${_money(weeklyAvg)} ج.م</div>
      </div>` : `
      <div class="ex-budget-box ex-budget-empty">
        <span>لم تحدد ميزانية شهرية بعد</span>
        <button class="ex-edit-link" onclick="window.ExpensesModule._openBudgetForm()">تحديد الميزانية</button>
      </div>`}

      <div class="ex-actions-row">
        <button class="tf-btn-primary" onclick="window.ExpensesModule._openForm()"><i class="fa-solid fa-plus"></i> إضافة مصروف</button>
        <button class="ex-transport-calc-btn" onclick="window.ExpensesModule._openTransportCalc()"><i class="fa-solid fa-route"></i> احسب تكلفة مواصلاتي</button>
      </div>

      <div class="tf-tabs ex-period-tabs">
        ${PERIODS.map(p => `<button class="tf-tab ${p.id === _period ? "active" : ""}" onclick="window.ExpensesModule._setPeriod('${p.id}')">${p.label}</button>`).join("")}
      </div>

      ${Object.keys(catTotals).length ? `
      <div class="ex-chart-box">
        <div class="ex-chart-title">أين تذهب أموالك</div>
        ${_buildCatBars(catTotals)}
      </div>` : ""}

      <div class="ex-list">
        ${!dateKeys.length ? `
          <div class="tf-empty">
            <div class="tf-empty-icon"><i class="fa-solid fa-receipt"></i></div>
            <div class="tf-empty-title">لا توجد مصروفات في هذه الفترة</div>
          </div>` : dateKeys.map(dk => `
          <div class="ex-day-group">
            <div class="ex-day-header">${_dayLabel(dk)}</div>
            ${groups[dk].map(e => `
              <div class="ex-item">
                <div class="ex-item-icon" style="color:${_cat(e.category).color}"><i class="fa-solid ${_cat(e.category).icon}"></i></div>
                <div class="ex-item-info">
                  <div class="ex-item-cat">${_esc(_cat(e.category).label)}${e.category === "transport" && (e.from || e.to) ? ` · ${_esc(e.from || "")} → ${_esc(e.to || "")}` : ""}</div>
                  ${e.note ? `<div class="ex-item-note">${_esc(e.note)}</div>` : ""}
                </div>
                <div class="ex-item-amount">${_money(e.amount)} ج.م</div>
                <div class="ex-item-actions">
                  <button class="tf-mini-btn" onclick="window.ExpensesModule._openForm('${_esc(e.id)}')"><i class="fa-solid fa-pen"></i></button>
                  <button class="tf-mini-btn tf-danger" onclick="window.ExpensesModule._delete('${_esc(e.id)}')"><i class="fa-solid fa-trash"></i></button>
                </div>
              </div>`).join("")}
          </div>`).join("")}
      </div>`;
  }

  function _buildCatBars(catTotals) {
    const entries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...entries.map(e => e[1]));
    return entries.map(([id, val]) => {
      const c = _cat(id);
      const pct = Math.max(4, Math.round((val / max) * 100));
      return `
        <div class="ex-cat-row">
          <div class="ex-cat-row-top"><span><i class="fa-solid ${c.icon}"></i> ${_esc(c.label)}</span><span>${_money(val)} ج.م</span></div>
          <div class="ex-cat-bar-track"><div class="ex-cat-bar-fill" style="width:${pct}%;background:${c.color}"></div></div>
        </div>`;
    }).join("");
  }

  window.ExpensesModule._setPeriod = function (p) { _period = p; _renderHome(); };

  /* ═══════════ إضافة / تعديل مصروف ═══════════ */
  window.ExpensesModule._openForm = function (id) {
    const existing = id && _all.find(e => e.id === id);
    _draft = existing
      ? { id, amount: String(existing.category === "transport" ? (existing.pricePerTrip ?? existing.amount ?? "") : (existing.amount ?? "")), category: existing.category || "other",
          date: existing.date || _todayStr(), time: existing.time || "", note: existing.note || "",
          from: existing.from || "", to: existing.to || "", transportType: existing.transportType || "",
          direction: existing.direction || "go", tripCount: String(existing.tripCount || 1) }
      : { id: null, amount: "", category: "other", date: _todayStr(), time: "", note: "", from: "", to: "", transportType: "", direction: "go", tripCount: "1" };
    _view = "add-form"; _setTitle(existing ? "تعديل مصروف" : "إضافة مصروف"); _renderForm();
  };

  function _renderForm() {
    const body = _body();
    if (!body || !_draft) return;
    const isTransport = _draft.category === "transport";
    body.innerHTML = `
      <div class="tf-form">
        <label class="tf-label">نوع المصروف</label>
        <div class="ex-cat-chips">
          ${CATS.map(c => `<button type="button" class="ex-cat-chip ${_draft.category === c.id ? "active" : ""}" onclick="window.ExpensesModule._setCat('${c.id}')"><i class="fa-solid ${c.icon}"></i> ${c.label}</button>`).join("")}
        </div>

        ${isTransport ? `
        <label class="tf-label">من</label>
        <input class="tf-select" value="${_esc(_draft.from)}" oninput="window.ExpensesModule._setField('from', this.value)">
        <label class="tf-label">إلى</label>
        <input class="tf-select" value="${_esc(_draft.to)}" oninput="window.ExpensesModule._setField('to', this.value)">
        <label class="tf-label">وسيلة المواصلات</label>
        <input class="tf-select" list="exTransportList" value="${_esc(_draft.transportType)}" oninput="window.ExpensesModule._setField('transportType', this.value)">
        <datalist id="exTransportList"><option value="ميكروباص"><option value="أتوبيس"><option value="مترو"><option value="تاكسي/أوبر"><option value="توك توك"></datalist>
        <label class="tf-label">الاتجاه</label>
        <select class="tf-select" onchange="window.ExpensesModule._setField('direction', this.value)">
          <option value="go" ${_draft.direction === "go" ? "selected" : ""}>ذهاب</option>
          <option value="back" ${_draft.direction === "back" ? "selected" : ""}>عودة</option>
        </select>
        <label class="tf-label">عدد مرات الرحلة</label>
        <input class="tf-select" type="number" min="1" value="${_esc(_draft.tripCount)}" oninput="window.ExpensesModule._setField('tripCount', this.value); window.ExpensesModule._refreshTransportTotal()">
        <label class="tf-label">سعر الرحلة الواحدة (جنيه)</label>
        ` : `<label class="tf-label">المبلغ (جنيه)</label>`}
        <input class="tf-select" id="exAmountInput" type="number" min="0" inputmode="numeric" value="${_esc(_draft.amount)}" oninput="window.ExpensesModule._setField('amount', this.value); window.ExpensesModule._refreshTransportTotal()">
        ${isTransport ? `<div class="tf-note" id="exTransportTotal">الإجمالي المُسجَّل: ${_money(_num(_draft.amount) * _num(_draft.tripCount || 1))} جنيه</div>` : ""}

        <label class="tf-label">التاريخ</label>
        <input class="tf-select" type="date" value="${_esc(_draft.date)}" onchange="window.ExpensesModule._setField('date', this.value)">
        <label class="tf-label">الوقت (اختياري)</label>
        <input class="tf-select" type="time" value="${_esc(_draft.time)}" onchange="window.ExpensesModule._setField('time', this.value)">
        <label class="tf-label">ملاحظة (اختياري)</label>
        <input class="tf-select" value="${_esc(_draft.note)}" oninput="window.ExpensesModule._setField('note', this.value)">

        <div class="tf-actions">
          <button class="tf-btn-primary" onclick="window.ExpensesModule._save()"><i class="fa-solid fa-floppy-disk"></i> حفظ</button>
          <button class="tf-btn-cancel" onclick="window.ExpensesModule._cancelForm()">إلغاء</button>
        </div>
      </div>`;
  }

  window.ExpensesModule._setCat = function (c) { if (_draft) { _draft.category = c; _renderForm(); } };
  window.ExpensesModule._setField = function (k, v) { if (_draft) _draft[k] = v; };
  window.ExpensesModule._refreshTransportTotal = function () {
    const el = document.getElementById("exTransportTotal");
    if (!el || !_draft) return;
    el.textContent = `الإجمالي المُسجَّل: ${_money(_num(_draft.amount) * _num(_draft.tripCount || 1))} جنيه`;
  };
  window.ExpensesModule._cancelForm = function () { _view = "home"; _setTitle("احسب فلوسك ومواصلاتك"); _renderHome(); };

  window.ExpensesModule._save = async function () {
    if (!_draft) return;
    const isTransport = _draft.category === "transport";
    const price = _num(_draft.amount);
    const count = isTransport ? Math.max(1, _num(_draft.tripCount || 1)) : 1;
    const amount = isTransport ? price * count : price;
    if (amount <= 0) { window.toast?.("اكتب المبلغ", "error"); return; }
    if (!_draft.date) { window.toast?.("اختر التاريخ", "error"); return; }
    const payload = {
      amount, category: _draft.category, date: _draft.date, time: (_draft.time || ""), note: (_draft.note || "").trim(),
    };
    if (isTransport) {
      payload.from = (_draft.from || "").trim();
      payload.to = (_draft.to || "").trim();
      payload.transportType = (_draft.transportType || "").trim();
      payload.direction = _draft.direction || "go";
      payload.tripCount = count;
      payload.pricePerTrip = price;
    }
    try {
      const { db, collection, doc, addDoc, updateDoc, serverTimestamp } = await _fs();
      const uid = _uid();
      if (_draft.id) {
        await updateDoc(doc(db, "users", uid, "expenses", _draft.id), payload);
      } else {
        await addDoc(collection(db, "users", uid, "expenses"), { ...payload, createdAt: serverTimestamp() });
      }
      window.toast?.("تم الحفظ بنجاح ✓");
      await _loadAll();
      _view = "home"; _setTitle("احسب فلوسك ومواصلاتك"); _renderHome();
    } catch (e) {
      window.toast?.("فشل الحفظ — حاول مرة أخرى", "error");
    }
  };

  window.ExpensesModule._delete = async function (id) {
    if (!window.confirm("حذف هذا المصروف؟")) return;
    try {
      const { db, doc, deleteDoc } = await _fs();
      await deleteDoc(doc(db, "users", _uid(), "expenses", id));
      window.toast?.("تم الحذف");
      await _loadAll(); _renderHome();
    } catch (e) { window.toast?.("فشل الحذف", "error"); }
  };

  /* ═══════════ الميزانية الشهرية ═══════════ */
  window.ExpensesModule._openBudgetForm = function () { _view = "budget-form"; _setTitle("الميزانية الشهرية"); _renderBudgetForm(); };
  function _renderBudgetForm() {
    const body = _body();
    if (!body) return;
    body.innerHTML = `
      <div class="tf-form">
        <label class="tf-label">ميزانيتك الشهرية (جنيه)</label>
        <input class="tf-select" id="exBudgetInput" type="number" min="0" value="${_esc(_settings.monthlyBudget || "")}">
        <div class="tf-hint">تحديد الميزانية لا يمنعك من تسجيل مصروفات تتجاوزها — بس بيوريك نسبة استهلاكك.</div>
        <div class="tf-actions">
          <button class="tf-btn-primary" onclick="window.ExpensesModule._saveBudget()"><i class="fa-solid fa-floppy-disk"></i> حفظ</button>
          <button class="tf-btn-cancel" onclick="window.ExpensesModule._back()">إلغاء</button>
        </div>
      </div>`;
  }
  window.ExpensesModule._saveBudget = async function () {
    const v = _num(document.getElementById("exBudgetInput")?.value);
    try {
      const { db, doc, setDoc } = await _fs();
      await setDoc(doc(db, "users", _uid(), "expensesMeta", "settings"), { monthlyBudget: v }, { merge: true });
      _settings.monthlyBudget = v;
      window.toast?.("تم الحفظ ✓");
      _view = "home"; _setTitle("احسب فلوسك ومواصلاتك"); _renderHome();
    } catch (e) { window.toast?.("فشل الحفظ", "error"); }
  };

  /* ═══════════ احسب تكلفة مواصلاتي (تقدير) ═══════════ */
  window.ExpensesModule._openTransportCalc = function () { _view = "transport-calc"; _setTitle("احسب تكلفة مواصلاتي"); _renderTransportCalc(); };
  function _renderTransportCalc() {
    const body = _body();
    if (!body) return;
    const t = _settings.transportEstimate || {};
    body.innerHTML = `
      <div class="tf-form">
        <div class="tf-hint">أدخل تكلفة رحلتك اليومية مرة واحدة، ونحسبلك تقدير أسبوعي وشهري</div>
        <label class="tf-label">تكلفة الذهاب (جنيه)</label>
        <input class="tf-select" id="exTGo" type="number" min="0" value="${_esc(t.goCost || "")}" oninput="window.ExpensesModule._calcPreview()">
        <label class="tf-label">تكلفة العودة (جنيه)</label>
        <input class="tf-select" id="exTBack" type="number" min="0" value="${_esc(t.returnCost || "")}" oninput="window.ExpensesModule._calcPreview()">
        <label class="tf-label">عدد أيام الدراسة في الأسبوع</label>
        <input class="tf-select" id="exTDays" type="number" min="1" max="7" value="${_esc(t.daysPerWeek || 5)}" oninput="window.ExpensesModule._calcPreview()">
        <div class="ex-transport-preview" id="exTPreview"></div>
        <div class="tf-note"><i class="fa-solid fa-circle-info"></i> ده تقدير فقط، مش تسجيل فعلي لحد ما تضغط «سجل رحلة اليوم»</div>
        <div class="tf-actions">
          <button class="tf-btn-primary" onclick="window.ExpensesModule._saveTransportCalc()"><i class="fa-solid fa-floppy-disk"></i> حفظ التقدير</button>
          <button class="tf-btn-cancel" onclick="window.ExpensesModule._logTransportToday()">سجل رحلة اليوم</button>
        </div>
      </div>`;
    window.ExpensesModule._calcPreview();
  }
  window.ExpensesModule._calcPreview = function () {
    const go = _num(document.getElementById("exTGo")?.value);
    const back = _num(document.getElementById("exTBack")?.value);
    const days = Math.max(1, _num(document.getElementById("exTDays")?.value || 5));
    const daily = go + back, weekly = daily * days, monthly = weekly * 4.33;
    const el = document.getElementById("exTPreview");
    if (!el) return;
    el.innerHTML = `
      <div class="ex-cash-mini">يوميًا: ${_money(daily)} ج.م</div>
      <div class="ex-cash-mini">أسبوعيًا: ${_money(weekly)} ج.م</div>
      <div class="ex-cash-mini">شهريًا (تقديري): ${_money(Math.round(monthly))} ج.م</div>`;
  };
  window.ExpensesModule._saveTransportCalc = async function () {
    const go = _num(document.getElementById("exTGo")?.value);
    const back = _num(document.getElementById("exTBack")?.value);
    const days = Math.max(1, _num(document.getElementById("exTDays")?.value || 5));
    try {
      const { db, doc, setDoc } = await _fs();
      await setDoc(doc(db, "users", _uid(), "expensesMeta", "settings"), { transportEstimate: { goCost: go, returnCost: back, daysPerWeek: days } }, { merge: true });
      _settings.transportEstimate = { goCost: go, returnCost: back, daysPerWeek: days };
      window.toast?.("تم الحفظ ✓");
    } catch (e) { window.toast?.("فشل الحفظ", "error"); }
  };
  window.ExpensesModule._logTransportToday = async function () {
    const go = _num(document.getElementById("exTGo")?.value);
    const back = _num(document.getElementById("exTBack")?.value);
    const amount = go + back;
    if (amount <= 0) { window.toast?.("أدخل تكلفة الذهاب أو العودة", "error"); return; }
    try {
      const { db, collection, addDoc, serverTimestamp } = await _fs();
      await addDoc(collection(db, "users", _uid(), "expenses"), { amount, category: "transport", date: _todayStr(), time: "", note: "رحلة يومية (ذهاب وعودة)", createdAt: serverTimestamp() });
      window.toast?.("تم تسجيل رحلة اليوم ✓");
      await _loadAll();
      _view = "home"; _setTitle("احسب فلوسك ومواصلاتك"); _renderHome();
    } catch (e) { window.toast?.("فشل الحفظ", "error"); }
  };

  /* ══════════════════════════════════════════
     مصروفاتي — الشاشة الرئيسية (Hub): اختيار بين الجزءين
  ══════════════════════════════════════════ */
  window.MyExpensesHub = window.MyExpensesHub || {};
  function _hubRoot() { return document.getElementById("tuition-hub-root"); }

  window.MyExpensesHub.open = function () {
    const root = _hubRoot();
    if (!root) return;
    root.classList.add("tuition-hub-open");
    root.style.display = "flex";
    root.innerHTML = `
      <div class="tf-overlay" onclick="window.MyExpensesHub.close()"></div>
      <div class="tf-sheet">
        <div class="tf-header">
          <button class="tf-back-btn" onclick="window.MyExpensesHub.close()"><i class="fa-solid fa-arrow-right"></i> رجوع</button>
          <div class="tf-title"><i class="fa-solid fa-sack-dollar"></i> مصروفاتي</div>
        </div>
        <div class="tf-body">
          <div class="ex-hub-card" onclick="window.MyExpensesHub.close(); window.TuitionModule && window.TuitionModule.open();">
            <div class="ex-hub-card-icon"><i class="fa-solid fa-graduation-cap"></i></div>
            <div class="ex-hub-card-info">
              <div class="ex-hub-card-title">مصروفات السنة الدراسية</div>
              <div class="ex-hub-card-sub">اعرف مصروفات سنتك الدراسية ونظام التقسيط</div>
            </div>
            <i class="fa-solid fa-chevron-left ex-hub-card-arrow"></i>
          </div>
          <div class="ex-hub-card" onclick="window.MyExpensesHub.close(); window.ExpensesModule && window.ExpensesModule.open();">
            <div class="ex-hub-card-icon ex-hub-card-icon--wallet"><i class="fa-solid fa-wallet"></i></div>
            <div class="ex-hub-card-info">
              <div class="ex-hub-card-title">احسب فلوسك ومواصلاتك</div>
              <div class="ex-hub-card-sub">تابع مصروفاتك اليومية واعرف تكلفة مواصلاتك وميزانيتك</div>
            </div>
            <i class="fa-solid fa-chevron-left ex-hub-card-arrow"></i>
          </div>
        </div>
      </div>`;
  };

  window.MyExpensesHub.close = function () {
    const root = _hubRoot();
    if (!root) return;
    root.classList.remove("tuition-hub-open");
    root.style.display = "none";
    root.innerHTML = "";
  };
})();
