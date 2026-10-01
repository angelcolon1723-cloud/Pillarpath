# Four-Sided Accounts — Implementation Plan

**Status:** PLAN ONLY — no code written. Target: separate, server-enforced
accounts for **parent**, **child**, **teacher**, and **admin**
(PillarPath Society Network corporate side), each seeing only its own data.

**Authored:** 2026-10-01, from a full read of the codebase (not from memory).

---

## 1. What exists today (inventory)

### 1.1 Auth (Better Auth, self-hosted at `/api/auth/*`)

| Item | Location | Notes |
|---|---|---|
| Server config | `src/lib/auth/server.ts` | betterAuth instance; cookie `__Host-grok-auth.session_token`; session cookieCache (5 min); bearer-token plugin for the live-preview iframe |
| API route | `src/routes/api/auth/$.ts` | serves all Better Auth endpoints |
| Client | `src/lib/auth/client.ts` | `authClient`, `signInDirect`, `signIn`, `signOut` |
| Session → client | `src/lib/auth/use-current-user.ts` | `useCurrentUserState()` → `{ id, displayName, primaryEmail, profileImageUrl }`. **No role field.** |
| Session → server | `src/lib/auth/verify.server.ts` | `requireUserId()` / `getSessionUser()` — resolves the user id from the session cookie, never from client input |
| Server-fn guard | `src/lib/auth/middleware.ts` | `authMiddleware` → `context.userId` (verified). Also asserts same-site requests. |
| Client gates | `src/lib/auth/gates.tsx` | `SignedIn`, `SignedOut`, `RedirectToSignIn` (→ `/login`) |
| Providers wired | `src/lib/auth/direct-providers.server.ts` | Google, Apple, Facebook, TikTok, X (Better Auth built-ins) + Instagram, Snapchat (genericOAuth). Each is **env-gated** — button appears only when its `*_CLIENT_ID`/`*_CLIENT_SECRET` are set. Google verified live 2026-09-30. |
| Email/password | `src/lib/auth/email-password.ts` | `emailAndPasswordEnabled = true` |
| Login UI | `src/routes/login.tsx` | sign-in/sign-up, social buttons, email/password. **No role selection at signup.** |
| App entry guard | `src/routes/index.tsx` | `SignedOut` → landing, `SignedIn` → `<PillarpathApp />` |
| Migrations | `migrations/auth/0001_auth.sql` | Better Auth tables `"user"`, `"session"`, `"account"`, `"verification"`. **The `"user"` table has NO role column.** |

### 1.2 Database

- Migration runner: `migrations/*.sql` applied by filename via `_migrations`
  table at Vercel build time and into the PGLite fallback. **New files only
  (`0005_*.sql` …); never edit applied files.**
- DB access: `getSql()` in `src/lib/db.ts` (Neon when `DATABASE_URL` is set,
  else PGLite).
- Server-side tables already keyed by user (all queries in
  `src/lib/pillarpath-server.ts` are scoped `where user_id = ${context.userId}`):
  `profiles(user_id PK)`, `children(id, user_id → parent, name, age, avatar,
  units, vault_units, frozen)`, `carts`, `cart_items`, `orders`, `order_items`,
  `fulfillments`, `marketing_campaigns`, `promo_codes`, `referrals`,
  `future_unit_plans`, `studio_projects`, `learning_progress`,
  `supplier_products`, `supplier_orders`.
- ⚠️ **Dual data systems:** the rich app state (chores, family Units, vault,
  drawings, missions, **teacher classrooms/lessons/students/threads**) lives
  in **client-side Zustand persisted to localStorage** (`kiddo-ledger-v2`,
  `pillarpath-teacher-v1`). The server tables are a thinner parallel layer
  (commerce + a `children` units mirror + studio project saves). Phase 3 must
  reconcile these — see §4.3.

### 1.3 The client-side `role` — every trust boundary that must move server-side

