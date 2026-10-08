import { createFileRoute } from "@tanstack/react-router";
import { SESSION_TOKEN_COOKIE } from "@/lib/auth/server";

/**
 * Native-app OAuth bridge (production route).
 *
 * Google blocks OAuth inside embedded WebViews, so in the Android shell
 * sign-in runs in the system browser (Chrome Custom Tab). Better Auth's
 * callback lands HERE in that browser, where the session cookie exists.
 * This page reads the session token server-side (same trick as the
 * live-preview popup flow) and hands it to the app through the
 * `pillarpath://auth` deep link; the app stores it as its Bearer session
 * (see `completeAppAuthDeepLink` in src/lib/auth/client.ts).
 */

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    const raw = trimmed.slice(eq + 1);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

function bridgePage(deepLink: string, ok: boolean): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PillarPath</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#070312;color:#f3efff;font-family:system-ui,sans-serif;text-align:center;padding:24px}
  .card{max-width:340px}
  .logo{font-size:44px}
  a{display:inline-block;margin-top:18px;background:linear-gradient(135deg,#06b6d4,#8b5cf6,#d946ef);color:#fff;font-weight:800;text-decoration:none;padding:14px 22px;border-radius:14px}
  p{color:#cfc6ff;line-height:1.5}
</style>
</head>
<body>
  <div class="card">
    <div class="logo">🏛️</div>
    <h2>${ok ? "You're signed in!" : "Sign-in didn't complete"}</h2>
    <p>${ok ? "Taking you back to PillarPath…" : "Head back to the app and try again."}</p>
    <a href="${deepLink}">Return to PillarPath</a>
  </div>
  <script>try{location.replace(${JSON.stringify(deepLink)});}catch(e){}</script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // This page can carry a session token — never cache it.
      "cache-control": "no-store",
    },
  });
}

export const Route = createFileRoute("/auth/app-return")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const rawDest = url.searchParams.get("dest") ?? "/";
        const dest =
          rawDest.startsWith("/") && !rawDest.startsWith("//") ? rawDest : "/";
        // Better Auth appends its real error code as an `error` param on
        // the failure redirect; our own marker is `failed=1`. Surface the
        // real code (last error param wins) — never a placeholder.
        const errorCodes = url.searchParams.getAll("error").filter(Boolean);
        const failed = url.searchParams.has("failed") || errorCodes.length > 0;
        const token = failed ? null : readCookie(request, SESSION_TOKEN_COOKIE);
        const deep = token
          ? `pillarpath://auth?token=${encodeURIComponent(token)}&dest=${encodeURIComponent(dest)}`
          : `pillarpath://auth?error=${encodeURIComponent(errorCodes[errorCodes.length - 1] ?? "sign_in_failed")}&dest=${encodeURIComponent(dest)}`;
        return bridgePage(deep, Boolean(token));
      },
    },
  },
});
