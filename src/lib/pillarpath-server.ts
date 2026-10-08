import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { isWorkspacePreview } from "@/lib/env.server";
import { uid } from "@/lib/utils";

const FUTURE_PLANS = {
  sprout: { label: "Sprout", termDays: 30, bonusRate: 0.05, min: 10 },
  builder: { label: "Builder", termDays: 60, bonusRate: 0.1, min: 25 },
  pathfinder: { label: "Pathfinder", termDays: 90, bonusRate: 0.15, min: 50 },
  creator: { label: "Creator", termDays: 180, bonusRate: 0.25, min: 100 },
} as const;

type FuturePlanCode = keyof typeof FUTURE_PLANS;

const DEFAULT_CAMPAIGNS = [
  { name: "Welcome sequence", channel: "Email", budget: 0 },
  { name: "Back-to-school social", channel: "Social", budget: 50000 },
];

async function ensureUserSeed(userId: string) {
  const sql = await getSql();
  await sql`
    insert into profiles (user_id, display_name)
    values (${userId}, 'Pillarpath Parent')
    on conflict (user_id) do nothing
  `;
  const childCount = await sql<{ count: number }>`select count(*)::int as count from children where user_id = ${userId}`;
  if ((childCount[0]?.count ?? 0) === 0) {
    await sql`
      insert into children (user_id, name, age, avatar, units, vault_units)
      values (${userId}, 'Alex', 10, 'star', 42, 25)
    `;
  }
  const campaignCount = await sql<{ count: number }>`select count(*)::int as count from marketing_campaigns where user_id = ${userId}`;
  if ((campaignCount[0]?.count ?? 0) === 0) {
    for (const campaign of DEFAULT_CAMPAIGNS) {
      await sql`
        insert into marketing_campaigns (user_id, name, channel, status, budget_cents)
        values (${userId}, ${campaign.name}, ${campaign.channel}, 'draft', ${campaign.budget})
      `;
    }
  }
  await sql`
    insert into referrals (user_id, code)
    values (${userId}, ${"PILLAR-" + userId.slice(0, 6).toUpperCase()})
    on conflict (code) do nothing
  `;
}

