import { useState } from "react";
import {
  BarChart3,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Gift,
  Megaphone,
  PackageCheck,
  Plus,
  Settings,
  ShoppingBag,
  Star,
  Store,
  Truck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  addToCart,
  createCampaign,
  createChild,
  createPromoCode,
  saveProfile,
} from "@/lib/pillarpath-server";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Input, FieldLabel, NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProductIcon } from "@/components/kiddo/product-icon";
import { SpendingInsightsPanel } from "@/components/kiddo/spending-insights";
import type { ProductIcon as ProductIconId } from "@/lib/products";
import { bandForAge } from "@/lib/studio-path";
import { cn } from "@/lib/utils";
import { useLedger } from "@/store/ledger";

export type AppData = Awaited<
  ReturnType<typeof import("@/lib/pillarpath-server").getPillarpathData>
>;
export type Product = AppData["products"][number];
export type ParentSection =
  | "dashboard"
  | "store"
  | "orders"
  | "marketing"
  | "fulfillment"
  | "family"
  | "goals"
  | "teachers"
  | "future-units"
  | "unit-market"
  | "settings";

export function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

const PRODUCT_ICONS: Record<string, ProductIconId> = {
  "pp-backpack": "backpack",
  "pp-art-kit": "art",
  "pp-science": "science",
  "pp-blocks": "blocks",
  "pp-story-pack": "book",
  "pp-sports-ball": "ball",
};

export function productIcon(id: string): ProductIconId {
  return PRODUCT_ICONS[id] ?? "blocks";
}

export function SectionIntro({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">{text}</p>
    </div>
  );
}

export function Metric({
  title,
  value,
  delta,
  icon: Icon,
}: {
  title: string;
  value: string;
  delta?: string;
  icon: typeof Store;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">
            {title}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          {delta ? <p className="mt-1 text-xs text-muted">{delta}</p> : null}
        </div>
        <div className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Store;
  title: string;
  text: string;
}) {
  return (
    <div className="grid min-h-48 place-items-center p-8 text-center">
      <Icon className="size-8 text-accent" />
      <h3 className="mt-3 font-display text-xl font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>
    </div>
  );
}

export function ProductArt({
  productId,
  className,
}: {
  productId: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid aspect-[1.4] place-items-center bg-surface-2 text-accent",
        className,
      )}
    >
      <ProductIcon name={productIcon(productId)} className="size-12" />
    </div>
  );
}

