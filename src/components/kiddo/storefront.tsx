"use client";

import { useMemo, useState } from "react";
import {
  Backpack,
  ChevronRight,
  Coins,
  Footprints,
  Gamepad2,
  Package,
  Puzzle,
  Search,
  SearchX,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn, formatUnits } from "@/lib/utils";
import type { MarketplaceProduct } from "@/lib/pillarpath-server";

interface StorefrontProps {
  products: MarketplaceProduct[];
  onSelect: (p: {
    id: string;
    name: string;
    price: number;
    description: string | null;
    imageUrl: string | null;
  }) => void;
  balance: number;
}

/** Branded aisle names, in the order kids walk them. */
const AISLE_ORDER = [
  "Toy Workshop",
  "Tech Lab",
  "Game Zone",
  "Society Gear",
  "Society Styles",
  "The Outfitters",
  "Scholar's Corner",
  "More Fun",
] as const;

type AisleName = (typeof AISLE_ORDER)[number];

const AISLE_ICONS: Record<AisleName, LucideIcon> = {
  "Toy Workshop": Puzzle,
  "Tech Lab": Zap,
  "Game Zone": Gamepad2,
  "Society Gear": Star,
  "Society Styles": Shirt,
  "The Outfitters": Footprints,
  "Scholar's Corner": Backpack,
  "More Fun": Sparkles,
};

/** Plain-language hint under each branded aisle name — shoppable first. */
const AISLE_HINTS: Record<AisleName, string> = {
  "Toy Workshop": "Toys & playtime",
  "Tech Lab": "Gadgets & electronics",
  "Game Zone": "Games & puzzles",
  "Society Gear": "Official PillarPath merch",
  "Society Styles": "Clothes & outfits",
  "The Outfitters": "Shoes & footwear",
  "Scholar's Corner": "School supplies & books",
  "More Fun": "Everything else",
};

/**
 * Map a product onto a branded aisle (case-insensitive).
 * PillarPath-branded merch goes to Society Gear — it's a category, not a
 * separate section, so it lives right in the aisles with everything else.
 */
function aisleFor(category: string | null, name: string): AisleName {
  const c = (category ?? "").toLowerCase();
  const n = name.toLowerCase();
  const has = (...terms: string[]) =>
    terms.some((t) => c.includes(t) || n.includes(t));
  // Strict priority: each product lands in exactly one aisle.
  if (
    n.includes("pillarpath") ||
    n.includes("pillar path") ||
    c.includes("merch") ||
    c.includes("pillar") ||
    (c.includes("brand") && !c.includes("branded toys"))
  )
    return "Society Gear";
  if (has("toy", "plush", "doll", "stuffed", "action figure", "lego", "blocks"))
    return "Toy Workshop";
  if (has("game", "puzzle", "board", "card game"))
    return "Game Zone";
  if (
    has(
      "electronic", "gadget", "tech", "headphone", "earbud",
      "speaker", "watch", "tablet", "camera", "robot", "drone", "console",
    )
  )
    return "Tech Lab";
  if (
    has(
      "cloth", "apparel", "shirt", "dress", "pants", "jacket",
      "hoodie", "tee", "t-shirt", "sweatshirt", "jersey", "legging",
    )
  )
    return "Society Styles";
  if (has("shoe", "sneaker", "boot", "sandal", "slipper", "footwear"))
    return "The Outfitters";
  if (
    has(
      "school", "suppl", "stationer", "backpack", "pencil",
      "notebook", "book", "crayon", "marker",
    )
  )
    return "Scholar's Corner";
  return "More Fun";
}

function toSelectArg(p: MarketplaceProduct) {
  return {
    id: p.id,
    name: p.name,
    price: p.unitPrice,
    description: p.description,
    imageUrl: p.imageUrl,
  };
}

function ProductCard({
  product,
  onSelect,
  className,
}: {
  product: MarketplaceProduct;
  onSelect: StorefrontProps["onSelect"];
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(toSelectArg(product))}
      className={cn(
        "group overflow-hidden rounded-xl bg-surface text-left shadow-[var(--shadow-float)] transition-all duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.97]",
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-surface-2">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted">
            <ShoppingBag className="size-9" strokeWidth={1.6} />
          </div>
        )}
        <Badge
          tone="accent"
          className="absolute left-2 top-2 gap-1 px-2 py-1 text-[11px]"
        >
          <ShieldCheck className="size-3" strokeWidth={2.5} />
          Kid-safe
        </Badge>
      </div>
      <div className="p-3">
        <div className="line-clamp-2 min-h-10 text-sm font-medium leading-snug">
          {product.name}
        </div>
        <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-accent">
          {formatUnits(product.unitPrice)} Units
        </div>
      </div>
    </button>
  );
}

