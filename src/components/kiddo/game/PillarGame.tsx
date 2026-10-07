import { useEffect, useRef, useState, useCallback } from "react";
import { useLedger } from "@/store/ledger";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Gamepad2, Sparkles } from "lucide-react";

/* ------------------------------------------------------------------ */
/* PillarPath Game Prototype — "The Scattered Orbs"                     */
/* Top-down explorer: Pillar Plaza, one quest, Doubtling enemies.       */
/* Kids think: plan routes, dodge hunters, risk vs reward.              */
/* ------------------------------------------------------------------ */

const WORLD_W = 1600;
const WORLD_H = 1200;
const PLAYER_SPEED = 240;
const PLAYER_R = 16;

interface Vec { x: number; y: number }

interface Orb extends Vec { taken: boolean; ph: number }
interface Doubtling extends Vec { taken?: boolean; ph: number; dir: number; speed: number; stun: number }
interface Obstacle { x: number; y: number; w: number; h: number; label?: string; color: string }

const OBSTACLES: Obstacle[] = [
  // Central pillar monument.
  { x: 740, y: 540, w: 120, h: 120, color: "#22d3ee" },
  // Realm buildings around the plaza.
  { x: 120, y: 120, w: 150, h: 110, label: "Chore Village", color: "#4ade80" },
  { x: 1330, y: 120, w: 150, h: 110, label: "Vault Mountain", color: "#fbbf24" },
  { x: 120, y: 970, w: 150, h: 110, label: "Studio Island", color: "#e879f9" },
  { x: 1330, y: 970, w: 150, h: 110, label: "Market Harbor", color: "#a78bfa" },
  { x: 640, y: 80, w: 320, h: 70, label: "Hall of Becoming", color: "#f472b6" },
  { x: 640, y: 1050, w: 320, h: 70, label: "Learning Lagoon", color: "#38bdf8" },
  // Scattered trees / rocks.
  { x: 420, y: 420, w: 44, h: 44, color: "#166534" },
  { x: 1140, y: 420, w: 44, h: 44, color: "#166534" },
  { x: 420, y: 740, w: 44, h: 44, color: "#166534" },
  { x: 1140, y: 740, w: 44, h: 44, color: "#166534" },
];

const ORB_SPOTS: Vec[] = [
  { x: 300, y: 620 },   // open — easy
  { x: 1300, y: 620 },  // open — easy
  { x: 800, y: 300 },   // near Hall — moderate
  { x: 200, y: 850 },   // corner — moderate
  { x: 1400, y: 850 },  // corner, Doubtling territory — risky
];

const KEEPER_POS: Vec = { x: 800, y: 760 };

