import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth/provider";
import { completeAppAuthDeepLink, isNativeShell } from "@/lib/auth/client";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "Pillarpath";

/**
 * Dismisses the native launch splash once the web app has painted.
 * The native shell is configured with launchAutoHide: false so the branded
 * splash stays up through the whole load — no black gap.
 */
function HideNativeSplash() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    import("@capacitor/splash-screen")
      .then(({ SplashScreen }) => {
        if (!cancelled) SplashScreen.hide().catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}

/**
 * Native shell only: listen for the `pillarpath://auth` deep link that
 * returns a completed browser OAuth sign-in to the app (Google blocks
 * OAuth inside the WebView itself). Handles both warm opens (appUrlOpen)
 * and cold starts (getLaunchUrl).
 */
function NativeAuthDeepLinks() {
  useEffect(() => {
    if (!isNativeShell()) return;
    let cancelled = false;
    let remove: (() => void) | undefined;
    (async () => {
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("appUrlOpen", (e) => {
        void completeAppAuthDeepLink(e.url);
      });
      if (cancelled) {
        void handle.remove();
        return;
      }
      remove = () => {
        void handle.remove();
      };
      const launch = await App.getLaunchUrl().catch(() => null);
      if (launch?.url) void completeAppAuthDeepLink(launch.url);
    })().catch(() => {});
    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);
  return null;
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: APP_NAME },
      { name: "theme-color", content: "#070312" },
      {
        name: "description",
        content:
          "A parent-controlled family finance and commerce app where kids earn, spend, and save Pillar Units.",
      },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preload", href: "/splash-launch.mp4", as: "video", type: "video/mp4" },
      { rel: "preload", href: "/splash-kids.mp4", as: "video", type: "video/mp4" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@500&family=Orbitron:wght@600;700;800&family=Outfit:wght@400;500;600&family=Baloo+2:wght@600;700;800&family=Caveat:wght@500;600;700&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-ink">
        <PreviewHostBridge />
        <HideNativeSplash />
        <NativeAuthDeepLinks />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Toaster
          position="bottom-center"
          theme="dark"
          offset={96}
          toastOptions={{
            className:
              "!bg-ink !text-bg !border-0 !shadow-[var(--shadow-border)] !rounded-lg !font-sans",
          }}
        />
        <Scripts />
      </body>
    </html>
  ),
});
