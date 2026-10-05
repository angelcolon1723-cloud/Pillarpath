/**
 * CJ Dropshipping API v2.0 client (server-only).
 *
 * Covers catalog ingestion (product search/list/detail/inventory) and order
 * fulfillment (freight quotes, order creation, payment, tracking).
 *
 * Auth: exchange `CJ_API_KEY` for a 15-day access token at
 * POST /authentication/getAccessToken, then send it as the `CJ-Access-Token`
 * header. Tokens are cached in-process; refresh tokens last 180 days.
 *
 * Rate limits (free tier): 1 request/second. The client paces itself
 * accordingly and retries transient failures with backoff.
 *
 * Docs: https://developers.cjdropshipping.com/en/api/api2/api/auth.html
 */

const CJ_BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";

// Free-tier pacing: CJ allows 1 req/s on free accounts.
const MIN_REQUEST_INTERVAL_MS = 1100;
const MAX_RETRIES = 3;

if (typeof window !== "undefined") {
  throw new Error(
    "@/lib/suppliers/cjdropshipping is server-only — never import it from client code.",
  );
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface CjConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface CjPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CjProductSummary {
  pid: string;
  nameEn: string;
  sku: string;
  bigImage: string;
  sellPrice: number;
  nowPrice: number | null;
  listedNum: number;
  categoryId: string | null;
  categoryName: string | null;
  warehouseInventoryNum: number;
  deliveryCycle: string | null;
  countryCode: string | null;
}

export interface CjVariant {
  vid: string;
  variantSku: string;
  variantNameEn: string;
  variantKey: string | null;
  variantSellPrice: number;
  variantSugSellPrice: number | null;
  variantLengthMm: number | null;
  variantWidthMm: number | null;
  variantHeightMm: number | null;
  variantWeightG: number | null;
  image: string | null;
}

export interface CjWarehouseStock {
  warehouseName: string;
  countryCode: string;
  totalInventoryNum: number;
  cjInventoryNum: number;
  verified: boolean;
}

export interface CjProductDetail extends CjProductSummary {
  description: string;
  images: string[];
  variants: CjVariant[];
  warehouseStocks: CjWarehouseStock[];
  material: string | null;
  packingWeightG: number | null;
}

export interface CjProductSearchParams {
  keyWord?: string;
  page?: number;
  size?: number;
  categoryId?: string;
  /** Warehouse country filter, e.g. "US". Prefer US stock for kids' products. */
  countryCode?: string;
  startSellPrice?: number;
  endSellPrice?: number;
  /** 0 = best match, 1 = listing count, 2 = price, 3 = create time, 4 = inventory */
  orderBy?: 0 | 1 | 2 | 3 | 4;
  sort?: "asc" | "desc";
}

export interface CjCategory {
  id: string;
  name: string;
  parentId: string | null;
  children: CjCategory[];
}

export interface CjFreightQuote {
  logisticName: string;
  logisticPrice: number;
  logisticAging: string | null;
}

export interface CjOrderItemInput {
  vid: string;
  quantity: number;
}

export interface CjShippingAddress {
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

export interface CjCreateOrderInput {
  /** Our unique order reference (idempotency key on our side). */
  orderNumber: string;
  address: CjShippingAddress;
  items: CjOrderItemInput[];
  /** Warehouse country to ship from, e.g. "US". */
  fromCountryCode: string;
  /** CJ shipping method, e.g. "USPS". */
  logisticName: string;
  /** 2 = pay with CJ balance immediately, 3 = create unpaid. */
  payType?: 2 | 3;
}

export interface CjOrder {
  orderId: string;
  orderNumber: string;
  status: string;
  trackingNumber: string | null;
}

export interface CjBalance {
  amount: number;
  frozenAmount: number;
  currency: string;
}

/** Thrown for CJ API failures (HTTP or business-level errors). */
export class CjApiError extends Error {
  readonly code: string | number | null;
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(
    message: string,
    opts: { code?: string | number | null; status?: number | null; retryable?: boolean } = {},
  ) {
    super(message);
    this.name = "CjApiError";
    this.code = opts.code ?? null;
    this.status = opts.status ?? null;
    this.retryable = opts.retryable ?? false;
  }
}

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

export interface TokenState {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

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

export class CjDropshippingClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private token: TokenState | null = null;
  private lastRequestAt = 0;
  private tokenPromise: Promise<string> | null = null;

  constructor(config: CjConfig) {
    if (!config.apiKey) throw new Error("CjDropshippingClient requires an API key");
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? CJ_BASE_URL).replace(/\/$/, "");
  }

  /** Seed or replace the in-memory token (e.g. from a DB cache). */
  setToken(token: TokenState): void {
    this.token = token;
    this.tokenPromise = null;
  }

  /* ---------------- auth ---------------- */

  private async fetchToken(): Promise<string> {
    // Serialize concurrent callers onto one token fetch (getAccessToken is
    // limited to once per 5 minutes per API key).
    this.tokenPromise ??= (async () => {
      try {
        const now = Date.now();
        if (this.token && now < this.token.expiresAt - 60_000) {
          return this.token.accessToken;
        }
        // Try refresh first when we have a refresh token.
        if (this.token?.refreshToken) {
          try {
            await this.exchangeRefreshToken();
            return this.token.accessToken;
          } catch {
            this.token = null; // fall through to full re-auth
          }
        }
        const res = await fetch(`${this.baseUrl}/authentication/getAccessToken`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: this.apiKey }),
        });
        const payload = await this.parseEnvelope<{ accessToken: string; refreshToken: string }>(
          res,
          "getAccessToken",
        );
        this.token = {
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          // CJ access tokens live 180 days per docs; refresh a day early.
          expiresAt: now + 179 * 24 * 3600 * 1000,
        };
        return this.token.accessToken;
      } finally {
        this.tokenPromise = null;
      }
    })();
    return this.tokenPromise;
  }

  private async exchangeRefreshToken(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/authentication/refreshAccessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: this.token?.refreshToken }),
    });
    const payload = await this.parseEnvelope<{ accessToken: string; refreshToken: string }>(
      res,
      "refreshAccessToken",
    );
    this.token = {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken ?? this.token?.refreshToken ?? "",
      expiresAt: Date.now() + 179 * 24 * 3600 * 1000,
    };
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
      message?: string;
      result?: unknown;
      data?: unknown;
    } | null;
    const code = body?.code;
    const ok = res.ok && (code === 200 || code === "200" || body?.success === true);
    if (!ok || !body) {
      const retryable = res.status === 429 || res.status >= 500;
      throw new CjApiError(`CJ ${op} failed: ${body?.message ?? `HTTP ${res.status}`}`, {
        code: code ?? null,
        status: res.status,
        retryable,
      });
    }
    // CJ wraps payloads in `result` or `data` depending on the endpoint.
    return (body.result ?? body.data ?? {}) as T;
  }

  private isAuthError(err: unknown): boolean {
    if (!(err instanceof CjApiError)) return false;
    if (err.status === 401) return true;
    const code = String(err.code ?? "");
    return code === "210401" || /token/i.test(err.message);
  }

  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    opts: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }

    let attempt = 0;
    let refreshed = false;
    for (;;) {
      await this.pace();
      const token = await this.fetchToken();
      let res: Response;
      try {
        res = await fetch(url, {
          method,
          headers: {
            "CJ-Access-Token": token,
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
        throw new CjApiError(
          `CJ ${method} ${path} network error: ${err instanceof Error ? err.message : String(err)}`,
          { retryable: true },
        );
      }

      try {
        return await this.parseEnvelope<T>(res, `${method} ${path}`);
      } catch (err) {
        if (this.isAuthError(err) && !refreshed) {
          // Token went stale mid-flight — drop it and retry once.
          refreshed = true;
          this.token = null;
          continue;
        }
        if (err instanceof CjApiError && err.retryable && attempt < MAX_RETRIES) {
          attempt += 1;
          await sleep(500 * 2 ** attempt);
          continue;
        }
        throw err;
      }
    }
  }

  /* ---------------- products ---------------- */

  async searchProducts(params: CjProductSearchParams = {}): Promise<CjPage<CjProductSummary>> {
    const raw = await this.request<{
      list?: unknown[];
      total?: number;
      pageNum?: number;
      pageSize?: number;
    }>("GET", "/product/listV2", {
      query: {
        keyWord: params.keyWord,
        page: params.page ?? 1,
        size: Math.min(Math.max(params.size ?? 20, 1), 100),
        categoryId: params.categoryId,
        countryCode: params.countryCode,
        startSellPrice: params.startSellPrice,
        endSellPrice: params.endSellPrice,
        orderBy: params.orderBy ?? 0,
        sort: params.sort ?? "desc",
      },
    });
    const items = Array.isArray(raw.list)
      ? (raw.list as Record<string, unknown>[]).map(mapProductSummary)
      : [];
    return {
      items,
      total: toNumber(raw.total),
      page: toNumber(raw.pageNum, 1),
      pageSize: toNumber(raw.pageSize, items.length),
    };
  }

  async getProductDetail(pid: string): Promise<CjProductDetail> {
    const raw = await this.request<Record<string, unknown>>("GET", "/product/query", {
      query: { pid },
    });
    const summary = mapProductSummary(raw);
    const descRaw = raw.description ?? raw.productDescription ?? "";
    const images = collectImages(raw);
    const variants = Array.isArray(raw.variants)
      ? (raw.variants as Record<string, unknown>[]).map(mapVariant)
      : [];
    const warehouseStocks = Array.isArray(raw.warehouseList)
      ? (raw.warehouseList as Record<string, unknown>[]).map(mapWarehouseStock)
      : [];
    return {
      ...summary,
      description: stripHtml(str(descRaw)),
      images,
      variants,
      warehouseStocks,
      material: raw.productMaterial ? str(raw.productMaterial) : null,
      packingWeightG: raw.packingWeight ? toNumber(raw.packingWeight) : null,
    };
  }

  async getCategories(): Promise<CjCategory[]> {
    const raw = await this.request<{ list?: unknown[] } | unknown[]>(
      "GET",
      "/product/getCategory",
    );
    const list = Array.isArray(raw) ? raw : (raw.list ?? []);
    return (list as Record<string, unknown>[]).map(mapCategory);
  }

  /** Live inventory for one variant across warehouses. */
  async getVariantStock(vid: string): Promise<CjWarehouseStock[]> {
    const raw = await this.request<{ list?: unknown[] } | unknown[]>(
      "GET",
      "/product/stock/queryByVid",
      { query: { vid } },
    );
    const list = Array.isArray(raw) ? raw : (raw.list ?? []);
    return (list as Record<string, unknown>[]).map(mapWarehouseStock);
  }

  /** Live inventory for every variant of a product. */
  async getInventoryByPid(pid: string): Promise<CjWarehouseStock[]> {
    const raw = await this.request<{ list?: unknown[] } | unknown[]>(
      "GET",
      "/product/stock/getInventoryByPid",
      { query: { pid } },
    );
    const list = Array.isArray(raw) ? raw : (raw.list ?? []);
    return (list as Record<string, unknown>[]).map(mapWarehouseStock);
  }

  /* ---------------- logistics ---------------- */

  async calculateFreight(
    fromCountryCode: string,
    toCountryCode: string,
    items: CjOrderItemInput[],
  ): Promise<CjFreightQuote[]> {
    const raw = await this.request<{ list?: unknown[] } | unknown[]>(
      "POST",
      "/logistic/freightCalculate",
      {
        body: {
          startCountryCode: fromCountryCode,
          endCountryCode: toCountryCode,
          products: items.map((i) => ({ vid: i.vid, quantity: i.quantity })),
        },
      },
    );
    const list = Array.isArray(raw) ? raw : (raw.list ?? []);
    return (list as Record<string, unknown>[]).map((q) => ({
      logisticName: str(q.logisticName),
      logisticPrice: toNumber(q.logisticPrice),
      logisticAging: q.logisticAging ? str(q.logisticAging) : null,
    }));
  }

  async trackOrder(trackingNumber: string): Promise<Record<string, unknown>> {
    return this.request("GET", "/logistic/trackInfo", {
      query: { trackNumber: trackingNumber },
    });
  }

  /* ---------------- orders ---------------- */

  async createOrder(input: CjCreateOrderInput): Promise<CjOrder> {
    if (!input.items.length) throw new CjApiError("createOrder requires at least one item");
    for (const item of input.items) {
      if (!item.vid || item.quantity <= 0) {
        throw new CjApiError("createOrder items need a vid and quantity > 0");
      }
    }
    const raw = await this.request<Record<string, unknown>>(
      "POST",
      "/shopping/order/createOrderV2",
      {
        body: {
          orderNumber: input.orderNumber,
          shippingCountryCode: input.address.countryCode,
          shippingCountry: input.address.country,
          shippingProvince: input.address.province,
          shippingCity: input.address.city,
          shippingAddress: input.address.address,
          shippingCustomerName: input.address.customerName,
          shippingPhone: input.address.phone,
          shippingZip: input.address.zipCode,
          email: input.address.email,
          logisticName: input.logisticName,
          fromCountryCode: input.fromCountryCode,
          payType: input.payType ?? 3,
          products: input.items.map((i) => ({ vid: i.vid, quantity: i.quantity })),
        },
      },
    );
    return {
      orderId: str(raw.orderId ?? raw.id),
      orderNumber: input.orderNumber,
      status: str(raw.status ?? raw.orderStatus ?? "CREATED"),
      trackingNumber: raw.trackingNumber ? str(raw.trackingNumber) : null,
    };
  }

  async getOrderDetail(orderId: string): Promise<Record<string, unknown>> {
    return this.request("GET", "/shopping/order/getOrderDetail", {
      query: { orderId },
    });
  }

  async listOrders(
    status?: string,
    pageNum = 1,
    pageSize = 20,
  ): Promise<CjPage<Record<string, unknown>>> {
    const raw = await this.request<{ list?: unknown[]; total?: number }>(
      "GET",
      "/shopping/order/list",
      { query: { status, pageNum, pageSize } },
    );
    const items = (Array.isArray(raw.list) ? raw.list : []) as Record<string, unknown>[];
    return { items, total: toNumber(raw.total), page: pageNum, pageSize };
  }

  async getBalance(): Promise<CjBalance> {
    const raw = await this.request<Record<string, unknown>>(
      "GET",
      "/shopping/pay/getBalance",
    );
    return {
      amount: toNumber(raw.amount ?? raw.balance),
      frozenAmount: toNumber(raw.frozenAmount),
      currency: "USD",
    };
  }

  /** Pay an unpaid CJ order from the CJ account balance. Moves real money — use deliberately. */
  async payOrderWithBalance(orderId: string): Promise<boolean> {
    const raw = await this.request<Record<string, unknown>>("POST", "/shopping/pay/payBalance", {
      body: { orderId },
    });
    return str(raw.code ?? raw.status).toLowerCase() === "success" || raw.success === true;
  }
}

/* ------------------------------------------------------------------ */
/* Response mapping                                                    */
/* ------------------------------------------------------------------ */

function mapProductSummary(raw: Record<string, unknown>): CjProductSummary {
  return {
    pid: str(raw.id ?? raw.pid ?? raw.productId),
    nameEn: str(raw.nameEn ?? raw.productNameEn ?? raw.productName),
    sku: str(raw.sku ?? raw.productSku),
    bigImage: str(raw.bigImage ?? raw.productImage),
    sellPrice: toNumber(raw.sellPrice ?? raw.productSellPrice),
    nowPrice: raw.nowPrice != null ? toNumber(raw.nowPrice) : null,
    listedNum: toNumber(raw.listedNum),
    categoryId: raw.categoryId != null ? str(raw.categoryId) : null,
    categoryName:
      raw.threeCategoryName != null
        ? str(raw.threeCategoryName)
        : raw.categoryName != null
          ? str(raw.categoryName)
          : null,
    warehouseInventoryNum: toNumber(raw.warehouseInventoryNum ?? raw.inventory),
    deliveryCycle: raw.deliveryCycle ? str(raw.deliveryCycle) : null,
    countryCode: raw.countryCode ? str(raw.countryCode) : null,
  };
}

function mapVariant(raw: Record<string, unknown>): CjVariant {
  return {
    vid: str(raw.vid ?? raw.id),
    variantSku: str(raw.variantSku ?? raw.sku),
    variantNameEn: str(raw.variantNameEn ?? raw.variantName),
    variantKey: raw.variantKey != null ? str(raw.variantKey) : null,
    variantSellPrice: toNumber(raw.variantSellPrice ?? raw.sellPrice),
    variantSugSellPrice:
      raw.variantSugSellPrice != null ? toNumber(raw.variantSugSellPrice) : null,
    variantLengthMm: raw.variantLength != null ? toNumber(raw.variantLength) : null,
    variantWidthMm: raw.variantWidth != null ? toNumber(raw.variantWidth) : null,
    variantHeightMm: raw.variantHeight != null ? toNumber(raw.variantHeight) : null,
    variantWeightG: raw.variantWeight != null ? toNumber(raw.variantWeight) : null,
    image: raw.variantImage ? str(raw.variantImage) : null,
  };
}

function mapWarehouseStock(raw: Record<string, unknown>): CjWarehouseStock {
  return {
    warehouseName: str(raw.warehouseName ?? raw.storageName ?? raw.name),
    countryCode: str(raw.countryCode ?? raw.areaCountryCode ?? ""),
    totalInventoryNum: toNumber(raw.totalInventoryNum ?? raw.inventory),
    cjInventoryNum: toNumber(raw.cjInventoryNum),
    verified: toNumber(raw.verifiedWarehouse, 2) === 1,
  };
}

function mapCategory(raw: Record<string, unknown>): CjCategory {
  const children = Array.isArray(raw.children)
    ? (raw.children as Record<string, unknown>[]).map(mapCategory)
    : [];
  return {
    id: str(raw.id ?? raw.categoryId),
    name: str(raw.name ?? raw.categoryName),
    parentId: raw.parentId != null ? str(raw.parentId) : null,
    children,
  };
}

function collectImages(raw: Record<string, unknown>): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    const s = str(v).trim();
    if (s && /^https?:\/\//i.test(s) && !out.includes(s)) out.push(s);
  };
  push(raw.bigImage ?? raw.productImage);
  const set = raw.productImageSet ?? raw.imageSet ?? raw.images;
  if (Array.isArray(set)) {
    for (const item of set) {
      if (typeof item === "string") push(item);
      else if (item && typeof item === "object") {
        push((item as Record<string, unknown>).image ?? (item as Record<string, unknown>).url);
      }
    }
  }
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

/** Build a client from env vars, or null when CJ is not configured. */
export function createCjClientFromEnv(): CjDropshippingClient | null {
  const apiKey = process.env.CJ_API_KEY?.trim();
  if (!apiKey) return null;
  return new CjDropshippingClient({ apiKey });
}
