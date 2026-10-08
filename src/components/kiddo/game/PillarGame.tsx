import { useEffect, useRef, useState, useCallback } from "react";
import { useLedger } from "@/store/ledger";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Lock, Heart, BookOpen, Volume2, VolumeX } from "lucide-react";
import { rankForScore, societyScore } from "@/components/kiddo/world/WorldMap";
import { EMOTIONS, getEncounters, recordEncounter } from "./emotions";

/* ------------------------------------------------------------------ */
/* Pillar Plaza — City Builder.                                        */
/* You're not running around anymore. You're BUILDING.                 */
/* Districts grow from real life. Decisions shape the skyline.         */
/* ------------------------------------------------------------------ */

const WORLD_W = 1600;
const WORLD_H = 1200;

interface Vec { x: number; y: number }
interface District {
  id: string;
  name: string;
  icon: string;
  color: string;
  pos: Vec;
  desc: string;
  level: number; // 1-5, computed from real stats
  maxLevel: number;
  locked: boolean;
  lockReason: string;
}
interface GameEvent extends Vec {
  id: number;
  type: "lost" | "kindness" | "shower" | "dilemma";
  label: string;
  ttl: number;
  ph: number;
  dilemmaKind?: "maya" | "peer" | "sam";
}
interface Chest extends Vec { opened: boolean; ph: number }

const DISTRICT_DEFS = [
  { id: "chore", name: "Chore Village", icon: "🏠", color: "#4ade80", x: 320, y: 320, desc: "Where work ethic lives. Every chore builds a home." },
  { id: "vault", name: "Vault Mountain", icon: "🏦", color: "#fbbf24", x: 1280, y: 320, desc: "Your savings, carved into the mountain." },
  { id: "market", name: "Market Harbor", icon: "🏪", color: "#a78bfa", x: 1280, y: 880, desc: "Every purchase is a decision. Trade wisely." },
  { id: "studio", name: "Studio Island", icon: "🎨", color: "#e879f9", x: 320, y: 880, desc: "Where creativity becomes real." },
  { id: "learn", name: "Learning Lagoon", icon: "📚", color: "#38bdf8", x: 800, y: 180, desc: "Knowledge is the deepest water." },
  { id: "hall", name: "Hall of Becoming", icon: "🏛️", color: "#f472b6", x: 800, y: 1020, desc: "Your journey, carved in stone." },
];

