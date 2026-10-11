/* ==========================================================================
   /livekit-token — يُضاف إلى الـ Cloudflare Worker الحالي (falling-sea-c753)
   ليس Worker جديدًا ولا يلمس مسار FCM/Cron. الملف مرجع للصق فقط، لا يُحمّل في المتصفح.

   الأسرار (Cloudflare → Worker → Settings → Variables/Secrets، وليس في الكود):
     LIVEKIT_API_KEY      (Secret)
     LIVEKIT_API_SECRET   (Secret)
     LIVEKIT_URL          مثال: wss://YOUR-PROJECT.livekit.cloud
     FIREBASE_PROJECT_ID  = ssss-27d97   (غالبًا موجود عندك بالفعل)
     OWNER_UID            = dKTc7vqFNGO7vqamubap5dKnn7z1  (بدونه لا توجد صلاحية مالك في المكالمات)

   الربط داخل fetch() الحالي — سطران فقط قبل منطق FCM الحالي:
     const url = new URL(request.url);
     if (url.pathname === "/livekit-token") return handleLiveKitToken(request, env);

   الطلب:  POST /livekit-token
           Authorization: Bearer <Firebase ID token>
           { "kind":"dm",   "peerUid":"<uid>" }
        أو { "kind":"room", "roomId":"<rooms doc id>" }
   الرد:   { token, url, room, identity }
   ========================================================================== */

const LK_ALLOWED_ORIGINS = ["https://cairohbis.github.io"]; // الأصول المسموحة فقط

function lkOriginAllowed(request) {
  const origin = request.headers.get("Origin");
  return origin === null || LK_ALLOWED_ORIGINS.includes(origin); // بدون Origin = ليس طلب متصفح عبر نطاق؛ التوكن مطلوب في كل الأحوال
}
function lkCors(request) {
  const origin = request.headers.get("Origin");
  if (!origin || !LK_ALLOWED_ORIGINS.includes(origin)) return { "Vary": "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function lkJson(request, status, obj) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "Content-Type": "application/json", ...lkCors(request) },
  });
}

const b64uToBytes = (s) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const bytesToB64u = (buf) => {
  let s = ""; const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const strToB64u = (s) => bytesToB64u(new TextEncoder().encode(s));

/* ── التحقق من Firebase ID token (RS256 عبر مفاتيح Google العامة) ── */
let _jwkCache = { at: 0, keys: null };
async function lkGetJwks() {
  if (_jwkCache.keys && Date.now() - _jwkCache.at < 3600e3) return _jwkCache.keys;
  const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  if (!r.ok) throw new Error("jwks");
  _jwkCache = { at: Date.now(), keys: (await r.json()).keys };
  return _jwkCache.keys;
}
async function lkVerifyFirebaseToken(idToken, projectId) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw new Error("malformed");
  const header = JSON.parse(new TextDecoder().decode(b64uToBytes(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(b64uToBytes(parts[1])));
  if (header.alg !== "RS256") throw new Error("alg");
  const jwk = (await lkGetJwks()).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("kid");
  const key = await crypto.subtle.importKey(
    "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", key, b64uToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) throw new Error("sig");
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw new Error("aud");
  if (payload.iss !== "https://securetoken.google.com/" + projectId) throw new Error("iss");
  if (!payload.sub || typeof payload.sub !== "string") throw new Error("sub");
  if (!(payload.exp > now)) throw new Error("exp");
  if (payload.iat > now + 60) throw new Error("iat");
  return payload;
}

/* ── قراءة وثائق Firestore بصلاحيات المستخدم نفسه (الـ Rules تُطبَّق) ── */
async function lkFsGet(projectId, path, idToken) {
  const r = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`,
    { headers: { Authorization: "Bearer " + idToken } });
  if (r.status === 404 || r.status === 403) return null;
  if (!r.ok) throw new Error("firestore " + r.status);
  return r.json();
}
const fsStr = (f) => (f && f.stringValue) || null;
const fsStrArr = (f) => ((f && f.arrayValue && f.arrayValue.values) || []).map((v) => v.stringValue);

/* ── LiveKit AccessToken (HS256) ── */
async function lkSign(env, { identity, name, room }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const claims = {
    iss: env.LIVEKIT_API_KEY, sub: identity, name, nbf: now - 5, iat: now, exp: now + 3600,
    video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true },
  };
  const data = strToB64u(JSON.stringify(header)) + "." + strToB64u(JSON.stringify(claims));
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(env.LIVEKIT_API_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return data + "." + bytesToB64u(sig);
}

export async function handleLiveKitToken(request, env) {
  if (!lkOriginAllowed(request)) return lkJson(request, 403, { error: "origin-not-allowed" });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: lkCors(request) });
  if (request.method !== "POST") return lkJson(request, 405, { error: "method-not-allowed" });
  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET || !env.LIVEKIT_URL || !env.FIREBASE_PROJECT_ID)
    return lkJson(request, 500, { error: "livekit-not-configured" });

  const projectId = env.FIREBASE_PROJECT_ID;
  const m = /^Bearer (.+)$/.exec(request.headers.get("Authorization") || "");
  if (!m) return lkJson(request, 401, { error: "missing-token" });
  const idToken = m[1];

  let user;
  try { user = await lkVerifyFirebaseToken(idToken, projectId); }
  catch (e) { return lkJson(request, 401, { error: "invalid-token" }); }
  const uid = user.sub;

  let body;
  try { body = await request.json(); } catch (e) { return lkJson(request, 400, { error: "bad-json" }); }

  try {
    const me = await lkFsGet(projectId, `users/${uid}`, idToken);
    const myF = (me && me.fields) || {};
    // المالك يُحدَّد بـ OWNER_UID الموثوق فقط (لا يُعتمد على users/{uid}.role لأنه قابل للكتابة من المستخدم).
    // غياب OWNER_UID = لا أحد يُعامَل كمالك.
    const isOwner = !!env.OWNER_UID && uid === env.OWNER_UID;
    let room;

    if (body.kind === "dm") {
      const peer = String(body.peerUid || "");
      if (!/^[A-Za-z0-9]{1,128}$/.test(peer) || peer === uid) return lkJson(request, 400, { error: "bad-peer" });
      const chatId = [uid, peer].sort().join("_");
      const chat = await lkFsGet(projectId, `privateChats/${chatId}`, idToken);
      const parts = chat ? fsStrArr(chat.fields && chat.fields.participants) : [];
      if (!parts.includes(uid) || !parts.includes(peer)) return lkJson(request, 403, { error: "not-participant" });
      room = "dm_" + chatId;
    } else if (body.kind === "room") {
      const roomId = String(body.roomId || "");
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(roomId)) return lkJson(request, 400, { error: "bad-room" });
      const rd = await lkFsGet(projectId, `rooms/${roomId}`, idToken);
      if (!rd) return lkJson(request, 403, { error: "room-not-accessible" });
      const roomWorld = fsStr(rd.fields && rd.fields.worldId);
      const myWorld = fsStr(myF.worldId);
      if (!isOwner && (!roomWorld || roomWorld !== myWorld)) return lkJson(request, 403, { error: "world-mismatch" });
      room = "room_" + roomId;
    } else {
      return lkJson(request, 400, { error: "bad-kind" });
    }

    const name = (fsStr(myF.name) || fsStr(myF.displayName) || user.name || "User").slice(0, 60);
    const token = await lkSign(env, { identity: uid, name, room });
    return lkJson(request, 200, { token, url: env.LIVEKIT_URL, room, identity: uid });
  } catch (e) {
    return lkJson(request, 502, { error: "upstream-failed" });
  }
}
