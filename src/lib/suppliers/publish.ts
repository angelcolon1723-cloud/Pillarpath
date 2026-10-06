/**
 * Storefront publishing (server-only).
 *
 * Moves screened supplier products onto the live shelves (`store_products`).
 * Only `supplier_products` rows with screening_status='approved' may be
 * published — this is the hard gate between the supplier engine and what
 * families can buy. Admin (Society Network) decides retail pricing at
 * publish time; the margin used is recorded on the row.
 *
 * Currency convention: 100 Units = $1.00, so unit_price (Units) equals
 * retail_price_cents numerically.
 */

import { getSql } from "@/lib/db";
import type { SupplierProductRow } from "@/lib/suppliers/catalog";
import { suggestRetailPrice } from "@/lib/suppliers/pricing";

if (typeof window !== "undefined") {
  throw new Error(
    "@/lib/suppliers/publish is server-only — never import it from client code.",
  );
}

export const DEFAULT_MARGIN_PCT = 40;

const SUPPLIER_LABELS: Record<string, string> = {
  cjdropshipping: "CJ Dropshipping",
  printify: "Printify",
};

export function supplierLabel(supplier: string): string {
  return SUPPLIER_LABELS[supplier] ?? supplier;
}

export interface PublishOptions {
  /** Percent markup over supplier cost. Defaults to 40. Ignored when retailPriceCents is set. */
  marginPct?: number;
  /** Explicit retail price (cents); overrides the margin computation. */
  retailPriceCents?: number;
  /** How many units to stock in the store. Defaults to 50. */
  stockQuantity?: number;
  /** Admin user id recording the publish. */
  publishedBy?: string | null;
}

export interface StoreProductRow {
  id: string;
  name: string;
  description: string;
  category: string;
  image_url: string | null;
  unit_price: number;
  retail_price_cents: number;
  supplier_name: string;
  supplier_sku: string;
  active: boolean;
  inventory: number;
  supplier_product_id: number | null;
  published_at: string | null;
  margin_pct: number | null;
}

