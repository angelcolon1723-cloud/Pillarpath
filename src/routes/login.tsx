import { useEffect, useState } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { authClient, clearOAuthInflight, signInDirect } from "@/lib/auth/client";
import { emailAndPasswordEnabled } from "@/lib/auth/email-password";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import {
  getLoginOtpState,
  requestLoginOtp,
  verifyLoginOtp,
} from "@/lib/auth/login-otp";
import {
  getEnabledSocialProviders,
  type SocialProviderInfo,
} from "@/lib/auth/social-providers-list";
import { PillarMark } from "@/components/kiddo/mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/login")({ component: LoginPage });

/**
 * Surfaces OAuth failures instead of silently bouncing to the landing page.
 * Better Auth redirects here as /login?error=<code> when the provider
 * callback fails (see signInDirect's errorCallbackURL).
 */
function OAuthErrorBanner() {
  const [code] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("error");
  });
  if (!code) return null;
  const friendly: Record<string, string> = {
    access_denied: "Google sign-in was cancelled or denied.",
    account_not_linked:
      "That Google account isn't linked to a PillarPath account yet.",
    state_mismatch:
      "Sign-in was started more than once — close any other PillarPath tabs, then tap your sign-in button just once.",
  };
  return (
    <div
      role="alert"
      className="mb-4 rounded-2xl border border-danger/40 bg-danger-soft p-4 text-sm"
    >
      <p className="font-semibold text-danger">
        {friendly[code] ?? "Sign-in didn't complete."}
      </p>
      <p className="mt-1 text-xs text-muted">
        Code: {code} — screenshot this and send it to support.
      </p>
    </div>
  );
}

function LoginPage() {
  return (
    <>
      <SignedIn>
        <SignedInRouter />
      </SignedIn>
      <SignedOut>
        <LoginForm />
      </SignedOut>
    </>
  );
}

/**
 * A signed-in visitor lands here instead of the app when their password login
 * still owes its 4-digit verification code (e.g. they closed the tab
 * mid-ceremony). Otherwise they go straight into the app.
 */