function HeroBanner({
  product,
  onSelect,
}: {
  product: MarketplaceProduct;
  onSelect: StorefrontProps["onSelect"];
}) {
  return (
    <section
      aria-label="Featured product"
      className="relative overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-float)]"
    >
      {/* Neon wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(34,211,238,0.22),rgba(139,92,246,0.22),rgba(217,70,239,0.22))]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-fuchsia-500/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-cyan-400/20 blur-3xl"
      />
      <div className="relative grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
        <div className="min-w-0">
          <Badge tone="accent" className="gap-1 px-2.5 py-1">
            <Sparkles className="size-3.5" strokeWidth={2.5} />
            Featured treasure
          </Badge>
          <h2 className="mt-3 line-clamp-2 font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {product.name}
          </h2>
          {product.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted">
              {product.description}
            </p>
          )}
          <p className="mt-3 font-mono text-xl font-bold tabular-nums text-accent">
            {formatUnits(product.unitPrice)}{" "}
            <span className="text-sm font-medium">Units</span>
          </p>
          <Button
            type="button"
            onClick={() => onSelect(toSelectArg(product))}
            className="mt-4"
          >
            Shop now
            <ChevronRight className="size-4" strokeWidth={2.5} />
          </Button>
        </div>
        <div className="mx-auto w-44 shrink-0 overflow-hidden rounded-xl bg-surface-2 shadow-lg sm:w-56">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="aspect-square size-full object-cover"
            />
          ) : (
            <div className="grid aspect-square place-items-center text-muted">
              <ShoppingBag className="size-12" strokeWidth={1.4} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AisleRow({
  name,
  products,
  onSelect,
}: {
  name: AisleName;
  products: MarketplaceProduct[];
  onSelect: StorefrontProps["onSelect"];
}) {
  const Icon = AISLE_ICONS[name];
  return (
    <section aria-label={`${name} aisle`}>
      <div className="mb-2 flex items-center gap-2 px-0.5">
        <span className="grid size-8 place-items-center rounded-lg bg-accent/15 text-accent">
          <Icon className="size-4.5" strokeWidth={2} />
        </span>
        <div className="leading-tight">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {name}
          </h2>
          <p className="text-xs text-muted">{AISLE_HINTS[name]}</p>
        </div>
        <span className="ml-auto text-xs tabular-nums text-muted">
          {products.length} {products.length === 1 ? "item" : "items"}
        </span>
      </div>
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            onSelect={onSelect}
            className="w-40 shrink-0 snap-start sm:w-44"
          />
        ))}
      </div>
    </section>
  );
}

export function Storefront({ products, onSelect, balance }: StorefrontProps) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const filtered = useMemo(() => {
    const list = !searching
      ? products
      : products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description ?? "").toLowerCase().includes(q),
        );
    // Deduplicate: same product (normalized name) appears only once.
    // Aggressive normalization catches variant punctuation/spacing.
    const seen = new Set<string>();
    return list.filter((p) => {
      const key = p.name
        .toLowerCase()
        .replace(/[’‘`]/g, "'") // curly quotes -> straight
        .replace(/[""]/g, '"')
        .replace(/[^a-z0-9\s]/g, " ") // punctuation -> space
        .replace(/\s+/g, " ")
        .trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [products, q, searching]);

  const featured = useMemo(() => {
    if (searching || products.length === 0) return null;
    return (
      products.find((p) => p.imageUrl) ?? products[0] ?? null
    );
  }, [products, searching]);

  const aisles = useMemo(() => {
    const groups = new Map<AisleName, MarketplaceProduct[]>();
    for (const p of filtered) {
      const aisle = aisleFor(p.category, p.name);
      const list = groups.get(aisle);
      if (list) list.push(p);
      else groups.set(aisle, [p]);
    }
    return AISLE_ORDER.filter((a) => (groups.get(a)?.length ?? 0) > 0).map(
      (a) => ({ name: a, products: groups.get(a) ?? [] }),
    );
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Store header */}
      <header>
        <p className="text-sm font-medium text-muted">Marketplace</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          The Society Store
        </h1>
        <p className="mt-1 text-sm text-muted">Gear up for becoming.</p>
      </header>

      {/* Search + balance */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
            strokeWidth={2}
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the store — try toy, game, shoes…"
            aria-label="Search products"
            className="pl-9"
          />
        </div>
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent/15 px-3 py-2 text-sm font-semibold tabular-nums text-accent"
          title="Your Units balance"
        >
          <Coins className="size-4" strokeWidth={2.25} />
          {formatUnits(balance)}
        </div>
      </div>

      {products.length === 0 ? (
        /* Empty store — shelves being stocked */
        <Card className="overflow-hidden p-8 text-center">
          <div className="relative mx-auto grid size-20 place-items-center rounded-2xl bg-[linear-gradient(135deg,rgba(34,211,238,0.25),rgba(139,92,246,0.25),rgba(217,70,239,0.25))]">
            <Store className="size-10 text-accent" strokeWidth={1.6} />
          </div>
          <h2 className="mt-4 font-display text-xl font-semibold tracking-tight">
            The shelves are being stocked
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
            Our crew is picking the coolest kid-safe treasures for you. Come
            back soon — the grand opening is almost here!
          </p>
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
            <Package className="size-4" strokeWidth={2} />
            New arrivals landing daily
          </div>
        </Card>
      ) : searching && filtered.length === 0 ? (
        /* Search with no matches */
        <Card className="p-8 text-center">
          <SearchX
            className="mx-auto size-10 text-muted"
            strokeWidth={1.6}
          />
          <h2 className="mt-3 font-display text-lg font-semibold">
            Nothing found for &ldquo;{query.trim()}&rdquo;
          </h2>
          <p className="mt-1 text-sm text-muted">
            Try a different word — like toy, game, or shoes.
          </p>
        </Card>
      ) : (
        <>
          {featured && <HeroBanner product={featured} onSelect={onSelect} />}
          {searching ? (
            <div
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
              aria-label="Search results"
            >
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} onSelect={onSelect} />
              ))}
            </div>
          ) : (
            aisles.map((a) => (
              <AisleRow
                key={a.name}
                name={a.name}
                products={a.products}
                onSelect={onSelect}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}
