import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { crewState, plazaLiveEnabled } from "@/lib/pillarpath-server";

/* ------------------------------------------------------------------ */
/* Plaza device passes — the kid-device pass (Phase 2 identity).      */
/*                                                                    */
/* A kid's own device has no account session, so until now the plaza  */
/* on that device ran local-only: no crew, no cloud save, no Live.    */
/* A parent now issues a pass for ONE child from the dashboard. The   */
/* kid enters it once in the plaza; from then on the plaza calls      */
/* these endpoints with the pass token instead of a session.          */
/*                                                                    */
/* Security shape: the token is 192 bits of randomness; only its      */
/* SHA-256 hash is stored. A pass resolves to exactly one             */
/* (user_id, child_id) pair and can ONLY reach the plaza surface      */
/* below — economy under the same daily caps + audit trail, cloud     */
/* save, crew, milestones, and Live presence inside the same          */
/* server-enforced circles. Every other server function in the app    */
/* still requires a full account session. Parents can revoke a pass   */
/* at any time; revocation takes effect on the next request.          */
/* ------------------------------------------------------------------ */

const PLAZA_ACTIONS = ["wave", "great", "follow", "help"];
const CREW_REWARD_UNITS = 20;

/** Normalize kid-typed input: lowercase hex, ignore spaces/dashes. */
function normalizeToken(raw: string): string {
  return String(raw || "").toLowerCase().replace(/[^0-9a-f]/g, "");
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generatePassToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface PassIdentity {
  passId: number;
  userId: string;
  childId: number;
}

/** Resolve a pass token to its (parent account, child) pair, or throw. */
async function resolvePass(sql: any, rawToken: string): Promise<PassIdentity> {
  const token = normalizeToken(rawToken);
  if (token.length !== 48) throw new Error("That pass doesn't look right — check it and try again.");
  const hash = await hashToken(token);
  const rows = await sql<{ id: number; user_id: string; child_id: number; last_used_at: string | null }>`
    select id, user_id, child_id, last_used_at from plaza_device_passes
    where token_hash = ${hash} and revoked_at is null`;
  if (!rows.length) throw new Error("That pass isn't valid anymore — ask a grown-up for a new one.");
  const pass = rows[0];
  // Touch last_used_at at most every 5 minutes (Live syncs every 2s).
  if (!pass.last_used_at || Date.now() - new Date(pass.last_used_at).getTime() > 5 * 60 * 1000) {
    await sql`update plaza_device_passes set last_used_at = now() where id = ${pass.id}`;
  }
  return { passId: pass.id, userId: pass.user_id, childId: pass.child_id };
}

async function assertChildOf(sql: any, userId: string, childId: number) {
  const rows = await sql<{ id: number }>`select id from children where id = ${childId} and user_id = ${userId}`;
  if (!rows.length) throw new Error("Child not found.");
}

/* ------------------------------------------------------------------ */
/* Parent management (full session required)                          */
/* ------------------------------------------------------------------ */

/** Issue a new device pass for one child. The token is returned ONCE. */
export const createPlazaDevicePass = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { childId: number; label?: string }) => input)
  .handler(async ({ context, data }): Promise<{ token: string }> => {
    const sql = await getSql();
    await assertChildOf(sql, context.userId, data.childId);
    const token = generatePassToken();
    const hash = await hashToken(token);
    const label = String(data.label || "Kid device").slice(0, 60);
    await sql`
      insert into plaza_device_passes (user_id, child_id, token_hash, label)
      values (${context.userId}, ${data.childId}, ${hash}, ${label})`;
    return { token };
  });

/** A child's device passes (never includes token material). */
export const listPlazaDevicePasses = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { childId: number }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await assertChildOf(sql, context.userId, data.childId);
    const rows = await sql<{ id: number; label: string; created_at: string; last_used_at: string | null; revoked_at: string | null }>`
      select id, label, created_at, last_used_at, revoked_at from plaza_device_passes
      where user_id = ${context.userId} and child_id = ${data.childId}
      order by id desc limit 10`;
    return rows.map((r: any) => ({
      id: r.id,
      label: r.label,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
      active: !r.revoked_at,
    }));
  });

