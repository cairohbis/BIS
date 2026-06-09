(function() {

  /* ── Build message skeleton HTML ── */
  function _buildMsgSkeletons(count) {
    const patterns = [
      { side:"other", name:true,  size:"medium" },
      { side:"me",    name:false, size:"short"  },
      { side:"other", name:false, size:"long"   },
      { side:"me",    name:false, size:"medium" },
      { side:"other", name:true,  size:"short"  },
      { side:"me",    name:false, size:"long"   },
      { side:"other", name:false, size:"medium" },
      { side:"me",    name:false, size:"short"  },
      { side:"other", name:true,  size:"long"   },
      { side:"me",    name:false, size:"medium" },
    ];
    let html = '<div class="chat-skel-wrap">';
    for (let i = 0; i < count; i++) {
      const p = patterns[i % patterns.length];
      html += `
        <div class="msg-skel-row ${p.side}">
          ${p.side === "other" ? `<div class="msg-skel-avatar skel-base"></div>` : ""}
          <div class="msg-skel-group">
            ${p.name && p.side === "other" ? `<div class="msg-skel-name skel-base"></div>` : ""}
            <div class="msg-skel-bubble ${p.size} ${p.side}-bubble skel-base"></div>
            <div class="msg-skel-meta skel-base"></div>
          </div>
          ${p.side === "me" ? `<div class="msg-skel-avatar skel-base"></div>` : ""}
        </div>`;
    }
    html += '</div>';
    return html;
  }

  /* ── Build DM list skeletons ── */
  function _buildDmSkeletons(count) {
    let html = "";
    for (let i = 0; i < count; i++) {
      html += `
        <div class="dm-skeleton">
          <div class="dm-skel-avatar"></div>
          <div class="dm-skel-info">
            <div class="dm-skel-name"></div>
            <div class="dm-skel-preview"></div>
          </div>
        </div>`;
    }
    return html;
  }

  /* ── Build members list skeletons ── */
  function _buildMemberSkeletons(count) {
    let html = "";
    for (let i = 0; i < count; i++) {
      html += `
        <div class="member-skel-item">
          <div class="member-skel-avatar skel-base"></div>
          <div class="member-skel-info">
            <div class="member-skel-name skel-base"></div>
            <div class="member-skel-preview skel-base"></div>
          </div>
        </div>`;
    }
    return html;
  }

  /* ── Expose globally ── */
  window._buildMsgSkeletons    = _buildMsgSkeletons;
  window._buildDmSkeletons     = _buildDmSkeletons;
  window._buildMemberSkeletons = _buildMemberSkeletons;

  /* ══════════════════════════════════════════
     PATCH: startChatListener — replace spinner with skeleton
  ══════════════════════════════════════════ */
  const _origStartChat = window.startChatListener || null;

  // We patch the already-defined startChatListener via prototype override
  // by wrapping the innerHTML assignment that was: spinner → skeleton
  document.addEventListener("DOMContentLoaded", function() {

    /* ── Patch: renderMembersList spinner → skeleton ── */
    const _origRenderMembers = window.renderMembersList;
    if (typeof _origRenderMembers === "function") {
      window.renderMembersList = async function(q) {
        const el = document.getElementById("membersList");
        if (el && window._buildMemberSkeletons) {
          el.innerHTML = window._buildMemberSkeletons(7);
        }
        return _origRenderMembers.apply(this, arguments);
      };
    }

    /* ── Patch: buildDmList — show DM skeletons while loading ── */
    const _origBuildDmList = window.buildDmList;
    if (typeof _origBuildDmList === "function") {
      window.buildDmList = async function() {
        const list = document.getElementById("dmList");
        if (list && !list.querySelector("#dm-public") && window._buildDmSkeletons) {
          list.innerHTML = window._buildDmSkeletons(5);
        }
        return _origBuildDmList.apply(this, arguments);
      };
    }

  });

})();
    
