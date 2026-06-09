(function() {
  /* ── Storage ── */
  let _notifs = [];          // { id, title, body, data, time, read, icon }
  let _filterQ = "";
  let _npOpen  = false;

  /* ── Icon map by notif type ── */
  function _iconForData(data) {
    if (!data) return "🔔";
    const t = data.type || data.chatType || "";
    if (t === "private" || t === "dm")      return "💬";
    if (t === "reply")                       return "↩️";
    if (t === "mention")                     return "📣";
    if (t === "vip")                         return "⭐";
    if (t === "admin")                       return "🔔";
    if (t === "news")                        return "📰";
    if (t === "lectures" || t === "lecture") return "📚";
    if (t === "exams"    || t === "exam")    return "📅";
    if (t === "sections" || t === "section") return "🏫";
    return "🔔";
  }

  /* ── Relative time ── */
  function _relTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000)       return "الآن";
    if (diff < 3600000)     return `منذ ${Math.floor(diff/60000)} د`;
    if (diff < 86400000)    return `منذ ${Math.floor(diff/3600000)} س`;
    if (diff < 172800000)   return "أمس";
    return new Date(ts).toLocaleDateString("ar-EG", { month:"short", day:"numeric" });
  }

  /* ── Add a notification (called by patched showInAppNotif) ── */
  window._npAddNotif = function(title, body, data, onClickCb) {
    const n = {
      id: Date.now() + "_" + Math.random().toString(36).slice(2),
      title: title || "إشعار",
      body:  body  || "",
      data:  data  || {},
      time:  Date.now(),
      read:  false,
      icon:  _iconForData(data),
      _cb:   onClickCb || null
    };
    _notifs.unshift(n);
    if (_notifs.length > 100) _notifs.length = 100;
    _renderNotifs();
    _updateProfileBadge();
  };

  /* ── Render ── */
  function _renderNotifs() {
    const list = document.getElementById("npNotifList");
    if (!list) return;

    const q = _filterQ.toLowerCase();
    const filtered = q
      ? _notifs.filter(n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
      : _notifs;

    if (!filtered.length) {
      list.innerHTML = `<div class="np-empty"><i class="fa-solid fa-bell-slash"></i><span>${q ? "لا نتائج" : "لا توجد إشعارات"}</span></div>`;
      return;
    }

    list.innerHTML = filtered.map(n => `
      <div class="np-item ${n.read ? "" : "np-unread"}" id="npi_${n.id}" onclick="_npClickItem('${n.id}')">
        <div class="np-item-icon">${n.icon}</div>
        <div class="np-item-body">
          <div class="np-item-title">${_esc(n.title)}</div>
          <div class="np-item-msg">${_esc(n.body)}</div>
          <div class="np-item-actions">
            ${!n.read ? `<button class="np-item-act-btn read-btn" onclick="event.stopPropagation();_npMarkRead('${n.id}')"><i class="fa-solid fa-check"></i> تحديد كمقروء</button>` : ""}
            <button class="np-item-act-btn del-btn" onclick="event.stopPropagation();_npDeleteItem('${n.id}')"><i class="fa-solid fa-xmark"></i> حذف</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
          <div class="np-item-time">${_relTime(n.time)}</div>
          ${!n.read ? '<div class="np-unread-dot"></div>' : ""}
        </div>
      </div>
    `).join("");
  }

  function _esc(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  /* ── Badge ── */
  function _updateProfileBadge() {
    const cnt = _notifs.filter(n => !n.read).length;
    const b = document.getElementById("profileNotifBadge");
    if (b) { b.textContent = cnt > 99 ? "99+" : cnt; b.style.display = cnt > 0 ? "inline-block" : "none"; }
    const nb = document.getElementById("npUnreadBadge");
    if (nb) { nb.textContent = cnt > 99 ? "99+" : cnt; nb.style.display = cnt > 0 ? "inline-block" : "none"; }
  }

  /* ── Open / Close ── */
  window.openNotifPanel = function() {
    const bd = document.getElementById("notifPanelBackdrop");
    if (!bd) return;
    bd.classList.add("np-open");
    _npOpen = true;
    _renderNotifs();
    _updateProfileBadge();
    // Also load prefs
    if (typeof window._loadNpPrefs === "function") window._loadNpPrefs();
  };

  window.closeNotifPanel = function() {
    const bd = document.getElementById("notifPanelBackdrop");
    if (!bd) return;
    bd.classList.remove("np-open");
    _npOpen = false;
  };

  /* Redirect old openNotifSettings → settings tab of new panel */
  window.openNotifSettings = function() {
    window.openNotifPanel();
    setTimeout(() => window.switchNpTab("settings"), 50);
  };
  window.closeNotifSettings = function() {
    window.closeNotifPanel();
  };

  /* ── Tab switch ── */
  window.switchNpTab = function(tab) {
    document.querySelectorAll(".np-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".np-panel").forEach(p => p.classList.remove("active"));
    const tabBtn = document.getElementById("npTab-" + tab);
    const panel  = document.getElementById("npPanel-" + tab);
    if (tabBtn) tabBtn.classList.add("active");
    if (panel)  panel.classList.add("active");
  };

  /* ── Filter ── */
  window.npFilterNotifs = function(val) {
    _filterQ = (val || "").trim();
    _renderNotifs();
  };

  /* ── Actions ── */
  window._npClickItem = function(id) {
    const n = _notifs.find(x => x.id === id);
    if (!n) return;
    n.read = true;
    _renderNotifs();
    _updateProfileBadge();
    if (n._cb) {
      try { n._cb(n.data); } catch(e) {}
      window.closeNotifPanel();
    } else {
      // default navigation by type
      const d = n.data || {};
      if (d.chatType === "private" && d.senderUid) { try { openDMChat(d.senderUid); window.closeNotifPanel(); } catch(e) {} }
      else if (d.type === "news")     { try { openForumSection("tab-news","tab-news-content"); window.closeNotifPanel(); } catch(e) {} }
      else if (d.type === "lectures") { try { openForumSection("tab-lectures","tab-lectures-content"); window.closeNotifPanel(); } catch(e) {} }
      else if (d.type === "exams")    { try { openForumSection("tab-exams","tab-exams-content"); window.closeNotifPanel(); } catch(e) {} }
      else if (d.type === "sections") { try { openForumSection("tab-sections","tab-sections-content"); window.closeNotifPanel(); } catch(e) {} }
    }
  };

  window._npMarkRead = function(id) {
    const n = _notifs.find(x => x.id === id);
    if (n) { n.read = true; _renderNotifs(); _updateProfileBadge(); }
  };

  window._npDeleteItem = function(id) {
    _notifs = _notifs.filter(x => x.id !== id);
    _renderNotifs();
    _updateProfileBadge();
  };

  window.npClearAll = function() {
    _notifs = [];
    _renderNotifs();
    _updateProfileBadge();
  };

  /* ── Patch showInAppNotif to also store in panel ── */
  function _patchIAN() {
    const _origIAN = window.showInAppNotif;
    if (typeof _origIAN === "function" && !_origIAN._npPatched) {
      window.showInAppNotif = function(title, body, data, onClick) {
        window._npAddNotif(title, body, data, onClick);
        return _origIAN.apply(this, arguments);
      };
      window.showInAppNotif._npPatched = true;
    }
    // Also patch toggleNotifPanel (old bell) to open new panel
    window.toggleNotifPanel = function() {
      window.openNotifPanel();
    };
    _renderNotifs();
    _updateProfileBadge();
  }
  // Try immediately first; fallback to DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _patchIAN);
  } else {
    _patchIAN();
  }

  /* ── ESC to close ── */
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && _npOpen) window.closeNotifPanel();
  });

  /* Expose loadPrefs hook for settings tab */
  window._loadNpPrefs = function() {
    if (window.currentUser && typeof window._loadPrefs === "function") {
      window._loadPrefs(window.currentUser.uid);
    }
  };

})();
