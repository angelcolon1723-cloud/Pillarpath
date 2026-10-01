import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Pillarpath Android packaging.
 *
 * Pillarpath is a server-driven app (TanStack Start server functions, Better
 * Auth, Postgres/Stripe webhooks). The beta APK is a native shell that loads
 * the deployed production web app, so auth, the database, and payments keep
 * working inside the app.
 *
 * Build the APK with the production URL baked in:
 *
 *   PILLARPATH_WEB_URL=https://your-app.vercel.app npx cap sync android
 *
 * When PILLARPATH_WEB_URL is not set, Capacitor falls back to the bundled
 * webDir (local static files) — useful only for UI smoke tests, not for
 * real beta use, because server functions need the backend.
 */
const webUrl = process.env.PILLARPATH_WEB_URL;

const config: CapacitorConfig = {
  appId: 'com.pillarpath.app',
  appName: 'Pillarpath',
  webDir: 'dist',
  bundledWebRuntime: false,
  ...(webUrl
    ? {
        server: {
          url: webUrl,
          androidScheme: 'https',
          cleartext: false,
        },
      }
    : {
        server: {
          androidScheme: 'https',
          cleartext: false,
        },
      }),
  android: {
    // Deep-space brand color (matches the web app's cosmic theme) so the
    // WebView never flashes pure black while the site loads.
    backgroundColor: '#060614',
  },
};

export default config;
