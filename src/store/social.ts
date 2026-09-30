import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useLedger } from "@/store/ledger";
import { uid } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* PillarPath social & creator store                                     */
/*                                                                      */
/* Covers: classroom leaderboards (effort-based, opt-in), the Creator    */
/* Showcase gallery, the Units-only Creator Shop, and Give (P2P Unit     */
/* gifting to parent-approved contacts).                                 */
/*                                                                      */
/* Guardrails baked in:                                                 */
/* - Leaderboards rank EFFORT (assignments/submissions), never balances. */
/* - Showcase posts need parent approval before anyone sees them.        */
/* - The shop is Units-only. No real money, payouts, or shipping.       */
/* - Gifts move FAMILY Units only, to parent-approved contacts, inside  */
/*   parent-configured limits, with a full activity trail.              */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "pillarpath-social-v1";

function nowIso() {
  return new Date().toISOString();
}

function todayKey(iso: string) {
  return iso.slice(0, 10);
}

/* ------------------------------ Leaderboard ------------------------------ */

export type LeaderboardConfig = {
  classroomId: string;
  enabled: boolean;
  /** When true, children see peer names. When false, peers are anonymized. */
  namedMode: boolean;
};

export type LeaderboardOptIn = {
  classroomId: string;
  studentName: string;
  optedIn: boolean;
};

/* ------------------------------- Showcase -------------------------------- */

export type ShowcaseStatus = "pending" | "approved" | "removed";

export type ShowcasePost = {
  id: string;
  drawingId: string;
  dataUrl: string;
  title: string;
  /** Display name only — never last names or contact details. */
  creatorName: string;
  classroomId?: string;
  status: ShowcaseStatus;
  cheers: number;
  featured: boolean;
  forSale: boolean;
  price: number;
  audience: "family" | "classroom";
  createdAt: string;
};

/* ------------------------------ Creator shop ----------------------------- */

export type ShopOrderStatus = "pending" | "approved" | "denied";

export type ShopOrder = {
  id: string;
  postId: string;
  title: string;
  price: number;
  sellerName: string;
  status: ShopOrderStatus;
  createdAt: string;
};

/* --------------------------------- Give ---------------------------------- */

export type GiveContact = {
  id: string;
  name: string;
  status: "pending" | "approved";
  requestedAt: string;
};

export type GiveSettings = {
  perTransferCap: number;
  dailyMax: number;
  /** Gifts above this need parent pre-approval. */
  approvalThreshold: number;
};

export type GiftStatus = "pending" | "completed" | "denied" | "reversed";

export type GiftRecord = {
  id: string;
  contactId: string;
  contactName: string;
  amount: number;
  note: string;
  status: GiftStatus;
  createdAt: string;
};

const DEFAULT_GIVE_SETTINGS: GiveSettings = {
  perTransferCap: 25,
  dailyMax: 50,
  approvalThreshold: 15,
};

const REVERSE_WINDOW_MS = 7 * 86_400_000;

type SocialData = {
  leaderboardConfigs: LeaderboardConfig[];
  leaderboardOptIns: LeaderboardOptIn[];
  posts: ShowcasePost[];
  cheeredIds: string[];
  shopOrders: ShopOrder[];
  contacts: GiveContact[];
  giveSettings: GiveSettings;
  gifts: GiftRecord[];
};

