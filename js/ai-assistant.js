/**
 * ══════════════════════════════════════════
 *   AI ASSISTANT — صفحة المساعد الذكي (Full Page)
 *   مرحلة التصميم النهائية (UI/UX فقط) — بدون Gemini، بدون API، بدون Firebase
 *
 *   ▸ ملف مستقل بالكامل — لا يعدّل أي منطق في أي نظام آخر
 *   ▸ يملأ محتوى #page-ai فقط (صفحة كاملة حقيقية عبر showPage، وليست Modal/Overlay)
 *   ▸ جميع الأيقونات SVG مرسومة يدويًا بطراز Lucide — لا Emoji ولا Font Awesome
 *   ▸ أنماط الرسائل (ai-user-message / ai-assistant-message) مجهّزة هنا كقالب
 *     <template> خامل فقط — لا تُعرض ولا تُستخدم في أي منطق حتى المرحلة القادمة
 * ══════════════════════════════════════════
 */

(function () {
  "use strict";

  if (window.__aiAssistantLoaded) return;
  window.__aiAssistantLoaded = true;

  /* ─────────────────────────────────────────
     أيقونات SVG (طراز Lucide) — بدون أي مكتبة خارجية
  ───────────────────────────────────────── */
  const ICONS = {
    cpu: `<rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"></path>`,
    sparkles: `<path d="M12 3l1.6 4.8L18 9l-4.4 1.2L12 15l-1.6-4.8L6 9l4.4-1.2L12 3z"></path><path d="M5 3v3M3.5 4.5h3M19 15v3M17.5 16.5h3"></path>`,
    send: `<path d="M12 19V5"></path><path d="M5 12l7-7 7 7"></path>`,
    plus: `<path d="M12 5v14M5 12h14"></path>`,
    back: `<path d="M15 18l-6-6 6-6"></path>`,
    history: `<path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v5h5"></path><path d="M12 7v5l3 3"></path>`,
    close: `<path d="M18 6L6 18"></path><path d="M6 6l12 12"></path>`,
    book: `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>`,
    fileText: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M9 13h6M9 17h6M9 9h1"></path>`,
    calculator: `<rect x="4" y="2" width="16" height="20" rx="2"></rect><path d="M8 6h8"></path><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"></path>`,
    lightbulb: `<path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M12 2a7 7 0 0 0-4 12.7c.5.4.8 1 .8 1.7v.1h6.4v-.1c0-.7.3-1.3.8-1.7A7 7 0 0 0 12 2z"></path>`,
    search: `<circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path>`,
    pencil: `<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>`,
    trash: `<path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path>`,
    user: `<circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"></path>`,
    copy: `<rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>`,
    refresh: `<path d="M21 12a9 9 0 1 1-3-6.7"></path><path d="M21 3v6h-6"></path>`,
  };
  function _svg(name, cls) {
    return `<svg class="${cls || ""}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
  }

  const SUGGESTIONS = [
    { icon: "book",       text: "اشرح لي مفهومًا دراسيًا" },
    { icon: "fileText",   text: "لخّص لي محاضرة" },
    { icon: "calculator", text: "ساعدني في حل مسألة" },
    { icon: "lightbulb",  text: "أعطني أفكارًا للمذاكرة" },
  ];

  /* ─────────────────────────────────────────
     Gemini — اتصال مباشر من المتصفح (بقرار واعٍ من المالك، بدون Backend)
     ملاحظة أمان: المفتاح ظاهر في كود العميل بالضرورة في هذا النمط من الربط.
  ───────────────────────────────────────── */
  const GEMINI_API_KEY  = "AQ.Ab8RN6LEFyGotxw2ammnwhF0od-VswGzQt3MfB-zVmLc4CvnlQ";
  const GEMINI_MODEL    = "gemini-flash-latest";
  const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;

  let _conversation = [];   // {role:"user"|"model", text} — سياق الجلسة الحالية (يُرسَل لـ Gemini كما هو)
  let _isSending    = false;
  let _currentConversationId = null; // معرّف المحادثة المحفوظة الحالية (null = محادثة جديدة لم تُحفظ بعد)

  /* ─────────────────────────────────────────
     تخزين المحادثات — LocalStorage فقط (لا Firebase، لا خادم)
     البنية: [{ id, title, updatedAt, messages:[{role,text,time}] }]
  ───────────────────────────────────────── */
  const STORAGE_KEY = "ai_conversations_v1";

  function _loadAllConversations() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  function _saveAllConversations(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      window.toast?.("تعذّر حفظ المحادثة (مساحة التخزين ممتلئة)", "error");
      return false;
    }
  }

  function _genId() {
    return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function _makeTitleFromText(text) {
    const t = (text || "").trim().replace(/\s+/g, " ");
    return t.length > 42 ? t.slice(0, 42) + "…" : (t || "محادثة جديدة");
  }

  // إنشاء/تحديث المحادثة الحالية بعد كل تبادل رسائل مكتمل بنجاح
  function _persistExchange(userText, modelText) {
    const list = _loadAllConversations();
    const now = Date.now();
    let convo = _currentConversationId ? list.find(c => c.id === _currentConversationId) : null;

    if (!convo) {
      convo = { id: _genId(), title: _makeTitleFromText(userText), updatedAt: now, messages: [] };
      list.push(convo);
      _currentConversationId = convo.id;
    }
    convo.messages.push({ role: "user", text: userText, time: now });
    convo.messages.push({ role: "model", text: modelText, time: now });
    convo.updatedAt = now;
    _saveAllConversations(list);
  }

  function _renameConversation(id, newTitle) {
    const list = _loadAllConversations();
    const convo = list.find(c => c.id === id);
    if (!convo) return;
    convo.title = newTitle.trim() || convo.title;
    _saveAllConversations(list);
  }

  function _deleteConversation(id) {
    const list = _loadAllConversations().filter(c => c.id !== id);
    _saveAllConversations(list);
    if (_currentConversationId === id) {
      _currentConversationId = null;
      _conversation = [];
    }
  }

  function _getConversation(id) {
    return _loadAllConversations().find(c => c.id === id) || null;
  }

  function _esc(s) {
    return (s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function _formatTime(d) {
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  /* ─────────────────────────────────────────
     Markdown خفيف بدون أي مكتبة خارجية (تدعم: **عريض**، *مائل*، `كود`،
     ```كتلة كود``` (مع زر نسخ)، # عناوين، قوائم -، جداول Markdown، وروابط [نص](رابط))
     الأمان: يُهرَّب النص الأصلي بالكامل أولًا، وتُدرَج فقط وسوم HTML التي ننشئها نحن
  ───────────────────────────────────────── */
  function _renderMarkdown(raw) {
    const codeBlocks = [];
    let s = String(raw || "").replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (m, code) => {
      codeBlocks.push(code.replace(/\n$/, ""));
      return "\u0000CODEBLOCK" + (codeBlocks.length - 1) + "\u0000";
    });

    s = _esc(s);

    // جداول Markdown (على النص المُهرَّب مسبقًا، قبل أي تحويل آخر)
    const tables = [];
    s = s.replace(/^\|(.+)\|\r?\n\|([ :\-|]+)\|\r?\n((?:\|.*\|\r?\n?)*)/gm, (m, headerRow, sepRow, bodyRows) => {
      const headers = headerRow.split("|").map(c => c.trim()).filter(c => c !== "");
      const rows = bodyRows.trim().split("\n").filter(Boolean).map(r =>
        r.replace(/^\||\|$/g, "").split("|").map(c => c.trim())
      );
      let html = '<div class="ai-table-wrap"><table class="ai-md-table"><thead><tr>';
      headers.forEach(h => { html += `<th>${h}</th>`; });
      html += "</tr></thead><tbody>";
      rows.forEach(r => {
        html += "<tr>";
        r.forEach(c => { html += `<td>${c}</td>`; });
        html += "</tr>";
      });
      html += "</tbody></table></div>";
      tables.push(html);
      return "\u0000TABLE" + (tables.length - 1) + "\u0000";
    });

    s = s.replace(/`([^`\n]+)`/g, '<code class="ai-inline-code">$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
    s = s.replace(/^### (.*)$/gm, '<div class="ai-md-h3">$1</div>');
    s = s.replace(/^## (.*)$/gm, '<div class="ai-md-h2">$1</div>');
    s = s.replace(/^# (.*)$/gm, '<div class="ai-md-h1">$1</div>');
    s = s.replace(/^\s*[-*]\s+(.*)$/gm, "<li>$1</li>");
    s = s.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul class="ai-md-list">$1</ul>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="ai-md-link">$1</a>');
    s = s.replace(/\n/g, "<br>");

    s = s.replace(/\u0000TABLE(\d+)\u0000/g, (m, idx) => tables[Number(idx)]);
    s = s.replace(/\u0000CODEBLOCK(\d+)\u0000/g, (m, idx) => `
      <div class="ai-code-block-wrap">
        <button class="ai-code-copy-btn" title="نسخ الكود">${_svg("copy", "ai-icon")}</button>
        <pre class="ai-code-block"><code>${_esc(codeBlocks[Number(idx)])}</code></pre>
      </div>`);

    return s;
  }

  function _showTyping(show) {
    const el = document.getElementById("aiTypingIndicator");
    if (!el) return;
    if (show) {
      el.removeAttribute("hidden");
      el.classList.remove("ai-fade-in");
      void el.offsetWidth; // إعادة تشغيل حركة الظهور من جديد
      el.classList.add("ai-fade-in");
    } else {
      el.setAttribute("hidden", "");
    }
  }

  // هل المستخدم قريب من أسفل منطقة الرسائل؟ (لمنع "قفز" التمرير أثناء البث لو كان يقرأ رسالة أقدم)
  function _isNearBottom(threshold) {
    const body = document.getElementById("aiBody");
    if (!body) return true;
    return body.scrollHeight - body.scrollTop - body.clientHeight < (threshold || 90);
  }

  function _appendUserMessage(text, atTime) {
    const messages = document.getElementById("aiMessages");
    const tpl = document.getElementById("aiMessageTemplateUser");
    if (!messages || !tpl) return;
    const frag = tpl.content.cloneNode(true);
    const msgEl = frag.querySelector(".ai-message");
    frag.querySelector(".ai-message-bubble").textContent = text;
    frag.querySelector(".ai-message-time").textContent = _formatTime(atTime ? new Date(atTime) : new Date());
    msgEl.classList.add("ai-msg-fade-in");
    messages.appendChild(frag);
  }

  function _appendAssistantPlaceholder(atTime) {
    const messages = document.getElementById("aiMessages");
    const tpl = document.getElementById("aiMessageTemplateAssistant");
    if (!messages || !tpl) return null;
    const frag = tpl.content.cloneNode(true);
    const msgEl  = frag.querySelector(".ai-message");
    const textEl = frag.querySelector(".ai-message-text");
    const timeEl = frag.querySelector(".ai-message-time");
    msgEl.classList.add("ai-msg-fade-in");
    textEl.innerHTML = '<span class="ai-streaming-cursor"></span>';
    timeEl.textContent = _formatTime(atTime ? new Date(atTime) : new Date());
    messages.appendChild(frag);
    return { msgEl, textEl, timeEl };
  }

  function _appendErrorMessage(text) {
    const messages = document.getElementById("aiMessages");
    if (!messages) return;
    const div = document.createElement("div");
    div.className = "ai-message ai-assistant-message ai-message--error ai-msg-fade-in";
    div.innerHTML = `
      <div class="ai-message-avatar ai-message-avatar--ai">${_svg("cpu", "ai-icon")}</div>
      <div class="ai-message-content">
        <div class="ai-message-text">${_esc(text)}</div>
      </div>`;
    messages.appendChild(div);
  }

  /* ─────────────────────────────────────────
     الاتصال الفعلي بـ Gemini عبر Streaming (SSE) — بدون أي مكتبة خارجية
  ───────────────────────────────────────── */
  async function _streamGemini(userText, onDelta, onDone, onError) {
    const contents = [
      ..._conversation.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
      { role: "user", parts: [{ text: userText }] }
    ];

    let response;
    try {
      response = await fetch(GEMINI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": GEMINI_API_KEY },
        body: JSON.stringify({ contents })
      });
    } catch (e) {
      onError("تعذّر الاتصال بالخادم. تحقّق من اتصال الإنترنت وحاول مجددًا.");
      return;
    }

    if (!response.ok || !response.body) {
      let msg = "حدث خطأ أثناء الاتصال بالمساعد الذكي. حاول مرة أخرى.";
      if (response.status === 429) msg = "تم تجاوز الحد المسموح من الطلبات حاليًا. حاول بعد قليل.";
      else if (response.status === 400) msg = "تعذّر فهم الطلب. حاول إعادة صياغة رسالتك.";
      else if (response.status === 401 || response.status === 403) msg = "تعذّر التحقق من صلاحية الوصول للمساعد الذكي.";
      else if (response.status >= 500) msg = "خدمة المساعد الذكي غير متاحة حاليًا. حاول لاحقًا.";
      onError(msg);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let full = "";
    let sawAnyDelta = false;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;
          try {
            const obj = JSON.parse(jsonStr);
            const candidate = obj?.candidates?.[0];
            const delta = candidate?.content?.parts?.[0]?.text;
            if (delta) { full += delta; sawAnyDelta = true; onDelta(full); }
            if (candidate?.finishReason === "SAFETY") {
              onError("تعذّر إكمال الرد بسبب سياسات المحتوى. حاول إعادة صياغة سؤالك.");
              return;
            }
          } catch (e) { /* سطر جزئي غير مكتمل بعد — يُهمَل بأمان وينتظر باقي البيانات */ }
        }
      }
    } catch (e) {
      if (sawAnyDelta) { onDone(full); return; }
      onError("انقطع الاتصال أثناء استقبال الرد. حاول مجددًا.");
      return;
    }

    if (!sawAnyDelta) { onError("لم يصل أي رد من المساعد الذكي. حاول مجددًا."); return; }
    onDone(full);
  }

  /* ─────────────────────────────────────────
     إرسال رسالة حقيقية — تمنع التكرار المتزامن، تنظّف النص، وتُظهر الكتابة/البث
  ───────────────────────────────────────── */
  async function _handleSend() {
    if (_isSending) return;
    const input = document.getElementById("aiInput");
    const sendBtn = document.getElementById("aiSendBtn");
    if (!input) return;

    const text = input.value.trim().replace(/[ \t]+/g, " ").slice(0, 6000);
    if (!text) return;

    const welcome = document.getElementById("aiWelcome");
    if (welcome && !welcome.hidden) welcome.setAttribute("hidden", "");

    _appendUserMessage(text);
    window.__aiScrollToBottom(true); // رسالة المستخدم نفسها: تمرير مباشر دائمًا (فعل صريح من المستخدم)

    input.value = "";
    input.style.height = "auto";
    _isSending = true;
    if (sendBtn) sendBtn.disabled = true;
    _showTyping(true);

    let placeholder = null;
    let firstChunk = true;
    // تحديث الرسالة أثناء البث عبر requestAnimationFrame فقط (تحديث واحد كحد أقصى لكل إطار)
    // بدل تحديث DOM عند كل جزء نصي وارد — أداء أفضل خصوصًا على الهاتف
    let _pendingText = null;
    let _rafScheduled = false;
    function _flushPendingText() {
      _rafScheduled = false;
      if (!placeholder || _pendingText === null) return;
      const nearBottom = _isNearBottom();
      placeholder.textEl.innerHTML = _renderMarkdown(_pendingText) + '<span class="ai-streaming-cursor"></span>';
      if (nearBottom) window.__aiScrollToBottom(false);
    }
    function _scheduleTextUpdate(text) {
      _pendingText = text;
      if (_rafScheduled) return;
      _rafScheduled = true;
      requestAnimationFrame(_flushPendingText);
    }

    await _streamGemini(
      text,
      (accumulated) => {
        if (firstChunk) { _showTyping(false); placeholder = _appendAssistantPlaceholder(); firstChunk = false; }
        _scheduleTextUpdate(accumulated);
      },
      (finalText) => {
        _showTyping(false);
        if (!placeholder) placeholder = _appendAssistantPlaceholder();
        if (placeholder) placeholder.textEl.innerHTML = _renderMarkdown(finalText);
        _conversation.push({ role: "user", text });
        _conversation.push({ role: "model", text: finalText });
        _persistExchange(text, finalText);
        _renderHistoryList(document.getElementById("aiHistorySearchInp")?.value);
        _isSending = false;
        if (sendBtn) sendBtn.disabled = false;
        window.__aiScrollToBottom(true);
      },
      (errMsg) => {
        _showTyping(false);
        _appendErrorMessage(errMsg);
        _isSending = false;
        if (sendBtn) sendBtn.disabled = false;
        window.__aiScrollToBottom(true);
      }
    );
  }

  function _regenerateLast() {
    if (_isSending) return;
    if (!_conversation.length) return;
    const last = _conversation[_conversation.length - 1];
    if (last.role !== "model") return;
    _conversation.pop(); // إزالة رد النموذج الأخير من السياق
    const lastUser = _conversation.pop(); // إزالة رسالة المستخدم المقابلة لإعادة إرسالها
    if (!lastUser) return;

    // إزالة آخر تبادل من المحادثة المحفوظة أيضًا (سيُعاد إنشاؤه من جديد بعد الإرسال)
    if (_currentConversationId) {
      const list = _loadAllConversations();
      const convo = list.find(c => c.id === _currentConversationId);
      if (convo && convo.messages.length >= 2) {
        convo.messages.splice(-2, 2);
        _saveAllConversations(list);
      }
    }

    const messages = document.getElementById("aiMessages");
    const lastEl = messages?.lastElementChild;
    if (lastEl && lastEl.classList.contains("ai-assistant-message")) lastEl.remove();

    const input = document.getElementById("aiInput");
    if (input) { input.value = lastUser.text; }
    _handleSend();
  }

  let _built = false;
  function _root() { return document.getElementById("page-ai"); }

  /* ─────────────────────────────────────────
     بناء الصفحة (مرة واحدة فقط)
  ───────────────────────────────────────── */
  function _build() {
    if (_built) return;
    const root = _root();
    if (!root) return;
    _built = true;

    root.innerHTML = `
      <div class="ai-page" id="aiPageEl">

        <div class="ai-topbar">
          <button class="ai-back-btn" id="aiBackBtn" title="رجوع">
            ${_svg("back", "ai-icon")}
          </button>
          <div class="ai-brand">
            <div class="ai-orb">${_svg("cpu", "ai-icon")}</div>
            <div class="ai-brand-text">
              <div class="ai-brand-title">المساعد الذكي</div>
              <div class="ai-brand-sub">قيد التطوير</div>
            </div>
          </div>
          <div class="ai-topbar-actions">
            <button class="ai-icon-only-btn" id="aiHistoryBtn" title="المحادثات السابقة">${_svg("history", "ai-icon")}</button>
            <button class="ai-icon-only-btn" id="aiNewChatBtn" title="محادثة جديدة">${_svg("plus", "ai-icon")}</button>
          </div>
        </div>

        <div class="ai-body" id="aiBody">

          <!-- Skeleton أولي (تجريبي بصريًا فقط) — يختفي بعد لحظة ليظهر محتوى الترحيب -->
          <div class="ai-skeleton-wrap" id="aiSkeletonWrap">
            <div class="ai-skeleton ai-skeleton-avatar"></div>
            <div class="ai-skeleton ai-skeleton-line" style="width:60%"></div>
            <div class="ai-skeleton ai-skeleton-line" style="width:80%"></div>
            <div class="ai-skeleton-row">
              <div class="ai-skeleton ai-skeleton-chip"></div>
              <div class="ai-skeleton ai-skeleton-chip"></div>
              <div class="ai-skeleton ai-skeleton-chip"></div>
              <div class="ai-skeleton ai-skeleton-chip"></div>
            </div>
          </div>

          <div class="ai-welcome" id="aiWelcome" hidden>
            <div class="ai-hero-orb">${_svg("sparkles", "ai-icon")}</div>
            <div class="ai-hero-title">أهلًا بك في المساعد الذكي</div>
            <div class="ai-hero-sub">اسأل أي سؤال دراسي، أو اطلب مساعدة في المذاكرة والمحاضرات</div>

            <div class="ai-suggestions" id="aiSuggestions">
              ${SUGGESTIONS.map(s => `
                <button class="ai-suggestion-chip" data-text="${_esc(s.text)}">
                  ${_svg(s.icon, "ai-icon")}
                  <span>${_esc(s.text)}</span>
                </button>
              `).join("")}
            </div>
          </div>

          <div class="ai-messages" id="aiMessages"></div>

          <!-- مؤشر "AI يكتب" — واجهة فقط، مخفي افتراضيًا، جاهز للمرحلة القادمة -->
          <div class="ai-typing-indicator" id="aiTypingIndicator" hidden>
            <div class="ai-typing-avatar">${_svg("cpu", "ai-icon")}</div>
            <div class="ai-typing-dots"><span></span><span></span><span></span></div>
          </div>
        </div>

        <div class="ai-input-bar">
          <div class="ai-input-wrap">
            <textarea id="aiInput" class="ai-input" placeholder="اكتب رسالتك هنا..." rows="1"></textarea>
            <button class="ai-send-btn" id="aiSendBtn" title="إرسال">
              ${_svg("send", "ai-icon")}
            </button>
          </div>
          <div class="ai-input-hint">المساعد الذكي قيد التطوير — سيتم تفعيله في مرحلة قادمة</div>
        </div>

        <!-- لوحة المحادثات السابقة -->
        <div class="ai-history-panel" id="aiHistoryPanel">
          <div class="ai-history-header">
            <span>المحادثات السابقة</span>
            <button class="ai-icon-only-btn" id="aiHistoryCloseBtn">${_svg("close", "ai-icon")}</button>
          </div>
          <div class="ai-history-search">
            ${_svg("search", "ai-icon")}
            <input type="text" id="aiHistorySearchInp" placeholder="ابحث في المحادثات...">
          </div>
          <div class="ai-history-list" id="aiHistoryList"></div>
        </div>
        <div class="ai-history-backdrop" id="aiHistoryBackdrop"></div>

      </div>

      <!-- ══════════════════════════════════════════
           قالب رسالة (خامل تمامًا — لا يُعرض ولا يُستخدم الآن)
           جاهز للمرحلة القادمة: نسخ محتواه عبر template.content.cloneNode(true)
      ══════════════════════════════════════════ -->
      <template id="aiMessageTemplateUser">
        <div class="ai-message ai-user-message">
          <div class="ai-message-content">
            <div class="ai-message-bubble"></div>
            <div class="ai-message-meta">
              <span class="ai-message-time"></span>
            </div>
          </div>
          <div class="ai-message-avatar ai-message-avatar--user">${_svg("user", "ai-icon")}</div>
        </div>
      </template>

      <template id="aiMessageTemplateAssistant">
        <div class="ai-message ai-assistant-message">
          <div class="ai-message-avatar ai-message-avatar--ai">${_svg("cpu", "ai-icon")}</div>
          <div class="ai-message-content">
            <div class="ai-message-text"></div>
            <div class="ai-message-meta">
              <span class="ai-message-time"></span>
              <div class="ai-message-actions">
                <button class="ai-msg-action-btn" data-action="copy" title="نسخ">${_svg("copy", "ai-icon")}</button>
                <button class="ai-msg-action-btn" data-action="regenerate" title="إعادة توليد">${_svg("refresh", "ai-icon")}</button>
              </div>
            </div>
          </div>
        </div>
      </template>`;

    _bindEvents();
    _renderHistoryList();
    _setupViewportFix();
    _revealContentAfterSkeleton();
  }

  /* ─────────────────────────────────────────
     Skeleton تمهيدي (معاينة بصرية فقط) — يظهر للحظة ثم يُستبدل بالترحيب الحقيقي
     في المرحلة القادمة سيُستبدل بنفس الآلية لكن مربوطًا بحالة تحميل فعلية
  ───────────────────────────────────────── */
  function _revealContentAfterSkeleton() {
    const skeleton = document.getElementById("aiSkeletonWrap");
    setTimeout(() => {
      if (skeleton) skeleton.setAttribute("hidden", "");
      // لا تُظهر الترحيب لو المستخدم بدأ محادثة فعلية بالفعل قبل انتهاء هذا التوقيت
      if (_conversation.length === 0 && !document.getElementById("aiMessages")?.children.length) {
        document.getElementById("aiWelcome")?.removeAttribute("hidden");
      }
    }, 550);
  }

  /* ─────────────────────────────────────────
     معالجة ارتفاع الصفحة عند ظهور لوحة مفاتيح Android
     (بعض متصفحات أندرويد لا تُحدّث dvh فوريًا عند فتح الكيبورد،
     فنعتمد على visualViewport كمصدر حقيقة إضافي عند توفره)
  ───────────────────────────────────────── */
  function _setupViewportFix() {
    if (!window.visualViewport) return;
    const el = document.getElementById("aiPageEl");
    if (!el) return;
    const update = () => { el.style.height = window.visualViewport.height + "px"; };
    window.visualViewport.addEventListener("resize", update);
    update();
  }

  /* ─────────────────────────────────────────
     التمرير التلقائي السلس لأسفل منطقة الرسائل
     (جاهزة كدالة مساعدة للمرحلة القادمة — لا تُستدعى تلقائيًا الآن لأن القائمة فارغة)
  ───────────────────────────────────────── */
  function _scrollMessagesToBottom(smooth) {
    const body = document.getElementById("aiBody");
    if (!body) return;
    body.scrollTo({ top: body.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }
  window.__aiScrollToBottom = _scrollMessagesToBottom; // مُتاحة للمرحلة القادمة فقط، غير مستخدمة الآن

  /* ─────────────────────────────────────────
     لوحة المحادثات السابقة — بيانات حقيقية من LocalStorage
     مرتبة حسب آخر استخدام، مع بحث فوري في العنوان ومحتوى الرسائل معًا
  ───────────────────────────────────────── */
  function _renderHistoryList(filter) {
    const listEl = document.getElementById("aiHistoryList");
    if (!listEl) return;
    const q = (filter || "").trim().toLowerCase();

    let items = _loadAllConversations().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (q) {
      items = items.filter(c =>
        (c.title || "").toLowerCase().includes(q) ||
        (c.messages || []).some(m => (m.text || "").toLowerCase().includes(q))
      );
    }

    if (!items.length) {
      listEl.innerHTML = `
        <div class="ai-history-empty">
          <div class="ai-history-empty-icon">${_svg("history", "ai-icon")}</div>
          <div>${q ? "لا توجد محادثات مطابقة" : "لا توجد محادثات سابقة بعد"}</div>
        </div>`;
      return;
    }

    listEl.innerHTML = items.map(c => `
      <div class="ai-history-item${c.id === _currentConversationId ? " selected" : ""}" data-id="${c.id}">
        <span class="ai-history-item-title">${_esc(c.title)}</span>
        <div class="ai-history-item-actions">
          <button class="ai-history-item-btn" data-action="rename" title="إعادة تسمية">${_svg("pencil", "ai-icon")}</button>
          <button class="ai-history-item-btn" data-action="delete" title="حذف">${_svg("trash", "ai-icon")}</button>
        </div>
      </div>
    `).join("");
  }

  /* ─────────────────────────────────────────
     فتح محادثة محفوظة سابقًا: تُعاد كتابة #aiMessages من بياناتها بالكامل
  ───────────────────────────────────────── */
  function _openConversation(id) {
    if (_isSending) return; // لا نبدّل المحادثة أثناء انتظار رد جارٍ
    const convo = _getConversation(id);
    if (!convo) return;

    _currentConversationId = convo.id;
    _conversation = convo.messages.map(m => ({ role: m.role, text: m.text }));

    const messagesEl = document.getElementById("aiMessages");
    if (messagesEl) messagesEl.innerHTML = "";
    const welcome = document.getElementById("aiWelcome");
    if (welcome) welcome.setAttribute("hidden", "");

    convo.messages.forEach(m => {
      if (m.role === "user") {
        _appendUserMessage(m.text, m.time);
      } else {
        const ph = _appendAssistantPlaceholder(m.time);
        if (ph) ph.textEl.innerHTML = _renderMarkdown(m.text);
      }
    });

    const historyPanel = document.getElementById("aiHistoryPanel");
    const historyBackdrop = document.getElementById("aiHistoryBackdrop");
    historyPanel?.classList.remove("open");
    historyBackdrop?.classList.remove("show");

    window.__aiScrollToBottom(false);
  }

  /* ─────────────────────────────────────────
     إعادة تسمية محادثة — تحرير مباشر داخل عنصر القائمة نفسه
  ───────────────────────────────────────── */
  function _startInlineRename(id, itemEl) {
    const titleSpan = itemEl.querySelector(".ai-history-item-title");
    if (!titleSpan || itemEl.querySelector(".ai-history-item-rename-inp")) return;
    const current = titleSpan.textContent;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "ai-history-item-rename-inp";
    input.value = current;
    titleSpan.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    function commit() {
      if (done) return;
      done = true;
      const val = input.value.trim();
      _renameConversation(id, val || current);
      _renderHistoryList(document.getElementById("aiHistorySearchInp")?.value);
    }
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      else if (e.key === "Escape") { done = true; _renderHistoryList(document.getElementById("aiHistorySearchInp")?.value); }
    });
  }

  /* ─────────────────────────────────────────
     ربط الأحداث الفعلي: إرسال حقيقي لـ Gemini، وإدارة محادثات حقيقية عبر LocalStorage
  ───────────────────────────────────────── */
  function _bindEvents() {
    const input           = document.getElementById("aiInput");
    const sendBtn          = document.getElementById("aiSendBtn");
    const newChatBtn       = document.getElementById("aiNewChatBtn");
    const backBtn          = document.getElementById("aiBackBtn");
    const historyBtn       = document.getElementById("aiHistoryBtn");
    const historyCloseBtn  = document.getElementById("aiHistoryCloseBtn");
    const historyBackdrop  = document.getElementById("aiHistoryBackdrop");
    const historyPanel     = document.getElementById("aiHistoryPanel");
    const historySearchInp = document.getElementById("aiHistorySearchInp");
    const historyList      = document.getElementById("aiHistoryList");
    const suggestions      = document.getElementById("aiSuggestions");

    if (backBtn) {
      backBtn.addEventListener("click", () => {
        if (!window._navGoBackIfMatches?.("page:page-ai")) window.showPage?.("page-home");
      });
    }

    if (input) {
      input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 140) + "px";
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          _handleSend();
        }
      });
    }

    if (sendBtn) sendBtn.addEventListener("click", _handleSend);

    if (newChatBtn) {
      newChatBtn.addEventListener("click", () => {
        if (_isSending) return; // لا نبدأ محادثة جديدة أثناء انتظار رد جارٍ
        if (input) { input.value = ""; input.style.height = "auto"; }
        _conversation = [];
        _currentConversationId = null;
        const messagesEl = document.getElementById("aiMessages");
        if (messagesEl) messagesEl.innerHTML = "";
        const welcome = document.getElementById("aiWelcome");
        if (welcome) welcome.removeAttribute("hidden");
        _renderHistoryList(document.getElementById("aiHistorySearchInp")?.value);
        window.toast?.("بدأت محادثة جديدة");
      });
    }

    const messagesContainer = document.getElementById("aiMessages");
    if (messagesContainer) {
      messagesContainer.addEventListener("click", (e) => {
        const codeCopyBtn = e.target.closest(".ai-code-copy-btn");
        if (codeCopyBtn) {
          const codeEl = codeCopyBtn.parentElement?.querySelector("code");
          const text = codeEl ? codeEl.innerText : "";
          if (text && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(() => window.toast?.("تم نسخ الكود"));
          }
          return;
        }
        const btn = e.target.closest(".ai-msg-action-btn");
        if (!btn) return;
        const action = btn.dataset.action;
        if (action === "copy") {
          const textEl = btn.closest(".ai-message-content")?.querySelector(".ai-message-text");
          const text = textEl ? textEl.innerText : "";
          if (text && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(() => window.toast?.("تم نسخ الرد"));
          }
        } else if (action === "regenerate") {
          _regenerateLast();
        }
      });
    }

    function _openHistory() { historyPanel?.classList.add("open"); historyBackdrop?.classList.add("show"); }
    function _closeHistory() { historyPanel?.classList.remove("open"); historyBackdrop?.classList.remove("show"); }
    if (historyBtn) {
      historyBtn.addEventListener("click", () => {
        _renderHistoryList(historySearchInp ? historySearchInp.value : "");
        _openHistory();
      });
    }
    if (historyCloseBtn) historyCloseBtn.addEventListener("click", _closeHistory);
    if (historyBackdrop) historyBackdrop.addEventListener("click", _closeHistory);

    if (historySearchInp) {
      historySearchInp.addEventListener("input", () => _renderHistoryList(historySearchInp.value));
    }

    if (historyList) {
      historyList.addEventListener("click", (e) => {
        const actionBtn = e.target.closest(".ai-history-item-btn");
        const item = e.target.closest(".ai-history-item");
        if (!item) return;
        const id = item.dataset.id;

        if (actionBtn) {
          const action = actionBtn.dataset.action;
          if (action === "delete") {
            if (!window.confirm("حذف هذه المحادثة نهائيًا؟")) return;
            _deleteConversation(id);
            if (!_currentConversationId) {
              const messagesEl = document.getElementById("aiMessages");
              if (messagesEl) messagesEl.innerHTML = "";
              document.getElementById("aiWelcome")?.removeAttribute("hidden");
              if (input) { input.value = ""; input.style.height = "auto"; }
            }
            _renderHistoryList(historySearchInp ? historySearchInp.value : "");
            window.toast?.("تم حذف المحادثة");
          } else if (action === "rename") {
            _startInlineRename(id, item);
          }
          return;
        }

        _openConversation(id);
      });
    }

    if (suggestions) {
      suggestions.addEventListener("click", (e) => {
        const chip = e.target.closest(".ai-suggestion-chip");
        if (!chip || !input) return;
        input.value = chip.dataset.text || "";
        input.focus();
        input.dispatchEvent(new Event("input"));
      });
    }
  }

  /* ─────────────────────────────────────────
     نقطة الدخول: تُبنى الصفحة أول مرة تصبح نشطة
     (نعتمد كليًا على أن showPage الموجودة أصلاً تُضيف/تُزيل كلاس "active"
     على أي #page-X بما فيها #page-ai — فلا حاجة لأي تعديل على showPage نفسها)
  ───────────────────────────────────────── */
  function _watchPageOpen() {
    const root = _root();
    if (!root) return;
    if (root.classList.contains("active")) _build();
    const observer = new MutationObserver(() => {
      if (root.classList.contains("active")) _build();
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _watchPageOpen);
  } else {
    _watchPageOpen();
  }
})();
