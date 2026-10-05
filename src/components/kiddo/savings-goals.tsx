import { useEffect, useState } from "react";
import { Plus, Target, PartyPopper, Undo2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  createSavingsGoal,
  listSavingsGoals,
  contributeToGoal,
  releaseSavingsGoal,
  type SavingsGoal,
} from "@/lib/pillarpath-server";

const GOAL_EMOJIS = ["🎯", "🚲", "🎮", "📚", "🎸", "⚽", "🧸", "💻", "🎨", "✈️", "🐶", "⭐"];

function ProgressRing({ pct, size = 72 }: { pct: number; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={6}
          className="stroke-border" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={6}
          strokeLinecap="round" className="stroke-accent transition-all duration-500"
          strokeDasharray={c} strokeDashoffset={c - (c * Math.min(100, pct)) / 100} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-bold">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

function milestoneFor(pct: number): string | null {
  if (pct >= 100) return "🎉 Goal reached!";
  if (pct >= 75) return "🔥 75% there!";
  if (pct >= 50) return "💪 Halfway!";
  if (pct >= 25) return "🌱 25% saved!";
  return null;
}

/**
 * Savings goals — parent creates, anyone contributes, parent releases.
 * `childId` + `readOnly` adapt it for the kid view.
 */
export function SavingsGoals({
  kids,
  childId,
  readOnly = false,
}: {
  kids: Array<{ id: number; name: string; units: number }>;
  childId?: number;
  readOnly?: boolean;
}) {
  const [goals, setGoals] = useState<SavingsGoal[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [target, setTarget] = useState("");
  const [goalChildId, setGoalChildId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [contribAmounts, setContribAmounts] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const r = await listSavingsGoals({ data: childId ? { childId } : {} });
      setGoals(r.goals);
    } catch {
      setGoals([]);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  const create = async () => {
    const cid = goalChildId ?? kids[0]?.id;
    const t = Math.floor(Number(target));
    if (!cid) return toast.error("Pick a child for this goal.");
    if (!title.trim()) return toast.error("Give the goal a name.");
    if (!Number.isFinite(t) || t < 10) return toast.error("Target must be at least 10 Units.");
    setBusy(true);
    try {
      await createSavingsGoal({ data: { childId: cid, title: title.trim(), emoji, targetUnits: t } });
      toast.success("🎯 Goal created — time to save!");
      setTitle(""); setTarget(""); setEmoji("🎯"); setShowForm(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create goal.");
    } finally {
      setBusy(false);
    }
  };

  const contribute = async (goalId: string) => {
    const amount = Math.floor(Number(contribAmounts[goalId]));
    if (!Number.isFinite(amount) || amount < 1) return toast.error("Enter at least 1 Unit.");
    setBusy(true);
    try {
      const r = await contributeToGoal({ data: { goalId, amount } });
      setContribAmounts((p) => ({ ...p, [goalId]: "" }));
      await load();
      const ms = milestoneFor(r.goal.progressPct);
      if (r.goal.status === "completed") {
        toast.success("🎉 GOAL REACHED! Amazing saving!");
      } else if (ms) {
        toast.success(`${ms} Keep going!`);
      } else {
        toast.success(`+${amount} Units saved!`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't contribute.");
    } finally {
      setBusy(false);
    }
  };

  const release = async (goal: SavingsGoal) => {
    setBusy(true);
    try {
      const r = await releaseSavingsGoal({ data: { goalId: goal.id } });
      toast.success(
        goal.status === "completed"
          ? `🎉 Goal achieved! ${r.releasedUnits} Units back to ${goal.childName} — go get that ${goal.title}!`
          : `${r.releasedUnits} Units returned to ${goal.childName}.`,
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't release goal.");
    } finally {
      setBusy(false);
    }
  };

  const active = goals?.filter((g) => g.status !== "released") ?? [];
  const done = goals?.filter((g) => g.status === "released") ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Target className="size-4 text-accent" />
          Savings goals
        </p>
        {!readOnly && (
          <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <Plus className="size-3.5" /> New goal
          </Button>
        )}
      </div>

      {!readOnly && showForm && (
        <Card className="space-y-3 p-4">
          {kids.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {kids.map((k: { id: number; name: string }) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setGoalChildId(k.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold",
                    (goalChildId ?? kids[0]?.id) === k.id
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border text-muted",
                  )}
                >
                  {k.name}
                </button>
              ))}
            </div>
          )}
          <Input
            placeholder="Goal name — e.g. New bike"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
          />
          <div className="flex flex-wrap gap-1.5">
            {GOAL_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={cn(
                  "grid size-9 place-items-center rounded-xl border text-lg",
                  emoji === e ? "border-accent bg-accent/15" : "border-border",
                )}
              >
                {e}
              </button>
            ))}
          </div>
          <Input
            type="number"
            min={10}
            placeholder="Target in Units — e.g. 8000"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <Button className="w-full" onClick={create} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "🎯 Create goal"}
          </Button>
        </Card>
      )}

      {goals === null && <p className="text-sm text-muted">Loading goals…</p>}

      {goals !== null && active.length === 0 && !showForm && (
        <Card className="p-6 text-center">
          <p className="text-3xl">🎯</p>
          <p className="mt-2 font-semibold">No savings goals yet</p>
          <p className="mt-1 text-xs text-muted">
            {readOnly
              ? "Ask your parent to set a savings goal with you!"
              : "Set a goal with your kid — something to save toward together."}
          </p>
        </Card>
      )}

      {active.map((g) => {
        const ms = milestoneFor(g.progressPct);
        const kid = kids.find((k: { id: number }) => k.id === g.childId);
        return (
          <Card key={g.id} className={cn("p-4", g.status === "completed" && "border-accent/50")}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{g.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{g.title}</p>
                <p className="text-xs text-muted">
                  {g.childName} · {g.savedUnits.toLocaleString()} / {g.targetUnits.toLocaleString()} Units
                </p>
                {ms && g.status !== "completed" && (
                  <p className="mt-0.5 text-xs font-semibold text-accent">{ms}</p>
                )}
              </div>
              <ProgressRing pct={g.progressPct} />
            </div>

            {g.status === "completed" ? (
              <div className="mt-3 rounded-xl bg-accent/10 p-3 text-center">
                <p className="flex items-center justify-center gap-2 text-sm font-bold text-accent">
                  <PartyPopper className="size-4" /> Goal reached!
                </p>
                {!readOnly && (
                  <Button size="sm" className="mt-2" onClick={() => release(g)} disabled={busy}>
                    🎉 Achieved — release {g.savedUnits.toLocaleString()} Units
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={kid?.units ?? undefined}
                  placeholder={`Add Units${kid ? ` (has ${kid.units.toLocaleString()})` : ""}`}
                  value={contribAmounts[g.id] ?? ""}
                  onChange={(e) => setContribAmounts((p) => ({ ...p, [g.id]: e.target.value }))}
                  className="flex-1"
                />
                <Button size="sm" onClick={() => contribute(g.id)} disabled={busy}>
                  Save
                </Button>
                {!readOnly && (
                  <Button size="sm" variant="ghost" onClick={() => release(g)} disabled={busy}
                    title="Cancel goal and return Units">
                    <Undo2 className="size-3.5" />
                  </Button>
                )}
              </div>
            )}
          </Card>
        );
      })}

      {done.length > 0 && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer font-semibold">
            {done.length} past goal{done.length === 1 ? "" : "s"}
          </summary>
          <div className="mt-2 space-y-1">
            {done.map((g) => (
              <p key={g.id}>
                {g.emoji} {g.title} — {g.childName} · {g.targetUnits.toLocaleString()} Units
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
