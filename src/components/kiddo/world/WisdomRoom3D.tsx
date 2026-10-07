import { useEffect, useState } from "react";
import { useLedger } from "@/store/ledger";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronLeft, ChevronRight, Lock, Quote, Shirt } from "lucide-react";
import { RANKS, rankForScore } from "./WorldMap";

/* ------------------------------------------------------------------ */
/* Hall of Becoming — cinematic storybook slideshow. One journey per    */
/* rank: painted world, unfolding story, shirt reveal, closing quote.   */
/* ------------------------------------------------------------------ */

interface Chapter {
  heading: string;
  body: string;
}

interface RankJourney {
  rank: string;
  color: string;
  bg: string;
  shirt: string;
  chapters: Chapter[];
  quote: string;
  quoteBy: string;
}

const JOURNEYS: RankJourney[] = [
  {
    rank: "Seedling",
    color: "#4ade80",
    bg: "/designs/hallway/hallway-seedling.png",
    shirt: "/designs/ranks/rank-seedling.png",
    chapters: [
      {
        heading: "Every journey begins underground",
        body: "Before the first leaf, there is only a seed in dark soil — small, unseen, full of promise. That was you the day you joined the Society.",
      },
      {
        heading: "Showing up is the bravest step",
        body: "You didn't know the way. Nobody does at first. But you showed up, and that single choice cracked the soil open.",
      },
      {
        heading: "The first green shoots",
        body: "Your first chores done. Your first Units earned. Tiny victories — but every pillar that ever stood began exactly like this.",
      },
    ],
    quote: "The expert in anything was once a beginner.",
    quoteBy: "Helen Hayes",
  },
  {
    rank: "Sprout",
    color: "#22d3ee",
    bg: "/designs/hallway/hallway-sprout.png",
    shirt: "/designs/ranks/rank-sprout.png",
    chapters: [
      {
        heading: "Growth you can feel",
        body: "Remember when saving 50 Units felt impossible? Now you do it without thinking. That's not luck — that's growth.",
      },
      {
        heading: "Roots run deep",
        body: "Every chore completed, every Unit saved, every mission finished — these are roots. Nobody sees them, but they hold everything up.",
      },
      {
        heading: "Reaching for the light",
        body: "You're not just doing tasks anymore. You're building habits. The forest around you is proof: keep growing, and the light finds you.",
      },
    ],
    quote: "Don't watch the clock; do what it does. Keep going.",
    quoteBy: "Sam Levenson",
  },
  {
    rank: "Trailblazer",
    color: "#a78bfa",
    bg: "/designs/hallway/hallway-trailblazer.png",
    shirt: "/designs/ranks/rank-trailblazer.png",
    chapters: [
      {
        heading: "The path ends here — so you make one",
        body: "Most people stop where the trail stops. You kept walking. Trailblazers don't wait for permission to go further.",
      },
      {
        heading: "Trying new things",
        body: "The Studio. Big savings goals. Giving to others. You started doing things that scared you a little — and survived all of them.",
      },
      {
        heading: "Others follow your footprints",
        body: "Look behind you. Younger kids are walking the path you carved. That's what a Trailblazer is — proof that the way forward exists.",
      },
    ],
    quote: "Whether you think you can or you think you can't, you're right.",
    quoteBy: "Henry Ford",
  },
  {
    rank: "Luminary",
    color: "#e879f9",
    bg: "/designs/hallway/hallway-luminary.png",
    shirt: "/designs/ranks/rank-luminary.png",
    chapters: [
      {
        heading: "You became the light",
        body: "Somewhere along the way, you stopped chasing the glow and started giving it. Kids look at you the way you once looked at others.",
      },
      {
        heading: "Wisdom earned, not given",
        body: "You know what it takes because you did it — the early mornings, the saved Units, the goals that took weeks. Nobody can take that from you.",
      },
      {
        heading: "Guiding without words",
        body: "A luminary doesn't shout. Like fireflies in the dark, you simply shine — and others find their way because of it.",
      },
    ],
    quote: "The future belongs to those who believe in the beauty of their dreams.",
    quoteBy: "Eleanor Roosevelt",
  },
  {
    rank: "Pillar",
    color: "#fbbf24",
    bg: "/designs/hallway/hallway-pillar.png",
    shirt: "/designs/ranks/rank-pillar.png",
    chapters: [
      {
        heading: "The climb is behind you",
        body: "Seedling. Sprout. Trailblazer. Luminary. Every step is carved into who you are now. The temple doors open for those who finish the journey.",
      },
      {
        heading: "A pillar others lean on",
        body: "Pillars don't just stand tall — they hold things up. Your family, your friends, your Society. You're someone people can count on.",
      },
      {
        heading: "Better than yesterday — forever",
        body: "This was never about a rank. It was about becoming. And becoming never ends. Welcome to the top of the climb, Pillar. The view is yours.",
      },
    ],
    quote: "I never dreamed about success. I worked for it.",
    quoteBy: "Estée Lauder",
  },
];

