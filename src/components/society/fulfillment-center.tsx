import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  listFulfillmentOrders,
  payCjOrder,
  refreshCjTracking,
  retryCjFulfillment,
  testCjConnection,
  cjDeepDiagnostic,
  type AdminFulfillmentOrder,
} from "@/lib/corporate-server";

/**
 * Fulfillment operations — the CJ shipping command center.
 *
 * Every physical order lands here: CJ submission status, payment,
 * tracking. Orders are created unpaid so the founder reviews each one
 * before real money moves to CJ.
 */
export function FulfillmentCenter() {
  const [orders, setOrders] = useState<AdminFulfillmentOrder[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cjTest, setCjTest] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await listFulfillmentOrders();
      setOrders(r.orders);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load orders.");
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(key: string, fn: () => Promise<{ ok: boolean; message: string }>) {
    setBusy(key);
    try {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  const [cjDiag, setCjDiag] = useState<string | null>(null);

  async function testCj() {
    setCjTest("Testing…");
    try {
      const r = await testCjConnection({ data: undefined });
      setCjTest(r.ok ? `✅ ${r.message}` : `❌ ${r.message}`);
    } catch (e) {
      setCjTest(`❌ ${e instanceof Error ? e.message : "Test failed."}`);
    }
  }

  async function deepDiag() {
    setCjDiag("Running deep diagnostic…");
    try {
      const r = await cjDeepDiagnostic({ data: undefined });
      setCjDiag(JSON.stringify(r, null, 1));
    } catch (e) {
      setCjDiag(`Failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  const cjBadge = (o: AdminFulfillmentOrder) => {
    switch (o.cjStatus) {
      case "paid": return <Badge tone="accent">Paid · fulfilling</Badge>;
      case "submitted": return <Badge tone="accent">Submitted — pay to ship</Badge>;
      case "failed": return <Badge tone="danger">Failed</Badge>;
      case "pending": return <Badge tone="muted">Queued</Badge>;
      default: return <Badge tone="muted">{o.cjStatus ?? "—"}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold">CJ Dropshipping connection</h3>
            <p className="text-xs text-muted">
              Orders are created unpaid — you review and pay each one from your CJ balance.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={testCj}>
              Test CJ connection
            </Button>
            <Button size="sm" variant="ghost" onClick={deepDiag}>
              Deep diagnostic
            </Button>
          </div>
        </div>
        {cjTest && <p className="mt-2 text-xs">{cjTest}</p>}
        {cjDiag && (
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-surface-2 p-3 font-mono text-[11px] whitespace-pre-wrap">
            {cjDiag}
          </pre>
        )}
      </Card>

      {orders === null ? (
        <p className="py-6 text-center text-sm text-muted">Loading orders…</p>
      ) : orders.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-display text-lg font-semibold">No orders yet</p>
          <p className="mt-1 text-sm text-muted">
            When parents approve marketplace purchases, they’ll land here for CJ fulfillment.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.orderId} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Order #{o.orderId}</p>
                  <p className="text-xs text-muted">
                    {o.items.map((i) => `${i.quantity}× ${i.productName}`).join(", ")}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {o.customerEmail} · {o.shipTo || "no address"}
                  </p>
                  <p className="text-xs text-muted">
                    ${(o.totalCents / 100).toFixed(2)} · {new Date(o.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {cjBadge(o)}
                  {o.trackingNumber && (
                    <p className="font-mono text-[11px] text-muted">{o.trackingNumber}</p>
                  )}
                </div>
              </div>
              {o.cjError && (
                <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {o.cjError}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {(o.cjStatus === "failed" || o.cjStatus === "pending") && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === `retry-${o.orderId}`}
                    onClick={() => run(`retry-${o.orderId}`, () => retryCjFulfillment({ data: { orderId: o.orderId } }))}
                  >
                    {busy === `retry-${o.orderId}` ? "Retrying…" : "Retry CJ submission"}
                  </Button>
                )}
                {o.cjStatus === "submitted" && (
                  <Button
                    size="sm"
                    disabled={busy === `pay-${o.orderId}`}
                    onClick={() => run(`pay-${o.orderId}`, () => payCjOrder({ data: { orderId: o.orderId } }))}
                  >
                    {busy === `pay-${o.orderId}` ? "Paying…" : "Pay with CJ balance"}
                  </Button>
                )}
                {o.trackingNumber && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === `track-${o.orderId}`}
                    onClick={() => run(`track-${o.orderId}`, () => refreshCjTracking({ data: { orderId: o.orderId } }))}
                  >
                    Refresh tracking
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
