import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CHORE_SEED, type ChoreCategory, type ChoreTemplate } from "@/lib/chores";
import { uid } from "@/lib/utils";

/** A real, published storefront product on the kid's marketplace shelf. */
export type MarketplaceSelection = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  imageUrl: string | null;
};

export type Role = "parent" | "child";

export type Screen =
  | "home"
  | "load"
  | "award"
  | "vault"
  | "history"
  | "market"
  | "confirm"
  | "studio"
  | "learn"
  | "classroom"
  | "orders"
  | "chores"
  | "goals"
  | "gallery"
  | "give"
  | "showcase";

export type HistoryKind =
  | "credit"
  | "debit"
  | "transfer"
  | "event"
  | "cashout";

export type HistoryEvent = {
  id: string;
  kind: HistoryKind;
  amount: number;
  note: string;
  at: string;
};

export type PendingPurchase = {
  id: string;
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
};

export type PendingChore = {
  id: string;
  choreId: string;
  name: string;
  amount: number;
};

export type SavedDrawing = {
  id: string;
  dataUrl: string;
  at: string;
  missionId?: string;
  title?: string;
};

export type MatchRate = 0 | 0.5 | 1;

/* ---------------- Vault CDs (education savings) ---------------- */
/** Units per US dollar for matured Vault CD redemptions. */
export const UNITS_PER_DOLLAR = 100;
/** Simple annual interest on locked CD principal, credited monthly in Units. */
export const CD_APY = 0.05;

export type CdTerm = "1yr" | "3yr" | "5yr" | "age18";

export const CD_TERMS: { value: CdTerm; label: string; years: number }[] = [
  { value: "1yr", label: "1 year", years: 1 },
  { value: "3yr", label: "3 years", years: 3 },
  { value: "5yr", label: "5 years", years: 5 },
  { value: "age18", label: "Until age 18", years: 0 },
];

export function cdTermYears(term: CdTerm, childAge: number): number {
  if (term === "age18") return Math.max(1, 18 - childAge);
  return CD_TERMS.find((t) => t.value === term)?.years ?? 1;
}

export type CdStatus = "active" | "matured" | "cashed-out" | "withdrawn";
export type PayoutRecipient = "parent-bank" | "school";
export type PayoutStatus = "pending";

export type VaultCd = {
  id: string;
  goal: string;
  principal: number;
  openedAt: string;
  maturityAt: string;
  term: CdTerm;
  bonusAccrued: number;
  lastBonusAt: string;
  status: CdStatus;
  unitsCashedOut: number;
  /** Where the principal came from, e.g. "Family balance". */
  source: string;
};

export type CdPayout = {
  id: string;
  cdId: string;
  goal: string;
  units: number;
  dollars: number;
  recipient: PayoutRecipient;
  status: PayoutStatus;
  requestedAt: string;
};

export function cdDollars(units: number): number {
  return units / UNITS_PER_DOLLAR;
}

export function formatDollars(units: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cdDollars(units));
}

export function payoutRecipientLabel(r: PayoutRecipient): string {
  return r === "school"
    ? "Educational institution"
    : "Parent bank account on file";
}

const DAY_MS = 86_400_000;
const MATURITY_DAYS = 28;
const VAULT_TARGET = 70;
const STORAGE_KEY = "kiddo-ledger-v2";

function nowIso() {
  return new Date().toISOString();
}

function openingState() {
  const opened = Date.now() - 10 * DAY_MS;
  return {
    consent: false,
    frozen: false,
    childName: "Alex",
    childAge: 10,
    balance: 42,
    vault: 25,
    vaultTarget: VAULT_TARGET,
    vaultGoal: "College Fund",
    vaultOpenedAt: opened,
    vaultCds: [] as VaultCd[],
    cdPayouts: [] as CdPayout[],
    demoDaysAdvanced: 0,
    matchRate: 0.5 as MatchRate,
    pendingPurchases: [] as PendingPurchase[],
    pendingChores: [] as PendingChore[],
    completedChoreIds: [] as string[],
    history: [
      {
        id: uid("evt"),
        kind: "credit" as const,
        amount: 42,
        note: "Opening spendable balance",
        at: nowIso(),
      },
      {
        id: uid("evt"),
        kind: "transfer" as const,
        amount: 25,
        note: "Opening vault · College Fund",
        at: new Date(opened).toISOString(),
      },
    ] as HistoryEvent[],
    drawings: [] as SavedDrawing[],
    completedMissionIds: [] as string[],
    studioXp: 0,
    studioStreak: 1,
    studioProUnlocked: false,
    lastStudioDay: "",
    gameWins: 0,
    studioTeam: null as string | null,
    ownedPacks: [] as string[],
    choreCatalog: CHORE_SEED.map((c) => ({ ...c })),
    disabledChoreIds: [] as string[],
  };
}

