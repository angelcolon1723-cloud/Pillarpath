/**
 * Market-aware retail price suggestions (shared client + server).
 *
 * Starts from cost-plus pricing (supplier cost + margin), then clamps the
 * result into a typical US market band for the product's category so a
 * shelf price never looks absurd next to Target/Amazon. Charm-priced
 * ($X.99 endings).
 */

export interface PriceSuggestion {
  cents: number;
  /** Set when the cost-plus price was pulled into the market band. */
  clamped: "low" | "high" | null;
  /** Human category label, e.g. "kids' hoodies". */
  category: string;
}

interface Band {
  match: RegExp;
  low: number;
  high: number;
  label: string;
}

const BANDS: Band[] = [
  { match: /hoodie/i, low: 3999, high: 4999, label: "kids' hoodies" },
  { match: /sweatshirt/i, low: 3499, high: 4499, label: "kids' sweatshirts" },
  { match: /jersey/i, low: 2999, high: 4999, label: "kids' jerseys" },
  { match: /legging/i, low: 2999, high: 3999, label: "kids' leggings" },
  { match: /lounge|jogger|\bpants\b/i, low: 2999, high: 4499, label: "kids' lounge pants" },
  { match: /tumbler|mug|bottle/i, low: 2499, high: 3499, label: "kids' tumblers" },
  { match: /puzzle/i, low: 1999, high: 2499, label: "kids' puzzles" },
  { match: /tee|t-shirt|tshirt/i, low: 1999, high: 2499, label: "kids' tees" },
];

const FALLBACK_BAND: Band = {
  match: /.*/,
  low: 1499,
  high: 4999,
  label: "kids' apparel",
};

/** 2437 -> 2399 ($24.37 -> $23.99). */
function charm(cents: number): number {
  return Math.max(199, Math.round(cents / 100) * 100 - 1);
}

export function suggestRetailPrice(
  title: string,
  costCents: number,
  marginPct = 40,
): PriceSuggestion {
  const band = BANDS.find((b) => b.match.test(title)) ?? FALLBACK_BAND;
  const base = Math.round(costCents * (1 + marginPct / 100));
  if (base < band.low)
    return { cents: charm(band.low), clamped: "low", category: band.label };
  if (base > band.high)
    return { cents: charm(band.high), clamped: "high", category: band.label };
  return { cents: charm(base), clamped: null, category: band.label };
}

/**
 * Fallback suggestion when supplier cost is unknown: midpoint of the
 * category's typical market band, charm-priced. Lets King publish
 * products that arrived without cost data.
 */
export function suggestRetailPriceNoCost(title: string): PriceSuggestion {
  const band = BANDS.find((b) => b.match.test(title)) ?? FALLBACK_BAND;
  const mid = Math.round((band.low + band.high) / 2);
  return { cents: charm(mid), clamped: null, category: band.label };
}
