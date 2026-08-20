// firebase-messaging-sw.js
// ══════════════════════════════════════════
// FCM Service Worker — Background & Closed-Tab Notifications
// + تخزين مؤقت لملفات الواجهة (App Shell) عشان الموقع يفتح بدون إنترنت
//
// DEPLOYMENT:
//   • Place this file in the SAME directory as index.html
//   • GitHub Pages: repo-root/ if index.html is at root, or docs/ if served from docs/
//   • Firebase Hosting: public/ root (firebase.json hosting.public)
//
// The JS in index.html registers this SW using a dynamic base path
// so it works on both GitHub Pages subdirs and Firebase Hosting root.
// ══════════════════════════════════════════

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyAUkeqz4iGn4LwJf93EJa0JilIUoHHdVOs",
  authDomain:        "ssss-27d97.firebaseapp.com",
  projectId:         "ssss-27d97",
  storageBucket:     "ssss-27d97.firebasestorage.app",
  messagingSenderId: "402050236451",
  appId:             "1:402050236451:web:5f8ad5ddcd6a7c63377196"
});

const messaging = firebase.messaging();

// Background message handler (app in background or tab closed)
messaging.onBackgroundMessage(function(payload) {
  const notif = payload.notification || {};
  const title = notif.title || 'نظام الجامعة';
  const options = {
    body:               notif.body  || '',
    icon:               notif.icon  || '/favicon.ico',
    badge:              notif.icon  || '/favicon.ico',
    data:               payload.data || {},
    dir:                'rtl',
    lang:               'ar',
    tag:                (payload.data && payload.data.tag) ? payload.data.tag : 'uni-bg',
    requireInteraction: false,
  };
  return self.registration.showNotification(title, options);
});

// Notification click — focus existing tab or open app
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  // Resolve URL relative to SW location (handles GitHub Pages subdirs automatically)
  const appUrl = self.registration.scope;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(appUrl);
    })
  );
});

/* ══════════════════════════════════════════
   إضافة — تخزين مؤقت لملفات الواجهة (App Shell)
   عشان الموقع يفتح ويشتغل بدون إنترنت (زي أي تطبيق حقيقي)

   ⚠️ لو ضفت أو غيرت ملفات CSS/JS جديدة، حدّث القايمة تحت وزوّد
   رقم CACHE_VERSION عشان المستخدمين ياخدوا النسخة الجديدة.
   ══════════════════════════════════════════ */

const CACHE_VERSION = 'v4';
const CACHE_NAME = 'bariq-shell-' + CACHE_VERSION;
const MEDIA_CACHE_NAME = 'bariq-media-' + CACHE_VERSION;

// المسارات نسبةً لمكان هذا الملف (تشتغل صح مع GitHub Pages تحت مجلد فرعي)
const PRECACHE_PATHS = [
  '',
  'index.html',
  'manifest.json',
  'terms.html',

  'css/style.css',
  'css/military.css',
  'css/dms-page.css',
  'css/bubble-blur.css',
  'css/bubble-color.css',
  'css/splash.css',
  'css/theme-toggle.css',

  'grades/grades.css',
  'grades/grades.js',

  'js/ai-assistant.js', 'js/ai-config.js', 'js/announcement.js', 'js/audit-log.js',
  'js/back-nav.js', 'js/bubble-blur.js', 'js/bubble-color.js', 'js/change-password.js',
  'js/chat-backgrounds.js', 'js/chat-search.js', 'js/connectivity.js', 'js/dm-extras.js',
  'js/dms-page.js', 'js/draft-messages.js', 'js/emoji-picker.js', 'js/lamp-login.js',
  'js/library.js', 'js/lightbox.js', 'js/maintenance.js', 'js/mention.js', 'js/military.js',
  'js/notif-panel.js', 'js/notif-settings.js', 'js/pin-message.js', 'js/poll.js',
  'js/report.js', 'js/settings-modal.js', 'js/sidebar-search.js', 'js/skeleton-loader.js',
  'js/spark.js', 'js/splash.js', 'js/theme-toggle.js', 'js/upload-engine.js',

  'images/app-icon.png',
  'images/app-icon-maskable.png',
  'images/default-student-female.png',
  'images/default-student-male.png',
  'images/military-icon.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const base = self.registration.scope; // ينتهي بـ "/" دايمًا
      const urls = PRECACHE_PATHS.map((p) => new URL(p, base).toString());
      // addAll بيفشل كله لو ملف واحد فشل، فبنحاول كل ملف لوحده
      // عشان ملف ناقص أو اتغير اسمه ميوقفش باقي التخزين
      return Promise.all(
        urls.map((u) => cache.add(u).catch(() => {}))
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith('bariq-shell-') && n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      );
      await clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isSameOrigin = req.url.startsWith(self.location.origin);
  const isMediaHost = req.url.startsWith('https://res.cloudinary.com') ||
                       req.url.startsWith('https://firebasestorage.googleapis.com');

  // ── وسائط خارجية (صور/ملفات/صوتيات من Cloudinary أو Firebase Storage) ──
  // كاش أولًا عشان أي ملف سبق فتحه يفضل ظاهر بدون نت، ولو مش موجود
  // في الكاش نجيبه من النت ونخزنه لأول مرة
  if (isMediaHost) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const resClone = res.clone();
            caches.open(MEDIA_CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // نسيب أي طلب تاني مش من نفس الموقع يعدي عادي (Firestore API، إلخ)
  if (!isSameOrigin) return;

  // طلبات التنقل (فتح الصفحة نفسها) — نجرب الشبكة الأول عشان تحديثات
  // الموقع توصل فورًا، ولو مفيش نت نرجع للنسخة المخزنة (app shell)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() =>
          caches.match(req).then(
            (cached) => cached || caches.match(new URL('index.html', self.registration.scope).toString())
          )
        )
    );
    return;
  }

  // باقي الملفات الثابتة (CSS/JS/صور) — كاش أولًا للسرعة وللعمل بدون نت،
  // مع تحديث النسخة المخزنة في الخلفية كل ما فيه اتصال (stale-while-revalidate)
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
