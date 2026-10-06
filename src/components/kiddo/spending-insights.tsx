import { useEffect, useState } from "react";
import { PiggyBank, TrendingUp, ShoppingBag, HeartHandshake, ReceiptText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getSpendingInsights, type SpendingInsights, type UnitsTxKind } from "@/lib/pillarpath-server";

const KIND_META: Record<string, { label: string; color: string }> = {
  earn: { label: "Earned", color: "bg-emerald-500" },
  load: { label: "Loaded", color: "bg-emerald-500" },
  award: { label: "Awarded", color: "bg-emerald-500" },
  release: { label: "Released", color: "bg-emerald-500" },
  spend: { label: "Spent", color: "bg-sky-500" },
  save: { label: "Saved", color: "bg-violet-500" },
  vault: { label: "Vault", color: "bg-violet-500" },
  goal: { label: "Goal", color: "bg-violet-500" },
  give: { label: "Given", color: "bg-rose-500" },
};

function FlowBar({ insight }: { insight: SpendingInsights }) {
  const total = insight.earned + insight.spent + insight.saved + insight.given;
  const segs = [
    { v: insight.earned, color: "bg-emerald-500", label: "Earned" },
    { v: insight.spent, color: "bg-sky-500", label: "Spent" },
    { v: insight.saved, color: "bg-violet-500", label: "Saved" },
    { v: insight.given, color: "bg-rose-500", label: "Given" },
  ].filter((s) => s.v > 0);
  if (total === 0) {
    return <p className="text-xs text-muted">No Units movement in the last 30 days yet.</p>;
  }
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
        {segs.map((s) => (
          <div
            key={s.label}
            className={cn(s.color, "h-full transition-all")}
            style={{ width: `${(s.v / total) * 100}%` }}
            title={`${s.label}: ${s.v.toLocaleString()}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {segs.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", s.color)} />
            <span className="text-muted">{s.label}</span>
            <span className="font-bold">{s.v.toLocaleString()}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function txLabel(kind: UnitsTxKind, amount: number): string {
  const meta = KIND_META[kind] ?? { label: kind };
  const sign = amount < 0 ? "−" : "+";
  return `${sign}${Math.abs(amount).toLocaleString()} · ${meta.label}`;
}

/**
 * Spending Insights — where the kid's Units actually go.
 * Lives on the parent dashboard.
 */
export function SpendingInsightsPanel() {
  const [insights, setInsights] = useState<SpendingInsights[] | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    getSpendingInsights()
      .then((r) => setInsights(r.insights))
      .catch(() => setInsights([]));
  }, []);

  if (insights === null) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted">Loading insights…</p>
      </Card>
    );
  }
  if (insights.length === 0) {
    return null;
  }

  const active = insights[Math.min(activeIdx, insights.length - 1)];

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <TrendingUp className="size-4 text-accent" />
          Spending insights
        </h2>
        <span className="text-xs text-muted">Last 30 days</span>
      </div>

      {insights.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {insights.map((ins, i) => (
            <button
              key={ins.childName}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold shadow-[var(--shadow-float)] transition-all duration-150 active:scale-95",
                i === activeIdx
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-muted",
              )}
            >
              {ins.childName}
            </button>
          ))}
        </div>
      )}

      <FlowBar insight={active} />

      {active.recent.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <ReceiptText className="size-3.5" /> Recent activity
          </p>
          <ul className="mt-2 space-y-1.5">
            {active.recent.map((t, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <span className="min-w-0 flex-1 truncate text-muted">
                  {t.note ?? KIND_META[t.kind]?.label ?? t.kind}
                </span>
                <span className={cn(
                  "ml-2 shrink-0 font-mono font-semibold",
                  t.amount < 0 ? "text-sky-400" : "text-emerald-400",
                )}>
                  {txLabel(t.kind, t.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {active.txCount === 0 && (
        <div className="flex items-start gap-3 rounded-xl bg-surface-2 p-3">
          <PiggyBank className="size-5 shrink-0 text-accent" />
          <p className="text-xs text-muted">
            Insights build up as {active.childName} earns, spends, saves, and gives.
            Every Units move is tracked here from now on.
          </p>
        </div>
      )}
      {active.saved > 0 && active.spent > active.saved * 2 && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 p-3">
          <ShoppingBag className="size-5 shrink-0 text-amber-400" />
          <p className="text-xs">
            <span className="font-semibold">Heads up:</span> {active.childName} is spending
            much more than saving. A savings goal could help balance it out. 🎯
          </p>
        </div>
      )}
      {active.given > 0 && (
        <div className="flex items-start gap-3 rounded-xl bg-rose-500/10 p-3">
          <HeartHandshake className="size-5 shrink-0 text-rose-400" />
          <p className="text-xs">
            <span className="font-semibold">Beautiful:</span> {active.childName} gave{" "}
            {active.given.toLocaleString()} Units. Generosity is growing. ❤️
          </p>
        </div>
      )}
    </Card>
  );
}
