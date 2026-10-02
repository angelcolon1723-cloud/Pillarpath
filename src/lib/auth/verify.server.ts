import { getRequest } from "@tanstack/react-start/server";
import { gateIdentityEnabled } from "./gate-identity.server";
import { auth, authConfigured } from "./server";

/**
 * Server-side session resolution (server-only).
 *
 * Because this app runs its OWN Better Auth at same-origin `/api/auth/*`, the
 * session cookie is sent with every request to this app — server functions AND
 * SSR loaders included. So we resolve the user straight from the request cookies
 * via `auth.api.getSession` (no client-minted JWT needed). Never trust a
 * client-supplied user id — only the result of this verification.
 */

/** True when a real database is configured server-side. */
const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());

/** Re-export so callers can branch on it without importing `server.ts`. */
export { authConfigured };

if (databaseConfigured && !authConfigured) {
  console.error(
    "[auth] DATABASE_URL is set but auth is disabled (VITE_AUTH_ENABLED=false) " +
      "— requireUserId() will reject every request (fail closed) rather than " +
      "share one dev user on a real database.",
  );
}

/** Dev fallback user id, used only when auth is disabled (VITE_AUTH_ENABLED=false). */
export const DEV_USER_ID = "dev-user";

/**
 * Thrown by `requireUserId` when the caller has no valid session. Carries
 * `status: 401`; the message is a stable contract — match
 * `err.message === "Unauthorized"` client-side to send the visitor to sign-in.
 */
export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

/**
 * Thrown by `requireUserId` when the caller's password login still owes its
 * 4-digit verification code. Carries `status: 403`; the message is a stable
 * contract — match `err.message === "OTP_REQUIRED"` client-side to route the
 * visitor to the code step.
 */
export class OtpRequiredError extends Error {
  readonly status = 403;
  constructor() {
    super("OTP_REQUIRED");
    this.name = "OtpRequiredError";
  }
}

export type VerifiedUser = { id: string; email: string | null };

/**
 * Four-sided account identity, resolved server-side on every request.
 *
 * The `kind` NEVER comes from the client — it is read from the `"user".role`
 * column (written only by the signup hook, the role picker, or admin flows).
 * Children are not users at all: a kid session resolves to `{ kind: "child" }`
 * with the parent's userId + the child profile id (Phase 2 wires the kid
 * cookie; until then only parent/teacher/admin kinds exist).
 */
export type Identity =
  | { kind: "parent"; userId: string }
  | { kind: "child"; userId: string; childId: number }
  | { kind: "teacher"; userId: string; teacherStatus: string }
  | { kind: "admin"; userId: string };

export type AccountRole = "parent" | "teacher" | "admin";

const VALID_ROLES: AccountRole[] = ["parent", "teacher", "admin"];

type UserRoleRow = {
  role: string | null;
  teacher_status: string | null;
  role_set_at: string | null;
};

/**
 * Read the account's server-side role facts. Returns safe defaults when the
 * column is missing (migration not yet applied) so deploys never hard-crash
 * mid-rollout — but every row will have real values after 0005 runs.
 */
async function readRoleFacts(userId: string): Promise<UserRoleRow> {
  if (userId === DEV_USER_ID) {
    return { role: "parent", teacher_status: "unverified", role_set_at: new Date().toISOString() };
  }
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  try {
    const rows = await sql<UserRoleRow>`
      select role, teacher_status, role_set_at from "user" where id = ${userId}
    `;
    return rows[0] ?? { role: "parent", teacher_status: "unverified", role_set_at: null };
  } catch {
    // Column missing (pre-0005 database): treat as a legacy parent account
    // that still needs the role picker.
    return { role: "parent", teacher_status: "unverified", role_set_at: null };
  }
}

/**
 * Resolve the caller's full four-sided identity: verified session user +
 * server-side role facts. Throws `UnauthorizedError` when signed out (same
 * contract as `requireUserId`).
 *
 * Phase 2 extends this to check the kid-session cookie FIRST and return
 * `{ kind: "child", … }` — a device is either in kid mode or full-session
 * mode, never both.
 */
