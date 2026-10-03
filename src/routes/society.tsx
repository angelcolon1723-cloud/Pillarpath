import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  approveStockItem,
  claimSocietyAdmin,
  createPrintifyDrafts,
  getSocietyStatus,
  getStock,
  importPrintifySelection,
  listTeacherVerifications,
  publishStockItem,
  rejectStockItem,
  reviewTeacherVerification,
  searchPrintifyBlueprints,
  syncPrintifyCosts,
  unpublishStockItem,
  type BlueprintChoice,
  type SocietyStatus,
  type TeacherVerificationRequest,
} from "@/lib/society-server";
import type { StockItem } from "@/lib/suppliers/publish";
import { suggestRetailPrice } from "@/lib/suppliers/pricing";
import { cn } from "@/lib/utils";
import { CorporateHQ } from "@/components/society/corporate-hq";

/**
 * /society — PillarPath Society Network internal stock page.
 *
 * Unlisted from public navigation and noindex. Admin-gated server-side.
 * Admins reach it through the Society Network entry in the app's More menu.
 * First slice of the Society Network dashboard: review screened supplier
 * products and publish approved ones to the storefront shelves.
 */
export const Route = createFileRoute("/society")({
  component: SocietyPage,
  head: () => ({
    meta: [
      { title: "Society Network — Internal" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

const SCREENING_TONE: Record<string, "accent" | "muted" | "warn" | "danger"> = {
  approved: "accent",
  quarantined: "warn",
  rejected: "danger",
  pending: "muted",
};

function money(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function SocietyPage() {
  const [status, setStatus] = useState<SocietyStatus | null>(null);
  const [denied, setDenied] = useState(false);
  const [items, setItems] = useState<StockItem[] | null>(null);
  const [verifications, setVerifications] = useState<TeacherVerificationRequest[] | null>(null);
  const [defaultMargin, setDefaultMargin] = useState(40);
  const [busy, setBusy] = useState(false);
  const [societyTab, setSocietyTab] = useState<"stockroom" | "hq">("stockroom");

  const load = useCallback(async () => {
    try {
      const s = await getSocietyStatus();
      setStatus(s);
      if (s.isAdmin) {
        const [stock, tv] = await Promise.all([
          getStock(),
          listTeacherVerifications(),
        ]);
        setItems(stock.items);
        setDefaultMargin(stock.defaultMarginPct);
        setVerifications(tv.items);
      }
    } catch {
      setDenied(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load ]);

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="theme-landing min-h-dvh bg-bg text-ink">
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">
        PillarPath Society Network · Internal
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold">Stock the shelves</h1>
      <p className="mt-1 font-display text-lg text-accent">
        The Society of Becoming.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Supplier products flow here after kid-safety screening. Only{" "}
        <span className="font-semibold text-accent">approved</span> products can
        be published to the family storefront. Nothing here is visible to
        customers.
      </p>

      {denied && (
        <Card className="mt-8 p-8 text-center">
          <h2 className="font-display text-xl font-semibold">Sign in required</h2>
          <p className="mt-2 text-sm text-muted">
            This area is restricted to PillarPath Society Network admins.
          </p>
          <Button asChild className="mt-5">
            <Link to="/login">Sign in</Link>
          </Button>
        </Card>
      )}

      {status && !status.isAdmin && !denied && (
        <Card className="mt-8 p-8 text-center">
          {!status.adminExists ? (
            <>
              <h2 className="font-display text-xl font-semibold">
                No admin account yet
              </h2>
              <p className="mt-2 text-sm text-muted">
                You&apos;re signed in. Claim the first admin seat to manage the
                shelves. This is recorded in the audit log.
              </p>
              <Button
                className="mt-5"
                disabled={busy}
                onClick={() => void run(() => claimSocietyAdmin(), "Admin access claimed.")}
              >
                Claim admin access
              </Button>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl font-semibold">Restricted</h2>
              <p className="mt-2 text-sm text-muted">
                Your account doesn&apos;t have Society Network admin access.
              </p>
            </>
          )}
        </Card>
      )}

      {status?.isAdmin && (
        <div className="mt-8">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={societyTab === "stockroom" ? "default" : "outline"}
              size="sm"
              onClick={() => setSocietyTab("stockroom")}
            >
              📦 Stockroom
            </Button>
            <Button
              variant={societyTab === "hq" ? "default" : "outline"}
              size="sm"
              onClick={() => setSocietyTab("hq")}
            >
              🏢 Corporate HQ
            </Button>
          </div>

          {societyTab === "hq" ? (
            <div className="mt-6">
              <CorporateHQ />
            </div>
          ) : (
        <div className="mt-8 space-y-8">
          <ImportPanel busy={busy} onImported={() => void load()} />
          <TeacherVerificationsPanel
            items={verifications}
            busy={busy}
            onAction={(fn, msg) => void run(fn, msg)}
          />
          <div className="space-y-4">
            {items === null && (
              <p className="text-sm text-muted">Loading supplier catalog…</p>
            )}
          {items !== null && items.length === 0 && (
            <Card className="p-8 text-center">
              <h2 className="font-display text-xl font-semibold">
                Catalog is empty
              </h2>
              <p className="mt-2 text-sm text-muted">
                Import supplier products (CJ Dropshipping / Printify) to begin
                screening and stocking.
              </p>
            </Card>
          )}
          {items?.map((item) => (
            <StockCard
              key={item.id}
              item={item}
              defaultMargin={defaultMargin}
              busy={busy}
              onAction={(fn, msg) => void run(fn, msg)}
            />
          ))}
          </div>
        </div>
          )}
        </div>
      )}
    </div>
    </main>
  );
}

function ImportPanel({
  busy,
  onImported,
}: {
  busy: boolean;
  onImported: () => void;
}) {
  const [query, setQuery] = useState("kids");
  const [results, setResults] = useState<BlueprintChoice[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [working, setWorking] = useState(false);

  async function search() {
    setWorking(true);
    try {
      const res = await searchPrintifyBlueprints({ data: { query } });
      setResults(res.blueprints);
      setSelected(new Set());
      if (!res.blueprints.length) toast("No blueprints matched that search.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setWorking(false);
    }
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function importSelected() {
    if (!selected.size) return;
    setWorking(true);
    try {
      const res = await importPrintifySelection({
        data: { blueprintIds: [...selected] },
      });
      if (res.errors.length) {
        toast.error(
          `Imported ${res.imported}, ${res.errors.length} failed: ${res.errors[0].error}`,
        );
      } else {
        toast.success(`Imported ${res.imported} product${res.imported === 1 ? "" : "s"} for screening.`);
      }
      setSelected(new Set());
      onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setWorking(false);
    }
  }

  async function syncCosts() {
    setWorking(true);
    try {
      const res = await syncPrintifyCosts();
      if (res.missing.length) {
        toast(
          `Costs synced for ${res.updated} of ${res.checked}. ${res.missing.length} still missing pricing — those need a print provider with published costs.`,
        );
      } else {
        toast.success(`Fulfillment costs synced for ${res.updated} products.`);
      }
      onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cost sync failed.");
    } finally {
      setWorking(false);
    }
  }

  async function createDrafts() {
    setWorking(true);
    try {
      const res = await createPrintifyDrafts();
      if (!res.created) {
        toast("No approved products need drafts right now.");
      } else if (res.failed.length) {
        toast(
          `${res.created} drafts created (${res.withCosts} with real costs). ${res.failed.length} failed: ${res.failed[0]?.title}`,
        );
      } else {
        toast.success(
          `${res.created} Printify drafts created, ${res.withCosts} with real fulfillment costs.`,
        );
      }
      onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Draft creation failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-semibold">Import from Printify</h2>
      <p className="mt-1 text-sm text-muted">
        Search the Printify catalog, pick products, and they&apos;ll be
        imported and kid-safety screened. Nothing goes live until you publish it.
      </p>
      <div className="mt-4 flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void search();
          }}
          placeholder="Try &quot;kids&quot;, &quot;toddler&quot;, &quot;youth&quot;…"
          aria-label="Search Printify catalog"
        />
        <Button onClick={() => void search()} disabled={working || busy}>
          Search
        </Button>
      </div>
      {results !== null && results.length > 0 && (
        <div className="mt-4 space-y-2">
          {results.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => toggle(b.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                selected.has(b.id)
                  ? "border-accent bg-accent/10"
                  : "border-border hover:border-accent/40",
              )}
            >
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-md border",
                  selected.has(b.id)
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border",
                )}
                aria-hidden
              >
                {selected.has(b.id) && "✓"}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {b.title}
                </span>
                {b.brand && (
                  <span className="block text-xs text-subtle">{b.brand}</span>
                )}
              </span>
            </button>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void importSelected()}
              disabled={working || busy || !selected.size}
            >
              Import {selected.size} selected
            </Button>
            <Button
              variant="outline"
              onClick={() => void syncCosts()}
              disabled={working || busy}
            >
              Sync fulfillment costs
            </Button>
            <Button
              variant="outline"
              onClick={() => void createDrafts()}
              disabled={working || busy}
              title="Create draft products in your Printify shop with PillarPath designs to reveal real fulfillment costs. Drafts are never published."
            >
              Create Printify drafts
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function TeacherVerificationsPanel({
  items,
  busy,
  onAction,
}: {
  items: TeacherVerificationRequest[] | null;
  busy: boolean;
  onAction: (fn: () => Promise<unknown>, msg: string) => void;
}) {
  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-semibold">Teacher verifications</h2>
      <p className="mt-1 text-sm text-muted">
        Educator applications. Teachers unlock student details, grades, and
        family messaging only after you approve them here.
      </p>
      <div className="mt-4 space-y-3">
        {items === null && (
          <p className="text-sm text-muted">Loading verification requests…</p>
        )}
        {items !== null && items.length === 0 && (
          <p className="text-sm text-muted">No verification requests.</p>
        )}
        {items?.map((v) => {
          const pending = v.status === "pending";
          return (
            <div
              key={v.teacherId}
              className="rounded-xl border border-border p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={
                    v.status === "verified"
                      ? "accent"
                      : v.status === "rejected"
                        ? "danger"
                        : v.status === "pending"
                          ? "warn"
                          : "muted"
                  }
                >
                  {v.status}
                </Badge>
                <span className="text-sm font-semibold">
                  {v.name || v.email || v.teacherId}
                </span>
                {v.name && (
                  <span className="text-xs text-subtle">{v.email}</span>
                )}
                <span className="ml-auto text-xs text-subtle">
                  Submitted {new Date(v.createdAt).toLocaleDateString()}
                  {v.reviewedAt
                    ? ` · reviewed ${new Date(v.reviewedAt).toLocaleDateString()}`
                    : ""}
                </span>
              </div>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-subtle">School</dt>
                  <dd>{v.school || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-subtle">District</dt>
                  <dd>{v.district || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-subtle">Work email</dt>
                  <dd>{v.workEmail || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-subtle">Notes</dt>
                  <dd className="text-muted">{v.notes || "—"}</dd>
                </div>
              </dl>
              {pending && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      onAction(
                        () =>
                          reviewTeacherVerification({
                            data: { teacherId: v.teacherId, approve: true },
                          }),
                        "Teacher verified.",
                      )
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    onClick={() =>
                      onAction(
                        () =>
                          reviewTeacherVerification({
                            data: { teacherId: v.teacherId, approve: false },
                          }),
                        "Verification rejected.",
                      )
                    }
                  >
                    Reject
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function StockCard({
  item,
  defaultMargin,
  busy,
  onAction,
}: {
  item: StockItem;
  defaultMargin: number;
  busy: boolean;
  onAction: (fn: () => Promise<unknown>, msg: string) => void;
}) {
  const images = Array.isArray(item.images) ? item.images : [];
  const thumb = typeof images[0] === "string" ? images[0] : null;
  const reasons = Array.isArray(item.screening_reasons)
    ? item.screening_reasons.map(String)
    : [];
  const suggestion =
    item.cost_cents != null
      ? suggestRetailPrice(item.title, item.cost_cents, defaultMargin)
      : null;
  const [price, setPrice] = useState(
    suggestion != null ? (suggestion.cents / 100).toFixed(2) : "",
  );
  const live = item.store_active === true;

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-xs text-subtle">No image</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={SCREENING_TONE[item.screening_status] ?? "muted"}>
              {item.screening_status}
            </Badge>
            {live ? (
              <Badge tone="accent">Live on shelves · {money(item.store_retail_cents)}</Badge>
            ) : (
              <Badge tone="muted">Not published</Badge>
            )}
            <span className="text-xs text-subtle">
              {item.supplier} · {item.supplier_sku ?? item.supplier_product_id}
            </span>
          </div>
          <h3 className="mt-2 font-semibold leading-snug">{item.title}</h3>
          {reasons.length > 0 && (
            <p className="mt-1 text-xs text-muted">
              Screening: {reasons.join("; ")}
            </p>
          )}
          <p className="mt-1 text-xs text-subtle">
            {item.cost_cents != null
              ? `Supplier cost ${money(item.cost_cents)}`
              : "Set a retail price below to publish"}
            {item.ship_from_country ? ` · ships from ${item.ship_from_country}` : ""}
            {item.inventory != null ? ` · ${item.inventory} in stock` : ""}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {item.screening_status !== "approved" && item.screening_status !== "rejected" && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => onAction(() => approveStockItem({ data: { id: item.id } }), "Approved.")}
          >
            Approve
          </Button>
        )}
        {item.screening_status !== "rejected" && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onAction(() => rejectStockItem({ data: { id: item.id } }), "Rejected.")}
          >
            Reject
          </Button>
        )}
        {item.screening_status === "approved" && !live && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted">$</span>
              <Input
                className="w-24"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                aria-label="Retail price in dollars"
              />
            </div>
            <Button
              size="sm"
              disabled={busy || price.trim() === ""}
              onClick={() => {
                const cents = Math.round(Number.parseFloat(price) * 100);
                if (!Number.isFinite(cents) || cents <= 0) {
                  toast.error("Enter a valid retail price.");
                  return;
                }
                onAction(
                  () => publishStockItem({ data: { id: item.id, retailPriceCents: cents } }),
                  "Published to the shelves.",
                );
              }}
            >
              Publish to shelves
            </Button>
            {suggestion != null && (
              <span className="text-xs text-subtle">
                Auto-price ${(suggestion.cents / 100).toFixed(2)} ({defaultMargin}%
                margin
                {suggestion.clamped === "low"
                  ? `, raised to typical ${suggestion.category} pricing`
                  : suggestion.clamped === "high"
                    ? `, capped to typical ${suggestion.category} pricing`
                    : ""}
                )
              </span>
            )}
          </div>
        )}
        {live && item.store_product_id && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              onAction(
                () => unpublishStockItem({ data: { storeProductId: item.store_product_id! } }),
                "Removed from the shelves.",
              )
            }
          >
            Unpublish
          </Button>
        )}
      </div>
    </Card>
  );
}