type LedgerData = ReturnType<typeof openingState>;

type LedgerState = LedgerData & {
  role: Role;
  screen: Screen;
  selectedProduct: MarketplaceSelection | null;
  setRole: (role: Role) => void;
  setScreen: (screen: Screen) => void;
  selectProduct: (product: MarketplaceSelection) => void;
  verifyConsent: () => string | null;
  toggleFreeze: () => string;
  loadUnits: (amount: number) => string | null;
  awardUnits: (amount: number, reason: string) => string | null;
  debitUnits: (amount: number, note: string) => string | null;
  creditUnits: (amount: number, note: string) => string | null;
  requestPurchase: () => string | null;
  approvePurchase: (id: string) => string | null;
  denyPurchase: (id: string) => string | null;
  completeChore: (choreId: string) => string | null;
  approveChore: (id: string) => string | null;
  denyChore: (id: string) => string | null;
  addChore: (input: {
    name: string;
    amount: number;
    category: ChoreCategory;
  }) => string | null;
  updateChore: (
    id: string,
    input: { name: string; amount: number; category: ChoreCategory },
  ) => string | null;
  toggleChore: (id: string) => void;
  removeChore: (id: string) => void;
  lockUnits: (amount: number) => string | null;
  setMatchRate: (rate: MatchRate) => string;
  advanceVaultDays: (days: number) => string;
  releaseVault: () => string | null;
  openCd: (input: { goal: string; principal: number; term: CdTerm }) => string | null;
  /** Accrue monthly CD bonus and flip matured CDs. Safe to call on every vault render. */
  refreshCds: () => void;
  cdDaysRemaining: (id: string) => number;
  requestCdCashOut: (
    cdId: string,
    input: { recipient: PayoutRecipient; units: number; attested: boolean },
  ) => string | null;
  /**
   * Early withdrawal: allowed, but the parent forfeits 100% of accrued
   * bonus Units. Principal returns to the family Units balance as Units —
   * never as cash. Cash-out is only available at maturity.
   */
  withdrawCdEarly: (cdId: string) => string | null;
  saveDrawing: (dataUrl: string, meta?: { missionId?: string; title?: string }) => string;
  clearDrawings: () => void;
  setChildAge: (age: number) => void;
  setStudioProUnlocked: (on: boolean) => void;
  completeStudioMission: (missionId: string, xp: number) => string | null;
  awardStudioWin: (xp: number, units: number, note: string) => string | null;
  buyStudioPack: (packId: string, cost: number) => string | null;
  joinStudioTeam: (team: string) => void;
  touchStudioStreak: () => void;
  resetDemo: () => void;
  daysRemaining: () => number;
  pendingCount: () => number;
};

function record(
  history: HistoryEvent[],
  kind: HistoryKind,
  amount: number,
  note: string,
): HistoryEvent[] {
  return [
    { id: uid("evt"), kind, amount, note, at: nowIso() },
    ...history,
  ].slice(0, 40);
}

