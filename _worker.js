// #region تنظیمات کلی
// ---------- تنظیمات کلی ----------
// مالک سایت: تنها کسی که می‌تونه ادمین‌های دیگه رو ارتقا/عزل کنه و همیشه دسترسی کامل  ادمین داره
const SUPER_ADMIN_USERNAME = "Aghey";

// فقط این دامنه‌ها اجازه دارن از مرورگر به این ورکر درخواست بزنن
const ALLOWED_ORIGINS = ["https://dehaat.faggott.fun", "https://dehaato.pages.dev", "https://dehaat.aghey.faggott.fun", "https://aghey.bbboi.ir", "https://appassets.androidplatform.net"];

// بر اساس Origin درخواست، هدرهای CORS مناسب رو می‌سازه
// (اگه Origin توی لیست مجاز نبود، هدر Allow-Origin اصلاً ست نمی‌شه؛
//  یعنی مرورگر خودش جلوی خوندن پاسخ رو برای اون سایت‌ها می‌گیره)
function corsHeadersFor(request) {
  const origin = request.headers.get("Origin");
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// undefined رو به null تبدیل می‌کنه، چون D1 با undefined خطا می‌ده
function bind(stmt, args) {
  return stmt.bind(...args.map((v) => (v === undefined ? null : v)));
}

// ================= پوش نوتیفیکیشن (Web Push، بدون کتابخونه، فقط با Web Crypto) =================
// نیازمندیِ تنظیمات ورکر (از داشبورد Cloudflare، بخش Settings > Variables):
//   VAPID_PUBLIC_KEY  = <کلید عمومیِ VAPID که تولید کردی>
//   VAPID_PRIVATE_KEY = <کلید خصوصیِ VAPID — حتماً به‌صورت Secret، نه متغیر عادی، و هیچ‌وقت جایی مثل کامنت/گیت نوشته نشه>
//   VAPID_SUBJECT     = "mailto:you@example.com"  (یه ایمیل یا لینک تماس؛ کلادفلر/مرورگرها بهش نیازی ندارن ولی استاندارد الزامیه)
// جدول لازم توی D1 (یک‌بار توی کنسول D1 اجرا کن):
//   CREATE TABLE IF NOT EXISTS push_subscriptions (
//     id TEXT PRIMARY KEY,
//     username TEXT NOT NULL,
//     endpoint TEXT NOT NULL UNIQUE,
//     p256dh TEXT NOT NULL,
//     auth TEXT NOT NULL,
//     created_at INTEGER NOT NULL
//   );
//   CREATE INDEX IF NOT EXISTS idx_push_subs_username ON push_subscriptions (username);

// ================= عنوان کوتاه پست (حداکثر ۱۵ کاراکتر) =================
// جدول posts از قبل توی D1 وجود داره، فقط این ستون رو (یک‌بار، توی کنسول D1) اضافه کن:
//   ALTER TABLE posts ADD COLUMN title TEXT;

// ================= مدت‌زمانِ آهنگ به ثانیه (برای زمان‌بندیِ رادیوی زنده) =================
// این ستون رو هم (یک‌بار، توی کنسول D1) اضافه کن؛ فقط برای پست‌های نوع audio پر می‌شه:
//   ALTER TABLE posts ADD COLUMN duration_seconds INTEGER;

// ================= تیکِ «نمایش در رادیو دهات» (برای پس‌زمینه‌ی تمام‌صفحه‌ی رادیونما) =================
// این ستون رو هم (یک‌بار، توی کنسول D1) اضافه کن؛ فقط برای پست‌های نوع photo/video معنی داره:
//   ALTER TABLE posts ADD COLUMN radio_visual INTEGER NOT NULL DEFAULT 0;

// ================= پین‌کردنِ پست توسط ادمین (همیشه بالای فید، برای همه) =================
// این ستون رو هم (یک‌بار، توی کنسول D1) اضافه کن:
//   ALTER TABLE posts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;

// ================= «متن نقاشی»: نقاشیِ همراهِ پست‌های متنی =================
// فقط برای پست‌های نوع text پر می‌شه؛ خودِ نقاشی مثلِ بقیه‌ی رسانه‌ها به تلگرام فرستاده می‌شه و
// فقط file_id ش اینجا ذخیره می‌شه (همون الگوی audio_thumb/video_thumb). این ستون رو هم (یک‌بار،
// توی کنسول D1) اضافه کن:
//   ALTER TABLE posts ADD COLUMN drawing_file_id TEXT;

// ================= ویرایشِ پست توسط صاحبش (منوی سه‌نقطه‌ی پست کارت) =================
// این ستون رو هم (یک‌بار، توی کنسول D1) اضافه کن:
//   ALTER TABLE posts ADD COLUMN edited INTEGER NOT NULL DEFAULT 0;

// ================= محضر: خواستگاری بین دو کاربر =================
// یه فعالیتِ جدید تویِ «ده‌دودز» (کنارِ رادیو) به اسمِ «محضر» که دو تا زیربخش داره: «خواستگاری»
// (فرستادنِ درخواست به یه کاربرِ دیگه، با یه عنوانِ انتخابی برای خودِ فرستنده — شوهر یا همسر —
// و یه متنِ حداکثر ۵۰ کاراکتری) و «درخواست‌ها» (دیدنِ خواستگاری‌هایی که برای خودِ کاربر اومده و
// قبول/ردشون). یه کاربر تا وقتی خواستگاریِ درحال‌انتظارش رد یا لغو نشه، نمی‌تونه به کسِ دیگه‌ای
// خواستگاری بده؛ وقتی قبول بشه، تو پروفایلِ هرکدوم عنوانِ انتخابیِ طرفِ مقابل (که خودکار برعکسِ
// عنوانِ خودشه) نشون داده می‌شه. این جدولِ جدید رو (یک‌بار، توی کنسول D1) بساز:
//   CREATE TABLE IF NOT EXISTS marriage_proposals (
//     id TEXT PRIMARY KEY,
//     from_username TEXT NOT NULL,
//     to_username TEXT NOT NULL,
//     from_title TEXT NOT NULL,
//     message TEXT,
//     status TEXT NOT NULL DEFAULT 'pending',
//     created_at INTEGER NOT NULL,
//     responded_at INTEGER
//   );
//   CREATE INDEX IF NOT EXISTS idx_marriage_from ON marriage_proposals (from_username, status);
//   CREATE INDEX IF NOT EXISTS idx_marriage_to ON marriage_proposals (to_username, status);

// ================= تگ‌های نرمال‌شده‌ی پست + ثبتِ پخشِ آهنگ (برای الگوریتمِ For You سگ‌تونز) =================
// این دو جدول رو (یک‌بار، توی کنسول D1) بساز:
//   CREATE TABLE IF NOT EXISTS post_tags (
//     post_id TEXT NOT NULL,
//     tag TEXT NOT NULL,
//     PRIMARY KEY (post_id, tag)
//   );
//   CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags (tag);
//
// migration (سیستمِ جدیدِ «تگِ خودکار/قفل‌شده»): این ستون رو هم اضافه کن — مشخص می‌کنه هر ردیفِ
// post_tags از کجا اومده: 'auto' (خودِ سیستم از رویِ تگِ ID3/متادیتا ساخته و کاربر هرگز نمی‌تونه حذفش
// کنه) یا 'user' (خودِ کاربر دستی اضافه کرده و آزادانه قابلِ حذف/ویرایشه). پیشِ‌فرض 'user'ه که ردیف‌های
// قدیمی هم منطقی بمونن؛ برچسب‌گذاریِ گروهیِ آهنگ‌های قدیمی (handleBackfillMusicTags) صریحاً 'auto' می‌ذاره.
//   ALTER TABLE post_tags ADD COLUMN source TEXT NOT NULL DEFAULT 'user';
//   CREATE TABLE IF NOT EXISTS track_plays (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     post_id TEXT NOT NULL,
//     username TEXT NOT NULL,
//     played_at INTEGER NOT NULL,
//     completed INTEGER NOT NULL DEFAULT 0
//   );
//   CREATE INDEX IF NOT EXISTS idx_track_plays_user ON track_plays (username, played_at DESC);
//   CREATE INDEX IF NOT EXISTS idx_track_plays_post ON track_plays (post_id);

function base64UrlToUint8Array(base64Url) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function uint8ArrayToBase64Url(bytes) {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concatBytes(...arrays) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

// کلید خصوصی VAPID رو (که فقط بخش d رو ذخیره کردیم) به یه CryptoKey قابل امضا تبدیل می‌کنه
async function importVapidPrivateKey(env) {
  const pub = base64UrlToUint8Array(env.VAPID_PUBLIC_KEY); // 65 بایت: 0x04 || X || Y
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: uint8ArrayToBase64Url(pub.slice(1, 33)),
    y: uint8ArrayToBase64Url(pub.slice(33, 65)),
    d: env.VAPID_PRIVATE_KEY,
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

// JWT امضاشده‌ی VAPID برای هدر Authorization
async function buildVapidJwt(env, audience) {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUBJECT || "mailto:admin@example.com",
  };
  const enc = new TextEncoder();
  const toB64Url = (obj) => uint8ArrayToBase64Url(enc.encode(JSON.stringify(obj)));
  const signingInput = `${toB64Url(header)}.${toB64Url(payload)}`;
  const privateKey = await importVapidPrivateKey(env);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    enc.encode(signingInput)
  );
  return `${signingInput}.${uint8ArrayToBase64Url(new Uint8Array(signature))}`;
}

// رمزنگاری بدنه‌ی پیام طبق RFC 8291 (aes128gcm) با کلیدهای مرورگر کاربر (p256dh و auth)
async function encryptPushPayload(subscription, payloadObj) {
  const uaPublicBytes = base64UrlToUint8Array(subscription.p256dh);
  const authSecret = base64UrlToUint8Array(subscription.auth);
  const plaintext = new TextEncoder().encode(JSON.stringify(payloadObj));

  const uaPublicKey = await crypto.subtle.importKey(
    "raw", uaPublicBytes, { name: "ECDH", namedCurve: "P-256" }, false, []
  );
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  );
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey));

  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaPublicKey }, ephemeralKeyPair.privateKey, 256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  async function hmacSha256(keyBytes, msgBytes) {
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC", key, msgBytes));
  }
  async function hkdfExpand(prk, info, length) {
    const key = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const t1 = new Uint8Array(await crypto.subtle.sign("HMAC", key, concatBytes(info, new Uint8Array([1]))));
    return t1.slice(0, length);
  }

  // مرحله‌ی اول: استخراج IKM از راز مشترک با auth_secret به‌عنوان salt (طبق RFC 8291)
  const enc = new TextEncoder();
  const prkKey = await hmacSha256(authSecret, sharedSecret);
  const keyInfo = concatBytes(enc.encode("WebPush: info\0"), uaPublicBytes, asPublicRaw);
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  // مرحله‌ی دوم: استخراج CEK و nonce طبق RFC 8188 (aes128gcm)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmacSha256(salt, ikm);
  const cekBytes = await hkdfExpand(prk, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonceBytes = await hkdfExpand(prk, enc.encode("Content-Encoding: nonce\0"), 12);

  const cekKey = await crypto.subtle.importKey("raw", cekBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const recordContent = concatBytes(plaintext, new Uint8Array([2])); // 0x02 = آخرین (و تنها) رکورد
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonceBytes }, cekKey, recordContent)
  );

  const rs = new Uint8Array([0, 0, 16, 0]); // record size = 4096 (big-endian)
  const header = concatBytes(salt, rs, new Uint8Array([asPublicRaw.length]), asPublicRaw);
  return concatBytes(header, ciphertext);
}

