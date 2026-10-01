/**
 * Supplier catalog persistence (server-only).
 *
 * CRUD helpers over `supplier_products` / `supplier_orders`
 * (migrations/0004_supplier_catalog.sql). The ingestion pipeline is:
 *
 *   CJ API → upsertSupplierProduct() → screenProduct() →
 *   recordScreening() → (admin approves quarantined rows) → storefront.
 */

import { getSql } from "@/lib/db";
import type {
  CjProductDetail,
  CjVariant,
  CjWarehouseStock,
} from "@/lib/suppliers/cjdropshipping";
import type { ScreeningResult, ScreeningVerdict } from "@/lib/suppliers/screening";

if (typeof window !== "undefined") {
  throw new Error(
    "@/lib/suppliers/catalog is server-only — never import it from client code.",
  );
}

export interface SupplierProductRow {
  id: number;
  supplier: string;
  supplier_product_id: string;
  supplier_sku: string | null;
  title: string;
  description: string | null;
  images: string[];
  cost_cents: number | null;
  currency: string;
  category_id: string | null;
  category_name: string | null;
  variants: CjVariant[];
  warehouse_country: string | null;
  ship_from_country: string | null;
  inventory: number | null;
  compliance: Record<string, unknown>;
  screening_status: ScreeningVerdict | "pending";
  screening_reasons: unknown[];
  screening_provider: string | null;
  screened_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportProductInput {
  supplier?: string;
  supplierProductId: string;
  supplierSku?: string | null;
  title: string;
  description?: string | null;
  images?: string[];
  costCents?: number | null;
  currency?: string;
  categoryId?: string | null;
  categoryName?: string | null;
  variants?: unknown[];
  shipFromCountry?: string | null;
  inventory?: number | null;
  compliance?: Record<string, unknown>;
}

/** Insert or refresh a supplier product. Screening status is never reset by re-import. */
export async function upsertSupplierProduct(
  input: ImportProductInput,
): Promise<SupplierProductRow> {
  const sql = await getSql();
  const rows = await sql<SupplierProductRow>`
    insert into supplier_products (
      supplier, supplier_product_id, supplier_sku, title, description, images,
      cost_cents, currency, category_id, category_name, variants,
      ship_from_country, inventory, compliance, updated_at
    ) values (
      ${input.supplier ?? "cjdropshipping"},
      ${input.supplierProductId},
      ${input.supplierSku ?? null},
      ${input.title},
      ${input.description ?? null},
      ${JSON.stringify(input.images ?? [])}::jsonb,
      ${input.costCents ?? null},
      ${input.currency ?? "USD"},
      ${input.categoryId ?? null},
      ${input.categoryName ?? null},
      ${JSON.stringify(input.variants ?? [])}::jsonb,
      ${input.shipFromCountry ?? null},
      ${input.inventory ?? null},
      ${JSON.stringify(input.compliance ?? {})}::jsonb,
      now()
    )
    on conflict (supplier, supplier_product_id) do update set
      supplier_sku = excluded.supplier_sku,
      title = excluded.title,
      description = excluded.description,
      images = excluded.images,
      cost_cents = excluded.cost_cents,
      currency = excluded.currency,
      category_id = excluded.category_id,
      category_name = excluded.category_name,
      variants = excluded.variants,
      ship_from_country = excluded.ship_from_country,
      inventory = excluded.inventory,
      compliance = excluded.compliance,
      updated_at = now()
    returning *`;
  return rows[0];
}

/** Build an import payload from a CJ product detail response. */
export function cjDetailToImport(
  detail: CjProductDetail,
  opts: { shipFromCountry?: string } = {},
): ImportProductInput {
  const usStock: CjWarehouseStock | undefined = detail.warehouseStocks.find(
    (w) => w.countryCode === (opts.shipFromCountry ?? "US"),
  );
  const stock = usStock ?? detail.warehouseStocks[0];
  const cheapest = detail.variants.length
    ? Math.min(...detail.variants.map((v) => v.variantSellPrice))
    : detail.sellPrice;
  return {
    supplier: "cjdropshipping",
    supplierProductId: detail.pid,
    supplierSku: detail.sku || null,
    title: detail.nameEn,
    description: detail.description || null,
    images: detail.images,
    costCents: Math.round(cheapest * 100),
    currency: "USD",
    categoryId: detail.categoryId,
    categoryName: detail.categoryName,
    variants: detail.variants,
    shipFromCountry: stock?.countryCode ?? opts.shipFromCountry ?? "US",
    inventory: stock?.totalInventoryNum ?? detail.warehouseInventoryNum ?? null,
    compliance: {
      safetyCertMentioned: /cpsia|astm|en\s*71|cpc|phthalate|bpa[\s-]*free|non[\s-]*toxic/i.test(
        `${detail.nameEn} ${detail.description}`,
      ),
    },
  };
}

/** Persist a screening verdict onto a supplier product row. */
export async function recordScreening(
  supplier: string,
  supplierProductId: string,
  result: ScreeningResult,
  reviewedBy: string | null = null,
): Promise<void> {
  const sql = await getSql();
  await sql`
    update supplier_products
    set screening_status = ${result.verdict},
        screening_reasons = ${JSON.stringify(result.reasons)}::jsonb,
        screening_provider = ${result.provider},
        screened_at = ${result.checkedAt},
        reviewed_by = ${reviewedBy},
        updated_at = now()
    where supplier = ${supplier} and supplier_product_id = ${supplierProductId}`;
}

/** Products awaiting screening, oldest first. */
export async function getPendingScreening(limit = 50): Promise<SupplierProductRow[]> {
  const sql = await getSql();
  return sql<SupplierProductRow>`
    select * from supplier_products
    where screening_status = 'pending'
    order by created_at asc
    limit ${limit}`;
}

/** Products awaiting human review. */
export async function getQuarantined(limit = 50): Promise<SupplierProductRow[]> {
  const sql = await getSql();
  return sql<SupplierProductRow>`
    select * from supplier_products
    where screening_status = 'quarantined'
    order by screened_at desc
    limit ${limit}`;
}

/** Human override of a screening verdict (records who decided). */
export async function reviewProduct(
  supplier: string,
  supplierProductId: string,
  verdict: Extract<ScreeningVerdict, "approved" | "rejected">,
  reviewedBy: string,
  note?: string,
): Promise<void> {
  const sql = await getSql();
  const reasons = note
    ? [{ code: "human_review", message: note, severity: "info" as const }]
    : [];
  await sql`
    update supplier_products
    set screening_status = ${verdict},
        screening_reasons = ${JSON.stringify(reasons)}::jsonb,
        screening_provider = 'human',
        screened_at = now(),
        reviewed_by = ${reviewedBy},
        updated_at = now()
    where supplier = ${supplier} and supplier_product_id = ${supplierProductId}`;
}

/** Link a PillarPath order to its supplier fulfillment order. */
export async function recordSupplierOrder(opts: {
  orderId: number;
  supplier?: string;
  supplierOrderId: string;
  supplierOrderNumber?: string | null;
  status?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into supplier_orders (
      order_id, supplier, supplier_order_id, supplier_order_number, status, payload, updated_at
    ) values (
      ${opts.orderId},
      ${opts.supplier ?? "cjdropshipping"},
      ${opts.supplierOrderId},
      ${opts.supplierOrderNumber ?? null},
      ${opts.status ?? "pending"},
      ${JSON.stringify(opts.payload ?? {})}::jsonb,
      now()
    )
    on conflict (supplier, supplier_order_id) do update set
      status = excluded.status,
      supplier_order_number = excluded.supplier_order_number,
      payload = excluded.payload,
      updated_at = now()`;
}