| # | Location | What it does today |
|---|---|---|
| 1 | `src/components/pillarpath-app.tsx:104-110` | **Local `role` state `"parent" \| "child" \| "teacher"`, default `"parent"`. A top-nav picker lets ANY signed-in user open ALL THREE workspaces.** This is the single biggest trust hole. |
| 2 | `src/components/pillarpath-app.tsx:197` | `setLedgerRole(next === "teacher" ? "parent" : next)` — maps the app role into the ledger store |
| 3 | `src/components/kiddo/shell.tsx:26-52` | `RoleSwitch` — "Demo as" Parent/Child tabs, one tap to switch |
| 4 | `src/store/ledger.ts:7` | `Role = "parent" \| "child"` — client-only; `setRole` only checks a client-side `consent` flag |
| 5 | `src/components/kiddo/studio.tsx:140,181` | role → child-vs-parent studio entry (missions gating) |
| 6 | `src/components/kiddo/studio-pro.tsx:1061` | **Studio Pro parent unlock gate reads client `role`** — any child can flip localStorage to "parent" and unlock it |
| 7 | `src/components/kiddo/teacher-views.tsx` | Teacher workspace renders on picker selection; **classroom rosters, threads, and records are localStorage** readable by anyone on the device |
| 8 | `src/lib/pillarpath-server.ts` (all fns) | Server functions check `userId` but **never role** — any signed-in account can call `createChild`, `createFutureUnitPlan`, `createCampaign`, `saveStudioProject`, etc. |

**Net:** today there is exactly ONE account type (a signed-in user), and "role"
is a client-side view toggle. Server enforcement of roles = the entire job.

### 1.4 Existing API routes and their auth posture

| Route | Auth |
|---|---|
| `src/routes/api/auth/$.ts` | Better Auth (correct) |
| `src/routes/api/webhooks/stripe.ts` | HMAC signature check, no session (correct for webhooks) |
| `src/routes/api/webhooks/dropship.ts` | HMAC signature check, no session (correct for webhooks) |
| All `createServerFn` in `src/lib/pillarpath-server.ts` | `authMiddleware` (userId) — **no role checks** |

---

## 2. Target data model

```
"user"  (Better Auth — add role via additionalFields)
  id, name, email, …,
  role: 'parent' | 'teacher' | 'admin'        -- NEVER 'child'; children are not users
  role_verified_at, teacher_status            -- teacher verification state

child_profiles  (extends existing `children` table)
  id, parent_user_id → "user"(id), name, age, avatar,
  pin_hash (bcrypt), pin_attempts, pin_locked_until,
  units, vault_units, frozen, …

kid_sessions
  token_hash PK, child_profile_id, parent_user_id, expires_at, created_at
  -- short-lived server sessions for PIN logins (see §4.2)

classrooms
  id, teacher_user_id → "user"(id), name, grade_level, subject, join_code (unique)

classroom_enrollments
  classroom_id, child_profile_id, joined_at
  -- a student row links a CHILD PROFILE (not a user) to a classroom

teacher_verifications
  user_id PK, status ('pending'|'approved'|'rejected'), school_email,
  evidence_url, reviewed_by, reviewed_at

admin_invites
  token_hash PK, email, created_by, expires_at, accepted_at

admin_audit_log
  id, admin_user_id, action, target, meta, created_at
```

Effective identity resolved server-side on every request:

```ts
type Identity =
  | { kind: "parent";  userId: string }
  | { kind: "child";   userId: string; childId: number }   // userId = parent
  | { kind: "teacher"; userId: string }
  | { kind: "admin";   userId: string };
```

---

## 3. Phased plan

### Phase 1 — Schema + auth roles + session (the foundation)

**Goal:** the server knows every account's role; no role value ever comes from
the client.

**New migration — `migrations/0005_account_roles.sql`:**

- `alter table "user" add column role text not null default 'parent'
  check (role in ('parent','teacher','admin'))` — quoted camelCase `"user"`
  table per the Better Auth convention in `0001_auth.sql`; new column can be
  snake_case (`role`) or camelCase (`"role"`); pick one and stay consistent.
- `alter table "user" add column teacher_status text not null default
  'unverified' check (teacher_status in
  ('unverified','pending','approved','rejected'))`
- `alter table "user" add column role_set_at timestamptz`
- `create table teacher_verifications (…)`, `create table admin_invites (…)`,
  `create table admin_audit_log (…)` (shapes per §2).
- Backfill: `update "user" set role = 'parent' where role is null` (covered by
  the default; explicit for clarity).

**Files to create/modify:**