/** Revoke a pass immediately; also clears any live presence it created. */
export const revokePlazaDevicePass = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { passId: number }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    const rows = await sql<{ child_id: number }>`
      update plaza_device_passes set revoked_at = now()
      where id = ${data.passId} and user_id = ${context.userId} and revoked_at is null
      returning child_id`;
    if (rows.length) {
      await sql`delete from plaza_presence where child_id = ${rows[0].child_id}`;
    }
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Kid-device plaza endpoints (pass-token identity, plaza scope only) */
/* ------------------------------------------------------------------ */

/** Entry state for a pass device: child, server Units mirror, cloud save, caps, Live switch. */
export const plazaPassState = createServerFn({ method: "POST" })
  .validator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const pass = await resolvePass(sql, data.token);
    const today = new Date().toISOString().slice(0, 10);
    const [child, save, caps, liveEnabled] = await Promise.all([
      sql<{ id: number; name: string; avatar: string; units: number }>`
        select id, name, avatar, units from children where id = ${pass.childId} and user_id = ${pass.userId}`,
      sql<{ save_json: string; updated_at: string }>`select save_json::text as save_json, updated_at from plaza_saves where child_id = ${pass.childId}`,
      sql<{ cap_key: string; count: number }>`select cap_key, count from plaza_reward_caps where user_id = ${pass.userId} and child_id = ${pass.childId} and day = ${today}`,
      plazaLiveEnabled(sql, pass.userId, pass.childId),
    ]);
    if (!child.length) throw new Error("That pass isn't valid anymore — ask a grown-up for a new one.");
    const capCounts: Record<string, number> = {};
    for (const c of caps) capCounts[c.cap_key] = c.count;
    return {
      child: { id: child[0].id, name: child[0].name, avatar: child[0].avatar || "🧒" },
      units: child[0].units ?? 0,
      saveJson: (save[0]?.save_json ?? null) as string | null,
      saveUpdatedAt: (save[0]?.updated_at ?? null) as string | null,
      capCounts,
      liveEnabled,
    };
  });

/** Same audited, cap-enforced credit as plazaEarn — via pass identity. */
export const plazaPassEarn = createServerFn({ method: "POST" })
  .validator((input: { token: string; amount: number; note: string; capKey?: string; capLimit?: number }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; newBalance?: number; capRemaining?: number }> => {
    const sql = await getSql();
    const pass = await resolvePass(sql, data.token);
    const amount = Math.max(1, Math.floor(Number(data.amount)));
    if (!Number.isFinite(amount) || amount > 500) throw new Error("Invalid amount.");
    const note = String(data.note || "Pillar Plaza reward").slice(0, 160);
    let capRemaining: number | undefined;
    if (data.capKey && data.capLimit) {
      const today = new Date().toISOString().slice(0, 10);
      const cap = await sql<{ count: number }>`
        insert into plaza_reward_caps (user_id, child_id, cap_key, day, count)
        values (${pass.userId}, ${pass.childId}, ${data.capKey}, ${today}, 1)
        on conflict (user_id, child_id, cap_key, day)
        do update set count = plaza_reward_caps.count + 1
        returning count`;
      const count = cap[0].count;
      capRemaining = Math.max(0, data.capLimit - count);
      if (count > data.capLimit) {
        await sql`update plaza_reward_caps set count = count - 1 where user_id = ${pass.userId} and child_id = ${pass.childId} and cap_key = ${data.capKey} and day = ${today}`;
        return { ok: false, reason: "cap", capRemaining: 0 };
      }
    }
    const rows = await sql<{ units: number }>`
      with credited as (
        update children set units = units + ${amount}
        where id = ${pass.childId} and user_id = ${pass.userId}
        returning units
      ),
      logged as (
        insert into units_transactions (user_id, child_id, kind, amount, note)
        select ${pass.userId}, ${pass.childId}, 'earn', ${amount}, ${note}
        where exists (select 1 from credited)
        returning 1
      )
      select units from credited`;
    if (!rows.length) throw new Error("Child not found.");
    return { ok: true, newBalance: rows[0].units, capRemaining };
  });