export const getPillarpathData = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureUserSeed(context.userId);
    const [profiles, children, products, cartItems, orders, campaigns, referral, fulfillments, futurePlans] = await Promise.all([
      sql<{ display_name: string; phone: string | null; marketing_opt_in: boolean; currency: string; studio_plus: boolean }>`select display_name, phone, marketing_opt_in, currency, coalesce(studio_plus, false) as studio_plus from profiles where user_id = ${context.userId}`,
      sql<{ id: number; name: string; age: number | null; avatar: string; units: number; vault_units: number; frozen: boolean }>`select id, name, age, avatar, units, vault_units, frozen from children where user_id = ${context.userId} order by id`,
      sql<{ id: string; name: string; description: string; category: string; image_url: string | null; unit_price: number; retail_price_cents: number; supplier_name: string; supplier_sku: string; inventory: number }>`select id, name, description, category, image_url, unit_price, retail_price_cents, supplier_name, supplier_sku, inventory from store_products where active = true order by category, name`,
      sql<{ product_id: string; quantity: number }>`select ci.product_id, ci.quantity from cart_items ci join carts c on c.id = ci.cart_id where c.user_id = ${context.userId} and c.status = 'open'`,
      sql<{ id: number; status: string; total_cents: number; created_at: string; payment_provider: string; payment_reference: string | null }>`select id, status, total_cents, created_at, payment_provider, payment_reference from orders where user_id = ${context.userId} order by id desc limit 20`,
      sql<{ id: number; name: string; channel: string; status: string; budget_cents: number; clicks: number; conversions: number }>`select id, name, channel, status, budget_cents, clicks, conversions from marketing_campaigns where user_id = ${context.userId} order by id desc`,
      sql<{ code: string; reward_cents: number; referrals: number }>`select code, reward_cents, referrals from referrals where user_id = ${context.userId} limit 1`,
      sql<{ id: number; order_id: number; supplier_name: string; status: string; tracking_number: string | null }>`select id, order_id, supplier_name, status, tracking_number from fulfillments where order_id in (select id from orders where user_id = ${context.userId}) order by id desc limit 30`,
      sql<{ id: string; plan_code: FuturePlanCode; committed_units: number; bonus_units: number; maturity_at: string; status: string; funding_mode: string; created_at: string }>`select id, plan_code, committed_units, bonus_units, maturity_at, status, funding_mode, created_at from future_unit_plans where user_id = ${context.userId} order by created_at desc limit 20`,
    ]);
    return {
      profile: profiles[0] ?? { display_name: "Pillarpath Parent", phone: null, marketing_opt_in: false, currency: "USD", studio_plus: false },
      children,
      products,
      cart: cartItems.map((item) => ({ productId: item.product_id, quantity: item.quantity })),
      orders,
      campaigns,
      referral: referral[0] ?? null,
      fulfillments,
      futurePlans,
    };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { displayName: string; phone: string; marketingOptIn: boolean }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into profiles (user_id, display_name, phone, marketing_opt_in, updated_at)
      values (${context.userId}, ${data.displayName.trim() || "Pillarpath Parent"}, ${data.phone.trim() || null}, ${data.marketingOptIn}, now())
      on conflict (user_id) do update set display_name = excluded.display_name, phone = excluded.phone, marketing_opt_in = excluded.marketing_opt_in, updated_at = now()
    `;
    return { ok: true };
  });

export const createChild = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name: string; age: number; avatar: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: number }>`insert into children (user_id, name, age, avatar) values (${context.userId}, ${data.name.trim()}, ${data.age}, ${data.avatar}) returning id`;
    return { id: rows[0]?.id };
  });

/**
 * Credit Units to a child's server-side balance (e.g. parent loads Units).
 * Atomic: the balance update and the ledger entry happen in one statement.
 */
export const loadUnitsForChild = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { childId: number; amount: number }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean; newBalance: number }> => {
    const sql = await getSql();
    const amount = Math.floor(Number(data.amount));
    if (!Number.isFinite(amount) || amount < 1) throw new Error("Amount must be at least 1 Unit.");
    const rows = await sql<{ units: number }>`
      with credited as (
        update children set units = units + ${amount}
        where id = ${data.childId} and user_id = ${context.userId}
        returning units
      ),
      logged as (
        insert into units_transactions (user_id, child_id, kind, amount, note)
        select ${context.userId}, ${data.childId}, 'load', ${amount}, 'Units loaded by parent'
        where exists (select 1 from credited)
        returning 1
      )
      select units from credited`;
    if (!rows.length) throw new Error("Child not found.");
    return { ok: true, newBalance: rows[0].units };
  });

/**
 * Family device linking (pairing codes).
 *
 * The parent generates a short code shown on their device; the child enters
 * it on their own device to link the two. Until the code is redeemed the
 * child row exists but is unlinked (linked_at is null) — the profile is
 * real, not a phantom row.
 */

function generatePairingCode(): string {
  // 6 digits, no ambiguous characters issues since digits only.
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
}

export interface FamilyInvite {
  id: number;
  code: string;
  childId: number;
  childName: string;
  childAge: number | null;
  status: string;
  expiresAt: string;
  deviceInfo: string | null;
  ipAddress: string | null;
}

export const createFamilyInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name: string; age: number }) => input)
  .handler(async ({ context, data }): Promise<{ invite: FamilyInvite }> => {
    const sql = await getSql();
    const name = data.name.trim();
    if (!name) throw new Error("Child name is required.");
    const age = Math.max(3, Math.min(18, Math.floor(data.age) || 10));

    // Expire any stale pending invites for this parent first.
    await sql`update family_invites set status = 'expired' where user_id = ${context.userId} and status = 'pending' and expires_at < now()`;

    const childRows = await sql<{ id: number }>`
      insert into children (user_id, name, age, avatar) values (${context.userId}, ${name}, ${age}, 'star') returning id
    `;
    const childId = childRows[0].id;

    // Retry on the astronomically unlikely code collision.
    let code = generatePairingCode();
    for (let i = 0; i < 3; i++) {
      try {
        const rows = await sql<{ id: number; expires_at: string }>`
          insert into family_invites (user_id, child_id, code, expires_at)
          values (${context.userId}, ${childId}, ${code}, now() + interval '30 minutes')
          returning id, expires_at
        `;
        return {
          invite: {
            id: rows[0].id,
            code,
            childId,
            childName: name,
            childAge: age,
            status: "pending",
            expiresAt: rows[0].expires_at,
            deviceInfo: null,
            ipAddress: null,
          },
        };
      } catch {
        code = generatePairingCode();
      }
    }
    // Clean up the orphaned child row if we couldn't mint a code.
    await sql`delete from children where id = ${childId}`;
    throw new Error("Couldn't generate a pairing code — try again.");
  });

export const listFamilyInvites = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ invites: FamilyInvite[] }> => {
    const sql = await getSql();
    await sql`update family_invites set status = 'expired' where user_id = ${context.userId} and status = 'pending' and expires_at < now()`;
    const rows = await sql<{
      id: number; code: string; child_id: number; status: string; expires_at: string;
      child_name: string; child_age: number | null;
      device_info: string | null; ip_address: string | null;
    }>`
      select fi.id, fi.code, fi.child_id, fi.status, fi.expires_at, c.name as child_name, c.age as child_age,
             fi.device_info, fi.ip_address
      from family_invites fi join children c on c.id = fi.child_id
      where fi.user_id = ${context.userId} and fi.status in ('pending', 'awaiting_approval')
      order by fi.created_at desc
    `;
    return {
      invites: rows.map((r) => ({
        id: r.id,
        code: r.code,
        childId: r.child_id,
        childName: r.child_name,
        childAge: r.child_age,
        status: r.status,
        expiresAt: r.expires_at,
        deviceInfo: r.device_info,
        ipAddress: r.ip_address,
      })),
    };
  });

export const cancelFamilyInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { inviteId: number }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: number; child_id: number }>`
      update family_invites set status = 'cancelled'
      where id = ${data.inviteId} and user_id = ${context.userId} and status = 'pending'
      returning id, child_id
    `;
    if (rows[0]) {
      // Remove the unlinked child row — it was never a real connection.
      await sql`delete from children where id = ${rows[0].child_id}`;
    }
    return { ok: true };
  });

/**
 * Parent approves a device that redeemed the pairing code.
 * This is the moment the two devices become genuinely connected —
 * the parent has seen the actual device (model, OS, network) and said yes.
 */
export const approveDeviceLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { inviteId: number }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: number; child_id: number }>`
      update family_invites set status = 'linked'
      where id = ${data.inviteId} and user_id = ${context.userId} and status = 'awaiting_approval'
      returning id, child_id
    `;
    if (!rows[0]) throw new Error("No device waiting for approval.");
    await sql`update children set linked_at = now() where id = ${rows[0].child_id}`;
    return { ok: true };
  });

export const denyDeviceLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { inviteId: number }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: number; child_id: number }>`
      update family_invites set status = 'denied'
      where id = ${data.inviteId} and user_id = ${context.userId} and status = 'awaiting_approval'
      returning id, child_id
    `;
    if (rows[0]) {
      await sql`delete from children where id = ${rows[0].child_id}`;
    }
    return { ok: true };
  });

/**
 * Redeem a pairing code from the child's device.
 * Captures the device fingerprint + network info so the parent can
 * verify the actual device before approving the connection.
 * Built for the kid-side "Join my family" screen (lands with independent
 * kid login); parent-gated until then.
 */
export const redeemFamilyInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { code: string; deviceLabel?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const code = data.code.trim();

    // Capture what we can about the requesting device.
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const req = getRequest();
      const h = req.headers;
      const fwd = h.get("x-forwarded-for");
      ip = (fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip")) || null;
      userAgent = h.get("user-agent");
    } catch {
      /* headers unavailable — device info stays null */
    }
    const deviceInfo =
      data.deviceLabel?.trim() ||
      (userAgent ? parseDeviceLabel(userAgent) : null);

    const rows = await sql<{ id: number; child_id: number }>`
      update family_invites
      set status = 'awaiting_approval', device_info = ${deviceInfo}, ip_address = ${ip}
      where code = ${code} and status = 'pending' and expires_at > now()
      returning id, child_id
    `;
    if (!rows[0]) throw new Error("That code isn't valid or has expired.");
    return { ok: true, inviteId: rows[0].id };
  });

/** Turn a raw user-agent into a human-readable device label. */
function parseDeviceLabel(ua: string): string {
  const android = ua.match(/Android [\d.]+; ([^;)]+)/);
  if (android) return `${android[1].trim()} · Android`;
  const iphone = /iPhone/.test(ua);
  if (iphone) return "iPhone · iOS";
  const ipad = /iPad/.test(ua);
  if (ipad) return "iPad · iOS";
  const windows = /Windows NT/.test(ua);
  if (windows) return "Windows PC · Browser";
  const mac = /Macintosh/.test(ua);
  if (mac) return "Mac · Browser";
  return "Unknown device · Browser";
}

async function getOrCreateCart(userId: string) {
  const sql = await getSql();
  const existing = await sql<{ id: number }>`select id from carts where user_id = ${userId} and status = 'open' limit 1`;
  if (existing[0]) return existing[0].id;
  const created = await sql<{ id: number }>`insert into carts (user_id) values (${userId}) returning id`;
  return created[0].id;
}

export interface MarketplaceProduct {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  unitPrice: number;
  retailPriceCents: number;
  category: string | null;
  stockQuantity: number;
}

/**
 * The kid's marketplace shelf — only live, screened, published products.
 * Empty until the Society publishes the first real products.
 */
export const getMarketplaceProducts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async (): Promise<{ products: MarketplaceProduct[] }> => {
    const sql = await getSql();
    const rows = await sql<{
      id: string; name: string; description: string | null;
      image_url: string | null; unit_price: number; retail_price_cents: number;
      category: string | null; stock_quantity: number | null;
    }>`select id, name, description, image_url, unit_price, retail_price_cents, category, stock_quantity from store_products where active = true order by name`;
    return {
      products: rows.map((r) => ({
        id: r.id, name: r.name, description: r.description,
        imageUrl: r.image_url, unitPrice: r.unit_price,
        retailPriceCents: r.retail_price_cents ?? 0,
        category: r.category, stockQuantity: r.stock_quantity ?? 50,
      })),
    };
  });

export const addToCart = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { productId: string; quantity: number }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const cartId = await getOrCreateCart(context.userId);
    await sql`
      insert into cart_items (cart_id, product_id, quantity)
      values (${cartId}, ${data.productId}, ${Math.max(1, Math.floor(data.quantity))})
      on conflict (cart_id, product_id) do update set quantity = cart_items.quantity + excluded.quantity
    `;
    await sql`update carts set updated_at = now() where id = ${cartId}`;
    return { ok: true };
  });

export const setCartQuantity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { productId: string; quantity: number }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    if (data.quantity <= 0) {
      await sql`delete from cart_items ci using carts c where ci.cart_id = c.id and c.user_id = ${context.userId} and c.status = 'open' and ci.product_id = ${data.productId}`;
    } else {
      await sql`update cart_items ci set quantity = ${Math.floor(data.quantity)} from carts c where ci.cart_id = c.id and c.user_id = ${context.userId} and c.status = 'open' and ci.product_id = ${data.productId}`;
    }
    return { ok: true };
  });

export interface CartItem {
  productId: string;
  name: string;
  imageUrl: string | null;
  retailPriceCents: number;
  quantity: number;
  stockQuantity: number | null;
}

/** Parent's shopping cart with product details. */
export const getCart = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ items: CartItem[] }> => {
    const sql = await getSql();
    const rows = await sql<{
      product_id: string; name: string; image_url: string | null;
      retail_price_cents: number; quantity: number; stock_quantity: number | null;
    }>`
      select ci.product_id, p.name, p.image_url, p.retail_price_cents, ci.quantity, p.stock_quantity
      from cart_items ci
      join carts c on c.id = ci.cart_id
      join store_products p on p.id = ci.product_id
      where c.user_id = ${context.userId} and c.status = 'open' and p.active = true
      order by ci.id
    `;
    return {
      items: rows.map((r) => ({
        productId: r.product_id,
        name: r.name,
        imageUrl: r.image_url,
        retailPriceCents: r.retail_price_cents,
        quantity: r.quantity,
        stockQuantity: r.stock_quantity,
      })),
    };
  });

export const createCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { email: string; shippingName: string; shippingAddress: { line1: string; city: string; state: string; postalCode: string } }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const items = await sql<{ product_id: string; quantity: number; name: string; retail_price_cents: number; supplier_name: string; supplier_sku: string }>`
      select ci.product_id, ci.quantity, p.name, p.retail_price_cents, p.supplier_name, p.supplier_sku
      from cart_items ci join carts c on c.id = ci.cart_id join store_products p on p.id = ci.product_id
      where c.user_id = ${context.userId} and c.status = 'open' and p.active = true
    `;
    if (!items.length) throw new Error("Your basket is empty.");
    const subtotal = items.reduce((sum, item) => sum + item.retail_price_cents * item.quantity, 0);
    const shipping = subtotal >= 7500 ? 0 : 799;
    const total = subtotal + shipping;
    const addressJson = JSON.stringify(data.shippingAddress);
    const order = await sql<{ id: number }>`
      insert into orders (user_id, status, payment_provider, subtotal_cents, shipping_cents, total_cents, shipping_name, shipping_email, shipping_address)
      values (${context.userId}, 'pending_payment', 'stripe', ${subtotal}, ${shipping}, ${total}, ${data.shippingName}, ${data.email}, ${addressJson}::jsonb)
      returning id
    `;
    const orderId = order[0].id;
    for (const item of items) {
      await sql`
        insert into order_items (order_id, product_id, product_name, supplier_name, supplier_sku, quantity, unit_price_cents)
        values (${orderId}, ${item.product_id}, ${item.name}, ${item.supplier_name}, ${item.supplier_sku}, ${item.quantity}, ${item.retail_price_cents})
      `;
      await sql`insert into fulfillments (order_id, supplier_name) values (${orderId}, ${item.supplier_name})`;
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!stripeKey) {
      await sql`update orders set status = 'preview_payment' where id = ${orderId}`;
      await sql`update carts set status = 'checked_out', updated_at = now() where user_id = ${context.userId} and status = 'open'`;
      return { mode: "preview" as const, orderId, checkoutUrl: null };
    }

    const baseUrl = process.env.BETTER_AUTH_URL?.trim() || "http://localhost:8080";
    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", `${baseUrl}/checkout/success?order=${orderId}`);
    form.set("cancel_url", `${baseUrl}/?checkout=cancelled`);
    form.set("customer_email", data.email);
    form.set("shipping_address_collection[allowed_countries][0]", "US");
    if (shipping > 0) form.set("shipping_options[0][shipping_rate_data][display_name]", "Standard shipping");
    if (shipping > 0) form.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
    if (shipping > 0) form.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(shipping));
    if (shipping > 0) form.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "usd");
    items.forEach((item, index) => {
      form.set(`line_items[${index}][quantity]`, String(item.quantity));
      form.set(`line_items[${index}][price_data][currency]`, "usd");
      form.set(`line_items[${index}][price_data][unit_amount]`, String(item.retail_price_cents));
      form.set(`line_items[${index}][price_data][product_data][name]`, item.name);
    });
    form.set("metadata[order_id]", String(orderId));
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Payment setup failed: ${message.slice(0, 220)}`);
    }
    const session = (await response.json()) as { id: string; url: string };
    await sql`update orders set payment_reference = ${session.id} where id = ${orderId}`;
    return { mode: "stripe" as const, orderId, checkoutUrl: session.url };
  });

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name: string; channel: string; budgetCents: number }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`insert into marketing_campaigns (user_id, name, channel, budget_cents) values (${context.userId}, ${data.name.trim()}, ${data.channel}, ${Math.max(0, Math.floor(data.budgetCents))})`;
    return { ok: true };
  });

