import { Capacitor } from "@capacitor/core";
import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { runPreSignInSignOut, runSignOut } from "../../../scripts/sign-out-plan.mjs";
import { GROK_PROVIDERS } from "./providers";
import type { SocialProviderInfo } from "./social-providers-list";

/**
 * Better Auth client for this React SPA (browser-side).
 *
 * Talks to this app's OWN Better Auth at same-origin `/api/auth/*`. In the live
 * preview the app is an embedded iframe with PARTITIONED cookies, so after a
 * popup sign-in it can't read the session cookie — it authenticates with a
 * bearer token instead (captured from the popup, see `signIn`). The `onRequest`
 * hook attaches that token when present; when deployed (cookie auth) no token
 * is stored, so nothing changes.
 *
 * To sign out call `signOut()` below, NOT `authClient.signOut()`: the raw call
 * leaves the bearer token in place, and `onRequest` keeps re-attaching it, so
 * the visitor stays signed in.
 */
export const authClient = createAuthClient({
  plugins: [genericOAuthClient()],
  fetchOptions: {
    onRequest(ctx) {
      const token = getBearerToken();
      if (token) ctx.headers.set("Authorization", `Bearer ${token}`);
      return ctx;
    },
  },
});

/**
 * True when sign-in UI should be shown — i.e. whenever `VITE_AUTH_ENABLED` is
 * not `"false"`. The shipped template sets it to `"false"`
 * (`.grok/app-env.json`), which selects the dev user (see `use-current-user`);
 * with the key removed, sign-in is real in preview (baked preview client) and
 * when deployed (injected per-app client).
 */
export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";

/** The upstream providers to render sign-in buttons for. */
export { GROK_PROVIDERS };

// ── Live-preview bearer token ────────────────────────────────────────────────
// The embedded preview iframe has partitioned cookies, so we keep the session's
// bearer token in sessionStorage and attach it to every Better Auth request (and
// to server functions, via `@/lib/auth/middleware`). Empty everywhere except the
// preview after a popup sign-in, so the cookie path is untouched elsewhere.
const BEARER_KEY = "grok-auth.bearer-token";

