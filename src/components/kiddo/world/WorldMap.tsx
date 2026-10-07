import { useMemo } from "react";
import {
  BookOpen,
  ChevronRight,
  GraduationCap,
  HeartHandshake,
  Images,
  Mountain,
  Palette,
  School,
  ShoppingBag,
  Sparkles,
  Sprout,
  Target,
  Trophy,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PillarMark } from "@/components/kiddo/mark";
import { useLedger, type Screen } from "@/store/ledger";
import { bandForAge, missionProgress } from "@/lib/studio-path";
import { formatUnits } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Society ranks — the "becoming" identity, computed from real stats.   */
/* ------------------------------------------------------------------ */

export type SocietyRank = {
  name: string;
  min: number;
  tagline: string;
};

export const RANKS: SocietyRank[] = [
  { name: "Seedling", min: 0, tagline: "Every pillar starts as a seed." },
  { name: "Sprout", min: 50, tagline: "Growing stronger every day." },
  { name: "Trailblazer", min: 150, tagline: "Blazing your own money trail." },
  { name: "Luminary", min: 300, tagline: "Your glow guides others." },
  { name: "Pillar", min: 450, tagline: "A pillar others can lean on." },
];

export function societyScore(stats: {
  choresDone: number;
  vaultPct: number;
  studioPct: number;
}): number {
  const chorePts = Math.min(150, stats.choresDone * 10);
  const vaultPts = Math.min(150, Math.round(stats.vaultPct * 150));
  const studioPts = Math.min(200, Math.round(stats.studioPct * 200));
  return chorePts + vaultPts + studioPts;
}

export function rankForScore(score: number): {
  rank: SocietyRank;
  next: SocietyRank | null;
  pctToNext: number;
} {
  let rank = RANKS[0];
  for (const r of RANKS) if (score >= r.min) rank = r;
  const idx = RANKS.indexOf(rank);
  const next = idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
  const pctToNext = next
    ? Math.min(100, Math.round(((score - rank.min) / (next.min - rank.min)) * 100))
    : 100;
  return { rank, next, pctToNext };
}

/* ------------------------------------------------------------------ */
/* Realms — each a world within the world.                              */
/* ------------------------------------------------------------------ */

type Realm = {
  id: string;
  screen: Screen;
  name: string;
  tagline: string;
  icon: typeof Sprout;
  /** biome gradient classes */
  biome: string;
  glow: string;
  badge: () => string | null;
};

