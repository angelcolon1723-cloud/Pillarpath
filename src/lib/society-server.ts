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
import { importPrintifyBlueprints } from "@/lib/suppliers/catalog";
import { createPrintifyClientFromEnv } from "@/lib/suppliers/printify";
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

export interface BlueprintChoice {
  id: number;
  title: string;
  brand: string | null;
  description: string | null;
}

/** Search the Printify catalog by title (admin only). */
export const searchPrintifyBlueprints = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("admin")])
  .validator((input: { query: string }) => input)
  .handler(async ({ data }): Promise<{ blueprints: BlueprintChoice[] }> => {
    const q = data.query.trim().toLowerCase();
    if (q.length < 2) return { blueprints: [] };
    const client = createPrintifyClientFromEnv();
    if (!client) throw new Error("Printify is not connected (PRINTIFY_API_KEY missing).");
    const all = await client.listBlueprints();
    const matches = all
      .filter((b) => b.title.toLowerCase().includes(q))
      .slice(0, 30)
      .map((b) => ({
        id: b.id,
        title: b.title,
        brand: b.brand ?? null,
        description: (b.description ?? "").slice(0, 160) || null,
      }));
    return { blueprints: matches };
  });

/** Import chosen Printify blueprints through screening (admin only). */
export const importPrintifySelection = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("admin")])
  .validator((input: { blueprintIds: number[] }) => input)
  .handler(async ({ data }) => {
    const ids = [...new Set(data.blueprintIds)]
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 20);
    if (!ids.length) throw new Error("No blueprints selected.");
    const client = createPrintifyClientFromEnv();
    if (!client) throw new Error("Printify is not connected (PRINTIFY_API_KEY missing).");
    const result = await importPrintifyBlueprints(client, ids, { preferCountry: "US" });
    return result;
  });

/**
 * Backfill real fulfillment costs for imported Printify blueprints.
 *
 * The catalog variants endpoint sometimes omits pricing on the first pass;
 * this re-checks each cost-less Printify row and records the cheapest
 * available variant cost so retail pricing can be cost-plus instead of blind.
 * Admin only; read-only against Printify, updates our own DB.
 */
export const syncPrintifyCosts = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("admin")])
  .handler(async () => {
    const client = createPrintifyClientFromEnv();
    if (!client) throw new Error("Printify is not connected (PRINTIFY_API_KEY missing).");
    const sql = await getSql();
    const rows = await sql<{ id: number; title: string; supplier_product_id: string; supplier_sku: string | null }>`
      select id, title, supplier_product_id, supplier_sku
      from supplier_products
      where supplier = 'printify' and cost_cents is null
      limit 50`;
    let updated = 0;
    const missing: string[] = [];
    for (const row of rows) {
      const m =
        row.supplier_product_id.match(/blueprint:(\d+):provider:(\d+)/) ??
        row.supplier_sku?.match(/printify-(\d+)-(\d+)/);
      if (!m) {
        missing.push(row.title);
        continue;
      }
      try {
        const variants = await client.listVariants(Number(m[1]), Number(m[2]));
        const costs = variants
          .filter((v) => v.isAvailable && v.priceCents != null)
          .map((v) => v.priceCents as number);
        if (!costs.length) {
          missing.push(row.title);
          continue;
        }
        const minCost = Math.round(Math.min(...costs));
        await sql`update supplier_products set cost_cents = ${minCost}, updated_at = now() where id = ${row.id}`;
        updated += 1;
      } catch {
        missing.push(row.title);
      }
    }
    return { checked: rows.length, updated, missing };
  });

export const unpublishStockItem = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("admin")])
  .validator((input: { storeProductId: string }) => input)
  .handler(async ({ context, data }) => {
    await unpublishFromStorefront(data.storeProductId);
    await audit(context.identity.userId, "stock.unpublish", data.storeProductId);
    return { ok: true };
  });

/**
 * Create draft products in the Printify shop for every approved Printify
 * supplier row that doesn't have one yet. Drafts are NEVER published to a
 * sales channel — they exist so Printify reveals the real per-variant
 * fulfillment cost, which is backfilled into `cost_cents`.
 *
 * Each draft gets a PillarPath print design (served from /designs) placed
 * centered on the provider's print areas. One tap, admin only.
 */
const PRODUCTION_URL = "https://pillarpath.vercel.app";