type SocialState = SocialData & {
  /* leaderboard */
  leaderboardConfig: (classroomId: string) => { enabled: boolean; namedMode: boolean };
  setLeaderboardEnabled: (classroomId: string, enabled: boolean) => void;
  setLeaderboardNamedMode: (classroomId: string, named: boolean) => void;
  studentOptIn: (classroomId: string, studentName: string) => boolean;
  setStudentOptIn: (classroomId: string, studentName: string, optedIn: boolean) => void;
  /* showcase */
  submitPost: (input: {
    drawingId: string;
    dataUrl: string;
    title: string;
    creatorName: string;
    classroomId?: string;
  }) => string | null;
  approvePost: (id: string) => void;
  removePost: (id: string) => void;
  cheerPost: (id: string) => string | null;
  featurePost: (id: string) => void;
  listForSale: (
    postId: string,
    price: number,
    audience: "family" | "classroom",
  ) => string | null;
  unlistFromSale: (postId: string) => void;
  /* shop */
  requestShopPurchase: (postId: string) => string | null;
  approveShopOrder: (id: string) => string | null;
  denyShopOrder: (id: string) => void;
  pendingShopOrders: () => ShopOrder[];
  /* give */
  requestContact: (name: string) => string | null;
  approveContact: (id: string) => void;
  denyContact: (id: string) => void;
  removeContact: (id: string) => void;
  setGiveSettings: (patch: Partial<GiveSettings>) => void;
  sendGift: (contactId: string, amount: number, note: string) => string | null;
  approveGift: (id: string) => string | null;
  denyGift: (id: string) => void;
  reverseGift: (id: string) => string | null;
  pendingGifts: () => GiftRecord[];
  pendingContacts: () => GiveContact[];
  resetDemo: () => void;
};

function emptyData(): SocialData {
  return {
    leaderboardConfigs: [],
    leaderboardOptIns: [],
    posts: [],
    cheeredIds: [],
    shopOrders: [],
    contacts: [],
    giveSettings: { ...DEFAULT_GIVE_SETTINGS },
    gifts: [],
  };
}

