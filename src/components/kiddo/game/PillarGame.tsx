import { useEffect, useRef, useState, useCallback } from "react";
import { useLedger } from "@/store/ledger";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Gamepad2, Sparkles, CloudLightning, Lock, Heart, BookOpen } from "lucide-react";
import { rankForScore, societyScore } from "@/components/kiddo/world/WorldMap";
import { EMOTIONS, getEncounters, recordEncounter } from "./emotions";

/* ------------------------------------------------------------------ */
/* PillarPath Game — "The Scattered Orbs"                               */
/* GTA-style concept: walk the plaza, enter buildings, face real        */
/* money decisions, dodge Doubtlings (bad habits), push through storms. */
/* ------------------------------------------------------------------ */

const WORLD_W = 1600;
const WORLD_H = 1200;
const PLAYER_SPEED = 240;
const PLAYER_R = 16;

interface Vec { x: number; y: number }
interface Orb extends Vec { taken: boolean; ph: number }
interface Doubtling extends Vec { ph: number; dir: number; speed: number; stun: number; emotionId: string }
interface StormCloud extends Vec { r: number; vx: number; ph: number }
interface Obstacle { x: number; y: number; w: number; h: number; label?: string; color: string }

const OBSTACLES: Obstacle[] = [
  { x: 740, y: 540, w: 120, h: 120, color: "#22d3ee" },
  { x: 120, y: 120, w: 150, h: 110, label: "Chore Village", color: "#4ade80" },
  { x: 1330, y: 120, w: 150, h: 110, label: "Vault Mountain", color: "#fbbf24" },
  { x: 120, y: 970, w: 150, h: 110, label: "Studio Island", color: "#e879f9" },
  { x: 1330, y: 970, w: 150, h: 110, label: "Market Harbor", color: "#a78bfa" },
  { x: 640, y: 80, w: 320, h: 70, label: "Hall of Becoming", color: "#f472b6" },
  { x: 640, y: 1050, w: 320, h: 70, label: "Learning Lagoon", color: "#38bdf8" },
  { x: 420, y: 420, w: 44, h: 44, color: "#166534" },
  { x: 1140, y: 420, w: 44, h: 44, color: "#166534" },
  { x: 420, y: 740, w: 44, h: 44, color: "#166534" },
  { x: 1140, y: 740, w: 44, h: 44, color: "#166534" },
];

const ORB_SPOTS: Vec[] = [
  { x: 300, y: 620 },
  { x: 1300, y: 620 },
  { x: 800, y: 300 },
  { x: 200, y: 850 },
  { x: 1400, y: 850 },
];

const KEEPER_POS: Vec = { x: 800, y: 760 };
const MAYA_POS: Vec = { x: 1080, y: 950 };
const PEER_POS: Vec = { x: 450, y: 950 }; // peer pressure kid
const SAM_POS: Vec = { x: 800, y: 180 }; // impulse buyer near Hall
const CHORE_DOOR: Vec = { x: 195, y: 250 };
const VAULT_DOOR: Vec = { x: 1405, y: 250 };
const MARKET_DOOR: Vec = { x: 1405, y: 1090 };

const JOBS = [
  { id: "dishes", name: "Dish Dynamo", desc: "Wash the dinner dishes without being asked.", reward: 30 },
  { id: "room", name: "Room Rescue", desc: "Clean your room top to bottom in 20 minutes.", reward: 40 },
  { id: "neighbor", name: "Neighbor Hero", desc: "Help a neighbor carry groceries.", reward: 60 },
];