function designForTitle(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("puzzle")) return "cosmic-rocket.png";
  if (t.includes("tumbler") || t.includes("mug") || t.includes("bottle"))
    return "earn-save-grow.png";
  if (
    t.includes("tee") || t.includes("shirt") || t.includes("hoodie") ||
    t.includes("sweatshirt") || t.includes("jersey") || t.includes("crewneck")
  )
    return "better-than-yesterday.png";
  return "society-of-becoming.png";
}

export const createPrintifyDrafts = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("admin")])
  .handler(async ({ context }) => {
    const client = createPrintifyClientFromEnv();
    if (!client) throw new Error("Printify is not connected (PRINTIFY_API_KEY missing).");
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      title: string;
      supplier_product_id: string;
      supplier_sku: string | null;
      compliance: Record<string, unknown> | null;
    }>`
      select id, title, supplier_product_id, supplier_sku, compliance
      from supplier_products
      where supplier = 'printify'
        and screening_status = 'approved'
        and (compliance is null or (compliance ->> 'printify_draft_product_id') is null)
      order by id
      limit 25`;
    if (!rows.length) return { created: 0, withCosts: 0, failed: [] as { title: string; error: string }[] };

    const shops = await client.listShops();
    if (!shops.length) throw new Error("No Printify shop found.");
    const shopId = shops[0].id;

    const failed: { title: string; error: string }[] = [];
    let created = 0;
    let withCosts = 0;

    for (const row of rows) {
      const m =
        row.supplier_product_id.match(/blueprint:(\d+):provider:(\d+)/) ??
        row.supplier_sku?.match(/printify-(\d+)-(\d+)/);
      if (!m) {
        failed.push({ title: row.title, error: "unknown blueprint/provider" });
        continue;
      }
      const blueprintId = Number(m[1]);
      const providerId = Number(m[2]);
      try {
        // 1. Upload the PillarPath design.
        const designFile = designForTitle(row.title);
        const uploadId = await client.uploadImageByUrl(
          designFile,
          `${PRODUCTION_URL}/designs/${designFile}`,
        );

        // 2. Variants + print areas for placement.
        const [variants, areas] = await Promise.all([
          client.listVariants(blueprintId, providerId),
          client.listPrintAreas(blueprintId, providerId).catch(() => []),
        ]);
        const enabled = variants.filter((v) => v.isAvailable);
        if (!enabled.length) throw new Error("no available variants");
        const variantIds = enabled.map((v) => v.id);
        const printAreas = (areas.length ? areas : [{ variantIds: [], positions: [] }]).map(
          (a) => ({
            variantIds: a.variantIds.length ? a.variantIds : variantIds,
            placeholders: (a.positions.length ? a.positions : ["front"]).map(
              (position) => ({
                position,
                images: [{ id: uploadId, x: 0.5, y: 0.5, scale: 0.55, angle: 0 }],
              }),
            ),
          }),
        );

        // 3. Create the draft (never published; price is a placeholder).
        const product = await client.createProduct(shopId, {
          title: `PillarPath — ${row.title} (draft)`,
          description:
            "PillarPath internal draft, created automatically for fulfillment-cost discovery. Not published to any sales channel.",
          blueprintId,
          printProviderId: providerId,
          variants: variantIds.map((id) => ({ id, price: 2500, isEnabled: true })),
          printAreas,
          tags: ["pillarpath-draft", "cost-discovery"],
        });

        // 4. Read back real fulfillment costs and backfill.
        const full = await client.getProduct(shopId, product.id);
        const costs = full.variants
          .map((v) => v.cost)
          .filter((c): c is number => c != null && c > 0);
        const compliance = {
          ...(row.compliance ?? {}),
          printify_draft_product_id: product.id,
          printify_draft_created_at: new Date().toISOString(),
        };
        if (costs.length) {
          const minCost = Math.round(Math.min(...costs));
          await sql`
            update supplier_products
            set cost_cents = ${minCost},
                compliance = ${JSON.stringify(compliance)}::jsonb,
                updated_at = now()
            where id = ${row.id}`;
          withCosts += 1;
        } else {
          await sql`
            update supplier_products
            set compliance = ${JSON.stringify(compliance)}::jsonb,
                updated_at = now()
            where id = ${row.id}`;
        }
        created += 1;
        await audit(context.identity.userId, "stock.printify_draft", row.title, {
          productId: product.id,
        });
      } catch (err) {
        failed.push({
          title: row.title,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return { created, withCosts, failed };
  });
