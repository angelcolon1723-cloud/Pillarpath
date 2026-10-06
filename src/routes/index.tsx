import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Backpack,
  BadgeCheck,
  Footprints,
  Gamepad2,
  GraduationCap,
  HeartHandshake,
  Images,
  Lock,
  Mountain,
  Palette,
  PiggyBank,
  Puzzle,
  School,
  Shirt,
  ShieldCheck,
  ShoppingBag,
  Sprout,
  Star,
  Store,
  Target,
  Trophy,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RoleGate } from "@/components/role-gate";
import { PillarpathApp } from "@/components/pillarpath-app";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PillarMark } from "@/components/kiddo/mark";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { isPending } = useCurrentUserState();
  if (isPending) return <BootScreen />;
  return (
    <>
      <SignedOut>
        <Landing />
      </SignedOut>
      <SignedIn>
        <RoleGate>
          <PillarpathApp />
        </RoleGate>
      </SignedIn>
    </>
  );
}

function BootScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg text-ink">
      <div className="text-center">
        <div className="mx-auto mb-4">
          <PillarMark className="size-14" />
        </div>
        <p className="font-display text-2xl font-semibold">Pillarpath</p>
        <p className="mt-1 text-sm text-muted">Preparing your family workspace…</p>
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
      {children}
    </p>
  );
}

const LANDS: { name: string; Icon: LucideIcon; line: string }[] = [
  { name: "Chore Village", Icon: Sprout, line: "Where effort turns into earnings." },
  { name: "Vault Mountain", Icon: Mountain, line: "Savings climb toward big goals." },
  { name: "Goal Garden", Icon: Target, line: "Dreams, planted and tended." },
  { name: "Studio Island", Icon: Palette, line: "Make art, music, and games." },
  { name: "Market Harbor", Icon: ShoppingBag, line: "The Society Store docks here." },
  { name: "Learning Lagoon", Icon: GraduationCap, line: "Money lessons that stick." },
  { name: "Showcase Gallery", Icon: Images, line: "Creations, on display." },
  { name: "Give Grove", Icon: HeartHandshake, line: "Giving grows here." },
  { name: "Classroom", Icon: School, line: "Learn together, earn together." },
];

const RANKS: { name: string; tagline: string }[] = [
  { name: "Seedling", tagline: "Every pillar starts as a seed." },
  { name: "Sprout", tagline: "Growing stronger every day." },
  { name: "Trailblazer", tagline: "Blazing your own money trail." },
  { name: "Luminary", tagline: "Your glow guides others." },
  { name: "Pillar", tagline: "A pillar others can lean on." },
];

const AISLES: { name: string; Icon: LucideIcon }[] = [
  { name: "Toy Workshop", Icon: Puzzle },
  { name: "Tech Lab", Icon: Zap },
  { name: "Game Zone", Icon: Gamepad2 },
  { name: "Society Gear", Icon: Star },
  { name: "Society Styles", Icon: Shirt },
  { name: "The Outfitters", Icon: Footprints },
  { name: "Scholar's Corner", Icon: Backpack },
];

const STARS: { left: string; top: string; delay: string; size: string }[] = [
  { left: "8%", top: "12%", delay: "0s", size: "size-1" },
  { left: "18%", top: "68%", delay: "0.8s", size: "size-1.5" },
  { left: "30%", top: "8%", delay: "1.6s", size: "size-1" },
  { left: "72%", top: "18%", delay: "0.4s", size: "size-1.5" },
  { left: "85%", top: "58%", delay: "2.1s", size: "size-1" },
  { left: "62%", top: "82%", delay: "1.2s", size: "size-1" },
  { left: "42%", top: "88%", delay: "2.6s", size: "size-1.5" },
  { left: "92%", top: "32%", delay: "1.9s", size: "size-1" },
];

