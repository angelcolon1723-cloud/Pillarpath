import { useEffect } from "react";
import {
  History,
  Home,
  Landmark,
  ShoppingBag,
  ShieldCheck,
  Sparkles,
  GraduationCap,
  Package,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { PillarMark } from "@/components/kiddo/mark";
import {
  ParentAward,
  ParentChores,
  ParentClassroom,
  ParentHistory,
  ParentHome,
  ParentLoad,
  ParentOrders,
  ParentVault,
} from "@/components/kiddo/parent-views";
import {
  ChildConfirm,
  ChildHome,
  ChildMarket,
  ChildVault,
  ChildLearn,
} from "@/components/kiddo/child-views";
import { StudioScreen } from "@/components/kiddo/studio";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLedger, type Role, type Screen } from "@/store/ledger";

function RoleSwitch() {
  const role = useLedger((s) => s.role);
  const consent = useLedger((s) => s.consent);
  const setRole = useLedger((s) => s.setRole);

  const pick = (next: Role) => {
    if (next === "child" && !consent) {
      toast.message("Verify parental consent before opening the child view");
      return;
    }
    setRole(next);
  };

  return (
    <div
      role="tablist"
      aria-label="Demo as"
      className="grid grid-cols-2 rounded-md bg-surface-2 p-1 shadow-[var(--shadow-border)]"
    >
      {(["parent", "child"] as const).map((r) => (
        <button
          key={r}
          type="button"
          role="tab"
          aria-selected={role === r}
          onClick={() => pick(r)}
          className={cn(
            "flex h-9 items-center justify-center gap-1.5 rounded-sm text-sm font-medium capitalize transition-[background-color,color] duration-150 ease-out",
            role === r ? "bg-surface text-ink shadow-[var(--shadow-border)]" : "text-muted",
          )}
        >
          {r === "parent" ? (
            <>
              <ShieldCheck className="size-3.5" />
              Parent
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" />
              Child
            </>
          )}
        </button>
      ))}
    </div>
  );
}

function BottomNav() {
  const role = useLedger((s) => s.role);
  const screen = useLedger((s) => s.screen);
  const setScreen = useLedger((s) => s.setScreen);
  const pending = useLedger((s) => s.pendingCount());

  const items =
    role === "parent"
      ? [
          { id: "home" as Screen, label: "Home", icon: Home },
          { id: "classroom" as Screen, label: "School", icon: GraduationCap },
          { id: "orders" as Screen, label: "Orders", icon: Package },
          { id: "history" as Screen, label: "History", icon: History, badge: pending },
          { id: "vault" as Screen, label: "Vault", icon: Landmark },
        ]
      : [
          { id: "home" as Screen, label: "Home", icon: Home },
          { id: "market" as Screen, label: "Market", icon: ShoppingBag },
          { id: "vault" as Screen, label: "Vault", icon: Landmark },
        ];

  return (
    <nav
      className="fixed bottom-3 left-1/2 z-20 w-[calc(100%-1.5rem)] max-w-[430px] -translate-x-1/2 rounded-3xl border border-white/10 bg-surface/90 px-2 py-2 shadow-[var(--shadow-float)] backdrop-blur-md"
      aria-label="Primary"
    >
      <div className="flex gap-1">
        {items.map((item) => {
          const active = screen === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setScreen(item.id)}
              className={cn(
                "relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-medium transition-all duration-150 active:scale-95",
                active
                  ? "bg-accent/15 text-accent shadow-[var(--shadow-float)]"
                  : "text-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2 : 1.7} />
              {item.label}
              {"badge" in item && item.badge ? (
                <Badge
                  tone="danger"
                  className="absolute top-0.5 right-[calc(50%-22px)] min-w-4 px-1"
                >
                  {item.badge}
                </Badge>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ScreenBody() {
  const role = useLedger((s) => s.role);
  const screen = useLedger((s) => s.screen);

  if (role === "parent") {
    switch (screen) {
      case "load":
        return <ParentLoad />;
      case "award":
        return <ParentAward />;
      case "vault":
        return <ParentVault />;
      case "history":
        return <ParentHistory />;
      case "chores":
        return <ParentChores />;
      case "classroom":
        return <ParentClassroom />;
      case "orders":
        return <ParentOrders />;
      default:
        return <ParentHome />;
    }
  }

  switch (screen) {
    case "market":
      return <ChildMarket />;
    case "confirm":
      return <ChildConfirm />;
    case "vault":
      return <ChildVault />;
    case "studio":
      return <StudioScreen />;
    case "learn":
      return <ChildLearn />;
    default:
      return <ChildHome />;
  }
}

export function AppShell() {
  useEffect(() => {
    void Promise.resolve(useLedger.persist.rehydrate());
  }, []);

  const role = useLedger((s) => s.role);
  const isChild = role === "child";

  return (
    <div className={cn("paper-grain min-h-dvh", isChild ? "theme-child" : "theme-parent")}>
      <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col bg-bg px-5 pt-[max(1rem,env(safe-area-inset-top))] shadow-[var(--shadow-border)] md:min-h-[100dvh] md:border-x md:border-border">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <PillarMark />
            <div className="min-w-0">
              <div className="font-display text-lg font-semibold leading-none tracking-tight">
                Pillarpath
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                {isChild ? <Sparkles className="size-3.5 text-accent" /> : <ShieldCheck className="size-3.5 text-accent" />}
                <span>{isChild ? "My money adventure" : "Parent dashboard"}</span>
              </div>
            </div>
          </div>
          <div className="w-36 shrink-0">
            <RoleSwitch />
          </div>
        </header>

        <main className="flex-1 pb-24">
          <ScreenBody />
        </main>

        <BottomNav />
      </div>
      <Toaster
        position="bottom-center"
        theme="light"
        offset={88}
        toastOptions={{
          className:
            "!bg-ink !text-bg !border-0 !shadow-[var(--shadow-border)] !rounded-lg !font-sans",
        }}
      />
    </div>
  );
}
