import { useEffect, useMemo, useState } from "react";
import { Shuffle, RotateCcw, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTeacher } from "@/store/teacher";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
  "bg-violet-500/20 text-violet-300 border-violet-400/40",
  "bg-cyan-500/20 text-cyan-300 border-cyan-400/40",
  "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
  "bg-amber-500/20 text-amber-300 border-amber-400/40",
  "bg-pink-500/20 text-pink-300 border-pink-400/40",
  "bg-blue-500/20 text-blue-300 border-blue-400/40",
];

function avatarColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** How long a response counts as "just happened" (pulsing desk). */
const FRESH_MS = 5 * 60 * 1000;
/** Live refresh cadence for the chart. */
const POLL_MS = 20_000;

/**
 * Virtual desk chart board — the living classroom seating chart.
 *
 * Every student gets a desk with their avatar and name. When a student
 * responds to a lesson (submits an assignment), a popup appears on their
 * desk — fresh responses pulse so the teacher sees them the moment they
 * land. Polls for new activity every 20 seconds.
 */
export function TeacherDeskChart() {
  const students = useTeacher((s) => s.students);
  const submissions = useTeacher((s) => s.submissions);
  const assignments = useTeacher((s) => s.assignments);
  const classrooms = useTeacher((s) => s.classrooms);
  const loadFromServer = useTeacher((s) => s.loadFromServer);
  const [activeClassroomId, setActiveClassroomId] = useState<string | null>(null);
  const [seatOrder, setSeatOrder] = useState<string[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Live updates: refresh classroom data on a cadence so response popups
  // appear without the teacher reloading.
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      void loadFromServer().catch(() => {});
    }, POLL_MS);
    return () => clearInterval(t);
  }, [loadFromServer]);

  const classroomId = activeClassroomId ?? classrooms[0]?.id ?? null;
  const roster = students.filter((s) => !classroomId || s.classroomId === classroomId);
  const order = seatOrder ?? roster.map((s) => s.id);
  const seats = [...order.filter((id) => roster.some((s) => s.id === id)),
    ...roster.map((s) => s.id).filter((id) => !order.includes(id))];

  /** Latest unreviewed response per student. */
  const responses = useMemo(() => {
    const map = new Map<string, { assignmentTitle: string; at: number; fresh: boolean }>();
    for (const sub of submissions) {
      if (sub.status !== "submitted") continue;
      const at = new Date(sub.submittedAt).getTime();
      const prev = map.get(sub.studentId);
      if (!prev || at > prev.at) {
        const a = assignments.find((x) => x.id === sub.assignmentId);
        map.set(sub.studentId, {
          assignmentTitle: a?.title ?? "a lesson",
          at,
          fresh: now - at < FRESH_MS,
        });
      }
    }
    return map;
  }, [submissions, assignments, now]);

  const shuffle = () => {
    const shuffled = [...seats];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setSeatOrder(shuffled);
  };

  const reset = () => setSeatOrder(null);
  const selected = roster.find((s) => s.id === selectedId) ?? null;
  const responding = [...responses.keys()].filter((id) => seats.includes(id)).length;

  return (
    <div className="space-y-4">
      {classrooms.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {classrooms.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={classroomId === c.id ? "default" : "outline"}
              onClick={() => { setActiveClassroomId(c.id); setSeatOrder(null); setSelectedId(null); }}
            >
              {c.name}
            </Button>
          ))}
        </div>
      )}

      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold">Desk chart</h3>
            <p className="text-xs text-muted">
              {roster.length === 0
                ? "No students enrolled yet — desks appear as they join."
                : `${roster.length} ${roster.length === 1 ? "desk" : "desks"}`}
              {responding > 0 && (
                <span className="ml-2 font-semibold text-accent">
                  · {responding} responding
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={shuffle} disabled={seats.length < 2}>
              <Shuffle className="size-3.5" /> Shuffle
            </Button>
            <Button size="sm" variant="ghost" onClick={reset} disabled={!seatOrder}>
              <RotateCcw className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <div className="rounded-xl border-2 border-dashed border-accent/50 bg-accent/10 px-6 py-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Teacher</p>
          </div>
        </div>

        {roster.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            Share your 6-letter class code and students will take their seats here.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {seats.map((id, i) => {
              const s = roster.find((r) => r.id === id);
              if (!s) return null;
              const active = selectedId === id;
              const resp = responses.get(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedId(active ? null : id)}
                  className={cn(
                    "relative rounded-2xl border p-3 text-left transition-all",
                    active
                      ? "border-accent bg-accent/10 shadow-lg"
                      : "border-border bg-surface hover:border-accent/40",
                    resp?.fresh && "animate-pulse border-accent",
                  )}
                >
                  {/* response popup */}
                  {resp && (
                    <span
                      className="absolute -top-2.5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold text-white shadow-lg"
                      title={`Responded to ${resp.assignmentTitle}`}
                    >
                      <MessageSquareText className="size-3" />
                      Responded!
                    </span>
                  )}
                  {/* avatar */}
                  <div
                    className={cn(
                      "mx-auto mb-1.5 flex size-11 items-center justify-center rounded-full border-2 text-sm font-bold",
                      avatarColor(s.name),
                    )}
                  >
                    {initials(s.name)}
                  </div>
                  {/* desk */}
                  <div className="mx-auto mb-1.5 h-8 w-14 rounded-lg border border-border bg-surface-2" />
                  <p className="truncate text-center text-sm font-semibold">{s.name}</p>
                  <p className="text-center text-[10px] text-muted">Seat {i + 1}</p>
                </button>
              );
            })}
          </div>
        )}

        {selected && (
          <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 p-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-10 items-center justify-center rounded-full border-2 text-sm font-bold",
                  avatarColor(selected.name),
                )}
              >
                {initials(selected.name)}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{selected.name}</p>
                <p className="text-xs text-muted">
                  Seat {seats.indexOf(selected.id) + 1} · Joined{" "}
                  {new Date(selected.joinedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            {(() => {
              const resp = responses.get(selected.id);
              return resp ? (
                <p className="mt-2 rounded-xl bg-accent/10 px-3 py-2 text-xs">
                  💬 Responded to <span className="font-semibold">{resp.assignmentTitle}</span>{" "}
                  {resp.fresh ? "just now" : new Date(resp.at).toLocaleTimeString()} — review it
                  under Assignments.
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted">
                  No pending responses. Classroom Units and progress live under Students.
                </p>
              );
            })()}
          </div>
        )}
      </Card>
    </div>
  );
}
