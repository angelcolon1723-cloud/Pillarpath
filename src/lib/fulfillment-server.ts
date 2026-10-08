import { createServerFn } from "@tanstack/react-start";
import { authMiddleware, roleMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { createCachedCjClient } from "@/lib/suppliers/cj-token-store";
import { createPrintifyClientFromEnv } from "@/lib/suppliers/printify";

/* ------------------------------------------------------------------ */
/* Physical fulfillment: Units approval -> doorstep delivery             */
/* ------------------------------------------------------------------ */
/*
 * Kids pay in Units (already real money — the parent loaded them).
 * Parent approval is the checkout moment. This module bridges that
 * approval to physical fulfillment via the product's own supplier
 * (CJ Dropshipping, or Printify for brand merch):
 *
 *   parent approves -> order created (paid in Units)
 *                   -> supplier fulfillment submitted
 *                   -> tracking surfaced to the parent
 *
 * Shipping addresses are captured once and reused.
 */

export interface ShippingAddress {
  id: string;
  recipientName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
}

export interface FulfillmentOrder {
  id: number;
  status: string;
  totalCents: number;
  createdAt: string;
  paymentProvider: string | null;
  items: { productName: string; quantity: number; unitPriceCents: number; imageUrl: string | null }[];
  fulfillmentStatus: string | null;
  trackingNumber: string | null;
}

function toAddress(row: {
  id: string; recipient_name: string; street: string; city: string;
  state: string; zip: string; country: string; phone: string;
}): ShippingAddress {
  return {
    id: row.id,
    recipientName: row.recipient_name,
    street: row.street,
    city: row.city,
    state: row.state,
    zip: row.zip,
    country: row.country,
    phone: row.phone,
  };
}

/** Parent's default shipping address, if any. */
export const getShippingAddress = createServerFn({ method: "GET" })
  .middleware([roleMiddleware("parent")])
  .handler(async ({ context }): Promise<{ address: ShippingAddress | null }> => {
    const sql = await getSql();
    const rows = await sql<{
      id: string; recipient_name: string; street: string; city: string;
      state: string; zip: string; country: string; phone: string;
    }>`
      select id, recipient_name, street, city, state, zip, country, phone
      from shipping_addresses
      where user_id = ${context.identity.userId} and is_default = true
      order by updated_at desc limit 1`;
    return { address: rows.length ? toAddress(rows[0]) : null };
  });

/** Save (or replace) the parent's shipping address. */
export const saveShippingAddress = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("parent")])
  .validator((input: {
    recipientName: string; street: string; city: string;
    state: string; zip: string; phone?: string;
  }) => input)
  .handler(async ({ context, data }): Promise<{ address: ShippingAddress }> => {
    const recipientName = data.recipientName.trim();
    const street = data.street.trim();
    const city = data.city.trim();
    const state = data.state.trim().toUpperCase();
    const zip = data.zip.trim();
    const phone = (data.phone ?? "").trim();
    if (!recipientName) throw new Error("Enter the recipient's name.");
    if (!street || !city) throw new Error("Enter the full street address and city.");
    if (!/^[A-Z]{2}$/.test(state)) throw new Error("Enter the 2-letter state code.");
    if (!/^\d{5}(-\d{4})?$/.test(zip)) throw new Error("Enter a valid ZIP code.");
    const sql = await getSql();
    const userId = context.identity.userId;
    await sql`update shipping_addresses set is_default = false where user_id = ${userId}`;
    const id = crypto.randomUUID();
    const rows = await sql<{
      id: string; recipient_name: string; street: string; city: string;
      state: string; zip: string; country: string; phone: string;
    }>`
      insert into shipping_addresses (id, user_id, recipient_name, street, city, state, zip, country, phone, is_default)
      values (${id}, ${userId}, ${recipientName}, ${street}, ${city}, ${state}, ${zip}, 'US', ${phone}, true)
      returning id, recipient_name, street, city, state, zip, country, phone`;
    return { address: toAddress(rows[0]) };
  });