function useRealms(): Realm[] {
  const balance = useLedger((s) => s.balance);
  const vault = useLedger((s) => s.vault);
  const vaultTarget = useLedger((s) => s.vaultTarget);
  const pendingChores = useLedger((s) => s.pendingChores);
  const completedChoreIds = useLedger((s) => s.completedChoreIds);
  const choreCatalog = useLedger((s) => s.choreCatalog);
  const disabledChoreIds = useLedger((s) => s.disabledChoreIds);
  const completedMissionIds = useLedger((s) => s.completedMissionIds ?? []);
  const childAge = useLedger((s) => s.childAge);

  const band = bandForAge(childAge);
  const studio = missionProgress(band, completedMissionIds);

  return useMemo(() => {
    const todoChores = choreCatalog.filter(
      (c) =>
        !disabledChoreIds.includes(c.id) &&
        !completedChoreIds.includes(c.id) &&
        !pendingChores.some((p) => p.choreId === c.id),
    );
    const vaultPct = vaultTarget > 0 ? Math.min(1, vault / vaultTarget) : 0;
    const realms: Realm[] = [
      {
        id: "chores",
        screen: "chores",
        name: "Chore Village",
        tagline: "Work earns Units here",
        icon: Sprout,
        biome: "from-emerald-500/25 via-emerald-400/10 to-transparent",
        glow: "shadow-emerald-400/20",
        badge: () =>
          todoChores.length > 0 ? `${todoChores.length} to do` : "All done!",
      },
      {
        id: "vault",
        screen: "vault",
        name: "Vault Mountain",
        tagline: "Savings grow tall here",
        icon: Mountain,
        biome: "from-sky-500/25 via-sky-400/10 to-transparent",
        glow: "shadow-sky-400/20",
        badge: () => `${Math.round(vaultPct * 100)}% of goal`,
      },
      {
        id: "goals",
        screen: "goals",
        name: "Goal Garden",
        tagline: "Dreams grow here",
        icon: Target,
        biome: "from-lime-500/25 via-lime-400/10 to-transparent",
        glow: "shadow-lime-400/20",
        badge: () => null,
      },
      {
        id: "studio",
        screen: "studio",
        name: "Studio Island",
        tagline: "Create and earn XP",
        icon: Palette,
        biome: "from-fuchsia-500/25 via-fuchsia-400/10 to-transparent",
        glow: "shadow-fuchsia-400/20",
        badge: () => `${studio.done}/${studio.total} missions`,
      },
      {
        id: "market",
        screen: "market",
        name: "Market Harbor",
        tagline: "Spend Units wisely",
        icon: ShoppingBag,
        biome: "from-amber-500/25 via-amber-400/10 to-transparent",
        glow: "shadow-amber-400/20",
        badge: () => formatUnits(balance),
      },
      {
        id: "learn",
        screen: "learn",
        name: "Learning Lagoon",
        tagline: "Money skills run deep",
        icon: GraduationCap,
        biome: "from-cyan-500/25 via-cyan-400/10 to-transparent",
        glow: "shadow-cyan-400/20",
        badge: () => null,
      },
      {
        id: "gallery",
        screen: "gallery",
        name: "Showcase Gallery",
        tagline: "Your creations on display",
        icon: Images,
        biome: "from-violet-500/25 via-violet-400/10 to-transparent",
        glow: "shadow-violet-400/20",
        badge: () => null,
      },
      {
        id: "give",
        screen: "give",
        name: "Give Grove",
        tagline: "Generosity grows here",
        icon: HeartHandshake,
        biome: "from-rose-500/25 via-rose-400/10 to-transparent",
        glow: "shadow-rose-400/20",
        badge: () => null,
      },
      {
        id: "classroom",
        screen: "classroom",
        name: "Classroom",
        tagline: "Your class world",
        icon: School,
        biome: "from-indigo-500/25 via-indigo-400/10 to-transparent",
        glow: "shadow-indigo-400/20",
        badge: () => null,
      },
      {
        id: "wisdom",
        screen: "wisdom",
        name: "Hall of Becoming",
        tagline: "The greats await",
        icon: BookOpen,
        biome: "from-amber-500/25 via-amber-400/10 to-transparent",
        glow: "shadow-amber-400/20",
        badge: () => null,
      },
    ];
    return realms;
  }, [
    balance,
    vault,
    vaultTarget,
    pendingChores,
    completedChoreIds,
    choreCatalog,
    disabledChoreIds,
    completedMissionIds,
    childAge,
  ]);
}

/* ------------------------------------------------------------------ */
/* Starfield — the sky above the world.                                 */
/* ------------------------------------------------------------------ */

