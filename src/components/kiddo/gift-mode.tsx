import { useEffect, useState } from "react";
import { Gift, Plus, Loader2, X, PartyPopper, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  createGiftWish,
  listGiftWishes,
  contributeToWish,
  markWishGifted,
  deleteGiftWish,
  type GiftWish,
} from "@/lib/pillarpath-server";

const WISH_EMOJIS = ["🎁", "🚲", "🎮", "📚", "🧸", "⚽", "🎨", "💻", "🎸", "🐶", "✈️", "⭐"];

/**
 * Gift Mode — wishes tied to occasions, family chips in.
 * Contributions are pledges; the family fulfills in real life.
 */
export function GiftModePanel({ kids }: { kids: Array<{ id: number; name: string }> }) {
  const [wishes, setWishes] = useState<GiftWish[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🎁");
  const [cost, setCost] = useState("");
  const [occasion, setOccasion] = useState("");
  const [wishChildId, setWishChildId] = useState<number | null>(null);
  const [contrib, setContrib] = useState<Record<string, { name: string; amount: string; message: string }>>({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const r = await listGiftWishes();
      setWishes(r.wishes);
    } catch {
      setWishes([]);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    const cid = wishChildId ?? kids[0]?.id;
    const c = Math.floor(Number(cost));
    if (!cid) return toast.error("Pick a child.");
    if (!title.trim()) return toast.error("Name the wish.");
    if (!Number.isFinite(c) || c < 1) return toast.error("Cost must be at least 1 Unit.");
    setBusy(true);
    try {
      await createGiftWish({
        data: { childId: cid, title: title.trim(), emoji, costUnits: c, occasion: occasion.trim() || undefined },
      });
      toast.success("🎁 Wish added — share it with family!");
      setTitle(""); setCost(""); setOccasion(""); setEmoji("🎁"); setShowForm(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add wish.");
    } finally {
      setBusy(false);
    }
  };

  const contribute = async (wishId: string) => {
    const f = contrib[wishId] ?? { name: "", amount: "", message: "" };
    const amount = Math.floor(Number(f.amount));
    if (!f.name.trim()) return toast.error("Who's contributing?");
    if (!Number.isFinite(amount) || amount < 1) return toast.error("Enter an amount.");
    setBusy(true);
    try {
      await contributeToWish({
        data: { wishId, contributorName: f.name.trim(), amountUnits: amount, message: f.message.trim() || undefined },
      });
      setContrib((p) => ({ ...p, [wishId]: { name: "", amount: "", message: "" } }));
      await load();
      toast.success(`❤️ ${f.name.trim()} chipped in ${amount.toLocaleString()} Units!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't contribute.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (wish: GiftWish) => {
    if (!confirm(`Remove "${wish.title}"?`)) return;
    setBusy(true);
    try {
      await deleteGiftWish({ data: { wishId: wish.id } });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove.");
    } finally {
      setBusy(false);
    }
  };

  const set = (wishId: string, patch: Partial<{ name: string; amount: string; message: string }>) =>
    setContrib((p) => ({ ...p, [wishId]: { ...(p[wishId] ?? { name: "", amount: "", message: "" }), ...patch } }));

  const open = wishes?.filter((w) => w.status === "open") ?? [];
  const funded = wishes?.filter((w) => w.status === "funded") ?? [];

  async function markGifted(wishId: string) {
    setBusy(true);
    try {
      await markWishGifted({ data: { wishId } });
      await load();
      toast.success("Marked as gifted 🎉");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <Gift className="size-4 text-accent" />
          Gift mode
        </h2>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          <Plus className="size-3.5" /> New wish
        </Button>
      </div>

      {showForm && (
        <Card className="space-y-3 p-4">
          {kids.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {kids.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setWishChildId(k.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold shadow-[var(--shadow-float)] transition-all duration-150 active:scale-95",
                    (wishChildId ?? kids[0]?.id) === k.id
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border text-muted",
                  )}
                >
                  {k.name}
                </button>
              ))}
            </div>
          )}
          <Input placeholder="Wish — e.g. LEGO castle" value={title}
            onChange={(e) => setTitle(e.target.value)} maxLength={60} />
          <div className="flex flex-wrap gap-1.5">
            {WISH_EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => setEmoji(e)}
                className={cn("grid size-9 place-items-center rounded-xl border text-lg",
                  emoji === e ? "border-accent bg-accent/15" : "border-border")}>
                {e}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" min={1} placeholder="Cost in Units" value={cost}
              onChange={(e) => setCost(e.target.value)} />
            <Input placeholder="Occasion — e.g. Birthday 🎂" value={occasion}
              onChange={(e) => setOccasion(e.target.value)} maxLength={40} />
          </div>
          <Button className="w-full" onClick={create} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "🎁 Add wish"}
          </Button>
        </Card>
      )}

      {wishes === null && <p className="text-sm text-muted">Loading wishes…</p>}
      {wishes !== null && open.length === 0 && !showForm && (
        <div className="rounded-xl bg-surface-2 p-4 text-center">
          <p className="text-2xl">🎁</p>
          <p className="mt-1 text-sm font-semibold">No wishes yet</p>
          <p className="mt-0.5 text-xs text-muted">
            Add a wish for a birthday or holiday — family can chip in.
          </p>
        </div>
      )}

      {open.map((w) => {
        const f = contrib[w.id] ?? { name: "", amount: "", message: "" };
        return (
          <div key={w.id} className="rounded-xl border border-border p-3">
            <div className="flex items-start gap-2">
              <span className="text-2xl">{w.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{w.title}</p>
                <p className="text-xs text-muted">
                  {w.childName}
                  {w.occasion ? ` · ${w.occasion}` : ""} ·{" "}
                  {w.fundedUnits.toLocaleString()} / {w.costUnits.toLocaleString()} Units
                </p>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${w.progressPct}%` }} />
                </div>
              </div>
              <button type="button" onClick={() => remove(w)} disabled={busy}
                className="rounded-xl p-1 text-muted shadow-[var(--shadow-float)] transition-all duration-150 active:scale-95 hover:text-red-500" aria-label="Remove wish">
                <Trash2 className="size-3.5" />
              </button>
            </div>

            {w.contributions.length > 0 && (
              <div className="mt-2 space-y-1">
                {w.contributions.map((c) => (
                  <p key={c.id} className="text-xs text-muted">
                    ❤️ <span className="font-semibold text-ink">{c.contributorName}</span>{" "}
                    chipped in {c.amountUnits.toLocaleString()} Units
                    {c.message ? ` — “${c.message}”` : ""}
                  </p>
                ))}
              </div>
            )}

            <div className="mt-2 grid grid-cols-2 gap-2">
              <Input placeholder="Your name" value={f.name}
                onChange={(e) => set(w.id, { name: e.target.value })} maxLength={40} />
              <Input type="number" min={1} placeholder="Units" value={f.amount}
                onChange={(e) => set(w.id, { amount: e.target.value })} />
            </div>
            <div className="mt-2 flex gap-2">
              <Input placeholder="Message (optional)" value={f.message}
                onChange={(e) => set(w.id, { message: e.target.value })}
                maxLength={120} className="flex-1" />
              <Button size="sm" onClick={() => contribute(w.id)} disabled={busy}>
                Chip in
              </Button>
            </div>
          </div>
        );
      })}

      {funded.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            Fully funded — confirm the gift
          </p>
          {funded.map((w) => (
            <div key={w.id} className="rounded-xl border border-accent/40 bg-accent/5 p-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{w.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{w.title}</p>
                  <p className="text-xs text-muted">
                    {w.childName} · {w.fundedUnits.toLocaleString()} / {w.costUnits.toLocaleString()} Units pledged
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">
                Pledges are in — did you buy it? Confirm below once the gift is in hand.
              </p>
              <Button size="sm" className="mt-2 w-full" onClick={() => markGifted(w.id)} disabled={busy}>
                <PartyPopper className="size-3.5" /> Gift purchased — mark as gifted
              </Button>
            </div>
          ))}
        </div>
      )}

      {wishes !== null && wishes.some((w) => w.status === "gifted") && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer font-semibold">
            <PartyPopper className="mr-1 inline size-3.5" />
            Gifted wishes
          </summary>
          <div className="mt-2 space-y-1">
            {wishes.filter((w) => w.status === "gifted").map((w) => (
              <p key={w.id}>
                {w.emoji} {w.title} — {w.childName}
                {w.occasion ? ` · ${w.occasion}` : ""}
              </p>
            ))}
          </div>
        </details>
      )}
    </Card>
  );
}
