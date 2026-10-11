# PillarPath — Tester Share Kit
Prepared 2026-10-08 for King, following the Plaza Live build (deploy `5eb8362`). Updated 2026-10-09: latest public-test APK is `pillarpath-public-test.apk`, GitHub Actions run `37858441546` (commit `be3206a`, carrying the splash fix, all Plaza work, kid pass, Printify routing, and the native Google sign-in fix) — this is the build King installed and confirmed working on his A25 on 2026-10-08. The plaza UI was decluttered in deploy `2351d4a` (web-only — testers opening the live app get it automatically, no reinstall). The 2026-10-09 login fix (deploy `2742828`) is also web-side, so testers on the existing APK get it automatically: email+password sign-in can no longer dead-end on an undeliverable email code (see §4).

## 1. Copy-paste message King can send a tester (nothing else around it)

Hey — can you test my app PillarPath? It's a kids' financial-literacy app I'm building.

Install: I'm sending you the app file — tap it to install (your phone may ask you to allow installs from this source, that's normal). Or just open pillarpath.vercel.app in Chrome and tap ⋮ → "Add to Home screen".

Sign in with Google, or with email + password — both work now. One heads-up if you use email + password: the app may show a "Check your email / Enter your code" screen. If no code arrives within a minute, don't keep retrying — the app clears that step itself and signs you in with a notice. That's expected for now, not a bug.

Then set it up like a parent: add a kid profile, then open the Plaza game and walk around a bit (tap the glowing ☰ Menu button at the bottom, then "Go Live"). After that, sign out and back in once so we know sign-in sticks.

Tell me: 1) Did the opening screen look right in the first 2 seconds? 2) Did everything you tapped actually work? 3) Send a screenshot of the WHOLE screen if anything looks broken or confusing — if there's a small "Detail:" line on an error screen, that line is the important part. Thanks!

## 2. The friend-flow test (needs King + one other family account)

1. Tester signs up as their own family ("Family B") with a *different* account (Google or email+password) and adds a kid.
2. King (master/admin account, parent dashboard → "Plaza friends & Live") creates a friend code for his kid.
3. Family B enters the code for their kid.
4. King approves the request in his dashboard — both parents must say yes, or nothing connects.
5. Both kids open the Plaza, tap the glowing ☰ Menu button, then 🔴 Go Live — they should see each other walk in real time, and can Wave / "Great job!" / "Follow me!" / "Help me!" (preset phrases only, no free chat; the emotes live in the same Menu).
6. Bonus check: do a good deed standing beside the live friend — it should count double toward the Crew Quest.

Family-only Live can be tested without a second family: open the Plaza on two devices signed into the same family account, both Go Live.

## 3. King's own quick checklist on the new APK (his A25)

- [ ] Force-stop the app first, then cold-launch — watch the first 2 seconds for the black-launch-screen fix in this build.
- [ ] Parent Dashboard quick actions: Load Units, Approve, Give (the buttons fixed in commit `355672f`) — tap each one.
- [ ] Sign out and look at the app as a normal/public account — confirm no Society Network / admin entry appears. Admin is by account, not a separate app.
- [ ] Plaza declutter (deploy `2351d4a`, web-only): plaza opens clean with one glowing ☰ Menu button; Go Live / emotes / Codex / Crew are inside it and the menu tucks away by itself.

## 4. Known limits to tell testers up front (so feedback stays useful)

- Sign-in: Google is unaffected by the email issue. Email + password sign-in works too — proven end-to-end by King's brother on 2026-10-09 after the OTP fix (deploy `2742828`): if the 4-digit code email can't be delivered (until the pillarpath.app sending domain is verified in Resend, codes only truly deliver to King's Gmail), the app lifts the code lock itself and signs the person in with a visible notice. No tester can be trapped behind a code that isn't coming again. Do NOT tell testers "Google only" — that instruction is retired.
- Internal note (not for testers): the permanent fix is the pillarpath.app domain purchase already in motion at Porkbun; after purchase, Resend domain verification makes code emails deliver to everyone, and the proof test is a non-Gmail email+password login actually receiving its code.
- Live works where the family account is signed in. A kid's own device can now connect with a Kid Pass: King creates one per kid in his dashboard (Plaza friends & Live → device pass), the kid enters it once in the plaza (🔑 Kid pass) — crew, cloud saves and Live then work on that device too. The pass is plaza-only and revocable anytime.
- Shared-screen dilemma voting isn't built; team-up double-helps are the co-op mechanic today.

## 5. What to ask back from every tester

Device model, what they tapped, what happened vs. what they expected, and a screenshot/screen recording if it failed. That is the format that has actually diagnosed King's past issues (e.g. the dashboard buttons were re-identified from his screen recording).

## 6. Tester status (2026-10-09)

- King's brother — IN (confirmed by WhatsApp 2026-10-09 1:02 PM EDT, "Okay I'm in"). He was given the follow-up steps King forwarded the same day: set up as a parent, add a kid profile, walk the Plaza, sign out and back in once, report anything broken or confusing. His results on those steps are still pending — and once his parent setup exists, he is the parent side ready for the classroom messaging-loop test (King as teacher creates a classroom and shares the join code; brother joins as parent, King approves, brother messages first).
- Kathy — proposed by King's brother as a second tester; King approved (👍). Her test is optional for diagnosis now that the sign-in root cause is fixed, but she is still a useful fresh-device test. Send her the §1 message exactly as written — it already contains the code-screen heads-up that would have saved the brother's lost evening.
