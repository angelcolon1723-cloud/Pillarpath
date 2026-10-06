/**
 * Live stock sync — keeps the storefront's `stock_quantity` honest by
 * pulling real warehouse numbers from suppliers.
 *
 * Currently supports CJ Dropshipping (via getInventoryByPid). Printify
 * items are made-to-order and skipped. Eprolo is stubbed for later —
 * add its client here when the API key lands.
 *
 * This module is server-only — never import it from client code.
 */

import { getSql } from "@/lib/db";
import { createCachedCjClient } from "@/lib/suppliers/cj-token-store";
import type { CjWarehouseStock } from "@/lib/suppliers/cjdropshipping";

export interface StockSyncResult {
  checked: number;
  updated: number;
  zeroed: number;
  skipped: number;
  errors: { productId: string; name: string; error: string }[];
  /** Products now at 5 or fewer units (excluding zero). */
  lowStock: { productId: string; name: string; stock: number }[];
  startedAt: string;
  finishedAt: string;
}

interface SyncableProduct {
  storeProductId: string;
  name: string;
  supplier: string;
  supplierProductId: string; // the supplier-side PID
  currentStock: number | null;
}

/**
 * Collapse a warehouse-stock list into a single sellable number.
 * Prefers US warehouses; dedupes repeat warehouse entries (CJ sometimes
 * returns one row per variant per warehouse) by taking the max per
 * warehouse before summing.
 */
export function summarizeWarehouseStock(
  stocks: CjWarehouseStock[],
  preferCountry = "US",
): number | null {
  if (stocks.length === 0) return null;
  // Dedupe by warehouse: keep the max reported number per warehouse.
  const byWarehouse = new Map<string, number>();
  for (const s of stocks) {
    const key = `${s.countryCode}::${s.warehouseName}`.toLowerCase();
    const n = Math.max(0, Math.floor(s.totalInventoryNum));
    const prev = byWarehouse.get(key);
    if (prev == null || n > prev) byWarehouse.set(key, n);
  }
  const usEntries: [string, number][] = [];
  const otherEntries: [string, number][] = [];
  for (const [key, n] of byWarehouse) {
    if (key.startsWith(preferCountry.toLowerCase() + "::")) usEntries.push([key, n]);
    else otherEntries.push([key, n]);
  }
  const pool = usEntries.length > 0 ? usEntries : otherEntries;
  if (pool.length === 0) return null;
  return pool.reduce((sum, [, n]) => sum + n, 0);
}

/** All live CJ-sourced products on the shelf, with their CJ PIDs. */
async function getCjSyncableProducts(): Promise<SyncableProduct[]> {
  const sql = await getSql();
  const rows = await sql<{
    store_product_id: string;
    name: string;
    supplier: string;
    supplier_product_id: string;
    stock_quantity: number | null;
  }>`
    select
      st.id as store_product_id,
      st.name,
      sp.supplier,
      sp.supplier_product_id,
      st.stock_quantity
    from store_products st
    join supplier_products sp on sp.id = st.supplier_product_id
    where st.active = true
      and sp.supplier = 'cjdropshipping'
      and sp.supplier_product_id is not null
      and sp.supplier_product_id <> ''
    order by st.name`;
  return rows.map((r) => ({
    storeProductId: r.store_product_id,
    name: r.name,
    supplier: r.supplier,
    supplierProductId: r.supplier_product_id,
    currentStock: r.stock_quantity,
  }));
}

/**
 * Refresh `stock_quantity` for every live CJ product from CJ's real
 * warehouse numbers. Conservative: one product at a time (the CJ client
 * already paces at ~1 req/s), errors are logged per product and never
 * abort the run. A product whose live stock can't be determined keeps
 * its current number.
 */
export async function syncCjStock(): Promise<StockSyncResult> {
  const startedAt = new Date().toISOString();
  const result: StockSyncResult = {
    checked: 0,
    updated: 0,
    zeroed: 0,
    skipped: 0,
    errors: [],
    lowStock: [],
    startedAt,
    finishedAt: startedAt,
  };

  const client = await createCachedCjClient();
  if (!client) {
    result.errors.push({
      productId: "",
      name: "",
      error: "CJ API key not configured — sync skipped entirely.",
    });
    result.finishedAt = new Date().toISOString();
    return result;
  }

  const products = await getCjSyncableProducts();
  const sql = await getSql();

  for (const p of products) {
    result.checked += 1;
    try {
      const stocks = await client.getInventoryByPid(p.supplierProductId);
      const live = summarizeWarehouseStock(stocks, "US");
      if (live == null) {
        result.skipped += 1;
        continue;
      }
      if (live !== p.currentStock) {
        await sql`
          update store_products
          set stock_quantity = ${live}, updated_at = now()
          where id = ${p.storeProductId}`;
        // Keep the supplier row's import-time snapshot fresh too.
        await sql`
          update supplier_products
          set inventory = ${live}, updated_at = now()
          where supplier = 'cjdropshipping'
            and supplier_product_id = ${p.supplierProductId}`;
        result.updated += 1;
        if (live === 0) result.zeroed += 1;
      }
      if (live > 0 && live <= 5) {
        result.lowStock.push({ productId: p.storeProductId, name: p.name, stock: live });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push({ productId: p.storeProductId, name: p.name, error: msg });
    }
  }

  result.finishedAt = new Date().toISOString();
  return result;
}

/** Products on the live shelf at 5 or fewer units (for the Stockroom queue). */
export async function getLowStockProducts(): Promise<
  { storeProductId: string; name: string; stockQuantity: number; supplierName: string; imageUrl: string | null }[]
> {
  const sql = await getSql();
  const rows = await sql<{
    store_product_id: string;
    name: string;
    stock_quantity: number;
    supplier_name: string;
    image_url: string | null;
  }>`
    select st.id as store_product_id, st.name, st.stock_quantity,
           st.supplier_name, st.image_url
    from store_products st
    where st.active = true
      and st.stock_quantity is not null
      and st.stock_quantity <= 5
    order by st.stock_quantity asc, st.name asc`;
  return rows.map((r) => ({
    storeProductId: r.store_product_id,
    name: r.name,
    stockQuantity: r.stock_quantity,
    supplierName: r.supplier_name,
    imageUrl: r.image_url,
  }));
}

// ── Future suppliers ──────────────────────────────────────────────
// Eprolo: when EPROLO_API_KEY lands, add a syncEproloStock() here
// following the same shape (per-product live stock → store_products).
// Printify: intentionally never synced — made-to-order, no finite stock.
