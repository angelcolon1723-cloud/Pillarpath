import { Card } from "@/components/ui/card";
import { ResourceShell, HowToUse } from "./shared";

const ROUNDS = [
  { n: 1, event: "📰 Good news! A popular YouTuber loves this toy.", price: "10 → 14", tip: "Demand rises, price rises." },
  { n: 2, event: "🏭 The factory makes twice as many.", price: "14 → 11", tip: "Supply rises, price falls." },
  { n: 3, event: "🎄 Holiday season — everyone wants one.", price: "11 → 18", tip: "High demand + limited supply = spike." },
  { n: 4, event: "📦 A shipment is stuck at the port.", price: "18 → 22", tip: "Scarcity pushes prices up." },
  { n: 5, event: "🆕 A cooler new toy launches.", price: "22 → 12", tip: "Better alternatives crash demand." },
];

export function MarketSim() {
  return (
    <ResourceShell
      title="Market simulation board"
      subtitle="A 5-round classroom game — supply, demand, and why prices move."
      resourceId="res-4"
    >
      <HowToUse
        steps={[
          "Split the class into teams. Each team starts with 100 Units of play money.",
          "Reveal one round card at a time. Teams secretly decide: BUY, SELL, or HOLD the toy.",
          "After each round, update the price on the board and let teams trade with each other.",
          "After round 5, teams count their Units. Richest team explains their strategy.",
          "Debrief: nobody could predict the news — that's the real lesson about markets.",
        ]}
      />
      <Card className="p-4">
        <h2 className="font-semibold">Setup</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>Each team: 100 Units play money + a tracking sheet.</li>
          <li>The "toy" price starts at <strong>10 Units</strong>.</li>
          <li>Teams may buy or sell any amount each round — but can't spend what they don't have.</li>
          <li>No peeking at future rounds! The teacher reads each event aloud.</li>
        </ul>
      </Card>
      <div className="space-y-2">
        {ROUNDS.map((r) => (
          <Card key={r.n} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-bold">Round {r.n}</p>
              <p className="rounded-full bg-accent/15 px-3 py-1 font-mono text-sm font-bold text-accent">
                {r.price}
              </p>
            </div>
            <p className="mt-1 text-sm">{r.event}</p>
            <p className="mt-1 text-xs text-muted">💡 {r.tip}</p>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <h2 className="font-semibold">Team tracking sheet</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-2">Round</th>
                <th className="pb-2">Action</th>
                <th className="pb-2">Toys held</th>
                <th className="pb-2">Units left</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((n) => (
                <tr key={n} className="border-t border-border">
                  <td className="py-3 font-medium">{n}</td>
                  <td className="py-3 text-muted">BUY / SELL / HOLD</td>
                  <td className="py-3"><span className="inline-block h-6 w-16 rounded border border-dashed border-border" /></td>
                  <td className="py-3"><span className="inline-block h-6 w-16 rounded border border-dashed border-border" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="p-4">
        <h2 className="font-semibold">Debrief questions</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
          <li>Which round surprised you most? Why?</li>
          <li>Did any team try to predict the news? How did that go?</li>
          <li>What's the difference between investing and guessing?</li>
          <li>Why might "buy low, sell high" be harder than it sounds?</li>
        </ol>
      </Card>
    </ResourceShell>
  );
}
