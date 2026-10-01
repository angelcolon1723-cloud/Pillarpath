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
  getSocietyStatus,
  getStock,
  importPrintifySelection,
  publishStockItem,
  rejectStockItem,
  searchPrintifyBlueprints,
  unpublishStockItem,
  type BlueprintChoice,
  type SocietyStatus,
} from "@/lib/society-server";
import type { StockItem } from "@/lib/suppliers/publish";
import { cn } from "@/lib/utils";

/**
 * /society — PillarPath Society Network internal stock page.
 *
 * Unlisted (no nav links anywhere, noindex). Admin-gated server-side.
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
  const [defaultMargin, setDefaultMargin] = useState(40);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await getSocietyStatus();
      setStatus(s);
      if (s.isAdmin) {
        const stock = await getStock();
        setItems(stock.items);
        setDefaultMargin(stock.defaultMarginPct);
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
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">
        PillarPath Society Network · Internal
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold">Stock the shelves</h1>
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
        <div className="mt-8 space-y-8">
          <ImportPanel busy={busy} onImported={() => void load()} />
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
          <Button
            onClick={() => void importSelected()}
            disabled={working || busy || !selected.size}
          >
            Import {selected.size} selected
          </Button>
        </div>
      )}
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
  const suggestedRetail =
    item.cost_cents != null
      ? Math.round(item.cost_cents * (1 + defaultMargin / 100))
      : null;
  const [price, setPrice] = useState(
    suggestedRetail != null ? (suggestedRetail / 100).toFixed(2) : "",
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
            Supplier cost {money(item.cost_cents)}
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
            {suggestedRetail != null && (
              <span className="text-xs text-subtle">
                Suggested ${(suggestedRetail / 100).toFixed(2)} ({defaultMargin}% margin)
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