/** Same audited debit as plazaSpend — via pass identity. */
export const plazaPassSpend = createServerFn({ method: "POST" })
  .validator((input: { token: string; amount: number; note: string }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    const pass = await resolvePass(sql, data.token);
    const amount = Math.max(1, Math.floor(Number(data.amount)));
    if (!Number.isFinite(amount) || amount > 100000) throw new Error("Invalid amount.");
    const note = String(data.note || "Pillar Plaza build").slice(0, 160);
    await sql`
      with debited as (
        update children set units = greatest(0, units - ${amount})
        where id = ${pass.childId} and user_id = ${pass.userId}
        returning id
      )
      insert into units_transactions (user_id, child_id, kind, amount, note)
      select ${pass.userId}, ${pass.childId}, 'spend', ${amount}, ${note}
      where exists (select 1 from debited)`;
    return { ok: true };
  });

/** Cloud-save the plaza from a pass device. */
export const plazaPassSaveGame = createServerFn({ method: "POST" })
  .validator((input: { token: string; saveJson: string }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    const pass = await resolvePass(sql, data.token);
    if (data.saveJson.length > 200000) throw new Error("Save too large.");
    JSON.parse(data.saveJson);
    await sql`
      insert into plaza_saves (child_id, user_id, save_json, updated_at)
      values (${pass.childId}, ${pass.userId}, ${data.saveJson}::jsonb, now())
      on conflict (child_id) do update set save_json = excluded.save_json, updated_at = now()`;
    return { ok: true };
  });

/** Milestone for the parent dashboard feed, from a pass device. */
export const plazaPassEvent = createServerFn({ method: "POST" })
  .validator((input: { token: string; icon: string; headline: string; detail?: string }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    const pass = await resolvePass(sql, data.token);
    await sql`insert into plaza_events (user_id, child_id, icon, headline, detail)
      values (${pass.userId}, ${pass.childId}, ${String(data.icon).slice(0, 12)}, ${String(data.headline).slice(0, 120)}, ${String(data.detail || "").slice(0, 240)})`;
    await sql`delete from plaza_events where child_id = ${pass.childId}
      and id not in (select id from plaza_events where child_id = ${pass.childId} order by created_at desc limit 50)`;
    return { ok: true };
  });

/** Crew roster + weekly quest progress for a pass device. */
export const plazaPassCrewState = createServerFn({ method: "POST" })
  .validator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const pass = await resolvePass(sql, data.token);
    const st = await crewState(sql, pass.userId);
    return { ...st, you: pass.childId };
  });

/** Record one helping action from a pass device. */
export const plazaPassCrewHelp = createServerFn({ method: "POST" })
  .validator((input: { token: string }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean; totalHelps: number; goal: number }> => {
    const sql = await getSql();
    const pass = await resolvePass(sql, data.token);
    const before = await crewState(sql, pass.userId);
    const week = before.week as string;
    await sql`
      insert into plaza_crew_helps (user_id, child_id, week_key, helps, updated_at)
      values (${pass.userId}, ${pass.childId}, ${week}, 1, now())
      on conflict (user_id, child_id, week_key)
      do update set helps = plaza_crew_helps.helps + 1, updated_at = now()`;
    const st = await crewState(sql, pass.userId);
    return { ok: true, totalHelps: st.totalHelps, goal: st.goal };
  });

/** Claim the weekly Crew Quest reward from a pass device. */
export const plazaPassCrewClaim = createServerFn({ method: "POST" })
  .validator((input: { token: string }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; amount?: number }> => {
    const sql = await getSql();
    const pass = await resolvePass(sql, data.token);
    const st = await crewState(sql, pass.userId);
    if (st.totalHelps < st.goal) return { ok: false, reason: "goal" };
    const me = st.members.find((m: any) => m.id === pass.childId);
    if (!me || me.claimed) return { ok: false, reason: "claimed" };
    const week = st.week as string;
    await sql`
      insert into plaza_crew_helps (user_id, child_id, week_key, helps, claimed, updated_at)
      values (${pass.userId}, ${pass.childId}, ${week}, 0, true, now())
      on conflict (user_id, child_id, week_key)
      do update set claimed = true, updated_at = now()`;
    await sql`
      with credited as (
        update children set units = units + ${CREW_REWARD_UNITS}
        where id = ${pass.childId} and user_id = ${pass.userId}
        returning id
      )
      insert into units_transactions (user_id, child_id, kind, amount, note)
      select ${pass.userId}, ${pass.childId}, 'earn', ${CREW_REWARD_UNITS}, 'Pillar Plaza Crew Quest reward'
      where exists (select 1 from credited)`;
    return { ok: true, amount: CREW_REWARD_UNITS };
  });

