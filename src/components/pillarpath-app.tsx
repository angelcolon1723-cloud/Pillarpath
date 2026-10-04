import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CreditCard,
  Gift,
  GraduationCap,
  Home,
  LayoutDashboard,
  LineChart,
  MoreHorizontal,
  PackageCheck,
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  createCheckout,
  getPillarpathData,
  setCartQuantity,
} from "@/lib/pillarpath-server";
import { getSocietyStatus } from "@/lib/society-server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PillarMark } from "@/components/kiddo/mark";
import { SplashScreen } from "@/components/splash-screen";
import {
  ParentAward,
  ParentHistory,
  ParentHome,
  ParentLoad,
  ParentVault,
} from "@/components/kiddo/parent-views";
import {
  ChildChores,
  ChildConfirm,
  ChildHome,
  ChildLearn,
  ChildMarket,
  ChildVault,
} from "@/components/kiddo/child-views";
import { ParentChores } from "@/components/kiddo/parent-views";
import { StudioScreen } from "@/components/kiddo/studio";
import { FutureUnitsMarket } from "@/components/kiddo/future-market";
import { UnitMarketView } from "@/components/kiddo/unit-market";
import {
  ChildClassroom,
  ParentTeachers,
  TeacherWorkspace,
  teacherNavIcons,
  teacherNavLabels,
  type TeacherSection,
} from "@/components/kiddo/teacher-views";
import { ChildGallery, ParentShowcase } from "@/components/kiddo/showcase";
import { ChildGive, ParentGive } from "@/components/kiddo/give";
import { useTeacher } from "@/store/teacher";
import { useSocial } from "@/store/social";
import { useLedger, type Screen } from "@/store/ledger";
import {
  Dashboard,
  EmptyState,
  FamilyProfiles,
  OrdersView,
  ProductArt,
  SectionIntro,
  SettingsView,
  StoreGrid,
  money,
  type AppData,
  type ParentSection,
  type Product,
} from "@/components/commerce";
import { cn } from "@/lib/utils";

const parentNav: Array<[ParentSection, string, typeof Home]> = [
  ["dashboard", "Overview", LayoutDashboard],
  ["store", "Store", Store],
  ["orders", "Orders", PackageCheck],
  ["family", "Family", Users],
  ["teachers", "Teachers", GraduationCap],
  ["future-units", "Future Units", BarChart3],
  ["unit-market", "Unit Market", LineChart],
  ["settings", "Settings", Settings],
];

const childNav: Array<[Screen, string, typeof Home]> = [
  ["home", "Home", Home],
  ["market", "Shop", ShoppingBag],
  ["vault", "Vault", Gift],
  ["studio", "Studio", Sparkles],
  ["classroom", "Class", GraduationCap],
];

const teacherNav: Array<[TeacherSection, string, typeof Home]> = (
  Object.keys(teacherNavLabels) as TeacherSection[]
).map((id) => [id, teacherNavLabels[id], teacherNavIcons[id]]);

type Role = "parent" | "child" | "teacher";

