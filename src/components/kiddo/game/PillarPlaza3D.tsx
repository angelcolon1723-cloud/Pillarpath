import { useEffect, useRef, useState } from "react";
import { useLedger } from "@/store/ledger";
import { rankForScore, societyScore } from "@/components/kiddo/world/WorldMap";
import { EMOTIONS, type Emotion } from "./emotions";
import {
  getPillarpathData,
  getPlazaServerState,
  plazaEarn,
  plazaSpend,
  plazaSaveGame,
  logPlazaEvent,
} from "@/lib/pillarpath-server";

/**
 * PillarPlaza3D — the 3D Pillar Plaza built on the Three.js foundation
 * contributed by King's friend, professionalized and wired into the real
 * PillarPath data: real Units balance, real Society rank, and the
 * non-negotiable real-life gates (Vault Mountain: 50 Units saved,
 * Market Harbor: 3 chores done).
 */

declare global {
  interface Window {
    THREE?: any;
    __pp3d?: any;
  }
}

const THREE_URLS = [
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
  "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js",
];

let threePromise: Promise<any> | null = null;
function loadThree(): Promise<any> {
  if (typeof window !== "undefined" && window.THREE) return Promise.resolve(window.THREE);
  if (threePromise) return threePromise;
  threePromise = new Promise((resolve, reject) => {
    const tryLoad = (i: number) => {
      if (i >= THREE_URLS.length) {
        reject(new Error("Could not load the 3D library. Check your connection and reload."));
        return;
      }
      const tag = document.createElement("script");
      tag.src = THREE_URLS[i];
      tag.onload = () => (window.THREE ? resolve(window.THREE) : tryLoad(i + 1));
      tag.onerror = () => tryLoad(i + 1);
      document.head.appendChild(tag);
    };
    tryLoad(0);
  });
  return threePromise;
}

/** Bridge between the 3D plaza and the real PillarPath app state. */
interface PlazaApi {
  getBalance: () => number;
  spend: (n: number, note: string) => boolean;
  earn: (n: number, note: string, cap?: { key: string; limit: number }) => Promise<boolean>;
  getSaved: () => number;
  getChores: () => number;
  getRank: () => string;
  go: (screen: string) => void;
}

/* ---------------- Tiny WebAudio SFX (no assets, mobile-safe) ---------------- */
function makeSfx() {
  let ctx: AudioContext | null = null;
  let muted = false;
  const ac = (): AudioContext | null => {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {
        return null;
      }
    }
    if (ctx && ctx.state === "suspended") void ctx.resume();
    return ctx;
  };
  const tone = (f: number, delay = 0, dur = 0.15, type: OscillatorType = "sine", vol = 0.12) => {
    if (muted) return;
    const c = ac();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = f;
    const now = c.currentTime + delay;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(now);
    o.stop(now + dur + 0.05);
  };
  const buzz = (p: number | number[]) => {
    if (muted) return;
    try {
      (navigator as any).vibrate?.(p);
    } catch {
      /* haptics unavailable */
    }
  };
  // --- positional ambience (fountain + water, panned by camera) ---
  let noiseBuf: AudioBuffer | null = null;
  const amb: any[] = [];
  return {
    unlock() {
      ac();
    },
    setMuted(m: boolean) {
      muted = m;
    },
    buzz,
    click() {
      tone(620, 0, 0.07, "triangle", 0.07);
    },
    build() {
      tone(170, 0, 0.22, "square", 0.09);
      tone(523, 0.08, 0.18, "sine", 0.11);
      tone(784, 0.16, 0.3, "sine", 0.11);
    },
    good() {
      [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.24, "sine", 0.11));
    },
    bad() {
      tone(160, 0, 0.28, "sawtooth", 0.07);
      tone(110, 0.1, 0.32, "sawtooth", 0.07);
    },
    whisper() {
      tone(196, 0, 0.5, "sine", 0.05);
      tone(147, 0.18, 0.6, "sine", 0.04);
      tone(98, 0.36, 0.7, "sine", 0.035);
    },
    locked() {
      tone(220, 0, 0.1, "square", 0.07);
      tone(175, 0.11, 0.14, "square", 0.07);
    },
    reward() {
      [880, 1174, 1568].forEach((f, i) => tone(f, i * 0.07, 0.2, "triangle", 0.09));
    },
    shift() {
      tone(200, 0, 0.28, "sine", 0.06);
      tone(420, 0.14, 0.35, "triangle", 0.05);
    },
    ach() {
      tone(659, 0, 0.09, "sine", 0.1);
      tone(880, 0.09, 0.18, "sine", 0.1);
    },
    bird(pan: number) {
      const c = ac();
      if (!c) return;
      try {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = "sine";
        const t0 = c.currentTime;
        o.frequency.setValueAtTime(2300 + Math.random() * 900, t0);
        o.frequency.exponentialRampToValueAtTime(1700, t0 + 0.12);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.055, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
        o.connect(g);
        if (c.createStereoPanner) {
          const p = c.createStereoPanner();
          p.pan.value = Math.max(-1, Math.min(1, pan));
          g.connect(p);
          p.connect(c.destination);
        } else {
          g.connect(c.destination);
        }
        o.start(t0);
        o.stop(t0 + 0.25);
      } catch {
        /* noop */
      }
    },
    startAmbience(spots: { x: number; z: number; kind: string }[]) {
      const c = ac();
      if (!c || amb.length) return;
      try {
        if (!noiseBuf) {
          const len = c.sampleRate * 2;
          noiseBuf = c.createBuffer(1, len, c.sampleRate);
          const d = noiseBuf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
        spots.forEach((s) => {
          const src = c.createBufferSource();
          src.buffer = noiseBuf!;
          src.loop = true;
          const f = c.createBiquadFilter();
          f.type = "bandpass";
          f.frequency.value = s.kind === "fountain" ? 1000 : 480;
          f.Q.value = 0.7;
          const g = c.createGain();
          g.gain.value = 0;
          const pan = c.createStereoPanner ? c.createStereoPanner() : null;
          src.connect(f);
          f.connect(g);
          if (pan) {
            g.connect(pan);
            pan.connect(c.destination);
          } else {
            g.connect(c.destination);
          }
          src.start();
          amb.push({ src, gain: g, pan, x: s.x, z: s.z, kind: s.kind });
        });
      } catch {
        /* noop */
      }
    },
    updateAmbience(px: number, pz: number, yaw: number, dayF: number) {
      const c = ctx;
      if (!c || !amb.length) return;
      try {
        const t = c.currentTime;
        const fwd = yaw + Math.PI;
        amb.forEach((n) => {
          const dx = n.x - px;
          const dz = n.z - pz;
          const dist = Math.hypot(dx, dz);
          const srcAng = Math.atan2(dx, dz);
          const panV = Math.sin(fwd - srcAng);
          const vol =
            Math.max(0, 1 - dist / 95) *
            (n.kind === "fountain" ? 0.045 : 0.075) *
            (0.35 + 0.65 * dayF);
          n.gain.gain.setTargetAtTime(vol, t, 0.4);
          if (n.pan) n.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, panV)), t, 0.4);
        });
      } catch {
        /* noop */
      }
    },
    stopAmbience() {
      amb.forEach((n) => {
        try {
          n.src.stop();
        } catch {
          /* noop */
        }
      });
      amb.length = 0;
    },
  };
}

/* ---------------- District + dilemma data ---------------- */
interface Dilemma {
  t: string;
  g: string;
  b: string;
}
interface District {
  n: string;
  e: string;
  v: string;
  c: number;
  gate?: string;
  qs: Dilemma[];
  pq: Dilemma;
}
const DIST: District[] = [
  {
    n: "Chore Village", e: "🏠", v: "work ethic", c: 0xe9a56b,
    qs: [
      { t: "Your neighbour is sick and her garden is full of weeds. You have free time.", g: "Help weed the garden before playing.", b: "Skip it. Not your problem." },
      { t: "You promised to take out the trash, but your show is starting.", g: "Pause the show — a promise is a promise.", b: "Somebody else will do it." },
      { t: "Your room is messy and a friend just invited you over.", g: "Tidy first — it takes ten minutes.", b: "Leave it. Future-you problem." },
      { t: "The trash is overflowing and it smells.", g: "Take it out without being asked.", b: "Wait until someone tells you." },
    ],
    pq: { t: "A whole street needs weeding and the sun is setting.", g: "Organise a quick team and finish before dark.", b: "Pretend you didn't notice." },
  },
  {
    n: "Vault Mountain", e: "🏦", v: "savings", c: 0x8fa6c9,
    gate: "Save 50 Units in real life to open the vault.",
    qs: [
      { t: "A shiny toy costs all your savings. A bigger goal is two weeks away.", g: "Wait and keep saving for the bigger goal.", b: "Spend it all right now." },
      { t: "Jay found a “double your Units” trick from a stranger online.", g: "Tell Jay it sounds like a scam and walk away.", b: "Try the trick — fast Units!" },
      { t: "You want a game everyone at school has.", g: "Save a little each week until you can afford it.", b: "Beg until someone buys it for you." },
      { t: "A friend wants to borrow Units and 'pay back later'.", g: "Lend only what you can afford to lose.", b: "Lend everything — they're your friend." },
    ],
    pq: { t: "A limited-edition item is half-price for one hour only.", g: "Check if it fits your bigger goal first.", b: "Buy it immediately — it's a deal!" },
  },
  {
    n: "Market Harbor", e: "🏪", v: "smart spending", c: 0x5fb8b0,
    gate: "Finish 3 real-life chores to open the market.",
    qs: [
      { t: "A stall sells the same pencil for half the price down the pier.", g: "Compare prices, then buy the cheaper one.", b: "Buy the first one you see." },
      { t: "A merchant offers “one free candy” if you buy three bags.", g: "Do the math — check if it is really a deal.", b: "Free candy! Take it!" },
      { t: "You see a toy you love but you came for groceries.", g: "Stick to the list — the toy waits.", b: "Buy it anyway. Groceries later." },
      { t: "A 'buy one get one free' deal on something you don't need.", g: "Skip it — a deal on junk is still junk.", b: "It's free! Take it!" },
    ],
    pq: { t: "Two stalls claim the same quality. One is 30% more expensive.", g: "Ask questions and choose value over brand.", b: "Grab the expensive one so you look cool." },
  },
  {
    n: "Studio Island", e: "🎨", v: "creativity", c: 0xd98cb3,
    qs: [
      { t: "Your painting looks wrong to you. A friend is watching.", g: "Keep going and try a new colour.", b: "Crumple it up and quit." },
      { t: "Maya says your song needs a weird verse. It feels risky.", g: "Try the weird verse — new sounds grow you.", b: "Play it safe and keep it boring." },
      { t: "Everyone is copying the same popular style.", g: "Make yours different — that's the point.", b: "Copy them so you fit in." },
      { t: "Your first try at the drums sounds terrible.", g: "Practice ten minutes a day.", b: "Quit. You're just not musical." },
    ],
    pq: { t: "You have 10 minutes left and the canvas is still blank.", g: "Start with one bold stroke and see where it leads.", b: "Give up and say you're not creative." },
  },
  {
    n: "Learning Lagoon", e: "📚", v: "knowledge", c: 0x7bb661,
    qs: [
      { t: "A puzzle is hard. A classmate offers to just give you the answer.", g: "Ask for a hint instead and solve it yourself.", b: "Copy the answer." },
      { t: "You got a question wrong in front of everyone.", g: "Ask what you missed so you can learn it.", b: "Laugh it off and never think about it again." },
      { t: "There's a big book you've been avoiding.", g: "Read one chapter a night.", b: "Never open it." },
      { t: "You don't understand the homework.", g: "Ask the teacher tomorrow.", b: "Guess and hope." },
    ],
    pq: { t: "The test is tomorrow and you still don't understand one chapter.", g: "Teach the idea out loud to a toy or sibling.", b: "Hope the question won't appear." },
  },
  {
    n: "Hall of Becoming", e: "🏛️", v: "growth", c: 0xe6c65a,
    qs: [
      { t: "You made a mistake that hurt a friend. Nobody saw it.", g: "Say sorry and make it right.", b: "Stay quiet and hope it passes." },
      { t: "Doubt whispers: “You will never reach Pillar.”", g: "Answer it: “Better than yesterday is enough.”", b: "Believe the whisper and stop trying." },
      { t: "You promised yourself you'd practice, but the couch is comfy.", g: "Keep the promise — that's how pillars are built.", b: "Tomorrow. Definitely tomorrow." },
      { t: "Someone is being picked on and everyone is watching.", g: "Stand with them.", b: "Stay out of it." },
    ],
    pq: { t: "You were blamed for something you only partly caused.", g: "Own your part and help fix the whole thing.", b: "Point the finger at someone else." },
  },
];