function storefrontId(row: SupplierProductRow): string {
  return `sp-${row.supplier}-${row.supplier_product_id}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

export async function publishSupplierProductToStorefront(
  supplierProductId: number,
  opts: PublishOptions = {},
): Promise<StoreProductRow> {
  const sql = await getSql();
  const rows = await sql<SupplierProductRow>`
    select * from supplier_products where id = ${supplierProductId}`;
  const product = rows[0];
  if (!product) throw new Error("Supplier product not found.");
  if (product.screening_status !== "approved") {
    throw new Error(
      `Only approved products can be published (current status: ${product.screening_status}).`,
    );
  }

  let retailPriceCents = opts.retailPriceCents;
  let marginPct = opts.marginPct ?? DEFAULT_MARGIN_PCT;
  if (retailPriceCents == null) {
    if (product.cost_cents == null || product.cost_cents <= 0) {
      throw new Error(
        "No supplier cost on record — set an explicit retail price to publish.",
      );
    }
    // Automatic market-aware pricing: cost-plus, clamped to the typical
    // market band for the product's category.
    retailPriceCents = suggestRetailPrice(
      product.title,
      product.cost_cents,
      marginPct,
    ).cents;
  } else {
    marginPct =
      product.cost_cents != null && product.cost_cents > 0
        ? Math.round(((retailPriceCents - product.cost_cents) / product.cost_cents) * 100)
        : 0;
  }
  if (retailPriceCents <= 0) throw new Error("Retail price must be positive.");

  const id = storefrontId(product);
  const images = Array.isArray(product.images) ? product.images : [];
  const imageUrl = typeof images[0] === "string" ? images[0] : null;
  const description =
    (product.description ?? "").trim().slice(0, 500) ||
    `${product.title} — curated for PillarPath families.`;
  const category = product.category_name?.trim() || "Kids";

  const result = await sql<StoreProductRow>`
    insert into store_products (
      id, name, description, category, image_url, unit_price,
      retail_price_cents, supplier_name, supplier_sku, active, inventory,
      supplier_product_id, published_at, margin_pct, stock_quantity
    ) values (
      ${id}, ${product.title}, ${description}, ${category}, ${imageUrl},
      ${retailPriceCents}, ${retailPriceCents},
      ${supplierLabel(product.supplier)}, ${product.supplier_sku ?? product.supplier_product_id},
      true, ${product.inventory ?? 100},
      ${product.id}, now(), ${marginPct}, ${opts.stockQuantity ?? 50}
    )
    on conflict (id) do update set
      name = excluded.name,
      description = excluded.description,
      category = excluded.category,
      image_url = excluded.image_url,
      unit_price = excluded.unit_price,
      retail_price_cents = excluded.retail_price_cents,
      supplier_name = excluded.supplier_name,
      supplier_sku = excluded.supplier_sku,
      active = true,
      inventory = excluded.inventory,
      supplier_product_id = excluded.supplier_product_id,
      published_at = now(),
      stock_quantity = excluded.stock_quantity,
      margin_pct = excluded.margin_pct
    returning *`;
  return result[0];
}

export async function unpublishFromStorefront(storeProductId: string): Promise<void> {
  const sql = await getSql();
  await sql`update store_products set active = false where id = ${storeProductId}`;
}

export interface StockRow extends SupplierProductRow {
  store_product_id: string | null;
  store_active: boolean | null;
  store_retail_cents: number | null;
}

/**
 * Serializable projection of a StockRow for the internal stock page.
 * Drops free-form jsonb columns (variants, compliance) that the UI
 * doesn't need and that TanStack server functions won't serialize.
 */
export interface StockItem {
  id: number;
  supplier: string;
  supplier_product_id: string;
  supplier_sku: string | null;
  title: string;
  images: string[];
  cost_cents: number | null;
  category_name: string | null;
  ship_from_country: string | null;
  inventory: number | null;
  screening_status: string;
  screening_reasons: string[];
  store_product_id: string | null;
  store_active: boolean | null;
  store_retail_cents: number | null;
}

/** Every supplier product with its storefront state, for the internal stock page. */
export async function getStockOverview(): Promise<StockItem[]> {
  const sql = await getSql();
  const rows = await sql<StockRow>`
    select sp.*,
      st.id as store_product_id,
      st.active as store_active,
      st.retail_price_cents as store_retail_cents
    from supplier_products sp
    left join store_products st on st.supplier_product_id = sp.id
    order by sp.screening_status, sp.updated_at desc`;
  return rows.map((r) => ({
    id: r.id,
    supplier: r.supplier,
    supplier_product_id: r.supplier_product_id,
    supplier_sku: r.supplier_sku,
    title: r.title,
    images: Array.isArray(r.images) ? r.images.filter((i): i is string => typeof i === "string") : [],
    cost_cents: r.cost_cents,
    category_name: r.category_name,
    ship_from_country: r.ship_from_country,
    inventory: r.inventory,
    screening_status: r.screening_status,
    screening_reasons: Array.isArray(r.screening_reasons)
      ? r.screening_reasons.map((reason) => {
          if (typeof reason === "string") return reason;
          if (reason && typeof reason === "object") {
            const rec = reason as Record<string, unknown>;
            const message = typeof rec.message === "string" ? rec.message : "";
            const code = typeof rec.code === "string" ? rec.code : "";
            return message || code || "flagged";
          }
          return String(reason);
        })
      : [],
    store_product_id: r.store_product_id,
    store_active: r.store_active,
    store_retail_cents: r.store_retail_cents,
  }));
}

export async function setScreeningStatus(
  supplierProductId: number,
  status: "approved" | "rejected",
  reviewedBy?: string | null,
): Promise<void> {
  const sql = await getSql();
  await sql`
    update supplier_products
    set screening_status = ${status},
        reviewed_by = ${reviewedBy ?? null},
        updated_at = now()
    where id = ${supplierProductId}`;
}
