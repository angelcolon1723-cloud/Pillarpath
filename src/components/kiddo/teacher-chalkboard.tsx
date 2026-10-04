import { useEffect, useRef, useState } from "react";
import { Eraser, Pen, Trash2, Download, Radio, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTeacher } from "@/store/teacher";
import {
  startChalkboardSession,
  endChalkboardSession,
  pushChalkboardStrokes,
  clearChalkboardSession,
  type LiveChalkboardSession,
} from "@/lib/teacher-server";

const COLORS = [
  "#ffffff", // chalk white
  "#fde68a", // yellow
  "#86efac", // green
  "#93c5fd", // blue
  "#f9a8d4", // pink
  "#fdba74", // orange
];

const SIZES = [3, 6, 12];

/**
 * Digital chalkboard — a canvas the teacher draws on with chalk-like strokes.
 * Pen colors, eraser, clear, and download as PNG.
 */
export function TeacherChalkboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [erasing, setErasing] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const classrooms = useTeacher((s) => s.classrooms);
  const [live, setLive] = useState<LiveChalkboardSession | null>(null);
  const [goingLive, setGoingLive] = useState(false);
  const pendingStrokes = useRef<{ color: string; size: number; eraser: boolean; points: [number, number][] }[]>([]);
  const currentStroke = useRef<{ color: string; size: number; eraser: boolean; points: [number, number][] } | null>(null);
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Size the canvas to its container once mounted.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  }, []);

  const pos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const normPos = (e: React.PointerEvent): [number, number] => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    ];
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    lastPos.current = pos(e);
    setDrawing(true);
    if (live) {
      currentStroke.current = { color, size, eraser: erasing, points: [normPos(e)] };
    }
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const p = pos(e);
    const last = lastPos.current ?? p;
    ctx.globalCompositeOperation = erasing ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = erasing ? size * 2 : size;
    // Slight chalk texture: draw with a soft shadow
    ctx.shadowColor = erasing ? "transparent" : color;
    ctx.shadowBlur = erasing ? 0 : 4;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    lastPos.current = p;
    if (live && currentStroke.current) {
      const np = normPos(e);
      const pts = currentStroke.current.points;
      const lastPt = pts[pts.length - 1];
      // Thin out points: only keep if moved enough (saves bandwidth).
      if (!lastPt || Math.hypot(np[0] - lastPt[0], np[1] - lastPt[1]) > 0.004) {
        pts.push(np);
      }
    }
  };

  const stop = () => {
    setDrawing(false);
    lastPos.current = null;
    if (live && currentStroke.current && currentStroke.current.points.length > 1) {
      pendingStrokes.current.push(currentStroke.current);
    }
    currentStroke.current = null;
  };

  useEffect(() => {
    if (!live) return;
    flushTimer.current = setInterval(async () => {
      const batch = pendingStrokes.current.splice(0, pendingStrokes.current.length);
      if (!batch.length) return;
      try {
        await pushChalkboardStrokes({ data: { sessionId: live.id, strokes: batch } });
      } catch {
        // Re-queue on failure; strokes are never silently dropped.
        pendingStrokes.current.unshift(...batch);
      }
    }, 1000);
    return () => {
      if (flushTimer.current) clearInterval(flushTimer.current);
    };
  }, [live]);

  const goLive = async () => {
    const classroomId = classrooms[0]?.id;
    if (!classroomId) {
      toast.error("Create a classroom first, then go live.");
      return;
    }
    setGoingLive(true);
    try {
      const r = await startChalkboardSession({ data: { classroomId } });
      setLive(r.session);
      toast.success("🔴 You're live — students can watch now.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not go live.");
    } finally {
      setGoingLive(false);
    }
  };

  const endLive = async () => {
    if (!live) return;
    // Flush remaining strokes before closing.
    const batch = pendingStrokes.current.splice(0, pendingStrokes.current.length);
    try {
      if (batch.length) {
        await pushChalkboardStrokes({ data: { sessionId: live.id, strokes: batch } });
      }
      await endChalkboardSession({ data: { sessionId: live.id } });
    } catch {
      /* session ends regardless */
    }
    setLive(null);
    toast.message("Broadcast ended.");
  };

  const clear = async () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (live) {
      try {
        await clearChalkboardSession({ data: { sessionId: live.id } });
      } catch {
        /* local clear still applies */
      }
    }
  };

  const download = () => {
    const canvas = canvasRef.current!;
    // Composite onto the dark board color so the PNG isn't transparent.
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const octx = out.getContext("2d")!;
    octx.fillStyle = "#1e293b";
    octx.fillRect(0, 0, out.width, out.height);
    octx.drawImage(canvas, 0, 0);
    const a = document.createElement("a");
    a.download = "chalkboard.png";
    a.href = out.toDataURL("image/png");
    a.click();
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <Button
          size="sm"
          variant={erasing ? "outline" : "default"}
          onClick={() => setErasing(false)}
          aria-label="Pen"
        >
          <Pen className="size-4" />
        </Button>
        <Button
          size="sm"
          variant={erasing ? "default" : "outline"}
          onClick={() => setErasing(true)}
          aria-label="Eraser"
        >
          <Eraser className="size-4" />
        </Button>
        <div className="mx-1 h-6 w-px bg-border" />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => { setColor(c); setErasing(false); }}
            className={cn(
              "size-7 rounded-full border-2 transition-transform",
              color === c && !erasing ? "scale-110 border-accent" : "border-white/20",
            )}
            style={{ backgroundColor: c }}
            aria-label={`Chalk color ${c}`}
          />
        ))}
        <div className="mx-1 h-6 w-px bg-border" />
        {SIZES.map((sz) => (
          <button
            key={sz}
            type="button"
            onClick={() => setSize(sz)}
            className={cn(
              "flex size-7 items-center justify-center rounded-full border",
              size === sz ? "border-accent bg-accent/15" : "border-border",
            )}
            aria-label={`Stroke size ${sz}`}
          >
            <span
              className="rounded-full bg-white"
              style={{ width: sz, height: sz }}
            />
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {live ? (
            <Button size="sm" variant="danger" onClick={endLive}>
              <Square className="size-3.5" /> End live
            </Button>
          ) : (
            <Button size="sm" variant="default" onClick={goLive} disabled={goingLive}>
              <Radio className="size-3.5" /> {goingLive ? "Going live…" : "Go live"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={download} aria-label="Download board">
            <Download className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={clear} aria-label="Clear board">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <div
        className="relative touch-none select-none"
        style={{
          background: "#1e293b",
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.04) 40px)",
        }}
      >
        <canvas
          ref={canvasRef}
          className="block h-[420px] w-full cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerLeave={stop}
        />
      </div>
      {live && (
        <div className="flex items-center gap-2 border-b border-red-500/30 bg-red-500/10 px-4 py-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
          </span>
          <p className="text-xs font-semibold text-red-300">
            LIVE — {live.teacherName} is broadcasting to the classroom
          </p>
        </div>
      )}
      <p className="px-4 py-2 text-xs text-muted">
        Draw with your finger or mouse — like a real chalkboard, for your lessons.
        {live ? " Students see every stroke as you draw." : " Tap Go live to broadcast to your class."}
      </p>
    </Card>
  );
}