export async function requireIdentity(bearerToken?: string): Promise<Identity> {
  const userId = await requireUserId(bearerToken);
  const facts = await readRoleFacts(userId);
  const role: AccountRole = VALID_ROLES.includes(facts.role as AccountRole)
    ? (facts.role as AccountRole)
    : "parent";
  if (role === "teacher") {
    return { kind: "teacher", userId, teacherStatus: facts.teacher_status ?? "unverified" };
  }
  if (role === "admin") {
    return { kind: "admin", userId };
  }
  return { kind: "parent", userId };
}

/** True when the account still needs the one-time post-signup role picker. */
export async function needsRoleChoice(bearerToken?: string): Promise<boolean> {
  const userId = await requireUserId(bearerToken);
  const facts = await readRoleFacts(userId);
  return facts.role_set_at == null;
}

/**
 * Resolve the signed-in user from the current request, or `null` when auth isn't
 * configured / nobody is signed in. Safe to call from server functions and SSR
 * loaders.
 *
 * `bearerToken` is for the LIVE PREVIEW: the app runs in a partitioned iframe
 * whose cookies don't reach the server, so `authMiddleware` forwards the session
 * as a bearer token, which we present as `Authorization: Bearer …` (the `bearer`
 * plugin resolves it). When deployed no token is passed and the cookie is used.
 */
export async function getSessionUser(
  bearerToken?: string,
): Promise<VerifiedUser | null> {
  if (!authConfigured && !gateIdentityEnabled()) return null;
  const request = getRequest();
  if (!request) return null;
  let headers = request.headers;
  if (bearerToken) {
    headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${bearerToken}`);
  }
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email ?? null };
}

/**
 * True when the user has a pending password-login code ceremony. The marker is
 * written by `requestLoginOtp` (login-otp.ts) and deleted by `verifyLoginOtp`;
 * OAuth sessions never get one. Skipped entirely when no email provider is
 * configured, so dev/preview stay usable.
 */
async function isLoginOtpRequired(userId: string): Promise<boolean> {
  const { isEmailConfigured } = await import("@/lib/email.server");
  if (!isEmailConfigured()) return false;
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql`
    select 1 from verification
    where identifier = ${`login-otp-required:${userId}`}
      and "expiresAt" > now()
    limit 1`;
  return rows.length > 0;
}

/**
 * Resolve the current user id for a server function, or throw when unauthorized.
 * Prefer `authMiddleware` (`./middleware`), which calls this for you.
 * - Auth enabled -> the verified session user id; throws
 *   `UnauthorizedError` when signed out. Works in the sandbox preview too (real
 *   sign-in via the baked preview client).
 * - Auth disabled (`VITE_AUTH_ENABLED=false`) + `DATABASE_URL` set -> throw (fail
 *   closed): one shared dev user on a real database would let every visitor
 *   read/write everyone's rows.
 * - Auth disabled + no database -> the shared dev user id.
 *
 * When a password login still owes its 4-digit verification code, throws
 * `OtpRequiredError` instead — pass `{ skipOtpCheck: true }` only from the OTP
 * ceremony's own endpoints.
 */
export async function requireUserId(
  bearerToken?: string,
  opts?: { skipOtpCheck?: boolean },
): Promise<string> {
  if (!authConfigured && !gateIdentityEnabled()) {
    if (databaseConfigured) {
      throw new Error(
        "Auth is disabled (VITE_AUTH_ENABLED=false) but DATABASE_URL is set — " +
          "refusing to fall back to the shared dev user against a real database.",
      );
    }
    return DEV_USER_ID;
  }
  const user = await getSessionUser(bearerToken);
  if (!user) throw new UnauthorizedError();
  if (!opts?.skipOtpCheck && (await isLoginOtpRequired(user.id))) {
    throw new OtpRequiredError();
  }
  return user.id;
}
