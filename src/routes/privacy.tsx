import { createFileRoute, Link } from "@tanstack/react-router";
import { PillarMark } from "@/components/kiddo/mark";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
});

function Privacy() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="mb-6 flex items-center gap-2">
        <PillarMark />
        <span className="font-display text-xl font-semibold">Pillarpath</span>
      </div>
      <h1 className="font-display text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated: 2026</p>
      <div className="mt-6 space-y-4 text-sm leading-6 text-muted">
        <p>
          Pillarpath is a parent-controlled financial education platform. We
          collect the minimum information needed to run the service: account
          details for parents, supervised child profiles created by parents,
          and educational activity for connected teacher classrooms.
        </p>
        <p>
          <strong className="text-ink">Children's privacy.</strong> Child
          accounts are created and managed by a verified parent. We do not
          sell children's information, and teacher access is limited to
          educational data (assignments, progress, classroom rewards) — never
          family balances, bank details, or private marketplace activity.
        </p>
        <p>
          <strong className="text-ink">PillarPath Units.</strong> Units are an
          internal educational reward system, not money, currency, or a
          stored-value product. They cannot be purchased for cash or redeemed
          for cash except through the parent-controlled Savings Vault maturity
          process described in the app.
        </p>
        <p>
          <strong className="text-ink">Data use.</strong> We use data to
          operate the app, process parent-approved marketplace orders, and
          improve the service. Parents can review, correct, or delete their
          family's data by contacting support.
        </p>
      </div>
      <Link to="/" className="mt-8 inline-block text-sm font-semibold text-accent">
        ← Back to Pillarpath
      </Link>
    </main>
  );
}
