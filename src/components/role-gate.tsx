import { cloneElement, isValidElement, useEffect, useState } from "react";
import { GraduationCap, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PillarMark } from "@/components/kiddo/mark";
import { chooseRole, getMyRole, type MyRole } from "@/lib/roles-server";

/**
 * Four-sided accounts — the one-time post-signup gate.
 *
 * Rendered for every signed-in account whose `role_set_at` is NULL (brand-new
 * signups AND pre-four-sided accounts like the beta). The choice is final and
 * server-enforced: `chooseRole` refuses to run twice.
 *
 * Only parent/teacher are offered. Children never hold accounts (COPPA) —
 * parents create child profiles later. Admin is invite-only (Phase 4).
 */
export function RoleGate({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<MyRole | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [otpRedirect, setOtpRedirect] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyRole()
      .then((r) => {
        if (!cancelled) setRole(r);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "unknown error";
        // A password login that still owes its 4-digit code is NOT an
        // account failure — the code screen lives on /login (SignedInRouter
        // shows it for exactly this state). Route there instead of
        // dead-ending on the error screen (the brother's OTP_REQUIRED wall).
        if (msg.includes("OTP_REQUIRED")) {
          setOtpRedirect(true);
          window.location.assign("/login");
          return;
        }
        setFailed(msg);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (otpRedirect) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-5 text-center text-ink">
        <div>
          <p className="font-display text-xl font-semibold">One more step</p>
          <p className="mt-2 text-sm text-muted">
            Taking you to verify your sign-in…
          </p>
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-5 text-center text-ink">
        <div>
          <p className="font-display text-xl font-semibold">Couldn&rsquo;t load your account</p>
          <p className="mt-2 text-sm text-muted">Check your connection and try again.</p>
          <p className="mt-2 text-xs text-muted/70">Detail: {failed}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-ink">
        <div className="text-center">
          <div className="mx-auto mb-4">
            <PillarMark className="size-14" />
          </div>
          <p className="font-display text-2xl font-semibold">Pillarpath</p>
          <p className="mt-1 text-sm text-muted">Setting up your account…</p>
        </div>
      </div>
    );
  }

  if (!role.roleChosen) {
    return <RolePicker />;
  }

  // This point is reached only after the choice is recorded, so `role` is
  // DB-fresh server truth. Hand it to the app shell so it opens in the right
  // workspace on first paint — the shell must never guess from a hardcoded
  // default or the (up-to-5-minutes-stale) session cookie cache.
  if (isValidElement<{ initialRole?: MyRole["role"] }>(children)) {
    return <>{cloneElement(children, { initialRole: role.role })}</>;
  }

  return <>{children}</>;
}

function RolePicker() {
  const [busy, setBusy] = useState<"parent" | "teacher" | null>(null);

  async function pick(choice: "parent" | "teacher") {
    setBusy(choice);
    try {
      await chooseRole({ data: { role: choice } });
      // Full reload: picks up the fresh session (role is in the session
      // cookie cache for up to 5 minutes otherwise).
      window.location.href = "/";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your choice");
      setBusy(null);
    }
  }

  return (
    <div className="theme-landing grid min-h-dvh place-items-center bg-bg px-5 py-10 text-ink">
      <div className="w-full max-w-2xl">
        <div className="text-center">
          <div className="mx-auto mb-5 w-fit">
            <PillarMark className="size-16" />
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            Who is this account for?
          </h1>
          <p className="mx-auto mt-3 max-w-md leading-7 text-muted">
            PillarPath has a separate world for parents and teachers. Pick
            yours — this keeps every family&rsquo;s and classroom&rsquo;s data
            in the right hands.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Card className="flex flex-col p-6">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-accent/15">
              <Users className="size-6 text-accent" />
            </span>
            <h2 className="mt-4 font-display text-2xl font-semibold">I&rsquo;m a Parent</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted">
              Run your family&rsquo;s money world: chores, Units, the Vault,
              and approvals. You&rsquo;ll create profiles for your kids next —
              they never sign up on their own.
            </p>
            <Button
              className="mt-5 w-full"
              disabled={busy !== null}
              onClick={() => pick("parent")}
            >
              {busy === "parent" ? "Setting up…" : "Continue as Parent"}
            </Button>
          </Card>

          <Card className="flex flex-col p-6">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-accent/15">
              <GraduationCap className="size-6 text-accent" />
            </span>
            <h2 className="mt-4 font-display text-2xl font-semibold">I&rsquo;m a Teacher</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted">
              Run your classroom: join codes, lessons, assignments, and
              records. Teacher accounts are verified before they can see
              student details.
            </p>
            <Button
              className="mt-5 w-full"
              variant="outline"
              disabled={busy !== null}
              onClick={() => pick("teacher")}
            >
              {busy === "teacher" ? "Setting up…" : "Continue as Teacher"}
            </Button>
          </Card>
        </div>

        <p className="mx-auto mt-6 flex max-w-md items-start gap-2 text-center text-xs leading-5 text-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
          Kids get their own login later, created by a parent — they never
          create accounts themselves. This choice can only be changed by our
          support team.
        </p>
      </div>
    </div>
  );
}