/** True inside the native Android/iOS shell (Capacitor WebView). */
export function isNativeShell(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Where the bearer token lives. Preview iframe: sessionStorage (partitioned
 * cookies make it necessary, and it should not outlive the tab). Native
 * shell: localStorage — the session is created in the system browser during
 * OAuth, so the token is the app's ONLY session credential and must survive
 * app restarts, or testers would have to sign in on every cold start.
 */
function bearerStore(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return isNativeShell() ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** The stored bearer token, or null. */
export function getBearerToken(): string | null {
  try {
    return bearerStore()?.getItem(BEARER_KEY) ?? null;
  } catch {
    return null;
  }
}

function setBearerToken(token: string | null): void {
  try {
    const store = bearerStore();
    if (!store) return;
    if (token) store.setItem(BEARER_KEY, token);
    else store.removeItem(BEARER_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}

/**
 * The sandbox live preview runs this app inside an iframe on a `*.grok-sandbox.com`
 * host, where a full-page redirect to the broker can't work — so sign-in uses a
 * popup there and a normal redirect everywhere else.
 */
function inLivePreview(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".grok-sandbox.com")
  );
}

/** Message the popup posts back to the opener once sign-in completes. */
type PopupMessage = { source: "grok-auth-popup"; token: string | null; error?: string };

// ── OAuth in-flight guard ────────────────────────────────────────────────────
// Better Auth keeps ONE last-write-wins `better-auth.state` cookie while its DB
// rows are per-flow. A second initiation — another tab, or an impatient re-tap
// while the first POST is still cold-starting — overwrites the cookie, and the
// first flow then fails its signed-cookie check as `state_mismatch`. Guard
// across tabs with a localStorage marker (sessionStorage is per-tab and would
// be blind to the other tab's initiation).
const OAUTH_INFLIGHT_KEY = "pillarpath.oauth-inflight";
// Matches the state's 5-minute cookie window, plus a margin.
const OAUTH_INFLIGHT_TTL_MS = 6 * 60 * 1000;

function readOAuthInflight(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(OAUTH_INFLIGHT_KEY);
    if (!raw) return null;
    const at = Number(raw);
    if (!Number.isFinite(at)) return null;
    if (Date.now() - at > OAUTH_INFLIGHT_TTL_MS) {
      window.localStorage.removeItem(OAUTH_INFLIGHT_KEY);
      return null;
    }
    return at;
  } catch {
    return null;
  }
}

/**
 * Throws when another tab (or an earlier tap) already started an OAuth flow.
 * Call before initiating; the claim is released by `clearOAuthInflight()` on
 * sign-out and when the login page loads with an `?error=` (a failed attempt
 * must not lock the user out), and expires on its own after the TTL.
 */
function claimOAuthInflight(takeOver = false): void {
  if (readOAuthInflight() !== null && !takeOver) {
    throw new Error(
      "A sign-in is already in progress in another tab — please finish it there, or close the other PillarPath tabs and try once.",
    );
  }
  try {
    window.localStorage.setItem(OAUTH_INFLIGHT_KEY, String(Date.now()));
  } catch {
    /* storage unavailable — proceed without the guard */
  }
}

/** Release the OAuth in-flight claim. */
export function clearOAuthInflight(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(OAUTH_INFLIGHT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Start sign-in with one of PillarPath's OWN direct social providers
 * (Google, Apple, Facebook, TikTok, X, Instagram, Snapchat).
 *
 * - kind "social": Better Auth built-in provider -> full-page redirect to the
 *   upstream, which returns to /api/auth/callback/<id>.
 * - kind "oauth2": custom genericOAuth provider (Instagram, Snapchat) ->
 *   reuses the oauth2 flow below, returning to /api/auth/oauth2/callback/<id>.
 */
export async function signInDirect(
  provider: SocialProviderInfo,
  opts: { callbackURL?: string; errorCallbackURL?: string } = {},
): Promise<void> {
  if (provider.kind === "oauth2") {
    await signIn(provider.id, opts);
    return;
  }
  // Claim the in-flight marker BEFORE the slow pre-signOut round-trip: an
  // impatient second tap (or another tab) while the first POST is still
  // cold-starting would otherwise overwrite the single last-write-wins
  // `better-auth.state` cookie and the first flow dies with state_mismatch.
  // In the native shell there is exactly ONE WebView — no other tab exists
  // — and a leftover claim from an abandoned browser attempt must never
  // lock the user out ("already in progress in another tab" with no tab).
  // The newest attempt takes the claim over; each native attempt starts a
  // fresh server-side flow and whichever completes returns by deep link.
  claimOAuthInflight(isNativeShell());
  const callbackURL = opts.callbackURL ?? "/";
  if (isNativeShell()) {
    // Native shell: Google blocks OAuth inside embedded WebViews (the
    // redirect dies on a "network not available" error page), so the flow
    // runs in the system browser and the finished session bridges back
    // through /auth/app-return → pillarpath://auth deep link. The flow
    // must START in the browser too (/auth/app-start 302s server-side):
    // starting it here with a fetch would set Better Auth's state/PKCE
    // cookies in the WebView's jar, while the callback runs in the
    // browser's jar — split jars, failed state check.
    const { Browser } = await import("@capacitor/browser");
    const start = `${window.location.origin}/auth/app-start?provider=${encodeURIComponent(provider.id)}&dest=${encodeURIComponent(callbackURL)}`;
    try {
      const handle = await Browser.addListener("browserFinished", () => {
        // Tab closed without a completed deep-link sign-in → release the
        // in-flight guard so an immediate retry isn't blocked.
        if (!getBearerToken()) clearOAuthInflight();
        void handle.remove();
      });
    } catch {
      /* listener unsupported — the guard expires on its own TTL */
    }
    await Browser.open({ url: start });
    return;
  }
  await authClient.signOut().catch(() => {});
  const { error } = await authClient.signIn.social({
    provider: provider.id,
    callbackURL,
    errorCallbackURL: opts.errorCallbackURL ?? "/login",
  });
  if (error) throw new Error(error.message ?? "Sign-in failed");
}

let appLinkHandled = "";
/**
 * Complete a native sign-in from the `pillarpath://auth?...` deep link the
 * /auth/app-return bridge sends back. Stores the session token as the
 * app's bearer credential, refreshes the session, and navigates to the
 * destination the user originally wanted. Returns false for URLs that
 * aren't ours.
 */
export async function completeAppAuthDeepLink(rawUrl: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return false;
  }
  if (u.protocol !== "pillarpath:" || u.host !== "auth") return false;
  if (appLinkHandled === rawUrl) return true; // launch-url + event double-fire
  appLinkHandled = rawUrl;
  clearOAuthInflight();
  const rawDest = u.searchParams.get("dest") ?? "/";
  const dest = rawDest.startsWith("/") && !rawDest.startsWith("//") ? rawDest : "/";
  const token = u.searchParams.get("token");
  if (!token) {
    window.location.href = `/login?error=${encodeURIComponent(u.searchParams.get("error") ?? "sign_in_failed")}`;
    return true;
  }
  setBearerToken(token);
  try {
    await authClient.getSession();
  } catch {
    /* session store will recover on next fetch */
  }
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.close();
  } catch {
    /* custom tab already closed */
  }
  // Transplant the session into the WebView's cookie jar (server
  // functions resolve sessions from cookies): /auth/app-cookie
  // validates the token and sets the real session cookie, then lands
  // on dest.
  window.location.href = `/auth/app-cookie?token=${encodeURIComponent(token)}&dest=${encodeURIComponent(dest)}`;
  return true;
}

/**
 * Start sign-in with one upstream provider (`providerId` from `GROK_PROVIDERS`),
 * federating through the Grok auth broker.
 *
 * - **Live preview** (`*.grok-sandbox.com` iframe): opens a POPUP to
 *   `/auth/popup`, served by the template Vite plugin (see `vite.config.ts` +
 *   `popup.server.ts`) — 302s to the broker/upstream login (no app chrome) and,
 *   on return, posts the session bearer token back. We store it and refresh the
 *   session; no top-level navigation of the iframe to the broker.
 * - **Deployed** (and local non-iframe): a normal full-page redirect into the broker.
 *
 * Either way it clears any existing local session FIRST so switching providers
 * actually switches identity.
 */
export async function signIn(
  providerId: string,
  opts: { callbackURL?: string; errorCallbackURL?: string } = {},
): Promise<void> {
  const callbackURL = opts.callbackURL ?? "/";
  const errorCallbackURL = opts.errorCallbackURL ?? "/login";

  // Guard first (synchronous): a second OAuth initiation would overwrite the
  // single last-write-wins state cookie and kill the first flow.
  claimOAuthInflight();

  // Open the popup SYNCHRONOUSLY on the user gesture — before any await
  // (including signOut). Awaiting first drops user-gesture privilege in some
  // browsers when the opener is a cross-origin live-preview iframe.
  const popup = inLivePreview() ? openSignInPopup(providerId) : null;

  // Clear any prior session so switching providers actually switches identity.
  // Bounded because the popup is already open — a request that never settles
  // would leave it hanging — but bounded PER ENVIRONMENT: only the server can
  // end a deployed session, so cutting it short at the preview's 1.5s would
  // start OAuth with the old session still live.
  await runPreSignInSignOut({
    livePreview: inLivePreview(),
    hasBearer: Boolean(getBearerToken()),
    requestSignOut: () => authClient.signOut(),
    clearToken: () => setBearerToken(null),
  });

  if (inLivePreview()) {
    if (!popup) throw new Error("Pop-up blocked — allow pop-ups for sign-in");
    const token = await waitForPopupToken(popup);
    if (!token) throw new Error("Sign-in was cancelled or failed");
    setBearerToken(token);
    // Refresh the client session store with the bearer attached (onRequest).
    // Avoid a full iframe reload when we're already on the destination — that
    // reload was the slow "still loading after the popup closed" feeling.
    try {
      await authClient.getSession();
    } catch {
      /* session store will recover on next useSession fetch */
    }
    if (typeof window !== "undefined") {
      const dest = new URL(callbackURL, window.location.origin);
      const here = window.location;
      if (dest.origin !== here.origin || dest.pathname !== here.pathname || dest.search !== here.search) {
        window.location.href = callbackURL;
      }
    }
    return;
  }

  const { data, error } = await authClient.signIn.oauth2({
    providerId,
    callbackURL,
    errorCallbackURL,
  });
  if (error) throw new Error(error.message ?? "Sign-in failed");
  if (data?.url) window.location.href = data.url;
}

/**
 * Open `/auth/popup` in a new window. Must run synchronously inside the click
 * handler (no await before this). The path is served by the template Vite
 * plugin (`authPopupPlugin` in vite.config.ts) — NOT by a React route.
 *
 * Opens the real URL directly (not about:blank → assign). From a cross-origin
 * iframe the about:blank dance often fails on the first click and the window
 * ends up showing the app shell.
 */
function openSignInPopup(providerId: string): Window | null {
  const origin = window.location.origin;
  const url = `${origin}/auth/popup?providerId=${encodeURIComponent(providerId)}`;
  // Unique name per attempt so a prior attempt stuck on the SPA is not reused.
  const name = `grok-signin-${Date.now()}`;
  return window.open(url, name, "popup,width=500,height=650");
}

/**
 * Wait for the popup's completion page to postMessage the session bearer (or
 * for the user to dismiss the popup).
 */
function waitForPopupToken(popup: Window): Promise<string | null> {
  return new Promise((resolve) => {
    const origin = window.location.origin;
    let settled = false;
    let closeTimer: number | undefined;
    const settle = (token: string | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(token);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const data = event.data as PopupMessage | undefined;
      if (!data || data.source !== "grok-auth-popup") return;
      settle(data.token ?? null);
    };
    // Fallback when the user dismisses the popup. Grace period lets the
    // completion page's postMessage win over a racing `popup.closed`.
    const pollTimer = window.setInterval(() => {
      if (!popup.closed) return;
      window.clearInterval(pollTimer);
      closeTimer = window.setTimeout(() => settle(null), 400);
    }, 300);
    function cleanup() {
      window.clearInterval(pollTimer);
      if (closeTimer !== undefined) window.clearTimeout(closeTimer);
      window.removeEventListener("message", onMessage);
    }
    window.addEventListener("message", onMessage);
  });
}

/**
 * Sign out of THIS app's local session, clear the preview token, then redirect.
 *
 * Use this, never `authClient.signOut()` — see the note on `authClient`.
 * Sequencing lives in `scripts/sign-out-plan.mjs` so it can be unit-tested.
 *
 * **Rejects when deployed if the server never confirms.** There the session is
 * an HttpOnly cookie only the server can clear, so redirecting anyway would
 * report a sign-out that did not happen. `<UserButton />` handles that for you;
 * a hand-rolled control must catch it and let the visitor retry. In the live
 * preview the local clear is sufficient, so it always resolves.
 */
export async function signOut(redirectTo = "/"): Promise<void> {
  clearOAuthInflight();
  await runSignOut({
    livePreview: inLivePreview(),
    hasBearer: Boolean(getBearerToken()),
    // Better Auth resolves with `{ error }` instead of rejecting, so surface a
    // failed response as a rejection for the sequence to act on.
    requestSignOut: async () => {
      const { error } = await authClient.signOut();
      if (error) throw new Error(error.message ?? "Sign-out failed");
    },
    clearToken: () => setBearerToken(null),
    redirect: () => {
      window.location.href = redirectTo;
    },
  });
}
