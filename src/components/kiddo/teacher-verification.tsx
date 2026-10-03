import { useCallback, useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { getMyRole } from "@/lib/roles-server";
import { requestTeacherVerification } from "@/lib/teacher-server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { FieldLabel, Input } from "@/components/ui/input";

/**
 * Teacher verification client components.
 *
 * Server truth lives in `user.teacher_status` (read via `getMyRole`);
 * these components never take the client's word for it. Under the
 * teacher shell (`theme-teacher`) the accent tokens resolve to the
 * sapphire/blue teacher identity.
 */

export type TeacherVerificationStatus =
  | "verified"
  | "pending"
  | "rejected"
  | "unverified";

const KNOWN_STATUSES: TeacherVerificationStatus[] = [
  "verified",
  "pending",
  "rejected",
  "unverified",
];

function normalizeTeacherStatus(raw: string | null | undefined): TeacherVerificationStatus {
  return KNOWN_STATUSES.includes(raw as TeacherVerificationStatus)
    ? (raw as TeacherVerificationStatus)
    : "unverified";
}

/**
 * Live verification status for the signed-in teacher.
 * `status` is null while the first read is in flight; any missing,
 * unknown, or failed read resolves to 'unverified' (fail-closed).
 *
 * Note: this mirrors `teacherStatus` only. Render these components from
 * the teacher shell, where `role === "teacher"` is already established.
 */
export function useTeacherVerificationStatus(): {
  status: TeacherVerificationStatus | null;
  loading: boolean;
  refresh: () => void;
} {
  const [status, setStatus] = useState<TeacherVerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    getMyRole()
      .then((r) => setStatus(normalizeTeacherStatus(r.teacherStatus)))
      .catch(() => setStatus("unverified"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, loading, refresh };
}

const STATUS_TONE: Record<TeacherVerificationStatus, "accent" | "muted" | "warn" | "danger"> = {
  verified: "accent",
  pending: "warn",
  rejected: "danger",
  unverified: "muted",
};

/**
 * Prominent banner shown when the teacher is not yet verified.
 * Renders nothing (null) while loading or once `verified`.
 *
 * - 'unverified' / 'rejected' → explainer + verification form. Submit calls
 *   `requestTeacherVerification` (server enforces the upsert), toasts the
 *   result, then calls `onSubmitted()` so the parent can refresh status —
 *   the banner then flips to the pending state on its own.
 * - 'pending' → "Verification under review" state, no form.
 */
export function TeacherVerificationBanner({
  onSubmitted,
}: {
  onSubmitted: () => void;
}) {
  const { status, loading } = useTeacherVerificationStatus();

  if (loading || status === null || status === "verified") return null;

  if (status === "pending") {
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Verification under review</CardTitle>
              <Badge tone={STATUS_TONE.pending}>pending</Badge>
            </div>
            <CardHint className="mt-1">
              Your educator application is in. Our team reviews every
              application before student details, grades, and family messaging
              unlock. You&apos;ll see it here the moment you&apos;re approved.
            </CardHint>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-accent/30 p-5 shadow-[0_0_24px_-8px_var(--accent)]">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <ShieldCheck className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Verify your educator status</CardTitle>
            {status === "rejected" && (
              <Badge tone={STATUS_TONE.rejected}>rejected</Badge>
            )}
          </div>
          <CardHint className="mt-1">
            {status === "rejected"
              ? "Your previous application wasn't approved. Double-check your school and work email and submit again."
              : "PillarPath is for real educators. Once we verify you, student details, grades, and family messaging unlock."}
          </CardHint>
          <VerificationForm onSubmitted={onSubmitted} />
        </div>
      </div>
    </Card>
  );
}

function VerificationForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [school, setSchool] = useState("");
  const [district, setDistrict] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!school.trim() || !workEmail.trim()) {
      toast.error("Please add your school and work email.");
      return;
    }
    setSubmitting(true);
    try {
      await requestTeacherVerification({
        data: {
          school: school.trim(),
          district: district.trim(),
          workEmail: workEmail.trim(),
          notes: notes.trim(),
        },
      });
      toast.success("Verification request submitted — we'll review it shortly.");
      onSubmitted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="tv-school">School</FieldLabel>
          <Input
            id="tv-school"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            placeholder="e.g. Lincoln Elementary"
            autoComplete="organization"
          />
        </div>
        <div>
          <FieldLabel htmlFor="tv-district">District</FieldLabel>
          <Input
            id="tv-district"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="e.g. Springfield USD"
          />
        </div>
      </div>
      <div>
        <FieldLabel htmlFor="tv-work-email">Work email</FieldLabel>
        <Input
          id="tv-work-email"
          type="email"
          value={workEmail}
          onChange={(e) => setWorkEmail(e.target.value)}
          placeholder="you@yourschool.org"
          autoComplete="email"
        />
      </div>
      <div>
        <FieldLabel htmlFor="tv-notes">Notes (optional)</FieldLabel>
        <textarea
          id="tv-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Anything that helps us verify you — grade level, department…"
          className="w-full rounded-md bg-surface-2 px-3.5 py-2.5 text-sm text-ink shadow-[var(--shadow-border)] outline-none placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-accent/35"
        />
      </div>
      <Button
        className="w-full sm:w-auto"
        disabled={submitting}
        onClick={() => void submit()}
      >
        {submitting ? "Submitting…" : "Submit for verification"}
      </Button>
    </div>
  );
}

/**
 * Locked placeholder the integrator renders in place of Students, Records,
 * and Messages content until the teacher is verified. Self-contained —
 * no props beyond title/text.
 */
export function VerificationLockedSection({
  title,
  text,
}: {
  title: string;
  text?: string;
}) {
  return (
    <Card className="p-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent/10 text-accent">
        <Lock className="size-5" aria-hidden />
      </span>
      <CardTitle className="mt-4">{title}</CardTitle>
      <CardHint className="mx-auto mt-2 max-w-sm">
        {text ?? "Verify your educator status to unlock student details."}
      </CardHint>
    </Card>
  );
}
