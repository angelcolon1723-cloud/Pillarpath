import { createFileRoute, Link } from "@tanstack/react-router";
import { PillarMark } from "@/components/kiddo/mark";

export const Route = createFileRoute("/terms")({
  component: Terms,
});

function Terms() {
  return (
    <main className="theme-landing min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-3xl px-5 py-10">
      <div className="mb-6 flex items-center gap-2">
        <PillarMark />
        <span className="font-display text-xl font-semibold">Pillarpath</span>
      </div>
      <h1 className="font-display text-3xl font-semibold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted">Last updated: 2026</p>
      <div className="mt-6 space-y-4 text-sm leading-6 text-muted">
        <p>
          Pillarpath provides parent-supervised financial education, chores and
          rewards, a Savings Vault and Vault CDs, a controlled marketplace,
          Creative Studio, and teacher classroom tools. By using Pillarpath
          you agree to these terms.
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
          non-refundable and cannot be converted to cash, with one exception:
          Units locked in a Vault CD that has reached maturity may be redeemed
          for cash strictly for qualified education expenses (such as tuition,
          books, and school fees). Maturity redemptions are requested by a
          parent, require an education-use attestation, carry no fees, and are
          processed by our licensed banking partner — no funds move until the
          partner completes review. Withdrawing a Vault CD before maturity is
          allowed, but forfeits 100% of accrued bonus Units; the principal
          returns to the family balance as Units, never as cash. Classroom
          Units awarded by teachers are a separate educational system and
          never convert to family Units or cash.
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
      </div>
    </main>
  );
}