export const createPromoCode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { code: string; discountPercent: number }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`insert into promo_codes (user_id, code, discount_percent) values (${context.userId}, ${data.code.trim().toUpperCase()}, ${Math.min(90, Math.max(1, Math.floor(data.discountPercent)))}) on conflict (user_id, code) do update set discount_percent = excluded.discount_percent, active = true`;
    return { ok: true };
  });

export const createFutureUnitPlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { planCode: FuturePlanCode; committedUnits: number }) => input)
  .handler(async ({ context, data }) => {
    const plan = FUTURE_PLANS[data.planCode];
    if (!plan) throw new Error("Unknown Future Units plan");
    const units = Math.floor(Number(data.committedUnits));
    if (!Number.isFinite(units) || units < plan.min || units > 100000) {
      throw new Error(`Choose between ${plan.min} and 100,000 Units.`);
    }
    const sql = await getSql();
    const bonus = Math.floor(units * plan.bonusRate);
    const maturity = new Date(Date.now() + plan.termDays * 86400000).toISOString();
    const child = (
      await sql<{ id: number; units: number }>`
        select id, units from children where user_id = ${context.userId} order by id limit 1
      `
    )[0];
    if (!child) throw new Error("Create a child profile before reserving Future Units.");
    const updated = await sql<{ id: number }>`
      update children
      set units = units - ${units},
          future_reserved_units = future_reserved_units + ${units}
      where id = ${child.id} and user_id = ${context.userId} and units >= ${units}
      returning id
    `;
    if (!updated[0]) throw new Error("Not enough available Units for this plan.");
    const planId = uid("future");
    await sql`
      insert into future_unit_plans (id, user_id, child_id, plan_code, committed_units, bonus_units, maturity_at, status, funding_mode)
      values (${planId}, ${context.userId}, ${child.id}, ${data.planCode}, ${units}, ${bonus}, ${maturity}, 'active', 'units')
    `;
    return { id: planId, mode: "closed_loop" as const, maturityAt: maturity, bonusUnits: bonus };
  });

