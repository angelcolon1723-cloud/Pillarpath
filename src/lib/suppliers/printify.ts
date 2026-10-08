/**
 * Printify API client (server-only).
 *
 * Covers catalog ingestion (blueprints, print providers, variants) and
 * fulfillment (product publishing, order creation, tracking) for PillarPath
 * merch and kids' print-on-demand products.
 *
 * Auth: personal access token sent as `Authorization: Bearer <token>`.
 * No token exchange needed — the token is long-lived.
 *
 * Rate limits: paced conservatively with backoff on 429/5xx.
 *
 * Docs: https://developers.printify.com/
 */

const PRINTIFY_BASE_URL = "https://api.printify.com/v1";

// Conservative pacing; Printify documents generous limits but there is no
// reason for the importer to hammer the API.
const MIN_REQUEST_INTERVAL_MS = 300;
const MAX_RETRIES = 3;

if (typeof window !== "undefined") {
  throw new Error(
    "@/lib/suppliers/printify is server-only — never import it from client code.",
  );
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface PrintifyConfig {
  token: string;
  baseUrl?: string;
}

export interface PrintifyShop {
  id: number;
  title: string;
  salesChannel: string;
}

export interface PrintifyBlueprint {
  id: number;
  title: string;
  description: string;
  brand: string | null;
  model: string | null;
  images: string[];
}

export interface PrintifyPrintProvider {
  id: number;
  title: string;
  location: Record<string, unknown>;
  /** Best-effort country code derived from the location blob. */
  countryCode: string | null;
}

export interface PrintifyVariantOption {
  color?: string;
  size?: string;
  [key: string]: unknown;
}

export interface PrintifyVariant {
  id: number;
  title: string;
  options: PrintifyVariantOption;
  isAvailable: boolean;
  priceCents: number | null;
}

export interface PrintifyProductVariantInput {
  /** Printify catalog variant id. */
  id: number;
  /** Retail price in cents. */
  price: number;
  isEnabled?: boolean;
}

export interface PrintifyPrintAreaImageInput {
  /** Uploaded image id returned by /uploads/images.json. */
  id: string;
  /** Center position as a fraction of the print area (0–1). Defaults to 0.5. */
  x?: number;
  y?: number;
  /** Relative scale. Defaults to 0.55. */
  scale?: number;
  angle?: number;
}

export interface PrintifyPrintAreaInput {
  variantIds: number[];
  placeholders: { position: string; images: PrintifyPrintAreaImageInput[] }[];
}

export interface PrintifyCreateProductInput {
  title: string;
  description: string;
  blueprintId: number;
  printProviderId: number;
  variants: PrintifyProductVariantInput[];
  /** Print areas with artwork placements (artwork must already be uploaded). */
  printAreas: PrintifyPrintAreaInput[];
  tags?: string[];
}

export interface PrintifyPrintArea {
  variantIds: number[];
  /** Placeholder positions, e.g. ["front"]. */
  positions: string[];
}

export interface PrintifyProduct {
  id: string;
  title: string;
  description: string;
  blueprintId: number | null;
  printProviderId: number | null;
  images: string[];
  variants: Array<{
    id: number;
    price: number | null;
    /** Fulfillment cost in cents, when the API exposes it. */
    cost: number | null;
    isEnabled: boolean;
    title?: string;
  }>;
  isLocked: boolean;
  publishedAt: string | null;
}

export interface PrintifyAddress {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  country: string;
  region: string;
  address1: string;
  address2?: string;
  city: string;
  zip: string;
}

export interface PrintifyCreateOrderInput {
  /** Our unique order reference (idempotency key on our side). */
  externalId: string;
  label?: string;
  shopProductId: string;
  variantId: number;
  quantity: number;
  address: PrintifyAddress;
  /** 1 = standard, 2 = express. */
  shippingMethod?: 1 | 2;
  sendShippingNotification?: boolean;
}

export interface PrintifyOrder {
  id: string;
  externalId: string | null;
  status: string;
  totalCents: number | null;
  trackingNumber: string | null;
}

/** Thrown for Printify API failures (HTTP or business-level errors). */
export class PrintifyApiError extends Error {
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(
    message: string,
    opts: { status?: number | null; retryable?: boolean } = {},
  ) {
    super(message);
    this.name = "PrintifyApiError";
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

function asArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === "object") {
    const rec = v as Record<string, unknown>;
    if (Array.isArray(rec.data)) return rec.data as T[];
    if (Array.isArray(rec.variants)) return rec.variants as T[];
  }
  return [];
}

function collectImageUrls(v: unknown): string[] {
  const out: string[] = [];
  const push = (u: unknown) => {
    const s = str(u).trim();
    if (s && /^https?:\/\//i.test(s) && !out.includes(s)) out.push(s);
  };
  if (typeof v === "string") {
    push(v);
    return out;
  }
  if (Array.isArray(v)) {
    for (const item of v) {
      if (typeof item === "string") push(item);
      else if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        push(rec.src ?? rec.url ?? rec.image);
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

export class PrintifyClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private lastRequestAt = 0;

  constructor(config: PrintifyConfig) {
    if (!config.token) throw new Error("PrintifyClient requires a token");
    this.token = config.token;
    this.baseUrl = (config.baseUrl ?? PRINTIFY_BASE_URL).replace(/\/$/, "");
  }

  /* ---------------- request plumbing ---------------- */

  private async pace(): Promise<void> {
    const wait = MIN_REQUEST_INTERVAL_MS - (Date.now() - this.lastRequestAt);
    if (wait > 0) await sleep(wait);
    this.lastRequestAt = Date.now();
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
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
            Authorization: `Bearer ${this.token}`,
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
        throw new PrintifyApiError(
          `Printify ${method} ${path} network error: ${err instanceof Error ? err.message : String(err)}`,
          { retryable: true },
        );
      }

      if (res.ok) {
        if (res.status === 204) return {} as T;
        return (await res.json().catch(() => ({}))) as T;
      }

      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < MAX_RETRIES) {
        attempt += 1;
        // Honor Retry-After when present.
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt,
        );
        continue;
      }

      const bodyText = await res.text().catch(() => "");
      let message = `HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(bodyText) as Record<string, unknown>;
        const detail =
          parsed.message ?? parsed.error ?? (parsed.errors as unknown);
        if (typeof detail === "string" && detail) message = detail;
        else if (Array.isArray(detail)) {
          const first = detail[0] as Record<string, unknown> | undefined;
          const m = first?.message ?? first?.reason;
          if (typeof m === "string" && m) message = m;
        } else if (detail && typeof detail === "object") {
          // Printify validation errors: { field: ["message"] } — flatten them.
          const parts: string[] = [];
          for (const [k, v] of Object.entries(detail as Record<string, unknown>)) {
            if (Array.isArray(v)) parts.push(`${k}: ${(v as unknown[]).join(", ")}`);
            else if (typeof v === "string") parts.push(`${k}: ${v}`);
          }
          if (parts.length) message = parts.join("; ").slice(0, 500);
        }
      } catch {
        if (bodyText.trim()) message = bodyText.trim().slice(0, 300);
      }
      throw new PrintifyApiError(`Printify ${method} ${path} failed: ${message}`, {
        status: res.status,
        retryable,
      });
    }
  }

  /* ---------------- shops ---------------- */

  async listShops(): Promise<PrintifyShop[]> {
    const raw = await this.request<unknown>("GET", "/shops.json");
    return asArray<Record<string, unknown>>(raw).map((s) => ({
      id: toNumber(s.id),
      title: str(s.title),
      salesChannel: str(s.sales_channel),
    }));
  }

  /* ---------------- catalog ---------------- */

  async listBlueprints(): Promise<PrintifyBlueprint[]> {
    const raw = await this.request<unknown>("GET", "/catalog/blueprints.json");
    return asArray<Record<string, unknown>>(raw).map(mapBlueprint);
  }

  async getBlueprint(blueprintId: number): Promise<PrintifyBlueprint> {
    const raw = await this.request<Record<string, unknown>>(
      "GET",
      `/catalog/blueprints/${blueprintId}.json`,
    );
    return mapBlueprint(raw);
  }

  async listPrintProviders(blueprintId: number): Promise<PrintifyPrintProvider[]> {
    const raw = await this.request<unknown>(
      "GET",
      `/catalog/blueprints/${blueprintId}/print_providers.json`,
    );
    return asArray<Record<string, unknown>>(raw).map((p) => {
      const location =
        p.location && typeof p.location === "object"
          ? (p.location as Record<string, unknown>)
          : {};
      return {
        id: toNumber(p.id),
        title: str(p.title),
        location,
        countryCode: extractCountryCode(location),
      };
    });
  }

  async listVariants(
    blueprintId: number,
    printProviderId: number,
  ): Promise<PrintifyVariant[]> {
    const raw = await this.request<Record<string, unknown>>(
      "GET",
      `/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`,
    );
    return asArray<Record<string, unknown>>(raw.variants ?? raw).map((v) => ({
      id: toNumber(v.id),
      title: str(v.title),
      options:
        v.options && typeof v.options === "object"
          ? (v.options as PrintifyVariantOption)
          : {},
      isAvailable: v.is_available !== false,
      priceCents:
        v.price != null || v.cost != null ? toNumber(v.price ?? v.cost) : null,
    }));
  }

  /** Print areas (with placeholder positions) for a blueprint + provider. */
  async listPrintAreas(
    blueprintId: number,
    printProviderId: number,
  ): Promise<PrintifyPrintArea[]> {
    const raw = await this.request<unknown>(
      "GET",
      `/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/print_areas.json`,
    );
    return asArray<Record<string, unknown>>(raw).map((a) => ({
      variantIds: asArray<unknown>(a.variant_ids)
        .map(toNumber)
        .filter((n) => n > 0),
      positions: asArray<Record<string, unknown>>(a.placeholders)
        .map((p) => str(p.position))
        .filter(Boolean),
    }));
  }

  /* ---------------- uploads ---------------- */
  /** Register an image by public URL for use in print areas. Returns the upload id. */
  async uploadImageByUrl(fileName: string, url: string): Promise<string> {
    const raw = await this.request<Record<string, unknown>>("POST", "/uploads/images.json", {
      body: { file_name: fileName, url },
    });
    const id = str(raw.id);
    if (!id) throw new PrintifyApiError("Printify upload did not return an id");
    return id;
  }

  /* ---------------- shop products ---------------- */

  async listProducts(shopId: number, page = 1, limit = 50): Promise<PrintifyProduct[]> {
    const raw = await this.request<Record<string, unknown>>(
      "GET",
      `/shops/${shopId}/products.json`,
      { query: { page, limit: Math.min(Math.max(limit, 1), 100) } },
    );
    return asArray<Record<string, unknown>>(raw.data ?? raw).map(mapProduct);
  }

  async getProduct(shopId: number, productId: string): Promise<PrintifyProduct> {
    const raw = await this.request<Record<string, unknown>>(
      "GET",
      `/shops/${shopId}/products/${productId}.json`,
    );
    return mapProduct(raw);
  }

  async createProduct(shopId: number, input: PrintifyCreateProductInput): Promise<PrintifyProduct> {
    if (!input.variants.length) throw new PrintifyApiError("createProduct requires variants");
    const raw = await this.request<Record<string, unknown>>(
      "POST",
      `/shops/${shopId}/products.json`,
      {
        body: {
          title: input.title,
          description: input.description,
          blueprint_id: input.blueprintId,
          print_provider_id: input.printProviderId,
          variants: input.variants.map((v) => ({
            id: v.id,
            price: v.price,
            is_enabled: v.isEnabled ?? true,
          })),
          print_areas: input.printAreas.map((a) => ({
            variant_ids: a.variantIds,
            placeholders: a.placeholders.map((p) => ({
              position: p.position,
              images: p.images.map((img) => ({
                id: img.id,
                x: img.x ?? 0.5,
                y: img.y ?? 0.5,
                scale: img.scale ?? 0.55,
                angle: img.angle ?? 0,
              })),
            })),
          })),
          ...(input.tags?.length ? { tags: input.tags } : {}),
        },
      },
    );
    return mapProduct(raw);
  }

  /** Publish a product to the connected sales channel. */
  async publishProduct(
    shopId: number,
    productId: string,
    opts: { title?: boolean; description?: boolean; images?: boolean; variants?: boolean; tags?: boolean } = {},
  ): Promise<boolean> {
    const raw = await this.request<Record<string, unknown>>(
      "POST",
      `/shops/${shopId}/products/${productId}/publish.json`,
      {
        body: {
          title: opts.title ?? true,
          description: opts.description ?? true,
          images: opts.images ?? true,
          variants: opts.variants ?? true,
          tags: opts.tags ?? true,
        },
      },
    );
    return raw.success === true || str(raw.status).toLowerCase() === "ok";
  }

  async unpublishProduct(shopId: number, productId: string): Promise<boolean> {
    const raw = await this.request<Record<string, unknown>>(
      "POST",
      `/shops/${shopId}/products/${productId}/unpublish.json`,
    );
    return raw.success === true || str(raw.status).toLowerCase() === "ok";
  }

  /* ---------------- orders ---------------- */

  /**
   * Submit a fulfillment order to Printify. Moves real money (print + shipping
   * are charged to the Printify account) — call deliberately, after the
   * PillarPath order itself is confirmed.
   */
  async createOrder(shopId: number, input: PrintifyCreateOrderInput): Promise<PrintifyOrder> {
    if (input.quantity <= 0) throw new PrintifyApiError("createOrder requires quantity > 0");
    const raw = await this.request<Record<string, unknown>>(
      "POST",
      `/shops/${shopId}/orders.json`,
      {
        body: {
          external_id: input.externalId,
          ...(input.label ? { label: input.label } : {}),
          line_items: [
            {
              product_id: input.shopProductId,
              variant_id: input.variantId,
              quantity: input.quantity,
            },
          ],
          shipping_method: input.shippingMethod ?? 1,
          send_shipping_notification: input.sendShippingNotification ?? false,
          address_to: {
            first_name: input.address.firstName,
            last_name: input.address.lastName,
            email: input.address.email,
            ...(input.address.phone ? { phone: input.address.phone } : {}),
            country: input.address.country,
            region: input.address.region,
            address1: input.address.address1,
            ...(input.address.address2 ? { address2: input.address.address2 } : {}),
            city: input.address.city,
            zip: input.address.zip,
          },
        },
      },
    );
    return mapOrder(raw);
  }

  /**
   * Send a created order to production. Orders created via the API wait
   * in a pending state until submitted; submitting is what actually
   * charges the Printify account and starts printing.
   */
  async submitOrder(shopId: number, orderId: string): Promise<void> {
    await this.request<Record<string, unknown>>(
      "POST",
      `/shops/${shopId}/orders/${orderId}/submit.json`,
      { body: {} },
    );
  }

  async getOrder(shopId: number, orderId: string): Promise<PrintifyOrder> {
    const raw = await this.request<Record<string, unknown>>(
      "GET",
      `/shops/${shopId}/orders/${orderId}.json`,
    );
    return mapOrder(raw);
  }

  async listOrders(shopId: number, page = 1, limit = 50): Promise<PrintifyOrder[]> {
    const raw = await this.request<Record<string, unknown>>(
      "GET",
      `/shops/${shopId}/orders.json`,
      { query: { page, limit: Math.min(Math.max(limit, 1), 100) } },
    );
    return asArray<Record<string, unknown>>(raw.data ?? raw).map(mapOrder);
  }
}

/* ------------------------------------------------------------------ */
/* Response mapping                                                    */
/* ------------------------------------------------------------------ */

function mapBlueprint(raw: Record<string, unknown>): PrintifyBlueprint {
  return {
    id: toNumber(raw.id),
    title: str(raw.title),
    description: stripHtml(str(raw.description)),
    brand: raw.brand != null ? str(raw.brand) : null,
    model: raw.model != null ? str(raw.model) : null,
    images: collectImageUrls(raw.images),
  };
}

function extractCountryCode(location: Record<string, unknown>): string | null {
  const direct = location.country_code ?? location.countryCode ?? location.country;
  if (typeof direct === "string" && direct.trim()) return direct.trim().toUpperCase();
  const address = location.address;
  if (address && typeof address === "object") {
    const c = (address as Record<string, unknown>).country;
    if (typeof c === "string" && c.trim()) return c.trim().toUpperCase();
  }
  return null;
}

function mapProduct(raw: Record<string, unknown>): PrintifyProduct {
  const variants = asArray<Record<string, unknown>>(raw.variants).map((v) => ({
    id: toNumber(v.id ?? v.variant_id),
    price: v.price != null ? toNumber(v.price) : null,
    cost: v.cost != null ? toNumber(v.cost) : null,
    isEnabled: v.is_enabled !== false,
    title: v.title != null ? str(v.title) : undefined,
  }));
  return {
    id: str(raw.id),
    title: str(raw.title),
    description: stripHtml(str(raw.description)),
    blueprintId: raw.blueprint_id != null ? toNumber(raw.blueprint_id) : null,
    printProviderId:
      raw.print_provider_id != null ? toNumber(raw.print_provider_id) : null,
    images: collectImageUrls(raw.images),
    variants,
    isLocked: raw.is_locked === true,
    publishedAt: raw.published_at != null ? str(raw.published_at) : null,
  };
}

function mapOrder(raw: Record<string, unknown>): PrintifyOrder {
  const shipments = asArray<Record<string, unknown>>(raw.shipments);
  const tracking =
    shipments
      .map((s) => str(s.tracking_number ?? s.trackingNumber))
      .find((t) => t) ?? null;
  return {
    id: str(raw.id),
    externalId: raw.external_id != null ? str(raw.external_id) : null,
    status: str(raw.status),
    totalCents:
      raw.total_price != null
        ? toNumber(raw.total_price)
        : raw.total != null
          ? toNumber(raw.total)
          : null,
    trackingNumber: tracking,
  };
}

/* ------------------------------------------------------------------ */
/* Env wiring                                                          */
/* ------------------------------------------------------------------ */

/** Build a client from env vars, or null when Printify is not configured. */
export function createPrintifyClientFromEnv(): PrintifyClient | null {
  const token = process.env.PRINTIFY_API_KEY?.trim();
  if (!token) return null;
  return new PrintifyClient({ token });
}