| File | Change |
|---|---|
| `src/lib/auth/server.ts` | Add `user: { additionalFields: { role: { type: "string", required: false, input: false } } }` so Better Auth reads/writes the column but **never accepts it from client input** (`input: false`). Add `databaseHooks.user.create.before` to force `role='parent'` on every self-signup (OAuth or email) — the client can never self-assign teacher/admin. |
| `src/lib/auth/verify.server.ts` | New `requireIdentity(bearerToken?): Promise<Identity>` — resolves session, reads `role` (+ `teacher_status`) from the `"user"` row, returns the `Identity`. Keep `requireUserId` as a thin wrapper. |
| `src/lib/auth/middleware.ts` | New `roleMiddleware(...allowed: Identity["kind"][])` composing `authMiddleware`; puts `context.identity` on the request; throws 403 on mismatch. `assertSameSiteRequest()` stays first. |
| `src/lib/auth/use-current-user.ts` | Extend `AppUser` with `role: "parent"\|"teacher"\|"admin"` fetched from a new `getMyRole` server fn (session-cookie read, cheap). Client uses it **for UI routing only** — never for authorization. |
| `src/routes/login.tsx` | After first sign-in, new users land on a **role picker**: "I'm a Parent" / "I'm a Teacher". (No "I'm a Child" — children never self-register. No "Admin" — invite-only, §4.4.) Picker calls `chooseRole` server fn, which allows **parent only** from this path; teacher choice routes into the verification flow (§4.4). Store `role_chosen` flag to skip the picker on later logins. |
| `src/lib/pillarpath-server.ts` (or new `src/lib/roles-server.ts`) | `chooseRole`, `getMyRole` server fns, both behind `authMiddleware`. |

**Security invariant established:** *Role is a server-side fact.* The DB is the
only writer (signup hook defaults parent; admin/teacher only via privileged
flows); the client only ever *displays* it.

