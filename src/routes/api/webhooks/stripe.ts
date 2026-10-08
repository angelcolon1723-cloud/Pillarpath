import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/db";

function verifyStripeSignature(payload: string, signature: string, secret: string) {
  const timestamp = signature.split(",").find((part) => part.startsWith("t="))?.slice(2);
  const v1 = signature.split(",").find((part) => part.startsWith("v1="))?.slice(3);
  if (!timestamp || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const digest = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(v1, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
        const signature = request.headers.get("stripe-signature");
        if (!secret || !signature || !verifyStripeSignature(body, signature, secret)) {
          return new Response("Invalid signature", { status: 400 });
        }
        const event = JSON.parse(body) as { type: string; data: { object: { metadata?: { order_id?: string }; payment_status?: string } } };
        const orderId = event.data.object.metadata?.order_id;
        if (orderId && event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") {
          const sql = await getSql();
          await sql`update orders set status = 'paid' where id = ${Number(orderId)}`;
          await sql`update fulfillments set status = 'queued', updated_at = now() where order_id = ${Number(orderId)}`;
          try {
            const { submitPaidOrderFulfillment } = await import("@/lib/fulfillment-server");
            await submitPaidOrderFulfillment(Number(orderId));
          } catch { await sql`update fulfillments set status = 'error', updated_at = now() where order_id = ${Number(orderId)}`; }
        }
        return new Response("ok");
      },
    },
  },
});
