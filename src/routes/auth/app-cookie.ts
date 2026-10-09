import { createFileRoute } from "@tanstack/react-router";
import { auth, SESSION_TOKEN_COOKIE } from "@/lib/auth/server";

/**
 * Native-app session transplant (production route).
 *
 * The deep-link sign-in hands the app a session TOKEN, which the app
 * presents as a Bearer credential. That works for the auth client's own
 * session fetch, but the app's server functions resolve sessions from
 * request cookies first — and the WebView's cookie jar is empty, so
 * account data failed to load ("Couldn't load your account"). This
 * route runs INSIDE the WebView right after the deep link: it validates
 * the token server-side and, when valid, sets the real session cookie
 * on the WebView's jar, so from here on the app authenticates exactly
 * like a normal browser session.
 */

function page(dest: string, cookie: string | null): Response {
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  if (cookie) headers.append("set-cookie", cookie);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="refresh" content="0;url=${dest.replace(/&/g, "&amp;")}" />
<title>PillarPath</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#070312;color:#f3efff;font-family:system-ui,sans-serif}</style>
</head>
<body>
  <p>Signing you in…</p>
  <script>try{location.replace(${JSON.stringify(dest)});}catch(e){}</script>
</body>
</html>`;
  return new Response(html, { status: 200, headers });
}

export const Route = createFileRoute("/auth/app-cookie")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        const rawDest = url.searchParams.get("dest") ?? "/";
        const dest =
          rawDest.startsWith("/") && !rawDest.startsWith("//") ? rawDest : "/";
        if (!token) return page("/login?error=sign_in_failed", null);
        try {
          const session = await auth.api.getSession({
            headers: new Headers({ authorization: `Bearer ${token}` }),
          });
          if (!session?.user) return page("/login?error=sign_in_failed", null);
        } catch {
          return page("/login?error=sign_in_failed", null);
        }
        // The token IS the signed session-cookie value (the bearer plugin
        // verifies its signature), so transplant it verbatim. Attributes
        // mirror Better Auth's own session cookie (__Host- rules: Secure,
        // Path=/, no Domain).
        const cookie =
          `${SESSION_TOKEN_COOKIE}=${encodeURIComponent(token)}` +
          `; Path=/; Max-Age=${7 * 24 * 60 * 60}; HttpOnly; Secure; SameSite=Lax`;
        return page(dest, cookie);
      },
    },
  },
});