// ارسال واقعی یک پوش به یک subscription؛ خروجی true/false برای موفقیت
async function sendWebPush(env, subscription, payloadObj) {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return { ok: false, gone: false };
  try {
    const endpointUrl = new URL(subscription.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
    const jwt = await buildVapidJwt(env, audience);
    const body = await encryptPushPayload(subscription, payloadObj);

    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": "86400",
        "Authorization": `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      },
      body,
    });

    // ۴۰۴/۴۱۰ یعنی subscription دیگه معتبر نیست (کاربر نوتیف رو غیرفعال کرده یا اپ رو حذف کرده)
    const gone = res.status === 404 || res.status === 410;
    return { ok: res.ok, gone };
  } catch (e) {
    return { ok: false, gone: false };
  }
}

// پوش رو به همه‌ی دستگاه‌های ثبت‌شده‌ی یک کاربر می‌فرسته؛ subscriptionهای منقضی رو خودش پاک می‌کنه
async function sendPushToUser(env, username, payloadObj) {
  try {
    const subs = await env.D1.prepare("SELECT * FROM push_subscriptions WHERE username = ?").bind(username).all();
    if (!subs.results || subs.results.length === 0) return;

    await Promise.all(
      subs.results.map(async (sub) => {
        const { gone } = await sendWebPush(env, sub, payloadObj);
        if (gone) {
          await env.D1.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(sub.id).run();
        }
      })
    );
  } catch (e) {
    // best-effort؛ خطای پوش نباید هیچ درخواستی رو خراب کنه
  }
}

// #endregion
// #region ثبت/به‌روزرسانی subscription پوش کاربر
// ---------- ثبت/به‌روزرسانی subscription پوش کاربر ----------
async function handleSubscribePush(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const body = await request.json();
  const { endpoint, keys } = body || {};
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return json({ error: "اطلاعات subscription ناقصه" }, 400);
  }

  const id = `${Date.now()}_${randomHex(4)}`;
  await bind(
    env.D1.prepare(
      `INSERT INTO push_subscriptions (id, username, endpoint, p256dh, auth, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET username = excluded.username, p256dh = excluded.p256dh, auth = excluded.auth`
    ),
    [id, username, endpoint, keys.p256dh, keys.auth, Date.now()]
  ).run();

  return json({ ok: true });
}

// #endregion
// #region حذف subscription (وقتی کاربر نوتیف رو خاموش می‌کنه)
// ---------- حذف subscription (وقتی کاربر نوتیف رو خاموش می‌کنه) ----------
async function handleUnsubscribePush(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const { endpoint } = await request.json();
  if (!endpoint) return json({ error: "endpoint لازمه" }, 400);

  await env.D1.prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND username = ?").bind(endpoint, username).run();
  return json({ ok: true });
}
// ================= پایان بخش پوش نوتیفیکیشن =================

// ================= پوش نوتیفیکیشن برای اپ اندروید (FCM HTTP v1، بدون کتابخونه) =================
// چرا جدا از Web Push بالا: اپ اندروید (WebView) از طریق Firebase Cloud Messaging توکن می‌گیره،
// نه از طریق p256dh/auth مرورگر؛ و ارسالش هم API کاملاً متفاوتیه (FCM v1، نه پروتکل Web Push).
// نیازمندیِ تنظیمات ورکر (از داشبورد Cloudflare، بخش Settings > Variables):
//   FCM_SERVICE_ACCOUNT_JSON = <کل محتوای فایل JSON سرویس‌اکانتِ فایربیس، به‌صورت یک رشته‌ی JSON — حتماً Secret>
//     (از Firebase Console > Project Settings > Service Accounts > Generate New Private Key گرفته می‌شه)
// جدول لازم توی D1 (یک‌بار توی کنسول D1 اجرا کن):
//   CREATE TABLE IF NOT EXISTS fcm_tokens (
//     id TEXT PRIMARY KEY,
//     username TEXT NOT NULL,
//     token TEXT NOT NULL UNIQUE,
//     created_at INTEGER NOT NULL
//   );
//   CREATE INDEX IF NOT EXISTS idx_fcm_tokens_username ON fcm_tokens (username);

// PEM (کلید خصوصیِ سرویس‌اکانت) رو به CryptoKey قابل امضا (RS256) تبدیل می‌کنه
async function importFcmPrivateKey(pem) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const raw = atob(body);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return crypto.subtle.importKey(
    "pkcs8", bytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
}

// یک access token از گوگل می‌گیره (OAuth2 با JWT خودامضا، طبق سرویس‌اکانت) — چیزی که FCM v1 API لازم داره
async function getFcmAccessToken(env) {
  if (!env.FCM_SERVICE_ACCOUNT_JSON) return null;
  const sa = JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON);
  const enc = new TextEncoder();
  const toB64Url = (obj) => uint8ArrayToBase64Url(enc.encode(JSON.stringify(obj)));

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${toB64Url(header)}.${toB64Url(payload)}`;
  const privateKey = await importFcmPrivateKey(sa.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", privateKey, enc.encode(signingInput)
  );
  const jwt = `${signingInput}.${uint8ArrayToBase64Url(new Uint8Array(signature))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { accessToken: data.access_token, projectId: sa.project_id };
}

// یک پیام به یک توکنِ FCM می‌فرسته؛ data-only (بدون کلید "notification") تا حتی وقتی اپ بسته/پس‌زمینه‌ست
// هم DehaatFirebaseMessagingService خودمون کنترلِ کامل رو داشته باشه (نوتیف سفارشی + دیپ‌لینک با open_url)
// دامنه‌ای که سایت روش سرو می‌شه. برخلافِ PWA (که service worker خودش می‌تونه URLِ نسبی رو نسبت به
// origin خودش resolve کنه)، اپِ اندروید با webView.loadUrl() فقط با یه URLِ کاملاً absolute کار می‌کنه؛
// وگرنه دقیقاً همون صفحه‌ی سیاه با آیکونِ شکسته (خطای «سایت باز نشد») رو نشون می‌ده
const SITE_ORIGIN = "https://dehaat.aghey.workers.dev";
async function sendFcmMessage(env, auth, token, payloadObj) {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token,
          data: {
            title: String(payloadObj.title || "دهات"),
            body: String(payloadObj.body || ""),
            url: String(payloadObj.url || ""),
          },
          android: { priority: "high" },
        },
      }),
    }
  );
  // NOT_FOUND/UNREGISTERED یعنی توکن دیگه معتبر نیست (اپ حذف شده یا داده‌هاش پاک شده)
  let gone = false;
  if (!res.ok) {
    try {
      const errBody = await res.json();
      const status = errBody?.error?.status;
      gone = status === "NOT_FOUND" || status === "UNREGISTERED" || res.status === 404;
    } catch (e) {
      gone = res.status === 404;
    }
  }
  return { ok: res.ok, gone };
}

// پیام رو به همه‌ی توکن‌های FCM ثبت‌شده‌ی یک کاربر می‌فرسته؛ توکن‌های منقضی رو خودش پاک می‌کنه
async function sendFcmToUser(env, username, payloadObj) {
  try {
    const auth = await getFcmAccessToken(env);
    if (!auth) return; // FCM_SERVICE_ACCOUNT_JSON تنظیم نشده؛ بی‌صدا رد شو (best-effort)

    const tokens = await env.D1.prepare("SELECT * FROM fcm_tokens WHERE username = ?").bind(username).all();
    if (!tokens.results || tokens.results.length === 0) return;

    await Promise.all(
      tokens.results.map(async (row) => {
        const { gone } = await sendFcmMessage(env, auth, row.token, payloadObj);
        if (gone) {
          await env.D1.prepare("DELETE FROM fcm_tokens WHERE id = ?").bind(row.id).run();
        }
      })
    );
  } catch (e) {
    // best-effort؛ خطای پوش نباید هیچ درخواستی رو خراب کنه
  }
}

// ---------- ثبت/به‌روزرسانی توکن FCM کاربر (صدا زده می‌شه از window.onFcmToken توی سایت) ----------
async function handleSaveFcmToken(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 4
