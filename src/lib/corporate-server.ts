/**
 * PillarPath corporate HQ — server functions with role-based access control.
 *
 * The corporate side is the company's private office: departments, roles,
 * permissions, and team management. Every privileged function resolves the
 * caller's corporate identity server-side and enforces it via
 * `corporateMiddleware(resource, action)`.
 *
 * Bootstrap: the account with `role = 'admin'` in the "user" table is the
 * Chief Executive Officer (full "*" permissions). The CEO seeds the
 * reference structure once via `seedCorporateStructure()` and then grants
 * roles to team members with `assignCorporateRole()`. Only the CEO
 * (level 10) may grant or revoke corporate roles.
 */

import { createServerFn } from "@tanstack/react-start";
import { authMiddleware, ForbiddenError } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  DEPARTMENTS,
  ROLES,
  expandGrants,
  getRole,
  hasGrant,
} from "@/lib/corporate-structure";

export interface CorporateRoleRef {
  slug: string;
  title: string;
  department: string;
  departmentName: string;
  level: number;
}

export interface CorporateStatus {
  signedIn: boolean;
  /** True when the caller holds any corporate position (or is the admin/CEO). */
  isCorporate: boolean;
  isCeo: boolean;
  displayTitle: string | null;
  roles: CorporateRoleRef[];
  /** Canonical "resource:action" grants, or ["*"]. */
  permissions: string[];
  /** True when the reference structure has not been seeded yet. */
  needsSeed: boolean;
}

async function audit(userId: string, action: string, target?: string, meta: Record<string, unknown> = {}) {
  const sql = await getSql();
  await sql`
    insert into admin_audit_log (admin_user_id, action, target, meta)
    values (${userId}, ${action}, ${target ?? null}, ${JSON.stringify(meta)}::jsonb)`;
}

async function readStatus(userId: string): Promise<CorporateStatus> {
  const sql = await getSql();
  const users = await sql<{ role: string | null; name: string | null }>`
    select role, name from "user" where id = ${userId}`;
  const accountRole = users[0]?.role ?? "parent";

  let needsSeed = false;
  try {
    const d = await sql<{ n: string }>`select count(*)::text as n from corporate_departments`;
    needsSeed = Number(d[0]?.n ?? "0") === 0;
  } catch {
    // Pre-0009 database: tables do not exist yet.
    needsSeed = true;
  }

  // The platform admin is the Chief Executive Officer.
  if (accountRole === "admin") {
    const ceo = getRole("ceo");
    return {
      signedIn: true,
      isCorporate: true,
      isCeo: true,
      displayTitle: ceo?.title ?? "Chief Executive Officer",
      roles: ceo
        ? [{ slug: ceo.slug, title: ceo.title, department: ceo.department, departmentName: "Executive", level: 10 }]
        : [],
      permissions: ["*"],
      needsSeed,
    };
  }

  try {
    const rows = await sql<{
      slug: string;
      title: string;
      dept_slug: string;
      dept_name: string;
      level: number;
      permissions: string[];
    }>`
      select r.slug, r.title, d.slug as dept_slug, d.name as dept_name, r.level,
             coalesce(array_agg(p.resource || ':' || p.action) filter (where p.resource is not null), '{}') as permissions
      from corporate_team t
      join corporate_roles r on r.id = t.role_id
      join corporate_departments d on d.id = r.department_id
      left join corporate_role_permissions p on p.role_id = r.id
      where t.user_id = ${userId} and t.status = 'active'
      group by r.slug, r.title, d.slug, d.name, r.level`;
    if (rows.length === 0) {
      return { signedIn: true, isCorporate: false, isCeo: false, displayTitle: null, roles: [], permissions: [], needsSeed };
    }
    const grants = new Set<string>();
    for (const r of rows) for (const g of r.permissions) grants.add(g);
    const top = [...rows].sort((a, b) => b.level - a.level)[0];
    return {
      signedIn: true,
      isCorporate: true,
      isCeo: top.level >= 10,
      displayTitle: top.title,
      roles: rows.map((r) => ({
        slug: r.slug, title: r.title, department: r.dept_slug,
        departmentName: r.dept_name, level: r.level,
      })),
      permissions: [...grants],
      needsSeed,
    };
  } catch {
    return { signedIn: true, isCorporate: false, isCeo: false, displayTitle: null, roles: [], permissions: [], needsSeed };
  }
}

export const getCorporateStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<CorporateStatus> => {
    return readStatus(context.userId);
  });

