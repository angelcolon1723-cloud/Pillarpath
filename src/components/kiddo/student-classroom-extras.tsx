import { useEffect, useState } from "react";
import { Hand, BarChart3, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  raiseHand,
  lowerHand,
  getMyHandStatus,
  getOpenPoll,
  answerPoll,
  type QuickPoll,
} from "@/lib/teacher-server";

/**
 * Student classroom extras: raise hand + answer live polls.
 *
 * Sits in the child's classroom view. Raise hand joins the teacher's
 * queue; open polls appear as tappable options with live feedback.
 */
export function StudentClassroomExtras({
  classroomId,
  studentId,
  studentName,
}: {
  classroomId: string;
  studentId: string;
  studentName: string;
}) {
  const [handRaised, setHandRaised] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [poll, setPoll] = useState<QuickPoll | null>(null);
  const [answering, setAnswering] = useState(false);

  const refreshHand = async () => {
    try {
      const r = await getMyHandStatus({ data: { classroomId, studentId } });
      setHandRaised(r.raised);
      setPosition(r.position);
    } catch {
      /* offline */
    }
  };

  const refreshPoll = async () => {
    try {
      const r = await getOpenPoll({ data: { classroomId, studentId } });
      setPoll(r.poll);
    } catch {
      /* offline */
    }
  };

  useEffect(() => {
    void refreshHand();
    void refreshPoll();
    const t = setInterval(() => {
      void refreshHand();
      void refreshPoll();
    }, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroomId, studentId]);

  const toggleHand = async () => {
    try {
      if (handRaised) {
        await lowerHand({ data: { classroomId, studentId } });
        setHandRaised(false);
        setPosition(null);
      } else {
        await raiseHand({ data: { classroomId, studentId, studentName } });
        toast.success("✋ Hand raised — the teacher sees you.");
        await refreshHand();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't raise hand.");
    }
  };

  const answer = async (optionIndex: number) => {
    if (!poll || answering) return;
    setAnswering(true);
    try {
      await answerPoll({ data: { pollId: poll.id, studentId, studentName, optionIndex } });
      await refreshPoll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't submit answer.");
    } finally {
      setAnswering(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        onClick={toggleHand}
        variant={handRaised ? "default" : "outline"}
        className="w-full"
      >
        <Hand className="size-4" />
        {handRaised
          ? position
            ? `Hand raised — you're #${position} in line`
            : "Hand raised — tap to lower"
          : "✋ Raise hand"}
      </Button>

      {poll && (
        <Card className="border-accent/40 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent">
            <BarChart3 className="size-3.5" /> Live poll
          </p>
          <p className="mt-1 font-semibold">{poll.question}</p>
          <div className="mt-3 space-y-2">
            {poll.options.map((opt, i) => {
              const chosen = poll.myChoice === i;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={answering}
                  onClick={() => answer(i)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-all",
                    chosen
                      ? "border-accent bg-accent/15 font-semibold"
                      : "border-border bg-bg hover:border-accent/40",
                  )}
                >
                  <span>{opt}</span>
                  {chosen && <Check className="size-4 shrink-0 text-accent" />}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            {poll.totalResponses} {poll.totalResponses === 1 ? "vote" : "votes"} so far
            {poll.myChoice !== null ? " · you voted" : ""}
          </p>
        </Card>
      )}
    </div>
  );
}
