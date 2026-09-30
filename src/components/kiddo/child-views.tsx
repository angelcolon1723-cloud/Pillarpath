import { useState } from "react";
import {
  BookOpen,
  Brain,
  CircleDollarSign,
  Target,
  Brush,
  Check,
  Heart,
  HeartHandshake,
  Home,
  Images,
  Landmark,
  Lock,
  ShoppingBag,
  Sparkles,
  Sun,
  TreePine,
  Utensils,
  WashingMachine,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, FieldLabel } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ProductIcon } from "@/components/kiddo/product-icon";
import { PRODUCTS } from "@/lib/products";
import { CHORE_CATEGORIES, type ChoreCategory } from "@/lib/chores";
import { formatUnits } from "@/lib/utils";
import { useLedger, formatDollars } from "@/store/ledger";
import { bandForAge, missionProgress } from "@/lib/studio-path";

const CHORE_ICON: Record<string, typeof Home> = {
  "rs-homework": BookOpen,
  "hh-clean-bedroom": Home,
  "hh-make-bed": Home,
  "hh-do-dishes": Utensils,
  "kt-set-table": Utensils,
  "kt-clear-table": Utensils,
  "kt-help-cook": Utensils,
};

const CATEGORY_ICON: Record<ChoreCategory, typeof Home> = {
  Household: WashingMachine,
  Kitchen: Utensils,
  Outdoor: TreePine,
  Responsibility: Sun,
  Kindness: Heart,
  "School & Learning": BookOpen,
};

function choreIconFor(id: string, category: ChoreCategory) {
  return CHORE_ICON[id] ?? CATEGORY_ICON[category] ?? Sparkles;
}

function BackHome() {
  const setScreen = useLedger((s) => s.setScreen);
  return (
    <Button variant="outline" className="w-full" onClick={() => setScreen("home")}>
      Back
    </Button>
  );
}

export function FrozenBanner() {
  const frozen = useLedger((s) => s.frozen);
  if (!frozen) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-warn-soft px-3 py-2.5 text-sm text-warn">
      <Lock className="size-4 shrink-0" />
      Your parent paused this ledger. You can look, not spend.
    </div>
  );
}

