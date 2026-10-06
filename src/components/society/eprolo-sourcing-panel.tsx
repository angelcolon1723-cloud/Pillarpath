import { useState } from "react";
import { Search, Loader2, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  searchEproloProducts,
  importEproloSelection,
  type EproloSearchHit,
} from "@/lib/society-server";

const QUICK_SEARCHES = [
  { label: "🧸 Squishies", keyword: "squishy fidget toy", maxPrice: 8 },
  { label: "👕 Kids clothes", keyword: "kids t-shirt", maxPrice: 15 },
  { label: "👶 Toddler", keyword: "toddler clothes set", maxPrice: 15 },
  { label: "🎲 Games & puzzles", keyword: "kids board game puzzle", maxPrice: 15 },
  { label: "🔌 Kid gadgets", keyword: "kids electronic toy", maxPrice: 25 },
];

/**
 * Eprolo sourcing panel — search Eprolo's live catalog, pick winners,
 * import through kid-safety screening into the stockroom.
 *
 * NOTE: requires EPROLO_API_KEY in the server env (issued by Eprolo's
 * support team via the dashboard message box). Until it's set, searches
 * show a setup hint instead of failing silently.
 */
export function EproloSourcingPanel({ onImported }: { onImported: () => void }) {
  const [keyword, setKeyword] = useState("");
  const [hits, setHits] = useState<EproloSearchHit[] | null>(null);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [usOnly, setUsOnly] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);

  const search = async (kw: string, maxPrice?: number) => {
    const q = kw.trim();
    if (!q) return;
    setSearching(true);
    setSelected(new Set());
    try {
      const res = await searchEproloProducts({
        data: { keyword: q, usOnly, maxPrice },
      });
      setHits(res.hits);
      setTotal(res.total);
      setNotConfigured(false);
      if (!res.hits.length) toast.message("No products found — try a different search.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Search failed.";
      if (/EPROLO_API_KEY/i.test(msg)) {
        setNotConfigured(true);
        setHits([]);
      } else {
        toast.error(msg, { duration: 8000 });
      }
    } finally {
      setSearching(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const importSelected = async () => {
    if (!selected.size) return;
    setImporting(true);
    try {
      const res = await importEproloSelection({ data: { ids: [...selected] } });
      toast.success(`Imported ${res.imported} product${res.imported === 1 ? "" : "s"} — screened and in the stockroom.`);
      setSelected(new Set());
      onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm font-semibold">🔍 Source from Eprolo</p>
        <p className="mt-1 text-xs text-muted">
          Search Eprolo's live catalog (~1M products, US warehouses). Picks
          flow through kid-safety screening into the stockroom — nothing
          reaches the shelves unapproved.
        </p>
        {notConfigured ? (
          <div className="mt-3 rounded-2xl border border-border bg-bg p-4 text-xs leading-6 text-muted">
            <p className="font-semibold text-ink">Eprolo isn't connected yet.</p>
            <p className="mt-1">
              Eprolo issues API access through their support team — open your
              Eprolo dashboard, message your Account Support Rep to request
              API access, and they'll send the API document + key. Then add it
              as the <span className="font-mono">EPROLO_API_KEY</span> server
              env var and this panel lights up.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-3 flex gap-2">
              <Input
                placeholder="Search products — e.g. squishy, dinosaur toy, headphones…"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void search(keyword);
                }}
              />
              <Button onClick={() => void search(keyword)} disabled={searching}>
                {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_SEARCHES.map((q) => (
                <Button
                  key={q.label}
                  size="sm"
                  variant="outline"
                  disabled={searching}
                  onClick={() => void search(q.keyword, q.maxPrice)}
                >
                  {q.label}
                </Button>
              ))}
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={usOnly}
                onChange={(e) => setUsOnly(e.target.checked)}
                className="size-4 accent-current"
              />
              US warehouse only — 2–7 day delivery, less import paperwork
            </label>
          </>
        )}
      </Card>

      {hits !== null && !notConfigured && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-muted">
              {hits.length} of {total.toLocaleString()} results
              {selected.size > 0 && ` · ${selected.size} selected`}
            </p>
            {selected.size > 0 && (
              <Button size="sm" onClick={importSelected} disabled={importing}>
                {importing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="size-3.5" />
                )}
                Import {selected.size} to stockroom
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {hits.map((h) => {
              const isSel = selected.has(h.id);
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => toggle(h.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border bg-surface text-left transition-all",
                    isSel
                      ? "border-accent ring-2 ring-accent/40"
                      : "border-border hover:border-accent/40",
                  )}
                >
                  <div className="aspect-square overflow-hidden bg-bg">
                    {h.image ? (
                      <img
                        src={h.image}
                        alt={h.name}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="grid size-full place-items-center text-muted">No photo</div>
                    )}
                  </div>
                  {isSel && (
                    <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-accent text-accent-foreground">
                      <Check className="size-4" />
                    </span>
                  )}
                  <div className="p-2.5">
                    <p className="line-clamp-2 min-h-8 text-xs font-medium">{h.name}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm font-bold">
                        ${(h.price || 0).toFixed(2)}
                      </span>
                      {h.usStock > 0 ? (
                        <Badge tone="accent" className="text-[10px]">🇺🇸 {h.usStock}</Badge>
                      ) : (
                        <Badge tone="muted" className="text-[10px]">No US stock</Badge>
                      )}
                    </div>
                    {h.deliveryEstimate && (
                      <p className="mt-0.5 text-[10px] text-muted">{h.deliveryEstimate}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
