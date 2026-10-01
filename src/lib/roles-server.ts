import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { DEV_USER_ID, type AccountRole } from "@/lib/auth/verify.server";

/**
 * Four-sided accounts — role read/write, server-enforced.
 *
 * The role picker (post-signup) calls `chooseRole` exactly once. The client
 * can only ever choose "parent" or "teacher" here:
 * - "parent" completes immediately.
 * - "teacher" sets teacher_status='pending' and routes into the verification
 *   flow (Phase 4 gates teacher capabilities until approved).
 * - "admin" is NOT offered — invite-only, Phase 4.
 * - "child" is NOT offered — children never hold accounts (COPPA).
 *
 * `role_set_at` is the one-time flag: once set, this fn refuses to run again.
 * Later role changes go through support/admin, never self-serve.
 */

export type MyRole = {
  role: AccountRole;
  teacherStatus: string;
  roleChosen: boolean;
};

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<MyRole> => {
    // Dev fallback (auth off): the dev user is a parent, picker skipped.
    if (context.userId === DEV_USER_ID) {
      return { role: "parent", teacherStatus: "unverified", roleChosen: true };
    }
    const sql = await getSql();
    try {
      const rows = await sql<{
        role: string | null;
        teacher_status: string | null;
        role_set_at: string | null;
      }>`select role, teacher_status, role_set_at from "user" where id = ${context.userId}`;
      const row = rows[0];
      const role = (row?.role === "teacher" || row?.role === "admin" ? row.role : "parent") as AccountRole;
      return {
        role,
        teacherStatus: row?.teacher_status ?? "unverified",
        roleChosen: row?.role_set_at != null,
      };
    } catch {
      // Pre-0005 database: legacy account, picker still needed.
      return { role: "parent", teacherStatus: "unverified", roleChosen: false };
    }
  });

export const chooseRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { role: "parent" | "teacher" }) => input)
  .handler(async ({ context, data }) => {
    const choice = data.role;
    if (choice !== "parent" && choice !== "teacher") {
      throw new Error("Invalid role choice");
    }
    // Dev fallback: nothing to persist; the dev user is always a parent.
    if (context.userId === DEV_USER_ID) return { role: "parent" as const };
    const sql = await getSql();
    // One-time, fail-closed: only rows that never chose can choose.
    const result = await sql<{ id: string }>`
      update "user"
      set role = ${choice},
          teacher_status = ${choice === "teacher" ? "pending" : "unverified"},
          role_set_at = now()
      where id = ${context.userId} and role_set_at is null
      returning id
    `;
    if (result.length === 0) {
      throw new Error("Role already chosen");
    }
    return { role: choice };
  });
