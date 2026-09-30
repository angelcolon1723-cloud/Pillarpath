import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/db";

function validSignature(body: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const digest = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/webhooks/dropship")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const secret = process.env.DROPSHIP_WEBHOOK_SECRET?.trim();
        if (!secret || !validSignature(body, request.headers.get("x-pillarpath-signature"), secret)) return new Response("Invalid signature", { status: 400 });
        const payload = JSON.parse(body) as { orderId: number; status: string; trackingNumber?: string; supplierOrderReference?: string };
        const sql = await getSql();
        await sql`
          update fulfillments
          set status = ${payload.status}, tracking_number = ${payload.trackingNumber ?? null}, supplier_order_reference = ${payload.supplierOrderReference ?? null}, updated_at = now()
          where order_id = ${payload.orderId}
        `;
        if (["shipped", "delivered"].includes(payload.status)) await sql`update orders set status = ${payload.status} where id = ${payload.orderId}`;
        return new Response("ok");
      },
    },
  },
});
