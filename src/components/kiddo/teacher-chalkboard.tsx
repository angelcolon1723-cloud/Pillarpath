import { useEffect, useRef, useState } from "react";
import { Eraser, Pen, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    lastPos.current = pos(e);
    setDrawing(true);
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
  };

  const stop = () => {
    setDrawing(false);
    lastPos.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
      <p className="px-4 py-2 text-xs text-muted">
        Draw with your finger or mouse — like a real chalkboard, for your lessons.
      </p>
    </Card>
  );
}