function circleRect(cx: number, cy: number, r: number, o: Obstacle): boolean {
  const nx = Math.max(o.x, Math.min(cx, o.x + o.w));
  const ny = Math.max(o.y, Math.min(cy, o.y + o.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export function PillarGame() {
  const setScreen = useLedger((s) => s.setScreen);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [quest, setQuest] = useState<"intro" | "active" | "done">("intro");
  const [orbsHeld, setOrbsHeld] = useState(0);
  const [dialog, setDialog] = useState<string | null>(
    "Welcome to Pillar Plaza, traveler. I'm the Keeper. Our Unit orbs have scattered across the plaza — and Doubtlings hunt in the shadows. Will you bring back 5 orbs?"
  );
  const [hits, setHits] = useState(0);
  const [won, setWon] = useState(false);

  const stateRef = useRef({
    player: { x: 800, y: 950 } as Vec,
    orbs: ORB_SPOTS.map((s) => ({ ...s, taken: false, ph: Math.random() * 6 })) as Orb[],
    doubtlings: [
      { x: 500, y: 600, ph: 0, dir: 0, speed: 95, stun: 0 },
      { x: 1100, y: 600, ph: 2, dir: 2, speed: 105, stun: 0 },
      { x: 1350, y: 800, ph: 4, dir: 4, speed: 120, stun: 0 },
    ] as Doubtling[],
    keys: {} as Record<string, boolean>,
    joy: { x: 0, y: 0, active: false },
    cam: { x: 0, y: 0 } as Vec,
    slowUntil: 0,
    particles: [] as Array<Vec & { vx: number; vy: number; life: number; color: string }>,
    time: 0,
    nearMissCd: 0,
    nearMissT: 0,
    faceAngle: 0,
  });
  const questRef = useRef(quest);
  questRef.current = quest;
  const setQuestRef = useRef(setQuest);
  setQuestRef.current = setQuest;

  const startQuest = useCallback(() => {
    setQuestRef.current("active");
    setDialog("The orbs glow where the shadows gather... Two hide in the corners. One dares you near the Hall. Go — and don't let the Doubtlings touch you.");
  }, []);

  const nearKeeper = useCallback(() => {
    const p = stateRef.current.player;
    const dx = p.x - KEEPER_POS.x;
    const dy = p.y - KEEPER_POS.y;
    return Math.hypot(dx, dy) < 90;
  }, []);

  /* ------------------------------ game loop ------------------------------ */
  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    const S = stateRef.current;

    /* Sprite loading */
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

    /* Virtual joystick */
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
        S.particles.push({
          x, y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.7 + Math.random() * 0.5, color,
        });
      }
    };

    const dropOrb = () => {
      // Knock one held orb loose near the player.
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
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      S.time += dt;

      /* --- input --- */
      let ix = 0;
      let iy = 0;
      if (S.keys["w"] || S.keys["arrowup"]) iy -= 1;
      if (S.keys["s"] || S.keys["arrowdown"]) iy += 1;
      if (S.keys["a"] || S.keys["arrowleft"]) ix -= 1;
      if (S.keys["d"] || S.keys["arrowright"]) ix += 1;
      if (S.joy.active) { ix += S.joy.x; iy += S.joy.y; }
      const il = Math.hypot(ix, iy);
      if (il > 1) { ix /= il; iy /= il; }

      /* --- player move (slower when slowed, slightly slower carrying orbs) --- */
      const heldCount = S.orbs.filter((o) => o.taken).length;
      const slowed = S.time < S.slowUntil ? 0.55 : 1;
      const burden = 1 - heldCount * 0.04;
      const sp = PLAYER_SPEED * slowed * burden;
      const p = S.player;
      const nx = p.x + ix * sp * dt;
      const ny = p.y + iy * sp * dt;
      if (!OBSTACLES.some((o) => circleRect(nx, p.y, PLAYER_R, o))) {
        p.x = Math.max(PLAYER_R, Math.min(WORLD_W - PLAYER_R, nx));
      }
      if (!OBSTACLES.some((o) => circleRect(p.x, ny, PLAYER_R, o))) {
        p.y = Math.max(PLAYER_R, Math.min(WORLD_H - PLAYER_R, ny));
      }

      /* --- orb pickup --- */
      if (questRef.current === "active") {
        for (const o of S.orbs) {
          if (!o.taken && Math.hypot(p.x - o.x, p.y - o.y) < 34) {
            o.taken = true;
            setOrbsHeld((n) => n + 1);
            spawnBurst(o.x, o.y, "#22d3ee", 12);
          }
        }
      }

      /* --- doubtlings: patrol, chase when close, stun after hit --- */
      // Excitement: they get FASTER with every orb you hold. Stakes rise.
      const heldForSpeed = S.orbs.filter((o) => o.taken).length;
      let nearestDist = Infinity;
      for (const d of S.doubtlings) {
        if (d.stun > 0) { d.stun -= dt; continue; }
        const dx = p.x - d.x;
        const dy = p.y - d.y;
        const dist = Math.hypot(dx, dy);
        nearestDist = Math.min(nearestDist, dist);
        const rageSpeed = d.speed * (1 + heldForSpeed * 0.18); // +18% per orb!
        let mx = 0;
        let my = 0;
        if (questRef.current === "active" && dist < 260) {
          // Hunt the player!
          mx = (dx / dist) * rageSpeed;
          my = (dy / dist) * rageSpeed;
        } else {
          // Wander.
          d.dir += dt * 0.7;
          mx = Math.cos(d.dir + d.ph) * d.speed * 0.4;
          my = Math.sin(d.dir * 0.8 + d.ph) * d.speed * 0.4;
        }
        const dnx = d.x + mx * dt;
        const dny = d.y + my * dt;
        if (!OBSTACLES.some((o) => circleRect(dnx, d.y, 14, o))) d.x = Math.max(20, Math.min(WORLD_W - 20, dnx));
        if (!OBSTACLES.some((o) => circleRect(d.x, dny, 14, o))) d.y = Math.max(20, Math.min(WORLD_H - 20, dny));

        // Hit!
        if (questRef.current === "active" && dist < 30 && S.time > S.slowUntil) {
          d.stun = 3; // back off after a hit
          dropOrb();
          setDialog("A Doubtling knocked an orb loose! Doubt makes you drop what you're building. Shake it off and keep going.");
        }
      }

      /* --- particles --- */
      for (let i = S.particles.length - 1; i >= 0; i--) {
        const pt = S.particles[i];
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.96;
        pt.vy *= 0.96;
        if (pt.life <= 0) S.particles.splice(i, 1);
      }

      /* --- camera --- */
      const vw = canvas.width / Math.min(window.devicePixelRatio || 1, 2);
      const vh = canvas.height / Math.min(window.devicePixelRatio || 1, 2);
      S.cam.x += (p.x - vw / 2 - S.cam.x) * Math.min(1, dt * 5);
      S.cam.y += (p.y - vh / 2 - S.cam.y) * Math.min(1, dt * 5);
      S.cam.x = Math.max(0, Math.min(WORLD_W - vw, S.cam.x));
      S.cam.y = Math.max(0, Math.min(WORLD_H - vh, S.cam.y));

      /* ------------------------------ render ------------------------------ */
      ctx.clearRect(0, 0, vw, vh);
      ctx.save();
      ctx.translate(-S.cam.x, -S.cam.y);

      // Painted plaza backdrop (falls back to gradient while loading).
      const plazaImg = sprites.plaza;
      if (plazaImg.complete && plazaImg.naturalWidth > 0) {
        ctx.drawImage(plazaImg, 0, 0, WORLD_W, WORLD_H);
      } else {
        const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
        g.addColorStop(0, "#0a0f24");
        g.addColorStop(0.5, "#070b1c");
        g.addColorStop(1, "#0a0f24");
        ctx.fillStyle = g;
        ctx.fillRect(S.cam.x - 20, S.cam.y - 20, vw + 40, vh + 40);
      }

      // Plaza ring around monument.
      ctx.strokeStyle = "rgba(34,211,238,0.25)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(800, 600, 170, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(232,121,249,0.18)";
      ctx.beginPath();
      ctx.arc(800, 600, 210, 0, Math.PI * 2);
      ctx.stroke();

      // Obstacles.
      for (const o of OBSTACLES) {
        const isMonument = o.w === 120 && o.h === 120;
        if (isMonument) {
          // Glowing pillar.
          const pg = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y);
          pg.addColorStop(0, "#0e7490");
          pg.addColorStop(0.5, "#22d3ee");
          pg.addColorStop(1, "#0e7490");
          ctx.fillStyle = pg;
          ctx.shadowColor = "#22d3ee";
          ctx.shadowBlur = 30;
          ctx.fillRect(o.x + 40, o.y, 40, o.h);
          ctx.shadowBlur = 0;
          // Orbit rings.
          ctx.strokeStyle = "rgba(34,211,238,0.8)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(o.x + 60, o.y + 40, 80, 22, -0.3 + Math.sin(S.time * 0.8) * 0.1, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = "rgba(232,121,249,0.8)";
          ctx.beginPath();
          ctx.ellipse(o.x + 60, o.y + 80, 95, 26, 0.35, 0, Math.PI * 2);
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
          // Tree.
          ctx.fillStyle = "#14532d";
          ctx.beginPath();
          ctx.arc(o.x + 22, o.y + 22, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#22c55e";
          ctx.beginPath();
          ctx.arc(o.x + 16, o.y + 16, 10, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Orbs — sprite with bob + pulse.
      const orbImg = sprites.orb;
      for (const o of S.orbs) {
        if (o.taken) continue;
        const bob = Math.sin(S.time * 3 + o.ph) * 5;
        const pulse = 1 + Math.sin(S.time * 4 + o.ph) * 0.12;
        const size = 44 * pulse;
        if (orbImg.complete && orbImg.naturalWidth > 0) {
          ctx.drawImage(orbImg, o.x - size / 2, o.y + bob - size / 2, size, size);
        } else {
          ctx.save();
          ctx.translate(o.x, o.y + bob);
          ctx.shadowColor = "#22d3ee";
          ctx.shadowBlur = 18;
          ctx.fillStyle = "#67e8f9";
          ctx.beginPath();
          ctx.arc(0, 0, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Keeper NPC — sprite.
      {
        const keeperImg = sprites.keeper;
        const bob = Math.sin(S.time * 2) * 3;
        const ks = 64;
        if (keeperImg.complete && keeperImg.naturalWidth > 0) {
          ctx.drawImage(keeperImg, KEEPER_POS.x - ks / 2, KEEPER_POS.y + bob - ks / 2, ks, ks);
        } else {
          ctx.save();
          ctx.translate(KEEPER_POS.x, KEEPER_POS.y + bob);
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath();
          ctx.arc(0, 0, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // Name tag.
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundRect(ctx, KEEPER_POS.x - 45, KEEPER_POS.y - 44 + bob, 90, 20, 8);
        ctx.fill();
        ctx.fillStyle = "#fde68a";
        ctx.font = "bold 11px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("The Keeper", KEEPER_POS.x, KEEPER_POS.y - 30 + bob);
        // "!" when quest available/complete.
        if (questRef.current !== "active") {
          const bounce = Math.abs(Math.sin(S.time * 4)) * 6;
          ctx.fillStyle = "#fbbf24";
          ctx.font = "bold 22px system-ui";
          ctx.fillText("!", KEEPER_POS.x + 24, KEEPER_POS.y - 34 - bounce + bob);
        }
      }

      // Doubtlings — sprite shadow creatures.
      const doubtImg = sprites.doubtling;
      for (const d of S.doubtlings) {
        const wob = Math.sin(S.time * 6 + d.ph) * 4;
        const ds = 56;
        // Face toward the player when hunting.
        const dx = p.x - d.x;
        const flip = dx < 0 ? -1 : 1;
        if (doubtImg.complete && doubtImg.naturalWidth > 0) {
          ctx.save();
          ctx.translate(d.x, d.y + wob);
          ctx.scale(flip, 1);
          ctx.drawImage(doubtImg, -ds / 2, -ds / 2, ds, ds);
          ctx.restore();
        } else {
          ctx.save();
          ctx.translate(d.x, d.y + wob);
          ctx.fillStyle = "rgba(30,20,60,0.92)";
          ctx.beginPath();
          ctx.arc(0, 0, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Player — kid sprite, rotates to face movement direction.
      {
        const playerImg = sprites.player;
        const moving = il > 0.1;
        const bob = moving ? Math.abs(Math.sin(S.time * 10)) * 2 : Math.sin(S.time * 2.5) * 1.5;
        const ps = 56;
        // Sprite faces down-right by default; rotate to face travel direction.
        const faceAngle = il > 0.1 ? Math.atan2(iy, ix) - Math.PI / 4 : S.faceAngle || 0;
        if (il > 0.1) S.faceAngle = faceAngle;
        if (playerImg.complete && playerImg.naturalWidth > 0) {
          ctx.save();
          ctx.translate(p.x, p.y - bob);
          ctx.rotate(S.faceAngle || 0);
          ctx.shadowColor = "rgba(34,211,238,0.6)";
          ctx.shadowBlur = 14;
          ctx.drawImage(playerImg, -ps / 2, -ps / 2, ps, ps);
          ctx.restore();
        } else {
          ctx.save();
          ctx.translate(p.x, p.y - bob);
          ctx.fillStyle = "#67e8f9";
          ctx.beginPath();
          ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Particles.
      for (const pt of S.particles) {
        ctx.globalAlpha = Math.max(0, pt.life * 1.4);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.restore();

      /* Danger vignette — screen edges pulse red when a Doubtling closes in */
      if (questRef.current === "active" && nearestDist < 170) {
        const danger = 1 - nearestDist / 170;
        const pulse = 0.25 + Math.sin(S.time * 8) * 0.12;
        const vg = ctx.createRadialGradient(
          vw / 2, vh / 2, Math.min(vw, vh) * 0.35,
          vw / 2, vh / 2, Math.max(vw, vh) * 0.75
        );
        vg.addColorStop(0, "rgba(239,68,68,0)");
        vg.addColorStop(1, `rgba(239,68,68,${(danger * pulse).toFixed(3)})`);
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, vw, vh);
      }

      /* Near-miss thrill */
      if (questRef.current === "active" && nearestDist < 55 && nearestDist >= 30) {
        if (!S.nearMissCd || S.time > S.nearMissCd) {
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

      /* Joystick visual */
      if (S.joy.active) {
        const r = canvas.getBoundingClientRect();
        void r;
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

      /* Interact prompt near keeper */
      const kp = KEEPER_POS;
      if (Math.hypot(p.x - kp.x, p.y - kp.y) < 90 && !dialog) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        const vw2 = canvas.width / Math.min(window.devicePixelRatio || 1, 2);
        roundRect(ctx, vw2 / 2 - 70, 14, 140, 30, 15);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 13px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("Tap TALK to speak", vw2 / 2, 34);
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

  const talkToKeeper = () => {
    const q = questRef.current;
    const held = stateRef.current.orbs.filter((o) => o.taken).length;
    if (q === "intro") {
      setDialog("Our Unit orbs have scattered across the plaza — and Doubtlings hunt in the shadows. Bring back 5 orbs. Two hide in the corners. One dares you near the Hall. Will you do it?");
    } else if (q === "active" && held >= 5) {
      setQuestRef.current("done");
      setWon(true);
      // Victory confetti explosion!
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
      setDialog("You did it! You outsmarted the Doubtlings and brought back every orb. That's what a Pillar does — protects what's valuable. Take 50 Units. You've earned them.");
    } else if (q === "active") {
      setDialog(`You carry ${held} of 5 orbs. ${5 - held} still out there. Watch the shadows — plan your path, don't just run.`);
    } else {
      setDialog("The plaza is safe because of you, traveler. Better than yesterday — every single day.");
    }
  };

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
        <div className="flex items-center gap-1 text-sm font-bold text-accent">
          <Sparkles className="size-4" /> {orbsHeld}/5
        </div>
      </div>

      <div ref={wrapRef} className="relative overflow-hidden rounded-2xl border border-accent/25">
        <canvas ref={canvasRef} className="block touch-none" />

        {/* Dialogue box */}
        {dialog && (
          <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-amber-300/30 bg-black/80 p-4 backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-300">The Keeper</p>
            <p className="mt-1 text-sm leading-relaxed text-white">{dialog}</p>
            <div className="mt-3 flex gap-2">
              {quest === "intro" && (
                <Button size="sm" onClick={() => { startQuest(); }} className="bg-amber-400 font-bold text-black hover:bg-amber-300">
                  Accept the quest
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setDialog(null)} className="border-white/25 text-white hover:bg-white/10 hover:text-white">
                {quest === "intro" ? "Not yet" : "Continue"}
              </Button>
            </div>
          </div>
        )}

        {/* Talk button */}
        {!dialog && (
          <Button
            size="sm"
            onClick={talkToKeeper}
            className="absolute bottom-3 right-3 bg-amber-400 font-bold text-black hover:bg-amber-300"
          >
            Talk
          </Button>
        )}

        {/* Win banner */}
        {won && !dialog && (
          <div className="absolute inset-x-8 top-8 rounded-2xl border border-amber-300/40 bg-black/85 p-5 text-center backdrop-blur-sm">
            <p className="font-display text-xl font-bold text-amber-300">Quest Complete!</p>
            <p className="mt-1 text-sm text-white/85">+50 Units earned · Doubtlings dodged: {hits === 0 ? "flawless!" : `${hits} hits taken`}</p>
            <Button size="sm" className="mt-3" onClick={() => setScreen("home")}>
              Back to the World
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <p>🕹️ Left side: drag to move · WASD/arrows on desktop</p>
        <p>👾 Purple shadows steal your orbs — plan your path</p>
      </div>
    </div>
  );
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
