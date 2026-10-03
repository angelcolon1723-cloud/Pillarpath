import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Brush,
  Circle,
  Download,
  Eraser,
  Layers,
  Layers2,
  Lock,
  Minus,
  Music2,
  PaintBucket,
  Play,
  Plus,
  Sparkles,
  Square,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, FieldLabel } from "@/components/ui/input";
import { useLedger } from "@/store/ledger";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Creative Studio Pro — the advanced tier.                             */
/*                                                                      */
/* Pro Canvas: 3 layers, shapes, text, mirror mode.                     */
/* Story Studio: multi-panel comic builder with captions.               */
/* Beat Sequencer: 16-step WebAudio sequencer.                          */
/* Unlock: a parent flips the switch (or previews it themselves).        */
/* ------------------------------------------------------------------ */

export type ProTool = "canvas" | "story" | "beats";

const PRO_W = 640;
const PRO_H = 400;
const PAPER = "#f4f4f1";

const SWATCHES = [
  "#1c1a16",
  "#e23b3b",
  "#f08c1e",
  "#f5c518",
  "#2e9e5b",
  "#1e88e5",
  "#7b4fd6",
  "#d63384",
  "#ffffff",
];

function makeLayer() {
  const c = document.createElement("canvas");
  c.width = PRO_W;
  c.height = PRO_H;
  return c;
}

/* ------------------------------ Pro Canvas ------------------------ */

type CanvasTool = "brush" | "eraser" | "fill" | "line" | "rect" | "circle" | "text";