/**
 * Fulfill a kid's approved marketplace purchase.
 *
 * Called by the parent right after approving (Units are deducted
 * client-side as today). Creates the order as paid-in-Units and kicks
 * off CJ fulfillment in the background.
 */
export const fulfillUnitPurchase = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("parent")])
  .validator((input: { productId: string; quantity?: number }) => input)
  .handler(async ({ context, data }): Promise<{ orderId: number }> => {
    const userId = context.identity.userId;
    const quantity = Math.max(1, Math.floor(data.quantity ?? 1));
    const sql = await getSql();

    const products = await sql<{
      id: string; name: string; retail_price_cents: number;
      supplier_name: string; supplier_sku: string; image_url: string | null;
    }>`
      select id, name, retail_price_cents, supplier_name, supplier_sku, image_url
      from store_products where id = ${data.productId} and active = true`;
    if (!products.length) throw new Error("That product is no longer available.");
    const product = products[0];

    const addrRows = await sql<{
      id: string; recipient_name: string; street: string; city: string;
      state: string; zip: string; country: string; phone: string;
    }>`
      select id, recipient_name, street, city, state, zip, country, phone
      from shipping_addresses
      where user_id = ${userId} and is_default = true
      order by updated_at desc limit 1`;
    if (!addrRows.length) throw new Error("Add a shipping address first.");
    const addr = toAddress(addrRows[0]);

    const total = product.retail_price_cents * quantity;
    const addressJson = JSON.stringify({
      line1: addr.street, city: addr.city, state: addr.state,
      postalCode: addr.zip, country: addr.country, phone: addr.phone,
    });
    // Parent's email for the CJ order + notifications.
    const userRows = await sql<{ email: string }>`select email from "user" where id = ${userId}`;
    const email = userRows[0]?.email ?? "";

    const orderRows = await sql<{ id: number }>`
      insert into orders (user_id, status, payment_provider, subtotal_cents, shipping_cents, total_cents,
                          shipping_name, shipping_email, shipping_address)
      values (${userId}, 'paid', 'units', ${total}, 0, ${total},
              ${addr.recipientName}, ${email}, ${addressJson}::jsonb)
      returning id`;
    const orderId = orderRows[0].id;

    await sql`
      insert into order_items (order_id, product_id, product_name, supplier_name, supplier_sku, quantity, unit_price_cents)
      values (${orderId}, ${product.id}, ${product.name}, ${product.supplier_name}, ${product.supplier_sku}, ${quantity}, ${product.retail_price_cents})`;
    await sql`
      insert into fulfillments (order_id, supplier_name, status)
      values (${orderId}, ${product.supplier_name}, 'queued')`;
    // Route fulfillment to the product's actual supplier — Printify brand
    // merch goes to Printify, everything else to CJ.
    const supplierKey = product.supplier_name === "Printify" ? "printify" : "cjdropshipping";
    await sql`
      insert into supplier_orders (order_id, supplier, status, payload)
      values (${orderId}, ${supplierKey}, 'pending', ${JSON.stringify({ productId: product.id, quantity })}::jsonb)`;

    // Fire supplier fulfillment in the background — never block the parent.
    const submit = supplierKey === "printify" ? submitPrintifyFulfillment : submitCjFulfillment;
    void submit(orderId).catch((e) => {
      console.error(`[fulfillment] ${supplierKey} submit failed for order ${orderId}:`, e);
    });

    return { orderId };
  });

