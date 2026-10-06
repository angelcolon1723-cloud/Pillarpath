import { useEffect, useState } from "react";
import { MessagesSquare, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getMoneyMoments, type MoneyMoment } from "@/lib/pillarpath-server";

/**
 * Money Moments — conversation starters from your kid's real activity.
 * Dismissed moments stay dismissed for this session.
 */
export function MoneyMomentsPanel() {
  const [moments, setMoments] = useState<MoneyMoment[] | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    getMoneyMoments()
      .then((r) => setMoments(r.moments))
      .catch(() => setMoments([]));
  }, []);

  if (moments === null || moments.length === 0) return null;
  const visible = moments.filter((m) => !dismissed.has(m.id));
  if (visible.length === 0) return null;

  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <MessagesSquare className="size-4 text-accent" />
        Money moments
        <span className="text-xs font-normal text-muted">— dinner-table gold</span>
      </h2>
      <div className="space-y-2">
        {visible.map((m) => (
          <div key={m.id} className="relative rounded-xl bg-surface-2 p-3 pr-9">
            <p className="text-sm font-semibold">
              <span className="mr-1.5">{m.icon}</span>
              {m.headline}
            </p>
            <p className="mt-1 text-xs text-muted">💬 {m.prompt}</p>
            <button
              type="button"
              onClick={() => setDismissed((d) => new Set(d).add(m.id))}
              className="absolute right-2 top-2 rounded-xl p-1 text-muted shadow-[var(--shadow-float)] transition-all duration-150 active:scale-95 hover:bg-surface hover:text-ink"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
