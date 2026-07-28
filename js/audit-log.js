/* ══════════════════════════════════════════
   js/audit-log.js — سجل العمليات الإدارية
   منقول من index.html بدون أي تغيير في المنطق —
   فقط استبدال المراجع المحلية (isAdmin/isOwner/currentUser/db/esc/currentRole/currentName)
   بمراجع window المكافئة (نفس القيم، نفس السلوك تماماً).
   يكتب في auditLogs/{logId}
══════════════════════════════════════════ */
import {
  addDoc, collection, serverTimestamp, query, orderBy, limit, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const AUDIT_ACTIONS = Object.freeze({
  BAN_USER:         'ban_user',
  UNBAN_USER:       'unban_user',
  CHAT_BAN:         'chat_ban',
  CHAT_UNBAN:       'chat_unban',
  PROMOTE_ADMIN:    'promote_admin',
  DEMOTE_ADMIN:     'demote_admin',
  ASSIGN_VIP:       'assign_vip',
  REMOVE_VIP:       'remove_vip',
  DELETE_MESSAGE:   'delete_message',
  DELETE_NEWS:      'delete_news',
  DELETE_LECTURE:   'delete_lecture',
  DELETE_EXAM:      'delete_exam',
  DELETE_SECTION:   'delete_section',
  CREATE_ROOM:      'create_room',
  DELETE_ROOM:      'delete_room',
  OWNER_SELF_UNBAN: 'owner_self_unban',
  ADMIN_VIEW_OPEN:  'admin_view_open',
  ADMIN_VIEW_CLOSE: 'admin_view_close',
});

async function writeAuditLog(action, details = {}, targetUid = null, targetName = null) {
  const db = window.db;
  const currentUser = window.currentUser;
  if (!window.isAdmin?.() || !currentUser?.uid) return;
  try {
    // actorRole مأخوذ من currentRole الذي يُحمَّل من Firestore عند تسجيل الدخول
    // Rules تتحقق منه server-side: actorRole == myRole()
    // لا يمكن تزويره لأن Rules تقيّده بالقيمة الفعلية في Firestore
    const logEntry = {
      action,
      actorUid:   currentUser.uid,
      actorName:  window.getCurrentName?.() || 'unknown',
      actorRole:  window.getCurrentRole?.() || 'user',  // verified by Firestore Rules
      timestamp:  serverTimestamp(),
      ...(targetUid  ? { targetUid }  : {}),
      ...(targetName ? { targetName } : {}),
      ...details
    };
    await addDoc(collection(db, 'auditLogs'), logEntry);
  } catch(e) {
    console.warn('AuditLog write failed:', e.code, e.message);
  }
}

async function loadAuditLogs(containerId = 'auditLogsList') {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!window.isOwner?.()) { el.innerHTML = '<div class="empty-state">غير مصرح</div>'; return; }
  el.innerHTML = '<div class="spinner"></div>';
  try {
    const db = window.db;
    const esc = window.esc;
    const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(50));
    const snap = await getDocs(q);
    if (snap.empty) { el.innerHTML = '<div class="empty-state">لا توجد سجلات بعد</div>'; return; }
    el.innerHTML = '';
    const _auditLabels = {
      ban_user:         { label: '🚫 حظر حساب',          color: '#fca5a5' },
      unban_user:       { label: '✅ رفع حظر حساب',       color: '#86efac' },
      chat_ban:         { label: '🔇 حظر شات',             color: '#fcd34d' },
      chat_unban:       { label: '🔊 رفع حظر شات',        color: '#5eead4' },
      promote_admin:    { label: '⬆️ ترقية أدمن',          color: '#fb923c' },
      demote_admin:     { label: '⬇️ تنزيل أدمن',          color: '#93c5fd' },
      assign_vip:       { label: '⭐ منح VIP',             color: '#fde080' },
      remove_vip:       { label: '🗑️ إزالة VIP',           color: '#d1d5db' },
      delete_message:   { label: '💬 حذف رسالة',           color: '#fca5a5' },
      delete_news:      { label: '📰 حذف خبر',             color: '#fca5a5' },
      delete_lecture:   { label: '📚 حذف محاضرة',          color: '#fca5a5' },
      delete_exam:      { label: '📅 حذف امتحان',          color: '#fca5a5' },
      delete_section:   { label: '🏫 حذف سكشن',            color: '#fca5a5' },
      create_room:      { label: '🏠 إنشاء غرفة',          color: '#86efac' },
      delete_room:      { label: '🗑️ حذف غرفة',            color: '#fca5a5' },
      owner_self_unban: { label: '👑 فك حظر الأونر',       color: '#c9a96e' },
      admin_view_open:  { label: '👁 فتح حساب للمشاهدة',    color: '#f97316' },
      admin_view_close: { label: '🚪 إغلاق وضع المشاهدة',   color: '#9ca3af' },
    };
    snap.forEach(d => {
      const log = d.data();
      const ts  = log.timestamp?.toDate?.() || new Date();
      const timeStr = ts.toLocaleString('ar-EG', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
      const info = _auditLabels[log.action] || { label: log.action, color: '#9ca3af' };
      const row = document.createElement('div');
      row.style.cssText = 'padding:10px 12px;margin:4px 0;border-radius:10px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02);font-size:12px;display:flex;flex-direction:column;gap:4px;';
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:700;color:${info.color}">${info.label}</span>
          <span style="color:var(--muted);font-size:10px">${timeStr}</span>
        </div>
        <div style="color:var(--muted)">
          بواسطة: <span style="color:var(--text);font-weight:600">${esc(log.actorName||'—')}</span>
          <span style="color:var(--gold);font-size:10px">(${log.actorRole||'—'})</span>
          ${log.targetName ? ` → <span style="color:var(--text)">${esc(log.targetName)}</span>` : ''}
        </div>
        ${log.msgPreview ? `<div style="color:var(--muted);font-size:11px;font-style:italic">"${esc(log.msgPreview)}"</div>` : ''}
        ${log.combined   ? `<div style="color:var(--gold);font-size:11px">${esc(log.combined)}</div>` : ''}
      `;
      el.appendChild(row);
    });
  } catch(e) {
    el.innerHTML = `<div class="empty-state">خطأ: ${esc(e.code || e.message)}</div>`;
    console.error(e);
  }
}

window.AUDIT_ACTIONS  = AUDIT_ACTIONS;
window.writeAuditLog  = writeAuditLog;
window.loadAuditLogs  = loadAuditLogs;
