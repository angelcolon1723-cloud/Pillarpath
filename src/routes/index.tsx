import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Brush,
  CheckCircle2,
  CreditCard,
  Gift,
  Megaphone,
  ShieldCheck,
  ShoppingBag,
  Users,
  WalletCards,
} from "lucide-react";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { PillarpathApp } from "@/components/pillarpath-app";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PillarMark } from "@/components/kiddo/mark";
import { STUDIO_BANDS, STUDIO_ROOMS } from "@/lib/studio-path";

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
        <PillarpathApp />
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

function Landing() {
  return (
    <main className="theme-landing min-h-dvh bg-bg text-ink">
      <header className="border-b border-border bg-bg/85 px-5 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <PillarMark />
            <div>
              <p className="font-display text-xl font-semibold">Pillarpath</p>
              <p className="text-xs text-muted">Family commerce</p>
            </div>
          </div>
          <Link to="/login">
            <Button variant="outline">Sign in</Button>
          </Link>
        </div>
      </header>

      <section className="px-5 py-14 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">
              A family operating system
            </p>
            <h1 className="mt-4 max-w-4xl font-display text-5xl font-semibold leading-[0.98] tracking-tight sm:text-7xl">
              Earn. Save. Shop. Create.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
              Parent controls, child financial learning, a curated store, and a
              Creative Studio that grows with age — Spark through Atelier — in
              one family-first product.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login">
                <Button className="h-12 px-5">
                  Create your family account
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <a href="#studio">
                <Button variant="outline" className="h-12 px-5">
                  See the studio
                </Button>
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-accent" /> Parent controlled
              </span>
              <span className="flex items-center gap-2">
                <CreditCard className="size-4 text-accent" /> Secure payments
              </span>
              <span className="flex items-center gap-2">
                <Brush className="size-4 text-accent" /> Age-progressed studio
              </span>
            </div>
          </div>

          <Card className="overflow-hidden rounded-[2rem] p-0">
            <div className="border-b border-border bg-surface-2 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                Live workspace
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold">
                One dashboard. Every path.
              </h2>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {(
                [
                  [Users, "Parent control", "Approvals, family profiles, settings"],
                  [WalletCards, "Child money", "Earn, save, learn, ask to shop"],
                  [Brush, "Creative Studio", "Age tracks, missions, unlocks"],
                  [ShoppingBag, "Marketplace", "Curated products and baskets"],
                  [CreditCard, "Checkout", "Cards and digital wallets"],
                  [Megaphone, "Growth", "Campaigns, promo, referrals"],
                ] as const
              ).map(([Icon, title, text]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-border bg-bg p-4"
                >
                  <Icon className="size-5 text-accent" />
                  <p className="mt-3 font-semibold">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{text}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section id="studio" className="px-5 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
              Creative Studio
            </p>
            <h2 className="mt-2 font-display text-4xl font-semibold">
              Four studio tracks. Work gets harder as they do.
            </h2>
            <p className="mt-3 text-muted">
              Kids start on a track that matches their age. Completing missions
              unlocks tools, then rooms: music, games, animation, design, and a
              studio shop. Finish a track and the next one waits as advanced work.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STUDIO_BANDS.map((band) => (
              <Card key={band.id} className="flex flex-col">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Ages {band.ages}
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold">{band.name}</h3>
                <p className="mt-2 flex-1 text-sm text-muted">{band.pitch}</p>
                <ul className="mt-4 space-y-2 text-sm text-muted">
                  {band.missions.map((mission) => (
                    <li key={mission.id} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent" />
                      {mission.title}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STUDIO_ROOMS.map((room) => (
              <div key={room.id} className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                  From {room.minBand}
                </p>
                <p className="mt-1 font-semibold">{room.title}</p>
                <p className="mt-1 text-sm text-muted">{room.blurb}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link to="/login">
              <Button className="h-12 px-5">
                Open a family studio
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section id="features" className="border-y border-border bg-surface/70 px-5 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
              Built to scale
            </p>
            <h2 className="mt-2 font-display text-4xl font-semibold">
              Commerce infrastructure without losing the family mission.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(
              [
                [ShieldCheck, "Controls", "Parent approvals, frozen access, profiles"],
                [Gift, "Savings", "Vault goals and matching"],
                [Brush, "Studio", "Spark, Maker, Inventor, Atelier"],
                [ShoppingBag, "Store", "Curated catalog, basket, orders"],
              ] as const
            ).map(([Icon, title, text]) => (
              <Card key={title}>
                <Icon className="size-6 text-accent" />
                <h3 className="mt-5 font-display text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted">{text}</p>
                <div className="mt-4 flex items-center gap-2 text-xs text-accent">
                  <CheckCircle2 className="size-3.5" /> Included
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <PillarMark />
            <span>Pillarpath</span>
          </div>
          <span>Family finance, commerce, and a growing studio</span>
          <div className="flex gap-4">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/affiliate-disclosure">Affiliate disclosure</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
