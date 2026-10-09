/* ══════════════════════════════════════════
   updates-check.js
   ملف مستقل — زر "التحديثات" في الإعدادات + زر «تحديث» في نافذة إشعار التحديث

   التحقق الفعلي من نسخة الموقع المنشورة على GitHub Pages:
   ▸ مصدر الحقيقة: ترويسات ETag / Last-Modified لطلبات HEAD (لا تمرّ على الـ Service Worker
     ولا على كاش HTTP: cache:"no-store") لملفات الواجهة (html/js/css/json) فقط — بدون تنزيل أجسامها.
   ▸ تُقارَن بآخر بصمة محفوظة محليًا (localStorage["bariq_shell_fp"]) لمعرفة ما تغيّر فعلًا.
   ▸ لا تغيير → رسالة فقط، بدون حذف كاش ولا إعادة تحميل.
   ▸ تغيير → يُحدَّث كل ملف تغيّر وحده: تُحذف نسخته من كاش bariq-shell-* ثم يُجلب بـ cache:"reload"
     (يتجاوز كاش HTTP ويُحدّثه فلا تعيد خلفية الـ Service Worker نسخة قديمة) ويُتحقق أنه صار متاحًا.
     أي فشل → تُستعاد النسخ القديمة كلها (لا نسخ مختلطة) ولا تُحفظ البصمة.
   ▸ إعادة التحميل فقط بعد نجاح الجلب، ولا تلمس Auth ولا Firestore ولا worldId ولا أي بيانات مستخدم.

   الاستخدام: onclick="window._checkForUpdates()" من أي زرار
══════════════════════════════════════════ */

const _UC_KEY = "bariq_shell_fp";
const _UC_CODE = /\.(?:html|js|css|json|webmanifest)$/i;
const _ucShell = (k) => k.startsWith("bariq-shell-");

/* URL نظيف لملف واجهة من نفس الموقع (أو null) — بدون _refresh وبدون hash */
function _ucNorm(raw) {
  try {
    const u = new URL(raw, location.href);
    if (u.origin !== location.origin) return null;
    u.hash = "";
    u.searchParams.delete("_refresh");
    if (!(_UC_CODE.test(u.pathname) || u.pathname.endsWith("/"))) return null;
    return u.toString();
  } catch (_) { return null; }
}

/* قائمة الملفات التي يستخدمها التطبيق فعلًا: الكاش + ما حمّلته الصفحة + الصفحة نفسها */
async function _ucCollect() {
  const set = new Set();
  const add = (r) => { const u = _ucNorm(r); if (u) set.add(u); };
  add(location.href); add("./"); add("index.html"); add("manifest.json");
  try { performance.getEntriesByType("resource").forEach((e) => add(e.name)); } catch (_) {}
  if ("caches" in window) {
    for (const k of (await caches.keys()).filter(_ucShell)) {
      const c = await caches.open(k);
      (await c.keys()).forEach((r) => add(r.url));
    }
  }
  return [...set];
}

const _ucVal = (h) => { const v = (h.get("etag") || "") + "|" + (h.get("last-modified") || ""); return v === "|" ? "" : v; };

/* HEAD بدون كاش: النص = بصمة الملف، "" = بلا ترويسات تحقق، null = ملف غير موجود (404...) ، ويرمي عند فشل الشبكة */
async function _ucHead(u) {
  const res = await fetch(u, { method: "HEAD", cache: "no-store" });
  return res.ok ? _ucVal(res.headers) : null;
}

async function _ucPool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const it = items[i++]; await fn(it); }
  }));
}

async function _ucCacheVal(u) {
  if (!("caches" in window)) return "";
  for (const k of (await caches.keys()).filter(_ucShell)) {
    const r = await (await caches.open(k)).match(u);
    if (r) return _ucVal(r.headers);
  }
  return "";
}

/* تحديث ملف واحد: حذف نسخته من الكاش → جلب فعلي يتجاوز كاش HTTP → تخزينه → التحقق. backups للتراجع */
async function _ucRefresh(u, backups) {
  const held = [];
  if ("caches" in window) {
    for (const k of (await caches.keys()).filter(_ucShell)) {
      const c = await caches.open(k);
      const old = await c.match(u);
      if (old) held.push({ c, old });
    }
  }
  held.forEach((h) => backups.push({ c: h.c, u, old: h.old.clone() }));
  for (const h of held) await h.c.delete(u);
  const res = await fetch(u, { cache: "reload" });
  if (!res.ok) throw new Error("refresh " + res.status + " " + u);
  for (const h of held) await h.c.put(u, res.clone());
  for (const h of held) if (!(await h.c.match(u))) throw new Error("verify " + u);
}

async function _ucRollback(backups) {
  for (const b of backups) { try { await b.c.put(b.u, b.old); } catch (_) {} }
}