export function PillarpathApp({ initialRole }: { initialRole?: "parent" | "teacher" | "admin" }) {
  const user = useCurrentUser();
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  // Workspace role comes from the DB-fresh `initialRole` handed down by
  // RoleGate — never a hardcoded default. ("admin" has no separate app
  // shell; admins land in the parent workspace.) Manual tab switches can
  // still change it afterwards via pickRole.
  const [role, setRole] = useState<Role>(initialRole === "teacher" ? "teacher" : "parent");
  const [parentSection, setParentSection] = useState<ParentSection>("dashboard");
  const [teacherSection, setTeacherSection] = useState<TeacherSection>("dashboard");
  const [familyTab, setFamilyTab] = useState<"profiles" | "ledger">("profiles");
  const [basketOpen, setBasketOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  /** Fresh server-side admin check (DB truth, never the possibly-stale session). */
  const [societyAdmin, setSocietyAdmin] = useState<boolean | null>(null);
  /** Branded splashes: cinematic pillar on launch, World tour on kids' entrance. */
  const [splash, setSplash] = useState<"launch" | "kids" | null>("launch");

  useEffect(() => {
    if (!moreOpen || societyAdmin !== null || !user || user.isDevFallback) return;
    let cancelled = false;
    getSocietyStatus()
      .then((s) => {
        if (!cancelled) setSocietyAdmin(s.isAdmin);
      })
      .catch(() => {
        if (!cancelled) setSocietyAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [moreOpen, societyAdmin, user]);

  const consent = useLedger((s) => s.consent);
  const ledgerScreen = useLedger((s) => s.screen);
  const setLedgerRole = useLedger((s) => s.setRole);
  const setLedgerScreen = useLedger((s) => s.setScreen);

  useEffect(() => {
    void Promise.resolve(useLedger.persist.rehydrate());
    void Promise.resolve(useTeacher.persist.rehydrate());
    void Promise.resolve(useSocial.persist.rehydrate());
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getPillarpathData());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load Pillarpath");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cartMap = useMemo(
    () => new Map((data?.cart ?? []).map((item) => [item.productId, item.quantity])),
    [data],
  );
  const cartLines = useMemo(
    () =>
      (data?.products ?? [])
        .filter((product) => cartMap.has(product.id))
        .map((product) => ({
          product,
          quantity: cartMap.get(product.id) ?? 0,
        })),
    [data, cartMap],
  );
  const cartTotal = cartLines.reduce(
    (sum, line) => sum + line.product.retail_price_cents * line.quantity,
    0,
  );

  if (loading || !data || !user) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-ink">
        <div className="text-center">
          <div className="mx-auto mb-4">
            <PillarMark className="size-14" />
          </div>
          <p className="font-display text-2xl font-semibold">Loading Pillarpath</p>
          <p className="mt-1 text-sm text-muted">Preparing your family workspace…</p>
        </div>
      </div>
    );
  }

  async function qty(productId: string, quantity: number) {
    try {
      await setCartQuantity({ data: { productId, quantity } });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update basket");
    }
  }

  function pickRole(next: Role) {
    if (next === "child" && !consent) {
      toast.message("Verify parental consent in Family before opening the child view");
      setRole("parent");
      setParentSection("family");
      setFamilyTab("ledger");
      setLedgerRole("parent");
      setLedgerScreen("home");
      return;
    }
    setRole(next);
    setLedgerRole(next === "teacher" ? "parent" : next);
    setLedgerScreen("home");
    setMoreOpen(false);
    // Entering the kids' world gets the full cinematic intro.
    if (next === "child") setSplash("kids");
  }

  const activeNav: Array<[string, string, typeof Home]> =
    role === "parent" ? parentNav : role === "child" ? childNav : teacherNav;
  const activeSection =
    role === "parent" ? parentSection : role === "child" ? ledgerScreen : teacherSection;

  function navigate(id: string) {
    if (role === "parent") setParentSection(id as ParentSection);
    else if (role === "child") setLedgerScreen(id as Screen);
    else setTeacherSection(id as TeacherSection);
  }

  const title =
    role === "parent"
      ? parentNav.find((item) => item[0] === parentSection)?.[1]
      : role === "child"
        ? childNav.find((item) => item[0] === ledgerScreen)?.[1] ?? "Home"
        : teacherNavLabels[teacherSection];

  return (
    <div className={cn("min-h-dvh bg-bg text-ink", role === "child" ? "theme-child" : role === "teacher" ? "theme-teacher" : "theme-parent")}>
      {splash && (
        <SplashScreen
          key={splash}
          src={splash === "launch" ? "/splash-launch.mp4" : "/splash-kids.mp4"}
          onDone={() => setSplash(null)}
        />
      )}
      <div className="mx-auto min-h-dvh max-w-[1500px] lg:grid lg:grid-cols-[240px_1fr]">
        <aside className="hidden border-r border-border bg-surface/80 p-4 lg:flex lg:flex-col">
          <div className="mb-8 flex items-center gap-3 px-2">
            <PillarMark />
            <div>
              <p className="font-display text-xl font-semibold">Pillarpath</p>
              <p className="text-xs text-muted">Family commerce</p>
            </div>
          </div>
          <div className="mb-5 rounded-2xl border border-border bg-surface-2 p-2">
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => pickRole("parent")}
                className={cn(
                  "min-h-11 rounded-xl px-2 py-2 text-xs font-semibold",
                  role === "parent" ? "bg-bg text-ink" : "text-muted",
                )}
              >
                Parent
              </button>
              <button
                type="button"
                onClick={() => pickRole("child")}
                className={cn(
                  "min-h-11 rounded-xl px-2 py-2 text-xs font-semibold",
                  role === "child" ? "bg-accent text-accent-foreground" : "text-muted",
                )}
              >
                Child
              </button>
              <button
                type="button"
                onClick={() => pickRole("teacher")}
                className={cn(
                  "min-h-11 rounded-xl px-2 py-2 text-xs font-semibold",
                  role === "teacher" ? "bg-bg text-ink" : "text-muted",
                )}
              >
                Teacher
              </button>
            </div>
          </div>
          <nav className="space-y-1">
            {activeNav.map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => navigate(id)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors duration-150",
                  activeSection === id
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                <Icon className="size-4" />
                {label}
                {label === "Shop" && cartLines.length > 0 ? (
                  <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                    {cartLines.length}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-border bg-bg p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-subtle">
              Commerce stack
            </p>
            <div className="mt-3 space-y-2 text-xs text-muted">
              <p className="flex items-center gap-2">
                <CreditCard className="size-3.5" /> Stripe Checkout ready
              </p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 lg:hidden">
                <PillarMark />
                <span className="font-display text-xl font-semibold">Pillarpath</span>
              </div>
              <div className="hidden lg:block">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                  {role === "parent"
                    ? "Parent workspace"
                    : role === "child"
                      ? "Child space"
                      : "Teacher workspace"}
                </p>
                <h1 className="font-display text-xl font-semibold">{title}</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBasketOpen(true)}
                  className="relative grid size-11 place-items-center rounded-xl border border-border bg-surface text-muted hover:text-ink"
                  aria-label="Open basket"
                >
                  <ShoppingBag className="size-5" />
                  {cartLines.length ? (
                    <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                      {cartLines.length}
                    </span>
                  ) : null}
                </button>
                <div className="rounded-xl border border-border bg-surface px-3 py-2">
                  <UserButton />
                </div>
              </div>
            </div>
          </header>

          <main className="overflow-x-clip px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:py-8">
            {role === "parent" ? (
              <ParentWorkspace
                data={data}
                section={parentSection}
                familyTab={familyTab}
                onFamilyTab={setFamilyTab}
                onNavigate={setParentSection}
                onRefresh={refresh}
              />
            ) : role === "child" ? (
              <ChildWorkspace />
            ) : (
              <TeacherWorkspace section={teacherSection} />
            )}
          </main>
        </div>
      </div>

      <div className="child-dock fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1">
          {(role === "parent"
            ? parentNav.slice(0, 4)
            : role === "child"
              ? childNav
              : teacherNav.slice(0, 4)
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => navigate(id)}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold",
                activeSection === id ? "bg-accent-soft text-accent" : "text-muted",
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
          {role !== "child" ? (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold",
                moreOpen ||
                  (role === "parent"
                    ? (
                        [
                          "teachers",
                          "future-units",
                          "unit-market",
                          "settings",
                        ] as string[]
                      ).includes(parentSection)
                    : teacherNav
                        .slice(4)
                        .some(([id]) => id === teacherSection))
                  ? "bg-accent-soft text-accent"
                  : "text-muted",
              )}
            >
              <MoreHorizontal className="size-4" />
              More
            </button>
          ) : null}
        </div>
      </div>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="More menu">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/70"
            onClick={() => setMoreOpen(false)}
          />
          <div className="more-sheet absolute inset-x-0 bottom-0 rounded-t-[1.75rem] border-t border-border bg-surface p-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">More</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
                className="grid size-11 place-items-center rounded-xl border border-border"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(role === "parent" ? parentNav.slice(4) : teacherNav.slice(4)).map(
                ([id, label, Icon]) => {
                  const isActive = activeSection === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => {
                        navigate(id);
                        setMoreOpen(false);
                      }}
                      className={cn(
                        "flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-left text-sm font-semibold",
                        isActive
                          ? "border-accent/50 bg-accent-soft text-accent"
                          : "border-border bg-bg",
                      )}
                    >
                      <Icon className="size-4 text-accent" />
                      {label}
                    </button>
                  );
                },
              )}
              <button
                type="button"
                onClick={() => pickRole(role === "parent" ? "child" : "parent")}
                className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-bg px-4 text-left text-sm font-semibold"
              >
                <Sparkles className="size-4 text-accent" />
                Switch to {role === "parent" ? "child" : "parent"}
              </button>
              {societyAdmin ? (
                <a
                  href="/society"
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-4 text-left text-sm font-semibold text-accent"
                >
                  <LayoutDashboard className="size-4" />
                  Society Network
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {basketOpen ? (
        <BasketPanel
          lines={cartLines}
          total={cartTotal}
          onClose={() => setBasketOpen(false)}
          onQty={qty}
          onCheckout={() => {
            if (role === "child") {
              setBasketOpen(false);
              toast.message("Your parent reviews purchases before checkout");
              return;
            }
            setBasketOpen(false);
            setCheckoutOpen(true);
          }}
        />
      ) : null}

      {checkoutOpen ? (
        <CheckoutPanel
          email={user.primaryEmail ?? ""}
          total={cartTotal}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={async (url) => {
            if (url) window.location.href = url;
            else {
              setCheckoutOpen(false);
              await refresh();
              toast.success("Preview order created");
            }
          }}
        />
      ) : null}
    </div>
  );
}

function ParentWorkspace({
  data,
  section,
  familyTab,
  onFamilyTab,
  onNavigate,
  onRefresh,
}: {
  data: AppData;
  section: ParentSection;
  familyTab: "profiles" | "ledger";
  onFamilyTab: (tab: "profiles" | "ledger") => void;
  onNavigate: (s: ParentSection) => void;
  onRefresh: () => Promise<void>;
}) {
  const ledgerScreen = useLedger((s) => s.screen);

  if (section === "store") return <StoreGrid products={data.products} onAdded={onRefresh} />;
  if (section === "orders") return <OrdersView data={data} />;
  if (section === "settings") return <SettingsView data={data} onRefresh={onRefresh} />;
  if (section === "future-units") return <FutureUnitsMarket data={data} onRefresh={onRefresh} />;
  if (section === "unit-market") return <UnitMarketView data={data} onRefresh={onRefresh} />;
  if (section === "teachers") {
    return (
      <section className="mx-auto max-w-3xl">
        <ParentTeachers />
      </section>
    );
  }
  if (section === "family") {
    return (
      <section className="space-y-5">
        <SectionIntro
          eyebrow="Family"
          title="Profiles and Units ledger"
          text="Keep each child's earning, saving, and store experience supervised."
        />
        <div
          role="tablist"
          className="grid max-w-md grid-cols-2 rounded-xl bg-surface-2 p-1"
        >
          {(
            [
              ["profiles", "Profiles"],
              ["ledger", "Units ledger"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={familyTab === id}
              onClick={() => onFamilyTab(id)}
              className={cn(
                "min-h-11 rounded-lg text-sm font-semibold",
                familyTab === id ? "bg-surface text-ink shadow-[var(--shadow-border)]" : "text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {familyTab === "profiles" ? (
          <FamilyProfiles data={data} onRefresh={onRefresh} />
        ) : ledgerScreen === "chores" ? (
          <ParentChores />
        ) : (
          <div className="max-w-xl">
            {ledgerScreen === "load" ? (
              <ParentLoad />
            ) : ledgerScreen === "award" ? (
              <ParentAward />
            ) : ledgerScreen === "vault" ? (
              <ParentVault />
            ) : ledgerScreen === "history" ? (
              <ParentHistory />
            ) : ledgerScreen === "give" ? (
              <ParentGive />
            ) : ledgerScreen === "showcase" ? (
              <ParentShowcase />
            ) : (
              <ParentHome />
            )}
          </div>
        )}
      </section>
    );
  }
  return <Dashboard data={data} onNavigate={onNavigate} />;
}

function ChildWorkspace() {
  const screen = useLedger((s) => s.screen);
  if (screen === "market") return <ChildMarket />;
  if (screen === "confirm") return <ChildConfirm />;
  if (screen === "vault") return <ChildVault />;
  if (screen === "studio") return <StudioScreen />;
  if (screen === "learn") return <ChildLearn />;
  if (screen === "classroom") return <ChildClassroom />;
  if (screen === "gallery") return <ChildGallery />;
  if (screen === "give") return <ChildGive />;
  if (screen === "chores") return <ChildChores />;
  return <ChildHome />;
}

function BasketPanel({
  lines,
  total,
  onClose,
  onQty,
  onCheckout,
}: {
  lines: Array<{ product: Product; quantity: number }>;
  total: number;
  onClose: () => void;
  onQty: (id: string, q: number) => Promise<void>;
  onCheckout: () => void;
}) {
  const shipping = total >= 7500 ? 0 : 799;
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close basket"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-border bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              Basket
            </p>
            <h2 className="font-display text-2xl font-semibold">Your order</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-xl border border-border"
          >
            <X className="size-5" />
          </button>
        </div>
        {lines.length ? (
          <>
            <div className="mt-6 divide-y divide-border">
              {lines.map(({ product, quantity }) => (
                <div key={product.id} className="flex gap-3 py-4">
                  <div className="size-12 shrink-0 overflow-hidden rounded-xl">
                    <ProductArt productId={product.id} className="aspect-square size-12" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-sm text-muted">{money(product.retail_price_cents)}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void onQty(product.id, quantity - 1)}
                        className="grid size-8 place-items-center rounded-lg border border-border"
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-sm tabular-nums">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => void onQty(product.id, quantity + 1)}
                        className="grid size-8 place-items-center rounded-lg border border-border"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="font-semibold tabular-nums">
                    {money(product.retail_price_cents * quantity)}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-bg p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="tabular-nums">{money(total)}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-muted">Shipping</span>
                <span>{shipping === 0 ? "Free" : money(shipping)}</span>
              </div>
              <div className="mt-4 flex justify-between border-t border-border pt-4 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{money(total + shipping)}</span>
              </div>
              <Button className="mt-4 h-12 w-full" onClick={onCheckout}>
                Secure checkout <CreditCard className="size-4" />
              </Button>
              <p className="mt-3 text-center text-xs text-subtle">
                Card and wallet payments are collected by Stripe Checkout when connected.
              </p>
            </div>
          </>
        ) : (
          <EmptyState
            icon={ShoppingBag}
            title="Basket is empty"
            text="Add something from the store."
          />
        )}
      </aside>
    </div>
  );
}

function CheckoutPanel({
  email,
  total,
  onClose,
  onSuccess,
}: {
  email: string;
  total: number;
  onClose: () => void;
  onSuccess: (url: string | null) => Promise<void>;
}) {
  const [shippingName, setShippingName] = useState("");
  const [checkoutEmail, setCheckoutEmail] = useState(email);
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [busy, setBusy] = useState(false);
  const shipping = total >= 7500 ? 0 : 799;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4">
      <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-border bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              Secure checkout
            </p>
            <h2 className="font-display text-2xl font-semibold">Delivery details</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-xl border border-border"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-5 grid gap-3">
          <Input
            placeholder="Full name"
            value={shippingName}
            onChange={(e) => setShippingName(e.target.value)}
          />
          <Input
            placeholder="Email"
            type="email"
            value={checkoutEmail}
            onChange={(e) => setCheckoutEmail(e.target.value)}
          />
          <Input
            placeholder="Street address"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
            <Input placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
            <Input
              placeholder="ZIP"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-5 rounded-2xl bg-surface-2 p-4">
          <div className="flex items-center gap-3">
            <CreditCard className="size-5 text-accent" />
            <div>
              <p className="font-semibold">Payment methods</p>
              <p className="text-xs text-muted">Cards · Apple Pay · Google Pay · Stripe Link</p>
            </div>
          </div>
        </div>
        <Button
          className="mt-5 h-12 w-full"
          disabled={
            busy ||
            !shippingName ||
            !checkoutEmail ||
            !line1 ||
            !city ||
            !state ||
            !postalCode
          }
          onClick={async () => {
            setBusy(true);
            try {
              const result = await createCheckout({
                data: {
                  email: checkoutEmail,
                  shippingName,
                  shippingAddress: { line1, city, state, postalCode },
                },
              });
              await onSuccess(result.checkoutUrl);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Checkout failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy
            ? "Creating secure checkout…"
            : `Continue to payment · ${money(total + shipping)}`}
        </Button>
        <p className="mt-3 text-center text-xs leading-5 text-subtle">
          Pillarpath does not collect or store raw card information.
        </p>
      </div>
    </div>
  );
}