**Breakage flags:**
- Google OAuth flow changes: first-time OAuth users now hit the role picker
  before the app. Existing users (King's beta account) get `role='parent'` by
  the migration default + a one-time "confirm your role" interstitial.
- `VITE_AUTH_ENABLED=false` dev mode still yields the shared `dev-user` —
  treat it as `parent` in that mode; document that role tests need auth on.

### Phase 2 — Parent/child linking + kid PIN login

**Goal:** COPPA-safe child access. Children are **profiles under a parent
account**, never users. Kids log in with **name + PIN** (decision: yes, PIN —
no email, no password, nothing that identifies the child online).

**New migration — `migrations/0006_child_auth.sql`:**

- `alter table children add column pin_hash text` (bcrypt, nullable until set),
  `pin_attempts int default 0`, `pin_locked_until timestamptz`,
  `rename column user_id to parent_user_id` (or keep `user_id` and document it
  means the parent — renaming is cleaner; it is referenced in
  `src/lib/pillarpath-server.ts` in ~8 queries, all updated in Phase 3).
- `create table kid_sessions (token_hash text primary key,
  child_profile_id bigint references children(id) on delete cascade,
  parent_user_id text references "user"(id) on delete cascade,
  expires_at timestamptz not null, created_at timestamptz default now())`.
- Index on `(parent_user_id, expires_at)` for cleanup.

**Files to create/modify:**

| File | Change |
|---|---|
| `src/lib/kid-auth-server.ts` (new) | `setChildPin({childId, pin})` — parent-only (`roleMiddleware("parent")`), validates `child.parent_user_id = identity.userId`, bcrypt-hashes 4–6 digit PIN. `kidSignIn({parentEmail, childId, pin})` — **public rate-limited** server fn: looks up parent by email → child row → verifies PIN (constant-time), enforces attempt lockout (5 fails → 15-min lock), mints `kid_sessions` token (32 random bytes, **httpOnly cookie** `__Host-pillarpath-kid`, 12-hour expiry, sliding). `kidSignOut()` clears it. `getKidSession()` resolves `{childId, parentUserId}` from the cookie — used by middleware. |
| `src/lib/auth/middleware.ts` | Extend identity resolution: if the kid cookie is present and valid, identity = `{kind:"child", userId: parentUserId, childId}`. Kid cookie is checked **instead of** the Better Auth session (a device is either in parent mode or kid mode, never both). |
| `src/routes/login.tsx` | Add "Kid login" tab: Step 1 — parent email (or family code, TBD); Step 2 — shows that family's child first-names + avatars only; Step 3 — PIN pad. No child data beyond first name/avatar is exposed pre-PIN. |
| `src/components/kiddo/*` (parent Family views) | "Add child profile" now calls server `createChild` (already exists) + new "Set login PIN" step calling `setChildPin`. |
| `src/lib/pillarpath-server.ts` | Harden existing `createChild`: keep `roleMiddleware("parent")`; add per-parent child cap (e.g. 10) to bound abuse. |

**Security invariant established:** *Children hold no credentials that work
outside their family's context.* A PIN alone is useless without the parent
email; the kid session cookie is httpOnly, short-lived, and resolves to a
child-scoped identity the server derives — the client never asserts "I am
child X".

**COPPA notes (explicit):**
- Under-13s never create accounts, never supply email, never see a signup
  form. The "Kid login" tab collects zero new personal data (it only *matches*
  what the parent already provided).
- Verifiable parental consent: the parent's own authenticated account +
  email verification is the consent instrument; record `consent_at` on the
  child row when the PIN is first set.
- Data minimization: child rows carry first name + age + avatar only — no
  last names, no emails, no photos without explicit opt-in.
- Parent rights: parent dashboard gets "Download my child's data" and "Delete
  child profile" (hard delete cascades via `on delete cascade`).
- No behavioral advertising or third-party trackers in any child-rendered
  view (audit the marketing/promo surfaces — they must be parent/admin-only).
- Kid sessions expire in 12h and on explicit sign-out; a "This is a shared
  device" reminder on the kid home screen.

### Phase 3 — Server-side data scoping per role

**Goal:** every read/write is scoped by the server-resolved `Identity`; the
client role switcher is deleted.

**Data-access matrix (enforced in SQL, not in components):**

| Role | May read | May write |
|---|---|---|
| parent | own `profiles` row; `children` where `parent_user_id = me`; carts/orders/fulfillments/vault/future-plans/learning-progress/studio-projects via own children; messages threads where they are the parent party | same scope; creates child profiles; sets PINs; approves redemptions |
| child | own `child_profiles` row (name/avatar/units/vault — **never** parent email, payment, or sibling PII beyond first names); own studio projects/learning progress; classroom enrollments + assignments for their classrooms | own studio saves, chore completions, messages to own teacher/parent thread |
| teacher | own classrooms; enrollments + **first names only** of enrolled students; lessons/assignments/threads they own | lessons, assignments, announcements, grades, thread replies |
| admin | everything, **read-mostly**; writes only via explicit admin actions, each row in `admin_audit_log` | invites, teacher approvals, quarantine/review, config |

**Files to create/modify:**

| File | Change |
|---|---|
| `src/components/pillarpath-app.tsx` | **Delete the role picker** (`role` state, `pickRole`, the Parent/Child/Teacher tabs). Render the workspace from `useCurrentUser().role` (+ kid-session identity). This is the single most important deletion in the project. |
| `src/components/kiddo/shell.tsx` | Delete `RoleSwitch`. |
| `src/store/ledger.ts` | Remove `role`/`setRole` from the store (or keep as a deprecated no-op for one release to avoid breaking persisted `kiddo-ledger-v2` hydration — decide at implementation; rehydration of an unknown key is harmless since zustand ignores it, so plain removal is safe). |
| `src/components/kiddo/studio-pro.tsx` | Studio Pro unlock gate reads **server** `studioProUnlocked` — already a ledger field; move the toggle write behind `roleMiddleware("parent")` (new `setStudioProUnlocked` server fn) so localStorage tampering can't unlock it. |
| `src/lib/pillarpath-server.ts` | Add `roleMiddleware(...)` to every fn with the correct role: `getPillarpathData` → parent-only (today it also seeds demo data — see breakage flags); `createChild`/`setChildPin` → parent; commerce fns → parent; new `getChildHome`, `getTeacherWorkspace`, `saveStudioProject` (child or parent), `recordLearningActivity` (child or teacher-of-record) with `childId` ownership checks against the identity. |
| `src/lib/teacher-server.ts` (new) | Move teacher reads/writes off localStorage: classrooms, students (via `classroom_enrollments` join), lessons, assignments, gradebook, message threads — all `roleMiddleware("teacher")` + `teacher_user_id = me` scoping. |
| `src/lib/classroom-join-server.ts` (new) | `joinClassroom({joinCode})` — child or parent identity; validates code, inserts `classroom_enrollments`; returns only the classroom name. Rate-limit to stop code enumeration. |
| Teacher↔parent messaging | Threads table (`message_threads`, `thread_messages`) keyed with `teacher_user_id` + `parent_user_id` + `child_profile_id`; both `roleMiddleware("teacher")` and `roleMiddleware("parent")` fns check party membership per thread. **A teacher can never message a parent whose child isn't enrolled in their classroom; a parent can never read another family's threads.** |

**Security invariant established:** *Every data access is scoped by
`(role, owner-id)` in SQL on the server.* The client holds no authority; the
localStorage stores become pure caches.

**Breakage flags (explicit):**
- **Demo/beta localStorage data will orphan.** `kiddo-ledger-v2` and
  `pillarpath-teacher-v1` contain the beta's chores/Units/classrooms. Phase 3
  must ship a one-time "Import my demo data" tool (parent-gated) or accept a
  fresh start — **do not silently wipe**; King's beta data includes real
  testing history.
- `ensureUserSeed()` in `pillarpath-server.ts` currently fabricates a demo
  child "Alex", demo marketing campaigns, and a referral row for every new
  user. **This must be deleted before four-sided launch** — it would create
  fake children and fake marketing data on real accounts (and it writes
  marketing rows, which must never exist for child identities).
- The existing `children.units` / `vault_units` columns are the server mirror
  of ledger Units — Phase 3 picks ONE system of record (recommend: server
  wins; ledger becomes a write-through cache).
- FERPA: classroom gradebook/assignment data is an education record — the
  teacher fns must never return one student's rows to another student's
  parent, and `joinClassroom` must not leak the full roster (return only
  "joined classroom X").

### Phase 4 — Teacher verification + admin invite-only + Society Network shell

**Goal:** teachers are verified humans; admins are invited humans; the
corporate side exists as a separate, unlisted surface.

**Teacher verification (files):**

| File | Change |
|---|---|
| `src/lib/teacher-verify-server.ts` (new) | `requestTeacherVerification({schoolEmail, evidence})` — any `role='teacher'` account; sets `teacher_status='pending'`, inserts `teacher_verifications` row. Until `approved`, teacher capabilities are **limited**: can create classrooms and join codes, but student PII is masked to first-name + last-initial and exports are disabled. |
| Society Network admin UI (below) | `approveTeacher` / `rejectTeacher` — `roleMiddleware("admin")`, writes `admin_audit_log`. |
| `src/routes/login.tsx` (role picker) | "I'm a Teacher" path explains verification *before* account creation (sets expectations, deters casual fraud). |

Anti-impostor layers (state all four; implement 1+2 at launch, 3+4 as policy):
1. **School-email check** — verification request requires a non-freemail
   domain; MX-validated.
2. **Human review queue** — admin approves in the Society Network dashboard
   (evidence: staff directory link, ID badge photo — stored, never displayed).
3. **Classroom join codes are capability-scoped** — a code only grants
   *enrollment*, never teacher powers; codes rotate; teachers can't mint
   codes for other teachers' classrooms.
4. **Ongoing:** anomalous signals (many classrooms, rapid student churn)
   surface in the admin review queue.

**Admin invite-only (files):**

| File | Change |
|---|---|
| `migrations/0005_account_roles.sql` | (already) `admin_invites`, `admin_audit_log` tables. |
| `src/lib/admin-server.ts` (new) | `createAdminInvite({email})` — `roleMiddleware("admin")`; stores bcrypt token hash, 48h expiry; `acceptAdminInvite({token})` — public, single-use: verifies hash + expiry + email match, then sets `"user".role='admin'` **only if the accepting account's email matches the invite** (invite the person, have them sign in with Google/email first, then accept). |
| Bootstrap | `ADMIN_SEED_EMAIL` env var: on first deploy, a one-time server fn (or migration-time insert, safer) creates the invite for King's address. After first admin exists, the env path is dead code — document removal. |
| `src/routes/login.tsx` | **No admin signup UI exists, ever.** Admin route is unlisted (`/society/accept?token=…`, `noindex`, not linked from the app). |

**Society Network admin shell (files):**

| File | Change |
|---|---|
| `src/routes/society/index.tsx` (new) | Admin dashboard shell — `roleMiddleware("admin")` on every loader/fn; **not linked** from parent/child/teacher nav; `noindex`. Sections: Users (search, role view), Teacher verifications queue, Admin invites, Supplier quarantine/review (existing screening service), Orders/fulfillments (existing tables), Audit log. |
| `src/components/society/*` (new) | Admin UI components — visually distinct (dark ops theme) so a screenshot can never be mistaken for the customer app. |
| `src/lib/admin-server.ts` | `listUsers`, `getAuditLog`, `approveTeacher`, `createAdminInvite`, supplier review actions — all `roleMiddleware("admin")`. |

**Security invariant established:** *Privilege can never be self-granted.*
Teacher requires human approval; admin requires a single-use invite tied to a
verified email; every admin write is audit-logged.

**Breakage flags:**
- The marketing/affiliate surfaces (`marketing_campaigns`, `promo_codes`,
  `referrals`, Partner hub) are currently reachable from the **parent**
  workspace (`pillarpath-app.tsx` parentNav). Decide: they stay parent-visible
  (referrals) or move fully into the Society Network shell (campaigns, promo
  codes are corporate ops — recommend moving them; keep only referral display
  for parents).
- Admins must never see child PINs (store only bcrypt hashes — already the
  plan) or full parent payment details beyond what's needed for support
  (mask in the admin UI).

---

## 4. Cross-cutting concerns

### 4.1 What breaks the Google OAuth flow (and how not to)

- `databaseHooks.user.create.before` forcing `role='parent'` is provider-
  agnostic — Google/Apple/Facebook/TikTok/X/Instagram/Snapchat/email all get
  the same default. No per-provider code.
- The role picker after first OAuth sign-in must handle the OAuth `callbackURL`
  correctly (picker at `/welcome`, then redirect to the stored destination).
- **Do not** put role in the OAuth `authorizationUrlParams` or profile
  mapping — role is assigned post-authentication, server-side, always.
- Existing sessions survive the migration (role defaults to parent); the
  cookieCache (`session_data`, 5 min) means role reads should go through the
  DB-backed `getMyRole`, not the cached session payload.

### 4.2 Session strategy (three session types, one resolver)

1. **Full session** (parent/teacher/admin): existing Better Auth cookie
   (`__Host-grok-auth.session_token`), unchanged.
2. **Kid session**: new `__Host-pillarpath-kid` httpOnly cookie → `kid_sessions`
   row → `{kind:"child"}` identity. Never coexists with a full session on the
   same device profile (kid mode is a deliberate switch, PIN-gated back).
3. **Dev fallback**: `VITE_AUTH_ENABLED=false` → `dev-user` treated as parent;
   kid/teacher/admin flows are untestable in this mode — document it.

`requireIdentity()` checks in order: kid cookie → Better Auth session → throw
401. Every server fn uses it via `authMiddleware` + `roleMiddleware`.

### 4.3 Data migration (beta → four-sided)

1. King's existing account → `role='parent'` (migration default).
2. Existing `children` rows already keyed by `user_id` → become that parent's
   child profiles (add `pin_hash = null` → parent sets PINs post-launch).
3. localStorage ledger/teacher data → one-time parent-gated import tool, then
   the app reads server-first. Keep the import idempotent (by natural keys,
   not blind insert).
4. Delete `ensureUserSeed` demo fabrication (`'Alex'`, demo campaigns) before
   launch — it is the #1 source of fake data on real accounts.

### 4.4 COPPA / FERPA checklist (explicit)

**COPPA:**
- [ ] No child self-registration anywhere (no "I'm a Child" signup path).
- [ ] No email/password/OAuth for children — PIN + family context only.
- [ ] Verifiable parental consent recorded (`consent_at`) before a child
  profile becomes active.
- [ ] Data minimization on child rows (first name, age, avatar).
- [ ] Parent can review, download, and delete child data (hard delete).
- [ ] No ads, no behavioral tracking, no third-party SDKs in child views.
- [ ] Kid sessions short-lived (12h), explicit sign-out, shared-device
  reminder.
- [ ] Privacy policy updated with a children's-privacy section before launch.

**FERPA:**
- [ ] Classroom records (assignments, grades, enrollment) scoped to the
  teacher of record + the individual student's parent — never cross-family.
- [ ] Teacher verification gates access to student PII (limited mode until
  approved).
- [ ] `joinClassroom` reveals nothing about the roster.
- [ ] Admin access to education records is audit-logged (`admin_audit_log`).
- [ ] Directory-information policy documented (what counts as shareable in
  leaderboards/showcase: first name + avatar only, opt-in).

---

## 5. Phase summary

| Phase | Delivers | Invariant |
|---|---|---|
| 1 — Schema + roles + session | `role` column, signup hook, `requireIdentity`, `roleMiddleware`, post-signup role picker | Role is a server-side fact; the client never asserts it |
| 2 — Child profiles + PIN login | `pin_hash`, `kid_sessions`, PIN pad login, parent consent record | Kids hold no online credentials; sessions are family-scoped |
| 3 — Server-side data scoping | Role picker UI deleted, per-role server fns, thread party checks, teacher server fns | Every read/write scoped by (role, owner-id) in SQL |
| 4 — Verification + admin shell | Teacher review queue, invite-only admin, `/society` dashboard, audit log | Privilege can never be self-granted |

**Suggested order inside each phase:** migration → server fns → middleware
wiring → UI. Typecheck + build + snapshot-push + Vercel READY verification
after every phase, per the standing deploy contract.
