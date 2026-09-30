# PillarPath — Production Build Report

**Date:** 2026-09-29
**Source:** `grok-workspace_0_dmxm.zip` (443 files) + RC6 docs + Master Manual

## 1. Extraction

- Extracted `grok-workspace_0_dmxm.zip` → `~/workspace/pillarpath/` ✔
- Extracted `pillarpath-rc6-complete_1_gjcu.zip` (docs only) → `docs-rc6/` ✔
- Stack confirmed: **Vite 8 + TanStack Start (SSR/nitro) + React 19 + Tailwind v4
  + Better Auth + Kysely/Postgres (+ PGLite dev fallback) + Stripe + Capacitor**

## 2. Production hardening checks

| Check | Result |
|---|---|
| `npm install` | ✔ 429 packages, no failures |
| `npm run build` (production) | ✔ built in ~1.5s, nitro/vercel output generated |
| `npm run db:migrate` | ✔ skipped cleanly (no `DATABASE_URL` locally; PGLite fallback covers dev) |
| `npm run typecheck` (`tsc --noEmit`) | ✔ zero errors |
| Hardcoded secrets scan (`src/`, `server/`, `scripts/`) | ✔ none found — keys are env-only, as intended |
| `.env.example` | ⚠ RC6 docs reference `.env.example`, but none exists in this workspace — see next steps |

## 3. APK status

- `@capacitor/core`, `@capacitor/android`, `@capacitor/cli` installed ✔
- `npx cap add android` — native project generated ✔ (`android/`, appId `com.pillarpath.app`)
- `npx cap sync android` with `PILLARPATH_WEB_URL` — verified, URL baked into
  `android/app/src/main/assets/capacitor.config.json` ✔
- **Debug APK could NOT be compiled in this environment** — no JDK / Android SDK /
  Gradle toolchain available here (and `apt` installs are not permitted).
- **Path to APK:** `.github/workflows/android-apk.yml` (new) runs the full
  pipeline on GitHub Actions: `npm ci` → `npm run build` → `cap sync` →
  `./gradlew assembleDebug` → uploads **`PillarPath-beta` artifact
  (`app-debug.apk`)**. Full steps in `BUILD-APK.md`.
- Architecture note: because Pillarpath is server-driven (server functions,
  auth, Postgres, Stripe webhooks), the beta APK is a native shell that loads
  the **deployed production web URL**. This is deliberate — an offline-bundled
  SPA would break auth/data. Web redeploys update the app without reinstalling.

## 4. Issues / gaps found

1. **Teacher Workspace is in the Master Manual but not in the code.** Only one
   incidental "teacher" string exists in `child-views.tsx`. Classrooms, lesson
   builder, assignments, classroom Units, and progress dashboards are not
   implemented — treat as post-beta roadmap (see ideas below).
