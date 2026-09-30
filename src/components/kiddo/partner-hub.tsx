import { Handshake, PlugZap, Truck, Megaphone, Store, Palette } from "lucide-react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PARTNER_INTEGRATIONS, type PartnerKind } from "@/lib/partner-integrations";

const icons: Record<PartnerKind, typeof Handshake> = { marketing: Megaphone, dropshipping: Truck, commerce: Store, creative: Palette };

export function PartnerHubView() {
  return (
    <section className="space-y-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">PillarPath ecosystem</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Marketing & fulfillment partners</h2><p className="mt-2 max-w-3xl text-sm text-muted">A centralized connector catalog for the companies and services that can support PillarPath's family-commerce mission. Providers shown here are integration targets; a provider is not represented as an existing affiliate unless its connection is actually configured.</p></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PARTNER_INTEGRATIONS.map((partner) => { const Icon = icons[partner.kind]; return <Card key={partner.id} className="p-5"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent"><Icon className="size-5" /></span><div className="min-w-0 flex-1"><CardTitle className="text-base">{partner.name}</CardTitle><CardHint className="mt-1">{partner.description}</CardHint></div><Badge tone={partner.status === "ready" ? "accent" : "muted"}>{partner.status === "ready" ? "Ready" : "Configure"}</Badge></div><div className="mt-4 flex items-center gap-2 text-xs text-muted"><PlugZap className="size-3.5" /> Server secret: <code>{partner.envKey}</code></div></Card>; })}
      </div>
      <Card className="border-accent/20 bg-accent-soft p-5"><div className="flex items-start gap-3"><Handshake className="mt-0.5 size-5 text-accent" /><div><CardTitle className="text-base">Safe integration rule</CardTitle><CardHint className="mt-1">Keep provider keys server-side. Parent-facing marketing must be consent-aware, and child experiences should never expose supplier credentials, affiliate IDs, or ad-platform tokens.</CardHint></div></div></Card>
    </section>
  );
}
