/**
 * Society Network internals — server functions for the unlisted /society
 * stock page. Every privileged function requires the admin role
 * (server-resolved via roleMiddleware, never from client input).
 *
 * `claimSocietyAdmin` is the one-time bootstrap: if no admin account exists
 * yet, the currently signed-in user may claim it. The claim is written to
 * admin_audit_log. Phase 4 replaces this with invite-only admin onboarding.
 */

import { createServerFn } from "@tanstack/react-start";
import { authMiddleware, roleMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  DEFAULT_MARGIN_PCT,
  getStockOverview,
  publishSupplierProductToStorefront,
  setScreeningStatus,
  unpublishFromStorefront,
  type StockItem,
} from "@/lib/suppliers/publish";

async function audit(adminUserId: string, action: string, target?: string, meta: Record<string, unknown> = {}) {
  const sql = await getSql();
  await sql`
    insert into admin_audit_log (admin_user_id, action, target, meta)
    values (${adminUserId}, ${action}, ${target ?? null}, ${JSON.stringify(meta)}::jsonb)`;
}

export interface SocietyStatus {
  signedIn: boolean;
  isAdmin: boolean;
  adminExists: boolean;
}

export const getSocietyStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SocietyStatus> => {
    const sql = await getSql();
    const rows = await sql<{ role: string | null }>`
      select role from "user" where id = ${context.userId}`;
    const role = rows[0]?.role;
    const adminRows = await sql<{ n: string }>`
      select count(*)::text as n from "user" where role = 'admin'`;
    return {
      signedIn: true,
      isAdmin: role === "admin",
      adminExists: Number(adminRows[0]?.n ?? "0") > 0,
    };
  });

export const claimSocietyAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    const adminRows = await sql<{ n: string }>`
      select count(*)::text as n from "user" where role = 'admin'`;
    if (Number(adminRows[0]?.n ?? "0") > 0) {
      throw new Error("An admin account already exists.");
    }
    await sql`
      update "user" set role = 'admin', role_set_at = now()
      where id = ${context.userId}`;
    await audit(context.userId, "admin.claim", context.userId, { bootstrap: true });
    return { ok: true };
  });

export const getStock = createServerFn({ method: "GET" })
  .middleware([roleMiddleware("admin")])
  .handler(async (): Promise<{ items: StockItem[]; defaultMarginPct: number }> => {
    return { items: await getStockOverview(), defaultMarginPct: DEFAULT_MARGIN_PCT };
  });

export const approveStockItem = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("admin")])
  .validator((input: { id: number }) => input)
  .handler(async ({ context, data }) => {
    await setScreeningStatus(data.id, "approved", context.identity.userId);
    await audit(context.identity.userId, "stock.approve", String(data.id));
    return { ok: true };
  });

export const rejectStockItem = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("admin")])
  .validator((input: { id: number }) => input)
  .handler(async ({ context, data }) => {
    await setScreeningStatus(data.id, "rejected", context.identity.userId);
    await audit(context.identity.userId, "stock.reject", String(data.id));
    return { ok: true };
  });

export const publishStockItem = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("admin")])
  .validator((input: { id: number; marginPct?: number; retailPriceCents?: number }) => input)
  .handler(async ({ context, data }) => {
    const row = await publishSupplierProductToStorefront(data.id, {
      marginPct: data.marginPct,
      retailPriceCents: data.retailPriceCents,
      publishedBy: context.identity.userId,
    });
    await audit(context.identity.userId, "stock.publish", String(data.id), {
      storeProductId: row.id,
      retailPriceCents: row.retail_price_cents,
      marginPct: row.margin_pct,
    });
    return { ok: true, storeProductId: row.id };
  });

export const unpublishStockItem = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("admin")])
  .validator((input: { storeProductId: string }) => input)
  .handler(async ({ context, data }) => {
    await unpublishFromStorefront(data.storeProductId);
    await audit(context.identity.userId, "stock.unpublish", data.storeProductId);
    return { ok: true };
  });