/** Parent's order history with fulfillment status. */
export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([roleMiddleware("parent")])
  .handler(async ({ context }): Promise<{ orders: FulfillmentOrder[] }> => {
    const sql = await getSql();
    const rows = await sql<{
      id: number; status: string; total_cents: number; created_at: string;
      payment_provider: string | null;
      fulfillment_status: string | null; tracking_number: string | null;
    }>`
      select o.id, o.status, o.total_cents, o.created_at::text as created_at,
             o.payment_provider,
             (select f.status from fulfillments f where f.order_id = o.id order by f.id desc limit 1) as fulfillment_status,
             (select so.tracking_number from supplier_orders so where so.order_id = o.id order by so.id desc limit 1) as tracking_number
      from orders o
      where o.user_id = ${context.identity.userId}
      order by o.id desc limit 50`;
    const orders: FulfillmentOrder[] = [];
    for (const r of rows) {
      const items = await sql<{
        product_name: string; quantity: number; unit_price_cents: number; image_url: string | null;
      }>`
        select oi.product_name, oi.quantity, oi.unit_price_cents, p.image_url
        from order_items oi left join store_products p on p.id = oi.product_id
        where oi.order_id = ${r.id}`;
      orders.push({
        id: r.id,
        status: r.status,
        totalCents: r.total_cents,
        createdAt: r.created_at,
        paymentProvider: r.payment_provider,
        items: items.map((i) => ({
          productName: i.product_name,
          quantity: i.quantity,
          unitPriceCents: i.unit_price_cents,
          imageUrl: i.image_url,
        })),
        fulfillmentStatus: r.fulfillment_status,
        trackingNumber: r.tracking_number,
      });
    }
    return { orders };
  });

/* ------------------------------------------------------------------ */
/* CJ submission (background)                                          */
/* ------------------------------------------------------------------ */

async function submitCjFulfillment(orderId: number): Promise<void> {
  const sql = await getSql();
  const client = await createCachedCjClient();
  if (!client) {
    await sql`update supplier_orders set status = 'failed', payload = payload || '{"error":"CJ_API_KEY not configured"}'::jsonb, updated_at = now() where order_id = ${orderId}`;
    return;
  }
  const orderRows = await sql<{
    shipping_name: string; shipping_email: string; shipping_address: Record<string, string>;
  }>`select shipping_name, shipping_email, shipping_address from orders where id = ${orderId}`;
  if (!orderRows.length) return;
  const o = orderRows[0];
  const addr = o.shipping_address as Record<string, string>;
  const items = await sql<{ supplier_sku: string; quantity: number; product_name: string }>`
    select supplier_sku, quantity, product_name from order_items
    where order_id = ${orderId} and supplier_name <> 'Printify'`;
  if (!items.length) return; // nothing for CJ in this order

  // Resolve CJ variant IDs from the screened catalog.
  const cjItems: { vid: string; quantity: number }[] = [];
  for (const item of items) {
    const sup = await sql<{ variants: unknown }>`
      select variants from supplier_products
      where supplier = 'cjdropshipping' and supplier_sku = ${item.supplier_sku}
      order by id desc limit 1`;
    const variants = (sup[0]?.variants ?? []) as { vid?: string }[];
    const vid = variants.find((v) => v.vid)?.vid;
    if (!vid) {
      await sql`update supplier_orders set status = 'failed', payload = payload || ${JSON.stringify({ error: `No CJ variant for SKU ${item.supplier_sku}` })}::jsonb, updated_at = now() where order_id = ${orderId}`;
      await sql`update fulfillments set status = 'failed' where order_id = ${orderId}`;
      return;
    }
    cjItems.push({ vid, quantity: item.quantity });
  }

  const cjOrder = await client.createOrder({
    orderNumber: `PP-${orderId}-${Date.now()}`,
    fromCountryCode: "US",
    logisticName: "USPS",
    address: {
      countryCode: "US",
      country: "United States",
      province: addr.state ?? "",
      city: addr.city ?? "",
      address: addr.line1 ?? "",
      customerName: o.shipping_name,
      phone: addr.phone ?? "",
      zipCode: addr.postalCode ?? "",
      email: o.shipping_email,
    },
    items: cjItems,
  });

  await sql`
    update supplier_orders
    set status = 'submitted', supplier_order_id = ${cjOrder.orderId},
        supplier_order_number = ${cjOrder.orderNumber},
        tracking_number = ${cjOrder.trackingNumber},
        payload = payload || ${JSON.stringify({ cjStatus: cjOrder.status })}::jsonb,
        updated_at = now()
    where order_id = ${orderId}`;
  await sql`update fulfillments set status = 'submitted', supplier_order_reference = ${cjOrder.orderId} where order_id = ${orderId}`;
}