/** Seed departments, roles, and permissions from corporate-structure.ts (idempotent). CEO only. */
export const seedCorporateStructure = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const status = await readStatus(context.userId);
    if (!status.isCeo) throw new ForbiddenError("corporate:roles:manage");
    const sql = await getSql();
    let deptCount = 0;
    let roleCount = 0;
    for (const d of DEPARTMENTS) {
      const rows = await sql<{ id: number }>`
        insert into corporate_departments (slug, name, tagline, icon, sort_order, mandate, room)
        values (${d.slug}, ${d.name}, ${d.tagline}, ${d.icon}, ${d.sortOrder}, ${d.mandate}, ${d.room})
        on conflict (slug) do update set
          name = excluded.name, tagline = excluded.tagline, icon = excluded.icon,
          sort_order = excluded.sort_order, mandate = excluded.mandate, room = excluded.room
        returning id`;
      deptCount++;
      const deptId = rows[0].id;
      for (const r of ROLES.filter((x) => x.department === d.slug)) {
        const rrows = await sql<{ id: number }>`
          insert into corporate_roles (slug, title, department_id, level, summary, responsibilities, is_executive)
          values (${r.slug}, ${r.title}, ${deptId}, ${r.level}, ${r.summary}, ${JSON.stringify(r.responsibilities)}, ${r.level >= 9})
          on conflict (slug) do update set
            title = excluded.title, department_id = excluded.department_id, level = excluded.level,
            summary = excluded.summary, responsibilities = excluded.responsibilities,
            is_executive = excluded.is_executive
          returning id`;
        roleCount++;
        const roleId = rrows[0].id;
        await sql`delete from corporate_role_permissions where role_id = ${roleId}`;
        for (const g of r.permissions) {
          if (g === "*") {
            await sql`insert into corporate_role_permissions (role_id, resource, action) values (${roleId}, '*', '*') on conflict do nothing`;
          } else {
            const [resource, action] = g.split(":");
            await sql`insert into corporate_role_permissions (role_id, resource, action) values (${roleId}, ${resource}, ${action}) on conflict do nothing`;
          }
        }
      }
    }
    await audit(context.userId, "corporate.seed", undefined, { departments: deptCount, roles: roleCount });
    return { ok: true, departments: deptCount, roles: roleCount };
  });

export interface OrgDepartment {
  slug: string;
  name: string;
  tagline: string;
  icon: string;
  room: string;
  mandate: string;
  roles: {
    slug: string;
    title: string;
    level: number;
    summary: string;
    responsibilities: string[];
    memberCount: number;
    members: { name: string; email: string }[];
  }[];
}

/** Full org structure for the Tower and org chart. Requires overview:view. */
export const listOrgStructure = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ departments: OrgDepartment[] }> => {
    const status = await readStatus(context.userId);
    if (!status.isCorporate || !hasGrant(status.permissions, "overview", "view")) {
      throw new ForbiddenError("corporate:overview:view");
    }
    const sql = await getSql();
    const depts = await sql<{
      slug: string; name: string; tagline: string; icon: string; room: string; mandate: string; sort_order: number;
    }>`select slug, name, tagline, icon, room, mandate, sort_order from corporate_departments order by sort_order`;
    const departments: OrgDepartment[] = [];
    for (const d of depts) {
      const roles = await sql<{
        slug: string; title: string; level: number; summary: string; responsibilities: string;
      }>`select slug, title, level, summary, responsibilities from corporate_roles r
          join corporate_departments dd on dd.id = r.department_id
          where dd.slug = ${d.slug} order by level desc, title`;
      const outRoles: OrgDepartment["roles"] = [];
      for (const r of roles) {
        const members = await sql<{ name: string; email: string }>`
          select u.name, u.email from corporate_team t
          join "user" u on u.id = t.user_id
          join corporate_roles rr on rr.id = t.role_id
          where rr.slug = ${r.slug} and t.status = 'active' order by u.name`;
        outRoles.push({
          slug: r.slug, title: r.title, level: r.level, summary: r.summary,
          responsibilities: JSON.parse(r.responsibilities ?? "[]"),
          memberCount: members.length, members,
        });
      }
      departments.push({
        slug: d.slug, name: d.name, tagline: d.tagline, icon: d.icon,
        room: d.room, mandate: d.mandate, roles: outRoles,
      });
    }
    return { departments };
  });

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  roleSlug: string;
  roleTitle: string;
  department: string;
  departmentName: string;
  level: number;
  status: string;
  grantedAt: string;
}

/** Team directory. Requires team:view. */
export const listTeam = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ members: TeamMember[] }> => {
    const status = await readStatus(context.userId);
    if (!status.isCorporate || !hasGrant(status.permissions, "team", "view")) {
      throw new ForbiddenError("corporate:team:view");
    }
    const sql = await getSql();
    const rows = await sql<{
      id: number; name: string; email: string; role_slug: string; role_title: string;
      dept_slug: string; dept_name: string; level: number; status: string; granted_at: string;
    }>`
      select t.id, u.name, u.email, r.slug as role_slug, r.title as role_title,
             d.slug as dept_slug, d.name as dept_name, r.level, t.status,
             t.granted_at::text as granted_at
      from corporate_team t
      join "user" u on u.id = t.user_id
      join corporate_roles r on r.id = t.role_id
      join corporate_departments d on d.id = r.department_id
      where t.status = 'active'
      order by r.level desc, u.name`;
    return {
      members: rows.map((r) => ({
        id: r.id, name: r.name, email: r.email, roleSlug: r.role_slug, roleTitle: r.role_title,
        department: r.dept_slug, departmentName: r.dept_name, level: r.level,
        status: r.status, grantedAt: r.granted_at,
      })),
    };
  });

