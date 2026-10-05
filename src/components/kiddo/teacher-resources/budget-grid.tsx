import { Card } from "@/components/ui/card";
import { ResourceShell, HowToUse } from "./shared";

const CATEGORIES = [
  { name: "💰 Save", hint: "Pay yourself first — future you says thanks", color: "bg-emerald-500/15" },
  { name: "🛒 Spend", hint: "Needs first, then thoughtful wants", color: "bg-sky-500/15" },
  { name: "❤️ Give", hint: "Helping others grows your heart", color: "bg-rose-500/15" },
];

export function BudgetGrid() {
  return (
    <ResourceShell
      title="Weekly budget grid"
      subtitle="A 100-Unit allocation worksheet — every Unit gets a job."
    >
      <HowToUse
        steps={[
          "Give each student 100 Units (real classroom Units or play money).",
          "They split the 100 across Save, Spend, and Give — every Unit must be assigned.",
          "Rule: Save gets at least 20 before anything else. That's 'pay yourself first.'",
          "Students pair up and defend their split. Then reveal: there's no single right answer, but every choice has a tradeoff.",
          "Track it for real: students who use PillarPath can mirror this in the app's Vault.",
        ]}
      />
      <Card className="p-4">
        <h2 className="font-semibold">Worked example</h2>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg bg-emerald-500/15 p-3">
            <p className="font-bold">💰 Save: 30</p>
            <p className="mt-1 text-xs text-muted">New bike fund</p>
          </div>
          <div className="rounded-lg bg-sky-500/15 p-3">
            <p className="font-bold">🛒 Spend: 55</p>
            <p className="mt-1 text-xs text-muted">Snacks 15 · Book 25 · Game rental 15</p>
          </div>
          <div className="rounded-lg bg-rose-500/15 p-3">
            <p className="font-bold">❤️ Give: 15</p>
            <p className="mt-1 text-xs text-muted">Animal shelter</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">Total: 100 ✓ — every Unit has a job.</p>
      </Card>
      <Card className="p-4">
        <h2 className="font-semibold">My budget — 100 Units</h2>
        <p className="mt-1 text-xs text-muted">Write your split. It must add up to 100.</p>
        <div className="mt-3 space-y-3">
          {CATEGORIES.map((c) => (
            <div key={c.name} className={`rounded-xl p-3 ${c.color}`}>
              <div className="flex items-center justify-between">
                <p className="font-bold">{c.name}</p>
                <div className="flex items-center gap-2">
                  <span className="h-8 w-24 rounded-lg border border-dashed border-border bg-surface" />
                  <span className="text-xs text-muted">Units</span>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted">{c.hint}</p>
              <div className="mt-2 h-10 rounded-lg border border-dashed border-border bg-surface" />
            </div>
          ))}
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <p className="font-bold">Total</p>
            <p className="text-sm text-muted">Must equal 100 → <span className="inline-block h-6 w-20 rounded border border-dashed border-border" /></p>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <h2 className="font-semibold">Reflection questions</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
          <li>Which category was hardest to fill? Why?</li>
          <li>If you earned 50 more Units, where would they go?</li>
          <li>What's one spending choice you could change this week?</li>
        </ol>
      </Card>
    </ResourceShell>
  );
}
