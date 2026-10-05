import { Card } from "@/components/ui/card";
import { ResourceShell, HowToUse } from "./shared";

export function SavingsPlan() {
  return (
    <ResourceShell
      title="Savings plan template"
      subtitle="Turn 'I want that' into a plan with a number and a date."
    >
      <HowToUse
        steps={[
          "Each student picks ONE thing they're saving for and fills in the plan.",
          "Teach the weekly formula: (Target − Saved so far) ÷ Weeks left = Save per week.",
          "Students check in weekly: color one checkpoint box per week they hit their number.",
          "Celebrate publicly when a plan completes — saving is a skill worth applauding.",
        ]}
      />
      <Card className="p-4">
        <h2 className="font-semibold">My savings plan</h2>
        <div className="mt-3 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-36 shrink-0 font-medium">🎯 I'm saving for:</span>
            <span className="h-9 flex-1 rounded-lg border border-dashed border-border" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-36 shrink-0 font-medium">💰 Target (Units):</span>
            <span className="h-9 w-32 rounded-lg border border-dashed border-border" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-36 shrink-0 font-medium">🏦 Saved so far:</span>
            <span className="h-9 w-32 rounded-lg border border-dashed border-border" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-36 shrink-0 font-medium">📅 I want it by:</span>
            <span className="h-9 w-40 rounded-lg border border-dashed border-border" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-36 shrink-0 font-medium">📆 Weeks left:</span>
            <span className="h-9 w-24 rounded-lg border border-dashed border-border" />
          </div>
        </div>
      </Card>
      <Card className="border-accent/40 p-4">
        <h2 className="font-semibold">⚡ The weekly number</h2>
        <p className="mt-2 text-center font-mono text-lg">
          ( Target − Saved ) ÷ Weeks = <span className="inline-block h-8 w-24 rounded border border-dashed border-border align-middle" /> / week
        </p>
        <p className="mt-2 text-center text-xs text-muted">
          Example: (800 − 200) ÷ 6 weeks = <strong>100 Units/week</strong>
        </p>
      </Card>
      <Card className="p-4">
        <h2 className="font-semibold">Weekly checkpoints</h2>
        <p className="mt-1 text-xs text-muted">Color a box each week you hit your number. 12 weeks.</p>
        <div className="mt-3 grid grid-cols-6 gap-2">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="grid size-10 place-items-center rounded-lg border border-dashed border-border text-xs text-muted">
                W{i + 1}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <h2 className="font-semibold">If I fall behind…</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>I can earn more (extra chores, help a neighbor).</li>
          <li>I can spend less this week (pack a snack instead of buying one).</li>
          <li>I can extend the date — a late plan beats a dead plan.</li>
          <li>I will NOT quit. Quitting is the only way to fail.</li>
        </ul>
      </Card>
    </ResourceShell>
  );
}
