# PillarPath — Tester Share Kit
Prepared 2026-10-08 for King, following the Plaza Live build (deploy `5eb8362`) and the fresh public-test APK (`pillarpath-public-test.apk`, GitHub Actions run `37829866943`, Live-build commit `5eb8362`).

## 1. Copy-paste message King can send a tester (nothing else around it)

Hey — can you test my app PillarPath? It's a kids' financial-literacy app I'm building.

Install: I'm sending you the app file — tap it to install (your phone may ask you to allow installs from this source, that's normal). Or just open pillarpath.vercel.app in Chrome and tap ⋮ → "Add to Home screen".

Sign up with Google (use that button — it's the smoothest right now), add your kid, then try the Plaza game and tap the red "Go Live" button.

Tell me: 1) Did the opening screen look right in the first 2 seconds? 2) Did everything you tapped actually work? 3) Send a screenshot if anything looks broken. Thanks!

## 2. The friend-flow test (needs King + one other family account)

1. Tester signs up as their own family ("Family B") with a *different* Google account and adds a kid.
2. King (master/admin account, parent dashboard → "Plaza friends & Live") creates a friend code for his kid.
3. Family B enters the code for their kid.
4. King approves the request in his dashboard — both parents must say yes, or nothing connects.
5. Both kids open the Plaza, tap 🔴 Go Live — they should see each other walk in real time, and can Wave / "Great job!" / "Follow me!" / "Help me!" (preset phrases only, no free chat).
6. Bonus check: do a good deed standing beside the live friend — it should count double toward the Crew Quest.

Family-only Live can be tested without a second family: open the Plaza on two devices signed into the same family account, both Go Live.

## 3. King's own quick checklist on the new APK (his A25)

- [ ] Force-stop the app first, then cold-launch — watch the first 2 seconds for the black-launch-screen fix in this build.
- [ ] Parent Dashboard quick actions: Load Units, Approve, Give (the buttons fixed in commit `355672f`) — tap each one.
- [ ] Sign out and look at the app as a normal/public account — confirm no Society Network / admin entry appears. Admin is by account, not a separate app.

## 4. Known limits to tell testers up front (so feedback stays useful)

- Email-code signup is still limited by the Resend sandbox — steer every tester to Google sign-in.
- Live works where the family account is signed in. A kid's own device can now connect with a Kid Pass: King creates one per kid in his dashboard (Plaza friends & Live → device pass), the kid enters it once in the plaza (🔑 Kid pass) — crew, cloud saves and Live then work on that device too. The pass is plaza-only and revocable anytime.
- Shared-screen dilemma voting isn't built; team-up double-helps are the co-op mechanic today.

## 5. What to ask back from every tester

Device model, what they tapped, what happened vs. what they expected, and a screenshot/screen recording if it failed. That is the format that has actually diagnosed King's past issues (e.g. the dashboard buttons were re-identified from his screen recording).