function Starfield() {
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: (i * 37.7 + 13) % 100,
        top: (i * 53.3 + 7) % 100,
        size: 1 + ((i * 7) % 3),
        delay: (i % 7) * 0.6,
      })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((s) => (
        <span
          key={s.id}
          className="star-twinkle absolute rounded-full bg-white"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The world map itself.                                                */
/* ------------------------------------------------------------------ */

export function WorldMap() {
  const childName = useLedger((s) => s.childName);
  const balance = useLedger((s) => s.balance);
  const vault = useLedger((s) => s.vault);
  const vaultTarget = useLedger((s) => s.vaultTarget);
  const completedChoreIds = useLedger((s) => s.completedChoreIds);
  const completedMissionIds = useLedger((s) => s.completedMissionIds ?? []);
  const childAge = useLedger((s) => s.childAge);
  const setScreen = useLedger((s) => s.setScreen);
  const realms = useRealms();

  const band = bandForAge(childAge);
  const studio = missionProgress(band, completedMissionIds);
  const vaultPct = vaultTarget > 0 ? Math.min(1, vault / vaultTarget) : 0;
  const score = societyScore({
    choresDone: completedChoreIds.length,
    vaultPct,
    studioPct: studio.total > 0 ? studio.done / studio.total : 0,
  });
  const { rank, next, pctToNext } = rankForScore(score);

  return (
    <div className="screen-enter relative -m-4 space-y-5 overflow-hidden p-4 pb-8">
      <Starfield />

      {/* Pillar Plaza — the central hub of the world, our castle */}
      <header className="relative text-center">
        <div className="float-y relative mx-auto w-fit">
          <div
            aria-hidden
            className="absolute -inset-6 rounded-full bg-accent/20 blur-2xl"
          />
          <PillarMark className="relative size-20 drop-shadow-[0_0_18px_rgba(103,232,249,0.55)]" />
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          Pillar Plaza
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          {childName}&rsquo;s World
        </h1>
        <p className="mt-1 text-sm text-muted">
          Eight lands. One becoming. Where to, {childName}?
        </p>

        {/* Treasure + rank */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Card className="units-hero overflow-hidden p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/60">
              Treasure
            </p>
            <p className="units-shimmer mt-1 font-hero text-2xl font-bold tabular-nums">
              {formatUnits(balance)}
            </p>
            <p className="text-xs text-white/70">Pillar Units</p>
          </Card>
          <Card className="border-accent/25 bg-accent-soft p-4">
            <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted">
              <Trophy className="size-3 text-accent" /> Society rank
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-accent">
              {rank.name}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {next ? `${next.min - score} pts to ${next.name}` : "Max rank!"}
            </p>
          </Card>
        </div>
        {next ? (
          <div className="mt-3">
            <Progress value={pctToNext} className="h-1.5" />
            <p className="mt-1 text-xs text-muted">{rank.tagline}</p>
          </div>
        ) : (
          <p className="mt-3 flex items-center gap-1 text-xs text-muted">
            <Sparkles className="size-3 text-accent" /> {rank.tagline}
          </p>
        )}
      </header>

      {/* The realms */}
      <div className="relative">
        {/* winding path */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 h-full w-8 -translate-x-1/2 text-accent/25"
          preserveAspectRatio="none"
          viewBox="0 0 32 100"
        >
          <path
            d="M16 0 C 26 20, 6 35, 16 50 C 26 65, 6 80, 16 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="5 5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="relative space-y-4">
          {realms.map((realm, i) => {
            const Icon = realm.icon;
            const badge = realm.badge();
            const left = i % 2 === 0;
            return (
              <button
                key={realm.id}
                type="button"
                onClick={() => setScreen(realm.screen)}
                className={`group flex w-full items-center gap-4 text-left ${left ? "" : "flex-row-reverse text-right"}`}
              >
                <span
                  className={`relative flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${realm.biome} shadow-lg ${realm.glow} ring-1 ring-white/10 transition-transform duration-200 group-active:scale-95`}
                >
                  <Icon className="size-7 text-white" strokeWidth={1.8} />
                </span>
                <Card
                  className={`flex-1 bg-gradient-to-br ${realm.biome} p-4 shadow-[var(--shadow-float)] transition-transform duration-200 group-active:scale-[0.98]`}
                >
                  <span className={`flex items-center gap-1 font-display text-lg font-semibold ${left ? "" : "justify-end"}`}>
                    {realm.name}
                    <ChevronRight
                      className={`size-4 text-muted transition-transform group-active:translate-x-0.5 ${left ? "" : "order-first rotate-180"}`}
                    />
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{realm.tagline}</span>
                  {badge ? (
                    <span className="mt-2 inline-block rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-accent">
                      {badge}
                    </span>
                  ) : null}
                </Card>
              </button>
            );
          })}
        </div>
      </div>

      <p className="relative pb-2 text-center text-xs text-muted">
        Better than yesterday.
      </p>
    </div>
  );
}
