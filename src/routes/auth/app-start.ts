import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

/**
 * Native-app OAuth START (production route).
 *
 * The whole OAuth flow must live in ONE cookie jar. If the app WebView
 * starts sign-in with a fetch (the normal client flow), Better Auth sets
 * its state/PKCE cookies in the WebView's jar — but the callback runs in
 * the system browser (Google blocks WebView OAuth), whose jar is empty,
 * so the callback fails its state check. This route is opened directly
 * in the browser tab instead: it starts OAuth server-side and 302s to
 * the provider with the state cookies set in the BROWSER's jar, exactly
 * like the live-preview popup flow. The callback then lands on
 * /auth/app-return, which bridges the session back into the app.
 */

const ALLOWED_PROVIDERS = new Set([
  "google",
  "facebook",
  "apple",
  "tiktok",
  "twitter",
  "instagram",
  "snapchat",
]);

function errorPage(dest: string): Response {
  const deep = `pillarpath://auth?error=${encodeURIComponent("sign_in_failed")}&dest=${encodeURIComponent(dest)}`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PillarPath</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#070312;color:#f3efff;font-family:system-ui,sans-serif;text-align:center;padding:24px}
  a{display:inline-block;margin-top:18px;background:linear-gradient(135deg,#06b6d4,#8b5cf6,#d946ef);color:#fff;font-weight:800;text-decoration:none;padding:14px 22px;border-radius:14px}
  p{color:#cfc6ff;line-height:1.5}
</style>
</head>
<body>
  <div>
    <h2>Sign-in couldn't start</h2>
    <p>Head back to the app and try again.</p>
    <a href="${deep}">Return to PillarPath</a>
  </div>
  <script>try{location.replace(${JSON.stringify(deep)});}catch(e){}</script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/auth/app-start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const provider = url.searchParams.get("provider") ?? "";
        const rawDest = url.searchParams.get("dest") ?? "/";
        const dest =
          rawDest.startsWith("/") && !rawDest.startsWith("//") ? rawDest : "/";
        if (!ALLOWED_PROVIDERS.has(provider)) return errorPage(dest);
        const back = `${url.origin}/auth/app-return?dest=${encodeURIComponent(dest)}`;
        try {
          // Start OAuth server-side so the state/PKCE cookies are set on
          // THIS response — i.e. in the browser tab that will also
          // receive the callback. signInSocial answers with a 302 to the
          // provider, but the TanStack pipeline normalizes handler
          // responses to 200 (cookies pass through; Location would be
          // ignored), so relay the redirect through a meta-refresh page
          // that carries the same Set-Cookie headers.
          const res = await auth.api.signInSocial({
            body: {
              provider: provider as "google",
              callbackURL: back,
              errorCallbackURL: `${back}&error=1`,
            },
            headers: request.headers,
            asResponse: true,
          });
          const loc = res.headers.get("location");
          if (!loc) return errorPage(dest);
          const headers = new Headers({
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
          });
          const cookies =
            typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
          if (cookies.length) {
            for (const c of cookies) headers.append("set-cookie", c);
          } else {
            const single = res.headers.get("set-cookie");
            if (single) headers.append("set-cookie", single);
          }
          const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="refresh" content="0;url=${loc.replace(/&/g, "&amp;")}" />
<title>PillarPath</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#070312;color:#f3efff;font-family:system-ui,sans-serif;text-align:center;padding:24px}a{display:inline-block;margin-top:18px;background:linear-gradient(135deg,#06b6d4,#8b5cf6,#d946ef);color:#fff;font-weight:800;text-decoration:none;padding:14px 22px;border-radius:14px}p{color:#cfc6ff}}</style>
</head>
<body>
  <div>
    <h2>Opening sign-in…</h2>
    <p>One moment.</p>
    <a href="${loc.replace(/&/g, "&amp;")}">Continue to sign in</a>
  </div>
  <script>try{location.replace(${JSON.stringify(loc)});}catch(e){}</script>
</body>
</html>`;
          return new Response(html, { status: 200, headers });
        } catch {
          return errorPage(dest);
        }
      },
    },
  },
});