export const matureFutureUnitPlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { planId: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      child_id: number;
      committed_units: number;
      bonus_units: number;
      maturity_at: string;
      status: string;
    }>`
      select id, child_id, committed_units, bonus_units, maturity_at, status
      from future_unit_plans
      where id = ${data.planId} and user_id = ${context.userId}
      limit 1
    `;
    const plan = rows[0];
    if (!plan) throw new Error("Future Units plan not found");
    if (plan.status !== "active" && plan.status !== "simulation") throw new Error("Plan is not active");
    if (new Date(plan.maturity_at).getTime() > Date.now()) throw new Error("Plan has not matured yet");
    const updated = await sql<{ id: number }>`
      with matured as (
        update future_unit_plans
        set status = 'matured'
        where id = ${data.planId} and user_id = ${context.userId} and status in ('active', 'simulation') and maturity_at <= now()
        returning child_id, committed_units, bonus_units
      )
      update children c
      set future_reserved_units = greatest(0, c.future_reserved_units - matured.committed_units),
          units = c.units + matured.committed_units + matured.bonus_units
      from matured
      where c.id = matured.child_id and c.user_id = ${context.userId}
      returning c.id
    `;
    if (!updated[0]) throw new Error("Plan was already matured or is not ready.");
    return { ok: true, totalUnits: plan.committed_units + plan.bonus_units };
  });

export const saveStudioProject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { childId?: number | null; title: string; category: string; ageBand: string; payload: Record<string, unknown> }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const payload = JSON.stringify(data.payload).slice(0, 150_000);
    const title = data.title.trim().slice(0, 100) || "Untitled project";
    const category = data.category.slice(0, 30);
    const ageBand = data.ageBand.slice(0, 20);
    const allowed = ["drawing", "coloring", "craft", "story", "shirt", "music", "game", "puzzle", "animation"];
    if (!allowed.includes(category)) throw new Error("Invalid studio category");
    if (data.childId) {
      const child = await sql<{ id: number }>`select id from children where id = ${data.childId} and user_id = ${context.userId} limit 1`;
      if (!child[0]) throw new Error("Child profile not found");
    }
    const projectId = uid("studio");
    const rows = await sql<{ id: string }>`
      insert into studio_projects (id, user_id, child_id, title, category, age_band, payload)
      values (${projectId}, ${context.userId}, ${data.childId ?? null}, ${title}, ${category}, ${ageBand}, ${payload}::jsonb)
      returning id
    `;
    return { id: rows[0]?.id };
  });

export const recordLearningActivity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { childId?: number | null; activityKey: string; ageBand: string; level: string; score: number }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    let childId = data.childId ?? null;
    if (childId) {
      const child = await sql<{ id: number }>`select id from children where id = ${childId} and user_id = ${context.userId} limit 1`;
      if (!child[0]) throw new Error("Child profile not found");
    } else {
      const first = await sql<{ id: number }>`select id from children where user_id = ${context.userId} order by id limit 1`;
      childId = first[0]?.id ?? null;
    }
    if (!childId) throw new Error("Create a child profile first");
    const score = Math.max(0, Math.min(100, Math.floor(data.score)));
    await sql`
      insert into learning_progress (user_id, child_id, activity_key, age_band, level, score, completions, last_completed_at)
      values (${context.userId}, ${childId}, ${data.activityKey.slice(0, 80)}, ${data.ageBand.slice(0, 20)}, ${data.level.slice(0, 40)}, ${score}, 1, now())
      on conflict (user_id, child_id, activity_key)
      do update set age_band = excluded.age_band, level = excluded.level, score = greatest(learning_progress.score, excluded.score), completions = learning_progress.completions + 1, last_completed_at = now()
    `;
    return { ok: true };
  });

export const createStudioCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Record<string, never>) => input)
  .handler(async ({ context }) => {
    const sql = await getSql();
    const configured = await sql<{ studio_plus: boolean }>`select studio_plus from profiles where user_id = ${context.userId}`;
    if (configured[0]?.studio_plus) return { mode: "active" as const, checkoutUrl: null };
    const price = Math.max(99, Number(process.env.STUDIO_PLUS_PRICE_CENTS ?? 499));
    const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!stripeKey && !isWorkspacePreview()) {
      throw new Error("Studio payments are not configured for production yet.");
    }
    if (!stripeKey) {
      await sql`update profiles set studio_plus = true, updated_at = now() where user_id = ${context.userId}`;
      return { mode: "preview" as const, checkoutUrl: null };
    }
    const baseUrl = process.env.BETTER_AUTH_URL?.trim() || "http://127.0.0.1:8080";
    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", `${baseUrl}/?studio=activated`);
    form.set("cancel_url", `${baseUrl}/?studio=cancelled`);
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", "usd");
    form.set("line_items[0][price_data][unit_amount]", String(price));
    form.set("line_items[0][price_data][product_data][name]", "Pillarpath Creative Studio Plus");
    form.set("metadata[studio_plus]", "1");
    form.set("metadata[user_id]", context.userId);
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!response.ok) throw new Error(`Studio checkout setup failed: ${(await response.text()).slice(0, 220)}`);
    const session = (await response.json()) as { url: string };
    return { mode: "stripe" as const, checkoutUrl: session.url };
  });

/* ------------------------------------------------------------------ */
/* Savings goals — parent + kid save toward something together          */
/* ------------------------------------------------------------------ */

export interface SavingsGoal {
  id: string;
  childId: number;
  childName: string;
  title: string;
  emoji: string;
  targetUnits: number;
  savedUnits: number;
  status: "active" | "completed" | "released";
  createdAt: string;
  progressPct: number;
}

function toSavingsGoal(r: {
  id: string; child_id: number; child_name: string; title: string; emoji: string;
  target_units: number; saved_units: number; status: string; created_at: string;
}): SavingsGoal {
  const pct = r.target_units > 0 ? Math.min(100, Math.round((r.saved_units / r.target_units) * 100)) : 0;
  return {
    id: r.id, childId: r.child_id, childName: r.child_name, title: r.title,
    emoji: r.emoji, targetUnits: r.target_units, savedUnits: r.saved_units,
    status: r.status as SavingsGoal["status"], createdAt: r.created_at, progressPct: pct,
  };
}

/** Parent creates a savings goal for one of their children. */
export const createSavingsGoal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { childId: number; title: string; emoji?: string; targetUnits: number }) => input)
  .handler(async ({ context, data }): Promise<{ goal: SavingsGoal }> => {
    const sql = await getSql();
    const title = data.title.trim().slice(0, 60);
    const target = Math.floor(Number(data.targetUnits));
    if (!title) throw new Error("Give the goal a name.");
    if (!Number.isFinite(target) || target < 10) throw new Error("Target must be at least 10 Units.");
    const kids = await sql<{ id: number; name: string }>`
      select id, name from children where id = ${data.childId} and user_id = ${context.userId}`;
    if (!kids.length) throw new Error("Child not found.");
    const rows = await sql<{
      id: string; child_id: number; child_name: string; title: string; emoji: string;
      target_units: number; saved_units: number; status: string; created_at: string;
    }>`
      insert into savings_goals (user_id, child_id, title, emoji, target_units)
      values (${context.userId}, ${data.childId}, ${title}, ${data.emoji ?? "🎯"}, ${target})
      returning id, child_id,
        (select name from children where id = ${data.childId}) as child_name,
        title, emoji, target_units, saved_units, status, created_at::text as created_at`;
    return { goal: toSavingsGoal(rows[0]) };
  });

