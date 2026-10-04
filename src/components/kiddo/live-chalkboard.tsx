import { useEffect, useRef, useState } from "react";
import { Radio, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTeacher } from "@/store/teacher";
import {
  getLiveChalkboardSession,
  getChalkboardStrokes,
  type LiveChalkboardSession,
  type ChalkboardStroke,
} from "@/lib/teacher-server";

const POLL_MS = 1500;

/**
 * Student-side live chalkboard.
 *
 * Shows a pulsing LIVE banner whenever the teacher is broadcasting to one
 * of the student's classrooms. Tapping it opens the viewer, which polls
 * for new strokes and renders them in near-real-time.
 */
export function LiveChalkboardBanner() {
  const classrooms = useTeacher((s) => s.classrooms);
  const students = useTeacher((s) => s.students);
  const [session, setSession] = useState<LiveChalkboardSession | null>(null);
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const classroomIds = classrooms.map((c) => c.id);
    if (!classroomIds.length) return;
    const check = async () => {
      try {
        const r = await getLiveChalkboardSession({ data: { classroomIds } });
        if (!cancelled) {
          setSession((prev) => {
            // If the session ended while watching, close the viewer.
            if (prev && !r.session && watching) setWatching(false);
            return r.session;
          });
        }
      } catch {
        /* offline — keep last known state */
      }
    };
    void check();
    const t = setInterval(check, POLL_MS * 2);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [classrooms, watching]);

  // Only show to students who are actually enrolled (not the teacher preview).
  const isEnrolled = students.length > 0;
  if (!session || !isEnrolled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setWatching(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-left transition-transform active:scale-[0.98]"
      >
        <span className="relative flex size-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex size-3 rounded-full bg-red-500" />
        </span>
        <div className="flex-1">
          <p className="font-semibold text-red-200">🔴 {session.teacherName} is live</p>
          <p className="text-xs text-red-200/70">{session.title} — tap to watch the board</p>
        </div>
        <Radio className="size-5 text-red-400" />
      </button>
      {watching && (
        <ChalkboardViewer session={session} onClose={() => setWatching(false)} />
      )}
    </>
  );
}

function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: ChalkboardStroke,
  w: number,
  h: number,
) {
  if (stroke.points.length < 2) return;
  ctx.globalCompositeOperation = stroke.eraser ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = (stroke.eraser ? stroke.size * 2 : stroke.size) * (w / 800);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = stroke.eraser ? "transparent" : stroke.color;
  ctx.shadowBlur = stroke.eraser ? 0 : 4;
  ctx.beginPath();
  stroke.points.forEach(([x, y], i) => {
    const px = x * w;
    const py = y * h;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = "source-over";
}

function ChalkboardViewer({
  session,
  onClose,
}: {
  session: LiveChalkboardSession;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ended, setEnded] = useState(false);
  const lastSeq = useRef(-1);
  const drawnSeqs = useRef(new Set<number>());

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    sizeCanvas();

    const draw = (strokes: ChalkboardStroke[]) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      // Re-render from scratch if canvas was resized mid-session.
      for (const st of strokes) {
        if (drawnSeqs.current.has(st.seq)) continue;
        drawnSeqs.current.add(st.seq);
        renderStroke(ctx, st, rect.width, rect.height);
        if (st.seq > lastSeq.current) lastSeq.current = st.seq;
      }
    };

    const poll = async () => {
      try {
        const r = await getChalkboardStrokes({
          data: { sessionId: session.id, afterSeq: lastSeq.current },
        });
        if (cancelled) return;
        if (r.strokes.length) draw(r.strokes);
        if (!r.live) setEnded(true);
      } catch {
        /* offline — retry next tick */
      }
    };

    // Initial load: fetch everything from the beginning.
    void poll();
    const t = setInterval(poll, POLL_MS);
    window.addEventListener("resize", sizeCanvas);
    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener("resize", sizeCanvas);
    };
  }, [session.id]);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#0a0f1e]">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 p-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">
              {ended ? "Broadcast ended" : `🔴 ${session.teacherName} — live`}
            </p>
            <p className="text-[11px] text-white/50">{session.title}</p>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close viewer">
          <X className="size-4" />
        </Button>
      </div>
      <div
        className="flex-1"
        style={{
          background: "#1e293b",
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.04) 40px)",
        }}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
      {ended && (
        <p className="border-t border-white/10 p-3 text-center text-xs text-white/50">
          The teacher ended this broadcast. The board above is the final state.
        </p>
      )}
    </div>
  );
}
