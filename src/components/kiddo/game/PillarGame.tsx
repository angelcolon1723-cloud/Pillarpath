import { useEffect, useRef, useState, useCallback } from "react";
import { useLedger } from "@/store/ledger";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, CloudLightning, Lock, Heart, BookOpen } from "lucide-react";
import { rankForScore, societyScore } from "@/components/kiddo/world/WorldMap";
import { EMOTIONS, getEncounters, recordEncounter } from "./emotions";

/* ------------------------------------------------------------------ */
/* Pillar Plaza v2 — full-screen immersive rebuild.                     */
/* Collision remapped to match the AAA background. Bigger, denser.     */
/* ------------------------------------------------------------------ */

const WORLD_W = 1600;
const WORLD_H = 1200;
const PLAYER_SPEED = 260;
const PLAYER_R = 16;

interface Vec { x: number; y: number }
interface Orb extends Vec { taken: boolean; ph: number }
interface Doubtling extends Vec { ph: number; dir: number; speed: number; stun: number; emotionId: string }
interface StormCloud extends Vec { r: number; vx: number; ph: number }
interface Chest extends Vec { opened: boolean; ph: number }
interface CourageOrb extends Vec { taken: boolean; ph: number; value: number }
interface Wanderer extends Vec { dir: number; speed: number; ph: number; pauseT: number; name: string }
interface CircleObs { x: number; y: number; r: number }
interface RectObs { x: number; y: number; w: number; h: number; label?: string; color: string }

/* Collision remapped to the AAA plaza background:
   - Central monument: circular
   - Buildings at perimeter where the visual structures are
   - Gardens and pathways: open */
const CIRCLE_OBS: CircleObs[] = [
  { x: 800, y: 600, r: 75 }, // central pillar monument (just the pillar, rings are walkable)
];

const RECT_OBS: RectObs[] = [
  { x: 660, y: 20, w: 280, h: 80, label: "Hall of Becoming", color: "#f472b6" },
  { x: 40, y: 60, w: 140, h: 100, label: "Chore Village", color: "#4ade80" },
  { x: 1420, y: 60, w: 140, h: 100, label: "Vault Mountain", color: "#fbbf24" },
  { x: 40, y: 1040, w: 140, h: 100, label: "Studio Island", color: "#e879f9" },
  { x: 1420, y: 1040, w: 140, h: 100, label: "Market Harbor", color: "#a78bfa" },
  { x: 660, y: 1100, w: 280, h: 80, label: "Learning Lagoon", color: "#38bdf8" },
];

const ORB_SPOTS: Vec[] = [
  { x: 350, y: 600 }, { x: 1250, y: 600 }, { x: 800, y: 300 },
  { x: 300, y: 900 }, { x: 1300, y: 900 }, { x: 500, y: 300 },
  { x: 1100, y: 300 }, { x: 800, y: 950 },
];

const KEEPER_POS: Vec = { x: 800, y: 800 };
const MAYA_POS: Vec = { x: 1050, y: 950 };
const PEER_POS: Vec = { x: 550, y: 950 };
const SAM_POS: Vec = { x: 800, y: 200 };
const CHORE_DOOR: Vec = { x: 110, y: 200 };
const VAULT_DOOR: Vec = { x: 1490, y: 200 };
const MARKET_DOOR: Vec = { x: 1490, y: 1100 };

const JOBS = [
  { id: "dishes", name: "Dish Dynamo", desc: "Wash the dinner dishes without being asked.", reward: 30 },
  { id: "room", name: "Room Rescue", desc: "Clean your room top to bottom in 20 minutes.", reward: 40 },
  { id: "neighbor", name: "Neighbor Hero", desc: "Help a neighbor carry groceries.", reward: 60 },
];