export function Dashboard({
  data,
  onNavigate,
}: {
  data: AppData;
  onNavigate: (s: ParentSection) => void;
}) {
  const revenue = data.orders
    .filter((o) => o.status === "paid" || o.status === "preview_payment")
    .reduce((sum, o) => sum + o.total_cents, 0);

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <SectionIntro
          eyebrow="Parent workspace"
          title={`Welcome, ${data.profile.display_name.split(" ")[0]}`}
          text="Family ledger, store, and orders in one place."
        />
        <Button onClick={() => onNavigate("store")}>
          <ShoppingBag className="size-4" />
          Open store
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric
          title="Store revenue"
          value={money(revenue)}
          delta="Paid and preview orders"
          icon={CircleDollarSign}
        />
        <Metric
          title="Orders"
          value={String(data.orders.length)}
          delta="Latest 20"
          icon={PackageCheck}
        />
        <Metric
          title="Children"
          value={String(data.children.length)}
          delta="Supervised profiles"
          icon={Users}
        />
      </div>
      <SpendingInsightsPanel />
      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <CardTitle>Commerce activity</CardTitle>
              <CardHint className="mt-1">Orders and payment status</CardHint>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("orders")}
              className="text-sm font-semibold text-accent"
            >
              View all
            </button>
          </div>
          {data.orders.length ? (
            data.orders.slice(0, 6).map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-surface-2 text-accent">
                    <PackageCheck className="size-4" />
                  </div>
                  <div>
                    <p className="font-medium">Order #{order.id}</p>
                    <p className="text-xs text-muted">
                      {new Date(order.created_at).toLocaleDateString()} ·{" "}
                      {order.payment_provider}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">
                    {money(order.total_cents)}
                  </p>
                  <Badge
                    tone={
                      order.status === "paid" || order.status === "preview_payment"
                        ? "accent"
                        : "muted"
                    }
                  >
                    {order.status.replaceAll("_", " ")}
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              icon={PackageCheck}
              title="No orders yet"
              text="Open the store and create your first basket."
            />
          )}
        </Card>
        <Card className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              Family pulse
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold">
              Children at a glance
            </h3>
          </div>
          {data.children.map((child) => (
            <div key={child.id} className="rounded-2xl bg-surface-2 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{child.name}</p>
                  <p className="text-xs text-muted">Age {child.age ?? "—"}</p>
                </div>
                <span className="font-mono text-sm text-accent tabular-nums">
                  {child.units} U
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-bg">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{
                    width: `${Math.min(100, (child.vault_units / 70) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                {child.vault_units} Units in Vault
              </p>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onNavigate("family")}
            className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-surface-2"
          >
            Manage family
            <ChevronRight className="size-4" />
          </button>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <QuickAction
          icon={BarChart3}
          title="Reserve Future Units"
          text="Closed-loop family goals"
          onClick={() => onNavigate("future-units")}
        />
        <QuickAction
          icon={Settings}
          title="Account settings"
          text="Profile and payment controls"
          onClick={() => onNavigate("settings")}
        />
      </div>
    </section>
  );
}

function QuickAction({
  icon: Icon,
  title,
  text,
  onClick,
}: {
  icon: typeof Store;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-border bg-surface p-5 text-left transition-[transform,border-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-border-hover)]"
    >
      <Icon className="size-5 text-accent" />
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </button>
  );
}

export function StoreGrid({
  products,
  onAdded,
}: {
  products: Product[];
  onAdded: () => Promise<void>;
}) {
  return (
    <section className="space-y-5">
      <SectionIntro
        eyebrow="Pillarpath Marketplace"
        title="Curated family store"
        text="Every product is kid-safety screened and hand-picked for PillarPath families. Buy with secure checkout, or let kids request items with Units."
      />
      {products.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Stocking the shelves"
          text="We're curating kid-safe products for the store. Check back soon — new arrivals are on the way."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <Card key={product.id} className="flex flex-col overflow-hidden p-0">
              {product.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.image_url}
                  alt={product.name}
                  loading="lazy"
                  className="aspect-[1.4] w-full object-cover"
                />
              ) : (
                <ProductArt productId={product.id} />
              )}
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="muted">{product.category}</Badge>
                      <Badge tone="accent">Kid-safe screened</Badge>
                    </div>
                    <h3 className="mt-3 font-display text-xl font-semibold">
                      {product.name}
                    </h3>
                  </div>
                  <p className="font-mono text-sm text-accent tabular-nums">
                    {product.unit_price} U
                  </p>
                </div>
                <p className="mt-2 flex-1 text-sm text-muted">
                  {product.description}
                </p>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold tabular-nums">
                    {money(product.retail_price_cents)}
                  </span>
                  <Button
                    onClick={async () => {
                      await addToCart({ data: { productId: product.id, quantity: 1 } });
                      await onAdded();
                      toast.success("Added to basket");
                    }}
                  >
                    Add to basket
                  </Button>
                </div>
                <p className="mt-2 text-xs text-subtle">
                  {product.inventory} available
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export function OrdersView({ data }: { data: AppData }) {
  return (
    <section className="space-y-5">
      <SectionIntro
        eyebrow="Commerce"
        title="Orders"
        text="Payment, fulfillment, and family order history."
      />
      <Card className="overflow-hidden p-0">
        {data.orders.length ? (
          data.orders.map((order) => (
            <div
              key={order.id}
              className="grid gap-3 border-b border-border px-5 py-4 last:border-0 sm:grid-cols-[1fr_auto_auto] sm:items-center"
            >
              <div>
                <p className="font-semibold">Order #{order.id}</p>
                <p className="text-xs text-muted">
                  {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
              <Badge
                tone={
                  order.status === "paid" || order.status === "preview_payment"
                    ? "accent"
                    : "muted"
                }
              >
                {order.status.replaceAll("_", " ")}
              </Badge>
              <p className="font-semibold tabular-nums">
                {money(order.total_cents)}
              </p>
            </div>
          ))
        ) : (
          <EmptyState
            icon={PackageCheck}
            title="No orders"
            text="Orders appear here after checkout."
          />
        )}
      </Card>
    </section>
  );
}

export function MarketingView({
  data,
  onRefresh,
}: {
  data: AppData;
  onRefresh: () => Promise<void>;
}) {
  const [campaignName, setCampaignName] = useState("");
  const [channel, setChannel] = useState("Social");
  const [promo, setPromo] = useState("");
  const [discount, setDiscount] = useState(10);

  return (
    <section className="space-y-5">
      <SectionIntro
        eyebrow="Growth engine"
        title="Marketing that compounds"
        text="Campaigns, referrals, and promo codes live beside the store."
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <Metric title="Campaigns" value={String(data.campaigns.length)} icon={Megaphone} />
        <Metric title="Referral code" value={data.referral?.code ?? "Ready"} icon={Gift} />
        <Metric
          title="Supplier-ready orders"
          value={String(data.fulfillments.length)}
          icon={Truck}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-4">
          <CardTitle>Launch campaign</CardTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Campaign name"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
            <NativeSelect
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option>Social</option>
              <option>Email</option>
              <option>Search</option>
              <option>Affiliate</option>
            </NativeSelect>
          </div>
          <Button
            onClick={async () => {
              if (!campaignName.trim()) return;
              await createCampaign({
                data: {
                  name: campaignName,
                  channel,
                  budgetCents: 25000,
                },
              });
              setCampaignName("");
              await onRefresh();
              toast.success("Campaign created");
            }}
          >
            Create campaign <Plus className="size-4" />
          </Button>
          <div className="divide-y divide-border">
            {data.campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="font-medium">{campaign.name}</p>
                  <p className="text-xs text-muted">
                    {campaign.channel} · {campaign.clicks} clicks ·{" "}
                    {campaign.conversions} conversions
                  </p>
                </div>
                <Badge tone={campaign.status === "active" ? "accent" : "muted"}>
                  {campaign.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card className="space-y-4">
          <CardTitle>Promotions</CardTitle>
          <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
            <Input
              placeholder="WELCOME10"
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
            />
            <Input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
            />
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              if (!promo.trim()) return;
              await createPromoCode({
                data: { code: promo, discountPercent: discount },
              });
              setPromo("");
              toast.success("Promo code saved");
            }}
          >
            Save promo code
          </Button>
          <div className="rounded-2xl bg-accent-soft p-4">
            <p className="text-sm font-semibold text-accent">Referral program</p>
            <p className="mt-1 text-sm text-muted">
              Share{" "}
              <span className="font-mono text-ink">{data.referral?.code}</span>{" "}
              when you invite another family.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}

export function FulfillmentView({ data }: { data: AppData }) {
  return (
    <section className="space-y-5">
      <SectionIntro
        eyebrow="Dropshipping"
        title="Supplier fulfillment center"
        text="Every paid store order is prepared for supplier routing and tracking."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          title="Queued"
          value={String(data.fulfillments.filter((f) => f.status === "queued").length)}
          icon={Boxes}
        />
        <Metric
          title="In transit"
          value={String(data.fulfillments.filter((f) => f.status === "shipped").length)}
          icon={Truck}
        />
        <Metric
          title="Tracked"
          value={String(data.fulfillments.filter((f) => f.tracking_number).length)}
          icon={PackageCheck}
        />
      </div>
      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-[1fr_1fr_120px] gap-4 border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wider text-subtle">
          <span>Order</span>
          <span>Supplier</span>
          <span>Status</span>
        </div>
        {data.fulfillments.length ? (
          data.fulfillments.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_1fr_120px] gap-4 border-b border-border px-5 py-4 text-sm last:border-0"
            >
              <span>#{item.order_id}</span>
              <span>{item.supplier_name}</span>
              <Badge tone={item.status === "shipped" ? "accent" : "muted"}>
                {item.status}
              </Badge>
            </div>
          ))
        ) : (
          <EmptyState
            icon={Truck}
            title="No fulfillment records yet"
            text="Complete a store checkout to queue a supplier order."
          />
        )}
      </Card>
    </section>
  );
}

export function FamilyProfiles({
  data,
  onRefresh,
}: {
  data: AppData;
  onRefresh: () => Promise<void>;
}) {
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState(10);
  const setStudioAge = useLedger((s) => s.setChildAge);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {data.children.map((child) => (
        <Card key={child.id} className="relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
              <Star className="size-5" />
            </div>
            <Badge tone={child.frozen ? "danger" : "accent"}>
              {child.frozen ? "Frozen" : "Active"}
            </Badge>
          </div>
          <h3 className="mt-5 font-display text-2xl font-semibold">{child.name}</h3>
          <p className="text-sm text-muted">
            Age {child.age ?? "—"} · {child.units} Units · {child.vault_units} Vault
          </p>
          <p className="mt-2 text-xs text-accent">
            Studio track · {bandForAge(child.age ?? 10).name} ({bandForAge(child.age ?? 10).ages})
          </p>
          <div className="mt-5 h-2 rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent"
              style={{
                width: `${Math.min(100, (child.vault_units / 70) * 100)}%`,
              }}
            />
          </div>
        </Card>
      ))}
      <Card className="border border-dashed border-border bg-transparent shadow-none">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-surface-2">
            <Plus className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold">Add a child</h3>
            <p className="text-xs text-muted">Create another supervised profile.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          <Input
            placeholder="Child name"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
          />
          <Input
            type="number"
            min={3}
            max={18}
            value={childAge}
            onChange={(e) => setChildAge(Number(e.target.value))}
          />
          <Button
            onClick={async () => {
              if (!childName.trim()) return;
              await createChild({
                data: { name: childName, age: childAge, avatar: "star" },
              });
              setStudioAge(childAge);
              setChildName("");
              await onRefresh();
              toast.success("Child profile created");
            }}
          >
            Create profile
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function SettingsView({
  data,
  onRefresh,
}: {
  data: AppData;
  onRefresh: () => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(data.profile.display_name);
  const [phone, setPhone] = useState(data.profile.phone ?? "");
  const [optIn, setOptIn] = useState(data.profile.marketing_opt_in);

  return (
    <section className="space-y-5">
      <SectionIntro
        eyebrow="Account"
        title="Settings and profile"
        text="Manage the parent account, communication preferences, and commerce defaults."
      />
      <Card className="max-w-2xl space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Display name</FieldLabel>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>Phone</FieldLabel>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <label className="flex min-h-11 items-start gap-3 rounded-2xl bg-surface-2 p-4 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-accent"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
          />
          <span>
            <strong>Growth communications</strong>
            <span className="block text-muted">
              Product, marketing, and family commerce updates.
            </span>
          </span>
        </label>
        <Button
          onClick={async () => {
            await saveProfile({
              data: { displayName, phone, marketingOptIn: optIn },
            });
            await onRefresh();
            toast.success("Settings saved");
          }}
        >
          Save changes
        </Button>
      </Card>
      <Card className="max-w-2xl">
        <h3 className="font-semibold">Payments</h3>
        <p className="mt-1 text-sm text-muted">
          Pillarpath never stores raw card numbers. Stripe Checkout collects cards
          and wallets when connected.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="muted">Cards</Badge>
          <Badge tone="muted">Apple Pay</Badge>
          <Badge tone="muted">Google Pay</Badge>
          <Badge tone="muted">Stripe Link</Badge>
        </div>
      </Card>
    </section>
  );
}