/** List savings goals — parent sees all, child sees their own. */
export const listSavingsGoals = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { childId?: number } = {}) => input)
  .handler(async ({ context, data }): Promise<{ goals: SavingsGoal[] }> => {
    const sql = await getSql();
    const rows = await sql<{
      id: string; child_id: number; child_name: string; title: string; emoji: string;
      target_units: number; saved_units: number; status: string; created_at: string;
    }>`
      select g.id, g.child_id, c.name as child_name, g.title, g.emoji,
             g.target_units, g.saved_units, g.status, g.created_at::text as created_at
      from savings_goals g
      join children c on c.id = g.child_id
      where g.user_id = ${context.userId}
        ${data.childId ? sql`and g.child_id = ${data.childId}` : sql``}
      order by g.status asc, g.created_at desc`;
    return { goals: rows.map(toSavingsGoal) };
  });

/**
 * Move Units from the child's spendable balance into the goal's escrow.
 * Atomic: the debit only happens if the child can cover it.
 */
export const contributeToGoal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { goalId: string; amount: number }) => input)
  .handler(async ({ context, data }): Promise<{ goal: SavingsGoal }> => {
    const sql = await getSql();
    const amount = Math.floor(Number(data.amount));
    if (!Number.isFinite(amount) || amount < 1) throw new Error("Amount must be at least 1 Unit.");
    // Single atomic statement: debit child + credit goal escrow + log tx.
    // If any part fails, nothing is written — Units can never be debited
    // without landing in escrow.
    const rows = await sql<{
      id: string; child_id: number; child_name: string; title: string; emoji: string;
      target_units: number; saved_units: number; status: string; created_at: string;
    }>`
      with goal as (
        select id, child_id, title, target_units, saved_units
        from savings_goals
        where id = ${data.goalId} and user_id = ${context.userId} and status = 'active'
      ),
      debited as (
        update children set units = units - ${amount}
        where id = (select child_id from goal)
          and user_id = ${context.userId}
          and units >= ${amount}
          and exists (select 1 from goal)
        returning id
      ),
      updated as (
        update savings_goals
        set saved_units = saved_units + ${amount},
            status = case when saved_units + ${amount} >= target_units then 'completed' else 'active' end,
            completed_at = case when saved_units + ${amount} >= target_units then now() else completed_at end
        where id = (select id from goal)
          and exists (select 1 from debited)
        returning id, child_id, title, emoji, target_units, saved_units, status, created_at::text as created_at
      ),
      logged as (
        insert into units_transactions (user_id, child_id, kind, amount, note)
        select ${context.userId}, (select child_id from goal), 'goal', ${-amount},
               'Saved toward "' || (select title from goal) || '"'
        where exists (select 1 from updated)
        returning 1
      )
      select u.id, u.child_id,
        (select name from children where id = u.child_id) as child_name,
        u.title, u.emoji, u.target_units, u.saved_units, u.status, u.created_at
      from updated u`;
    if (!rows.length) {
      // Distinguish "goal missing" from "insufficient funds" for a useful error.
      const g = await sql<{ id: string }>`select id from savings_goals where id = ${data.goalId} and user_id = ${context.userId} and status = 'active'`;
      if (!g.length) throw new Error("Goal not found or no longer active.");
      throw new Error("Not enough Units in the child's balance.");
    }
    return { goal: toSavingsGoal(rows[0]) };
  });

/**
 * Parent releases a goal: escrow returns to the child's spendable balance.
 * Use when the goal is achieved (they go buy the thing) or cancelled.
 */
export const releaseSavingsGoal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { goalId: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean; releasedUnits: number }> => {
    const sql = await getSql();
    // Single atomic statement: credit child + zero escrow + mark released + log.
    // Units can never be credited without the goal being marked released
    // (which would allow a double-release).
    const rows = await sql<{ saved_units: number }>`
      with goal as (
        select id, child_id, saved_units
        from savings_goals
        where id = ${data.goalId} and user_id = ${context.userId} and status != 'released'
      ),
      credited as (
        update children set units = units + (select saved_units from goal)
        where id = (select child_id from goal)
          and user_id = ${context.userId}
          and exists (select 1 from goal)
        returning id
      ),
      released as (
        update savings_goals set saved_units = 0, status = 'released'
        where id = (select id from goal)
          and exists (select 1 from credited)
        returning saved_units
      ),
      logged as (
        insert into units_transactions (user_id, child_id, kind, amount, note)
        select ${context.userId}, (select child_id from goal), 'release',
               (select saved_units from goal), 'Savings goal released'
        where exists (select 1 from released)
          and (select saved_units from goal) > 0
        returning 1
      )
      select (select saved_units from goal) as saved_units
      where exists (select 1 from released)`;
    if (!rows.length) throw new Error("Goal not found or already released.");
    return { ok: true, releasedUnits: rows[0].saved_units };
  });

/* ------------------------------------------------------------------ */
/* Units transaction log + Spending Insights                            */
/* ------------------------------------------------------------------ */

export type UnitsTxKind =
  | "earn" | "spend" | "save" | "vault" | "give" | "goal"
  | "release" | "load" | "award" | "adjust";

async function recordTx(
  sql: any,
  userId: string,
  childId: number | null,
  kind: UnitsTxKind,
  amount: number,
  note?: string,
) {
  await sql`
    insert into units_transactions (user_id, child_id, kind, amount, note)
    values (${userId}, ${childId}, ${kind}, ${amount}, ${note ?? null})`;
}

/**
 * Log a Units movement from the client (chores, store, vault moves that
 * happen in the local store). Server verifies the child belongs to the family.
 */
export const logUnitsTransaction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { childId?: number; kind: UnitsTxKind; amount: number; note?: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    const amount = Math.floor(Number(data.amount));
    if (!Number.isFinite(amount) || amount === 0) throw new Error("Invalid amount.");
    let childId: number | null = null;
    if (data.childId) {
      const kids = await sql<{ id: number }>`
        select id from children where id = ${data.childId} and user_id = ${context.userId}`;
      if (!kids.length) throw new Error("Child not found.");
      childId = kids[0].id;
    } else {
      // Legacy callers (e.g. chore approvals from the single-child ledger
      // store) don't send a childId. If the parent has exactly one child,
      // attribute it there so per-child insights stay accurate.
      const kids = await sql<{ id: number }>`
        select id from children where user_id = ${context.userId} limit 2`;
      if (kids.length === 1) childId = kids[0].id;
    }
    await recordTx(sql, context.userId, childId, data.kind, amount, data.note?.slice(0, 120));
    return { ok: true };
  });

export interface SpendingInsights {
  childId: number | null;
  childName: string;
  earned: number;
  spent: number;
  saved: number;
  given: number;
  txCount: number;
  recent: Array<{ kind: UnitsTxKind; amount: number; note: string | null; at: string }>;
}