2. **No `.env.example` in the workspace** (RC6 docs reference one). Production
   deploy needs: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DROPSHIP_API_URL`,
   `DROPSHIP_API_KEY`. Recommend adding `.env.example` before first deploy.
3. **Stripe + dropship are stubbed behind env vars** — commerce flow works end to
   end only after keys are connected; until then fulfillment stays queued.
4. **Legal pages missing** — privacy policy / terms / affiliate disclosure pages
   should exist before real users (esp. children) use it.
5. **Seed data is demo content** ("Alex", 42 units) — fine for beta, must be
   replaced by real onboarding before launch.

## 5. Next steps (in order)

1. ~~Add `.env.example` with the variables above (no real values).~~ **Done** — `.env.example` added (see §8).
2. Deploy web app to Vercel with production env vars; run `db:migrate`.
3. Push repo to GitHub; run the **Android APK (beta)** workflow with the
   production URL; download `app-debug.apk`.
4. Install on test phones (allow unknown apps); beta test Parent + Child + Teacher flows.
5. ~~Add legal pages + affiliate disclosures before any public beta.~~ **Done** — `/privacy`, `/terms`, `/affiliate-disclosure` routes added (see §8).
6. ~~Plan Teacher Workspace implementation (biggest manual-vs-code gap).~~ **Done** — Teacher Workspace MVP built (see §7–8).

## 6. Product improvement ideas (for King's review)

1. **Teacher Workspace MVP** — the manual's biggest promise and the code's
   biggest gap. Start small: class creation + join codes, a lesson/assignment
   builder, and classroom Units kept separate from family Units.
2. **Units ledger parents can actually audit** — a single transaction history
   (chore +25, vault transfer −10, marketplace −15) with filters per child.
   Trust is the product; make money movement transparent.
3. **Parent approval inbox as the home screen** — purchase requests, chore
   submissions, and teacher connection requests in one queue with one-tap
   approve/deny. Beta parents will live here.
4. **Goal wizard for kids** — pick a goal (bike, game), see "you're 60% there,
   3 more chores," with a visual progress ring. Turns abstract saving into a
   game loop.
5. **Savings Vault with lock rules parents control** — time-locked or
   goal-locked vault with a clear "unlocks on" date; teaches delayed
   gratification better than a plain balance.
6. **Marketplace "request vs. buy" guardrails** — child can never check out
   alone (already the design); add price-comparison coaching ("this costs 12
   chores") to reinforce the Unit Market lessons.
7. **Offline-friendly beta mode** — cache the child's dashboard/ledger in the
   WebView so the app opens usefully on flaky connections; sync when online.
8. **Weekly family report** — auto-generated digest for parents (earned, saved,
   spent, lessons completed) plus one conversation prompt. Gives parents a
   reason to open the app every week.

## 7. Feature Audit — Master Manual vs. code (2026-09-29)

Audited Manual sections 9–27 (Teacher Workspace) plus Units ledger (§4),
Savings Vault (§33), Goals (§34), Chores (§35), Marketplace request flow (§37).

| Manual section | Before this build | After |
|---|---|---|
| §9–11 Teacher Workspace / dashboard | ❌ missing (zero "teacher" strings in `src/`) | ✅ MVP: 11-tab workspace (Dashboard, My Classes, Lessons, Assignments, Students, Classroom Units, Progress, Creative Studio, Resources, Messages, Settings) |
| §12 Classroom interface (name, grade, subject, join codes, announcements) | ❌ | ✅ create classroom, 6-letter join codes, roster, announcements |
| §13 Student management (educational profiles only) | ❌ | ✅ per-student progress cards; teachers never see family financial data |
| §14–15 Lesson & assignment builders | ❌ | ✅ builders with objective, instructions, materials, scoring, due date, Unit reward |
| §16 Assignment flow (create→submit→review→feedback→complete→award) | ❌ | ✅ full loop wired teacher↔child |
| §17–18 Classroom Units & rewards (separate from family Units) | ❌ | ✅ separate ledger + balances; privacy-boundary notices in UI |
| §19 10-module Financial Literacy Curriculum | ❌ | ✅ all 10 modules seeded as starter lessons |
| §20–21 Progress dashboards (teacher + student) | ❌ | ✅ per-class + per-student completion views |
| §22–23 Parent↔teacher connection (approve/disconnect/permissions) | ❌ | ✅ join-code request → teacher approve; parent toggles educational/Unit permissions; disconnect anytime |
| §24 Teacher privacy boundaries | ❌ | ✅ enforced by design: teacher store holds only educational data |
| §25 Resource library | ❌ | ✅ 6 seeded resources |
| §26 Classroom challenges | ⚠ partial | ✅ via assignments + classroom Unit rewards (dedicated challenge templates deferred) |
| §27 Teacher Creative Studio assignments | ❌ | ✅ creative-assignment builder + prompt ideas; students submit |
| §4 Units ledger (auditable history) | ⚠ unfiltered list | ✅ filterable (All / Chores / Marketplace / Vault / Awards) |
| §33 Savings Vault (lockable, unlock date) | ⚠ no unlock date shown | ✅ "Unlocks on {date}" + locked-until messaging |
| §34–35 Chores/goals catalog | ⚠ 3 hardcoded chores, not editable | ✅ 67-item seeded catalog across 6 categories; enable/disable, edit, delete, add custom; one-tap parent award; all flow into ledger |
| §36–37 Marketplace request flow | ✅ existed | ✅ unchanged (parent approval inbox already in place) |
| §49–51 Subscriptions / legal / affiliate disclosure | ❌ | ✅ `/privacy`, `/terms`, `/affiliate-disclosure` routes + landing footer links |
| §55–57 Android packaging | ✅ (prior build) | ✅ re-synced after UI changes |

## 8. Feature build — what was added (2026-09-29)

**New files**
- `src/lib/chores.ts` — 67-item chore catalog (Household 21, Kitchen 9, Outdoor 11,
  Responsibility 9, Kindness 9, School & Learning 8; rewards 4–25 Units) +
  12 seeded teacher classroom earning activities.
- `src/store/teacher.ts` — persisted Teacher Workspace store: classrooms (join
  codes), students, lessons (10 seeded curriculum modules), assignments,
  submissions with review flow, classroom-Unit balances + ledger, parent↔teacher
  connections with permissions, messages, resources, earning activities.
- `src/components/kiddo/teacher-views.tsx` — TeacherWorkspace (11 tabs),
  ChildClassroom (child joins via code, does assignments, submits, sees
  classroom Units), ParentTeachers (parent approves/disconnects, manages
  permissions).
- `src/routes/privacy.tsx`, `src/routes/terms.tsx`,
  `src/routes/affiliate-disclosure.tsx` — legal pages; linked in landing footer.
- `.env.example` — all needed vars (DB, auth, Stripe, dropship, Capacitor URL).

**Changed files**
- `src/store/ledger.ts` — `choreCatalog` + `disabledChoreIds` persisted state;
  `addChore` / `updateChore` / `toggleChore` / `removeChore` actions;
  `completeChore` reads the live catalog; `Screen` += `"chores"`, `"classroom"`.
- `src/components/kiddo/child-views.tsx` — "Today's goals" renders the live
  catalog grouped by category with icons (disabled chores hidden).
- `src/components/kiddo/parent-views.tsx` — `ParentChores` management screen
  (filter, add/edit/delete, enable/disable, one-tap Award → ledger); `Chores`
  button on Parent home; `ParentHistory` now filterable; `ParentVault` shows
  the vault unlock date.
- `src/components/kiddo/shell.tsx` — handles the new `"chores"` screen.
- `src/components/pillarpath-app.tsx` — third role **Teacher** in the role
  switcher; teacher nav (11 sections); parent `Teachers` section; child `Class`
  tab; mobile nav + More sheet generalized for three roles.
- `src/components/commerce.tsx` — `ParentSection` += `"teachers"`.
- `android/` — re-synced via `npx cap sync android` after the web build.

**Verification**
- `npm run typecheck` ✔ zero errors
- `npm run build` ✔ production build passes (nitro/vercel output)
- `npx cap sync android` ✔ web assets copied to the native project

**Deliberately stubbed / deferred (with reasons)**
- Classroom challenges (§26) as dedicated templates — covered functionally by
  assignments + Unit rewards; templates can be added without schema changes.
- Server-side persistence for teacher data — currently localStorage/persisted
  zustand like the rest of the demo ledger; moving to Postgres is a backend
  task for post-beta (no schema changes needed in the UI layer).
- Marketplace price-comparison coaching ("costs N chores") and weekly family
  report (ideas #6, #8 from §6) — not started; listed as follow-ups for King.
- Demo seed identity ("Alex", 42 units) retained — must be replaced by real
  onboarding before public launch.

## 9. Social & creator features (2026-09-29)

King approved four new features: classroom leaderboard, Creator Showcase
gallery, Creator Shop (Units-only), and Give (P2P gifting). All four are
built, typechecked, and in the production build.

**New files**
- `src/store/social.ts` — persisted zustand store (`pillarpath-social-v1`):
  leaderboard configs + parent opt-ins; showcase posts (pending/approved/
  removed) with cheers; shop orders; give contacts, give settings
  (per-transfer cap 25 / daily max 50 / approval threshold 15), gift
  records. All state survives reload via localStorage.
- `src/components/kiddo/leaderboard.tsx` — `effortRanking()` helper (ranks
  completed assignments + participation, NEVER Unit balances);
  `TeacherLeaderboard` (per-class on/off, named vs. anonymous mode, ranked
  table); `ChildLeaderboardCard` ("You are #N of M", anonymized peers unless
  teacher enables names); `ParentLeaderboardOptIn` (default OFF).
- `src/components/kiddo/showcase.tsx` — `ChildGallery` (Browse / My
  creations tabs, publish from saved Studio drawings, cheers, sell
  controls); `ParentShowcase` (approve/remove, manage live posts);
  `TeacherShowcase` (approve class submissions, feature standout work);
  `PendingGalleryRows` (parent approval inbox).
- `src/components/kiddo/creator-shop.tsx` — `choresFor()` pricing guidance
  ("≈N chores", avg chore reward ≈ 11 Units); `SellControls` (price +
  family/classroom audience); `ParentCreatorShop` (browse + buy);
  `PendingShopRows` (approve → creator credited, deny).
- `src/components/kiddo/give.tsx` — `ChildGive` (send to approved contacts,
  request new contacts, gift history); `ParentGive` (contact approvals,
  contacts management, giving limits, gift approvals, activity feed with
  7-day reversals); `PendingGiftRows` (approval inbox).

**Changed files**
- `src/store/ledger.ts` — `Screen` += `"gallery"`, `"give"`, `"showcase"`;
  new `debitUnits()` / `creditUnits()` actions (used by gifts + shop sales).
- `src/components/pillarpath-app.tsx` — `ChildWorkspace` renders
  `ChildGallery` / `ChildGive`; parent family-ledger renders `ParentGive` /
  `ParentShowcase`; `useSocial` rehydrated on mount.
- `src/components/kiddo/child-views.tsx` — `ChildHome` buttons: Showcase
  gallery, Give Units.
- `src/components/kiddo/parent-views.tsx` — `ParentHome` Pending inbox now
  aggregates gift approvals, shop orders, and showcase submissions (badge
  counts all); new buttons: Give & contacts, Showcase & shop.
- `src/components/kiddo/teacher-views.tsx` — `TeacherSection` +=
  `"leaderboard"` (12th nav item, Trophy icon); `TeacherWorkspace` renders
  it; Studio section appends `TeacherShowcase`; `ChildClassroom` cards show
  `ChildLeaderboardCard`; `ParentTeachers` appends
  `ParentLeaderboardOptIn`.
- `android/` — re-synced via `npx cap sync android`.

**Key decisions**
- Leaderboard is classroom-scoped only (no global board), teacher opts the
  class in AND parent opts the child in (both default OFF). Effort-ranked;
  Unit balances never appear. Children see "You are #3 of 12" unless the
  teacher enables named mode.
- Showcase uses cheers, not comments — nothing to moderate. Posts need
  parent approval (teacher can also approve class-assignment pieces). Only
  display names shown.
- Shop is Units-only by design: family buys the child's work, the creator
  earns Units, parent approves every sale. No payments, payouts, or
  shipping — the entrepreneurship lesson without legal risk.
- Give adds a 7th pillar (Learn·Earn·Save·Spend·Create·Grow·**Give**).
  Contacts are parent-approved; gifts above the threshold wait for parent
  approval; parents are notified via the activity feed and can reverse
  gifts within 7 days. Classroom Units can never be gifted.

**Verification**
- `npm run typecheck` ✔ zero errors
- `npm run build` ✔ production build passes
- `npx cap sync android` ✔

**Deliberately NOT built (with reasons)**
- Real-money selling, payouts, shipping — legal/compliance surface too big
  for beta; Units-only shop ships the lesson safely. V2 roadmap item.
- Public global leaderboards — rejected on child-safety grounds; classroom-
  scoped + opt-in only.
- Kid-to-kid direct messaging/comments — replaced with cheers (no text =
  no moderation burden).
- Multi-child balances for classroom shop purchases — single-child demo
  ledger; classroom purchases would need per-student family balances
  (backend task).
