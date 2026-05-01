const RESEND_API_BASE = "https://api.resend.com";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function pickEmail(body) {
  if (!body || typeof body !== "object") return "";
  if (typeof body.email !== "string") return "";
  return body.email.trim().toLowerCase();
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

  const apiKey = process.env.RESEND_API_KEY || "";
  const audienceId = process.env.RESEND_AUDIENCE_ID || "";
  const fromEmail = process.env.RESEND_FROM_EMAIL || "";

  if (!apiKey || !audienceId || !fromEmail) {
    res.status(500).json({ error: "server_not_configured" });
    return;
  }

  const email = pickEmail(req.body);
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "invalid_email" });
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
    res.status(502).json({ error: "subscribe_failed", detail: contactResult?.data || null });
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
    res.status(502).json({ error: "welcome_email_failed", detail: welcomeResult.data || null });
    return;
  }

  res.status(200).json({ ok: true, duplicate: false, welcomed: true });
};

