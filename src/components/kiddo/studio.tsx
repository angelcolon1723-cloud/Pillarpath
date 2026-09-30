import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Eraser,
  Grid3x3,
  Home,
  Redo2,
  Sailboat,
  Save,
  Smile,
  Star,
  Sun,
  Trash2,
  TreePine,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { NativeSelect } from "@/components/ui/input";
import { useLedger } from "@/store/ledger";
import {
  STUDIO_BANDS,
  STUDIO_SWATCHES,
  bandForAge,
  missionProgress,
  nextBand,
  nextMission,
  toolsFor,
  type StudioMission,
  type StudioRoomId,
  type StudioToolId,
} from "@/lib/studio-path";
import { cn } from "@/lib/utils";
import { StudioHub, StudioRoomView } from "@/components/kiddo/studio-rooms";

type Tool = "brush" | StudioToolId;

const PAPER = "#f4f4f1";
const CANVAS_H = 288;

function drawStamp(
  ctx: CanvasRenderingContext2D,
  tool: StudioToolId,
  x: number,
  y: number,
  color: string,
  scale: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const s = scale;
  if (tool === "stamp-sun") {
    ctx.beginPath();
    ctx.arc(0, 0, s * 10, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 14, Math.sin(a) * s * 14);
      ctx.lineTo(Math.cos(a) * s * 20, Math.sin(a) * s * 20);
      ctx.stroke();
    }
  } else if (tool === "stamp-house") {
    ctx.beginPath();
    ctx.moveTo(-s * 16, s * 6);
    ctx.lineTo(-s * 16, s * 18);
    ctx.lineTo(s * 16, s * 18);
    ctx.lineTo(s * 16, s * 6);
    ctx.lineTo(0, -s * 14);
    ctx.closePath();
    ctx.stroke();
  } else if (tool === "stamp-smile") {
    ctx.beginPath();
    ctx.arc(0, 0, s * 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-s * 5, -s * 3, s * 1.6, 0, Math.PI * 2);
    ctx.arc(s * 5, -s * 3, s * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, s * 2, s * 7, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (tool === "stamp-tree") {
    ctx.beginPath();
    ctx.moveTo(0, -s * 18);
    ctx.lineTo(s * 12, s * 8);
    ctx.lineTo(-s * 12, s * 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-s * 2.5, s * 8, s * 5, s * 10);
  } else if (tool === "stamp-star") {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const fn = i === 0 ? ctx.moveTo.bind(ctx) : ctx.lineTo.bind(ctx);
      fn(Math.cos(a) * s * 14, Math.sin(a) * s * 14);
    }
    ctx.closePath();
    ctx.fill();
  } else if (tool === "stamp-boat") {
    ctx.beginPath();
    ctx.moveTo(-s * 16, s * 4);
    ctx.lineTo(s * 16, s * 4);
    ctx.lineTo(s * 10, s * 14);
    ctx.lineTo(-s * 10, s * 14);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, s * 4);
    ctx.lineTo(0, -s * 16);
    ctx.lineTo(s * 12, s * 2);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

const STAMP_BUTTONS: Array<[StudioToolId, typeof Sun, string]> = [
  ["stamp-sun", Sun, "Sun"],
  ["stamp-house", Home, "House"],
  ["stamp-smile", Smile, "Smile"],
  ["stamp-tree", TreePine, "Tree"],
  ["stamp-star", Star, "Star"],
  ["stamp-boat", Sailboat, "Boat"],
];

export function StudioScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const undoStack = useRef<ImageData[]>([]);
  const [color, setColor] = useState<string>(STUDIO_SWATCHES[0]);
  const [tool, setTool] = useState<Tool>("brush");
  const [missionId, setMissionId] = useState<string | null>(null);
  const [room, setRoom] = useState<StudioRoomId>("hub");

  const role = useLedger((s) => s.role);
  const childAge = useLedger((s) => s.childAge);
  const setChildAge = useLedger((s) => s.setChildAge);
  const saveDrawing = useLedger((s) => s.saveDrawing);
  const drawings = useLedger((s) => s.drawings);
  const completedMissionIds = useLedger((s) => s.completedMissionIds ?? []);
  const studioXp = useLedger((s) => s.studioXp ?? 0);
  const completeStudioMission = useLedger((s) => s.completeStudioMission);
  const setScreen = useLedger((s) => s.setScreen);
  const touchStudioStreak = useLedger((s) => s.touchStudioStreak);

  useEffect(() => {
    touchStudioStreak();
  }, [touchStudioStreak]);

  const band = bandForAge(childAge);
  const progress = missionProgress(band, completedMissionIds);
  const current = useMemo(() => {
    if (missionId) {
      return band.missions.find((m) => m.id === missionId) ?? nextMission(band, completedMissionIds);
    }
    return nextMission(band, completedMissionIds);
  }, [band, completedMissionIds, missionId]);
  const tools = toolsFor(band.id, completedMissionIds);
  const stretch = progress.complete ? nextBand(band.id) : null;
  const swatches = STUDIO_SWATCHES.slice(0, band.id === "spark" ? 4 : band.id === "maker" ? 6 : 8);
  const brushSize = tool === "crayon" ? 14 : tool === "fine" ? 2.5 : 7;

  useEffect(() => {
    const open = nextMission(band, completedMissionIds);
    setMissionId(open?.id ?? band.missions[0]?.id ?? null);
  }, [band, completedMissionIds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const fit = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(CANVAS_H * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${CANVAS_H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, rect.width, CANVAS_H);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      undoStack.current = [];
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [band.id]);

  function snapshot() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStack.current.length > 16) undoStack.current.shift();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const pos = (e: MouseEvent | TouchEvent) => {
      const r = canvas.getBoundingClientRect();
      const t = "touches" in e ? e.touches[0] : e;
      if (!t) return null;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };

    const start = (e: MouseEvent | TouchEvent) => {
      if ("touches" in e) e.preventDefault();
      const p = pos(e);
      if (!p) return;
      snapshot();
      if (String(tool).startsWith("stamp-")) {
        drawStamp(ctx, tool as StudioToolId, p.x, p.y, color, brushSize / 7);
        return;
      }
      drawing.current = true;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.moveTo(p.x, p.y);
    };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawing.current) return;
      if ("touches" in e) e.preventDefault();
      const p = pos(e);
      if (!p) return;
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    const end = () => {
      drawing.current = false;
    };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);
    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
    };
  }, [color, tool, brushSize]);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    snapshot();
    const r = canvas.getBoundingClientRect();
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, r.width, CANVAS_H);
  };

  const undo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const last = undoStack.current.pop();
    if (!canvas || !ctx || !last) return;
    ctx.putImageData(last, 0, 0);
  };

  const save = (mission?: StudioMission) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    saveDrawing(canvas.toDataURL("image/png"), {
      missionId: mission?.id,
      title: mission?.title,
    });
    toast.success(mission ? `${mission.title} saved` : "Piece saved to this device");
  };

  const finishMission = () => {
    if (!current) return;
    save(current);
    const err = completeStudioMission(current.id, current.xp);
    if (err) toast.message(err);
    else toast.success(`Mission complete · +${current.xp} studio XP`);
  };

  const stamps = STAMP_BUTTONS.filter(([id]) => tools.has(id));

  if (room !== "color") {
    return (
      <div className="screen-enter space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted">Creative Studio</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {band.name} studio
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted">{band.pitch}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{band.ages}</Badge>
            <Badge tone="muted">{studioXp} XP</Badge>
            {role === "parent" ? (
              <NativeSelect
                className="h-11 w-40"
                value={String(childAge)}
                onChange={(e) => setChildAge(Number(e.target.value))}
                aria-label="Studio age track"
              >
                {STUDIO_BANDS.flatMap((item) => {
                  const ages: number[] = [];
                  for (let n = item.minAge; n <= item.maxAge; n++) ages.push(n);
                  return ages.map((n) => (
                    <option key={n} value={n}>
                      Age {n} · {item.name}
                    </option>
                  ));
                })}
              </NativeSelect>
            ) : null}
          </div>
        </header>
        {room === "hub" ? (
          <StudioHub bandId={band.id} role={role} onOpen={setRoom} />
        ) : (
          <StudioRoomView
            room={room as Exclude<StudioRoomId, "hub" | "color">}
            bandId={band.id}
            onBack={() => setRoom("hub")}
          />
        )}
        <Button variant="outline" className="w-full" onClick={() => setScreen("home")}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="screen-enter space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted">Creative Studio</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {band.name} track
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">{band.pitch}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setRoom("hub")}>
            Studio home
          </Button>
          <Badge tone="accent">{band.ages}</Badge>
          <Badge tone="muted">{studioXp} XP</Badge>
          {role === "parent" ? (
            <NativeSelect
              className="h-11 w-40"
              value={String(childAge)}
              onChange={(e) => setChildAge(Number(e.target.value))}
              aria-label="Studio age track"
            >
              {STUDIO_BANDS.flatMap((item) => {
                const ages: number[] = [];
                for (let n = item.minAge; n <= item.maxAge; n++) ages.push(n);
                return ages.map((n) => (
                  <option key={n} value={n}>
                    Age {n} · {item.name}
                  </option>
                ));
              })}
            </NativeSelect>
          ) : null}
        </div>
      </header>

      <div className="grid gap-2 sm:grid-cols-4">
        {STUDIO_BANDS.map((item) => {
          const active = item.id === band.id;
          const itemProgress = missionProgress(item, completedMissionIds);
          return (
            <button
              key={item.id}
              type="button"
              disabled={role === "child" && !active && !itemProgress.done}
              onClick={() => {
                if (role === "parent") setChildAge(item.minAge);
              }}
              className={cn(
                "rounded-2xl border border-border bg-surface p-4 text-left transition-colors duration-150",
                active && "border-accent/50 bg-accent-soft",
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                {item.ages}
              </p>
              <p className="mt-1 font-display text-lg font-semibold">{item.name}</p>
              <Progress
                value={item.id === band.id ? progress.pct : itemProgress.pct}
                className="mt-3"
              />
              <p className="mt-2 text-xs text-muted">
                {item.id === band.id
                  ? `${progress.done}/${progress.total} missions`
                  : itemProgress.done
                    ? `${itemProgress.done} complete`
                    : "Locked to this age"}
              </p>
            </button>
          );
        })}
      </div>

      {current ? (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                Current mission
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold">{current.title}</h2>
              <p className="mt-1 text-sm text-muted">{current.brief}</p>
            </div>
            <Badge tone="muted">+{current.xp} XP</Badge>
          </div>
          <p className="text-sm text-muted">{band.canvasHint}</p>
        </Card>
      ) : (
        <Card>
          <h2 className="font-display text-2xl font-semibold">Track complete</h2>
          <p className="mt-1 text-sm text-muted">
            {stretch
              ? `You finished ${band.name}. Stretch work from ${stretch.name} unlocks when age catches up — or a parent can preview it.`
              : "You have finished every studio track on this ledger."}
          </p>
        </Card>
      )}

      <Card className="space-y-3 p-3">
        <div
          ref={wrapRef}
          className={cn(
            "relative overflow-hidden rounded-lg bg-ink text-bg shadow-[var(--shadow-border)]",
            tools.has("grid") && "studio-grid",
          )}
        >
          <canvas
            ref={canvasRef}
            className="block h-72 w-full touch-none"
            aria-label="Studio canvas"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 px-1">
          {swatches.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              onClick={() => setColor(c)}
              className="size-11 rounded-full shadow-[var(--shadow-border)]"
              style={{
                background: c,
                outline:
                  color === c ? "2px solid var(--color-ink)" : "2px solid transparent",
                outlineOffset: "2px",
              }}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-2 px-1">
          <ToolChip
            active={tool === "brush"}
            onClick={() => setTool("brush")}
            label="Brush"
          />
          {tools.has("crayon") ? (
            <ToolChip
              active={tool === "crayon"}
              onClick={() => setTool("crayon")}
              label="Crayon"
            />
          ) : null}
          {tools.has("fine") ? (
            <ToolChip
              active={tool === "fine"}
              onClick={() => setTool("fine")}
              label="Fine liner"
            />
          ) : null}
          {stamps.map(([id, Icon, label]) => (
            <ToolChip
              key={id}
              active={tool === id}
              onClick={() => setTool(id)}
              label={label}
              icon={Icon}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {tools.has("undo") ? (
            <Button variant="outline" className="flex-1" onClick={undo}>
              <Undo2 className="size-4" />
              Undo
            </Button>
          ) : null}
          <Button variant="outline" className="flex-1" onClick={clear}>
            <Eraser className="size-4" />
            Clear
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => save(current ?? undefined)}>
            <Save className="size-4" />
            Save piece
          </Button>
          {current ? (
            <Button className="flex-1" onClick={finishMission}>
              <Check className="size-4" />
              Complete mission
            </Button>
          ) : null}
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Missions in {band.name}</h2>
        <div className="grid gap-2">
          {band.missions.map((mission, index) => {
            const done = completedMissionIds.includes(mission.id);
            const locked =
              index > 0 && !completedMissionIds.includes(band.missions[index - 1].id);
            return (
              <button
                key={mission.id}
                type="button"
                disabled={locked}
                onClick={() => setMissionId(mission.id)}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-surface px-4 text-left",
                  mission.id === current?.id && "border-accent/50 bg-accent-soft",
                  locked && "opacity-50",
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 font-mono text-sm">
                  {done ? <Check className="size-4 text-accent" /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{mission.title}</span>
                  <span className="block text-xs text-muted">{mission.brief}</span>
                </span>
                <Badge tone={done ? "accent" : "muted"}>
                  {done ? "Done" : `+${mission.xp}`}
                </Badge>
              </button>
            );
          })}
        </div>
      </section>

      {stretch && progress.complete ? (
        <Card className="border-accent/30">
          <div className="flex items-start gap-3">
            <Grid3x3 className="size-5 text-accent" />
            <div>
              <h2 className="font-display text-lg font-semibold">
                Advanced · {stretch.name}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {stretch.pitch} This section opens fully at ages {stretch.ages}.
                {role === "parent"
                  ? " Preview it now with the age control above."
                  : " Keep making work on this track until your parent updates your age."}
              </p>
              {role === "parent" ? (
                <Button
                  className="mt-4"
                  onClick={() => setChildAge(stretch.minAge)}
                >
                  Preview {stretch.name}
                  <Redo2 className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {drawings.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Gallery</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => useLedger.getState().clearDrawings()}
            >
              <Trash2 className="size-3.5" />
              Clear all
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {drawings.map((drawing) => (
              <figure key={drawing.id} className="min-w-0">
                <img
                  src={drawing.dataUrl}
                  alt={drawing.title ?? "Saved drawing"}
                  className="aspect-square w-full rounded-md object-cover shadow-[var(--shadow-border)] outline outline-1 -outline-offset-1 outline-ink/10"
                />
                {drawing.title ? (
                  <figcaption className="mt-1 truncate text-xs text-muted">
                    {drawing.title}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      <Button variant="outline" className="w-full" onClick={() => setScreen("home")}>
        Back
      </Button>
    </div>
  );
}

function ToolChip({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: typeof Sun;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold",
        active ? "bg-ink text-bg" : "bg-surface-2 text-ink",
      )}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {label}
    </button>
  );
}
