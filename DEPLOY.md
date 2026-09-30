# PillarPath — Deploy Guide (GitHub + Vercel + Beta APK)

The project is committed locally (`git log` shows the production commit) and the
production build passes. These are the remaining steps.

## 1. Push to GitHub

```bash
cd ~/workspace/pillarpath

# Create the repo on github.com (or: gh repo create pillarpath --private --source=. --push)
git remote add origin git@github.com:YOUR_USERNAME/pillarpath.git
git push -u origin main
```

Notes:
- `.gitignore` excludes `node_modules/`, `dist/`, `.vercel/`, Android build
  artifacts (`android/build/`, `android/.gradle/`), logs, and **all `.env`
  files**. Only `.env.example` is tracked.
- Android native **source** (`android/app/src`, `AndroidManifest.xml`), 
  `capacitor.config.ts`, and `.github/workflows/` ARE committed.

## 2. Connect Vercel to the repo

1. Open the Vercel connect page and authorize the Vercel integration:
   https://agent.meta.ai/connectors/connect/vercel
2. In the Vercel dashboard: **Add New → Project → Import** the `pillarpath`
   GitHub repo.
3. Framework preset: it auto-detects (TanStack Start / Nitro output). No custom
   build command needed — `npm run build` works out of the box.
4. Deploy. Your production URL will be like `https://pillarpath.vercel.app`.

## 3. Required environment variables (Vercel → Project → Settings → Environment Variables)

From `.env.example` — set these in Vercel (Production environment):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string (e.g. Neon/Supabase). Without it, the app falls back to PGLite (demo mode, no persistence). |
| `BETTER_AUTH_SECRET` | Yes | Long random string for session signing. |
| `BETTER_AUTH_URL` | Yes | Your production URL, e.g. `https://pillarpath.vercel.app`. |
| `STRIPE_SECRET_KEY` | For payments | `sk_live_...` when you enable real billing. |
| `STRIPE_WEBHOOK_SECRET` | For payments | `whsec_...` from the Stripe webhook endpoint. |
| `STRIPE_PRICE_CORE` | Optional | Price ID for Core plan ($4.99/mo). |
| `STRIPE_PRICE_FAMILY` | Optional | Price ID for Family plan ($7.99/mo). |
| `STRIPE_PRICE_STUDIO_PLUS` | Optional | Price ID for Creative Studio Plus ($4.99). |
| `PRINTFUL_API_KEY` | Optional | Dropshipping fulfillment. |
| `PRINTIFY_API_TOKEN` | Optional | Dropshipping fulfillment. |
| `SPOCKET_API_KEY` | Optional | Dropshipping fulfillment. |
| `VITE_AUTH_ENABLED` | Yes | Set to `true` (client-side flag, safe to expose). |

After adding env vars, **redeploy** so the serverless functions pick them up.

`PILLARPATH_WEB_URL` is NOT a Vercel env var — it's only used when syncing the
Android shell (see below).

## 4. Build the beta APK (GitHub Actions)

The workflow `.github/workflows/android-apk.yml` builds the APK — no local
Android SDK needed.

1. Go to the repo on GitHub → **Actions** → **Android APK (beta)** →
   **Run workflow**.
2. Enter `web_url`: your production Vercel URL
   (e.g. `https://pillarpath.vercel.app`). The APK is a native Capacitor shell
   that loads this URL, so auth, the database, and payments keep working inside
   the app.
3. When the run finishes, download the **`PillarPath-beta`** artifact
   (`app-debug.apk`, kept 30 days).
4. Install on the Android phone (allow "install unknown apps" once), then open
   and sign in.

Every web redeploy updates the app inside the installed APK automatically — no
reinstall needed unless the native shell itself changes.

## 5. Pre-launch checklist

- [ ] Real Postgres `DATABASE_URL` set (not PGLite)
- [ ] `BETTER_AUTH_SECRET` + `BETTER_AUTH_URL` set
- [ ] Privacy / Terms / Affiliate Disclosure pages reviewed (`/privacy`, `/terms`, `/affiliate-disclosure`)
- [ ] Demo seed data ("Alex", 42 Units) replaced by real onboarding
- [ ] Stripe keys switched to live when billing goes live
