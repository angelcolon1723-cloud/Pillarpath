import { useState } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";
import { emailAndPasswordEnabled } from "@/lib/auth/email-password";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { LedgerMark } from "@/components/kiddo/mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  return (
    <>
      <SignedIn>
        <Navigate to="/" />
      </SignedIn>
      <SignedOut>
        <LoginForm />
      </SignedOut>
    </>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const result = await authClient.signUp.email({ name, email, password });
        if (result.error) throw new Error(result.error.message);
      } else {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) throw new Error(result.error.message);
      }
      await navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Account request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-bg px-5 py-8 text-ink">
      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:block">
          <div className="mb-8 flex items-center gap-3">
            <LedgerMark />
            <span className="font-display text-2xl font-semibold">Pillarpath</span>
          </div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            Family commerce + financial learning
          </p>
          <h1 className="max-w-2xl font-display text-6xl font-semibold leading-[0.98] tracking-tight">
            One family account for earning, saving, shopping, and creating.
          </h1>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {(
              [
                ["Parent control", "Approvals, budgets, profiles"],
                ["Kid-safe store", "Curated products + Units"],
                ["Studio tracks", "Spark to Atelier by age"],
              ] as const
            ).map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-border bg-surface p-4">
                <CheckCircle2 className="mb-4 size-5 text-accent" />
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="mx-auto w-full max-w-md rounded-[2rem] border border-border bg-surface p-6 shadow-[var(--shadow-border-hover)] sm:p-8">
          <div className="mb-6 lg:hidden">
            <div className="mb-4 flex items-center gap-3">
              <LedgerMark />
              <span className="font-display text-2xl font-semibold">Pillarpath</span>
            </div>
            <p className="text-sm text-muted">Family commerce and financial learning.</p>
          </div>
          <div className="mb-6">
            <div className="mb-2 flex items-center gap-2 text-accent">
              <LockKeyhole className="size-4" />
              <span className="text-sm font-semibold">Secure family account</span>
            </div>
            <h2 className="font-display text-3xl font-semibold">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Use your account to keep family data and orders synced.
            </p>
          </div>
          {emailAndPasswordEnabled ? (
            <form className="space-y-3" onSubmit={submit}>
              {mode === "signup" ? (
                <Input
                  placeholder="Parent name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              ) : null}
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <Button className="h-12 w-full" disabled={busy}>
                {busy
                  ? "Working…"
                  : mode === "signin"
                    ? "Sign in"
                    : "Create account"}
                <ArrowRight className="size-4" />
              </Button>
            </form>
          ) : null}
          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            <span>or continue with</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="grid gap-2">
            {GROK_PROVIDERS.map((provider) => (
              <Button
                key={provider.providerId}
                variant="outline"
                className="h-11 w-full"
                onClick={() => void signIn(provider.providerId, { callbackURL: "/" })}
              >
                {provider.label}
              </Button>
            ))}
          </div>
          <button
            type="button"
            className="mt-5 min-h-11 w-full text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin"
              ? "New to Pillarpath? Create an account"
              : "Already have an account? Sign in"}
          </button>
          <p className="mt-6 text-center text-xs leading-5 text-subtle">
            By continuing, you agree to use Pillarpath for family commerce and
            supervised child experiences.
          </p>
        </section>
      </div>
    </main>
  );
}
