/**
 * Eprolo dropshipping API client (server-only).
 *
 * Covers catalog ingestion (product search/list/detail) and order
 * fulfillment (order creation, order detail/tracking).
 *
 * Auth: static API key sent as `Authorization: Bearer <key>` on every
 * request. The key is issued by Eprolo's support team (dashboard message
 * box → "request API access") and plugged in via `EPROLO_API_KEY`. Unlike
 * CJ there is no token exchange or refresh flow.
 *
 * API doc: issued per-account by Eprolo support (no public docs).
 * Base URL: https://api.eprolo.com/v1
 *
 * ⚠️ ENDPOINT VERIFICATION STATUS (2026-10-06):
 *   - POST /v1/orders with Bearer auth — CONFIRMED by a working community
 *     integration (github.com/hyperflowoffical-maker/cj-dropshipping-store).
 *   - GET /v1/products (search/list), GET /v1/products/{id} (detail),
 *     GET /v1/orders/{id}, GET /v1/orders (list), GET /v1/categories —
 *     ASSUMED RESTful shapes. Eprolo's official API document (issued by
 *     their support rep after signup) is the source of truth; adjust the
 *     ENDPOINT constants below the moment the real doc lands.
 *
 * The response mapping is intentionally defensive: every mapper tries a
 * list of candidate field names so a slightly different payload shape
 * still maps cleanly. Unknown envelope shapes are unwrapped like CJ's
 * (prefer a non-empty `data`/`result` object).
 */

const EPROLO_BASE_URL = "https://api.eprolo.com/v1";

/**
 * Endpoint paths. Adjust against Eprolo's official API document —
 * only createOrder is verified against a live integration.
 */
const ENDPOINTS = {
  productSearch: "/products",
  productDetail: (id: string) => `/products/${encodeURIComponent(id)}`,
  categories: "/categories",
  createOrder: "/orders",
  orderDetail: (id: string) => `/orders/${encodeURIComponent(id)}`,
  orderList: "/orders",
} as const;

// Conservative pacing; Eprolo publishes no rate limits for the API.
const MIN_REQUEST_INTERVAL_MS = 1100;
const MAX_RETRIES = 3;

if (typeof window !== "undefined") {
  throw new Error(
    "@/lib/suppliers/eprolo is server-only — never import it from client code.",
  );
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface EproloConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface EproloPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EproloProductSummary {
  id: string;
  title: string;
  sku: string | null;
  image: string | null;
  /** Cheapest listed cost in USD. */
  price: number;
  categoryId: string | null;
  categoryName: string | null;
  /** Total sellable inventory across warehouses (best-effort). */
  inventory: number;
  /** US-warehouse inventory when the API reports it. */
  usStock: number;
  /** Warehouse country code when the API reports it (e.g. "US"). */
  warehouseCountry: string | null;
  deliveryEstimate: string | null;
}

export interface EproloVariant {
  id: string;
  sku: string | null;
  name: string;
  price: number;
  inventory: number;
  image: string | null;
}

export interface EproloWarehouseStock {
  warehouseName: string;
  countryCode: string;
  inventory: number;
}

export interface EproloProductDetail extends EproloProductSummary {
  description: string;
  images: string[];
  variants: EproloVariant[];
  warehouseStocks: EproloWarehouseStock[];
}

export interface EproloProductSearchParams {
  keyword?: string;
  page?: number;
  pageSize?: number;
  categoryId?: string;
  /** Prefer items stocked in this warehouse country, e.g. "US". */
  warehouseCountry?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface EproloCategory {
  id: string;
  name: string;
  parentId: string | null;
}

export interface EproloOrderItemInput {
  productId: string;
  /** Variant id when the product has variants. */
  variantId?: string;
  quantity: number;
}

export interface EproloShippingAddress {
  countryCode: string;
  country: string;
  province: string;
  city: string;
  address: string;
  customerName: string;
  phone: string;
  email?: string;
  zipCode?: string;
}

export interface EproloCreateOrderInput {
  /** Our unique order reference (idempotency key on our side). */
  orderNumber: string;
  address: EproloShippingAddress;
  items: EproloOrderItemInput[];
}

export interface EproloOrder {
  orderId: string;
  orderNumber: string;
  status: string;
  trackingNumber: string | null;
}

/** Thrown for Eprolo API failures (HTTP or business-level errors). */
export class EproloApiError extends Error {
  readonly code: string | number | null;
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(
    message: string,
    opts: { code?: string | number | null; status?: number | null; retryable?: boolean } = {},
  ) {
    super(message);
    this.name = "EproloApiError";
    this.code = opts.code ?? null;
    this.status = opts.status ?? null;
    this.retryable = opts.retryable ?? false;
  }
}

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/** First non-empty string among the candidate fields of a record. */
function pickStr(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) return v;
    if (v != null && typeof v !== "object") {
      const s = String(v);
      if (s.trim()) return s;
    }
  }
  return "";
}