/** Scanline flood fill on a 2d context. */
function floodFill(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  hex: string,
  opacity: number,
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const ti = (y0 * w + x0) * 4;
  const tr = d[ti];
  const tg = d[ti + 1];
  const tb = d[ti + 2];
  const ta = d[ti + 3];
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const fr = m ? parseInt(m[1].slice(0, 2), 16) : 0;
  const fg = m ? parseInt(m[1].slice(2, 4), 16) : 0;
  const fb = m ? parseInt(m[1].slice(4, 6), 16) : 0;
  const fa = Math.round(opacity * 255);
  // Already the target color — nothing to do.
  if (tr === fr && tg === fg && tb === fb && ta === fa) return;
  const tol = 40;
  const match = (i: number) =>
    Math.abs(d[i] - tr) <= tol &&
    Math.abs(d[i + 1] - tg) <= tol &&
    Math.abs(d[i + 2] - tb) <= tol &&
    Math.abs(d[i + 3] - ta) <= tol;
  const stack: Array<[number, number]> = [[x0, y0]];
  while (stack.length) {
    const [x, y] = stack.pop() as [number, number];
    let nx = x;
    // scan left to the boundary
    while (nx >= 0 && match((y * w + nx) * 4)) nx--;
    nx++;
    let spanUp = false;
    let spanDown = false;
    while (nx < w && match((y * w + nx) * 4)) {
      const i = (y * w + nx) * 4;
      d[i] = fr;
      d[i + 1] = fg;
      d[i + 2] = fb;
      d[i + 3] = fa;
      if (y > 0) {
        const up = match(((y - 1) * w + nx) * 4);
        if (up && !spanUp) {
          stack.push([nx, y - 1]);
          spanUp = true;
        } else if (!up) spanUp = false;
      }
      if (y < h - 1) {
        const dn = match(((y + 1) * w + nx) * 4);
        if (dn && !spanDown) {
          stack.push([nx, y + 1]);
          spanDown = true;
        } else if (!dn) spanDown = false;
      }
      nx++;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Trigger a PNG download of a canvas element. */
function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string) {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function ProCanvas({ onDone }: { onDone: () => void }) {
  const viewRef = useRef<HTMLCanvasElement>(null);
  const layersRef = useRef<HTMLCanvasElement[]>([]);
  const undoRef = useRef<ImageData[]>([]);
  const strokeRef = useRef<{
    tool: CanvasTool;
    start: { x: number; y: number };
    snapshot: ImageData | null;
  } | null>(null);

  const [activeLayer, setActiveLayer] = useState(0);
  const [visible, setVisible] = useState([true, true, true]);
  const [tool, setTool] = useState<CanvasTool>("brush");
  const [color, setColor] = useState(SWATCHES[0]);
  const [size, setSize] = useState(8);
  const [opacity, setOpacity] = useState(1);
  const [mirror, setMirror] = useState(false);
  const [text, setText] = useState("");
  const [, setTick] = useState(0);

  const saveDrawing = useLedger((s) => s.saveDrawing);
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const colorRef = useRef(color);
  colorRef.current = color;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const mirrorRef = useRef(mirror);
  mirrorRef.current = mirror;
  const textRef = useRef(text);
  textRef.current = text;
  const activeRef = useRef(activeLayer);
  activeRef.current = activeLayer;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    layersRef.current = [makeLayer(), makeLayer(), makeLayer()];
    composite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function composite() {
    const view = viewRef.current;
    if (!view) return;
    const ctx = view.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, PRO_W, PRO_H);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, PRO_W, PRO_H);
    layersRef.current.forEach((layer, i) => {
      if (visibleRef.current[i]) ctx.drawImage(layer, 0, 0);
    });
  }

  function pushUndo() {
    const layer = layersRef.current[activeRef.current];
    const ctx = layer.getContext("2d");
    if (!ctx) return;
    undoRef.current.push(ctx.getImageData(0, 0, PRO_W, PRO_H));
    if (undoRef.current.length > 20) undoRef.current.shift();
  }

  function undo() {
    const prev = undoRef.current.pop();
    if (!prev) return;
    const layer = layersRef.current[activeRef.current];
    const ctx = layer.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(prev, 0, 0);
    composite();
    setTick((t) => t + 1);
  }

  function layerCtx() {
    const layer = layersRef.current[activeRef.current];
    return layer.getContext("2d");
  }

  function setupStroke(ctx: CanvasRenderingContext2D, t: CanvasTool) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = sizeRef.current;
    ctx.globalAlpha = opacityRef.current;
    if (t === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "#000";
      ctx.fillStyle = "#000";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = colorRef.current;
      ctx.fillStyle = colorRef.current;
    }
  }

  function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.beginPath();
    ctx.arc(x, y, sizeRef.current / 2, 0, Math.PI * 2);
    ctx.fill();
    if (mirrorRef.current) {
      ctx.beginPath();
      ctx.arc(PRO_W - x, y, sizeRef.current / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSeg(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    if (mirrorRef.current) {
      ctx.beginPath();
      ctx.moveTo(PRO_W - x0, y0);
      ctx.lineTo(PRO_W - x1, y1);
      ctx.stroke();
    }
  }

  function pos(e: React.PointerEvent) {
    const canvas = viewRef.current;
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * PRO_W,
      y: ((e.clientY - r.top) / r.height) * PRO_H,
    };
  }

  function onDown(e: React.PointerEvent) {
    const p = pos(e);
    if (!p) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const t = toolRef.current;
    const ctx = layerCtx();
    if (!ctx) return;

    if (t === "text") {
      const label = textRef.current.trim() || "Aa";
      pushUndo();
      setupStroke(ctx, t);
      ctx.font = `600 ${Math.max(16, sizeRef.current * 4)}px system-ui, sans-serif`;
      ctx.fillText(label, p.x, p.y);
      if (mirrorRef.current) ctx.fillText(label, PRO_W - p.x - ctx.measureText(label).width, p.y);
      ctx.globalAlpha = 1;
      composite();
      return;
    }

    if (t === "fill") {
      pushUndo();
      floodFill(ctx, p.x, p.y, colorRef.current, opacityRef.current);
      ctx.globalAlpha = 1;
      composite();
      return;
    }

    pushUndo();
    setupStroke(ctx, t);
    if (t === "brush" || t === "eraser") {
      drawDot(ctx, p.x, p.y);
      strokeRef.current = { tool: t, start: p, snapshot: null };
    } else {
      // shape tools: snapshot for live preview
      const view = viewRef.current;
      const vctx = view?.getContext("2d");
      strokeRef.current = {
        tool: t,
        start: p,
        snapshot: vctx ? vctx.getImageData(0, 0, PRO_W, PRO_H) : null,
      };
    }
    ctx.globalAlpha = 1;
    composite();
  }

  function onMove(e: React.PointerEvent) {
    const s = strokeRef.current;
    if (!s) return;
    const p = pos(e);
    if (!p) return;
    if (s.tool === "brush" || s.tool === "eraser") {
      const ctx = layerCtx();
      if (!ctx) return;
      setupStroke(ctx, s.tool);
      drawSeg(ctx, s.start.x, s.start.y, p.x, p.y);
      ctx.globalAlpha = 1;
      s.start = p;
      composite();
    } else if (s.snapshot) {
      // live shape preview on the visible canvas
      const view = viewRef.current;
      const vctx = view?.getContext("2d");
      if (!vctx) return;
      vctx.putImageData(s.snapshot, 0, 0);
      vctx.save();
      vctx.lineCap = "round";
      vctx.lineWidth = sizeRef.current;
      vctx.globalAlpha = opacityRef.current;
      vctx.strokeStyle = colorRef.current;
      const x0 = s.start.x;
      const y0 = s.start.y;
      vctx.beginPath();
      if (s.tool === "line") {
        vctx.moveTo(x0, y0);
        vctx.lineTo(p.x, p.y);
        vctx.stroke();
      } else if (s.tool === "rect") {
        vctx.strokeRect(x0, y0, p.x - x0, p.y - y0);
      } else if (s.tool === "circle") {
        const r = Math.hypot(p.x - x0, p.y - y0);
        vctx.arc(x0, y0, r, 0, Math.PI * 2);
        vctx.stroke();
      }
      vctx.restore();
    }
  }

  function onUp(e: React.PointerEvent) {
    const s = strokeRef.current;
    if (!s) return;
    strokeRef.current = null;
    const p = pos(e);
    if ((s.tool === "line" || s.tool === "rect" || s.tool === "circle") && p) {
      const ctx = layerCtx();
      if (ctx) {
        setupStroke(ctx, s.tool);
        ctx.beginPath();
        const x0 = s.start.x;
        const y0 = s.start.y;
        if (s.tool === "line") {
          ctx.moveTo(x0, y0);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        } else if (s.tool === "rect") {
          ctx.strokeRect(x0, y0, p.x - x0, p.y - y0);
        } else if (s.tool === "circle") {
          ctx.arc(x0, y0, Math.hypot(p.x - x0, p.y - y0), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
    composite();
    setTick((t) => t + 1);
  }

  function clearLayer() {
    pushUndo();
    const ctx = layerCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, PRO_W, PRO_H);
    composite();
  }

  function save() {
    const out = document.createElement("canvas");
    out.width = PRO_W;
    out.height = PRO_H;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, PRO_W, PRO_H);
    layersRef.current.forEach((layer, i) => {
      if (visibleRef.current[i]) ctx.drawImage(layer, 0, 0);
    });
    saveDrawing(out.toDataURL("image/png"), { title: "Studio Pro piece" });
    toast.success("Pro piece saved to the gallery");
    onDone();
  }

  function download() {
    const out = document.createElement("canvas");
    out.width = PRO_W;
    out.height = PRO_H;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, PRO_W, PRO_H);
    layersRef.current.forEach((layer, i) => {
      if (visibleRef.current[i]) ctx.drawImage(layer, 0, 0);
    });
    downloadCanvasPng(out, "pillarpath-artwork.png");
    toast.success("Artwork downloaded");
  }

  const tools: Array<[CanvasTool, typeof Brush, string]> = [
    ["brush", Brush, "Brush"],
    ["eraser", Eraser, "Eraser"],
    ["fill", PaintBucket, "Fill"],
    ["line", Minus, "Line"],
    ["rect", Square, "Rect"],
    ["circle", Circle, "Circle"],
    ["text", Type, "Text"],
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted">Studio Pro</p>
          <h2 className="font-display text-2xl font-semibold">Pro Canvas</h2>
        </div>
        <Button variant="outline" size="sm" onClick={onDone}>
          <ArrowLeft className="size-4" /> Tools
        </Button>
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {tools.map(([id, Icon, label]) => (
            <Button
              key={id}
              size="sm"
              variant={tool === id ? "default" : "outline"}
              onClick={() => setTool(id)}
              aria-label={label}
            >
              <Icon className="size-4" />
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={undo} aria-label="Undo">
            <Undo2 className="size-4" />
          </Button>
          <Button
            size="sm"
            variant={tool === "brush" && mirror ? "default" : "outline"}
            onClick={() => setMirror((m) => !m)}
          >
            Mirror {mirror ? "on" : "off"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((s) => (
            <button
              key={s}
              type="button"
              aria-label={`Color ${s}`}
              onClick={() => setColor(s)}
              className={cn(
                "size-7 rounded-full border-2",
                color === s ? "border-accent" : "border-border",
              )}
              style={{ backgroundColor: s }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="size-7 cursor-pointer rounded-full"
            aria-label="Custom color"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Brush size · {size}px</FieldLabel>
            <input
              type="range"
              min={2}
              max={40}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <FieldLabel>Opacity · {Math.round(opacity * 100)}%</FieldLabel>
            <input
              type="range"
              min={10}
              max={100}
              value={Math.round(opacity * 100)}
              onChange={(e) => setOpacity(Number(e.target.value) / 100)}
              className="w-full"
            />
          </div>
        </div>
        {tool === "text" ? (
          <div>
            <FieldLabel>Text to stamp</FieldLabel>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type words, then tap the canvas"
              maxLength={40}
            />
          </div>
        ) : null}
      </Card>

      <div
        className="overflow-hidden rounded-2xl border border-border"
        style={{ touchAction: "none" }}
      >
        <canvas
          ref={viewRef}
          width={PRO_W}
          height={PRO_H}
          className="block w-full cursor-crosshair"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => {
            strokeRef.current = null;
            composite();
          }}
        />
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-accent" />
          <CardTitle className="text-base">Layers</CardTitle>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "rounded-xl border p-2",
                activeLayer === i ? "border-accent" : "border-border",
              )}
            >
              <button
                type="button"
                onClick={() => setActiveLayer(i)}
                className="w-full text-left text-sm font-semibold"
              >
                Layer {i + 1}
                {activeLayer === i ? " · active" : ""}
              </button>
              <label className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={visible[i]}
                  onChange={() =>
                    setVisible((v) => {
                      const next = [...v];
                      next[i] = !next[i];
                      visibleRef.current = next;
                      composite();
                      return next;
                    })
                  }
                  className="size-3.5 accent-accent"
                />
                Visible
              </label>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={clearLayer}>
            <Trash2 className="size-4" /> Clear layer
          </Button>
          <Button variant="outline" size="sm" onClick={download}>
            <Download className="size-4" /> Download PNG
          </Button>
          <Button size="sm" onClick={save}>
            Save piece
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------- Story Studio ------------------------ */

type StoryPanel = { id: string; dataUrl: string; caption: string };

const PANEL_W = 480;
const PANEL_H = 300;

function StoryStudio({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [panels, setPanels] = useState<StoryPanel[]>([]);
  const [caption, setCaption] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [size, setSize] = useState(6);
  const [title, setTitle] = useState("");
  const saveDrawing = useLedger((s) => s.saveDrawing);
  const colorRef = useRef(color);
  colorRef.current = color;
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, PANEL_W, PANEL_H);
  }, []);

  function clearPanel() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, PANEL_W, PANEL_H);
  }

  function ppos(e: React.PointerEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * PANEL_W,
      y: ((e.clientY - r.top) / r.height) * PANEL_H,
    };
  }

  function addPanel() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (panels.length >= 8) {
      toast.error("8 panels max — finish this story first");
      return;
    }
    setPanels((p) => [
      ...p,
      {
        id: `panel-${Date.now()}-${p.length}`,
        dataUrl: canvas.toDataURL("image/png"),
        caption: caption.trim(),
      },
    ]);
    setCaption("");
    clearPanel();
    toast.success(`Panel ${panels.length + 1} added`);
  }

  function removePanel(id: string) {
    setPanels((p) => p.filter((x) => x.id !== id));
  }

  /** Composite the story strip; calls back with the finished canvas. */
  function renderStoryStrip(done: (out: HTMLCanvasElement) => void) {
    if (panels.length === 0) {
      toast.error("Add at least one panel first");
      return;
    }
    const pad = 24;
    const capH = 44;
    const out = document.createElement("canvas");
    out.width = PANEL_W + pad * 2;
    out.height = panels.length * (PANEL_H + capH + pad) + pad;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#14121a";
    ctx.fillRect(0, 0, out.width, out.height);
    let y = pad;
    const imgs = panels.map((p) => {
      const img = new Image();
      img.src = p.dataUrl;
      return img;
    });
    const drawAll = () => {
      panels.forEach((p, i) => {
        const img = imgs[i];
        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, pad, y, PANEL_W, PANEL_H);
        }
        y += PANEL_H + 8;
        ctx.fillStyle = "#f4f4f1";
        ctx.font = "500 22px system-ui, sans-serif";
        const label = p.caption || `Panel ${i + 1}`;
        ctx.fillText(label.slice(0, 60), pad, y + 26, PANEL_W);
        y += capH + pad;
      });
      done(out);
    };
    let loaded = 0;
    imgs.forEach((img) => {
      if (img.complete) {
        loaded += 1;
        if (loaded === imgs.length) drawAll();
      } else {
        img.onload = () => {
          loaded += 1;
          if (loaded === imgs.length) drawAll();
        };
      }
    });
    if (imgs.length === 0) drawAll();
  }

  function saveStory() {
    renderStoryStrip((out) => {
      saveDrawing(out.toDataURL("image/png"), {
        title: title.trim() || "Studio Pro story",
      });
      toast.success("Story saved to the gallery");
      onDone();
    });
  }

  function downloadStory() {
    renderStoryStrip((out) => {
      downloadCanvasPng(out, "pillarpath-story.png");
      toast.success("Story downloaded");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted">Studio Pro</p>
          <h2 className="font-display text-2xl font-semibold">Story Studio</h2>
        </div>
        <Button variant="outline" size="sm" onClick={onDone}>
          <ArrowLeft className="size-4" /> Tools
        </Button>
      </div>
      <Card className="space-y-3 p-4">
        <div>
          <FieldLabel>Story title</FieldLabel>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Day the Robot Learned to Share"
            maxLength={60}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              aria-label={`Color ${s}`}
              onClick={() => setColor(s)}
              className={cn(
                "size-7 rounded-full border-2",
                color === s ? "border-accent" : "border-border",
              )}
              style={{ backgroundColor: s }}
            />
          ))}
          <div className="ml-2 flex items-center gap-2">
            <FieldLabel className="mb-0">Size</FieldLabel>
            <input
              type="range"
              min={2}
              max={24}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-24"
            />
          </div>
          <Button size="sm" variant="outline" onClick={clearPanel}>
            Clear
          </Button>
        </div>
        <div
          className="overflow-hidden rounded-xl border border-border"
          style={{ touchAction: "none" }}
        >
          <canvas
            ref={canvasRef}
            width={PANEL_W}
            height={PANEL_H}
            className="block w-full cursor-crosshair"
            onPointerDown={(e) => {
              const p = ppos(e);
              if (!p) return;
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              drawing.current = true;
              last.current = p;
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return;
              const p = ppos(e);
              const canvas = canvasRef.current;
              const ctx = canvas?.getContext("2d");
              if (!p || !ctx || !last.current) return;
              ctx.strokeStyle = colorRef.current;
              ctx.lineWidth = sizeRef.current;
              ctx.lineCap = "round";
              ctx.beginPath();
              ctx.moveTo(last.current.x, last.current.y);
              ctx.lineTo(p.x, p.y);
              ctx.stroke();
              last.current = p;
            }}
            onPointerUp={() => {
              drawing.current = false;
              last.current = null;
            }}
          />
        </div>
        <div>
          <FieldLabel>Caption for this panel</FieldLabel>
          <div className="flex gap-2">
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="One line of story…"
              maxLength={80}
            />
            <Button onClick={addPanel}>
              <Plus className="size-4" /> Add panel
            </Button>
          </div>
        </div>
      </Card>

      {panels.length > 0 ? (
        <Card className="space-y-3 p-4">
          <CardTitle className="text-base">
            Storyboard · {panels.length} panel{panels.length === 1 ? "" : "s"}
          </CardTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {panels.map((p, i) => (
              <div key={p.id} className="overflow-hidden rounded-xl border border-border">
                <img src={p.dataUrl} alt={`Panel ${i + 1}`} className="block w-full" />
                <div className="flex items-center justify-between gap-2 p-2">
                  <p className="truncate text-xs text-muted">
                    {i + 1}. {p.caption || "No caption"}
                  </p>
                  <Button size="sm" variant="outline" onClick={() => removePanel(p.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button onClick={saveStory} className="w-full">
            Save story to gallery
          </Button>
          <Button variant="outline" onClick={downloadStory} className="w-full">
            <Download className="size-4" /> Download story PNG
          </Button>
        </Card>
      ) : (
        <p className="text-center text-sm text-muted">
          Draw a scene, add a caption, and build your story one panel at a time.
        </p>
      )}
    </div>
  );
}

/* ---------------------------- Beat Sequencer ----------------------- */

const STEPS = 16;
const TRACKS = [
  { id: "kick", name: "Kick", color: "#e23b3b" },
  { id: "snare", name: "Snare", color: "#f08c1e" },
  { id: "hat", name: "Hat", color: "#f5c518" },
  { id: "clap", name: "Clap", color: "#e564e8" },
  { id: "bass", name: "Bass", color: "#2e9e5b" },
  { id: "keys", name: "Keys", color: "#1e88e5" },
  { id: "arp", name: "Arp", color: "#7c5cff" },
] as const;

type TrackId = (typeof TRACKS)[number]["id"];

const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

function defaultPattern(): Record<TrackId, boolean[]> {
  const off = () => Array(STEPS).fill(false);
  const p: Record<TrackId, boolean[]> = {
    kick: off(),
    snare: off(),
    hat: off(),
    clap: off(),
    bass: off(),
    keys: off(),
    arp: off(),
  };
  [0, 4, 8, 12].forEach((s) => (p.kick[s] = true));
  [4, 12].forEach((s) => (p.snare[s] = true));
  for (let s = 0; s < STEPS; s += 2) p.hat[s] = true;
  [4, 12].forEach((s) => (p.clap[s] = true));
  [0, 6, 8, 14].forEach((s) => (p.bass[s] = true));
  [0, 4, 8, 12].forEach((s) => (p.keys[s] = true));
  [2, 6, 10, 14].forEach((s) => (p.arp[s] = true));
  return p;
}

let sharedCtx: AudioContext | null = null;
function audio() {
  if (!sharedCtx) sharedCtx = new AudioContext();
  void sharedCtx.resume();
  return sharedCtx;
}

function noiseBuffer(ctx: BaseAudioContext) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function playTrackSound(ctx: BaseAudioContext, track: TrackId, step: number, when: number) {
  if (track === "kick") {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, when);
    o.frequency.exponentialRampToValueAtTime(48, when + 0.12);
    g.gain.setValueAtTime(0.5, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.24);
    o.connect(g).connect(ctx.destination);
    o.start(when);
    o.stop(when + 0.25);
  } else if (track === "snare") {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.16);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(when);
    src.stop(when + 0.18);
  } else if (track === "hat") {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(when);
    src.stop(when + 0.06);
  } else if (track === "bass") {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = step % 8 === 6 ? 82.41 : 55;
    g.gain.setValueAtTime(0.4, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.3);
    o.connect(g).connect(ctx.destination);
    o.start(when);
    o.stop(when + 0.32);
  } else if (track === "clap") {
    // layered noise bursts through a bandpass = hand clap
    for (let i = 0; i < 3; i++) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx);
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 1600;
      f.Q.value = 1.4;
      const g = ctx.createGain();
      const t = when + i * 0.018;
      g.gain.setValueAtTime(0.3 - i * 0.07, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      src.connect(f).connect(g).connect(ctx.destination);
      src.start(t);
      src.stop(t + 0.1);
    }
  } else if (track === "arp") {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = PENTA[(step * 2 + 1) % PENTA.length] * 2;
    g.gain.setValueAtTime(0.12, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
    o.connect(g).connect(ctx.destination);
    o.start(when);
    o.stop(when + 0.2);
  } else {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = PENTA[step % PENTA.length];
    g.gain.setValueAtTime(0.22, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.28);
    o.connect(g).connect(ctx.destination);
    o.start(when);
    o.stop(when + 0.3);
  }
}

/** Encode an AudioBuffer as a 16-bit PCM WAV blob. */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const len = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = len * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const v = new DataView(ab);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  v.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, numCh, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * blockAlign, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, 16, true);
  writeStr(36, "data");
  v.setUint32(40, dataSize, true);
  const channels: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

function BeatSequencer({ onDone, onFirstPlay }: { onDone: () => void; onFirstPlay?: () => void }) {
  const [pattern, setPattern] = useState<Record<TrackId, boolean[]>>(defaultPattern);
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(110);
  const [step, setStep] = useState(0);
  const playedRef = useRef(false);
  const timer = useRef<number | null>(null);
  const stepRef = useRef(0);
  const nextAt = useRef(0);
  const patternRef = useRef(pattern);
  patternRef.current = pattern;
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  function toggle(track: TrackId, s: number) {
    setPattern((p) => {
      const next = { ...p, [track]: [...p[track]] };
      next[track][s] = !next[track][s];
      return next;
    });
  }

  function clear() {
    const off = () => Array(STEPS).fill(false);
    setPattern({ kick: off(), snare: off(), hat: off(), clap: off(), bass: off(), keys: off(), arp: off() });
  }

  useEffect(() => {
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  function start() {
    const ctx = audio();
    setPlaying(true);
    if (!playedRef.current) {
      playedRef.current = true;
      onFirstPlay?.();
    }
    stepRef.current = 0;
    nextAt.current = ctx.currentTime + 0.06;
    timer.current = window.setInterval(() => {
      const c = audio();
      const spb = 60 / bpmRef.current / 4;
      while (nextAt.current < c.currentTime + 0.12) {
        const s = stepRef.current;
        (Object.keys(patternRef.current) as TrackId[]).forEach((t) => {
          if (patternRef.current[t][s]) playTrackSound(c, t, s, nextAt.current);
        });
        setStep(s);
        nextAt.current += spb;
        stepRef.current = (s + 1) % STEPS;
      }
    }, 25);
  }

  function stop() {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
  }

  async function exportWav() {
    if (playing) stop();
    const bpmNow = bpmRef.current;
    const pat = patternRef.current;
    const spb = 60 / bpmNow / 4;
    const bars = 2;
    const totalSteps = STEPS * bars;
    const sampleRate = 44100;
    const dur = totalSteps * spb + 0.5;
    const off = new OfflineAudioContext(1, Math.ceil(sampleRate * dur), sampleRate);
    for (let s = 0; s < totalSteps; s++) {
      const stepIdx = s % STEPS;
      const when = s * spb;
      (Object.keys(pat) as TrackId[]).forEach((t) => {
        if (pat[t][stepIdx]) playTrackSound(off, t, stepIdx, when);
      });
    }
    const buf = await off.startRendering();
    const blob = audioBufferToWav(buf);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pillarpath-beat.wav";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Beat exported as WAV");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted">Studio Pro</p>
          <h2 className="font-display text-2xl font-semibold">Beat Sequencer</h2>
        </div>
        <Button variant="outline" size="sm" onClick={onDone}>
          <ArrowLeft className="size-4" /> Tools
        </Button>
      </div>
      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={playing ? stop : start}>
            <Play className="size-4" /> {playing ? "Stop" : "Play"}
          </Button>
          <div className="flex items-center gap-2">
            <FieldLabel className="mb-0">Tempo</FieldLabel>
            <input
              type="range"
              min={80}
              max={160}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-28"
            />
            <span className="text-sm font-semibold">{bpm} BPM</span>
          </div>
          <Button variant="outline" size="sm" onClick={clear}>
            Clear
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPattern(defaultPattern())}
          >
            Starter beat
          </Button>
          <Button variant="outline" size="sm" onClick={exportWav}>
            <Download className="size-4" /> Export WAV
          </Button>
        </div>
        <div className="space-y-1.5 overflow-x-auto">
          {TRACKS.map((t) => (
            <div key={t.id} className="flex min-w-[560px] items-center gap-1.5">
              <span className="w-14 shrink-0 text-xs font-semibold">{t.name}</span>
              <div className="grid flex-1 grid-cols-16 gap-1">
                {pattern[t.id].map((on, s) => (
                  <button
                    key={s}
                    type="button"
                    aria-label={`${t.name} step ${s + 1} ${on ? "on" : "off"}`}
                    onClick={() => toggle(t.id, s)}
                    className={cn(
                      "aspect-square rounded-md border transition-colors",
                      on ? "border-transparent" : "border-border bg-surface",
                      playing && step === s && "ring-2 ring-accent ring-offset-1",
                    )}
                    style={on ? { backgroundColor: t.color } : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">
          Tap squares to build your beat. First creation earns Pro XP and Units.
        </p>
      </Card>
    </div>
  );
}

/* -------------------------------- Hub ------------------------------ */

const PRO_MISSIONS = [
  {
    id: "pro-canvas-1",
    title: "Layer master",
    brief: "Finish and save a piece on the Pro Canvas.",
    xp: 50,
    units: 10,
  },
  {
    id: "pro-story-1",
    title: "Storyteller",
    brief: "Build a 3+ panel story in Story Studio and save it.",
    xp: 60,
    units: 12,
  },
  {
    id: "pro-beats-1",
    title: "Beat maker",
    brief: "Program an original 16-step beat and play it back.",
    xp: 40,
    units: 8,
  },
];

export function awardProMission(missionId: string) {
  const m = PRO_MISSIONS.find((x) => x.id === missionId);
  if (!m) return;
  const { completeStudioMission, awardStudioWin } = useLedger.getState();
  const first = completeStudioMission(m.id, m.xp);
  if (!first) {
    awardStudioWin(0, m.units, `Studio Pro · ${m.title}`);
    toast.success(`Pro mission complete · +${m.xp} XP · +${m.units} Units`);
  }
}

export function StudioProScreen({
  tool,
  onNavigate,
  onExit,
}: {
  tool: ProTool | "hub";
  onNavigate: (t: ProTool | "hub") => void;
  onExit: () => void;
}) {
  const role = useLedger((s) => s.role);
  const proUnlocked = useLedger((s) => s.studioProUnlocked ?? false);
  const setProUnlocked = useLedger((s) => s.setStudioProUnlocked);
  const completed = useLedger((s) => s.completedMissionIds ?? []);

  if (tool === "canvas")
    return (
      <ProCanvas
        onDone={() => {
          awardProMission("pro-canvas-1");
          onNavigate("hub");
        }}
      />
    );
  if (tool === "story")
    return (
      <StoryStudio
        onDone={() => {
          awardProMission("pro-story-1");
          onNavigate("hub");
        }}
      />
    );
  if (tool === "beats")
    return (
      <BeatSequencer
        onDone={() => onNavigate("hub")}
        onFirstPlay={() => awardProMission("pro-beats-1")}
      />
    );

  const canUse = proUnlocked || role === "parent";

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-muted">
            <Sparkles className="size-4 text-accent" /> Creative Studio Pro
          </p>
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            The advanced workshop
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Layered painting, comic storytelling, and beat programming — for
            creators ready to level up.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onExit}>
          <ArrowLeft className="size-4" /> Studio
        </Button>
      </div>

      {role === "parent" ? (
        <Card className="flex items-center justify-between gap-3 p-4">
          <div>
            <CardTitle className="text-base">Studio Pro access</CardTitle>
            <CardHint>
              {proUnlocked
                ? "Unlocked — your child can open every Pro tool."
                : "Locked — flip the switch to unlock the Pro workshop."}
            </CardHint>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={proUnlocked}
              onChange={(e) => {
                setProUnlocked(e.target.checked);
                toast.success(
                  e.target.checked ? "Studio Pro unlocked" : "Studio Pro locked",
                );
              }}
              className="size-5 accent-accent"
            />
            {proUnlocked ? "On" : "Off"}
          </label>
        </Card>
      ) : null}

      {!canUse ? (
        <Card className="space-y-3 p-6 text-center">
          <Lock className="mx-auto size-8 text-muted" />
          <CardTitle className="text-lg">Studio Pro is locked</CardTitle>
          <p className="mx-auto max-w-sm text-sm text-muted">
            Ask a parent to unlock the Pro workshop from their side. It holds
            the advanced tools — layers, stories, and beats.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              { id: "canvas", title: "Pro Canvas", blurb: "3 layers, shapes, text, mirror mode.", icon: Layers2 },
              { id: "story", title: "Story Studio", blurb: "Multi-panel comics with captions.", icon: Type },
              { id: "beats", title: "Beat Sequencer", blurb: "16-step beats you program yourself.", icon: Music2 },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onNavigate(t.id)}
              className="rounded-2xl border border-border bg-card p-5 text-left hover:border-accent/50"
            >
              <t.icon className="size-6 text-accent" />
              <p className="mt-3 font-semibold">{t.title}</p>
              <p className="mt-1 text-sm text-muted">{t.blurb}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-accent">
                Open
              </p>
            </button>
          ))}
        </div>
      )}

      {canUse ? (
        <Card className="space-y-3 p-5">
          <CardTitle className="text-base">Pro missions</CardTitle>
          <CardHint>
            Advanced challenges with bigger rewards than the standard studio.
          </CardHint>
          <div className="grid gap-2">
            {PRO_MISSIONS.map((m) => {
              const done = completed.includes(m.id);
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{m.title}</p>
                    <p className="text-xs text-muted">{m.brief}</p>
                    <p className="mt-1 text-xs font-medium text-accent">
                      +{m.xp} XP · +{m.units} Units
                    </p>
                  </div>
                  {done ? (
                    <Badge tone="muted">Done</Badge>
                  ) : (
                    <Badge tone="accent">Open</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
