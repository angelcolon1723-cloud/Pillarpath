/**
 * Outbound email for PillarPath (server-only).
 *
 * Sends via the Resend API using `RESEND_API_KEY` (Vercel production env var,
 * sensitive). When the key is absent (local dev, preview) sending is disabled
 * and callers must degrade gracefully — never crash the auth flow.
 *
 * Free-tier note: until a sending domain is verified in Resend, mail must go
 * out from `onboarding@resend.dev`.
 */

const RESEND_URL = "https://api.resend.com/emails";
const FROM = "PillarPath <onboarding@resend.dev>";

/** True when the app can actually send email right now. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** Thrown when a code email is requested but no provider is configured. */
export class EmailNotConfiguredError extends Error {
  constructor() {
    super("EMAIL_NOT_CONFIGURED");
    this.name = "EmailNotConfiguredError";
  }
}

export async function sendLoginCodeEmail(
  to: string,
  code: string,
): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new EmailNotConfiguredError();
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject: `Your PillarPath code: ${code}`,
      text:
        `Your PillarPath verification code is ${code}.\n\n` +
        `It expires in 10 minutes. If you didn't try to sign in, you can ignore this email.`,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[email] Resend send failed", {
      status: res.status,
      body: body.slice(0, 300),
    });
    throw new Error(`Email send failed (${res.status})`);
  }
}
