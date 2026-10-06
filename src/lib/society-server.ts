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

/**
 * Teacher verification review queue (admin only).
 *
 * Teachers choose their role post-signup and land here as `pending`;
 * the client teacher views gate student details / grades / family
 * messaging on `user.teacher_status = 'verified'`. These functions keep
 * `teacher_verifications` (the review record) and `user.teacher_status`
 * (the enforcement flag) in sync, and audit every decision.
 */

export interface TeacherVerificationRequest {
  teacherId: string;
  email: string | null;
  name: string | null;
  school: string;
  district: string;
  workEmail: string;
  notes: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
}

export const listTeacherVerifications = createServerFn({ method: "GET" })
  .middleware([roleMiddleware("admin")])
  .handler(async (): Promise<{ items: TeacherVerificationRequest[] }> => {
    const sql = await getSql();
    const rows = await sql<{
      teacher_id: string;
      email: string | null;
      name: string | null;
      school: string;
      district: string;
      work_email: string;
      notes: string;
      status: string;
      created_at: Date | string;
      reviewed_at: Date | string | null;
    }>`
      select tv.teacher_id,
             u.email,
             u.name,
             tv.school,
             tv.district,
             tv.work_email,
             tv.notes,
             tv.status,
             tv.created_at,
             tv.reviewed_at
      from teacher_verifications tv
      left join "user" u on u.id = tv.teacher_id
      order by case when tv.status = 'pending' then 0 else 1 end,
               tv.created_at desc`;
    return {
      items: rows.map((r) => ({
        teacherId: r.teacher_id,
        email: r.email,
        name: r.name,
        school: r.school,
        district: r.district,
        workEmail: r.work_email,
        notes: r.notes,
        status: r.status,
        createdAt: new Date(r.created_at).toISOString(),
        reviewedAt:
          r.reviewed_at == null ? null : new Date(r.reviewed_at).toISOString(),
      })),
    };
  });

export const reviewTeacherVerification = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("admin")])
  .validator((input: { teacherId: string; approve: boolean }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const status = data.approve ? "verified" : "rejected";
    // Fail-closed: only a row still `pending` can be decided; an already
    // reviewed row updates zero rows and throws.
    const updated = await sql<{ school: string }>`
      update teacher_verifications
      set status = ${status},
          reviewed_by = ${context.identity.userId},
          reviewed_at = now()
      where teacher_id = ${data.teacherId} and status = 'pending'
      returning school`;
    if (updated.length === 0) {
      throw new Error("This verification request is no longer pending.");
    }
    await sql`
      update "user" set teacher_status = ${status}
      where id = ${data.teacherId}`;
    await audit(
      context.identity.userId,
      data.approve ? "teacher.verify.approve" : "teacher.verify.reject",
      data.teacherId,
      { school: updated[0].school },
    );
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* CJ product sourcing — live catalog search + import to stockroom       */
/* ------------------------------------------------------------------ */

import { createCachedCjClient } from "@/lib/suppliers/cj-token-store";
import {
  cjDetailToImport,
  upsertSupplierProduct,
} from "@/lib/suppliers/catalog";

export interface CjSearchHit {
  pid: string;
  name: string;
  image: string;
  price: number;
  nowPrice: number | null;
  category: string | null;
  usStock: number;
  deliveryCycle: string | null;
}

/** Admin-only: search CJ's live catalog. US warehouse preferred for kids' products. */
export const searchCjProducts = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("admin")])
  .validator((input: { keyword: string; usOnly?: boolean; maxPrice?: number }) => input)
  .handler(async ({ data }): Promise<{ hits: CjSearchHit[]; total: number }> => {
    const kw = data.keyword.trim();
    if (!kw) return { hits: [], total: 0 };
    // NOTE: CJ's listV2 countryCode filter is broken server-side (returns
    // totalRecords>0 but empty productList). Fetch unfiltered and apply the
    // US-warehouse filter client-side on the product's countryCode field.
    const params = {
      keyWord: kw,
      size: 24,
      endSellPrice: data.maxPrice,
      orderBy: 4 as const,
      sort: "desc" as const,
    };
    const client = await createCachedCjClient();
    if (!client) throw new Error("CJ API key not configured.");
    let page;
    try {
      page = await client.searchProducts(params);
    } catch (e) {
      const { CjApiError } = await import("@/lib/suppliers/cjdropshipping");
      const cjErr = e instanceof CjApiError ? e : null;
      // Same stale-token trap as the connection test: nuke the DB cache
      // and retry with a brand-new client on 1600001.
      if (cjErr && String(cjErr.code) === "1600001") {
        const { clearCjToken } = await import("@/lib/suppliers/cj-token-store");
        await clearCjToken().catch(() => {});
        const fresh = await createCachedCjClient();
        if (!fresh) throw e;
        page = await fresh.searchProducts(params);
      } else {
        throw e;
      }
    }
    // The list endpoint is flaky and returns incomplete data. For each
    // product, fetch the full detail (reliable endpoint) in parallel.
    // Limit to 12 to keep it fast.
    const client2 = await createCachedCjClient();
    const detailHits = await Promise.all(
      page.items.slice(0, 12).map(async (p) => {
        try {
          const d = await client2!.getProductDetail(p.pid);
          return {
            pid: d.pid,
            name: d.nameEn,
            image: d.bigImage,
            price: d.sellPrice,
            nowPrice: d.nowPrice,
            category: d.categoryName,
            countryCode: d.countryCode,
            usStock: d.warehouseInventoryNum,
            deliveryCycle: d.deliveryCycle,
          };
        } catch {
          // Fall back to list data if detail fails.
          return {
            pid: p.pid,
            name: p.nameEn,
            image: p.bigImage,
            price: p.sellPrice,
            nowPrice: p.nowPrice,
            category: p.categoryName,
            countryCode: p.countryCode,
            usStock: p.countryCode === "US" ? p.warehouseInventoryNum : 0,
            deliveryCycle: p.deliveryCycle,
          };
        }
      }),
    );
    // Client-side US-warehouse filter (CJ's server-side filter is broken).
    // Permissive: only exclude products explicitly marked non-US. Products
    // with unknown warehouse (null countryCode) are included — King decides.
    const hits = data.usOnly === false
      ? detailHits
      : detailHits.filter((h) => h.countryCode === "US" || h.countryCode == null);
    return {
      total: data.usOnly === false ? page.total : hits.length,
      hits,
    };
  });

/** Admin-only: import chosen CJ products through kid-safety screening into the stockroom. */
export const importCjSelection = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("admin")])
  .validator((input: { pids: string[] }) => input)
  .handler(async ({ data }): Promise<{ imported: number; verdicts: string[] }> => {
    const client = await createCachedCjClient();
    if (!client) throw new Error("CJ API key not configured.");
    const pids = [...new Set(data.pids)].slice(0, 12);
    if (!pids.length) throw new Error("Pick at least one product.");
    const verdicts: string[] = [];
    let imported = 0;
    for (const pid of pids) {
      const detail = await client.getProductDetail(pid);
      const payload = cjDetailToImport(detail, { shipFromCountry: "US" });
      const row = await upsertSupplierProduct(payload);
      imported += 1;
      verdicts.push(`${detail.nameEn.slice(0, 40)}… → ${row.screening_status}`);
    }
    return { imported, verdicts };
  });
