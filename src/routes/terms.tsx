import { createFileRoute, Link } from "@tanstack/react-router";
import { LedgerMark } from "@/components/kiddo/mark";

export const Route = createFileRoute("/terms")({
  component: Terms,
});

function Terms() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="mb-6 flex items-center gap-2">
        <LedgerMark />
        <span className="font-display text-xl font-semibold">Pillarpath</span>
      </div>
      <h1 className="font-display text-3xl font-semibold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted">Last updated: 2026</p>
      <div className="mt-6 space-y-4 text-sm leading-6 text-muted">
        <p>
          Pillarpath provides parent-supervised financial education, chores and
          rewards, a Savings Vault, a controlled marketplace, Creative Studio,
          and teacher classroom tools. By using Pillarpath you agree to these
          terms.
        </p>
        <p>
          <strong className="text-ink">Parental responsibility.</strong> A
          parent or legal guardian must create and supervise every child
          account, verify parental consent, and approve marketplace purchases,
          chore rewards, and teacher classroom connections.
        </p>
        <p>
          <strong className="text-ink">PillarPath Units are not money.</strong>{" "}
          Units are educational rewards with no cash value. Loaded Units are
          non-refundable. Classroom Units awarded by teachers are a separate
          educational system and never convert to family Units or cash.
        </p>
        <p>
          <strong className="text-ink">Marketplace.</strong> Product
          availability, pricing, and fulfillment are subject to change.
          Physical goods are fulfilled by third-party suppliers; delivery times
          vary.
        </p>
        <p>
          <strong className="text-ink">Subscriptions.</strong> Paid plans renew
          automatically until cancelled. Cancel anytime from Settings; access
          continues until the end of the billing period.
        </p>
      </div>
      <Link to="/" className="mt-8 inline-block text-sm font-semibold text-accent">
        ← Back to Pillarpath
      </Link>
    </main>
  );
}