const TIERS: [number, string][] = [
  [0, "Settlement"],
  [25, "Village"],
  [60, "Town"],
  [120, "City"],
  [220, "Metropolis"],
  [400, "Dimensional Hub"],
];

const ACH: Record<string, { t: string; d: string }> = {
  firstQuest: { t: "First Step", d: "Complete your first quest" },
  firstBuild: { t: "Builder", d: "Build your first structure" },
  trust5: { t: "Trusted", d: "Reach 5 Trust" },
  family10: { t: "Family Bond", d: "Reach 10 Family Bond" },
  shift1: { t: "Dimensional Traveller", d: "Use Dimensional Shift" },
  allOpen: { t: "Explorer", d: "Open every district" },
  fullDistrict: { t: "City Planner", d: "Fill a district" },
  blightFree: { t: "Healer", d: "Clear all blight from a district" },
  doubt1: { t: "Name It", d: "Face your first Doubtling" },
};

const SHIFT_COST = 1;
const SHIFT_DUR = 45;

interface StructureDef { name: string; icon: string; cost: number; prosperity: number; }
const DIST_IDS = ["chore", "vault", "market", "studio", "learn", "hall"];
const STRUCTURES: Record<string, StructureDef[]> = {
  chore: [
    { name: "Cottage", icon: "🏡", cost: 50, prosperity: 20 },
    { name: "Workshop", icon: "🏭", cost: 120, prosperity: 45 },
    { name: "Town Hall", icon: "🏛️", cost: 250, prosperity: 80 },
  ],
  vault: [
    { name: "Coin Hut", icon: "🛖", cost: 50, prosperity: 20 },
    { name: "Silver Vault", icon: "🏦", cost: 150, prosperity: 50 },
    { name: "Gold Tower", icon: "🗼", cost: 300, prosperity: 90 },
  ],
  market: [
    { name: "Stall", icon: "⛺", cost: 50, prosperity: 20 },
    { name: "Shop", icon: "🏪", cost: 120, prosperity: 45 },
    { name: "Grand Bazaar", icon: "🏬", cost: 250, prosperity: 80 },
  ],
  studio: [
    { name: "Easel", icon: "🎨", cost: 50, prosperity: 20 },
    { name: "Art Studio", icon: "🖌️", cost: 120, prosperity: 45 },
    { name: "Gallery", icon: "🖼️", cost: 250, prosperity: 80 },
  ],
  learn: [
    { name: "Book Nook", icon: "📚", cost: 50, prosperity: 20 },
    { name: "Library", icon: "🏫", cost: 150, prosperity: 50 },
    { name: "University", icon: "🎓", cost: 300, prosperity: 90 },
  ],
  hall: [
    { name: "Shrine", icon: "⛩️", cost: 50, prosperity: 20 },
    { name: "Monument", icon: "🗿", cost: 150, prosperity: 50 },
    { name: "Pillar of Legends", icon: "🏆", cost: 300, prosperity: 90 },
  ],
};

interface NewsItem { icon: string; headline: string; detail: string; time: number; }
interface Daily { date: string; key: string; text: string; need: number; progress: number; done: boolean; }

const NPCS = [
  { name: "Maya", icon: "🌟", district: 0, color: 0xe879f9, x: 6.5, z: 5,
    qs: [
      { t: "A new kid sits alone at lunch. Your friends say not to bother.", g: "Invite them to sit with you.", b: "Stay with your friends." },
      { t: "Maya's little brother broke her favorite paintbrush.", g: "Forgive him — it was an accident.", b: "Stay mad all week." },
    ] },
  { name: "Jay", icon: "⚡", district: 2, color: 0x38bdf8, x: -6.5, z: 5,
    qs: [
      { t: "Jay dares you to take an extra cookie when nobody is looking.", g: "Say no — dares don't make it right.", b: "Take it. Nobody will know." },
      { t: "Jay found a wallet with Units inside.", g: "Turn it in so it finds its owner.", b: "Keep it. Finders keepers." },
    ] },
  { name: "Sam", icon: "🔬", district: 4, color: 0x4ade80, x: 6.5, z: -4,
    qs: [
      { t: "Sam's experiment failed in front of the class.", g: "Write down what went wrong and try again.", b: "Hide the results and pretend it worked." },
      { t: "A friend asks Sam for homework answers.", g: "Offer to study together instead.", b: "Just send the answers." },
    ] },
];
const R = 48;
const GATE = 15;
const SAVE_KEY = "pillar-plaza-3d";
// Local fallback caps — used only when the server is unreachable (offline).
// When online, caps are enforced atomically in Postgres (plaza_reward_caps),
// so clearing storage cannot farm rewards.
function localCapConsume(key: string, limit: number): boolean {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const k = `plaza-cap-${key}`;
    const j = JSON.parse(localStorage.getItem(k) || "{}");
    const n = j.day === today ? j.n || 0 : 0;
    if (n >= limit) return false;
    localStorage.setItem(k, JSON.stringify({ day: today, n: n + 1 }));
    return true;
  } catch {
    return false;
  }
}
const REWARD_KEY = "pillar-plaza-3d-rewards";
const RANK_ORDER = ["Seedling", "Sprout", "Trailblazer", "Luminary", "Pillar"];
const WISDOM = [
  "Wealth is what you don't see.",
  "A small leak sinks a great ship.",
  "Do not save what is left after spending — spend what is left after saving.",
  "The best time to start was yesterday. The next best time is now.",
  "A penny saved is a penny earned.",
];
const NPC_MEMORY: Record<string, { good: string; bad: string }> = {
  Maya: {
    good: "Last time you told me to stand up for my friend. I did — thank you \u{1F49B}",
    bad: "Last time you told me to stay quiet... I've been thinking about it.",
  },
  Jay: {
    good: "Your idea worked — the game was fair AND fun!",
    bad: "I tried what you said... it didn't go great.",
  },
  Sam: {
    good: "I shared my snack like you said. We both smiled!",
    bad: "I kept it all to myself... felt weird after.",
  },
};

/* ---------------- Plaza CSS (cosmic PillarPath theme) ---------------- */
const PLAZA_CSS = `
.pp3d{position:absolute;inset:0;overflow:hidden;font-family:ui-rounded,system-ui,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none}
.pp3d canvas{display:block;width:100%;height:100%}
.pp3d-hud{position:absolute;left:8px;right:8px;top:calc(env(safe-area-inset-top,0px) + 8px);display:flex;flex-wrap:wrap;gap:6px;pointer-events:none;z-index:5}
.pp3d-chip{background:rgba(15,10,40,.72);border:1px solid rgba(139,92,246,.35);color:#f3efff;border-radius:14px;padding:5px 10px;font-size:12px;font-weight:700;box-shadow:0 2px 10px #0006;backdrop-filter:blur(6px)}
.pp3d-bar{display:inline-block;width:46px;height:7px;border-radius:4px;background:#ffffff22;vertical-align:middle;overflow:hidden;margin-left:4px}
.pp3d-bar i{display:block;height:100%;border-radius:4px}
.pp3d-panel{position:absolute;left:8px;right:8px;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);display:flex;justify-content:center;gap:8px;flex-wrap:wrap;z-index:5}
.pp3d-btn{font:inherit;font-size:14px;font-weight:800;border:0;border-radius:14px;padding:10px 16px;background:linear-gradient(135deg,#06b6d4,#8b5cf6,#d946ef);color:#fff;box-shadow:0 4px 14px #8b5cf680;cursor:pointer}
.pp3d-btn.alt{background:rgba(15,10,40,.78);color:#f3efff;border:1px solid rgba(139,92,246,.4);box-shadow:0 2px 8px #0006}
.pp3d-msg{position:absolute;left:50%;top:24%;transform:translateX(-50%);background:rgba(15,10,40,.85);border:1px solid rgba(139,92,246,.4);color:#f3efff;padding:8px 14px;border-radius:14px;font-size:13px;font-weight:700;text-align:center;max-width:82%;display:none;z-index:6;box-shadow:0 4px 16px #0008}
.pp3d-modal{position:absolute;inset:0;background:#06031299;display:none;align-items:center;justify-content:center;padding:16px;z-index:10}
.pp3d-modal .box{background:linear-gradient(160deg,#1b1040,#0d0728);border:1px solid rgba(139,92,246,.45);color:#f3efff;border-radius:20px;padding:18px;max-width:380px;width:100%;max-height:82%;overflow:auto;box-shadow:0 12px 40px #000c}
.pp3d-modal h3{margin:0 0 8px;font-size:17px}
.pp3d-modal p{font-size:14px;line-height:1.5;color:#d9d2ff}
.pp3d-modal .box .pp3d-btn{display:block;width:100%;margin-top:8px;text-align:left;font-size:14px}
.pp3d-stat{background:#ffffff0d;border-radius:12px;padding:8px 10px;margin:8px 0;font-size:13px;font-weight:700}
.pp3d-track{height:8px;border-radius:5px;background:#ffffff1c;margin-top:6px;overflow:hidden}
.pp3d-track i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,#06b6d4,#8b5cf6)}
.pp3d-err{position:absolute;left:8px;right:8px;top:60px;background:#fff;color:#900;padding:8px;font:12px monospace;display:none;z-index:20;border-radius:10px}
.pp3d-dimfx{position:absolute;inset:0;pointer-events:none;z-index:3;opacity:0;transition:opacity .7s;background:radial-gradient(ellipse at 50% 40%, transparent 25%, #6a1b9aaa 100%);mix-blend-mode:screen}
.pp3d-dimfx.on{opacity:.6}
.pp3d-ach{position:absolute;top:calc(env(safe-area-inset-top,0px) + 76px);left:50%;transform:translateX(-50%) translateY(-24px);background:linear-gradient(135deg,#f0d78c,#d4a017);color:#1a1200;padding:10px 18px;border-radius:16px;font-weight:800;font-size:13px;opacity:0;pointer-events:none;transition:.45s;z-index:15;box-shadow:0 8px 28px #0008;white-space:nowrap;max-width:92%;overflow:hidden;text-overflow:ellipsis}
.pp3d-ach.show{opacity:1;transform:translateX(-50%) translateY(0)}
.pp3d-tutdot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ffffff30;margin:0 3px}
.pp3d-tutdot.on{background:#d4a017}
.pp3d-movehint{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 86px);transform:translateX(-50%);background:#0c1228cc;color:#00e5ffaa;font-size:12px;padding:6px 14px;border-radius:20px;z-index:4;pointer-events:none;border:1px solid #00e5ff33;transition:opacity .4s;white-space:nowrap}
.pp3d-float{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);font-size:22px;font-weight:800;pointer-events:none;opacity:0;transition:opacity .3s,transform .6s;z-index:12;text-shadow:0 0 14px currentColor;white-space:nowrap}
`;