/** Aggregated Units flow per child (plus family-wide) for the parent dashboard. */
export const getSpendingInsights = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ insights: SpendingInsights[] }> => {
    const sql = await getSql();
    const kids = await sql<{ id: number; name: string }>`
      select id, name from children where user_id = ${context.userId} order by id`;
    const txs = await sql<{
      child_id: number | null; kind: string; amount: number;
      note: string | null; created_at: string;
    }>`
      select child_id, kind, amount, note, created_at::text as created_at
      from units_transactions
      where user_id = ${context.userId}
        and created_at > now() - interval '30 days'
      order by created_at desc
      limit 500`;

    const EARN = new Set(["earn", "load", "award", "release"]);
    const SPEND = new Set(["spend"]);
    const SAVE = new Set(["save", "vault", "goal"]);
    const GIVE = new Set(["give"]);

    const build = (childId: number | null, childName: string): SpendingInsights => {
      const rows = txs.filter((t) => (childId === null ? true : t.child_id === childId));
      let earned = 0, spent = 0, saved = 0, given = 0;
      for (const t of rows) {
        const a = Math.abs(t.amount);
        if (EARN.has(t.kind)) earned += a;
        else if (SPEND.has(t.kind)) spent += a;
        else if (SAVE.has(t.kind)) saved += a;
        else if (GIVE.has(t.kind)) given += a;
      }
      return {
        childId, childName, earned, spent, saved, given,
        txCount: rows.length,
        recent: rows.slice(0, 8).map((t) => ({
          kind: t.kind as UnitsTxKind, amount: t.amount, note: t.note, at: t.created_at,
        })),
      };
    };

    const insights = kids.map((k) => build(k.id, k.name));
    if (kids.length > 1) insights.unshift(build(null, "Whole family"));
    return { insights };
  });

/* ------------------------------------------------------------------ */
/* Money Moments — conversation starters for parents                    */
/* ------------------------------------------------------------------ */

export interface MoneyMoment {
  id: string;
  icon: string;
  headline: string;
  prompt: string;
  at: string;
}

/**
 * Turn recent Units activity into conversation starters.
 * Financial literacy sticks through dialogue, not dashboards.
 */
export const getMoneyMoments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ moments: MoneyMoment[] }> => {
    const sql = await getSql();
    const txs = await sql<{
      id: string; child_id: number | null; kind: string; amount: number;
      note: string | null; created_at: string; child_name: string | null;
    }>`
      select t.id, t.child_id, t.kind, t.amount, t.note,
             t.created_at::text as created_at, c.name as child_name
      from units_transactions t
      left join children c on c.id = t.child_id
      where t.user_id = ${context.userId}
        and t.created_at > now() - interval '7 days'
      order by t.created_at desc
      limit 50`;

    const moments: MoneyMoment[] = [];
    const seen = new Set<string>();
    const name = (t: { child_name: string | null }) => t.child_name ?? "Your kid";

    for (const t of txs) {
      const n = name(t);
      if (t.kind === "give" && !seen.has(`give-${t.child_id}`)) {
        seen.add(`give-${t.child_id}`);
        moments.push({
          id: `m-${t.id}`,
          icon: "❤️",
          headline: `${n} gave ${Math.abs(t.amount).toLocaleString()} Units`,
          prompt: `Ask ${n}: "What made you want to give? How did it feel after?" Generosity noticed is generosity repeated.`,
          at: t.created_at,
        });
      }
      if (t.kind === "goal" && !seen.has(`goal-${t.child_id}`)) {
        seen.add(`goal-${t.child_id}`);
        moments.push({
          id: `m-${t.id}`,
          icon: "🎯",
          headline: `${n} saved toward a goal`,
          prompt: `Ask ${n}: "What's the thing you're saving for — and what will it feel like when you get there?"`,
          at: t.created_at,
        });
      }
      if (t.kind === "earn" && t.amount >= 50 && !seen.has(`earn-${t.child_id}`)) {
        seen.add(`earn-${t.child_id}`);
        moments.push({
          id: `m-${t.id}`,
          icon: "💪",
          headline: `${n} earned ${t.amount.toLocaleString()} Units${t.note ? ` (${t.note})` : ""}`,
          prompt: `Celebrate the work first — then ask: "What's your plan for these Units: save, spend, or share?"`,
          at: t.created_at,
        });
      }
      if (t.kind === "spend" && Math.abs(t.amount) >= 100 && !seen.has(`spend-${t.child_id}`)) {
        seen.add(`spend-${t.child_id}`);
        moments.push({
          id: `m-${t.id}`,
          icon: "🛒",
          headline: `${n} spent ${Math.abs(t.amount).toLocaleString()} Units`,
          prompt: `No judgment — ask: "Was it worth it? What would you do differently?" Reflection beats lectures.`,
          at: t.created_at,
        });
      }
      if (t.kind === "vault" && !seen.has(`vault-${t.child_id}`)) {
        seen.add(`vault-${t.child_id}`);
        moments.push({
          id: `m-${t.id}`,
          icon: "🏦",
          headline: `${n} put Units in the vault`,
          prompt: `Ask ${n}: "Do you know what those Units will be worth later? Let's look at the Vault together."`,
          at: t.created_at,
        });
      }
      if (moments.length >= 5) break;
    }

    return { moments };
  });

/* ------------------------------------------------------------------ */
/* Gift Mode — wishes, occasions, family contributions                  */
/* ------------------------------------------------------------------ */

export interface GiftContribution {
  id: string;
  contributorName: string;
  amountUnits: number;
  message: string | null;
  createdAt: string;
}

export interface GiftWish {
  id: string;
  childId: number;
  childName: string;
  title: string;
  emoji: string;
  costUnits: number;
  fundedUnits: number;
  occasion: string | null;
  status: "open" | "funded" | "gifted";
  createdAt: string;
  progressPct: number;
  contributions: GiftContribution[];
}

function toGiftWish(r: {
  id: string; child_id: number; child_name: string; title: string; emoji: string;
  cost_units: number; funded_units: number; occasion: string | null;
  status: string; created_at: string;
}, contributions: GiftContribution[]): GiftWish {
  return {
    id: r.id, childId: r.child_id, childName: r.child_name, title: r.title,
    emoji: r.emoji, costUnits: r.cost_units, fundedUnits: r.funded_units,
    occasion: r.occasion, status: r.status as GiftWish["status"],
    createdAt: r.created_at,
    progressPct: r.cost_units > 0 ? Math.min(100, Math.round((r.funded_units / r.cost_units) * 100)) : 0,
    contributions,
  };
}

export const createGiftWish = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { childId: number; title: string; emoji?: string; costUnits: number; occasion?: string }) => input)
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const sql = await getSql();
    const title = data.title.trim().slice(0, 60);
    const cost = Math.floor(Number(data.costUnits));
    if (!title) throw new Error("Name the wish.");
    if (!Number.isFinite(cost) || cost < 1) throw new Error("Cost must be at least 1 Unit.");
    const kids = await sql<{ id: number }>`
      select id from children where id = ${data.childId} and user_id = ${context.userId}`;
    if (!kids.length) throw new Error("Child not found.");
    const rows = await sql<{ id: string }>`
      insert into gift_wishes (user_id, child_id, title, emoji, cost_units, occasion)
      values (${context.userId}, ${data.childId}, ${title}, ${data.emoji ?? "🎁"}, ${cost},
              ${data.occasion?.trim().slice(0, 40) || null})
      returning id`;
    return { id: rows[0].id };
  });