function SignedInRouter() {
  const [pending, setPending] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    getLoginOtpState()
      .then((s) => {
        if (!cancelled) setPending(s.required);
      })
      .catch(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (pending === null) return null;
  if (pending) return <OtpShell autoSend />;
  return <Navigate to="/" />;
}

/** Card shell shared by the OTP step (same look as the login card). */
function OtpShell({ autoSend }: { autoSend?: boolean }) {
  return (
    <main className="theme-landing min-h-dvh bg-bg px-5 py-8 text-ink">
      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-10">
        <section className="mx-auto w-full max-w-md rounded-[2rem] border border-border bg-surface p-6 shadow-[var(--shadow-border-hover)] sm:p-8">
          <div className="mb-2 flex items-center gap-3">
            <PillarMark />
            <span className="font-display text-2xl font-semibold">Pillarpath</span>
          </div>
          <OtpForm autoSend={autoSend} />
        </section>
      </div>
    </main>
  );
}

/**
 * The 4-digit email-code step of password login. `autoSend` requests a fresh
 * code on mount (used when resuming a pending ceremony); otherwise the parent
 * already sent one.
 */
function OtpForm({ autoSend }: { autoSend?: boolean }) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(autoSend ? null : Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!autoSend) return;
    let cancelled = false;
    requestLoginOtp()
      .then((r) => {
        if (!cancelled && r.sent) {
          setLastSentAt(Date.now());
          toast.success("Verification code sent to your email.");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Couldn't send the code.";
          // A cooldown error just means a recent code is still valid.
          if (!msg.includes("wait a minute")) toast.error(msg);
          else setLastSentAt(Date.now());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [autoSend]);

  useEffect(() => {
    if (lastSentAt === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [lastSentAt]);

  const cooldownLeft =
    lastSentAt === null
      ? 0
      : Math.max(0, 60 - Math.floor((now - lastSentAt) / 1000));

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{4}$/.test(code)) {
      toast.error("Enter the 4-digit code from your email.");
      return;
    }
    setBusy(true);
    try {
      await verifyLoginOtp({ data: { code } });
      toast.success("Verified — welcome in.");
      await navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    try {
      const r = await requestLoginOtp();
      if (r.sent) {
        setLastSentAt(Date.now());
        toast.success("New code sent to your email.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send a new code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-accent">
        <LockKeyhole className="size-4" />
        <span className="text-sm font-semibold">Check your email</span>
      </div>
      <h2 className="font-display text-3xl font-semibold">Enter your code</h2>
      <p className="mt-1 text-sm text-muted">
        We sent a 4-digit verification code to your email address. It expires in
        10 minutes.
      </p>
      <form className="mt-5 space-y-3" onSubmit={verify}>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="4-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          maxLength={4}
          required
          className="text-center text-2xl tracking-[0.5em]"
        />
        <Button className="h-12 w-full" disabled={busy}>
          {busy ? "Working…" : "Verify"}
          <ArrowRight className="size-4" />
        </Button>
      </form>
      <button
        type="button"
        disabled={busy || cooldownLeft > 0}
        onClick={() => void resend()}
        className="mt-4 min-h-11 w-full text-sm text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
      >
        {cooldownLeft > 0
          ? `Request a new code in ${cooldownLeft}s`
          : "Didn't get it? Send a new code"}
      </button>
    </div>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  // After a password sign-in the account owes its 4-digit email code before it
  // can enter the app ("credentials" -> "otp").
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  // A failed OAuth attempt must release the in-flight claim, or the guard in
  // signInDirect would keep blocking the retry.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error")) {
      clearOAuthInflight();
    }
  }, []);
  // Direct social providers configured on the server (env-driven). Null while
  // loading; empty when none are configured (email sign-in still works).
  const [providers, setProviders] = useState<SocialProviderInfo[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    getEnabledSocialProviders()
      .then((list) => {
        if (!cancelled) setProviders(list);
      })
      .catch(() => {
        if (!cancelled) setProviders([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function socialSignIn(provider: SocialProviderInfo) {
    setBusy(true);
    try {
      await signInDirect(provider, { callbackURL: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-in failed");
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      // Trim: mobile autofill often sneaks in trailing spaces, which fail
      // email validation and look like a broken signup form.
      const cleanEmail = email.trim();
      const cleanName = name.trim();
      if (mode === "signup") {
        if (password !== confirmPassword) {
          toast.error("Passwords don't match — please retype them.");
          setBusy(false);
          return;
        }
        const result = await authClient.signUp.email({
          name: cleanName,
          email: cleanEmail,
          password,
        });
        if (result.error) throw new Error(result.error.message);
      } else {
        const result = await authClient.signIn.email({
          email: cleanEmail,
          password,
        });
        if (result.error) throw new Error(result.error.message);
      }
      // The session cookie does not always reach the browser on TanStack Start
      // (see session-cookie-fix.server.ts). Navigating to "/" with no session
      // renders the landing page and looks like the login "didn't work", so
      // verify the session actually stuck before leaving this page.
      const { data: sessionData } = await authClient.getSession();
      if (!sessionData) {
        toast.error(
          "Signed in, but the session didn't save — please reload the page and try again.",
        );
        setBusy(false);
        return;
      }
      // Two-step: password logins owe a 4-digit email code before entering.
      // When email isn't configured the ceremony is inert and we go straight in.
      const otp = await requestLoginOtp();
      if (otp.sent) {
        setStep("otp");
        setBusy(false);
        return;
      }
      await navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Account request failed");
    } finally {
      setBusy(false);
    }
  }

  if (step === "otp") return <OtpShell />;

  return (
    <main className="theme-landing min-h-dvh bg-bg px-5 py-8 text-ink">
      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:block">
          <div className="mb-8 flex items-center gap-3">
            <PillarMark />
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
              <PillarMark />
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
          <OAuthErrorBanner />
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
              {mode === "signup" ? (
                <Input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                />
              ) : null}
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
          {providers !== null && providers.length > 0 ? (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-border" />
                <span>or continue with</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="grid gap-2">
                {(providers ?? []).map((provider) => (
                  <Button
                    key={provider.id}
                    variant="outline"
                    className="h-11 w-full"
                    disabled={busy}
                    onClick={() => void socialSignIn(provider)}
                  >
                    {provider.label}
                  </Button>
                ))}
              </div>
            </>
          ) : null}
          <button
            type="button"
            className="mt-5 min-h-11 w-full text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
            onClick={() => {
              setConfirmPassword("");
              setMode(mode === "signin" ? "signup" : "signin");
            }}
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
