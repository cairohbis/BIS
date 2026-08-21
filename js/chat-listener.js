/* ══════════════════════════════════════════════════════════════
   CHAT LISTENER — الاستماع اللحظي + الـ Pagination + حالة القراءة
   ▸ منقولة حرفيًا من index.html (بدون أي تعديل منطقي)
   ▸ تضم: startChatListener, _insertLoadMoreBtn, _loadOlderMessages,
     _markMessagesSeenAsync, _markOneMsgSeen, _refreshMsgTick
   ▸ + كل الـ state الخاص بيهم (كان مبعثر بين index.html:2102
     و index.html:4209-4213) — نُقل سوا لأنه غير مستخدم برّه المجموعة دي خالص
   ▸ Typing indicator system (_stopTyping, _startTypingListener) اتسابت
     عمدًا في index.html لتقليل الـ bridges — بتتصدّر هناك على window
   ══════════════════════════════════════════════════════════════ */

import { collection, doc, getDocs, limit, onSnapshot, orderBy, query,
         startAfter, updateDoc, where, writeBatch }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let _reactionsUnsub = null;

/* ══════════════════════════════════════════
   CHAT PAGINATION STATE
   PAGE_SIZE: رسائل لكل تحميل
   _oldestDoc: آخر نقطة للتحميل للخلف
   _allLoaded: وصلنا لأول رسالة؟
   _loadingMore: منع التحميل المتكرر
══════════════════════════════════════════ */
const PAGE_SIZE    = 40;
let _oldestDoc     = null;
let _allLoaded     = false;
let _loadingMore   = false;
let _activeChatId  = null;

