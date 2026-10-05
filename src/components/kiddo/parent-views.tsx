import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  Award,
  Check,
  Landmark,
  ListChecks,
  Pencil,
  Plus,
  Power,
  ShieldCheck,
  Snowflake,
  Sun,
  History as HistoryIcon,
  Ban,
  FastForward,
  RotateCcw,
  Trash2,
  HeartHandshake,
  Images,
  PiggyBank,
  GraduationCap,
  Lock,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, FieldLabel, NativeSelect } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { AWARD_REASONS } from "@/lib/products";
import { CHORE_CATEGORIES, type ChoreCategory } from "@/lib/chores";
import { formatUnits, formatWhen, cn } from "@/lib/utils";
import {
  useLedger,
  type MatchRate,
  type CdTerm,
  type PayoutRecipient,
  type VaultCd,
  CD_TERMS,
  CD_APY,
  UNITS_PER_DOLLAR,
  cdTermYears,
  formatDollars,
  payoutRecipientLabel,
} from "@/store/ledger";
import {
  joinClassroomByCode,
  listMyClassroomConnections,
  listParentThreads,
  sendParentThreadMessage,
  type ParentClassroomConnection,
  type ParentThread,
} from "@/lib/teacher-server";
import { useSocial } from "@/store/social";
import {
  fulfillUnitPurchase,
  getShippingAddress,
  listMyOrders,
  saveShippingAddress,
  type FulfillmentOrder,
} from "@/lib/fulfillment-server";
import { PendingGiftRows } from "@/components/kiddo/give";
import { PendingShopRows } from "@/components/kiddo/creator-shop";
import { PendingGalleryRows } from "@/components/kiddo/showcase";
import { logUnitsTransaction } from "@/lib/pillarpath-server";

function BackButton() {
  const setScreen = useLedger((s) => s.setScreen);
  return (
    <Button variant="outline" className="w-full" onClick={() => setScreen("home")}>
      Back
    </Button>
  );
}