export const listGiftWishes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ wishes: GiftWish[] }> => {
    const sql = await getSql();
    const wishes = await sql<{
      id: string; child_id: number; child_name: string; title: string; emoji: string;
      cost_units: number; funded_units: number; occasion: string | null;
      status: string; created_at: string;
    }>`
      select w.id, w.child_id, c.name as child_name, w.title, w.emoji,
             w.cost_units, w.funded_units, w.occasion, w.status,
             w.created_at::text as created_at
      from gift_wishes w
      join children c on c.id = w.child_id
      where w.user_id = ${context.userId}
      order by w.status asc, w.created_at desc`;
    const contribs = await sql<{
      id: string; wish_id: string; contributor_name: string;
      amount_units: number; message: string | null; created_at: string;
    }>`
      select gc.id, gc.wish_id, gc.contributor_name, gc.amount_units, gc.message,
             gc.created_at::text as created_at
      from gift_contributions gc
      join gift_wishes w on w.id = gc.wish_id
      where w.user_id = ${context.userId}
      order by gc.created_at`;
    return {
      wishes: wishes.map((w) =>
        toGiftWish(w, contribs
          .filter((c) => c.wish_id === w.id)
          .map((c) => ({
            id: c.id, contributorName: c.contributor_name,
            amountUnits: c.amount_units, message: c.message, createdAt: c.created_at,
          }))),
      ),
    };
  });

/** Family member pledges toward a wish (no Units move — fulfilled in real life). */
export const contributeToWish = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { wishId: string; contributorName: string; amountUnits: number; message?: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    const amount = Math.floor(Number(data.amountUnits));
    const name = data.contributorName.trim().slice(0, 40);
    if (!name) throw new Error("Who's contributing?");
    if (!Number.isFinite(amount) || amount < 1) throw new Error("Amount must be at least 1.");
    const wishes = await sql<{ id: string; funded_units: number; cost_units: number }>`
      select id, funded_units, cost_units from gift_wishes
      where id = ${data.wishId} and user_id = ${context.userId} and status = 'open'`;
    if (!wishes.length) throw new Error("Wish not found or already gifted.");
    await sql`
      insert into gift_contributions (user_id, wish_id, contributor_name, amount_units, message)
      values (${context.userId}, ${data.wishId}, ${name}, ${amount},
              ${data.message?.trim().slice(0, 120) || null})`;
    await sql`
      update gift_wishes
      set funded_units = funded_units + ${amount},
          status = case when funded_units + ${amount} >= cost_units then 'funded' else 'open' end
      where id = ${data.wishId}`;
    return { ok: true };
  });

/**
 * Parent confirms the gift was actually purchased/delivered.
 * Pledges reaching the target only marks a wish 'funded' — this
 * explicit confirmation moves it to 'gifted'.
 */
export const markWishGifted = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { wishId: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    const rows = await sql<{ id: string }>`
      update gift_wishes set status = 'gifted'
      where id = ${data.wishId} and user_id = ${context.userId} and status = 'funded'
      returning id`;
    if (!rows.length) throw new Error("Wish not found or not ready to mark gifted.");
    return { ok: true };
  });

export const deleteGiftWish = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { wishId: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    await sql`delete from gift_wishes where id = ${data.wishId} and user_id = ${context.userId}`;
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Pillar Plaza server economy — the game and the app work as one.     */
/*                                                                    */
/* The family ledger's working balances live in the app; these        */
/* functions make the plaza's Unit movements tamper-proof and fully   */
/* audited: daily reward caps are enforced in Postgres (clearing      */
/* localStorage cannot farm rewards), every movement lands in         */
/* units_transactions, and the children.units mirror stays complete.  */
/* Plaza progress itself is cloud-saved per child, and curated        */
/* milestones flow into plaza_events for the parent dashboard feed.   */
/* All functions are parent-authenticated and child-scoped.           */
/* ------------------------------------------------------------------ */

async function assertPlazaChild(sql: any, userId: string, childId: number) {
  const rows = await sql<{ id: number }>`select id from children where id = ${childId} and user_id = ${userId}`;
  if (!rows.length) throw new Error("Child not found.");
  return rows[0].id;
}

/** Plaza entry: server state + today's consumed reward caps + cloud save. */
export const getPlazaServerState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { childId: number }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await assertPlazaChild(sql, context.userId, data.childId);
    const today = new Date().toISOString().slice(0, 10);
    const [child, save, caps] = await Promise.all([
      sql<{ units: number }>`select units from children where id = ${data.childId}`,
      sql<{ save_json: string; updated_at: string }>`select save_json::text as save_json, updated_at from plaza_saves where child_id = ${data.childId}`,
      sql<{ cap_key: string; count: number }>`select cap_key, count from plaza_reward_caps where user_id = ${context.userId} and child_id = ${data.childId} and day = ${today}`,
    ]);
    const capCounts: Record<string, number> = {};
    for (const c of caps) capCounts[c.cap_key] = c.count;
    return {
      units: child[0]?.units ?? 0,
      saveJson: (save[0]?.save_json ?? null) as string | null,
      saveUpdatedAt: (save[0]?.updated_at ?? null) as string | null,
      capCounts,
    };
  });

/**
 * Credit Units from plaza play. When capKey/capLimit are given, the daily cap
 * is enforced atomically in Postgres: the increment and the limit check happen
 * in one statement, so concurrent requests cannot overshoot.
 */
export const plazaEarn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { childId: number; amount: number; note: string; capKey?: string; capLimit?: number }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean; reason?: string; newBalance?: number; capRemaining?: number }> => {
    const sql = await getSql();
    await assertPlazaChild(sql, context.userId, data.childId);
    const amount = Math.max(1, Math.floor(Number(data.amount)));
    if (!Number.isFinite(amount) || amount > 500) throw new Error("Invalid amount.");
    const note = String(data.note || "Pillar Plaza reward").slice(0, 160);
    let capRemaining: number | undefined;
    if (data.capKey && data.capLimit) {
      const today = new Date().toISOString().slice(0, 10);
      const cap = await sql<{ count: number }>`
        insert into plaza_reward_caps (user_id, child_id, cap_key, day, count)
        values (${context.userId}, ${data.childId}, ${data.capKey}, ${today}, 1)
        on conflict (user_id, child_id, cap_key, day)
        do update set count = plaza_reward_caps.count + 1
        returning count`;
      const count = cap[0].count;
      capRemaining = Math.max(0, data.capLimit - count);
      if (count > data.capLimit) {
        await sql`update plaza_reward_caps set count = count - 1 where user_id = ${context.userId} and child_id = ${data.childId} and cap_key = ${data.capKey} and day = ${today}`;
        return { ok: false, reason: "cap", capRemaining: 0 };
      }
    }
    const rows = await sql<{ units: number }>`
      with credited as (
        update children set units = units + ${amount}
        where id = ${data.childId} and user_id = ${context.userId}
        returning units
      ),
      logged as (
        insert into units_transactions (user_id, child_id, kind, amount, note)
        select ${context.userId}, ${data.childId}, 'earn', ${amount}, ${note}
        where exists (select 1 from credited)
        returning 1
      )
      select units from credited`;
    if (!rows.length) throw new Error("Child not found.");
    return { ok: true, newBalance: rows[0].units, capRemaining };
  });

/**
 * Debit Units for plaza builds. Audited + mirrored server-side; the
 * sufficient-funds check stays against the working (local) ledger, which is
 * self-consistent (it can never go below zero).
 */
export const plazaSpend = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { childId: number; amount: number; note: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    await assertPlazaChild(sql, context.userId, data.childId);
    const amount = Math.max(1, Math.floor(Number(data.amount)));
    if (!Number.isFinite(amount) || amount > 100000) throw new Error("Invalid amount.");
    const note = String(data.note || "Pillar Plaza build").slice(0, 160);
    await sql`
      with debited as (
        update children set units = greatest(0, units - ${amount})
        where id = ${data.childId} and user_id = ${context.userId}
        returning id
      )
      insert into units_transactions (user_id, child_id, kind, amount, note)
      select ${context.userId}, ${data.childId}, 'spend', ${amount}, ${note}
      where exists (select 1 from debited)`;
    return { ok: true };
  });