function circleRect(cx: number, cy: number, r: number, o: Obstacle): boolean {
  const nx = Math.max(o.x, Math.min(cx, o.x + o.w));
  const ny = Math.max(o.y, Math.min(cy, o.y + o.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
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
  const wrapRef = useRef<HTMLDivElement>(null);

  /* Real-life state — the game reads your actual life */
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

  /* Building gates — real life unlocks the game */
  const vaultUnlocked = vault >= 50;
  const marketUnlocked = choresDone >= 3;

  const [quest, setQuest] = useState<"intro" | "active" | "done">("intro");
  const [orbsHeld, setOrbsHeld] = useState(0);
  const [dialog, setDialog] = useState<string | null>(
    "Welcome to Pillar Plaza, traveler. I'm the Keeper. Our Unit orbs have scattered across the plaza — and Doubtlings hunt in the shadows. Will you bring back 5 orbs?"
  );
  const [hits, setHits] = useState(0);
  const [won, setWon] = useState(false);
  const [interior, setInterior] = useState<null | "chore" | "vault" | "market">(null);
  const [dilemma, setDilemma] = useState<null | { q: string; a: string; b: string; c: string }>(null);
  const [dilemmaKind, setDilemmaKind] = useState<null | "maya" | "peer" | "sam">(null);
  const [missionsDone, setMissionsDone] = useState<string[]>([]);
  const [nearWhat, setNearWhat] = useState<null | "keeper" | "maya" | "peer" | "sam" | "chore" | "vault" | "market">(null);
  const [inStorm, setInStorm] = useState(false);
  const [showCodex, setShowCodex] = useState(false);
  const [encounters, setEncounters] = useState<Record<string, number>>({});
  const [ceremony, setCeremony] = useState<null | string>(null);
  const [mayaMemory, setMayaMemory] = useState<null | "good" | "bad">(null);
  const [marketChoice, setMarketChoice] = useState<null | string>(null);
  /* Trust — your character shapes the game world. Good decisions weaken Doubtlings. */
  const [trust, setTrust] = useState(50);
  const trustRef = useRef(50);

  const stateRef = useRef({
    player: { x: 800, y: 950 } as Vec,
    orbs: ORB_SPOTS.map((s) => ({ ...s, taken: false, ph: Math.random() * 6 })) as Orb[],
    doubtlings: [
      { x: 500, y: 600, ph: 0, dir: 0, speed: 95, stun: 0, emotionId: "doubt" },
      { x: 1100, y: 600, ph: 2, dir: 2, speed: 105, stun: 0, emotionId: "impulse" },
      { x: 1350, y: 800, ph: 4, dir: 4, speed: 120, stun: 0, emotionId: "loneliness" },
    ] as Doubtling[],
    clouds: [
      { x: 400, y: 300, r: 130, vx: 22, ph: 0 },
      { x: 1200, y: 500, r: 150, vx: -18, ph: 2 },
      { x: 800, y: 950, r: 110, vx: 26, ph: 4 },
    ] as StormCloud[],
    keys: {} as Record<string, boolean>,
    joy: { x: 0, y: 0, active: false },
    cam: { x: 0, y: 0 } as Vec,
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

  /* Load Maya's memory + check for rank-up ceremony */
  useEffect(() => {
    try {
      const mem = localStorage.getItem("pillarpath-maya");
      if (mem === "good" || mem === "bad") setMayaMemory(mem);
    } catch { /* ignore */ }
    try {
      const lastRank = localStorage.getItem("pillarpath-last-rank");
      if (lastRank && lastRank !== rank.name) {
        // Rank changed! Ceremony time (only if rank went UP).
        const order = ["Seedling", "Sprout", "Trailblazer", "Luminary", "Pillar"];
        if (order.indexOf(rank.name) > order.indexOf(lastRank)) {
          setCeremony(rank.name);
        }
      }
      localStorage.setItem("pillarpath-last-rank", rank.name);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Proximity polling for action buttons */
  useEffect(() => {
    const id = setInterval(() => {
      if (interior) { setNearWhat(null); return; }
      const p = stateRef.current.player;
      const d = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
      if (d(p, KEEPER_POS) < 95) setNearWhat("keeper");
      else if (d(p, MAYA_POS) < 95) setNearWhat("maya");
      else if (d(p, PEER_POS) < 95) setNearWhat("peer");
      else if (d(p, SAM_POS) < 95) setNearWhat("sam");
      else if (d(p, CHORE_DOOR) < 110) setNearWhat("chore");
      else if (d(p, VAULT_DOOR) < 110) setNearWhat("vault");
      else if (d(p, MARKET_DOOR) < 110) setNearWhat("market");
      else setNearWhat(null);
      setInStorm(stateRef.current.inStorm);
    }, 250);
    return () => clearInterval(id);
  }, [interior]);

  const startQuest = useCallback(() => {
    questRef.current = "active";
    setQuest("active");
    setDialog("The orbs glow where the shadows gather... Two hide in the corners. One dares you near the Hall. Storms will slow you — plan around them. Go — and don't let the Doubtlings touch you.");
  }, []);

  const talkToKeeper = () => {
    const q = questRef.current;
    const held = stateRef.current.orbs.filter((o) => o.taken).length;
    if (q === "intro") {
      setDialog("Our Unit orbs have scattered across the plaza — and Doubtlings hunt in the shadows. Bring back 5 orbs. Two hide in the corners. One dares you near the Hall. Will you do it?");
    } else if (q === "active" && held >= 5) {
      questRef.current = "done";
      setQuest("done");
      setWon(true);
      const p = stateRef.current.player;
      const colors = ["#22d3ee", "#e879f9", "#fbbf24", "#4ade80", "#a78bfa"];
      for (let i = 0; i < 80; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 80 + Math.random() * 220;
        stateRef.current.particles.push({
          x: p.x, y: p.y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
          life: 1.2 + Math.random() * 0.8,
          color: colors[i % colors.length],
        });
      }
      setDialog("You did it! You outsmarted the Doubtlings, pushed through the storms, and brought back every orb. That's what a Pillar does — protects what's valuable. Take 50 Units. You've earned them.");
    } else if (q === "active") {
      setDialog(`You carry ${held} of 5 orbs. ${5 - held} still out there. Watch the shadows, mind the storms — plan your path, don't just run.`);
    } else {
      setDialog("The plaza is safe because of you, traveler. Better than yesterday — every single day.");
    }
  };

  const talkToMaya = () => {
    setDilemmaKind("maya");
    // Maya remembers your last advice.
    const mem = mayaMemory;
    if (mem === "good") {
      setDilemma({
        q: "Maya beams at you! \"Your advice worked — I found the owner AND saved half! But now... my friend wants me to lend him ALL my savings. What should I do?\"",
        a: "Lend it all — that's what friends do!",
        b: "Lend a little, keep the rest safe",
        c: "Say no — money ruins friendships",
      });
    } else if (mem === "bad") {
      setDilemma({
        q: "Maya looks down. \"I kept all that money... and I feel awful. I want to make it right. What should I do now?\"",
        a: "It's too late — just forget about it",
        b: "Try to find the owner and return it",
        c: "Give it away to someone who needs it",
      });
    } else {
      setDilemma({
        q: "Maya found 100 Units on the ground! Nobody saw her pick it up. What should she do?",
        a: "Keep it all — finders keepers!",
        b: "Save half, try to find the owner with the other half",
        c: "Spend it all on candy right now",
      });
    }
  };

  const talkToPeer = () => {
    setDilemmaKind("peer");
    setDilemma({
      q: "Jay runs up, excited. \"Everyone's getting the new Hover Board! It's 500 Units! Just borrow from your vault — you can pay it back later!\"",
      a: "Borrow from the vault — everyone's doing it!",
      b: "Say no — the vault is for your future, not peer pressure",
      c: "Suggest you both save up for it together",
    });
  };

  const talkToSam = () => {
    setDilemmaKind("sam");
    setDilemma({
      q: "Sam's eyes are wide. \"FLASH SALE! 50% off everything for the next 5 minutes! I HAVE to buy something — anything! Should I?\"",
      a: "YES! Buy it all before it's gone!",
      b: "Stop. Ask: do I NEED this, or do I just WANT it?",
      c: "Buy one small thing to feel the rush",
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
      setDialog(msg + " Your Trust grows — the Doubtlings seem weaker.");
    };
    const bad = (msg: string, penalty = 10) => {
      const nt = Math.max(0, trustRef.current - penalty);
      trustRef.current = nt;
      setTrust(nt);
      setDialog(msg + " Your Trust falls — and the Doubtlings grow bolder.");
    };

    if (kind === "maya") {
      if (mayaMemory === "good") {
        // Second encounter.
        if (choice === "b") {
          setMayaMemory("good");
          try { localStorage.setItem("pillarpath-maya", "good"); } catch { /* ignore */ }
          good("Maya nods. \"Lend a little, keep the rest safe. That's smart AND kind.\" She hugs you. Good friends don't ask you to risk everything.");
        } else if (choice === "a") {
          setMayaMemory("bad");
          try { localStorage.setItem("pillarpath-maya", "bad"); } catch { /* ignore */ }
          bad("Maya lends it all... and her friend 'forgets' to pay back. She learned the hard way: generosity needs boundaries too.");
        } else {
          bad("Maya pushes her friend away. \"You're right, money ruins everything.\" But now she's lonely AND has money. There was a middle path.", 5);
        }
      } else if (mayaMemory === "bad") {
        // Redemption arc.
        if (choice === "b") {
          setMayaMemory("good");
          try { localStorage.setItem("pillarpath-maya", "good"); } catch { /* ignore */ }
          good("Maya's face lights up. \"I'll find the owner!\" A week later she returns, beaming — the owner rewarded her honesty. Redemption feels amazing.");
        } else if (choice === "c") {
          setMayaMemory("good");
          try { localStorage.setItem("pillarpath-maya", "good"); } catch { /* ignore */ }
          good("Maya gives it to a kid who lost his lunch money. \"I can't undo what I did, but I can do something good now.\" That's growth.");
        } else {
          bad("Maya shrugs and walks away. The guilt follows her. Some choices echo longer than we expect.");
        }
      } else {
        // First encounter.
        if (choice === "b") {
          setMayaMemory("good");
          try { localStorage.setItem("pillarpath-maya", "good"); } catch { /* ignore */ }
          good("Maya nods slowly... \"You're right. Saving half grows my future, and trying to find the owner is the honest move. That's what a Pillar would do.\"");
        } else if (choice === "a") {
          setMayaMemory("bad");
          try { localStorage.setItem("pillarpath-maya", "bad"); } catch { /* ignore */ }
          bad("Maya pockets it all... but she looks uneasy. \"I guess... it doesn't feel as good as I thought.\" Honest money feels better than found money.");
        } else {
          setMayaMemory("bad");
          try { localStorage.setItem("pillarpath-maya", "bad"); } catch { /* ignore */ }
          bad("Maya buys candy for everyone! Fun for a day... but tomorrow the Units are gone. Sweet now, empty later — that's the trap.", 5);
        }
      }
    } else if (kind === "peer") {
      if (choice === "b") {
        good("Jay blinks. \"The vault is for your future?\" He thinks... \"You're right. I don't want to steal from my own future.\" Standing up to pressure is real strength.");
      } else if (choice === "c") {
        good("Jay grins. \"Save up TOGETHER? That's actually more fun!\" You turned pressure into teamwork. That's leadership.");
      } else {
        bad("You borrow from the vault. The Hover Board is fun... for a week. But your savings goal is wrecked. Peer pressure is expensive.");
      }
    } else if (kind === "sam") {
      if (choice === "b") {
        good("Sam takes a breath. \"Do I NEED it... or WANT it?\" He puts everything back. \"I didn't need any of it. You just saved me 200 Units!\" That's the pause that saves fortunes.");
      } else if (choice === "c") {
        bad("Sam buys one small thing. The rush fades in minutes. \"Why did I even...\" Impulse is a thief that steals your future.", 5);
      } else {
        bad("Sam panic-buys everything! Bags of stuff he doesn't need. The sale ends, the regret begins. Flash sales are designed to bypass your brain.");
      }
    }
  };

  const acceptJob = (id: string) => {
    if (missionsDone.includes(id)) return;
    setMissionsDone((m) => [...m, id]);
    setInterior(null);
    setDialog("Mission accepted! In the real world, do this chore and tell your parent — they'll award the Units. This is how game quests become real earnings.");
  };

  /* ------------------------------ game loop ------------------------------ */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ctx = canvas.getContext("2d")!;
    const S = stateRef.current;

    const sprites: Record<string, HTMLImageElement> = {};
    const spritePaths: Record<string, string> = {
      player: "/designs/game/game-kid.webp",
      doubtling: "/designs/game/game-doubtling.webp",
      orb: "/designs/game/game-orb.webp",
      keeper: "/designs/game/game-keeper.webp",
      plaza: "/designs/game/game-plaza-bg.webp",
    };
    for (const [k, src] of Object.entries(spritePaths)) {
      const img = new Image();
      img.src = src;
      sprites[k] = img;
    }

    const resize = () => {
      const w = wrap.clientWidth;
      const h = Math.min(window.innerHeight * 0.62, 560);
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
      if (x < r.width * 0.45 && y > r.height * 0.5) {
        joyId = e.pointerId;
        joyBase.x = x;
        joyBase.y = y;
        S.joy.active = true;
        canvas.setPointerCapture(e.pointerId);
      }
    };
    const joyMove = (e: PointerEvent) => {
      if (e.pointerId !== joyId) return;
      const r = canvas.getBoundingClientRect();
      const dx = e.clientX - r.left - joyBase.x;
      const dy = e.clientY - r.top - joyBase.y;
      const len = Math.hypot(dx, dy);
      const max = 60;
      const cl = len > max ? max / len : 1;
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
      // Name the feeling. Record it in the Codex.
      const emotion = EMOTIONS.find((e) => e.id === emotionId);
      if (emotion) {
        const encounters = recordEncounter(emotionId);
        const count = encounters[emotionId];
        setDialog(
          `${emotion.icon} ${emotion.name} touched you. It whispers: "${emotion.whisper}"\n\nBut here's the truth: ${emotion.truth}\n\nYou've faced ${emotion.name} ${count} time${count === 1 ? "" : "s"}. You're getting stronger.`
        );
      }
    };

    const drawCloud = (c: StormCloud) => {
      // Dark storm cloud: layered gray puffs with lightning flicker.
      const flicker = Math.sin(S.time * 7 + c.ph) * 0.5 + 0.5;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.globalAlpha = 0.82;
      const puffs: Array<[number, number, number]> = [
        [0, 0, c.r * 0.55], [-c.r * 0.4, c.r * 0.1, c.r * 0.42],
        [c.r * 0.4, c.r * 0.12, c.r * 0.45], [0, -c.r * 0.25, c.r * 0.4],
        [-c.r * 0.2, -c.r * 0.3, c.r * 0.32], [c.r * 0.25, -c.r * 0.28, c.r * 0.34],
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
      // Lightning flicker inside.
      if (flicker > 0.86) {
        ctx.strokeStyle = `rgba(253,224,71,${((flicker - 0.86) * 6).toFixed(2)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        const lx = (Math.sin(c.ph * 7) * 0.5) * c.r;
        ctx.moveTo(lx, -c.r * 0.3);
        ctx.lineTo(lx + 12, 0);
        ctx.lineTo(lx - 6, c.r * 0.25);
        ctx.lineTo(lx + 10, c.r * 0.5);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      S.time += dt;

      /* input */
      let ix = 0;
      let iy = 0;
      if (S.keys["w"] || S.keys["arrowup"]) iy -= 1;
      if (S.keys["s"] || S.keys["arrowdown"]) iy += 1;
      if (S.keys["a"] || S.keys["arrowleft"]) ix -= 1;
      if (S.keys["d"] || S.keys["arrowright"]) ix += 1;
      if (S.joy.active) { ix += S.joy.x; iy += S.joy.y; }
      const il = Math.hypot(ix, iy);
      if (il > 1) { ix /= il; iy /= il; }

      /* storm clouds drift */
      for (const c of S.clouds) {
        c.x += c.vx * dt;
        if (c.x > WORLD_W + c.r) c.x = -c.r;
        if (c.x < -c.r) c.x = WORLD_W + c.r;
      }

      /* player move */
      const p = S.player;
      const heldCount = S.orbs.filter((o) => o.taken).length;
      const inStormNow = S.clouds.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < c.r * 0.7);
      S.inStorm = inStormNow;
      const slowed = S.time < S.slowUntil ? 0.55 : 1;
      const stormSlow = inStormNow ? 0.6 : 1;
      const burden = 1 - heldCount * 0.04;
      const sp = PLAYER_SPEED * slowed * stormSlow * burden;
      const nx = p.x + ix * sp * dt;
      const ny = p.y + iy * sp * dt;
      if (!OBSTACLES.some((o) => circleRect(nx, p.y, PLAYER_R, o))) {
        p.x = Math.max(PLAYER_R, Math.min(WORLD_W - PLAYER_R, nx));
      }
      if (!OBSTACLES.some((o) => circleRect(p.x, ny, PLAYER_R, o))) {
        p.y = Math.max(PLAYER_R, Math.min(WORLD_H - PLAYER_R, ny));
      }
      if (il > 0.1) S.faceAngle = Math.atan2(iy, ix) - Math.PI / 4;

      /* orb pickup */
      if (questRef.current === "active") {
        for (const o of S.orbs) {
          if (!o.taken && Math.hypot(p.x - o.x, p.y - o.y) < 34) {
            o.taken = true;
            setOrbsHeld((n) => n + 1);
            spawnBurst(o.x, o.y, "#22d3ee", 12);
          }
        }
      }

      /* doubtlings — Trust shapes them: high trust weakens, low trust emboldens */
      const heldForSpeed = S.orbs.filter((o) => o.taken).length;
      const trustFactor = 1.3 - (trustRef.current / 100) * 0.6; // trust 100 → 0.7x, trust 0 → 1.3x
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
        if (questRef.current === "active" && dist < 260) {
          mx = (dx / dist) * rageSpeed;
          my = (dy / dist) * rageSpeed;
        } else {
          d.dir += dt * 0.7;
          mx = Math.cos(d.dir + d.ph) * d.speed * 0.4;
          my = Math.sin(d.dir * 0.8 + d.ph) * d.speed * 0.4;
        }
        const dnx = d.x + mx * dt;
        const dny = d.y + my * dt;
        if (!OBSTACLES.some((o) => circleRect(dnx, d.y, 14, o))) d.x = Math.max(20, Math.min(WORLD_W - 20, dnx));
        if (!OBSTACLES.some((o) => circleRect(d.x, dny, 14, o))) d.y = Math.max(20, Math.min(WORLD_H - 20, dny));
        if (questRef.current === "active" && dist < 30 && S.time > S.slowUntil) {
          d.stun = 3;
          dropOrb(d.emotionId);
        }
      }

      /* particles */
      for (let i = S.particles.length - 1; i >= 0; i--) {
        const pt = S.particles[i];
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.96;
        pt.vy *= 0.96;
        if (pt.life <= 0) S.particles.splice(i, 1);
      }

      /* camera */
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vw = canvas.width / dpr;
      const vh = canvas.height / dpr;
      S.cam.x += (p.x - vw / 2 - S.cam.x) * Math.min(1, dt * 5);
      S.cam.y += (p.y - vh / 2 - S.cam.y) * Math.min(1, dt * 5);
      S.cam.x = Math.max(0, Math.min(WORLD_W - vw, S.cam.x));
      S.cam.y = Math.max(0, Math.min(WORLD_H - vh, S.cam.y));

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

      ctx.strokeStyle = "rgba(34,211,238,0.25)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(800, 600, 170, 0, Math.PI * 2);
      ctx.stroke();

      /* obstacles */
      for (const o of OBSTACLES) {
        const isMonument = o.w === 120 && o.h === 120;
        if (isMonument) {
          const pg = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y);
          pg.addColorStop(0, "#0e7490");
          pg.addColorStop(0.5, "#22d3ee");
          pg.addColorStop(1, "#0e7490");
          ctx.fillStyle = pg;
          ctx.shadowColor = "#22d3ee";
          ctx.shadowBlur = 30;
          ctx.fillRect(o.x + 40, o.y, 40, o.h);
          ctx.shadowBlur = 0;
          ctx.strokeStyle = "rgba(34,211,238,0.8)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(o.x + 60, o.y + 40, 80, 22, -0.3 + Math.sin(S.time * 0.8) * 0.1, 0, Math.PI * 2);
          ctx.stroke();
        } else if (o.label) {
          ctx.fillStyle = "#111736";
          ctx.strokeStyle = o.color;
          ctx.lineWidth = 2;
          ctx.shadowColor = o.color;
          ctx.shadowBlur = 12;
          roundRect(ctx, o.x, o.y, o.w, o.h, 10);
          ctx.fill();
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#fff";
          ctx.font = "bold 13px system-ui";
          ctx.textAlign = "center";
          ctx.fillText(o.label, o.x + o.w / 2, o.y + o.h / 2 + 5);
        } else {
          ctx.fillStyle = "#14532d";
          ctx.beginPath();
          ctx.arc(o.x + 22, o.y + 22, 22, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      /* storm clouds (behind characters, above ground) */
      for (const c of S.clouds) drawCloud(c);

      /* orbs */
      const orbImg = sprites.orb;
      for (const o of S.orbs) {
        if (o.taken) continue;
        const bob = Math.sin(S.time * 3 + o.ph) * 5;
        const pulse = 1 + Math.sin(S.time * 4 + o.ph) * 0.12;
        const size = 44 * pulse;
        if (orbImg.complete && orbImg.naturalWidth > 0) {
          ctx.drawImage(orbImg, o.x - size / 2, o.y + bob - size / 2, size, size);
        }
      }

      /* keeper */
      {
        const keeperImg = sprites.keeper;
        const bob = Math.sin(S.time * 2) * 3;
        const ks = 64;
        if (keeperImg.complete && keeperImg.naturalWidth > 0) {
          ctx.drawImage(keeperImg, KEEPER_POS.x - ks / 2, KEEPER_POS.y + bob - ks / 2, ks, ks);
        }
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundRect(ctx, KEEPER_POS.x - 45, KEEPER_POS.y - 44 + bob, 90, 20, 8);
        ctx.fill();
        ctx.fillStyle = "#fde68a";
        ctx.font = "bold 11px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("The Keeper", KEEPER_POS.x, KEEPER_POS.y - 30 + bob);
        if (questRef.current !== "active") {
          const bounce = Math.abs(Math.sin(S.time * 4)) * 6;
          ctx.fillStyle = "#fbbf24";
          ctx.font = "bold 22px system-ui";
          ctx.fillText("!", KEEPER_POS.x + 24, KEEPER_POS.y - 34 - bounce + bob);
        }
      }

      /* maya */
      {
        const mayaImg = sprites.player;
        const bob = Math.sin(S.time * 2 + 2) * 3;
        const ms = 52;
        if (mayaImg.complete && mayaImg.naturalWidth > 0) {
          ctx.save();
          ctx.translate(MAYA_POS.x, MAYA_POS.y + bob);
          ctx.rotate(Math.PI / 4);
          ctx.drawImage(mayaImg, -ms / 2, -ms / 2, ms, ms);
          ctx.restore();
        }
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundRect(ctx, MAYA_POS.x - 35, MAYA_POS.y - 42 + bob, 70, 20, 8);
        ctx.fill();
        ctx.fillStyle = "#fde68a";
        ctx.font = "bold 11px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("Maya", MAYA_POS.x, MAYA_POS.y - 28 + bob);
        const bounce = Math.abs(Math.sin(S.time * 4 + 1)) * 6;
        ctx.fillStyle = "#e879f9";
        ctx.font = "bold 22px system-ui";
        ctx.fillText("?", MAYA_POS.x + 26, MAYA_POS.y - 32 - bounce + bob);
      }

      /* peer + sam NPCs */
      for (const [pos, name, color] of [
        [PEER_POS, "Jay", "#fbbf24"],
        [SAM_POS, "Sam", "#38bdf8"],
      ] as Array<[Vec, string, string]>) {
        const npcImg = sprites.player;
        const bob = Math.sin(S.time * 2 + pos.x) * 3;
        const ms = 52;
        if (npcImg.complete && npcImg.naturalWidth > 0) {
          ctx.save();
          ctx.translate(pos.x, pos.y + bob);
          ctx.rotate(Math.PI / 4 + Math.sin(S.time * 0.8 + pos.x) * 0.2);
          ctx.drawImage(npcImg, -ms / 2, -ms / 2, ms, ms);
          ctx.restore();
        }
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundRect(ctx, pos.x - 35, pos.y - 42 + bob, 70, 20, 8);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.font = "bold 11px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(name, pos.x, pos.y - 28 + bob);
        const bounce = Math.abs(Math.sin(S.time * 4 + pos.x)) * 6;
        ctx.fillStyle = "#e879f9";
        ctx.font = "bold 22px system-ui";
        ctx.fillText("?", pos.x + 26, pos.y - 32 - bounce + bob);
      }

      /* doubtlings */
      const doubtImg = sprites.doubtling;
      for (const d of S.doubtlings) {
        const wob = Math.sin(S.time * 6 + d.ph) * 4;
        const ds = 56;
        const flip = p.x - d.x < 0 ? -1 : 1;
        if (doubtImg.complete && doubtImg.naturalWidth > 0) {
          ctx.save();
          ctx.translate(d.x, d.y + wob);
          ctx.scale(flip, 1);
          ctx.drawImage(doubtImg, -ds / 2, -ds / 2, ds, ds);
          ctx.restore();
        }
      }

      /* player */
      {
        const playerImg = sprites.player;
        const moving = il > 0.1;
        const bob = moving ? Math.abs(Math.sin(S.time * 10)) * 2 : Math.sin(S.time * 2.5) * 1.5;
        const ps = 56;
        if (playerImg.complete && playerImg.naturalWidth > 0) {
          ctx.save();
          ctx.translate(p.x, p.y - bob);
          ctx.rotate(S.faceAngle);
          ctx.shadowColor = "rgba(34,211,238,0.6)";
          ctx.shadowBlur = 14;
          ctx.drawImage(playerImg, -ps / 2, -ps / 2, ps, ps);
          ctx.restore();
        }
      }

      /* particles */
      for (const pt of S.particles) {
        ctx.globalAlpha = Math.max(0, pt.life * 1.4);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      /* storm overlay tint when inside a cloud */
      if (inStormNow) {
        ctx.fillStyle = "rgba(60,70,95,0.22)";
        ctx.fillRect(0, 0, vw, vh);
      }

      /* danger vignette */
      if (questRef.current === "active" && nearestDist < 170) {
        const danger = 1 - nearestDist / 170;
        const pulse = 0.25 + Math.sin(S.time * 8) * 0.12;
        const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
        vg.addColorStop(0, "rgba(239,68,68,0)");
        vg.addColorStop(1, `rgba(239,68,68,${(danger * pulse).toFixed(3)})`);
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, vw, vh);
      }

      /* near-miss */
      if (questRef.current === "active" && nearestDist < 55 && nearestDist >= 30) {
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
        ctx.fillText("CLOSE!", vw / 2, vh * 0.32);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      /* joystick */
      if (S.joy.active) {
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(joyBase.x, joyBase.y, 60, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(34,211,238,0.5)";
        ctx.beginPath();
        ctx.arc(joyBase.x + S.joy.x * 60, joyBase.y + S.joy.y * 60, 24, 0, Math.PI * 2);
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
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <Button variant="ghost" size="sm" onClick={() => setShowCodex(false)} className="gap-1">
          <ArrowLeft className="size-4" /> Back to the Plaza
        </Button>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Name it to tame it</p>
          <h1 className="font-display text-2xl font-bold">The Emotion Codex</h1>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Every feeling you've faced in the plaza. {discovered} of {EMOTIONS.length} discovered.
            The more you name them, the smaller they get.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {EMOTIONS.map((e) => {
            const count = enc[e.id] || 0;
            const found = count > 0;
            return (
              <div
                key={e.id}
                className="rounded-2xl border p-4"
                style={{
                  borderColor: found ? `${e.color}55` : "var(--border)",
                  background: found ? `linear-gradient(135deg, ${e.color}14, transparent)` : "var(--card)",
                  opacity: found ? 1 : 0.55,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{found ? e.icon : "❓"}</span>
                  <div>
                    <p className="font-display font-bold" style={{ color: found ? e.color : undefined }}>
                      {found ? e.name : "???"}
                    </p>
                    <p className="text-[11px] uppercase tracking-widest text-muted">{e.family}</p>
                  </div>
                  {found && (
                    <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">
                      Faced {count}×
                    </span>
                  )}
                </div>
                {found ? (
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="italic text-muted">Whispers: "{e.whisper}"</p>
                    <p className="font-medium">Truth: {e.truth}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted">Not yet encountered. Keep exploring the plaza...</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ------------------------------ interior view ------------------------------ */
  if (interior === "chore") {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-4">
        <Button variant="ghost" size="sm" onClick={() => setInterior(null)} className="gap-1">
          <ArrowLeft className="size-4" /> Back to the Plaza
        </Button>
        <div className="relative overflow-hidden rounded-2xl border border-accent/25">
          <img src="/designs/game/game-interior-chore.webp" alt="Chore Village job hall" className="h-56 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-4">
            <h2 className="font-display text-2xl font-bold text-white">Chore Village</h2>
            <p className="text-sm text-white/75">Pick a mission. Do it in real life. Earn real Units.</p>
          </div>
        </div>
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
                <Button
                  size="sm"
                  disabled={done}
                  onClick={() => acceptJob(job.id)}
                  className={done ? "" : "bg-amber-400 font-bold text-black hover:bg-amber-300"}
                >
                  {done ? "Accepted!" : "Accept"}
                </Button>
              </div>
            );
          })}
        </div>
        <p className="text-center text-xs text-muted">
          Missions you accept here become real chores. Do them, parent confirms, Units land in your balance.
        </p>
      </div>
    );
  }

  /* ------------------------------ vault interior ------------------------------ */
  if (interior === "vault") {
    const vaultPct = vaultTarget > 0 ? Math.min(100, Math.round((vault / vaultTarget) * 100)) : 0;
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-4">
        <Button variant="ghost" size="sm" onClick={() => setInterior(null)} className="gap-1">
          <ArrowLeft className="size-4" /> Back to the Plaza
        </Button>
        <div className="relative overflow-hidden rounded-2xl border border-accent/25">
          <img src="/designs/game/game-interior-vault.webp" alt="Vault Mountain" className="h-56 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-4">
            <h2 className="font-display text-2xl font-bold text-white">Vault Mountain</h2>
            <p className="text-sm text-white/75">Your savings live here. Guard them well.</p>
          </div>
        </div>
        <div className="rounded-2xl border border-amber-300/25 bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="font-display font-bold">Savings Vault</p>
            <p className="text-2xl font-bold text-amber-300">{vault} Units</p>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-200 transition-all"
              style={{ width: `${vaultPct}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted">{vaultPct}% of your {vaultTarget}-Unit goal</p>
          <div className="mt-4 rounded-xl bg-surface p-4">
            <p className="font-display text-sm font-bold text-amber-300">💡 The Keeper's Wisdom</p>
            <p className="mt-1 text-sm leading-relaxed">
              Every Unit in your vault is a soldier working for your future. Savers don't just have more money —
              they have more <em>choices</em>. The kids who save young become the adults who are free.
            </p>
          </div>
          {vaultPct >= 100 ? (
            <p className="mt-3 text-center font-display font-bold text-emerald-400">🎉 Goal crushed! You're a savings legend!</p>
          ) : (
            <p className="mt-3 text-center text-sm text-muted">
              Save {vaultTarget - vault} more Units to hit your goal. Every chore gets you closer.
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------ market interior ------------------------------ */
  if (interior === "market") {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-4">
        <Button variant="ghost" size="sm" onClick={() => setInterior(null)} className="gap-1">
          <ArrowLeft className="size-4" /> Back to the Plaza
        </Button>
        <div className="relative overflow-hidden rounded-2xl border border-accent/25">
          <img src="/designs/game/game-interior-market.webp" alt="Market Harbor" className="h-56 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-4">
            <h2 className="font-display text-2xl font-bold text-white">Market Harbor</h2>
            <p className="text-sm text-white/75">Every purchase is a decision. Choose wisely.</p>
          </div>
        </div>
        <div className="rounded-2xl border border-violet-300/25 bg-card p-5">
          <p className="font-display font-bold">The Merchant's Test</p>
          <p className="mt-1 text-sm text-muted">
            A merchant offers you three deals. You have 80 Units. What do you do?
          </p>
          {!marketChoice ? (
            <div className="mt-3 space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => setMarketChoice("candy")}>
                🍬 Candy Pack — 30 Units <span className="ml-auto text-xs text-muted">Sweet now, gone tomorrow</span>
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => setMarketChoice("book")}>
                📚 Skill Book — 50 Units <span className="ml-auto text-xs text-muted">Learn something forever</span>
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => setMarketChoice("save")}>
                💰 Save it all <span className="ml-auto text-xs text-muted">80 Units stay in your pocket</span>
              </Button>
            </div>
          ) : (
            <div className="mt-3 rounded-xl bg-surface p-4">
              {marketChoice === "candy" && (
                <p className="text-sm leading-relaxed">Tasty! But tomorrow it's gone and so are 30 Units. <strong>Wants</strong> feel urgent but fade fast. Next time, pause and ask: will I care about this in a week?</p>
              )}
              {marketChoice === "book" && (
                <p className="text-sm leading-relaxed">Excellent! A book pays you back forever. <strong>Needs</strong> and growth beat momentary treats every time. That's a Pillar move.</p>
              )}
              {marketChoice === "save" && (
                <p className="text-sm leading-relaxed">Disciplined! 80 Units saved is 80 soldiers for your future. Sometimes the best purchase is the one you <em>don't</em> make.</p>
              )}
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setMarketChoice(null)}>
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------ plaza view ------------------------------ */
  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 py-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setScreen("home")} className="gap-1">
          <ArrowLeft className="size-4" /> World
        </Button>
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <Gamepad2 className="size-4 text-accent" />
          <span>Pillar Plaza</span>
          <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
            Prototype
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setEncounters(getEncounters()); setShowCodex(true); }}
            className="gap-1 text-xs"
          >
            <BookOpen className="size-4" /> Codex
          </Button>
          <div className="flex items-center gap-1 text-xs font-bold" title="Trust: good decisions weaken Doubtlings">
            <Heart className="size-4" style={{ color: trust >= 70 ? "#4ade80" : trust >= 40 ? "#fbbf24" : "#ef4444" }} />
            <span style={{ color: trust >= 70 ? "#4ade80" : trust >= 40 ? "#fbbf24" : "#ef4444" }}>{trust}</span>
          </div>
          <div className="flex items-center gap-1 text-sm font-bold text-accent">
            <Sparkles className="size-4" /> {orbsHeld}/5
          </div>
        </div>
      </div>

      {inStorm && (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-500/20 py-1.5 text-xs font-semibold text-slate-300">
          <CloudLightning className="size-4" /> Caught in a storm — moving slow. Push through!
        </div>
      )}

      <div ref={wrapRef} className="relative overflow-hidden rounded-2xl border border-accent/25">
        <canvas ref={canvasRef} className="block touch-none" />

        {dialog && (
          <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-amber-300/30 bg-black/80 p-4 backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-300">The Keeper</p>
            <p className="mt-1 text-sm leading-relaxed text-white">{dialog}</p>
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
          <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-fuchsia-300/30 bg-black/85 p-4 backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">Maya needs your advice</p>
            <p className="mt-1 text-sm leading-relaxed text-white">{dilemma.q}</p>
            <div className="mt-3 space-y-2">
              <Button size="sm" variant="outline" className="w-full justify-start border-white/25 text-left text-white hover:bg-white/10 hover:text-white" onClick={() => answerDilemma("a")}>
                {dilemma.a}
              </Button>
              <Button size="sm" variant="outline" className="w-full justify-start border-white/25 text-left text-white hover:bg-white/10 hover:text-white" onClick={() => answerDilemma("b")}>
                {dilemma.b}
              </Button>
              <Button size="sm" variant="outline" className="w-full justify-start border-white/25 text-left text-white hover:bg-white/10 hover:text-white" onClick={() => answerDilemma("c")}>
                {dilemma.c}
              </Button>
            </div>
          </div>
        )}

        {!dialog && !dilemma && nearWhat && (
          <div className="absolute bottom-3 right-3 flex gap-2">
            {nearWhat === "keeper" && (
              <Button size="sm" onClick={talkToKeeper} className="bg-amber-400 font-bold text-black hover:bg-amber-300">
                Talk
              </Button>
            )}
            {nearWhat === "maya" && (
              <Button size="sm" onClick={talkToMaya} className="bg-fuchsia-400 font-bold text-black hover:bg-fuchsia-300">
                Help Maya
              </Button>
            )}
            {nearWhat === "peer" && (
              <Button size="sm" onClick={talkToPeer} className="bg-amber-400 font-bold text-black hover:bg-amber-300">
                Talk to Jay
              </Button>
            )}
            {nearWhat === "sam" && (
              <Button size="sm" onClick={talkToSam} className="bg-sky-400 font-bold text-black hover:bg-sky-300">
                Talk to Sam
              </Button>
            )}
            {nearWhat === "chore" && (
              <Button size="sm" onClick={() => setInterior("chore")} className="bg-emerald-400 font-bold text-black hover:bg-emerald-300">
                Enter Chore Village
              </Button>
            )}
            {nearWhat === "vault" && (
              vaultUnlocked ? (
                <Button size="sm" onClick={() => setInterior("vault")} className="bg-amber-400 font-bold text-black hover:bg-amber-300">
                  Enter Vault Mountain
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 rounded-lg bg-black/70 px-3 py-2 text-xs font-semibold text-white">
                  <Lock className="size-4 text-amber-300" /> Save {50 - vault} more Units to enter
                </div>
              )
            )}
            {nearWhat === "market" && (
              marketUnlocked ? (
                <Button size="sm" onClick={() => setInterior("market")} className="bg-violet-400 font-bold text-black hover:bg-violet-300">
                  Enter Market Harbor
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 rounded-lg bg-black/70 px-3 py-2 text-xs font-semibold text-white">
                  <Lock className="size-4 text-violet-300" /> Complete {3 - choresDone} more chore{3 - choresDone === 1 ? "" : "s"} to enter
                </div>
              )
            )}
          </div>
        )}

        {won && !dialog && (
          <div className="absolute inset-x-8 top-8 rounded-2xl border border-amber-300/40 bg-black/85 p-5 text-center backdrop-blur-sm">
            <p className="font-display text-xl font-bold text-amber-300">Quest Complete!</p>
            <p className="mt-1 text-sm text-white/85">+50 Units earned · {hits === 0 ? "Flawless — no Doubtling touched you!" : `${hits} Doubtling hit${hits === 1 ? "" : "s"} taken`}</p>
            <Button size="sm" className="mt-3" onClick={() => setScreen("home")}>
              Back to the World
            </Button>
          </div>
        )}

        {ceremony && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-black/70 backdrop-blur-sm">
            <div className="mx-6 rounded-3xl border border-amber-300/50 bg-gradient-to-b from-amber-950/90 to-black/90 p-8 text-center">
              <p className="text-5xl">🎉</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest text-amber-300">Rank Up Ceremony</p>
              <p className="mt-2 font-display text-3xl font-bold text-white">Welcome, {ceremony}!</p>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/80">
                The plaza gathers to celebrate YOU. Every chore, every saved Unit, every smart choice
                led here. Better than yesterday — proven.
              </p>
              <Button
                className="mt-4 bg-amber-400 font-bold text-black hover:bg-amber-300"
                onClick={() => setCeremony(null)}
              >
                Continue the journey
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <p>🕹️ Drag left side to move · WASD on desktop</p>
        <p>🌩️ Storms slow you · 👾 Doubtlings steal orbs</p>
      </div>

      {/* Real-life unlocks — the game is part of your life */}
      <div className="rounded-2xl border border-accent/20 bg-card p-4">
        <p className="font-display text-sm font-bold">Your life unlocks the game</p>
        <div className="mt-2 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              {vaultUnlocked ? "✅" : "🔒"} Vault Mountain
            </span>
            <span className="text-muted">{vaultUnlocked ? "Open!" : `Save ${50 - vault} more Units`}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              {marketUnlocked ? "✅" : "🔒"} Market Harbor
            </span>
            <span className="text-muted">{marketUnlocked ? "Open!" : `${3 - choresDone} more chore${3 - choresDone === 1 ? "" : "s"} to go`}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>🏅 Your rank: {rank.name}</span>
            <span className="text-muted">{choresDone} chore{choresDone === 1 ? "" : "s"} done · {vault} Units saved</span>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          This game can't be beaten by playing more — only by living better. Do chores, save Units, make smart choices, and watch the world open up.
        </p>
      </div>
    </div>
  );
}
