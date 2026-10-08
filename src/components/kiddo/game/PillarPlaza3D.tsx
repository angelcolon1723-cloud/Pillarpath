import { useEffect, useRef, useState } from "react";
import { useLedger } from "@/store/ledger";
import { rankForScore, societyScore } from "@/components/kiddo/world/WorldMap";

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
  earn: (n: number, note: string) => void;
  getSaved: () => number;
  getChores: () => number;
  getRank: () => string;
  go: (screen: string) => void;
}

/* ---------------- Tiny WebAudio SFX (no assets, mobile-safe) ---------------- */
function makeSfx() {
  let ctx: AudioContext | null = null;
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
  return {
    unlock() {
      ac();
    },
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
    locked() {
      tone(220, 0, 0.1, "square", 0.07);
      tone(175, 0.11, 0.14, "square", 0.07);
    },
    reward() {
      [880, 1174, 1568].forEach((f, i) => tone(f, i * 0.07, 0.2, "triangle", 0.09));
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
}
const DIST: District[] = [
  {
    n: "Chore Village", e: "🏠", v: "work ethic", c: 0xe9a56b,
    qs: [
      { t: "Your neighbour is sick and her garden is full of weeds. You have free time.", g: "Help weed the garden before playing.", b: "Skip it. Not your problem." },
      { t: "You promised to take out the trash, but your show is starting.", g: "Pause the show — a promise is a promise.", b: "Somebody else will do it." },
    ],
  },
  {
    n: "Vault Mountain", e: "🏦", v: "savings", c: 0x8fa6c9,
    gate: "Save 50 Units in real life to open the vault.",
    qs: [
      { t: "A shiny toy costs all your savings. A bigger goal is two weeks away.", g: "Wait and keep saving for the bigger goal.", b: "Spend it all right now." },
      { t: "Jay found a “double your Units” trick from a stranger online.", g: "Tell Jay it sounds like a scam and walk away.", b: "Try the trick — fast Units!" },
    ],
  },
  {
    n: "Market Harbor", e: "🏪", v: "smart spending", c: 0x5fb8b0,
    gate: "Finish 3 real-life chores to open the market.",
    qs: [
      { t: "A stall sells the same pencil for half the price down the pier.", g: "Compare prices, then buy the cheaper one.", b: "Buy the first one you see." },
      { t: "A merchant offers “one free candy” if you buy three bags.", g: "Do the math — check if it is really a deal.", b: "Free candy! Take it!" },
    ],
  },
  {
    n: "Studio Island", e: "🎨", v: "creativity", c: 0xd98cb3,
    qs: [
      { t: "Your painting looks wrong to you. A friend is watching.", g: "Keep going and try a new colour.", b: "Crumple it up and quit." },
      { t: "Maya says your song needs a weird verse. It feels risky.", g: "Try the weird verse — new sounds grow you.", b: "Play it safe and keep it boring." },
    ],
  },
  {
    n: "Learning Lagoon", e: "📚", v: "knowledge", c: 0x7bb661,
    qs: [
      { t: "A puzzle is hard. A classmate offers to just give you the answer.", g: "Ask for a hint instead and solve it yourself.", b: "Copy the answer." },
      { t: "You got a question wrong in front of everyone.", g: "Ask what you missed so you can learn it.", b: "Laugh it off and never think about it again." },
    ],
  },
  {
    n: "Hall of Becoming", e: "🏛️", v: "growth", c: 0xe6c65a,
    qs: [
      { t: "You made a mistake that hurt a friend. Nobody saw it.", g: "Say sorry and make it right.", b: "Stay quiet and hope it passes." },
      { t: "Doubt whispers: “You will never reach Pillar.”", g: "Answer it: “Better than yesterday is enough.”", b: "Believe the whisper and stop trying." },
    ],
  },
];

const TIERS: [number, string][] = [
  [0, "Settlement"],
  [25, "Village"],
  [60, "Town"],
  [120, "City"],
  [220, "Metropolis"],
];
const R = 48;
const COST = 20;
const GATE = 15;
const SAVE_KEY = "pillar-plaza-3d";
const REWARD_KEY = "pillar-plaza-3d-rewards";
const RANK_ORDER = ["Seedling", "Sprout", "Trailblazer", "Luminary", "Pillar"];

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
.pp3d-joy{position:absolute;left:18px;bottom:calc(env(safe-area-inset-bottom,0px) + 74px);width:104px;height:104px;border-radius:50%;background:#ffffff14;border:2px solid #ffffff40;z-index:5;touch-action:none}
.pp3d-knob{position:absolute;left:34px;top:34px;width:36px;height:36px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#c4b5fd);box-shadow:0 2px 8px #0008}
.pp3d-modal{position:absolute;inset:0;background:#06031299;display:none;align-items:center;justify-content:center;padding:16px;z-index:10}
.pp3d-modal .box{background:linear-gradient(160deg,#1b1040,#0d0728);border:1px solid rgba(139,92,246,.45);color:#f3efff;border-radius:20px;padding:18px;max-width:380px;width:100%;max-height:82%;overflow:auto;box-shadow:0 12px 40px #000c}
.pp3d-modal h3{margin:0 0 8px;font-size:17px}
.pp3d-modal p{font-size:14px;line-height:1.5;color:#d9d2ff}
.pp3d-modal .box .pp3d-btn{display:block;width:100%;margin-top:8px;text-align:left;font-size:14px}
.pp3d-stat{background:#ffffff0d;border-radius:12px;padding:8px 10px;margin:8px 0;font-size:13px;font-weight:700}
.pp3d-track{height:8px;border-radius:5px;background:#ffffff1c;margin-top:6px;overflow:hidden}
.pp3d-track i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,#06b6d4,#8b5cf6)}
.pp3d-err{position:absolute;left:8px;right:8px;top:60px;background:#fff;color:#900;padding:8px;font:12px monospace;display:none;z-index:20;border-radius:10px}
`;

/* ---------------- The plaza itself (adapted from the contributed foundation) ---------------- */
function startPlaza(root: HTMLElement, THREE: any, api: PlazaApi): () => void {
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
    blight: number[];
    built: number[];
  }
  let S: PlazaState = { trust: 0, courage: 0, blight: [0, 0, 0, 0, 0, 0], built: [0, 0, 0, 0, 0, 0] };
  try {
    const j = localStorage.getItem(SAVE_KEY);
    if (j) S = Object.assign(S, JSON.parse(j));
  } catch {
    /* fresh plaza */
  }
  const save = () => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(S));
    } catch {
      /* storage unavailable */
    }
  };
  const isOpen = (i: number) => (i === 1 ? api.getSaved() >= 50 : i === 2 ? api.getChores() >= 3 : true);
  const prosp = () =>
    S.built.reduce((a, b) => a + b * 5, 0) + Math.floor(S.trust / 2) - S.blight.reduce((a, b) => a + b, 0);
  const rankIdx = () => Math.max(0, RANK_ORDER.indexOf(api.getRank()));

  /* ----- DOM scaffold ----- */
  const style = document.createElement("style");
  style.textContent = PLAZA_CSS;
  root.appendChild(style);
  const wrap = document.createElement("div");
  wrap.className = "pp3d";
  wrap.innerHTML = `
    <div class="pp3d-hud" id="pp3d-hud"></div>
    <div class="pp3d-msg" id="pp3d-msg"></div>
    <div class="pp3d-joy" id="pp3d-joy"><div class="pp3d-knob" id="pp3d-knob"></div></div>
    <div class="pp3d-panel" id="pp3d-panel"></div>
    <div class="pp3d-modal" id="pp3d-modal"><div class="box" id="pp3d-mbox"></div></div>
    <div class="pp3d-err" id="pp3d-err"></div>`;
  root.appendChild(wrap);
  const $ = (id: string) => wrap.querySelector<HTMLElement>("#" + id)!;
  const hud = $("pp3d-hud"), panel = $("pp3d-panel"), msgBox = $("pp3d-msg");

  /* ----- three.js scene ----- */
  const rd = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  rd.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  rd.shadowMap.enabled = true;
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
  const bgColor = new THREE.Color(0x9fd8f7);
  scene.background = bgColor;
  scene.fog = new THREE.Fog(0x9fd8f7, 70, 200);

  const M = (c: number, o?: any) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  const add = (g: any, m: any, x: number, y: number, z: number, p?: any): any => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    (p || scene).add(o);
    return o;
  };

  // Ground + central plaza
  add(new THREE.CircleGeometry(170, 48), M(0x7cc46a), 0, 0, 0).rotation.x = -Math.PI / 2;
  add(new THREE.CylinderGeometry(15, 15, 0.3, 40), M(0xf0e4cc), 0, 0.15, 0);

  // Central Pillar monument — grows with the kid's real Society rank
  const mon = new THREE.Group();
  scene.add(mon);
  add(new THREE.CylinderGeometry(4, 4.4, 0.9, 24), M(0xcfd8dc), 0, 0.6, 0, mon);
  add(new THREE.CylinderGeometry(3.4, 3.4, 0.5, 24), M(0x7ec8e3), 0, 1, 0, mon);
  const pillarCol = add(new THREE.CylinderGeometry(0.7, 0.9, 7, 16), M(0xfaf3e3), 0, 4, 0, mon);
  const pillarOrb = add(
    new THREE.SphereGeometry(0.9, 16, 12),
    M(0xffd36e, { emissive: 0x664400 }),
    0, 7.9, 0, mon,
  );
  const orbColors = [0xffd36e, 0x7cf29c, 0x6ec6ff, 0xc58cff, 0xff8ad4];
  function sizeMonument() {
    const h = 7 + rankIdx() * 1.6;
    pillarCol.scale.y = h / 7;
    pillarCol.position.y = h / 2 + 0.5;
    pillarOrb.position.y = h + 1.4;
    (pillarOrb.material as any).color.setHex(orbColors[rankIdx()]);
  }
  sizeMonument();
  // Monument glow ring
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.35 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.25, 8, 40), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  mon.add(ring);

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
    const gm = M(d.c);
    groundMats.push(gm);
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
    // building slots (ring around district)
    const sl: [number, number][] = [];
    for (let k = 0; k < 8; k++) {
      const t = (k / 8) * Math.PI * 2;
      sl.push([Math.cos(t) * 11, Math.sin(t) * 11]);
    }
    slots.push({ g, sl, meshes: [], windows: [] });
    zones.push({ x: cx, z: cz, a });
    // path from plaza
    const path = add(new THREE.BoxGeometry(5, 0.12, R - 30), M(0xe8d9b5), (Math.sin(a) * R) / 2, 0.09, (-Math.cos(a) * R) / 2, scene);
    path.rotation.y = -a;
  });

  function rebuild() {
    DIST.forEach((d, i) => {
      const s = slots[i];
      s.meshes.forEach((m) => s.g.remove(m));
      s.meshes = [];
      s.windows = [];
      for (let k = 0; k < Math.min(S.built[i], 8); k++) {
        const h = new THREE.Group();
        const [x, z] = s.sl[k];
        h.position.set(x, 0, z);
        h.rotation.y = -Math.atan2(z, x);
        add(new THREE.BoxGeometry(3, 2 + (k % 3), 3), M(0xfff4e0), 0, 1 + (k % 3) / 2, 0, h);
        add(new THREE.ConeGeometry(2.5, 1.8, 4), M(0xc0563a), 0, 3.1 + (k % 3), 0, h).rotation.y = Math.PI / 4;
        add(new THREE.BoxGeometry(0.8, 1.2, 0.1), M(0x6a4b2a), 0, 0.6, 1.55, h);
        // warm window that glows at night
        const wm = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0 });
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), wm);
        win.position.set(-0.7, 1.4, 1.56);
        h.add(win);
        s.windows.push(wm);
        s.g.add(h);
        s.meshes.push(h);
      }
      const dark = Math.min(S.blight[i] / 4, 1);
      groundMats[i].color.setHex(d.c).lerp(new THREE.Color(0x555555), dark * 0.7);
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
    add(new THREE.CylinderGeometry(0.3, 0.4, 2, 6), M(0x7a5230), x, 1, z);
    add(new THREE.SphereGeometry(1.6 + rnd(), 10, 8), M(0x4f9d4b), x, 3.2, z);
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
  let yaw = 0, pitch = 0.45, dist = 13, face = 0, vel = 0, bob = 0;

  /* ----- input: keys + joystick + orbit/zoom ----- */
  const keys: Record<string, number> = {};
  on(window, "keydown", (e: KeyboardEvent) => {
    keys[e.key.toLowerCase()] = 1;
  });
  on(window, "keyup", (e: KeyboardEvent) => {
    keys[e.key.toLowerCase()] = 0;
  });
  let joy = { x: 0, y: 0 };
  let jid: number | null = null;
  const jel = $("pp3d-joy"), knob = $("pp3d-knob");
  const jm = (e: PointerEvent) => {
    const r = jel.getBoundingClientRect();
    let x = (e.clientX - r.left - 52) / 40;
    let y = (e.clientY - r.top - 52) / 40;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    joy = { x, y };
    knob.style.transform = `translate(${x * 32}px,${y * 32}px)`;
  };
  on(jel, "pointerdown", (e: PointerEvent) => {
    jid = e.pointerId;
    try {
      jel.setPointerCapture(jid);
    } catch {
      /* noop */
    }
    sfx.unlock();
    jm(e);
  });
  on(jel, "pointermove", (e: PointerEvent) => {
    if (e.pointerId === jid) jm(e);
  });
  const jend = (e: PointerEvent) => {
    if (e.pointerId === jid) {
      jid = null;
      joy = { x: 0, y: 0 };
      knob.style.transform = "";
    }
  };
  on(jel, "pointerup", jend);
  on(jel, "pointercancel", jend);
  const cv = rd.domElement;
  let oid: number | null = null;
  let last: [number, number] | null = null;
  on(cv, "pointerdown", (e: PointerEvent) => {
    sfx.unlock();
    oid = e.pointerId;
    last = [e.clientX, e.clientY];
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
      oid = null;
      last = null;
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

  /* ----- UI ----- */
  const bar = (v: number, c: string) =>
    `<span class="pp3d-bar"><i style="width:${Math.min(v, 10) * 10}%;background:${c}"></i></span>`;
  function drawHud() {
    sizeMonument();
    const p = Math.max(0, prosp());
    const tier = [...TIERS].reverse().find((t) => p >= t[0])![1];
    hud.innerHTML =
      `<span class="pp3d-chip">🪙 ${api.getBalance()} Units</span>` +
      `<span class="pp3d-chip">🏙️ ${p} · ${tier}</span>` +
      `<span class="pp3d-chip">🎖️ ${api.getRank()}</span>` +
      `<span class="pp3d-chip">Trust${bar(S.trust, "#4ade80")} Courage${bar(S.courage, "#fb923c")}</span>`;
  }
  let near = -1;
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
      b.push(`<button class="pp3d-btn" onclick="__pp3d.build(${near})">🏗️ Build (${COST})</button>`);
    }
    b.push(`<button class="pp3d-btn alt" onclick="__pp3d.realLife()">🌟 Real-life progress</button>`);
    panel.innerHTML = b.join("");
  }
  function modal(html: string) {
    $("pp3d-mbox").innerHTML = html;
    $("pp3d-modal").style.display = "flex";
  }
  const closeM = () => {
    $("pp3d-modal").style.display = "none";
  };

  function rewardCount(): number {
    try {
      const j = JSON.parse(localStorage.getItem(REWARD_KEY) || "{}");
      const today = new Date().toISOString().slice(0, 10);
      return j.day === today ? j.n || 0 : 0;
    } catch {
      return 0;
    }
  }
  function bumpReward(): boolean {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const n = rewardCount();
      localStorage.setItem(REWARD_KEY, JSON.stringify({ day: today, n: n + 1 }));
      return n < 3;
    } catch {
      return false;
    }
  }

  window.__pp3d = {
    quest(i: number) {
      sfx.click();
      const q = DIST[i].qs[Math.floor(Math.random() * DIST[i].qs.length)];
      const o: [string, number][] = [[q.g, 1], [q.b, 0]];
      if (Math.random() < 0.5) o.reverse();
      modal(
        `<h3>${DIST[i].e} ${DIST[i].n}</h3><p>${q.t}</p>` +
          o.map(([t, g]) => `<button class="pp3d-btn" onclick="__pp3d.ans(${i},${g})">${t}</button>`).join("") +
          `<button class="pp3d-btn alt" onclick="__pp3d.close()">Not now</button>`,
      );
    },
    ans(i: number, g: number) {
      S.courage++;
      if (g) {
        S.trust++;
        S.blight[i] = Math.max(0, S.blight[i] - 1);
        sfx.good();
        let extra = "";
        if (bumpReward()) {
          api.earn(5, "Pillar Plaza good deed");
          extra = `<p>✨ +5 real Units for a good deed (up to 3 a day).</p>`;
          sfx.reward();
        }
        modal(
          `<h3>Trust grows 🌱</h3><p>Good choice. The district brightens.</p>${extra}` +
            `<button class="pp3d-btn" onclick="__pp3d.close()">Continue</button>`,
        );
      } else {
        S.blight[i] = Math.min(4, S.blight[i] + 1);
        sfx.bad();
        modal(
          `<h3>Blight spreads 🥀</h3><p>The district dims a little. Take another quest to heal it.</p>` +
            `<button class="pp3d-btn" onclick="__pp3d.close()">Continue</button>`,
        );
      }
      save();
      rebuild();
      drawHud();
    },
    build(i: number) {
      if (S.built[i] >= 8) {
        sfx.locked();
        return say("This district is full!");
      }
      if (!api.spend(COST, `Built in ${DIST[i].n} (3D plaza)`)) {
        sfx.locked();
        return say(`Need ${COST} Units to build. Earn them through chores and good decisions!`);
      }
      S.built[i]++;
      sfx.build();
      save();
      rebuild();
      drawHud();
      say("Built! Prosperity grows ✨");
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
          `<button class="pp3d-btn alt" onclick="__pp3d.close()">Back to the plaza</button>`,
      );
    },
    go(screen: string) {
      closeM();
      api.go(screen);
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

  const skyDay = new THREE.Color(0x9fd8f7);
  const skyDusk = new THREE.Color(0xf6a45e);
  const skyNight = new THREE.Color(0x141a3a);
  const tmpC = new THREE.Color();
  let T = 0.25;
  const clock = new THREE.Clock();
  const fv = new THREE.Vector3();
  let raf = 0;

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
    ringMat.opacity = 0.25 + 0.15 * Math.sin(t * 2);
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
      (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0) + joy.x;
    const iz =
      (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0) + joy.y;
    const l = Math.hypot(ix, iz);
    let nx = ix, nz = iz;
    if (l > 1) {
      nx /= l;
      nz /= l;
    }
    if (l > 0.08) {
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

    // district proximity + locked gates push the player out
    let n = -1;
    zones.forEach((z, i) => {
      const dx = P.position.x - z.x;
      const dz = P.position.z - z.z;
      const d = Math.hypot(dx, dz);
      if (d < GATE + 3 && n < 0) n = i;
      if (!isOpen(i) && d < 12 && d > 0.001) {
        P.position.x = z.x + (dx / d) * 12;
        P.position.z = z.z + (dz / d) * 12;
        sfx.locked();
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

    // follow camera
    const tx = P.position.x, ty = 2, tz = P.position.z;
    cam.position.set(
      tx + Math.sin(yaw) * Math.cos(pitch) * dist,
      ty + Math.sin(pitch) * dist,
      tz + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    cam.lookAt(tx, ty, tz);
    rd.render(scene, cam);
  }

  rebuild();
  drawHud();
  drawPanel();
  loop();
  setTimeout(() => say("👋 Welcome to Pillar Plaza! Walk to a district."), 600);

  return () => {
    cancelAnimationFrame(raf);
    cleanups.forEach((fn) => fn());
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
    const api: PlazaApi = {
      getBalance: () => useLedger.getState().balance,
      spend: (n, note) => !useLedger.getState().debitUnits(n, note),
      earn: (n, note) => {
        useLedger.getState().creditUnits(n, note);
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
    loadThree()
      .then((THREE) => {
        if (cancelled || !rootRef.current) return;
        cleanup = startPlaza(rootRef.current, THREE, api);
        setStatus("ready");
      })
      .catch((e) => {
        if (!cancelled) {
          setErrMsg(e instanceof Error ? e.message : String(e));
          setStatus("error");
        }
      });
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
          ‹ 2D City
        </button>
      )}
    </div>
  );
}
