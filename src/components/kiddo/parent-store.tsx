import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AISLE_HINTS,
  AISLE_ICONS,
  AISLE_ORDER,
  aisleFor,
  type AisleName,
} from "@/components/kiddo/storefront";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, FieldLabel } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  addToCart,
  createCheckout,
  getCart,
  getMarketplaceProducts,
  setCartQuantity,
  type CartItem,
  type MarketplaceProduct,
} from "@/lib/pillarpath-server";
import { cn } from "@/lib/utils";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/* ------------------------------------------------------------------ */
/* Product card — parent version: dollar price, add to cart            */
/* ------------------------------------------------------------------ */

function ParentProductCard({
  product,
  onAdd,
}: {
  product: MarketplaceProduct;
  onAdd: (product: MarketplaceProduct) => void;
}) {
  const outOfStock = product.stockQuantity <= 0;
  return (
    <Card className="flex w-40 shrink-0 snap-start flex-col overflow-hidden p-0 sm:w-44">
      <div className="relative aspect-square w-full overflow-hidden bg-surface-2">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted">
            <ShoppingBag className="size-10" strokeWidth={1.4} />
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 grid place-items-center bg-bg/60">
            <Badge tone="muted">Out of stock</Badge>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-center gap-1.5">
          <Badge tone="accent" className="text-[10px]">
            Kid-safe screened
          </Badge>
        </div>
        <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">
          {product.name}
        </h3>
        <p className="mt-1 text-sm font-bold text-accent tabular-nums">
          {money(product.retailPriceCents)}
        </p>
        {!outOfStock && product.stockQuantity <= 5 && (
          <p className="mt-0.5 text-[11px] font-medium text-amber-500">
            Only {product.stockQuantity} left
          </p>
        )}
        <Button
          size="sm"
          className="mt-2 w-full"
          disabled={outOfStock}
          onClick={() => onAdd(product)}
        >
          <ShoppingCart className="size-3.5" />
          Add to cart
        </Button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Aisle row — same layout as kid's store                              */
/* ------------------------------------------------------------------ */

function ParentAisleRow({
  name,
  products,
  onAdd,
}: {
  name: AisleName;
  products: MarketplaceProduct[];
  onAdd: (product: MarketplaceProduct) => void;
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
          <ParentProductCard key={p.id} product={p} onAdd={onAdd} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Cart drawer                                                         */
/* ------------------------------------------------------------------ */

function CartDrawer({
  open,
  items,
  onClose,
  onUpdateQty,
  onCheckout,
}: {
  open: boolean;
  items: CartItem[];
  onClose: () => void;
  onUpdateQty: (productId: string, quantity: number) => void;
  onCheckout: () => void;
}) {
  const subtotal = items.reduce((s, i) => s + i.retailPriceCents * i.quantity, 0);
  const shipping = subtotal >= 7500 || subtotal === 0 ? 0 : 799;
  const total = subtotal + shipping;

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Shopping cart">
      <div
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="font-display text-xl font-semibold">
            Your cart{" "}
            <span className="text-sm font-normal text-muted">
              ({items.reduce((s, i) => s + i.quantity, 0)})
            </span>
          </h2>
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close cart">
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <ShoppingCart className="mx-auto size-12 text-muted" strokeWidth={1.4} />
                <p className="mt-4 font-semibold">Your cart is empty</p>
                <p className="mt-1 text-sm text-muted">
                  Add some goodies for the kids.
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.productId} className="flex gap-3">
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="grid size-full place-items-center text-muted">
                        <ShoppingBag className="size-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="text-sm text-accent tabular-nums">
                      {money(item.retailPriceCents)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() => onUpdateQty(item.productId, item.quantity - 1)}
                        aria-label="Decrease quantity"
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <span className="min-w-6 text-center text-sm font-semibold tabular-nums">
                        {item.quantity}
                      </span>
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() => onUpdateQty(item.productId, item.quantity + 1)}
                        aria-label="Increase quantity"
                      >
                        <Plus className="size-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => onUpdateQty(item.productId, 0)}
                        aria-label="Remove item"
                        className="ml-auto text-muted hover:text-danger"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">
                    {money(item.retailPriceCents * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        {items.length > 0 && (
          <div className="border-t border-border p-5">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span className="tabular-nums">{money(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span className="flex items-center gap-1.5">
                  <Truck className="size-3.5" /> Shipping
                </span>
                <span className="tabular-nums">
                  {shipping === 0 ? "Free" : money(shipping)}
                </span>
              </div>
              {shipping > 0 && (
                <p className="text-xs text-muted">
                  Free shipping on orders over {money(7500)}
                </p>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums">{money(total)}</span>
              </div>
            </div>
            <Button className="mt-4 w-full" size="lg" onClick={onCheckout}>
              Checkout
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Checkout form — shipping address, then Stripe                       */
/* ------------------------------------------------------------------ */

function CheckoutForm({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postal, setPostal] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return toast.error("Enter a valid email.");
    if (!name.trim() || !line1.trim() || !city.trim() || !state.trim() || !postal.trim()) {
      return toast.error("Fill in every shipping field.");
    }
    setBusy(true);
    try {
      const res = await createCheckout({
        data: {
          email: email.trim(),
          shippingName: name.trim(),
          shippingAddress: {
            line1: line1.trim(),
            city: city.trim(),
            state: state.trim(),
            postalCode: postal.trim(),
          },
        },
      });
      if (res.mode === "stripe" && res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        toast.success("Order created — payment step coming right up.");
        onDone();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4">
        ← Back to store
      </Button>
      <Card className="p-6">
        <h2 className="font-display text-2xl font-semibold">Shipping details</h2>
        <p className="mt-1 text-sm text-muted">
          Where should we send your order? Payment is handled securely by
          Stripe on the next step.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <FieldLabel htmlFor="co-email">Email</FieldLabel>
            <Input
              id="co-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <FieldLabel htmlFor="co-name">Full name</FieldLabel>
            <Input
              id="co-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              required
            />
          </div>
          <div>
            <FieldLabel htmlFor="co-line1">Street address</FieldLabel>
            <Input
              id="co-line1"
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              placeholder="123 Main St, Apt 4"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="co-city">City</FieldLabel>
              <Input
                id="co-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Springfield"
                required
              />
            </div>
            <div>
              <FieldLabel htmlFor="co-state">State</FieldLabel>
              <Input
                id="co-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="IL"
                required
              />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="co-postal">ZIP code</FieldLabel>
            <Input
              id="co-postal"
              value={postal}
              onChange={(e) => setPostal(e.target.value)}
              placeholder="62701"
              inputMode="numeric"
              required
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? "Setting up payment…" : "Continue to payment"}
            <ChevronRight className="size-4" />
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="size-3.5 text-accent" />
            Secure checkout powered by Stripe
          </p>
        </form>
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Main parent store                                                   */
/* ------------------------------------------------------------------ */

export function ParentStore() {
  const [products, setProducts] = useState<MarketplaceProduct[] | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState(false);
  const [cartBounce, setCartBounce] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const res = await getMarketplaceProducts({});
      setProducts(res.products);
    } catch {
      setProducts([]);
    }
  }, []);

  const loadCart = useCallback(async () => {
    try {
      const res = await getCart({});
      setCart(res.items);
    } catch {
      setCart([]);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
    void loadCart();
  }, [loadProducts, loadCart]);

  const aisles = useMemo(() => {
    if (!products) return [];
    const groups = new Map<AisleName, MarketplaceProduct[]>();
    const seen = new Set<string>();
    for (const p of products) {
      const key = p.name
        .toLowerCase()
        .replace(/[’‘`]/g, "'")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (seen.has(key)) continue;
      seen.add(key);
      const aisle = aisleFor(p.category, p.name);
      const list = groups.get(aisle);
      if (list) list.push(p);
      else groups.set(aisle, [p]);
    }
    return AISLE_ORDER.filter((a) => (groups.get(a)?.length ?? 0) > 0).map(
      (a) => ({ name: a, products: groups.get(a) ?? [] }),
    );
  }, [products]);

  async function handleAdd(product: MarketplaceProduct) {
    try {
      await addToCart({ data: { productId: product.id, quantity: 1 } });
      await loadCart();
      setCartBounce(true);
      setTimeout(() => setCartBounce(false), 400);
      toast.success(`Added "${product.name}" to cart`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add to cart.");
    }
  }

  async function handleUpdateQty(productId: string, quantity: number) {
    try {
      await setCartQuantity({ data: { productId, quantity } });
      await loadCart();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update cart.");
    }
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  if (checkoutMode) {
    return (
      <CheckoutForm
        onBack={() => setCheckoutMode(false)}
        onDone={() => {
          setCheckoutMode(false);
          void loadCart();
        }}
      />
    );
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            The Society Store
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Shop for the family
          </h1>
          <p className="mt-1 text-sm text-muted">
            Real products, real prices — buy directly with your card. No Units,
            no approvals needed. Perfect for birthdays and surprises.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setCartOpen(true)}
          className={cn("relative shrink-0", cartBounce && "scale-110")}
          aria-label={`Open cart, ${cartCount} items`}
        >
          <ShoppingCart className="size-4" />
          {cartCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
              {cartCount}
            </span>
          )}
        </Button>
      </div>

      {/* Trust strip */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-accent" /> Kid-safe screened
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-accent" /> Secure Stripe checkout
        </span>
        <span className="flex items-center gap-1.5">
          <Truck className="size-3.5 text-accent" /> Free shipping over $75
        </span>
      </div>

      {/* Aisles */}
      {products === null ? (
        <p className="py-10 text-center text-sm text-muted">Loading the shelves…</p>
      ) : aisles.length === 0 ? (
        <Card className="p-10 text-center">
          <ShoppingBag className="mx-auto size-10 text-muted" strokeWidth={1.4} />
          <h2 className="mt-4 font-display text-xl font-semibold">
            Shelves are being stocked
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            The Society is curating products. Check back soon — new arrivals
            land regularly.
          </p>
        </Card>
      ) : (
        aisles.map(({ name, products: aisleProducts }) => (
          <ParentAisleRow
            key={name}
            name={name}
            products={aisleProducts}
            onAdd={handleAdd}
          />
        ))
      )}

      <CartDrawer
        open={cartOpen}
        items={cart}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onCheckout={() => {
          setCartOpen(false);
          setCheckoutMode(true);
        }}
      />
    </section>
  );
}