export const useSocial = create<SocialState>()(
  persist(
    (set, get) => ({
      ...emptyData(),

      /* ------------------------------ leaderboard ------------------------------ */
      leaderboardConfig: (classroomId) => {
        const found = get().leaderboardConfigs.find(
          (c) => c.classroomId === classroomId,
        );
        return { enabled: found?.enabled ?? false, namedMode: found?.namedMode ?? false };
      },
      setLeaderboardEnabled: (classroomId, enabled) => {
        set((s) => {
          const existing = s.leaderboardConfigs.find(
            (c) => c.classroomId === classroomId,
          );
          if (existing) {
            return {
              leaderboardConfigs: s.leaderboardConfigs.map((c) =>
                c.classroomId === classroomId ? { ...c, enabled } : c,
              ),
            };
          }
          return {
            leaderboardConfigs: [
              ...s.leaderboardConfigs,
              { classroomId, enabled, namedMode: false },
            ],
          };
        });
      },
      setLeaderboardNamedMode: (classroomId, named) => {
        set((s) => {
          const existing = s.leaderboardConfigs.find(
            (c) => c.classroomId === classroomId,
          );
          if (existing) {
            return {
              leaderboardConfigs: s.leaderboardConfigs.map((c) =>
                c.classroomId === classroomId ? { ...c, namedMode: named } : c,
              ),
            };
          }
          return {
            leaderboardConfigs: [
              ...s.leaderboardConfigs,
              { classroomId, enabled: false, namedMode: named },
            ],
          };
        });
      },
      studentOptIn: (classroomId, studentName) => {
        const key = studentName.trim().toLowerCase();
        return (
          get().leaderboardOptIns.find(
            (o) =>
              o.classroomId === classroomId &&
              o.studentName.trim().toLowerCase() === key,
          )?.optedIn ?? false
        );
      },
      setStudentOptIn: (classroomId, studentName, optedIn) => {
        const key = studentName.trim().toLowerCase();
        set((s) => {
          const existing = s.leaderboardOptIns.find(
            (o) =>
              o.classroomId === classroomId &&
              o.studentName.trim().toLowerCase() === key,
          );
          if (existing) {
            return {
              leaderboardOptIns: s.leaderboardOptIns.map((o) =>
                o === existing ? { ...o, optedIn } : o,
              ),
            };
          }
          return {
            leaderboardOptIns: [
              ...s.leaderboardOptIns,
              { classroomId, studentName: studentName.trim(), optedIn },
            ],
          };
        });
      },

      /* ------------------------------- showcase -------------------------------- */
      submitPost: (input) => {
        const title = input.title.trim().slice(0, 60);
        if (!title) return "Give your creation a title";
        if (!input.dataUrl) return "No artwork found";
        const s = get();
        if (
          s.posts.some(
            (p) =>
              p.drawingId === input.drawingId &&
              p.creatorName.toLowerCase() === input.creatorName.trim().toLowerCase() &&
              p.status !== "removed",
          )
        ) {
          return "This creation is already in the showcase";
        }
        const post: ShowcasePost = {
          id: uid("post"),
          drawingId: input.drawingId,
          dataUrl: input.dataUrl,
          title,
          creatorName: input.creatorName.trim(),
          classroomId: input.classroomId,
          status: "pending",
          cheers: 0,
          featured: false,
          forSale: false,
          price: 0,
          audience: "family",
          createdAt: nowIso(),
        };
        set({ posts: [post, ...s.posts].slice(0, 200) });
        return null;
      },
      approvePost: (id) => {
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === id ? { ...p, status: "approved" as const } : p,
          ),
        }));
      },
      removePost: (id) => {
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === id
              ? { ...p, status: "removed" as const, forSale: false }
              : p,
          ),
        }));
      },
      cheerPost: (id) => {
        const s = get();
        if (s.cheeredIds.includes(id)) return "Already cheered";
        const post = s.posts.find((p) => p.id === id);
        if (!post || post.status !== "approved") return "Not available";
        set({
          posts: s.posts.map((p) =>
            p.id === id ? { ...p, cheers: p.cheers + 1 } : p,
          ),
          cheeredIds: [...s.cheeredIds, id],
        });
        return null;
      },
      featurePost: (id) => {
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === id ? { ...p, featured: !p.featured } : p,
          ),
        }));
      },
      listForSale: (postId, price, audience) => {
        const post = get().posts.find((p) => p.id === postId);
        if (!post) return "Creation not found";
        if (post.status !== "approved")
          return "Only approved showcase pieces can be sold";
        const amt = Math.max(1, Math.floor(price));
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === postId
              ? { ...p, forSale: true, price: amt, audience }
              : p,
          ),
        }));
        return null;
      },
      unlistFromSale: (postId) => {
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === postId ? { ...p, forSale: false } : p,
          ),
        }));
      },

      /* --------------------------------- shop ---------------------------------- */
      requestShopPurchase: (postId) => {
        const s = get();
        const post = s.posts.find((p) => p.id === postId);
        if (!post || !post.forSale || post.status !== "approved")
          return "This piece is no longer for sale";
        if (s.shopOrders.some((o) => o.postId === postId && o.status === "pending"))
          return "A purchase is already waiting for approval";
        const order: ShopOrder = {
          id: uid("shop"),
          postId,
          title: post.title,
          price: post.price,
          sellerName: post.creatorName,
          status: "pending",
          createdAt: nowIso(),
        };
        set({ shopOrders: [order, ...s.shopOrders].slice(0, 100) });
        return null;
      },
      approveShopOrder: (id) => {
        const s = get();
        const order = s.shopOrders.find((o) => o.id === id);
        if (!order || order.status !== "pending") return "Order not found";
        // Units-only sale: the young creator earns the price in family Units.
        useLedger.getState().creditUnits(order.price, `Creator shop sale · ${order.title}`);
        set({
          shopOrders: s.shopOrders.map((o) =>
            o.id === id ? { ...o, status: "approved" as const } : o,
          ),
          posts: s.posts.map((p) =>
            p.id === order.postId ? { ...p, forSale: false } : p,
          ),
        });
        return null;
      },
      denyShopOrder: (id) => {
        set((s) => ({
          shopOrders: s.shopOrders.map((o) =>
            o.id === id ? { ...o, status: "denied" as const } : o,
          ),
        }));
      },
      pendingShopOrders: () =>
        get().shopOrders.filter((o) => o.status === "pending"),

      /* --------------------------------- give ---------------------------------- */
      requestContact: (name) => {
        const trimmed = name.trim().slice(0, 40);
        if (trimmed.length < 2) return "Enter a name for this contact";
        const key = trimmed.toLowerCase();
        if (get().contacts.some((c) => c.name.toLowerCase() === key))
          return "This contact is already on the list";
        set((s) => ({
          contacts: [
            {
              id: uid("contact"),
              name: trimmed,
              status: "pending",
              requestedAt: nowIso(),
            } as GiveContact,
            ...s.contacts,
          ].slice(0, 50),
        }));
        return null;
      },
      approveContact: (id) => {
        set((s) => ({
          contacts: s.contacts.map((c) =>
            c.id === id ? { ...c, status: "approved" as const } : c,
          ),
        }));
      },
      denyContact: (id) => {
        set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) }));
      },
      removeContact: (id) => {
        set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) }));
      },
      setGiveSettings: (patch) => {
        const clamp = (v: number | undefined, fallback: number) =>
          v === undefined ? fallback : Math.min(500, Math.max(1, Math.floor(v)));
        set((s) => ({
          giveSettings: {
            perTransferCap: clamp(patch.perTransferCap, s.giveSettings.perTransferCap),
            dailyMax: clamp(patch.dailyMax, s.giveSettings.dailyMax),
            approvalThreshold: clamp(
              patch.approvalThreshold,
              s.giveSettings.approvalThreshold,
            ),
          },
        }));
      },
      sendGift: (contactId, amount, note) => {
        const s = get();
        const ledger = useLedger.getState();
        if (ledger.frozen) return "Access is frozen by your parent";
        const contact = s.contacts.find((c) => c.id === contactId);
        if (!contact || contact.status !== "approved")
          return "Choose an approved contact";
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt < 1) return "Enter an amount of at least 1 Unit";
        if (amt > s.giveSettings.perTransferCap)
          return `Gifts are limited to ${s.giveSettings.perTransferCap} Units at a time`;
        const today = todayKey(nowIso());
        const spentToday = s.gifts
          .filter(
            (g) =>
              (g.status === "completed" || g.status === "pending") &&
              todayKey(g.createdAt) === today,
          )
          .reduce((sum, g) => sum + g.amount, 0);
        if (spentToday + amt > s.giveSettings.dailyMax)
          return `Daily giving limit is ${s.giveSettings.dailyMax} Units`;
        if (amt > ledger.balance) return "Not enough Units";
        const needsApproval = amt > s.giveSettings.approvalThreshold;
        const gift: GiftRecord = {
          id: uid("gift"),
          contactId,
          contactName: contact.name,
          amount: amt,
          note: note.trim().slice(0, 80),
          status: needsApproval ? "pending" : "completed",
          createdAt: nowIso(),
        };
        if (!needsApproval) {
          const err = ledger.debitUnits(amt, `Gift to ${contact.name}`);
          if (err) return err;
        }
        set({ gifts: [gift, ...s.gifts].slice(0, 200) });
        return null;
      },
      approveGift: (id) => {
        const s = get();
        const gift = s.gifts.find((g) => g.id === id);
        if (!gift || gift.status !== "pending") return "Gift not found";
        const ledger = useLedger.getState();
        const err = ledger.debitUnits(gift.amount, `Gift to ${gift.contactName}`);
        if (err) return err;
        set({
          gifts: s.gifts.map((g) =>
            g.id === id ? { ...g, status: "completed" as const } : g,
          ),
        });
        return null;
      },
      denyGift: (id) => {
        set((s) => ({
          gifts: s.gifts.map((g) =>
            g.id === id ? { ...g, status: "denied" as const } : g,
          ),
        }));
      },
      reverseGift: (id) => {
        const s = get();
        const gift = s.gifts.find((g) => g.id === id);
        if (!gift || gift.status !== "completed") return "Only completed gifts can be reversed";
        if (Date.now() - new Date(gift.createdAt).getTime() > REVERSE_WINDOW_MS)
          return "This gift is older than 7 days";
        useLedger.getState().creditUnits(gift.amount, `Gift reversed · ${gift.contactName}`);
        set({
          gifts: s.gifts.map((g) =>
            g.id === id ? { ...g, status: "reversed" as const } : g,
          ),
        });
        return null;
      },
      pendingGifts: () => get().gifts.filter((g) => g.status === "pending"),
      pendingContacts: () => get().contacts.filter((c) => c.status === "pending"),

      resetDemo: () => set({ ...emptyData() }),
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
    },
  ),
);
