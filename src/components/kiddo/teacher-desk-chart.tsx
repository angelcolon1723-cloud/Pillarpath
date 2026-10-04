import { useState } from "react";
import { Shuffle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTeacher } from "@/store/teacher";
import { cn } from "@/lib/utils";

/**
 * Virtual desk chart board — the classroom seating chart.
 *
 * Each enrolled student gets a desk on the board. The teacher can shuffle
 * seats, reset the layout, and tap a desk to see who's sitting there.
 * Front of the class is marked where the teacher stands.
 */
export function TeacherDeskChart() {
  const students = useTeacher((s) => s.students);
  const classrooms = useTeacher((s) => s.classrooms);
  const [activeClassroomId, setActiveClassroomId] = useState<string | null>(null);
  const [seatOrder, setSeatOrder] = useState<string[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const classroomId = activeClassroomId ?? classrooms[0]?.id ?? null;
  const roster = students.filter((s) => !classroomId || s.classroomId === classroomId);
  const order = seatOrder ?? roster.map((s) => s.id);
  // Keep any new students appended, drop removed ones.
  const seats = [...order.filter((id) => roster.some((s) => s.id === id)),
    ...roster.map((s) => s.id).filter((id) => !order.includes(id))];

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

        {/* Teacher's spot — front of the class */}
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
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedId(active ? null : id)}
                  className={cn(
                    "rounded-2xl border p-3 text-left transition-all",
                    active
                      ? "border-accent bg-accent/10 shadow-lg"
                      : "border-border bg-surface hover:border-accent/40",
                  )}
                >
                  {/* desk */}
                  <div className="mx-auto mb-2 h-10 w-16 rounded-lg border border-border bg-surface-2" />
                  <p className="truncate text-center text-sm font-semibold">{s.name}</p>
                  <p className="text-center text-[10px] text-muted">Seat {i + 1}</p>
                </button>
              );
            })}
          </div>
        )}

        {selected && (
          <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{selected.name}</p>
              <Badge tone="muted" className="text-[10px]">
                Joined {new Date(selected.joinedAt).toLocaleDateString()}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted">
              Seat {seats.indexOf(selected.id) + 1} · Classroom Units and progress live under Students.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