/** Grant a corporate role to a user by email. CEO only. Replaces existing active roles. */
export const assignCorporateRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { email: string; roleSlug: string; note?: string }) => input)
  .handler(async ({ context, data }) => {
    const status = await readStatus(context.userId);
    if (!status.isCeo) throw new ForbiddenError("corporate:roles:manage");
    const sql = await getSql();
    const users = await sql<{ id: string; name: string }>`
      select id, name from "user" where lower(email) = lower(${data.email.trim()})`;
    if (users.length === 0) throw new Error("No account found with that email.");
    const roles = await sql<{ id: number; title: string }>`
      select id, title from corporate_roles where slug = ${data.roleSlug}`;
    if (roles.length === 0) throw new Error("Unknown role.");
    const userId = users[0].id;
    const roleId = roles[0].id;
    await sql`update corporate_team set status = 'revoked', revoked_at = now()
              where user_id = ${userId} and status = 'active'`;
    const ins = await sql<{ id: number }>`
      insert into corporate_team (user_id, role_id, granted_by, note)
      values (${userId}, ${roleId}, ${context.userId}, ${data.note ?? ""})
      returning id`;
    await audit(context.userId, "corporate.role.assign", String(ins[0].id), {
      email: data.email.trim(), role: data.roleSlug,
    });
    return { ok: true, memberId: ins[0].id, name: users[0].name, roleTitle: roles[0].title };
  });

/** Revoke a team member's corporate role. CEO only. */
export const revokeCorporateRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { teamId: number }) => input)
  .handler(async ({ context, data }) => {
    const status = await readStatus(context.userId);
    if (!status.isCeo) throw new ForbiddenError("corporate:roles:manage");
    const sql = await getSql();
    await sql`update corporate_team set status = 'revoked', revoked_at = now()
              where id = ${data.teamId} and status = 'active'`;
    await audit(context.userId, "corporate.role.revoke", String(data.teamId));
    return { ok: true };
  });

export interface MatrixRole {
  slug: string;
  title: string;
  departmentName: string;
  level: number;
  grants: string[];
}

/** Permission matrix for the HQ reference table. Requires overview:view. */
export const getPermissionMatrix = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ roles: MatrixRole[] }> => {
    const status = await readStatus(context.userId);
    if (!status.isCorporate || !hasGrant(status.permissions, "overview", "view")) {
      throw new ForbiddenError("corporate:overview:view");
    }
    // Canonical definitions are the source of truth for display.
    const roles: MatrixRole[] = ROLES.map((r) => {
      const dept = DEPARTMENTS.find((d) => d.slug === r.department);
      return {
        slug: r.slug, title: r.title, departmentName: dept?.name ?? r.department,
        level: r.level, grants: expandGrants(r),
      };
    }).sort((a, b) => b.level - a.level || a.title.localeCompare(b.title));
    void getRole;
    return { roles };
  });

/**
 * Verify the CJ Dropshipping API key with a live token exchange.
 * Runs on the server (Vercel's network in production) — this is the real
 * end-to-end proof the key works. Never returns the token itself.
 * Requires suppliers:manage (VP Sales and up).
 */
export const testCjConnection = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const status = await readStatus(context.userId);
    if (!status.isCorporate || !hasGrant(status.permissions, "suppliers", "manage")) {
      throw new ForbiddenError("corporate:suppliers:manage");
    }
    const apiKey = process.env.CJ_API_KEY;
    if (!apiKey) {
      return { ok: false, message: "CJ_API_KEY is not set on the server." };
    }
    try {
      const res = await fetch("https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const body = (await res.json().catch(() => null)) as {
        code?: number; message?: string; data?: { accessTokenExpiryDate?: string };
      } | null;
      if (body && (body.code === 200 || body.data?.accessTokenExpiryDate)) {
        await audit(context.userId, "corporate.cj.test", undefined, { ok: true });
        return {
          ok: true,
          message: `CJ API key verified — token issued, valid until ${body.data?.accessTokenExpiryDate ?? "unknown"}.`,
        };
      }
      return { ok: false, message: `CJ rejected the key: ${body?.message ?? `HTTP ${res.status}`}` };
    } catch (e) {
      return { ok: false, message: `Could not reach CJ's API: ${e instanceof Error ? e.message : "network error"}` };
    }
  });
