import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { syncCjStock } from "@/lib/suppliers/stock-sync";

/**
 * Nightly stock sync trigger: GET /api/cron/sync-stock
 *
 * Secured by the CRON_SECRET bearer token (server env var). Called by the
 * platform cron job — not by browsers. Returns the sync summary as JSON.
 *
 * To invoke manually (admin only, via the Stockroom "Sync stock from CJ"
 * button instead): use the syncCjStockNow server function.
 */
function validToken(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/cron/sync-stock")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET?.trim();
        if (!secret) {
          return Response.json({ error: "Cron not configured." }, { status: 500 });
        }
        const auth = request.headers.get("authorization");
        const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!validToken(token, secret)) {
          return Response.json({ error: "Unauthorized." }, { status: 401 });
        }
        try {
          const result = await syncCjStock();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