/** Cloud-save the plaza. Last write wins; entry sync keeps the newer side. */
export const plazaSaveGame = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { childId: number; saveJson: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    await assertPlazaChild(sql, context.userId, data.childId);
    if (data.saveJson.length > 200000) throw new Error("Save too large.");
    JSON.parse(data.saveJson);
    await sql`
      insert into plaza_saves (child_id, user_id, save_json, updated_at)
      values (${data.childId}, ${context.userId}, ${data.saveJson}::jsonb, now())
      on conflict (child_id) do update set save_json = excluded.save_json, updated_at = now()`;
    return { ok: true };
  });

/** Curated plaza milestones for the parent dashboard "Plaza activity" feed. */
export const logPlazaEvent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { childId: number; icon: string; headline: string; detail?: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    await assertPlazaChild(sql, context.userId, data.childId);
    await sql`insert into plaza_events (user_id, child_id, icon, headline, detail)
      values (${context.userId}, ${data.childId}, ${String(data.icon).slice(0, 12)}, ${String(data.headline).slice(0, 120)}, ${String(data.detail || "").slice(0, 240)})`;
    await sql`delete from plaza_events where child_id = ${data.childId}
      and id not in (select id from plaza_events where child_id = ${data.childId} order by created_at desc limit 50)`;
    return { ok: true };
  });

export const getPlazaEvents = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { childId?: number; limit?: number }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const limit = Math.min(20, Math.max(1, Number(data.limit) || 8));
    if (data.childId) {
      await assertPlazaChild(sql, context.userId, data.childId);
      return sql<{ icon: string; headline: string; detail: string; created_at: string }>`
        select icon, headline, detail, created_at from plaza_events
        where child_id = ${data.childId} and user_id = ${context.userId}
        order by created_at desc limit ${limit}`;
    }
    return sql<{ icon: string; headline: string; detail: string; created_at: string }>`
      select icon, headline, detail, created_at from plaza_events
      where user_id = ${context.userId}
      order by created_at desc limit ${limit}`;
  });

/* ------------------------------------------------------------------ */
/* Plaza Crew — other students join your plaza and help with quests.  */
/*                                                                    */
/* A crew is every child on the family account (classroom crews are   */
/* the next step, once kid-scoped identities exist). Each helping     */
/* action in the plaza counts as one "help" toward a shared weekly    */
/* Crew Quest; helps pool across the crew, and when the goal is met   */
/* each member claims the reward once. All parent-authenticated and   */
/* child-scoped, like the rest of the plaza economy.                  */
/* ------------------------------------------------------------------ */

const CREW_GOAL_PER_MEMBER = 8;
const CREW_REWARD_UNITS = 20;

/** Monday (UTC) of the current week, as a YYYY-MM-DD key. */
function crewWeekKey(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

async function crewState(sql: any, userId: string) {
  const week = crewWeekKey();
  const kids = await sql<{ id: number; name: string; avatar: string; units: number }>`
    select id, name, avatar, units from children where user_id = ${userId} order by id`;
  const helps = await sql<{ child_id: number; helps: number; claimed: boolean }>`
    select child_id, helps, claimed from plaza_crew_helps
    where user_id = ${userId} and week_key = ${week}`;
  const saves = await sql<{ child_id: number }>`
    select child_id from plaza_saves where user_id = ${userId}`;
  const events = await sql<{ child_id: number; icon: string; headline: string }>`
    select child_id, icon, headline from plaza_events
    where user_id = ${userId} order by created_at desc limit 60`;
  const helpByChild = new Map<number, { helps: number; claimed: boolean }>(
    helps.map((h: any) => [h.child_id as number, { helps: h.helps as number, claimed: h.claimed as boolean }]),
  );
  const hasPlaza = new Set(saves.map((s: any) => s.child_id));
  const latestByChild = new Map<number, { icon: string; headline: string }>();
  for (const e of events) {
    if (!latestByChild.has(e.child_id)) latestByChild.set(e.child_id, { icon: e.icon, headline: e.headline });
  }
  const members = kids.map((k: any) => {
    const h = helpByChild.get(k.id);
    return {
      id: k.id,
      name: k.name,
      avatar: k.avatar || "🧒",
      units: k.units,
      helps: h?.helps ?? 0,
      claimed: h?.claimed ?? false,
      hasPlaza: hasPlaza.has(k.id),
      latest: latestByChild.get(k.id) ?? null,
    };
  });
  const totalHelps = members.reduce((a: number, m: any) => a + m.helps, 0);
  const goal = Math.max(CREW_GOAL_PER_MEMBER, members.length * CREW_GOAL_PER_MEMBER);
  return { week, goal, totalHelps, members };
}

/** Crew roster + this week's shared quest progress, for one plaza child. */
export const getPlazaCrew = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { childId: number }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await assertPlazaChild(sql, context.userId, data.childId);
    const st = await crewState(sql, context.userId);
    return { ...st, you: data.childId };
  });

/** Record one helping action toward the weekly Crew Quest. */
export const plazaCrewHelp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { childId: number }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean; totalHelps: number; goal: number }> => {
    const sql = await getSql();
    await assertPlazaChild(sql, context.userId, data.childId);
    const week = crewWeekKey();
    await sql`
      insert into plaza_crew_helps (user_id, child_id, week_key, helps, updated_at)
      values (${context.userId}, ${data.childId}, ${week}, 1, now())
      on conflict (user_id, child_id, week_key)
      do update set helps = plaza_crew_helps.helps + 1, updated_at = now()`;
    const st = await crewState(sql, context.userId);
    return { ok: true, totalHelps: st.totalHelps, goal: st.goal };
  });

/**
 * Claim the Crew Quest reward once per member per week, after the crew
 * reaches the goal together. Credited through the same audited path as
 * every other plaza earning (children.units mirror + transaction row).
 */
export const plazaCrewClaim = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { childId: number }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean; reason?: string; amount?: number }> => {
    const sql = await getSql();
    await assertPlazaChild(sql, context.userId, data.childId);
    const st = await crewState(sql, context.userId);
    if (st.totalHelps < st.goal) return { ok: false, reason: "goal" };
    const me = st.members.find((m: any) => m.id === data.childId);
    if (!me || me.claimed) return { ok: false, reason: "claimed" };
    const week = crewWeekKey();
    await sql`
      insert into plaza_crew_helps (user_id, child_id, week_key, helps, claimed, updated_at)
      values (${context.userId}, ${data.childId}, ${week}, 0, true, now())
      on conflict (user_id, child_id, week_key)
      do update set claimed = true, updated_at = now()`;
    await sql`
      with credited as (
        update children set units = units + ${CREW_REWARD_UNITS}
        where id = ${data.childId} and user_id = ${context.userId}
        returning id
      )
      insert into units_transactions (user_id, child_id, kind, amount, note)
      select ${context.userId}, ${data.childId}, 'earn', ${CREW_REWARD_UNITS}, 'Pillar Plaza Crew Quest reward'
      where exists (select 1 from credited)`;
    return { ok: true, amount: CREW_REWARD_UNITS };
  });
