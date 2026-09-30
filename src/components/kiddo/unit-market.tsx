import { useMemo, useState } from "react";
import { BarChart3, CheckCircle2, LockKeyhole, Sparkles, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useLedger } from "@/store/ledger";
import { createStudioCheckout } from "@/lib/pillarpath-server";
import type { AppData } from "@/components/commerce";

const MARKET_POINTS = [42, 45, 44, 49, 52, 50, 56, 61, 59, 64, 67, 71];

export function UnitMarketView({
  data,
  onRefresh,
}: {
  data: AppData;
  onRefresh: () => Promise<void>;
}) {
  const balance = useLedger((s) => s.balance);
  const vault = useLedger((s) => s.vault);
  const [loading, setLoading] = useState(false);
  const studioPlus = Boolean(data.profile.studio_plus);
  const peak = Math.max(...MARKET_POINTS);
  const current = MARKET_POINTS.at(-1) ?? 0;
  const velocity = Math.round((balance + vault) / 10);
  const savingsRate = Math.round((vault / Math.max(1, balance + vault)) * 100);
  const path = useMemo(
    () =>
      MARKET_POINTS.map(
        (value, i) => `${(i / (MARKET_POINTS.length - 1)) * 100},${100 - (value / peak) * 78}`,
      ).join(" "),
    [peak],
  );

  async function unlockStudio() {
    setLoading(true);
    try {
      const result = await createStudioCheckout({ data: {} });
      if (result.checkoutUrl) window.location.href = result.checkoutUrl;
      else {
        await onRefresh();
        toast.success("Studio Plus preview activated");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open Studio Plus");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
          Parent workspace
        </p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Unit Market
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Family activity for Pillar Units. A simulation dashboard — Units are closed-loop
          credits, not securities.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Activity index</p>
          <p className="mt-2 font-display text-3xl font-semibold">{current}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Unit velocity</p>
          <p className="mt-2 font-display text-3xl font-semibold">{velocity}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Savings rate</p>
          <p className="mt-2 font-display text-3xl font-semibold">{savingsRate}%</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Children</p>
          <p className="mt-2 font-display text-3xl font-semibold">{data.children.length}</p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Unit activity chart</CardTitle>
            <CardHint className="mt-1">Illustrative index, not a market price.</CardHint>
          </div>
          <TrendingUp className="size-5 text-accent" />
        </div>
        <div className="mt-6 h-56 rounded-xl bg-surface-2 p-4">
          <svg
            viewBox="0 0 100 100"
            className="h-full w-full"
            preserveAspectRatio="none"
            role="img"
            aria-label="Illustrative Pillar Unit activity chart"
          >
            <polyline
              points={path}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              className="text-accent"
            />
          </svg>
        </div>
      </Card>

      <Card className="border-accent/20 bg-accent-soft p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-surface text-accent">
            <Sparkles className="size-5" />
          </span>
          <div className="flex-1">
            <CardTitle>Creative Studio Plus</CardTitle>
            <CardHint className="mt-1">
              Unlock advanced studio rooms, merch design, and skill games on the child track.
            </CardHint>
          </div>
          <span className="font-semibold">$4.99</span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg bg-surface p-3 text-sm">Animation flipbook</div>
          <div className="rounded-lg bg-surface p-3 text-sm">Tee designer</div>
          <div className="rounded-lg bg-surface p-3 text-sm">Memory games</div>
        </div>
        <Button
          className="mt-4 w-full sm:w-auto"
          disabled={studioPlus || loading}
          onClick={() => void unlockStudio()}
        >
          {studioPlus ? (
            <>
              <CheckCircle2 className="size-4" /> Active
            </>
          ) : (
            <>
              <LockKeyhole className="size-4" /> Activate for $4.99
            </>
          )}
        </Button>
      </Card>

      <Card className="p-5">
        <CardTitle>Family ecosystem signals</CardTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-lg bg-surface-2 p-3">
            <Users className="size-4 text-accent" /> Parent approvals
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-surface-2 p-3">
            <BarChart3 className="size-4 text-accent" /> Store activity
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-surface-2 p-3">
            <TrendingUp className="size-4 text-accent" /> Savings behavior
          </div>
        </div>
        <Progress value={savingsRate} className="mt-4" />
      </Card>
    </section>
  );
}
