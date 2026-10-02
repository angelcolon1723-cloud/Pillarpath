/**
 * Password-login two-step verification (4-digit email code).
 *
 * Ceremony:
 *   1. Client signs in with email+password (better-auth, session created).
 *   2. Client calls `requestLoginOtp()` -> server generates a 4-digit code,
 *      stores its SHA-256 in the `verification` table
 *      (`login-otp:<userId>`, 10-min expiry), marks the ceremony pending
 *      (`login-otp-required:<userId>`, 24h expiry), and emails the code.
 *   3. Client calls `verifyLoginOtp({ code })` -> on success both rows are
 *      deleted and the session is fully usable.
 *
 * Enforcement is server-side: `requireUserId` (verify.server.ts) throws
 * `OtpRequiredError` while the pending marker exists, so every data server
 * function stays closed until the code is verified. OAuth sessions never get
 * the marker, so Google/Apple/etc. logins are unaffected.
 *
 * When no email provider is configured (RESEND_API_KEY absent — local dev,
 * preview), the whole ceremony is inert: `requestLoginOtp` returns
 * `{ sent: false }` and `requireUserId` skips the check.
 */
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/db";
import {
  EmailNotConfiguredError,
  isEmailConfigured,
  sendLoginCodeEmail,
} from "@/lib/email.server";

const OTP_TTL_MS = 10 * 60 * 1000;
const REQUIRED_MARKER_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const otpIdentifier = (userId: string) => `login-otp:${userId}`;
const requiredIdentifier = (userId: string) => `login-otp-required:${userId}`;

/** Same as authMiddleware, but skips the OTP enforcement (these ARE the ceremony). */
const otpBypassMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import(
      "@/lib/auth/isolation.server"
    );
    const { requireUserId } = await import("@/lib/auth/verify.server");
    assertSameSiteRequest();
    const userId = await requireUserId(context.bearerToken, {
      skipOtpCheck: true,
    });
    return next({ context: { userId } });
  });

type OtpRow = {
  identifier: string;
  value: string;
  expiresAt: string;
  createdAt: string;
};

async function getOtpRow(identifier: string): Promise<OtpRow | null> {
  const sql = await getSql();
  const rows = await sql<OtpRow>`
    select identifier, value, "expiresAt", "createdAt"
    from verification where identifier = ${identifier} limit 1`;
  return rows[0] ?? null;
}

async function deleteRows(identifiers: string[]): Promise<void> {
  if (identifiers.length === 0) return;
  const sql = await getSql();
  await sql`delete from verification where identifier = any(${identifiers})`;
}

function hashCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

function codesEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

async function getUserEmail(userId: string): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ email: string | null }>`
    select email from "user" where id = ${userId} limit 1`;
  return rows[0]?.email ?? null;
}

/**
 * Generate and email a fresh 4-digit login code. Replaces any previous code.
 * Returns `{ sent: false }` when email isn't configured (ceremony inert).
 */
export const requestLoginOtp = createServerFn({ method: "POST" })
  .middleware([otpBypassMiddleware])
  .handler(async ({ context }): Promise<{ sent: boolean }> => {
    const { userId } = context;
    if (!isEmailConfigured()) return { sent: false };

    const email = await getUserEmail(userId);
    if (!email) throw new Error("No email address on this account.");

    const existing = await getOtpRow(otpIdentifier(userId));
    if (existing) {
      const ageMs = Date.now() - new Date(existing.createdAt).getTime();
      const expired = new Date(existing.expiresAt).getTime() <= Date.now();
      if (!expired && ageMs < RESEND_COOLDOWN_MS) {
        throw new Error("A code was just sent — please wait a minute before requesting another.");
      }
    }

    const code = String(randomInt(1000, 10000)); // always 4 digits
    const now = new Date();
    const sql = await getSql();
    await deleteRows([otpIdentifier(userId)]);
    await sql`
      insert into verification (id, identifier, value, "expiresAt")
      values (${randomUUID()}, ${otpIdentifier(userId)},
              ${JSON.stringify({ hash: hashCode(code), attempts: 0 })},
              ${new Date(now.getTime() + OTP_TTL_MS)})`;
    await deleteRows([requiredIdentifier(userId)]);
    await sql`
      insert into verification (id, identifier, value, "expiresAt")
      values (${randomUUID()}, ${requiredIdentifier(userId)}, '1',
              ${new Date(now.getTime() + REQUIRED_MARKER_TTL_MS)})`;

    try {
      await sendLoginCodeEmail(email, code);
    } catch (err) {
      if (err instanceof EmailNotConfiguredError) return { sent: false };
      throw err;
    }
    return { sent: true };
  });

/** Verify the 4-digit code. On success the ceremony completes. */
export const verifyLoginOtp = createServerFn({ method: "POST" })
  .middleware([otpBypassMiddleware])
  .validator((input: { code: string }) => {
    if (!/^\d{4}$/.test(input.code)) {
      throw new Error("Enter the 4-digit code from your email.");
    }
    return input;
  })
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { userId } = context;
    const row = await getOtpRow(otpIdentifier(userId));
    if (!row || new Date(row.expiresAt).getTime() <= Date.now()) {
      await deleteRows([otpIdentifier(userId)]);
      throw new Error("That code expired — request a new one.");
    }
    let parsed: { hash: string; attempts: number };
    try {
      parsed = JSON.parse(row.value) as { hash: string; attempts: number };
    } catch {
      await deleteRows([otpIdentifier(userId)]);
      throw new Error("That code is no longer valid — request a new one.");
    }
    if (parsed.attempts >= MAX_ATTEMPTS) {
      await deleteRows([otpIdentifier(userId)]);
      throw new Error("Too many wrong attempts — request a new code.");
    }
    if (!codesEqual(hashCode(data.code), parsed.hash)) {
      const sql = await getSql();
      await sql`
        update verification set value = ${JSON.stringify({ hash: parsed.hash, attempts: parsed.attempts + 1 })}
        where identifier = ${otpIdentifier(userId)}`;
      const remaining = MAX_ATTEMPTS - parsed.attempts - 1;
      throw new Error(
        remaining > 0
          ? `Incorrect code — ${remaining} ${remaining === 1 ? "try" : "tries"} left.`
          : "Incorrect code — request a new one.",
      );
    }
    await deleteRows([otpIdentifier(userId), requiredIdentifier(userId)]);
    return { ok: true };
  });

/** Does the current session still owe the login code? (safety net for resumed sessions) */
export const getLoginOtpState = createServerFn({ method: "GET" })
  .middleware([otpBypassMiddleware])
  .handler(async ({ context }): Promise<{ required: boolean; emailConfigured: boolean }> => {
    const { userId } = context;
    const emailConfigured = isEmailConfigured();
    if (!emailConfigured) return { required: false, emailConfigured };
    const row = await getOtpRow(requiredIdentifier(userId));
    const required =
      !!row && new Date(row.expiresAt).getTime() > Date.now();
    return { required, emailConfigured };
  });