export function ParentHome() {
  const childName = useLedger((s) => s.childName);
  const consent = useLedger((s) => s.consent);
  const frozen = useLedger((s) => s.frozen);
  const balance = useLedger((s) => s.balance);
  const vault = useLedger((s) => s.vault);
  const vaultTarget = useLedger((s) => s.vaultTarget);
  const vaultGoal = useLedger((s) => s.vaultGoal);
  const pendingPurchases = useLedger((s) => s.pendingPurchases);
  const pendingChores = useLedger((s) => s.pendingChores);
  const reservedUnits = pendingPurchases.reduce((sum, p) => sum + p.price, 0);
  const availableUnits = Math.max(0, balance - reservedUnits);
  const pendingCount = useLedger((s) => s.pendingCount());
  const gifts = useSocial((s) => s.gifts);
  const shopOrders = useSocial((s) => s.shopOrders);
  const posts = useSocial((s) => s.posts);
  const contacts = useSocial((s) => s.contacts);
  const socialPending =
    gifts.filter((g) => g.status === "pending").length +
    shopOrders.filter((o) => o.status === "pending").length +
    posts.filter((p) => p.status === "pending").length +
    contacts.filter((c) => c.status === "pending").length;
  const allPending = pendingCount + socialPending;
  const daysRemaining = useLedger((s) => s.daysRemaining());
  const setScreen = useLedger((s) => s.setScreen);
  const verifyConsent = useLedger((s) => s.verifyConsent);
  const toggleFreeze = useLedger((s) => s.toggleFreeze);
  const approvePurchase = useLedger((s) => s.approvePurchase);
  const denyPurchase = useLedger((s) => s.denyPurchase);
  const [addressGate, setAddressGate] = useState<null | { purchaseId: string; productId: string; name: string }>(null);
  const [fulfilling, setFulfilling] = useState(false);

  async function approveWithFulfillment(purchase: { id: string; productId: string; name: string; price: number }) {
    // Units check happens in the store; address check happens server-side.
    try {
      const { address } = await getShippingAddress();
      if (!address) {
        // Capture the shipping address first, then complete approval.
        setAddressGate({ purchaseId: purchase.id, productId: purchase.productId, name: purchase.name });
        return;
      }
      await completeApproval(purchase);
    } catch {
      // If the address lookup fails (offline?), fall back to local approval.
      const err = approvePurchase(purchase.id);
      if (err) toast.error(err);
      else toast.success("Purchase approved");
    }
  }

  async function completeApproval(purchase: { id: string; productId: string; name: string }) {
    const err = approvePurchase(purchase.id);
    if (err) {
      toast.error(err);
      return;
    }
    setFulfilling(true);
    try {
      const { orderId } = await fulfillUnitPurchase({ data: { productId: purchase.productId } });
      toast.success(`Approved — order #${orderId} is on its way!`);
    } catch (e) {
      // Units were deducted; the order will be retried from the stockroom.
      toast.message(`Approved. Fulfillment queued — ${e instanceof Error ? e.message : "will retry"}`);
    } finally {
      setFulfilling(false);
      setAddressGate(null);
    }
  }
  const approveChore = useLedger((s) => s.approveChore);
  const denyChore = useLedger((s) => s.denyChore);

  const vaultPct = (vault / vaultTarget) * 100;

  return (
    <div className="screen-enter space-y-4">
      <header className="stagger-1 screen-enter">
        <p className="text-sm font-medium text-muted">Parent</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {childName}'s ledger
        </h1>
        <p className="mt-1 text-sm text-muted">
          Units load in, never cash out — until a vault matures.
        </p>
      </header>

      <Card className="stagger-2 screen-enter space-y-0 p-2">
        <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-accent-soft text-accent">
              <ShieldCheck className="size-5" strokeWidth={1.8} />
            </span>
            <div>
              <div className="text-sm font-medium">Parental consent</div>
              <div className="text-xs text-muted">
                {consent ? "Verified" : "Required before loading Units"}
              </div>
            </div>
          </div>
          <Button
            variant={consent ? "secondary" : "default"}
            size="sm"
            disabled={consent}
            onClick={() => {
              const err = verifyConsent();
              if (err) toast.message(err);
              else toast.success("Consent verified");
            }}
          >
            {consent ? "Verified" : "Verify"}
          </Button>
        </div>
        <div className="mx-3 h-px bg-border" />
        <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-surface-2 text-ink">
              {frozen ? (
                <Snowflake className="size-5" strokeWidth={1.8} />
              ) : (
                <Sun className="size-5" strokeWidth={1.8} />
              )}
            </span>
            <div>
              <div className="text-sm font-medium">Child access</div>
              <div className="text-xs text-muted">
                {frozen ? "Frozen — spend and chores paused" : "Active"}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.message(toggleFreeze())}
          >
            {frozen ? "Unfreeze" : "Freeze"}
          </Button>
        </div>
      </Card>

      <div className="stagger-3 screen-enter overflow-hidden rounded-xl bg-ink p-5 text-bg shadow-[var(--shadow-border)]">
        <p className="text-xs font-medium uppercase tracking-wider text-bg/60">
          Spendable balance
        </p>
        <p className="mt-1 font-display text-5xl font-semibold tracking-tight tabular-nums">
          {formatUnits(balance)}
        </p>
        <p className="mt-1 text-sm text-bg/70">
          Pillar Units · {availableUnits} available to approve or spend
        </p>
      </div>

      <Card className="stagger-4 screen-enter bg-vault p-5 text-vault-foreground">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-vault-foreground/60">
              Savings vault
            </p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
              {formatUnits(vault)}
            </p>
            <p className="mt-1 text-sm text-vault-foreground/75">
              {vaultGoal} ·{" "}
              {daysRemaining === 0
                ? "Matured"
                : `Matures in ${daysRemaining} days`}
            </p>
          </div>
          <Landmark className="size-5 opacity-70" strokeWidth={1.6} />
        </div>
        <Progress
          value={vaultPct}
          className="mt-4 bg-white/15"
          barClassName="bg-vault-foreground"
        />
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Pending</CardTitle>
            {reservedUnits > 0 ? (
              <p className="mt-0.5 text-xs text-muted">{reservedUnits} Units reserved by purchase requests</p>
            ) : null}
          </div>
          {allPending > 0 ? <Badge tone="danger">{allPending}</Badge> : null}
        </div>
        {addressGate && (
          <ShippingAddressGate
            purchaseName={addressGate.name}
            onCancel={() => setAddressGate(null)}
            onSaved={() => {
              const gate = addressGate;
              setAddressGate(null);
              if (gate) void completeApproval({ id: gate.purchaseId, productId: gate.productId, name: gate.name });
            }}
          />
        )}
        {allPending === 0 ? (
          <p className="py-4 text-center text-sm text-muted">
            No requests right now.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {pendingPurchases.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="size-10 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink">
                    <ShoppingBag className="size-5" strokeWidth={1.6} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted">
                    {p.price} Units · Marketplace
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="success"
                    size="icon-sm"
                    aria-label="Approve"
                    onClick={() => void approveWithFulfillment(p)}
                    disabled={fulfilling}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Deny"
                    onClick={() => {
                      denyPurchase(p.id);
                      toast.message("Purchase denied");
                    }}
                  >
                    <Ban className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            {pendingChores.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                  <Award className="size-5" strokeWidth={1.7} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-muted">
                    +{c.amount} Units · Goal
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="success"
                    size="icon-sm"
                    aria-label="Award"
                    onClick={() => {
                      const err = approveChore(c.id);
                      if (err) toast.error(err);
                      else {
                        toast.success(`+${c.amount} Units awarded`);
                        logUnitsTransaction({
                          data: { kind: "earn", amount: c.amount, note: `Chore approved · ${c.name}` },
                        }).catch(() => {});
                      }
                    }}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Deny"
                    onClick={() => {
                      denyChore(c.id);
                      toast.message("Goal not awarded");
                    }}
                  >
                    <Ban className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            <PendingGiftRows />
            <PendingShopRows />
            <PendingGalleryRows />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button
          className="h-12"
          disabled={!consent}
          onClick={() => setScreen("load")}
        >
          <ArrowDownToLine className="size-4" />
          Load Units
        </Button>
        <Button
          variant="secondary"
          className="h-12"
          disabled={!consent}
          onClick={() => setScreen("award")}
        >
          <Award className="size-4" />
          Award
        </Button>
        <Button
          variant="outline"
          className="h-12"
          onClick={() => setScreen("chores")}
        >
          <ListChecks className="size-4" />
          Chores
        </Button>
        <Button variant="outline" className="h-12" onClick={() => setScreen("vault")}>
          <Landmark className="size-4" />
          Vault
        </Button>
        <Button
          variant="outline"
          className="h-12 col-span-2"
          onClick={() => setScreen("history")}
        >
          <HistoryIcon className="size-4" />
          History
        </Button>
        <Button variant="outline" className="h-12" onClick={() => setScreen("give")}>
          <HeartHandshake className="size-4" />
          Give & contacts
        </Button>
        <Button variant="outline" className="h-12" onClick={() => setScreen("showcase")}>
          <Images className="size-4" />
          Showcase & shop
        </Button>
      </div>
    </div>
  );
}

export function ParentChores() {
  const choreCatalog = useLedger((s) => s.choreCatalog);
  const disabledChoreIds = useLedger((s) => s.disabledChoreIds);
  const addChore = useLedger((s) => s.addChore);
  const updateChore = useLedger((s) => s.updateChore);
  const toggleChore = useLedger((s) => s.toggleChore);
  const removeChore = useLedger((s) => s.removeChore);
  const awardUnits = useLedger((s) => s.awardUnits);
  const setScreen = useLedger((s) => s.setScreen);

  const [category, setCategory] = useState<ChoreCategory | "All">("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState(5);
  const [editCategory, setEditCategory] = useState<ChoreCategory>("Household");
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState(8);
  const [newCategory, setNewCategory] = useState<ChoreCategory>("Household");
  const [showAdd, setShowAdd] = useState(false);

  const enabled = choreCatalog.filter((c) => !disabledChoreIds.includes(c.id));
  const visible =
    category === "All"
      ? choreCatalog
      : choreCatalog.filter((c) => c.category === category);

  return (
    <div className="screen-enter space-y-4">
      <header>
        <p className="text-sm font-medium text-muted">Earning</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Chore catalog
        </h1>
        <p className="mt-1 text-sm text-muted">
          {enabled.length} of {choreCatalog.length} earning opportunities turned
          on. Everything your child completes flows into the Units ledger.
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {(["All", ...CHORE_CATEGORIES] as const).map((c) => (
          <Button
            key={c}
            type="button"
            size="sm"
            variant={category === c ? "default" : "outline"}
            onClick={() => setCategory(c)}
          >
            {c}
          </Button>
        ))}
      </div>

      <Button onClick={() => setShowAdd((v) => !v)}>
        <Plus className="size-4" /> {showAdd ? "Close" : "Add a chore"}
      </Button>

      {showAdd ? (
        <Card className="space-y-3 p-4">
          <CardTitle className="text-base">New earning opportunity</CardTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <FieldLabel>Name</FieldLabel>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Walk the neighbor's dog"
              />
            </div>
            <div>
              <FieldLabel>Units</FieldLabel>
              <Input
                type="number"
                min={1}
                value={newAmount}
                onChange={(e) => setNewAmount(Number(e.target.value))}
              />
            </div>
          </div>
          <div>
            <FieldLabel>Category</FieldLabel>
            <NativeSelect
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as ChoreCategory)}
            >
              {CHORE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button
            onClick={() => {
              const err = addChore({
                name: newName,
                amount: newAmount,
                category: newCategory,
              });
              if (err) toast.error(err);
              else {
                setNewName("");
                setNewAmount(8);
                setShowAdd(false);
                toast.success("Chore added to the catalog");
              }
            }}
          >
            Add chore
          </Button>
        </Card>
      ) : null}

      <div className="space-y-2">
        {visible.map((c) => {
          const disabled = disabledChoreIds.includes(c.id);
          const editing = editingId === c.id;
          return (
            <Card key={c.id} className="p-3">
              {editing ? (
                <div className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <FieldLabel>Name</FieldLabel>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </div>
                    <div>
                      <FieldLabel>Units</FieldLabel>
                      <Input
                        type="number"
                        min={1}
                        value={editAmount}
                        onChange={(e) => setEditAmount(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Category</FieldLabel>
                    <NativeSelect
                      value={editCategory}
                      onChange={(e) =>
                        setEditCategory(e.target.value as ChoreCategory)
                      }
                    >
                      {CHORE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        const err = updateChore(c.id, {
                          name: editName,
                          amount: editAmount,
                          category: editCategory,
                        });
                        if (err) toast.error(err);
                        else {
                          setEditingId(null);
                          toast.success("Chore updated");
                        }
                      }}
                    >
                      <Check className="size-4" /> Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={disabled ? "Turn on" : "Turn off"}
                    onClick={() => toggleChore(c.id)}
                    className={
                      disabled
                        ? "grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted"
                        : "grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"
                    }
                  >
                    <Power className="size-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        disabled
                          ? "truncate text-sm font-medium text-muted line-through"
                          : "truncate text-sm font-medium"
                      }
                    >
                      {c.name}
                    </p>
                    <p className="text-xs text-muted">
                      {c.category} · {c.amount} Units
                      {disabled ? " · off" : ""}
                    </p>
                  </div>
                  {!disabled ? (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => {
                        const err = awardUnits(c.amount, `Chore · ${c.name}`);
                        if (err) toast.error(err);
                        else toast.success(`+${c.amount} Units awarded`);
                      }}
                    >
                      Award
                    </Button>
                  ) : null}
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label="Edit"
                    onClick={() => {
                      setEditingId(c.id);
                      setEditName(c.name);
                      setEditAmount(c.amount);
                      setEditCategory(c.category);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label="Delete"
                    onClick={() => {
                      removeChore(c.id);
                      toast.message("Chore removed");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          No chores in this category.
        </p>
      ) : null}

      <Button variant="outline" className="w-full" onClick={() => setScreen("home")}>
        Back
      </Button>
    </div>
  );
}

const UNIT_PACKS = [
  { id: "starter", name: "Starter Pack", units: 500, price: 5, bonus: 0, blurb: "A first taste of the marketplace" },
  { id: "growth", name: "Growth Pack", units: 1200, price: 10, bonus: 200, tag: "Most popular", blurb: "Room to spend and save" },
  { id: "family", name: "Family Pack", units: 3000, price: 25, bonus: 500, tag: "Best value", blurb: "Stock up for the whole crew" },
];

const MONTHLY_PLAN = { name: "PillarPath Monthly", price: 6.99, unitsPerMonth: 1000 };

export function ParentLoad() {
  const [packId, setPackId] = useState<string | null>("growth");
  const [custom, setCustom] = useState("20");
  const [ack, setAck] = useState(false);
  const loadUnits = useLedger((s) => s.loadUnits);

  const pack = UNIT_PACKS.find((x) => x.id === packId) ?? null;
  const amount = pack ? pack.units : Math.max(0, Math.floor(Number(custom) || 0));

  return (
    <div className="screen-enter space-y-4">
      <header>
        <p className="text-sm font-medium text-muted">Load</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Add Units
        </h1>
        <p className="mt-1 text-sm text-muted">
          Affordable packs for spending in the Pillarpath Marketplace or locking
          in the vault. Kids earn Units first through chores — packs are a
          top-up, never a replacement.
        </p>
      </header>

      <div className="rounded-lg bg-warn-soft p-4 text-sm text-warn">
        Once loaded, Units are not refundable as cash. Cash is only available
        to the child when a vault reaches maturity.
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Unit packs</p>
        <div className="grid grid-cols-3 gap-2">
          {UNIT_PACKS.map((p) => {
            const selected = p.id === packId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPackId(p.id)}
                className={`relative rounded-lg border p-3 text-left transition ${
                  selected
                    ? "border-accent bg-accent/10"
                    : "border-border bg-surface"
                }`}
              >
                {p.tag && (
                  <span className="absolute -top-2 left-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                    {p.tag}
                  </span>
                )}
                <p className="text-xs font-medium text-muted">{p.name}</p>
                <p className="font-display text-xl font-semibold">
                  {p.units.toLocaleString()}
                </p>
                <p className="text-sm text-muted">Units</p>
                <p className="mt-1 text-sm font-semibold">${p.price.toFixed(2)}</p>
                {p.bonus > 0 && (
                  <p className="text-[11px] text-accent">+{p.bonus} bonus Units</p>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted">
          Beta preview — real checkout activates at launch.
        </p>
      </div>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{MONTHLY_PLAN.name}</p>
            <p className="text-xs text-muted">
              {MONTHLY_PLAN.unitsPerMonth.toLocaleString()} Units every month —
              ${MONTHLY_PLAN.price.toFixed(2)}/mo, pause anytime.
            </p>
          </div>
          <Badge>Coming soon</Badge>
        </div>
      </Card>

      <Card className="space-y-3">
        <FieldLabel htmlFor="load-amount">Or load a custom amount</FieldLabel>
        <Input
          id="load-amount"
          type="number"
          min={1}
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            setPackId(null);
          }}
        />
        <div className="flex gap-2">
          {[10, 20, 50].map((n) => (
            <Button
              key={n}
              type="button"
              variant={!pack && Number(custom) === n ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => {
                setCustom(String(n));
                setPackId(null);
              }}
            >
              {n}
            </Button>
          ))}
        </div>
        <label className="flex items-start gap-3 rounded-md bg-surface-2 p-3 text-sm">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-0.5 size-4 accent-accent"
          />
          <span>
            I understand these Units cannot be withdrawn as cash until a vault
            matures.
          </span>
        </label>
        <Button
          className="w-full"
          disabled={!ack || amount < 1}
          onClick={() => {
            const err = loadUnits(amount);
            if (err) toast.error(err);
            else toast.success(`${amount.toLocaleString()} Units loaded — non-refundable`);
          }}
        >
          {amount >= 1
            ? `Confirm and load ${amount.toLocaleString()} Units`
            : "Confirm and load"}
        </Button>
      </Card>
      <BackButton />
    </div>
  );
}


export function ParentAward() {
  const [reason, setReason] = useState<string>(AWARD_REASONS[0]);
  const [amount, setAmount] = useState(5);
  const awardUnits = useLedger((s) => s.awardUnits);

  return (
    <div className="screen-enter space-y-4">
      <header>
        <p className="text-sm font-medium text-muted">Award</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Reward a goal
        </h1>
        <p className="mt-1 text-sm text-muted">
          Direct awards skip the child's request queue.
        </p>
      </header>
      <Card className="space-y-3">
        <FieldLabel htmlFor="award-reason">Reason</FieldLabel>
        <NativeSelect
          id="award-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        >
          {AWARD_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </NativeSelect>
        <FieldLabel htmlFor="award-amount">Units</FieldLabel>
        <Input
          id="award-amount"
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
        <Button
          className="w-full"
          onClick={() => {
            const err = awardUnits(amount, reason);
            if (err) toast.error(err);
            else toast.success(`+${amount} Units awarded`);
          }}
        >
          Award Units
        </Button>
      </Card>
      <BackButton />
    </div>
  );
}

/* ---------------- Vault CDs (education savings) ---------------- */

function CdStatusBadge({ cd }: { cd: VaultCd }) {
  if (cd.status === "matured") return <Badge tone="accent">Matured</Badge>;
  if (cd.status === "cashed-out") return <Badge tone="muted">Cashed out</Badge>;
  if (cd.status === "withdrawn")
    return <Badge tone="muted">Withdrawn early</Badge>;
  return <Badge tone="warn">Growing · {Math.round(CD_APY * 100)}% APY</Badge>;
}

function CdOpenForm() {
  const balance = useLedger((s) => s.balance);
  const childAge = useLedger((s) => s.childAge);
  const openCd = useLedger((s) => s.openCd);
  const [goal, setGoal] = useState("College Fund");
  const [amount, setAmount] = useState(100);
  const [term, setTerm] = useState<CdTerm>("5yr");
  const [confirmed, setConfirmed] = useState(false);

  const years = cdTermYears(term, childAge);
  const maturityLabel = new Date(
    Date.now() + years * 365 * 86_400_000,
  ).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const units = Math.max(0, Math.floor(amount) || 0);
  const valid = units >= 1 && units <= balance;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <PiggyBank className="size-5 text-accent" />
        <CardTitle className="text-base">Open a Vault CD</CardTitle>
      </div>
      <CardHint>
        Lock Units until maturity, like a certificate of deposit. They grow at{" "}
        {Math.round(CD_APY * 100)}% APY in bonus Units. Cash-out is only
        available at maturity, and only for education expenses — with no fees,
        ever. {UNITS_PER_DOLLAR} Units = $1.00.
      </CardHint>
      <div>
        <FieldLabel htmlFor="cd-goal">Education goal</FieldLabel>
        <Input
          id="cd-goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="College Fund"
        />
      </div>
      <div>
        <FieldLabel htmlFor="cd-amount">
          Units to lock (family balance: {formatUnits(balance)})
        </FieldLabel>
        <Input
          id="cd-amount"
          type="number"
          min={1}
          max={balance}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
        <p className="mt-1 text-sm text-muted">
          ≈ {formatDollars(units)} cash value at {UNITS_PER_DOLLAR} Units/$1
        </p>
      </div>
      <div>
        <FieldLabel htmlFor="cd-term">Term</FieldLabel>
        <NativeSelect
          id="cd-term"
          value={term}
          onChange={(e) => setTerm(e.target.value as CdTerm)}
        >
          {CD_TERMS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.value === "age18"
                ? `Until age 18 (≈${cdTermYears("age18", childAge)} yrs)`
                : t.label}
            </option>
          ))}
        </NativeSelect>
        <p className="mt-1 text-sm text-muted">Matures {maturityLabel}</p>
      </div>
      <label className="flex items-start gap-3 rounded-md bg-surface-2 p-3 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 size-4 accent-accent"
        />
        <span>
          I understand these Units are locked until {maturityLabel}. I may
          withdraw early, but I will forfeit 100% of the bonus Units — the
          principal returns to the family balance as Units, never as cash.
        </span>
      </label>
      <Button
        className="w-full"
        disabled={!confirmed || !valid}
        onClick={() => {
          const err = openCd({ goal, principal: units, term });
          if (err) toast.error(err);
          else {
            toast.success(`Vault CD opened · ${goal.trim() || "College Fund"}`);
            setConfirmed(false);
          }
        }}
      >
        <Lock className="size-4" />
        Open Vault CD
      </Button>
    </div>
  );
}

function CdCashOutForm({
  cdId,
  maxUnits,
  onDone,
}: {
  cdId: string;
  maxUnits: number;
  onDone: () => void;
}) {
  const requestCdCashOut = useLedger((s) => s.requestCdCashOut);
  const [recipient, setRecipient] = useState<PayoutRecipient>("parent-bank");
  const [amount, setAmount] = useState(maxUnits);
  const [attested, setAttested] = useState(false);

  const units = Math.max(0, Math.floor(amount) || 0);
  const valid = units >= 1 && units <= maxUnits;

  return (
    <div className="space-y-3 rounded-md bg-surface-2 p-3">
      <div>
        <FieldLabel htmlFor={`payout-recipient-${cdId}`}>
          Send payout to
        </FieldLabel>
        <NativeSelect
          id={`payout-recipient-${cdId}`}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value as PayoutRecipient)}
        >
          <option value="parent-bank">Parent bank account on file</option>
          <option value="school">Educational institution</option>
        </NativeSelect>
      </div>
      <div>
        <FieldLabel htmlFor={`payout-amount-${cdId}`}>
          Units to redeem (max {formatUnits(maxUnits)})
        </FieldLabel>
        <Input
          id={`payout-amount-${cdId}`}
          type="number"
          min={1}
          max={maxUnits}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
        <p className="mt-1 text-sm text-muted">
          ≈ {formatDollars(units)} · no fees
        </p>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={attested}
          onChange={(e) => setAttested(e.target.checked)}
          className="mt-0.5 size-4 accent-accent"
        />
        <span>
          I attest these funds will be used only for qualified education
          expenses (tuition, books, school fees) for my child.
        </span>
      </label>
      <p className="text-xs text-muted">
        Payouts are processed by our banking partner. Your request is queued —
        no money moves until the banking partner completes review.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!attested || !valid}
          onClick={() => {
            const err = requestCdCashOut(cdId, {
              recipient,
              units,
              attested,
            });
            if (err) toast.error(err);
            else {
              toast.success("Cash-out requested — queued with banking partner");
              onDone();
            }
          }}
        >
          Request payout
        </Button>
      </div>
    </div>
  );
}

function CdCard({ cd }: { cd: VaultCd }) {
  const daysRemaining = useLedger((s) => s.cdDaysRemaining(cd.id));
  const demoDaysAdvanced = useLedger((s) => s.demoDaysAdvanced);
  const withdrawCdEarly = useLedger((s) => s.withdrawCdEarly);
  const [showCashOut, setShowCashOut] = useState(false);
  const [confirmingEarly, setConfirmingEarly] = useState(false);
  const [earlyAck, setEarlyAck] = useState(false);

  const total = cd.principal + cd.bonusAccrued;
  const available = total - cd.unitsCashedOut;
  const openedMs = new Date(cd.openedAt).getTime();
  const maturityMs = new Date(cd.maturityAt).getTime();
  const effectiveNow = Date.now() + demoDaysAdvanced * 86_400_000;
  const progress = Math.min(
    100,
    Math.max(
      0,
      ((effectiveNow - openedMs) / Math.max(1, maturityMs - openedMs)) * 100,
    ),
  );
  const maturityLabel = new Date(cd.maturityAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GraduationCap className="size-5 text-accent" />
          <CardTitle className="text-base">{cd.goal}</CardTitle>
        </div>
        <CdStatusBadge cd={cd} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-surface-2 p-2">
          <p className="text-xs text-muted">Principal</p>
          <p className="font-display text-lg font-semibold tabular-nums">
            {formatUnits(cd.principal)}
          </p>
        </div>
        <div className="rounded-md bg-surface-2 p-2">
          <p className="text-xs text-muted">Bonus earned</p>
          <p className="font-display text-lg font-semibold tabular-nums text-accent">
            +{formatUnits(cd.bonusAccrued)}
          </p>
        </div>
        <div className="rounded-md bg-surface-2 p-2">
          <p className="text-xs text-muted">≈ Cash value</p>
          <p className="font-display text-lg font-semibold tabular-nums">
            {formatDollars(available)}
          </p>
        </div>
      </div>

      {cd.status === "active" ? (
        <>
          <Progress value={progress} />
          <p className="text-sm text-muted">
            {daysRemaining} days to maturity · {maturityLabel}
          </p>
          {!confirmingEarly ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setConfirmingEarly(true);
                setEarlyAck(false);
              }}
            >
              Withdraw early
            </Button>
          ) : (
            <div className="space-y-3 rounded-md bg-surface-2 p-3">
              <p className="text-sm font-semibold">
                Withdraw &ldquo;{cd.goal}&rdquo; early?
              </p>
              <p className="text-sm text-muted">
                You will forfeit{" "}
                <strong className="text-ink">
                  {formatUnits(cd.bonusAccrued)} bonus Units
                </strong>
                . The{" "}
                <strong className="text-ink">
                  {formatUnits(cd.principal)} Unit principal
                </strong>{" "}
                returns to the family balance as Units — never as cash.
              </p>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={earlyAck}
                  onChange={(e) => setEarlyAck(e.target.checked)}
                  className="mt-0.5 size-4 accent-accent"
                />
                <span>
                  I understand I lose all {formatUnits(cd.bonusAccrued)} bonus
                  Units and receive no cash.
                </span>
              </label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConfirmingEarly(false)}
                >
                  Keep locked
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  disabled={!earlyAck}
                  onClick={() => {
                    const err = withdrawCdEarly(cd.id);
                    if (err) toast.error(err);
                    else {
                      toast.success(
                        `Withdrawn early · ${formatUnits(cd.bonusAccrued)} bonus Units forfeited`,
                      );
                      setConfirmingEarly(false);
                    }
                  }}
                >
                  Confirm withdrawal
                </Button>
              </div>
            </div>
          )}
        </>
      ) : null}

      {cd.status === "matured" && available > 0 ? (
        <>
          <p className="text-sm font-medium text-accent">
            Matured — cash-out is available for education expenses. No fees.
          </p>
          {!showCashOut ? (
            <Button className="w-full" onClick={() => setShowCashOut(true)}>
              Request cash-out
            </Button>
          ) : (
            <CdCashOutForm
              cdId={cd.id}
              maxUnits={available}
              onDone={() => setShowCashOut(false)}
            />
          )}
        </>
      ) : null}

      {cd.status === "withdrawn" ? (
        <p className="text-sm text-muted">
          Withdrawn early — the principal returned to the family balance as
          Units. All bonus Units were forfeited. No cash was paid out.
        </p>
      ) : null}
      {cd.status === "cashed-out" ? (
        <p className="text-sm text-muted">
          Fully redeemed for education expenses. Thank you for saving for the
          future.
        </p>
      ) : null}
    </Card>
  );
}

function CdPayoutList() {
  const cdPayouts = useLedger((s) => s.cdPayouts);
  if (cdPayouts.length === 0) return null;
  return (
    <Card className="space-y-3">
      <CardTitle className="text-base">Payout requests</CardTitle>
      <CardHint>
        Pending payouts are processed by our banking partner — no money moves
        until their review completes.
      </CardHint>
      <div className="space-y-2">
        {cdPayouts.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-md bg-surface-2 p-3"
          >
            <div>
              <p className="text-sm font-semibold">
                {formatUnits(p.units)} Units ≈ {formatDollars(p.units)}
              </p>
              <p className="text-xs text-muted">
                {p.goal} · {payoutRecipientLabel(p.recipient)} ·{" "}
                {formatWhen(p.requestedAt)}
              </p>
            </div>
            <Badge tone="warn">Pending</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ParentVault() {
  const vault = useLedger((s) => s.vault);
  const vaultTarget = useLedger((s) => s.vaultTarget);
  const vaultGoal = useLedger((s) => s.vaultGoal);
  const matchRate = useLedger((s) => s.matchRate);
  const daysRemaining = useLedger((s) => s.daysRemaining());
  const setMatchRate = useLedger((s) => s.setMatchRate);
  const advanceVaultDays = useLedger((s) => s.advanceVaultDays);
  const releaseVault = useLedger((s) => s.releaseVault);
  const setScreen = useLedger((s) => s.setScreen);
  const vaultCds = useLedger((s) => s.vaultCds);
  const refreshCds = useLedger((s) => s.refreshCds);

  useEffect(() => {
    refreshCds();
  }, [refreshCds]);

  return (
    <div className="screen-enter space-y-4">
      <header>
        <p className="text-sm font-medium text-muted">Vault</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Long-term savings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Locked Units become cash only at maturity.
        </p>
      </header>

      <Card className="bg-vault p-5 text-vault-foreground">
        <p className="text-xs font-medium uppercase tracking-wider text-vault-foreground/60">
          Currently locked
        </p>
        <p className="mt-1 font-display text-4xl font-semibold tabular-nums">
          {formatUnits(vault)}
        </p>
        <p className="mt-1 text-sm text-vault-foreground/75">
          Goal: {vaultGoal}
        </p>
        <Progress
          value={(vault / vaultTarget) * 100}
          className="mt-4 bg-white/15"
          barClassName="bg-vault-foreground"
        />
        <p className="mt-3 text-sm text-vault-foreground/80">
          {daysRemaining === 0
            ? "Ready to release as cash for Alex."
            : `${daysRemaining} days until cash can be released.`}
        </p>
        {daysRemaining > 0 ? (
          <p className="mt-1 text-xs text-vault-foreground/60">
            Unlocks on{" "}
            {new Date(Date.now() + daysRemaining * 86_400_000).toLocaleDateString(
              undefined,
              { year: "numeric", month: "long", day: "numeric" },
            )}{" "}
            · locked until the goal date
          </p>
        ) : null}
      </Card>

      <div className="space-y-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Vault CDs</h2>
          <p className="text-sm text-muted">
            CD-style education savings · {Math.round(CD_APY * 100)}% APY ·
            cash-out only at maturity, for education
          </p>
        </div>
        <Card>
          <CdOpenForm />
        </Card>
        {vaultCds.map((cd) => (
          <CdCard key={cd.id} cd={cd} />
        ))}
        <CdPayoutList />
      </div>

      <Card className="space-y-3">
        <CardTitle className="text-base">Parent matching</CardTitle>
        <CardHint>
          Optionally match what Alex locks. Matched Units go straight into the
          vault.
        </CardHint>
        <NativeSelect
          value={String(matchRate)}
          onChange={(e) => {
            const v = Number(e.target.value) as MatchRate;
            toast.success(setMatchRate(v));
          }}
        >
          <option value="0">No matching</option>
          <option value="0.5">Match 50%</option>
          <option value="1">Match 100%</option>
        </NativeSelect>
      </Card>

      <Card className="space-y-3">
        <CardTitle className="text-base">Demo clock</CardTitle>
        <CardHint>
          Fast-forward maturity so you can try a cash release without waiting
          28 days.
        </CardHint>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => toast.message(advanceVaultDays(7))}
          >
            <FastForward className="size-4" />
            +7 days
          </Button>
          <Button
            variant="vault"
            className="flex-1"
            disabled={daysRemaining > 0 || vault <= 0}
            onClick={() => {
              const err = releaseVault();
              if (err) toast.error(err);
              else {
                toast.success("Cash payout marked for Alex");
                setScreen("home");
              }
            }}
          >
            Release cash
          </Button>
        </div>
      </Card>
      <BackButton />
    </div>
  );
}

export function ParentHistory() {
  const history = useLedger((s) => s.history);
  const resetDemo = useLedger((s) => s.resetDemo);
  const [filter, setFilter] = useState<
    "all" | "chores" | "marketplace" | "vault" | "awards"
  >("all");

  const categorized = history.map((e) => {
    const note = e.note.toLowerCase();
    const category =
      note.includes("chore")
        ? "chores"
        : note.includes("marketplace")
          ? "marketplace"
          : note.includes("vault") || e.kind === "transfer" || e.kind === "cashout"
            ? "vault"
            : note.includes("award") || note.includes("loaded")
              ? "awards"
              : "other";
    return { event: e, category };
  });
  const visible =
    filter === "all"
      ? categorized
      : categorized.filter((c) => c.category === filter);

  const filters = [
    ["all", "All"],
    ["chores", "Chores"],
    ["marketplace", "Marketplace"],
    ["vault", "Vault"],
    ["awards", "Awards"],
  ] as const;

  return (
    <div className="screen-enter space-y-4">
      <header>
        <p className="text-sm font-medium text-muted">Ledger</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          History
        </h1>
        <p className="mt-1 text-sm text-muted">
          Every load, award, lock, and spend — kept on this device.
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {filters.map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={filter === id ? "default" : "outline"}
            onClick={() => setFilter(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      <Card className="ledger-ruled p-0">
        {visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">No events yet.</p>
        ) : (
          <ul>
            {visible.map(({ event: e }) => {
              const signed =
                e.kind === "debit" || e.kind === "transfer" || e.kind === "cashout"
                  ? "out"
                  : e.kind === "event"
                    ? "none"
                    : "in";
              return (
                <li
                  key={e.id}
                  className="flex items-start justify-between gap-3 px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{e.note}</div>
                    <div className="text-xs text-muted">{formatWhen(e.at)}</div>
                  </div>
                  {signed !== "none" ? (
                    <span
                      className={`shrink-0 font-mono text-sm tabular-nums ${
                        signed === "in" ? "text-success" : "text-ink"
                      }`}
                    >
                      {signed === "in" ? "+" : "−"}
                      {e.amount}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          resetDemo();
          toast.message("Demo reset");
        }}
      >
        <RotateCcw className="size-4" />
        Reset demo
      </Button>
      <BackButton />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Classroom — join via code, message with teachers                     */
/* ------------------------------------------------------------------ */

export function ParentClassroom() {
  const [connections, setConnections] = useState<ParentClassroomConnection[]>([]);
  const [threads, setThreads] = useState<ParentThread[]>([]);
  const [code, setCode] = useState("");
  const [childName, setChildName] = useState("");
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, t] = await Promise.all([
        listMyClassroomConnections(),
        listParentThreads(),
      ]);
      setConnections(c.connections);
      setThreads(t.threads);
    } catch {
      /* not connected yet or offline — show join card */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function join() {
    if (!code.trim() || !childName.trim()) {
      toast.error("Enter the join code and your child's name.");
      return;
    }
    setBusy(true);
    try {
      const r = await joinClassroomByCode({ data: { code: code.trim(), childName: childName.trim() } });
      toast.success(
        r.status === "pending"
          ? `Request sent to ${r.classroomName} — the teacher will approve it.`
          : `Connected to ${r.classroomName}.`,
      );
      setCode("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not join the classroom.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(threadId: string) {
    const text = reply.trim();
    if (!text) return;
    setBusy(true);
    try {
      await sendParentThreadMessage({ data: { threadId, body: text } });
      setReply("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the message.");
    } finally {
      setBusy(false);
    }
  }

  const openThread = threads.find((t) => t.id === openThreadId) ?? null;
  const unreadCount = threads.length;

  return (
    <div className="screen-enter space-y-4">
      <header>
        <p className="text-sm font-medium text-muted">School</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Classroom
        </h1>
        <p className="mt-1 text-sm text-muted">
          Connect to your child's classroom and message their teacher directly.
        </p>
      </header>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted">Loading…</p>
      ) : (
        <>
          <Card className="space-y-3 p-4">
            <CardTitle className="text-base">Join a classroom</CardTitle>
            <p className="text-xs text-muted">
              Ask your child's teacher for the classroom join code.
            </p>
            <div className="grid gap-2">
              <div>
                <FieldLabel>Join code</FieldLabel>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABC123"
                  className="font-mono uppercase"
                />
              </div>
              <div>
                <FieldLabel>Child's name</FieldLabel>
                <Input
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="Your child's name"
                />
              </div>
            </div>
            <Button className="w-full" disabled={busy} onClick={join}>
              {busy ? "Sending…" : "Request to join"}
            </Button>
          </Card>

          {connections.length > 0 && (
            <Card className="p-4">
              <CardTitle className="text-base">My classrooms</CardTitle>
              <div className="mt-3 divide-y divide-white/10">
                {connections.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold">{c.classroomName}</p>
                      <p className="text-xs text-muted">
                        {c.childName} · {c.teacherName}
                      </p>
                    </div>
                    <Badge
                      tone={c.status === "approved" ? "accent" : c.status === "pending" ? "warn" : "muted"}
                    >
                      {c.status === "approved" ? "Connected" : c.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Teacher messages</CardTitle>
              {unreadCount > 0 && (
                <Badge tone="accent">{unreadCount}</Badge>
              )}
            </div>
            {threads.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                No conversations yet. Once your child's teacher starts one, it will appear here.
              </p>
            ) : openThread ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setOpenThreadId(null)}
                  className="mb-2 text-xs font-medium text-accent"
                >
                  ← All conversations
                </button>
                <p className="text-sm font-semibold">{openThread.teacherName}</p>
                <p className="text-xs text-muted">
                  {openThread.classroomName} · {openThread.childName}
                </p>
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-lg bg-surface-2/50 p-3">
                  {openThread.messages.map((m) => {
                    const mine = m.sender === "parent";
                    return (
                      <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                            mine ? "bg-accent text-accent-foreground" : "bg-surface text-ink",
                          )}
                        >
                          {m.body}
                        </div>
                      </div>
                    );
                  })}
                  {openThread.messages.length === 0 && (
                    <p className="text-center text-xs text-muted">Say hello to start the conversation.</p>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a message…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void sendReply(openThread.id);
                    }}
                  />
                  <Button disabled={busy || !reply.trim()} onClick={() => void sendReply(openThread.id)}>
                    Send
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 divide-y divide-white/10">
                {threads.map((t) => {
                  const last = t.messages[t.messages.length - 1];
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setOpenThreadId(t.id)}
                      className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{t.teacherName}</p>
                        <p className="truncate text-xs text-muted">
                          {last ? last.body : "New conversation"} · {t.classroomName}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted">→</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
      <BackButton />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shipping address gate + order history                                */
/* ------------------------------------------------------------------ */

function ShippingAddressGate({
  purchaseName,
  onCancel,
  onSaved,
}: {
  purchaseName: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [recipientName, setRecipientName] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await saveShippingAddress({
        data: { recipientName, street, city, state, zip, phone },
      });
      toast.success("Address saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the address.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 border-accent/40 p-4">
      <CardTitle className="text-base">Where should it ship?</CardTitle>
      <p className="text-xs text-muted">
        Approving “{purchaseName}” places a real order. Enter the delivery
        address once — we’ll reuse it next time.
      </p>
      <div className="grid gap-2">
        <div>
          <FieldLabel>Recipient name</FieldLabel>
          <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Jane Appleseed" />
        </div>
        <div>
          <FieldLabel>Street address</FieldLabel>
          <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="123 Maple St, Apt 4" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1">
            <FieldLabel>City</FieldLabel>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Springfield" />
          </div>
          <div>
            <FieldLabel>State</FieldLabel>
            <Input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} placeholder="IL" maxLength={2} />
          </div>
          <div>
            <FieldLabel>ZIP</FieldLabel>
            <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="62701" inputMode="numeric" />
          </div>
        </div>
        <div>
          <FieldLabel>Phone (for delivery updates)</FieldLabel>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(optional)" inputMode="tel" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save & approve"}
        </Button>
      </div>
    </Card>
  );
}

export function ParentOrders() {
  const [orders, setOrders] = useState<FulfillmentOrder[] | null>(null);

  useEffect(() => {
    listMyOrders()
      .then((r) => setOrders(r.orders))
      .catch(() => setOrders([]));
  }, []);

  const statusLabel = (o: FulfillmentOrder) => {
    if (o.trackingNumber) return "Shipped";
    switch (o.fulfillmentStatus) {
      case "submitted": return "With the supplier";
      case "failed": return "Needs attention";
      case "queued": return "Preparing";
      default: return "Order placed";
    }
  };

  return (
    <div className="screen-enter space-y-4">
      <header>
        <p className="text-sm font-medium text-muted">Store</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Orders</h1>
        <p className="mt-1 text-sm text-muted">
          Everything approved from the marketplace, on its way to your door.
        </p>
      </header>
      {orders === null ? (
        <p className="py-6 text-center text-sm text-muted">Loading orders…</p>
      ) : orders.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-display text-lg font-semibold">No orders yet</p>
          <p className="mt-1 text-sm text-muted">
            Approved marketplace purchases will show up here with tracking.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Order #{o.id}</p>
                  <p className="text-xs text-muted">
                    {o.items.map((i) => `${i.quantity}× ${i.productName}`).join(", ")}
                  </p>
                </div>
                <Badge tone={o.trackingNumber ? "accent" : o.fulfillmentStatus === "failed" ? "danger" : "muted"}>
                  {statusLabel(o)}
                </Badge>
              </div>
              {o.items[0]?.imageUrl && (
                <img src={o.items[0].imageUrl} alt="" className="mt-3 h-16 w-16 rounded-lg object-cover" />
              )}
              {o.trackingNumber && (
                <p className="mt-2 font-mono text-xs text-muted">
                  Tracking: {o.trackingNumber}
                </p>
              )}
              <p className="mt-1 text-xs text-muted">
                ${(o.totalCents / 100).toFixed(2)} · {new Date(o.createdAt).toLocaleDateString()}
              </p>
            </Card>
          ))}
        </div>
      )}
      <BackButton />
    </div>
  );
}
