# Pillarpath — Android-ready project

This workspace is configured to package the Pillarpath web application as a native Android app using Capacitor.

## Requirements

- Node.js 20+
- npm 10+
- Android Studio (latest stable)
- Android SDK / platform tools
- JDK 21

## First-time setup

From this directory:

```bash
npm install
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli
npx cap add android
```

Then build and sync the web app:

```bash
npm run build
npx cap sync android
```

Open the Android project:

```bash
npx cap open android
```

From Android Studio, select a device and press **Run**.

## Debug APK

After `npx cap add android` and a successful sync:

```bash
cd android
./gradlew assembleDebug
```

The APK will be under:

`android/app/build/outputs/apk/debug/app-debug.apk`

## Release APK / Play Store

Create a signed release key in Android Studio, configure the signing credentials using Gradle's recommended private configuration, then build an Android App Bundle (`.aab`) for Google Play.

Do not commit keystores, passwords, API keys, Stripe secrets, database credentials, or OAuth secrets.

## Product configuration

- App name: **Pillarpath**
- Android package ID: `com.pillarpath.app`
- Dark/black application background
- Web app remains the source of truth for parent and child interfaces
- Payment credentials remain server-side

## Important

The Android folder is intentionally generated with Capacitor on the build machine rather than checked into this source package. This keeps the project portable and avoids shipping machine-specific Gradle artifacts. Running `npx cap add android` creates the native Android project from the configuration in `capacitor.config.ts`.