/** First finite number among the candidate fields of a record. */
function pickNum(raw: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v.replace(/[^0-9.\-]/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export class EproloClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private lastRequestAt = 0;

  constructor(config: EproloConfig) {
    if (!config.apiKey) throw new Error("EproloClient requires an API key");
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? EPROLO_BASE_URL).replace(/\/$/, "");
  }

  /* ---------------- request plumbing ---------------- */

  private async pace(): Promise<void> {
    const wait = MIN_REQUEST_INTERVAL_MS - (Date.now() - this.lastRequestAt);
    if (wait > 0) await sleep(wait);
    this.lastRequestAt = Date.now();
  }

  private async parseEnvelope<T>(res: Response, op: string): Promise<T> {
    const body = (await res.json().catch(() => null)) as {
      code?: number | string;
      success?: boolean;
      status?: string;
      message?: string;
      msg?: string;
      error?: string;
      result?: unknown;
      data?: unknown;
    } | null;
    const code = body?.code;
    const ok =
      res.ok &&
      (code === 200 || code === "200" || code === 0 || code === "0" ||
        body?.success === true ||
        body?.status === "success" ||
        body == null /* empty 200 */);
    if (!ok || body === undefined) {
      const retryable = res.status === 429 || res.status >= 500;
      const message =
        body?.message ?? body?.msg ?? body?.error ?? `HTTP ${res.status}`;
      throw new EproloApiError(`Eprolo ${op} failed: ${message}`, {
        code: code ?? null,
        status: res.status,
        retryable,
      });
    }
    return unwrapEproloEnvelope(body) as T;
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    opts: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }

    let attempt = 0;
    for (;;) {
      await this.pace();
      let res: Response;
      try {
        res = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        });
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          attempt += 1;
          await sleep(500 * 2 ** attempt);
          continue;
        }
        throw new EproloApiError(
          `Eprolo ${method} ${path} network error: ${err instanceof Error ? err.message : String(err)}`,
          { retryable: true },
        );
      }

      try {
        return await this.parseEnvelope<T>(res, `${method} ${path}`);
      } catch (err) {
        if (err instanceof EproloApiError && err.retryable && attempt < MAX_RETRIES) {
          attempt += 1;
          await sleep(500 * 2 ** attempt);
          continue;
        }
        throw err;
      }
    }
  }

  /* ---------------- products ---------------- */

  /**
   * Search the Eprolo product catalog.
   * NOTE: endpoint + query params are the assumed RESTful shape — verify
   * against Eprolo's official API document.
   */
  async searchProducts(params: EproloProductSearchParams = {}): Promise<EproloPage<EproloProductSummary>> {
    const raw = await this.request<Record<string, unknown>>("GET", ENDPOINTS.productSearch, {
      query: {
        // Send several common spellings; unknown params are ignored by the API.
        keyword: params.keyword,
        q: params.keyword,
        search: params.keyword,
        page: params.page ?? 1,
        page_size: Math.min(Math.max(params.pageSize ?? 24, 1), 100),
        per_page: Math.min(Math.max(params.pageSize ?? 24, 1), 100),
        limit: Math.min(Math.max(params.pageSize ?? 24, 1), 100),
        category_id: params.categoryId,
        warehouse_country: params.warehouseCountry,
        country: params.warehouseCountry,
        min_price: params.minPrice,
        max_price: params.maxPrice,
      },
    });
    const { items, total, page, pageSize } = extractList(raw);
    const mapped = items.map(mapProductSummary).filter((p) => p.id);
    return {
      items: mapped,
      total: total ?? mapped.length,
      page: page ?? params.page ?? 1,
      pageSize: pageSize ?? mapped.length,
    };
  }

  /**
   * Full product detail (variants, images, warehouse stock).
   * NOTE: endpoint shape assumed — verify against the official doc.
   */
  async getProductDetail(id: string): Promise<EproloProductDetail> {
    const raw = await this.request<Record<string, unknown>>(
      "GET",
      ENDPOINTS.productDetail(id),
    );
    const payload =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? raw
        : { id };
    const summary = mapProductSummary(payload);
    const images = collectImages(payload);
    const variantsRaw = firstArray(payload, "variants", "skus", "options", "variant_list");
    const variants = variantsRaw.map(mapVariant);
    const stocksRaw = firstArray(
      payload,
      "warehouseStocks",
      "warehouses",
      "inventory_list",
      "stock_list",
    );
    const warehouseStocks = stocksRaw.map(mapWarehouseStock);
    return {
      ...summary,
      description: stripHtml(pickStr(payload, "description", "desc", "detail", "content")),
      images,
      variants,
      warehouseStocks,
      // Recompute US stock from the warehouse breakdown when available.
      usStock: pickUsStock(warehouseStocks, summary.usStock),
    };
  }

  /** Category tree for browsing. NOTE: endpoint shape assumed — verify. */
  async getCategories(): Promise<EproloCategory[]> {
    const raw = await this.request<Record<string, unknown>>("GET", ENDPOINTS.categories);
    const { items } = extractList(raw);
    return items.map((r) => ({
      id: pickStr(r, "id", "category_id", "cat_id"),
      name: pickStr(r, "name", "title", "category_name"),
      parentId: (() => {
        const p = pickStr(r, "parent_id", "parentId");
        return p || null;
      })(),
    })).filter((c) => c.id);
  }

  /* ---------------- orders ---------------- */

  /**
   * Create a fulfillment order. Endpoint confirmed by a working community
   * integration; field names follow that example. Moves real money —
   * use deliberately.
   */
  async createOrder(input: EproloCreateOrderInput): Promise<EproloOrder> {
    if (!input.items.length) throw new EproloApiError("createOrder requires at least one item");
    for (const item of input.items) {
      if (!item.productId || item.quantity <= 0) {
        throw new EproloApiError("createOrder items need a productId and quantity > 0");
      }
    }
    const a = input.address;
    const raw = await this.request<Record<string, unknown>>("POST", ENDPOINTS.createOrder, {
      body: {
        order_number: input.orderNumber,
        reference: input.orderNumber,
        product_id: input.items[0]?.productId,
        quantity: input.items.reduce((n, i) => n + i.quantity, 0),
        items: input.items.map((i) => ({
          product_id: i.productId,
          variant_id: i.variantId,
          quantity: i.quantity,
        })),
        shipping_address: {
          name: a.customerName,
          phone: a.phone,
          email: a.email,
          country: a.country,
          country_code: a.countryCode,
          province: a.province,
          state: a.province,
          city: a.city,
          address: a.address,
          address_line1: a.address,
          zip: a.zipCode,
          zipcode: a.zipCode,
          postal_code: a.zipCode,
        },
      },
    });
    return {
      orderId: pickStr(raw, "order_id", "id", "orderId", "eprolo_order_id"),
      orderNumber: input.orderNumber,
      status: pickStr(raw, "status", "order_status") || "CREATED",
      trackingNumber: pickStr(raw, "tracking_number", "trackingNumber") || null,
    };
  }

  /** Order detail / tracking. NOTE: endpoint shape assumed — verify. */
  async getOrderDetail(orderId: string): Promise<Record<string, unknown>> {
    return this.request("GET", ENDPOINTS.orderDetail(orderId));
  }

  /** List orders. NOTE: endpoint shape assumed — verify. */
  async listOrders(page = 1, pageSize = 20): Promise<EproloPage<Record<string, unknown>>> {
    const raw = await this.request<Record<string, unknown>>("GET", ENDPOINTS.orderList, {
      query: { page, page_size: pageSize, per_page: pageSize, limit: pageSize },
    });
    const { items, total } = extractList(raw);
    return { items, total: total ?? items.length, page, pageSize };
  }
}