export function ChildHome() {
  const childName = useLedger((s) => s.childName);
  const balance = useLedger((s) => s.balance);
  const vault = useLedger((s) => s.vault);
  const vaultTarget = useLedger((s) => s.vaultTarget);
  const vaultGoal = useLedger((s) => s.vaultGoal);
  const frozen = useLedger((s) => s.frozen);
  const pendingChores = useLedger((s) => s.pendingChores);
  const completedChoreIds = useLedger((s) => s.completedChoreIds);
  const pendingPurchases = useLedger((s) => s.pendingPurchases);
  const reserved = pendingPurchases.reduce((sum, p) => sum + p.price, 0);
  const available = Math.max(0, balance - reserved);
  const setScreen = useLedger((s) => s.setScreen);
  const completeChore = useLedger((s) => s.completeChore);
  const choreCatalog = useLedger((s) => s.choreCatalog);
  const disabledChoreIds = useLedger((s) => s.disabledChoreIds);
  const childAge = useLedger((s) => s.childAge);
  const completedMissionIds = useLedger((s) => s.completedMissionIds ?? []);
  const studioXp = useLedger((s) => s.studioXp ?? 0);
  const band = bandForAge(childAge);
  const studio = missionProgress(band, completedMissionIds);

  return (
    <div className="screen-enter space-y-4">
      <header>
        <p className="text-sm font-medium text-muted">Hi {childName}</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Your ledger
        </h1>
        <p className="mt-1 text-sm text-muted">
          Earn Units. Spend them here. Save the rest.
        </p>
      </header>

      <FrozenBanner />

      <div className="units-hero tilt-r overflow-hidden rounded-xl p-5 shadow-[var(--shadow-border)]">
        <p className="text-xs font-medium uppercase tracking-wider text-white/60">
          Spendable
        </p>
        <p className="units-shimmer mt-1 font-hero text-5xl font-bold tracking-tight tabular-nums">
          {formatUnits(balance)}
        </p>
        <p className="mt-1 text-sm text-white/70">Pillar Units · {available} available</p>
      </div>

      <Card className="tilt-l bg-vault p-5 text-vault-foreground">
        <p className="text-xs font-medium uppercase tracking-wider text-vault-foreground/60">
          Savings vault
        </p>
        <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
          {formatUnits(vault)}
        </p>
        <p className="mt-1 text-sm text-vault-foreground/75">
          {vaultGoal} · {Math.round((vault / vaultTarget) * 100)}% of goal
        </p>
        <Progress
          value={(vault / vaultTarget) * 100}
          className="mt-4 bg-white/15"
          barClassName="bg-vault-foreground"
        />
      </Card>

      {pendingPurchases.length > 0 ? (
        <Card className="p-4">
          <CardTitle className="mb-2 text-base">Waiting on parent</CardTitle>
          <ul className="space-y-2">
            {pendingPurchases.map((p) => (
              <li key={p.id} className="flex items-center gap-3 text-sm">
                <ProductIcon name={p.icon} className="size-4 text-muted" />
                <span className="flex-1">{p.name}</span>
                <span className="font-mono tabular-nums text-muted">
                  {p.price}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="p-4">
        <CardTitle className="mb-1 text-base">Today's goals</CardTitle>
        <p className="mb-3 text-sm text-muted">
          Mark done — your parent awards the Units.
        </p>
        {CHORE_CATEGORIES.map((category) => {
          const items = choreCatalog.filter(
            (c) => c.category === category && !disabledChoreIds.includes(c.id),
          );
          if (items.length === 0) return null;
          return (
            <div key={category} className="mt-3 first:mt-0">
              <p className="py-2 text-xs font-semibold uppercase tracking-wider text-muted">
                {category}
              </p>
              <div className="divide-y divide-border">
                {items.map((c) => {
                  const Icon = choreIconFor(c.id, c.category);
                  const pending = pendingChores.some((p) => p.choreId === c.id);
                  const done = completedChoreIds.includes(c.id);
                  return (
              <div key={c.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink">
                  <Icon className="size-5" strokeWidth={1.7} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-muted">Earn {c.amount} Units</div>
                </div>
                <Button
                  size="sm"
                  variant={done ? "secondary" : pending ? "outline" : "default"}
                  disabled={frozen || pending || done}
                  onClick={() => {
                    const err = completeChore(c.id);
                    if (err) toast.error(err);
                    else toast.success("Sent to your parent");
                  }}
                >
                  {done ? (
                    <>
                      <Check className="size-3.5" />
                      Done
                    </>
                  ) : pending ? (
                    "Waiting"
                  ) : (
                    "Done"
                  )}
                </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Card>

      <Card className="border-accent/20 bg-accent-soft p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface text-accent">
            <Brain className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">Money Lab</CardTitle>
            <p className="mt-1 text-sm text-muted">
              Learn how spending, saving, and matching work before you use your Units.
            </p>
          </div>
        </div>
        <Button variant="outline" className="mt-3 w-full" onClick={() => setScreen("learn")}>
          <CircleDollarSign className="size-4" />
          Learn a money skill
        </Button>
      </Card>

      <div className="grid gap-2">
        <Button className="h-12" onClick={() => setScreen("market")}>
          <ShoppingBag className="size-4" />
          Open marketplace
        </Button>
        <Button variant="outline" className="h-12" onClick={() => setScreen("vault")}>
          <Landmark className="size-4" />
          Savings vault
        </Button>
        <Button variant="outline" className="h-12" onClick={() => setScreen("studio")}>
          <Brush className="size-4" />
          {band.name} studio · {studio.done}/{studio.total}
        </Button>
        <Button variant="outline" className="h-12" onClick={() => setScreen("gallery")}>
          <Images className="size-4" />
          Showcase gallery
        </Button>
        <Button variant="outline" className="h-12" onClick={() => setScreen("give")}>
          <HeartHandshake className="size-4" />
          Give Units
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              Creative Studio
            </p>
            <CardTitle className="mt-1 text-base">
              {band.name} · ages {band.ages}
            </CardTitle>
            <p className="mt-1 text-sm text-muted">
              {studio.complete
                ? "Track complete. Advanced work unlocks with age."
                : `${studio.done} of ${studio.total} missions · ${studioXp} XP`}
            </p>
          </div>
          <Brush className="size-5 text-accent" />
        </div>
        <Progress value={studio.pct} className="mt-4" />
      </Card>
    </div>
  );
}

export function ChildMarket() {
  const selectProduct = useLedger((s) => s.selectProduct);
  const setScreen = useLedger((s) => s.setScreen);
  const balance = useLedger((s) => s.balance);

  return (
    <div className="screen-enter space-y-4">
      <header>
        <p className="text-sm font-medium text-muted">Marketplace</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Spend Units here
        </h1>
        <p className="mt-1 text-sm text-muted">
          You have {formatUnits(balance)} Units. Parent approval required.
        </p>
      </header>
      <FrozenBanner />
      <div className="grid grid-cols-2 gap-3">
        {PRODUCTS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => selectProduct(p.id)}
            className="market-card overflow-hidden rounded-xl bg-surface p-0 text-left shadow-[var(--shadow-border)] transition-[scale,box-shadow] duration-150 ease-out active:scale-[0.96]"
          >
            <div className="flex h-24 items-center justify-center bg-surface-2 text-ink">
              <ProductIcon name={p.icon} className="size-9" />
            </div>
            <div className="p-3">
              <div className="text-sm font-medium leading-snug">{p.name}</div>
              <div className="mt-1 font-mono text-sm tabular-nums text-accent">
                {p.price} Units
              </div>
            </div>
          </button>
        ))}
      </div>
      <Button variant="outline" className="w-full" onClick={() => setScreen("home")}>
        Back
      </Button>
    </div>
  );
}

export function ChildConfirm() {
  const selectedProductId = useLedger((s) => s.selectedProductId);
  const requestPurchase = useLedger((s) => s.requestPurchase);
  const setScreen = useLedger((s) => s.setScreen);
  const product = PRODUCTS.find((p) => p.id === selectedProductId);

  if (!product) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">No item selected.</p>
        <Button className="w-full" onClick={() => setScreen("market")}>
          Browse marketplace
        </Button>
      </div>
    );
  }

  return (
    <div className="screen-enter space-y-4">
      <header>
        <p className="text-sm font-medium text-muted">Confirm</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Ask your parent
        </h1>
        <p className="mt-1 text-sm text-muted">
          They will approve or deny this request.
        </p>
      </header>
      <FrozenBanner />
      <Card className="flex flex-col items-center py-8 text-center">
        <span className="flex size-16 items-center justify-center rounded-lg bg-surface-2 text-ink">
          <ProductIcon name={product.icon} className="size-8" />
        </span>
        <h2 className="mt-4 font-display text-xl font-semibold">{product.name}</h2>
        <p className="mt-1 text-sm text-muted">{product.blurb}</p>
        <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-accent">
          {product.price} Units
        </p>
      </Card>
      <Button
        className="w-full"
        onClick={() => {
          const err = requestPurchase(product.id);
          if (err) toast.error(err);
          else toast.success("Request sent to your parent");
        }}
      >
        Send request
      </Button>
      <Button variant="outline" className="w-full" onClick={() => setScreen("market")}>
        Back
      </Button>
    </div>
  );
}

export function ChildVault() {
  const [amount, setAmount] = useState(5);
  const vault = useLedger((s) => s.vault);
  const vaultTarget = useLedger((s) => s.vaultTarget);
  const vaultGoal = useLedger((s) => s.vaultGoal);
  const matchRate = useLedger((s) => s.matchRate);
  const daysRemaining = useLedger((s) => s.daysRemaining());
  const lockUnits = useLedger((s) => s.lockUnits);
  const frozen = useLedger((s) => s.frozen);
  const vaultCds = useLedger((s) => s.vaultCds);

  // Read-only: child sees growth, no actions.
  const cdTotal = vaultCds
    .filter((cd) => cd.status === "active" || cd.status === "matured")
    .reduce((sum, cd) => sum + cd.principal + cd.bonusAccrued, 0);

  const match = Math.floor(amount * matchRate);

  return (
    <div className="screen-enter space-y-4">
      <header>
        <p className="text-sm font-medium text-muted">Vault</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Lock for later
        </h1>
        <p className="mt-1 text-sm text-muted">
          When it matures, this becomes cash for you.
        </p>
      </header>
      <FrozenBanner />
      <Card className="tilt-l bg-vault p-5 text-vault-foreground">
        <p className="text-xs font-medium uppercase tracking-wider text-vault-foreground/60">
          {vaultGoal}
        </p>
        <p className="mt-1 font-display text-4xl font-semibold tabular-nums">
          {formatUnits(vault)}
        </p>
        <p className="mt-1 text-sm text-vault-foreground/75">Units locked</p>
        <Progress
          value={(vault / vaultTarget) * 100}
          className="mt-4 bg-white/15"
          barClassName="bg-vault-foreground"
        />
        <p className="mt-3 text-sm text-vault-foreground/80">
          {daysRemaining === 0
            ? "Matured — your parent can release cash."
            : `${daysRemaining} days until maturity.`}
        </p>
      </Card>
      {cdTotal > 0 ? (
        <Card className="tilt-r bg-vault p-5 text-vault-foreground">
          <p className="text-xs font-medium uppercase tracking-wider text-vault-foreground/60">
            College fund growing
          </p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
            {formatUnits(cdTotal)}
          </p>
          <p className="mt-1 text-sm text-vault-foreground/75">
            ≈ {formatDollars(cdTotal)} saved for your education · growing at 5%
            APY until maturity
          </p>
        </Card>
      ) : null}
      <Card className="space-y-3">
        <CardTitle className="text-base">Lock more Units</CardTitle>
        <FieldLabel htmlFor="lock-amount">Amount</FieldLabel>
        <Input
          id="lock-amount"
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
        {matchRate > 0 ? (
          <p className="text-sm text-muted">
            Parent match: +{match} Units added to the vault.
          </p>
        ) : null}
        <Button
          className="w-full"
          disabled={frozen}
          onClick={() => {
            const err = lockUnits(amount);
            if (err) toast.error(err);
            else toast.success(`${amount} Units locked`);
          }}
        >
          Lock in vault
        </Button>
      </Card>
      <BackHome />
    </div>
  );
}


export function ChildLearn() {
  const setScreen = useLedger((s) => s.setScreen);
  const vault = useLedger((s) => s.vault);
  const balance = useLedger((s) => s.balance);
  const matchRate = useLedger((s) => s.matchRate);

  const lessons = [
    {
      icon: Target,
      title: "Give every Unit a job",
      text: "Spend some, save some, and keep a little room for a goal. You do not have to use everything you earn.",
    },
    {
      icon: Landmark,
      title: "Saving gets easier with a match",
      text: matchRate > 0
        ? `Your parent currently matches ${Math.round(matchRate * 100)}% of what you lock in the Vault.`
        : "Your parent can choose to match Units you lock in the Vault.",
    },
    {
      icon: CircleDollarSign,
      title: "Check before you spend",
      text: `You have ${formatUnits(balance)} Units in your ledger and ${formatUnits(vault)} Units already working toward your savings goal.`,
    },
  ];

  return (
    <div className="screen-enter space-y-4">
      <header>
        <p className="text-sm font-medium text-muted">Money Lab</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Build your money skills
        </h1>
        <p className="mt-1 text-sm text-muted">
          Small lessons now make bigger choices easier later.
        </p>
      </header>

      <Card className="tilt-r bg-vault p-5 text-vault-foreground">
        <p className="text-xs font-medium uppercase tracking-wider text-vault-foreground/60">
          Your rule
        </p>
        <p className="mt-2 font-display text-2xl font-semibold">
          Earn · Choose · Save
        </p>
        <p className="mt-2 text-sm text-vault-foreground/75">
          Pillarpath lets you practice with Units while a parent stays in control.
        </p>
      </Card>

      <div className="space-y-3">
        {lessons.map((lesson, index) => {
          const Icon = lesson.icon;
          return (
            <Card key={lesson.title} className="p-4">
              <div className="flex gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">
                    Skill {index + 1}
                  </p>
                  <h2 className="mt-0.5 text-base font-semibold">{lesson.title}</h2>
                  <p className="mt-1 text-sm text-muted">{lesson.text}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Button className="w-full" onClick={() => setScreen("home")}>
        Back to my ledger
      </Button>
    </div>
  );
}
