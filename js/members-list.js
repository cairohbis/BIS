/* ══════════════════════════════════════════
   MEMBERS LIST — Browse all users & open DM directly
   Owner → Admin → Members, with realtime search
   منقول من index.html — راجع BIS-split-log.md لتفاصيل الاستلاف
══════════════════════════════════════════ */
let _membersSearchDebounce = null;
let _allMembersCache = null;
let _allMembersCacheTs = 0;

document.getElementById("sidebarHeaderSearchInp")?.addEventListener("input", e => {
  const activeTab = document.querySelector(".sidebar-tab.active")?.id;
  if (activeTab !== "stab-members") return;
  const q = e.target.value.trim();
  clearTimeout(_membersSearchDebounce);
  _membersSearchDebounce = setTimeout(() => renderMembersList(q), 300);
});

// ── إضافة منفصلة: بحث الأعضاء داخل صفحة الدردشات الجديدة (#page-dms) ──
// لم يُلمس الـ Listener أعلاه إطلاقاً (لا يزال يخدم الشريط الجانبي القديم
// المستخدم فعليًا في أماكن أخرى). هذا Listener جديد كليًا لعنصر مختلف.
document.getElementById("dmsSearchInp")?.addEventListener("input", e => {
  const activePanel = document.querySelector("#page-dms .dms-tab.active")?.dataset.panel;
  if (activePanel !== "members") return;
  const q = e.target.value.trim();
  clearTimeout(_membersSearchDebounce);
  _membersSearchDebounce = setTimeout(() => renderMembersList(q, "dmsMembersList"), 300);
});

async function renderMembersList(q, containerId = "membersList") {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = (window._buildMemberSkeletons ? window._buildMemberSkeletons(7) : `<div class="spinner" style="margin:30px auto;"></div>`);

  try {
    const all = await window._getAllUsers();

    const lower = q.toLowerCase();
    // هل الاستعلام رقمي؟ → بحث مباشر بـ publicId
    const isNumericId = /^\d{5,6}$/.test(q.trim());

    const filtered = all.filter(u => {
      const uid = u.uid || u.id;
      if (uid === window.currentUser.uid) return false;
      if (!q) return true;
      const nameMatch    = (u.name||"").toLowerCase().includes(lower);
      const emailMatch   = window.isOwner() ? (u.email||"").toLowerCase().includes(lower) : false;
      const publicIdMatch = isNumericId ? (u.publicId||"") === q.trim() : false;
      return nameMatch || emailMatch || publicIdMatch;
    });

    // إذا كان البحث برقم معرف → نرتب بحيث المطابق أولاً
    if (isNumericId) {
      filtered.sort((a, b) => {
        const aMatch = (a.publicId||"") === q.trim() ? -1 : 0;
        const bMatch = (b.publicId||"") === q.trim() ? -1 : 0;
        return aMatch - bMatch;
      });
    }

    // Sort: owner → admin → user
    const roleOrder = { owner: 0, admin: 1, user: 2 };
    filtered.sort((a, b) => (roleOrder[a.role]||2) - (roleOrder[b.role]||2));

    el.innerHTML = "";

    if (!filtered.length) {
      el.innerHTML = `<div class="dm-empty">${q ? `لا نتائج لـ "${window.esc(q)}"` : "لا يوجد أعضاء"}</div>`;
      return;
    }

    // Group headers
    const groups = [
      { key: "owner", label: "المالك",   icon: "fa-crown",       color: "var(--gold)" },
      { key: "admin", label: "الإدارة",  icon: "fa-gear",        color: "var(--orange)" },
      { key: "user",  label: "الأعضاء",  icon: "fa-circle-user", color: "var(--blue)" }
    ];

    groups.forEach(g => {
      const groupUsers = filtered.filter(u => (u.role || "user") === g.key);
      if (!groupUsers.length) return;

      // ترتيب فرعي: المتصلون أولاً، ثم غير المتصلين — لمجموعة "الأعضاء" فقط
      // (المالك والإدارة يبقيان بترتيبهما الحالي في أعلى القائمة دائمًا)
      if (g.key === "user") {
        groupUsers.sort((a, b) => {
          const aOnline = window._isOnlineVisible ? window._isOnlineVisible(a) : false;
          const bOnline = window._isOnlineVisible ? window._isOnlineVisible(b) : false;
          return (bOnline ? 1 : 0) - (aOnline ? 1 : 0);
        });
      }

      // Group header
      const hdr = document.createElement("div");
      hdr.style.cssText = `font-size:10px;font-weight:800;color:${g.color};padding:10px 14px 4px;letter-spacing:.5px;text-transform:uppercase;display:flex;align-items:center;gap:6px;`;
      hdr.innerHTML = `<i class="fa-solid ${g.icon}"></i> ${g.label} (${groupUsers.length})`;
      el.appendChild(hdr);

    groupUsers.forEach(u => {
        const uid = u.uid || u.id;

        // ── ضمان وجود publicId لكل مستخدم — ينشئه بصمت إن لم يكن موجوداً ──
        if (!u.publicId && uid) {
          window._ensurePublicId(uid).catch(() => {});
        }

        const alreadyOpen = !!window._acceptedPeers[uid] || !!document.getElementById(`dm-${uid}`);

        const online = window._isOnlineVisible ? window._isOnlineVisible(u) : false;
        const roleLabel = g.key==="owner" ? "مالك" : g.key==="admin" ? "مشرف" : "عضو";

        // ربط مستمع الحضور اللحظي (نفس النظام الحقيقي المستخدم في الدردشات) —
        // بدونه، حالة الاتصال تعتمد فقط على لقطة مخزَّنة مؤقتًا لمدة 5 دقائق
        // (_getAllUsers) ولا تتحدّث أبدًا وهي معروضة.
        if (uid) window._ensureVipListener(uid);

        const item = document.createElement("div");
        item.className = "dm-item";
        item.id = `dms-member-${uid}`;
        item.style.cssText = "cursor:pointer;";
        item.innerHTML = `
          <div class="dm-avatar-wrap ${online ? "online" : "offline"}">
            <div class="dm-avatar" style="${g.key==="owner"?"background:linear-gradient(135deg,var(--gold),var(--goldL));color:#060d1a;":g.key==="admin"?"background:linear-gradient(135deg,var(--orange),#fb923c);color:#fff;":""}">
              ${u.photo ? `<img src="${window.esc(u.photo)}" alt="">` : window._defaultAvatarHTML(u.gender, 46)}
            </div>
          </div>
          <div class="dm-info">
            <div class="dm-top-row">
              <div class="dm-name">${window.renderUserDisplay(u.name||"مستخدم", u)} <span class="dm-role-inline">— ${roleLabel}</span></div>
              ${alreadyOpen ? `<div class="dm-time" style="color:var(--success);font-size:10px;"><i class="fa-solid fa-comments"></i></div>` : ""}
            </div>
            <div class="dm-bottom-row">
              <div class="dm-preview">${window.isOwner() && u.email ? window.esc(u.email) : (g.key==="owner"?"مؤسس النظام":"")}</div>
            </div>
          </div>
        `;
        item.addEventListener("click", (e) => { e.stopPropagation(); window._showUserContextMenu(uid, e.clientX, e.clientY, u); });
        el.appendChild(item);
      });
    });

  } catch(e) {
    el.innerHTML = `<div class="dm-empty">خطأ في التحميل</div>`;
    console.error(e);
  }
}
window.renderMembersList = renderMembersList;
