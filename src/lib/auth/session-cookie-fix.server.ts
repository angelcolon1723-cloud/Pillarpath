import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { parseSetCookieHeader, toCookieOptions } from "better-auth/cookies";

const LOG = "[session-cookie-fix]";

/**
 * Re-forward auth Set-Cookie headers through TanStack Start directly.
 *
 * On TanStack Start, Better Auth writes Set-Cookie into an internal header bag
 * (`ctx.context.responseHeaders`) that is not always copied onto the final HTTP
 * response — the response can end up with no Set-Cookie at all (see the same
 * note on `emitSessionCookie` in gate-session.server.ts). The bundled
 * `tanstackStartCookies()` after-hook is supposed to forward the bag, but it
 * swallows every failure silently and leaves no diagnostics.
 *
 * This plugin runs on the endpoints that mint sessions (email sign-in/sign-up
 * and every OAuth callback) and forwards whatever the bag holds through
 * TanStack's `setCookie`, logging loudly when the bag is unexpectedly empty so
 * a dropped session cookie becomes a visible server log instead of a mystery
 * landing-page bounce.
 */
const COOKIE_PATHS = new Set(["/sign-in/email", "/sign-up/email"]);

function isAuthCookiePath(path: string | undefined): boolean {
  if (!path) return false;
  return COOKIE_PATHS.has(path) || path.startsWith("/callback/");
}

export function sessionCookieFix() {
  return {
    id: "pillarpath-session-cookie-fix",
    hooks: {
      after: [
        {
          matcher: (ctx: { path?: string }) => isAuthCookiePath(ctx.path),
          handler: createAuthMiddleware(async (ctx) => {
            const responseHeaders = ctx.context.responseHeaders;
            const setCookieHeader =
              responseHeaders instanceof Headers
                ? responseHeaders.get("set-cookie")
                : null;
            if (!setCookieHeader) {
              console.error(
                `${LOG} no set-cookie in responseHeaders after ${ctx.path} — auth cookies may not reach the browser`,
              );
              return;
            }
            const parsed = parseSetCookieHeader(setCookieHeader);
            if (parsed.size === 0) return;
            let forwarded = 0;
            try {
              const { setCookie } = await import(
                "@tanstack/react-start/server"
              );
              parsed.forEach((cookie, name) => {
                if (!name) return;
                try {
                  setCookie(name, cookie.value, toCookieOptions(cookie));
                  forwarded += 1;
                } catch (err) {
                  console.error(`${LOG} setCookie failed for ${name}`, err);
                }
              });
            } catch (err) {
              console.error(`${LOG} TanStack setCookie unavailable`, err);
              return;
            }
            if (forwarded === 0) {
              console.error(
                `${LOG} parsed ${parsed.size} cookie(s) after ${ctx.path} but forwarded none`,
              );
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
