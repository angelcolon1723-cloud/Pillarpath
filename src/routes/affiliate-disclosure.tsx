import { createFileRoute, Link } from "@tanstack/react-router";
import { LedgerMark } from "@/components/kiddo/mark";

export const Route = createFileRoute("/affiliate-disclosure")({
  component: Disclosure,
});

function Disclosure() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="mb-6 flex items-center gap-2">
        <LedgerMark />
        <span className="font-display text-xl font-semibold">Pillarpath</span>
      </div>
      <h1 className="font-display text-3xl font-semibold">Affiliate Disclosure</h1>
      <p className="mt-2 text-sm text-muted">Last updated: 2026</p>
      <div className="mt-6 space-y-4 text-sm leading-6 text-muted">
        <p>
          Some products and links in the Pillarpath Marketplace may be provided
          through affiliate or partner programs. When you make a qualifying
          purchase through one of these links, Pillarpath may earn a commission
          at no extra cost to you.
        </p>
        <p>
          We only surface products we believe are appropriate for families.
          Affiliate relationships never influence chore rewards, classroom
          Units, or educational content, and child-facing experiences always
          remain consistent with applicable advertising and child-protection
          requirements.
        </p>
        <p>
          A product is only described as an official partner integration when a
          real business relationship exists.
        </p>
      </div>
      <Link to="/" className="mt-8 inline-block text-sm font-semibold text-accent">
        ← Back to Pillarpath
      </Link>
    </main>
  );
}