/* ------------------------------------------------------------------ */
/* Printify submission (background)                                    */
/* ------------------------------------------------------------------ */

/**
 * Submit an order to Printify. Each item orders the designed draft
 * product stored on its supplier_products row (compliance →
 * printify_draft_product_id) in the first enabled variant — the same
 * "default variant" convention the CJ path uses. Created order ids are
 * recorded in the supplier_orders payload BEFORE submitting to
 * production, so a retry re-submits the same Printify orders instead
 * of creating duplicates.
 */
async function submitPrintifyFulfillment(orderId: number): Promise<void> {
  const sql = await getSql();
  const fail = async (error: string) => {
    await sql`update supplier_orders set status = 'failed', payload = payload || ${JSON.stringify({ error })}::jsonb, updated_at = now() where order_id = ${orderId}`;
    await sql`update fulfillments set status = 'failed' where order_id = ${orderId}`;
  };
  const client = createPrintifyClientFromEnv();
  if (!client) {
    await sql`update supplier_orders set status = 'failed', payload = payload || '{"error":"PRINTIFY_API_KEY not configured"}'::jsonb, updated_at = now() where order_id = ${orderId}`;
    return;
  }
  const soRows = await sql<{ payload: Record<string, unknown> }>`
    select payload from supplier_orders where order_id = ${orderId} and supplier = 'printify'`;
  const priorIds = ((soRows[0]?.payload as { printifyOrderIds?: string[] })?.printifyOrderIds ?? []).filter(
    (x) => typeof x === "string" && x,
  );

  const shops = await client.listShops();
  if (!shops.length) return fail("No Printify shop found.");
  const shopId = shops[0].id;

  if (!priorIds.length) {
    const orderRows = await sql<{
      shipping_name: string; shipping_email: string; shipping_address: Record<string, string>;
    }>`select shipping_name, shipping_email, shipping_address from orders where id = ${orderId}`;
    if (!orderRows.length) return;
    const o = orderRows[0];
    const addr = o.shipping_address as Record<string, string>;
    const nameParts = (o.shipping_name || "").trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? "PillarPath";
    const lastName = nameParts.slice(1).join(" ") || firstName;
    const items = await sql<{ supplier_sku: string; quantity: number; product_name: string }>`
      select supplier_sku, quantity, product_name from order_items
      where order_id = ${orderId} and supplier_name = 'Printify'`;
    if (!items.length) return; // nothing for Printify in this order

    const createdIds: string[] = [];
    for (const [idx, item] of items.entries()) {
      const sup = await sql<{ compliance: Record<string, unknown> | null }>`
        select compliance from supplier_products
        where supplier = 'printify'
          and (supplier_sku = ${item.supplier_sku} or supplier_product_id = ${item.supplier_sku})
        order by id desc limit 1`;
      const draftId = (sup[0]?.compliance as { printify_draft_product_id?: string } | null)
        ?.printify_draft_product_id;
      if (!draftId) {
        return fail(`No Printify design on file for ${item.product_name} — create its draft in the Society stockroom first.`);
      }
      const draft = await client.getProduct(shopId, draftId);
      const variant = draft.variants.find((v) => v.isEnabled) ?? draft.variants[0];
      if (!variant) return fail(`Printify design for ${item.product_name} has no variants.`);
      const created = await client.createOrder(shopId, {
        externalId: `PP-${orderId}-${idx + 1}`,
        label: `PillarPath order ${orderId}`,
        shopProductId: draftId,
        variantId: variant.id,
        quantity: item.quantity,
        address: {
          firstName,
          lastName,
          email: o.shipping_email,
          phone: addr.phone ?? "",
          country: "US",
          region: addr.state ?? "",
          address1: addr.line1 ?? "",
          city: addr.city ?? "",
          zip: addr.postalCode ?? "",
        },
      });
      createdIds.push(created.id);
      // Record progress immediately — a later failure must not duplicate.
      await sql`update supplier_orders
        set payload = payload || ${JSON.stringify({ printifyOrderIds: createdIds })}::jsonb, updated_at = now()
        where order_id = ${orderId}`;
    }
    priorIds.push(...createdIds);
  }

  for (const pid of priorIds) {
    await client.submitOrder(shopId, pid);
  }
  await sql`
    update supplier_orders
    set status = 'submitted', supplier_order_id = ${priorIds[0] ?? null},
        payload = payload || ${JSON.stringify({ printifyOrderIds: priorIds })}::jsonb,
        updated_at = now()
    where order_id = ${orderId}`;
  await sql`update fulfillments set status = 'submitted', supplier_order_reference = ${priorIds[0] ?? null} where order_id = ${orderId}`;
}

