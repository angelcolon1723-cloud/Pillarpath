import {
  choresFor,
  unitsToDollars,
} from "@/lib/value-system";

/* ------------------------------------------------------------------ */
/* PriceTag — every price in the app speaks the same three-lens language */
/* Units · dollar equivalent · chore-effort.                             */
/* ------------------------------------------------------------------ */

export function PriceTag({
  units,
  showChores = true,
  className = "",
}: {
  units: number;
  showChores?: boolean;
  className?: string;
}) {
  const dollars = unitsToDollars(units);
  return (
    <span className={className}>
      {Math.round(units).toLocaleString()} Units · ≈$
      {dollars.toFixed(dollars < 10 ? 2 : 0)}
      {showChores ? ` · ≈${choresFor(units)} chores` : ""}
    </span>
  );
}

/** Compact tag for tight spaces: "1,200 Units (≈$12)". */
export function PriceTagShort({
  units,
  className = "",
}: {
  units: number;
  className?: string;
}) {
  const dollars = unitsToDollars(units);
  return (
    <span className={className}>
      {Math.round(units).toLocaleString()} Units (≈$
      {dollars.toFixed(dollars < 10 ? 2 : 0)})
    </span>
  );
}