/* حذف نسخ التنقل المؤقتة (...?_refresh=) التي يخزّنها الـ Service Worker حتى لا تتراكم */
async function _ucPurge() {
  if (!("caches" in window)) return;
  for (const k of (await caches.keys()).filter(_ucShell)) {
    const c = await caches.open(k);
    for (const r of await c.keys()) {
      try { if (new URL(r.url).searchParams.has("_refresh")) await c.delete(r); } catch (_) {}
    }
  }
}

/* تحديث الـ Service Worker نفسه إن تغيّر ملفه، وانتظار تفعيله قبل فحص الكاش (يرجع true لو وُجد إصدار جديد) */
async function _ucSw() {
  let found = false;
  if (!("serviceWorker" in navigator)) return found;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map(async (r) => {
    try {
      await r.update();
      const w = r.installing || r.waiting;
      if (w) {
        found = true;
        if (w.state !== "activated") {
          await new Promise((res) => {
            const t = setTimeout(res, 4000);
            w.addEventListener("statechange", () => {
              if (w.state === "activated" || w.state === "redundant") { clearTimeout(t); res(); }
            });
          });
        }
      }
    } catch (_) {}
  }));
  return found;
}

/* سلوك قديم احتياطي فقط لو الخادم لا يرسل أي ترويسة تحقق (لا يمكن التحقق عندها) */
async function _ucLegacy() {
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.update().catch(() => {})));
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter(_ucShell).map((k) => caches.delete(k)));
  }
}

function _ucReload() {
  setTimeout(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("_refresh", Date.now());
    window.location.replace(url.toString());
  }, 600);
}

window._checkForUpdates = async function () {
  const btn = event?.currentTarget;
  const label = btn?.querySelector(".smod-label");
  const originalText = label?.textContent;
  const say = (m, t) => { if (typeof window.toast === "function") window.toast(m, t); };
  if (window._ucBusy) return;
  window._ucBusy = true;
  if (label) label.textContent = "جاري البحث عن تحديثات...";
  say("جاري البحث عن آخر تحديث...", "info");

  let reload = false;
  try {
    if (navigator.onLine === false) throw new Error("offline");

    const swNew = await _ucSw();
    const urls = await _ucCollect();
    const heads = [];
    await _ucPool(urls, 8, async (u) => { heads.push([u, await _ucHead(u)]); });
    const S = {};
    heads.forEach(([u, v]) => { if (v) S[u] = v; });
    const keys = Object.keys(S);

    if (!keys.length) {            // لا ترويسات تحقق إطلاقًا → السلوك القديم
      await _ucLegacy();
      say("تم التحديث — جاري إعادة التحميل...", "success");
      reload = true;
      return;
    }

    let B = null;
    try { B = JSON.parse(localStorage.getItem(_UC_KEY) || "null"); } catch (_) {}
    const first = !B || !B.f;
    const changed = [];
    for (const u of keys) {
      const old = first ? undefined : B.f[u];
      if (old === S[u]) continue;
      if (old === undefined && (await _ucCacheVal(u)) === S[u]) continue;   // الكاش فيه النسخة الحالية أصلًا
      changed.push(u);
    }
    const save = () => { try { localStorage.setItem(_UC_KEY, JSON.stringify({ t: Date.now(), f: S })); } catch (_) {} };

    if (!first && !swNew && !changed.length) {   // لا يوجد تحديث فعلي
      save();
      say("لا توجد تحديثات مضافة", "info");
      return;
    }

    const backups = [];
    try {
      await _ucPool(changed, 6, (u) => _ucRefresh(u, backups));
    } catch (e) {
      await _ucRollback(backups);
      throw e;
    }
    await _ucPurge();
    save();
    say("تم تحديث الموقع", "success");
    reload = true;
  } catch (e) {
    console.error("checkForUpdates:", e);
    say("تعذر التحقق من التحديثات، تحقق من اتصالك بالإنترنت", "error");
  } finally {
    window._ucBusy = false;
    if (label) label.textContent = originalText || "التحديثات";
    if (reload) _ucReload();
  }
};

/* احتياطي: لو index.html المنشور لا يربط إشعار «نشر تحديث» (نسخة قديمة/مخزّنة) يُحمَّل هنا مرة واحدة.
   لا يفعل شيئًا إذا كان الربط موجودًا أصلًا. */
(function () {
  try {
    if (!document.querySelector('link[href*="update-notice.css"]')) {
      const l = document.createElement("link");
      l.rel = "stylesheet"; l.href = "css/update-notice.css";
      document.head.appendChild(l);
    }
    if (!document.querySelector('script[src*="update-notice.js"]')) {
      const s = document.createElement("script");
      s.type = "module"; s.src = "js/update-notice.js";
      document.head.appendChild(s);
    }
  } catch (e) {}
})();
