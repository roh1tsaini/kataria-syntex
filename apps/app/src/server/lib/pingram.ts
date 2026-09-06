/**
 * Pingram client — direct REST calls (same API key for SMS + email).
 *
 * SMS: POST /sms — https://www.pingram.io/docs/api-reference/operations/sms_send/
 * Email: POST /email — https://www.pingram.io/docs/api-reference/operations/email_send/
 *
 * The account lives on the EU region (Frankfurt), hence api.eu.pingram.io.
 * SMS `to` must be E.164 (+CC...). The API returns HTTP 200 with an `error`
 * object when the account cannot deliver (e.g. billing not configured) —
 * treat that as failure.
 */
const SENDER_NAME = "Kataria Syntex Biz App";
const API_BASE_URL = "https://api.eu.pingram.io";

async function post(
  apiKey: string,
  path: "sms" | "email",
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => "");
  let bodyHasError = false;
  try {
    const body: unknown = JSON.parse(text);
    bodyHasError = body !== null && typeof body === "object" && "error" in body;
  } catch {
    // Non-JSON 2xx body — no error field to check.
  }
  if (!res.ok || bodyHasError) {
    throw new Error(
      `pingram_${path}_failed ${res.status} ${text.slice(0, 200)}`,
    );
  }
}

export function sendOtpSms(
  apiKey: string,
  phone: string,
  code: string,
): Promise<void> {
  return post(apiKey, "sms", {
    type: "otp",
    to: phone,
    message: `${SENDER_NAME}: your verification code is ${code}. Valid for 5 minutes.`,
  });
}

export function sendOtpEmail(
  apiKey: string,
  email: string,
  code: string,
): Promise<void> {
  return post(apiKey, "email", {
    type: "otp",
    to: email,
    fromName: SENDER_NAME,
    subject: `${code} is your ${SENDER_NAME} verification code`,
    previewText: `Your verification code expires in 5 minutes.`,
    html: [
      `<div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">`,
      `<h1 style="font-size:20px;margin:0 0 12px;">Verify your login</h1>`,
      `<p style="font-size:14px;color:#555;margin:0 0 24px;">Enter this code to continue. It expires in <strong>5 minutes</strong>.</p>`,
      `<div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f4f4f5;border-radius:12px;padding:20px;text-align:center;">${code}</div>`,
      `<p style="font-size:12px;color:#888;margin:24px 0 0;">If you didn't request this, you can safely ignore this email.</p>`,
      `</div>`,
    ].join(""),
  });
}
