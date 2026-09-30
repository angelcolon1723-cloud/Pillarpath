# PillarPath — Beta APK Build Guide

This repo produces an installable Android APK for beta testing via **GitHub Actions**
(the same pipeline described in the Master Manual: repo → Actions → APK → device).

## Why this approach

Pillarpath is a server-driven app: TanStack Start server functions, Better Auth,
Postgres, and Stripe webhooks. A phone can't run that backend locally, so the
beta APK is a **native Capacitor shell that loads your deployed production web
app**. Auth, the database, and payments keep working inside the app exactly as
on the web.

## Prerequisites

1. **Deploy the web app** (Vercel recommended):
   ```bash
   vercel deploy --prod
   ```
   Set the production env vars first: `DATABASE_URL`, `BETTER_AUTH_SECRET`,
   `BETTER_AUTH_URL` (= your public URL), `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET` (optional for beta), `DROPSHIP_API_URL` /
   `DROPSHIP_API_KEY` (optional).
   Run `npm run db:migrate` with `DATABASE_URL` set, or let the deploy do it
   (`npm run build` runs migrations automatically when `DATABASE_URL` is set).
2. **Push this repo to GitHub** (the `.github/workflows/android-apk.yml`
   workflow is already included).

## Build the APK

1. Open your repo on GitHub → **Actions** → **Android APK (beta)** → **Run workflow**.
2. Enter the **production web app URL** when prompted
   (e.g. `https://pillarpath.vercel.app`). This URL is baked into the APK —
   the app will load it on launch.
3. Wait ~5–8 minutes. Download the **`PillarPath-beta`** artifact when it finishes.
4. The artifact contains `app-debug.apk`.

## Install on your phone

1. Copy `app-debug.apk` to your Android phone (Drive, email, USB — any way).
2. Open it on the phone and allow **"Install unknown apps"** when prompted.
3. This is a **debug-signed** build — perfect for beta testing, not for the
   Play Store. For Play Store release you need a release keystore and an
   `.aab` (see ANDROID_BUILD.md).

## Local iteration (no APK rebuild needed)

Because the APK loads the live web URL, most changes only require redeploying
the web app — testers get the update instantly without reinstalling. Rebuild the
APK only when the native shell itself changes (app id, icons, splash, plugins).

## Files

| File | Purpose |
|---|---|
| `capacitor.config.ts` | App id `com.pillarpath.app`; reads `PILLARPATH_WEB_URL` at sync time |
| `android/` | Generated native project (`npx cap add android`) — committed for CI |
| `.github/workflows/android-apk.yml` | CI: install → build web → cap sync → Gradle `assembleDebug` → upload APK |
| `dist/index.html` | Fallback page if an APK is ever built without a web URL |
| `ANDROID_BUILD.md` | Full Android Studio / release-signing reference |