export const useLedger = create<LedgerState>()(
  persist(
    (set, get) => ({
      ...openingState(),
      role: "parent",
      screen: "home",
      selectedProduct: null,
      setRole: (role) => {
        const { consent, frozen } = get();
        if (role === "child" && !consent) {
          set({ role: "parent", screen: "home" });
          return;
        }
        set({
          role,
          screen: "home",
          selectedProduct: null,
        });
        if (role === "child" && frozen) {
          /* still allow viewing */
        }
      },
      setScreen: (screen) => set({ screen }),
      selectProduct: (product) =>
        set({ selectedProduct: product, screen: "confirm" }),
      verifyConsent: () => {
        if (get().consent) return "Consent is already verified";
        set((s) => ({
          consent: true,
          history: record(
            s.history,
            "event",
            0,
            "Verifiable parental consent completed",
          ),
        }));
        return null;
      },
      toggleFreeze: () => {
        const next = !get().frozen;
        set((s) => ({
          frozen: next,
          history: record(
            s.history,
            "event",
            0,
            next ? "Child access frozen" : "Child access restored",
          ),
        }));
        return next ? "Alex is frozen" : "Alex is unfrozen";
      },
      loadUnits: (amount) => {
        if (!get().consent) return "Verify parental consent first";
        const amt = Math.max(1, Math.floor(amount));
        set((s) => ({
          balance: s.balance + amt,
          history: record(
            s.history,
            "credit",
            amt,
            "Parent loaded Units (non-refundable)",
          ),
          screen: "home",
        }));
        return null;
      },
      awardUnits: (amount, reason) => {
        if (!get().consent) return "Verify parental consent first";
        const amt = Math.max(1, Math.floor(amount));
        set((s) => ({
          balance: s.balance + amt,
          history: record(s.history, "credit", amt, `Awarded · ${reason}`),
          screen: "home",
        }));
        return null;
      },
      debitUnits: (amount, note) => {
        const s = get();
        const amt = Math.max(1, Math.floor(amount));
        if (amt > s.balance) return "Not enough Units";
        set({
          balance: s.balance - amt,
          history: record(s.history, "debit", amt, note),
        });
        return null;
      },
      creditUnits: (amount, note) => {
        const amt = Math.max(1, Math.floor(amount));
        set((s) => ({
          balance: s.balance + amt,
          history: record(s.history, "credit", amt, note),
        }));
        return null;
      },
      requestPurchase: () => {
        const s = get();
        if (s.frozen) return "Access is frozen by your parent";
        const product = s.selectedProduct;
        if (!product) return "No item selected";
        const reserved = s.pendingPurchases.reduce((sum, p) => sum + p.price, 0);
        const available = s.balance - reserved;
        if (product.price > available) {
          return available > 0
            ? `Only ${available} Units are available after pending requests`
            : "Your available Units are already reserved";
        }
        if (s.pendingPurchases.some((p) => p.productId === product.id)) {
          return "This request is already waiting";
        }
        set({
          pendingPurchases: [
            {
              id: uid("buy"),
              productId: product.id,
              name: product.name,
              price: product.price,
              imageUrl: product.imageUrl,
            },
            ...s.pendingPurchases,
          ],
          screen: "home",
          selectedProduct: null,
        });
        return null;
      },
      approvePurchase: (id) => {
        const s = get();
        const item = s.pendingPurchases.find((p) => p.id === id);
        if (!item) return "Request not found";
        if (item.price > s.balance) return "Insufficient Units";
        set({
          balance: s.balance - item.price,
          pendingPurchases: s.pendingPurchases.filter((p) => p.id !== id),
          history: record(
            s.history,
            "debit",
            item.price,
            `Marketplace · ${item.name}`,
          ),
        });
        return null;
      },
      denyPurchase: (id) => {
        const s = get();
        const item = s.pendingPurchases.find((p) => p.id === id);
        set({
          pendingPurchases: s.pendingPurchases.filter((p) => p.id !== id),
          history: record(
            s.history,
            "event",
            0,
            item ? `Denied · ${item.name}` : "Purchase denied",
          ),
        });
        return null;
      },
      completeChore: (choreId) => {
        const s = get();
        if (s.frozen) return "Access is frozen by your parent";
        const chore = s.choreCatalog.find((c) => c.id === choreId);
        if (!chore) return "Goal not found";
        if (s.disabledChoreIds.includes(choreId)) return "This goal is turned off";
        if (s.completedChoreIds.includes(choreId)) return "Already completed";
        if (s.pendingChores.some((c) => c.choreId === choreId)) {
          return "Waiting on parent";
        }
        set({
          pendingChores: [
            {
              id: uid("chore"),
              choreId,
              name: chore.name,
              amount: chore.amount,
            },
            ...s.pendingChores,
          ],
        });
        return null;
      },
      approveChore: (id) => {
        const s = get();
        const item = s.pendingChores.find((c) => c.id === id);
        if (!item) return "Request not found";
        if (!s.consent) return "Verify parental consent first";
        set({
          balance: s.balance + item.amount,
          pendingChores: s.pendingChores.filter((c) => c.id !== id),
          completedChoreIds: [...s.completedChoreIds, item.choreId],
          history: record(
            s.history,
            "credit",
            item.amount,
            `Chore approved · ${item.name}`,
          ),
        });
        return null;
      },
      denyChore: (id) => {
        const s = get();
        const item = s.pendingChores.find((c) => c.id === id);
        set({
          pendingChores: s.pendingChores.filter((c) => c.id !== id),
          history: record(
            s.history,
            "event",
            0,
            item ? `Chore not approved · ${item.name}` : "Chore denied",
          ),
        });
        return null;
      },
      addChore: (input) => {
        const name = input.name.trim();
        if (!name) return "Give the chore a name";
        const amount = Math.max(1, Math.floor(input.amount) || 1);
        const chore: ChoreTemplate = {
          id: uid("chore-tpl"),
          name,
          amount,
          category: input.category,
        };
        set((s) => ({ choreCatalog: [...s.choreCatalog, chore] }));
        return null;
      },
      updateChore: (id, input) => {
        const name = input.name.trim();
        if (!name) return "Give the chore a name";
        const amount = Math.max(1, Math.floor(input.amount) || 1);
        set((s) => ({
          choreCatalog: s.choreCatalog.map((c) =>
            c.id === id ? { ...c, name, amount, category: input.category } : c,
          ),
        }));
        return null;
      },
      toggleChore: (id) => {
        set((s) => ({
          disabledChoreIds: s.disabledChoreIds.includes(id)
            ? s.disabledChoreIds.filter((c) => c !== id)
            : [...s.disabledChoreIds, id],
        }));
      },
      removeChore: (id) => {
        set((s) => ({
          choreCatalog: s.choreCatalog.filter((c) => c.id !== id),
          disabledChoreIds: s.disabledChoreIds.filter((c) => c !== id),
          pendingChores: s.pendingChores.filter((c) => c.choreId !== id),
        }));
      },
      lockUnits: (amount) => {
        const s = get();
        if (s.frozen) return "Access is frozen by your parent";
        const amt = Math.max(1, Math.floor(amount));
        if (amt > s.balance) return "Not enough Units";
        const match = Math.floor(amt * s.matchRate);
        set({
          balance: s.balance - amt,
          vault: s.vault + amt + match,
          history: record(
            s.history,
            "transfer",
            amt,
            match
              ? `Locked in Vault · parent matched ${match}`
              : "Locked in Vault",
          ),
          screen: "home",
        });
        return null;
      },
      setMatchRate: (rate) => {
        set({ matchRate: rate });
        return "Matching preference saved";
      },
      advanceVaultDays: (days) => {
        set((s) => ({ demoDaysAdvanced: s.demoDaysAdvanced + days }));
        return `Advanced ${days} days`;
      },
      releaseVault: () => {
        const s = get();
        if (get().daysRemaining() > 0) return "Vault has not matured yet";
        if (s.vault <= 0) return "Vault is empty";
        const amt = s.vault;
        set({
          vault: 0,
          vaultOpenedAt: Date.now(),
          demoDaysAdvanced: 0,
          history: record(
            s.history,
            "cashout",
            amt,
            "Vault matured · cash payout marked for Alex",
          ),
        });
        return null;
      },
      openCd: (input) => {
        const s = get();
        if (!s.consent) return "Verify parental consent first";
        const goal = input.goal.trim() || "College Fund";
        const amt = Math.max(1, Math.floor(input.principal));
        if (amt > s.balance) return "Not enough Units in the family balance";
        const years = cdTermYears(input.term, s.childAge);
        const openedAt = Date.now();
        const maturityAt = openedAt + years * 365 * DAY_MS;
        const maturityLabel = new Date(maturityAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        const cd: VaultCd = {
          id: uid("cd"),
          goal,
          principal: amt,
          openedAt: new Date(openedAt).toISOString(),
          maturityAt: new Date(maturityAt).toISOString(),
          term: input.term,
          bonusAccrued: 0,
          lastBonusAt: new Date(openedAt).toISOString(),
          status: "active",
          unitsCashedOut: 0,
          source: "Family balance",
        };
        set({
          balance: s.balance - amt,
          vaultCds: [cd, ...s.vaultCds],
          history: record(
            s.history,
            "transfer",
            amt,
            `Vault CD opened · ${goal} · ${amt} Units locked until ${maturityLabel} · 5% APY · source: family balance`,
          ),
        });
        return null;
      },
      refreshCds: () => {
        const s = get();
        if (s.vaultCds.length === 0) return;
        const now = Date.now() + s.demoDaysAdvanced * DAY_MS;
        let changed = false;
        let history = s.history;
        const vaultCds = s.vaultCds.map((cd) => {
          if (cd.status === "cashed-out" || cd.status === "withdrawn") return cd;
          const next = { ...cd };
          // Monthly bonus: 5% APY simple interest on principal, Units only.
          const lastBonus = new Date(cd.lastBonusAt).getTime();
          const months = Math.floor((now - lastBonus) / (30 * DAY_MS));
          if (months > 0 && next.status === "active") {
            const bonus = Math.floor((cd.principal * CD_APY * months) / 12);
            if (bonus > 0) {
              next.bonusAccrued = cd.bonusAccrued + bonus;
              history = record(
                history,
                "credit",
                bonus,
                `CD bonus · ${cd.goal} +${bonus} Units (5% APY)`,
              );
              changed = true;
            }
            next.lastBonusAt = new Date(now).toISOString();
            changed = true;
          }
          if (
            next.status === "active" &&
            now >= new Date(cd.maturityAt).getTime()
          ) {
            next.status = "matured";
            history = record(
              history,
              "event",
              0,
              `Vault CD matured · ${cd.goal} · ${next.principal + next.bonusAccrued} Units ready for education cash-out`,
            );
            changed = true;
          }
          return next;
        });
        if (changed) set({ vaultCds, history });
      },
      cdDaysRemaining: (id) => {
        const s = get();
        const cd = s.vaultCds.find((c) => c.id === id);
        if (!cd) return 0;
        const now = Date.now() + s.demoDaysAdvanced * DAY_MS;
        return Math.max(
          0,
          Math.ceil((new Date(cd.maturityAt).getTime() - now) / DAY_MS),
        );
      },
      requestCdCashOut: (cdId, input) => {
        const s = get();
        if (!s.consent) return "Verify parental consent first";
        if (!input.attested)
          return "Please confirm the education-use attestation";
        const cd = s.vaultCds.find((c) => c.id === cdId);
        if (!cd) return "CD not found";
        if (cd.status === "cashed-out" || cd.status === "withdrawn")
          return "This CD is already closed";
        const now = Date.now() + s.demoDaysAdvanced * DAY_MS;
        if (now < new Date(cd.maturityAt).getTime())
          return "This CD has not matured yet — cash-out is only available at maturity";
        const available = cd.principal + cd.bonusAccrued - cd.unitsCashedOut;
        const amt = Math.max(1, Math.floor(input.units));
        if (amt > available)
          return `Only ${available} Units are available in this CD`;
        const payout: CdPayout = {
          id: uid("payout"),
          cdId,
          goal: cd.goal,
          units: amt,
          dollars: cdDollars(amt),
          recipient: input.recipient,
          status: "pending",
          requestedAt: nowIso(),
        };
        const unitsCashedOut = cd.unitsCashedOut + amt;
        const fullyPaid = unitsCashedOut >= cd.principal + cd.bonusAccrued;
        set({
          cdPayouts: [payout, ...s.cdPayouts],
          vaultCds: s.vaultCds.map((c) =>
            c.id === cdId
              ? {
                  ...c,
                  unitsCashedOut,
                  status: (fullyPaid ? "cashed-out" : "matured") as CdStatus,
                }
              : c,
          ),
          history: record(
            s.history,
            "cashout",
            amt,
            `CD cash-out requested · ${cd.goal} · ${amt} Units ≈ ${formatDollars(amt)} · no fee · queued with banking partner for education expenses`,
          ),
        });
        return null;
      },
      withdrawCdEarly: (cdId) => {
        const s = get();
        const cd = s.vaultCds.find((c) => c.id === cdId);
        if (!cd) return "CD not found";
        if (cd.status === "matured")
          return "This CD has matured — request a cash-out instead";
        if (cd.status !== "active") return "This CD is already closed";
        const forfeited = cd.bonusAccrued;
        set({
          balance: s.balance + cd.principal,
          vaultCds: s.vaultCds.map((c) =>
            c.id === cdId
              ? { ...c, bonusAccrued: 0, status: "withdrawn" as CdStatus }
              : c,
          ),
          history: record(
            s.history,
            "transfer",
            cd.principal,
            `Vault CD withdrawn early · ${cd.goal} · ${cd.principal} Units returned to family balance · ${forfeited} bonus Units forfeited (never cash)`,
          ),
        });
        return null;
      },
      saveDrawing: (dataUrl, meta) => {
        set((s) => ({
          drawings: [
            {
              id: uid("draw"),
              dataUrl,
              at: nowIso(),
              missionId: meta?.missionId,
              title: meta?.title,
            },
            ...s.drawings,
          ].slice(0, 12),
        }));
        return "Design saved";
      },
      clearDrawings: () => set({ drawings: [] }),
      setChildAge: (age) => {
        const next = Math.min(17, Math.max(5, Math.floor(age) || 10));
        set({ childAge: next });
      },
      setStudioProUnlocked: (on) => {
        set({ studioProUnlocked: on });
      },
      completeStudioMission: (missionId, xp) => {
        const s = get();
        const done = s.completedMissionIds ?? [];
        if (done.includes(missionId)) return "Mission already complete";
        set({
          completedMissionIds: [missionId, ...done],
          studioXp: (s.studioXp ?? 0) + Math.max(0, Math.floor(xp)),
          history: record(s.history, "event", 0, `Studio mission · ${missionId}`),
        });
        return null;
      },
      awardStudioWin: (xp, units, note) => {
        const s = get();
        if (s.frozen) return "Account is frozen";
        const credit = Math.max(0, Math.floor(units));
        set({
          studioXp: (s.studioXp ?? 0) + Math.max(0, Math.floor(xp)),
          gameWins: (s.gameWins ?? 0) + 1,
          balance: s.balance + credit,
          history: record(s.history, "credit", credit, note),
        });
        return null;
      },
      buyStudioPack: (packId, cost) => {
        const s = get();
        const owned = s.ownedPacks ?? [];
        if (owned.includes(packId)) return "Already owned";
        if (s.balance < cost) return "Not enough Units";
        set({
          balance: s.balance - cost,
          ownedPacks: [...owned, packId],
          history: record(s.history, "debit", cost, `Studio pack · ${packId}`),
        });
        return null;
      },
      joinStudioTeam: (team) => set({ studioTeam: team }),
      touchStudioStreak: () => {
        const today = new Date().toISOString().slice(0, 10);
        const s = get();
        if (s.lastStudioDay === today) return;
        const yesterday = new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
        set({
          lastStudioDay: today,
          studioStreak: s.lastStudioDay === yesterday ? (s.studioStreak ?? 0) + 1 : 1,
        });
      },
      resetDemo: () => {
        const next = openingState();
        set({
          ...next,
          role: "parent",
          screen: "home",
          selectedProduct: null,
        });
      },
      daysRemaining: () => {
        const s = get();
        const elapsed = Math.floor(
          (Date.now() - s.vaultOpenedAt) / DAY_MS + s.demoDaysAdvanced,
        );
        return Math.max(0, MATURITY_DAYS - elapsed);
      },
      pendingCount: () => {
        const s = get();
        return s.pendingPurchases.length + s.pendingChores.length;
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
      skipHydration: true,
      partialize: (state) => ({
        consent: state.consent,
        frozen: state.frozen,
        childName: state.childName,
        childAge: state.childAge,
        balance: state.balance,
        vault: state.vault,
        vaultTarget: state.vaultTarget,
        vaultGoal: state.vaultGoal,
        vaultOpenedAt: state.vaultOpenedAt,
        vaultCds: state.vaultCds,
        cdPayouts: state.cdPayouts,
        demoDaysAdvanced: state.demoDaysAdvanced,
        matchRate: state.matchRate,
        pendingPurchases: state.pendingPurchases,
        pendingChores: state.pendingChores,
        completedChoreIds: state.completedChoreIds,
        history: state.history,
        drawings: state.drawings,
        completedMissionIds: state.completedMissionIds,
        studioXp: state.studioXp,
        studioStreak: state.studioStreak,
        studioProUnlocked: state.studioProUnlocked,
        lastStudioDay: state.lastStudioDay,
        gameWins: state.gameWins,
        studioTeam: state.studioTeam,
        ownedPacks: state.ownedPacks,
      }),
    },
  ),
);

export { MATURITY_DAYS };