/** The PillarPath World: a pillar monument orbited by the lands. */
function WorldOrbit() {
  const chips = LANDS.slice(0, 8);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[440px]" aria-hidden>
      {STARS.map((s, i) => (
        <span
          key={i}
          className={`star-twinkle absolute ${s.size} rounded-full bg-white`}
          style={{ left: s.left, top: s.top, animationDelay: s.delay }}
        />
      ))}
      {/* rotating orbit rings */}
      <div className="absolute inset-4 animate-[spin_70s_linear_infinite] rounded-full border border-dashed border-accent/25" />
      <div className="absolute inset-16 rounded-full border border-accent/10" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.22),transparent_70%)] blur-2xl"
      />
      {/* central monument */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="float-y grid size-24 place-items-center rounded-[2rem] border border-white/10 bg-gradient-to-br from-cyan-400/25 via-violet-500/25 to-fuchsia-500/25 shadow-[var(--shadow-float)] backdrop-blur-md sm:size-28">
          <PillarMark className="size-12 sm:size-14" />
        </div>
      </div>
      {/* orbiting land chips */}
      {chips.map(({ name, Icon }, i) => {
        const angle = (i / chips.length) * 360;
        return (
          <div
            key={name}
            className="absolute left-1/2 top-1/2"
            style={{
              transform: `rotate(${angle}deg) translateX(min(36vw,148px)) rotate(${-angle}deg)`,
            }}
          >
            <div
              className="float-y -ml-6 -mt-6 grid size-12 place-items-center rounded-2xl border border-white/10 bg-surface/90 shadow-[var(--shadow-float)] backdrop-blur-md"
              style={{ animationDelay: `${(i * 0.55).toFixed(2)}s` }}
              title={name}
            >
              <Icon className="size-5 text-accent" strokeWidth={1.8} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Landing() {
  return (
    <main className="theme-landing min-h-dvh bg-bg text-ink">
      <header className="border-b border-border bg-bg/85 px-5 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <PillarMark />
            <div>
              <p className="font-display text-xl font-semibold">Pillarpath</p>
              <p className="text-xs text-muted">The Society of Becoming</p>
            </div>
          </div>
          <Link to="/login">
            <Button variant="outline">Sign in</Button>
          </Link>
        </div>
      </header>

      {/* ------------------------------- HERO ------------------------------- */}
      <section className="relative overflow-hidden px-5 pb-16 pt-14 sm:pt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.12),rgba(139,92,246,0.1),transparent_70%)] blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <Eyebrow>Better than yesterday.</Eyebrow>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Welcome to the{" "}
              <span className="bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                Society of Becoming.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-muted lg:mx-0">
              A world where kids earn, save, and grow — one better yesterday
              at a time.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link to="/login">
                <Button className="h-12 px-6 text-base">
                  Join the Society
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <a href="#world">
                <Button variant="outline" className="h-12 px-6 text-base">
                  Explore the world
                </Button>
              </a>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-muted lg:justify-start">
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-accent" /> You approve everything
              </span>
              <span className="flex items-center gap-2">
                <Lock className="size-4 text-accent" /> Units aren&rsquo;t real money
              </span>
              <span className="flex items-center gap-2">
                <BadgeCheck className="size-4 text-accent" /> Kid-safe by design
              </span>
            </div>
          </div>
          <WorldOrbit />
        </div>
      </section>

      {/* ------------------------------- WORLD ------------------------------- */}
      <section id="world" className="border-y border-border bg-surface/60 px-5 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>The World</Eyebrow>
            <h2 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">
              Nine lands. One climb.
            </h2>
            <p className="mt-4 leading-7 text-muted">
              Kids don&rsquo;t open another app — they step into Pillar Plaza
              and set out. Every chore finished, every Unit saved, every thing
              made moves them forward.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
            {LANDS.map(({ name, Icon, line }) => (
              <Card
                key={name}
                className="group p-4 transition-transform duration-150 hover:-translate-y-1 sm:p-5"
              >
                <div className="grid size-11 place-items-center rounded-2xl bg-accent/12 text-accent shadow-[var(--shadow-float)]">
                  <Icon className="size-5" strokeWidth={1.8} />
                </div>
                <h3 className="mt-3 font-display text-base font-semibold sm:text-lg">
                  {name}
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted sm:text-sm">{line}</p>
              </Card>
            ))}
          </div>

          {/* Society ranks */}
          <div className="mt-12">
            <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-accent">
              The Society ranks
            </p>
            <div className="mt-6 flex items-stretch justify-between gap-1 sm:gap-2">
              {RANKS.map((rank, i) => (
                <div key={rank.name} className="flex flex-1 flex-col items-center">
                  <div
                    className={`grid size-10 place-items-center rounded-full border font-display text-sm font-bold sm:size-12 sm:text-base ${
                      i === RANKS.length - 1
                        ? "border-transparent bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500 text-white shadow-[var(--shadow-float)]"
                        : "border-border bg-surface text-accent shadow-[var(--shadow-float)]"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <p className="mt-2 text-center font-display text-xs font-semibold sm:text-sm">
                    {rank.name}
                  </p>
                  <p className="mt-0.5 hidden text-center text-[11px] leading-4 text-muted sm:block">
                    {rank.tagline}
                  </p>
                  {i < RANKS.length - 1 && (
                    <div aria-hidden className="mt-3 hidden h-px w-full bg-gradient-to-r from-transparent via-accent/40 to-transparent sm:block" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------- STORE ------------------------------- */}
      <section className="relative overflow-hidden px-5 py-14 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-32 size-[30rem] rounded-full bg-[radial-gradient(circle,rgba(217,70,239,0.12),transparent_70%)] blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <Card className="overflow-hidden p-0">
              <div className="flex items-center gap-3 border-b border-border bg-surface-2 p-5">
                <div className="grid size-11 place-items-center rounded-2xl bg-accent/12 text-accent shadow-[var(--shadow-float)]">
                  <Store className="size-5" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="font-display text-lg font-semibold">The Society Store</p>
                  <p className="text-xs text-muted">Gear up for becoming.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
                {AISLES.map(({ name, Icon }) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 rounded-2xl border border-border bg-bg px-3 py-2.5"
                  >
                    <Icon className="size-4 shrink-0 text-accent" strokeWidth={1.8} />
                    <span className="truncate text-xs font-semibold">{name}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-border bg-surface-2 px-5 py-3">
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <BadgeCheck className="size-3.5 text-accent" /> Kid-safe screened
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <ShieldCheck className="size-3.5 text-accent" /> Parent approves every purchase
                </span>
              </div>
            </Card>
          </div>
          <div className="order-1 lg:order-2">
            <Eyebrow>The Society Store</Eyebrow>
            <h2 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">
              Gear up for becoming.
            </h2>
            <p className="mt-4 leading-7 text-muted">
              Units earned become treasures chosen. Kids browse real aisles —
              toys, tech, games, styles — and pick what their effort bought.
              Nothing reaches the shelves without passing kid-safety screening,
              and every purchase still waits for your tap.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/login">
                <Button>
                  Join to shop the shelves
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------- HOW IT WORKS ----------------------------- */}
      <section className="border-y border-border bg-surface/60 px-5 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">
              Earn. Grow. Become.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {(
              [
                [Wallet, "Earn", "Real chores pay real Units — with values you set. Kids see exactly what effort is worth."],
                [PiggyBank, "Grow", "Units flow into Vault goals, a college-fund CD, or the Society Store. Patience, visualized."],
                [Trophy, "Become", "Every step climbs the Society ranks — from Seedling to Pillar. Better than yesterday, every day."],
              ] as const
            ).map(([Icon, title, text], i) => (
              <Card key={title} className="relative overflow-hidden p-6">
                <p
                  aria-hidden
                  className="pointer-events-none absolute -right-2 -top-4 font-display text-[6rem] font-bold leading-none text-accent/8"
                >
                  {i + 1}
                </p>
                <div className="relative">
                  <div className="grid size-12 place-items-center rounded-2xl bg-accent/12 text-accent shadow-[var(--shadow-float)]">
                    <Icon className="size-6" strokeWidth={1.8} />
                  </div>
                  <h3 className="mt-4 font-display text-2xl font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ FINAL CTA ------------------------------ */}
      <section className="relative overflow-hidden px-5 py-16 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.1),rgba(139,92,246,0.1),transparent_70%)] blur-3xl"
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="float-y mx-auto mb-6 w-fit">
            <PillarMark className="size-16" />
          </div>
          <h2 className="font-display text-4xl font-semibold sm:text-5xl">
            Join the Society of{" "}
            <span className="bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              Becoming.
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-7 text-muted">
            Set up your family in minutes — and watch better-than-yesterday begin.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/login">
              <Button className="h-12 px-6 text-base">
                Join the Society
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <PillarMark />
            <span>Pillarpath</span>
          </div>
          <span>Better than yesterday.</span>
          <div className="flex gap-4">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