export function WisdomRoom3D({ score }: { score: number }) {
  const setScreen = useLedger((s) => s.setScreen);
  const { rank } = rankForScore(score);
  const rankIndex = RANKS.indexOf(rank);
  const [journeyIdx, setJourneyIdx] = useState<number | null>(null);
  const [chapterIdx, setChapterIdx] = useState(0);

  // Each journey unlocks at its rank's threshold — kids earn the story.
  const journeyUnlocked = (i: number) => score >= RANKS[i].min;

  // Reset chapter when switching journeys.
  useEffect(() => {
    setChapterIdx(0);
  }, [journeyIdx]);

  // ---- Full-screen journey view ----
  if (journeyIdx !== null) {
    const j = JOURNEYS[journeyIdx];
    const ch = j.chapters[chapterIdx];
    const isLast = chapterIdx === j.chapters.length - 1;
    const isFirst = chapterIdx === 0;

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black">
        {/* Painted world backdrop with slow Ken Burns drift */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            key={j.bg}
            src={j.bg}
            alt={`${j.rank} world`}
            className="hall-kenburns h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/40" />
        </div>

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-white hover:bg-white/15 hover:text-white"
            onClick={() => setJourneyIdx(null)}
          >
            <ArrowLeft className="size-4" /> Hall
          </Button>
          <div className="flex items-center gap-2">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: j.color, boxShadow: `0 0 10px ${j.color}` }}
            />
            <span className="font-display text-sm font-bold uppercase tracking-widest text-white">
              {j.rank}
            </span>
            {journeyIdx === rankIndex && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-black" style={{ backgroundColor: j.color }}>
                YOUR RANK
              </span>
            )}
          </div>
          <div className="w-16" />
        </div>

        {/* Chapter content */}
        <div className="relative z-10 flex flex-1 flex-col justify-end px-6 pb-6">
          <div key={`${journeyIdx}-${chapterIdx}`} className="screen-enter space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: j.color }}>
              Chapter {chapterIdx + 1} of {j.chapters.length}
            </p>
            <h2 className="font-display text-2xl font-bold text-white">{ch.heading}</h2>
            <p className="max-w-lg text-[15px] leading-relaxed text-white/90">{ch.body}</p>
          </div>

          {/* Closing quote on last chapter */}
          {isLast && (
            <div key={`q-${journeyIdx}`} className="screen-enter mt-5 max-w-lg rounded-2xl bg-white/10 p-5 backdrop-blur-md">
              <Quote className="mb-2 size-5" style={{ color: j.color }} />
              <p className="font-display text-lg italic text-white">"{j.quote}"</p>
              <p className="mt-1 text-sm text-white/70">— {j.quoteBy}</p>
            </div>
          )}

          {/* Shirt reveal on last chapter */}
          {isLast && (
            <div key={`s-${journeyIdx}`} className="screen-enter mt-4 flex items-center gap-4">
              <img
                src={j.shirt}
                alt={`${j.rank} rank shirt`}
                className="h-24 w-24 rounded-xl border-2 object-cover"
                style={{ borderColor: j.color }}
              />
              <div>
                <p className="font-display text-sm font-bold text-white">The {j.rank} shirt</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 gap-1 border-white/30 text-white hover:bg-white/15 hover:text-white"
                  onClick={() => setScreen("market")}
                >
                  <Shirt className="size-4" /> Get the shirt
                </Button>
              </div>
            </div>
          )}

          {/* Nav */}
          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              disabled={isFirst}
              onClick={() => setChapterIdx((c) => c - 1)}
              className="gap-1 text-white hover:bg-white/15 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="size-4" /> Back
            </Button>
            <div className="flex gap-1.5">
              {j.chapters.map((_, i) => (
                <span
                  key={i}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: i === chapterIdx ? 24 : 8,
                    backgroundColor: i === chapterIdx ? j.color : "rgba(255,255,255,0.3)",
                  }}
                />
              ))}
            </div>
            {isLast ? (
              <Button
                size="sm"
                onClick={() => {
                  if (journeyIdx < JOURNEYS.length - 1) setJourneyIdx(journeyIdx + 1);
                  else setJourneyIdx(null);
                }}
                style={{ backgroundColor: j.color, color: "#000" }}
              >
                {journeyIdx < JOURNEYS.length - 1 ? "Next rank" : "Finish"} <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setChapterIdx((c) => c + 1)}
                style={{ backgroundColor: j.color, color: "#000" }}
              >
                Continue <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Hall lobby: the five journeys ----
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <Button variant="ghost" size="sm" onClick={() => setScreen("home")} className="gap-1">
        <ArrowLeft className="size-4" /> World
      </Button>
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          Five ranks. Five journeys.
        </p>
        <h1 className="font-display text-3xl font-bold">The Hall of Becoming</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Walk each rank's path — from the first seed in dark soil to the golden
          temple at the top of the climb. Each journey unlocks when you earn its rank.
        </p>
      </div>

      <div className="space-y-4">
        {JOURNEYS.map((j, i) => {
          const isLocked = !journeyUnlocked(i);
          return (
            <button
              key={j.rank}
              onClick={() => { if (!isLocked) setJourneyIdx(i); }}
              className="group relative block w-full overflow-hidden rounded-2xl border border-accent/20 text-left transition-transform active:scale-[0.99]"
            >
              <img
                src={j.bg}
                alt={`${j.rank} world`}
                className={`h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105 ${isLocked ? "grayscale-[0.6] brightness-[0.55]" : ""}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              {isLocked && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="flex flex-col items-center gap-1 rounded-2xl bg-black/60 px-5 py-3 backdrop-blur-sm">
                    <Lock className="size-6 text-white/90" />
                    <p className="text-sm font-semibold text-white">
                      Earn the {j.rank} rank to unlock
                    </p>
                    <p className="text-xs text-white/70">{RANKS[i].min} pts needed</p>
                  </div>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ backgroundColor: j.color, boxShadow: `0 0 10px ${j.color}` }}
                    />
                    <p className="font-display text-xl font-bold text-white">{j.rank}</p>
                    {i === rankIndex && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-black" style={{ backgroundColor: j.color }}>
                        YOUR RANK
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-sm text-white/75">
                    {isLocked ? "A journey waiting for you..." : j.chapters[0].heading}
                  </p>
                </div>
                {!isLocked && (
                  <ChevronRight className="size-6 shrink-0 text-white/80 transition-transform group-hover:translate-x-1" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
