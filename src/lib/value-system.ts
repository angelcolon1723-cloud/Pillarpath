import { CHORE_SEED } from "@/lib/chores";
import { UNITS_PER_DOLLAR } from "@/store/ledger";

/* ------------------------------------------------------------------ */
/* PillarPath spending value system — the single source of truth for     */
/* what Units are worth everywhere in the app.                          */
/*                                                                      */
/* One anchor rate: UNITS_PER_DOLLAR (100 Units = $1). Every price shown  */
/* to families carries three lenses: Units, dollar equivalent, and the   */
/* chore-effort it represents ("about N chores"). Kids learn the value   */
/* of work; parents see exactly what money means.                        */
/*                                                                      */
/* Three spending lanes:                                                */
/*  1. Creator Shop — kid-to-kid digital goods, Units only.              */
/*  2. PillarPath Store — physical goods; Units redeemable toward real   */
/*     products under REDEMPTION_RULES (the LLC funds redemptions, so    */
/*     guardrails keep it affordable AND profitable).                    */
/*  3. Vault CD — the saving lane; the alternative to spending.          */
/* ------------------------------------------------------------------ */

export { UNITS_PER_DOLLAR };

/** Average Units paid per chore across the seeded chore catalog. */
export const AVG_CHORE_REWARD =
  CHORE_SEED.reduce((sum, c) => sum + c.amount, 0) /
  Math.max(1, CHORE_SEED.length);

/** "This price costs about N chores of work." */
export function choresFor(units: number): number {
  return Math.max(1, Math.round(units / AVG_CHORE_REWARD));
}

/** Dollar value of a Units amount at the anchor rate. */
export function unitsToDollars(units: number): number {
  return units / UNITS_PER_DOLLAR;
}

/** Units needed to represent a dollar amount at the anchor rate. */
export function dollarsToUnits(dollars: number): number {
  return Math.round(dollars * UNITS_PER_DOLLAR);
}

/* ---------------- physical-store redemption rules ------------------ */
/*
 * When a kid redeems earned Units for a physical product, PillarPath pays
 * the supplier real money. These guardrails keep redemptions affordable
 * for families, meaningful for kids (chores -> real toy), and sustainable
 * for PillarPath Network Society LLC.
 */
export const REDEMPTION_RULES = {
  /** Units cover at most this fraction of any single physical purchase. */
  maxFractionPerOrder: 0.5,
  /** Max redemption value per child per calendar month, in dollars. */
  monthlyCapDollars: 25,
  /** Parent must approve every redemption — no exceptions. */
  parentApprovalRequired: true,
} as const;

/**
 * How many Units a child may apply to a physical order right now.
 * monthlyRedeemedDollars = dollar value the child already redeemed this month.
 */
export function maxRedeemableUnits(
  orderDollars: number,
  monthlyRedeemedDollars: number,
): number {
  const perOrderCap = dollarsToUnits(
    orderDollars * REDEMPTION_RULES.maxFractionPerOrder,
  );
  const monthlyRemaining = dollarsToUnits(
    Math.max(
      0,
      REDEMPTION_RULES.monthlyCapDollars - monthlyRedeemedDollars,
    ),
  );
  return Math.max(0, Math.min(perOrderCap, monthlyRemaining));
}
