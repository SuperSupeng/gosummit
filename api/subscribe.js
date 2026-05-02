const RESEND_API_BASE = "https://api.resend.com";
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateBuckets = new Map();

const DEFAULT_ALLOWED_ORIGINS = [
  "https://gosummit.ai",
  "https://www.gosummit.ai",
  "http://localhost:8001",
  "http://127.0.0.1:8001",
];

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function pickEmail(body) {
  if (!body || typeof body !== "object") return "";
  if (typeof body.email !== "string") return "";
  return body.email.trim().toLowerCase();
}

function getAllowedOrigins() {
  const configured = process.env.ALLOWED_ORIGINS || "";
  const origins = configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  const vercelBranchUrl = process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : "";
  return [...(origins.length ? origins : DEFAULT_ALLOWED_ORIGINS), vercelUrl, vercelBranchUrl].filter(Boolean);
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin || "";
  const referer = req.headers.referer || "";
  const allowedOrigins = getAllowedOrigins();
  const source = origin || referer;
  if (!source) return true;
  return allowedOrigins.some((allowed) => source === allowed || source.startsWith(`${allowed}/`));
}

function getClientKey(req) {
  const forwardedFor = req.headers["x-forwarded-for"] || "";
  return String(forwardedFor).split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
}

function isRateLimited(req) {
  const key = getClientKey(req);
  const now = Date.now();
  const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return bucket.count > RATE_LIMIT_MAX;
}

function looksLikeBot(body) {
  if (!body || typeof body !== "object") return false;
  if (typeof body.website === "string" && body.website.trim()) return true;
  const submittedAt = Number(body.submittedAt || 0);
  if (!Number.isFinite(submittedAt) || submittedAt <= 0) return true;
  const ageMs = Date.now() - submittedAt;
  return ageMs < 1500 || ageMs > 24 * 60 * 60 * 1000;
}

async function resendRequest(path, apiKey, payload) {
  const response = await fetch(`${RESEND_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: response.ok, status: response.status, data: json };
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  if (!isAllowedOrigin(req)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  if (isRateLimited(req)) {
    res.status(429).json({ error: "rate_limited" });
    return;
  }

  if (looksLikeBot(req.body)) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }

  const email = pickEmail(req.body);
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "invalid_email" });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY || "";
  const audienceId = process.env.RESEND_AUDIENCE_ID || "";
  const fromEmail = process.env.RESEND_FROM_EMAIL || "";

  if (!apiKey || !audienceId || !fromEmail) {
    res.status(500).json({ error: "server_not_configured" });
    return;
  }

  // Try the audience-specific endpoint first, then fallback to /contacts payload variants.
  const contactAttempts = [
    {
      path: `/audiences/${audienceId}/contacts`,
      payload: { email, unsubscribed: false },
    },
    {
      path: "/contacts",
      payload: { email, audience_id: audienceId, unsubscribed: false },
    },
    {
      path: "/contacts",
      payload: { email, audienceId, unsubscribed: false },
    },
  ];

  let contactResult = null;
  for (const attempt of contactAttempts) {
    contactResult = await resendRequest(attempt.path, apiKey, attempt.payload);
    if (contactResult.ok || contactResult.status === 409) break;
    if (contactResult.status < 500) break;
  }

  if (!contactResult || (!contactResult.ok && contactResult.status !== 409)) {
    console.error("subscribe_failed", contactResult?.status, contactResult?.data || null);
    res.status(502).json({ error: "subscribe_failed" });
    return;
  }

  const duplicate = contactResult.status === 409;
  if (duplicate) {
    res.status(200).json({ ok: true, duplicate: true, welcomed: false });
    return;
  }

  const welcomeHtml =
    "<p>Welcome to GO Summit updates.</p><p>You're on the list for upcoming cities, speakers and partner updates.</p>";
  const welcomeText =
    "Welcome to GO Summit updates. You're on the list for upcoming cities, speakers and partner updates.";

  const welcomeResult = await resendRequest("/emails", apiKey, {
    from: fromEmail,
    to: [email],
    subject: "Welcome to GO Summit",
    html: welcomeHtml,
    text: welcomeText,
    reply_to: "info@agivilla.com",
  });

  if (!welcomeResult.ok) {
    console.error("welcome_email_failed", welcomeResult.status, welcomeResult.data || null);
    res.status(502).json({ error: "welcome_email_failed" });
    return;
  }

  res.status(200).json({ ok: true, duplicate: false, welcomed: true });
};