async function startChatListener(chatId) {
  // ── إيقاف المستمع السابق ──────────────────
  if (msgUnsub) { msgUnsub(); msgUnsub = null; }
  if (_reactionsUnsub) { _reactionsUnsub(); _reactionsUnsub = null; }
  _stopTyping();
  _startTypingListener(chatId);

  // إعادة تعيين حالة Pagination
  _oldestDoc   = null;
  _allLoaded   = false;
  _loadingMore = false;
  _activeChatId = chatId;

  // ── تجهيز المحادثة الخاصة ─────────────────
  if (chatId !== "public") {
    try {
      await ensurePrivateChatDoc(chatId);
    } catch(e) {
      if (_activeChatId !== chatId) return;
      const container = document.getElementById("chatMessages");
      container.innerHTML = `<div class="empty-state" style="margin:auto;color:var(--danger);">
        <i class="fa-solid fa-triangle-exclamation"></i> فشل تحميل المحادثة (${e.code || e.message})
        <br><small style="color:var(--muted);">تأكد من تحديث Firestore Rules</small>
      </div>`;
      return;
    }
    if (_activeChatId !== chatId) return;
    _markMessagesSeenAsync(chatId);
  }

  updateChatBannedState();

  const container = document.getElementById("chatMessages");
  container.innerHTML = (window._buildMsgSkeletons ? window._buildMsgSkeletons(10) : `<div class="spinner" style="margin:auto;margin-top:60px;"></div>`);

  // ── تحميل الصفحة الأولى (أحدث PAGE_SIZE رسالة) ─
  const colPath = chatColPath(chatId);
  const initQ   = query(
    collection(db, colPath),
    orderBy("createdAt", "desc"),
    limit(PAGE_SIZE)
  );

  let initSnap;
  try { initSnap = await getDocs(initQ); }
  catch(e) {
    if (_activeChatId !== chatId) return;
    container.innerHTML = `<div class="empty-state" style="margin:auto;">خطأ في التحميل</div>`;
    return;
  }

  if (_activeChatId !== chatId) return;

  container.innerHTML = "";

  // ✅ متغيّر مشترك بين التحميل الأول والمستمع الحي — يحل مشكلة تكرار فاصل التاريخ
  let prevDate = null;
  let prevSenderUid = null;

  if (initSnap.empty) {
    container.innerHTML = `<div class="empty-state" style="margin:auto;">لا توجد رسائل بعد <i class="fa-solid fa-comments"></i></div>`;
    _allLoaded = true;
  } else {
    // الرسائل جاءت desc، نعكسها للعرض الصحيح
    const docs = [...initSnap.docs].reverse();
    _oldestDoc = docs[0];                          // أقدم وثيقة في الصفحة
    _allLoaded = initSnap.size < PAGE_SIZE;

    // زر "تحميل المزيد" في الأعلى
    if (!_allLoaded) _insertLoadMoreBtn(container, chatId);

    // إضافة div خاص بالرسائل الأقدم (فوق) والأحدث (تحت)
    docs.forEach(d => {
      appendChatMsg(container, d.id, d.data(), prevDate, nd => { prevDate = nd; }, prevSenderUid, nu => { prevSenderUid = nu; });
    });

    // تمرير للأسفل فوري بدون animation عند الفتح
    container.style.scrollBehavior = "auto";
    container.scrollTop = container.scrollHeight;
    requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; container.style.scrollBehavior = ""; });
  }

  // ── Listener للرسائل الجديدة فقط ──────────────────────────────────
  // نستخدم createdAt من آخر doc. إذا كانت null (serverTimestamp لم يُطبَّق بعد)
  // نرجع لـ new Date() كـ fallback آمن
  const newestDoc = initSnap.empty ? null : initSnap.docs[0];
  let liveQ;
  if (newestDoc) {
    const newestTs = newestDoc.data().createdAt ?? new Date(0);
    liveQ = query(
      collection(db, colPath),
      orderBy("createdAt", "asc"),
      where("createdAt", ">", newestTs)
    );
  } else {
    liveQ = query(collection(db, colPath), orderBy("createdAt", "asc"), limit(1));
  }

  msgUnsub = onSnapshot(liveQ, snap => {
    if (_activeChatId !== chatId) return;
    snap.docChanges().forEach(ch => {
      if (ch.type === "added") {
        const el = document.getElementById("chatMessages");
        const empty = el.querySelector(".empty-state");
        if (empty) empty.remove();
        appendChatMsg(el, ch.doc.id, ch.doc.data(), prevDate, nd => { prevDate = nd; }, prevSenderUid, nu => { prevSenderUid = nu; });

        if (chatId !== "public" && ch.doc.data().uid !== currentUser.uid) {
          _markOneMsgSeen(chatId, ch.doc.id);
        }
        requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
      }
      if (ch.type === "modified") {
        _refreshMsgTick(ch.doc.id, ch.doc.data());
        // Handle edited text update
        const d = ch.doc.data();
        if (d.edited) {
          const row = document.getElementById("msg-" + ch.doc.id);
          if (row) {
            const textEl = row.querySelector(".bubble-text");
            if (textEl && !d.image && !d.audio && !d.pdf && !d.file) {
              textEl.textContent = d.text || "";
            }
            // Add/update edited label
            const meta = row.querySelector(".bubble-time-in");
            if (meta && !meta.querySelector(".edited-label")) {
              const lbl = document.createElement("span");
              lbl.className = "edited-label";
              lbl.style.cssText = "font-size:10px;color:var(--muted);font-style:italic;margin-inline-start:3px;";
              lbl.textContent = "تم التعديل";
              const timeEl = meta.querySelector(".bubble-time");
              if (timeEl) timeEl.insertAdjacentElement("afterend", lbl);
              else meta.prepend(lbl);
            }
          }
        }
        // ── Update reactions in real-time ──
        if (typeof _updateReactionChips === "function") {
          const row = document.getElementById("msg-" + ch.doc.id);
          if (row) _updateReactionChips(row, ch.doc.id, d.reactions || {});
          // Refresh ctx menu reaction bar if this message is open
          if (_ctxDocId === ch.doc.id && _ctxData) {
            _ctxData = { ..._ctxData, reactions: d.reactions || {} };
            const myUid2 = currentUser?.uid;
            document.querySelectorAll("#ctxReactionBar .reaction-btn").forEach(btn => {
              const em = btn.dataset.emoji;
              const vt = (d.reactions || {})[em] || [];
              btn.classList.toggle("my-pick", vt.includes(myUid2));
            });
          }
        }
      }
      if (ch.type === "removed")  document.getElementById(`msg-${ch.doc.id}`)?.remove();
    });
  }, err => console.error("liveQ:", err));

  // ── Listener للتفاعلات على الرسائل المحمّلة ──────────────────────────
  // يستمع للـ modified على نفس الـ colPath ليحدّث الـ chips فوراً
  if (!initSnap.empty && _oldestDoc) {
    const oldestTs = _oldestDoc.data().createdAt ?? new Date(0);
    const reactQ   = query(
      collection(db, colPath),
      orderBy("createdAt", "asc"),
      where("createdAt", ">=", oldestTs)
    );
    _reactionsUnsub = onSnapshot(reactQ, rSnap => {
      if (_activeChatId !== chatId) return;
      rSnap.docChanges().forEach(ch => {
        if (ch.type !== "modified") return;
        const d   = ch.doc.data();
        const row = document.getElementById("msg-" + ch.doc.id);
        // ✅ تحديث فوري عند حذف رسالة (realtime، بدون الحاجة لتحديث الصفحة)
        if (row && d.deleted) {
          const bubbleEl = row.querySelector('.bubble-text, .bubble-image');
          if (bubbleEl && bubbleEl.textContent !== '🗑 تم حذف هذه الرسالة') {
            bubbleEl.className = 'bubble-text';
            bubbleEl.style.cssText = 'color:var(--muted);font-style:italic;font-size:12px;';
            bubbleEl.textContent = '🗑 تم حذف هذه الرسالة';
          }
          return;
        }
        if (row && typeof _updateReactionChips === "function") {
          _updateReactionChips(row, ch.doc.id, d.reactions || {});
        }
        // Refresh ctx bar if open on this message
        if (_ctxDocId === ch.doc.id) {
          _ctxData = { ..._ctxData, reactions: d.reactions || {} };
          const myUid3 = currentUser?.uid;
          document.querySelectorAll("#ctxReactionBar .reaction-btn").forEach(btn => {
            const em = btn.dataset.emoji;
            const vt = (d.reactions || {})[em] || [];
            btn.classList.toggle("my-pick", vt.includes(myUid3));
          });
        }
      });
    }, () => {});
  }

  // ── Scroll للأعلى → تحميل المزيد ──────────
  container.onscroll = () => {
    if (container.scrollTop < 80 && !_loadingMore && !_allLoaded) {
      _loadOlderMessages(chatId);
    }
  };
}