/* ---------------- The plaza itself (adapted from the contributed foundation) ---------------- */
interface PlazaHooks {
  queueCloudSave: () => void;
  serverEvent: (icon: string, headline: string, detail: string) => void;
}
function startPlaza(root: HTMLElement, THREE: any, api: PlazaApi, hooks: PlazaHooks): () => void {
  const sfx = makeSfx();
  const cleanups: (() => void)[] = [];
  const on = <K extends keyof WindowEventMap>(
    target: Window | HTMLElement,
    type: string,
    fn: (e: any) => void,
    opts?: any,
  ) => {
    target.addEventListener(type, fn as EventListener, opts);
    cleanups.push(() => target.removeEventListener(type, fn as EventListener, opts));
  };

  /* ----- state (plaza-local progress; money & rank are real app data) ----- */
  interface PlazaState {
    trust: number;
    courage: number;
    family: number;
    freeBuild: number;
    famBase: { chores: number; saved: number };
    ach: Record<string, boolean>;
    tutorial: number;
    news: NewsItem[];
    newsSeen: number;
    daily: Daily | null;
    lastRank: number;
    npcMem: Record<string, "good" | "bad">;
    cacheDay: string;
    cacheUnits: number;
    doubts: Record<string, number>;
    powerCleanse: boolean;
    powerAscend: boolean;
    muted: boolean;
    savedAt: number;
    blight: number[];
    built: number[][];
  }
  let S: PlazaState = {
    trust: 0, courage: 0, family: 0, freeBuild: 0,
    famBase: { chores: 0, saved: 0 }, ach: {}, tutorial: 0,
    news: [], newsSeen: 0, daily: null, lastRank: -1, npcMem: {}, cacheDay: "", cacheUnits: 0, doubts: {}, powerCleanse: false, powerAscend: false, muted: false, savedAt: 0,
    blight: [0, 0, 0, 0, 0, 0], built: [[], [], [], [], [], []],
  };
  try {
    const j = localStorage.getItem(SAVE_KEY);
    if (j) {
      const loaded = JSON.parse(j);
      if (loaded.built && typeof loaded.built[0] === "number") {
        loaded.built = (loaded.built as number[]).map((n) => Array(Math.min(8, n)).fill(0));
      }
      S = Object.assign(S, loaded);
    }
  } catch {
    /* fresh plaza */
  }
  const save = () => {
    try {
      S.savedAt = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(S));
      hooks.queueCloudSave();
    } catch {
      /* storage unavailable */
    }
  };
  sfx.setMuted(!!S.muted);
  const isOpen = (i: number) => (i === 1 ? api.getSaved() >= 50 : i === 2 ? api.getChores() >= 3 : true);
  const prosp = () => {
    let p = 0;
    DIST_IDS.forEach((id, i) => {
      (S.built[i] || []).forEach((t) => {
        p += STRUCTURES[id][t]?.prosperity || 0;
      });
    });
    return p + Math.floor(S.trust / 2) + Math.floor(S.family / 3) - S.blight.reduce((a, b) => a + b, 0);
  };
  function pushNews(icon: string, headline: string, detail: string) {
    S.news = [{ icon, headline, detail, time: Date.now() }, ...S.news].slice(0, 30);
    save();
  }
  const rankIdx = () => Math.max(0, RANK_ORDER.indexOf(api.getRank()));

  // --- Dimensional Shift state (runtime only, never saved) ---
  let shiftActive = false, shiftTimer = 0, shiftDistrict = -1;

  // --- Family Bond: derived from REAL chores + savings deltas, never fake-logged ---
  function checkFamilyPowers() {
    if (S.family >= 15 && S.freeBuild < 1) {
      S.freeBuild = 1;
      save();
      showAch("family10");
      pushNews("💜", "Pillar power unlocked!", "Family Bond reached 15 — 1 free build earned.");
      hooks.serverEvent("💜", "Pillar power unlocked!", "Family Bond 15 — free build earned.");
      say("💜 Pillar power unlocked: 1 free build!");
      sfx.reward();
      sfx.buzz([40, 40, 40, 40, 120]);
    } else if (S.family >= 10) {
      showAch("family10");
    }
    if (S.family >= 30 && !S.powerCleanse) {
      S.powerCleanse = true;
      save();
      pushNews("\u{1F6E1}\uFE0F", "Pillar power unlocked!", "Family Bond reached 30 — Blight Cleansing armed.");
      hooks.serverEvent("\u{1F6E1}\uFE0F", "Pillar power unlocked!", "Family Bond 30 — Blight Cleansing armed.");
      say("\u{1F6E1}\uFE0F Pillar power unlocked: Blight Cleansing!");
      sfx.reward();
      sfx.buzz([40, 40, 40, 40, 120]);
    }
    if (S.family >= 50 && !S.powerAscend) {
      S.powerAscend = true;
      save();
      pushNews("\u{1F31F}", "Pillar power unlocked!", "Family Bond reached 50 — Pillar Ascendant armed.");
      hooks.serverEvent("\u{1F31F}", "Pillar power unlocked!", "Family Bond 50 — Pillar Ascendant armed.");
      say("\u{1F31F} Pillar power unlocked: Pillar Ascendant!");
      sfx.reward();
      sfx.buzz([40, 40, 40, 40, 200]);
    }
  }
  function syncFamily() {
    const chores = api.getChores();
    const saved = api.getSaved();
    const dc = Math.max(0, chores - S.famBase.chores);
    const ds = Math.max(0, saved - S.famBase.saved);
    const gain = dc * 2 + Math.floor(ds / 10) * 3;
    if (gain > 0) {
      S.family += gain;
      S.famBase = { chores, saved };
      save();
      checkFamilyPowers();
    } else if (chores !== S.famBase.chores || saved !== S.famBase.saved) {
      S.famBase = { chores, saved };
      save();
    }
  }

  function ensureDaily() {
    const today = new Date().toDateString();
    if (!S.daily || S.daily.date !== today) {
      const goals = [
        { key: "quests", text: "Complete 2 quests with good choices", need: 2 },
        { key: "builds", text: "Build 1 structure", need: 1 },
        { key: "shifts", text: "Use Dimensional Shift once", need: 1 },
        { key: "talks", text: "Talk to 2 friends", need: 2 },
        { key: "face", text: "Face 1 Doubtling with the truth", need: 1 },
      ];
      const g = goals[Math.floor(Math.random() * goals.length)];
      S.daily = { date: today, key: g.key, text: g.text, need: g.need, progress: 0, done: false };
      save();
    }
  }
  async function dailyTick(key: string) {
    const d = S.daily;
    if (!d || d.done || d.key !== key) return;
    d.progress++;
    if (d.progress >= d.need) {
      d.done = true;
      S.courage++;
      const ok = await api.earn(15, "Pillar Plaza daily challenge", { key: "daily", limit: 1 });
      if (ok) {
        floatText("Daily Done! +15 Units", "#ffaa00");
        say("🎯 Daily challenge complete! +15 real Units.");
        pushNews("🎯", "Daily challenge complete!", d.text + " — +15 Units earned.");
        hooks.serverEvent("🎯", "Daily challenge complete!", `${d.text} — +15 Units earned.`);
      } else {
        say("🎯 Challenge done — today's reward was already claimed.");
        pushNews("🎯", "Daily challenge complete!", d.text + ".");
      }
      sfx.ach();
      sfx.buzz([40, 40, 40, 40, 150]);
    }
    save();
    drawHud();
  }
  function floatText(t: string, color?: string) {
    const el = $("pp3d-float");
    if (!el) return;
    el.textContent = t;
    el.style.color = color || "#00e5ff";
    el.style.opacity = "1";
    el.style.transform = "translate(-50%,-80%)";
    window.clearTimeout((el as any)._t);
    (el as any)._t = window.setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translate(-50%,-120%)";
    }, 900);
  }
  let rankCeremonyPending = false;
  function showRankCeremony() {
    const rank = RANK_ORDER[rankIdx()];
    sfx.ach();
    sfx.buzz([60, 60, 60, 60, 200]);
    floatText(`\u{1F451} ${rank}!`, "#ffd36e");
    pushNews("\u{1F451}", `Society rank up: ${rank}!`, "Your real-life effort raised your rank. The whole plaza celebrates you.");
    hooks.serverEvent("\u{1F451}", `Society rank up: ${rank}!`, "Real chores, saving, and good choices raised this rank.");
    modal(
      `<h3>\u{1F451} Rank Up: ${rank}!</h3>` +
        `<p>All your real chores, saving, and good choices added up. The energy core burns brighter because of <b>you</b>.</p>` +
        `<p style="opacity:.8">This is what becoming looks like. Better than yesterday.</p>` +
        `<button class="pp3d-btn" onclick="__pp3d.close()">Celebrate! \u{1F389}</button>`,
    );
  }
  function showAch(key: string) {
    if (S.ach[key]) return;
    const a = ACH[key];
    if (!a) return;
    S.ach[key] = true;
    S.courage++;
    save();
    pushNews("🏆", `Achievement: ${a.t}`, `${a.d} (+1 Courage)`);
    achBox.textContent = `🏆 ${a.t} — ${a.d} · +1 Courage`;
    achBox.classList.add("show");
    sfx.ach();
    sfx.buzz([30, 50, 30, 50, 90]);
    window.setTimeout(() => achBox.classList.remove("show"), 3400);
  }

  /* ----- DOM scaffold ----- */
  const style = document.createElement("style");
  style.textContent = PLAZA_CSS;
  root.appendChild(style);
  const wrap = document.createElement("div");
  wrap.className = "pp3d";
  wrap.innerHTML = `
    <div class="pp3d-hud" id="pp3d-hud"></div>
    <div class="pp3d-msg" id="pp3d-msg"></div>
    <div class="pp3d-ach" id="pp3d-ach"></div>
    <div class="pp3d-float" id="pp3d-float"></div>
    <div class="pp3d-dimfx" id="pp3d-dimfx"></div>
    <div class="pp3d-movehint" id="pp3d-movehint">Tap the ground to walk · WASD / arrows · Autopilot</div>
    <div class="pp3d-panel" id="pp3d-panel"></div>
    <div class="pp3d-modal" id="pp3d-modal"><div class="box" id="pp3d-mbox"></div></div>
    <div class="pp3d-err" id="pp3d-err"></div>`;
  root.appendChild(wrap);
  const $ = (id: string) => wrap.querySelector<HTMLElement>("#" + id)!;
  const hud = $("pp3d-hud"), panel = $("pp3d-panel"), msgBox = $("pp3d-msg");
  const dimfx = $("pp3d-dimfx"), achBox = $("pp3d-ach");

  /* ----- three.js scene ----- */
  const rd = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  rd.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  rd.shadowMap.enabled = true;
  rd.shadowMap.type = THREE.PCFSoftShadowMap;
  if (THREE.ACESFilmicToneMapping !== undefined) {
    rd.toneMapping = THREE.ACESFilmicToneMapping;
    rd.toneMappingExposure = 1.15;
  }
  if (THREE.sRGBEncoding !== undefined) rd.outputEncoding = THREE.sRGBEncoding;
  wrap.prepend(rd.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x6b8f4e, 0.8);
  const sun = new THREE.DirectionalLight(0xfff1d0, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -80;
  sc.right = sc.top = 80;
  sc.far = 300;
  scene.add(hemi, sun, sun.target);
  const neonViolet = new THREE.PointLight(0x7b2fff, 0.7, 48, 2);
  neonViolet.position.set(30, 9, -20);
  scene.add(neonViolet);
  const neonGreen = new THREE.PointLight(0x00ff9d, 0.5, 42, 2);
  neonGreen.position.set(-25, 7, 25);
  scene.add(neonGreen);
  const bgColor = new THREE.Color(0x9fd8f7);
  scene.background = bgColor;
  scene.fog = new THREE.Fog(0x9fd8f7, 70, 200);

  const M = (c: number, o?: any) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  const std = (c: number, o?: any) =>
    new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75, metalness: 0.05 }, o || {}));
  const glow = (c: number, i = 0.6) =>
    new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.2, metalness: 0.7 });
  const add = (g: any, m: any, x: number, y: number, z: number, p?: any): any => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    (p || scene).add(o);
    return o;
  };
  function textSprite(text: string, fontPx = 64, scale = 2.2): any {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const cx = cv.getContext("2d")!;
    cx.font = `${fontPx}px serif`;
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.fillText(text, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(scale, scale, 1);
    return sp;
  }
  function labelSprite(text: string): any {
    const cv = document.createElement("canvas");
    cv.width = 512;
    cv.height = 128;
    const cx = cv.getContext("2d")!;
    cx.fillStyle = "rgba(15,10,40,0.78)";
    if ((cx as any).roundRect) {
      cx.beginPath();
      (cx as any).roundRect(8, 24, 496, 80, 36);
      cx.fill();
    } else {
      cx.fillRect(8, 24, 496, 80);
    }
    cx.font = "bold 44px system-ui, sans-serif";
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.fillStyle = "#f3efff";
    cx.fillText(text, 256, 66);
    const tex = new THREE.CanvasTexture(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(11, 2.75, 1);
    return sp;
  }

  // Ground + central plaza
  add(new THREE.CircleGeometry(170, 48), std(0x0a1220, { roughness: 0.6, metalness: 0.3 }), 0, 0, 0).rotation.x = -Math.PI / 2;
  add(new THREE.CylinderGeometry(15, 15, 0.3, 40), std(0x101828, { roughness: 0.25, metalness: 0.7 }), 0, 0.15, 0);

  // Central Pillar — a neon energy core that grows with the kid's real Society rank
  const mon = new THREE.Group();
  scene.add(mon);
  add(new THREE.CylinderGeometry(3.8, 4.2, 0.9, 24), std(0x1a2a40, { metalness: 0.8, roughness: 0.35 }), 0, 0.55, 0, mon);
  add(new THREE.CylinderGeometry(3.2, 3.2, 0.4, 24), glow(0x00e5ff, 0.5), 0, 1.0, 0, mon);
  const pillarCol = add(new THREE.CylinderGeometry(0.55, 0.7, 7.5, 16), std(0x203040, { metalness: 0.6, roughness: 0.3 }), 0, 4.3, 0, mon);
  const pillarOrb = add(new THREE.SphereGeometry(1.05, 24, 18), glow(0x00e5ff, 1.0), 0, 8.4, 0, mon);
  const orbCore = add(new THREE.SphereGeometry(0.55, 16, 12), glow(0xffffff, 1.5), 0, 8.4, 0, mon);
  const orbMat = pillarOrb.material as any;
  const orbLight = new THREE.PointLight(0x00e5ff, 1.4, 32, 2);
  orbLight.position.set(0, 8.5, 0);
  mon.add(orbLight);
  // rotating holographic rings around the core
  const holoRings: any[] = [];
  for (let r = 0; r < 3; r++) {
    const hr = add(new THREE.TorusGeometry(2.2 + r * 0.9, 0.06, 8, 40), glow([0x00e5ff, 0x7b2fff, 0x00ff9d][r], 0.7), 0, 3 + r * 1.8, 0, mon);
    hr.rotation.x = Math.PI / 2 + r * 0.15;
    holoRings.push(hr);
  }
  const orbColors = [0x00e5ff, 0x00e5ff, 0x7b2fff, 0x00ff9d, 0xff8ad4];
  function sizeMonument() {
    const h = 7.5 + rankIdx() * 1.6;
    pillarCol.scale.y = h / 7.5;
    pillarCol.position.y = h / 2 + 0.6;
    pillarOrb.position.y = h + 1.5;
    orbCore.position.y = h + 1.5;
    orbMat.color.setHex(orbColors[rankIdx()]);
    orbMat.emissive.setHex(orbColors[rankIdx()]);
  }
  sizeMonument();
  // holographic plaza ring
  const ringMat = glow(0x00e5ff, 0.8);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(15.5, 0.15, 8, 64), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.35;
  scene.add(ring);

  /* ----- districts ----- */
  const zones: { x: number; z: number; a: number }[] = [];
  const slots: { g: any; sl: [number, number][]; meshes: any[]; windows: any[] }[] = [];
  const groundMats: any[] = [];
  const waterMats: any[] = [];
  DIST.forEach((d, i) => {
    const a = (i * Math.PI) / 3;
    const cx = Math.sin(a) * R;
    const cz = -Math.cos(a) * R;
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    scene.add(g);
    const gm = std(d.c, { roughness: 0.5, metalness: 0.4 });
    gm.color.multiplyScalar(0.62);
    groundMats.push(gm);
    const dring = add(new THREE.TorusGeometry(14.5, 0.08, 6, 48), glow(0x00e5ff, 0.4), 0, 0.24, 0, g);
    dring.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(15, 15, 0.2, 32), gm, 0, 0.1, 0, g);
    const wall = M(0xfff4e0), roof = M(0xc0563a);
    if (i === 0) {
      [[-4, -3], [4, -4], [0, 4]].forEach(([x, z]) => {
        add(new THREE.BoxGeometry(4, 3, 4), wall, x, 1.5, z, g);
        add(new THREE.ConeGeometry(3.4, 2.2, 4), roof, x, 4.1, z, g).rotation.y = Math.PI / 4;
      });
    }
    if (i === 1) {
      add(new THREE.ConeGeometry(9, 13, 7), M(0x9aa5b1), 0, 6.5, -3, g);
      add(new THREE.ConeGeometry(3, 3, 7), M(0xffffff), 0, 12.5, -3, g);
      add(new THREE.BoxGeometry(3, 3.4, 0.6), M(0xc9a227), 0, 1.7, 2.4, g);
    }
    if (i === 2) {
      const wm = M(0x4aa3d8, { transparent: true, opacity: 0.9 });
      waterMats.push(wm);
      add(new THREE.CylinderGeometry(6, 6, 0.1, 24), wm, 0, 0.25, -5, g);
      [-5, 0, 5].forEach((x) => {
        add(new THREE.BoxGeometry(3, 2, 2.2), wall, x, 1, 3, g);
        add(new THREE.BoxGeometry(3.4, 0.3, 2.8), M([0xe05555, 0x4a90d9, 0xf2c14e][(x + 5) / 5], {}), x, 2.3, 3, g);
      });
    }
    if (i === 3) {
      add(new THREE.SphereGeometry(4, 20, 14), M(0xf4a6c9), 0, 4, 0, g);
      add(new THREE.TorusGeometry(5.5, 0.5, 10, 28), M(0x6fd0c5), 0, 4, 0, g).rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.4, 0.4, 6, 8), M(0xffb347), 6, 3, 4, g);
    }
    if (i === 4) {
      const wm = M(0x5fb7e8, { transparent: true, opacity: 0.9 });
      waterMats.push(wm);
      add(new THREE.CylinderGeometry(5, 5, 0.1, 24), wm, 4, 0.25, 3, g);
      [0, 1, 2].forEach((k) =>
        add(new THREE.BoxGeometry(4.4 - k * 0.4, 1, 3), M([0xd9534f, 0x5b8def, 0x5cb85c][k]), -4, 0.7 + k, -3, g),
      );
    }
    if (i === 5) {
      add(new THREE.BoxGeometry(14, 0.8, 8), M(0xf5efe0), 0, 0.5, 0, g);
      for (let k = -3; k <= 3; k++) add(new THREE.CylinderGeometry(0.55, 0.65, 6, 12), M(0xfaf3e3), k * 1.9, 3.8, 0, g);
      add(new THREE.BoxGeometry(14, 0.8, 8), M(0xf5efe0), 0, 7.2, 0, g);
      add(new THREE.ConeGeometry(8.5, 2.4, 4), M(0xe6c65a), 0, 8.8, 0, g).rotation.y = Math.PI / 4;
    }
    // district sign post
    add(new THREE.CylinderGeometry(0.15, 0.15, 3, 6), M(0x8b5a2b), 0, 1.5, 11, g);
    const sign = add(new THREE.BoxGeometry(4.6, 1.6, 0.2), M(0x2a1b4e), 0, 3.4, 11, g);
    sign.castShadow = false;
    const lab = labelSprite(`${d.e} ${d.n}`);
    lab.position.set(0, 6.4, 11);
    g.add(lab);
    // building slots (ring around district)
    const sl: [number, number][] = [];
    for (let k = 0; k < 8; k++) {
      const t = (k / 8) * Math.PI * 2;
      sl.push([Math.cos(t) * 11, Math.sin(t) * 11]);
    }
    slots.push({ g, sl, meshes: [], windows: [] });
    zones.push({ x: cx, z: cz, a });
    // path from plaza
    const path = add(new THREE.BoxGeometry(5, 0.1, R - 30), glow(0x00e5ff, 0.16), (Math.sin(a) * R) / 2, 0.08, (-Math.cos(a) * R) / 2, scene);
    path.rotation.y = -a;
  });

  // positional ambience: fountain + harbor/lagoon water, panned by camera
  sfx.startAmbience([
    { x: 0, z: 0, kind: "fountain" },
    { x: zones[2].x, z: zones[2].z, kind: "water" },
    { x: zones[4].x, z: zones[4].z, kind: "water" },
  ]);

  // NPCs: Maya, Jay, Sam — walk up and talk
  const npcGroups: any[] = [];
  NPCS.forEach((n) => {
    const g = slots[n.district].g;
    const grp = new THREE.Group();
    grp.position.set(n.x, 0, n.z);
    add(new THREE.CylinderGeometry(0.4, 0.45, 1.1, 10), M(n.color), 0, 1.0, 0, grp);
    add(new THREE.SphereGeometry(0.36, 14, 10), M(0xf2c9a0), 0, 1.95, 0, grp);
    const tag = textSprite(n.icon);
    tag.position.set(0, 3.0, 0);
    grp.add(tag);
    g.add(grp);
    npcGroups.push(grp);
  });

  function rebuild() {
    DIST.forEach((d, i) => {
      const s = slots[i];
      s.meshes.forEach((m) => s.g.remove(m));
      s.meshes = [];
      s.windows = [];
      const list = S.built[i] || [];
      for (let k = 0; k < Math.min(list.length, 8); k++) {
        const type = list[k] || 0;
        const h = new THREE.Group();
        const [x, z] = s.sl[k];
        h.position.set(x, 0, z);
        h.rotation.y = -Math.atan2(z, x);
        // three visual tiers: hut -> house -> landmark
        const W = [2.4, 3.2, 4.2][type];
        const H = [1.9, 2.9, 4.3][type];
        const wallC = [0xe8d9b0, 0xfff4e0, 0xf8f4ec][type];
        const roofC = [0x8a6a4a, 0xc0563a, 0xd4a017][type];
        add(new THREE.BoxGeometry(W, H, W), M(wallC), 0, H / 2, 0, h);
        add(new THREE.ConeGeometry(W * 0.78, 1.7, 4), M(roofC), 0, H + 0.85, 0, h).rotation.y = Math.PI / 4;
        add(new THREE.BoxGeometry(0.8, 1.2, 0.1), M(0x6a4b2a), 0, 0.6, W / 2 + 0.03, h);
        // warm windows that glow at night (more on grander builds)
        const wins = type === 2 ? [-1.1, 0, 1.1] : [-0.7, 0.7];
        wins.forEach((wx) => {
          const wm = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0 });
          const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), wm);
          win.position.set(wx, H * 0.62, W / 2 + 0.04);
          h.add(win);
          s.windows.push(wm);
        });
        s.g.add(h);
        s.meshes.push(h);
      }
      const dark = Math.min(S.blight[i] / 4, 1);
      groundMats[i].color.setHex(d.c).multiplyScalar(0.62).lerp(new THREE.Color(0x111122), dark * 0.8);
    });
  }

  /* ----- environment: trees, stars, moon, clouds, fireflies ----- */
  let rs = 7;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 110; n++) {
    const a = rnd() * 6.283;
    const r = 22 + rnd() * 95;
    const x = Math.sin(a) * r;
    const z = -Math.cos(a) * r;
    if (zones.some((q) => Math.hypot(q.x - x, q.z - z) < 19)) continue;
    const th = 2 + rnd() * 4;
    add(new THREE.CylinderGeometry(0.12, 0.18, th, 6), std(0x1a2030, { metalness: 0.6, roughness: 0.4 }), x, th / 2, z);
    if (rnd() > 0.45) {
      add(new THREE.SphereGeometry(0.25 + rnd() * 0.2, 8, 6), glow([0x00e5ff, 0x7b2fff, 0x00ff9d][Math.floor(rnd() * 3)], 0.6), x, th + 0.3, z);
    } else {
      add(new THREE.SphereGeometry(1.3 + rnd(), 8, 6), std(0x0e2a1e, { roughness: 0.9 }), x, th + 0.8, z);
    }
  }
  // stars (fade in at night)
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = Math.random() * Math.PI * 0.45 + 0.05;
    const r = 230;
    starPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    starPos[i * 3 + 1] = Math.sin(e) * r;
    starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0 });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
  // moon
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xf4f1de, transparent: true, opacity: 0 });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 12), moonMat);
  moon.position.set(-90, 110, -160);
  scene.add(moon);
  // drifting clouds
  const clouds: any[] = [];
  for (let i = 0; i < 6; i++) {
    const cl = new THREE.Group();
    const cm = M(0xffffff, { transparent: true, opacity: 0.85 });
    for (let k = 0; k < 3; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.random() * 2, 10, 8), cm);
      puff.position.set(k * 3.5 - 3.5, Math.random(), Math.random() * 2);
      puff.castShadow = false;
      cl.add(puff);
    }
    cl.position.set((Math.random() - 0.5) * 240, 34 + Math.random() * 10, (Math.random() - 0.5) * 240);
    scene.add(cl);
    clouds.push({ g: cl, sp: 0.6 + Math.random() * 0.8 });
  }
  // fireflies (visible at night around the plaza)
  const flyGeo = new THREE.BufferGeometry();
  const flyPos = new Float32Array(50 * 3);
  for (let i = 0; i < 50; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 16 + Math.random() * 60;
    flyPos[i * 3] = Math.sin(a) * r;
    flyPos[i * 3 + 1] = 1 + Math.random() * 3;
    flyPos[i * 3 + 2] = -Math.cos(a) * r;
  }
  flyGeo.setAttribute("position", new THREE.BufferAttribute(flyPos, 3));
  const flyMat = new THREE.PointsMaterial({
    color: 0xaef29a, size: 0.9, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const flies = new THREE.Points(flyGeo, flyMat);
  scene.add(flies);
  // dimensional-shift particles (purple, visible during Shift)
  const pCount = 100;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount * 3; i++) pPos[i] = (Math.random() - 0.5) * 50;
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xbb66ff, size: 0.28, transparent: true, opacity: 0, depthWrite: false,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* ----- player ----- */
  const P = new THREE.Group();
  P.position.set(0, 0, 10);
  scene.add(P);
  add(new THREE.CylinderGeometry(0.5, 0.55, 1.2, 12), M(0x3d7fd9), 0, 1, 0, P);
  const head = add(new THREE.SphereGeometry(0.45, 14, 10), M(0xf2c9a0), 0, 2.1, 0, P);
  add(new THREE.SphereGeometry(0.47, 14, 8, 0, 6.3, 0, 1.5), M(0x5a3a1a), 0, 2.15, 0, P);
  add(new THREE.CylinderGeometry(0.18, 0.18, 0.8, 8), M(0x2f4f8a), -0.2, 0.4, 0, P);
  add(new THREE.CylinderGeometry(0.18, 0.18, 0.8, 8), M(0x2f4f8a), 0.2, 0.4, 0, P);
  // soft blob shadow
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.8, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  P.add(blob);
  add(new THREE.SphereGeometry(0.12, 8, 6), glow(0x00e5ff, 0.9), 0, 1.4, 0.42, P);
  let yaw = 0, pitch = 0.45, dist = 13, face = 0, vel = 0, bob = 0;

  /* ----- input: keys + tap-to-move + orbit/zoom ----- */
  const keys: Record<string, number> = {};
  on(window, "keydown", (e: KeyboardEvent) => {
    keys[e.key.toLowerCase()] = 1;
    hideHint();
  });
  on(window, "keyup", (e: KeyboardEvent) => {
    keys[e.key.toLowerCase()] = 0;
  });
  const cv = rd.domElement;
  let oid: number | null = null;
  let last: [number, number] | null = null;
  // tap-to-move
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitP = new THREE.Vector3();
  let walkTarget: { x: number; z: number } | null = null;
  let downPos: [number, number] | null = null;
  const targetRingMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const targetRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.1, 24), targetRingMat);
  targetRing.rotation.x = -Math.PI / 2;
  targetRing.position.y = 0.12;
  scene.add(targetRing);
  // autopilot
  let autoPilot = false, autoTarget = -1, autoPause = 0;
  // Doubtlings — King's Emotion Codex as living wisps. Naming a feeling makes it smaller.
  interface Wisp { emo: Emotion; g: any; core: any; halo: any; tx: number; tz: number; whisperCd: number; facedCd: number }
  const wisps: Wisp[] = [];
  let nearWisp = -1;
  function wispColor(w: Wisp) { return new THREE.Color(w.emo.color).getHex(); }
  function spawnWisps() {
    const pool = [...EMOTIONS].sort(() => Math.random() - 0.5);
    for (let i = 0; i < 3; i++) {
      const emo = pool[i % pool.length];
      const g = new THREE.Group();
      const col = new THREE.Color(emo.color).getHex();
      const core = add(new THREE.SphereGeometry(0.5, 14, 10), glow(col, 1.2), 0, 1.6, 0, g);
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 14, 10),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      halo.position.y = 1.6;
      g.add(halo);
      const a = Math.random() * Math.PI * 2, r = 25 + Math.random() * 20;
      g.position.set(Math.sin(a) * r, 0, -Math.cos(a) * r);
      scene.add(g);
      wisps.push({ emo, g, core, halo, tx: g.position.x, tz: g.position.z, whisperCd: 6 + Math.random() * 12, facedCd: 0 });
    }
  }
  // supply caches (salvaged from the 2D city's treasure chests)
  interface Cache { x: number; z: number; g: any; open: boolean; timer: number }
  const caches: Cache[] = [];
  function placeCache(c: Cache) {
    for (let tries = 0; tries < 24; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = 22 + Math.random() * 20;
      const x = Math.sin(a) * r, z = -Math.cos(a) * r;
      if (zones.some((q) => Math.hypot(q.x - x, q.z - z) < 18)) continue;
      c.x = x; c.z = z;
      c.g.position.set(x, 0, z);
      return;
    }
    c.g.position.set(20, 0, 20);
    c.x = 20; c.z = 20;
  }
  function spawnCaches() {
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      add(new THREE.BoxGeometry(1.2, 0.9, 1.2), std(0x152030, { metalness: 0.6, roughness: 0.35 }), 0, 0.45, 0, g);
      add(new THREE.BoxGeometry(1.3, 0.18, 1.3), glow(0xff8ad4, 0.7), 0, 0.95, 0, g);
      add(new THREE.BoxGeometry(0.5, 0.7, 0.08), glow(0xffd36e, 0.6), 0, 0.45, 0.62, g);
      scene.add(g);
      const c: Cache = { x: 0, z: 0, g, open: false, timer: 0 };
      placeCache(c);
      caches.push(c);
    }
  }
  let hintHidden = false;
  const hideHint = () => {
    if (hintHidden) return;
    hintHidden = true;
    const h = $("pp3d-movehint");
    if (h) h.style.opacity = "0";
  };
  on(cv, "pointerdown", (e: PointerEvent) => {
    sfx.unlock();
    hideHint();
    oid = e.pointerId;
    last = [e.clientX, e.clientY];
    downPos = [e.clientX, e.clientY];
  });
  on(cv, "pointermove", (e: PointerEvent) => {
    if (e.pointerId === oid && last) {
      yaw -= (e.clientX - last[0]) * 0.006;
      pitch = Math.max(0.1, Math.min(1.2, pitch + (e.clientY - last[1]) * 0.005));
      last = [e.clientX, e.clientY];
    }
  });
  const oend = (e: PointerEvent) => {
    if (e.pointerId === oid) {
      if (downPos && Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]) < 10 && !autoPilot) {
        // a short tap (not a drag): walk to the tapped ground point
        const rect = cv.getBoundingClientRect();
        (ndc as any).x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        (ndc as any).y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(ndc as any, cam);
        if (raycaster.ray.intersectPlane(groundPlane, hitP)) {
          const r = Math.hypot(hitP.x, hitP.z);
          const cl = r > 145 ? 145 / r : 1;
          walkTarget = { x: hitP.x * cl, z: hitP.z * cl };
          targetRing.position.set(walkTarget.x, 0.12, walkTarget.z);
          targetRingMat.opacity = 0.9;
          sfx.click();
        }
      }
      oid = null;
      last = null;
      downPos = null;
    }
  };
  on(cv, "pointerup", oend);
  on(cv, "pointercancel", oend);
  // pinch zoom
  const pinch = new Map<number, [number, number]>();
  let pinchDist = 0;
  on(cv, "pointerdown", (e: PointerEvent) => {
    pinch.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch.size === 2) {
      const [a, b] = [...pinch.values()];
      pinchDist = Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
  });
  on(cv, "pointermove", (e: PointerEvent) => {
    if (!pinch.has(e.pointerId)) return;
    pinch.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch.size === 2) {
      const [a, b] = [...pinch.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      dist = Math.max(7, Math.min(26, dist - (d - pinchDist) * 0.05));
      pinchDist = d;
    }
  });
  const pinchEnd = (e: PointerEvent) => pinch.delete(e.pointerId);
  on(cv, "pointerup", pinchEnd);
  on(cv, "pointercancel", pinchEnd);
  on(cv, "wheel", (e: WheelEvent) => {
    dist = Math.max(7, Math.min(26, dist + e.deltaY * 0.01));
  }, { passive: true });

  // tilt-to-look (phones with a gyroscope; auto-enables on first reading)
  let tiltOn = false, tiltHas = false, tiltYaw = 0, tiltPitch = 0, tiltYawSm = 0, tiltPitchSm = 0;
  on(window, "deviceorientation", (e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null) return;
    if (!tiltHas) {
      tiltHas = true;
      tiltOn = true;
      drawPanel();
    }
    if (!tiltOn) return;
    const g = Math.max(-45, Math.min(45, e.gamma));
    const b = Math.max(0, Math.min(90, e.beta));
    tiltYaw = ((-g * Math.PI) / 180) * 0.9;
    tiltPitch = (((45 - b) * Math.PI) / 180) * 0.5;
  });

  /* ----- UI ----- */
  const bar = (v: number, c: string) =>
    `<span class="pp3d-bar"><i style="width:${Math.min(v, 10) * 10}%;background:${c}"></i></span>`;
  function drawHud() {
    sizeMonument();
    syncFamily();
    const p = Math.max(0, prosp());
    const tier = [...TIERS].reverse().find((t) => p >= t[0])![1];
    hud.innerHTML =
      `<span class="pp3d-chip">🪙 ${api.getBalance()} Units</span>` +
      `<span class="pp3d-chip">🏙️ ${p} · ${tier}</span>` +
      `<span class="pp3d-chip">🎖️ ${api.getRank()}</span>` +
      `<span class="pp3d-chip">Trust${bar(S.trust, "#4ade80")} Courage${bar(S.courage, "#fb923c")}</span>` +
      `<span class="pp3d-chip">💜 ${S.family}</span>` +
      (shiftActive
        ? `<span class="pp3d-chip" style="border-color:#9b4dff;background:rgba(106,27,154,.8)">🌀 ${Math.ceil(shiftTimer)}s</span>`
        : "") +
      `<button class="pp3d-chip" style="pointer-events:auto;cursor:pointer;border-color:#d4a017" onclick="__pp3d.post()">📰${S.news.length - S.newsSeen > 0 ? ` <b style="color:#ff5252">●${S.news.length - S.newsSeen}</b>` : ""}</button>` +
      (S.daily && !S.daily.done ? `<span class="pp3d-chip" style="border-color:#ffaa00">🎯 ${S.daily.progress}/${S.daily.need}</span>` : "") +
      (S.daily && S.daily.done ? `<span class="pp3d-chip" style="border-color:#00ff9d">✅ Daily done</span>` : "") +
      (autoPilot ? `<span class="pp3d-chip" style="border-color:#00ff9d;background:rgba(0,170,102,.5)">🟢 AUTO</span>` : "");
    if (lastTier && lastTier !== tier) {
      const order = TIERS.map((x) => x[1]);
      if (order.indexOf(tier) > order.indexOf(lastTier)) {
        pushNews("🏙️", `${tier} reached!`, "Your plaza grows with you. Better than yesterday.");
        hooks.serverEvent("🏙️", `${tier} reached!`, "The plaza grows with real effort.");
        say(`🏙️ ${tier}! The whole plaza celebrates.`);
        sfx.reward();
        sfx.buzz([40, 40, 40, 40, 120]);
      }
    }
    lastTier = tier;
    if (DIST.every((_, i) => isOpen(i))) showAch("allOpen");
  }
  let near = -1;
  let nearNpc = -1;
  let nearCache = -1;
  let lastTier = "";
  let msgT = 0;
  function say(t: string) {
    msgBox.textContent = t;
    msgBox.style.display = "block";
    window.clearTimeout(msgT);
    msgT = window.setTimeout(() => {
      msgBox.style.display = "none";
    }, 2800);
  }
  function drawPanel() {
    const b: string[] = [];
    if (near >= 0 && isOpen(near)) {
      b.push(`<button class="pp3d-btn" onclick="__pp3d.quest(${near})">${DIST[near].e} Take quest</button>`);
      b.push(`<button class="pp3d-btn" onclick="__pp3d.chooseBuild(${near})">🏗️ Build${S.freeBuild > 0 ? " (FREE!)" : ""}</button>`);
      if (!shiftActive && S.courage >= SHIFT_COST)
        b.push(`<button class="pp3d-btn" style="background:linear-gradient(135deg,#9b4dff,#6a1b9a)" onclick="__pp3d.doShift(${near})">🌀 Shift</button>`);
    }
    if (nearNpc >= 0)
      b.push(`<button class="pp3d-btn" onclick="__pp3d.talkNpc(${nearNpc})">💬 Talk to ${NPCS[nearNpc].name}</button>`);
    if (nearCache >= 0) b.push(`<button class="pp3d-btn" onclick="__pp3d.openCache(${nearCache})">🎁 Open supply cache</button>`);
    if (nearWisp >= 0) b.push(`<button class="pp3d-btn" onclick="__pp3d.faceWisp(${nearWisp})">\u{1F32B}\uFE0F Face the Doubtling</button>`);
    b.push(`<button class="pp3d-btn alt" onclick="__pp3d.codex()">📖 Codex</button>`);
    b.push(`<button class="pp3d-btn alt" onclick="__pp3d.toggleAuto()">${autoPilot ? "🟢 Auto ON" : "⚪ Autopilot"}</button>`);
    b.push(`<button class="pp3d-btn alt" onclick="__pp3d.realLife()">🌟 Real-life progress</button>`);
    b.push(`<button class="pp3d-btn alt" onclick="__pp3d.mute()">${S.muted ? "🔇 Muted" : "🔊 Sound"}</button>`);
    b.push(`<button class="pp3d-btn alt" onclick="__pp3d.help()">❓</button>`);
    if (tiltHas) b.push(`<button class="pp3d-btn alt" onclick="__pp3d.tilt()">📱 Tilt: ${tiltOn ? "on" : "off"}</button>`);
    panel.innerHTML = b.join("");
  }
  function modal(html: string) {
    $("pp3d-mbox").innerHTML = html;
    $("pp3d-modal").style.display = "flex";
  }

  function runTutorial() {
    if (S.tutorial >= 5) return;
    const steps = [
      { t: "Welcome to Pillar Plaza", d: "A living world that grows when you get better at real life. Tap the ground to walk, or use WASD keys." },
      { t: "Six districts, six values", d: "Walk to a district and take a quest. Good choices grow Trust and heal blight. Say hi to Maya, Jay and Sam!" },
      { t: "Real life powers the plaza", d: "Real chores and saving open Vault Mountain and Market Harbor — and grow Family Bond 💜, which unlocks Pillar powers like free builds." },
      { t: "Name the Doubtlings \u{1F32B}\uFE0F", d: "Glowing wisps drift through the plaza — Doubt, Impulse, Loneliness and their kin. Walk up to one, hear its whisper, then face it with the truth. Naming a feeling makes it smaller. +1 Courage each time." },
      { t: "Tilt, sound and Shift 🌀", d: "Tilt your phone to look around, and listen — water and birds come from their direction. With Courage, Shift into a parallel district for bigger rewards and bigger risk." },
    ];
    const s = steps[S.tutorial];
    modal(
      `<h3>${s.t}</h3><p>${s.d}</p>` +
        `<div style="text-align:center;margin:14px 0">` +
        steps.map((_, k) => `<span class="pp3d-tutdot${k === S.tutorial ? " on" : ""}"></span>`).join("") +
        `</div>` +
        `<button class="pp3d-btn" onclick="__pp3d.nextTut()">${S.tutorial < 4 ? "Next" : "Start exploring!"}</button>`,
    );
  }
  const closeM = () => {
    $("pp3d-modal").style.display = "none";
  };


  window.__pp3d = {
    quest(i: number) {
      sfx.click();
      sfx.buzz(15);
      const parallel = shiftActive && shiftDistrict === i;
      const q = parallel ? DIST[i].pq : DIST[i].qs[Math.floor(Math.random() * DIST[i].qs.length)];
      const o: [string, number][] = [[q.g, 1], [q.b, 0]];
      if (Math.random() < 0.5) o.reverse();
      modal(
        `<h3>${DIST[i].e} ${DIST[i].n}${parallel ? " 🌀 Parallel" : ""}</h3><p>${q.t}</p>` +
          o.map(([t, g]) => `<button class="pp3d-btn" onclick="__pp3d.ans(${i},${g})">${t}</button>`).join("") +
          `<button class="pp3d-btn alt" onclick="__pp3d.close()">Not now</button>`,
      );
    },
    async ans(i: number, g: number, npc?: number) {
      if (typeof npc === "number" && NPCS[npc]) { S.npcMem[NPCS[npc].name] = g ? "good" : "bad"; }
      const parallel = shiftActive && shiftDistrict === i;
      S.courage++;
      if (g) {
        S.trust++;
        S.blight[i] = Math.max(0, S.blight[i] - 1);
        sfx.good();
        sfx.buzz([25, 40, 25, 40, 80]);
        let extra = "";
        {
          const rw = parallel ? 8 : 5;
          const ok = await api.earn(rw, `Pillar Plaza good deed${parallel ? " (parallel)" : ""}`, { key: "good-deed", limit: 3 });
          if (ok) {
            extra = `<p>✨ +${rw} real Units for a good deed.</p>`;
            sfx.reward();
            sfx.buzz([25, 40, 25, 40, 120]);
            floatText(`+${rw} Units`, "#00ff9d");
          } else {
            extra = `<p>🌙 Today's good-deed rewards are already claimed — come back tomorrow!</p>`;
          }
        }
        modal(
          `<h3>Trust grows 🌱</h3><p>Good choice${parallel ? " — parallel bonus" : ""}. The district brightens.</p>${extra}` +
            `<button class="pp3d-btn" onclick="__pp3d.close()">Continue</button>`,
        );
        showAch("firstQuest");
        dailyTick("quests");
        if (S.trust >= 5) showAch("trust5");
        if (S.blight[i] === 0) showAch("blightFree");
      } else {
        S.blight[i] = Math.min(4, S.blight[i] + (parallel ? 2 : 1));
        sfx.bad();
        sfx.buzz(150);
        modal(
          `<h3>Blight spreads 🥀</h3><p>The district dims a little${parallel ? " — the parallel realm is riskier" : ""}. Take another quest to heal it.</p>` +
            `<button class="pp3d-btn" onclick="__pp3d.close()">Continue</button>`,
        );
      }
      save();
      rebuild();
      drawHud();
    },
    chooseBuild(i: number) {
      sfx.click();
      const id = DIST_IDS[i];
      if ((S.built[i] || []).length >= 8) {
        sfx.locked();
        return say("This district is full!");
      }
      modal(
        `<h3>🏗️ Build in ${DIST[i].n}</h3><p>Choose a structure.${S.freeBuild > 0 ? " 💜 You have a FREE build!" : ""}</p>` +
          STRUCTURES[id].map(
            (s, t) =>
              `<button class="pp3d-btn" onclick="__pp3d.build(${i},${t})">${s.icon} ${s.name} — ${S.freeBuild > 0 ? "FREE" : `${s.cost} Units`} <span style="opacity:.7">(+${s.prosperity})</span></button>`,
          ).join("") +
          `<button class="pp3d-btn alt" onclick="__pp3d.close()">Cancel</button>`,
      );
    },
    build(i: number, t: number) {
      const def = STRUCTURES[DIST_IDS[i]][t];
      if (!def) return;
      if ((S.built[i] || []).length >= 8) {
        sfx.locked();
        return say("This district is full!");
      }
      const cost = S.freeBuild > 0 ? 0 : def.cost;
      if (cost > 0 && !api.spend(cost, `Built ${def.name} in ${DIST[i].n} (3D plaza)`)) {
        sfx.locked();
        return say(`Need ${def.cost} Units to build. Earn them through chores and good decisions!`);
      }
      if (cost === 0 && S.freeBuild > 0) S.freeBuild--;
      S.built[i].push(t);
      sfx.build();
      sfx.buzz([40, 60, 90]);
      save();
      rebuild();
      drawHud();
      drawPanel();
      say(cost === 0 ? "💜 Pillar power used: free build! ✨" : `${def.icon} ${def.name} rises! Prosperity grows ✨`);
      floatText(cost === 0 ? "FREE Build!" : "Built!", "#00e5ff");
      pushNews(def.icon, `${def.name} rises in ${DIST[i].n}`, `Prosperity +${def.prosperity}.`);
      showAch("firstBuild");
      dailyTick("builds");
      if (S.built[i].length >= 8) showAch("fullDistrict");
    },
    talkNpc(k: number) {
      const npc = NPCS[k];
      if (!npc) return;
      sfx.click();
      sfx.buzz(15);
      dailyTick("talks");
      floatText(`${npc.icon} ${npc.name}!`, "#7b2fff");
      const q = npc.qs[Math.floor(Math.random() * npc.qs.length)];
      const mem = S.npcMem[npc.name];
      const memLine = mem && NPC_MEMORY[npc.name]
        ? `<p style="opacity:.8"><i>${NPC_MEMORY[npc.name][mem]}</i></p>`
        : "";
      const o: [string, number][] = [[q.g, 1], [q.b, 0]];
      if (Math.random() < 0.5) o.reverse();
      modal(
        `<h3>${npc.icon} ${npc.name}</h3>` + memLine + `<p>${q.t}</p>` +
          o.map(([t, g]) => `<button class="pp3d-btn" onclick="__pp3d.ans(${npc.district},${g},${k})">${t}</button>`).join("") +
          `<button class="pp3d-btn alt" onclick="__pp3d.close()">Bye!</button>`,
      );
    },
    async openCache(ci: number) {
      const c = caches[ci];
      if (!c || c.open) return;
      c.open = true; c.g.visible = false; c.timer = 120;
      const roll = Math.random();
      sfx.reward();
      sfx.buzz([30, 50, 90]);
      if (roll < 0.45) {
        const rw = 2 + Math.floor(Math.random() * 3);
        const ok = await api.earn(rw, "Pillar Plaza supply cache", { key: "cache", limit: 3 });
        if (ok) {
          floatText(`+${rw} Units`, "#00ff9d");
          say(`🎁 Cache opened! +${rw} real Units.`);
          pushNews("🎁", "Supply cache found!", `+${rw} Units discovered in the plaza.`);
        } else {
          say("🎁 The cache is empty — today's cache rewards are already claimed.");
        }
      } else if (roll < 0.75) {
        S.courage++;
        floatText("+1 Courage", "#ffaa00");
        say("🎁 Cache opened! +1 Courage.");
      } else {
        const q = WISDOM[Math.floor(Math.random() * WISDOM.length)];
        floatText("💎 Wisdom", "#e879f9");
        modal(`<h3>🎁 Ancient wisdom</h3><p><i>"${q}"</i></p><button class="pp3d-btn alt" onclick="__pp3d.close()">Pocket it</button>`);
      }
      save();
      drawHud();
      drawPanel();
    },
    faceWisp(k: number) {
      const w = wisps[k];
      if (!w || w.facedCd > 0) return;
      sfx.click();
      sfx.buzz(15);
      modal(
        `<h3>\u{1F32B}\uFE0F ${w.emo.icon} ${w.emo.name} <span style="opacity:.55;font-size:12px">· ${w.emo.family}</span></h3>` +
          `<p><i>"${w.emo.whisper}"</i></p>` +
          `<p>But the truth is: <b>${w.emo.truth}</b></p>` +
          `<button class="pp3d-btn" onclick="__pp3d.faceTruth(${k})">\u{1F49B} Believe the truth</button>` +
          `<button class="pp3d-btn alt" onclick="__pp3d.close()">Walk away</button>`,
      );
    },
    faceTruth(k: number) {
      const w = wisps[k];
      if (!w) return;
      const faced = w.emo;
      S.doubts[faced.id] = (S.doubts[faced.id] || 0) + 1;
      S.courage++;
      w.facedCd = 60;
      w.whisperCd = 20;
      const rest = EMOTIONS.filter((e) => e.id !== faced.id);
      const ne = rest[Math.floor(Math.random() * rest.length)];
      w.emo = ne;
      const col = new THREE.Color(ne.color).getHex();
      (w.core.material as any).color.setHex(col);
      (w.core.material as any).emissive.setHex(col);
      (w.halo.material as any).color.setHex(col);
      closeM();
      sfx.good();
      sfx.buzz([40, 40, 120]);
      floatText(`${faced.icon} Faced!`, "#ffd36e");
      say(`\u{1F49B} You named it: ${faced.name}. Feelings get smaller when you name them. +1 Courage.`);
      dailyTick("face");
      showAch("doubt1");
      save();
      drawHud();
      drawPanel();
    },
    codex() {
      sfx.click();
      const discovered = EMOTIONS.filter((e) => (S.doubts[e.id] || 0) > 0).length;
      modal(
        `<h3>📖 Emotion Codex</h3>` +
          `<p style="opacity:.8">${discovered} of ${EMOTIONS.length} named. Every feeling has a name — naming it makes it smaller.</p>` +
          EMOTIONS.map((e) => {
            const n = S.doubts[e.id] || 0;
            return n > 0
              ? `<div class="pp3d-stat"><span style="color:${e.color}">${e.icon} <b>${e.name}</b></span> <span style="opacity:.55">· ${e.family} · faced ${n}×</span><br><span style="font-size:12px;opacity:.75"><i>"${e.whisper}"</i> → ${e.truth}</span></div>`
              : `<div class="pp3d-stat" style="opacity:.45">\u{1F32B}\uFE0F <b>???</b> <span style="opacity:.6">· a Doubtling drifts in the plaza...</span></div>`;
          }).join("") +
          `<button class="pp3d-btn alt" onclick="__pp3d.close()">Close</button>`,
      );
    },
    useCleanse() {
      if (!S.powerCleanse) return;
      S.powerCleanse = false;
      S.blight = [0, 0, 0, 0, 0, 0];
      closeM();
      save(); rebuild(); drawHud(); drawPanel();
      sfx.good();
      sfx.buzz([60, 60, 120]);
      floatText("Blight Cleansed!", "#4ade80");
      say("\u{1F6E1}\uFE0F Blight Cleansing! Every district shines again.");
      pushNews("\u{1F6E1}\uFE0F", "Blight Cleansing!", "A Family Bond power washed every district clean.");
    },
    useAscend() {
      if (!S.powerAscend) return;
      S.powerAscend = false;
      S.blight = [0, 0, 0, 0, 0, 0];
      S.trust += 3;
      S.courage += 3;
      closeM();
      save(); rebuild(); drawHud(); drawPanel();
      sfx.ach();
      sfx.buzz([60, 60, 60, 60, 200]);
      floatText("\u{1F31F} ASCENDANT!", "#ffd36e");
      say("\u{1F31F} Pillar Ascendant! +3 Trust, +3 Courage, blight gone.");
      pushNews("\u{1F31F}", "Pillar Ascendant!", "+3 Trust, +3 Courage — the plaza glows gold.");
    },
    mute() {
      S.muted = !S.muted;
      sfx.setMuted(S.muted);
      save();
      drawPanel();
      say(S.muted ? "🔇 Sound and vibration off." : "🔊 Sound on.");
    },
    help() {
      sfx.click();
      modal(
        `<h3>❓ Plaza Guide</h3>` +
          `<div class="pp3d-stat">🚶 <b>Move:</b> tap the ground to walk, or WASD / arrow keys. Drag to look, pinch or wheel to zoom.</div>` +
          `<div class="pp3d-stat">🏙️ <b>Districts:</b> take quests, build structures with real Units. Good choices heal blight.</div>` +
          `<div class="pp3d-stat">\u{1F32B}\uFE0F <b>Doubtlings:</b> face glowing wisps with the truth (+1 Courage). Open the 📖 Codex.</div>` +
          `<div class="pp3d-stat">🎁 <b>Caches:</b> open supply caches for Units, Courage, or wisdom.</div>` +
          `<div class="pp3d-stat">🌀 <b>Shift:</b> 1 Courage for 45s in a parallel district — bigger rewards, bigger risk.</div>` +
          `<div class="pp3d-stat">💜 <b>Family Bond:</b> grows from real chores + saving. Powers at 15 / 30 / 50.</div>` +
          `<div class="pp3d-stat">🎯 <b>Daily:</b> one challenge a day pays +15 real Units.</div>` +
          `<button class="pp3d-btn" onclick="__pp3d.replayTut()">▶️ Replay tutorial</button>` +
          `<button class="pp3d-btn alt" onclick="__pp3d.close()">Close</button>`,
      );
    },
    replayTut() {
      S.tutorial = 0;
      save();
      closeM();
      setTimeout(runTutorial, 300);
    },
    post() {
      sfx.click();
      S.newsSeen = S.news.length;
      save();
      drawHud();
      modal(
        `<h3>📰 The Pillar Post</h3>` +
          (S.news.length
            ? S.news.map((x) => `<div class="pp3d-stat">${x.icon} <b>${x.headline}</b><br><span style="font-weight:400;opacity:.75">${x.detail}</span></div>`).join("")
            : `<p>Nothing yet. Go build something worth reporting!</p>`) +
          `<button class="pp3d-btn alt" onclick="__pp3d.close()">Close</button>`,
      );
    },
    doShift(i: number) {
      if (shiftActive || S.courage < SHIFT_COST) return;
      S.courage -= SHIFT_COST;
      shiftActive = true;
      shiftTimer = SHIFT_DUR;
      shiftDistrict = i;
      dimfx.classList.add("on");
      pMat.opacity = 0.65;
      sfx.shift();
      sfx.buzz([50, 50, 50, 50, 100]);
      showAch("shift1");
      dailyTick("shifts");
      pushNews("🌀", "Dimensional Shift!", `Entered the parallel ${DIST[i].n} for ${SHIFT_DUR} seconds.`);
      say(`🌀 Entered parallel ${DIST[i].n}! Higher rewards, higher risk.`);
      save();
      drawHud();
      drawPanel();
    },
    nextTut() {
      S.tutorial++;
      save();
      closeM();
      if (S.tutorial < 5) setTimeout(runTutorial, 380);
    },
    toggleAuto() {
      autoPilot = !autoPilot;
      sfx.click();
      if (autoPilot) {
        walkTarget = null;
        let best = -1, bestD = 1e9;
        zones.forEach((z, i) => {
          if (!isOpen(i)) return;
          const d = Math.hypot(P.position.x - z.x, P.position.z - z.z);
          if (d < bestD) { bestD = d; best = i; }
        });
        autoTarget = best >= 0 ? best : 0;
        autoPause = 0;
        say("🟢 Autopilot on — walking to " + DIST[autoTarget].n);
      } else {
        say("Autopilot off.");
      }
      drawPanel();
      drawHud();
    },
    realLife() {
      sfx.click();
      const chores = api.getChores();
      const saved = api.getSaved();
      modal(
        `<h3>🌟 Real life powers the plaza</h3>` +
          `<p>Vault Mountain and Market Harbor open through real effort — confirmed by your grown-up in the app.</p>` +
          `<div class="pp3d-stat">🍽️ Chores done: ${chores} / 3<div class="pp3d-track"><i style="width:${Math.min(100, (chores / 3) * 100)}%"></i></div></div>` +
          `<div class="pp3d-stat">🐷 Units saved: ${saved} / 50<div class="pp3d-track"><i style="width:${Math.min(100, (saved / 50) * 100)}%"></i></div></div>` +
          `<button class="pp3d-btn" onclick="__pp3d.go('chores')">Do chores →</button>` +
          `<button class="pp3d-btn" onclick="__pp3d.go('vault')">Grow savings →</button>` +
          `<div class="pp3d-stat">💜 <b>Pillar Powers</b> <span style="opacity:.6">(Bond ${S.family})</span></div>` +
          `<div class="pp3d-stat">${S.freeBuild > 0 ? "✅" : S.family >= 15 ? "✅" : "🔒"} <b>Free build</b> — Bond 15${S.freeBuild > 0 ? "<br><span style='opacity:.7'>Ready! Tap 🏗️ Build on any structure.</span>" : ""}</div>` +
          `<div class="pp3d-stat">${S.powerCleanse ? "🛡️" : "🔒"} <b>Blight Cleansing</b> — Bond 30${S.powerCleanse ? `<button class="pp3d-btn" onclick="__pp3d.useCleanse()">Cleanse now</button>` : "<br><span style='opacity:.6'>Washes every district clean.</span>"}</div>` +
          `<div class="pp3d-stat">${S.powerAscend ? "🌟" : "🔒"} <b>Pillar Ascendant</b> — Bond 50${S.powerAscend ? `<button class="pp3d-btn" onclick="__pp3d.useAscend()">Ascend now</button>` : "<br><span style='opacity:.6'>+3 Trust, +3 Courage, blight gone.</span>"}</div>` +
          `<button class="pp3d-btn alt" onclick="__pp3d.close()">Back to the plaza</button>`,
      );
    },
    go(screen: string) {
      closeM();
      api.go(screen);
    },
    tilt() {
      tiltOn = !tiltOn;
      sfx.click();
      sfx.buzz(20);
      drawPanel();
      say(tiltOn ? "📱 Tilt-look on — tip your phone to look around." : "📱 Tilt-look off.");
    },
    close: closeM,
  };

  /* ----- resize + main loop ----- */
  function resize() {
    const w = wrap.clientWidth || window.innerWidth;
    const h = wrap.clientHeight || window.innerHeight;
    rd.setSize(w, h);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }
  on(window, "resize", resize);
  resize();

  const skyDay = new THREE.Color(0x16245e);
  const skyDusk = new THREE.Color(0x6a3aa0);
  const skyNight = new THREE.Color(0x05051a);
  const tmpC = new THREE.Color();
  let T = 0.25;
  const clock = new THREE.Clock();
  const fv = new THREE.Vector3();
  let raf = 0;
  let frame = 0;
  let birdT = 3;
  let lastGateBuzz = -10;

  function loop() {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    T = (T + dt / 150) % 1;
    const ang = T * Math.PI * 2;
    const h = Math.sin(ang); // >0 day
    const night = h > 0 ? 0 : Math.min(1, -h * 3);
    const dusk = 1 - Math.min(1, Math.abs(h) * 4);

    sun.position.set(Math.cos(ang) * 100, Math.max(h, 0.05) * 100 + 10, 40);
    sun.target.position.copy(P.position);
    fv.copy(P.position);
    sun.position.add(fv);
    sun.intensity = Math.max(0, h) * 1.1;
    hemi.intensity = 0.25 + Math.max(0, h) * 0.6;
    tmpC.copy(h > 0 ? skyDay : skyNight).lerp(skyDusk, dusk * 0.8);
    bgColor.copy(tmpC);
    (scene.fog as any).color.copy(tmpC);

    // night dressing
    starMat.opacity = night;
    moonMat.opacity = night * 0.95;
    flyMat.opacity = night * (0.55 + 0.35 * Math.sin(t * 3));
    slots.forEach((s) => s.windows.forEach((w: any) => (w.opacity = night * 0.95)));
    (ringMat as any).emissiveIntensity = 0.65 + 0.25 * Math.sin(t * 2);
    if (rankCeremonyPending && ($("pp3d-modal") as HTMLElement | null)?.style.display !== "flex") {
      rankCeremonyPending = false;
      showRankCeremony();
    }
    targetRingMat.opacity = Math.max(0, targetRingMat.opacity - dt * 1.1);
    const trs = 1 + Math.sin(t * 6) * 0.08;
    targetRing.scale.set(trs, trs, 1);
    holoRings.forEach((hr, ri) => { hr.rotation.z += dt * (0.2 + ri * 0.12); });
    waterMats.forEach((m: any, i: number) => {
      m.opacity = 0.82 + 0.1 * Math.sin(t * 2 + i * 2);
    });
    // clouds drift
    clouds.forEach((c: any) => {
      c.g.position.x += c.sp * dt;
      if (c.g.position.x > 140) c.g.position.x = -140;
    });

    // movement
    const ix =
      (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    const iz =
      (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    const l = Math.hypot(ix, iz);
    let nx = ix, nz = iz;
    if (l > 1) {
      nx /= l;
      nz /= l;
    }
    if (autoPilot) {
      // guided tour: walks between open districts, pausing at each
      if (autoPause > 0) {
        autoPause -= dt;
        vel = 0;
      } else {
        const z = zones[autoTarget];
        const dx = z.x - P.position.x, dz = z.z - P.position.z;
        const dd = Math.hypot(dx, dz);
        if (dd < GATE + 1) {
          autoPause = 2.5;
          let next = (autoTarget + 1) % 6;
          for (let k = 0; k < 6; k++) { if (isOpen(next)) break; next = (next + 1) % 6; }
          autoTarget = next;
          say("Arrived. Next: " + DIST[autoTarget].e + " " + DIST[autoTarget].n);
        } else {
          const sp = 8;
          P.position.x += (dx / dd) * sp * dt;
          P.position.z += (dz / dd) * sp * dt;
          const tf = Math.atan2(dx, dz);
          let df = tf - face;
          df = Math.atan2(Math.sin(df), Math.cos(df));
          face += df * Math.min(1, dt * 10);
          bob += dt * sp * 1.2;
          vel = 1;
        }
      }
    } else if (walkTarget && l <= 0.08) {
      // tap-to-move
      const dx = walkTarget.x - P.position.x, dz = walkTarget.z - P.position.z;
      const dd = Math.hypot(dx, dz);
      if (dd < 0.8) {
        walkTarget = null;
        vel = 0;
      } else {
        const sp = 9;
        P.position.x += (dx / dd) * sp * dt;
        P.position.z += (dz / dd) * sp * dt;
        const tf = Math.atan2(dx, dz);
        let df = tf - face;
        df = Math.atan2(Math.sin(df), Math.cos(df));
        face += df * Math.min(1, dt * 11);
        bob += dt * sp * 1.3;
        vel = 1;
      }
    } else if (l > 0.08) {
      if (autoPilot) { autoPilot = false; drawPanel(); drawHud(); }
      walkTarget = null;
      const sp = 9 * Math.min(1, l);
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const mx = nx * c + nz * s;
      const mz = -nx * s + nz * c;
      P.position.x += mx * sp * dt;
      P.position.z += mz * sp * dt;
      const tf = Math.atan2(mx, mz);
      let df = tf - face;
      df = Math.atan2(Math.sin(df), Math.cos(df));
      face += df * Math.min(1, dt * 12);
      bob += dt * sp * 1.4;
      vel = 1;
    } else {
      vel = 0;
    }
    // keep the kid inside the world
    const pr = Math.hypot(P.position.x, P.position.z);
    if (pr > 150) {
      P.position.x *= 150 / pr;
      P.position.z *= 150 / pr;
    }
    P.rotation.y = face;
    head.position.y = 2.1 + Math.sin(bob) * 0.05 * vel;
    npcGroups.forEach((gr, gi) => {
      gr.position.y = Math.sin(t * 2 + gi * 2.1) * 0.08;
    });
    caches.forEach((c) => {
      if (c.open) {
        c.timer -= dt;
        if (c.timer <= 0) { placeCache(c); c.open = false; c.g.visible = true; }
      } else {
        c.g.position.y = Math.sin(t * 2.4 + c.x) * 0.15;
        c.g.rotation.y += dt * 0.6;
      }
    });
    // Doubtling wisps drift, whisper, and shrink when faced with the truth
    let nw = -1;
    wisps.forEach((w, wi) => {
      const dx = w.tx - w.g.position.x, dz = w.tz - w.g.position.z;
      const dd = Math.hypot(dx, dz);
      if (dd < 1.5) {
        const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 45;
        w.tx = Math.sin(a) * r; w.tz = -Math.cos(a) * r;
      } else {
        const sp = 1.6;
        w.g.position.x += (dx / dd) * sp * dt;
        w.g.position.z += (dz / dd) * sp * dt;
      }
      w.g.position.y = Math.sin(t * 2 + wi * 2.4) * 0.25;
      w.facedCd = Math.max(0, w.facedCd - dt);
      const sc = w.facedCd > 0 ? 0.35 : 1;
      w.g.scale.set(sc, sc, sc);
      w.halo.rotation.y += dt * 0.8;
      w.whisperCd -= dt;
      const dk = Math.hypot(P.position.x - w.g.position.x, P.position.z - w.g.position.z);
      if (dk < 8 && w.facedCd <= 0) {
        if (nw < 0) nw = wi;
        if (w.whisperCd <= 0) {
          w.whisperCd = 30;
          sfx.whisper();
          say(`\u{1F32B}\uFE0F ${w.emo.icon} ${w.emo.name} whispers: "${w.emo.whisper}"`);
        }
      }
    });
    if (nw !== nearWisp) {
      nearWisp = nw;
      drawPanel();
      if (nw >= 0) { sfx.click(); say(`\u{1F32B}\uFE0F A Doubtling drifts near... tap \u{1F32B}\uFE0F to face it.`); }
    }

    // district proximity + locked gates push the player out
    let n = -1;
    let nc = -1;
    caches.forEach((c, ci) => {
      if (!c.open && Math.hypot(P.position.x - c.x, P.position.z - c.z) < 4 && nc < 0) nc = ci;
    });
    if (nc !== nearCache) {
      nearCache = nc;
      drawPanel();
      if (nc >= 0) { sfx.click(); say("🎁 A supply cache! Tap to open it."); }
    }
    zones.forEach((z, i) => {
      const dx = P.position.x - z.x;
      const dz = P.position.z - z.z;
      const d = Math.hypot(dx, dz);
      if (d < GATE + 3 && n < 0) n = i;
      if (!isOpen(i) && d < 12 && d > 0.001) {
        P.position.x = z.x + (dx / d) * 12;
        P.position.z = z.z + (dz / d) * 12;
        sfx.locked();
        if (t - lastGateBuzz > 1.6) {
          lastGateBuzz = t;
          sfx.buzz([70, 50, 70]);
        }
        say("🔒 " + DIST[i].gate);
      }
    });
    if (n !== near) {
      near = n;
      drawPanel();
      if (n >= 0 && isOpen(n)) {
        sfx.click();
        say(`${DIST[n].e} ${DIST[n].n} — ${DIST[n].v}`);
      }
    }

    // NPC proximity
    let nn = -1;
    NPCS.forEach((npc, k) => {
      const wx = zones[npc.district].x + npc.x;
      const wz = zones[npc.district].z + npc.z;
      if (Math.hypot(P.position.x - wx, P.position.z - wz) < 5.5) nn = k;
    });
    if (nn !== nearNpc) {
      nearNpc = nn;
      drawPanel();
      if (nn >= 0) {
        sfx.click();
        say(`${NPCS[nn].icon} ${NPCS[nn].name} — tap 💬 to talk.`);
      }
    }

    // dimensional shift: timer, particles, screen fx
    if (shiftActive) {
      shiftTimer -= dt;
      if (shiftTimer <= 0) {
        shiftActive = false;
        shiftDistrict = -1;
        dimfx.classList.remove("on");
        pMat.opacity = 0;
        say("The parallel realm closes.");
        drawHud();
        drawPanel();
      } else {
        const pos = pGeo.attributes.position.array as Float32Array;
        const pt = performance.now() * 0.001;
        for (let k = 0; k < pCount; k++) {
          const k3 = k * 3;
          pos[k3] += Math.sin(pt + k) * 0.025;
          pos[k3 + 1] += 0.012;
          pos[k3 + 2] += Math.cos(pt + k) * 0.025;
          if (pos[k3 + 1] > 22) pos[k3 + 1] = -6;
        }
        pGeo.attributes.position.needsUpdate = true;
        particles.position.copy(P.position);
        if ((frame & 15) === 0) drawHud();
      }
    }

    // orb pulse — brighter with Family Bond
    const famBoost = Math.min(S.family / 50, 1);
    orbMat.emissiveIntensity = 0.7 + famBoost * 0.6 + Math.sin(t * 2.8) * (0.25 + famBoost * 0.25);
    (orbCore.material as any).emissiveIntensity = 1.2 + famBoost * 0.8 + Math.sin(t * 4) * 0.4;
    orbLight.intensity = 1.0 + famBoost * 0.7 + Math.max(0, -h) * 0.5;

    // positional ambience + daytime birds (throttled)
    if ((frame++ & 7) === 0) sfx.updateAmbience(P.position.x, P.position.z, yaw, h > 0 ? 1 : 0.15);
    birdT -= dt;
    if (birdT <= 0) {
      birdT = 4 + Math.random() * 6;
      if (h > 0.2) sfx.bird(Math.random() * 2 - 1);
    }

    // follow camera (blended with tilt-look when enabled)
    tiltYawSm += (tiltYaw - tiltYawSm) * Math.min(1, dt * 3);
    tiltPitchSm += (tiltPitch - tiltPitchSm) * Math.min(1, dt * 3);
    const ey = yaw + (tiltOn ? tiltYawSm : 0);
    const ep = Math.max(0.1, Math.min(1.2, pitch + (tiltOn ? tiltPitchSm : 0)));
    const tx = P.position.x, ty = 2, tz = P.position.z;
    cam.position.set(
      tx + Math.sin(ey) * Math.cos(ep) * dist,
      ty + Math.sin(ep) * dist,
      tz + Math.cos(ey) * Math.cos(ep) * dist,
    );
    cam.lookAt(tx, ty, tz);
    cam.rotation.z = shiftActive ? Math.sin(performance.now() * 0.0018) * 0.07 : 0;
    rd.render(scene, cam);
  }

  ensureDaily();
  spawnCaches();
  spawnWisps();
  rebuild();
  drawHud();
  drawPanel();
  loop();
  setTimeout(() => say("👋 Welcome to Pillar Plaza! Walk to a district. 📱 Tilt your phone to look around."), 600);
  setTimeout(() => {
    if (S.tutorial < 5) runTutorial();
  }, 1100);

  return () => {
    cancelAnimationFrame(raf);
    cleanups.forEach((fn) => fn());
    sfx.stopAmbience();
    if (window.__pp3d) delete window.__pp3d;
    try {
      rd.dispose();
    } catch {
      /* noop */
    }
    root.removeChild(wrap);
  };
}

/* ---------------- React wrapper ---------------- */
export function PillarPlaza3D({ onExit }: { onExit: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let cancelled = false;
    // --- Plaza server link: the game and the app work as one. ---
    // When the parent session is available, Unit movements are gated by
    // Postgres (tamper-proof daily caps, full audit trail) and progress is
    // cloud-saved. Offline or unauthenticated, the plaza falls back to the
    // local ledger with local caps — play never breaks.
    let serverChildId: number | null = null;
    const serverEvent = (icon: string, headline: string, detail: string) => {
      if (serverChildId == null) return;
      logPlazaEvent({ data: { childId: serverChildId, icon, headline, detail } }).catch(() => {});
    };
    const queueCloudSave = (() => {
      let t: ReturnType<typeof setTimeout> | null = null;
      return () => {
        if (serverChildId == null) return;
        if (t) clearTimeout(t);
        t = setTimeout(() => {
          try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (raw && serverChildId != null)
              plazaSaveGame({ data: { childId: serverChildId, saveJson: raw } }).catch(() => {});
          } catch {
            /* noop */
          }
        }, 3000);
      };
    })();
    const api: PlazaApi = {
      getBalance: () => useLedger.getState().balance,
      spend: (n, note) => {
        const ok = !useLedger.getState().debitUnits(n, note);
        if (ok && serverChildId != null) {
          plazaSpend({ data: { childId: serverChildId, amount: Math.max(1, Math.floor(n)), note } }).catch(() => {});
        }
        return ok;
      },
      earn: async (n, note, cap) => {
        const amt = Math.max(1, Math.floor(n));
        if (serverChildId != null) {
          try {
            const r = await plazaEarn({
              data: { childId: serverChildId, amount: amt, note, capKey: cap?.key, capLimit: cap?.limit },
            });
            if (r.ok) {
              useLedger.getState().creditUnits(amt, note);
              return true;
            }
            return false; // server-enforced cap hit
          } catch {
            /* fall through to local */
          }
        }
        if (cap && !localCapConsume(cap.key, cap.limit)) return false;
        useLedger.getState().creditUnits(amt, note);
        return true;
      },
      getSaved: () => useLedger.getState().vault,
      getChores: () => useLedger.getState().completedChoreIds.length,
      getRank: () => {
        const s = useLedger.getState();
        const vaultPct = s.vaultTarget > 0 ? Math.min(1, s.vault / s.vaultTarget) : 0;
        const { rank } = rankForScore(
          societyScore({ choresDone: s.completedChoreIds.length, vaultPct, studioPct: 0 }),
        );
        return rank.name;
      },
      go: (screen) => {
        useLedger.getState().setScreen(screen as any);
      },
    };
    (async () => {
      // Server sync BEFORE the plaza reads its save: the newer of
      // cloud/local wins, so progress follows the kid across devices.
      try {
        const d = await getPillarpathData();
        const child = d.children[0];
        if (child) {
          serverChildId = child.id;
          const st = await getPlazaServerState({ data: { childId: child.id } });
          const localRaw = localStorage.getItem(SAVE_KEY);
          let localTs = 0;
          try {
            localTs = JSON.parse(localRaw || "{}").savedAt || 0;
          } catch {
            /* noop */
          }
          const serverTs = st.saveUpdatedAt ? new Date(st.saveUpdatedAt).getTime() : 0;
          if (st.saveJson) {
            if (!localRaw || serverTs > localTs) {
              localStorage.setItem(SAVE_KEY, st.saveJson);
            } else if (localTs > serverTs) {
              plazaSaveGame({ data: { childId: child.id, saveJson: localRaw as string } }).catch(() => {});
            }
          } else if (localRaw) {
            plazaSaveGame({ data: { childId: child.id, saveJson: localRaw } }).catch(() => {});
          }
        }
      } catch {
        /* local-only mode: play never breaks */
      }
      if (cancelled) return;
      try {
        const THREE = await loadThree();
        if (cancelled || !rootRef.current) return;
        cleanup = startPlaza(rootRef.current, THREE, api, { queueCloudSave, serverEvent });
        setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setErrMsg(e instanceof Error ? e.message : String(e));
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, []);

  return (
    <div className="absolute inset-0 z-40 overflow-hidden bg-[#0b0620]">
      <div ref={rootRef} className="absolute inset-0" />
      {status === "loading" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#0b0620]">
          <div className="text-5xl">🏙️</div>
          <p className="text-sm font-bold text-violet-200">Entering Pillar Plaza…</p>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-500" />
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#0b0620] p-6 text-center">
          <div className="text-5xl">🌧️</div>
          <p className="text-sm font-bold text-white">The plaza could not open.</p>
          <p className="text-xs text-white/60">{errMsg}</p>
          <button
            onClick={onExit}
            className="rounded-2xl bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-extrabold text-white"
          >
            Back to the city
          </button>
        </div>
      )}
      {status === "ready" && (
        <button
          onClick={onExit}
          className="absolute right-3 z-20 rounded-full border border-violet-400/40 bg-[#0f0a28]/80 px-4 py-2 text-sm font-extrabold text-violet-100 shadow-lg backdrop-blur-sm"
          style={{ top: "calc(env(safe-area-inset-top,0px) + 52px)" }}
        >
          ‹ Home
        </button>
      )}
    </div>
  );
}
