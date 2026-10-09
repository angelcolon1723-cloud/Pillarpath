import { useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { authClient, signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { FieldLabel, Input } from "@/components/ui/input";

const ROLE_LABEL: Record<string, string> = {
  parent: "Parent account",
  teacher: "Teacher account",
  admin: "Admin account",
};

/**
 * The account-settings card shared by the parent Settings section and
 * the teacher Settings section: who you're signed in as, your account
 * type, change password, and sign out. Before this existed, both
 * settings sections only had profile/demo fields and none of the
 * actual account controls.
 */
export function AccountSettingsCard() {
  const user = useCurrentUser();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  const name = user.displayName ?? "Your account";
  const initial = name.charAt(0).toUpperCase() || "P";

  async function changePassword() {
    if (!current) {
      toast.error("Enter your current password.");
      return;
    }
    if (next.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      toast.error("New passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (error) {
        toast.error(
          error.message ||
            "Could not change your password. If you signed in with Google, your password lives with Google.",
        );
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password changed");
    } catch {
      toast.error("Could not change your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-2xl space-y-4 p-4">
      <CardTitle className="text-base">Account</CardTitle>
      <div className="flex items-center gap-3">
        {user.profileImageUrl ? (
          <img
            src={user.profileImageUrl}
            alt=""
            className="size-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent/25 text-lg font-bold">
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted">{user.primaryEmail ?? ""}</p>
        </div>
        <Badge tone="accent" className="ml-auto shrink-0">
          {ROLE_LABEL[user.role] ?? "Account"}
        </Badge>
      </div>

      {user.isDevFallback ? (
        <CardHint>
          You're in the preview account. Password and sign-out apply once you
          sign in with a real account.
        </CardHint>
      ) : (
        <>
          <div className="border-t border-white/10 pt-4">
            <p className="text-sm font-semibold">Change password</p>
            <p className="mt-0.5 text-xs text-muted">
              For accounts that signed up with an email and password. If you
              signed in with Google, change your password with Google.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <FieldLabel>Current password</FieldLabel>
                <Input
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div>
                <FieldLabel>New password</FieldLabel>
                <Input
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <FieldLabel>Confirm new password</FieldLabel>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <Button
              className="mt-3"
              disabled={busy}
              onClick={() => void changePassword()}
            >
              {busy ? "Changing…" : "Change password"}
            </Button>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-4">
            <div>
              <p className="text-sm font-semibold">Sign out</p>
              <p className="text-xs text-muted">
                You'll need to sign in again on this device.
              </p>
            </div>
            <Button variant="outline" onClick={() => void signOut()}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