/**
 * Live heartbeat + peer fetch from a pass device. Identical visibility
 * rule to plazaLiveSync — the server only ever returns family, approved
 * friends, or doubly-approved classmates for the pass's child.
 */
export const plazaPassLiveSync = createServerFn({ method: "POST" })
  .validator((input: { token: string; x: number; z: number; face: number; action?: string; live: boolean }) => input)
  .handler(async ({ data }): Promise<{ liveEnabled: boolean; peers: any[] }> => {
    const sql = await getSql();
    const pass = await resolvePass(sql, data.token);
    const userId = pass.userId;
    const childId = pass.childId;
    const enabled = await plazaLiveEnabled(sql, userId, childId);
    if (!enabled || !data.live) {
      await sql`delete from plaza_presence where child_id = ${childId}`;
      return { liveEnabled: enabled, peers: [] };
    }
    const x = Math.max(-160, Math.min(160, Number(data.x) || 0));
    const z = Math.max(-160, Math.min(160, Number(data.z) || 0));
    const face = Number(data.face) || 0;
    const action = data.action && PLAZA_ACTIONS.includes(data.action) ? data.action : "";
    if (action) {
      await sql`
        insert into plaza_presence (child_id, user_id, x, z, face, action, action_at, updated_at)
        values (${childId}, ${userId}, ${x}, ${z}, ${face}, ${action}, now(), now())
        on conflict (child_id) do update set x = excluded.x, z = excluded.z, face = excluded.face,
          action = excluded.action, action_at = excluded.action_at, updated_at = now()`;
    } else {
      await sql`
        insert into plaza_presence (child_id, user_id, x, z, face, updated_at)
        values (${childId}, ${userId}, ${x}, ${z}, ${face}, now())
        on conflict (child_id) do update set x = excluded.x, z = excluded.z, face = excluded.face, updated_at = now()`;
    }
    const me = await sql<{ name: string }>`select name from children where id = ${childId}`;
    const myName = me[0]?.name ?? "";
    const peers = await sql<{
      child_id: number; name: string; avatar: string; x: number; z: number; face: number;
      action: string; action_at: string | null; kind: string;
    }>`
      select p.child_id, c.name, c.avatar, p.x, p.z, p.face, p.action, p.action_at,
        case
          when p.user_id = ${userId} then 'family'
          when exists (select 1 from plaza_friendships f
            where f.status = 'approved'
              and ((f.child_a = ${childId} and f.child_b = p.child_id)
                or (f.child_a = p.child_id and f.child_b = ${childId}))) then 'friend'
          else 'classmate'
        end as kind
      from plaza_presence p
      join children c on c.id = p.child_id
      where p.child_id != ${childId}
        and p.updated_at > now() - interval '15 seconds'
        and (
          p.user_id = ${userId}
          or exists (select 1 from plaza_friendships f
            where f.status = 'approved'
              and ((f.child_a = ${childId} and f.child_b = p.child_id)
                or (f.child_a = p.child_id and f.child_b = ${childId})))
          or exists (select 1 from classroom_connections cc1
            join classroom_connections cc2 on cc2.classroom_id = cc1.classroom_id
            where cc1.parent_user_id = ${userId} and cc1.status = 'approved' and cc1.child_name = ${myName}
              and cc2.parent_user_id = p.user_id and cc2.status = 'approved' and cc2.child_name = c.name)
        )
      limit 12`;
    return {
      liveEnabled: true,
      peers: peers.map((p: any) => ({
        childId: p.child_id, name: p.name, avatar: p.avatar || "🧒",
        x: p.x, z: p.z, face: p.face, action: p.action || "",
        actionAt: p.action_at ? new Date(p.action_at).getTime() : 0, kind: p.kind,
      })),
    };
  });