const JOBS = [
  { id: "dishes", name: "Dish Dynamo", desc: "Wash the dinner dishes without being asked.", reward: 30 },
  { id: "room", name: "Room Rescue", desc: "Clean your room top to bottom in 20 minutes.", reward: 40 },
  { id: "neighbor", name: "Neighbor Hero", desc: "Help a neighbor carry groceries.", reward: 60 },
];

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function PillarGame() {
  const setScreen = useLedger((s) => s.setScreen);
  const awardUnits = useLedger((s) => s.awardUnits);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const completedChoreIds = useLedger((s) => s.completedChoreIds);
  const vault = useLedger((s) => s.vault);
  const vaultTarget = useLedger((s) => s.vaultTarget);
  const choresDone = completedChoreIds.length;
  const score = societyScore({
    choresDone,
    vaultPct: vaultTarget > 0 ? Math.min(1, vault / vaultTarget) : 0,
    studioPct: 0,
  });
  const { rank } = rankForScore(score);
  const vaultUnlocked = vault >= 50;
  const marketUnlocked = choresDone >= 3;

  // District levels from real life.
  const districtLevels: Record<string, number> = {
    chore: Math.min(5, 1 + Math.floor(choresDone / 2)),
    vault: vaultUnlocked ? Math.min(5, 1 + Math.floor(vault / 100)) : 1,
    market: marketUnlocked ? Math.min(5, 2 + Math.floor(choresDone / 4)) : 1,
    studio: 1,
    learn: 1,
    hall: Math.min(5, 1 + ["Sprout", "Trailblazer", "Luminary", "Pillar"].indexOf(rank.name)),
  };

  const [selected, setSelected] = useState<null | string>(null);
  const [dilemma, setDilemma] = useState<null | { q: string; a: string; b: string; c: string }>(null);
  const [dilemmaKind, setDilemmaKind] = useState<null | "maya" | "peer" | "sam">(null);
  const [missionsDone, setMissionsDone] = useState<string[]>([]);
  const [showCodex, setShowCodex] = useState(false);
  const [ceremony, setCeremony] = useState<null | string>(null);
  const [mayaMemory, setMayaMemory] = useState<null | "good" | "bad">(null);
  const [marketChoice, setMarketChoice] = useState<null | string>(null);
  const [courage, setCourage] = useState(0);
  const [trust, setTrust] = useState(50);
  const [toasts, setToasts] = useState<Array<{ id: number; title: string; msg: string; color: string }>>([]);
  const [soundOn, setSoundOn] = useState(false);
  const [cityMood, setCityMood] = useState<"dawn" | "day" | "sunset" | "night">("day");
  const toastId = useRef(0);
  const audioRef = useRef<{ ctx: AudioContext } | null>(null);
  const zoomRef = useRef<{ zoomIn: () => void; zoomOut: () => void; reset: () => void }>({
    zoomIn: () => {}, zoomOut: () => {}, reset: () => {},
  });

  const trustRef = useRef(50);
  const rankRef = useRef(rank);
  rankRef.current = rank;

  const pushToast = (title: string, msg: string, color = "#fbbf24") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, title, msg, color }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  };
  const toastRef = useRef(pushToast);
  toastRef.current = pushToast;

  const stateRef = useRef({
    districts: DISTRICT_DEFS.map((d) => ({ ...d, pos: { x: d.x, y: d.y } })),
    chests: [
      { x: 550, y: 550, opened: false, ph: 0 },
      { x: 1050, y: 550, opened: false, ph: 2 },
      { x: 550, y: 750, opened: false, ph: 4 },
      { x: 1050, y: 750, opened: false, ph: 1 },
    ] as Chest[],
    events: [] as GameEvent[],
    eventTimer: 20,
    eventId: 0,
    particles: [] as Array<Vec & { vx: number; vy: number; life: number; color: string }>,
    fireflies: null as null | Array<{ x: number; y: number; ph: number; sp: number }>,
    time: 0,
    dayTime: 0.3,
    blight: 0, // 0-1, grows when trust is low
  });

  // Rank-up ceremony.
  useEffect(() => {
    try {
      const lastRank = localStorage.getItem("pillarpath-last-rank");
      if (lastRank && lastRank !== rank.name) {
        const order = ["Seedling", "Sprout", "Trailblazer", "Luminary", "Pillar"];
        if (order.indexOf(rank.name) > order.indexOf(lastRank)) setCeremony(rank.name);
      }
      localStorage.setItem("pillarpath-last-rank", rank.name);
    } catch { /* ignore */ }
    try {
      const mem = localStorage.getItem("pillarpath-maya");
      if (mem === "good" || mem === "bad") setMayaMemory(mem);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.ctx.close();
      audioRef.current = null;
      setSoundOn(false);
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const master = ctx.createGain();
      master.gain.value = 0.06;
      master.connect(ctx.destination);
      const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];
      const playNote = () => {
        if (!audioRef.current) return;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = notes[Math.floor(Math.random() * notes.length)];
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 2.5);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 7);
        osc.connect(g); g.connect(master);
        osc.start(); osc.stop(ctx.currentTime + 7.5);
        setTimeout(playNote, 3000 + Math.random() * 4000);
      };
      playNote();
      audioRef.current = { ctx };
      setSoundOn(true);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    return () => { if (audioRef.current) { audioRef.current.ctx.close(); audioRef.current = null; } };
  }, []);

  const openChest = (chest: Chest) => {
    if (chest.opened) return;
    chest.opened = true;
    const roll = Math.random();
    if (roll < 0.4) {
      const nt = Math.min(100, trustRef.current + 5);
      trustRef.current = nt; setTrust(nt);
      pushToast("Treasure!", "+5 Trust — your city glows brighter.", "#4ade80");
    } else if (roll < 0.7) {
      setCourage((c) => c + 10);
      pushToast("Treasure!", "+10 Courage — bravery builds cities.", "#fbbf24");
    } else {
      pushToast("Wisdom!", "💎 \"Wealth is what you don't see.\"", "#e879f9");
    }
    const S = stateRef.current;
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 120;
      S.particles.push({ x: chest.x, y: chest.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.8, color: "#fbbf24" });
    }
  };

  const triggerDilemma = (kind: "maya" | "peer" | "sam") => {
    setDilemmaKind(kind);
    const mem = mayaMemory;
    if (kind === "maya") {
      if (mem === "good") {
        setDilemma({
          q: "Maya beams! \"Your advice worked! But now my friend wants me to lend him ALL my savings. What should I do?\"",
          a: "Lend it all — that's what friends do!", b: "Lend a little, keep the rest safe", c: "Say no — money ruins friendships",
        });
      } else if (mem === "bad") {
        setDilemma({
          q: "Maya looks down. \"I kept all that money... and I feel awful. I want to make it right. What now?\"",
          a: "Too late — forget about it", b: "Try to find the owner and return it", c: "Give it to someone who needs it",
        });
      } else {
        setDilemma({
          q: "Maya found 100 Units! Nobody saw. A citizen needs your wisdom — what should she do?",
          a: "Keep it all — finders keepers!", b: "Save half, try to find the owner", c: "Spend it all on candy now",
        });
      }
    } else if (kind === "peer") {
      setDilemma({
        q: "Jay: \"Everyone's getting the Hover Board! 500 Units! Just borrow from your vault!\"",
        a: "Borrow — everyone's doing it!", b: "No — the vault is my future", c: "Let's save up together!",
      });
    } else {
      setDilemma({
        q: "Sam: \"FLASH SALE! 50% off for 5 MINUTES! Should I buy everything?!\"",
        a: "YES! Buy it all!", b: "Stop. Need it or just want it?", c: "Buy one small thing",
      });
    }
  };

  const answerDilemma = (choice: "a" | "b" | "c") => {
    const kind = dilemmaKind;
    setDilemma(null); setDilemmaKind(null);
    const S = stateRef.current;
    const good = (msg: string) => {
      const nt = Math.min(100, trustRef.current + 10);
      trustRef.current = nt; setTrust(nt);
      pushToast("Wise choice!", `${msg} Your city prospers.`, "#4ade80");
      S.blight = Math.max(0, S.blight - 0.2);
    };
    const bad = (msg: string) => {
      const nt = Math.max(0, trustRef.current - 10);
      trustRef.current = nt; setTrust(nt);
      pushToast("Tough call...", `${msg} Blight spreads.`, "#ef4444");
      S.blight = Math.min(1, S.blight + 0.25);
      const emo = EMOTIONS[Math.floor(Math.random() * 3)];
      recordEncounter(emo.id);
    };
    if (kind === "maya") {
      const setMem = (m: "good" | "bad") => {
        setMayaMemory(m);
        try { localStorage.setItem("pillarpath-maya", m); } catch { /* ignore */ }
      };
      if (choice === "b") { setMem("good"); good("Maya nods. \"That's what a Pillar does.\""); }
      else { setMem("bad"); bad("Maya looks uneasy. Easy now, costly later."); }
    } else if (kind === "peer") {
      if (choice === "a") bad("The vault cracks. Pressure is expensive.");
      else good(choice === "b" ? "Jay thinks... \"You're right.\"" : "Jay grins. \"Save together? More fun!\"");
    } else if (kind === "sam") {
      if (choice === "b") good("Sam breathes. \"Need it or want it?\" Crisis averted.");
      else bad("Panic-buy! The market district dims.");
    }
  };

  const acceptJob = (id: string) => {
    if (missionsDone.includes(id)) return;
    setMissionsDone((m) => [...m, id]);
    setSelected(null);
    pushToast("Mission accepted!", "Do it in real life, tell your parent — your Chore Village grows.", "#4ade80");
  };

  /* ------------------------------ canvas loop ------------------------------ */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const S = stateRef.current;

    const sprites: Record<string, HTMLImageElement> = {};
    for (const [k, src] of Object.entries({
      plaza: "/designs/game/game-plaza-bg.webp",
      chest: "/designs/game/game-chest.webp",
    })) {
      const img = new Image(); img.src = src; sprites[k] = img;
    }

    // Camera: fill screen by default, pinch to zoom, drag to pan.
    // Default view is biased left so Chore Village + Studio Island are in frame.
    const DEFAULT_CX = WORLD_W / 2 - 180;
    const cam = { cx: DEFAULT_CX, cy: WORLD_H / 2, zoom: 1 };
    let minZoom = 0.2;
    let maxZoom = 2.5;
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      minZoom = Math.min(w / WORLD_W, h / WORLD_H) * 0.9;
      // Default: cover the screen (no black bars).
      if (cam.zoom === 1) cam.zoom = Math.max(w / WORLD_W, h / WORLD_H);
      cam.zoom = Math.max(minZoom, Math.min(maxZoom, cam.zoom));
      clampCam(w, h);
    };
    const clampCam = (w: number, h: number) => {
      const vw = w / cam.zoom;
      const vh = h / cam.zoom;
      const mx = Math.max(0, (WORLD_W - vw) / 2) + 120;
      const my = Math.max(0, (WORLD_H - vh) / 2) + 120;
      cam.cx = Math.max(WORLD_W / 2 - mx, Math.min(WORLD_W / 2 + mx, cam.cx));
      cam.cy = Math.max(WORLD_H / 2 - my, Math.min(WORLD_H / 2 + my, cam.cy));
    };
    const screenToWorld = (sx: number, sy: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      return {
        x: cam.cx + (sx - w / 2) / cam.zoom,
        y: cam.cy + (sy - h / 2) / cam.zoom,
      };
    };
    resize();
    window.addEventListener("resize", resize);

    // Pointer handling: tap vs drag vs pinch.
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDist = 0;
    let pinchZoom = 1;
    let downTime = 0;
    let downPos = { x: 0, y: 0 };
    let moved = false;
    let lastPan = { x: 0, y: 0 };

    const handleTap = (sx: number, sy: number) => {
      const { x: wx, y: wy } = screenToWorld(sx, sy);
      for (const d of S.districts) {
        if (Math.hypot(wx - d.pos.x, wy - d.pos.y) < 130) {
          setSelected(d.id);
          return;
        }
      }
      for (const c of S.chests) {
        if (!c.opened && Math.hypot(wx - c.x, wy - c.y) < 70) {
          openChest(c);
          return;
        }
      }
      for (const ev of S.events) {
        if (Math.hypot(wx - ev.x, wy - ev.y) < 80) {
          if (ev.type === "dilemma" && ev.dilemmaKind) {
            triggerDilemma(ev.dilemmaKind);
          } else if (ev.type === "kindness") {
            const nt = Math.min(100, trustRef.current + 8);
            trustRef.current = nt; setTrust(nt);
            setCourage((c) => c + 5);
            toastRef.current("Kindness!", "You helped the elder. +8 Trust, +5 Courage.", "#4ade80");
            spawnBurst(ev.x, ev.y, "#4ade80", 16);
          } else if (ev.type === "shower") {
            setCourage((c) => c + 10);
            const nt = Math.min(100, trustRef.current + 3);
            trustRef.current = nt; setTrust(nt);
            toastRef.current("Blessing!", "+10 Courage, +3 Trust. The city smiles.", "#fbbf24");
            spawnBurst(ev.x, ev.y, "#fbbf24", 20);
          }
          S.events = S.events.filter((x) => x.id !== ev.id);
          return;
        }
      }
      setSelected(null);
    };

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        downTime = performance.now();
        downPos = { x: e.clientX, y: e.clientY };
        lastPan = { x: e.clientX, y: e.clientY };
        moved = false;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        pinchZoom = cam.zoom;
        moved = true; // cancel tap
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0) {
          const w = window.innerWidth;
          const h = window.innerHeight;
          // Zoom toward pinch midpoint.
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const before = screenToWorld(mx, my);
          cam.zoom = Math.max(minZoom, Math.min(maxZoom, pinchZoom * (d / pinchDist)));
          const after = screenToWorld(mx, my);
          cam.cx += before.x - after.x;
          cam.cy += before.y - after.y;
          clampCam(w, h);
        }
      } else if (pointers.size === 1) {
        const dx = e.clientX - lastPan.x;
        const dy = e.clientY - lastPan.y;
        lastPan = { x: e.clientX, y: e.clientY };
        if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 12) moved = true;
        if (moved) {
          cam.cx -= dx / cam.zoom;
          cam.cy -= dy / cam.zoom;
          clampCam(window.innerWidth, window.innerHeight);
        }
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0 && !moved && performance.now() - downTime < 500) {
        handleTap(e.clientX, e.clientY);
      }
      if (pointers.size < 2) pinchDist = 0;
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    // Expose zoom controls to React buttons.
    zoomRef.current = {
      zoomIn: () => {
        cam.zoom = Math.min(maxZoom, cam.zoom * 1.4);
        clampCam(window.innerWidth, window.innerHeight);
      },
      zoomOut: () => {
        cam.zoom = Math.max(minZoom, cam.zoom / 1.4);
        clampCam(window.innerWidth, window.innerHeight);
      },
      reset: () => {
        cam.cx = DEFAULT_CX; cam.cy = WORLD_H / 2;
        cam.zoom = Math.max(window.innerWidth / WORLD_W, window.innerHeight / WORLD_H);
        clampCam(window.innerWidth, window.innerHeight);
      },
    };

    // Auto-sound on first tap.
    let audioStarted = false;
    const autoAudio = () => {
      if (audioStarted || audioRef.current) return;
      audioStarted = true;
      toggleSound();
    };
    canvas.addEventListener("pointerdown", autoAudio, { once: true });

    let raf = 0;
    let last = performance.now();
    const spawnBurst = (x: number, y: number, color: string, n = 14) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 140;
        S.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.7 + Math.random() * 0.5, color });
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      S.time += dt;
      S.dayTime = (S.dayTime + dt / 360) % 1;

      // Blight follows trust inversely.
      const targetBlight = Math.max(0, (50 - trustRef.current) / 100);
      S.blight += (targetBlight - S.blight) * Math.min(1, dt * 0.5);

      // Random city events.
      S.eventTimer -= dt;
      if (S.eventTimer <= 0 && S.events.length < 2) {
        S.eventTimer = 35 + Math.random() * 35;
        S.eventId += 1;
        const roll = Math.random();
        const a = Math.random() * Math.PI * 2;
        const ex = 800 + Math.cos(a) * 320;
        const ey = 600 + Math.sin(a) * 240;
        if (roll < 0.5) {
          const kinds: Array<"maya" | "peer" | "sam"> = ["maya", "peer", "sam"];
          const dk = kinds[Math.floor(Math.random() * 3)];
          const labels = { maya: "😢 Maya needs wisdom", peer: "😤 Jay needs advice", sam: "😱 Sam needs help" };
          S.events.push({ id: S.eventId, type: "dilemma", label: labels[dk], x: ex, y: ey, ttl: 90, ph: Math.random() * 6, dilemmaKind: dk });
          toastRef.current(labels[dk], "A citizen seeks your counsel. Tap the beacon!", "#e879f9");
        } else if (roll < 0.75) {
          S.events.push({ id: S.eventId, type: "kindness", label: "🤝 Help Needed!", x: ex, y: ey, ttl: 60, ph: Math.random() * 6 });
          toastRef.current("🤝 Help Needed!", "An elder needs help. Tap the beacon!", "#4ade80");
        } else {
          S.events.push({ id: S.eventId, type: "shower", label: "✨ Blessing!", x: ex, y: ey, ttl: 45, ph: Math.random() * 6 });
          toastRef.current("✨ Blessing!", "The city smiles on you. Tap the beacon!", "#fbbf24");
        }
      }
      for (let i = S.events.length - 1; i >= 0; i--) {
        const ev = S.events[i];
        ev.ttl -= dt;
        if (ev.ttl <= 0) S.events.splice(i, 1);
      }
      // Kindness/shower auto-resolve on tap (handled in onTap for dilemma; others give instant reward).
      // (Tap handling above covers interaction.)

      // Particles.
      for (let i = S.particles.length - 1; i >= 0; i--) {
        const pt = S.particles[i];
        pt.life -= dt;
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        pt.vx *= 0.96; pt.vy *= 0.96;
        if (pt.life <= 0) S.particles.splice(i, 1);
      }

      /* ------------------------------ render ------------------------------ */
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const sw = canvas.width / dpr;
      const sh = canvas.height / dpr;
      ctx.clearRect(0, 0, sw, sh);
      ctx.save();
      // Camera transform: center on cam, apply zoom.
      ctx.translate(sw / 2, sh / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.cx, -cam.cy);

      // Background.
      const plazaImg = sprites.plaza;
      if (plazaImg.complete && plazaImg.naturalWidth > 0) {
        ctx.drawImage(plazaImg, 0, 0, WORLD_W, WORLD_H);
      } else {
        ctx.fillStyle = "#070b1c";
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      }

      // Fireflies.
      if (!S.fireflies) {
        S.fireflies = Array.from({ length: 24 }, () => ({
          x: Math.random() * WORLD_W, y: Math.random() * WORLD_H,
          ph: Math.random() * 6, sp: 8 + Math.random() * 16,
        }));
      }
      for (const f of S.fireflies) {
        f.x += Math.cos(S.time * 0.4 + f.ph) * f.sp * dt;
        f.y += Math.sin(S.time * 0.6 + f.ph) * f.sp * dt;
        ctx.save();
        ctx.globalAlpha = (0.25 + 0.45 * Math.abs(Math.sin(S.time * 1.5 + f.ph))) * 0.6;
        ctx.fillStyle = "#fde68a";
        ctx.beginPath(); ctx.arc(f.x, f.y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // Central monument — grows with rank.
      const rk = rankRef.current;
      const rankIdx = ["Seedling", "Sprout", "Trailblazer", "Luminary", "Pillar"].indexOf(rk.name);
      const monSize = 90 + rankIdx * 22;
      const monPulse = 1 + Math.sin(S.time * 2) * 0.03;
      ctx.save();
      ctx.translate(800, 600);
      ctx.scale(monPulse, monPulse);
      // Glow.
      const mg = ctx.createRadialGradient(0, 0, 10, 0, 0, monSize * 1.4);
      mg.addColorStop(0, "rgba(34,211,238,0.35)");
      mg.addColorStop(1, "rgba(34,211,238,0)");
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(0, 0, monSize * 1.4, 0, Math.PI * 2); ctx.fill();
      // Pillar.
      ctx.fillStyle = "#1e293b";
      roundRect(ctx, -monSize * 0.22, -monSize * 0.7, monSize * 0.44, monSize * 1.4, 12);
      ctx.fill();
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 3;
      roundRect(ctx, -monSize * 0.22, -monSize * 0.7, monSize * 0.44, monSize * 1.4, 12);
      ctx.stroke();
      // Top orb.
      ctx.fillStyle = "#22d3ee";
      ctx.shadowColor = "#22d3ee"; ctx.shadowBlur = 24;
      ctx.beginPath(); ctx.arc(0, -monSize * 0.85, 16, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
      // Rank label.
      ctx.font = "bold 20px system-ui";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      const rlw = ctx.measureText(`🏛️ ${rk.name}`).width;
      roundRect(ctx, 800 - rlw / 2 - 12, 600 + monSize * 0.85, rlw + 24, 32, 14);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(`🏛️ ${rk.name}`, 800, 600 + monSize * 0.85 + 22);

      // Districts.
      for (const d of S.districts) {
        const lvl = districtLevels[d.id] ?? 1;
        const isLocked = (d.id === "vault" && !vaultUnlocked) || (d.id === "market" && !marketUnlocked);
        const size = 64 + lvl * 14;
        const pulse = 1 + Math.sin(S.time * 2 + d.pos.x) * 0.02;

        // Blight overlay.
        if (S.blight > 0.15) {
          ctx.save();
          ctx.globalAlpha = S.blight * 0.5;
          ctx.fillStyle = "#4c1d95";
          ctx.beginPath(); ctx.arc(d.pos.x, d.pos.y, size * 1.3, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(d.pos.x, d.pos.y);
        ctx.scale(pulse, pulse);
        // Shadow.
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.beginPath(); ctx.ellipse(0, size * 0.55, size * 0.5, size * 0.16, 0, 0, Math.PI * 2); ctx.fill();
        // Glow.
        const g = ctx.createRadialGradient(0, 0, 8, 0, 0, size * 1.2);
        g.addColorStop(0, `${d.color}44`);
        g.addColorStop(1, `${d.color}00`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, size * 1.2, 0, Math.PI * 2); ctx.fill();
        // Building base.
        ctx.fillStyle = isLocked ? "#1f2937" : "#0f172a";
        roundRect(ctx, -size / 2, -size / 2, size, size, 18);
        ctx.fill();
        ctx.strokeStyle = isLocked ? "#4b5563" : d.color;
        ctx.lineWidth = 3;
        roundRect(ctx, -size / 2, -size / 2, size, size, 18);
        ctx.stroke();
        // Icon.
        ctx.font = `${Math.round(size * 0.5)}px system-ui`;
        ctx.textAlign = "center";
        ctx.globalAlpha = isLocked ? 0.4 : 1;
        ctx.fillText(d.icon, 0, size * 0.18);
        ctx.globalAlpha = 1;
        if (isLocked) {
          ctx.font = "bold 28px system-ui";
          ctx.fillText("🔒", 0, -size * 0.28);
        }
        ctx.restore();

        // Name + level pips.
        ctx.font = "bold 15px system-ui";
        ctx.textAlign = "center";
        const nw = ctx.measureText(d.name).width;
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        roundRect(ctx, d.pos.x - nw / 2 - 10, d.pos.y + size / 2 + 8, nw + 20, 26, 12);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(d.name, d.pos.x, d.pos.y + size / 2 + 26);
        // Level pips.
        for (let li = 0; li < 5; li++) {
          ctx.fillStyle = li < lvl ? d.color : "rgba(255,255,255,0.18)";
          ctx.beginPath();
          ctx.arc(d.pos.x - 28 + li * 14, d.pos.y + size / 2 + 44, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Chests.
      const chestImg = sprites.chest;
      for (const c of S.chests) {
        if (c.opened) continue;
        const bob = Math.sin(S.time * 2 + c.ph) * 4;
        if (chestImg.complete && chestImg.naturalWidth > 0) {
          ctx.save();
          ctx.translate(c.x, c.y + bob);
          ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 12;
          ctx.drawImage(chestImg, -26, -26, 52, 52);
          ctx.restore();
        }
        ctx.fillStyle = `rgba(251,191,36,${(0.5 + 0.4 * Math.sin(S.time * 4 + c.ph)).toFixed(2)})`;
        ctx.font = "bold 18px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("✦", c.x + 24, c.y - 26 + bob);
      }

      // Events.
      for (const ev of S.events) {
        const bounce = Math.abs(Math.sin(S.time * 3 + ev.ph)) * 10;
        const beamG = ctx.createLinearGradient(ev.x, ev.y - 140, ev.x, ev.y);
        beamG.addColorStop(0, "rgba(232,121,249,0)");
        beamG.addColorStop(1, "rgba(232,121,249,0.4)");
        ctx.fillStyle = beamG;
        ctx.fillRect(ev.x - 14, ev.y - 140 - bounce, 28, 140);
        ctx.font = "bold 36px system-ui";
        ctx.textAlign = "center";
        const icons: Record<string, string> = { dilemma: "❗", kindness: "🤝", shower: "✨", lost: "😢" };
        ctx.fillText(icons[ev.type] || "❗", ev.x, ev.y - 36 - bounce);
        ctx.font = "bold 14px system-ui";
        const lw = ctx.measureText(ev.label).width;
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        roundRect(ctx, ev.x - lw / 2 - 10, ev.y + 18, lw + 20, 26, 12);
        ctx.fill();
        ctx.fillStyle = "#e879f9";
        ctx.fillText(ev.label, ev.x, ev.y + 36);
      }

      // Particles.
      for (const pt of S.particles) {
        ctx.globalAlpha = Math.max(0, pt.life * 1.4);
        ctx.fillStyle = pt.color;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // Day/night tint (screen space).
      const t = S.dayTime;
      let tint: string | null = null;
      let mood: "dawn" | "day" | "sunset" | "night" = "day";
      if (t > 0.42 && t < 0.58) {
        const k = Math.sin(((t - 0.42) / 0.16) * Math.PI);
        tint = `rgba(251,146,60,${(k * 0.16).toFixed(3)})`;
        mood = "sunset";
      } else if (t >= 0.58 && t < 0.92) {
        const k = Math.sin(((t - 0.58) / 0.34) * Math.PI);
        tint = `rgba(30,27,75,${(k * 0.32).toFixed(3)})`;
        mood = "night";
      } else if (t >= 0.92 || t < 0.08) {
        mood = "dawn";
        tint = `rgba(244,114,182,${(0.1).toFixed(3)})`;
      }
      if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, sw, sh); }
      if (mood !== cityMood) setCityMood(mood);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerdown", autoAudio);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle kindness/shower event taps via selected state effect.
  useEffect(() => {
    const S = stateRef.current;
    // Auto-resolve non-dilemma events when tapped (they're handled in onTap by proximity; this is a fallback).
  }, [selected]);

  /* ------------------------------ district panels ------------------------------ */
  const selDef = selected ? DISTRICT_DEFS.find((d) => d.id === selected) : null;
  const selLevel = selected ? districtLevels[selected] ?? 1 : 1;
  const selLocked = selected === "vault" ? !vaultUnlocked : selected === "market" ? !marketUnlocked : false;

  if (showCodex) {
    const enc = getEncounters();
    const discovered = EMOTIONS.filter((e) => enc[e.id] > 0).length;
    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-background">
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => setShowCodex(false)} className="gap-1">
            <ArrowLeft className="size-4" /> Back to the City
          </Button>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Name it to tame it</p>
            <h1 className="font-display text-2xl font-bold">The Emotion Codex</h1>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">{discovered} of {EMOTIONS.length} discovered.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {EMOTIONS.map((e) => {
              const count = enc[e.id] || 0;
              const found = count > 0;
              return (
                <div key={e.id} className="rounded-2xl border p-4" style={{ borderColor: found ? `${e.color}55` : undefined, opacity: found ? 1 : 0.55 }}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{found ? e.icon : "❓"}</span>
                    <div>
                      <p className="font-display font-bold" style={{ color: found ? e.color : undefined }}>{found ? e.name : "???"}</p>
                      <p className="text-[11px] uppercase tracking-widest text-muted">{e.family}</p>
                    </div>
                    {found && <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">Faced {count}×</span>}
                  </div>
                  {found ? (
                    <div className="mt-2 space-y-1 text-sm">
                      <p className="italic text-muted">"{e.whisper}"</p>
                      <p className="font-medium">{e.truth}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted">Not yet encountered...</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------ main view ------------------------------ */
  return (
    <div className="fixed inset-0 z-[60] bg-black">
      <canvas ref={canvasRef} className="block touch-none" />

      {/* Top HUD */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-3">
        <Button variant="ghost" size="sm" onClick={() => setScreen("home")} className="gap-1 text-white hover:bg-white/15 hover:text-white">
          <ArrowLeft className="size-4" /> World
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggleSound} className="px-2 text-white hover:bg-white/15 hover:text-white">
            {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowCodex(true)} className="gap-1 text-xs text-white hover:bg-white/15 hover:text-white">
            <BookOpen className="size-4" /> Codex
          </Button>
          <div className="flex items-center gap-1 text-xs font-bold text-white" title="Trust">
            <Heart className="size-4" style={{ color: trust >= 70 ? "#4ade80" : trust >= 40 ? "#fbbf24" : "#ef4444" }} />
            <span>{trust}</span>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-amber-300" title="Courage">
            <span>💪</span><span>{courage}</span>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-cyan-300" title="Rank">
            <Sparkles className="size-4" /> {rank.name}
          </div>
        </div>
      </div>

      {/* City mood indicator */}
      <div className="absolute left-3 top-14 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white/80 backdrop-blur-sm">
        {cityMood === "day" && "☀️ Day in the city"}
        {cityMood === "sunset" && "🌅 Sunset over the plaza"}
        {cityMood === "night" && "🌙 Night — the city glows"}
        {cityMood === "dawn" && "🌄 Dawn — a new day"}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-3 z-20 flex flex-col gap-2">
        <Button size="sm" variant="ghost" className="h-10 w-10 rounded-full bg-black/60 p-0 text-xl text-white backdrop-blur-sm hover:bg-black/80 hover:text-white" onClick={() => zoomRef.current.zoomIn()}>＋</Button>
        <Button size="sm" variant="ghost" className="h-10 w-10 rounded-full bg-black/60 p-0 text-xl text-white backdrop-blur-sm hover:bg-black/80 hover:text-white" onClick={() => zoomRef.current.zoomOut()}>－</Button>
        <Button size="sm" variant="ghost" className="h-10 w-10 rounded-full bg-black/60 p-0 text-sm text-white backdrop-blur-sm hover:bg-black/80 hover:text-white" onClick={() => zoomRef.current.reset()}>⟡</Button>
      </div>

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="pointer-events-none absolute inset-x-3 top-24 z-30 space-y-2">
          {toasts.map((t) => (
            <div key={t.id} className="rounded-2xl border bg-black/85 p-3 backdrop-blur-sm" style={{ borderColor: `${t.color}55` }}>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: t.color }}>{t.title}</p>
              <p className="mt-0.5 text-sm leading-snug text-white">{t.msg}</p>
            </div>
          ))}
        </div>
      )}

      {/* Dilemma modal */}
      {dilemma && (
        <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-fuchsia-300/30 bg-black/90 p-4 backdrop-blur-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">
            {dilemmaKind === "maya" ? "Maya needs wisdom" : dilemmaKind === "peer" ? "Jay needs advice" : "Sam needs help"}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-white">{dilemma.q}</p>
          <div className="mt-3 space-y-2">
            {([["a", dilemma.a], ["b", dilemma.b], ["c", dilemma.c]] as Array<[string, string]>).map(([k, text]) => (
              <Button key={k} size="sm" variant="outline" className="w-full justify-start border-white/25 text-left text-white hover:bg-white/10 hover:text-white" onClick={() => answerDilemma(k as "a" | "b" | "c")}>
                {text}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* District detail sheet */}
      {selDef && (
        <div className="absolute inset-x-0 bottom-0 max-h-[70%] overflow-y-auto rounded-t-3xl border-t border-white/15 bg-[#0b1020]/95 p-5 backdrop-blur-md">
          <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-white/20" />
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display text-xl font-bold text-white">{selDef.icon} {selDef.name}</p>
              <p className="mt-1 text-sm text-white/70">{selDef.desc}</p>
              <div className="mt-2 flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className="text-lg" style={{ color: i < selLevel ? selDef.color : "rgba(255,255,255,0.15)" }}>●</span>
                ))}
                <span className="ml-2 text-xs font-bold text-white/60">Level {selLevel}/5</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="text-white hover:bg-white/10">✕</Button>
          </div>

          {selLocked ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/5 p-4 text-sm text-white/80">
              <Lock className="size-5" style={{ color: selDef.color }} />
              {selected === "vault"
                ? `Save ${50 - vault} more Units in real life to unlock Vault Mountain.`
                : `Complete ${3 - choresDone} more real chores to unlock Market Harbor.`}
            </div>
          ) : (
            <div className="mt-4">
              {selected === "chore" && (
                <div className="space-y-2">
                  {JOBS.map((job) => {
                    const done = missionsDone.includes(job.id);
                    return (
                      <div key={job.id} className="flex items-center justify-between rounded-xl bg-white/5 p-3">
                        <div>
                          <p className="font-bold text-white">{job.name}</p>
                          <p className="text-xs text-white/60">{job.desc}</p>
                          <p className="mt-1 text-xs font-bold text-amber-300">+{job.reward} Units</p>
                        </div>
                        <Button size="sm" disabled={done} onClick={() => acceptJob(job.id)} className={done ? "" : "bg-emerald-400 font-bold text-black hover:bg-emerald-300"}>
                          {done ? "✓" : "Accept"}
                        </Button>
                      </div>
                    );
                  })}
                  <p className="pt-1 text-center text-xs text-white/50">Do these in real life — your village grows with every chore.</p>
                </div>
              )}
              {selected === "vault" && (
                <div>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-white">Savings Vault</p>
                    <p className="text-xl font-bold text-amber-300">{vault} Units</p>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-200" style={{ width: `${vaultTarget > 0 ? Math.min(100, Math.round((vault / vaultTarget) * 100)) : 0}%` }} />
                  </div>
                  <p className="mt-3 rounded-xl bg-white/5 p-3 text-sm text-white/75">💡 Every Unit saved makes the mountain taller. Savers have more <em>choices</em>.</p>
                </div>
              )}
              {selected === "market" && (
                <div>
                  {!marketChoice ? (
                    <div className="space-y-2">
                      <p className="text-sm text-white/70">The Merchant's Test — you have 80 Units:</p>
                      <Button variant="outline" className="w-full justify-start border-white/20 text-white hover:bg-white/10" onClick={() => setMarketChoice("candy")}>🍬 Candy — 30U</Button>
                      <Button variant="outline" className="w-full justify-start border-white/20 text-white hover:bg-white/10" onClick={() => setMarketChoice("book")}>📚 Skill Book — 50U</Button>
                      <Button variant="outline" className="w-full justify-start border-white/20 text-white hover:bg-white/10" onClick={() => setMarketChoice("save")}>💰 Save it all</Button>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-white/5 p-4">
                      <p className="text-sm text-white/85">
                        {marketChoice === "candy" && "Tasty! Gone tomorrow. Will you care in a week?"}
                        {marketChoice === "book" && "Excellent! Knowledge pays forever."}
                        {marketChoice === "save" && "Disciplined! Sometimes the best purchase is none."}
                      </p>
                      <Button variant="ghost" size="sm" className="mt-2 text-white" onClick={() => setMarketChoice(null)}>Try again</Button>
                    </div>
                  )}
                </div>
              )}
              {(selected === "studio" || selected === "learn" || selected === "hall") && (
                <p className="rounded-xl bg-white/5 p-4 text-sm text-white/70">
                  {selected === "studio" && "🎨 Your creations live here. The more you make in the Studio, the brighter this island glows."}
                  {selected === "learn" && "📚 Every lesson completed deepens the lagoon. Knowledge compounds."}
                  {selected === "hall" && "🏛️ Your journey, carved in stone. Each rank adds a new chapter to your story."}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Ceremony */}
      {ceremony && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/70 backdrop-blur-sm">
          <div className="mx-6 rounded-3xl border border-amber-300/50 bg-gradient-to-b from-amber-950/90 to-black/90 p-8 text-center">
            <p className="text-5xl">🎉</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-amber-300">Your city grows!</p>
            <p className="mt-2 font-display text-3xl font-bold text-white">Welcome, {ceremony}!</p>
            <p className="mt-1 text-sm text-white/70">The monument rises. New districts shine.</p>
            <Button className="mt-4 bg-amber-400 font-bold text-black" onClick={() => setCeremony(null)}>Behold my city</Button>
          </div>
        </div>
      )}

      {/* Hint */}
      {!selected && !dilemma && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-[11px] font-medium text-white/70 backdrop-blur-sm">
          👆 Tap districts · Pinch to zoom · Drag to explore
        </div>
      )}
    </div>
  );
}
