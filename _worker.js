// #region تنظیمات کلی
// ---------- تنظیمات کلی ----------
// مالک سایت: تنها کسی که می‌تونه ادمین‌های دیگه رو ارتقا/عزل کنه و همیشه دسترسی کامل  ادمین داره
const SUPER_ADMIN_USERNAME = "Aghey";

// فقط این دامنه‌ها اجازه دارن از مرورگر به این ورکر درخواست بزنن
const ALLOWED_ORIGINS = ["https://dehaat.faggott.fun", "https://dehaato.pages.dev", "https://dehaat.aghey.faggott.fun", "https://dehaat.bbboi.ir"];

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
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const { token } = await request.json();
  if (!token) return json({ error: "توکن لازمه" }, 400);

  const id = `${Date.now()}_${randomHex(4)}`;
  await bind(
    env.D1.prepare(
      `INSERT INTO fcm_tokens (id, username, token, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(token) DO UPDATE SET username = excluded.username`
    ),
    [id, username, token, Date.now()]
  ).run();

  return json({ ok: true });
}

// ---------- حذف توکن FCM (اختیاری، وقتی کاربر توی اپ نوتیف رو خاموش می‌کنه یا لاگ‌اوت می‌کنه) ----------
async function handleDeleteFcmToken(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const { token } = await request.json();
  if (!token) return json({ error: "توکن لازمه" }, 400);

  await env.D1.prepare("DELETE FROM fcm_tokens WHERE token = ? AND username = ?").bind(token, username).run();
  return json({ ok: true });
}
// ================= پایان بخش FCM =================

// #endregion
// #region هش کردن پسورد (PBKDF2)
// ---------- هش کردن پسورد (PBKDF2) ----------
async function hashPassword(password, saltHex, env) {
  const enc = new TextEncoder();
  // پپر: یه رشته‌ی مخفیِ ثابت که فقط تو Cloudflare Secrets (env.PASSWORD_PEPPER) نگه‌داری می‌شه،
  // نه تو D1. اگه یه روز کل جدولِ users (salt+hash) لو بره، بدونِ دونستنِ پپر، مهاجم اصلاً نمی‌تونه
  // فرمولِ هش رو کامل بازسازی کنه و بروت‌فورس رو شروع کنه؛ چون پپر جزوِ ورودیِ PBKDF2 هست ولی
  // هیچ‌جای دیتابیس ذخیره نمی‌شه. اگه env.PASSWORD_PEPPER ست نشده باشه، برای سازگاری با عقب
  // (قبل از اضافه‌شدنِ این قابلیت) از رشته‌ی خالی استفاده می‌شه.
  const pepper = (env && env.PASSWORD_PEPPER) || "";
  const peppered = password + pepper;
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(peppered),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(saltHex),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return bufferToHex(bits);
}

function randomHex(bytes = 16) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return bufferToHex(arr.buffer);
}

// #endregion
// #region حضور آنلاین کاربر (برای نشونِ آنلاین/آخرین بازدید توی چت)
// ---------- حضور آنلاین کاربر ----------
// جدول لازم توی D1 (یک‌بار توی کنسول D1 اجرا کن):
//   CREATE TABLE IF NOT EXISTS user_presence (username TEXT PRIMARY KEY, last_active_at INTEGER NOT NULL);
// و برای پیام‌های ویرایش/حذف‌شده، این ستون‌ها رو هم اضافه کن:
//   ALTER TABLE chat_messages ADD COLUMN edited_at INTEGER;
//   ALTER TABLE chat_messages ADD COLUMN deleted_at INTEGER;
// برای فیچرِ ریپلای روی پیام‌های چت، این ستون رو هم اضافه کن (شناسه‌ی پیامی که این پیام در پاسخ به اونه):
//   ALTER TABLE chat_messages ADD COLUMN reply_to_message_id TEXT;
// برای فیچرهای پین/ریکشن/فوروارد/سایلنت‌کردنِ چت، این‌ها رو هم اجرا کن:
//   ALTER TABLE chat_messages ADD COLUMN pinned_at INTEGER;
//   ALTER TABLE chat_messages ADD COLUMN pinned_by TEXT;
//   ALTER TABLE chat_messages ADD COLUMN forwarded_from TEXT;
//   ALTER TABLE chat_conversation_members ADD COLUMN muted INTEGER NOT NULL DEFAULT 0;
//   CREATE TABLE IF NOT EXISTS chat_message_reactions (
//     message_id TEXT NOT NULL,
//     username TEXT NOT NULL,
//     emoji TEXT NOT NULL,
//     created_at INTEGER NOT NULL,
//     PRIMARY KEY (message_id, username)
//   );
//   CREATE INDEX IF NOT EXISTS idx_chat_reactions_message ON chat_message_reactions (message_id);
// برای ذخیره‌شدنِ واقعیِ تگ‌های پست (نه فقط تزیینیِ پیش‌نمایش)، این ستون رو هم به جدولِ posts اضافه کن:
//   ALTER TABLE posts ADD COLUMN tags TEXT;
// نکته: role توی chat_conversation_members از قبل وجود داره؛ الان مقادیر 'owner' / 'admin' / 'member' رو می‌گیره
async function touchUserPresence(env, username) {
  try {
    await bind(
      env.D1.prepare(
        "INSERT INTO user_presence (username, last_active_at) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET last_active_at = excluded.last_active_at"
      ),
      [username, Date.now()]
    ).run();
  } catch (e) {
    // نبودِ جدول (قبل از اجرای مایگریشن) نباید کل درخواست رو خراب کنه
  }
}

async function getUserPresence(env, username) {
  try {
    const row = await env.D1.prepare("SELECT last_active_at FROM user_presence WHERE username = ?").bind(username).first();
    return row ? row.last_active_at : null;
  } catch (e) {
    return null;
  }
}

const ONLINE_WINDOW_MS = 45000; // اگه توی ۴۵ ثانیه‌ی اخیر فعالیتی ثبت شده باشه، «آنلاین» نشون داده می‌شه

// #endregion
// #region اندپوینتِ داخلی: پوش‌نوتیفیکیشنِ دعوتِ دوز (صدا زده می‌شه توسطِ ورکرِ جدایِ deh-games)
// این مسیر با همون X-Internal-Key محافظت می‌شه که پروکسیِ Pages ازش استفاده می‌کنه؛ یعنی هیچ
// کلید/سکرتِ جدیدی لازم نیست، فقط باید همین مقدار رو تو env.INTERNAL_KEY ورکرِ deh-games هم ست کنی.
async function handleDoozInvitePush(request, env) {
  const internalKey = request.headers.get("X-Internal-Key");
  if (!env.INTERNAL_KEY || internalKey !== env.INTERNAL_KEY) {
    return json({ error: "دسترسی نداری" }, 403);
  }
  const body = await request.json().catch(() => ({}));
  const toUsername = (body.toUsername || "").trim();
  const fromUsername = (body.fromUsername || "").trim();
  if (!toUsername || !fromUsername) return json({ error: "پارامترها ناقصه" }, 400);

  const pushPayload = {
    title: "دهات",
    body: `${fromUsername} دعوتت کرد به بازیِ دوز`,
    url: `${SITE_ORIGIN}/index.html`,
    tag: `dooz-invite-${fromUsername}`,
  };
  await Promise.all([
    sendPushToUser(env, toUsername, pushPayload),
    sendFcmToUser(env, toUsername, pushPayload),
  ]);
  return json({ ok: true });
}
// #endregion
// ---------- لیستِ کاربرانِ آنلاین ----------
// صفحه‌بندی با offset ساده‌ست چون این لیست مرتب تغییر می‌کنه (based on لیزی‌لودِ اسکرول، نه URLِ قابلِ بوکمارک)
async function handleOnlineUsers(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  touchUserPresence(env, username).catch(() => {});

  const url = new URL(request.url);
  const limitParam = parseInt(url.searchParams.get("limit") || "20", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;
  const offsetParam = parseInt(url.searchParams.get("offset") || "0", 10);
  const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

  const cutoff = Date.now() - ONLINE_WINDOW_MS;
  let rows = [];
  try {
    const res = await env.D1.prepare(
      `SELECT up.username AS username, up.last_active_at AS lastActiveAt, p.avatar_file_id AS avatarFileId
       FROM user_presence up
       LEFT JOIN profiles p ON p.username = up.username
       WHERE up.last_active_at >= ? AND up.username != ?
       ORDER BY up.last_active_at DESC
       LIMIT ? OFFSET ?`
    ).bind(cutoff, username, limit + 1, offset).all();
    rows = res.results || [];
  } catch (e) {
    rows = [];
  }

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).map((r) => ({
    username: r.username,
    avatarFileId: r.avatarFileId || null,
    lastActiveAt: r.lastActiveAt,
  }));

  return json({ ok: true, users: page, hasMore, nextOffset: offset + page.length });
}
// #endregion
// #region تشخیص واقعیِ نوع فایل از روی بایت‌های اول (Magic Bytes)
// ---------- تشخیص واقعیِ نوع فایل از روی بایت‌های اول (Magic Bytes) ----------
// به Content-Type اعلام‌شده توسط مرورگر به‌تنهایی اعتماد نمی‌کنیم؛ چون یه درخواست دستی (مثلاً با curl، نه از
// خودِ سایت) می‌تونه هر Content-Type دلخواهی رو ادعا کنه. این تابع خودِ محتوای فایل رو چک می‌کنه تا کسی نتونه
// مثلاً یه فایل HTML/SVG حاوی اسکریپت رو با ادعای «image/png» به سرور قالب کنه (که بعداً موقع نمایش می‌تونست
// باعث اجرای کد دلخواه (XSS) بشه).
async function detectRealMediaCategory(file) {
  const buf = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const hex = (start, len) => Array.from(buf.slice(start, start + len)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const ascii = (start, len) => String.fromCharCode(...buf.slice(start, start + len));

  // عکس
  if (hex(0, 3) === "ffd8ff") return "image"; // JPEG
  if (hex(0, 4) === "89504e47") return "image"; // PNG
  if (ascii(0, 4) === "GIF8") return "image"; // GIF
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image"; // WEBP
  if (hex(0, 2) === "424d") return "image"; // BMP

  // کانتینر ISO-BMFF (mp4/mov/m4a/heic و مشابه، همه از یه ساختار مشترک استفاده می‌کنن)
  if (ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4).trim().toLowerCase();
    if (["heic", "heix", "heif", "mif1", "avif"].includes(brand)) return "image";
    return "av"; // ویدیو یا صدا (mp4/mov/m4a همه اینجان)
  }
  if (hex(0, 4) === "1a45dfa3") return "av"; // WEBM/MKV
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "AVI ") return "av";

  // صوت
  if (ascii(0, 3) === "ID3") return "audio"; // MP3 با تگ ID3
  if (hex(0, 2) === "fffb" || hex(0, 2) === "fff3" || hex(0, 2) === "fff2") return "audio"; // MP3 خام
  if (ascii(0, 4) === "OggS") return "audio"; // OGG
  if (ascii(0, 4) === "fLaC") return "audio"; // FLAC
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return "audio"; // WAV

  return null; // هیچ امضای شناخته‌شده‌ای نداشت؛ فایل مشکوکه
}

// چک می‌کنه محتوای واقعیِ فایل با دسته‌ی ادعاشده (image/video/audio) هم‌خونی داره یا نه
async function verifyFileMatchesCategory(file, claimedCategory) {
  if (claimedCategory === "file") return true; // فایلِ عمومی: هیچ محدودیتِ نوعی نداره، پس چیزی برای تاییدِ محتوا نیست
  const real = await detectRealMediaCategory(file);
  if (!real) return false;
  if (real === claimedCategory) return true;
  if (real === "av" && (claimedCategory === "video" || claimedCategory === "audio")) return true;
  return false;
}

// #endregion
// #region جایگزین KV: ذخیره‌ی کلید/مقدارِ کوتاه‌عمر روی D1 (چون سقف نوشتن روزانه‌ی رایگان KV فقط ۱۰۰۰ تاست،
// ولی D1 روزی ۱۰۰٬۰۰۰ نوشتن رایگان داره؛ منطقاً همون کاری که KV با expirationTtl می‌کرد رو اینجا با یه ستون
// expires_at و چک‌کردن دستی موقع خوندن شبیه‌سازی می‌کنیم)
async function kvGet(env, key) {
  const row = await env.D1.prepare("SELECT v, expires_at FROM kv_store WHERE k = ?").bind(key).first();
  if (!row) return null;
  if (Date.now() > row.expires_at) return null; // منقضی شده؛ حذف فوری لازم نیست، پاکسازی دوره‌ای انجامش می‌ده
  return row.v;
}

async function kvPut(env, key, value, ttlSeconds) {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  await env.D1.prepare(
    "INSERT INTO kv_store (k, v, expires_at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, expires_at = excluded.expires_at"
  ).bind(key, value, expiresAt).run();
}

async function kvDelete(env, key) {
  await env.D1.prepare("DELETE FROM kv_store WHERE k = ?").bind(key).run();
}

// #endregion
// #region محدودکننده‌ی نرخ درخواست (rate limit) روی D1؛ برای اکشن‌های پرهزینه (ثبت‌نام، پست، کامنت، آپلود)
// ---------- محدودکننده‌ی نرخ درخواست (rate limit) روی D1؛ برای اکشن‌های پرهزینه (ثبت‌نام، پست، کامنت، آپلود) ----------
// key: شناسه‌ای که محدودیت روش اعمال می‌شه (یوزرنیم یا IP)، limit: سقف مجاز در بازه، windowSeconds: طول پنجره
// خروجی true یعنی مجازه، false یعنی به سقف رسیده و باید رد بشه
async function checkRateLimit(env, action, key, limit, windowSeconds) {
  const rlKey = `ratelimit:${action}:${key}`;
  const now = Date.now();

  let state = null;
  try {
    const raw = await kvGet(env, rlKey);
    state = raw ? JSON.parse(raw) : null;
  } catch (e) {
    state = null;
  }

  if (!state || now > state.resetAt) {
    await kvPut(env, rlKey, JSON.stringify({ count: 1, resetAt: now + windowSeconds * 1000 }), windowSeconds);
    return true;
  }

  if (state.count >= limit) return false;

  state.count += 1;
  const remainingTtl = Math.max(1, Math.ceil((state.resetAt - now) / 1000));
  await kvPut(env, rlKey, JSON.stringify(state), remainingTtl);
  return true;
}

// #endregion
// #region شناسه‌ی IP کاربر (برای rate limit روی درخواست‌های پیش از لاگین مثل ثبت‌نام)
// ---------- شناسه‌ی IP کاربر (برای rate limit روی درخواست‌های پیش از لاگین مثل ثبت‌نام) ----------
function getClientIp(request) {
  // اگه از طریق ورکر پروکسی اومده باشه (که تا این نقطه از کد قبلاً با X-Internal-Key تایید شده)،
  // آی‌پی واقعیِ کاربر رو از هدر سفارشیِ پروکسی می‌خونیم؛ چون CF-Connecting-IP توی این حالت
  // آی‌پیِ خودِ شبکه‌ی کلادفلره، نه کاربر. اگه این هدر نبود (مثلاً موقع تست مستقیم)، به روش قبلی برمی‌گردیم.
  return request.headers.get("X-Real-Client-IP") || request.headers.get("CF-Connecting-IP") || "unknown";
}

// #endregion
// #region کپچای اثبات‌کار خودمیزبان (ضدبات، جایگزینِ Turnstile — بدون تماس با هیچ سرور خارجی)
// ---------- کپچای اثبات‌کار خودمیزبان (ضدبات، جایگزینِ Turnstile — بدون تماس با هیچ سرور خارجی) ----------
// چرا؟ Turnstile برای خیلی از کاربرهای ایرانی یا لود نمی‌شه یا کند/ناپایداره چون باید با سرورهای
// کلادفلر (challenges.cloudflare.com) تماس بگیره. این جایگزین کاملاً روی همین ورکر اجرا می‌شه:
// نه مرورگر کاربر و نه خودِ ورکر هیچ درخواستی به سرور خارجی نمی‌زنن. مکانیزم شبیه Altcha است:
// یه «چالش» اثبات‌کار (proof-of-work) به کلاینت داده می‌شه، کاربر (بدون هیچ تعامل دستی جز یه
// تیک) با هش کردن SHA-256 دنبال یه nonce می‌گرده که هشِ salt+nonce با تعداد مشخصی صفر شروع بشه،
// و سرور در پایان همون محاسبه رو تکرار و تایید می‌کنه. سختیِ پایین (DIFFICULTY_BITS) باعث می‌شه
// حل‌کردنش رو مرورگر کاربر واقعی زیر یه ثانیه طول بکشه، ولی جلوی اسکریپت‌های خودکارِ ساده رو بگیره.
const CAPTCHA_DIFFICULTY_BITS = 18; // هرچی بیشتر، سخت‌تر و کندتر (برای مرورگر معمولی خوب: ۱۶ تا ۲۰)
const CAPTCHA_TTL_SECONDS = 120; // مهلت حل کردنِ هر چالش

function randomBase64Url(bytes = 24) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return bufferToHex(buf);
}

// تعداد بیتِ صفرِ ابتدای هش (به‌صورت باینری) رو می‌شمره؛ برای چک کردنِ سختیِ جواب
function leadingZeroBits(hexHash) {
  let bits = 0;
  for (const ch of hexHash) {
    const nibble = parseInt(ch, 16);
    if (nibble === 0) { bits += 4; continue; }
    // شمارشِ صفرهای ابتدایی همون نیبل ۴بیتی
    bits += Math.clz32(nibble) - 28;
    break;
  }
  return bits;
}

// چالش جدید می‌سازه و توی جدولِ kv_store (روی D1، نه سرویسِ خارجی) ذخیره‌اش می‌کنه
async function createCaptchaChallenge(env) {
  const id = randomBase64Url(16);
  const salt = randomBase64Url(16);
  await kvPut(env, `captcha:${id}`, JSON.stringify({ salt, used: false }), CAPTCHA_TTL_SECONDS);
  return { id, salt, difficulty: CAPTCHA_DIFFICULTY_BITS };
}

// جوابِ کلاینت (id چالش + nonce پیدا شده) رو تایید می‌کنه؛ هر چالش فقط یک‌بار قابلِ استفاده‌ست
async function verifyCaptchaSolution(solution, env) {
  if (!solution || !solution.id || solution.nonce === undefined || solution.nonce === null) return false;
  const raw = await kvGet(env, `captcha:${solution.id}`);
  if (!raw) return false; // چالش وجود نداره یا منقضی شده
  const state = JSON.parse(raw);
  if (state.used) return false;

  const hash = await sha256Hex(`${state.salt}:${solution.nonce}`);
  if (leadingZeroBits(hash) < CAPTCHA_DIFFICULTY_BITS) return false;

  // یک‌بارمصرف: بلافاصله بعد از تایید موفق، چالش رو باطل کن تا قابلِ استفاده‌ی مجدد نباشه
  await kvDelete(env, `captcha:${solution.id}`);
  return true;
}

// اپ نیتیوِ اندروید نمی‌تونه ویجتِ وبیِ کپچا رو نشون بده؛ به‌جاش یه کلید مخفی تو خودِ اپ ذخیره می‌شه
// و با هدر X-App-Secret فرستاده می‌شه. اگه این هدر با مقدار محرمانه‌ی env مطابقت داشت، یعنی درخواست
// از اپ رسمیه و از چکِ کپچا معاف می‌شه (بقیه‌ی محدودیت‌های نرخ درخواست همچنان برقرارن).
function isTrustedNativeApp(request, env) {
  if (!env.APP_SHARED_SECRET) return false;
  const header = request.headers.get("X-App-Secret") || "";
  return header === env.APP_SHARED_SECRET;
}

// #endregion
// #region کمکی: آیا کاربر جاری ادمینه؟ (مالک سایت همیشه ادمینه)
// ---------- کمکی: آیا کاربر جاری ادمینه؟ (مالک سایت همیشه ادمینه) ----------
function isSuperAdmin(username) {
  return username === SUPER_ADMIN_USERNAME;
}

// ---------- رتبه‌ی ادمینِ یک کاربر ----------
// ۱ = مالک سایت (Aghey، هاردکد و غیرقابل‌واگذاری)، ۲ و ۳ = رتبه‌های قابل‌واگذاری توسط مالک، ۰ = ادمین نیست
async function getAdminRank(env, username) {
  if (!username) return 0;
  if (isSuperAdmin(username)) return 1;
  const row = await env.D1.prepare("SELECT admin_rank FROM users WHERE username = ?").bind(username).first();
  const rank = row ? Number(row.admin_rank) : 0;
  return rank === 2 || rank === 3 ? rank : 0;
}

// آیا کاربر جاری، ادمین (با هر رتبه‌ای) هست؟
async function isAdminUser(env, username) {
  return (await getAdminRank(env, username)) > 0;
}

// آمار سایت و لیست/مسدودسازی کاربران: هر سه رتبه
function canBanUsers(rank) {
  return rank === 1 || rank === 2 || rank === 3;
}
// مدیریت استیکرها (حذف استیکر دیگران): فقط رتبه ۱ و ۲
function canManageStickers(rank) {
  return rank === 1 || rank === 2;
}
// مشاهده و بستن گزارش‌ها: فقط رتبه ۱ و ۲
function canManageReports(rank) {
  return rank === 1 || rank === 2;
}
// حذف پست/کامنتِ دیگران و نظارت روی گروه‌های چت و تغییر رتبه‌ی ادمین‌ها: فقط رتبه ۱ (مالک سایت)
function canModerateContent(rank) {
  return rank === 1;
}
// دادن/گرفتنِ قابلیتِ «کد معرف» به کاربرها: فقط مالک سایت (رتبه ۱) و ادمین‌های رتبه ۲
function canGrantReferral(rank) {
  return rank === 1 || rank === 2;
}

// #endregion
// #region گرفتن کاربر از روی توکن (و رد کردن کاربر مسدود)
// ---------- گرفتن کاربر از روی توکن (و رد کردن کاربر مسدود) ----------
// سشن‌ها همچنان توی KV هستن (کاربرد اصلی KV: داده‌ی کوتاه‌مدت با TTL)
async function getUserFromToken(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  // قبلاً این تابع دو تا کوئریِ پشتِ‌سرِهم به D1 می‌زد (یکی برای sessions، یکی برای users)؛ چون این
  // تابع رویِ تقریباً هر اندپوینتِ لاگین‌شده صدا زده می‌شه، این دو رفت‌وبرگشت رو با یه JOIN به یکی
  // تبدیل کردیم — همینه که سرعتِ تقریباً کل سایت رو (نه فقط این تابع) قابل‌لمس بهتر می‌کنه.
  const row = await env.D1.prepare(
    "SELECT sessions.expires_at AS expires_at, users.username AS username, users.banned AS banned " +
    "FROM sessions JOIN users ON users.username = sessions.username " +
    "WHERE sessions.token = ?"
  ).bind(token).first();

  if (!row) return null;
  if (row.expires_at < Date.now()) {
    // سشن منقضی شده؛ پاکش می‌کنیم و رد می‌کنیم
    await env.D1.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return null;
  }
  if (row.banned) return null;

  return row.username;
}

// مثل getUserFromToken، ولی علاوه بر هدر Authorization، از پارامتر ?token= هم پشتیبانی می‌کنه؛
// چون تگ‌های <img>/<audio>/<video> نمی‌تونن هدر سفارشی بفرستن، مدیای خصوصی مجبوره توکن رو
// از کوئری‌استرینگ بخونه. فقط برای handleMedia استفاده می‌شه؛ بقیه‌ی اندپوینت‌ها همچنان فقط هدر رو قبول می‌کنن.
async function getUserFromTokenOrQuery(request, env) {
  const viaHeader = await getUserFromToken(request, env);
  if (viaHeader) return viaHeader;

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return null;

  const session = await env.D1.prepare("SELECT username, expires_at FROM sessions WHERE token = ?").bind(token).first();
  if (!session) return null;
  if (session.expires_at < Date.now()) {
    await env.D1.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return null;
  }

  const user = await env.D1.prepare("SELECT banned FROM users WHERE username = ?").bind(session.username).first();
  if (!user || user.banned) return null;

  return session.username;
}

// #endregion
// #region خروج (باطل کردن توکن سمت سرور)
// ---------- خروج (باطل کردن توکن سمت سرور) ----------
async function handleLogout(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token) await env.D1.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  return json({ ok: true });
}

// فقط حروف (فارسی/انگلیسی)، عدد و آندرلاین مجازه؛ جلوی کاراکترهایی مثل کوتیشن، تگ و... رو می‌گیره
// که می‌تونستن با جاسازی نام کاربری داخل onclick سمت فرانت، باعث اجرای کد دلخواه (XSS ذخیره‌شده) بشن
const USERNAME_RE = /^[\p{L}\p{N}_]{3,20}$/u;

// #endregion
// #region صدور چالشِ کپچا (اثبات‌کار) برای فرم‌های ورود/ثبت‌نام
// ---------- صدور چالشِ کپچا (اثبات‌کار) برای فرم‌های ورود/ثبت‌نام ----------
async function handleCaptchaChallenge(request, env) {
  const ip = getClientIp(request);
  // یه محدودیتِ سبک روی صدورِ چالش، تا کسی نتونه با هزاران درخواستِ پشت‌سرهم جدولِ kv_store رو پر کنه
  if (!(await checkRateLimit(env, "captcha_challenge", ip, 60, 300))) {
    return json({ error: "درخواست زیاد بود، کمی صبر کن" }, 429);
  }
  const challenge = await createCaptchaChallenge(env);
  return json(challenge);
}

// #endregion
// #region ثبت‌نام
// ---------- ثبت‌نام ----------
async function handleRegister(request, env) {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(env, "register", ip, 5, 3600))) {
    return json({ error: "تعداد ثبت‌نام از این آی‌پی زیاد بوده، یه ساعت دیگه امتحان کن" }, 429);
  }

  const { username, password, captchaSolution, referralCode } = await request.json();

  if (!isTrustedNativeApp(request, env) && !(await verifyCaptchaSolution(captchaSolution, env))) {
    return json({ error: "تایید امنیتی انجام نشد؛ صفحه رو رفرش کن و دوباره امتحان کن" }, 400);
  }

  const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/; // حداقل ۸ کاراکتر، شاملِ حداقل یه حرف و یه عدد
  if (!username || !password || !USERNAME_RE.test(username) || !PASSWORD_RE.test(password)) {
    return json({ error: "نام کاربری باید ۳ تا ۲۰ کاراکتر و فقط شامل حروف، عدد و _ باشه؛ رمز حداقل ۸ کاراکتر و شامل حرف و عدد باشه" }, 400);
  }

  const normalizedReferralCode = (referralCode || "").toString().trim().toUpperCase();
  if (!normalizedReferralCode) {
    return json({ error: "برای ثبت‌نام به یه کد معرف نیاز داری" }, 400);
  }
  const referralRow = await env.D1.prepare(
    "SELECT code, owner_username, used, max_uses, use_count, expires_at, is_custom FROM referral_codes WHERE code = ?"
  ).bind(normalizedReferralCode).first();
  if (!referralRow) {
    return json({ error: "کد معرف نامعتبره" }, 400);
  }
  const maxUses = referralRow.max_uses || 1;
  const useCount = referralRow.use_count || 0;
  if (referralRow.used || useCount >= maxUses) {
    return json({ error: "کد معرف به سقفِ استفاده‌ی مجاز رسیده" }, 400);
  }
  if (referralRow.expires_at && referralRow.expires_at <= Date.now()) {
    return json({ error: "مهلتِ استفاده از این کد معرف تموم شده" }, 400);
  }

  const existing = await env.D1.prepare("SELECT username FROM users WHERE username = ?").bind(username).first();
  if (existing) {
    return json({ error: "این نام کاربری قبلاً گرفته شده" }, 409);
  }

  const salt = randomHex(16);
  const hash = await hashPassword(password, salt, env);
  const now = Date.now();
  await bind(
    env.D1.prepare(
      "INSERT INTO users (username, salt, hash, banned, is_admin, created_at, referred_by) VALUES (?, ?, ?, 0, 0, ?, ?)"
    ),
    [username, salt, hash, now, referralRow.owner_username]
  ).run();

  // آمارِ مصرفِ کد معرف رو به‌روز کن؛ فقط وقتی به سقفِ max_uses برسه به‌عنوانِ «تمام‌شده» علامت می‌خوره
  const newUseCount = useCount + 1;
  const exhausted = newUseCount >= maxUses ? 1 : 0;
  await env.D1.prepare(
    "UPDATE referral_codes SET used = ?, use_count = ?, used_by = ?, used_at = ? WHERE code = ?"
  ).bind(exhausted, newUseCount, username, now, normalizedReferralCode).run();
  // ردِ هر بارِ استفاده (برای کدهای چندبارمصرف، تا Aghey بتونه لیستِ کاملِ استفاده‌کننده‌ها رو ببینه)
  await env.D1.prepare(
    "INSERT INTO referral_code_uses (id, code, used_by, used_at) VALUES (?, ?, ?, ?)"
  ).bind(`${now}_${randomHex(4)}`, normalizedReferralCode, username, now).run();

  const ownerUsername = referralRow.owner_username;
  if (referralRow.is_custom) {
    // کدهای شخصی‌سازی‌شده مستقل از سیستمِ کول‌داون/کدِ خودکارِ شخصیِ صاحبشون هستن؛ چیزِ دیگه‌ای لازم نیست
  } else if (isSuperAdmin(ownerUsername)) {
    // مالک سایت محدودیت و کول‌داون نداره؛ همیشه یه کدِ فعالِ جدید داشته باشه
    await issueNewReferralCode(env, ownerUsername);
  } else {
    const ownerRow = await env.D1.prepare(
      "SELECT referral_success_count FROM users WHERE username = ?"
    ).bind(ownerUsername).first();
    const newCount = ((ownerRow && ownerRow.referral_success_count) || 0) + 1;
    let cooldownUntil = null;
    if (newCount % REFERRAL_SUCCESS_BATCH === 0) {
      cooldownUntil = now + REFERRAL_COOLDOWN_MS;
    }
    await env.D1.prepare(
      "UPDATE users SET referral_success_count = ?, referral_cooldown_until = ? WHERE username = ?"
    ).bind(newCount, cooldownUntil, ownerUsername).run();

    if (!cooldownUntil) {
      // هنوز به سقفِ ۵‌تایی نرسیده؛ بلافاصله یه کدِ جدید براش بساز
      await issueNewReferralCode(env, ownerUsername);
    }
  }

  return json({ ok: true });
}

// #endregion
// #region ثبت تلاش ناموفق ورود؛ بعد ۵ تای پشت‌سرهم ۵ دقیقه قفل می‌شه
// ---------- ثبت تلاش ناموفق ورود؛ بعد ۵ تای پشت‌سرهم ۵ دقیقه قفل می‌شه ----------
async function registerFailedLogin(env, username) {
  const failsKey = `login_fails:${username}`;
  const raw = await kvGet(env, failsKey);
  const count = raw ? parseInt(raw, 10) : 0;
  const newCount = count + 1;

  if (newCount >= 5) {
    await kvPut(env, `login_lock:${username}`, "1", 300); // ۵ دقیقه قفل
    await kvDelete(env, failsKey);
  } else {
    await kvPut(env, failsKey, String(newCount), 300); // پنجره‌ی شمارش: ۵ دقیقه
  }
}

// #endregion
// #region ورود
// ---------- ورود ----------
async function handleLogin(request, env) {
  const ip = getClientIp(request);
  // محدودیت روی خودِ IP (جدا از قفل به‌ازای هر یوزرنیم)؛ جلوی این رو می‌گیره که یه نفر
  // از یه IP، رو صدها یوزرنیم مختلف هرکدوم چندتا تلاش بزنه بدون این‌که هیچ‌جا قفل بشه
  if (!(await checkRateLimit(env, "login_ip", ip, 20, 300))) {
    return json({ error: "تعداد تلاش‌های ورود از این آی‌پی زیاد بوده، چند دقیقه دیگه امتحان کن" }, 429);
  }

  const { username, password, captchaSolution } = await request.json();
  if (!username || !password) return json({ error: "نام کاربری و رمز لازمه" }, 400);

  if (!isTrustedNativeApp(request, env) && !(await verifyCaptchaSolution(captchaSolution, env))) {
    return json({ error: "تایید امنیتی انجام نشد؛ صفحه رو رفرش کن و دوباره امتحان کن" }, 400);
  }

  const lockKey = `login_lock:${username}`;
  const locked = await kvGet(env, lockKey);
  if (locked) {
    return json({ error: "به خاطر تلاش‌های ناموفق زیاد، ۵ دقیقه صبر کن و دوباره امتحان کن" }, 429);
  }

  const userData = await env.D1.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
  if (!userData) {
    await registerFailedLogin(env, username);
    return json({ error: "نام کاربری یا رمز اشتباهه" }, 401);
  }

  const attemptHash = await hashPassword(password, userData.salt, env);
  if (attemptHash !== userData.hash) {
    await registerFailedLogin(env, username);
    return json({ error: "نام کاربری یا رمز اشتباهه" }, 401);
  }
  if (userData.banned) return json({ error: "این حساب توسط مدیر سایت مسدود شده" }, 403);

  await kvDelete(env, `login_fails:${username}`);

  const token = randomHex(24);
  // سشن به مدت ۳۰ روز معتبره
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  await env.D1.prepare("INSERT INTO sessions (token, username, expires_at) VALUES (?, ?, ?)")
    .bind(token, username, expiresAt)
    .run();

  return json({ ok: true, token, username });
}

// #endregion
// #region توزیعِ تصادفیِ بارِ درخواست‌های تلگرام بینِ چند بات (اختیاری)
// ---------- توزیعِ تصادفیِ بارِ درخواست‌های تلگرام بینِ چند بات (اختیاری) ----------
// تلگرام به یه چتِ خاص (همون CHANNEL_ID) رو حدودِ ۲۰ پیام در دقیقه توصیه می‌کنه؛ چون همه‌چیز (پست،
// عکس، ویدیو، آهنگ، اعلانِ کامنت...) به همین یه چنل می‌ره، ممکنه به این سقف بخوریم. راه‌حل: یه بات
// کمکیِ دوم (env.BOT_TOKEN_2) هم به‌عنوانِ ادمین به چنل اضافه می‌شه و بینِ دو بات، تصادفی پخش می‌کنیم.
// اگه BOT_TOKEN_2 ست نشده باشه، همیشه فقط باتِ اول استفاده می‌شه — یعنی کاملاً اختیاریه.
//
// نکته‌ی مهمِ فنی: تلگرام اجازه نمی‌ده یه بات پیامی که باتِ دیگه فرستاده رو ویرایش کنه (editMessageCaption/
// editMessageText فقط رویِ پیام‌های خودِ همون بات کار می‌کنه). برای همین:
// - هر فایلی که آپلود می‌شه، شناسه‌ش با پیشوندِ «2:» علامت‌گذاری می‌شه اگه بات دوم فرستاده باشدش
//   (extractFileId/tagFileId این کار رو خودکار انجام می‌دن)؛ موقعِ نمایش/دانلود (handleMedia) همین
//   پیشوند خونده می‌شه تا با باتِ درست از تلگرام گرفته بشه.
// - برای پست‌ها (که message_id‌شون ممکنه بعداً نیاز به ویرایشِ کپشن یا حذف داشته باشه)، یه ستونِ
//   bot_slot تو جدولِ posts نگه می‌داریم:
//   ALTER TABLE posts ADD COLUMN bot_slot INTEGER NOT NULL DEFAULT 1;
function pickTelegramBot(env) {
  if (env.BOT_TOKEN_2 && Math.random() < 0.5) return { token: env.BOT_TOKEN_2, slot: 2 };
  return { token: env.BOT_TOKEN, slot: 1 };
}

function telegramTokenForSlot(env, slot) {
  return slot === 2 && env.BOT_TOKEN_2 ? env.BOT_TOKEN_2 : env.BOT_TOKEN;
}

// شناسه‌ی فایل رو (اگه بات دوم فرستاده باشدش) با پیشوندِ «2:» علامت‌گذاری می‌کنه تا موقعِ دانلود
// بشه فهمید با کدوم بات باید از تلگرام گرفته بشه. شناسه‌های قدیمی/بدونِ پیشوند یعنی باتِ اول.
function tagFileId(id, slot) {
  if (!id) return id || null;
  return slot === 2 ? `2:${id}` : id;
}

// پیشوندِ احتمالیِ «2:» رو از یه فایل‌آیدی جدا می‌کنه؛ برمی‌گردونه { id, slot }
function untagFileId(fileId) {
  if (typeof fileId === "string" && fileId.startsWith("2:")) {
    return { id: fileId.slice(2), slot: 2 };
  }
  return { id: fileId, slot: 1 };
}

// #endregion
// #region ارسال به تلگرام (متن ساده)
// ---------- ارسال به تلگرام (متن ساده) ----------
// برمی‌گردونه { message_id, slot } تا فراخوان (در صورتِ نیاز به ویرایش/حذفِ بعدی) بدونه کدوم بات فرستاده
async function sendTelegramTextTo(env, chatId, text) {
  const { token, slot } = pickTelegramBot(env);
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || "خطای تلگرام");
  data.result.__slot = slot;
  return data.result;
}

async function sendTelegramText(env, text) {
  return sendTelegramTextTo(env, env.CHANNEL_ID, text);
}

// موقعِ آپلودِ چانکی، فایل قبل از اینکه متنِ پست معلوم باشه به تلگرام فرستاده می‌شه (بدونِ کپشن).
// این تابع بعداً (تو handlePost، وقتی متن هم در دسترسه) کپشن رو رویِ همون پیام می‌ذاره.
// slot باید دقیقاً همون باتی باشه که خودِ پیام رو فرستاده، وگرنه تلگرام خطا می‌ده.
async function editTelegramCaption(env, chatId, messageId, caption, slot = 1) {
  const token = telegramTokenForSlot(env, slot);
  const res = await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, caption: caption.slice(0, 1000) }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || "خطای تلگرام");
  return data.result;
}

// #endregion
// #region ارسال فایل (عکس/ویدیو/سند/آهنگ) به تلگرام
// ---------- ارسال فایل (عکس/ویدیو/سند/آهنگ) به تلگرام ----------
async function sendTelegramFile(env, method, field, file, caption, extraFields = {}) {
  const { token, slot } = pickTelegramBot(env);
  const fd = new FormData();
  fd.append("chat_id", env.CHANNEL_ID);
  if (caption) fd.append("caption", caption.slice(0, 1000)); // کپشن تلگرام حداکثر ۱۰۲۴ کاراکتره
  fd.append(field, file, file.name || "upload");
  for (const [key, value] of Object.entries(extraFields)) {
    if (value) fd.append(key, value);
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    body: fd,
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || "خطای تلگرام");
  data.result.__slot = slot;
  return data.result;
}

// شناسه‌ی فایلِ اصلی رو از پاسخِ تلگرام استخراج می‌کنه و (در صورتِ نیاز) با پیشوندِ باتِ دوم علامت می‌زنه
function extractFileId(type, result) {
  let id = null;
  if (type === "photo" && result.photo) id = result.photo[result.photo.length - 1].file_id;
  else if (type === "video" && result.video) id = result.video.file_id;
  else if (type === "audio" && result.audio) id = result.audio.file_id;
  else if (type === "voice" && result.voice) id = result.voice.file_id;
  else if (type === "document" && result.document) id = result.document.file_id;
  else if (type === "animation" && result.animation) id = result.animation.file_id;
  return tagFileId(id, result.__slot);
}


// #endregion
// #region پل موقتِ آپلود (litterbox.catbox.moe) — برای اینترنتِ کند/ناپایدار
// ---------- پل موقتِ آپلود ----------
// چرا: آپلودِ مستقیم از مرورگرِ کاربر به این ورکر، رویِ اینترنتِ کند/ناپایدار (مثلاً ایران) اغلب قطع
// می‌شه چون یه درخواستِ حجیمِ تکی خیلی شکننده‌ست. راه‌حل: کلاینت اول فایل رو به یه سرویسِ رایگانِ
// «فایلِ موقت» (litterbox.catbox.moe؛ آپلودِ ناشناس، بدونِ نیاز به اکانت/کلید، و بعد از ۱ ساعت خودش
// خودکار پاک می‌شه — همون «پلِ موقت»ی که خواسته شده بود) آپلود می‌کنه؛ اگه اون سمت شکست خورد،
// کلاینت خودش به‌صورتِ خودکار به روشِ قبلی (آپلودِ مستقیمِ multipart به همین ورکر) برمی‌گرده، پس هیچ
// رگرسیونی نداره. بعد از آپلودِ موفق به litterbox، کلاینت فقط یه لینکِ کوچیک (چند ده کاراکتر، نه خودِ
// فایل) به این ورکر می‌فرسته؛ این ورکر (که رویِ شبکه‌ی سریعِ کلادفلره) خودش فایل رو از اونجا می‌گیره
// و دقیقاً مثلِ قبل به تلگرام می‌فرسته. لیترباکس API/حذفِ دستی نداره؛ فقط با گذشتِ زمان (اینجا کوتاه‌ترین
// بازه یعنی ۱ ساعت) خودش پاک می‌شه، که چون همون لحظه‌ی آپلود این ورکر می‌گیرتش و می‌فرستتش، کافیه.
//
// نکته‌ی امنیتی مهم (جلوگیری از SSRF): این ورکر فقط اجازه داره از دامنه‌های دقیقاً مشخص‌شده‌ی زیر
// فچ کنه، نه از هر آدرسی که کلاینت بفرسته؛ وگرنه کلاینتِ مخرب می‌تونست این ورکر رو مجبور کنه به
// آدرس‌های داخلی/دلخواه درخواست بزنه.
const ALLOWED_BRIDGE_HOSTS = ["litter.catbox.moe", "litterbox.catbox.moe"];

function isAllowedBridgeUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "https:") return false;
    return ALLOWED_BRIDGE_HOSTS.includes(u.hostname);
  } catch (e) {
    return false;
  }
}

async function fetchBridgeFile(urlStr, maxSize) {
  const res = await fetch(urlStr);
  if (!res.ok) throw new Error("دریافتِ فایل از سرورِ موقت ناموفق بود");
  const blob = await res.blob();
  if (!blob || blob.size === 0) throw new Error("فایلِ دریافتی خالیه");
  if (blob.size > maxSize) throw new Error("حجمِ فایل بیش از حدِ مجازه");
  return blob;
}
// #endregion

// #endregion
// #region ساخت پست جدید (متن و/یا رسانه)
// ---------- ساخت پست جدید (متن و/یا رسانه) ----------
// #endregion
// #region کول‌داون آپلود پست: هر کاربر فقط هر POST_COOLDOWN_SECONDS یه پست می‌تونه بذاره
// ---------- کول‌داون آپلود پست: هر کاربر فقط هر POST_COOLDOWN_SECONDS یه پست می‌تونه بذاره ----------
// این جدا از checkRateLimit عمومیه: rateLimit عمومی جلوی برست/اسپم سریع رو می‌گیره (مثلاً ۸ تا تو ۵ دقیقه)،
// ولی اینجا یه فاصله‌ی ثابتِ حداقلی بین دو پست پیاپی رو تضمین می‌کنه و علاوه بر پیام خطا، زمان دقیق باقی‌مونده
// (به ثانیه) رو هم برمی‌گردونه تا کلاینت بتونه شمارش‌معکوس واقعی نشون بده.
const POST_COOLDOWN_SECONDS = 60; // ۳ دقیقه

async function checkPostCooldown(env, username) {
  const key = `postcooldown:${username}`;
  const now = Date.now();

  let nextAllowedAt = null;
  try {
    const raw = await kvGet(env, key);
    if (raw) nextAllowedAt = parseInt(raw, 10);
  } catch (e) {
    nextAllowedAt = null;
  }

  if (nextAllowedAt && now < nextAllowedAt) {
    return { allowed: false, remainingSeconds: Math.ceil((nextAllowedAt - now) / 1000) };
  }

  const newNextAllowedAt = now + POST_COOLDOWN_SECONDS * 1000;
  await kvPut(env, key, String(newNextAllowedAt), POST_COOLDOWN_SECONDS + 10);
  return { allowed: true, remainingSeconds: 0 };
}


async function handlePost(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  // مالکِ سایت از کول‌داون/ریت‌لیمیتِ پست معافه — برای قابلیتِ آپلودِ دسته‌ای (مثلاً ۳۰ تا موزیک پشتِ‌سرِهم)
  if (!isSuperAdmin(username)) {
    const cooldown = await checkPostCooldown(env, username);
    if (!cooldown.allowed) {
      return json(
        { error: `هنوز ${cooldown.remainingSeconds} ثانیه تا پست بعدی مونده`, cooldownRemaining: cooldown.remainingSeconds },
        429
      );
    }

    if (!(await checkRateLimit(env, "post", username, 8, 300))) {
      return json({ error: "پست زیاد ثبت کردی، چند دقیقه دیگه امتحان کن" }, 429);
    }
  }

  const form = await request.formData();
  const text = (form.get("text") || "").toString().trim();
  const title = (form.get("title") || "").toString().trim().slice(0, 15);
  const file = form.get("file");
  const hasFile = file && typeof file !== "string" && file.size > 0;
  // فایلِ از قبل آپلودشده (از طریقِ آپلودِ چانکی، /api/upload/*): وقتی کلاینت فایل رو خودش تکه‌تکه
  // به تلگرام فرستاده و fileId گرفته، دیگه نباید همون فایل رو دوباره اینجا آپلود کنه — فقط شناسه‌اش
  // رو می‌فرسته و ما مستقیم همون رو به‌عنوانِ file_id پست ذخیره می‌کنیم
  const preUploadedFileId = (form.get("fileId") || "").toString().trim();
  const preUploadedFileType = (form.get("fileType") || "").toString().trim();
  const preUploadedMessageIdRaw = (form.get("messageId") || "").toString().trim();
  const preUploadedMessageId = preUploadedMessageIdRaw ? Number(preUploadedMessageIdRaw) : null;
  const hasPreUploaded = !!preUploadedFileId && ["image", "video", "audio"].includes(preUploadedFileType);
  const clientAudioTitle = (form.get("audio_title") || "").toString().trim().slice(0, 60);
  const clientAudioPerformer = (form.get("audio_performer") || "").toString().trim().slice(0, 60);
  // ۴۳ نه ۴۰: چون کلاینت هر ۱۰ کاراکتر یه خط جدید (\n) اضافه می‌کنه، متنِ ۴۰‌کاراکتریِ فرمت‌شده
  // می‌تونه تا ۳ کاراکتر \n اضافه هم داشته باشه؛ برش با ۴۰ باعث قطع‌شدنِ انتهای خط آخر می‌شد
  const clientAudioFeeling = (form.get("audio_feeling") || "").toString().trim().slice(0, 43);
  // مدت‌زمانِ آهنگ (ثانیه)؛ مرورگرِ کاربر خودش موقعِ آپلود با Audio API می‌خونتش و می‌فرسته — لازمِ
  // زمان‌بندیِ رادیوی زنده‌ست (بدونِ این، سرور نمی‌دونه هر آهنگ کِی تموم می‌شه)
  const clientAudioDurationRaw = Number(form.get("audio_duration"));
  const clientAudioDuration = Number.isFinite(clientAudioDurationRaw) && clientAudioDurationRaw > 0 && clientAudioDurationRaw < 36000
    ? Math.round(clientAudioDurationRaw)
    : null;
  const audioCoverFile = form.get("audio_cover");
  const hasAudioCover = audioCoverFile && typeof audioCoverFile !== "string" && audioCoverFile.size > 0
    && audioCoverFile.size <= 5 * 1024 * 1024;
  // «نقاشیِ متن»: فقط برای پست‌های متنی معنی داره (بدون فایل/آپلودِ ازقبل‌آماده)؛ خروجیِ PNG کوچیکیه
  // که کلاینت از کانواسِ نقاشی می‌سازه
  const drawingFile = form.get("drawing");
  const hasDrawing = drawingFile && typeof drawingFile !== "string" && drawingFile.size > 0
    && drawingFile.size <= 5 * 1024 * 1024;
  // تیکِ «نمایش در رادیو دهات»؛ فقط برای عکس/ویدیو معنی داره — یعنی این رسانه به‌عنوانِ پس‌زمینه‌ی
  // تمام‌صفحه‌ی رادیونما (بدونِ صدا، هر ۴۵ ثانیه عوض می‌شه) هم استفاده بشه
  const clientRadioVisual = ["1", "true", "on"].includes((form.get("radio_visual") || "").toString().trim().toLowerCase());

  // «سرو غذا»: فقط برای سرآشپزها معنی داره — اگه تیک بخوره، این پست اصلاً وارد فیدِ عادی نمی‌شه،
  // فقط به‌عنوانِ یه آیتمِ منوی رستوران ذخیره می‌شه (پایین‌تر همین تابع مدیریتش می‌کنه)
  const serveFood = ["1", "true", "on"].includes((form.get("serve_food") || "").toString().trim().toLowerCase());
  const foodPriceRaw = Number(form.get("food_price"));
  const foodPrice = Number.isFinite(foodPriceRaw) && foodPriceRaw > 0 ? Math.round(foodPriceRaw) : null;
  const foodDescription = (form.get("food_description") || "").toString().trim().slice(0, 300);

  // تگ‌ها: دقیقاً همون قانونِ تفکیکِ سمتِ کلاینت (با فاصله/کاما جدا می‌شن)، حداکثر ۶ تا و هر کدوم حداکثر ۳۰ کاراکتر
  const tagsRaw = (form.get("tags") || "").toString().trim();
  let tags = [];
  if (tagsRaw) {
    tags = tagsRaw
      .split(/[\s,،]+/)
      .filter(Boolean)
      .map((t) => t.slice(0, 30))
      .slice(0, 6);
  }
  const tagsJson = tags.length ? JSON.stringify(tags) : null;

  if (!text && !hasFile && !hasPreUploaded) return json({ error: "پست نمی‌تونه خالی باشه" }, 400);
  if (text.length > 2000) return json({ error: "متن خیلی طولانیه" }, 400);
  if (title.length > 15) return json({ error: "عنوان نباید بیشتر از ۱۵ کاراکتر باشه" }, 400);
  if (hasFile && file.size > 20 * 1024 * 1024) {
    return json({ error: "حجم فایل نباید بیشتر از ۲۰ مگابایت باشه" }, 400);
  }

  if (hasFile && !/^(image|video|audio)\//.test(file.type)) {
    return json({ error: "فقط عکس، ویدیو و آهنگ قابل آپلوده" }, 400);
  }
  if (hasFile && !(await verifyFileMatchesCategory(file, file.type.split("/")[0]))) {
    return json({ error: "محتوای فایل با نوع اعلام‌شده‌اش مطابقت نداره" }, 400);
  }

  if (serveFood) {
    if (!(await isChefUser(env, username))) return json({ error: "فقط سرآشپزها می‌تونن غذا سرو کنن" }, 403);
    // عکس یا از مسیرِ قدیمیِ آپلودِ مستقیم میاد (hasFile) یا از مسیرِ چانکی/resumable که فقط
    // fileId+fileType می‌فرسته (hasPreUploaded)؛ قبلاً فقط حالتِ اول چک می‌شد و همینِ باعث می‌شد
    // هر عکسی که از مسیرِ چانکی بیاد (که مسیرِ فعلیِ کلاینته) رد بشه
    const hasFoodImage = (hasFile && file.type.startsWith("image/")) || (hasPreUploaded && preUploadedFileType === "image");
    if (!hasFoodImage) return json({ error: "غذا باید با یه عکس سرو بشه" }, 400);
    if (!foodPrice) return json({ error: "قیمتِ غذا (به دهپوینت) نامعتبره" }, 400);
  }

  const caption = text ? `${username}\n\n${text}` : username;
  let type = "text";
  let result;
  let audioCoverFileId = null;
  let drawingFileId = null;

  try {
    if (hasPreUploaded) {
      // فایل قبلاً (به‌صورت چانکی) به تلگرام فرستاده شده؛ همون fileId/messageId رو مستقیم استفاده می‌کنیم
      type = preUploadedFileType === "image" ? "photo" : preUploadedFileType === "video" ? "video" : "audio";
      result = { message_id: preUploadedMessageId };
      // چون اون‌موقع (حینِ آپلودِ چانکی) کپشن فرستاده نشده بود، الان که متنِ پست معلومه، رویِ همون
      // پیامِ ازقبل‌فرستاده‌شده می‌ذاریمش؛ اگه شکست بخوره، جلویِ ثبتِ پست رو نمی‌گیریم (فقط لاگ می‌شه).
      // باتِ درست (همونی که خودِ فایل رو فرستاده) رو از پیشوندِ preUploadedFileId می‌خونیم، چون
      // ویرایشِ کپشن فقط با همون باتی که پیام رو فرستاده کار می‌کنه.
      const preUploadedSlot = untagFileId(preUploadedFileId).slot;
      if (preUploadedMessageId) {
        try {
          await editTelegramCaption(env, env.CHANNEL_ID, preUploadedMessageId, caption, preUploadedSlot);
        } catch (captionErr) {
          console.error("خطای افزودنِ کپشن به پستِ ازقبل‌آپلودشده:", captionErr.message);
        }
      }
      if (type === "audio" && hasAudioCover && (await verifyFileMatchesCategory(audioCoverFile, "image"))) {
        try {
          const coverResult = await sendTelegramFile(env, "sendPhoto", "photo", audioCoverFile, `کاور — ${username}`);
          audioCoverFileId = extractFileId("photo", coverResult);
        } catch (photoErr) {
          try {
            const coverDocResult = await sendTelegramFile(env, "sendDocument", "document", audioCoverFile, `کاور — ${username}`);
            audioCoverFileId = extractFileId("document", coverDocResult);
          } catch (docErr) {
            console.error("خطای آپلود کاور آهنگ (هم به‌شکل عکس هم سند شکست خورد):", photoErr.message, "|", docErr.message);
          }
        }
      }
    } else if (hasFile && file.type.startsWith("image/")) {
      type = "photo";
      result = await sendTelegramFile(env, "sendPhoto", "photo", file, caption);
    } else if (hasFile && file.type.startsWith("video/")) {
      type = "video";
      result = await sendTelegramFile(env, "sendVideo", "video", file, caption);
    } else if (hasFile && file.type.startsWith("audio/")) {
      type = "audio";
      // اگه از خود فایل (تگ ID3) عنوان/خواننده واقعی استخراج شده، همونا رو صریح می‌فرستیم
      // وگرنه تلگرام خودش سعی می‌کنه از تگ ID3 فایل استخراج کنه
      result = await sendTelegramFile(env, "sendAudio", "audio", file, caption, {
        title: clientAudioTitle,
        performer: clientAudioPerformer,
      });
      // کاور واقعی استخراج‌شده از تگ ID3 رو جدا آپلود می‌کنیم تا مطمئن باشیم عکس واقعی خود آهنگه
      if (hasAudioCover && (await verifyFileMatchesCategory(audioCoverFile, "image"))) {
        try {
          const coverResult = await sendTelegramFile(env, "sendPhoto", "photo", audioCoverFile, `کاور — ${username}`);
          audioCoverFileId = extractFileId("photo", coverResult);
        } catch (photoErr) {
          // بعضی کاورها رو تلگرام به‌عنوان «عکس» قبول نمی‌کنه (مثلاً JPEG با پروفایل رنگی CMYK یا ابعاد نامتعارف
          // که تو کاورهای MP3 زیاد پیش میاد). به‌جای از دست دادن کاور، همون فایل رو به‌عنوان سند می‌فرستیم؛
          // چون موقع نمایش فقط بایت‌های خام فایل رو با تگ <img> نشون می‌دیم، فرقی نداره تلگرام داخلی
          // اسمش رو «عکس» گذاشته باشه یا «سند»
          try {
            const coverDocResult = await sendTelegramFile(env, "sendDocument", "document", audioCoverFile, `کاور — ${username}`);
            audioCoverFileId = extractFileId("document", coverDocResult);
          } catch (docErr) {
            console.error("خطای آپلود کاور آهنگ (هم به‌شکل عکس هم سند شکست خورد):", photoErr.message, "|", docErr.message);
          }
        }
      }
    } else {
      type = "text";
      result = await sendTelegramText(env, caption);
    }
    // نقاشیِ متن: فقط وقتی پست واقعاً «متن»ه (نه عکس/ویدیو/آهنگ) و بدونِ preUploaded — جدا از خودِ
    // پیامِ متنی، به‌عنوانِ یه عکس به تلگرام فرستاده می‌شه و فقط file_id ش نگه داشته می‌شه
    if (type === "text" && hasDrawing && (await verifyFileMatchesCategory(drawingFile, "image"))) {
      try {
        const drawingResult = await sendTelegramFile(env, "sendPhoto", "photo", drawingFile, `نقاشی — ${username}`);
        drawingFileId = extractFileId("photo", drawingResult);
      } catch (drawingErr) {
        console.error("خطای آپلود نقاشیِ متن:", drawingErr.message);
      }
    }
  } catch (err) {
    console.error("خطای ارسال پست به تلگرام:", err);
    return json({ error: "ارسال پست ناموفق بود، دوباره امتحان کن" }, 502);
  }

  if (serveFood) {
    const foodFileId = hasPreUploaded ? preUploadedFileId : extractFileId(type, result);
    const foodId = `${Date.now()}_${randomHex(4)}`;
    await env.D1.prepare(
      `INSERT INTO restaurant_items (id, chef_username, file_id, title, description, price_points, created_at, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
    )
      .bind(foodId, username, foodFileId, title || "بدون‌نام", foodDescription || null, foodPrice, Date.now())
      .run();
    return json({ ok: true, restaurantItemId: foodId });
  }

  const id = `${Date.now()}_${randomHex(4)}`;
  // اینکه کدوم بات این پست رو فرستاده (برایِ حذفِ بعدیِ پیام از تلگرام لازممون می‌شه؛ ویرایشِ کپشن
  // که بالاتر انجام شد، قبلاً خودش از preUploadedSlot استفاده کرد)
  const postBotSlot = hasPreUploaded ? untagFileId(preUploadedFileId).slot : (result.__slot || 1);
  const post = {
    id,
    username,
    text,
    title: title || null,
    type,
    file_id: hasPreUploaded ? preUploadedFileId : extractFileId(type, result),
    message_id: result.message_id || 0,
    bot_slot: postBotSlot,
    date: Date.now(),
    audio_title: null,
    audio_performer: null,
    audio_thumb: null,
    audio_feeling: null,
    video_thumb: null,
    tags: tagsJson,
    radio_visual: clientRadioVisual && (type === "photo" || type === "video") ? 1 : 0,
    drawing_file_id: drawingFileId,
  };
  // نکته: قبلاً این شرط `result.audio &&` هم داشت که فقط وقتی صدق می‌کرد که خودِ handlePost مستقیم
  // فایل رو به تلگرام فرستاده باشه؛ برای مسیرِ آپلودِ چانکی (hasPreUploaded) چون فایل قبلاً (توی
  // مرحله‌ی /api/upload/complete) فرستاده شده، result.audio اینجا وجود نداره و همه‌ی اطلاعاتِ
  // آهنگ (عنوان/خواننده/کاور/حس) گم می‌شد؛ حالا فقط به نوعِ پست وابسته‌ست و از مقادیرِ کلاینت/کاورِ
  // همین‌جا‌آپلودشده استفاده می‌کنه که برای هر دو مسیر معتبره.
  if (type === "audio") {
    post.audio_title = clientAudioTitle || (result.audio && result.audio.title) || null;
    post.audio_performer = clientAudioPerformer || (result.audio && result.audio.performer) || null;
    post.audio_thumb = audioCoverFileId || tagFileId(result.audio && result.audio.thumb && result.audio.thumb.file_id, result.__slot) || null;
    post.audio_feeling = clientAudioFeeling || null; // «حس من»: فقط تزیینیه، تو پخش تمام‌صفحه نشون داده می‌شه
    post.duration_seconds = clientAudioDuration;
  }
  if (type === "video" && result.video) {
    // تلگرام خودش موقع آپلود ویدیو یه فریم رو به‌عنوان تامبنیل می‌سازه؛ همون رو ذخیره می‌کنیم
    // تا موقع نمایش پست، قبل از اینکه خودِ ویدیو لود بشه، به‌جای صفحه‌ی سیاه یه عکس نشون بدیم
    const thumb = result.video.thumb || result.video.thumbnail || null;
    post.video_thumb = tagFileId(thumb && thumb.file_id, result.__slot) || null;
  }

  try {
    await bind(
      env.D1.prepare(
        `INSERT INTO posts (id, username, text, title, type, file_id, message_id, bot_slot, date, upvotes, downvotes, likes, audio_title, audio_performer, audio_thumb, audio_feeling, video_thumb, tags, duration_seconds, radio_visual, drawing_file_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
      [post.id, post.username, post.text, post.title, post.type, post.file_id, post.message_id, post.bot_slot, post.date, post.audio_title, post.audio_performer, post.audio_thumb, post.audio_feeling, post.video_thumb, post.tags, post.duration_seconds || null, post.radio_visual, post.drawing_file_id]
    ).run();
  } catch (err) {
    // اگه اینجا خطا بخوره (مثلاً یه مقدارِ نامعتبر برایِ D1)، قبلاً بدونِ گرفتنش می‌رفت به handlerِ
    // سراسری و فقط «خطای داخلی سرور» نشون می‌داد؛ حالا لاگِ دقیق‌تری می‌گیریم که تو داشبوردِ
    // Cloudflare (تبِ Logs) قابلِ دیدنه
    console.error("خطای ذخیره‌ی پست در D1:", err, JSON.stringify(post));
    return json({ error: "ذخیره‌ی پست روی سرور ناموفق بود، دوباره امتحان کن" }, 500);
  }

  return json({ ok: true, post });
}

// #endregion
// #region پروکسی گرفتن فایل از تلگرام (بدون افشای توکن)
// ---------- پروکسی گرفتن فایل از تلگرام (بدون افشای توکن) ----------
// #endregion
// #region رادیوی زنده (پخشِ همگام برای همه‌ی کاربرا، بدونِ نیاز به سرورِ استریمینگِ واقعی)
// ---------- رادیوی زنده ----------
// چون Cloudflare Worker نمی‌تونه یه پخشِ پیوسته و زنده نگه داره (هر درخواست جدا و کوتاه‌مدته)،
// به‌جاش زمان‌بندی رو محاسبه می‌کنیم: یه چیدمانِ ثابت و قطعی (deterministic) از همه‌ی آهنگ‌ها
// می‌سازیم (seed اون، تاریخِ امروزِ تهرانه — یعنی هر روز یه چیدمانِ تازه، ولی همه‌ی کاربرا دقیقاً
// همون چیدمان رو حساب می‌کنن، بدونِ نیاز به ذخیره‌ی چیزی جایی). بعد با «الان چند ثانیه از نیمه‌شبِ
// تهران گذشته، مودِ کل‌طولِ پلی‌لیست» دقیقاً مشخص می‌کنیم الان کدوم آهنگ و از کدوم ثانیه‌ش باید
// پخش بشه — همه‌ی کاربرا همین محاسبه رو می‌کنن، پس همه هم‌زمان دقیقاً یه چیز می‌شنون.
const RADIO_FALLBACK_DURATION_SECONDS = 180; // برای آهنگ‌های قدیمی‌تر که duration_seconds ندارن
const TEHRAN_UTC_OFFSET_SECONDS = 3.5 * 3600; // ایران دیگه ساعتِ تابستانی نداره؛ آفستِ ثابت +۰۳:۳۰

// PRNG سبک و قطعی (mulberry32)؛ با یه seed ثابت همیشه دقیقاً همون دنباله‌ی اعداد رو می‌ده
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// جابه‌جاییِ فیشر-یتس با یه PRNG قطعی؛ همون seed = همیشه همون خروجی
function seededShuffle(array, seed) {
  const rng = mulberry32(seed);
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- موتورِ زمان‌بندیِ رادیو (state-machine واقعی) ----------
// قبلاً این بخش کاملاً بی‌حافظه بود (فقط از رویِ ساعتِ دیواری حساب می‌شد) چون صف واقعی‌ای وجود
// نداشت. الان که صفِ ویس داینامیکه (هر لحظه ممکنه یکی چیزی بفرسته)، دیگه نمی‌شه فقط با فرمول
// حساب کرد؛ یه ردیفِ singleton تو جدولِ radio_state وضعیتِ فعلی (چه‌قسمتیه: آهنگ/ویس/مکث، از کِی
// شروع شده، چقدر طول می‌کشه) رو نگه می‌داره و هر درخواست، تنبلانه (lazy) اونقدر جلو می‌برتش تا به
// «الان» برسه — یعنی هیچ کرون/تایمرِ جدا لازم نیست، خودِ درخواست‌های کاربرا موتور رو می‌چرخونن.
//
// توالیِ هر قسمت: آهنگ → (اگه صفِ ویس چیزی داشت) ویسِ جلوترینِ صف → مکثِ کوتاه → آهنگِ بعدی → ...
// اگه صف خالی بود، مستقیم از آهنگ به آهنگِ بعدی می‌ره (بدونِ ویس/مکثِ اضافه).
//
// نکته‌ی migration: قبل از دیپلوی این نسخه، این دو جدول رو یه‌بار تو کنسولِ D1 (داشبوردِ کلادفلر) اجرا کن:
//
//   CREATE TABLE radio_voice_queue (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     username TEXT NOT NULL,
//     file_id TEXT NOT NULL,
//     bot_slot INTEGER NOT NULL DEFAULT 1,
//     duration_seconds INTEGER NOT NULL,
//     status TEXT NOT NULL DEFAULT 'pending',
//     created_at INTEGER NOT NULL,
//     played_at INTEGER
//   );
//   CREATE INDEX idx_radio_voice_queue_status ON radio_voice_queue(status, created_at);
//
//   CREATE TABLE radio_state (
//     id INTEGER PRIMARY KEY,
//     segment_type TEXT NOT NULL,
//     segment_start_ms INTEGER NOT NULL,
//     segment_duration_seconds INTEGER NOT NULL,
//     order_seed INTEGER NOT NULL,
//     order_length INTEGER NOT NULL,
//     song_cursor INTEGER NOT NULL DEFAULT 0,
//     current_song_post_id TEXT,
//     current_voice_id INTEGER
//   );

const RADIO_VOICE_PAUSE_SECONDS = 3; // مکثِ کوتاه بینِ پایانِ ویس و شروعِ آهنگِ بعدی
const RADIO_VOICE_MAX_SECONDS = 20;

async function getRadioTracks(env) {
  const rows = await env.D1.prepare(
    "SELECT id, username, file_id, audio_title, audio_performer, audio_thumb, duration_seconds FROM posts WHERE type = 'audio' ORDER BY id ASC"
  ).all();
  return rows.results || [];
}

function trackDurationSeconds(t) {
  return Number.isFinite(t.duration_seconds) && t.duration_seconds > 0 ? t.duration_seconds : RADIO_FALLBACK_DURATION_SECONDS;
}

async function pickPendingVoice(env) {
  return env.D1.prepare(
    "SELECT id, username, file_id, duration_seconds FROM radio_voice_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1"
  ).first();
}

async function loadRadioState(env) {
  return env.D1.prepare("SELECT * FROM radio_state WHERE id = 1").first();
}

async function bootstrapRadioState(env, tracks, nowMs) {
  const seed = Math.floor(Math.random() * 2 ** 31);
  const order = seededShuffle(tracks, seed);
  const first = order[0];
  const state = {
    segment_type: "song",
    segment_start_ms: nowMs,
    segment_duration_seconds: trackDurationSeconds(first),
    order_seed: seed,
    order_length: order.length,
    song_cursor: 0,
    current_song_post_id: first.id,
    current_voice_id: null,
  };
  await env.D1.prepare(
    `INSERT INTO radio_state (id, segment_type, segment_start_ms, segment_duration_seconds, order_seed, order_length, song_cursor, current_song_post_id, current_voice_id)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET segment_type=excluded.segment_type, segment_start_ms=excluded.segment_start_ms,
       segment_duration_seconds=excluded.segment_duration_seconds, order_seed=excluded.order_seed, order_length=excluded.order_length,
       song_cursor=excluded.song_cursor, current_song_post_id=excluded.current_song_post_id, current_voice_id=excluded.current_voice_id`
  ).bind(state.segment_type, state.segment_start_ms, state.segment_duration_seconds, state.order_seed, state.order_length, state.song_cursor, state.current_song_post_id, state.current_voice_id).run();
  return state;
}

// یه قدم جلو می‌ره: قسمتِ فعلی (که تازه تموم شده) رو می‌بنده و قسمتِ بعدی رو می‌سازه. چیزی رو خودش
// ذخیره نمی‌کنه (فراخوان مسئولِ persist‌کردنه)، چون ممکنه لازم باشه چند قدم پشتِ‌سرِهم جلو بریم.
async function advanceRadioSegment(env, tracks, state, segEndMs) {
  if (state.segment_type === "song") {
    const voice = await pickPendingVoice(env);
    if (voice) {
      return {
        segment_type: "voice",
        segment_start_ms: segEndMs,
        segment_duration_seconds: Math.min(RADIO_VOICE_MAX_SECONDS, voice.duration_seconds || RADIO_VOICE_MAX_SECONDS),
        order_seed: state.order_seed,
        order_length: state.order_length,
        song_cursor: state.song_cursor,
        current_song_post_id: state.current_song_post_id,
        current_voice_id: voice.id,
      };
    }
    return nextSongSegment(tracks, state, segEndMs);
  }
  if (state.segment_type === "voice") {
    if (state.current_voice_id) {
      await env.D1.prepare("UPDATE radio_voice_queue SET status = 'played', played_at = ? WHERE id = ? AND status = 'pending'")
        .bind(segEndMs, state.current_voice_id)
        .run();
    }
    return {
      segment_type: "pause",
      segment_start_ms: segEndMs,
      segment_duration_seconds: RADIO_VOICE_PAUSE_SECONDS,
      order_seed: state.order_seed,
      order_length: state.order_length,
      song_cursor: state.song_cursor,
      current_song_post_id: state.current_song_post_id,
      current_voice_id: null,
    };
  }
  // pause -> آهنگِ بعدی
  return nextSongSegment(tracks, state, segEndMs);
}

// آهنگِ بعدیِ چیدمان رو برمی‌گردونه (بدونِ هیچ فچِ دیتابیسی؛ فقط رویِ آرایه‌ی tracksِ همین درخواست کار می‌کنه)
function nextSongSegment(tracks, state, segEndMs) {
  let nextCursor = state.song_cursor + 1;
  let seed = state.order_seed;
  let order = seededShuffle(tracks, seed);
  if (nextCursor >= order.length) {
    // یه دور کامل تموم شد؛ دوباره قاطی می‌کنیم (seedِ جدید) — این‌جوری آهنگ‌های تازه‌آپلودشده هم
    // از دورِ بعد وارد چرخش می‌شن و چیدمان هر دور با دورِ قبل فرق می‌کنه
    seed = Math.floor(Math.random() * 2 ** 31);
    order = seededShuffle(tracks, seed);
    nextCursor = 0;
  }
  const next = order[nextCursor] || order[0];
  return {
    segment_type: "song",
    segment_start_ms: segEndMs,
    segment_duration_seconds: trackDurationSeconds(next),
    order_seed: seed,
    order_length: order.length,
    song_cursor: nextCursor,
    current_song_post_id: next.id,
    current_voice_id: null,
  };
}

// اگه وقفه خیلی طولانی باشه (سرور مدت‌ها هیچ درخواستی نداشته)، جلوبردنِ state قدم‌به‌قدم با یه
// کوئریِ D1 برای هر قدم (توی advanceRadioSegment) هم به سقفِ subrequestِ ورکر می‌خوره هم کاربر رو
// دقیقه‌ها تو یه حلقه‌ی «آهنگ رد شد، یکی دیگه اومد، اونم رد شد» نگه می‌داره (چون remainingSeconds
// همیشه رویِ کفِ ۱ ثانیه گیر می‌کنه تا کاملاً catch-up بشه). برای این حالت، یه جهشِ سریعِ کاملاً
// تو-حافظه داریم: صفِ ویسِ معلق (که مالِ گذشته‌ی خیلی دوره و دیگه معنی نداره پخش بشه) رو یه‌بار
// منقضی می‌کنیم، بعد فقط با آرایه‌ی از قبل‌خونده‌شده‌ی tracks (بدونِ هیچ کوئریِ اضافه) جلو می‌ریم.
function fastForwardSongOnly(tracks, state, targetMs) {
  let segStart = state.segment_start_ms;
  let segDur = state.segment_duration_seconds;
  let seed = state.order_seed;
  let order = seededShuffle(tracks, seed);
  let cursor = state.song_cursor;
  let guard = 0;
  while (segStart + segDur * 1000 <= targetMs && guard < 200000) {
    segStart += segDur * 1000;
    cursor += 1;
    if (cursor >= order.length) {
      seed = Math.floor(Math.random() * 2 ** 31);
      order = seededShuffle(tracks, seed);
      cursor = 0;
    }
    const next = order[cursor] || order[0];
    segDur = trackDurationSeconds(next);
    guard++;
  }
  const finalTrack = order[cursor] || order[0];
  return {
    segment_type: "song",
    segment_start_ms: segStart,
    segment_duration_seconds: segDur,
    order_seed: seed,
    order_length: order.length,
    song_cursor: cursor,
    current_song_post_id: finalTrack.id,
    current_voice_id: null,
  };
}

async function persistRadioState(env, prevStartMs, state) {
  // optimistic concurrency: فقط اگه از وقتی این درخواست state رو خونده، کسِ دیگه‌ای زودتر جلوش
  // نبرده باشه (segment_start_ms هنوز همونیه که خوندیم) آپدیت می‌کنیم. اگه یه درخواستِ هم‌زمانِ
  // دیگه زودتر برده باشدش، همین یه‌بار می‌بازیم — بدونِ فاجعه، دفعه‌ی بعد state تازه رو می‌خونیم.
  const res = await env.D1.prepare(
    `UPDATE radio_state SET segment_type=?, segment_start_ms=?, segment_duration_seconds=?, order_seed=?, order_length=?, song_cursor=?, current_song_post_id=?, current_voice_id=?
     WHERE id = 1 AND segment_start_ms = ?`
  )
    .bind(
      state.segment_type, state.segment_start_ms, state.segment_duration_seconds, state.order_seed,
      state.order_length, state.song_cursor, state.current_song_post_id, state.current_voice_id, prevStartMs
    )
    .run();
  return !!(res.meta && res.meta.changes > 0);
}

async function handleRadioNow(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const tracks = await getRadioTracks(env);
  if (tracks.length === 0) {
    return json({ error: "هنوز هیچ آهنگی برای رادیو موجود نیست" }, 404);
  }

  const nowMs = Date.now();
  let state = await loadRadioState(env);
  if (!state) state = await bootstrapRadioState(env, tracks, nowMs);

  // اگه قسمتِ فعلی تموم شده، جلو می‌بریمش. برای وقفه‌های کوتاه (چند قسمت) مثلِ قبل قدم‌به‌قدم و با
  // چکِ واقعیِ صفِ ویس جلو می‌ریم. ولی اگه سرور مدتِ طولانی‌ای (بیشتر از ۱۰ دقیقه) هیچ درخواستی
  // نداشته، به‌جای صدها قدمِ پشتِ‌سرِهم (که هم به سقفِ subrequestِ ورکر می‌خورد هم چندین‌بار پشتِ‌سرِهم
  // به کاربر «آهنگ عوض شد» نشون می‌داد بدونِ اینکه واقعاً چیزی پخش بشه)، یه جهشِ سریعِ تو-حافظه می‌زنیم.
  const RADIO_FAST_FORWARD_THRESHOLD_MS = 10 * 60 * 1000;
  const RADIO_VOICE_EXPIRE_MS = 10 * 60 * 1000;
  const startedAtMs = state.segment_start_ms;
  const deficitMs = nowMs - (state.segment_start_ms + state.segment_duration_seconds * 1000);

  if (deficitMs > RADIO_FAST_FORWARD_THRESHOLD_MS) {
    // ویس‌های معلقِ خیلی قدیمی (مالِ قبلِ این وقفه‌ی طولانی) دیگه معنی نداره الان پخش بشن؛ منقضی‌شون کن
    await env.D1.prepare(
      "UPDATE radio_voice_queue SET status = 'expired' WHERE status = 'pending' AND created_at < ?"
    ).bind(nowMs - RADIO_VOICE_EXPIRE_MS).run();
    if (state.segment_type !== "song") {
      // اگه دقیقاً وسطِ ویس/مکث گیر کرده بودیم، اول یه قدمِ معمولی تا برسیم به یه «آهنگ»، بعد جهشِ سریع
      const segEnd = state.segment_start_ms + state.segment_duration_seconds * 1000;
      state = await advanceRadioSegment(env, tracks, state, segEnd);
    }
    state = fastForwardSongOnly(tracks, state, nowMs);
    const persisted = await persistRadioState(env, startedAtMs, state);
    if (!persisted) {
      const fresh = await loadRadioState(env);
      if (fresh) state = fresh;
    }
  } else {
    let steps = 0;
    while (nowMs >= state.segment_start_ms + state.segment_duration_seconds * 1000 && steps < 20) {
      const segEnd = state.segment_start_ms + state.segment_duration_seconds * 1000;
      state = await advanceRadioSegment(env, tracks, state, segEnd);
      steps++;
    }
    if (steps > 0) {
      const persisted = await persistRadioState(env, startedAtMs, state);
      if (!persisted) {
        const fresh = await loadRadioState(env);
        if (fresh) state = fresh;
      }
    }
  }

  const offsetInSegment = Math.max(0, (nowMs - state.segment_start_ms) / 1000);
  const remainingSeconds = Math.max(1, state.segment_duration_seconds - offsetInSegment);

  let current;
  if (state.segment_type === "voice") {
    const voice = await env.D1.prepare("SELECT id, username, file_id FROM radio_voice_queue WHERE id = ?").bind(state.current_voice_id).first();
    if (voice) {
      const senderProfile = await env.D1.prepare("SELECT avatar_file_id FROM profiles WHERE username = ?").bind(voice.username).first();
      current = {
        segmentType: "voice",
        voiceId: voice.id,
        username: voice.username,
        avatarFileId: (senderProfile && senderProfile.avatar_file_id) || null,
        fileId: voice.file_id,
        startMs: state.segment_start_ms,
        offsetSeconds: Math.floor(offsetInSegment),
        durationSeconds: state.segment_duration_seconds,
        remainingSeconds: Math.ceil(remainingSeconds),
      };
    } else {
      // ویس یهو حذف شده (خیلی نادر)؛ به‌جای خطا دادن، همین لحظه رو مثلِ یه مکثِ کوتاه نشون می‌دیم
      current = { segmentType: "pause", startMs: state.segment_start_ms, offsetSeconds: 0, durationSeconds: RADIO_VOICE_PAUSE_SECONDS, remainingSeconds: RADIO_VOICE_PAUSE_SECONDS };
    }
  } else if (state.segment_type === "pause") {
    current = {
      segmentType: "pause",
      startMs: state.segment_start_ms,
      offsetSeconds: Math.floor(offsetInSegment),
      durationSeconds: state.segment_duration_seconds,
      remainingSeconds: Math.ceil(remainingSeconds),
    };
  } else {
    const song = tracks.find((t) => t.id === state.current_song_post_id) || tracks[0];
    const senderProfile = await env.D1.prepare("SELECT avatar_file_id FROM profiles WHERE username = ?").bind(song.username).first();
    current = {
      segmentType: "song",
      postId: song.id,
      username: song.username,
      avatarFileId: (senderProfile && senderProfile.avatar_file_id) || null,
      title: song.audio_title || "بدون‌نام",
      performer: song.audio_performer || "",
      fileId: song.file_id,
      thumbFileId: song.audio_thumb || null,
      startMs: state.segment_start_ms,
      offsetSeconds: Math.floor(offsetInSegment),
      durationSeconds: state.segment_duration_seconds,
      remainingSeconds: Math.ceil(remainingSeconds),
    };
  }

  // پیش‌نمایشِ «بعدی»: فقط وقتی قسمتِ فعلی آهنگه معنی‌دار حدس زده می‌شه — اگه صفِ ویس همین الان
  // چیزی داره، بعدی تقریباً قطعاً ویسه؛ وگرنه آهنگِ بعدیِ چیدمان (بدونِ persist کردن، فقط یه پیش‌بینی)
  let next = null;
  if (state.segment_type === "song") {
    const pendingVoice = await pickPendingVoice(env);
    if (pendingVoice) {
      next = { type: "voice" };
    } else {
      const peek = nextSongSegment(tracks, state, 0);
      const nextSong = tracks.find((t) => t.id === peek.current_song_post_id);
      next = { type: "song", title: (nextSong && nextSong.audio_title) || "بدون‌نام", performer: (nextSong && nextSong.audio_performer) || "" };
    }
  }

  const pendingCountRow = await env.D1.prepare("SELECT COUNT(*) AS cnt FROM radio_voice_queue WHERE status = 'pending'").first();

  return json({
    ok: true,
    serverTime: nowMs,
    current,
    next,
    queueLength: (pendingCountRow && pendingCountRow.cnt) || 0,
  });
}

// ---------- اصلاحِ عقب‌ماندگیِ duration برای آهنگ‌های قدیمی/مشکل‌دار ----------
// قبل از این‌که audio_duration درست فرستاده بشه، duration_seconds برای همه‌ی آهنگ‌های قدیمی
// null بود (و رادیو از مقدارِ پیش‌فرضِ ۱۸۰ ثانیه استفاده می‌کرد). این دو اندپوینت به ادمین اجازه
// می‌ده از تویِ خودِ مرورگر (که واقعاً می‌تونه فایل رو دیکد کنه و طولِ واقعیش رو بفهمه — چیزی که
// خودِ ورکر توانایی‌شو نداره) این عددا رو یکی‌یکی درست کنه.
async function handleRadioDurationsMissing(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username || !(await isAdminUser(env, username))) return json({ error: "دسترسی نداری" }, 403);

  const rows = await env.D1.prepare(
    "SELECT id, file_id, audio_title FROM posts WHERE type = 'audio' AND (duration_seconds IS NULL OR duration_seconds <= 0) ORDER BY id ASC LIMIT 25"
  ).all();
  return json({ ok: true, items: (rows.results || []).map((r) => ({ postId: r.id, fileId: r.file_id, title: r.audio_title || "بدون‌نام" })) });
}

async function handleRadioDurationsFix(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username || !(await isAdminUser(env, username))) return json({ error: "دسترسی نداری" }, 403);

  const body = await request.json().catch(() => ({}));
  const postId = body.postId;
  const duration = Number(body.duration);
  // آهنگ‌ها عملاً هیچ‌وقت کوتاه‌تر از ۱۰ ثانیه نیستن؛ این سد جلوی نوشتنِ دوباره‌ی یه مقدارِ ناقص/خراب رو می‌گیره
  if (!postId || !Number.isFinite(duration) || duration < 10) {
    return json({ error: "ورودی نامعتبره" }, 400);
  }
  await env.D1.prepare("UPDATE posts SET duration_seconds = ? WHERE id = ? AND type = 'audio'")
    .bind(Math.round(duration), postId)
    .run();
  return json({ ok: true });
}
async function handleRadioVoiceSubmit(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  if (!(await checkRateLimit(env, "radio_voice", username, 3, 600))) {
    return json({ error: "زیاد ویس فرستادی، چند دقیقه دیگه امتحان کن" }, 429);
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string" || file.size === 0) {
    return json({ error: "ویسی دریافت نشد" }, 400);
  }
  if (file.size > 3 * 1024 * 1024) {
    return json({ error: "حجمِ ویس بیش از حدِ مجازه" }, 400);
  }
  if (!/^audio\//.test(file.type)) {
    return json({ error: "فقط فایلِ صوتی قابلِ ارسال به صفِ رادیوعه" }, 400);
  }

  const durationRaw = Number(form.get("duration"));
  const duration = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.min(RADIO_VOICE_MAX_SECONDS, Math.round(durationRaw)) : null;
  if (!duration) return json({ error: "مدت‌زمانِ ویس نامعتبره" }, 400);

  let result;
  try {
    result = await sendTelegramFile(env, "sendVoice", "voice", file, `ویسِ رادیو — ${username}`);
  } catch (err) {
    console.error("خطای ارسالِ ویسِ رادیو به تلگرام:", err);
    return json({ error: "ارسالِ ویس ناموفق بود، دوباره امتحان کن" }, 502);
  }

  const fileId = extractFileId("voice", result);
  if (!fileId) return json({ error: "دریافتِ شناسه‌ی فایل ناموفق بود" }, 502);

  const createdAt = Date.now();
  await env.D1.prepare(
    "INSERT INTO radio_voice_queue (username, file_id, bot_slot, duration_seconds, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)"
  )
    .bind(username, fileId, result.__slot || 1, duration, createdAt)
    .run();

  const positionRow = await env.D1.prepare(
    "SELECT COUNT(*) AS cnt FROM radio_voice_queue WHERE status = 'pending' AND created_at <= ?"
  )
    .bind(createdAt)
    .first();

  return json({ ok: true, position: (positionRow && positionRow.cnt) || 1 });
}

// موقعیتِ فعلیِ کاربر تو صفِ ویس (اگه چیزی تو صف داره)؛ برای اینکه بعد از رفرش/بازکردنِ دوباره‌ی
// صفحه هم بتونه ببینه نفرِ چندمه، نه فقط لحظه‌ی ارسال
async function handleRadioVoiceMine(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const row = await env.D1.prepare(
    "SELECT id, created_at FROM radio_voice_queue WHERE username = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 1"
  )
    .bind(username)
    .first();
  if (!row) return json({ ok: true, pending: null });

  const positionRow = await env.D1.prepare(
    "SELECT COUNT(*) AS cnt FROM radio_voice_queue WHERE status = 'pending' AND created_at <= ?"
  )
    .bind(row.created_at)
    .first();

  return json({ ok: true, pending: { position: (positionRow && positionRow.cnt) || 1 } });
}

// ---------- پروکسیِ عمومیِ «فایل از یه پوشه‌ی گیت‌هاب» — با کشِ edge، بدونِ تماسِ مستقیمِ مرورگر با گیت‌هاب/jsDelivr ----------
// چرا؟ اگه مرورگرِ کاربر مستقیم به api.github.com یا jsDelivr/raw.githubusercontent.com وصل بشه،
// این‌ها دامنه‌های خارجی‌ان و ممکنه از ایران کند/ناپایدار باشن. به‌جاش خودِ ورکر (که از شبکه‌ی
// داخلیِ کلادفلر به گیت‌هاب وصل می‌شه، نه از ایران) لیست و فایل‌ها رو می‌گیره و رو edge کش می‌کنه.
// این تابعِ عمومیه؛ هم برای مدیای اسپلشِ لاگین استفاده می‌شه، هم برای صدای بین‌آهنگیِ رادیو.
async function fetchGithubFolderList(repo, branch, folder, extRegex, cacheNamespace, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(`https://${cacheNamespace}-list.internal/list`, { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const apiUrl = `https://api.github.com/repos/${repo}/contents/${folder}?ref=${branch}`;
  const res = await fetch(apiUrl, { headers: { "User-Agent": "dehaat-worker", Accept: "application/vnd.github+json" } });
  if (!res.ok) return json({ error: "لیست فایل‌ها گرفته نشد" }, 502);
  const files = await res.json();

  const names = (Array.isArray(files) ? files : [])
    .filter((f) => f.type === "file" && extRegex.test(f.name))
    .map((f) => f.name);

  const response = json({ files: names });
  // کشِ ۱۰دقیقه‌ای رو edge؛ هم لیمیتِ نرخِ API گیت‌هاب اذیت نمی‌شه، هم فایلِ تازه‌آپلودشده خیلی دیر ظاهر نمی‌شه
  response.headers.set("Cache-Control", "public, max-age=600");
  if (ctx) ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function fetchGithubFolderFile(repo, branch, folder, name, allowedExtRegex, defaultContentType, cacheNamespace, request, ctx) {
  // فقط اسمِ فایلِ ساده (بدون اسلش/دات‌دات) و فقط پسوندهای مجاز قبول می‌شن — جلوی path traversal رو می‌گیره
  if (!name || !allowedExtRegex.test(name) || name.includes("..") || name.includes("/")) {
    return json({ error: "نام فایل نامعتبره" }, 400);
  }

  const rangeHeader = request ? request.headers.get("Range") : null;
  const cache = caches.default;
  const cacheKey = new Request(`https://${cacheNamespace}-file.internal/${encodeURIComponent(name)}`, { method: "GET" });

  // فقط جواب‌های کامل (بدون Range) کش می‌شن؛ Range (سیک‌کردنِ ویدیو/صدا) همیشه زنده گرفته می‌شه
  if (!rangeHeader) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const sourceUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${folder ? folder + "/" : ""}${encodeURIComponent(name)}`;
  const sourceHeaders = {};
  if (rangeHeader) sourceHeaders["Range"] = rangeHeader;

  const fileRes = await fetch(sourceUrl, { headers: sourceHeaders });
  if (!fileRes.ok && fileRes.status !== 206) return json({ error: "فایل پیدا نشد" }, 404);

  const headers = new Headers();
  headers.set("Content-Type", fileRes.headers.get("Content-Type") || defaultContentType);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("Accept-Ranges", "bytes");
  const contentLength = fileRes.headers.get("Content-Length");
  if (contentLength) headers.set("Content-Length", contentLength);
  const contentRange = fileRes.headers.get("Content-Range");
  if (contentRange) headers.set("Content-Range", contentRange);

  const status = rangeHeader && fileRes.status === 206 ? 206 : 200;
  const response = new Response(fileRes.body, { status, headers });

  if (!rangeHeader && status === 200 && ctx) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  }
  return response;
}

// ---------- چرخشِ پس‌زمینه‌ی رادیونما (عکس/ویدیوهایی که «نمایش در رادیو دهات» تیک خوردن) ----------
// همون منطقِ رادیوی صوتی، ولی ساده‌تر: چون هر آیتم دقیقاً ۴۵ ثانیه می‌مونه (نه طولِ متغیر مثلِ
// آهنگ‌ها)، لازم نیست تجمعی جمع بزنیم؛ فقط تقسیمِ صحیح کافیه. سیدِ متفاوت از رادیوی صوتی (با یه
// افستِ ثابت) تا چیدمانِ تصویرها هم‌بسته با چیدمانِ آهنگ‌ها نباشه.
const RADIO_VISUAL_SLOT_SECONDS = 45;
const RADIO_VISUAL_SEED_OFFSET = 7331;

async function handleRadioVisualNow(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const rows = await env.D1.prepare(
    "SELECT id, file_id, type FROM posts WHERE radio_visual = 1 ORDER BY id ASC"
  ).all();
  const visuals = rows.results || [];
  if (visuals.length === 0) {
    return json({ error: "هنوز هیچ رسانه‌ای برای رادیونما تیک نخورده" }, 404);
  }

  const nowMs = Date.now();
  const tehranNowSeconds = Math.floor(nowMs / 1000) + TEHRAN_UTC_OFFSET_SECONDS;
  const secondsSinceTehranMidnight = tehranNowSeconds % 86400;
  const tehranDaySeed = Math.floor(tehranNowSeconds / 86400) + RADIO_VISUAL_SEED_OFFSET;

  const shuffled = seededShuffle(visuals, tehranDaySeed);
  const slotIndex = Math.floor(secondsSinceTehranMidnight / RADIO_VISUAL_SLOT_SECONDS) % shuffled.length;
  const secondsIntoSlot = secondsSinceTehranMidnight % RADIO_VISUAL_SLOT_SECONDS;
  const remainingSeconds = RADIO_VISUAL_SLOT_SECONDS - secondsIntoSlot;

  // با یه چیدمانِ ثابت، دو تا اسلاتِ پشتِ‌سرِهم عملاً هیچ‌وقت نباید یه آیتمِ تکراری بدن (چون shuffled
  // یه‌جایگشتِ بدونِ تکراره). ولی چون لیستِ رسانه‌های تیک‌خورده هر لحظه ممکنه عوض بشه (یکی تازه تیک زده/
  // برداشته)، «چیدمانِ ثابت» فقط تو یه درخواستِ واحد معتبره؛ اگه بینِ دو تا اسلاتِ متوالی این لیست عوض
  // بشه، این تضمین از بین می‌ره. برای اطمینان، صریحاً چک می‌کنیم و اگه تصادفاً با اسلاتِ قبلی یکی
  // دراومد، یکی جلوتر می‌ریم — این کارِ قطعیه (نه رندوم)، پس همه‌ی بیننده‌ها همچنان یه چیزِ یکسان می‌بینن.
  let effectiveIndex = slotIndex;
  if (shuffled.length > 1) {
    const prevIndex = (slotIndex - 1 + shuffled.length) % shuffled.length;
    if (shuffled[prevIndex].id === shuffled[effectiveIndex].id) {
      effectiveIndex = (effectiveIndex + 1) % shuffled.length;
    }
  }

  const current = shuffled[effectiveIndex];

  return json({
    ok: true,
    serverTime: nowMs,
    slotSeconds: RADIO_VISUAL_SLOT_SECONDS,
    remainingSeconds,
    current: {
      postId: current.id,
      fileId: current.file_id,
      type: current.type, // "photo" یا "video"
    },
  });
}


const SPLASH_MEDIA_REPO = "oldvasl/vasl";
const SPLASH_MEDIA_BRANCH = "main";
const SPLASH_MEDIA_FOLDER = "login";

async function handleSplashMediaList(env, ctx) {
  const cache = caches.default;
  const cacheKey = new Request("https://splash-media-list.internal/list", { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const apiUrl = `https://api.github.com/repos/${SPLASH_MEDIA_REPO}/contents/${SPLASH_MEDIA_FOLDER}?ref=${SPLASH_MEDIA_BRANCH}`;
  const res = await fetch(apiUrl, { headers: { "User-Agent": "dehaat-worker", Accept: "application/vnd.github+json" } });
  if (!res.ok) return json({ error: "لیست فایل‌های اسپلش گرفته نشد" }, 502);
  const files = await res.json();

  const videos = (Array.isArray(files) ? files : [])
    .filter((f) => f.type === "file" && /^[\w.\-]+\.mp4$/i.test(f.name))
    .map((f) => f.name);
  const audios = (Array.isArray(files) ? files : [])
    .filter((f) => f.type === "file" && /^[\w.\-]+\.mp3$/i.test(f.name))
    .map((f) => f.name);

  // کشِ ۱۰دقیقه‌ای رو edge؛ هم لیمیتِ نرخِ API گیت‌هاب اذیت نمی‌شه، هم فایلِ تازه‌آپلودشده خیلی دیر ظاهر نمی‌شه
  const response = json({ videos, audios });
  response.headers.set("Cache-Control", "public, max-age=600");
  if (ctx) ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function handleSplashMediaFile(name, request, env, ctx) {
  return fetchGithubFolderFile(
    SPLASH_MEDIA_REPO, SPLASH_MEDIA_BRANCH, SPLASH_MEDIA_FOLDER,
    name, /^[\w.\-]+\.(mp4|mp3)$/i, /\.mp3$/i.test(name || "") ? "audio/mpeg" : "video/mp4",
    "splash-media", request, ctx
  );
}

// ---------- صدای بینِ‌آهنگیِ رادیو (جینگل/ترنزیشن) ----------
// این ریپو/شاخه/پوشه رو با آدرسِ واقعیِ ریپوی «radio» که پرشون می‌کنی هماهنگ کن؛ فرض بر اینه که
// چندتا فایلِ mp3 مستقیم تو ریشه‌ی همون ریپو (یا هر پوشه‌ای که RADIO_JINGLE_FOLDER مشخص می‌کنه) هست.
const RADIO_JINGLE_REPO = "oldvasl/radio";
const RADIO_JINGLE_BRANCH = "main";
const RADIO_JINGLE_FOLDER = ""; // اگه فایل‌ها تو یه زیرپوشه‌ن، مثلاً "jingles"، همینو عوض کن

async function handleRadioJingleList(env, ctx) {
  return fetchGithubFolderList(RADIO_JINGLE_REPO, RADIO_JINGLE_BRANCH, RADIO_JINGLE_FOLDER, /^[\w.\-]+\.mp3$/i, "radio-jingle", ctx);
}
async function handleRadioJingleFile(name, request, env, ctx) {
  return fetchGithubFolderFile(RADIO_JINGLE_REPO, RADIO_JINGLE_BRANCH, RADIO_JINGLE_FOLDER, name, /^[\w.\-]+\.mp3$/i, "audio/mpeg", "radio-jingle", request, ctx);
}

// #endregion
// #region مدیای تلگرام (عکس/ویدیو/صدای پست‌ها و پیام‌ها) — پروکسی و کش‌شده روی خودِ ورکر
async function handleMedia(fileId, env, request, ctx) {
  if (!fileId) return json({ error: "شناسه فایل لازمه" }, 400);

  // اگه این فایل با باتِ دومی فرستاده شده بوده (پیشوندِ «2:» رویِ fileId)، باید دقیقاً با همون بات
  // از تلگرام بگیریمش؛ file_id بینِ بات‌ها قابل‌جابه‌جایی نیست. rawFileId (بدونِ پیشوند) همونیه که
  // باید تو URLهای getFile/کش استفاده بشه.
  const { id: rawFileId, slot: fileBotSlot } = untagFileId(fileId);
  const mediaBotToken = telegramTokenForSlot(env, fileBotSlot);

  // دهات کاملاً خصوصیه؛ فقط کاربر لاگین‌کرده می‌تونه مدیا رو ببینه. چون تگ‌های img/audio/video
  // نمی‌تونن هدر Authorization بفرستن، توکن از کوئری‌استرینگ (?token=) هم قبول می‌شه.
  const viewer = await getUserFromTokenOrQuery(request, env);
  if (!viewer) return json({ error: "ابتدا وارد شو" }, 401);

  // اگه مرورگر برای سیک‌کردنِ سیک‌بار، یه بازه‌ی خاص از بایت‌های فایل رو خواسته (هدر Range)،
  // عیناً همون بازه رو از تلگرام هم می‌خوایم — نه کل فایل رو از اول — تا فقط از همونجا دانلود/پخش بشه
  // و مرورگر مجبور نشه (چون جواب کامل ۲۰۰ گرفته، نه ۲۰۶ بخشی) دوباره از صفر شروع کنه
  const rangeHeader = request ? request.headers.get("Range") : null;

  // کش روی edge کلادفلر: فقط برای درخواست‌های کامل (بدون Range)، تا فایل‌های پرتکرار
  // (مثل عکس یه پست پرطرفدار) دیگه به ازای هر کاربر دوباره از تلگرام گرفته نشن.
  // درخواست‌های Range (برای سیک کردن داخل پخش صدا/ویدیو) از این کش رد می‌شن و همیشه مستقیم می‌رن سراغ تلگرام،
  // چون کش کردن یه تکه‌ی وسط فایل به‌جای کل فایل می‌تونه پخش رو خراب کنه.
  const cache = caches.default;
  const cacheKey = new Request(`https://media-cache.internal/${encodeURIComponent(fileId)}`, { method: "GET" });

  if (!rangeHeader) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const infoCacheKey = new Request(`https://media-filepath-cache.internal/${encodeURIComponent(fileId)}`, { method: "GET" });
  let filePath = null;
  const cachedInfo = await cache.match(infoCacheKey);
  if (cachedInfo) {
    filePath = await cachedInfo.text();
  } else {
    const infoRes = await fetch(`https://api.telegram.org/bot${mediaBotToken}/getFile?file_id=${rawFileId}`);
    const info = await infoRes.json();
    if (!info.ok) return json({ error: "فایل پیدا نشد" }, 404);
    filePath = info.result.file_path;
    // این مسیر برای این fileId عملاً ثابته؛ کش‌کردنش یعنی دفعاتِ بعدی (چه یه کاربرِ دیگه، چه
    // همین کاربر موقعِ سیک‌کردنِ صدا/ویدیو با درخواست‌های Range پی‌درپی) این رفت‌وبرگشتِ اول حذف بشه
    if (ctx) {
      ctx.waitUntil(
        cache.put(infoCacheKey, new Response(filePath, { headers: { "Cache-Control": "public, max-age=21600" } }))
      );
    }
  }

  const telegramReqHeaders = {};
  if (rangeHeader) telegramReqHeaders["Range"] = rangeHeader;

  let fileRes = await fetch(
    `https://api.telegram.org/file/bot${mediaBotToken}/${filePath}`,
    { headers: telegramReqHeaders }
  );

  // اگه مسیرِ کش‌شده منقضی/نامعتبر شده بود (خیلی نادر)، یه‌بار بدون کش دوباره تلاش کن
  if (!fileRes.ok && cachedInfo) {
    const freshInfoRes = await fetch(`https://api.telegram.org/bot${mediaBotToken}/getFile?file_id=${rawFileId}`);
    const freshInfo = await freshInfoRes.json();
    if (freshInfo.ok) {
      filePath = freshInfo.result.file_path;
      fileRes = await fetch(
        `https://api.telegram.org/file/bot${mediaBotToken}/${filePath}`,
        { headers: telegramReqHeaders }
      );
      if (ctx && fileRes.ok) {
        ctx.waitUntil(
          cache.put(infoCacheKey, new Response(filePath, { headers: { "Cache-Control": "public, max-age=21600" } }))
        );
      }
    }
  }
  if (!fileRes.ok) return json({ error: "فایل پیدا نشد" }, 404);

  const headers = new Headers();
  headers.set("Content-Type", fileRes.headers.get("Content-Type") || "application/octet-stream");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("Accept-Ranges", "bytes"); // به مرورگر می‌گیم می‌تونه هر بازه‌ای از فایل رو جدا بخواد (سیک واقعی)

  const contentLength = fileRes.headers.get("Content-Length");
  if (contentLength) headers.set("Content-Length", contentLength);
  const contentRange = fileRes.headers.get("Content-Range");
  if (contentRange) headers.set("Content-Range", contentRange);

  // اگه درخواست Range بوده و تلگرام هم بخشی (۲۰۶) جواب داده، همون استاتوس رو عیناً برمی‌گردونیم
  const status = rangeHeader && fileRes.status === 206 ? 206 : 200;
  const response = new Response(fileRes.body, { status, headers });

  // فقط جواب‌های کامل (۲۰۰، بدون Range) رو روی edge کش می‌کنیم؛ جواب‌های جزئی (۲۰۶) هیچ‌وقت کش نمی‌شن
  if (!rangeHeader && status === 200 && ctx) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  }

  return response;
}

const MAX_STICKERS_PER_USER = 10;

// #endregion
// #region سقف تعداد اعضای گروه چت (به‌جز خودِ سازنده)
const MAX_GROUP_MEMBERS = 50;

// #endregion
// #region آواتار گروه + کد عضویت گروه (نیازمندِ دو ستونِ جدید توی D1)
// ---------- آواتار گروه + کد عضویت گروه ----------
// جدول chat_conversations از قبل توی D1 وجود داره، فقط این دو ستون رو (یک‌بار، توی کنسول D1) اضافه کن:
//   ALTER TABLE chat_conversations ADD COLUMN avatar_file_id TEXT;
//   ALTER TABLE chat_conversations ADD COLUMN invite_code TEXT;
//   CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conversations_invite_code ON chat_conversations (invite_code);

// حروف/عددهای مشابه‌الشکل (0/O، 1/I/L) حذف شدن تا کد به چشم/دیکته اشتباه گرفته نشه
const INVITE_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateInviteCodeCandidate(length = 7) {
  let out = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) out += INVITE_CODE_CHARS[arr[i] % INVITE_CODE_CHARS.length];
  return out;
}

// چند بار تلاش می‌کنه تا یه کدِ یکتا (که هنوز توی جدول نیست) پیدا کنه
async function generateUniqueInviteCode(env) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = generateInviteCodeCandidate();
    const existing = await env.D1.prepare(
      "SELECT id FROM chat_conversations WHERE invite_code = ?"
    ).bind(candidate).first();
    if (!existing) return candidate;
  }
  // احتمالش عملاً صفره، ولی برای اطمینان یه کدِ طولانی‌تر و تصادفی‌تر برمی‌گردونیم
  return generateInviteCodeCandidate(10) + randomHex(2);
}

// #endregion
// #region سیستم کد معرف (ثبت‌نام فقط با کد معرفِ معتبر)
// ---------- سیستم کد معرف ----------
// این ستون‌ها/جدول باید یه‌بار دستی روی D1 اجرا بشن (مثل بقیه‌ی ALTER/CREATE های پروژه):
//   ALTER TABLE users ADD COLUMN can_refer INTEGER NOT NULL DEFAULT 0;
//   ALTER TABLE users ADD COLUMN referred_by TEXT;
//   ALTER TABLE users ADD COLUMN referral_success_count INTEGER NOT NULL DEFAULT 0;
//   ALTER TABLE users ADD COLUMN referral_cooldown_until INTEGER;
//   CREATE TABLE IF NOT EXISTS referral_codes (
//     code TEXT PRIMARY KEY,
//     owner_username TEXT NOT NULL,
//     used INTEGER NOT NULL DEFAULT 0,
//     used_by TEXT,
//     created_at INTEGER NOT NULL,
//     used_at INTEGER
//   );
//   CREATE INDEX IF NOT EXISTS idx_referral_codes_owner ON referral_codes(owner_username);
//
// ستون‌های اضافه‌ی زیر برای کدهای معرفِ شخصی‌سازی‌شده (فقط مالک سایت/Aghey می‌تونه بسازه) لازمه:
//   ALTER TABLE referral_codes ADD COLUMN max_uses INTEGER NOT NULL DEFAULT 1;
//   ALTER TABLE referral_codes ADD COLUMN use_count INTEGER NOT NULL DEFAULT 0;
//   ALTER TABLE referral_codes ADD COLUMN expires_at INTEGER;
//   ALTER TABLE referral_codes ADD COLUMN is_custom INTEGER NOT NULL DEFAULT 0;
//   ALTER TABLE referral_codes ADD COLUMN note TEXT;
//   CREATE TABLE IF NOT EXISTS referral_code_uses (
//     id TEXT PRIMARY KEY,
//     code TEXT NOT NULL,
//     used_by TEXT NOT NULL,
//     used_at INTEGER NOT NULL
//   );
//   CREATE INDEX IF NOT EXISTS idx_referral_code_uses_code ON referral_code_uses(code);
//
// منطق:
// - فقط کاربرهایی که can_refer=1 دارن (یا مالک سایت که همیشه مجازه) می‌تونن کد معرفِ خودکارِ شخصی بسازن.
//   این کدهای خودکار همیشه max_uses=1 (تک‌مصرفی) و بدون انقضا هستن، دقیقاً مثل قبل.
// - هر کاربر فقط یه کد معرفِ خودکارِ فعال (استفاده‌نشده) داره؛ ساختِ کدِ جدید، کدِ خودکارِ قبلیِ استفاده‌نشده رو
//   باطل می‌کنه (کدهای شخصی‌سازی‌شده/is_custom=1 دست‌نخورده می‌مونن).
// - به محض استفاده‌ی یه کاربر جدید از یه کدِ خودکار، اون کد غیرقابل‌استفاده می‌شه و (در صورت نبودن کول‌داون) یه
//   کد خودکارِ جدید برای صاحبش ساخته می‌شه.
// - هر ۵ تا استفاده‌ی موفق، ۷ روز کول‌داون برای ساختِ کدِ بعدی می‌ذاره. فقط Aghey از این محدودیت و کول‌داون معافه.
// - کدهای شخصی‌سازی‌شده (is_custom=1): فقط Aghey می‌سازتشون، هر کدوم می‌تونن max_uses بار (نه فقط یه‌بار)
//   استفاده بشن و اختیاری می‌تونن یه expires_at (مهلتِ انقضا) داشته باشن؛ بعد از رسیدن use_count به max_uses
//   یا رد شدن از expires_at، دیگه قابل‌استفاده نیستن. هیچ منطقِ کول‌داون یا آمارِ referral_success_count روی
//   صاحبِ این کدها اعمال نمی‌شه و بعد از استفاده هم به‌طور خودکار جایگزین نمی‌شن.
const REFERRAL_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const REFERRAL_SUCCESS_BATCH = 5; // بعد از هر ۵ استفاده‌ی موفق، کول‌داون اعمال می‌شه
const REFERRAL_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // ۷ روز
const CUSTOM_REFERRAL_MAX_USES_CAP = 100000; // سقفِ منطقیِ بالا برای جلوگیری از مقادیرِ نامعقول
const CUSTOM_REFERRAL_CODE_RE = /^[A-Z0-9_-]{3,32}$/;

function generateReferralCodeCandidate(length = 8) {
  let out = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) out += REFERRAL_CODE_CHARS[arr[i] % REFERRAL_CODE_CHARS.length];
  return out;
}

async function generateUniqueReferralCode(env) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = generateReferralCodeCandidate();
    const existing = await env.D1.prepare("SELECT code FROM referral_codes WHERE code = ?").bind(candidate).first();
    if (!existing) return candidate;
  }
  return generateReferralCodeCandidate(12) + randomHex(2);
}

// آیا این کاربر (بر اساس can_refer/مالک‌بودن) مجازه کد معرف بسازه؟
async function canUserGenerateReferral(env, username) {
  if (isSuperAdmin(username)) return true;
  const row = await env.D1.prepare("SELECT can_refer FROM users WHERE username = ?").bind(username).first();
  return !!(row && row.can_refer);
}

// یه کدِ معرفِ خودکارِ جدید (تک‌مصرفی، بدون انقضا) برای owner می‌سازه؛ کدهای خودکارِ استفاده‌نشده‌ی
// قبلیِ همون owner رو پاک می‌کنه (کدهای شخصی‌سازی‌شده/is_custom=1 دست‌نخورده می‌مونن).
// چک‌های مجازبودن/کول‌داون رو انجام نمی‌ده؛ باید قبلش چک شده باشن.
async function issueNewReferralCode(env, ownerUsername) {
  const code = await generateUniqueReferralCode(env);
  await env.D1.prepare("DELETE FROM referral_codes WHERE owner_username = ? AND used = 0 AND is_custom = 0").bind(ownerUsername).run();
  await env.D1.prepare(
    "INSERT INTO referral_codes (code, owner_username, used, created_at, max_uses, use_count, is_custom) VALUES (?, ?, 0, ?, 1, 0, 0)"
  ).bind(code, ownerUsername, Date.now()).run();
  return code;
}

// ---------- وضعیت کد معرفِ کاربر جاری ----------
async function handleReferralMe(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const userRow = await env.D1.prepare(
    "SELECT can_refer, referred_by, referral_success_count, referral_cooldown_until FROM users WHERE username = ?"
  ).bind(username).first();

  const allowed = isSuperAdmin(username) || !!(userRow && userRow.can_refer);
  const activeCodeRow = await env.D1.prepare(
    "SELECT code FROM referral_codes WHERE owner_username = ? AND used = 0"
  ).bind(username).first();

  const cooldownUntil = (userRow && userRow.referral_cooldown_until) || null;
  const now = Date.now();

  return json({
    ok: true,
    allowed,
    unlimited: isSuperAdmin(username),
    code: activeCodeRow ? activeCodeRow.code : null,
    success_count: (userRow && userRow.referral_success_count) || 0,
    batch_size: REFERRAL_SUCCESS_BATCH,
    cooldown_until: cooldownUntil && cooldownUntil > now ? cooldownUntil : null,
    referred_by: (userRow && userRow.referred_by) || null,
  });
}

// ---------- ساخت/تعویض کدِ معرف (فقط قبل از استفاده‌شدن مجازه) ----------
async function handleReferralGenerate(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  if (!(await checkRateLimit(env, "referral_generate", username, 10, 3600))) {
    return json({ error: "درخواست زیاد بوده، یه‌کم بعد امتحان کن" }, 429);
  }

  if (!(await canUserGenerateReferral(env, username))) {
    return json({ error: "این قابلیت برات فعال نشده" }, 403);
  }

  if (!isSuperAdmin(username)) {
    const userRow = await env.D1.prepare(
      "SELECT referral_cooldown_until FROM users WHERE username = ?"
    ).bind(username).first();
    const cooldownUntil = userRow && userRow.referral_cooldown_until;
    if (cooldownUntil && cooldownUntil > Date.now()) {
      return json({
        error: "به خاطر رسیدن به سقفِ استفاده، تا پایانِ کول‌داون نمی‌تونی کدِ جدید بسازی",
        cooldown_until: cooldownUntil,
      }, 429);
    }
  }

  const code = await issueNewReferralCode(env, username);
  return json({ ok: true, code });
}

// ---------- ساخت کدِ معرفِ شخصی‌سازی‌شده (فقط مالک سایت/Aghey) ----------
// برخلافِ کدِ خودکارِ شخصی، این کدها می‌تونن چندبار (تا max_uses بار) و/یا تا یه مهلتِ مشخص (expires_at)
// استفاده بشن، مستقل از هرگونه کد فعالِ دیگه‌ی صاحبش.
async function handleAdminCreateCustomReferral(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!isSuperAdmin(username)) return json({ error: "فقط مالک سایت می‌تونه کدِ شخصی‌سازی‌شده بسازه" }, 403);

  if (!(await checkRateLimit(env, "referral_generate", username, 30, 3600))) {
    return json({ error: "درخواست زیاد بوده، یه‌کم بعد امتحان کن" }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }

  // تعداد استفاده‌ی مجاز: پیش‌فرض ۱، باید عددِ صحیحِ مثبت باشه (یا 0/خالی برای «نامحدود»)
  let maxUses = 1;
  if (body.maxUses !== undefined && body.maxUses !== null && body.maxUses !== "") {
    const n = Number(body.maxUses);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return json({ error: "تعداد استفاده‌ی مجاز باید یه عددِ صحیحِ نامنفی باشه" }, 400);
    }
    maxUses = n === 0 ? CUSTOM_REFERRAL_MAX_USES_CAP : Math.min(n, CUSTOM_REFERRAL_MAX_USES_CAP);
  }

  // مهلتِ استفاده: یا expiresAt (تایم‌استمپِ میلی‌ثانیه‌ای مستقیم) یا expiresInHours (نسبت به الان)؛ اختیاریه
  let expiresAt = null;
  if (body.expiresAt !== undefined && body.expiresAt !== null && body.expiresAt !== "") {
    const ts = Number(body.expiresAt);
    if (!Number.isFinite(ts) || ts <= Date.now()) {
      return json({ error: "مهلتِ انقضا باید یه زمانِ معتبر در آینده باشه" }, 400);
    }
    expiresAt = ts;
  } else if (body.expiresInHours !== undefined && body.expiresInHours !== null && body.expiresInHours !== "") {
    const hours = Number(body.expiresInHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      return json({ error: "مهلتِ انقضا باید یه عددِ مثبت (ساعت) باشه" }, 400);
    }
    expiresAt = Date.now() + Math.round(hours * 60 * 60 * 1000);
  }

  // کدِ دلخواه (اختیاری): فقط حروفِ بزرگِ انگلیسی/عدد/خط‌تیره/زیرخط، ۳ تا ۳۲ کاراکتر
  let code;
  if (body.code) {
    code = body.code.toString().trim().toUpperCase();
    if (!CUSTOM_REFERRAL_CODE_RE.test(code)) {
      return json({ error: "کدِ دلخواه فقط می‌تونه حروفِ بزرگِ انگلیسی، عدد، خط‌تیره و زیرخط باشه (۳ تا ۳۲ کاراکتر)" }, 400);
    }
    const existing = await env.D1.prepare("SELECT code FROM referral_codes WHERE code = ?").bind(code).first();
    if (existing) return json({ error: "این کد قبلاً استفاده شده" }, 409);
  } else {
    code = await generateUniqueReferralCode(env);
  }

  const note = body.note ? body.note.toString().slice(0, 200) : null;
  const now = Date.now();

  await bind(
    env.D1.prepare(
      `INSERT INTO referral_codes (code, owner_username, used, created_at, max_uses, use_count, is_custom, expires_at, note)
       VALUES (?, ?, 0, ?, ?, 0, 1, ?, ?)`
    ),
    [code, username, now, maxUses, expiresAt, note]
  ).run();

  return json({
    ok: true,
    code: { code, owner_username: username, max_uses: maxUses, use_count: 0, expires_at: expiresAt, note, created_at: now },
  });
}

// ---------- لیستِ کدهای معرفِ شخصی‌سازی‌شده (فقط مالک سایت/Aghey) ----------
async function handleAdminListCustomReferrals(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!isSuperAdmin(username)) return json({ error: "دسترسی نداری" }, 403);

  const rows = await env.D1.prepare(
    `SELECT code, owner_username, max_uses, use_count, used, expires_at, note, created_at
     FROM referral_codes WHERE is_custom = 1 ORDER BY created_at DESC LIMIT 200`
  ).all();

  const now = Date.now();
  const codes = (rows.results || []).map((r) => ({
    code: r.code,
    owner_username: r.owner_username,
    max_uses: r.max_uses,
    use_count: r.use_count,
    remaining: Math.max(0, (r.max_uses || 0) - (r.use_count || 0)),
    expires_at: r.expires_at || null,
    expired: !!(r.expires_at && r.expires_at <= now),
    exhausted: !!r.used,
    note: r.note || null,
    created_at: r.created_at,
  }));

  return json({ ok: true, codes });
}

// ---------- ابطالِ فوریِ یه کدِ معرفِ شخصی‌سازی‌شده (فقط مالک سایت/Aghey) ----------
async function handleAdminRevokeReferralCode(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!isSuperAdmin(username)) return json({ error: "دسترسی نداری" }, 403);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }
  const code = (body.code || "").toString().trim().toUpperCase();
  if (!code) return json({ error: "کد لازمه" }, 400);

  const row = await env.D1.prepare("SELECT code FROM referral_codes WHERE code = ? AND is_custom = 1").bind(code).first();
  if (!row) return json({ error: "کدِ شخصی‌سازی‌شده پیدا نشد" }, 404);

  await env.D1.prepare("UPDATE referral_codes SET used = 1 WHERE code = ?").bind(code).run();
  return json({ ok: true, code });
}


async function handleAdminSetReferralPermission(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  const actorRank = await getAdminRank(env, username);
  if (!canGrantReferral(actorRank)) return json({ error: "دسترسی نداری" }, 403);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }

  const targetUsername = (body.username || "").toString();
  const allowed = !!body.allowed;
  if (!targetUsername) return json({ error: "نام کاربری لازمه" }, 400);
  if (isSuperAdmin(targetUsername)) {
    return json({ error: "مالک سایت همیشه به این قابلیت دسترسی داره" }, 400);
  }

  const existing = await env.D1.prepare("SELECT username FROM users WHERE username = ?").bind(targetUsername).first();
  if (!existing) return json({ error: "کاربر پیدا نشد" }, 404);

  await env.D1.prepare("UPDATE users SET can_refer = ? WHERE username = ?").bind(allowed ? 1 : 0, targetUsername).run();
  if (!allowed) {
    // اگه دسترسی گرفته شد، کدِ فعالِ استفاده‌نشده‌اش هم باطل بشه
    await env.D1.prepare("DELETE FROM referral_codes WHERE owner_username = ? AND used = 0").bind(targetUsername).run();
  }

  return json({ ok: true, username: targetUsername, can_refer: allowed });
}

// #endregion
// #region آپلود استیکر شخصی (عکس یا گیف) به تلگرام؛ سقف ۱۰ تا برای هر کاربر، عمومی و قابل استفاده برای همه
// ---------- آپلود استیکر شخصی (عکس یا گیف) به تلگرام؛ سقف ۱۰ تا برای هر کاربر، عمومی و قابل استفاده برای همه ----------
async function handleUploadSticker(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "sticker_upload", username, 10, 600))) {
    return json({ error: "آپلود استیکر زیاد بوده، چند دقیقه دیگه امتحان کن" }, 429);
  }

  const countRow = await env.D1.prepare("SELECT COUNT(*) as c FROM stickers WHERE username = ?").bind(username).first();
  if (countRow && countRow.c >= MAX_STICKERS_PER_USER) {
    return json({ error: `حداکثر ${MAX_STICKERS_PER_USER} استیکر شخصی می‌تونی داشته باشی` }, 400);
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string" || file.size === 0) {
    return json({ error: "فایلی انتخاب نشده" }, 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return json({ error: "حجم استیکر نباید بیشتر از ۵ مگابایت باشه" }, 400);
  }
  if (!/^image\//.test(file.type)) {
    return json({ error: "فقط عکس یا گیف قابل استفاده به‌عنوان استیکره" }, 400);
  }
  if (!(await verifyFileMatchesCategory(file, "image"))) {
    return json({ error: "محتوای فایل با نوع اعلام‌شده‌اش مطابقت نداره" }, 400);
  }

  let name = (form.get("name") || "").toString().trim().slice(0, 40);
  if (!name) name = null;

  const isAnimated = file.type === "image/gif";
  let fileId = null;

  try {
    if (isAnimated) {
      // گیف رو با sendAnimation می‌فرستیم تا تلگرام حالت متحرکش رو حفظ کنه (خروجی mp4 بی‌صدا)
      const result = await sendTelegramFile(env, "sendAnimation", "animation", file, undefined);
      fileId = extractFileId("animation", result);
    } else {
      const result = await sendTelegramFile(env, "sendPhoto", "photo", file, undefined);
      fileId = extractFileId("photo", result);
    }
  } catch (err) {
    console.error("خطای ارسال استیکر به تلگرام:", err);
    return json({ error: "آپلود استیکر ناموفق بود، دوباره امتحان کن" }, 502);
  }

  if (!fileId) return json({ error: "دریافت فایل استیکر ناموفق بود" }, 502);

  const id = `${Date.now()}_${randomHex(4)}`;
  const date = Date.now();
  await bind(
    env.D1.prepare("INSERT INTO stickers (id, username, file_id, is_animated, date, name) VALUES (?, ?, ?, ?, ?, ?)"),
    [id, username, fileId, isAnimated ? 1 : 0, date, name]
  ).run();

  return json({ ok: true, sticker: { id, username, file_id: fileId, is_animated: isAnimated ? 1 : 0, date, name } });
}

// #endregion
// #region لیست استیکرهای شخصیِ عمومیِ همه‌ی کاربران (صفحه‌بندی‌شده + قابل جستجو، برای پشتیبانی از تعداد زیاد)
// ---------- لیست استیکرهای شخصیِ عمومیِ همه‌ی کاربران (صفحه‌بندی‌شده + قابل جستجو، برای پشتیبانی از تعداد زیاد) ----------
async function handleGetStickers(request, env) {
  // دهات کاملاً خصوصیه؛ استیکرها فقط برای کاربر لاگین‌کرده قابل مشاهده‌ست
  const viewer = await getUserFromToken(request, env);
  if (!viewer) return json({ error: "ابتدا وارد شو" }, 401);

  const url = new URL(request.url);
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
  const pageSize = Math.min(Math.max(parseInt(url.searchParams.get("pageSize") || "60", 10), 1), 100);
  const search = (url.searchParams.get("search") || "").toLowerCase().trim();
  const usernameFilter = url.searchParams.get("username");

  const where = [];
  const params = [];
  if (search) {
    where.push("(LOWER(name) LIKE ? OR LOWER(username) LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (usernameFilter) {
    where.push("username = ?");
    params.push(usernameFilter);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await bind(env.D1.prepare(`SELECT COUNT(*) as c FROM stickers ${whereSql}`), params).first();
  const total = totalRow ? totalRow.c : 0;

  const start = (page - 1) * pageSize;
  const rows = await bind(
    env.D1.prepare(`SELECT id, username, file_id, is_animated, name, date FROM stickers ${whereSql} ORDER BY date DESC LIMIT ? OFFSET ?`),
    [...params, pageSize, start]
  ).all();

  return json({
    ok: true,
    stickers: rows.results || [],
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  });
}

// #endregion
// #region حذف استیکر (صاحبش یا ادمین)
// ---------- حذف استیکر (صاحبش یا ادمین) ----------
async function handleDeleteSticker(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "شناسه استیکر لازمه" }, 400);

  const sticker = await env.D1.prepare("SELECT * FROM stickers WHERE id = ?").bind(id).first();
  if (!sticker) return json({ error: "استیکر پیدا نشد" }, 404);

  if (sticker.username !== username && !canManageStickers(await getAdminRank(env, username))) {
    return json({ error: "فقط صاحب استیکر یا ادمینِ مجاز می‌تونه حذفش کنه" }, 403);
  }

  await env.D1.prepare("DELETE FROM stickers WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

// دامنه‌ی مجاز برای استیکرهای پیش‌فرض (فایل‌های خام ریپو گیت‌هاب) — برای جلوگیری از ثبت لینک دلخواه به‌جای استیکر
const ALLOWED_STICKER_URL_HOST = "raw.githubusercontent.com";

// #endregion
// #region استیکرهای پیش‌فرض: لیست و پروکسی‌ی فایل (سمتِ سرور، نه مستقیم از مرورگرِ کاربر)
// ---------- استیکرهای پیش‌فرض: لیست و پروکسی‌ی فایل ----------
// چرا سمتِ سرور: مرورگرِ کاربرهای ایرانی گاهی نمی‌تونه مستقیم به api.github.com یا
// raw.githubusercontent.com وصل بشه (همون فیلترینگِ DNS/SNI). چون خودِ این ورکر
// (روی Cloudflare) معمولاً بدون مشکل به گیت‌هاب وصل می‌شه، حالا لیست‌گیری و دانلودِ
// فایلِ استیکرهای پیش‌فرض از پوشه‌ی stickers توی ریپو، از سمتِ خودِ ورکر انجام می‌شه
// و فقط نتیجه‌ی نهایی به مرورگر می‌رسه؛ مرورگرِ کاربر دیگه هیچ‌وقت مستقیم با دامنه‌های
// گیت‌هاب صحبت نمی‌کنه.
const STICKER_REPO_CONTENTS_API = "https://api.github.com/repos/oldvasl/vasl/contents/stickers?ref=main";
const STICKER_REPO_RAW_BASE = "https://raw.githubusercontent.com/oldvasl/vasl/main/stickers/";
const STICKER_FILE_EXT_RE = /\.(gif|png|jpe?g|webp)$/i;

async function handleDefaultStickersList(request, env, ctx) {
  const viewer = await getUserFromTokenOrQuery(request, env);
  if (!viewer) return json({ error: "ابتدا وارد شو" }, 401);

  const cache = caches.default;
  const cacheKey = new Request("https://sticker-list-cache.internal/default-stickers", { method: "GET" });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const res = await fetch(STICKER_REPO_CONTENTS_API, {
    headers: {
      "User-Agent": "dehat-app",
      "Accept": "application/vnd.github+json",
    },
  });
  if (!res.ok) return json({ error: "لیستِ استیکرهای پیش‌فرض در دسترس نیست" }, 502);

  const data = await res.json();
  const files = Array.isArray(data)
    ? data.filter((f) => f.type === "file" && STICKER_FILE_EXT_RE.test(f.name))
    : [];

  const stickers = files.map((f) => ({
    name: f.name,
    // raw_url: آدرسِ اصلیِ گیت‌هاب — همین به‌عنوان sticker_url موقعِ ثبتِ کامنت فرستاده می‌شه
    // (چون بک‌اند فقط لینک‌های raw.githubusercontent.com رو معتبر می‌دونه)
    raw_url: STICKER_REPO_RAW_BASE + encodeURIComponent(f.name),
    // url: آدرسِ پروکسی‌شده‌ی همینِ ورکر — فقط برای نمایش (src تگ img)، تا مرورگر
    // مستقیم به گیت‌هاب وصل نشه
    url: `${new URL(request.url).origin}/api/stickers/default/${encodeURIComponent(f.name)}`,
  }));

  const response = json({ stickers });
  ctx.waitUntil(
    (async () => {
      const toCache = response.clone();
      const cacheableRes = new Response(toCache.body, {
        status: toCache.status,
        headers: { ...Object.fromEntries(toCache.headers), "Cache-Control": "public, max-age=1800" },
      });
      await cache.put(cacheKey, cacheableRes);
    })()
  );
  return response;
}

async function handleDefaultStickerFile(name, env, ctx, request) {
  if (!name || !STICKER_FILE_EXT_RE.test(name)) return json({ error: "نام فایل نامعتبره" }, 400);
  const viewer = await getUserFromTokenOrQuery(request, env);
  if (!viewer) return json({ error: "ابتدا وارد شو" }, 401);

  const cache = caches.default;
  const cacheKey = new Request(`https://sticker-file-cache.internal/${encodeURIComponent(name)}`, { method: "GET" });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const rawUrl = STICKER_REPO_RAW_BASE + encodeURIComponent(name);
  const fileRes = await fetch(rawUrl, { headers: { "User-Agent": "dehat-app" } });
  if (!fileRes.ok) return json({ error: "استیکر پیدا نشد" }, 404);

  const headers = new Headers();
  headers.set("Content-Type", fileRes.headers.get("Content-Type") || "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("X-Content-Type-Options", "nosniff");

  const response = new Response(fileRes.body, { status: 200, headers });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

// #endregion
// #region ساخت اعلان برای یک کاربر
// ---------- ساخت اعلان برای یک کاربر ----------
async function createNotification(env, toUsername, data) {
  if (!toUsername) return;
  const id = `${Date.now()}_${randomHex(4)}`;
  await bind(
    env.D1.prepare(
      "INSERT INTO notifications (id, to_username, type, post_id, from_username, text, comment_id, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ),
    [id, toUsername, data.type, data.post_id || null, data.from_username || null, data.text || null, data.comment_id || null, Date.now()]
  ).run();

  // ارسال پوش نوتیفیکیشن به موازات ذخیره‌ی اعلان (best-effort؛ نبود subscription یا خطای شبکه چیزی رو خراب نمی‌کنه)
  const pushMessages = {
    comment: (d) => `${d.from_username} روی پستت کامنت گذاشت`,
    reply: (d) => `${d.from_username} به کامنتت جواب داد`,
    vote: (d) => `${d.from_username} به پستت رای مثبت داد`,
    marriage_request: (d) => `${d.from_username} تو محضر ازت خواستگاری کرد`,
    marriage_accept: (d) => `${d.from_username} خواستگاریت رو قبول کرد`,
  };
  const bodyBuilder = pushMessages[data.type];
  if (bodyBuilder) {
    const pushPayload = {
      title: "دهات",
      body: bodyBuilder(data),
      url: data.post_id ? `${SITE_ORIGIN}/index.html?post=${data.post_id}` : `${SITE_ORIGIN}/index.html`,
      tag: `notif-${data.type}-${data.post_id || ""}`,
    };
    await Promise.all([
      sendPushToUser(env, toUsername, pushPayload),
      sendFcmToUser(env, toUsername, pushPayload),
    ]);
  }
}

// #endregion
// #region ثبت کامنت جدید (متنی یا استیکری)
// ---------- ثبت کامنت جدید (متنی یا استیکری) ----------
async function handleAddComment(request, env, ctx) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "comment", username, 20, 300))) {
    return json({ error: "کامنت زیاد ثبت کردی، چند دقیقه دیگه امتحان کن" }, 429);
  }

  const body = await request.json();
  const { post_id, parent_id, sticker_id, sticker_url } = body;
  if (!post_id) return json({ error: "شناسه پست لازمه" }, 400);

  let type = "text";
  let text = (body.text || "").toString().trim();
  let stickerSrc = null;
  let stickerIsExternal = 0;
  let stickerIsVideo = 0;

  if (sticker_id) {
    // استیکر شخصی: باید توی جدول stickers ثبت شده باشه (فایل روی تلگرام)
    const sticker = await env.D1.prepare("SELECT * FROM stickers WHERE id = ?").bind(sticker_id).first();
    if (!sticker) return json({ error: "استیکر پیدا نشد" }, 404);
    type = "sticker";
    text = "";
    stickerSrc = sticker.file_id;
    stickerIsExternal = 0;
    stickerIsVideo = sticker.is_animated ? 1 : 0;
  } else if (sticker_url) {
    // استیکر پیش‌فرض: لینک مستقیم از پوشه‌ی stickers توی ریپو گیت‌هاب
    let parsed;
    try {
      parsed = new URL(sticker_url.toString());
    } catch (e) {
      return json({ error: "لینک استیکر نامعتبره" }, 400);
    }
    if (parsed.hostname !== ALLOWED_STICKER_URL_HOST) {
      return json({ error: "لینک استیکر مجاز نیست" }, 400);
    }
    type = "sticker";
    text = "";
    stickerSrc = parsed.toString();
    stickerIsExternal = 1;
    stickerIsVideo = 0;
  } else {
    if (!text) return json({ error: "متن کامنت خالیه" }, 400);
    if (text.length > 500) return json({ error: "کامنت خیلی طولانیه" }, 400);
  }

  const post = await env.D1.prepare("SELECT * FROM posts WHERE id = ?").bind(post_id).first();

  // اگه ریپلای به یه کامنت دیگه‌ست، اون کامنت رو پیدا می‌کنیم
  let parentComment = null;
  if (parent_id) {
    parentComment = await env.D1.prepare("SELECT * FROM comments WHERE id = ? AND post_id = ?").bind(parent_id, post_id).first();
  }

  // تلاش برای ثبت به صورت ریپلای زیر پست اصلی در تلگرام (best-effort، اگه شکست بخوره مشکلی نیست)
  const noticeText = type === "sticker" ? "یک استیکر فرستاد" : text;
  try {
    if (post && post.message_id) {
      const prefix = parentComment ? `ریپلای به ${parentComment.username} از طرف ${username}` : `کامنت از ${username}`;
      // این یه پیامِ یک‌باره‌ی جدیده (نه ویرایش/حذفِ پیامِ قبلی)، پس می‌شه آزادانه بینِ دو بات رندوم کرد
      const { token: noticeToken } = pickTelegramBot(env);
      await fetch(`https://api.telegram.org/bot${noticeToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.CHANNEL_ID,
          text: `${prefix}:\n${noticeText}`,
          reply_to_message_id: post.message_id,
        }),
      });
    }
  } catch (err) {
    // مهم نیست؛ کامنت مستقل از تلگرام هم ذخیره می‌شه
  }

  const id = `${Date.now()}_${randomHex(4)}`;
  const comment = {
    id,
    post_id,
    username,
    text,
    date: Date.now(),
    parent_id: parentComment ? parentComment.id : null,
    type,
    sticker_src: stickerSrc,
    sticker_is_external: stickerIsExternal,
    sticker_is_video: stickerIsVideo,
  };
  await bind(
    env.D1.prepare(
      `INSERT INTO comments (id, post_id, username, text, date, parent_id, type, sticker_src, sticker_is_external, sticker_is_video)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ),
    [
      comment.id,
      comment.post_id,
      comment.username,
      comment.text,
      comment.date,
      comment.parent_id,
      comment.type,
      comment.sticker_src,
      comment.sticker_is_external,
      comment.sticker_is_video,
    ]
  ).run();

  const notifSnippet = type === "sticker" ? "🖼️ یک استیکر فرستاد" : text.slice(0, 120);

  // ساختِ اعلان (INSERT + فراخوانیِ Web Push به سرورهای خارجی) دیگه جلوی جوابِ ثبتِ کامنت رو
  // نمی‌گیره؛ با ctx.waitUntil در پس‌زمینه انجام می‌شه تا کاربر بلافاصله بعد از فرستادنِ کامنت جواب بگیره.
  let notifyPromise = null;
  if (parentComment) {
    // ریپلای: اعلان برای صاحب کامنت مادر (نه لزوماً صاحب پست)
    if (parentComment.username && parentComment.username !== username) {
      notifyPromise = createNotification(env, parentComment.username, {
        type: "reply",
        post_id,
        from_username: username,
        text: notifSnippet,
        comment_id: id,
      });
    }
  } else if (post && post.username && post.username !== username) {
    // کامنت معمولی: اعلان برای صاحب پست
    notifyPromise = createNotification(env, post.username, {
      type: "comment",
      post_id,
      from_username: username,
      text: notifSnippet,
      comment_id: id,
    });
  }
  if (notifyPromise) {
    if (ctx) ctx.waitUntil(notifyPromise);
    else await notifyPromise;
  }

  return json({ ok: true, comment });
}

// #endregion
// #region گرفتن کامنت‌های یک پست
// ---------- گرفتن کامنت‌های یک پست ----------
async function handleGetComments(request, env) {
  const url = new URL(request.url);
  const postId = url.searchParams.get("post_id");
  if (!postId) return json({ error: "شناسه پست لازمه" }, 400);

  // دهات کاملاً خصوصیه؛ کامنت‌ها فقط برای کاربر لاگین‌کرده قابل مشاهده‌ست
  const viewerUsername = await getUserFromToken(request, env);
  if (!viewerUsername) return json({ error: "ابتدا وارد شو" }, 401);

  const res = await env.D1.prepare("SELECT * FROM comments WHERE post_id = ? ORDER BY date ASC").bind(postId).all();
  const comments = res.results || [];

  if (comments.length === 0) return json({ ok: true, comments: [] });

  // آواتار نویسنده‌های این کامنت‌ها
  const uniqueUsernames = [...new Set(comments.map((c) => c.username))];
  const avatarMap = {};
  if (uniqueUsernames.length > 0) {
    const placeholders = uniqueUsernames.map(() => "?").join(",");
    const profileRows = await bind(
      env.D1.prepare(`SELECT username, avatar_file_id FROM profiles WHERE username IN (${placeholders})`),
      uniqueUsernames
    ).all();
    for (const row of profileRows.results || []) {
      if (row.avatar_file_id) avatarMap[row.username] = row.avatar_file_id;
    }
  }

  // اینکه کاربرِ درخواست‌دهنده کدوم کامنت‌ها رو لایک کرده
  let likedSet = new Set();
  if (viewerUsername) {
    const ids = comments.map((c) => c.id);
    const placeholders = ids.map(() => "?").join(",");
    const likeRows = await bind(
      env.D1.prepare(`SELECT comment_id FROM comment_likes WHERE username = ? AND comment_id IN (${placeholders})`),
      [viewerUsername, ...ids]
    ).all();
    likedSet = new Set((likeRows.results || []).map((r) => r.comment_id));
  }

  const enriched = comments.map((c) => ({
    ...c,
    avatar_file_id: avatarMap[c.username] || null,
    likes: c.likes || 0,
    edited: !!c.edited,
    liked: likedSet.has(c.id),
  }));

  return json({ ok: true, comments: enriched });
}

// #endregion
// #region لایک/آنلایک یک کامنت
// ---------- لایک/آنلایک یک کامنت ----------
async function handleLikeComment(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }
  const commentId = body.comment_id;
  if (!commentId) return json({ error: "شناسه کامنت لازمه" }, 400);

  const comment = await env.D1.prepare("SELECT id FROM comments WHERE id = ?").bind(commentId).first();
  if (!comment) return json({ error: "کامنت پیدا نشد" }, 404);

  const existing = await env.D1
    .prepare("SELECT 1 FROM comment_likes WHERE comment_id = ? AND username = ?")
    .bind(commentId, username)
    .first();

  let liked;
  let stmts;
  if (existing) {
    stmts = [
      env.D1.prepare("DELETE FROM comment_likes WHERE comment_id = ? AND username = ?").bind(commentId, username),
      env.D1.prepare("UPDATE comments SET likes = MAX(0, likes - 1) WHERE id = ? RETURNING likes").bind(commentId),
    ];
    liked = false;
  } else {
    stmts = [
      env.D1.prepare("INSERT INTO comment_likes (comment_id, username) VALUES (?, ?)").bind(commentId, username),
      env.D1.prepare("UPDATE comments SET likes = likes + 1 WHERE id = ? RETURNING likes").bind(commentId),
    ];
    liked = true;
  }

  const batchResults = await env.D1.batch(stmts);
  const newLikes = batchResults[batchResults.length - 1].results[0].likes || 0;

  return json({ ok: true, liked, likes: newLikes });
}

// #endregion
// #region ویرایش متن یک کامنت (فقط صاحبش)
// ---------- ویرایش متن یک کامنت (فقط صاحبش) ----------
async function handleEditComment(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }
  const commentId = body.comment_id;
  const text = (body.text || "").toString().trim();
  if (!commentId) return json({ error: "شناسه کامنت لازمه" }, 400);
  if (!text) return json({ error: "متن کامنت نمی‌تونه خالی باشه" }, 400);
  if (text.length > 500) return json({ error: "کامنت خیلی طولانیه" }, 400);

  const comment = await env.D1.prepare("SELECT * FROM comments WHERE id = ?").bind(commentId).first();
  if (!comment) return json({ error: "کامنت پیدا نشد" }, 404);
  if (comment.username !== username) return json({ error: "فقط صاحب کامنت می‌تونه ویرایشش کنه" }, 403);
  if (comment.type === "sticker") return json({ error: "استیکر قابل ویرایش نیست" }, 400);

  await env.D1.prepare("UPDATE comments SET text = ?, edited = 1 WHERE id = ?").bind(text, commentId).run();
  return json({ ok: true, text });
}

// #endregion
// #region حذف یک کامنت (صاحبش یا ادمین)
// ---------- حذف یک کامنت (صاحبش یا ادمین) ----------
async function handleDeleteComment(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "شناسه کامنت لازمه" }, 400);

  const comment = await env.D1.prepare("SELECT * FROM comments WHERE id = ?").bind(id).first();
  if (!comment) return json({ error: "کامنت پیدا نشد" }, 404);

  if (comment.username !== username && !canModerateContent(await getAdminRank(env, username))) {
    return json({ error: "فقط صاحب کامنت یا مالک سایت می‌تونه حذفش کنه" }, 403);
  }

  // ریپلای‌های مستقیمِ همین کامنت هم حذف می‌شن که یتیم نمونن
  const replies = await env.D1.prepare("SELECT id FROM comments WHERE parent_id = ?").bind(id).all();
  const allIds = [id, ...(replies.results || []).map((r) => r.id)];
  const placeholders = allIds.map(() => "?").join(",");

  await env.D1.batch([
    bind(env.D1.prepare(`DELETE FROM comments WHERE id IN (${placeholders})`), allIds),
    bind(env.D1.prepare(`DELETE FROM comment_likes WHERE comment_id IN (${placeholders})`), allIds),
  ]);

  return json({ ok: true });
}

// #endregion
// #region حذف پست
// ---------- حذف پست ----------
async function handleDeletePost(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "شناسه پست لازمه" }, 400);

  const post = await env.D1.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
  if (!post) return json({ error: "پست پیدا نشد" }, 404);

  if (post.username !== username && !canModerateContent(await getAdminRank(env, username))) {
    return json({ error: "فقط صاحب پست یا مالک سایت می‌تونه حذفش کنه" }, 403);
  }

  // تلاش برای حذف پیام از تلگرام (best-effort)
  try {
    if (post.message_id) {
      const deleteToken = telegramTokenForSlot(env, post.bot_slot);
      await fetch(`https://api.telegram.org/bot${deleteToken}/deleteMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: env.CHANNEL_ID, message_id: post.message_id }),
      });
    }
  } catch (err) {
    // مهم نیست، ادامه می‌دیم
  }

  await env.D1.batch([
    env.D1.prepare("DELETE FROM posts WHERE id = ?").bind(id),
    env.D1.prepare("DELETE FROM comments WHERE post_id = ?").bind(id),
    env.D1.prepare("DELETE FROM votes WHERE post_id = ?").bind(id),
    env.D1.prepare("DELETE FROM likes WHERE post_id = ?").bind(id),
  ]);

  return json({ ok: true });
}

// #endregion
// #region ویرایشِ پست (فقط صاحبِ پست، فقط متن/عنوان/تگ‌ها)
// ---------- ویرایشِ پست (فقط صاحبِ پست می‌تونه؛ فایل/مدیای پست قابلِ تغییر نیست، فقط متن/عنوان/تگ) ----------
async function handleEditPost(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }

  const id = (body.id || "").toString();
  if (!id) return json({ error: "شناسه پست لازمه" }, 400);

  const post = await env.D1.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
  if (!post) return json({ error: "پست پیدا نشد" }, 404);
  if (post.username !== username) return json({ error: "فقط صاحبِ پست می‌تونه ویرایشش کنه" }, 403);

  const text = (body.text || "").toString().trim();
  const title = (body.title || "").toString().trim().slice(0, 15);
  const hasMedia = post.type === "photo" || post.type === "video" || post.type === "audio" || post.type === "document" || !!post.drawing_file_id;
  if (!text && !hasMedia) return json({ error: "پست نمی‌تونه خالی باشه" }, 400);
  if (text.length > 2000) return json({ error: "متن خیلی طولانیه" }, 400);
  if (title.length > 15) return json({ error: "عنوان نباید بیشتر از ۱۵ کاراکتر باشه" }, 400);

  const tagsRaw = (body.tags || "").toString().trim();
  let tags = [];
  if (tagsRaw) {
    tags = tagsRaw
      .split(/[\s,،]+/)
      .filter(Boolean)
      .map((t) => t.slice(0, 30))
      .slice(0, 6);
  }
  const tagsJson = tags.length ? JSON.stringify(tags) : null;

  await env.D1.prepare("UPDATE posts SET text = ?, title = ?, tags = ?, edited = 1 WHERE id = ?")
    .bind(text || null, title || null, tagsJson, id)
    .run();

  // به‌روزرسانیِ کپشنِ پیامِ تلگرام هم (best-effort؛ اگه شکست بخوره جلویِ ثبتِ ویرایش رو نمی‌گیره)
  try {
    if (post.message_id) {
      const caption = text ? `${username}\n\n${text}` : username;
      const slot = untagFileId(post.file_id || "").slot;
      await editTelegramCaption(env, env.CHANNEL_ID, post.message_id, caption, slot);
    }
  } catch (err) {
    // مهم نیست، ادامه می‌دیم
  }

  return json({ ok: true, id, text, title, tags });
}

// #endregion
// #region پین‌کردنِ پست توسط ادمین
// ---------- پین/آن‌پینِ پست (فقط مالکِ سایت، دقیقاً همون سطحِ دسترسیِ حذفِ پستِ دیگران) ----------
async function handlePinPost(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  if (!canModerateContent(await getAdminRank(env, username))) {
    return json({ error: "فقط مالکِ سایت می‌تونه پست رو پین کنه" }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }

  const id = (body.id || "").toString();
  const pinned = !!body.pinned;
  if (!id) return json({ error: "شناسه پست لازمه" }, 400);

  const post = await env.D1.prepare("SELECT id FROM posts WHERE id = ?").bind(id).first();
  if (!post) return json({ error: "پست پیدا نشد" }, 404);

  await env.D1.prepare("UPDATE posts SET pinned = ? WHERE id = ?").bind(pinned ? 1 : 0, id).run();

  return json({ ok: true, id, pinned });
}

// #endregion
// #region گرفتن فید (با صفحه‌بندی و فیلتر رسانه/متن)
// ---------- گرفتن فید (با صفحه‌بندی و فیلتر رسانه/متن) ----------
// #endregion
// #region گرفتن یک پست به‌تنهایی (برای نمایش پاپ‌آپ از روی اعلان)
// ---------- گرفتن یک پست به‌تنهایی (برای نمایش پاپ‌آپ از روی اعلان) ----------
async function handleGetSinglePost(request, env) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "شناسه پست لازمه" }, 400);

  const post = await env.D1.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
  if (!post) return json({ error: "پست پیدا نشد" }, 404);

  // دهات کاملاً خصوصیه؛ پست فقط برای کاربر لاگین‌کرده قابل مشاهده‌ست
  const viewerUsername = await getUserFromToken(request, env);
  if (!viewerUsername) return json({ error: "ابتدا وارد شو" }, 401);

  const profile = await env.D1.prepare("SELECT avatar_file_id FROM profiles WHERE username = ?").bind(post.username).first();

  let userVote = null;
  let liked = false;
  if (viewerUsername) {
    const [voteRow, likeRow] = await Promise.all([
      env.D1.prepare("SELECT action FROM votes WHERE post_id = ? AND username = ?").bind(id, viewerUsername).first(),
      env.D1.prepare("SELECT 1 FROM likes WHERE post_id = ? AND username = ?").bind(id, viewerUsername).first(),
    ]);
    userVote = voteRow ? voteRow.action : null;
    liked = !!likeRow;
  }

  // شماره‌ی همون پست، هم‌راستا با شماره‌گذاری فید (تعداد پست‌هایی که هم‌زمان یا زودتر ثبت شدن)
  const numberRow = await env.D1.prepare("SELECT COUNT(*) as c FROM posts WHERE date <= ?").bind(post.date).first();
  const number = numberRow ? numberRow.c : 1;

  const commentCountRow = await env.D1.prepare("SELECT COUNT(*) as c FROM comments WHERE post_id = ?").bind(id).first();

  const enrichedPost = {
    ...post,
    avatar_file_id: (profile && profile.avatar_file_id) || null,
    upvotes: post.upvotes || 0,
    downvotes: post.downvotes || 0,
    likes: post.likes || 0,
    userVote,
    liked,
    comment_count: commentCountRow ? commentCountRow.c : 0,
  };

  return json({ ok: true, post: enrichedPost, number });
}

// منطق اصلیِ ساختِ یک صفحه از فید، جدا از پارس‌کردنِ URL؛ هم توسط handleFeed و هم توسط
// handleBootstrap (که چندتا endpoint رو تویِ یه درخواست جمع می‌کنه) صدا زده می‌شه.
async function fetchFeedPage(env, viewerUsername, opts) {
  const {
    page = 1,
    pageSize = 10,
    filter = "all",
    usernameFilter = null,
    excludeAudio = false,
    sort = "date",
    excludeIds = [],
    unseenOnly = false,
  } = opts || {};

  // پست‌های پین‌شده فقط تویِ فیدِ عادی (سورتِ date) بالای همه میان؛ تویِ «محبوب‌ترین‌ها» و صفِ رندومِ
  // رادیو معنی نداره که پین دخالت کنه، پس اونجا رفتارِ قبلی دست‌نخورده می‌مونه.
  const orderBySql = sort === "popular" ? "upvotes DESC, date DESC" : sort === "random" ? "RANDOM()" : "pinned DESC, date DESC";

  const where = [];
  const params = [];
  if (filter === "media") {
    where.push("type != 'text' AND type != 'audio'");
  } else if (filter === "text") {
    where.push("type = 'text'");
  } else if (filter === "audio") {
    where.push("type = 'audio'");
  }
  if (excludeAudio) {
    where.push("type != 'audio'");
  }
  if (usernameFilter) {
    where.push("username = ?");
    params.push(usernameFilter);
  }
  if (excludeIds.length > 0) {
    where.push(`id NOT IN (${excludeIds.map(() => "?").join(",")})`);
    params.push(...excludeIds);
  }
  if (unseenOnly && viewerUsername) {
    where.push("id NOT IN (SELECT post_id FROM deel_views WHERE username = ?)");
    params.push(viewerUsername);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // قبلاً «تعداد کل» و «خودِ پست‌ها» دو تا کوئریِ جدا و پشتِ‌سرِهم بودن؛ چون هیچ‌کدوم به نتیجه‌ی
  // اون‌یکی نیاز نداره، با D1.batch تو یه رفت‌وبرگشتِ واحد به دیتابیس اجرا می‌شن.
  const [totalBatchResult, pagePostsBatchResult] = await env.D1.batch([
    bind(env.D1.prepare(`SELECT COUNT(*) as c FROM posts ${whereSql}`), params),
    bind(
      env.D1.prepare(`SELECT * FROM posts ${whereSql} ORDER BY ${orderBySql} LIMIT ? OFFSET ?`),
      [...params, pageSize, (page - 1) * pageSize]
    ),
  ]);
  const total = (totalBatchResult.results && totalBatchResult.results[0] && totalBatchResult.results[0].c) || 0;
  const pagePosts = pagePostsBatchResult.results || [];
  const start = (page - 1) * pageSize;

  // چهار تا کوئریِ بعدی (آواتارها، رای‌های خودِ کاربر، لایک‌های خودِ کاربر، تعدادِ کامنت‌ها) هیچ‌کدوم
  // به نتیجه‌ی اون‌یکی وابسته نیست، فقط به idهای همین صفحه؛ به‌جایِ صبرکردنِ پشتِ‌سرِهم برای هرکدوم
  // (یا حتی Promise.all که بازم چند رفت‌وبرگشتِ جدا به D1 می‌زنه)، همه رو با یه D1.batch واحد
  // می‌فرستیم — یعنی کل فیدِ یه صفحه با فقط ۲ رفت‌وبرگشتِ D1 آماده می‌شه، نه ۵-۶ تا.
  const uniqueUsernames = [...new Set(pagePosts.map((p) => p.username))];
  const postIds = pagePosts.map((p) => p.id);

  const avatarMap = {};
  const voteMap = {};
  const likeMap = {};
  const commentCountMap = {};

  if (pagePosts.length > 0) {
    const avatarPlaceholders = uniqueUsernames.map(() => "?").join(",");
    const idPlaceholders = postIds.map(() => "?").join(",");

    const batchStmts = [
      uniqueUsernames.length > 0
        ? bind(env.D1.prepare(`SELECT username, avatar_file_id FROM profiles WHERE username IN (${avatarPlaceholders})`), uniqueUsernames)
        : null,
      viewerUsername
        ? bind(env.D1.prepare(`SELECT post_id, action FROM votes WHERE username = ? AND post_id IN (${idPlaceholders})`), [viewerUsername, ...postIds])
        : null,
      viewerUsername
        ? bind(env.D1.prepare(`SELECT post_id FROM likes WHERE username = ? AND post_id IN (${idPlaceholders})`), [viewerUsername, ...postIds])
        : null,
      bind(env.D1.prepare(`SELECT post_id, COUNT(*) as c FROM comments WHERE post_id IN (${idPlaceholders}) GROUP BY post_id`), postIds),
    ];
    // اسلات‌های null (وقتی مثلاً کاربر مهمونه و رای/لایک معنی نداره) رو از batch حذف می‌کنیم، ولی
    // اندیسشون رو نگه می‌داریم تا بعداً بدونیم کدوم نتیجه مالِ کدوم کوئریه
    const activeIndexes = [];
    const activeStmts = [];
    batchStmts.forEach((stmt, i) => {
      if (stmt) { activeIndexes.push(i); activeStmts.push(stmt); }
    });
    const results = activeStmts.length > 0 ? await env.D1.batch(activeStmts) : [];
    const resultByIndex = {};
    activeIndexes.forEach((originalIndex, i) => { resultByIndex[originalIndex] = results[i]; });

    if (resultByIndex[0]) {
      for (const row of resultByIndex[0].results || []) {
        if (row.avatar_file_id) avatarMap[row.username] = row.avatar_file_id;
      }
    }
    if (resultByIndex[1]) {
      for (const row of resultByIndex[1].results || []) voteMap[row.post_id] = row.action;
    }
    if (resultByIndex[2]) {
      for (const row of resultByIndex[2].results || []) likeMap[row.post_id] = true;
    }
    if (resultByIndex[3]) {
      for (const row of resultByIndex[3].results || []) commentCountMap[row.post_id] = row.c;
    }
  }

  const enrichedPosts = pagePosts.map((p) => ({
    ...p,
    avatar_file_id: avatarMap[p.username] || null,
    upvotes: p.upvotes || 0,
    downvotes: p.downvotes || 0,
    likes: p.likes || 0,
    userVote: voteMap[p.id] || null,
    liked: !!likeMap[p.id],
    comment_count: commentCountMap[p.id] || 0,
    pinned: !!p.pinned,
  }));

  return {
    posts: enrichedPosts,
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  };
}

async function handleFeed(request, env) {
  const url = new URL(request.url);
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
  const pageSize = Math.min(Math.max(parseInt(url.searchParams.get("pageSize") || "10", 10), 1), 50);
  const filter = url.searchParams.get("filter") || "all"; // all | media | text | audio
  const usernameFilter = url.searchParams.get("username");
  const excludeAudio = url.searchParams.get("excludeAudio") === "1";
  const sort = url.searchParams.get("sort") || "date"; // date | popular (بر اساس آپ‌ووت) | random (برای صفِ پخش رندوم)
  // لیست شناسه‌هایی که باید از نتیجه کنار گذاشته بشن (برای صفِ رندوم پلیر، تا آهنگ تکراری اضافه نشه)
  const excludeIdsParam = url.searchParams.get("exclude");
  const excludeIds = excludeIdsParam
    ? excludeIdsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 300)
    : [];
  // فقط پست‌هایی که این کاربر تا حالا تو Deels ندیده (برای فازِ اولِ الگوریتمِ Deels)
  const unseenOnly = url.searchParams.get("unseenOnly") === "1";

  // دهات کاملاً خصوصیه؛ فید فقط برای کاربر لاگین‌کرده قابل مشاهده‌ست
  const viewerUsername = await getUserFromToken(request, env);
  if (!viewerUsername) return json({ error: "ابتدا وارد شو" }, 401);

  const feedResult = await fetchFeedPage(env, viewerUsername, {
    page, pageSize, filter, usernameFilter, excludeAudio, sort, excludeIds, unseenOnly,
  });

  return json({ ok: true, ...feedResult });
}

// ---------- ثبتِ پست‌هایی که کاربر تو Deels دیده (برای فازِ اولِ الگوریتم: اول ندیده‌ها، بعد دیده‌ها) ----------
// جدولِ لازم (یک‌بار با wrangler d1 execute اجرا بشه):
//   CREATE TABLE IF NOT EXISTS deel_views (
//     username TEXT NOT NULL,
//     post_id TEXT NOT NULL,
//     seen_at INTEGER NOT NULL,
//     PRIMARY KEY (username, post_id)
//   );
async function handleMarkDeelsSeen(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "Unauthorized" }, 401);
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === "string" && id).slice(0, 50) : [];
  if (ids.length === 0) return json({ ok: true });
  const now = Date.now();
  try {
    await env.D1.batch(
      ids.map((id) =>
        env.D1.prepare("INSERT OR IGNORE INTO deel_views (username, post_id, seen_at) VALUES (?, ?, ?)").bind(username, id, now)
      )
    );
  } catch (e) {
    // اگه جدول هنوز ساخته نشده باشه بی‌صدا رد می‌شیم؛ فقط یعنی فازِ اول هربار از نو حساب می‌شه، قفل که نمی‌کنه
  }
  return json({ ok: true });
}

// #endregion
// #region رای دادن به پست (آپ‌ووت/داون‌ووت)
// ---------- رای دادن به پست (آپ‌ووت/داون‌ووت) ----------
async function handleVote(request, env, ctx) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }

  const postId = (body.post_id || "").toString();
  const action = (body.action || "").toString();
  if (!postId) return json({ error: "شناسه پست لازمه" }, 400);
  if (!["up", "down"].includes(action)) return json({ error: "نوع رای نامعتبره" }, 400);

  // قبلاً «مالکِ پست» و «رایِ قبلیِ همین کاربر» دو تا کوئریِ جدا و پشتِ‌سرِهم بودن؛ چون به هم وابسته
  // نیستن، با یه LEFT JOIN تو یه رفت‌وبرگشتِ واحد می‌گیریمشون.
  const info = await env.D1.prepare(
    "SELECT posts.username AS post_owner, votes.action AS existing_action " +
    "FROM posts LEFT JOIN votes ON votes.post_id = posts.id AND votes.username = ? " +
    "WHERE posts.id = ?"
  ).bind(username, postId).first();
  if (!info) return json({ error: "پست پیدا نشد" }, 404);
  const post = { username: info.post_owner };
  const existing = info.existing_action || null;

  // به‌جای خوندنِ upvotes/downvotes و نوشتنِ دوباره‌شون (که زیر بار همزمان می‌تونه یه رای رو گم کنه)،
  // مستقیم با `col = col ± 1` توی خودِ SQL افزایش/کاهش می‌دیم؛ این عملیات توی SQLite/D1 اتمیکه.
  // آخرین UPDATE هر مسیر با RETURNING مقدار نهاییِ واقعی (بعد از کامیت کل batch) رو برمی‌گردونه.
  let userVote;
  let stmts;
  if (existing === action) {
    // همون رای قبلی دوباره زده شده => لغو رای
    const col = action === "up" ? "upvotes" : "downvotes";
    stmts = [
      env.D1.prepare("DELETE FROM votes WHERE post_id = ? AND username = ?").bind(postId, username),
      env.D1.prepare(`UPDATE posts SET ${col} = MAX(0, ${col} - 1) WHERE id = ? RETURNING upvotes, downvotes`).bind(postId),
    ];
    userVote = null;
  } else {
    stmts = [];
    if (existing === "up") stmts.push(env.D1.prepare("UPDATE posts SET upvotes = MAX(0, upvotes - 1) WHERE id = ?").bind(postId));
    else if (existing === "down") stmts.push(env.D1.prepare("UPDATE posts SET downvotes = MAX(0, downvotes - 1) WHERE id = ?").bind(postId));
    stmts.push(env.D1.prepare("INSERT OR REPLACE INTO votes (post_id, username, action) VALUES (?, ?, ?)").bind(postId, username, action));
    const newCol = action === "up" ? "upvotes" : "downvotes";
    stmts.push(env.D1.prepare(`UPDATE posts SET ${newCol} = ${newCol} + 1 WHERE id = ? RETURNING upvotes, downvotes`).bind(postId));
    userVote = action;
  }

  const batchResults = await env.D1.batch(stmts);
  const finalRow = batchResults[batchResults.length - 1].results[0];
  const upvotes = finalRow.upvotes || 0;
  const downvotes = finalRow.downvotes || 0;

  // اعلان فقط برای آپ‌ووت جدید (نه لغو رای، نه داون‌ووت) و نه به خود صاحب پست. ساختِ اعلان (که خودش
  // هم یه INSERT دیگه‌ست هم یه فراخوانیِ Web Push به سرورهای خارجی) دیگه جلوی جوابِ رای رو نمی‌گیره؛
  // با ctx.waitUntil در پس‌زمینه انجام می‌شه، پس کاربر بلافاصله بعد از رای‌دادن جواب می‌گیره.
  if (userVote === "up" && existing !== "up" && post.username && post.username !== username) {
    const notifyPromise = createNotification(env, post.username, {
      type: "vote",
      post_id: postId,
      from_username: username,
    });
    if (ctx) ctx.waitUntil(notifyPromise);
    else await notifyPromise;
  }

  return json({
    ok: true,
    upvotes,
    downvotes,
    score: upvotes - downvotes,
    userVote,
  });
}

// #endregion
// #region لایک (سیو) کردن پست
// ---------- لایک (سیو) کردن پست ----------
async function handleLike(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }

  const postId = (body.post_id || "").toString();
  if (!postId) return json({ error: "شناسه پست لازمه" }, 400);

  // مثلِ رای‌دهی: «پست وجود داره؟» و «کاربر قبلاً لایک کرده؟» با یه LEFT JOIN تو یه رفت‌وبرگشت
  const info = await env.D1.prepare(
    "SELECT posts.id AS post_id, likes.post_id AS like_row " +
    "FROM posts LEFT JOIN likes ON likes.post_id = posts.id AND likes.username = ? " +
    "WHERE posts.id = ?"
  ).bind(username, postId).first();
  if (!info) return json({ error: "پست پیدا نشد" }, 404);
  const existing = !!info.like_row;

  // مثل رای‌دهی، اینجا هم `likes = likes ± 1` مستقیم توی SQL انجام می‌شه (اتمیک) به‌جای خوندن-سپس-نوشتن
  let liked;
  let stmts;
  if (existing) {
    stmts = [
      env.D1.prepare("DELETE FROM likes WHERE post_id = ? AND username = ?").bind(postId, username),
      env.D1.prepare("UPDATE posts SET likes = MAX(0, likes - 1) WHERE id = ? RETURNING likes").bind(postId),
    ];
    liked = false;
  } else {
    stmts = [
      env.D1.prepare("INSERT INTO likes (post_id, username) VALUES (?, ?)").bind(postId, username),
      env.D1.prepare("UPDATE posts SET likes = likes + 1 WHERE id = ? RETURNING likes").bind(postId),
    ];
    liked = true;
  }

  const batchResults = await env.D1.batch(stmts);
  const likes = batchResults[batchResults.length - 1].results[0].likes || 0;

  return json({ ok: true, likes, liked });
}

// #endregion
// #region گرفتن پروفایل یک کاربر (عمومی)
// ---------- گرفتن پروفایل یک کاربر (عمومی) ----------
// #endregion
// #region جستجوی کاربران (برای اتوکامپلیتِ «شروع چت جدید» و «افزودن عضو به گروه»)
// ---------- جستجوی کاربران ----------
async function handleUserSearch(request, env) {
  const viewer = await getUserFromToken(request, env);
  if (!viewer) return json({ error: "ابتدا وارد شو" }, 401);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 40);
  if (!q) return json({ users: [] });

  const rows = await env.D1.prepare(
    "SELECT username FROM users WHERE username LIKE ? AND (banned IS NULL OR banned = 0) AND username != ? ORDER BY username ASC LIMIT 15"
  ).bind(`%${q}%`, viewer).all();

  const usernames = (rows.results || []).map((r) => r.username);
  const avatarMap = {};
  if (usernames.length) {
    const placeholders = usernames.map(() => "?").join(",");
    const profRows = await env.D1.prepare(
      `SELECT username, avatar_file_id FROM profiles WHERE username IN (${placeholders})`
    ).bind(...usernames).all();
    for (const row of profRows.results || []) {
      if (row.avatar_file_id) avatarMap[row.username] = row.avatar_file_id;
    }
  }

  return json({ users: usernames.map((u) => ({ username: u, avatar_file_id: avatarMap[u] || null })) });
}

// #endregion
// #region رستوران/آشپزخونه/یخچال
// یادداشتِ مایگریشن (یه‌بار توی D1 Console اجرا شه):
//   CREATE TABLE chefs (username TEXT PRIMARY KEY, appointed_at INTEGER);
//   CREATE TABLE restaurant_items (
//     id TEXT PRIMARY KEY, chef_username TEXT NOT NULL, file_id TEXT NOT NULL,
//     title TEXT, description TEXT, price_points INTEGER NOT NULL, created_at INTEGER NOT NULL,
//     active INTEGER NOT NULL DEFAULT 1
//   );
//   CREATE TABLE fridge_items (
//     id TEXT PRIMARY KEY, username TEXT NOT NULL, restaurant_item_id TEXT NOT NULL,
//     title TEXT, file_id TEXT, acquired_at INTEGER NOT NULL
//   );
//   ALTER TABLE fridge_items ADD COLUMN price_points INTEGER;
//   ALTER TABLE fridge_items ADD COLUMN description TEXT;

// یادداشتِ مایگریشن (یه‌بار توی D1 Console اجرا شه):
//   CREATE TABLE birthday_claims (username TEXT PRIMARY KEY, claimed_at INTEGER NOT NULL);

// پاپ‌آپِ تولدِ alucardswifey: وضعیتِ فعلیِ کاربر (که ببینه اصلاً باید پاپ‌آپ رو نشون بده یا نه).
// عمداً سمتِ سرور چک می‌شه نه فقط localStorage، وگرنه با پاک‌کردنِ کش/عوض‌کردنِ مرورگر هر بار دوباره میاد.
async function handleBirthdayStatus(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "لطفاً وارد شو" }, 401);
  const row = await env.D1.prepare("SELECT username FROM birthday_claims WHERE username = ?").bind(username).first();
  return json({ ok: true, claimed: !!row });
}

// خوردنِ کیک: فقط یه‌بار برای هر کاربر جواب می‌ده؛ ۱۰ دهپوینت کم می‌کنه (حتی اگه منفی بشه، طبقِ
// خواسته). ایمن دربرابرِ درخواستِ همزمان/تکراری: اگه قبلاً claim شده، دوباره کم نمی‌کنه.
async function handleBirthdayClaim(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "لطفاً وارد شو" }, 401);

  const already = await env.D1.prepare("SELECT username FROM birthday_claims WHERE username = ?").bind(username).first();
  if (already) {
    const balRow = await env.D1.prepare("SELECT points FROM dehpoints WHERE username = ?").bind(username).first();
    return json({ ok: true, alreadyClaimed: true, dehpoints: (balRow && balRow.points) || 0 });
  }

  const now = Date.now();
  try {
    await env.D1.batch([
      env.D1.prepare("INSERT INTO birthday_claims (username, claimed_at) VALUES (?, ?)").bind(username, now),
      env.D1.prepare(
        `INSERT INTO dehpoints (username, points, updated_at) VALUES (?, -10, ?)
         ON CONFLICT(username) DO UPDATE SET points = points - 10, updated_at = excluded.updated_at`
      ).bind(username, now),
    ]);
  } catch (err) {
    // اگه بینِ چکِ بالا و این batch یه درخواستِ همزمانِ دیگه زودتر claim کرده باشه (ریس‌کاندیشنِ نادر)،
    // اینسرتِ birthday_claims با خطای PRIMARY KEY شکست می‌خوره؛ یعنی همین الان جای دیگه claim شده
    const balRow = await env.D1.prepare("SELECT points FROM dehpoints WHERE username = ?").bind(username).first();
    return json({ ok: true, alreadyClaimed: true, dehpoints: (balRow && balRow.points) || 0 });
  }

  const balRow = await env.D1.prepare("SELECT points FROM dehpoints WHERE username = ?").bind(username).first();
  return json({ ok: true, dehpoints: (balRow && balRow.points) || 0 });
}

async function isChefUser(env, username) {
  if (isSuperAdmin(username)) return true; // مالکِ سایت خودش هم می‌تونه غذا سرو کنه
  const row = await env.D1.prepare("SELECT username FROM chefs WHERE username = ?").bind(username).first();
  return !!row;
}

async function handleChefStatus(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "لطفاً وارد شو" }, 401);
  return json({ ok: true, isChef: await isChefUser(env, username) });
}

async function handleAdminChefsList(request, env) {
  const username = await getUserFromToken(request, env);
  if ((await getAdminRank(env, username)) !== 1) return json({ error: "دسترسی نداری" }, 403);
  const rows = await env.D1.prepare("SELECT username, appointed_at FROM chefs ORDER BY appointed_at DESC").all();
  return json({ ok: true, chefs: rows.results || [] });
}

async function handleAdminChefAdd(request, env) {
  const username = await getUserFromToken(request, env);
  if ((await getAdminRank(env, username)) !== 1) return json({ error: "دسترسی نداری" }, 403);
  const body = await request.json().catch(() => ({}));
  const target = (body.username || "").toString().trim();
  if (!target) return json({ error: "یوزرنیم نامعتبره" }, 400);
  await env.D1.prepare("INSERT INTO chefs (username, appointed_at) VALUES (?, ?) ON CONFLICT(username) DO NOTHING")
    .bind(target, Date.now())
    .run();
  return json({ ok: true });
}

async function handleAdminChefRemove(request, env) {
  const username = await getUserFromToken(request, env);
  if ((await getAdminRank(env, username)) !== 1) return json({ error: "دسترسی نداری" }, 403);
  const body = await request.json().catch(() => ({}));
  const target = (body.username || "").toString().trim();
  await env.D1.prepare("DELETE FROM chefs WHERE username = ?").bind(target).run();
  return json({ ok: true });
}

async function handleRestaurantMenu(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "لطفاً وارد شو" }, 401);
  const rows = await env.D1.prepare(
    "SELECT id, chef_username, file_id, title, description, price_points, created_at FROM restaurant_items WHERE active = 1 ORDER BY created_at DESC"
  ).all();
  return json({ ok: true, items: rows.results || [] });
}

async function handleRestaurantBuy(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "لطفاً وارد شو" }, 401);
  const body = await request.json().catch(() => ({}));
  const itemId = (body.itemId || "").toString().trim();
  if (!itemId) return json({ error: "غذا نامعتبره" }, 400);

  const item = await env.D1.prepare("SELECT * FROM restaurant_items WHERE id = ? AND active = 1").bind(itemId).first();
  if (!item) return json({ error: "این غذا دیگه موجود نیست" }, 404);
  if (item.chef_username === username) return json({ error: "نمی‌تونی غذای خودت رو بخری" }, 400);

  const balanceRow = await env.D1.prepare("SELECT points FROM dehpoints WHERE username = ?").bind(username).first();
  const balance = (balanceRow && balanceRow.points) || 0;
  if (balance < item.price_points) return json({ error: "دهپوینتِ کافی نداری" }, 400);

  // یک‌سومِ قیمت (رند به بالا) به‌عنوانِ اجاره برای مالکِ سایت، بقیه برای سرآشپز
  const chefShare = Math.floor((item.price_points * 2) / 3);
  const adminShare = item.price_points - chefShare;
  const now = Date.now();
  const fridgeId = `${now}_${randomHex(4)}`;

  await env.D1.batch([
    env.D1.prepare("UPDATE dehpoints SET points = points - ?, updated_at = ? WHERE username = ?").bind(item.price_points, now, username),
    env.D1.prepare(
      `INSERT INTO dehpoints (username, points, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET points = points + excluded.points, updated_at = excluded.updated_at`
    ).bind(item.chef_username, chefShare, now),
    env.D1.prepare(
      `INSERT INTO dehpoints (username, points, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET points = points + excluded.points, updated_at = excluded.updated_at`
    ).bind(SUPER_ADMIN_USERNAME, adminShare, now),
    env.D1.prepare(
      "INSERT INTO fridge_items (id, username, restaurant_item_id, title, file_id, acquired_at, price_points, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(fridgeId, username, item.id, item.title, item.file_id, now, item.price_points, item.description || null),
  ]);

  return json({ ok: true });
}

async function handleRestaurantFridge(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "لطفاً وارد شو" }, 401);
  const rows = await env.D1.prepare(
    "SELECT id, title, file_id, acquired_at, price_points, description FROM fridge_items WHERE username = ? ORDER BY acquired_at DESC"
  )
    .bind(username)
    .all();
  return json({ ok: true, items: rows.results || [] });
}
// #endregion
// #region پروفایل عمومیِ یک کاربر
// یادداشت مایگریشن (یه‌بار توی D1 Console اجرا شه):
//   ALTER TABLE profiles ADD COLUMN banner_file_id TEXT;
//   ALTER TABLE profiles ADD COLUMN chat_bg_file_id TEXT;
async function handleGetProfile(request, env) {
  const url = new URL(request.url);
  const username = url.searchParams.get("username");
  if (!username) return json({ error: "نام کاربری لازمه" }, 400);

  // دهات کاملاً خصوصیه؛ پروفایل فقط برای کاربر لاگین‌کرده قابل مشاهده‌ست
  const viewer = await getUserFromToken(request, env);
  if (!viewer) return json({ error: "ابتدا وارد شو" }, 401);

  const user = await env.D1.prepare("SELECT username, referred_by FROM users WHERE username = ?").bind(username).first();
  if (!user) return json({ error: "کاربر پیدا نشد" }, 404);

  const profile = await env.D1.prepare("SELECT * FROM profiles WHERE username = ?").bind(username).first();

  // مجموع آپ‌ووت و لایکِ دریافتی روی همه‌ی پست‌های این کاربر، برای نمایش تو صفحه‌ی پروفایل
  const totals = await env.D1.prepare(
    "SELECT COALESCE(SUM(upvotes), 0) AS totalUpvotes, COALESCE(SUM(likes), 0) AS totalLikes FROM posts WHERE username = ?"
  ).bind(username).first();

  // اگه این کاربر تویِ محضر ازدواج کرده، عنوانِ انتخابیِ خودش (شوهر/همسر) و اطلاعاتِ همسرش
  // (برای نمایشِ آواتار/اسمِ قابل‌کلیک تو پروفایل) رو هم برمی‌گردونیم
  let marriageTitle = null;
  let spouse = null;
  const marriageRow = await env.D1.prepare(
    "SELECT * FROM marriage_proposals WHERE status = 'accepted' AND (from_username = ? OR to_username = ?)"
  ).bind(username, username).first();
  if (marriageRow) {
    const isFrom = marriageRow.from_username === username;
    marriageTitle = isFrom ? marriageRow.from_title : oppositeMarriageTitle(marriageRow.from_title);
    const spouseUsername = isFrom ? marriageRow.to_username : marriageRow.from_username;
    const spouseTitle = isFrom ? oppositeMarriageTitle(marriageRow.from_title) : marriageRow.from_title;
    const spouseProfile = await env.D1.prepare("SELECT avatar_file_id FROM profiles WHERE username = ?").bind(spouseUsername).first();
    spouse = {
      username: spouseUsername,
      title: spouseTitle,
      avatar_file_id: (spouseProfile && spouseProfile.avatar_file_id) || null,
    };
  }

  // امتیازِ dehpoints (مشترک با Workerِ بازی‌ها، از همون جدولِ D1)
  let dehpoints = 0;
  try {
    const pointsRow = await env.D1.prepare("SELECT points FROM dehpoints WHERE username = ?").bind(username).first();
    dehpoints = (pointsRow && pointsRow.points) || 0;
  } catch (e) {
    // اگه جدولِ dehpoints هنوز ساخته نشده باشه، صفر برمی‌گردونیم
  }

  // اگه پروفایل خودش نیست، چک می‌کنیم قبلاً گزارشش داده یا نه
  let reportedByMe = false;
  if (viewer !== username) {
    const existingReport = await env.D1.prepare(
      "SELECT id FROM reports WHERE reporter_username = ? AND target_username = ?"
    ).bind(viewer, username).first();
    reportedByMe = !!existingReport;
  }

  return json({
    ok: true,
    profile: {
      username,
      bio: (profile && profile.bio) || "",
      avatar_file_id: (profile && profile.avatar_file_id) || null,
      banner_file_id: (profile && profile.banner_file_id) || null,
      chat_bg_file_id: (profile && profile.chat_bg_file_id) || null,
      theme: normalizeThemeValue((profile && profile.theme) || "purple-dark"),
      font: normalizeFontValue(profile && profile.font),
      total_upvotes: (totals && totals.totalUpvotes) || 0,
      total_likes: (totals && totals.totalLikes) || 0,
      reported_by_me: reportedByMe,
      referred_by: user.referred_by || null,
      marriage_title: marriageTitle,
      spouse,
      dehpoints,
    },
  });
}

// #endregion
// #region ذخیره تم انتخابی کاربر
// ---------- ذخیره تم انتخابی کاربر ----------
// هر تم از دو بخش «رنگ‌بندی-حالت» تشکیل شده، مثلاً "emerald-dark". نگاشتِ زیر مقادیرِ قدیمیِ
// تک‌کلمه‌ای (قبل از اضافه‌شدنِ حالت روشن/تاریک) رو به معادلِ جدیدشون تبدیل می‌کنه.
const THEME_HUES = ["purple", "walnut", "red", "blue", "pure", "emerald", "berry", "police", "fall"];
const VALID_THEMES = THEME_HUES.flatMap((h) => [`${h}-dark`, `${h}-light`]).concat(["purple-dark-bg", "purple-light-bg"]);
const LEGACY_THEME_MAP = { purple: "purple-dark", dark: "walnut-dark", red: "red-dark", blue: "blue-dark", teal: "pure-dark", emerald: "emerald-dark" };
function normalizeThemeValue(theme) {
  if (!theme) return "purple-dark";
  return LEGACY_THEME_MAP[theme] || theme;
}

// ---------- فونتِ سایت (مستقل از تم رنگی) ----------
// یادداشت مایگریشن (یه‌بار توی D1 Console اجرا شه):
//   ALTER TABLE profiles ADD COLUMN font TEXT;
const VALID_FONTS = ["vazirmatn", "plex", "handjet"];
function normalizeFontValue(font) {
  return VALID_FONTS.includes(font) ? font : "vazirmatn";
}

async function handleUpdateFont(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }

  const font = (body.font || "").toString();
  if (!VALID_FONTS.includes(font)) {
    return json({ error: "فونت نامعتبره" }, 400);
  }

  await env.D1.prepare(
    `INSERT INTO profiles (username, bio, avatar_file_id, banner_file_id, font, theme, updated_at) VALUES (?, '', NULL, NULL, ?, ?, ?)
     ON CONFLICT(username) DO UPDATE SET font = excluded.font, updated_at = excluded.updated_at`
  ).bind(username, font, "purple-dark", Date.now()).run();

  return json({ ok: true, font });
}

async function handleUpdateTheme(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }

  const theme = normalizeThemeValue((body.theme || "").toString());
  if (!VALID_THEMES.includes(theme)) {
    return json({ error: "تم نامعتبره" }, 400);
  }

  await env.D1.prepare(
    `INSERT INTO profiles (username, bio, avatar_file_id, banner_file_id, theme, updated_at) VALUES (?, '', NULL, NULL, ?, ?)
     ON CONFLICT(username) DO UPDATE SET theme = excluded.theme, updated_at = excluded.updated_at`
  ).bind(username, theme, Date.now()).run();

  return json({ ok: true, theme });
}

// #endregion
// #region ذخیره پروفایل خود کاربر (بایو / آواتار / بنر)
// ---------- ذخیره پروفایل خود کاربر (بایو / آواتار / بنر) ----------
async function handleUpdateProfile(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const form = await request.formData();
  const bio = (form.get("bio") || "").toString().trim().slice(0, 300);
  const avatarFile = form.get("avatar");
  const hasAvatar = avatarFile && typeof avatarFile !== "string" && avatarFile.size > 0;
  const bannerFile = form.get("banner");
  const hasBanner = bannerFile && typeof bannerFile !== "string" && bannerFile.size > 0;

  const existing = await env.D1.prepare("SELECT * FROM profiles WHERE username = ?").bind(username).first();
  let avatarFileId = (existing && existing.avatar_file_id) || null;
  let bannerFileId = (existing && existing.banner_file_id) || null;
  const theme = normalizeThemeValue((existing && existing.theme) || "purple-dark");

  if (hasAvatar) {
    if (!avatarFile.type.startsWith("image/")) {
      return json({ error: "آواتار باید یه فایل عکس باشه" }, 400);
    }
    if (!(await verifyFileMatchesCategory(avatarFile, "image"))) {
      return json({ error: "محتوای فایل با نوع اعلام‌شده‌اش مطابقت نداره" }, 400);
    }
    if (avatarFile.size > 5 * 1024 * 1024) {
      return json({ error: "حجم عکس آواتار نباید بیشتر از ۵ مگابایت باشه" }, 400);
    }
    if (!(await checkRateLimit(env, "avatar_upload", username, 6, 600))) {
      return json({ error: "آپدیت آواتار زیاد بوده، چند دقیقه دیگه امتحان کن" }, 429);
    }
    try {
      const result = await sendTelegramFile(env, "sendPhoto", "photo", avatarFile, `آواتار جدید — ${username}`);
      avatarFileId = extractFileId("photo", result);
    } catch (err) {
      console.error("خطای آپلود آواتار به تلگرام:", err);
      return json({ error: "آپلود آواتار ناموفق بود، دوباره امتحان کن" }, 502);
    }
  }

  if (hasBanner) {
    if (!bannerFile.type.startsWith("image/")) {
      return json({ error: "بنر باید یه فایل عکس باشه" }, 400);
    }
    if (!(await verifyFileMatchesCategory(bannerFile, "image"))) {
      return json({ error: "محتوای فایل با نوع اعلام‌شده‌اش مطابقت نداره" }, 400);
    }
    if (bannerFile.size > 8 * 1024 * 1024) {
      return json({ error: "حجم عکس بنر نباید بیشتر از ۸ مگابایت باشه" }, 400);
    }
    if (!(await checkRateLimit(env, "banner_upload", username, 6, 600))) {
      return json({ error: "آپدیت بنر زیاد بوده، چند دقیقه دیگه امتحان کن" }, 429);
    }
    try {
      const result = await sendTelegramFile(env, "sendPhoto", "photo", bannerFile, `بنر جدید — ${username}`);
      bannerFileId = extractFileId("photo", result);
    } catch (err) {
      console.error("خطای آپلود بنر به تلگرام:", err);
      return json({ error: "آپلود بنر ناموفق بود، دوباره امتحان کن" }, 502);
    }
  }

  await env.D1.prepare(
    `INSERT INTO profiles (username, bio, avatar_file_id, banner_file_id, theme, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(username) DO UPDATE SET bio = excluded.bio, avatar_file_id = excluded.avatar_file_id, banner_file_id = excluded.banner_file_id, updated_at = excluded.updated_at`
  ).bind(username, bio, avatarFileId, bannerFileId, theme, Date.now()).run();

  return json({ ok: true, profile: { username, bio, avatar_file_id: avatarFileId, banner_file_id: bannerFileId, theme } });
}

// #endregion
// #region پس‌زمینه‌ی چت (یه عکسِ مشترک برای همه‌ی چت‌ها/گروه‌های کاربر)
// ---------- آپلود/جایگزینیِ پس‌زمینه‌ی چت ----------
// عکس از سمتِ کلاینت از قبل با نسبتِ صفحه‌ی دیوایسِ خودش کراپ شده؛ اینجا فقط اعتبارسنجی و ذخیره می‌کنیم.
async function handleUpdateChatBg(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const form = await request.formData();
  const bgFile = form.get("chat_bg");
  if (!bgFile || typeof bgFile === "string" || bgFile.size === 0) {
    return json({ error: "عکسی ارسال نشده" }, 400);
  }
  if (!bgFile.type.startsWith("image/")) {
    return json({ error: "پس‌زمینه باید یه فایل عکس باشه" }, 400);
  }
  if (!(await verifyFileMatchesCategory(bgFile, "image"))) {
    return json({ error: "محتوای فایل با نوع اعلام‌شده‌اش مطابقت نداره" }, 400);
  }
  if (bgFile.size > 8 * 1024 * 1024) {
    return json({ error: "حجم عکسِ پس‌زمینه نباید بیشتر از ۸ مگابایت باشه" }, 400);
  }
  if (!(await checkRateLimit(env, "chatbg_upload", username, 10, 600))) {
    return json({ error: "آپدیت پس‌زمینه زیاد بوده، چند دقیقه دیگه امتحان کن" }, 429);
  }

  let chatBgFileId;
  try {
    const result = await sendTelegramFile(env, "sendPhoto", "photo", bgFile, `پس‌زمینه‌ی چت جدید — ${username}`);
    chatBgFileId = extractFileId("photo", result);
  } catch (err) {
    console.error("خطای آپلود پس‌زمینه‌ی چت به تلگرام:", err);
    return json({ error: "آپلود پس‌زمینه ناموفق بود، دوباره امتحان کن" }, 502);
  }

  const existing = await env.D1.prepare("SELECT * FROM profiles WHERE username = ?").bind(username).first();
  const theme = normalizeThemeValue((existing && existing.theme) || "purple-dark");
  await env.D1.prepare(
    `INSERT INTO profiles (username, bio, avatar_file_id, banner_file_id, chat_bg_file_id, theme, updated_at) VALUES (?, '', NULL, NULL, ?, ?, ?)
     ON CONFLICT(username) DO UPDATE SET chat_bg_file_id = excluded.chat_bg_file_id, updated_at = excluded.updated_at`
  ).bind(username, chatBgFileId, theme, Date.now()).run();

  return json({ ok: true, chat_bg_file_id: chatBgFileId });
}

// ---------- حذفِ پس‌زمینه‌ی چت (برگشت به حالتِ پیش‌فرض) ----------
async function handleRemoveChatBg(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  await env.D1.prepare("UPDATE profiles SET chat_bg_file_id = NULL, updated_at = ? WHERE username = ?")
    .bind(Date.now(), username).run();

  return json({ ok: true });
}

// #endregion
// #region وضعیت ادمین‌بودن کاربر جاری
// ---------- وضعیت ادمین‌بودن کاربر جاری ----------
async function handleAdminMe(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const rank = await getAdminRank(env, username);
  return json({ ok: true, admin_rank: rank });
}

// ---------- بوت‌استرپِ صفحه‌ی اصلی: چهارتا درخواستِ جداگانه‌ی لود اول (پروفایل/تم، وضعیتِ ادمین،
// تعدادِ اعلانِ نخونده، و صفحه‌ی اولِ فید) رو تویِ یه رفت‌وبرگشتِ HTTP جمع می‌کنه ----------
// این مخصوصاً روی کانکشن‌های کند/ناپایدار مهمه: هر رفت‌وبرگشتِ اضافه (نه لزوماً حجمِ دیتا) خودش
// یه‌جور تاخیره؛ ادغامِ ۴ تا درخواست تو ۱ تا، این تاخیرِ تکراری رو حذف می‌کنه.
// ---------- changelog: یه‌بار به هر کاربر نشون داده می‌شه (نه هر دستگاه؛ روی خودِ اکانت ذخیره می‌شه) ----------
// نیازمندیِ D1 (یک‌بار اجرا کن):
//   ALTER TABLE users ADD COLUMN seen_changelog_version TEXT;
// هر وقت چیزِ تازه‌ای اضافه کردی، این عدد رو زیاد کن و آیتم‌های جدید رو به آرایه اضافه کن؛ به‌محضِ
// اینکه CHANGELOG_VERSION از مقدارِ ذخیره‌شده‌ی کاربر بزرگ‌تر باشه، دفعه‌ی بعد که بوت‌استرپ می‌شه
// پنجره‌ی «چه خبر بود» یه‌بار نشونش داده می‌شه
const CHANGELOG_VERSION = "1";
const CHANGELOG_ENTRIES = [
  { emoji: "🎟️", text: "برای ثبت‌نام حالا کد معرف لازمه؛ از تنظیمات می‌تونی کدِ خودت رو بسازی و به بقیه بدی" },
  { emoji: "🔔", text: "نوتیفیکیشن رو اپِ اندروید هم فعال شد" },
  { emoji: "🖼️", text: "پیش‌نمایشِ عکس/فیلم/آهنگ قبل از ارسال تو چت، درست مثلِ گالری" },
  { emoji: "🎵", text: "پلیرِ تازه‌ی آهنگ با موج‌نما و سیک‌بار، برای پیام‌های صوتیِ چت" },
  { emoji: "📌", text: "پین‌کردنِ پیام تو گروه‌ها" },
  { emoji: "😍", text: "ری‌اکشن با ایموجی رو پیام‌های چت" },
  { emoji: "📣", text: "منشن‌کردنِ اعضا با @یوزرنیم تو گروه، با نوتیفِ مخصوصِ خودش" },
  { emoji: "🔍", text: "جست‌وجو داخلِ هر مکالمه" },
  { emoji: "🔕", text: "سایلنت‌کردنِ نوتیفِ یه گفتگوی خاص، بدونِ نیاز به بلاک‌کردن" },
  { emoji: "↪️", text: "فورواردِ پیام بینِ چت‌ها و گروه‌ها" },
];

const CHANGELOG_KV_KEY = "changelog:current";
// عمرِ خیلی طولانی (~۱۰ سال) چون این عملاً یه تنظیمِ دائمیه، نه یه کشِ موقت؛ jsonِ ذخیره‌شده اینه:
// { version: "...", entries: [{ emoji, text }, ...] }
const CHANGELOG_KV_TTL_SECONDS = 315360000;

async function getCurrentChangelog(env) {
  try {
    const raw = await kvGet(env, CHANGELOG_KV_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version && Array.isArray(parsed.entries)) return parsed;
    }
  } catch (e) {}
  return { version: CHANGELOG_VERSION, entries: CHANGELOG_ENTRIES };
}

async function handleBootstrap(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const url = new URL(request.url);
  const pageSize = Math.min(Math.max(parseInt(url.searchParams.get("pageSize") || "10", 10), 1), 50);

  const [adminRank, profileRow, unreadRow, feedResult, changelogRow, currentChangelog] = await Promise.all([
    getAdminRank(env, username),
    env.D1.prepare("SELECT * FROM profiles WHERE username = ?").bind(username).first(),
    (async () => {
      const lastReadRow = await env.D1.prepare("SELECT last_read FROM notif_read WHERE username = ?").bind(username).first();
      const lastRead = lastReadRow ? lastReadRow.last_read : 0;
      return env.D1.prepare("SELECT COUNT(*) as c FROM notifications WHERE to_username = ? AND date > ?").bind(username, lastRead).first();
    })(),
    fetchFeedPage(env, username, { page: 1, pageSize, filter: "media", sort: "date" }),
    env.D1.prepare("SELECT seen_changelog_version FROM users WHERE username = ?").bind(username).first(),
    getCurrentChangelog(env),
  ]);

  const seenChangelogVersion = (changelogRow && changelogRow.seen_changelog_version) || null;

  return json({
    ok: true,
    admin_rank: adminRank,
    profile: {
      username,
      avatar_file_id: (profileRow && profileRow.avatar_file_id) || null,
      chat_bg_file_id: (profileRow && profileRow.chat_bg_file_id) || null,
      theme: normalizeThemeValue((profileRow && profileRow.theme) || "purple-dark"),
      font: normalizeFontValue(profileRow && profileRow.font),
    },
    unread_notifications: (unreadRow && unreadRow.c) || 0,
    feed: feedResult,
    changelog: {
      version: currentChangelog.version,
      seen: seenChangelogVersion === currentChangelog.version,
      entries: currentChangelog.entries,
    },
  });
}

async function handleChangelogSeen(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  const current = await getCurrentChangelog(env);
  await env.D1.prepare("UPDATE users SET seen_changelog_version = ? WHERE username = ?").bind(current.version, username).run();
  return json({ ok: true });
}

// ---------- فقط مالک سایت (Aghey): فرستادنِ دستیِ یه changelog تازه برای همه‌ی کاربرا ----------
// چون هر کاربر نسخه‌ی changelog ای که دیده رو تو ستونِ seen_changelog_version خودش داره، کافیه یه
// نسخه‌ی جدید (اینجا timestamp همین لحظه) ست کنیم؛ خودکار برای همه‌ی کاربرا "دیده‌نشده" می‌شه، بدونِ
// اینکه لازم باشه ردیفِ هیچ کاربری رو دستی آپدیت کنیم
async function handleAdminSendChangelog(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!isSuperAdmin(username)) return json({ error: "فقط مالک سایت می‌تونه changelog بفرسته" }, 403);

  const body = await request.json().catch(() => ({}));
  const rawEntries = Array.isArray(body.entries) ? body.entries : [];
  const entries = rawEntries
    .map((e) => ({
      emoji: (e && e.emoji ? String(e.emoji) : "✨").slice(0, 8),
      text: (e && e.text ? String(e.text) : "").trim().slice(0, 200),
    }))
    .filter((e) => e.text.length > 0)
    .slice(0, 20);

  if (entries.length === 0) return json({ error: "حداقل یه آیتم با متن لازمه" }, 400);

  const version = `manual-${Date.now()}`;
  await kvPut(env, CHANGELOG_KV_KEY, JSON.stringify({ version, entries }), CHANGELOG_KV_TTL_SECONDS);

  return json({ ok: true, version, entries });
}

async function handleAdminGetChangelog(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!isSuperAdmin(username)) return json({ error: "فقط مالک سایت اجازه داره" }, 403);
  const current = await getCurrentChangelog(env);
  return json({ version: current.version, entries: current.entries });
}

// #endregion
// #region سوییچِ HTTP/3 دامنه (فقط مالک سایت) — از طریق API خودِ کلادفلر
// ---------- سوییچِ HTTP/3 دامنه (فقط مالک سایت) ----------
// این مربوط به تنظیماتِ Zone تو کلادفلره، نه چیزی که این ورکر مستقیم کنترلش کنه؛ برای همین باید
// از API خودِ کلادفلر استفاده کنیم. دو تا Secret تو تنظیماتِ ورکر لازمه:
//   CF_API_TOKEN  = یه توکنِ API با دسترسیِ «Zone → Zone Settings → Edit» رویِ همون دامنه
//   CF_ZONE_ID    = شناسه‌ی Zone دامنه (تو داشبورد کلادفلر → صفحه‌ی اصلیِ دامنه، پایینِ ستونِ راست)
// اگه این دوتا ست نشده باشن، اندپوینت با یه خطای واضح جواب می‌ده (نه کرش خاموش).
async function cloudflareApiFetch(env, path, options = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.success !== true) {
    const msg = data && data.errors && data.errors[0] ? data.errors[0].message : `کلادفلر خطای ${res.status} داد`;
    throw new Error(msg);
  }
  return data;
}

async function handleAdminGetHttp3(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!isSuperAdmin(username)) return json({ error: "فقط مالک سایت اجازه داره" }, 403);
  if (!env.CF_API_TOKEN || !env.CF_ZONE_ID) {
    return json({ error: "CF_API_TOKEN یا CF_ZONE_ID تو تنظیماتِ ورکر ست نشده" }, 500);
  }
  try {
    const data = await cloudflareApiFetch(env, `/zones/${env.CF_ZONE_ID}/settings/http3`);
    return json({ ok: true, enabled: data.result.value === "on" });
  } catch (e) {
    return json({ error: e.message || "گرفتنِ وضعیتِ HTTP/3 ناموفق بود" }, 502);
  }
}

async function handleAdminToggleHttp3(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!isSuperAdmin(username)) return json({ error: "فقط مالک سایت می‌تونه این تنظیم رو عوض کنه" }, 403);
  if (!env.CF_API_TOKEN || !env.CF_ZONE_ID) {
    return json({ error: "CF_API_TOKEN یا CF_ZONE_ID تو تنظیماتِ ورکر ست نشده" }, 500);
  }
  try {
    const current = await cloudflareApiFetch(env, `/zones/${env.CF_ZONE_ID}/settings/http3`);
    const newValue = current.result.value === "on" ? "off" : "on";
    const updated = await cloudflareApiFetch(env, `/zones/${env.CF_ZONE_ID}/settings/http3`, {
      method: "PATCH",
      body: JSON.stringify({ value: newValue }),
    });
    return json({ ok: true, enabled: updated.result.value === "on" });
  } catch (e) {
    return json({ error: e.message || "تغییرِ HTTP/3 ناموفق بود" }, 502);
  }
}

// ---------- تعیین/تغییر رتبه‌ی ادمین (فقط مالک سایت) ----------
async function handleSetAdmin(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!isSuperAdmin(username)) return json({ error: "فقط مالک سایت می‌تونه رتبه‌ی ادمین رو تغییر بده" }, 403);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }

  const targetUsername = (body.username || "").toString();
  const rank = parseInt(body.rank, 10);
  if (!targetUsername) return json({ error: "نام کاربری لازمه" }, 400);
  if (targetUsername === SUPER_ADMIN_USERNAME) {
    return json({ error: "مالک سایت همیشه بالاترین رتبه رو داره و نیازی به تغییر نداره" }, 400);
  }
  if (![0, 2, 3].includes(rank)) return json({ error: "رتبه نامعتبره" }, 400);

  const existing = await env.D1.prepare("SELECT username FROM users WHERE username = ?").bind(targetUsername).first();
  if (!existing) return json({ error: "کاربر پیدا نشد" }, 404);

  await env.D1.prepare("UPDATE users SET admin_rank = ? WHERE username = ?").bind(rank, targetUsername).run();

  return json({ ok: true, username: targetUsername, admin_rank: rank });
}

// #endregion
// #region تغییرِ رمزِ عبورِ یک کاربر توسط مالک سایت (برای کاربرهایی که رمزشون یادشون رفته)
// ---------- تغییرِ رمزِ عبورِ یک کاربر توسط مالک سایت ----------
// فقط Aghey (مالک سایت) اجازه داره؛ نیازی به دونستنِ رمزِ فعلیِ کاربر نیست.
async function handleAdminChangePassword(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!isSuperAdmin(username)) return json({ error: "فقط مالک سایت می‌تونه رمزِ کاربرها رو تغییر بده" }, 403);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }

  const targetUsername = (body.targetUsername || "").toString().trim();
  const newPassword = (body.newPassword || "").toString();
  if (!targetUsername || !newPassword) return json({ error: "همه‌ی فیلدها لازمه" }, 400);

  if (targetUsername === SUPER_ADMIN_USERNAME) {
    return json({ error: "رمزِ مالک سایت از همین مسیر قابل تغییر نیست" }, 400);
  }

  const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
  if (!PASSWORD_RE.test(newPassword)) {
    return json({ error: "رمز جدید باید حداقل ۸ کاراکتر و شامل حرف و عدد باشه" }, 400);
  }

  const existing = await env.D1.prepare("SELECT username FROM users WHERE username = ?").bind(targetUsername).first();
  if (!existing) return json({ error: "کاربر پیدا نشد" }, 404);

  const newSalt = randomHex(16);
  const newHash = await hashPassword(newPassword, newSalt, env);
  await env.D1.prepare("UPDATE users SET salt = ?, hash = ? WHERE username = ?").bind(newSalt, newHash, targetUsername).run();

  // با تغییرِ رمز توسط مالک سایت، همه‌ی سشن‌های فعلیِ اون کاربر باطل می‌شه تا با رمزِ جدید دوباره وارد بشه
  await env.D1.prepare("DELETE FROM sessions WHERE username = ?").bind(targetUsername).run();
  await kvDelete(env, `pwd_fails:${targetUsername}`);

  return json({ ok: true, targetUsername });
}

// #endregion
// #region تعویضِ دستیِ رمزِ همه‌ی کاربرها (اقدامِ اضطراری، فقط مالک سایت)
// ---------- تعویضِ دستیِ رمزِ همه‌ی کاربرها ----------
// برای شرایطی که احتمالِ لو رفتنِ رمزها (چه هش‌شده چه پلین) وجود داره: برای هر کاربر (به‌جز
// خودِ Aghey) یه رمزِ تصادفیِ جدید می‌سازه، هش می‌کنه و جایگزینِ رمزِ قبلی می‌کنه، همه‌ی سشن‌های
// فعالِ همه رو باطل می‌کنه، و لیستِ «نام‌کاربری => رمزِ جدید» رو برمی‌گردونه تا مالک سایت دستی
// (مثلاً یکی‌یکی تو تلگرام) به هر کاربر برسونتش. رمزِ جدید هیچ‌وقت جایی ذخیره نمی‌شه؛ فقط همین
// یه بار تو پاسخِ همین درخواست برمی‌گرده، پس اگه گم بشه باید دوباره اجرا بشه.
function generateRandomPassword() {
  // ترکیبِ حروف و عدد که با PASSWORD_RE (حداقل ۸ کاراکتر، حداقل یه حرف و یه عدد) سازگاره
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let pass = "";
  for (let i = 0; i < bytes.length; i++) pass += chars[bytes[i] % chars.length];
  return pass;
}

async function handleAdminResetAllPasswords(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!isSuperAdmin(username)) {
    return json({ error: "فقط مالک سایت می‌تونه این کار رو انجام بده" }, 403);
  }

  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }
  // برای جلوگیری از اجرای تصادفی/اشتباهی، باید صریحاً تایید بفرسته
  if (body.confirm !== "RESET_ALL_PASSWORDS") {
    return json({ error: "برای تاییدِ این عملیاتِ برگشت‌ناپذیر، confirm رو برابرِ RESET_ALL_PASSWORDS بفرست" }, 400);
  }

  const { results } = await env.D1
    .prepare("SELECT username FROM users WHERE username != ?")
    .bind(SUPER_ADMIN_USERNAME)
    .all();

  const changed = [];
  for (const row of results) {
    const newPassword = generateRandomPassword();
    const newSalt = randomHex(16);
    const newHash = await hashPassword(newPassword, newSalt, env);
    await env.D1
      .prepare("UPDATE users SET salt = ?, hash = ? WHERE username = ?")
      .bind(newSalt, newHash, row.username)
      .run();
    changed.push({ username: row.username, newPassword });
  }

  // باطل کردنِ همه‌ی سشن‌های فعال (به‌جز سشنِ همینِ درخواست، که مالِ خودِ Aghey‌ست)
  const authHeader = request.headers.get("Authorization") || "";
  const currentToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (currentToken) {
    await env.D1.prepare("DELETE FROM sessions WHERE token != ?").bind(currentToken).run();
  } else {
    await env.D1.prepare("DELETE FROM sessions").run();
  }

  // یه نسخه‌ی متنیِ ساده هم می‌سازیم (هر خط: نام‌کاربری: رمزِ جدید) تا رو موبایل راحت کپی بشه،
  // چون خوندن/کپی‌کردن از داخلِ آرایه‌ی JSON رو گوشی دردسرِ زیادی داره
  const list = changed.map((c) => `${c.username}: ${c.newPassword}`).join("\n");

  return json({ ok: true, count: changed.length, users: changed, list });
}

// #endregion
// #region حذفِ کاملِ اکانتِ یک کاربر توسط مالک سایت
// ---------- انتقالِ خودکارِ مالکیتِ گروه‌ها هنگامِ حذفِ اکانتِ مالک ----------
async function transferOrCleanupOwnedGroups(env, targetUsername) {
  const owned = await env.D1.prepare(
    "SELECT conversation_id FROM chat_conversation_members WHERE username = ? AND role = 'owner'"
  ).bind(targetUsername).all();

  for (const row of owned.results || []) {
    const conversationId = row.conversation_id;
    // بعدی در صف: اول ادمین‌ها (قدیمی‌ترین)، بعد اعضای عادی (قدیمی‌ترین)؛ خودِ کاربرِ درحال‌حذف‌شدن رو نادیده بگیر
    const candidate = await env.D1.prepare(
      `SELECT username FROM chat_conversation_members
       WHERE conversation_id = ? AND username != ?
       ORDER BY (role = 'admin') DESC, joined_at ASC LIMIT 1`
    ).bind(conversationId, targetUsername).first();

    if (!candidate) {
      // هیچ عضوِ دیگه‌ای نمونده؛ گروه بی‌مالک و بی‌فایده می‌شه، پس کلاً حذفش می‌کنیم
      await env.D1.batch([
        env.D1.prepare("DELETE FROM chat_messages WHERE conversation_id = ?").bind(conversationId),
        env.D1.prepare("DELETE FROM chat_conversation_members WHERE conversation_id = ?").bind(conversationId),
        env.D1.prepare("DELETE FROM chat_conversations WHERE id = ?").bind(conversationId),
      ]);
    } else {
      await env.D1.prepare(
        "UPDATE chat_conversation_members SET role = 'owner' WHERE conversation_id = ? AND username = ?"
      ).bind(conversationId, candidate.username).run();
      await env.D1.prepare("UPDATE chat_conversations SET created_by = ? WHERE id = ?")
        .bind(candidate.username, conversationId).run();
    }
  }
}

// ---------- انتقالِ خودکارِ مالکیتِ کانال‌ها هنگامِ حذفِ اکانتِ مالک ----------
async function transferOrCleanupOwnedChannels(env, targetUsername) {
  const owned = await env.D1.prepare(
    "SELECT channel_id FROM channel_members WHERE username = ? AND role = 'owner'"
  ).bind(targetUsername).all();

  for (const row of owned.results || []) {
    const channelId = row.channel_id;
    const candidate = await env.D1.prepare(
      `SELECT username FROM channel_members
       WHERE channel_id = ? AND username != ?
       ORDER BY (role = 'admin') DESC, joined_at ASC LIMIT 1`
    ).bind(channelId, targetUsername).first();

    if (!candidate) {
      await env.D1.batch([
        env.D1.prepare("DELETE FROM channel_posts WHERE channel_id = ?").bind(channelId),
        env.D1.prepare("DELETE FROM channel_members WHERE channel_id = ?").bind(channelId),
        env.D1.prepare("DELETE FROM channels WHERE id = ?").bind(channelId),
      ]);
    } else {
      await env.D1.prepare(
        "UPDATE channel_members SET role = 'owner' WHERE channel_id = ? AND username = ?"
      ).bind(channelId, candidate.username).run();
      await env.D1.prepare("UPDATE channels SET owner_username = ? WHERE id = ?")
        .bind(candidate.username, channelId).run();
    }
  }
}

// ---------- حذفِ کاملِ اکانتِ یک کاربر توسط مالک سایت ----------
// فقط Aghey اجازه داره. برخلافِ بن‌کردن (که فقط یه پرچمه و برگشت‌پذیره)، این کاملاً غیرقابلِ برگشته:
// اکانت، پروفایل، پست‌ها، کامنت‌ها، پیام‌ها، عضویت‌ها و هر ردی از این کاربر توی همه‌ی جدول‌ها پاک می‌شه.
async function handleAdminDeleteAccount(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!isSuperAdmin(username)) return json({ error: "فقط مالک سایت می‌تونه اکانتِ کاربر رو حذف کنه" }, 403);
  if (!(await checkRateLimit(env, "admin_delete_account", username, 10, 3600))) {
    return json({ error: "درخواست زیاد بوده، یه‌کم بعد امتحان کن" }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const targetUsername = (body.targetUsername || "").toString().trim();
  if (!targetUsername) return json({ error: "نام کاربری لازمه" }, 400);
  if (targetUsername === SUPER_ADMIN_USERNAME) {
    return json({ error: "نمی‌شه اکانتِ مالک سایت رو حذف کرد" }, 400);
  }

  const existing = await env.D1.prepare("SELECT username FROM users WHERE username = ?").bind(targetUsername).first();
  if (!existing) return json({ error: "کاربر پیدا نشد" }, 404);

  // قبل از حذفِ خودِ عضویت‌ها: اگه این کاربر مالکِ یه گروه/کانال بوده، مالکیت خودکار به قدیمی‌ترین
  // ادمین (یا اگه ادمینی نبود، قدیمی‌ترین عضوِ عادی) منتقل می‌شه؛ اگه هیچ عضوِ دیگه‌ای نمونده باشه،
  // چون اون گروه/کانال دیگه بی‌فایده و بی‌مالکه، کلاً حذف می‌شه
  await transferOrCleanupOwnedGroups(env, targetUsername);
  await transferOrCleanupOwnedChannels(env, targetUsername);

  // همون جدول/ستون‌هایی که برای «تغییرِ نام کاربری» هم استفاده می‌شن، به‌علاوه‌ی جدول‌های مربوط به کانال‌ها
  const tableColumns = [
    ["sessions", "username"],
    ["profiles", "username"],
    ["posts", "username"],
    ["comments", "username"],
    ["comment_likes", "username"],
    ["votes", "username"],
    ["likes", "username"],
    ["stickers", "username"],
    ["notifications", "to_username"],
    ["notifications", "from_username"],
    ["notif_read", "username"],
    ["reports", "reporter_username"],
    ["reports", "target_username"],
    ["chat_conversation_members", "username"],
    ["chat_messages", "sender_username"],
    ["chat_blocks", "blocker_username"],
    ["chat_blocks", "blocked_username"],
    ["push_subscriptions", "username"],
    ["user_presence", "username"],
    ["channel_members", "username"],
    ["channel_posts", "author_username"],
  ];

  try {
    const statements = tableColumns.map(([table, col]) =>
      env.D1.prepare(`DELETE FROM ${table} WHERE ${col} = ?`).bind(targetUsername)
    );
    statements.push(env.D1.prepare("DELETE FROM users WHERE username = ?").bind(targetUsername));
    await env.D1.batch(statements);
  } catch (err) {
    console.error("خطای حذفِ اکانت:", err);
    return json({ error: "حذفِ اکانت ناموفق بود، دوباره امتحان کن" }, 500);
  }

  return json({ ok: true, targetUsername });
}

// #endregion
// #region آمار پنل مدیریت (برای همه‌ی ادمین‌ها)
// ---------- آمار پنل مدیریت (برای همه‌ی ادمین‌ها) ----------
async function handleAdminStats(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await isAdminUser(env, username))) return json({ error: "دسترسی نداری" }, 403);

  const [userCount, postCount, commentCount] = await Promise.all([
    env.D1.prepare("SELECT COUNT(*) as c FROM users").first(),
    env.D1.prepare("SELECT COUNT(*) as c FROM posts").first(),
    env.D1.prepare("SELECT COUNT(*) as c FROM comments").first(),
  ]);

  return json({
    ok: true,
    stats: { users: userCount.c, posts: postCount.c, comments: commentCount.c },
  });
}

// #endregion
// #region لیست کاربران با قابلیت جستجو (برای همه‌ی ادمین‌ها)
// ---------- لیست کاربران با قابلیت جستجو (برای همه‌ی ادمین‌ها) ----------
async function handleAdminUsers(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await isAdminUser(env, username))) return json({ error: "دسترسی نداری" }, 403);

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").toLowerCase().trim();
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
  const pageSize = Math.min(Math.max(parseInt(url.searchParams.get("pageSize") || "20", 10), 1), 100);

  const where = search ? "WHERE LOWER(username) LIKE ?" : "";
  const params = search ? [`%${search}%`] : [];

  const totalRow = await bind(env.D1.prepare(`SELECT COUNT(*) as c FROM users ${where}`), params).first();
  const total = totalRow ? totalRow.c : 0;

  const start = (page - 1) * pageSize;
  const rows = await bind(
    env.D1.prepare(`SELECT username, banned, admin_rank, created_at, can_refer FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`),
    [...params, pageSize, start]
  ).all();

  const pageUsers = (rows.results || []).map((u) => ({
    username: u.username,
    banned: !!u.banned,
    admin_rank: isSuperAdmin(u.username) ? 1 : (u.admin_rank === 2 || u.admin_rank === 3 ? u.admin_rank : 0),
    created_at: u.created_at || null,
    can_refer: isSuperAdmin(u.username) ? true : !!u.can_refer,
  }));

  return json({ ok: true, users: pageUsers, total, page, pageSize, hasMore: start + pageSize < total });
}

// #endregion
// #region نظارت ادمین: لیستِ همه‌ی گروه‌های چت
// ---------- نظارت ادمین: لیستِ همه‌ی گروه‌های چت (بدون نیاز به عضویت) ----------
async function handleAdminChatGroups(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!isSuperAdmin(username)) return json({ error: "دسترسی نداری" }, 403);

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").toLowerCase().trim();
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
  const pageSize = Math.min(Math.max(parseInt(url.searchParams.get("pageSize") || "20", 10), 1), 100);

  const where = search ? "WHERE type = 'group' AND LOWER(title) LIKE ?" : "WHERE type = 'group'";
  const params = search ? [`%${search}%`] : [];

  const totalRow = await bind(env.D1.prepare(`SELECT COUNT(*) as c FROM chat_conversations ${where}`), params).first();
  const total = totalRow ? totalRow.c : 0;

  const start = (page - 1) * pageSize;
  const rows = await bind(
    env.D1.prepare(
      `SELECT id, title, created_by, created_at, last_message_at, avatar_file_id, invite_code FROM chat_conversations ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ),
    [...params, pageSize, start]
  ).all();

  const groupRows = rows.results || [];
  const ids = groupRows.map((g) => g.id);
  const memberCounts = {};
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    const countRows = await env.D1.prepare(
      `SELECT conversation_id, COUNT(*) AS c FROM chat_conversation_members WHERE conversation_id IN (${placeholders}) GROUP BY conversation_id`
    ).bind(...ids).all();
    for (const row of countRows.results || []) memberCounts[row.conversation_id] = row.c;
  }

  const groups = groupRows.map((g) => ({
    id: g.id,
    title: g.title,
    createdBy: g.created_by,
    createdAt: g.created_at,
    lastMessageAt: g.last_message_at || null,
    avatarFileId: g.avatar_file_id || null,
    inviteCode: g.invite_code || null,
    memberCount: memberCounts[g.id] || 0,
  }));

  return json({ ok: true, groups, total, page, pageSize, hasMore: start + pageSize < total });
}

// #endregion
// #region نظارت ادمین: پیام‌های یک گروه (فقط خواندنی، بدون نیاز به عضویت)
// ---------- نظارت ادمین: پیام‌های یک گروه (فقط خواندنی، بدون نیاز به عضویت) ----------
// عمداً فقط روی گروه‌ها کار می‌کنه، نه گفتگوهای دونفره‌ی خصوصی؛ حریم خصوصیِ چت‌های خصوصیِ
// کاربرا حتی از دیدِ ادمین هم باید محفوظ بمونه، ولی گروه‌ها فضای جمعی‌ان و نظارت روشون منطقیه
async function handleAdminChatMessages(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!isSuperAdmin(username)) return json({ error: "دسترسی نداری" }, 403);

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversation");
  if (!conversationId) return json({ error: "شناسه‌ی گفتگو لازمه" }, 400);

  const conv = await env.D1.prepare("SELECT type, title FROM chat_conversations WHERE id = ?").bind(conversationId).first();
  if (!conv) return json({ error: "گروه پیدا نشد" }, 404);
  if (conv.type !== "group") return json({ error: "نظارت فقط روی گروه‌ها ممکنه" }, 403);

  const after = url.searchParams.get("after");
  if (after) {
    const rows = await env.D1.prepare(
      "SELECT id, sender_username, msg_type, text, file_id, is_external, created_at, edited_at, deleted_at, reply_to_message_id, file_name, file_size FROM chat_messages WHERE conversation_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 50"
    ).bind(conversationId, parseInt(after, 10) || 0).all();
    const messages = await attachReplyPreviews(env, rows.results || []);
    return json({ messages, groupTitle: conv.title });
  }

  const before = parseInt(url.searchParams.get("before") || "0", 10) || Date.now() + 1;
  const rows = await env.D1.prepare(
    "SELECT id, sender_username, msg_type, text, file_id, is_external, created_at, edited_at, deleted_at, reply_to_message_id, file_name, file_size FROM chat_messages WHERE conversation_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT 30"
  ).bind(conversationId, before).all();
  const messages = await attachReplyPreviews(env, (rows.results || []).slice().reverse());

  return json({ messages, hasMore: messages.length === 30, groupTitle: conv.title });
}

// #endregion
// #region مسدود/رفع مسدودی یک کاربر (برای همه‌ی ادمین‌ها، با محدودیت روی خود ادمین‌ها)
// ---------- مسدود/رفع مسدودی یک کاربر (برای همه‌ی ادمین‌ها، با محدودیت روی خود ادمین‌ها) ----------
async function handleBanUser(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  const actorRank = await getAdminRank(env, username);
  if (!canBanUsers(actorRank)) return json({ error: "دسترسی نداری" }, 403);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }

  const targetUsername = (body.username || "").toString();
  const banned = !!body.banned;
  if (!targetUsername) return json({ error: "نام کاربری لازمه" }, 400);
  if (targetUsername === username) return json({ error: "نمی‌تونی خودت رو مسدود کنی" }, 400);
  if (isSuperAdmin(targetUsername)) return json({ error: "نمی‌شه مالک سایت رو مسدود کرد" }, 400);

  const existing = await env.D1.prepare("SELECT username, admin_rank FROM users WHERE username = ?").bind(targetUsername).first();
  if (!existing) return json({ error: "کاربر پیدا نشد" }, 404);

  const targetRank = existing.admin_rank === 2 || existing.admin_rank === 3 ? existing.admin_rank : 0;

  // مسدود کردن یک ادمین دیگه (رتبه ۲ یا ۳) فقط از مالک سایت ساخته‌ست؛ ادمین‌های رتبه ۲/۳ فقط کاربرای عادی رو مسدود می‌کنن
  if (targetRank > 0 && actorRank !== 1) {
    return json({ error: "فقط مالک سایت می‌تونه ادمین‌های دیگه رو مسدود کنه" }, 403);
  }

  await env.D1.prepare("UPDATE users SET banned = ? WHERE username = ?").bind(banned ? 1 : 0, targetUsername).run();

  return json({ ok: true, username: targetUsername, banned });
}

// #endregion
// #region گرفتن لیست اعلان‌های کاربر
// ---------- گرفتن لیست اعلان‌های کاربر ----------
async function handleGetNotifications(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const url = new URL(request.url);
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
  const pageSize = Math.min(Math.max(parseInt(url.searchParams.get("pageSize") || "20", 10), 1), 50);

  const totalRow = await env.D1.prepare("SELECT COUNT(*) as c FROM notifications WHERE to_username = ?").bind(username).first();
  const total = totalRow ? totalRow.c : 0;

  const start = (page - 1) * pageSize;
  const rows = await env.D1.prepare(
    "SELECT * FROM notifications WHERE to_username = ? ORDER BY date DESC LIMIT ? OFFSET ?"
  ).bind(username, pageSize, start).all();

  const lastReadRow = await env.D1.prepare("SELECT last_read FROM notif_read WHERE username = ?").bind(username).first();
  const lastRead = lastReadRow ? lastReadRow.last_read : 0;

  const unreadRow = await env.D1.prepare("SELECT COUNT(*) as c FROM notifications WHERE to_username = ? AND date > ?").bind(username, lastRead).first();
  const unreadCount = unreadRow ? unreadRow.c : 0;

  // عنوان پست‌های مرتبط با همین صفحه از اعلان‌ها رو یک‌جا می‌گیریم (نه یکی‌یکی)، تا مشخص بشه
  // هر اعلان زیر کدوم پسته — دقیقاً مثل الگوی avatarMap توی handleFeed
  const notifRows = rows.results || [];
  const uniquePostIds = [...new Set(notifRows.map((n) => n.post_id).filter(Boolean))];
  const postTitleMap = {};
  if (uniquePostIds.length > 0) {
    const placeholders = uniquePostIds.map(() => "?").join(",");
    const titleRows = await env.D1.prepare(
      `SELECT id, title FROM posts WHERE id IN (${placeholders})`
    ).bind(...uniquePostIds).all();
    for (const row of titleRows.results || []) {
      if (row.title) postTitleMap[row.id] = row.title;
    }
  }

  const pageNotifs = notifRows.map((n) => ({
    ...n,
    is_new: n.date > lastRead,
    post_title: n.post_id ? (postTitleMap[n.post_id] || null) : null,
  }));

  return json({
    ok: true,
    notifications: pageNotifs,
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
    unread_count: unreadCount,
  });
}

// #endregion
// #region علامت‌زدن همه اعلان‌ها به‌عنوان خونده‌شده
// ---------- علامت‌زدن همه اعلان‌ها به‌عنوان خونده‌شده ----------
async function handleMarkNotificationsRead(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  await env.D1.prepare(
    `INSERT INTO notif_read (username, last_read) VALUES (?, ?)
     ON CONFLICT(username) DO UPDATE SET last_read = excluded.last_read`
  ).bind(username, Date.now()).run();

  return json({ ok: true });
}

// #endregion
// #region ثبت گزارش یک کاربر (هر کاربر فقط یک‌بار می‌تونه یک نفر رو گزارش بده)
// ---------- ثبت گزارش یک کاربر (هر کاربر فقط یک‌بار می‌تونه یک نفر رو گزارش بده) ----------
async function handleCreateReport(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }

  const targetUsername = (body.target_username || "").toString().trim();
  const reason = (body.reason || "").toString().trim();

  if (!targetUsername) return json({ error: "نام کاربری لازمه" }, 400);
  if (targetUsername === username) return json({ error: "نمی‌تونی خودت رو گزارش کنی" }, 400);
  if (!reason) return json({ error: "دلیل گزارش رو بنویس" }, 400);
  if (reason.length > 80) return json({ error: "توضیحات نباید بیشتر از ۸۰ کاراکتر باشه" }, 400);

  const target = await env.D1.prepare("SELECT username FROM users WHERE username = ?").bind(targetUsername).first();
  if (!target) return json({ error: "کاربر پیدا نشد" }, 404);

  const existing = await env.D1.prepare(
    "SELECT id FROM reports WHERE reporter_username = ? AND target_username = ?"
  ).bind(username, targetUsername).first();
  if (existing) return json({ error: "قبلاً این کاربر رو گزارش دادی" }, 409);

  const id = `${Date.now()}_${randomHex(4)}`;
  await bind(
    env.D1.prepare("INSERT INTO reports (id, reporter_username, target_username, reason, date) VALUES (?, ?, ?, ?, ?)"),
    [id, username, targetUsername, reason, Date.now()]
  ).run();

  return json({ ok: true });
}

// #endregion
// #region لیست گزارش‌ها (برای رتبه‌ی ۱ و ۲)
// ---------- لیست گزارش‌ها (برای رتبه‌ی ۱ و ۲) ----------
async function handleAdminReports(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!canManageReports(await getAdminRank(env, username))) return json({ error: "دسترسی نداری" }, 403);

  const url = new URL(request.url);
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
  const pageSize = Math.min(Math.max(parseInt(url.searchParams.get("pageSize") || "20", 10), 1), 100);

  const totalRow = await env.D1.prepare("SELECT COUNT(*) as c FROM reports").first();
  const total = totalRow ? totalRow.c : 0;

  const start = (page - 1) * pageSize;
  const rows = await env.D1.prepare("SELECT * FROM reports ORDER BY date DESC LIMIT ? OFFSET ?")
    .bind(pageSize, start)
    .all();

  return json({ ok: true, reports: rows.results || [], total, page, pageSize, hasMore: start + pageSize < total });
}

// #endregion
// #region بستن (حذف) یک گزارش، بعد از رسیدگی (برای رتبه‌ی ۱ و ۲)
// ---------- بستن (حذف) یک گزارش، بعد از رسیدگی (برای رتبه‌ی ۱ و ۲) ----------
async function handleDismissReport(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!canManageReports(await getAdminRank(env, username))) return json({ error: "دسترسی نداری" }, 403);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "شناسه گزارش لازمه" }, 400);

  await env.D1.prepare("DELETE FROM reports WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

// #endregion
// #region چت: شروع/گرفتنِ یک گفتگوی دونفره (اگه از قبل بین این دو نفر بوده، همون رو برمی‌گردونه)
// ---------- چت: شروع/گرفتنِ یک گفتگوی دونفره (اگه از قبل بین این دو نفر بوده، همون رو برمی‌گردونه) ----------
// شناسه‌ی گفتگوهای دونفره رو خودمون به‌صورت قطعی از روی یوزرنیمِ دو طرف می‌سازیم (نه رندوم)؛
// این‌جوری هربار که یکی روی پروفایل طرف مقابل «چت» بزنه، به‌جای ساختِ گفتگوی تکراری همون قبلی پیدا می‌شه
async function handleChatStart(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const body = await request.json().catch(() => ({}));
  const other = (body.username || "").toString().trim();
  if (!other) return json({ error: "یوزرنیم طرف مقابل لازمه" }, 400);
  if (other === username) return json({ error: "نمی‌شه با خودت چت بزنی" }, 400);

  const otherUser = await env.D1.prepare("SELECT username, banned FROM users WHERE username = ?").bind(other).first();
  if (!otherUser || otherUser.banned) return json({ error: "کاربر پیدا نشد" }, 404);

  const blocked = await env.D1.prepare(
    "SELECT 1 AS ok FROM chat_blocks WHERE (blocker_username = ? AND blocked_username = ?) OR (blocker_username = ? AND blocked_username = ?)"
  ).bind(username, other, other, username).first();
  if (blocked) return json({ error: "امکان شروع این گفتگو نیست" }, 403);

  const pair = [username, other].sort();
  const conversationId = `direct_${pair[0]}_${pair[1]}`;

  const existing = await env.D1.prepare("SELECT id FROM chat_conversations WHERE id = ?").bind(conversationId).first();
  if (!existing) {
    const now = Date.now();
    await bind(
      env.D1.prepare(
        "INSERT INTO chat_conversations (id, type, title, created_by, created_at, last_message_at) VALUES (?, 'direct', NULL, ?, ?, NULL)"
      ),
      [conversationId, username, now]
    ).run();
    await env.D1.batch([
      bind(
        env.D1.prepare(
          "INSERT INTO chat_conversation_members (conversation_id, username, role, joined_at, last_read_at) VALUES (?, ?, 'member', ?, 0)"
        ),
        [conversationId, username, now]
      ),
      bind(
        env.D1.prepare(
          "INSERT INTO chat_conversation_members (conversation_id, username, role, joined_at, last_read_at) VALUES (?, ?, 'member', ?, 0)"
        ),
        [conversationId, other, now]
      ),
    ]);
  }

  return json({ conversationId });
}

// #endregion
// #region چت: ساخت گروه جدید
// ---------- چت: ساخت گروه جدید ----------
async function handleChatCreateGroup(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "chat_group_create", username, 5, 3600))) {
    return json({ error: "ساخت گروه زیاد بوده، یه‌کم بعد امتحان کن" }, 429);
  }

  // چون ممکنه آواتار هم پیوست شده باشه، ورودی همیشه به‌صورت multipart/form-data خونده می‌شه؛
  // فیلد متنیِ عنوان هم به‌همون‌شکل داخل همون فرم میاد.
  // نکته: موقعِ ساختِ گروه دیگه نمی‌شه مستقیماً عضو اضافه کرد (بدون اجازه‌ی طرف درست نیست)؛ گروه فقط با
  // خودِ سازنده (به‌عنوان مالک) ساخته می‌شه و بقیه صرفاً با واردکردنِ کدِ دعوتِ اختصاصیِ گروه بهش می‌پیوندن
  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: "درخواست نامعتبره" }, 400);

  const title = (form.get("title") || "").toString().trim().slice(0, 60);
  if (!title) return json({ error: "اسم گروه لازمه" }, 400);
  const isPublic = (form.get("isPublic") || "").toString() === "1" ? 1 : 0;

  // آواتار گروه اختیاریه؛ دقیقاً همون قوانین آواتار پروفایل (نوع/حجم/تشخیصِ واقعیِ محتوا) رو رعایت می‌کنه
  let avatarFileId = null;
  const avatarFile = form.get("avatar");
  const hasAvatar = avatarFile && typeof avatarFile !== "string" && avatarFile.size > 0;
  if (hasAvatar) {
    if (!avatarFile.type.startsWith("image/")) {
      return json({ error: "آواتار گروه باید یه فایل عکس باشه" }, 400);
    }
    if (!(await verifyFileMatchesCategory(avatarFile, "image"))) {
      return json({ error: "محتوای فایل با نوع اعلام‌شده‌اش مطابقت نداره" }, 400);
    }
    if (avatarFile.size > 5 * 1024 * 1024) {
      return json({ error: "حجم عکس آواتار نباید بیشتر از ۵ مگابایت باشه" }, 400);
    }
    try {
      const result = await sendTelegramFile(env, "sendPhoto", "photo", avatarFile, `آواتار گروه — ${title}`);
      avatarFileId = extractFileId("photo", result);
    } catch (err) {
      console.error("خطای آپلود آواتار گروه به تلگرام:", err);
      return json({ error: "آپلود آواتار گروه ناموفق بود، دوباره امتحان کن" }, 502);
    }
  }

  const inviteCode = await generateUniqueInviteCode(env);
  const id = `group_${Date.now()}_${randomHex(6)}`;
  const now = Date.now();
  await bind(
    env.D1.prepare(
      "INSERT INTO chat_conversations (id, type, title, created_by, created_at, last_message_at, avatar_file_id, invite_code, is_public) VALUES (?, 'group', ?, ?, ?, NULL, ?, ?, ?)"
    ),
    [id, title, username, now, avatarFileId, inviteCode, isPublic]
  ).run();

  await bind(
    env.D1.prepare(
      "INSERT INTO chat_conversation_members (conversation_id, username, role, joined_at, last_read_at) VALUES (?, ?, 'owner', ?, 0)"
    ),
    [id, username, now]
  ).run();

  return json({ conversationId: id, inviteCode });
}

// #endregion
// #region چت: عضویت در گروه با کد دعوت
// ---------- چت: عضویت در گروه با کد دعوت ----------
async function handleChatJoinGroup(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "chat_group_join", username, 15, 3600))) {
    return json({ error: "تلاش زیاد بوده، یه‌کم بعد امتحان کن" }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const code = (body.code || "").toString().trim().toUpperCase();
  if (!code) return json({ error: "کد گروه لازمه" }, 400);

  const conv = await env.D1.prepare(
    "SELECT id, type, title FROM chat_conversations WHERE invite_code = ?"
  ).bind(code).first();
  if (!conv || conv.type !== "group") return json({ error: "کد گروه پیدا نشد" }, 404);

  const already = await getGroupMembership(env, conv.id, username);
  if (already) return json({ conversationId: conv.id, alreadyMember: true });

  const countRow = await env.D1.prepare(
    "SELECT COUNT(*) AS c FROM chat_conversation_members WHERE conversation_id = ?"
  ).bind(conv.id).first();
  if ((countRow && countRow.c) >= MAX_GROUP_MEMBERS + 1) {
    return json({ error: "این گروه پره" }, 400);
  }

  await bind(
    env.D1.prepare(
      "INSERT INTO chat_conversation_members (conversation_id, username, role, joined_at, last_read_at) VALUES (?, ?, 'member', ?, 0)"
    ),
    [conv.id, username, Date.now()]
  ).run();

  return json({ conversationId: conv.id, title: conv.title });
}

// ---------- عضویت در گروهِ عمومی بدون کد (فقط از طریقِ نتیجه‌ی جست‌وجوی عمومی معتبره) ----------
async function handleChatJoinPublicGroup(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "chat_group_join", username, 15, 3600))) {
    return json({ error: "تلاش زیاد بوده، یه‌کم بعد امتحان کن" }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const conversationId = (body.conversationId || "").toString();
  if (!conversationId) return json({ error: "شناسه‌ی گروه لازمه" }, 400);

  const conv = await env.D1.prepare(
    "SELECT id, type, title, is_public FROM chat_conversations WHERE id = ?"
  ).bind(conversationId).first();
  if (!conv || conv.type !== "group" || !conv.is_public) return json({ error: "این گروه عمومی نیست" }, 403);

  const already = await getGroupMembership(env, conv.id, username);
  if (already) return json({ conversationId: conv.id, alreadyMember: true });

  const countRow = await env.D1.prepare(
    "SELECT COUNT(*) AS c FROM chat_conversation_members WHERE conversation_id = ?"
  ).bind(conv.id).first();
  if ((countRow && countRow.c) >= MAX_GROUP_MEMBERS + 1) return json({ error: "این گروه پره" }, 400);

  await bind(
    env.D1.prepare(
      "INSERT INTO chat_conversation_members (conversation_id, username, role, joined_at, last_read_at) VALUES (?, ?, 'member', ?, 0)"
    ),
    [conv.id, username, Date.now()]
  ).run();

  return json({ conversationId: conv.id, title: conv.title });
}

// #endregion
// #region چت: کمکی‌های مدیریت اعضای گروه
// ---------- چت: کمکی‌های مدیریت اعضای گروه ----------
async function getGroupMembership(env, conversationId, username) {
  return env.D1.prepare(
    "SELECT role FROM chat_conversation_members WHERE conversation_id = ? AND username = ?"
  ).bind(conversationId, username).first();
}
function isGroupModerator(role) {
  return role === "owner" || role === "admin";
}

// #endregion
// #region چت: لیست اعضای یک گروه/گفتگو (نقش و وضعیت آنلاین هرکدوم)
// ---------- چت: لیست اعضای گروه ----------
async function handleChatMembers(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversation");
  if (!conversationId) return json({ error: "شناسه‌ی گفتگو لازمه" }, 400);

  const conv = await env.D1.prepare(
    "SELECT type, title, created_by, avatar_file_id, invite_code, is_public FROM chat_conversations WHERE id = ?"
  ).bind(conversationId).first();
  if (!conv) return json({ error: "گفتگو پیدا نشد" }, 404);

  const me = await getGroupMembership(env, conversationId, username);
  if (!me) return json({ error: "عضو این گفتگو نیستی" }, 403);

  const rows = await env.D1.prepare(
    "SELECT username, role, joined_at FROM chat_conversation_members WHERE conversation_id = ? ORDER BY (role = 'owner') DESC, (role = 'admin') DESC, joined_at ASC"
  ).bind(conversationId).all();

  const usernames = (rows.results || []).map((r) => r.username);
  const avatarMap = {};
  if (usernames.length) {
    const placeholders = usernames.map(() => "?").join(",");
    const profRows = await env.D1.prepare(
      `SELECT username, avatar_file_id FROM profiles WHERE username IN (${placeholders})`
    ).bind(...usernames).all();
    for (const row of profRows.results || []) {
      if (row.avatar_file_id) avatarMap[row.username] = row.avatar_file_id;
    }
  }

  const members = [];
  for (const row of rows.results || []) {
    const lastActiveAt = await getUserPresence(env, row.username);
    members.push({
      username: row.username,
      role: row.role,
      joinedAt: row.joined_at,
      avatarFileId: avatarMap[row.username] || null,
      online: !!lastActiveAt && Date.now() - lastActiveAt < ONLINE_WINDOW_MS,
      lastActiveAt,
    });
  }

  return json({
    conversation: {
      id: conversationId,
      type: conv.type,
      title: conv.title,
      createdBy: conv.created_by,
      avatarFileId: conv.avatar_file_id || null,
      inviteCode: conv.invite_code || null,
      isPublic: !!conv.is_public,
    },
    myRole: me.role,
    members,
  });
}

// #endregion
// #region چت: ویرایش گروه (اسم/عکس؛ فقط مالک) — جایگزینِ قابلیتِ حذف‌شده‌ی «افزودنِ دستیِ عضو»
// ---------- چت: ویرایش گروه (اسم/عکس؛ فقط مالک) ----------
// توجه: افزودنِ دستیِ عضو به گروه به‌کل حذف شده؛ تنها راهِ ورود به گروه، واردکردنِ کدِ دعوته
async function handleChatUpdateGroup(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "chat_group_update", username, 10, 3600))) {
    return json({ error: "درخواست زیاد بوده، یه‌کم بعد امتحان کن" }, 429);
  }

  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: "درخواست نامعتبره" }, 400);

  const conversationId = (form.get("conversationId") || "").toString();
  if (!conversationId) return json({ error: "شناسه‌ی گفتگو لازمه" }, 400);

  const conv = await env.D1.prepare("SELECT type FROM chat_conversations WHERE id = ?").bind(conversationId).first();
  if (!conv || conv.type !== "group") return json({ error: "این گفتگو گروه نیست" }, 400);

  const me = await getGroupMembership(env, conversationId, username);
  if (!me || me.role !== "owner") return json({ error: "فقط مالکِ گروه می‌تونه گروه رو ویرایش کنه" }, 403);

  const title = (form.get("title") || "").toString().trim().slice(0, 60);
  if (!title) return json({ error: "اسم گروه لازمه" }, 400);
  const isPublic = (form.get("isPublic") || "").toString() === "1" ? 1 : 0;

  let avatarFileId = undefined; // undefined یعنی تغییری در آواتار داده نشه
  const avatarFile = form.get("avatar");
  const hasAvatar = avatarFile && typeof avatarFile !== "string" && avatarFile.size > 0;
  if (hasAvatar) {
    if (!avatarFile.type.startsWith("image/")) {
      return json({ error: "آواتار گروه باید یه فایل عکس باشه" }, 400);
    }
    if (!(await verifyFileMatchesCategory(avatarFile, "image"))) {
      return json({ error: "محتوای فایل با نوع اعلام‌شده‌اش مطابقت نداره" }, 400);
    }
    if (avatarFile.size > 5 * 1024 * 1024) {
      return json({ error: "حجم عکس آواتار نباید بیشتر از ۵ مگابایت باشه" }, 400);
    }
    try {
      const result = await sendTelegramFile(env, "sendPhoto", "photo", avatarFile, `آواتار گروه — ${title}`);
      avatarFileId = extractFileId("photo", result);
    } catch (err) {
      console.error("خطای آپلود آواتار گروه به تلگرام:", err);
      return json({ error: "آپلود آواتار گروه ناموفق بود، دوباره امتحان کن" }, 502);
    }
  }

  if (avatarFileId !== undefined) {
    await env.D1.prepare("UPDATE chat_conversations SET title = ?, avatar_file_id = ?, is_public = ? WHERE id = ?")
      .bind(title, avatarFileId, isPublic, conversationId).run();
  } else {
    await env.D1.prepare("UPDATE chat_conversations SET title = ?, is_public = ? WHERE id = ?")
      .bind(title, isPublic, conversationId).run();
  }

  return json({ ok: true, title, avatarFileId: avatarFileId !== undefined ? avatarFileId : undefined });
}

// #endregion
// #region چت: ساختِ کدِ دعوتِ جدید برای گروه (باطل‌کردنِ کدِ قبلی؛ فقط مالک)
// ---------- چت: ساختِ کدِ دعوتِ جدید ----------
async function handleChatRegenerateInvite(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "chat_group_regen_invite", username, 15, 3600))) {
    return json({ error: "درخواست زیاد بوده، یه‌کم بعد امتحان کن" }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const conversationId = (body.conversationId || "").toString();
  if (!conversationId) return json({ error: "شناسه‌ی گفتگو لازمه" }, 400);

  const conv = await env.D1.prepare("SELECT type FROM chat_conversations WHERE id = ?").bind(conversationId).first();
  if (!conv || conv.type !== "group") return json({ error: "این گفتگو گروه نیست" }, 400);

  const me = await getGroupMembership(env, conversationId, username);
  if (!me || me.role !== "owner") return json({ error: "فقط مالکِ گروه می‌تونه کدِ دعوت رو تغییر بده" }, 403);

  const inviteCode = await generateUniqueInviteCode(env);
  await env.D1.prepare("UPDATE chat_conversations SET invite_code = ? WHERE id = ?")
    .bind(inviteCode, conversationId).run();

  return json({ ok: true, inviteCode });
}

// #endregion
// #region چت: حذف یک عضو از گروه (فقط مالک/ادمین؛ نمی‌شه مالک رو حذف کرد)
// ---------- چت: حذف عضو ----------
async function handleChatRemoveMember(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const body = await request.json().catch(() => ({}));
  const conversationId = (body.conversationId || "").toString();
  const target = (body.username || "").toString().trim();
  if (!conversationId || !target) return json({ error: "اطلاعات لازم ناقصه" }, 400);

  const conv = await env.D1.prepare("SELECT type FROM chat_conversations WHERE id = ?").bind(conversationId).first();
  if (!conv || conv.type !== "group") return json({ error: "این گفتگو گروه نیست" }, 400);

  const me = await getGroupMembership(env, conversationId, username);
  if (!me || !isGroupModerator(me.role)) return json({ error: "فقط مالک/ادمین گروه می‌تونه عضو حذف کنه" }, 403);

  const targetMembership = await getGroupMembership(env, conversationId, target);
  if (!targetMembership) return json({ error: "این کاربر عضو گروه نیست" }, 404);
  if (targetMembership.role === "owner") return json({ error: "نمی‌شه مالک گروه رو حذف کرد" }, 400);
  if (targetMembership.role === "admin" && me.role !== "owner") {
    return json({ error: "فقط مالک می‌تونه ادمین رو حذف کنه" }, 403);
  }

  await env.D1.prepare(
    "DELETE FROM chat_conversation_members WHERE conversation_id = ? AND username = ?"
  ).bind(conversationId, target).run();

  return json({ ok: true });
}

// #endregion
// #region چت: تغییر نقش عضو (ارتقا به ادمین یا عزل از ادمین؛ فقط مالک)
// ---------- چت: تغییر نقش عضو ----------
async function handleChatSetMemberRole(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const body = await request.json().catch(() => ({}));
  const conversationId = (body.conversationId || "").toString();
  const target = (body.username || "").toString().trim();
  const role = (body.role || "").toString();
  if (!conversationId || !target) return json({ error: "اطلاعات لازم ناقصه" }, 400);
  if (!["admin", "member"].includes(role)) return json({ error: "نقش نامعتبره" }, 400);

  const conv = await env.D1.prepare("SELECT type FROM chat_conversations WHERE id = ?").bind(conversationId).first();
  if (!conv || conv.type !== "group") return json({ error: "این گفتگو گروه نیست" }, 400);

  const me = await getGroupMembership(env, conversationId, username);
  if (!me || me.role !== "owner") return json({ error: "فقط مالکِ گروه می‌تونه نقش‌ها رو تغییر بده" }, 403);

  const targetMembership = await getGroupMembership(env, conversationId, target);
  if (!targetMembership) return json({ error: "این کاربر عضو گروه نیست" }, 404);
  if (targetMembership.role === "owner") return json({ error: "نقشِ مالک قابل تغییر نیست" }, 400);

  await env.D1.prepare(
    "UPDATE chat_conversation_members SET role = ? WHERE conversation_id = ? AND username = ?"
  ).bind(role, conversationId, target).run();

  return json({ ok: true });
}

// #endregion
// #region چت: خروج از گروه (اگه مالک بره، مالکیت به قدیمی‌ترین عضو دیگه منتقل می‌شه؛ اگه آخرین نفر بود، گروه پاک می‌شه)
// ---------- چت: خروج از گروه ----------
async function handleChatLeaveGroup(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const body = await request.json().catch(() => ({}));
  const conversationId = (body.conversationId || "").toString();
  if (!conversationId) return json({ error: "شناسه‌ی گفتگو لازمه" }, 400);

  const conv = await env.D1.prepare("SELECT type FROM chat_conversations WHERE id = ?").bind(conversationId).first();
  if (!conv || conv.type !== "group") return json({ error: "این گفتگو گروه نیست" }, 400);

  const me = await getGroupMembership(env, conversationId, username);
  if (!me) return json({ error: "عضو این گروه نیستی" }, 404);

  await env.D1.prepare(
    "DELETE FROM chat_conversation_members WHERE conversation_id = ? AND username = ?"
  ).bind(conversationId, username).run();

  const remaining = await env.D1.prepare(
    "SELECT username, role FROM chat_conversation_members WHERE conversation_id = ? ORDER BY joined_at ASC"
  ).bind(conversationId).all();

  if (!remaining.results || remaining.results.length === 0) {
    // آخرین عضو بود؛ کل گروه و پیام‌هاش پاک می‌شه
    await env.D1.batch([
      env.D1.prepare("DELETE FROM chat_messages WHERE conversation_id = ?").bind(conversationId),
      env.D1.prepare("DELETE FROM chat_conversation_members WHERE conversation_id = ?").bind(conversationId),
      env.D1.prepare("DELETE FROM chat_conversations WHERE id = ?").bind(conversationId),
    ]);
  } else if (me.role === "owner") {
    // مالکیت به قدیمی‌ترین ادمین (یا در نبودش، قدیمی‌ترین عضو) منتقل می‌شه
    const nextOwner = remaining.results.find((r) => r.role === "admin") || remaining.results[0];
    await env.D1.prepare(
      "UPDATE chat_conversation_members SET role = 'owner' WHERE conversation_id = ? AND username = ?"
    ).bind(conversationId, nextOwner.username).run();
  }

  return json({ ok: true });
}

// #endregion
// #region چت: حذف کامل گروه (فقط مالکِ گروه؛ برخلافِ خروج، اینجا فوراً برای همه‌ی اعضا پاک می‌شه)
// ---------- چت: حذف گروه ----------
async function handleChatDeleteGroup(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const body = await request.json().catch(() => ({}));
  const conversationId = (body.conversationId || "").toString();
  if (!conversationId) return json({ error: "شناسه‌ی گفتگو لازمه" }, 400);

  const conv = await env.D1.prepare("SELECT type FROM chat_conversations WHERE id = ?").bind(conversationId).first();
  if (!conv || conv.type !== "group") return json({ error: "این گفتگو گروه نیست" }, 400);

  const me = await getGroupMembership(env, conversationId, username);
  if (!me || me.role !== "owner") return json({ error: "فقط مالکِ گروه می‌تونه گروه رو حذف کنه" }, 403);

  await env.D1.batch([
    env.D1.prepare("DELETE FROM chat_messages WHERE conversation_id = ?").bind(conversationId),
    env.D1.prepare("DELETE FROM chat_conversation_members WHERE conversation_id = ?").bind(conversationId),
    env.D1.prepare("DELETE FROM chat_conversations WHERE id = ?").bind(conversationId),
  ]);

  return json({ ok: true });
}

// #endregion
// #region چت: پیام‌های ذخیره‌شده (یه گفتگوی تک‌نفره‌ی مخصوصِ خودِ کاربر، برای نگه‌داشتنِ یادداشت/پیام)
// ---------- چت: مطمئن‌شدن از وجودِ گفتگوی «پیام‌های ذخیره‌شده»ی یک کاربر (اگه نبود، می‌سازدش) ----------
const SAVED_MESSAGES_TITLE = "پیام‌های ذخیره‌شده";
function savedMessagesConversationId(username) {
  return `saved_${username}`;
}
async function ensureSavedMessagesConversation(env, username) {
  const conversationId = savedMessagesConversationId(username);
  const existing = await env.D1.prepare("SELECT id FROM chat_conversations WHERE id = ?").bind(conversationId).first();
  if (existing) return conversationId;
  const now = Date.now();
  await bind(
    env.D1.prepare(
      "INSERT INTO chat_conversations (id, type, title, created_by, created_at, last_message_at) VALUES (?, 'saved', ?, ?, ?, NULL)"
    ),
    [conversationId, SAVED_MESSAGES_TITLE, username, now]
  ).run();
  await bind(
    env.D1.prepare(
      "INSERT INTO chat_conversation_members (conversation_id, username, role, joined_at, last_read_at) VALUES (?, ?, 'owner', ?, 0)"
    ),
    [conversationId, username, now]
  ).run();
  return conversationId;
}

// #endregion
// #region چت: لیست گفتگوهای کاربر (با آخرین پیام و تعداد نخوانده)
// ---------- چت: لیست گفتگوهای کاربر (با آخرین پیام و تعداد نخوانده) ----------
async function handleChatList(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  touchUserPresence(env, username).catch(() => {});
  await ensureSavedMessagesConversation(env, username);

  const rows = await env.D1.prepare(
    `SELECT c.id, c.type, c.title, c.last_message_at, c.avatar_file_id, m.last_read_at, m.muted
     FROM chat_conversations c
     JOIN chat_conversation_members m ON m.conversation_id = c.id
     WHERE m.username = ?
     ORDER BY (c.type = 'saved') DESC, COALESCE(c.last_message_at, c.created_at) DESC
     LIMIT 100`
  ).bind(username).all();

  const conversations = [];
  for (const row of rows.results || []) {
    let displayTitle = row.title;
    let otherUsername = null;
    let blockedByMe = false;
    let avatarFileId = null;
    let memberCount = null;
    let online = false;
    let lastActiveAt = null;
    if (row.type === "direct") {
      const other = await env.D1.prepare(
        "SELECT username FROM chat_conversation_members WHERE conversation_id = ? AND username != ?"
      ).bind(row.id, username).first();
      otherUsername = other ? other.username : null;
      displayTitle = otherUsername || "کاربر حذف‌شده";
      if (otherUsername) {
        const blockRow = await env.D1.prepare(
          "SELECT 1 AS ok FROM chat_blocks WHERE blocker_username = ? AND blocked_username = ?"
        ).bind(username, otherUsername).first();
        blockedByMe = !!blockRow;
        const prof = await env.D1.prepare("SELECT avatar_file_id FROM profiles WHERE username = ?").bind(otherUsername).first();
        avatarFileId = (prof && prof.avatar_file_id) || null;
        lastActiveAt = await getUserPresence(env, otherUsername);
        online = !!lastActiveAt && Date.now() - lastActiveAt < ONLINE_WINDOW_MS;
      }
    } else if (row.type === "saved") {
      // گفتگوی «پیام‌های ذخیره‌شده»: تک‌نفره‌ست، نه بلاک معنی داره نه تعداد عضو
      displayTitle = SAVED_MESSAGES_TITLE;
    } else {
      const countRow = await env.D1.prepare(
        "SELECT COUNT(*) AS c FROM chat_conversation_members WHERE conversation_id = ?"
      ).bind(row.id).first();
      memberCount = (countRow && countRow.c) || 0;
      avatarFileId = row.avatar_file_id || null;
    }
    const lastMsg = await env.D1.prepare(
      "SELECT sender_username, msg_type, text, created_at, deleted_at FROM chat_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1"
    ).bind(row.id).first();
    const unreadRow = await env.D1.prepare(
      "SELECT COUNT(*) AS c FROM chat_messages WHERE conversation_id = ? AND created_at > ? AND sender_username != ? AND deleted_at IS NULL"
    ).bind(row.id, row.last_read_at || 0, username).first();

    conversations.push({
      id: row.id,
      type: row.type,
      title: displayTitle,
      otherUsername,
      blockedByMe,
      avatarFileId,
      memberCount,
      online,
      lastActiveAt,
      lastMessage: lastMsg
        ? {
            sender: lastMsg.sender_username,
            msgType: lastMsg.msg_type,
            text: lastMsg.deleted_at ? null : lastMsg.text,
            createdAt: lastMsg.created_at,
            deleted: !!lastMsg.deleted_at,
          }
        : null,
      unreadCount: (unreadRow && unreadRow.c) || 0,
      muted: !!row.muted,
    });
  }

  return json({ conversations });
}

// #endregion
// #endregion
// #region چت: مسدودکردن/رفعِ مسدودیِ یک کاربر (فقط برای گفتگوهای دونفره معنی داره)
// ---------- چت: مسدودکردن/رفعِ مسدودی ----------
async function handleChatBlock(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  const body = await request.json().catch(() => ({}));
  const target = (body.username || "").toString().trim();
  if (!target) return json({ error: "یوزرنیم لازمه" }, 400);
  if (target === username) return json({ error: "نمی‌شه خودت رو مسدود کنی" }, 400);

  await bind(
    env.D1.prepare("INSERT OR IGNORE INTO chat_blocks (blocker_username, blocked_username, created_at) VALUES (?, ?, ?)"),
    [username, target, Date.now()]
  ).run();
  return json({ ok: true, blocked: true });
}

async function handleChatUnblock(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  const body = await request.json().catch(() => ({}));
  const target = (body.username || "").toString().trim();
  if (!target) return json({ error: "یوزرنیم لازمه" }, 400);

  await env.D1.prepare("DELETE FROM chat_blocks WHERE blocker_username = ? AND blocked_username = ?").bind(username, target).run();
  return json({ ok: true, blocked: false });
}

// ---------- چت: گرفتن لیستِ کاربرانی که کاربرِ جاری مسدودشون کرده (برای «تنظیمات > حریم خصوصی») ----------
async function handleChatBlockedList(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const { results } = await env.D1
    .prepare(
      `SELECT cb.blocked_username AS username, p.avatar_file_id AS avatarFileId
       FROM chat_blocks cb
       LEFT JOIN profiles p ON p.username = cb.blocked_username
       WHERE cb.blocker_username = ?
       ORDER BY cb.created_at DESC`
    )
    .bind(username)
    .all();

  return json({
    blocked: (results || []).map((r) => ({ username: r.username, avatarFileId: r.avatarFileId || null })),
  });
}

// #endregion
// #region چت: گرفتن پیام‌ها — هم برای تاریخچه‌ی رو-به-عقب (before) هم پولینگِ پیام‌های تازه (after)
// ---------- چت: گرفتن پیام‌ها ----------
// ستون‌های مشترکی که هر جا پیام‌های چت (با پین/ریکشن/فوروارد) خونده می‌شن استفاده می‌شن؛ یه‌جا
// تعریف شده تا مجبور نباشیم این رشته‌ی طولانی رو هر جا از نو بنویسیم
const CHAT_MESSAGE_SELECT_COLUMNS = `
  id, sender_username, msg_type, text, file_id, is_external, created_at, edited_at, deleted_at,
  reply_to_message_id, pinned_at, pinned_by, forwarded_from, file_name, file_size,
  (SELECT json_group_array(json_object('emoji', emoji, 'username', username))
   FROM chat_message_reactions WHERE message_id = chat_messages.id) AS reactions_json
`;

function mapChatMessageRow(m) {
  const deleted = !!m.deleted_at;
  let reactions = [];
  if (m.reactions_json) {
    try {
      const raw = JSON.parse(m.reactions_json) || [];
      const counts = {};
      for (const r of raw) {
        if (!r || !r.emoji) continue;
        if (!counts[r.emoji]) counts[r.emoji] = { emoji: r.emoji, count: 0, usernames: [] };
        counts[r.emoji].count++;
        counts[r.emoji].usernames.push(r.username);
      }
      reactions = Object.values(counts);
    } catch (e) {
      reactions = [];
    }
  }
  return {
    id: m.id,
    sender: m.sender_username,
    msgType: m.msg_type,
    text: deleted ? null : m.text,
    fileId: deleted ? null : m.file_id,
    fileName: deleted ? null : m.file_name || null,
    fileSize: deleted ? null : m.file_size || null,
    isExternal: !!m.is_external,
    createdAt: m.created_at,
    editedAt: m.edited_at || null,
    deleted,
    replyToId: m.reply_to_message_id || null,
    pinnedAt: m.pinned_at || null,
    pinnedBy: m.pinned_by || null,
    forwardedFrom: deleted ? null : m.forwarded_from || null,
    reactions: deleted ? [] : reactions,
  };
}

// ---------- چت: پیوست‌کردنِ پیش‌نمایشِ پیامِ ریپلای‌شده به لیستی از پیام‌ها ----------
// به‌جای N بار کوئری‌زدن برای هر پیام، یه‌بار همه‌ی reply_to_message_id های یکتا رو جمع می‌کنیم
// و با یه کوئریِ IN(...) پیش‌نمایششون (فرستنده/نوع/متن) رو می‌گیریم
async function attachReplyPreviews(env, rows) {
  const mapped = rows.map(mapChatMessageRow);
  const replyIds = [...new Set(mapped.filter((m) => m.replyToId).map((m) => m.replyToId))];
  if (replyIds.length === 0) return mapped.map((m) => ({ ...m, replyTo: null }));

  const placeholders = replyIds.map(() => "?").join(",");
  const refRows = await env.D1.prepare(
    `SELECT id, sender_username, msg_type, text, deleted_at, file_name FROM chat_messages WHERE id IN (${placeholders})`
  ).bind(...replyIds).all();
  const refMap = {};
  for (const r of refRows.results || []) {
    refMap[r.id] = {
      id: r.id,
      sender: r.sender_username,
      msgType: r.msg_type,
      text: r.deleted_at ? null : r.text,
      fileName: r.deleted_at ? null : r.file_name || null,
      deleted: !!r.deleted_at,
    };
  }
  return mapped.map((m) => ({ ...m, replyTo: m.replyToId ? refMap[m.replyToId] || null : null }));
}

async function handleChatMessages(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  touchUserPresence(env, username).catch(() => {});

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversation");
  if (!conversationId) return json({ error: "شناسه‌ی گفتگو لازمه" }, 400);

  const conv = await env.D1.prepare("SELECT type FROM chat_conversations WHERE id = ?").bind(conversationId).first();
  if (!conv) return json({ error: "گفتگو پیدا نشد" }, 404);

  const member = await env.D1.prepare(
    "SELECT 1 AS ok FROM chat_conversation_members WHERE conversation_id = ? AND username = ?"
  ).bind(conversationId, username).first();
  if (!member) return json({ error: "به این گفتگو دسترسی نداری" }, 403);

  // هر بار این مسیر صدا زده بشه (چه برای تاریخچه، چه برای پولینگِ دوره‌ای)، یعنی کاربر همین الان داره
  // به این گفتگو نگاه می‌کنه؛ همین رو به‌عنوان signal حضور ذخیره می‌کنیم تا موقع پیام جدید بدونیم کی
  // همین الان خودش تو چته (و نیازی به پوش اضافه براش نیست)
  await env.D1.prepare(
    "UPDATE chat_conversation_members SET last_active_at = ? WHERE conversation_id = ? AND username = ?"
  ).bind(Date.now(), conversationId, username).run();

  // برای تیکِ دوبل (خوانده‌شدن)، فقط توی گفتگوهای دونفره معنی داره: last_read_at طرفِ مقابل
  let otherReadAt = null;
  let otherPresence = null;
  if (conv.type === "direct") {
    const other = await env.D1.prepare(
      "SELECT username, last_read_at FROM chat_conversation_members WHERE conversation_id = ? AND username != ?"
    ).bind(conversationId, username).first();
    if (other) {
      otherReadAt = other.last_read_at || 0;
      const lastActiveAt = await getUserPresence(env, other.username);
      otherPresence = { online: !!lastActiveAt && Date.now() - lastActiveAt < ONLINE_WINDOW_MS, lastActiveAt };
    }
  }

  // پیام‌های پین‌شده (فقط تو گروه معنی داره) هر بار همراهِ پیام‌ها برگردونده می‌شن تا نوارِ پین
  // بالای چت همیشه به‌روز بمونه، حتی اگه یه ادمینِ دیگه همین الان پین/آن‌پینش کرده باشه
  const pinnedRows = conv.type === "group"
    ? await env.D1.prepare(
        `SELECT ${CHAT_MESSAGE_SELECT_COLUMNS} FROM chat_messages WHERE conversation_id = ? AND pinned_at IS NOT NULL AND deleted_at IS NULL ORDER BY pinned_at DESC LIMIT 20`
      ).bind(conversationId).all()
    : null;
  const pinnedMessages = pinnedRows ? (pinnedRows.results || []).map(mapChatMessageRow) : [];

  const after = url.searchParams.get("after");
  if (after) {
    const rows = await env.D1.prepare(
      `SELECT ${CHAT_MESSAGE_SELECT_COLUMNS} FROM chat_messages WHERE conversation_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 50`
    ).bind(conversationId, parseInt(after, 10) || 0).all();
    const messages = await attachReplyPreviews(env, rows.results || []);
    return json({ messages, otherReadAt, otherPresence, pinnedMessages });
  }

  const before = parseInt(url.searchParams.get("before") || "0", 10) || Date.now() + 1;
  const rows = await env.D1.prepare(
    `SELECT ${CHAT_MESSAGE_SELECT_COLUMNS} FROM chat_messages WHERE conversation_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT 30`
  ).bind(conversationId, before).all();
  const messages = (await attachReplyPreviews(env, (rows.results || []).slice().reverse()));

  return json({ messages, hasMore: messages.length === 30, otherReadAt, otherPresence, pinnedMessages });
}

// #endregion
// #region چت: ارسال پیام (متن یا عکس/صدا با file_id از قبل آپلودشده)
// ---------- چت: ارسال پیام ----------
// ---------- چت: اطلاع‌رسانیِ پوش برای یه پیامِ تازه (هم ارسالِ عادی هم فوروارد ازش استفاده می‌کنن) ----------
async function notifyChatMembersOfNewMessage(env, conv, conversationId, senderUsername, msgType, text, now) {
  // پوش فقط برای اعضایی می‌ره که همین الان (تو ۱۲ ثانیه‌ی اخیر) خودشون تو همین گفتگو پولینگ نکردن؛
  // یعنی احتمالاً همین الان چت رو باز نگاه نمی‌کنن، پس با پولینگِ خودِ صفحه پیام رو نمی‌بینن
  const PRESENCE_WINDOW_MS = 12000;
  const members = await env.D1.prepare(
    "SELECT username, last_active_at, muted FROM chat_conversation_members WHERE conversation_id = ? AND username != ?"
  ).bind(conversationId, senderUsername).all();

  // منشن: @username تو متنِ پیام (فقط تو گروه معنی داره). فقط یوزرنیم‌هایی که واقعاً عضوِ همین
  // گروهن معتبرن؛ منشن حتی اگه اون عضو نوتیفِ این گفتگو رو سایلنت کرده باشه هم می‌رسه
  const mentionedUsernames = new Set();
  if (msgType === "text" && conv.type === "group" && text) {
    const candidateMatches = text.match(/@([a-zA-Z0-9_]{3,20})/g) || [];
    const candidates = new Set(candidateMatches.map((x) => x.slice(1)));
    for (const row of members.results || []) {
      if (candidates.has(row.username)) mentionedUsernames.add(row.username);
    }
  }

  const preview =
    msgType === "text" ? text : msgType === "image" ? "یه عکس فرستاد" : msgType === "video" ? "یه فیلم فرستاد" : msgType === "audio" ? "یه پیامِ صوتی فرستاد" : msgType === "file" ? "یه فایل فرستاد" : msgType === "post_shortcut" ? `یه پست فرستاد: ${text || ""}` : "یه استیکر فرستاد";
  for (const row of members.results || []) {
    if (now - (row.last_active_at || 0) < PRESENCE_WINDOW_MS) continue;
    const isMentioned = mentionedUsernames.has(row.username);
    if (row.muted && !isMentioned) continue; // گفتگو سایلنته و منشن نشده؛ پوش نره
    const chatPushPayload = isMentioned
      ? {
          title: `${senderUsername} منشنت کرد`,
          body: (preview || "").slice(0, 120),
          url: `${SITE_ORIGIN}/index.html?chat=${conversationId}`,
          tag: `chat-${conversationId}`,
        }
      : {
          title: `پیام جدید از ${senderUsername}`,
          body: (preview || "").slice(0, 120),
          url: `${SITE_ORIGIN}/index.html?chat=${conversationId}`,
          tag: `chat-${conversationId}`,
        };
    await Promise.all([
      sendPushToUser(env, row.username, chatPushPayload),
      sendFcmToUser(env, row.username, chatPushPayload),
    ]);
  }
}

async function handleChatSend(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "chat_send", username, 30, 60))) {
    return json({ error: "پیام زیاد فرستادی، یه‌کم صبر کن" }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const conversationId = (body.conversationId || "").toString();
  if (!conversationId) return json({ error: "شناسه‌ی گفتگو لازمه" }, 400);

  const conv = await env.D1.prepare("SELECT type FROM chat_conversations WHERE id = ?").bind(conversationId).first();
  if (!conv) return json({ error: "گفتگو پیدا نشد" }, 404);

  const member = await env.D1.prepare(
    "SELECT 1 AS ok FROM chat_conversation_members WHERE conversation_id = ? AND username = ?"
  ).bind(conversationId, username).first();
  if (!member) return json({ error: "عضو این گفتگو نیستی" }, 403);

  // مسدودسازی فقط برای گفتگوهای دونفره معنی داره؛ اگه هرکدوم از دو طرف اون‌یکی رو مسدود کرده باشه، ارسال ممنوعه
  if (conv.type === "direct") {
    const other = await env.D1.prepare(
      "SELECT username FROM chat_conversation_members WHERE conversation_id = ? AND username != ?"
    ).bind(conversationId, username).first();
    if (other) {
      const blocked = await env.D1.prepare(
        "SELECT 1 AS ok FROM chat_blocks WHERE (blocker_username = ? AND blocked_username = ?) OR (blocker_username = ? AND blocked_username = ?)"
      ).bind(username, other.username, other.username, username).first();
      if (blocked) return json({ error: "ارسال پیام به این گفتگو امکان‌پذیر نیست" }, 403);
    }
  }

  const msgType = ["text", "image", "video", "audio", "file", "sticker", "post_shortcut"].includes(body.msgType) ? body.msgType : "text";
  let text = null;
  let fileId = null;
  let isExternal = 0;
  let fileName = null;
  let fileSize = null;

  if (msgType === "text") {
    text = String(body.text || "").trim().slice(0, 2000);
    if (!text) return json({ error: "متن پیام خالیه" }, 400);
  } else if (msgType === "post_shortcut") {
    // شورتکاتِ فوروارد یه پست: بجای فایل، شناسه‌ی همون پست تو ستونِ file_id ذخیره می‌شه (این نوع پیام هیچ فایلِ واقعی‌ای نداره)
    const postId = (body.postId || "").toString().trim();
    if (!postId) return json({ error: "شناسه‌ی پست لازمه" }, 400);
    const postExists = await env.D1.prepare("SELECT id FROM posts WHERE id = ?").bind(postId).first();
    if (!postExists) return json({ error: "پست پیدا نشد" }, 404);
    fileId = postId;
    text = String(body.text || "پست").trim().slice(0, 100) || "پست";
  } else if (msgType === "sticker") {
    // درست مثل استیکر تو کامنت: یا sticker_id (استیکرِ شخصیِ آپلودشده روی تلگرام) یا sticker_url (استیکر پیش‌فرض از ریپوی گیت‌هاب)
    if (body.stickerId) {
      const sticker = await env.D1.prepare("SELECT file_id FROM stickers WHERE id = ?").bind(body.stickerId).first();
      if (!sticker) return json({ error: "استیکر پیدا نشد" }, 404);
      fileId = sticker.file_id;
      isExternal = 0;
    } else if (body.stickerUrl) {
      let parsed;
      try {
        parsed = new URL(body.stickerUrl.toString());
      } catch (e) {
        return json({ error: "لینک استیکر نامعتبره" }, 400);
      }
      if (parsed.hostname !== ALLOWED_STICKER_URL_HOST) return json({ error: "لینک استیکر مجاز نیست" }, 400);
      fileId = parsed.toString();
      isExternal = 1;
    } else {
      return json({ error: "استیکر انتخاب نشده" }, 400);
    }
  } else {
    fileId = body.fileId ? String(body.fileId).slice(0, 200) : null;
    if (!fileId) return json({ error: "فایل پیدا نشد؛ اول باید آپلودش کنی" }, 400);
    if (body.text) text = String(body.text).trim().slice(0, 300) || null; // کپشنِ اختیاری روی عکس/صدا/فایل
    if (msgType === "file") {
      fileName = body.fileName ? String(body.fileName).trim().slice(0, 200) : "فایل";
      fileSize = Number(body.fileSize) || null;
    }
  }

  // ریپلای اختیاریه: اگه شناسه‌ی یه پیامِ دیگه از همین گفتگو فرستاده باشه، بهش وصل می‌کنیم و پیش‌نمایشش رو
  // برای پاسخِ فوری (بدون نیاز به رفرش) آماده می‌کنیم
  let replyToId = null;
  let replyToPreview = null;
  if (body.replyTo) {
    const refMsg = await env.D1.prepare(
      "SELECT id, sender_username, msg_type, text, deleted_at FROM chat_messages WHERE id = ? AND conversation_id = ?"
    ).bind(String(body.replyTo), conversationId).first();
    if (refMsg) {
      replyToId = refMsg.id;
      replyToPreview = {
        id: refMsg.id,
        sender: refMsg.sender_username,
        msgType: refMsg.msg_type,
        text: refMsg.deleted_at ? null : refMsg.text,
        deleted: !!refMsg.deleted_at,
      };
    }
  }

  const id = `${Date.now()}_${randomHex(4)}`;
  const now = Date.now();

  await bind(
    env.D1.prepare(
      "INSERT INTO chat_messages (id, conversation_id, sender_username, msg_type, text, file_id, is_external, created_at, reply_to_message_id, forwarded_from, file_name, file_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ),
    [id, conversationId, username, msgType, text, fileId, isExternal, now, replyToId, null, fileName, fileSize]
  ).run();
  await env.D1.prepare("UPDATE chat_conversations SET last_message_at = ? WHERE id = ?").bind(now, conversationId).run();
  await env.D1.prepare(
    "UPDATE chat_conversation_members SET last_active_at = ? WHERE conversation_id = ? AND username = ?"
  ).bind(now, conversationId, username).run();
  touchUserPresence(env, username).catch(() => {});

  // اگه یه گروه تلگرامیِ مخصوصِ بک‌آپِ چت تنظیم شده باشه (متغیر CHAT_LOG_CHAT_ID تو تنظیمات ورکر)، متنِ پیام‌ها
  // همون‌جا هم لاگ می‌شه؛ صرفاً یه بک‌آپِ خامِ فقط-خواندنیه، D1 همچنان منبعِ اصلیِ چیزیه که خودِ سایت نشون می‌ده.
  // best-effort‌ه: نبودِ این متغیر یا خطای شبکه نباید جلوی ارسال خودِ پیام رو بگیره
  if (env.CHAT_LOG_CHAT_ID) {
    const logText = msgType === "text" ? text : msgType === "image" ? "[عکس]" : msgType === "video" ? "[فیلم]" : msgType === "audio" ? "[پیامِ صوتی]" : msgType === "file" ? `[فایل: ${fileName || ""}]` : msgType === "post_shortcut" ? `[پست: ${text || ""}]` : "[استیکر]";
    sendTelegramTextTo(env, env.CHAT_LOG_CHAT_ID, `#گفتگو_${conversationId}\n${username}: ${logText}`).catch(() => {});
  }

  await notifyChatMembersOfNewMessage(env, conv, conversationId, username, msgType, text, now);

  return json({
    message: {
      id,
      sender: username,
      msgType,
      text,
      fileId,
      fileName,
      fileSize,
      isExternal: !!isExternal,
      createdAt: now,
      editedAt: null,
      deleted: false,
      replyToId,
      replyTo: replyToPreview,
      pinnedAt: null,
      pinnedBy: null,
      forwardedFrom: null,
      reactions: [],
    },
  });
}

// #endregion
// #region چت: ویرایش پیام متنی (فقط خودِ فرستنده، فقط پیام‌های متنی/کپشن‌دار)
// ---------- چت: ویرایش پیام ----------
async function handleChatEditMessage(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const body = await request.json().catch(() => ({}));
  const conversationId = (body.conversationId || "").toString();
  const messageId = (body.messageId || "").toString();
  const text = String(body.text || "").trim().slice(0, 2000);
  if (!conversationId || !messageId) return json({ error: "اطلاعات لازم ناقصه" }, 400);
  if (!text) return json({ error: "متن پیام خالیه" }, 400);

  const msg = await env.D1.prepare(
    "SELECT sender_username, msg_type, deleted_at FROM chat_messages WHERE id = ? AND conversation_id = ?"
  ).bind(messageId, conversationId).first();
  if (!msg) return json({ error: "پیام پیدا نشد" }, 404);
  if (msg.deleted_at) return json({ error: "این پیام حذف شده" }, 400);
  if (msg.sender_username !== username) return json({ error: "فقط فرستنده‌ی پیام می‌تونه ویرایشش کنه" }, 403);
  if (msg.msg_type === "sticker") return json({ error: "استیکر قابل ویرایش نیست" }, 400);

  const now = Date.now();
  await env.D1.prepare(
    "UPDATE chat_messages SET text = ?, edited_at = ? WHERE id = ? AND conversation_id = ?"
  ).bind(text, now, messageId, conversationId).run();

  return json({ ok: true, text, editedAt: now });
}

// #endregion
// #region چت: حذف پیام (فرستنده‌ی خودش، یا مالک/ادمینِ گروه برای هر پیامی)
// ---------- چت: حذف پیام ----------
async function handleChatDeleteMessage(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversation");
  const messageId = url.searchParams.get("message");
  if (!conversationId || !messageId) return json({ error: "اطلاعات لازم ناقصه" }, 400);

  const conv = await env.D1.prepare("SELECT type FROM chat_conversations WHERE id = ?").bind(conversationId).first();
  if (!conv) return json({ error: "گفتگو پیدا نشد" }, 404);

  const msg = await env.D1.prepare(
    "SELECT sender_username, deleted_at FROM chat_messages WHERE id = ? AND conversation_id = ?"
  ).bind(messageId, conversationId).first();
  if (!msg) return json({ error: "پیام پیدا نشد" }, 404);
  if (msg.deleted_at) return json({ ok: true }); // از قبل حذف شده

  let allowed = msg.sender_username === username;
  if (!allowed && conv.type === "group") {
    const me = await getGroupMembership(env, conversationId, username);
    allowed = !!me && isGroupModerator(me.role);
  }
  if (!allowed) return json({ error: "اجازه‌ی حذف این پیام رو نداری" }, 403);

  await env.D1.prepare(
    "UPDATE chat_messages SET deleted_at = ?, text = NULL, file_id = NULL WHERE id = ? AND conversation_id = ?"
  ).bind(Date.now(), messageId, conversationId).run();

  return json({ ok: true });
}

// #endregion
// #region چت: پین/آن‌پین کردنِ پیام (فقط تو گروه، فقط مالک/ادمین)
const CHAT_MAX_PINNED_MESSAGES = 20;

async function handleChatPinMessage(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const body = await request.json().catch(() => ({}));
  const conversationId = (body.conversationId || "").toString();
  const messageId = (body.messageId || "").toString();
  if (!conversationId || !messageId) return json({ error: "اطلاعات لازم ناقصه" }, 400);

  const conv = await env.D1.prepare("SELECT type FROM chat_conversations WHERE id = ?").bind(conversationId).first();
  if (!conv) return json({ error: "گفتگو پیدا نشد" }, 404);
  if (conv.type !== "group") return json({ error: "پین فقط تو گروه‌ها ممکنه" }, 400);

  const me = await getGroupMembership(env, conversationId, username);
  if (!me || !isGroupModerator(me.role)) return json({ error: "فقط مالک/ادمینِ گروه می‌تونه پیام رو پین کنه" }, 403);

  const msg = await env.D1.prepare(
    "SELECT deleted_at FROM chat_messages WHERE id = ? AND conversation_id = ?"
  ).bind(messageId, conversationId).first();
  if (!msg || msg.deleted_at) return json({ error: "پیام پیدا نشد" }, 404);

  const pinnedCount = await env.D1.prepare(
    "SELECT COUNT(*) AS c FROM chat_messages WHERE conversation_id = ? AND pinned_at IS NOT NULL"
  ).bind(conversationId).first();
  if ((pinnedCount?.c || 0) >= CHAT_MAX_PINNED_MESSAGES) {
    return json({ error: `حداکثر ${CHAT_MAX_PINNED_MESSAGES} پیام قابلِ پین‌شدنه؛ اول یکی رو آن‌پین کن` }, 400);
  }

  await env.D1.prepare(
    "UPDATE chat_messages SET pinned_at = ?, pinned_by = ? WHERE id = ? AND conversation_id = ?"
  ).bind(Date.now(), username, messageId, conversationId).run();

  return json({ ok: true });
}

async function handleChatUnpinMessage(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const body = await request.json().catch(() => ({}));
  const conversationId = (body.conversationId || "").toString();
  const messageId = (body.messageId || "").toString();
  if (!conversationId || !messageId) return json({ error: "اطلاعات لازم ناقصه" }, 400);

  const conv = await env.D1.prepare("SELECT type FROM chat_conversations WHERE id = ?").bind(conversationId).first();
  if (!conv) return json({ error: "گفتگو پیدا نشد" }, 404);

  const me = await getGroupMembership(env, conversationId, username);
  if (!me || !isGroupModerator(me.role)) return json({ error: "فقط مالک/ادمینِ گروه می‌تونه آن‌پین کنه" }, 403);

  await env.D1.prepare(
    "UPDATE chat_messages SET pinned_at = NULL, pinned_by = NULL WHERE id = ? AND conversation_id = ?"
  ).bind(messageId, conversationId).run();

  return json({ ok: true });
}
// #endregion

// #region چت: ریکشن با ایموجی رو پیام (هر کاربر رو هر پیام فقط یه ریکشنِ فعال داره)
async function handleChatReactMessage(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "chat-react", username, 60, 60))) {
    return json({ error: "کمی آروم‌تر! بعداً دوباره امتحان کن" }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const conversationId = (body.conversationId || "").toString();
  const messageId = (body.messageId || "").toString();
  const emoji = (body.emoji || "").toString().trim().slice(0, 8);
  if (!conversationId || !messageId || !emoji) return json({ error: "اطلاعات لازم ناقصه" }, 400);

  const member = await env.D1.prepare(
    "SELECT 1 AS ok FROM chat_conversation_members WHERE conversation_id = ? AND username = ?"
  ).bind(conversationId, username).first();
  if (!member) return json({ error: "به این گفتگو دسترسی نداری" }, 403);

  const msg = await env.D1.prepare(
    "SELECT deleted_at FROM chat_messages WHERE id = ? AND conversation_id = ?"
  ).bind(messageId, conversationId).first();
  if (!msg || msg.deleted_at) return json({ error: "پیام پیدا نشد" }, 404);

  await env.D1.prepare(
    "INSERT INTO chat_message_reactions (message_id, username, emoji, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (message_id, username) DO UPDATE SET emoji = excluded.emoji, created_at = excluded.created_at"
  ).bind(messageId, username, emoji, Date.now()).run();

  const row = await env.D1.prepare(`SELECT ${CHAT_MESSAGE_SELECT_COLUMNS} FROM chat_messages WHERE id = ?`).bind(messageId).first();
  return json({ reactions: row ? mapChatMessageRow(row).reactions : [] });
}

async function handleChatUnreactMessage(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const body = await request.json().catch(() => ({}));
  const conversationId = (body.conversationId || "").toString();
  const messageId = (body.messageId || "").toString();
  if (!conversationId || !messageId) return json({ error: "اطلاعات لازم ناقصه" }, 400);

  const member = await env.D1.prepare(
    "SELECT 1 AS ok FROM chat_conversation_members WHERE conversation_id = ? AND username = ?"
  ).bind(conversationId, username).first();
  if (!member) return json({ error: "به این گفتگو دسترسی نداری" }, 403);

  await env.D1.prepare("DELETE FROM chat_message_reactions WHERE message_id = ? AND username = ?").bind(messageId, username).run();

  const row = await env.D1.prepare(`SELECT ${CHAT_MESSAGE_SELECT_COLUMNS} FROM chat_messages WHERE id = ?`).bind(messageId).first();
  return json({ reactions: row ? mapChatMessageRow(row).reactions : [] });
}
// #endregion

// #region چت: جست‌وجوی متن داخلِ یک مکالمه
async function handleChatSearchMessages(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversation");
  const q = (url.searchParams.get("q") || "").trim().slice(0, 200);
  if (!conversationId) return json({ error: "شناسه‌ی گفتگو لازمه" }, 400);
  if (q.length < 2) return json({ error: "حداقل ۲ کاراکتر بنویس" }, 400);

  const member = await env.D1.prepare(
    "SELECT 1 AS ok FROM chat_conversation_members WHERE conversation_id = ? AND username = ?"
  ).bind(conversationId, username).first();
  if (!member) return json({ error: "به این گفتگو دسترسی نداری" }, 403);

  const escaped = q.replace(/[%_\\]/g, (c) => `\\${c}`);
  const rows = await env.D1.prepare(
    "SELECT id, sender_username, msg_type, text, created_at FROM chat_messages WHERE conversation_id = ? AND deleted_at IS NULL AND msg_type = 'text' AND text LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT 50"
  ).bind(conversationId, `%${escaped}%`).all();

  const results = (rows.results || []).map((r) => ({
    id: r.id,
    sender: r.sender_username,
    msgType: r.msg_type,
    text: r.text,
    createdAt: r.created_at,
  }));
  return json({ results });
}
// #endregion

// #region چت: سایلنت‌کردنِ نوتیفِ یه گفتگو (بدونِ بلاک/ترک‌کردن)
async function handleChatMute(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const body = await request.json().catch(() => ({}));
  const conversationId = (body.conversationId || "").toString();
  const muted = !!body.muted;
  if (!conversationId) return json({ error: "شناسه‌ی گفتگو لازمه" }, 400);

  const result = await env.D1.prepare(
    "UPDATE chat_conversation_members SET muted = ? WHERE conversation_id = ? AND username = ?"
  ).bind(muted ? 1 : 0, conversationId, username).run();
  if (!result.meta || result.meta.changes === 0) return json({ error: "به این گفتگو دسترسی نداری" }, 403);

  return json({ ok: true, muted });
}
// #endregion

// #region چت: فوروارد پیام به یک یا چند مکالمه‌ی دیگه
async function handleChatForwardMessage(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "chat-forward", username, 20, 60))) {
    return json({ error: "کمی آروم‌تر! بعداً دوباره امتحان کن" }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const sourceConversationId = (body.sourceConversationId || "").toString();
  const messageId = (body.messageId || "").toString();
  const targetConversationIds = Array.isArray(body.targetConversationIds)
    ? [...new Set(body.targetConversationIds.map((x) => String(x)))].slice(0, 15)
    : [];
  if (!sourceConversationId || !messageId || targetConversationIds.length === 0) {
    return json({ error: "اطلاعات لازم ناقصه" }, 400);
  }

  const sourceMember = await env.D1.prepare(
    "SELECT 1 AS ok FROM chat_conversation_members WHERE conversation_id = ? AND username = ?"
  ).bind(sourceConversationId, username).first();
  if (!sourceMember) return json({ error: "به این گفتگو دسترسی نداری" }, 403);

  const original = await env.D1.prepare(
    "SELECT sender_username, msg_type, text, file_id, is_external, deleted_at, file_name, file_size FROM chat_messages WHERE id = ? AND conversation_id = ?"
  ).bind(messageId, sourceConversationId).first();
  if (!original || original.deleted_at) return json({ error: "پیام پیدا نشد" }, 404);

  const forwardedFromLabel = original.sender_username;
  const sentTo = [];
  for (const targetConversationId of targetConversationIds) {
    const targetMember = await env.D1.prepare(
      "SELECT 1 AS ok FROM chat_conversation_members WHERE conversation_id = ? AND username = ?"
    ).bind(targetConversationId, username).first();
    if (!targetMember) continue; // عضوِ اون مکالمه نیست؛ بی‌سروصدا ردش کن

    const targetConv = await env.D1.prepare("SELECT type FROM chat_conversations WHERE id = ?").bind(targetConversationId).first();
    if (!targetConv) continue;

    const id = `${Date.now()}_${randomHex(4)}`;
    const now = Date.now();
    await env.D1.prepare(
      "INSERT INTO chat_messages (id, conversation_id, sender_username, msg_type, text, file_id, is_external, created_at, reply_to_message_id, forwarded_from, file_name, file_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, targetConversationId, username, original.msg_type, original.text, original.file_id, original.is_external, now, null, forwardedFromLabel, original.file_name || null, original.file_size || null).run();
    await env.D1.prepare("UPDATE chat_conversations SET last_message_at = ? WHERE id = ?").bind(now, targetConversationId).run();
    await env.D1.prepare(
      "UPDATE chat_conversation_members SET last_active_at = ? WHERE conversation_id = ? AND username = ?"
    ).bind(now, targetConversationId, username).run();

    notifyChatMembersOfNewMessage(env, targetConv, targetConversationId, username, original.msg_type, original.text, now).catch(() => {});
    sentTo.push(targetConversationId);
  }

  return json({ ok: true, sentTo });
}
// #endregion

// #region چت: علامت‌زدن یک گفتگو به‌عنوان خوانده‌شده
// ---------- چت: علامت‌زدن یک گفتگو به‌عنوان خوانده‌شده ----------
async function handleChatRead(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const body = await request.json().catch(() => ({}));
  const conversationId = (body.conversationId || "").toString();
  if (!conversationId) return json({ error: "شناسه‌ی گفتگو لازمه" }, 400);

  await env.D1.prepare(
    "UPDATE chat_conversation_members SET last_read_at = ? WHERE conversation_id = ? AND username = ?"
  ).bind(Date.now(), conversationId, username).run();
  touchUserPresence(env, username).catch(() => {});

  return json({ ok: true });
}

// #endregion
// #region چت: آپلود عکس/صدا برای پیام (همون الگوی آپلود رسانه‌ی بقیه‌ی سایت؛ نتیجه‌اش file_id تلگرامه که
// بعد از طریق پیامِ WebSocket برای گفتگو فرستاده می‌شه، نه این‌که خودش پیام رو ثبت کنه)
// ---------- چت: آپلود عکس/صدا برای پیام ----------
// #region آپلودِ استیج‌بندی‌شده/رزوم‌پذیر (برای اینترنتِ کند/ناپایدار) — روی D1، بدون نیاز به R2/پرداخت
// چرا: یه آپلودِ تکی و حجیم رویِ اینترنتِ ناپایدار (مثلاً وقتی سرعت تا ۲۸٪ یا ۵۰٪ می‌ره و قطع می‌شه)
// شکننده‌ست و با هر قطعی از صفر شروع می‌شه. راه‌حل: فایل رویِ خودِ مرورگر به چند تکه (پارت) تقسیم
// می‌شه؛ هر تکه جدا آپلود و رویِ همون D1ای که از قبل استفاده می‌کنی نگه داشته می‌شه (نه R2 — نیازی
// به فعال‌سازیِ سرویسِ جدید یا کارتِ بانکی نیست)؛ اگه یه تکه شکست بخوره، فقط همون تکه دوباره
// امتحان می‌شه (نه کلِ فایل)؛ و اگه صفحه/اتصال کلاً قطع بشه، با یه درخواستِ status می‌شه فهمید
// کدوم تکه‌ها از قبل رسیدن و آپلود رو دقیقاً از همونجا ادامه داد.
//
// جدول‌های لازم توی D1 (یک‌بار، توی کنسولِ D1 اجرا کن):
//   CREATE TABLE IF NOT EXISTS chunked_uploads (
//     upload_id TEXT PRIMARY KEY,
//     username TEXT NOT NULL,
//     kind TEXT NOT NULL,
//     file_size INTEGER NOT NULL,
//     mime_type TEXT NOT NULL,
//     chunk_size INTEGER NOT NULL,
//     total_chunks INTEGER NOT NULL,
//     created_at INTEGER NOT NULL
//   );
//   CREATE TABLE IF NOT EXISTS chunked_upload_parts (
//     upload_id TEXT NOT NULL,
//     chunk_index INTEGER NOT NULL,
//     data BLOB NOT NULL,
//     created_at INTEGER NOT NULL,
//     PRIMARY KEY (upload_id, chunk_index)
//   );
//   CREATE INDEX IF NOT EXISTS idx_chunked_upload_parts_upload ON chunked_upload_parts (upload_id);

// اندازه‌ی هر تکه از سمتِ سرور محدود می‌شه تا زیرِ سقفِ اندازه‌ی هر ستونِ D1 بمونه.
// نکته‌ی مهم (که قبلاً باعثِ کندی و شکنندگیِ آپلود می‌شد): سقفِ واقعیِ D1 برای هر ردیف/BLOB
// حدودِ ۲ مگابایته، و مهم‌تر از اون، هر invocationِ ورکر فقط تا ۵۰ subrequest (پلنِ رایگان) یا
// ۱۰۰۰ تا (پلنِ پولی) می‌تونه به D1/بیرون بزنه. با چانکِ ۷۰۰ کیلوبایتیِ قدیم، یه ویدیوی ۵۰
// مگابایتی می‌شد ~۷۲ تکه — که مرحله‌ی «تکمیل» (merge کردنِ تکه‌ها) به‌تنهایی ۷۲ تا کوئریِ D1 توی
// یه invocation می‌زد و رویِ پلنِ رایگان مستقیماً به سقفِ subrequest می‌خورد و شکست می‌خورد، بدونِ
// اینکه پیغامِ خطا این علتِ واقعی رو نشون بده. حالا با چانکِ ۱.۵ مگابایتی، همون ویدیو ~۳۴ تکه می‌شه:
// هم تعدادِ درخواست‌ها (و درنتیجه سربارِ رفت‌وبرگشتِ شبکه) تقریباً نصف می‌شه، هم مرحله‌ی تکمیل
// همیشه زیرِ سقفِ ۵۰ subrequest می‌مونه.
const CHUNK_UPLOAD_MIN_SIZE = 256 * 1024;
const CHUNK_UPLOAD_MAX_SIZE = 1536 * 1024;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- اجرای موازیِ محدود (concurrency pool) ----------
// چرا: قبلاً موقعِ چسبوندنِ تکه‌ها (merge)، هر تکه با یه await سرتاسری و پشتِ‌سرِهم از D1 خونده
// می‌شد؛ برای فایل‌های چندتکه‌ای این یعنی جمعِ تأخیرِ رفت‌وبرگشتِ تک‌تکِ کوئری‌ها. حالا چند تا
// کوئری هم‌زمان (نه همه‌ی‌شون با هم، برای اینکه به D1 فشار نیاد) اجرا می‌شن.
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runNext() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await worker(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

// ---------- فرستادنِ فایل به تلگرام با چندبار تلاش ----------
// چرا: خودِ sendTelegramFile قبلاً فقط یه‌بار امتحان می‌شد؛ اگه همون یه درخواست به تلگرام (که
// می‌تونه چندین مگابایت باشه) به‌خاطرِ یه قطعیِ گذرا شکست می‌خورد، کلِ آپلود شکست می‌خورد با اینکه
// فایل کاملاً رویِ سرورِ ما آماده بود. حالا چندبار (با فاصله‌ی کوتاه، و هر بار با شانسِ انتخابِ باتِ
// دیگه چون pickTelegramBot خودش تصادفیه) امتحان می‌شه.
async function sendTelegramFileWithRetry(env, method, field, file, caption, extraFields = {}, attempts = 3) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await sendTelegramFile(env, method, field, file, caption, extraFields);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await sleep(500 * (i + 1));
    }
  }
  throw lastErr;
}

// پاک‌سازیِ فرصت‌طلبانه‌ی جلسه‌های رهاشده (بدونِ نیازِ کرون جدا): هر بار init صدا زده بشه، با
// احتمالِ کم یه پاک‌سازیِ جلسه‌های قدیمی‌تر از ۲۴ ساعت هم انجام می‌شه
async function maybeCleanupStaleChunkedUploads(env) {
  if (Math.random() > 0.05) return;
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const stale = await env.D1.prepare("SELECT upload_id FROM chunked_uploads WHERE created_at < ?").bind(cutoff).all();
    for (const row of stale.results || []) {
      await deleteChunkedUploadRows(env, row.upload_id);
    }
  } catch (err) {
    console.error("خطای پاک‌سازیِ خودکارِ آپلودهای رهاشده:", err);
  }
}

async function deleteChunkedUploadRows(env, uploadId) {
  try {
    await env.D1.prepare("DELETE FROM chunked_upload_parts WHERE upload_id = ?").bind(uploadId).run();
    await env.D1.prepare("DELETE FROM chunked_uploads WHERE upload_id = ?").bind(uploadId).run();
  } catch (err) {
    console.error("خطای پاک‌سازیِ آپلودِ استیج‌بندی‌شده:", err);
  }
}

async function handleUploadInit(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "chunked_upload_init", username, 20, 300))) {
    return json({ error: "درخواست‌های زیاد؛ چند دقیقه دیگه امتحان کن" }, 429);
  }
  await maybeCleanupStaleChunkedUploads(env);

  const body = await request.json().catch(() => ({}));
  const kind = (body.kind || "").toString();
  const fileSize = Number(body.fileSize) || 0;
  const mimeType = (body.mimeType || "").toString();
  const chunkSize = Math.max(CHUNK_UPLOAD_MIN_SIZE, Math.min(CHUNK_UPLOAD_MAX_SIZE, Number(body.chunkSize) || CHUNK_UPLOAD_MIN_SIZE));

  if (!["image", "video", "audio", "file"].includes(kind)) {
    return json({ error: "نوع فایل نامعتبره" }, 400);
  }
  const maxSize = kind === "image" ? 8 * 1024 * 1024 : kind === "video" ? 50 * 1024 * 1024 : kind === "file" ? 20 * 1024 * 1024 : 15 * 1024 * 1024;
  if (fileSize <= 0 || fileSize > maxSize) {
    return json({ error: `حجم فایل نباید بیشتر از ${Math.round(maxSize / 1024 / 1024)} مگابایت باشه` }, 400);
  }
  // برای «file» (سند/زیپ/pdf و...) هیچ محدودیتِ نوعِ MIMEای اعمال نمی‌شه؛ هر نوع فایلی مجازه
  if (kind !== "file") {
    const typeCheck = kind === "image" ? /^image\// : kind === "video" ? /^video\// : /^audio\//;
    if (!typeCheck.test(mimeType)) {
      return json({ error: "نوع فایل با دسته‌ی انتخابی مطابقت نداره" }, 400);
    }
  }

  const totalChunks = Math.max(1, Math.ceil(fileSize / chunkSize));
  const uploadId = crypto.randomUUID();
  try {
    await env.D1.prepare(
      "INSERT INTO chunked_uploads (upload_id, username, kind, file_size, mime_type, chunk_size, total_chunks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(uploadId, username, kind, fileSize, mimeType, chunkSize, totalChunks, Date.now())
      .run();
  } catch (err) {
    console.error("خطای شروعِ آپلودِ استیج‌بندی‌شده (احتمالاً جدول‌های D1 ساخته نشدن):", err);
    return json({ error: "آپلودِ استیج‌بندی‌شده رویِ سرور آماده نیست" }, 500);
  }

  return json({ uploadId, chunkSize, totalChunks });
}

async function getChunkedUploadManifest(env, username, uploadId) {
  const row = await env.D1.prepare("SELECT * FROM chunked_uploads WHERE upload_id = ? AND username = ?").bind(uploadId, username).first();
  return row || null;
}

async function handleUploadChunk(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const form = await request.formData();
  const uploadId = (form.get("uploadId") || "").toString();
  const chunkIndex = Number(form.get("chunkIndex"));
  const chunk = form.get("chunk");
  if (!uploadId || !Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return json({ error: "درخواستِ نامعتبر" }, 400);
  }
  if (!chunk || typeof chunk === "string" || chunk.size === 0) {
    return json({ error: "تکه‌ی فایل خالیه" }, 400);
  }

  const manifest = await getChunkedUploadManifest(env, username, uploadId);
  if (!manifest) return json({ error: "این جلسه‌ی آپلود پیدا نشد یا منقضی شده؛ از اول شروع کن" }, 404);
  if (chunkIndex >= manifest.total_chunks) {
    return json({ error: "اندیسِ تکه نامعتبره" }, 400);
  }
  if (chunk.size > CHUNK_UPLOAD_MAX_SIZE + 1024) {
    return json({ error: "اندازه‌ی این تکه بیش‌ازحدِ مجازه" }, 400);
  }

  if (!(await checkRateLimit(env, "chunked_upload_chunk", username, 900, 300))) {
    return json({ error: "درخواست‌های زیاد؛ چند دقیقه دیگه امتحان کن" }, 429);
  }

  // مستقیم ArrayBuffer رو بایند می‌کنیم (نه Uint8Array): این استانداردترین نوعِ داده‌ای‌ایه که D1
  // برایِ ستونِ BLOB انتظار داره؛ بایندکردنِ TypedArray می‌تونست باعثِ رفتارِ نامشخص (و در نتیجه
  // «خراب» به‌نظر رسیدنِ دیتا موقعِ خوندن) بشه.
  const chunkArrayBuffer = await chunk.arrayBuffer();
  try {
    await env.D1.prepare(
      "INSERT INTO chunked_upload_parts (upload_id, chunk_index, data, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(upload_id, chunk_index) DO UPDATE SET data = excluded.data"
    )
      .bind(uploadId, chunkIndex, chunkArrayBuffer, Date.now())
      .run();
  } catch (err) {
    console.error("خطای ذخیره‌ی تکه‌ی آپلود:", err);
    return json({ error: "ذخیره‌سازیِ این تکه ناموفق بود" }, 500);
  }

  return json({ ok: true });
}

async function handleUploadStatus(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const url = new URL(request.url);
  const uploadId = (url.searchParams.get("uploadId") || "").toString();
  if (!uploadId) return json({ error: "درخواستِ نامعتبر" }, 400);

  const manifest = await getChunkedUploadManifest(env, username, uploadId);
  if (!manifest) return json({ error: "این جلسه‌ی آپلود پیدا نشد یا منقضی شده" }, 404);

  const rows = await env.D1.prepare("SELECT chunk_index FROM chunked_upload_parts WHERE upload_id = ? ORDER BY chunk_index").bind(uploadId).all();
  const receivedChunks = (rows.results || []).map((r) => r.chunk_index);

  return json({ totalChunks: manifest.total_chunks, chunkSize: manifest.chunk_size, receivedChunks });
}

async function handleUploadComplete(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "chunked_upload_complete", username, 20, 300))) {
    return json({ error: "درخواست‌های زیاد؛ چند دقیقه دیگه امتحان کن" }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const uploadId = (body.uploadId || "").toString();
  if (!uploadId) return json({ error: "درخواستِ نامعتبر" }, 400);
  // اسمِ اصلیِ فایل فقط برای kind === "file" معنی داره (سند/زیپ/pdf و...)؛ برای بقیه‌ی انواع نادیده گرفته می‌شه
  const clientFileName = body.fileName ? String(body.fileName).trim().slice(0, 200) : null;

  const manifest = await getChunkedUploadManifest(env, username, uploadId);
  if (!manifest) return json({ error: "این جلسه‌ی آپلود پیدا نشد یا منقضی شده" }, 404);

  // این بخش (خوندنِ تکه‌ها از D1 و چسبوندنشون به هم) قبلاً با یه SELECT بزرگ همه‌ی تکه‌ها رو با هم
  // می‌خوند. برای فایل‌های کوچیکِ چت (۱-۲ تکه) مشکلی نداشت، ولی برای فایل‌های بزرگ‌تر مثل یه آهنگِ
  // کامل (۲۰+ تکه، رویِ هم چندین مگابایت) به سقفِ اندازه‌ی پاسخِ یه‌کوئریِ D1 می‌خورد و کل درخواست
  // شکست می‌خورد. به‌جاش هر تکه جدا خونده می‌شه — هم امن‌تره، هم اگه یه تکه‌ی خاص مشکل داشته باشه،
  // دقیقاً همون رو (با شماره‌اش) تو لاگ و پیغامِ خطا مشخص می‌کنه. تنها فرقِ الان با قبل اینه که
  // به‌جایِ یکی‌یکی و پشتِ‌سرِهم (که برایِ فایل‌هایِ چندتکه‌ای جمعِ کندیِ رفت‌وبرگشتِ هر کوئری رو
  // روی هم می‌ذاشت)، چندتا کوئری هم‌زمان اجرا می‌شن (مثلِ قبل، همچنان زیرِ سقفِ subrequestِ ورکر،
  // چون تعدادِ کلِ تکه‌ها با چانکِ بزرگ‌ترِ جدید خیلی کمتره) — همون نتیجه، به‌طورِ محسوسی سریع‌تر.
  let file;
  try {
    const totalChunks = manifest.total_chunks;
    const indices = Array.from({ length: totalChunks }, (_, i) => i);
    const chunkBuffers = await mapWithConcurrency(indices, 6, async (i) => {
      const row = await env.D1.prepare("SELECT data FROM chunked_upload_parts WHERE upload_id = ? AND chunk_index = ?").bind(uploadId, i).first();
      if (!row || row.data == null) {
        throw new Error(`MISSING_CHUNK:${i}`);
      }
      // نکته‌ی مهم: چک‌کردنِ نوعِ دیتا با «instanceof ArrayBuffer» غیرقابل‌اعتماده، چون دیتایی که از
      // D1 برمی‌گرده ممکنه از یه «رِلمِ» جاوااسکریپتیِ دیگه باشه (مثلاً از داخلِ خودِ ران‌تایمِ ورکر)،
      // و instanceof بینِ رِلم‌های مختلف درست کار نمی‌کنه حتی اگه واقعاً ArrayBuffer باشه. به‌جاش
      // مستقیم سعی می‌کنیم بسازیمش با new Uint8Array(...) که کاملاً ساختاری کار می‌کنه و به رِلم
      // وابسته نیست؛ اگه واقعاً خراب باشه همینجا خطا می‌ده و می‌فهمیم.
      try {
        return row.data instanceof Uint8Array ? row.data : new Uint8Array(row.data);
      } catch (convErr) {
        console.error(`تبدیلِ دیتای تکه‌ی شماره‌ی ${i} به بایت ناموفق بود:`, convErr && convErr.message, "typeof:", typeof row.data);
        throw new Error(`CORRUPT_CHUNK:${i}`);
      }
    });

    let totalSize = 0;
    for (const bytes of chunkBuffers) totalSize += bytes.byteLength;
    const merged = new Uint8Array(totalSize);
    let offset = 0;
    for (const bytes of chunkBuffers) {
      merged.set(bytes, offset);
      offset += bytes.byteLength;
    }

    const fileName = manifest.kind === "image" ? "upload.jpg" : manifest.kind === "video" ? "upload.mp4" : manifest.kind === "file" ? (clientFileName || "file") : "upload.mp3";
    // از Blob به‌جای File استفاده می‌کنیم: سازنده‌ی File توی بعضی نسخه‌های ران‌تایمِ ورکرها به‌طورِ
    // کامل در دسترس نیست و باعثِ خطای بی‌صداتر می‌شد (که فقط تویِ لاگِ سرور دیده می‌شد، نه پیغامِ
    // دقیق برای کاربر). Blob همه‌جا پشتیبانی می‌شه؛ فقط چون sendTelegramFile از file.name برای
    // اسمِ فایل استفاده می‌کنه، خودمون دستی همون خاصیت رو رویِ Blob می‌ذاریم.
    const mergedBlob = new Blob([merged], { type: manifest.mime_type });
    Object.defineProperty(mergedBlob, "name", { value: fileName, writable: false });
    file = mergedBlob;
  } catch (err) {
    const msg = (err && err.message) || "";
    const missingMatch = msg.match(/^(MISSING|CORRUPT)_CHUNK:(\d+)$/);
    if (missingMatch) {
      const label = missingMatch[1] === "MISSING" ? "پیدا نشد" : "خراب بود";
      console.error(`خطای چسبوندنِ تکه‌های آپلود به هم: تکه‌ی شماره‌ی ${missingMatch[2]} ${label}`);
      // تکه‌های ذخیره‌شده واقعاً ناقص/خراب‌ان، نگه‌داشتنشون فایده‌ای نداره؛ کاربر باید از اول شروع کنه
      await deleteChunkedUploadRows(env, uploadId);
      return json({ error: `تکه‌ی ${Number(missingMatch[2]) + 1} از ${manifest.total_chunks} ${label}؛ آپلود کامل نیست، دوباره امتحان کن` }, 409);
    }
    console.error("خطای چسبوندنِ تکه‌های آپلود به هم:", err && err.message, err && err.stack);
    await deleteChunkedUploadRows(env, uploadId);
    return json({ error: "چسبوندنِ تکه‌های فایل به هم ناموفق بود، دوباره امتحان کن" }, 502);
  }

  if (!(await verifyFileMatchesCategory(file, manifest.kind))) {
    await deleteChunkedUploadRows(env, uploadId);
    return json({ error: "محتوای فایل با نوع اعلام‌شده‌اش مطابقت نداره" }, 400);
  }

  // نکته‌ی مهمِ پایداری: قبلاً این بخش، صرف‌نظر از موفقیت/شکستِ فرستادن به تلگرام، همیشه (تویِ finally)
  // تکه‌های ذخیره‌شده رو پاک می‌کرد. یعنی اگه فرستادن به تلگرام به‌خاطرِ یه قطعیِ گذرا شکست می‌خورد
  // (که رویِ اینترنتِ ناپایدار خیلی محتمله)، فایلی که کاربر با زحمت و صبر تکه‌تکه آپلود کرده بود
  // (که می‌تونست چند مگابایت باشه) کاملاً از دست می‌رفت و باید از صفر آپلود می‌شد. حالا تکه‌ها فقط
  // وقتی پاک می‌شن که یا واقعاً موفق بشیم، یا خودِ فایل به‌طورِ ذاتی خراب/نامعتبر باشه؛ برای خطاهای
  // گذرای تلگرام، تکه‌ها دست‌نخورده می‌مونن تا با یه تلاشِ دیگه‌ی /api/upload/complete (بدونِ نیازِ
  // به آپلودِ دوباره‌ی خودِ فایل) کامل بشه.
  let fileId = null;
  let messageId = null;
  try {
    if (manifest.kind === "image") {
      const result = await sendTelegramFileWithRetry(env, "sendPhoto", "photo", file, undefined);
      fileId = extractFileId("photo", result);
      messageId = result.message_id || null;
    } else if (manifest.kind === "video") {
      const result = await sendTelegramFileWithRetry(env, "sendVideo", "video", file, undefined);
      fileId = extractFileId("video", result);
      messageId = result.message_id || null;
    } else if (manifest.kind === "file") {
      const result = await sendTelegramFileWithRetry(env, "sendDocument", "document", file, undefined);
      fileId = extractFileId("document", result);
      messageId = result.message_id || null;
    } else {
      const result = await sendTelegramFileWithRetry(env, "sendAudio", "audio", file, undefined);
      fileId = extractFileId("audio", result);
      messageId = result.message_id || null;
    }
  } catch (err) {
    console.error("خطای تکمیلِ آپلودِ استیج‌بندی‌شده (تلگرام):", err && err.message);
    return json({ error: "ارسال به تلگرام ناموفق بود؛ فایل رویِ سرور محفوظه، دوباره امتحان کن" }, 502);
  }

  await deleteChunkedUploadRows(env, uploadId);

  if (!fileId) return json({ error: "دریافت فایل از تلگرام ناموفق بود" }, 502);
  // پستِ اصلی (handlePost) این fileId/messageId رو مستقیماً استفاده می‌کنه تا مجبور نباشه فایل رو
  // دوباره به تلگرام بفرسته — همون فایلی که همینجا (از روی تکه‌های چانک‌شده) قبلاً فرستاده شد
  return json({ fileId, messageId });
}

async function handleUploadAbort(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const body = await request.json().catch(() => ({}));
  const uploadId = (body.uploadId || "").toString();
  if (!uploadId) return json({ error: "درخواستِ نامعتبر" }, 400);

  const manifest = await getChunkedUploadManifest(env, username, uploadId);
  if (manifest) await deleteChunkedUploadRows(env, uploadId);
  return json({ ok: true });
}
// #endregion

async function handleChatUploadMedia(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "chat_media_upload", username, 20, 300))) {
    return json({ error: "آپلود زیاد بوده، چند دقیقه دیگه امتحان کن" }, 429);
  }

  const form = await request.formData();
  const file = form.get("file");
  const kind = (form.get("kind") || "").toString();
  if (!file || typeof file === "string" || file.size === 0) {
    return json({ error: "فایلی انتخاب نشده" }, 400);
  }
  if (!["image", "video", "audio"].includes(kind)) {
    return json({ error: "نوع فایل نامعتبره" }, 400);
  }

  const maxSize = kind === "image" ? 8 * 1024 * 1024 : kind === "video" ? 50 * 1024 * 1024 : 15 * 1024 * 1024;
  if (file.size > maxSize) {
    return json({ error: `حجم فایل نباید بیشتر از ${Math.round(maxSize / 1024 / 1024)} مگابایت باشه` }, 400);
  }
  const typeCheck = kind === "image" ? /^image\// : kind === "video" ? /^video\// : /^audio\//;
  if (!typeCheck.test(file.type)) {
    return json({ error: "نوع فایل با دسته‌ی انتخابی مطابقت نداره" }, 400);
  }
  if (!(await verifyFileMatchesCategory(file, kind))) {
    return json({ error: "محتوای فایل با نوع اعلام‌شده‌اش مطابقت نداره" }, 400);
  }

  let fileId = null;
  try {
    if (kind === "image") {
      const result = await sendTelegramFile(env, "sendPhoto", "photo", file, undefined);
      fileId = extractFileId("photo", result);
    } else if (kind === "video") {
      const result = await sendTelegramFile(env, "sendVideo", "video", file, undefined);
      fileId = extractFileId("video", result);
    } else {
      const result = await sendTelegramFile(env, "sendAudio", "audio", file, undefined);
      fileId = extractFileId("audio", result);
    }
  } catch (err) {
    console.error("خطای آپلود رسانه‌ی چت:", err);
    return json({ error: "آپلود ناموفق بود، دوباره امتحان کن" }, 502);
  }

  if (!fileId) return json({ error: "دریافت فایل از تلگرام ناموفق بود" }, 502);
  return json({ fileId });
}

// ---------- آپلودِ رسانه‌ی چت از روی پلِ موقت (litterbox) ----------
// نسخه‌ی جایگزینِ handleChatUploadMedia: به‌جایِ گرفتنِ خودِ فایل از بدنه‌ی درخواست، فقط یه لینکِ
// litterbox می‌گیره، خودش فایل رو (رویِ شبکه‌ی سریعِ کلادفلر) از اونجا می‌کشه و بقیه‌ی مسیر
// (چک نوع/حجم/محتوایِ واقعی، فرستادن به تلگرام) دقیقاً مثلِ نسخه‌ی قبلیه.
async function handleChatUploadMediaFromUrl(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "chat_media_upload", username, 20, 300))) {
    return json({ error: "آپلود زیاد بوده، چند دقیقه دیگه امتحان کن" }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const kind = (body.kind || "").toString();
  const bridgeUrl = (body.url || "").toString();
  if (!["image", "video", "audio"].includes(kind)) {
    return json({ error: "نوع فایل نامعتبره" }, 400);
  }
  if (!isAllowedBridgeUrl(bridgeUrl)) {
    return json({ error: "آدرسِ فایل نامعتبره" }, 400);
  }

  const maxSize = kind === "image" ? 8 * 1024 * 1024 : kind === "video" ? 50 * 1024 * 1024 : 15 * 1024 * 1024;
  let blob;
  try {
    blob = await fetchBridgeFile(bridgeUrl, maxSize);
  } catch (err) {
    return json({ error: err.message || "دریافتِ فایل ناموفق بود" }, 502);
  }

  const guessedType = blob.type || (kind === "image" ? "image/jpeg" : kind === "video" ? "video/mp4" : "audio/mpeg");
  const bridgeFileName = kind === "image" ? "upload.jpg" : kind === "video" ? "upload.mp4" : "upload.mp3";
  const file = new Blob([blob], { type: guessedType });
  Object.defineProperty(file, "name", { value: bridgeFileName, writable: false });

  if (!(await verifyFileMatchesCategory(file, kind))) {
    return json({ error: "محتوای فایل با نوع اعلام‌شده‌اش مطابقت نداره" }, 400);
  }

  let fileId = null;
  try {
    if (kind === "image") {
      const result = await sendTelegramFile(env, "sendPhoto", "photo", file, undefined);
      fileId = extractFileId("photo", result);
    } else if (kind === "video") {
      const result = await sendTelegramFile(env, "sendVideo", "video", file, undefined);
      fileId = extractFileId("video", result);
    } else {
      const result = await sendTelegramFile(env, "sendAudio", "audio", file, undefined);
      fileId = extractFileId("audio", result);
    }
  } catch (err) {
    console.error("خطای آپلود رسانه‌ی چت (از پلِ موقت):", err);
    return json({ error: "آپلود ناموفق بود، دوباره امتحان کن" }, 502);
  }

  if (!fileId) return json({ error: "دریافت فایل از تلگرام ناموفق بود" }, 502);
  return json({ fileId });
}

// #endregion
// #region چک در دسترس‌بودنِ نام کاربری جدید (برای اعتبارسنجی زنده‌ی فرم تغییر نام کاربری)
// ---------- چک در دسترس‌بودنِ نام کاربری جدید ----------
async function handleCheckUsername(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const url = new URL(request.url);
  const candidate = (url.searchParams.get("username") || "").trim();

  if (!USERNAME_RE.test(candidate)) {
    return json({ available: false, reason: "نام کاربری باید ۳ تا ۲۰ کاراکتر و فقط شامل حروف، عدد و _ باشه" });
  }
  if (candidate === username) {
    return json({ available: false, reason: "این همون نام کاربری فعلیته" });
  }

  const existing = await env.D1.prepare("SELECT username FROM users WHERE username = ?").bind(candidate).first();
  if (existing) {
    return json({ available: false, reason: "این نام کاربری قبلاً گرفته شده" });
  }

  return json({ available: true });
}

// #endregion
// #region تغییر نام کاربری (روی همه‌ی جدول‌هایی که یوزرنیم رو نگه می‌دارن یکجا اعمال می‌شه)
// ---------- تغییر نام کاربری ----------
// نکته‌ی مهم: چون یوزرنیم به‌جای یه شناسه‌ی عددی، توی خیلی از جدول‌ها مستقیماً به‌عنوان کلید ذخیره شده،
// تغییرش باید همزمان روی همه‌ی این جدول‌ها اعمال بشه، وگرنه رکوردهای قدیمی (پست، کامنت، چت و...) یتیم می‌مونن.
// از env.D1.batch استفاده می‌کنیم که چندتا استیتمنت رو به‌صورت یکجا (اتمیک) اجرا می‌کنه.
async function handleChangeUsername(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  if (!(await checkRateLimit(env, "username_change", username, 3, 3600))) {
    return json({ error: "تعداد دفعات تغییر نام کاربری زیاد بوده، یه ساعت دیگه امتحان کن" }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }

  const newUsername = (body.newUsername || "").toString().trim();
  if (!USERNAME_RE.test(newUsername)) {
    return json({ error: "نام کاربری باید ۳ تا ۲۰ کاراکتر و فقط شامل حروف، عدد و _ باشه" }, 400);
  }
  if (newUsername === username) {
    return json({ error: "این همون نام کاربری فعلیته" }, 400);
  }

  const existing = await env.D1.prepare("SELECT username FROM users WHERE username = ?").bind(newUsername).first();
  if (existing) {
    return json({ error: "این نام کاربری قبلاً گرفته شده" }, 409);
  }

  const tableColumns = [
    ["users", "username"],
    ["sessions", "username"],
    ["profiles", "username"],
    ["posts", "username"],
    ["comments", "username"],
    ["comment_likes", "username"],
    ["votes", "username"],
    ["likes", "username"],
    ["stickers", "username"],
    ["notifications", "to_username"],
    ["notifications", "from_username"],
    ["notif_read", "username"],
    ["reports", "reporter_username"],
    ["reports", "target_username"],
    ["chat_conversation_members", "username"],
    ["chat_messages", "sender_username"],
    ["chat_blocks", "blocker_username"],
    ["chat_blocks", "blocked_username"],
    ["chat_conversations", "created_by"],
    ["push_subscriptions", "username"],
    ["user_presence", "username"],
  ];

  try {
    const statements = tableColumns.map(([table, col]) =>
      env.D1.prepare(`UPDATE ${table} SET ${col} = ? WHERE ${col} = ?`).bind(newUsername, username)
    );
    await env.D1.batch(statements);
  } catch (err) {
    console.error("خطای تغییر نام کاربری:", err);
    return json({ error: "تغییر نام کاربری ناموفق بود، دوباره امتحان کن" }, 500);
  }

  return json({ ok: true, username: newUsername });
}

// #endregion
// #region محدودکننده‌ی تلاش‌های تایید رمز فعلی (۵ تلاش ناموفق => ۲ دقیقه قفل)
// ---------- محدودکننده‌ی تلاش‌های تایید رمز فعلی ----------
async function registerFailedPasswordAttempt(env, username) {
  const failsKey = `pwd_fails:${username}`;
  const raw = await kvGet(env, failsKey);
  const count = raw ? parseInt(raw, 10) : 0;
  const newCount = count + 1;

  if (newCount >= 5) {
    await kvPut(env, `pwd_lock:${username}`, "1", 120); // ۲ دقیقه قفل
    await kvDelete(env, failsKey);
  } else {
    await kvPut(env, failsKey, String(newCount), 120);
  }
}

async function isPasswordLocked(env, username) {
  return !!(await kvGet(env, `pwd_lock:${username}`));
}

// #endregion
// #region تایید رمز عبور فعلی (مرحله‌ی اول ویزارد تغییر رمز)
// ---------- تایید رمز عبور فعلی ----------
async function handlePasswordVerify(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  if (await isPasswordLocked(env, username)) {
    return json({ error: "به خاطر تلاش‌های ناموفق زیاد، ۲ دقیقه صبر کن و دوباره امتحان کن" }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }

  const currentPassword = (body.currentPassword || "").toString();
  if (!currentPassword) return json({ error: "رمز فعلی لازمه" }, 400);

  const userData = await env.D1.prepare("SELECT salt, hash FROM users WHERE username = ?").bind(username).first();
  if (!userData) return json({ error: "کاربر پیدا نشد" }, 404);

  const attemptHash = await hashPassword(currentPassword, userData.salt, env);
  if (attemptHash !== userData.hash) {
    await registerFailedPasswordAttempt(env, username);
    return json({ error: "رمز عبور فعلی اشتباهه" }, 401);
  }

  await kvDelete(env, `pwd_fails:${username}`);
  return json({ ok: true });
}

// #endregion
// #region تغییر رمز عبور (مرحله‌ی نهایی ویزارد؛ رمز فعلی دوباره سمت سرور چک می‌شه)
// ---------- تغییر رمز عبور ----------
async function handleChangePassword(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  if (await isPasswordLocked(env, username)) {
    return json({ error: "به خاطر تلاش‌های ناموفق زیاد، ۲ دقیقه صبر کن و دوباره امتحان کن" }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }

  const currentPassword = (body.currentPassword || "").toString();
  const newPassword = (body.newPassword || "").toString();
  if (!currentPassword || !newPassword) return json({ error: "همه‌ی فیلدها لازمه" }, 400);

  const userData = await env.D1.prepare("SELECT salt, hash FROM users WHERE username = ?").bind(username).first();
  if (!userData) return json({ error: "کاربر پیدا نشد" }, 404);

  const attemptHash = await hashPassword(currentPassword, userData.salt, env);
  if (attemptHash !== userData.hash) {
    await registerFailedPasswordAttempt(env, username);
    return json({ error: "رمز عبور فعلی اشتباهه" }, 401);
  }

  const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
  if (!PASSWORD_RE.test(newPassword)) {
    return json({ error: "رمز جدید باید حداقل ۸ کاراکتر و شامل حرف و عدد باشه" }, 400);
  }
  if (newPassword === currentPassword) {
    return json({ error: "رمز جدید نباید با رمز فعلی یکی باشه" }, 400);
  }

  const newSalt = randomHex(16);
  const newHash = await hashPassword(newPassword, newSalt, env);
  await env.D1.prepare("UPDATE users SET salt = ?, hash = ? WHERE username = ?").bind(newSalt, newHash, username).run();

  // بعد از تغییر موفق رمز، همه‌ی سشن‌های دیگه (روی گوشی/مرورگرهای دیگه) باطل می‌شن؛ فقط همینی که
  // همین الان داره درخواست می‌ده زنده می‌مونه. این‌جوری اگه یه توکن جایی لو رفته بود، با عوض کردن
  // رمز واقعاً بیرون انداخته می‌شه، نه اینکه تا ۳۰ روز بعد هم بتونه کار کنه.
  const authHeader = request.headers.get("Authorization") || "";
  const currentToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (currentToken) {
    await env.D1.prepare("DELETE FROM sessions WHERE username = ? AND token != ?").bind(username, currentToken).run();
  } else {
    await env.D1.prepare("DELETE FROM sessions WHERE username = ?").bind(username).run();
  }

  await kvDelete(env, `pwd_fails:${username}`);
  return json({ ok: true });
}

// #endregion
// #region محضر: خواستگاری بین دو کاربر
// ---------- محضر: خواستگاری بین دو کاربر ----------
const MARRIAGE_TITLES = ["شوهر", "همسر"];
function oppositeMarriageTitle(t) {
  return t === "شوهر" ? "همسر" : "شوهر";
}

// خواستگاریِ درحال‌انتظارِ فرستاده‌شده توسطِ این کاربر (اگه باشه) و ازدواجِ فعلیش (اگه باشه) رو برمی‌گردونه
async function getMarriageStateFor(env, username) {
  const outgoing = await env.D1.prepare(
    "SELECT * FROM marriage_proposals WHERE from_username = ? AND status = 'pending'"
  ).bind(username).first();
  const marriage = await env.D1.prepare(
    "SELECT * FROM marriage_proposals WHERE status = 'accepted' AND (from_username = ? OR to_username = ?)"
  ).bind(username, username).first();
  return { outgoing: outgoing || null, marriage: marriage || null };
}

async function handleMarriageStatus(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const { outgoing, marriage } = await getMarriageStateFor(env, username);

  let spouse = null;
  if (marriage) {
    const isFrom = marriage.from_username === username;
    const spouseUsername = isFrom ? marriage.to_username : marriage.from_username;
    const myTitle = isFrom ? marriage.from_title : oppositeMarriageTitle(marriage.from_title);
    const spouseProfile = await env.D1.prepare("SELECT avatar_file_id FROM profiles WHERE username = ?").bind(spouseUsername).first();
    spouse = {
      username: spouseUsername,
      my_title: myTitle,
      spouse_title: oppositeMarriageTitle(myTitle),
      since: marriage.responded_at,
      avatar_file_id: (spouseProfile && spouseProfile.avatar_file_id) || null,
    };
  }

  return json({
    ok: true,
    outgoing: outgoing
      ? { id: outgoing.id, to_username: outgoing.to_username, title: outgoing.from_title, message: outgoing.message || "", created_at: outgoing.created_at }
      : null,
    spouse,
  });
}

async function handleMarriagePropose(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "marriage_propose", username, 10, 3600))) {
    return json({ error: "زیاد خواستگاری فرستادی، کمی بعد امتحان کن" }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }

  const toUsername = (body.to_username || "").toString().trim();
  const title = (body.title || "").toString().trim();
  const message = (body.message || "").toString().trim().slice(0, 50);

  if (!toUsername) return json({ error: "باید یه نفر رو انتخاب کنی" }, 400);
  if (toUsername === username) return json({ error: "نمی‌تونی از خودت خواستگاری کنی" }, 400);
  if (!MARRIAGE_TITLES.includes(title)) return json({ error: "عنوان نامعتبره" }, 400);

  const targetUser = await env.D1.prepare("SELECT username FROM users WHERE username = ?").bind(toUsername).first();
  if (!targetUser) return json({ error: "کاربر پیدا نشد" }, 404);

  const myState = await getMarriageStateFor(env, username);
  if (myState.marriage) return json({ error: "تو الان همسر داری" }, 400);
  if (myState.outgoing) return json({ error: "یه خواستگاریِ درحالِ‌انتظار داری؛ اول باید لغوش کنی" }, 400);

  const targetState = await getMarriageStateFor(env, toUsername);
  if (targetState.marriage) return json({ error: "این کاربر الان همسر داره" }, 400);

  const id = `${Date.now()}_${randomHex(4)}`;
  await bind(
    env.D1.prepare(
      "INSERT INTO marriage_proposals (id, from_username, to_username, from_title, message, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)"
    ),
    [id, username, toUsername, title, message || null, Date.now()]
  ).run();

  await createNotification(env, toUsername, { type: "marriage_request", from_username: username, text: message || null });

  return json({ ok: true, id });
}

async function handleMarriageCancel(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const outgoing = await env.D1.prepare(
    "SELECT * FROM marriage_proposals WHERE from_username = ? AND status = 'pending'"
  ).bind(username).first();
  if (!outgoing) return json({ error: "خواستگاریِ درحالِ‌انتظاری نداری" }, 404);

  await env.D1.prepare("UPDATE marriage_proposals SET status = 'cancelled', responded_at = ? WHERE id = ?").bind(Date.now(), outgoing.id).run();
  return json({ ok: true });
}

async function handleMarriageRequests(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const rows = await env.D1.prepare(
    "SELECT * FROM marriage_proposals WHERE to_username = ? AND status = 'pending' ORDER BY created_at DESC"
  ).bind(username).all();

  const list = rows.results || [];
  const out = [];
  for (const r of list) {
    const profile = await env.D1.prepare("SELECT avatar_file_id, bio FROM profiles WHERE username = ?").bind(r.from_username).first();
    out.push({
      id: r.id,
      from_username: r.from_username,
      from_title: r.from_title,
      message: r.message || "",
      created_at: r.created_at,
      avatar_file_id: (profile && profile.avatar_file_id) || null,
      bio: (profile && profile.bio) || "",
    });
  }

  return json({ ok: true, requests: out });
}

async function handleMarriageRespond(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }

  const id = (body.id || "").toString();
  const action = (body.action || "").toString();
  if (!id || (action !== "accept" && action !== "reject")) return json({ error: "درخواست نامعتبره" }, 400);

  const row = await env.D1.prepare("SELECT * FROM marriage_proposals WHERE id = ?").bind(id).first();
  if (!row) return json({ error: "درخواست پیدا نشد" }, 404);
  if (row.to_username !== username) return json({ error: "دسترسی نداری" }, 403);
  if (row.status !== "pending") return json({ error: "این درخواست قبلاً پاسخ داده شده" }, 400);

  if (action === "reject") {
    await env.D1.prepare("UPDATE marriage_proposals SET status = 'rejected', responded_at = ? WHERE id = ?").bind(Date.now(), id).run();
    return json({ ok: true });
  }

  const [myState, senderState] = await Promise.all([getMarriageStateFor(env, username), getMarriageStateFor(env, row.from_username)]);
  if (myState.marriage) return json({ error: "تو الان همسر داری" }, 400);
  if (senderState.marriage) return json({ error: "این کاربر الان همسر داره" }, 400);

  const now = Date.now();
  await env.D1.prepare("UPDATE marriage_proposals SET status = 'accepted', responded_at = ? WHERE id = ?").bind(now, id).run();

  // بقیه‌ی خواستگاری‌های درحال‌انتظارِ مربوط به هرکدوم از این دو نفر (چه فرستاده چه گرفته)
  // دیگه معنی نداره، پس خودکار رد می‌شن
  await bind(
    env.D1.prepare(
      "UPDATE marriage_proposals SET status = 'rejected', responded_at = ? WHERE status = 'pending' AND id != ? AND (from_username = ? OR to_username = ? OR from_username = ? OR to_username = ?)"
    ),
    [now, id, username, username, row.from_username, row.from_username]
  ).run();

  await createNotification(env, row.from_username, { type: "marriage_accept", from_username: username, text: null });

  return json({ ok: true });
}

// #endregion
// #region تشخیص مسیر و صدا زدن هندلر مربوطه (بدون هدر CORS؛ CORS در fetch اصلی اضافه می‌شه)
// ---------- تشخیص مسیر و صدا زدن هندلر مربوطه (بدون هدر CORS؛ CORS در fetch اصلی اضافه می‌شه) ----------
async function routeRequest(url, request, env, ctx) {
      if (url.pathname === "/api/captcha/challenge" && request.method === "POST") {
        return await handleCaptchaChallenge(request, env);
      }
      if (url.pathname === "/api/register" && request.method === "POST") {
        return await handleRegister(request, env);
      }
      if (url.pathname === "/api/login" && request.method === "POST") {
        return await handleLogin(request, env);
      }
      if (url.pathname === "/api/logout" && request.method === "POST") {
        return await handleLogout(request, env);
      }
      if (url.pathname === "/api/post" && request.method === "GET") {
        return await handleGetSinglePost(request, env);
      }
      if (url.pathname === "/api/post" && request.method === "POST") {
        return await handlePost(request, env);
      }
      if (url.pathname === "/api/feed" && request.method === "GET") {
        return await handleFeed(request, env);
      }
      if (url.pathname === "/api/deels/mark-seen" && request.method === "POST") {
        return await handleMarkDeelsSeen(request, env);
      }
      if (url.pathname === "/api/post" && request.method === "DELETE") {
        return await handleDeletePost(request, env);
      }
      if (url.pathname === "/api/post/edit" && request.method === "POST") {
        return await handleEditPost(request, env);
      }
      if (url.pathname === "/api/post/pin" && request.method === "POST") {
        return await handlePinPost(request, env);
      }
      if (url.pathname === "/api/comment" && request.method === "POST") {
        return await handleAddComment(request, env, ctx);
      }
      if (url.pathname === "/api/comment" && request.method === "DELETE") {
        return await handleDeleteComment(request, env);
      }
      if (url.pathname === "/api/comment/like" && request.method === "POST") {
        return await handleLikeComment(request, env);
      }
      if (url.pathname === "/api/comment/edit" && request.method === "POST") {
        return await handleEditComment(request, env);
      }
      if (url.pathname === "/api/sticker" && request.method === "POST") {
        return await handleUploadSticker(request, env);
      }
      if (url.pathname === "/api/stickers" && request.method === "GET") {
        return await handleGetStickers(request, env);
      }
      if (url.pathname === "/api/stickers/default" && request.method === "GET") {
        return await handleDefaultStickersList(request, env, ctx);
      }
      if (url.pathname.startsWith("/api/stickers/default/") && request.method === "GET") {
        const name = decodeURIComponent(url.pathname.slice("/api/stickers/default/".length));
        return await handleDefaultStickerFile(name, env, ctx, request);
      }
      if (url.pathname === "/api/sticker" && request.method === "DELETE") {
        return await handleDeleteSticker(request, env);
      }
      if (url.pathname === "/api/vote" && request.method === "POST") {
        return await handleVote(request, env, ctx);
      }
      if (url.pathname === "/api/like" && request.method === "POST") {
        return await handleLike(request, env);
      }
      if (url.pathname === "/api/comments" && request.method === "GET") {
        return await handleGetComments(request, env);
      }
      if (url.pathname === "/api/profile" && request.method === "GET") {
        return await handleGetProfile(request, env);
      }
      if (url.pathname === "/api/marriage/status" && request.method === "GET") {
        return await handleMarriageStatus(request, env);
      }
      if (url.pathname === "/api/marriage/propose" && request.method === "POST") {
        return await handleMarriagePropose(request, env);
      }
      if (url.pathname === "/api/marriage/cancel" && request.method === "POST") {
        return await handleMarriageCancel(request, env);
      }
      if (url.pathname === "/api/marriage/requests" && request.method === "GET") {
        return await handleMarriageRequests(request, env);
      }
      if (url.pathname === "/api/marriage/respond" && request.method === "POST") {
        return await handleMarriageRespond(request, env);
      }
      if (url.pathname === "/api/profile" && request.method === "POST") {
        return await handleUpdateProfile(request, env);
      }
      if (url.pathname === "/api/profile/chat-bg" && request.method === "POST") {
        return await handleUpdateChatBg(request, env);
      }
      if (url.pathname === "/api/profile/chat-bg" && request.method === "DELETE") {
        return await handleRemoveChatBg(request, env);
      }
      if (url.pathname === "/api/username/check" && request.method === "GET") {
        return await handleCheckUsername(request, env);
      }
      if (url.pathname === "/api/username/change" && request.method === "POST") {
        return await handleChangeUsername(request, env);
      }
      if (url.pathname === "/api/password/verify" && request.method === "POST") {
        return await handlePasswordVerify(request, env);
      }
      if (url.pathname === "/api/password/change" && request.method === "POST") {
        return await handleChangePassword(request, env);
      }
      if (url.pathname === "/api/theme" && request.method === "POST") {
        return await handleUpdateTheme(request, env);
      }
      if (url.pathname === "/api/font" && request.method === "POST") {
        return await handleUpdateFont(request, env);
      }
      if (url.pathname === "/api/admin/me" && request.method === "GET") {
        return await handleAdminMe(request, env);
      }
      if (url.pathname === "/api/bootstrap" && request.method === "GET") {
        return await handleBootstrap(request, env);
      }
      if (url.pathname === "/api/admin/stats" && request.method === "GET") {
        return await handleAdminStats(request, env);
      }
      if (url.pathname === "/api/admin/users" && request.method === "GET") {
        return await handleAdminUsers(request, env);
      }
      if (url.pathname === "/api/admin/chat/groups" && request.method === "GET") {
        return await handleAdminChatGroups(request, env);
      }
      if (url.pathname === "/api/admin/chat/messages" && request.method === "GET") {
        return await handleAdminChatMessages(request, env);
      }
      if (url.pathname === "/api/admin/ban" && request.method === "POST") {
        return await handleBanUser(request, env);
      }
      if (url.pathname === "/api/admin/role" && request.method === "POST") {
        return await handleSetAdmin(request, env);
      }
      if (url.pathname === "/api/referral/me" && request.method === "GET") {
        return await handleReferralMe(request, env);
      }
      if (url.pathname === "/api/referral/generate" && request.method === "POST") {
        return await handleReferralGenerate(request, env);
      }
      if (url.pathname === "/api/admin/referral/custom-create" && request.method === "POST") {
        return await handleAdminCreateCustomReferral(request, env);
      }
      if (url.pathname === "/api/admin/referral/custom-list" && request.method === "GET") {
        return await handleAdminListCustomReferrals(request, env);
      }
      if (url.pathname === "/api/admin/referral/custom-revoke" && request.method === "POST") {
        return await handleAdminRevokeReferralCode(request, env);
      }
      if (url.pathname === "/api/admin/referral-permission" && request.method === "POST") {
        return await handleAdminSetReferralPermission(request, env);
      }
      if (url.pathname === "/api/admin/change-password" && request.method === "POST") {
        return await handleAdminChangePassword(request, env);
      }
      if (url.pathname === "/api/admin/reset-all-passwords" && request.method === "POST") {
        return await handleAdminResetAllPasswords(request, env);
      }
      if (url.pathname === "/api/admin/delete-account" && request.method === "POST") {
        return await handleAdminDeleteAccount(request, env);
      }
      if (url.pathname === "/api/report" && request.method === "POST") {
        return await handleCreateReport(request, env);
      }
      if (url.pathname === "/api/admin/reports" && request.method === "GET") {
        return await handleAdminReports(request, env);
      }
      if (url.pathname === "/api/admin/reports" && request.method === "DELETE") {
        return await handleDismissReport(request, env);
      }
      if (url.pathname === "/api/admin/chefs" && request.method === "GET") {
        return await handleAdminChefsList(request, env);
      }
      if (url.pathname === "/api/admin/chefs/add" && request.method === "POST") {
        return await handleAdminChefAdd(request, env);
      }
      if (url.pathname === "/api/admin/chefs/remove" && request.method === "POST") {
        return await handleAdminChefRemove(request, env);
      }
      if (url.pathname === "/api/birthday/status" && request.method === "GET") {
        return await handleBirthdayStatus(request, env);
      }
      if (url.pathname === "/api/birthday/claim" && request.method === "POST") {
        return await handleBirthdayClaim(request, env);
      }
      if (url.pathname === "/api/restaurant/chef-status" && request.method === "GET") {
        return await handleChefStatus(request, env);
      }
      if (url.pathname === "/api/restaurant/menu" && request.method === "GET") {
        return await handleRestaurantMenu(request, env);
      }
      if (url.pathname === "/api/restaurant/buy" && request.method === "POST") {
        return await handleRestaurantBuy(request, env);
      }
      if (url.pathname === "/api/restaurant/fridge" && request.method === "GET") {
        return await handleRestaurantFridge(request, env);
      }
      if (url.pathname === "/api/notifications" && request.method === "GET") {
        return await handleGetNotifications(request, env);
      }
      if (url.pathname === "/api/notifications/read" && request.method === "POST") {
        return await handleMarkNotificationsRead(request, env);
      }
      if (url.pathname === "/api/push/subscribe" && request.method === "POST") {
        return await handleSubscribePush(request, env);
      }
      if (url.pathname === "/api/push/unsubscribe" && request.method === "POST") {
        return await handleUnsubscribePush(request, env);
      }
      if (url.pathname === "/api/fcm/save-token" && request.method === "POST") {
        return await handleSaveFcmToken(request, env);
      }
      if (url.pathname === "/api/fcm/delete-token" && request.method === "POST") {
        return await handleDeleteFcmToken(request, env);
      }
      if (url.pathname === "/api/radio/now" && request.method === "GET") {
        return await handleRadioNow(request, env);
      }
      if (url.pathname === "/api/radio/voice" && request.method === "POST") {
        return await handleRadioVoiceSubmit(request, env);
      }
      if (url.pathname === "/api/radio/voice/mine" && request.method === "GET") {
        return await handleRadioVoiceMine(request, env);
      }
      if (url.pathname === "/api/radio/durations/missing" && request.method === "GET") {
        return await handleRadioDurationsMissing(request, env);
      }
      if (url.pathname === "/api/radio/durations/fix" && request.method === "POST") {
        return await handleRadioDurationsFix(request, env);
      }
      if (url.pathname === "/api/radio/visual-now" && request.method === "GET") {
        return await handleRadioVisualNow(request, env);
      }
      if (url.pathname === "/api/radio/jingle/list" && request.method === "GET") {
        return await handleRadioJingleList(env, ctx);
      }
      if (url.pathname.startsWith("/api/radio/jingle/file/") && request.method === "GET") {
        const name = decodeURIComponent(url.pathname.slice("/api/radio/jingle/file/".length));
        return await handleRadioJingleFile(name, request, env, ctx);
      }
      if (url.pathname === "/api/splash-media/list" && request.method === "GET") {
        return await handleSplashMediaList(env, ctx);
      }
      if (url.pathname.startsWith("/api/splash-media/file/") && request.method === "GET") {
        const name = decodeURIComponent(url.pathname.slice("/api/splash-media/file/".length));
        return await handleSplashMediaFile(name, request, env, ctx);
      }
      if (url.pathname.startsWith("/api/media/") && request.method === "GET") {
        const fileId = decodeURIComponent(url.pathname.slice("/api/media/".length));
        return await handleMedia(fileId, env, request, ctx);
      }
      if (url.pathname === "/api/users/search" && request.method === "GET") {
        return await handleUserSearch(request, env);
      }
      if (url.pathname === "/api/chat/start" && request.method === "POST") {
        return await handleChatStart(request, env);
      }
      if (url.pathname === "/api/chat/group" && request.method === "POST") {
        return await handleChatCreateGroup(request, env);
      }
      if (url.pathname === "/api/chat/join" && request.method === "POST") {
        return await handleChatJoinGroup(request, env);
      }
      if (url.pathname === "/api/chat/join-public" && request.method === "POST") {
        return await handleChatJoinPublicGroup(request, env);
      }
      if (url.pathname === "/api/chat/members" && request.method === "GET") {
        return await handleChatMembers(request, env);
      }
      if (url.pathname === "/api/presence/online" && request.method === "GET") {
        return await handleOnlineUsers(request, env);
      }
      if (url.pathname === "/api/internal/dooz-invite-push" && request.method === "POST") {
        return await handleDoozInvitePush(request, env);
      }
      if (url.pathname === "/api/chat/group/update" && request.method === "POST") {
        return await handleChatUpdateGroup(request, env);
      }
      if (url.pathname === "/api/chat/group/invite/regenerate" && request.method === "POST") {
        return await handleChatRegenerateInvite(request, env);
      }
      if (url.pathname === "/api/chat/members/remove" && request.method === "POST") {
        return await handleChatRemoveMember(request, env);
      }
      if (url.pathname === "/api/chat/members/role" && request.method === "POST") {
        return await handleChatSetMemberRole(request, env);
      }
      if (url.pathname === "/api/chat/leave" && request.method === "POST") {
        return await handleChatLeaveGroup(request, env);
      }
      if (url.pathname === "/api/chat/group/delete" && request.method === "POST") {
        return await handleChatDeleteGroup(request, env);
      }
      if (url.pathname === "/api/chat/message/edit" && request.method === "POST") {
        return await handleChatEditMessage(request, env);
      }
      if (url.pathname === "/api/chat/message" && request.method === "DELETE") {
        return await handleChatDeleteMessage(request, env);
      }
      if (url.pathname === "/api/chat/block" && request.method === "POST") {
        return await handleChatBlock(request, env);
      }
      if (url.pathname === "/api/chat/unblock" && request.method === "POST") {
        return await handleChatUnblock(request, env);
      }
      if (url.pathname === "/api/chat/blocked" && request.method === "GET") {
        return await handleChatBlockedList(request, env);
      }
      if (url.pathname === "/api/chat/list" && request.method === "GET") {
        return await handleChatList(request, env);
      }
      if (url.pathname === "/api/chat/messages" && request.method === "GET") {
        return await handleChatMessages(request, env);
      }
      if (url.pathname === "/api/chat/send" && request.method === "POST") {
        return await handleChatSend(request, env);
      }
      if (url.pathname === "/api/chat/read" && request.method === "POST") {
        return await handleChatRead(request, env);
      }
      if (url.pathname === "/api/chat/message/pin" && request.method === "POST") {
        return await handleChatPinMessage(request, env);
      }
      if (url.pathname === "/api/chat/message/unpin" && request.method === "POST") {
        return await handleChatUnpinMessage(request, env);
      }
      if (url.pathname === "/api/chat/message/react" && request.method === "POST") {
        return await handleChatReactMessage(request, env);
      }
      if (url.pathname === "/api/chat/message/unreact" && request.method === "POST") {
        return await handleChatUnreactMessage(request, env);
      }
      if (url.pathname === "/api/chat/messages/search" && request.method === "GET") {
        return await handleChatSearchMessages(request, env);
      }
      if (url.pathname === "/api/chat/mute" && request.method === "POST") {
        return await handleChatMute(request, env);
      }
      if (url.pathname === "/api/changelog/seen" && request.method === "POST") {
        return await handleChangelogSeen(request, env);
      }
      if (url.pathname === "/api/admin/changelog/send" && request.method === "POST") {
        return await handleAdminSendChangelog(request, env);
      }
      if (url.pathname === "/api/admin/changelog/current" && request.method === "GET") {
        return await handleAdminGetChangelog(request, env);
      }
      if (url.pathname === "/api/admin/cloudflare/http3" && request.method === "GET") {
        return await handleAdminGetHttp3(request, env);
      }
      if (url.pathname === "/api/admin/cloudflare/http3" && request.method === "POST") {
        return await handleAdminToggleHttp3(request, env);
      }
      if (url.pathname === "/api/chat/message/forward" && request.method === "POST") {
        return await handleChatForwardMessage(request, env);
      }
      if (url.pathname === "/api/upload/init" && request.method === "POST") {
        return await handleUploadInit(request, env);
      }
      if (url.pathname === "/api/upload/chunk" && request.method === "POST") {
        return await handleUploadChunk(request, env);
      }
      if (url.pathname === "/api/upload/status" && request.method === "GET") {
        return await handleUploadStatus(request, env);
      }
      if (url.pathname === "/api/upload/complete" && request.method === "POST") {
        return await handleUploadComplete(request, env);
      }
      if (url.pathname === "/api/upload/abort" && request.method === "POST") {
        return await handleUploadAbort(request, env);
      }
      if (url.pathname === "/api/chat/upload" && request.method === "POST") {
        return await handleChatUploadMedia(request, env);
      }
      if (url.pathname === "/api/chat/upload-url" && request.method === "POST") {
        return await handleChatUploadMediaFromUrl(request, env);
      }
      if (url.pathname === "/api/channels/create" && request.method === "POST") {
        return await handleCreateChannel(request, env);
      }
      if (url.pathname === "/api/channels/join" && request.method === "POST") {
        return await handleJoinChannel(request, env);
      }
      if (url.pathname === "/api/rooms/join" && request.method === "POST") {
        return await handleJoinRoomByCode(request, env);
      }
      if (url.pathname === "/api/channels/leave" && request.method === "POST") {
        return await handleLeaveChannel(request, env);
      }
      if (url.pathname === "/api/channels/delete" && request.method === "POST") {
        return await handleDeleteChannel(request, env);
      }
      if (url.pathname === "/api/channels/mine" && request.method === "GET") {
        return await handleMyChannels(request, env);
      }
      if (url.pathname === "/api/channels/update" && request.method === "POST") {
        return await handleUpdateChannel(request, env);
      }
      if (url.pathname === "/api/channels/role" && request.method === "POST") {
        return await handleSetChannelRole(request, env);
      }
      if (url.pathname === "/api/channels/pin" && request.method === "POST") {
        return await handlePinChannel(request, env);
      }
      if (url.pathname === "/api/channels/posts" && request.method === "POST") {
        return await handleCreateChannelPost(request, env);
      }
      if (url.pathname === "/api/channels/posts/delete" && request.method === "POST") {
        return await handleDeleteChannelPost(request, env);
      }
      if (url.pathname === "/api/search/rooms" && request.method === "GET") {
        return await handleSearchRooms(request, env);
      }
      // مسیرهای پویا: /api/channels/:id  و  /api/channels/:id/posts
      // مسیرهای پویا: /api/channels/:id  و  /api/channels/:id/posts  و  /api/channels/:id/join-public
      if (url.pathname.startsWith("/api/channels/") && request.method === "POST") {
        const rest = url.pathname.slice("/api/channels/".length);
        if (rest.endsWith("/join-public")) {
          const channelId = decodeURIComponent(rest.slice(0, -"/join-public".length));
          return await handleJoinPublicChannel(request, env, channelId);
        }
      }
      if (url.pathname.startsWith("/api/channels/") && request.method === "GET") {
        const rest = url.pathname.slice("/api/channels/".length);
        if (rest.endsWith("/posts")) {
          const channelId = decodeURIComponent(rest.slice(0, -"/posts".length));
          return await handleListChannelPosts(request, env, channelId);
        }
        if (rest.endsWith("/members")) {
          const channelId = decodeURIComponent(rest.slice(0, -"/members".length));
          return await handleChannelMembers(request, env, channelId);
        }
        if (rest && !rest.includes("/")) {
          const channelId = decodeURIComponent(rest);
          return await handleChannelDetails(request, env, channelId);
        }
      }
      if (url.pathname === "/api/playlist/create" && request.method === "POST") {
        return await handleCreatePlaylist(request, env);
      }
      if (url.pathname === "/api/playlist/update" && request.method === "POST") {
        return await handleUpdatePlaylist(request, env);
      }
      if (url.pathname === "/api/playlist/delete" && request.method === "POST") {
        return await handleDeletePlaylist(request, env);
      }
      if (url.pathname === "/api/playlists" && request.method === "GET") {
        return await handleListPlaylists(request, env);
      }
      if (url.pathname === "/api/playlist/add-track" && request.method === "POST") {
        return await handleAddTrackToPlaylist(request, env);
      }
      if (url.pathname === "/api/playlist/remove-track" && request.method === "POST") {
        return await handleRemoveTrackFromPlaylist(request, env);
      }
      if (url.pathname === "/api/playlist/for-track" && request.method === "GET") {
        return await handlePlaylistsForTrack(request, env);
      }
      // مسیر پویا: /api/playlist/:id/tracks
      if (url.pathname.startsWith("/api/playlist/") && url.pathname.endsWith("/tracks") && request.method === "GET") {
        const playlistId = decodeURIComponent(url.pathname.slice("/api/playlist/".length, -"/tracks".length));
        return await handlePlaylistTracks(request, env, playlistId);
      }
      return json({ error: "مسیر پیدا نشد" }, 404);
}

// #endregion
// #region کانال‌ها (سیستمِ کاملاً جدا از چت — شبیهِ کانالِ تلگرام: فقط مالک/ادمین پست می‌ذاره، بقیه فقط می‌خونن)
// ---------- کانال‌ها ----------
// جدول‌های موردنیاز (یک‌بار توی کنسولِ D1 اجرا شه):
//   CREATE TABLE IF NOT EXISTS channels (
//     id TEXT PRIMARY KEY,
//     title TEXT NOT NULL,
//     description TEXT,
//     avatar_file_id TEXT,
//     owner_username TEXT NOT NULL,
//     invite_code TEXT NOT NULL,
//     is_public INTEGER NOT NULL DEFAULT 0,
//     is_pinned INTEGER NOT NULL DEFAULT 0,
//     pinned_at INTEGER,
//     created_at INTEGER NOT NULL
//   );
//   CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_invite_code ON channels (invite_code);
//   CREATE TABLE IF NOT EXISTS channel_members (
//     channel_id TEXT NOT NULL,
//     username TEXT NOT NULL,
//     role TEXT NOT NULL DEFAULT 'member',
//     joined_at INTEGER NOT NULL,
//     last_read_at INTEGER NOT NULL DEFAULT 0,
//     PRIMARY KEY (channel_id, username)
//   );
//   CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members (username);
//   CREATE TABLE IF NOT EXISTS channel_posts (
//     id TEXT PRIMARY KEY,
//     channel_id TEXT NOT NULL,
//     author_username TEXT NOT NULL,
//     text TEXT,
//     file_id TEXT,
//     file_type TEXT,
//     created_at INTEGER NOT NULL,
//     edited_at INTEGER,
//     deleted INTEGER NOT NULL DEFAULT 0
//   );
//   CREATE INDEX IF NOT EXISTS idx_channel_posts_channel ON channel_posts (channel_id, created_at);
//   -- برای «عمومی/خصوصی»ِ گروه‌ها هم (چون قبلاً همه‌ی گروه‌ها همیشه خصوصی/فقط با کد بودن):
//   ALTER TABLE chat_conversations ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;

const CHANNEL_ROOM_PAGE_SIZE = 10;
const CHANNEL_POST_PAGE_SIZE = 30;

async function getChannelMembership(env, channelId, username) {
  return await env.D1.prepare(
    "SELECT role FROM channel_members WHERE channel_id = ? AND username = ?"
  ).bind(channelId, username).first();
}

function isChannelModerator(role) {
  return role === "owner" || role === "admin";
}

async function generateUniqueChannelInviteCode(env) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = generateInviteCodeCandidate();
    const existing = await env.D1.prepare("SELECT id FROM channels WHERE invite_code = ?").bind(candidate).first();
    if (!existing) return candidate;
  }
  return generateInviteCodeCandidate(10) + randomHex(2);
}

// ---------- ساختِ کانال ----------
async function handleCreateChannel(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "channel_create", username, 5, 3600))) {
    return json({ error: "ساختِ کانال زیاد بوده، یه‌کم بعد امتحان کن" }, 429);
  }

  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: "درخواست نامعتبره" }, 400);

  const title = (form.get("title") || "").toString().trim().slice(0, 60);
  if (!title) return json({ error: "اسم کانال لازمه" }, 400);
  const description = (form.get("description") || "").toString().trim().slice(0, 300);
  const isPublic = (form.get("isPublic") || "").toString() === "1" ? 1 : 0;

  let avatarFileId = null;
  const avatarFile = form.get("avatar");
  const hasAvatar = avatarFile && typeof avatarFile !== "string" && avatarFile.size > 0;
  if (hasAvatar) {
    if (!avatarFile.type.startsWith("image/")) return json({ error: "آواتار کانال باید یه فایل عکس باشه" }, 400);
    if (!(await verifyFileMatchesCategory(avatarFile, "image"))) {
      return json({ error: "محتوای فایل با نوع اعلام‌شده‌اش مطابقت نداره" }, 400);
    }
    if (avatarFile.size > 5 * 1024 * 1024) return json({ error: "حجم عکس آواتار نباید بیشتر از ۵ مگابایت باشه" }, 400);
    try {
      const result = await sendTelegramFile(env, "sendPhoto", "photo", avatarFile, `آواتار کانال — ${title}`);
      avatarFileId = extractFileId("photo", result);
    } catch (err) {
      console.error("خطای آپلود آواتار کانال به تلگرام:", err);
      return json({ error: "آپلود آواتار کانال ناموفق بود، دوباره امتحان کن" }, 502);
    }
  }

  const inviteCode = await generateUniqueChannelInviteCode(env);
  const id = `channel_${Date.now()}_${randomHex(6)}`;
  const now = Date.now();

  await bind(
    env.D1.prepare(
      "INSERT INTO channels (id, title, description, avatar_file_id, owner_username, invite_code, is_public, is_pinned, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)"
    ),
    [id, title, description || null, avatarFileId, username, inviteCode, isPublic, now]
  ).run();

  await bind(
    env.D1.prepare(
      "INSERT INTO channel_members (channel_id, username, role, joined_at, last_read_at) VALUES (?, ?, 'owner', ?, ?)"
    ),
    [id, username, now, now]
  ).run();

  return json({ channelId: id, inviteCode });
}

// ---------- عضویت در کانال با کدِ دعوت ----------
async function handleJoinChannel(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "channel_join", username, 15, 3600))) {
    return json({ error: "تلاش زیاد بوده، یه‌کم بعد امتحان کن" }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const code = (body.code || "").toString().trim().toUpperCase();
  if (!code) return json({ error: "کدِ کانال لازمه" }, 400);

  const channel = await env.D1.prepare("SELECT id, title FROM channels WHERE invite_code = ?").bind(code).first();
  if (!channel) return json({ error: "کدِ کانال نامعتبره" }, 404);

  const already = await getChannelMembership(env, channel.id, username);
  if (already) return json({ channelId: channel.id, alreadyMember: true });

  await bind(
    env.D1.prepare(
      "INSERT INTO channel_members (channel_id, username, role, joined_at, last_read_at) VALUES (?, ?, 'member', ?, ?)"
    ),
    [channel.id, username, Date.now(), 0]
  ).run();

  return json({ channelId: channel.id, title: channel.title });
}

// ---------- عضویتِ یکپارچه با کد: هم گروه هم کانال، بدونِ این‌که کاربر لازم باشه بدونه کد مالِ کدومه ----------
// چون جدولِ کدِ گروه‌ها (chat_conversations) و کانال‌ها (channels) کاملاً جداست، این تابع اول گروه رو
// چک می‌کنه، پیدا نشد می‌ره سراغِ کانال. برخوردِ کد بینِ دو جدول عملاً غیرممکنه (کدها تصادفی و طولانی‌ان)
async function handleJoinRoomByCode(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "room_join", username, 15, 3600))) {
    return json({ error: "تلاش زیاد بوده، یه‌کم بعد امتحان کن" }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const code = (body.code || "").toString().trim().toUpperCase();
  if (!code) return json({ error: "کد لازمه" }, 400);

  const conv = await env.D1.prepare(
    "SELECT id, type, title FROM chat_conversations WHERE invite_code = ?"
  ).bind(code).first();

  if (conv && conv.type === "group") {
    const already = await getGroupMembership(env, conv.id, username);
    if (already) return json({ kind: "group", id: conv.id, alreadyMember: true });

    const countRow = await env.D1.prepare(
      "SELECT COUNT(*) AS c FROM chat_conversation_members WHERE conversation_id = ?"
    ).bind(conv.id).first();
    if ((countRow && countRow.c) >= MAX_GROUP_MEMBERS + 1) return json({ error: "این گروه پره" }, 400);

    await bind(
      env.D1.prepare(
        "INSERT INTO chat_conversation_members (conversation_id, username, role, joined_at, last_read_at) VALUES (?, ?, 'member', ?, 0)"
      ),
      [conv.id, username, Date.now()]
    ).run();
    return json({ kind: "group", id: conv.id, title: conv.title });
  }

  const channel = await env.D1.prepare("SELECT id, title FROM channels WHERE invite_code = ?").bind(code).first();
  if (!channel) return json({ error: "این کد معتبر نیست" }, 404);

  const alreadyCh = await getChannelMembership(env, channel.id, username);
  if (alreadyCh) return json({ kind: "channel", id: channel.id, alreadyMember: true });

  await bind(
    env.D1.prepare(
      "INSERT INTO channel_members (channel_id, username, role, joined_at, last_read_at) VALUES (?, ?, 'member', ?, ?)"
    ),
    [channel.id, username, Date.now(), 0]
  ).run();
  return json({ kind: "channel", id: channel.id, title: channel.title });
}

// ---------- عضویت در کانالِ عمومی بدون کد (فقط از طریقِ نتیجه‌ی جست‌وجوی عمومی معتبره) ----------
async function handleJoinPublicChannel(request, env, channelId) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "channel_join", username, 15, 3600))) {
    return json({ error: "تلاش زیاد بوده، یه‌کم بعد امتحان کن" }, 429);
  }
  if (!channelId) return json({ error: "شناسه‌ی کانال لازمه" }, 400);

  const channel = await env.D1.prepare("SELECT id, title, is_public FROM channels WHERE id = ?").bind(channelId).first();
  if (!channel || !channel.is_public) return json({ error: "این کانال عمومی نیست" }, 403);

  const already = await getChannelMembership(env, channelId, username);
  if (already) return json({ channelId, alreadyMember: true });

  await bind(
    env.D1.prepare(
      "INSERT INTO channel_members (channel_id, username, role, joined_at, last_read_at) VALUES (?, ?, 'member', ?, ?)"
    ),
    [channelId, username, Date.now(), 0]
  ).run();

  return json({ channelId, title: channel.title });
}

// ---------- خروج از کانال (مالک نمی‌تونه؛ باید حذفش کنه) ----------
async function handleLeaveChannel(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const body = await request.json().catch(() => ({}));
  const channelId = (body.channelId || "").toString();
  if (!channelId) return json({ error: "شناسه‌ی کانال لازمه" }, 400);

  const me = await getChannelMembership(env, channelId, username);
  if (!me) return json({ error: "عضوِ این کانال نیستی" }, 400);
  if (me.role === "owner") return json({ error: "مالکِ کانال نمی‌تونه خارج بشه؛ باید کانال رو حذف کنه" }, 400);

  await env.D1.prepare("DELETE FROM channel_members WHERE channel_id = ? AND username = ?").bind(channelId, username).run();
  return json({ ok: true });
}

// ---------- حذفِ کانال (فقط مالک) ----------
async function handleDeleteChannel(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const body = await request.json().catch(() => ({}));
  const channelId = (body.channelId || "").toString();
  if (!channelId) return json({ error: "شناسه‌ی کانال لازمه" }, 400);

  const me = await getChannelMembership(env, channelId, username);
  if (!me || me.role !== "owner") return json({ error: "فقط مالکِ کانال می‌تونه حذفش کنه" }, 403);

  await env.D1.batch([
    env.D1.prepare("DELETE FROM channel_posts WHERE channel_id = ?").bind(channelId),
    env.D1.prepare("DELETE FROM channel_members WHERE channel_id = ?").bind(channelId),
    env.D1.prepare("DELETE FROM channels WHERE id = ?").bind(channelId),
  ]);
  return json({ ok: true });
}

// ---------- لیستِ کانال‌های خودِ کاربر (صفحه‌بندی‌شده، پین‌شده‌ها همیشه اول) ----------
async function handleMyChannels(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const offset = (page - 1) * CHANNEL_ROOM_PAGE_SIZE;

  const countRow = await env.D1.prepare(
    "SELECT COUNT(*) AS c FROM channel_members cm WHERE cm.username = ?"
  ).bind(username).first();
  const total = (countRow && countRow.c) || 0;

  const rows = await env.D1.prepare(
    `SELECT c.id, c.title, c.avatar_file_id, c.is_public, c.is_pinned, cm.role,
            (SELECT text FROM channel_posts p WHERE p.channel_id = c.id AND p.deleted = 0 ORDER BY p.created_at DESC LIMIT 1) AS last_post_text,
            (SELECT created_at FROM channel_posts p WHERE p.channel_id = c.id AND p.deleted = 0 ORDER BY p.created_at DESC LIMIT 1) AS last_post_at
     FROM channels c
     JOIN channel_members cm ON cm.channel_id = c.id
     WHERE cm.username = ?
     ORDER BY c.is_pinned DESC, COALESCE(last_post_at, c.created_at) DESC
     LIMIT ? OFFSET ?`
  ).bind(username, CHANNEL_ROOM_PAGE_SIZE, offset).all();

  return json({
    channels: rows.results || [],
    page,
    totalPages: Math.max(1, Math.ceil(total / CHANNEL_ROOM_PAGE_SIZE)),
  });
}

// ---------- جزئیاتِ یک کانال ----------
async function handleChannelDetails(request, env, channelId) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const channel = await env.D1.prepare(
    "SELECT id, title, description, avatar_file_id, owner_username, invite_code, is_public, is_pinned FROM channels WHERE id = ?"
  ).bind(channelId).first();
  if (!channel) return json({ error: "کانال پیدا نشد" }, 404);

  const me = await getChannelMembership(env, channelId, username);
  const countRow = await env.D1.prepare("SELECT COUNT(*) AS c FROM channel_members WHERE channel_id = ?").bind(channelId).first();

  return json({
    channel: {
      id: channel.id,
      title: channel.title,
      description: channel.description,
      avatarFileId: channel.avatar_file_id,
      isPublic: !!channel.is_public,
      isPinned: !!channel.is_pinned,
      memberCount: (countRow && countRow.c) || 0,
      // کدِ دعوت فقط به مالک/ادمین نشون داده می‌شه
      inviteCode: me && isChannelModerator(me.role) ? channel.invite_code : null,
    },
    myRole: me ? me.role : null,
  });
}

// ---------- لیستِ اعضای یک کانال (فقط مالک/ادمین؛ برای مدیریتِ نقش‌ها) ----------
async function handleChannelMembers(request, env, channelId) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const me = await getChannelMembership(env, channelId, username);
  if (!me || !isChannelModerator(me.role)) return json({ error: "فقط مالک/ادمینِ کانال می‌تونه اعضا رو ببینه" }, 403);

  const rows = await env.D1.prepare(
    "SELECT username, role, joined_at FROM channel_members WHERE channel_id = ? ORDER BY (role = 'owner') DESC, (role = 'admin') DESC, joined_at ASC LIMIT 200"
  ).bind(channelId).all();

  const usernames = (rows.results || []).map((r) => r.username);
  const avatarMap = {};
  if (usernames.length) {
    const placeholders = usernames.map(() => "?").join(",");
    const profRows = await env.D1.prepare(
      `SELECT username, avatar_file_id FROM profiles WHERE username IN (${placeholders})`
    ).bind(...usernames).all();
    for (const row of profRows.results || []) {
      if (row.avatar_file_id) avatarMap[row.username] = row.avatar_file_id;
    }
  }

  const members = (rows.results || []).map((r) => ({
    username: r.username,
    role: r.role,
    joinedAt: r.joined_at,
    avatarFileId: avatarMap[r.username] || null,
  }));

  return json({ members, myRole: me.role });
}

// ---------- ویرایشِ کانال (اسم/توضیح/عکس/عمومی-خصوصی؛ مالک/ادمین) ----------
async function handleUpdateChannel(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "channel_update", username, 15, 3600))) {
    return json({ error: "درخواست زیاد بوده، یه‌کم بعد امتحان کن" }, 429);
  }

  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: "درخواست نامعتبره" }, 400);
  const channelId = (form.get("channelId") || "").toString();
  if (!channelId) return json({ error: "شناسه‌ی کانال لازمه" }, 400);

  const me = await getChannelMembership(env, channelId, username);
  if (!me || !isChannelModerator(me.role)) return json({ error: "فقط مالک/ادمینِ کانال می‌تونه ویرایشش کنه" }, 403);

  const title = (form.get("title") || "").toString().trim().slice(0, 60);
  if (!title) return json({ error: "اسم کانال لازمه" }, 400);
  const description = (form.get("description") || "").toString().trim().slice(0, 300);
  const isPublic = (form.get("isPublic") || "").toString() === "1" ? 1 : 0;

  let avatarFileId = undefined;
  const avatarFile = form.get("avatar");
  const hasAvatar = avatarFile && typeof avatarFile !== "string" && avatarFile.size > 0;
  if (hasAvatar) {
    if (!avatarFile.type.startsWith("image/")) return json({ error: "آواتار کانال باید یه فایل عکس باشه" }, 400);
    if (!(await verifyFileMatchesCategory(avatarFile, "image"))) {
      return json({ error: "محتوای فایل با نوع اعلام‌شده‌اش مطابقت نداره" }, 400);
    }
    if (avatarFile.size > 5 * 1024 * 1024) return json({ error: "حجم عکس آواتار نباید بیشتر از ۵ مگابایت باشه" }, 400);
    try {
      const result = await sendTelegramFile(env, "sendPhoto", "photo", avatarFile, `آواتار کانال — ${title}`);
      avatarFileId = extractFileId("photo", result);
    } catch (err) {
      console.error("خطای آپلود آواتار کانال به تلگرام:", err);
      return json({ error: "آپلود آواتار کانال ناموفق بود، دوباره امتحان کن" }, 502);
    }
  }

  if (avatarFileId !== undefined) {
    await env.D1.prepare(
      "UPDATE channels SET title = ?, description = ?, is_public = ?, avatar_file_id = ? WHERE id = ?"
    ).bind(title, description || null, isPublic, avatarFileId, channelId).run();
  } else {
    await env.D1.prepare(
      "UPDATE channels SET title = ?, description = ?, is_public = ? WHERE id = ?"
    ).bind(title, description || null, isPublic, channelId).run();
  }

  return json({ ok: true });
}

// ---------- تعیینِ نقشِ اعضا (ادمین‌کردن/برداشتنِ ادمین؛ فقط مالک) ----------
async function handleSetChannelRole(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const body = await request.json().catch(() => ({}));
  const channelId = (body.channelId || "").toString();
  const targetUsername = (body.username || "").toString();
  const role = (body.role || "").toString();
  if (!channelId || !targetUsername || !["member", "admin"].includes(role)) {
    return json({ error: "درخواست نامعتبره" }, 400);
  }

  const me = await getChannelMembership(env, channelId, username);
  if (!me || me.role !== "owner") return json({ error: "فقط مالکِ کانال می‌تونه نقش‌ها رو تغییر بده" }, 403);
  if (targetUsername === username) return json({ error: "نمی‌تونی نقشِ خودت رو عوض کنی" }, 400);

  const target = await getChannelMembership(env, channelId, targetUsername);
  if (!target) return json({ error: "این کاربر عضوِ کانال نیست" }, 404);

  await env.D1.prepare("UPDATE channel_members SET role = ? WHERE channel_id = ? AND username = ?")
    .bind(role, channelId, targetUsername).run();
  return json({ ok: true });
}

// ---------- پین‌کردنِ کانال (فقط مالکِ سایت؛ بالای تبِ کانال‌ها برای همه نمایش داده می‌شه) ----------
async function handlePinChannel(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!isSuperAdmin(username)) return json({ error: "فقط مالکِ سایت می‌تونه کانال رو پین کنه" }, 403);

  const body = await request.json().catch(() => ({}));
  const channelId = (body.channelId || "").toString();
  const pinned = !!body.pinned;
  if (!channelId) return json({ error: "شناسه‌ی کانال لازمه" }, 400);

  const channel = await env.D1.prepare("SELECT id FROM channels WHERE id = ?").bind(channelId).first();
  if (!channel) return json({ error: "کانال پیدا نشد" }, 404);

  await env.D1.prepare("UPDATE channels SET is_pinned = ?, pinned_at = ? WHERE id = ?")
    .bind(pinned ? 1 : 0, pinned ? Date.now() : null, channelId).run();

  // پین‌شدن یعنی کانال «رسمی/ویژه»ست؛ خودِ مالکِ سایت هم باید عضوش باشه تا تو لیستِ خودش ببینتش
  if (pinned) {
    const already = await getChannelMembership(env, channelId, username);
    if (!already) {
      await bind(
        env.D1.prepare(
          "INSERT INTO channel_members (channel_id, username, role, joined_at, last_read_at) VALUES (?, ?, 'member', ?, ?)"
        ),
        [channelId, username, Date.now(), 0]
      ).run();
    }
  }

  return json({ ok: true });
}

// ---------- پست‌گذاری در کانال (فقط مالک/ادمین) ----------
async function handleCreateChannelPost(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  if (!(await checkRateLimit(env, "channel_post", username, 30, 3600))) {
    return json({ error: "پست زیاد بوده، یه‌کم بعد امتحان کن" }, 429);
  }

  const body = await request.json().catch(() => ({}));
  const channelId = (body.channelId || "").toString();
  const text = (body.text || "").toString().trim().slice(0, 4000);
  const fileId = body.fileId ? String(body.fileId) : null;
  const fileType = body.fileType ? String(body.fileType) : null;
  if (!channelId) return json({ error: "شناسه‌ی کانال لازمه" }, 400);
  if (!text && !fileId) return json({ error: "متن یا رسانه لازمه" }, 400);

  const me = await getChannelMembership(env, channelId, username);
  if (!me || !isChannelModerator(me.role)) return json({ error: "فقط مالک/ادمینِ کانال می‌تونه پست بذاره" }, 403);

  const id = `cpost_${Date.now()}_${randomHex(6)}`;
  const now = Date.now();
  await bind(
    env.D1.prepare(
      "INSERT INTO channel_posts (id, channel_id, author_username, text, file_id, file_type, created_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, 0)"
    ),
    [id, channelId, username, text || null, fileId, fileType, now]
  ).run();

  return json({ post: { id, channelId, authorUsername: username, text, fileId, fileType, createdAt: now } });
}

// ---------- خواندنِ پست‌های یک کانال (صفحه‌بندی‌شده، مثلِ پیام‌های چت) ----------
async function handleListChannelPosts(request, env, channelId) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const me = await getChannelMembership(env, channelId, username);
  if (!me) return json({ error: "عضوِ این کانال نیستی" }, 403);

  const url = new URL(request.url);
  const before = parseInt(url.searchParams.get("before") || "0", 10) || Date.now() + 1;
  const rows = await env.D1.prepare(
    "SELECT id, author_username, text, file_id, file_type, created_at, edited_at FROM channel_posts WHERE channel_id = ? AND created_at < ? AND deleted = 0 ORDER BY created_at DESC LIMIT ?"
  ).bind(channelId, before, CHANNEL_POST_PAGE_SIZE).all();

  const posts = (rows.results || []).slice().reverse();
  await env.D1.prepare("UPDATE channel_members SET last_read_at = ? WHERE channel_id = ? AND username = ?")
    .bind(Date.now(), channelId, username).run();

  return json({ posts, hasMore: posts.length === CHANNEL_POST_PAGE_SIZE });
}

// ---------- حذفِ یک پست (فقط مالک/ادمین) ----------
async function handleDeleteChannelPost(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const body = await request.json().catch(() => ({}));
  const postId = (body.postId || "").toString();
  if (!postId) return json({ error: "شناسه‌ی پست لازمه" }, 400);

  const post = await env.D1.prepare("SELECT channel_id FROM channel_posts WHERE id = ?").bind(postId).first();
  if (!post) return json({ error: "پست پیدا نشد" }, 404);

  const me = await getChannelMembership(env, post.channel_id, username);
  if (!me || !isChannelModerator(me.role)) return json({ error: "فقط مالک/ادمینِ کانال می‌تونه پست رو حذف کنه" }, 403);

  await env.D1.prepare("UPDATE channel_posts SET deleted = 1 WHERE id = ?").bind(postId).run();
  return json({ ok: true });
}

// ---------- جست‌وجوی گروه‌ها و کانال‌های عمومی (برای کشف/عضویت؛ صفحه‌بندی/لیزی‌لود) ----------
async function handleSearchRooms(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").toString().trim().slice(0, 60);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = 15;
  const offset = (page - 1) * limit;
  const like = `%${q}%`;

  const groupsRows = await env.D1.prepare(
    `SELECT id, title, avatar_file_id FROM chat_conversations
     WHERE type = 'group' AND is_public = 1 AND title LIKE ?
     ORDER BY title ASC LIMIT ? OFFSET ?`
  ).bind(like, limit, offset).all();

  const channelsRows = await env.D1.prepare(
    `SELECT id, title, avatar_file_id FROM channels
     WHERE is_public = 1 AND title LIKE ?
     ORDER BY title ASC LIMIT ? OFFSET ?`
  ).bind(like, limit, offset).all();

  const results = [
    ...(groupsRows.results || []).map((r) => ({ kind: "group", id: r.id, title: r.title, avatarFileId: r.avatar_file_id })),
    ...(channelsRows.results || []).map((r) => ({ kind: "channel", id: r.id, title: r.title, avatarFileId: r.avatar_file_id })),
  ];

  return json({ results, hasMore: results.length >= limit, page });
}

// #endregion
// #region پلی‌لیست‌های سگ‌تونز
// ---------- پلی‌لیست‌ها ----------
// جدول‌های موردنیاز (یک‌بار توی کنسولِ D1 اجرا شه):
//   CREATE TABLE IF NOT EXISTS playlists (
//     id TEXT PRIMARY KEY,
//     owner_username TEXT NOT NULL,
//     name TEXT NOT NULL,
//     is_public INTEGER NOT NULL DEFAULT 0,
//     created_at INTEGER NOT NULL,
//     updated_at INTEGER NOT NULL
//   );
//   CREATE INDEX IF NOT EXISTS idx_playlists_owner ON playlists (owner_username);
//   CREATE TABLE IF NOT EXISTS playlist_items (
//     playlist_id TEXT NOT NULL,
//     post_id TEXT NOT NULL,
//     added_at INTEGER NOT NULL,
//     position INTEGER NOT NULL,
//     PRIMARY KEY (playlist_id, post_id)
//   );
//   CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items (playlist_id, position);

const PLAYLIST_PAGE_SIZE = 30;
const PLAYLIST_TRACK_PAGE_SIZE = 30;

// فقط اگه مالکِ پلی‌لیست خودِ کاربر باشه رکوردش رو برمی‌گردونه، وگرنه خطای مناسب
async function getPlaylistOwned(env, playlistId, username) {
  const pl = await env.D1.prepare("SELECT * FROM playlists WHERE id = ?").bind(playlistId).first();
  if (!pl) return { error: json({ error: "پلی‌لیست پیدا نشد" }, 404) };
  if (pl.owner_username !== username) return { error: json({ error: "این پلی‌لیست مالِ تو نیست" }, 403) };
  return { playlist: pl };
}

// ---------- ساختِ پلی‌لیست ----------
async function handleCreatePlaylist(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").toString().trim().slice(0, 60);
  if (!name) return json({ error: "اسم پلی‌لیست لازمه" }, 400);
  const isPublic = body.is_public ? 1 : 0;
  const now = Date.now();
  const id = `pl_${now}_${randomHex(4)}`;
  await env.D1.prepare(
    "INSERT INTO playlists (id, owner_username, name, is_public, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, username, name, isPublic, now, now).run();
  return json({
    ok: true,
    playlist: { id, owner_username: username, name, is_public: isPublic, created_at: now, updated_at: now, track_count: 0 },
  });
}

// ---------- ویرایشِ پلی‌لیست (تغییرِ اسم و/یا عمومی↔خصوصی) ----------
async function handleUpdatePlaylist(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  const body = await request.json().catch(() => ({}));
  const playlistId = (body.playlist_id || "").toString();
  if (!playlistId) return json({ error: "شناسه پلی‌لیست لازمه" }, 400);
  const { error } = await getPlaylistOwned(env, playlistId, username);
  if (error) return error;

  const updates = [];
  const params = [];
  if (typeof body.name === "string" && body.name.trim()) {
    updates.push("name = ?");
    params.push(body.name.trim().slice(0, 60));
  }
  if (typeof body.is_public !== "undefined") {
    updates.push("is_public = ?");
    params.push(body.is_public ? 1 : 0);
  }
  if (updates.length === 0) return json({ error: "چیزی برای تغییر نیست" }, 400);
  updates.push("updated_at = ?");
  params.push(Date.now(), playlistId);
  await env.D1.prepare(`UPDATE playlists SET ${updates.join(", ")} WHERE id = ?`).bind(...params).run();
  return json({ ok: true });
}

// ---------- حذفِ پلی‌لیست ----------
async function handleDeletePlaylist(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  const body = await request.json().catch(() => ({}));
  const playlistId = (body.playlist_id || "").toString();
  if (!playlistId) return json({ error: "شناسه پلی‌لیست لازمه" }, 400);
  const { error } = await getPlaylistOwned(env, playlistId, username);
  if (error) return error;
  await env.D1.batch([
    env.D1.prepare("DELETE FROM playlist_items WHERE playlist_id = ?").bind(playlistId),
    env.D1.prepare("DELETE FROM playlists WHERE id = ?").bind(playlistId),
  ]);
  return json({ ok: true });
}

// ---------- لیستِ پلی‌لیست‌ها: یا پلی‌لیست‌های خودِ کاربر (خصوصی+عمومی)، یا همه‌ی عمومی‌های سایت ----------
async function handleListPlaylists(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") || "mine"; // mine | public
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
  const pageSize = PLAYLIST_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const whereSql = scope === "public" ? "WHERE is_public = 1" : "WHERE owner_username = ?";
  const params = scope === "public" ? [] : [username];

  const countRow = await env.D1.prepare(`SELECT COUNT(*) as c FROM playlists ${whereSql}`).bind(...params).first();
  const rows = await env.D1.prepare(
    `SELECT playlists.*, (SELECT COUNT(*) FROM playlist_items WHERE playlist_items.playlist_id = playlists.id) AS track_count
     FROM playlists ${whereSql} ORDER BY updated_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all();

  const total = countRow?.c || 0;
  return json({ ok: true, playlists: rows.results || [], hasMore: offset + (rows.results || []).length < total });
}

// ---------- آهنگ‌های داخلِ یه پلی‌لیست (تازه‌اضافه‌شده‌ها بالاتر) ----------
async function handlePlaylistTracks(request, env, playlistId) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  const playlist = await env.D1.prepare("SELECT * FROM playlists WHERE id = ?").bind(playlistId).first();
  if (!playlist) return json({ error: "پلی‌لیست پیدا نشد" }, 404);
  if (!playlist.is_public && playlist.owner_username !== username) {
    return json({ error: "این پلی‌لیست خصوصیه" }, 403);
  }

  const url = new URL(request.url);
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
  const pageSize = PLAYLIST_TRACK_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const countRow = await env.D1.prepare("SELECT COUNT(*) as c FROM playlist_items WHERE playlist_id = ?").bind(playlistId).first();
  const rows = await env.D1.prepare(
    `SELECT posts.* FROM playlist_items
     JOIN posts ON posts.id = playlist_items.post_id
     WHERE playlist_items.playlist_id = ?
     ORDER BY playlist_items.position DESC LIMIT ? OFFSET ?`
  ).bind(playlistId, pageSize, offset).all();

  const total = countRow?.c || 0;
  return json({
    ok: true,
    playlist,
    posts: rows.results || [],
    hasMore: offset + (rows.results || []).length < total,
  });
}

// ---------- افزودنِ یه آهنگ به پلی‌لیست ----------
async function handleAddTrackToPlaylist(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  const body = await request.json().catch(() => ({}));
  const playlistId = (body.playlist_id || "").toString();
  const postId = (body.post_id || "").toString();
  if (!playlistId || !postId) return json({ error: "اطلاعات ناقصه" }, 400);
  const { error } = await getPlaylistOwned(env, playlistId, username);
  if (error) return error;

  const post = await env.D1.prepare("SELECT id FROM posts WHERE id = ? AND type = 'audio'").bind(postId).first();
  if (!post) return json({ error: "آهنگ پیدا نشد" }, 404);

  const now = Date.now();
  await env.D1.prepare(
    "INSERT OR IGNORE INTO playlist_items (playlist_id, post_id, added_at, position) VALUES (?, ?, ?, ?)"
  ).bind(playlistId, postId, now, now).run();
  await env.D1.prepare("UPDATE playlists SET updated_at = ? WHERE id = ?").bind(now, playlistId).run();
  return json({ ok: true });
}

// ---------- حذفِ یه آهنگ از پلی‌لیست ----------
async function handleRemoveTrackFromPlaylist(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  const body = await request.json().catch(() => ({}));
  const playlistId = (body.playlist_id || "").toString();
  const postId = (body.post_id || "").toString();
  if (!playlistId || !postId) return json({ error: "اطلاعات ناقصه" }, 400);
  const { error } = await getPlaylistOwned(env, playlistId, username);
  if (error) return error;

  await env.D1.prepare("DELETE FROM playlist_items WHERE playlist_id = ? AND post_id = ?").bind(playlistId, postId).run();
  return json({ ok: true });
}

// ---------- برای مودالِ «افزودن به پلی‌لیست»: پلی‌لیست‌های خودِ کاربر + این‌که کدوم‌ها همین آهنگ رو دارن ----------
async function handlePlaylistsForTrack(request, env) {
  const username = await getUserFromToken(request, env);
  if (!username) return json({ error: "ابتدا وارد شو" }, 401);
  const url = new URL(request.url);
  const postId = (url.searchParams.get("post_id") || "").toString();
  if (!postId) return json({ error: "شناسه آهنگ لازمه" }, 400);

  const rows = await env.D1.prepare(
    `SELECT playlists.id, playlists.name, playlists.is_public,
            EXISTS(SELECT 1 FROM playlist_items WHERE playlist_items.playlist_id = playlists.id AND playlist_items.post_id = ?) AS has_track
     FROM playlists WHERE owner_username = ? ORDER BY updated_at DESC`
  ).bind(postId, username).all();

  return json({ ok: true, playlists: rows.results || [] });
}

// #endregion
// #region روتر اصلی
// ---------- روتر اصلی ----------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = corsHeadersFor(request);

    // پیش‌درخواستِ CORS (OPTIONS) همیشه، حتی برای Originهای غیرمجاز، باید با کدِ ۲xx جواب داده بشه؛
    // این خودِ مرورگره که بر اساسِ هدرهای CORS توی همین پاسخ تصمیم می‌گیره درخواستِ اصلی رو بفرسته یا
    // نه. اگه اینجا (مثلِ قبل) قبل از OPTIONS، گیتِ دسترسیِ مستقیم رو چک کنیم و برای پیش‌درخواست ۴۰۳
    // برگردونیم، مرورگر اصلاً کدِ وضعیت رو نمی‌بینه و کلِ درخواست رو به‌عنوانِ یه خطای شبکه (چیزی که
    // توی کدِ فرانت‌اند مثلِ "Failed to fetch" دیده می‌شه) گزارش می‌ده؛ محدودیتِ واقعیِ دسترسی باید
    // فقط رویِ خودِ درخواستِ اصلی (POST/GET/...) اعمال بشه، نه رویِ پیش‌درخواست.
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // این ورکر دیگه نباید مستقیم صدا زده بشه؛ فقط از طریق ورکر پروکسیِ جلوش. پروکسی یه هدر
    // مخفی مشترک (X-Internal-Key) اضافه می‌کنه که فقط بین دو ورکر شناخته‌شده‌ست. یه استثنا هم
    // داریم: دکمه‌ی «آپلود با گیت‌هاب» توی فرانت‌اند به کاربر اجازه می‌ده صراحتاً همین مسیرِ مستقیم رو
    // انتخاب کنه (چه از پشتِ GitHub Pages وارد شده باشه که اصلاً پروکسی نداره، چه از دامنه‌ی دیگه‌ای
    // بخواد پروکسی رو دور بزنه)؛ برای همین، هر Originِ شناخته‌شده‌ی خودِ سایت (همون لیستِ
    // ALLOWED_ORIGINS بالا) بدونِ نیاز به کلید مجازه. اگه هیچ‌کدوم از این دو شرط برقرار نبود (یعنی
    // درخواست مستقیم از curl/Postman/جای ناشناس اومده)، رد می‌شه.
    const requestOrigin = request.headers.get("Origin");
    const internalKey = request.headers.get("X-Internal-Key");
    const hasValidInternalKey = env.INTERNAL_KEY && internalKey === env.INTERNAL_KEY;
    const isAllowedDirectOrigin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin);
    if (!hasValidInternalKey && !isAllowedDirectOrigin) {
      const denied = json({ error: "دسترسی مستقیم مجاز نیست" }, 403);
      for (const [key, value] of Object.entries(corsHeaders)) {
        denied.headers.set(key, value);
      }
      return denied;
    }

    try {
      const response = await routeRequest(url, request, env, ctx);
      const finalHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(corsHeaders)) {
        finalHeaders.set(key, value);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: finalHeaders,
      });
    } catch (err) {
      // جزئیات خطا فقط توی لاگ سرور (قابل مشاهده از داشبورد Cloudflare) ثبت می‌شه، نه توی پاسخ به کاربر؛
      // چون پیام خام خطا می‌تونه جزئیات داخلی (نام جدول، ساختار کوئری و...) رو لو بده
      console.error("خطای داخلی سرور:", err);
      const errResponse = json({ error: "خطای داخلی سرور رخ داد؛ لطفاً دوباره امتحان کن" }, 500);
      for (const [key, value] of Object.entries(corsHeaders)) {
        errResponse.headers.set(key, value);
      }
      return errResponse;
    }
  },
};
// #endregion