/** Pick the payload out of Eprolo's envelope (data/result wrapper). */
function unwrapEproloEnvelope(body: {
  result?: unknown;
  data?: unknown;
} | null): unknown {
  if (!body || typeof body !== "object") return {};
  const isPayload = (v: unknown) =>
    typeof v === "object" && v !== null && Object.keys(v).length > 0;
  // Prefer a non-empty object; fall back to the raw body so list-shaped
  // responses (bare arrays) still work.
  if (isPayload(body.data)) return body.data;
  if (isPayload(body.result)) return body.result;
  if (Array.isArray(body.data) && body.data.length) return body.data;
  if (Array.isArray(body.result) && body.result.length) return body.result;
  return body;
}

/** Pull a list + pagination out of the many shapes list endpoints use. */
function extractList(raw: Record<string, unknown>): {
  items: Record<string, unknown>[];
  total: number | null;
  page: number | null;
  pageSize: number | null;
} {
  const asRecords = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];
  const candidates: Array<[unknown, Record<string, unknown> | null]> = [
    [raw.products, null],
    [raw.items, null],
    [raw.list, null],
    [(raw.data as Record<string, unknown> | undefined)?.products, raw.data as Record<string, unknown>],
    [(raw.data as Record<string, unknown> | undefined)?.list, raw.data as Record<string, unknown>],
    [(raw.data as Record<string, unknown> | undefined)?.items, raw.data as Record<string, unknown>],
    [Array.isArray(raw) ? raw : null, null],
  ];
  let items: Record<string, unknown>[] = [];
  let holder: Record<string, unknown> | null = raw;
  for (const [cand, h] of candidates) {
    const arr = asRecords(cand);
    if (arr.length) {
      items = arr;
      holder = h ?? raw;
      break;
    }
  }
  const h = holder ?? {};
  const total =
    pickNum(h, "total", "total_count", "totalCount", "count", "total_records") ??
    pickNum(raw, "total", "total_count", "totalCount", "count", "total_records");
  const page = pickNum(h, "page", "page_num", "current_page") ?? pickNum(raw, "page", "page_num");
  const pageSize =
    pickNum(h, "page_size", "per_page", "limit", "pageSize") ??
    pickNum(raw, "page_size", "per_page", "limit");
  return { items, total, page, pageSize };
}