/* ── زر "تحميل المزيد" ── */
function _insertLoadMoreBtn(container, chatId) {
  const existing = container.querySelector(".load-more-btn");
  if (existing) return;
  const btn = document.createElement("button");
  btn.className   = "load-more-btn";
  btn.innerHTML = "<i class=\"fa-solid fa-arrow-up\"></i> تحميل رسائل أقدم";
  btn.onclick     = () => _loadOlderMessages(chatId);
  container.prepend(btn);
}

/* ── تحميل رسائل أقدم (Pagination) ── */
async function _loadOlderMessages(chatId) {
  if (_loadingMore || _allLoaded || !_oldestDoc) return;
  if (_activeChatId !== chatId) return;

  _loadingMore = true;
  const container = document.getElementById("chatMessages");
  const btn = container.querySelector(".load-more-btn");
  if (btn) { btn.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> جاري التحميل...'; btn.disabled = true; }

  const prevScrollH = container.scrollHeight;

  try {
    const colPath = chatColPath(chatId);
    const olderQ  = query(
      collection(db, colPath),
      orderBy("createdAt", "desc"),
      startAfter(_oldestDoc),
      limit(PAGE_SIZE)
    );
    const snap = await getDocs(olderQ);
    if (_activeChatId !== chatId) return;

    if (snap.empty || snap.size < PAGE_SIZE) {
      _allLoaded = true;
      btn?.remove();
    } else {
      if (btn) { btn.innerHTML = "<i class=\"fa-solid fa-arrow-up\"></i> تحميل رسائل أقدم"; btn.disabled = false; }
    }

    if (!snap.empty) {
      const docs = [...snap.docs].reverse();
      _oldestDoc = docs[0];

      // إدراج الرسائل في بداية الـ container (فوق الموجودة)
      const fragment = document.createDocumentFragment();
      let prevDate   = null;
      let prevSenderUid = null;
      docs.forEach(d => {
        // نبني عنصر مؤقت ونضيف إلى fragment
        const tempDiv = document.createElement("div");
        const tmpContainer = { appendChild: el => fragment.appendChild(el) };
        appendChatMsg(tmpContainer, d.id, d.data(), prevDate, nd => { prevDate = nd; }, prevSenderUid, nu => { prevSenderUid = nu; });
      });

      // الصور داخل الرسائل المُدرَجة ليس لها width/height محجوزة مسبقاً،
      // فارتفاعها الحقيقي لا يُعرف إلا بعد اكتمال تحميلها (onload)، وهو ما يحدث
      // بعد أن يكون prevScrollH/scrollHeight قد قِيسا بالفعل. لذلك نلتقط
      // مراجع هذه الصور الآن (قبل الإدراج بالـ DOM) لنعوّض الفرق لاحقاً.
      const _pendingImgs = [...fragment.querySelectorAll(".bubble-image img")].filter(img => !img.complete);

      // احذف فاصل التاريخ الأول الموجود في الـ container إذا كان نفس آخر تاريخ في الـ batch
      // لتجنب تكرار نفس الفاصل بين الـ batch القديم والجديد
      const firstExistingDivider = container.querySelector(".date-divider");
      if (firstExistingDivider && prevDate) {
        const firstExistingDate = firstExistingDivider.querySelector("span")?.textContent;
        if (firstExistingDate === prevDate) firstExistingDivider.remove();
      }

      // أدرج fragment بعد الزر مباشرة
      const loadBtn = container.querySelector(".load-more-btn");
      if (loadBtn) loadBtn.after(fragment);
      else container.prepend(fragment);

      // حافظ على موضع الـ scroll بعد الإدراج
      // ملاحظة: .chat-body لديها scroll-behavior:smooth بالـ CSS (لتمرير الرسائل الجديدة بسلاسة)،
      // فإذا تركناها كما هي هنا، فإن ضبط scrollTop سيتحرك بشكل animated بدل فوري،
      // مما يجعل scrollTop يبقى أقل من 80 أثناء الحركة ⇒ يُعاد استدعاء _loadOlderMessages
      // بشكل متكرر (أو يبدو أن السكرول "يقفز"/لا يعمل بشكل صحيح). لذلك نعطّل الـ smooth
      // مؤقتاً هنا فقط، تماماً مثلما يحدث عند فتح الشات أول مرة.
      const _prevScrollBehavior = container.style.scrollBehavior;
      container.style.scrollBehavior = "auto";
      container.scrollTop += container.scrollHeight - prevScrollH;
      container.style.scrollBehavior = _prevScrollBehavior;

      // تعويض إضافي عند اكتمال تحميل أي صورة من الرسائل القديمة (ترتفع بعد
      // التحميل لأن لا width/height محجوزة لها مسبقاً، فتزيح المحتوى وتُحدث
      // قفزة محسوسة أثناء التمرير لأعلى). نقيس الفرق الفعلي في scrollHeight
      // بعد كل صورة (بترتيب اكتمالها، أياً كان)، ونعوّضه فوراً وبدون animation.
      let _lastKnownH = container.scrollHeight;
      _pendingImgs.forEach(img => {
        img.addEventListener("load", () => {
          if (_activeChatId !== chatId) return; // الشات تغيّر، لا داعي للتعويض
          const newH = container.scrollHeight;
          const diff = newH - _lastKnownH;
          _lastKnownH = newH;
          if (diff !== 0) {
            const behPrev = container.style.scrollBehavior;
            container.style.scrollBehavior = "auto";
            container.scrollTop += diff;
            container.style.scrollBehavior = behPrev;
          }
        }, { once: true });
      });
    }
  } catch(e) {
    console.error("loadOlder:", e);
    if (btn) { btn.innerHTML = "<i class=\"fa-solid fa-arrow-up\"></i> تحميل رسائل أقدم"; btn.disabled = false; }
  }

  _loadingMore = false;
}
window.startChatListener = startChatListener;

/* ══════════════════════════════════════════
   SEEN / DELIVERED HELPERS
══════════════════════════════════════════ */
// تحديد جميع الرسائل غير المقروءة كـ "seen" (batch) عند فتح المحادثة
async function _markMessagesSeenAsync(otherUid) {
  // ✅ AVM: في وضع المشاهدة لا نعلّم أي رسالة كمقروءة
  if (_avm.active) return;
  // ✅ Privacy: إذا أوقف المستخدم إيصالات القراءة لا نُرسلها
  if (typeof _privPrefs !== "undefined" && _privPrefs.readReceipts === false) return;
  try {
    const roomId = privateChatId(otherUid);
    const q = query(
      collection(db, `privateChats/${roomId}/messages`),
      where("seen", "==", false),
      limit(50)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    // علّم فقط رسائل الطرف الآخر
    snap.forEach(d => {
      if (d.data().uid !== currentUser.uid) {
        batch.update(d.ref, { seen: true, delivered: true });
      }
    });
    await batch.commit();
  } catch(e) {
    // غير حرجة — تجاهل أخطاء الـ index أو الـ permission
    if (e.code !== "permission-denied") console.warn("markSeen:", e.code);
  }
}

// Mark a single newly-arrived message as seen
async function _markOneMsgSeen(otherUid, msgId) {
  // ✅ AVM: في وضع المشاهدة لا نعدّل حالة الرسائل
  if (_avm.active) return;
  // ✅ Privacy: إذا أوقف المستخدم إيصالات القراءة لا نُرسلها
  if (typeof _privPrefs !== "undefined" && _privPrefs.readReceipts === false) return;
  try {
    const roomId = privateChatId(otherUid);
    await updateDoc(
      doc(db, `privateChats/${roomId}/messages`, msgId),
      { delivered: true, seen: true }
    );
  } catch(e) { /* non-critical */ }
}

// Refresh the ✓✓ tick on an already-rendered message bubble
function _refreshMsgTick(msgId, data) {
  const row = document.getElementById(`msg-${msgId}`);
  if (!row) return;
  const tickEl = row.querySelector(".bubble-status");
  if (!tickEl) return;
  const _checkSvg2 = `<svg width="14" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 5l3 3 5-7"/><path d="M6 5l3 3 6-7"/></svg>`;
  const _checkSvg1 = `<svg width="12" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 5l3 3 8-9"/></svg>`;
  if (data.seen)           { tickEl.innerHTML = _checkSvg2; tickEl.classList.add("seen"); }
  else if (data.delivered) { tickEl.innerHTML = _checkSvg2; tickEl.classList.remove("seen"); }
  else                      { tickEl.innerHTML = _checkSvg1; tickEl.classList.remove("seen"); }
}

window._markMessagesSeenAsync = _markMessagesSeenAsync;
window._markOneMsgSeen        = _markOneMsgSeen;
window._refreshMsgTick        = _refreshMsgTick;
window._loadOlderMessages     = _loadOlderMessages;
window._insertLoadMoreBtn     = _insertLoadMoreBtn;
