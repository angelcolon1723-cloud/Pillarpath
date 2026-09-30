import { getSql } from "@/lib/db";

/** Generic supplier adapter. Connect a dropship provider by setting server-side env vars. */
export async function submitPaidOrderToSupplier(orderId: number) {
  const endpoint = process.env.DROPSHIP_API_URL?.trim();
  const apiKey = process.env.DROPSHIP_API_KEY?.trim();
  if (!endpoint || !apiKey) return { connected: false as const, submitted: false as const };
  const sql = await getSql();
  const items = await sql<{ product_id: string; product_name: string; supplier_name: string; supplier_sku: string; quantity: number }>`select product_id, product_name, supplier_name, supplier_sku, quantity from order_items where order_id = ${orderId}`;
  const order = await sql<{ shipping_name: string | null; shipping_email: string | null; shipping_address: unknown }>`select shipping_name, shipping_email, shipping_address from orders where id = ${orderId}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, customer: order[0], items }),
  });
  if (!response.ok) throw new Error(`Supplier submission failed with ${response.status}`);
  const payload = (await response.json().catch(() => ({}))) as { supplierOrderReference?: string; trackingNumber?: string };
  await sql`
    update fulfillments set status = 'submitted', supplier_order_reference = ${payload.supplierOrderReference ?? null}, tracking_number = ${payload.trackingNumber ?? null}, updated_at = now()
    where order_id = ${orderId}
  `;
  return { connected: true as const, submitted: true as const, supplierOrderReference: payload.supplierOrderReference ?? null };
}