/** First non-empty array among candidate fields. */
function firstArray(raw: Record<string, unknown>, ...keys: string[]): Record<string, unknown>[] {
  for (const k of keys) {
    const v = raw[k];
    if (Array.isArray(v)) {
      const recs = v.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
      if (recs.length) return recs;
    }
  }
  return [];
}

function pickUsStock(stocks: EproloWarehouseStock[], fallback: number): number {
  const us = stocks.find((s) => s.countryCode.toUpperCase() === "US");
  if (us) return us.inventory;
  return fallback;
}

/* ------------------------------------------------------------------ */
/* Response mapping                                                    */
/* ------------------------------------------------------------------ */

function mapProductSummary(raw: Record<string, unknown>): EproloProductSummary {
  const id = pickStr(raw, "id", "product_id", "pid", "goods_id", "spu_id");
  const variantsRaw = firstArray(raw, "variants", "skus", "options");
  const variantPrices = variantsRaw
    .map((v) => pickNum(v, "price", "sell_price", "cost", "wholesale_price"))
    .filter((n): n is number => n != null && n > 0);
  const price =
    pickNum(raw, "price", "sell_price", "cost", "wholesale_price", "min_price") ??
    (variantPrices.length ? Math.min(...variantPrices) : 0);
  const stocksRaw = firstArray(raw, "warehouseStocks", "warehouses", "inventory_list", "stock_list");
  const warehouseStocks = stocksRaw.map(mapWarehouseStock);
  const usStock = pickUsStock(
    warehouseStocks,
    pickNum(raw, "us_stock", "usStock", "us_inventory") ?? 0,
  );
  const inventory =
    pickNum(raw, "inventory", "stock", "total_inventory", "quantity") ??
    warehouseStocks.reduce((n, w) => n + w.inventory, 0);
  return {
    id,
    title: pickStr(raw, "title", "name", "product_name", "goods_name"),
    sku: pickStr(raw, "sku", "product_sku", "goods_sku") || null,
    image: firstImage(raw),
    price,
    categoryId: pickStr(raw, "category_id", "categoryId", "cat_id") || null,
    categoryName: pickStr(raw, "category_name", "categoryName", "category", "cat_name") || null,
    inventory,
    usStock,
    warehouseCountry: pickStr(raw, "warehouse_country", "country_code", "ship_from") || null,
    deliveryEstimate: pickStr(raw, "delivery_estimate", "shipping_time", "delivery_time") || null,
  };
}

