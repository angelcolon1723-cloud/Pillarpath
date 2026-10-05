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
      image_url: string | null; unit_price: number;
    }>`select id, name, description, image_url, unit_price from store_products where active = true order by name`;
    return {
      products: rows.map((r) => ({
        id: r.id, name: r.name, description: r.description,
        imageUrl: r.image_url, unitPrice: r.unit_price,
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
    const goals = await sql<{ id: string; child_id: number }>`
      select id, child_id from savings_goals
      where id = ${data.goalId} and user_id = ${context.userId} and status = 'active'`;
    if (!goals.length) throw new Error("Goal not found or no longer active.");
    const childId = goals[0].child_id;
    // Atomic debit: only succeeds if the child has enough.
    const debited = await sql<{ id: number }>`
      update children set units = units - ${amount}
      where id = ${childId} and user_id = ${context.userId} and units >= ${amount}
      returning id`;
    if (!debited.length) throw new Error("Not enough Units in the child's balance.");
    const rows = await sql<{
      id: string; child_id: number; child_name: string; title: string; emoji: string;
      target_units: number; saved_units: number; status: string; created_at: string;
    }>`
      update savings_goals
      set saved_units = saved_units + ${amount},
          status = case when saved_units + ${amount} >= target_units then 'completed' else 'active' end,
          completed_at = case when saved_units + ${amount} >= target_units then now() else completed_at end
      where id = ${data.goalId}
      returning id, child_id,
        (select name from children where id = ${childId}) as child_name,
        title, emoji, target_units, saved_units, status, created_at::text as created_at`;
    await recordTx(sql, context.userId, childId, "goal", -amount,
      `Saved toward "${rows[0].title}"`);
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
    const goals = await sql<{ id: string; child_id: number; saved_units: number }>`
      select id, child_id, saved_units from savings_goals
      where id = ${data.goalId} and user_id = ${context.userId} and status != 'released'`;
    if (!goals.length) throw new Error("Goal not found or already released.");
    const g = goals[0];
    if (g.saved_units > 0) {
      await sql`update children set units = units + ${g.saved_units}
                where id = ${g.child_id} and user_id = ${context.userId}`;
    }
    await sql`update savings_goals set saved_units = 0, status = 'released' where id = ${data.goalId}`;
    if (g.saved_units > 0) {
      await recordTx(sql, context.userId, g.child_id, "release", g.saved_units,
        "Savings goal released");
    }
    return { ok: true, releasedUnits: g.saved_units };
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