/**
 * Stripe-paid orders (parent dollar store): route the order to its real
 * supplier(s) once the webhook confirms payment. Ensures the
 * supplier_orders tracking row exists, then runs the CJ and/or Printify
 * submissions for whichever items the order contains.
 */
export async function submitPaidOrderFulfillment(orderId: number): Promise<void> {
  const sql = await getSql();
  const items = await sql<{ supplier_name: string }>`
    select supplier_name from order_items where order_id = ${orderId}`;
  if (!items.length) return;
  const hasPrintify = items.some((i) => i.supplier_name === "Printify");
  const hasCj = items.some((i) => i.supplier_name !== "Printify");
  const supplierKey = hasPrintify && hasCj ? "mixed" : hasPrintify ? "printify" : "cjdropshipping";
  const existing = await sql<{ id: number }>`select id from supplier_orders where order_id = ${orderId}`;
  if (!existing.length) {
    await sql`
      insert into supplier_orders (order_id, supplier, status, payload)
      values (${orderId}, ${supplierKey}, 'pending', ${JSON.stringify({ source: "stripe" })}::jsonb)`;
  }
  if (hasCj) await submitCjFulfillment(orderId);
  if (hasPrintify) await submitPrintifyFulfillment(orderId);
}

/* ------------------------------------------------------------------ */
/* Retry (called from the corporate admin side)                         */
/* ------------------------------------------------------------------ */

/** Retry a failed supplier submission for an order. Exported for the admin API. */
export async function retryFulfillmentSubmission(orderId: number): Promise<{ ok: boolean; message: string }> {
  const sql = await getSql();
  const existing = await sql<{ status: string; supplier: string }>`
    select status, supplier from supplier_orders where order_id = ${orderId}`;
  if (!existing.length) throw new Error("Order not found.");
  const supplierName = existing[0].supplier === "printify" ? "Printify" : "CJ";
  if (existing[0].status === "submitted" || existing[0].status === "paid") {
    return { ok: true, message: `Already submitted to ${supplierName}.` };
  }
  await sql`
    update supplier_orders
    set status = 'pending', payload = payload || '{"retried":true}'::jsonb, updated_at = now()
    where order_id = ${orderId}`;
  try {
    if (existing[0].supplier === "printify") {
      await submitPrintifyFulfillment(orderId);
    } else if (existing[0].supplier === "mixed") {
      await submitPaidOrderFulfillment(orderId);
    } else {
      await submitCjFulfillment(orderId);
    }
    const after = await sql<{ status: string }>`
      select status from supplier_orders where order_id = ${orderId}`;
    if (after[0]?.status === "submitted") {
      return { ok: true, message: `Submitted to ${supplierName} successfully.` };
    }
    const errRow = await sql<{ payload: Record<string, unknown> }>`
      select payload from supplier_orders where order_id = ${orderId}`;
    const err = (errRow[0]?.payload as { error?: string })?.error ?? "unknown error";
    return { ok: false, message: `Still failing: ${err}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Submission failed." };
  }
}