function mapVariant(raw: Record<string, unknown>): EproloVariant {
  return {
    id: pickStr(raw, "id", "variant_id", "sku_id"),
    sku: pickStr(raw, "sku", "variant_sku") || null,
    name: pickStr(raw, "name", "title", "variant_name", "option"),
    price: pickNum(raw, "price", "sell_price", "cost") ?? 0,
    inventory: pickNum(raw, "inventory", "stock", "quantity") ?? 0,
    image: firstImage(raw),
  };
}

function mapWarehouseStock(raw: Record<string, unknown>): EproloWarehouseStock {
  return {
    warehouseName: pickStr(raw, "warehouse_name", "warehouse", "name", "location"),
    countryCode: pickStr(raw, "country_code", "country", "code").toUpperCase(),
    inventory: pickNum(raw, "inventory", "stock", "quantity", "available") ?? 0,
  };
}

function firstImage(raw: Record<string, unknown>): string | null {
  const direct = pickStr(raw, "image", "main_image", "thumbnail", "cover", "pic_url", "img");
  if (direct && /^https?:\/\//i.test(direct)) return direct;
  const set = firstArray(raw, "images", "image_list", "pics", "gallery");
  for (const item of set) {
    const s =
      typeof item === "string"
        ? item
        : pickStr(item as Record<string, unknown>, "url", "src", "image");
    if (s && /^https?:\/\//i.test(s)) return s;
  }
  // Some APIs return images as a plain string array nested in `raw.images`.
  const v = (raw as Record<string, unknown>).images;
  if (Array.isArray(v)) {
    for (const s of v) {
      if (typeof s === "string" && /^https?:\/\//i.test(s)) return s;
    }
  }
  return null;
}

function collectImages(raw: Record<string, unknown>): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    const s = typeof v === "string" ? v.trim() : "";
    if (s && /^https?:\/\//i.test(s) && !out.includes(s)) out.push(s);
  };
  push(pickStr(raw, "image", "main_image", "thumbnail", "cover"));
  const set = firstArray(raw, "images", "image_list", "pics", "gallery");
  for (const item of set) {
    push(
      typeof item === "string"
        ? item
        : pickStr(item as Record<string, unknown>, "url", "src", "image"),
    );
  }
  const v = raw.images;
  if (Array.isArray(v)) for (const s of v) push(s);
  return out;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Env wiring                                                          */
/* ------------------------------------------------------------------ */

/** Build a client from env vars, or null when Eprolo is not configured. */
export function createEproloClientFromEnv(): EproloClient | null {
  const apiKey = process.env.EPROLO_API_KEY?.trim();
  if (!apiKey) return null;
  return new EproloClient({ apiKey });
}
