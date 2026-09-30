import { useMemo, useState } from "react";
import { Check, Store, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Input, FieldLabel, NativeSelect } from "@/components/ui/input";
import { useSocial, type ShowcasePost } from "@/store/social";
import { CHORE_SEED } from "@/lib/chores";

/* ------------------------------------------------------------------ */
/* Creator Shop — Units only, no real money                             */
/*                                                                      */
/* Young creators list showcase pieces for PillarPath Units. Family     */
/* buys the work (parent approves every sale), and the creator earns    */
/* the price in family Units. The entrepreneurship lesson, with zero    */
/* legal risk: no payments, no payouts, no shipping.                    */
/* ------------------------------------------------------------------ */

const AVG_CHORE_REWARD =
  CHORE_SEED.reduce((sum, c) => sum + c.amount, 0) / Math.max(1, CHORE_SEED.length);

/** Pricing guidance: "this costs about N chores". */
export function choresFor(price: number): number {
  return Math.max(1, Math.round(price / AVG_CHORE_REWARD));
}

/* ------------------------- child: sell controls ------------------------- */

export function SellControls({ post }: { post: ShowcasePost }) {
  const listForSale = useSocial((s) => s.listForSale);
  const [price, setPrice] = useState("20");
  const [audience, setAudience] = useState<"family" | "classroom">("family");

  return (
    <div className="space-y-2 rounded-xl bg-surface-2 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>Price (Units)</FieldLabel>
          <Input
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Sell to</FieldLabel>
          <NativeSelect
            value={audience}
            onChange={(e) => setAudience(e.target.value as "family" | "classroom")}
          >
            <option value="family">Family</option>
            <option value="classroom">Classroom</option>
          </NativeSelect>
        </div>
      </div>
      {Number(price) > 0 ? (
        <p className="text-xs text-muted">
          ≈ {choresFor(Number(price))} chores of work — buyers see this too.
        </p>
      ) : null}
      <Button
        size="sm"
        className="w-full"
        onClick={() => {
          const err = listForSale(post.id, Number(price), audience);
          if (err) toast.error(err);
          else toast.success(`Listed for ${Math.max(1, Math.floor(Number(price)))} Units`);
        }}
      >
        <Tag className="size-3.5" />
        List for sale
      </Button>
    </div>
  );
}

/* ---------------------- parent: browse + buy listings --------------------- */

export function ParentCreatorShop() {
  const posts = useSocial((s) => s.posts);
  const requestShopPurchase = useSocial((s) => s.requestShopPurchase);

  const listings = useMemo(
    () => posts.filter((p) => p.status === "approved" && p.forSale),
    [posts],
  );

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
          <Store className="size-5" />
        </span>
        <div>
          <CardTitle className="text-base">Creator shop</CardTitle>
          <CardHint>
            Buy your child's creations with Units — they earn the price. Every
            purchase needs your approval.
          </CardHint>
        </div>
      </div>

      {listings.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted">
          Nothing for sale right now. Creations can be listed from the showcase.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {listings.map((p) => (
            <div
              key={p.id}
              className="overflow-hidden rounded-xl border border-border bg-surface"
            >
              <img
                src={p.dataUrl}
                alt={p.title}
                className="aspect-square w-full object-cover"
              />
              <div className="p-2.5">
                <p className="truncate text-sm font-semibold">{p.title}</p>
                <p className="text-xs text-muted">by {p.creatorName}</p>
                <p className="mt-1 text-xs font-semibold text-accent">
                  {p.price} Units · ≈{choresFor(p.price)} chores
                </p>
                <Button
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => {
                    const err = requestShopPurchase(p.id);
                    if (err) toast.error(err);
                    else toast.success("Purchase request created — approve it in Pending");
                  }}
                >
                  Buy
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ------------------- parent: pending shop order approvals ------------------ */

export function PendingShopRows() {
  const orders = useSocial((s) => s.shopOrders);
  const approveShopOrder = useSocial((s) => s.approveShopOrder);
  const denyShopOrder = useSocial((s) => s.denyShopOrder);

  const pending = orders.filter((o) => o.status === "pending");
  if (pending.length === 0) return null;

  return (
    <>
      {pending.map((o) => (
        <div key={o.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
            <Store className="size-5" strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{o.title}</div>
            <div className="text-xs text-muted">
              {o.price} Units (≈{choresFor(o.price)} chores) · {o.sellerName} earns it · Creator shop
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="success"
              size="icon-sm"
              aria-label="Approve"
              onClick={() => {
                const err = approveShopOrder(o.id);
                if (err) toast.error(err);
                else toast.success(`+${o.price} Units to ${o.sellerName}`);
              }}
            >
              <Check className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Deny"
              onClick={() => {
                denyShopOrder(o.id);
                toast.message("Sale denied");
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </>
  );
}