function circleHit(cx: number, cy: number, r: number): boolean {
  for (const c of CIRCLE_OBS) {
    const dx = cx - c.x;
    const dy = cy - c.y;
    if (dx * dx + dy * dy < (r + c.r) * (r + c.r)) return true;
  }
  for (const o of RECT_OBS) {
    const nx = Math.max(o.x, Math.min(cx, o.x + o.w));
    const ny = Math.max(o.y, Math.min(cy, o.y + o.h));
    const dx = cx - nx;
    const dy = cy - ny;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

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

  const [quest, setQuest] = useState<"intro" | "active" | "done">("intro");
  const [orbsHeld, setOrbsHeld] = useState(0);
  const [dialog, setDialog] = useState<string | null>(
    "Welcome to Pillar Plaza, traveler. I'm the Keeper. Our Unit orbs have scattered — and Doubtlings hunt in the shadows. Will you bring back 8 orbs?"
  );
  const [hits, setHits] = useState(0);
  const [won, setWon] = useState(false);
  const [interior, setInterior] = useState<null | "chore" | "vault" | "market">(null);
  const [dilemma, setDilemma] = useState<null | { q: string; a: string; b: string; c: string }>(null);
  const [dilemmaKind, setDilemmaKind] = useState<null | "maya" | "peer" | "sam">(null);
  const [missionsDone, setMissionsDone] = useState<string[]>([]);
  const [nearWhat, setNearWhat] = useState<null | "keeper" | "maya" | "peer" | "sam" | "chore" | "vault" | "market" | "chest">(null);
  const [inStorm, setInStorm] = useState(false);
  const [showCodex, setShowCodex] = useState(false);
  const [ceremony, setCeremony] = useState<null | string>(null);
  const [mayaMemory, setMayaMemory] = useState<null | "good" | "bad">(null);
  const [marketChoice, setMarketChoice] = useState<null | string>(null);
  const [courage, setCourage] = useState(0);
  const [trust, setTrust] = useState(50);
  const [toasts, setToasts] = useState<Array<{ id: number; title: string; msg: string; color: string }>>([]);
  const toastId = useRef(0);

  const pushToast = (title: string, msg: string, color = "#fbbf24") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, title, msg, color }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  };
  const toastRef = useRef(pushToast);
  toastRef.current = pushToast;

  const trustRef = useRef(50);
  const stateRef = useRef({
    player: { x: 800, y: 1000 } as Vec,
    orbs: ORB_SPOTS.map((s) => ({ ...s, taken: false, ph: Math.random() * 6 })) as Orb[],
    doubtlings: [
      { x: 500, y: 600, ph: 0, dir: 0, speed: 95, stun: 0, emotionId: "doubt" },
      { x: 1100, y: 600, ph: 2, dir: 2, speed: 105, stun: 0, emotionId: "impulse" },
      { x: 1300, y: 800, ph: 4, dir: 4, speed: 120, stun: 0, emotionId: "loneliness" },
      { x: 350, y: 750, ph: 1, dir: 1, speed: 88, stun: 0, emotionId: "doubt" },
    ] as Doubtling[],
    clouds: [
      { x: 400, y: 300, r: 130, vx: 22, ph: 0 },
      { x: 1200, y: 500, r: 150, vx: -18, ph: 2 },
      { x: 800, y: 950, r: 110, vx: 26, ph: 4 },
    ] as StormCloud[],
    chests: [
      { x: 300, y: 420, opened: false, ph: 0 },
      { x: 1300, y: 450, opened: false, ph: 2 },
      { x: 800, y: 1100, opened: false, ph: 4 },
      { x: 200, y: 700, opened: false, ph: 1 },
      { x: 1400, y: 700, opened: false, ph: 3 },
    ] as Chest[],
    courageOrbs: [] as CourageOrb[],
    wanderers: [
      { x: 600, y: 450, dir: 0, speed: 40, ph: 0, pauseT: 0, name: "Lily" },
      { x: 1000, y: 750, dir: 2, speed: 35, ph: 2, pauseT: 0, name: "Max" },
      { x: 700, y: 950, dir: 4, speed: 45, ph: 4, pauseT: 0, name: "Zoe" },
      { x: 1150, y: 400, dir: 1, speed: 38, ph: 1, pauseT: 0, name: "Kai" },
      { x: 450, y: 800, dir: 3, speed: 42, ph: 3, pauseT: 0, name: "Ava" },
      { x: 950, y: 550, dir: 5, speed: 36, ph: 5, pauseT: 0, name: "Leo" },
    ] as Wanderer[],
    courageTimer: 0,
    courage: 0,
    fireflies: null as null | Array<{ x: number; y: number; ph: number; sp: number }>,
    keys: {} as Record<string, boolean>,
    joy: { x: 0, y: 0, active: false },
    cam: { x: 0, y: 0 } as Vec,
    camVel: { x: 0, y: 0 } as Vec,
    slowUntil: 0,
    particles: [] as Array<Vec & { vx: number; vy: number; life: number; color: string }>,
    time: 0,
    nearMissCd: 0,
    nearMissT: 0,
    faceAngle: 0,
    inStorm: false,
  });

  const questRef = useRef(quest);
  questRef.current = quest;

  useEffect(() => {
    try {
      const mem = localStorage.getItem("pillarpath-maya");
      if (mem === "good" || mem === "bad") setMayaMemory(mem);
    } catch { /* ignore */ }
    try {
      const lastRank = localStorage.getItem("pillarpath-last-rank");
      if (lastRank && lastRank !== rank.name) {
        const order = ["Seedling", "Sprout", "Trailblazer", "Luminary", "Pillar"];
        if (order.indexOf(rank.name) > order.indexOf(lastRank)) setCeremony(rank.name);
      }
      localStorage.setItem("pillarpath-last-rank", rank.name);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (interior) { setNearWhat(null); return; }
      const p = stateRef.current.player;
      const d = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
      if (d(p, KEEPER_POS) < 100) setNearWhat("keeper");
      else if (d(p, MAYA_POS) < 100) setNearWhat("maya");
      else if (d(p, PEER_POS) < 100) setNearWhat("peer");
      else if (d(p, SAM_POS) < 100) setNearWhat("sam");
      else if (d(p, CHORE_DOOR) < 120) setNearWhat("chore");
      else if (d(p, VAULT_DOOR) < 120) setNearWhat("vault");
      else if (d(p, MARKET_DOOR) < 120) setNearWhat("market");
      else {
        const chest = stateRef.current.chests.find((c) => !c.opened && d(p, c) < 85);
        setNearWhat(chest ? "chest" : null);
      }
      setInStorm(stateRef.current.inStorm);
    }, 250);
    return () => clearInterval(id);
  }, [interior]);

  const startQuest = useCallback(() => {
    questRef.current = "active";
    setQuest("active");
    setDialog(null);
    toastRef.current("Quest started!", "8 orbs glow across the plaza. Storms slow you, Doubtlings hunt you. The brave earn more.", "#22d3ee");
  }, []);

  const talkToKeeper = () => {
    const q = questRef.current;
    const held = stateRef.current.orbs.filter((o) => o.taken).length;
    if (q === "intro") {
      setDialog("Our Unit orbs have scattered across the plaza — and Doubtlings hunt in the shadows. Bring back 8 orbs. Will you do it?");
    } else if (q === "active" && held >= 8) {
      questRef.current = "done";
      setQuest("done");
      setWon(true);
      const hitCount = hits;
      if (hitCount === 0) {
        const nt = Math.min(100, trustRef.current + 15);
        trustRef.current = nt;
        setTrust(nt);
        setCourage((c) => c + 20);
        stateRef.current.courage += 20;
      }
      const p = stateRef.current.player;
      const colors = ["#22d3ee", "#e879f9", "#fbbf24", "#4ade80", "#a78bfa"];
      for (let i = 0; i < 100; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 80 + Math.random() * 240;
        stateRef.current.particles.push({
          x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
          life: 1.2 + Math.random() * 0.8, color: colors[i % colors.length],
        });
      }
      setDialog(null);
      toastRef.current(
        hitCount === 0 ? "FLAWLESS!" : "Quest complete!",
        hitCount === 0
          ? "Not a single Doubtling touched you. +15 Trust, +20 Courage. The plaza whispers your name."
          : `Every orb recovered in ${hitCount} hits. That's what a Pillar does. +50 Units.`,
        "#fbbf24"
      );
    } else if (q === "active") {
      setDialog(`You carry ${held} of 8 orbs. ${8 - held} still out there. Watch the shadows, mind the storms.`);
    } else {
      setDialog("The plaza is safe because of you, traveler. Better than yesterday — every single day.");
    }
  };

  const talkToMaya = () => {
    setDilemmaKind("maya");
    const mem = mayaMemory;
    if (mem === "good") {
      setDilemma({
        q: "Maya beams! \"Your advice worked! But now my friend wants me to lend him ALL my savings. What should I do?\"",
        a: "Lend it all — that's what friends do!",
        b: "Lend a little, keep the rest safe",
        c: "Say no — money ruins friendships",
      });
    } else if (mem === "bad") {
      setDilemma({
        q: "Maya looks down. \"I kept all that money... and I feel awful. I want to make it right. What now?\"",
        a: "Too late — forget about it",
        b: "Try to find the owner and return it",
        c: "Give it to someone who needs it",
      });
    } else {
      setDilemma({
        q: "Maya found 100 Units! Nobody saw. What should she do?",
        a: "Keep it all — finders keepers!",
        b: "Save half, try to find the owner",
        c: "Spend it all on candy now",
      });
    }
  };

  const talkToPeer = () => {
    setDilemmaKind("peer");
    setDilemma({
      q: "Jay: \"Everyone's getting the Hover Board! 500 Units! Just borrow from your vault!\"",
      a: "Borrow — everyone's doing it!",
      b: "No — the vault is my future",
      c: "Let's save up together!",
    });
  };

  const talkToSam = () => {
    setDilemmaKind("sam");
    setDilemma({
      q: "Sam: \"FLASH SALE! 50% off for 5 MINUTES! Should I buy everything?!\"",
      a: "YES! Buy it all!",
      b: "Stop. Need it or just want it?",
      c: "Buy one small thing",
    });
  };

  const answerDilemma = (choice: "a" | "b" | "c") => {
    const kind = dilemmaKind;
    setDilemma(null);
    setDilemmaKind(null);
    const good = (msg: string) => {
      const nt = Math.min(100, trustRef.current + 10);
      trustRef.current = nt;
      setTrust(nt);
      toastRef.current("Good choice!", `${msg} Trust up — Doubtlings weaken.`, "#4ade80");
    };
    const bad = (msg: string, penalty = 10) => {
      const nt = Math.max(0, trustRef.current - penalty);
      trustRef.current = nt;
      setTrust(nt);
      toastRef.current("Tough call...", `${msg} Trust down — Doubtlings grow bolder.`, "#ef4444");
    };
    if (kind === "maya") {
      const setMem = (m: "good" | "bad") => {
        setMayaMemory(m);
        try { localStorage.setItem("pillarpath-maya", m); } catch { /* ignore */ }
      };
      if (choice === "b") {
        setMem("good");
        good(mayaMemory === "bad"
          ? "Maya lights up. \"I'll make it right!\" Redemption feels amazing."
          : "Maya nods. \"Saving half, finding the owner — that's what a Pillar does.\"");
      } else {
        setMem("bad");
        bad(choice === "a" && mayaMemory !== "good"
          ? "Maya pockets it... but looks uneasy. Honest money feels better."
          : "Sweet now, empty later. That's the trap.", 5);
      }
    } else if (kind === "peer") {
      if (choice === "a") bad("You borrow from the vault. Fun for a week — savings wrecked. Pressure is expensive.");
      else good(choice === "b" ? "Jay thinks... \"You're right.\" Standing up to pressure is strength." : "Jay grins. \"Save together? More fun!\" Pressure became teamwork.");
    } else if (kind === "sam") {
      if (choice === "b") good("Sam breathes. \"Need it or want it?\" He puts it all back. The pause saved a fortune.");
      else bad(choice === "a" ? "Panic-buy! Regret begins. Flash sales bypass your brain." : "The rush fades in minutes. Impulse steals futures.", 5);
    }
  };

  const openChest = () => {
    const p = stateRef.current.player;
    const chest = stateRef.current.chests.find((c) => !c.opened && Math.hypot(p.x - c.x, p.y - c.y) < 85);
    if (!chest) return;
    chest.opened = true;
    const roll = Math.random();
    if (roll < 0.4) {
      const nt = Math.min(100, trustRef.current + 5);
      trustRef.current = nt;
      setTrust(nt);
      pushToast("Treasure!", "+5 Trust — the Doubtlings shrink.", "#4ade80");
    } else if (roll < 0.7) {
      setCourage((c) => c + 10);
      stateRef.current.courage += 10;
      pushToast("Treasure!", "+10 Courage — bravery compounds.", "#fbbf24");
    } else {
      const wisdoms = [
        "💎 \"Wealth is what you don't see.\"",
        "💎 \"A habit saved is a fortune built.\"",
        "💎 \"The best investment is yourself.\"",
      ];
      pushToast("Wisdom found!", wisdoms[Math.floor(Math.random() * wisdoms.length)], "#e879f9");
    }
    const S = stateRef.current;
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 120;
      S.particles.push({ x: chest.x, y: chest.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.8 + Math.random() * 0.4, color: "#fbbf24" });
    }
  };

  const acceptJob = (id: string) => {
    if (missionsDone.includes(id)) return;
    setMissionsDone((m) => [...m, id]);
    setInterior(null);
    pushToast("Mission accepted!", "Do this chore in real life, tell your parent — Units incoming.", "#4ade80");
  };

  /* ------------------------------ game loop ------------------------------ */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const S = stateRef.current;

    const sprites: Record<string, HTMLImageElement> = {};
    for (const [k, src] of Object.entries({
      player: "/designs/game/game-kid.webp",
      doubtling: "/designs/game/game-doubtling.webp",
      orb: "/designs/game/game-orb.webp",
      keeper: "/designs/game/game-keeper.webp",
      plaza: "/designs/game/game-plaza-bg.webp",
      chest: "/designs/game/game-chest.webp",
    })) {
      const img = new Image();
      img.src = src;
      sprites[k] = img;
    }

    const resize = () => {
      // Full-screen: fill the entire viewport minus nothing.
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const keyDown = (e: KeyboardEvent) => { S.keys[e.key.toLowerCase()] = true; };
    const keyUp = (e: KeyboardEvent) => { S.keys[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    const joyBase = { x: 0, y: 0 };
    let joyId: number | null = null;
    const joyStart = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (x < r.width * 0.45 && y > r.height * 0.45) {
        joyId = e.pointerId;
        joyBase.x = x;
        joyBase.y = y;
        S.joy.active = true;
        try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
      }
    };
    const joyMove = (e: PointerEvent) => {
      if (e.pointerId !== joyId) return;
      const r = canvas.getBoundingClientRect();
      const dx = e.clientX - r.left - joyBase.x;
      const dy = e.clientY - r.top - joyBase.y;
      const len = Math.hypot(dx, dy) || 1;
      const max = 70;
      const cl = Math.min(1, max / len);
      S.joy.x = (dx * cl) / max;
      S.joy.y = (dy * cl) / max;
    };
    const joyEnd = (e: PointerEvent) => {
      if (e.pointerId !== joyId) return;
      joyId = null;
      S.joy.active = false;
      S.joy.x = 0;
      S.joy.y = 0;
    };
    canvas.addEventListener("pointerdown", joyStart);
    canvas.addEventListener("pointermove", joyMove);
    canvas.addEventListener("pointerup", joyEnd);
    canvas.addEventListener("pointercancel", joyEnd);

    let raf = 0;
    let last = performance.now();

    const spawnBurst = (x: number, y: number, color: string, n = 14) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 140;
        S.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.7 + Math.random() * 0.5, color });
      }
    };

    const drawShadow = (x: number, y: number, rx: number, ry: number, alpha = 0.35) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawCloud = (c: StormCloud) => {
      const flicker = Math.sin(S.time * 7 + c.ph) * 0.5 + 0.5;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.globalAlpha = 0.82;
      const puffs: Array<[number, number, number]> = [
        [0, 0, c.r * 0.55], [-c.r * 0.4, c.r * 0.1, c.r * 0.42],
        [c.r * 0.4, c.r * 0.12, c.r * 0.45], [0, -c.r * 0.25, c.r * 0.4],
      ];
      for (const [px, py, pr] of puffs) {
        const g = ctx.createRadialGradient(px, py, pr * 0.2, px, py, pr);
        g.addColorStop(0, "rgba(75,85,105,0.95)");
        g.addColorStop(0.7, "rgba(55,65,85,0.9)");
        g.addColorStop(1, "rgba(40,48,68,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }
      if (flicker > 0.86) {
        ctx.strokeStyle = `rgba(253,224,71,${((flicker - 0.86) * 6).toFixed(2)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        const lx = Math.sin(c.ph * 7) * 0.5 * c.r;
        ctx.moveTo(lx, -c.r * 0.3);
        ctx.lineTo(lx + 12, 0);
        ctx.lineTo(lx - 6, c.r * 0.25);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    };

    const dropOrb = (emotionId: string) => {
      const p = S.player;
      const free = S.orbs.find((o) => o.taken);
      if (free) {
        free.taken = false;
        free.x = Math.max(40, Math.min(WORLD_W - 40, p.x + (Math.random() - 0.5) * 160));
        free.y = Math.max(40, Math.min(WORLD_H - 40, p.y + (Math.random() - 0.5) * 160));
        setOrbsHeld((n) => Math.max(0, n - 1));
      }
      S.slowUntil = S.time + 2.5;
      setHits((h) => h + 1);
      spawnBurst(p.x, p.y, "#a78bfa", 18);
      const emotion = EMOTIONS.find((e) => e.id === emotionId);
      if (emotion) {
        const encounters = recordEncounter(emotionId);
        const count = encounters[emotionId];
        toastRef.current(`${emotion.icon} ${emotion.name}`, `"${emotion.whisper}" — ${emotion.truth} (Faced ${count}×)`, emotion.color);
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      S.time += dt;

      let ix = 0;
      let iy = 0;
      if (S.keys["w"] || S.keys["arrowup"]) iy -= 1;
      if (S.keys["s"] || S.keys["arrowdown"]) iy += 1;
      if (S.keys["a"] || S.keys["arrowleft"]) ix -= 1;
      if (S.keys["d"] || S.keys["arrowright"]) ix += 1;
      if (S.joy.active) { ix += S.joy.x; iy += S.joy.y; }
      const il = Math.hypot(ix, iy);
      if (il > 1) { ix /= il; iy /= il; }

      for (const c of S.clouds) {
        c.x += c.vx * dt;
        if (c.x > WORLD_W + c.r) c.x = -c.r;
        if (c.x < -c.r) c.x = WORLD_W + c.r;
      }

      const p = S.player;
      const heldCount = S.orbs.filter((o) => o.taken).length;
      const inStormNow = S.clouds.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < c.r * 0.7);
      S.inStorm = inStormNow;
      const slowed = S.time < S.slowUntil ? 0.55 : 1;
      const sp = PLAYER_SPEED * slowed * (inStormNow ? 0.6 : 1) * (1 - heldCount * 0.04);
      const nx = p.x + ix * sp * dt;
      const ny = p.y + iy * sp * dt;
      if (!circleHit(nx, p.y, PLAYER_R)) p.x = Math.max(PLAYER_R, Math.min(WORLD_W - PLAYER_R, nx));
      if (!circleHit(p.x, ny, PLAYER_R)) p.y = Math.max(PLAYER_R, Math.min(WORLD_H - PLAYER_R, ny));
      if (il > 0.1) S.faceAngle = Math.atan2(iy, ix) - Math.PI / 4;

      if (questRef.current === "active") {
        for (const o of S.orbs) {
          if (!o.taken && Math.hypot(p.x - o.x, p.y - o.y) < 36) {
            o.taken = true;
            setOrbsHeld((n) => n + 1);
            spawnBurst(o.x, o.y, "#22d3ee", 12);
          }
        }
      }

      S.courageTimer += dt;
      if (S.courageTimer > 8 && S.courageOrbs.filter((o) => !o.taken).length < 3) {
        S.courageTimer = 0;
        const d = S.doubtlings[Math.floor(Math.random() * S.doubtlings.length)];
        const a = Math.random() * Math.PI * 2;
        S.courageOrbs.push({
          x: Math.max(60, Math.min(WORLD_W - 60, d.x + Math.cos(a) * 130)),
          y: Math.max(60, Math.min(WORLD_H - 60, d.y + Math.sin(a) * 130)),
          taken: false, ph: Math.random() * 6, value: 5,
        });
      }
      for (const co of S.courageOrbs) {
        if (!co.taken && Math.hypot(p.x - co.x, p.y - co.y) < 34) {
          co.taken = true;
          setCourage((c) => c + co.value);
          S.courage += co.value;
          spawnBurst(co.x, co.y, "#fbbf24", 10);
        }
      }

      for (const w of S.wanderers) {
        if (w.pauseT > 0) { w.pauseT -= dt; continue; }
        w.dir += dt * 0.4;
        const wx = w.x + Math.cos(w.dir + w.ph) * w.speed * dt;
        const wy = w.y + Math.sin(w.dir * 0.7 + w.ph) * w.speed * dt;
        if (!circleHit(wx, w.y, 14)) w.x = Math.max(30, Math.min(WORLD_W - 30, wx));
        else w.dir += 1.5;
        if (!circleHit(w.x, wy, 14)) w.y = Math.max(30, Math.min(WORLD_H - 30, wy));
        else w.dir += 1.5;
        if (Math.random() < dt * 0.12) w.pauseT = 1 + Math.random() * 2;
      }

      const heldForSpeed = S.orbs.filter((o) => o.taken).length;
      const trustFactor = 1.3 - (trustRef.current / 100) * 0.6;
      let nearestDist = Infinity;
      for (const d of S.doubtlings) {
        if (d.stun > 0) { d.stun -= dt; continue; }
        const dx = p.x - d.x;
        const dy = p.y - d.y;
        const dist = Math.hypot(dx, dy);
        nearestDist = Math.min(nearestDist, dist);
        const rageSpeed = d.speed * (1 + heldForSpeed * 0.18) * trustFactor;
        let mx = 0;
        let my = 0;
        if (questRef.current === "active" && dist < 280) {
          mx = (dx / dist) * rageSpeed;
          my = (dy / dist) * rageSpeed;
        } else {
          d.dir += dt * 0.7;
          mx = Math.cos(d.dir + d.ph) * d.speed * 0.4;
          my = Math.sin(d.dir * 0.8 + d.ph) * d.speed * 0.4;
        }
        const dnx = d.x + mx * dt;
        const dny = d.y + my * dt;
        if (!circleHit(dnx, d.y, 14)) d.x = Math.max(20, Math.min(WORLD_W - 20, dnx));
        if (!circleHit(d.x, dny, 14)) d.y = Math.max(20, Math.min(WORLD_H - 20, dny));
        if (questRef.current === "active" && dist < 32 && S.time > S.slowUntil) {
          d.stun = 3;
          dropOrb(d.emotionId);
        }
      }

      for (let i = S.particles.length - 1; i >= 0; i--) {
        const pt = S.particles[i];
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.96;
        pt.vy *= 0.96;
        if (pt.life <= 0) S.particles.splice(i, 1);
      }

      /* camera with velocity lookahead */
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vw = canvas.width / dpr;
      const vh = canvas.height / dpr;
      const lookX = ix * 90;
      const lookY = iy * 90;
      const tx = p.x - vw / 2 + lookX;
      const ty = p.y - vh / 2 + lookY;
      S.camVel.x += (tx - S.cam.x - S.camVel.x * 0.12) * Math.min(1, dt * 6);
      S.camVel.y += (ty - S.cam.y - S.camVel.y * 0.12) * Math.min(1, dt * 6);
      S.cam.x += S.camVel.x * dt * 6;
      S.cam.y += S.camVel.y * dt * 6;
      S.cam.x = Math.max(-80, Math.min(WORLD_W - vw + 80, S.cam.x));
      S.cam.y = Math.max(-80, Math.min(WORLD_H - vh + 80, S.cam.y));

      /* ------------------------------ render ------------------------------ */
      ctx.clearRect(0, 0, vw, vh);
      ctx.save();
      ctx.translate(-S.cam.x, -S.cam.y);

      const plazaImg = sprites.plaza;
      if (plazaImg.complete && plazaImg.naturalWidth > 0) {
        ctx.drawImage(plazaImg, 0, 0, WORLD_W, WORLD_H);
      } else {
        ctx.fillStyle = "#070b1c";
        ctx.fillRect(S.cam.x - 20, S.cam.y - 20, vw + 40, vh + 40);
      }

      /* fireflies */
      if (!S.fireflies) {
        S.fireflies = Array.from({ length: 28 }, () => ({
          x: Math.random() * WORLD_W, y: Math.random() * WORLD_H,
          ph: Math.random() * 6, sp: 10 + Math.random() * 22,
        }));
      }
      for (const f of S.fireflies) {
        f.x += Math.cos(S.time * 0.5 + f.ph) * f.sp * dt;
        f.y += Math.sin(S.time * 0.7 + f.ph) * f.sp * dt;
        if (f.x > S.cam.x - 20 && f.x < S.cam.x + vw + 20 && f.y > S.cam.y - 20 && f.y < S.cam.y + vh + 20) {
          ctx.save();
          ctx.globalAlpha = (0.3 + 0.5 * Math.abs(Math.sin(S.time * 2 + f.ph))) * 0.7;
          ctx.fillStyle = "#fde68a";
          ctx.shadowColor = "#fde68a";
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(f.x, f.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      for (const c of S.clouds) drawCloud(c);

      /* building labels (visual anchors matching background) */
      for (const o of RECT_OBS) {
        if (!o.label) continue;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        roundRect(ctx, o.x + o.w / 2 - 62, o.y - 30, 124, 24, 10);
        ctx.fill();
        ctx.fillStyle = o.color;
        ctx.font = "bold 12px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(o.label, o.x + o.w / 2, o.y - 13);
      }

      /* chests */
      const chestImg = sprites.chest;
      for (const c of S.chests) {
        const bob = c.opened ? 0 : Math.sin(S.time * 2 + c.ph) * 3;
        drawShadow(c.x, c.y + 18, 20, 7, 0.4);
        if (chestImg.complete && chestImg.naturalWidth > 0) {
          ctx.save();
          ctx.translate(c.x, c.y + bob);
          if (!c.opened) {
            ctx.shadowColor = "#fbbf24";
            ctx.shadowBlur = 14 + Math.sin(S.time * 3 + c.ph) * 6;
          }
          ctx.globalAlpha = c.opened ? 0.55 : 1;
          ctx.drawImage(chestImg, -28, -28, 56, 56);
          ctx.restore();
          ctx.globalAlpha = 1;
        }
        if (!c.opened) {
          ctx.fillStyle = `rgba(251,191,36,${(0.5 + 0.4 * Math.sin(S.time * 4 + c.ph)).toFixed(2)})`;
          ctx.font = "bold 16px system-ui";
          ctx.textAlign = "center";
          ctx.fillText("✦", c.x + 20, c.y - 24 + bob);
        }
      }

      /* courage orbs */
      for (const co of S.courageOrbs) {
        if (co.taken) continue;
        const bob = Math.sin(S.time * 5 + co.ph) * 4;
        drawShadow(co.x, co.y + 12, 10, 4, 0.3);
        ctx.save();
        ctx.translate(co.x, co.y + bob);
        ctx.shadowColor = "#fbbf24";
        ctx.shadowBlur = 16;
        const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, 12);
        cg.addColorStop(0, "#fff");
        cg.addColorStop(0.4, "#fde68a");
        cg.addColorStop(1, "#b45309");
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      /* orbs */
      const orbImg = sprites.orb;
      for (const o of S.orbs) {
        if (o.taken) continue;
        const bob = Math.sin(S.time * 3 + o.ph) * 5;
        const size = 46 * (1 + Math.sin(S.time * 4 + o.ph) * 0.12);
        drawShadow(o.x, o.y + 14, 12, 5, 0.3);
        if (orbImg.complete && orbImg.naturalWidth > 0) {
          ctx.drawImage(orbImg, o.x - size / 2, o.y + bob - size / 2, size, size);
        }
      }

      const drawNPC = (pos: Vec, name: string, color: string, marker: string, markerColor: string, img: HTMLImageElement | null, rotExtra = 0) => {
        const bob = Math.sin(S.time * 2 + pos.x) * 3;
        drawShadow(pos.x, pos.y + 20, 18, 7, 0.35);
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.save();
          ctx.translate(pos.x, pos.y + bob);
          ctx.rotate(Math.PI / 4 + rotExtra + Math.sin(S.time * 0.8 + pos.x) * 0.15);
          ctx.drawImage(img, -26, -26, 52, 52);
          ctx.restore();
        }
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundRect(ctx, pos.x - 40, pos.y - 44 + bob, 80, 20, 8);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.font = "bold 11px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(name, pos.x, pos.y - 30 + bob);
        const bounce = Math.abs(Math.sin(S.time * 4 + pos.x)) * 6;
        ctx.fillStyle = markerColor;
        ctx.font = "bold 22px system-ui";
        ctx.fillText(marker, pos.x + 26, pos.y - 32 - bounce + bob);
      };

      const kidImg = sprites.player;
      const keeperImg = sprites.keeper;
      drawNPC(KEEPER_POS, "The Keeper", "#fde68a", questRef.current !== "active" ? "!" : "", "#fbbf24", keeperImg, 0);
      drawNPC(MAYA_POS, "Maya", "#fde68a", "?", "#e879f9", kidImg);
      drawNPC(PEER_POS, "Jay", "#fbbf24", "?", "#e879f9", kidImg);
      drawNPC(SAM_POS, "Sam", "#38bdf8", "?", "#e879f9", kidImg);

      for (const w of S.wanderers) {
        const bob = Math.sin(S.time * 3 + w.ph) * 2;
        drawShadow(w.x, w.y + 18, 16, 6, 0.3);
        if (kidImg.complete && kidImg.naturalWidth > 0) {
          ctx.save();
          ctx.translate(w.x, w.y + bob);
          ctx.rotate(w.dir + w.ph - Math.PI / 4);
          ctx.globalAlpha = 0.9;
          ctx.drawImage(kidImg, -22, -22, 44, 44);
          ctx.restore();
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        roundRect(ctx, w.x - 28, w.y - 38 + bob, 56, 16, 7);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "bold 10px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(w.name, w.x, w.y - 26 + bob);
      }

      /* doubtlings */
      const doubtImg = sprites.doubtling;
      for (const d of S.doubtlings) {
        const wob = Math.sin(S.time * 6 + d.ph) * 4;
        const flip = p.x - d.x < 0 ? -1 : 1;
        drawShadow(d.x, d.y + 20, 18, 7, 0.45);
        if (doubtImg.complete && doubtImg.naturalWidth > 0) {
          ctx.save();
          ctx.translate(d.x, d.y + wob);
          ctx.scale(flip, 1);
          ctx.drawImage(doubtImg, -28, -28, 56, 56);
          ctx.restore();
        }
      }

      /* player */
      {
        const playerImg = sprites.player;
        const moving = il > 0.1;
        const bob = moving ? Math.abs(Math.sin(S.time * 10)) * 2 : Math.sin(S.time * 2.5) * 1.5;
        drawShadow(p.x, p.y + 22, 20, 8);
        if (playerImg.complete && playerImg.naturalWidth > 0) {
          ctx.save();
          ctx.translate(p.x, p.y - bob);
          ctx.rotate(S.faceAngle);
          ctx.shadowColor = "rgba(34,211,238,0.6)";
          ctx.shadowBlur = 14;
          ctx.drawImage(playerImg, -28, -28, 56, 56);
          ctx.restore();
        }
      }

      for (const pt of S.particles) {
        ctx.globalAlpha = Math.max(0, pt.life * 1.4);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      if (inStormNow) {
        ctx.fillStyle = "rgba(60,70,95,0.22)";
        ctx.fillRect(0, 0, vw, vh);
      }

      if (questRef.current === "active" && nearestDist < 170) {
        const danger = 1 - nearestDist / 170;
        const pulse = 0.25 + Math.sin(S.time * 8) * 0.12;
        const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
        vg.addColorStop(0, "rgba(239,68,68,0)");
        vg.addColorStop(1, `rgba(239,68,68,${(danger * pulse).toFixed(3)})`);
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, vw, vh);
      }

      if (questRef.current === "active" && nearestDist < 55 && nearestDist >= 32) {
        if (S.time > S.nearMissCd) {
          S.nearMissCd = S.time + 2;
          S.nearMissT = S.time;
        }
      }
      if (S.nearMissT && S.time - S.nearMissT < 0.9) {
        const a = 1 - (S.time - S.nearMissT) / 0.9;
        ctx.globalAlpha = a;
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 26px system-ui";
        ctx.textAlign = "center";
        ctx.shadowColor = "#fbbf24";
        ctx.shadowBlur = 16;
        ctx.fillText("CLOSE!", vw / 2, vh * 0.3);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      /* minimap */
      const mmW = 110;
      const mmH = 82;
      const mmX = vw - mmW - 12;
      const mmY = 12;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      roundRect(ctx, mmX, mmY, mmW, mmH, 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(34,211,238,0.4)";
      ctx.lineWidth = 1.5;
      roundRect(ctx, mmX, mmY, mmW, mmH, 10);
      ctx.stroke();
      const sx = mmW / WORLD_W;
      const sy = mmH / WORLD_H;
      ctx.fillStyle = "#22d3ee";
      for (const o of S.orbs) {
        if (o.taken) continue;
        ctx.beginPath();
        ctx.arc(mmX + o.x * sx, mmY + o.y * sy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#e879f9";
      for (const d of S.doubtlings) {
        ctx.beginPath();
        ctx.arc(mmX + d.x * sx, mmY + d.y * sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mmX + p.x * sx, mmY + p.y * sy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // viewport rect
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(mmX + S.cam.x * sx, mmY + S.cam.y * sy, vw * sx, vh * sy);

      /* joystick */
      if (S.joy.active) {
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(joyBase.x, joyBase.y, 70, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(34,211,238,0.5)";
        ctx.beginPath();
        ctx.arc(joyBase.x + S.joy.x * 70, joyBase.y + S.joy.y * 70, 26, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      canvas.removeEventListener("pointerdown", joyStart);
      canvas.removeEventListener("pointermove", joyMove);
      canvas.removeEventListener("pointerup", joyEnd);
      canvas.removeEventListener("pointercancel", joyEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------ codex view ------------------------------ */
  if (showCodex) {
    const enc = getEncounters();
    const discovered = EMOTIONS.filter((e) => enc[e.id] > 0).length;
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => setShowCodex(false)} className="gap-1">
            <ArrowLeft className="size-4" /> Back to the Plaza
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

  /* ------------------------------ interiors ------------------------------ */
  if (interior) {
    const data = {
      chore: { img: "/designs/game/game-interior-chore.webp", title: "Chore Village", sub: "Pick a mission. Do it in real life. Earn real Units." },
      vault: { img: "/designs/game/game-interior-vault.webp", title: "Vault Mountain", sub: "Your savings live here. Guard them well." },
      market: { img: "/designs/game/game-interior-market.webp", title: "Market Harbor", sub: "Every purchase is a decision." },
    }[interior];
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
        <div className="mx-auto max-w-3xl space-y-3 px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => setInterior(null)} className="gap-1">
            <ArrowLeft className="size-4" /> Back to the Plaza
          </Button>
          <div className="relative overflow-hidden rounded-2xl border border-accent/25">
            <img src={data.img} alt={data.title} className="h-56 w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-4">
              <h2 className="font-display text-2xl font-bold text-white">{data.title}</h2>
              <p className="text-sm text-white/75">{data.sub}</p>
            </div>
          </div>
          {interior === "chore" && (
            <div className="space-y-3">
              {JOBS.map((job) => {
                const done = missionsDone.includes(job.id);
                return (
                  <div key={job.id} className="flex items-center justify-between rounded-2xl border border-accent/20 bg-card p-4">
                    <div>
                      <p className="font-display font-bold">{job.name}</p>
                      <p className="text-sm text-muted">{job.desc}</p>
                      <p className="mt-1 text-sm font-bold text-amber-300">+{job.reward} Units</p>
                    </div>
                    <Button size="sm" disabled={done} onClick={() => acceptJob(job.id)} className={done ? "" : "bg-amber-400 font-bold text-black hover:bg-amber-300"}>
                      {done ? "Accepted!" : "Accept"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          {interior === "vault" && (
            <div className="rounded-2xl border border-amber-300/25 bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="font-display font-bold">Savings Vault</p>
                <p className="text-2xl font-bold text-amber-300">{vault} Units</p>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-200" style={{ width: `${vaultTarget > 0 ? Math.min(100, Math.round((vault / vaultTarget) * 100)) : 0}%` }} />
              </div>
              <div className="mt-4 rounded-xl bg-surface p-4">
                <p className="font-display text-sm font-bold text-amber-300">💡 The Keeper's Wisdom</p>
                <p className="mt-1 text-sm leading-relaxed">Every Unit in your vault is a soldier for your future. Savers don't just have more money — they have more <em>choices</em>.</p>
              </div>
            </div>
          )}
          {interior === "market" && (
            <div className="rounded-2xl border border-violet-300/25 bg-card p-5">
              <p className="font-display font-bold">The Merchant's Test</p>
              <p className="mt-1 text-sm text-muted">You have 80 Units. Three deals. Choose.</p>
              {!marketChoice ? (
                <div className="mt-3 space-y-2">
                  <Button variant="outline" className="w-full justify-start" onClick={() => setMarketChoice("candy")}>🍬 Candy — 30U</Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => setMarketChoice("book")}>📚 Skill Book — 50U</Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => setMarketChoice("save")}>💰 Save it all</Button>
                </div>
              ) : (
                <div className="mt-3 rounded-xl bg-surface p-4">
                  <p className="text-sm leading-relaxed">
                    {marketChoice === "candy" && "Tasty! Gone tomorrow. Wants fade fast — will you care in a week?"}
                    {marketChoice === "book" && "Excellent! Knowledge pays forever. A Pillar move."}
                    {marketChoice === "save" && "Disciplined! Sometimes the best purchase is the one you don't make."}
                  </p>
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => setMarketChoice(null)}>Try again</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------ full-screen plaza ------------------------------ */
  return (
    <div className="fixed inset-0 z-[60] bg-black">
      <canvas ref={canvasRef} className="block touch-none" />

      {/* Top HUD */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-3">
        <Button variant="ghost" size="sm" onClick={() => setScreen("home")} className="gap-1 text-white hover:bg-white/15 hover:text-white">
          <ArrowLeft className="size-4" /> World
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setShowCodex(true)} className="gap-1 text-xs text-white hover:bg-white/15 hover:text-white">
            <BookOpen className="size-4" /> Codex
          </Button>
          <div className="flex items-center gap-1 text-xs font-bold text-white">
            <Heart className="size-4" style={{ color: trust >= 70 ? "#4ade80" : trust >= 40 ? "#fbbf24" : "#ef4444" }} />
            <span>{trust}</span>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-amber-300">
            <span>💪</span><span>{courage}</span>
          </div>
          <div className="flex items-center gap-1 text-sm font-bold text-cyan-300">
            <Sparkles className="size-4" /> {orbsHeld}/8
          </div>
        </div>
      </div>

      {inStorm && (
        <div className="absolute left-1/2 top-14 -translate-x-1/2 rounded-full bg-slate-500/30 px-4 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur-sm">
          ⛈️ Storm — slowed!
        </div>
      )}

      {dialog && (
        <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-amber-300/30 bg-black/85 p-4 backdrop-blur-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-300">The Keeper</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-white">{dialog}</p>
          <div className="mt-3 flex gap-2">
            {quest === "intro" && (
              <Button size="sm" onClick={startQuest} className="bg-amber-400 font-bold text-black hover:bg-amber-300">
                Accept the quest
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setDialog(null)} className="border-white/25 text-white hover:bg-white/10 hover:text-white">
              {quest === "intro" ? "Not yet" : "Continue"}
            </Button>
          </div>
        </div>
      )}

      {dilemma && (
        <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-fuchsia-300/30 bg-black/90 p-4 backdrop-blur-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">
            {dilemmaKind === "maya" ? "Maya needs advice" : dilemmaKind === "peer" ? "Jay is pressuring you" : "Sam needs help"}
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

      {toasts.length > 0 && (
        <div className="pointer-events-none absolute inset-x-3 top-14 z-30 space-y-2">
          {toasts.map((t) => (
            <div key={t.id} className="rounded-2xl border bg-black/85 p-3 backdrop-blur-sm" style={{ borderColor: `${t.color}55` }}>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: t.color }}>{t.title}</p>
              <p className="mt-0.5 text-sm leading-snug text-white">{t.msg}</p>
            </div>
          ))}
        </div>
      )}

      {!dialog && !dilemma && nearWhat && (
        <div className="absolute bottom-3 right-3 flex gap-2">
          {nearWhat === "keeper" && <Button size="sm" onClick={talkToKeeper} className="bg-amber-400 font-bold text-black">Talk</Button>}
          {nearWhat === "maya" && <Button size="sm" onClick={talkToMaya} className="bg-fuchsia-400 font-bold text-black">Help Maya</Button>}
          {nearWhat === "peer" && <Button size="sm" onClick={talkToPeer} className="bg-amber-400 font-bold text-black">Talk to Jay</Button>}
          {nearWhat === "sam" && <Button size="sm" onClick={talkToSam} className="bg-sky-400 font-bold text-black">Talk to Sam</Button>}
          {nearWhat === "chore" && <Button size="sm" onClick={() => setInterior("chore")} className="bg-emerald-400 font-bold text-black">Enter</Button>}
          {nearWhat === "chest" && <Button size="sm" onClick={openChest} className="bg-amber-400 font-bold text-black">🗝️ Open</Button>}
          {nearWhat === "vault" && (vaultUnlocked
            ? <Button size="sm" onClick={() => setInterior("vault")} className="bg-amber-400 font-bold text-black">Enter</Button>
            : <div className="flex items-center gap-1.5 rounded-lg bg-black/70 px-3 py-2 text-xs font-semibold text-white"><Lock className="size-4 text-amber-300" /> Save {50 - vault} more</div>)}
          {nearWhat === "market" && (marketUnlocked
            ? <Button size="sm" onClick={() => setInterior("market")} className="bg-violet-400 font-bold text-black">Enter</Button>
            : <div className="flex items-center gap-1.5 rounded-lg bg-black/70 px-3 py-2 text-xs font-semibold text-white"><Lock className="size-4 text-violet-300" /> {3 - choresDone} more chores</div>)}
        </div>
      )}

      {won && !dialog && (
        <div className="absolute inset-x-8 top-20 rounded-2xl border border-amber-300/40 bg-black/85 p-5 text-center backdrop-blur-sm">
          <p className="font-display text-xl font-bold text-amber-300">Quest Complete!</p>
          <p className="mt-1 text-sm text-white/85">{hits === 0 ? "FLAWLESS! +15 Trust, +20 Courage." : `${hits} hits taken.`} +50 Units.</p>
          <Button size="sm" className="mt-3" onClick={() => setScreen("home")}>Back to the World</Button>
        </div>
      )}

      {ceremony && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/70 backdrop-blur-sm">
          <div className="mx-6 rounded-3xl border border-amber-300/50 bg-gradient-to-b from-amber-950/90 to-black/90 p-8 text-center">
            <p className="text-5xl">🎉</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-amber-300">Rank Up!</p>
            <p className="mt-2 font-display text-3xl font-bold text-white">Welcome, {ceremony}!</p>
            <Button className="mt-4 bg-amber-400 font-bold text-black" onClick={() => setCeremony(null)}>Continue</Button>
          </div>
        </div>
      )}

      {/* Real-life gates panel — top-left, compact, never overlaps dialogs */}
      <details className="absolute left-3 top-14 rounded-xl border border-accent/20 bg-black/70 px-2.5 py-1.5 backdrop-blur-sm">
        <summary className="cursor-pointer text-[11px] font-bold text-white">🔓 Unlocks</summary>
        <div className="mt-1.5 space-y-1 text-[11px] text-white/80">
          <p>{vaultUnlocked ? "✅" : "🔒"} Vault — {vaultUnlocked ? "open" : `${50 - vault} to save`}</p>
          <p>{marketUnlocked ? "✅" : "🔒"} Market — {marketUnlocked ? "open" : `${3 - choresDone} chores left`}</p>
        </div>
      </details>

      <div className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 text-[11px] text-white/50 sm:block">
        WASD / arrows to move · drag left side on touch
      </div>
    </div>
  );
}
