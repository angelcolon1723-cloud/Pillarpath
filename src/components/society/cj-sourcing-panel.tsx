import { useState } from "react";
import { Search, Loader2, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  searchCjProducts,
  importCjSelection,
  type CjSearchHit,
} from "@/lib/society-server";

const QUICK_SEARCHES = [
  { label: "🧸 Squishies", keyword: "squishy fidget toy", maxPrice: 8 },
  { label: "🎲 Games & puzzles", keyword: "kids board game puzzle", maxPrice: 15 },
  { label: "📚 Picture books", keyword: "children picture book", maxPrice: 10 },
  { label: "🎒 Back to school", keyword: "kids school supplies set", maxPrice: 20 },
];

/**
 * CJ sourcing panel — search CJ's live catalog, pick winners, import
 * through kid-safety screening into the stockroom.
 */
export function CjSourcingPanel({ onImported }: { onImported: () => void }) {
  const [keyword, setKeyword] = useState("");
  const [hits, setHits] = useState<CjSearchHit[] | null>(null);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [usOnly, setUsOnly] = useState(true);

  const search = async (kw: string, maxPrice?: number) => {
    const q = kw.trim();
    if (!q) return;
    setSearching(true);
    setSelected(new Set());
    try {
      const res = await searchCjProducts({
        data: { keyword: q, usOnly, maxPrice },
      });
      setHits(res.hits);
      setTotal(res.total);
      if (!res.hits.length) toast.message("No products found — try a different search.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const toggle = (pid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const importSelected = async () => {
    if (!selected.size) return;
    setImporting(true);
    try {
      const res = await importCjSelection({ data: { pids: [...selected] } });
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
        <p className="text-sm font-semibold">🔍 Source from CJ Dropshipping</p>
        <p className="mt-1 text-xs text-muted">
          Search CJ's live catalog. Picks flow through kid-safety screening into
          the stockroom — nothing reaches the shelves unapproved.
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="Search products — e.g. squishy, puzzle, crayons…"
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
      </Card>

      {hits !== null && (
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
              const isSel = selected.has(h.pid);
              return (
                <button
                  key={h.pid}
                  type="button"
                  onClick={() => toggle(h.pid)}
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
                        ${((h.nowPrice ?? h.price) || 0).toFixed(2)}
                      </span>
                      {h.usStock > 0 ? (
                        <Badge tone="accent" className="text-[10px]">🇺🇸 {h.usStock}</Badge>
                      ) : (
                        <Badge tone="muted" className="text-[10px]">No US stock</Badge>
                      )}
                    </div>
                    {h.deliveryCycle && (
                      <p className="mt-0.5 text-[10px] text-muted">{h.deliveryCycle}</p>
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
