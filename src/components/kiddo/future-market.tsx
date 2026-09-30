import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { createFutureUnitPlan, matureFutureUnitPlan } from "@/lib/pillarpath-server";
import type { AppData } from "@/components/commerce";

const PLANS = {
  sprout: { label: "Sprout", term: "30 days", bonus: "5% Unit bonus", min: 10, tone: "Foundations" },
  builder: { label: "Builder", term: "60 days", bonus: "10% Unit bonus", min: 25, tone: "Builder" },
  pathfinder: { label: "Pathfinder", term: "90 days", bonus: "15% Unit bonus", min: 50, tone: "Challenger" },
  creator: { label: "Creator", term: "180 days", bonus: "25% Unit bonus", min: 100, tone: "Mastery" },
} as const;

type PlanCode = keyof typeof PLANS;

export function FutureUnitsMarket({
  data,
  onRefresh,
}: {
  data: AppData;
  onRefresh: () => Promise<void>;
}) {
  const [planCode, setPlanCode] = useState<PlanCode>("builder");
  const [units, setUnits] = useState(25);
  const [loading, setLoading] = useState(false);
  const plan = PLANS[planCode];
  const bonus = Math.floor(
    units * { sprout: 0.05, builder: 0.1, pathfinder: 0.15, creator: 0.25 }[planCode],
  );
  const projected = units + bonus;
  const active = useMemo(
    () => data.futurePlans.filter((p) => p.status === "active" || p.status === "simulation"),
    [data.futurePlans],
  );

  async function reserve() {
    if (units < plan.min) {
      toast.error(`Minimum for ${plan.label} is ${plan.min} Units.`);
      return;
    }
    setLoading(true);
    try {
      await createFutureUnitPlan({ data: { planCode, committedUnits: units } });
      await onRefresh();
      toast.success("Future Units plan reserved in closed-loop mode");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create plan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Parent-only</p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Future Units
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Lock Units toward a family goal and unlock a set bonus at maturity. Closed-loop
          rewards only — not stocks, cash, or a tradable market.
        </p>
      </div>

      <Card className="border-accent/20 bg-accent-soft p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Production safety gate</CardTitle>
            <CardHint className="mt-1">
              Cash-funded trading stays off until legal and payments review is complete.
            </CardHint>
          </div>
          <Badge tone="accent">Closed-loop Units</Badge>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-4">
        {(Object.entries(PLANS) as Array<[PlanCode, (typeof PLANS)[PlanCode]]>).map(
          ([code, option]) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                setPlanCode(code);
                setUnits(Math.max(option.min, units));
              }}
              className={`rounded-2xl border p-5 text-left transition ${
                planCode === code
                  ? "border-accent bg-accent-soft"
                  : "border-border bg-surface hover:bg-surface-2"
              }`}
            >
              <Badge tone={planCode === code ? "accent" : "muted"}>{option.tone}</Badge>
              <h3 className="mt-4 font-display text-xl font-semibold">{option.label}</h3>
              <p className="mt-1 text-sm text-muted">
                {option.term} · {option.bonus}
              </p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-subtle">
                Minimum
              </p>
              <p className="mt-1 font-mono text-lg">{option.min} U</p>
            </button>
          ),
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <Card className="space-y-4 p-5">
          <CardTitle>Reserve future Units</CardTitle>
          <CardHint>
            Commit Units from the family ledger. Nothing is charged to a card.
          </CardHint>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Plan
              <NativeSelect
                className="mt-2"
                value={planCode}
                onChange={(e) => setPlanCode(e.target.value as PlanCode)}
              >
                {Object.entries(PLANS).map(([code, option]) => (
                  <option key={code} value={code}>
                    {option.label} · {option.term}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm font-semibold">
              Units to reserve
              <Input
                className="mt-2"
                type="number"
                min={plan.min}
                max={100000}
                value={units}
                onChange={(e) => setUnits(Math.max(0, Number(e.target.value)))}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-surface-2 p-4">
              <p className="text-xs text-muted">Committed</p>
              <p className="mt-1 font-display text-2xl font-semibold">{units} U</p>
            </div>
            <div className="rounded-xl bg-surface-2 p-4">
              <p className="text-xs text-muted">Bonus</p>
              <p className="mt-1 font-display text-2xl font-semibold">+{bonus} U</p>
            </div>
            <div className="rounded-xl bg-surface-2 p-4">
              <p className="text-xs text-muted">At maturity</p>
              <p className="mt-1 font-display text-2xl font-semibold">{projected} U</p>
            </div>
          </div>
          <Button
            className="w-full"
            disabled={loading || units < plan.min}
            onClick={() => void reserve()}
          >
            {loading ? "Reserving…" : `Reserve ${units} Future Units`}
          </Button>
        </Card>
        <Card className="p-5">
          <CardTitle>Why parents use it</CardTitle>
          <div className="mt-4 space-y-3 text-sm text-muted">
            <p>Name a future goal without leaving the family workspace.</p>
            <p>Turn long-term saving into a dated milestone.</p>
            <p>Keep the child studio focused on making, not money markets.</p>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <CardTitle>My future plans</CardTitle>
          <CardHint className="mt-1">Private to this parent account.</CardHint>
        </div>
        {active.length ? (
          active.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 border-b border-border px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold">
                  {PLANS[item.plan_code as PlanCode]?.label ?? item.plan_code} plan
                </p>
                <p className="text-sm text-muted">
                  {item.committed_units} U + {item.bonus_units} U bonus · matures{" "}
                  {new Date(item.maturity_at).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={new Date(item.maturity_at).getTime() > Date.now()}
                onClick={async () => {
                  try {
                    await matureFutureUnitPlan({ data: { planId: item.id } });
                    await onRefresh();
                    toast.success("Future plan matured");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Plan is not ready");
                  }
                }}
              >
                Mature
              </Button>
            </div>
          ))
        ) : (
          <p className="p-6 text-sm text-muted">No future plans yet.</p>
        )}
      </Card>
    </section>
  );
}
