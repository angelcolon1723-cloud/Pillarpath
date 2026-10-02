import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Brush,
  CheckCircle2,
  GraduationCap,
  Lock,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RoleGate } from "@/components/role-gate";
import { PillarpathApp } from "@/components/pillarpath-app";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PillarMark } from "@/components/kiddo/mark";
import { STUDIO_BANDS } from "@/lib/studio-path";

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

function Landing() {
  return (
    <main className="theme-landing min-h-dvh bg-bg text-ink">
      <header className="border-b border-border bg-bg/85 px-5 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <PillarMark />
            <div>
              <p className="font-display text-xl font-semibold">Pillarpath</p>
              <p className="text-xs text-muted">Financial literacy for kids</p>
            </div>
          </div>
          <Link to="/login">
            <Button variant="outline">Sign in</Button>
          </Link>
        </div>
      </header>

      {/* ------------------------------- HERO ------------------------------- */}
      <section className="px-5 py-14 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <Eyebrow>Better than yesterday.</Eyebrow>
            <h1 className="mt-4 max-w-4xl font-display text-5xl font-semibold leading-[0.98] tracking-tight sm:text-7xl">
              Turn chores into money smarts.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
              PillarPath gives your kids a world of their own — where real
              chores earn Units, savings goals teach patience, and every money
              move happens under your approval. Built for families, ready for
              classrooms.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login">
                <Button className="h-12 px-5">
                  Create your family account
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <a href="#how">
                <Button variant="outline" className="h-12 px-5">
                  See how it works
                </Button>
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-accent" /> Parent approves everything
              </span>
              <span className="flex items-center gap-2">
                <Lock className="size-4 text-accent" /> Units aren&rsquo;t real money — zero financial risk
              </span>
              <span className="flex items-center gap-2">
                <BadgeCheck className="size-4 text-accent" /> Kid-safe by design
              </span>
            </div>
          </div>

          <Card className="overflow-hidden rounded-[2rem] p-0">
            <div className="border-b border-border bg-surface-2 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                The earning loop
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold">
                Earn. Approve. Grow.
              </h2>
            </div>
            <div className="grid gap-3 p-5">
              {(
                [
                  [Wallet, "Kids earn Units", "Real chores, real effort — 67 pre-seeded jobs across 6 categories, with values you set."],
                  [ShieldCheck, "Parents approve", "Every chore, gift, and spend request lands in your queue. Nothing moves without your tap."],
                  [PiggyBank, "Savings grow", "Units flow into Vault goals — or a Vault CD earning 5% APY toward college."],
                ] as const
              ).map(([Icon, title, text], i) => (
                <div
                  key={title}
                  className="flex gap-4 rounded-2xl border border-border bg-bg p-4"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 font-display text-lg font-bold text-accent">
                    {i + 1}
                  </div>
                  <div>
                    <p className="flex items-center gap-2 font-semibold">
                      <Icon className="size-4 text-accent" /> {title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* ---------------------------- HOW IT WORKS ---------------------------- */}
      <section id="how" className="border-y border-border bg-surface/70 px-5 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-2 font-display text-4xl font-semibold">
              Allowance, rebuilt as an education.
            </h2>
            <p className="mt-3 text-muted">
              Most kids learn about money by watching. PillarPath lets them
              practice — with training wheels you control.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {(
              [
                [Wallet, "Kids do real work", "From making the bed to mowing the lawn, 67 pre-seeded chores across 6 categories pay Units. Edit the values, add your own, or disable what doesn't fit your family."],
                [ShieldCheck, "You stay in charge", "Chore completions, gifts between kids, and shop purchases all wait for your approval. See every Unit move in the family ledger — and freeze access anytime."],
                [GraduationCap, "Lessons stick", "Units saved in the Vault teach delayed gratification. Classroom modules teach the concepts. The Creative Studio keeps them creating, not just consuming."],
              ] as const
            ).map(([Icon, title, text]) => (
              <Card key={title}>
                <Icon className="size-6 text-accent" />
                <h3 className="mt-5 font-display text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ PARENTS ------------------------------ */}
      <section id="parents" className="px-5 py-14 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>For parents</Eyebrow>
            <h2 className="mt-2 font-display text-4xl font-semibold">
              You&rsquo;re the bank. And the boss.
            </h2>
            <p className="mt-4 leading-7 text-muted">
              Your workspace is mission control for your family&rsquo;s money
              habits. Set up chores once, then approve with a tap while the
              ledger tracks every Unit earned, saved, gifted, and spent.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Approve chores, gifts, and purchases — nothing moves without you",
                "Full family ledger: every Unit, timestamped and filterable",
                "Load Units onto your family balance whenever you choose",
                "Freeze a child's access instantly, right from your phone",
                "67 pre-seeded chores you can edit, disable, or replace with your own",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-muted">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                  <span className="leading-6">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 rounded-2xl border border-border bg-surface p-4 text-sm leading-6 text-muted">
              <span className="font-semibold text-ink">Honest by design:</span>{" "}
              Units are a family reward currency — not cash, not crypto, and
              non-refundable. Your kids can never cash them out on their own.
            </p>
          </div>
          <Card className="rounded-[2rem] p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              Parent workspace
            </p>
            <h3 className="mt-1 font-display text-2xl font-semibold">
              One dashboard for the whole family economy
            </h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(
                [
                  [Users, "Family profiles", "Each child gets their own space, balances, and history."],
                  [Wallet, "Chore manager", "The full catalog, your values, your rules."],
                  [PiggyBank, "Vault & Vault CD", "Savings goals plus long-term CDs earning 5% APY in Units."],
                  [ShieldCheck, "Approvals queue", "Chores, gifts, and shop requests — approve or decline in seconds."],
                ] as const
              ).map(([Icon, title, text]) => (
                <div key={title} className="rounded-2xl border border-border bg-bg p-4">
                  <Icon className="size-5 text-accent" />
                  <p className="mt-3 font-semibold">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{text}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* -------------------------------- KIDS -------------------------------- */}
      <section id="kids" className="border-y border-border bg-surface/70 px-5 py-14 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <Card className="order-2 rounded-[2rem] p-6 lg:order-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              Child workspace
            </p>
            <h3 className="mt-1 font-display text-2xl font-semibold">
              A world that feels like a game, teaches like a class
            </h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(
                [
                  [Trophy, "Earn & level up", "Finish chores, watch your balance grow, hit streaks."],
                  [PiggyBank, "Save toward goals", "Vault goals for the big stuff — plus a college-fund CD that grows."],
                  [Sparkles, "Creator shop", "Spend Units on creations in the shop — Units only, no real money."],
                  [Brush, "Creative Studio", "Draw, build, and make things across music, games, and design."],
                ] as const
              ).map(([Icon, title, text]) => (
                <div key={title} className="rounded-2xl border border-border bg-bg p-4">
                  <Icon className="size-5 text-accent" />
                  <p className="mt-3 font-semibold">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{text}</p>
                </div>
              ))}
            </div>
          </Card>
          <div className="order-1 lg:order-2">
            <Eyebrow>For kids</Eyebrow>
            <h2 className="mt-2 font-display text-4xl font-semibold">
              Their money. Their missions. Your rules.
            </h2>
            <p className="mt-4 leading-7 text-muted">
              Kids get a space that&rsquo;s theirs — earning, saving, and
              creating — while every boundary you set holds firm in the
              background. They feel independent. You stay in control.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "See exactly what each chore pays before lifting a finger",
                "Watch savings grow in the Vault — patience, visualized",
                "Gift Units to siblings (with your approval, of course)",
                "A read-only college-fund card shows their Vault CD growing",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-muted">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                  <span className="leading-6">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------ TEACHERS ------------------------------ */}
      <section id="teachers" className="px-5 py-14 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>For teachers</Eyebrow>
            <h2 className="mt-2 font-display text-4xl font-semibold">
              Financial literacy, taught like it matters.
            </h2>
            <p className="mt-4 leading-7 text-muted">
              Bring money skills into your classroom with a 10-module starter
              curriculum, ready-made earning activities, and tools that make
              running it effortless.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "6-letter class join codes — students enroll in seconds",
                "10-module financial-literacy curriculum, ready to teach",
                "Lesson and assignment builders for your own material",
                "Effort-ranked leaderboard (students stay anonymous by default)",
                "Upload and download class records",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-muted">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                  <span className="leading-6">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 rounded-2xl border border-border bg-surface p-4 text-sm leading-6 text-muted">
              <span className="font-semibold text-ink">Clean separation:</span>{" "}
              classroom Units and family Units never mix. What happens in class
              stays in class.
            </p>
          </div>
          <Card className="rounded-[2rem] p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              Teacher workspace
            </p>
            <h3 className="mt-1 font-display text-2xl font-semibold">
              Mission control for money skills
            </h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(
                [
                  [BookOpen, "Curriculum", "10 starter modules on saving, earning, and smart spending."],
                  [Users, "Classrooms", "Create classes, share join codes, manage students."],
                  [Trophy, "Leaderboard", "Effort-ranked, anonymized — motivation without shaming."],
                  [BadgeCheck, "Records", "Track progress and export records for your files."],
                ] as const
              ).map(([Icon, title, text]) => (
                <div key={title} className="rounded-2xl border border-border bg-bg p-4">
                  <Icon className="size-5 text-accent" />
                  <p className="mt-3 font-semibold">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{text}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* ------------------------------- VAULT CD ------------------------------- */}
      <section id="vault" className="border-y border-border bg-surface/70 px-5 py-14 sm:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <Eyebrow>Vault CD</Eyebrow>
          <h2 className="mt-2 font-display text-4xl font-semibold">
            A college fund that starts with chores.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-muted">
            Lock Units away for 1, 3, or 5 years — or until your child turns
            18 — and watch them earn a{" "}
            <span className="font-semibold text-ink">5% APY bonus in Units</span>,
            credited monthly. It&rsquo;s the first savings account your kid
            will actually understand, because they funded it themselves.
          </p>
          <div className="mt-8 grid gap-4 text-left sm:grid-cols-3">
            {(
              [
                ["Lock it", "Choose a term and move Units from the family balance into the CD."],
                ["Watch it grow", "A 5% APY bonus accrues in Units, month after month."],
                ["Use it for education", "At maturity, request a payout for qualified education expenses."],
              ] as const
            ).map(([title, text], i) => (
              <Card key={title} className="p-5">
                <p className="font-display text-3xl font-bold text-accent">{i + 1}</p>
                <h3 className="mt-3 font-display text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
              </Card>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-xs leading-5 text-muted">
            Early withdrawal returns the principal as Units and forfeits the
            bonus — the lesson is the point. Education payouts at maturity are
            queued pending our licensed banking partner; no real money moves
            yet, and we&rsquo;ll say so loudly when it does.
          </p>
        </div>
      </section>

      {/* ------------------------------ CREATIVE STUDIO ------------------------------ */}
      <section id="studio" className="px-5 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <Eyebrow>Creative Studio</Eyebrow>
            <h2 className="mt-2 font-display text-4xl font-semibold">
              Not just money skills. Making skills.
            </h2>
            <p className="mt-3 text-muted">
              Four age-matched tracks — Spark through Atelier — where kids
              complete creative missions, unlock real tools, and open rooms for
              music, games, animation, and design. Earning teaches discipline;
              creating teaches everything else.
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
                  {band.missions.slice(0, 3).map((mission) => (
                    <li key={mission.id} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent" />
                      {mission.title}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------- SAFETY -------------------------------- */}
      <section id="safety" className="border-y border-border bg-surface/70 px-5 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <Eyebrow>Why parents trust it</Eyebrow>
            <h2 className="mt-2 font-display text-4xl font-semibold">
              Built like a bank vault. Feels like a game.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                [ShieldCheck, "Approval-first", "Chores, gifts, and purchases wait for a parent's tap. Nothing moves on its own."],
                [Lock, "Not real money", "Units are a closed-loop family currency. No bank account to drain, no surprise charges — ever."],
                [Users, "Separated worlds", "Classroom Units and family Units are strictly separated, by design, always."],
                [BadgeCheck, "Honest beta", "We're in beta: the core loops work today, and we'll tell you plainly what's still on the way."],
              ] as const
            ).map(([Icon, title, text]) => (
              <Card key={title}>
                <Icon className="size-6 text-accent" />
                <h3 className="mt-5 font-display text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ FINAL CTA ------------------------------ */}
      <section className="px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-6 w-fit">
            <PillarMark className="size-16" />
          </div>
          <h2 className="font-display text-4xl font-semibold sm:text-5xl">
            Give your kids a head start on money.
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-7 text-muted">
            Set up your family in minutes. Add your kids, pick your chores,
            and watch earning turn into learning.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/login">
              <Button className="h-12 px-6">
                Create your family account
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
          <span>Financial literacy for kids — earn, save, learn, create</span>
          <div className="flex gap-4">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
