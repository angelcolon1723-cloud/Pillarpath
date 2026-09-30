import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout/success")({
  validateSearch: (search: Record<string, unknown>) => ({ order: typeof search.order === "string" ? search.order : undefined }),
  component: CheckoutSuccess,
});

function CheckoutSuccess() {
  const search = Route.useSearch();
  return <main className="theme-landing grid min-h-dvh place-items-center bg-bg px-5 text-ink"><section className="w-full max-w-md rounded-[2rem] border border-border bg-surface p-8 text-center shadow-[var(--shadow-border-hover)]"><div className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-accent-soft text-accent"><CheckCircle2 className="size-8" /></div><h1 className="font-display text-3xl font-semibold">Order received</h1><p className="mt-2 text-sm text-muted">Your Pillarpath order {search.order ? `#${search.order}` : ""} has been created. Payment confirmation and supplier fulfillment will update the order status.</p><div className="my-6 flex items-center justify-center gap-2 text-sm text-accent"><PackageCheck className="size-4" /> Fulfillment pipeline ready</div><Link to="/"><Button className="w-full">Return to Pillarpath</Button></Link></section></main>;
}
