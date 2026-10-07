import { useLedger } from "@/store/ledger";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Lock, Quote, Shirt, Star } from "lucide-react";
import { RANKS, rankForScore } from "./WorldMap";

const QUOTES = [
  {
    text: "I never dreamed about success. I worked for it.",
    author: "Estée Lauder",
  },
  {
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
  },
  {
    text: "Whether you think you can or you think you can't, you're right.",
    author: "Henry Ford",
  },
  {
    text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    author: "Winston Churchill",
  },
  {
    text: "Don't watch the clock; do what it does. Keep going.",
    author: "Sam Levenson",
  },
  {
    text: "The future belongs to those who believe in the beauty of their dreams.",
    author: "Eleanor Roosevelt",
  },
  {
    text: "It always seems impossible until it's done.",
    author: "Nelson Mandela",
  },
  {
    text: "Do what you can, with what you have, where you are.",
    author: "Theodore Roosevelt",
  },
];

export function WisdomRoom({ score }: { score: number }) {
  const setScreen = useLedger((s) => s.setScreen);
  const { rank, next, pctToNext } = rankForScore(score);
  const rankIndex = RANKS.indexOf(rank);
  // Unlock at Sprout (score >= 50).
  const unlocked = score >= 50;

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-xl space-y-6 px-4 py-8 text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setScreen("home")}
          className="gap-1"
        >
          <ArrowLeft className="size-4" /> Back to the World
        </Button>
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-accent-soft text-accent">
          <Lock className="size-10" />
        </div>
        <h1 className="font-display text-2xl font-bold">The Room of Wisdom</h1>
        <p className="text-muted">
          This sacred hall opens to those who reach the{" "}
          <span className="font-semibold text-ink">Sprout</span> rank. Keep
          doing chores, saving, and creating — you're on your way.
        </p>
        <div className="mx-auto h-2 max-w-xs overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 transition-all"
            style={{ width: `${Math.min(100, Math.round((score / 50) * 100))}%` }}
          />
        </div>
        <p className="text-sm text-muted">{score} / 50 to unlock</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setScreen("home")}
        className="gap-1"
      >
        <ArrowLeft className="size-4" /> Back to the World
      </Button>

      {/* Header */}
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          A sacred hall of the Society
        </p>
        <h1 className="font-display text-3xl font-bold">The Room of Wisdom</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">
          The greats walked this path before you. Read their words. Earn your
          place among them.
        </p>
      </div>

      {/* Ranks on the wall */}
      <section>
        <h2 className="mb-4 text-center font-display text-xl font-semibold">
          The Ranks of the Society
        </h2>
        <div className="grid gap-3 sm:grid-cols-5">
          {RANKS.map((r, i) => {
            const isCurrent = i === rankIndex;
            const isPast = i < rankIndex;
            return (
              <Card
                key={r.name}
                className={`p-4 text-center transition-all ${
                  isCurrent
                    ? "border-accent shadow-[0_0_24px_var(--accent-glow)] scale-105"
                    : isPast
                      ? "opacity-70"
                      : "opacity-40"
                }`}
              >
                <div className="mb-2 flex justify-center gap-0.5">
                  {Array.from({ length: i + 1 }).map((_, s) => (
                    <Star
                      key={s}
                      className={`size-3 ${isCurrent ? "fill-amber-400 text-amber-400" : "text-muted"}`}
                    />
                  ))}
                </div>
                <p className="font-display text-sm font-bold">{r.name}</p>
                <p className="mt-1 text-[11px] text-muted">{r.tagline}</p>
                {isCurrent && (
                  <p className="mt-2 text-xs font-semibold text-accent">
                    You are here
                  </p>
                )}
              </Card>
            );
          })}
        </div>
        {next && (
          <p className="mt-4 text-center text-sm text-muted">
            {pctToNext}% of the way to{" "}
            <span className="font-semibold text-ink">{next.name}</span> —{" "}
            {next.tagline}
          </p>
        )}
        {!next && (
          <p className="mt-4 text-center text-sm font-semibold text-accent">
            You have reached the highest rank. A pillar others lean on.
          </p>
        )}
      </section>

      {/* Rank shirts CTA */}
      <Card className="flex items-center gap-4 p-5">
        <div className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <Shirt className="size-6" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Wear your rank</p>
          <p className="text-sm text-muted">
            Each rank has its own shirt. Earn the rank, wear the shirt.
          </p>
        </div>
        <Button onClick={() => setScreen("market")}>See shirts</Button>
      </Card>

      {/* Quotes on the wall */}
      <section>
        <h2 className="mb-4 text-center font-display text-xl font-semibold">
          Words from the Greats
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {QUOTES.map((q) => (
            <Card key={q.author} className="p-5">
              <Quote className="mb-2 size-5 text-accent" />
              <p className="font-display text-base leading-relaxed">
                "{q.text}"
              </p>
              <p className="mt-2 text-sm text-muted">— {q.author}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Closing message */}
      <Card className="bg-gradient-to-br from-cyan-500/10 via-violet-500/10 to-fuchsia-500/10 p-6 text-center">
        <p className="font-display text-lg font-semibold">
          "Better than yesterday."
        </p>
        <p className="mt-2 text-sm text-muted">
          Every rank on this wall was once a Seedling. Your becoming has already
          begun.
        </p>
      </Card>
    </div>
  );
}
