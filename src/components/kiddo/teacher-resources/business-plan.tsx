import { Card } from "@/components/ui/card";
import { ResourceShell, HowToUse } from "./shared";

export function BusinessPlan() {
  return (
    <ResourceShell
      title="Business plan one-pager"
      subtitle="From idea to profit — on a single page."
      resourceId="res-5"
    >
      <HowToUse
        steps={[
          "Students dream up a tiny business (lemonade stand, pet-sitting, friendship bracelets).",
          "They fill in each box — the math boxes are the heart of the lesson.",
          "Everyone presents their one-pager in 60 seconds: the pitch.",
          "Vote on most creative, most realistic, and best profit margin.",
          "Bonus: the winning team 'launches' with classroom Units as startup capital.",
        ]}
      />
      <Card className="p-4">
        <h2 className="font-semibold">🏢 My business name</h2>
        <div className="mt-2 h-10 rounded-lg border border-dashed border-border" />
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-semibold">🧑‍🤝‍🧑 My customer</h2>
          <p className="mt-1 text-xs text-muted">Who will buy this? Be specific.</p>
          <div className="mt-2 h-20 rounded-lg border border-dashed border-border" />
        </Card>
        <Card className="p-4">
          <h2 className="font-semibold">📦 What I sell</h2>
          <p className="mt-1 text-xs text-muted">What is it? Why is it great?</p>
          <div className="mt-2 h-20 rounded-lg border border-dashed border-border" />
        </Card>
      </div>
      <Card className="border-accent/40 p-4">
        <h2 className="font-semibold">💰 The math (this is the business!)</h2>
        <div className="mt-3 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-44 shrink-0">Price I charge (each):</span>
            <span className="h-8 w-24 rounded-lg border border-dashed border-border" />
            <span className="text-xs text-muted">Units</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-44 shrink-0">Cost to make (each):</span>
            <span className="h-8 w-24 rounded-lg border border-dashed border-border" />
            <span className="text-xs text-muted">Units</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-44 shrink-0">Profit per sale:</span>
            <span className="text-xs text-muted">(price − cost) =</span>
            <span className="h-8 w-24 rounded-lg border border-dashed border-border" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-44 shrink-0">I plan to sell (count):</span>
            <span className="h-8 w-24 rounded-lg border border-dashed border-border" />
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-accent/10 p-2">
            <span className="w-44 shrink-0 font-bold">Total profit:</span>
            <span className="text-xs text-muted">(profit each × count) =</span>
            <span className="h-8 w-24 rounded-lg border border-dashed border-border bg-surface" />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          Example: Lemonade at 5 Units, costs 2 to make → 3 profit each × 20 cups = <strong>60 Units profit</strong>.
        </p>
      </Card>
      <Card className="p-4">
        <h2 className="font-semibold">📣 My poster pitch</h2>
        <p className="mt-1 text-xs text-muted">
          Draw your poster here. It needs: the product, the price, and ONE reason to buy.
        </p>
        <div className="mt-2 h-48 rounded-lg border border-dashed border-border" />
      </Card>
      <Card className="p-4">
        <h2 className="font-semibold">🎤 60-second pitch script</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>"My business is called ___."</li>
          <li>"My customers are ___."</li>
          <li>"I charge ___ Units and it costs me ___ to make."</li>
          <li>"If I sell ___, I profit ___ Units."</li>
          <li>"You should buy because ___."</li>
        </ol>
      </Card>
    </ResourceShell>
  );
}
