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

/* ------------------------------ build system ------------------------------ */
interface BuildingDef { name: string; icon: string; cost: number; prosperity: number }
const BUILDINGS: Record<string, BuildingDef[]> = {
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
const CITY_TIERS = [
  { name: "Settlement", at: 0 },
  { name: "Hamlet", at: 60 },
  { name: "Village", at: 150 },
  { name: "Town", at: 300 },
  { name: "City", at: 500 },
  { name: "Metropolis", at: 750 },
];
const QUESTS = [
  { id: "first-build", name: "Break Ground", desc: "Build your first structure", check: (s: CitySave) => countBuildings(s) >= 1, reward: "trust10" },
  { id: "builder", name: "Developer", desc: "Build 4 structures", check: (s: CitySave) => countBuildings(s) >= 4, reward: "courage15" },
  { id: "village", name: "Growing Community", desc: "Reach Village tier", check: (s: CitySave) => prosperityOf(s) >= 150, reward: "both10" },
  { id: "town", name: "Town Founder", desc: "Reach Town tier", check: (s: CitySave) => prosperityOf(s) >= 300, reward: "both15" },
  { id: "magnate", name: "City Magnate", desc: "Build 10 structures", check: (s: CitySave) => countBuildings(s) >= 10, reward: "both20" },
];
interface CitySave {
  structures: Record<string, Array<number | null>>; // districtId -> 3 slots, value = building index or null
  questsDone: string[];
  tutorialDone: boolean;
}
function countBuildings(s: CitySave): number {
  return Object.values(s.structures).flat().filter((v) => v !== null).length;
}
function prosperityOf(s: CitySave): number {
  let p = 0;
  for (const [did, slots] of Object.entries(s.structures)) {
    slots.forEach((bi) => {
      if (bi !== null) p += BUILDINGS[did][bi].prosperity;
    });
  }
  return p;
}
function loadCity(): CitySave {
  try {
    const raw = localStorage.getItem("pillarpath-city");
    if (raw) {
      const s = JSON.parse(raw) as CitySave;
      if (s.structures && s.questsDone) return s;
    }
  } catch { /* ignore */ }
  const structures: Record<string, Array<number | null>> = {};
  for (const d of DISTRICT_DEFS) structures[d.id] = [null, null, null];
  return { structures, questsDone: [], tutorialDone: false };
}
function saveCity(s: CitySave) {
  try { localStorage.setItem("pillarpath-city", JSON.stringify(s)); } catch { /* ignore */ }
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
  const awardUnits = useLedger((s) => s.awardUnits);
  const debitUnits = useLedger((s) => s.debitUnits);
  const balance = useLedger((s) => s.balance);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // City save: structures, quests, tutorial.
  const [city, setCity] = useState<CitySave>(() => loadCity());
  const cityRef = useRef(city);
  cityRef.current = city;
  const persistCity = (next: CitySave) => {
    setCity(next);
    cityRef.current = next;
    saveCity(next);
  };

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
  const sfxRef = useRef<AudioContext | null>(null);

  /* ------------------------------ sound effects ------------------------------ */
  const ensureSfx = (): AudioContext | null => {
    try {
      if (sfxRef.current) return sfxRef.current;
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      sfxRef.current = new AC();
      return sfxRef.current;
    } catch { return null; }
  };
  const playTone = (freq: number, dur: number, type: OscillatorType = "sine", vol = 0.15, when = 0) => {
    const ctx = ensureSfx();
    if (!ctx) return;
    try {
      const t = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + dur + 0.05);
    } catch { /* ignore */ }
  };
  const sfx = {
    tap: () => playTone(660, 0.08, "sine", 0.08),
    build: () => {
      playTone(261.63, 0.15, "triangle", 0.14, 0);
      playTone(329.63, 0.15, "triangle", 0.14, 0.1);
      playTone(392.0, 0.2, "triangle", 0.14, 0.2);
      playTone(523.25, 0.35, "triangle", 0.16, 0.3);
      playTone(130.81, 0.4, "sine", 0.2, 0.3); // foundation thud
    },
    quest: () => {
      playTone(523.25, 0.12, "square", 0.08, 0);
      playTone(659.25, 0.12, "square", 0.08, 0.12);
      playTone(783.99, 0.25, "square", 0.1, 0.24);
    },
    tierUp: () => {
      const notes = [392.0, 523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => playTone(f, 0.3, "triangle", 0.14, i * 0.12));
    },
    chest: () => {
      playTone(880, 0.1, "sine", 0.1, 0);
      playTone(1174.66, 0.2, "sine", 0.1, 0.08);
    },
    error: () => playTone(220, 0.2, "sawtooth", 0.08),
  };
  const sfxRef2 = useRef(sfx);
  sfxRef2.current = sfx;
  const zoomRef = useRef<{ zoomIn: () => void; zoomOut: () => void; reset: () => void }>({
    zoomIn: () => {}, zoomOut: () => {}, reset: () => {},
  });

  const trustRef = useRef(50);
  const rankRef = useRef(rank);
  rankRef.current = rank;
  const cityMoodRef = useRef(cityMood);
  cityMoodRef.current = cityMood;
  const districtLevelsRef = useRef(districtLevels);
  districtLevelsRef.current = districtLevels;
  // Build animation: when each structure was constructed (for rise effect).
  const builtAtRef = useRef<Record<string, number>>({});
  // Tier-up detection.
  const [tierCeremony, setTierCeremony] = useState<null | string>(null);
  const prevTierRef = useRef<string>("");
  const [fireworks, setFireworks] = useState(false);
  const fireworksRef = useRef(false);
  fireworksRef.current = fireworks;

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
    // Living city: citizens, smoke, birds, clouds.
    citizens: null as null | Array<{
      x: number; y: number; tx: number; ty: number;
      speed: number; ph: number; color: string; pause: number;
    }>,
    smoke: [] as Array<Vec & { vy: number; life: number; size: number }>,
    birds: null as null | Array<{ x: number; y: number; vx: number; ph: number }>,
    clouds: null as null | Array<{ x: number; y: number; vx: number; s: number; a: number }>,
    prevLevels: {} as Record<string, number>,
    time: 0,
    dayTime: 0.3,
    blight: 0,
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
    sfxRef2.current.chest();
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

  /* ------------------------------ building ------------------------------ */
  const [showQuests, setShowQuests] = useState(false);
  const [buildSlot, setBuildSlot] = useState<null | { district: string; slot: number }>(null);
  const prosperity = prosperityOf(city);
  const cityTier = [...CITY_TIERS].reverse().find((t) => prosperity >= t.at) ?? CITY_TIERS[0];
  const nextTier = CITY_TIERS[CITY_TIERS.indexOf(cityTier) + 1];

  // Tier-up ceremony + fireworks at Metropolis.
  useEffect(() => {
    if (prevTierRef.current && prevTierRef.current !== cityTier.name) {
      setTierCeremony(cityTier.name);
      sfxRef2.current.tierUp();
      if (cityTier.name === "Metropolis") {
        setFireworks(true);
        setTimeout(() => setFireworks(false), 8000);
      }
    }
    prevTierRef.current = cityTier.name;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityTier.name]);

  const buildStructure = (districtId: string, slot: number) => {
    const defs = BUILDINGS[districtId];
    const def = defs[slot];
    if (!def) return;
    const err = debitUnits(def.cost, `Built ${def.name} in ${districtId}`);
    if (err) {
      sfxRef2.current.error();
      pushToast("Not enough Units", `You need ${def.cost} Units. Earn them through chores and good decisions!`, "#ef4444");
      return;
    }
    sfxRef2.current.build();
    builtAtRef.current[`${districtId}:${slot}`] = performance.now();
    const next: CitySave = {
      ...cityRef.current,
      structures: {
        ...cityRef.current.structures,
        [districtId]: cityRef.current.structures[districtId].map((v, i) => (i === slot ? slot : v)),
      },
    };
    persistCity(next);
    setBuildSlot(null);
    // Celebration.
    const S = stateRef.current;
    const d = S.districts.find((x) => x.id === districtId);
    if (d) {
      for (let i = 0; i < 36; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 80 + Math.random() * 180;
        S.particles.push({
          x: d.pos.x, y: d.pos.y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
          life: 1 + Math.random() * 0.8, color: d.color,
        });
      }
    }
    const nt = Math.min(100, trustRef.current + 5);
    trustRef.current = nt; setTrust(nt);
    pushToast(`${def.icon} ${def.name} built!`, `+${def.prosperity} Prosperity, +5 Trust. Your city grows!`, "#4ade80");
    checkQuests(next);
  };

  const checkQuests = (s: CitySave) => {
    for (const q of QUESTS) {
      if (s.questsDone.includes(q.id)) continue;
      if (q.check(s)) {
        const next = { ...s, questsDone: [...s.questsDone, q.id] };
        persistCity(next);
        sfxRef2.current.quest();
        if (q.reward === "trust10") {
          const nt = Math.min(100, trustRef.current + 10);
          trustRef.current = nt; setTrust(nt);
          pushToast(`Quest: ${q.name}!`, "Completed! +10 Trust.", "#fbbf24");
        } else if (q.reward === "courage15") {
          setCourage((c) => c + 15);
          pushToast(`Quest: ${q.name}!`, "Completed! +15 Courage.", "#fbbf24");
        } else {
          const amt = q.reward === "both20" ? 20 : q.reward === "both15" ? 15 : 10;
          const nt = Math.min(100, trustRef.current + amt);
          trustRef.current = nt; setTrust(nt);
          setCourage((c) => c + amt);
          pushToast(`Quest: ${q.name}!`, `Completed! +${amt} Trust, +${amt} Courage.`, "#fbbf24");
        }
      }
    }
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
          sfxRef2.current.tap();
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
      // Fireworks at Metropolis!
      if (fireworksRef.current && Math.random() < dt * 6) {
        const fx = 200 + Math.random() * (WORLD_W - 400);
        const fy = 150 + Math.random() * 350;
        const cols = ["#f472b6", "#fbbf24", "#4ade80", "#38bdf8", "#e879f9", "#fde68a"];
        const col = cols[Math.floor(Math.random() * cols.length)];
        for (let i = 0; i < 26; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 100 + Math.random() * 220;
          S.particles.push({
            x: fx, y: fy,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 0.8 + Math.random() * 0.7, color: col,
          });
        }
        sfxRef2.current.quest();
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

      /* ---------- living city: citizens, smoke, birds, clouds ---------- */
      const dPos = S.districts.map((d) => d.pos);
      if (!S.citizens) {
        const cols = ["#fbbf24", "#4ade80", "#38bdf8", "#e879f9", "#fb7185", "#fde68a", "#a78bfa", "#34d399"];
        S.citizens = Array.from({ length: 10 }, (_, i) => {
          const a = dPos[Math.floor(Math.random() * dPos.length)];
          const b = dPos[Math.floor(Math.random() * dPos.length)];
          return {
            x: a.x + (Math.random() - 0.5) * 60, y: a.y + (Math.random() - 0.5) * 60,
            tx: b.x + (Math.random() - 0.5) * 80, ty: b.y + (Math.random() - 0.5) * 80,
            speed: 28 + Math.random() * 30, ph: Math.random() * 6,
            color: cols[i % cols.length], pause: 0,
          };
        });
      }
      if (!S.birds) {
        S.birds = Array.from({ length: 4 }, () => ({
          x: Math.random() * WORLD_W, y: 80 + Math.random() * 220,
          vx: (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 40),
          ph: Math.random() * 6,
        }));
      }
      if (!S.clouds) {
        S.clouds = Array.from({ length: 5 }, () => ({
          x: Math.random() * WORLD_W, y: 60 + Math.random() * 260,
          vx: 8 + Math.random() * 14, s: 60 + Math.random() * 70, a: 0.1 + Math.random() * 0.12,
        }));
      }
      // Citizens walk.
      for (const c of S.citizens) {
        if (c.pause > 0) { c.pause -= dt; continue; }
        const dx = c.tx - c.x;
        const dy = c.ty - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 12) {
          c.pause = 1 + Math.random() * 3;
          const b = dPos[Math.floor(Math.random() * dPos.length)];
          c.tx = b.x + (Math.random() - 0.5) * 90;
          c.ty = b.y + (Math.random() - 0.5) * 90;
        } else {
          c.x += (dx / dist) * c.speed * dt;
          c.y += (dy / dist) * c.speed * dt;
        }
      }
      // Birds fly.
      for (const b of S.birds) {
        b.x += b.vx * dt;
        if (b.x < -60) b.x = WORLD_W + 60;
        if (b.x > WORLD_W + 60) b.x = -60;
      }
      // Clouds drift.
      for (const cl of S.clouds) {
        cl.x += cl.vx * dt;
        if (cl.x - cl.s > WORLD_W) cl.x = -cl.s;
      }
      // Chimney smoke from districts.
      for (const d of S.districts) {
        if (Math.random() < dt * 3) {
          S.smoke.push({
            x: d.pos.x + (Math.random() - 0.5) * 20,
            y: d.pos.y - 40,
            vy: -(18 + Math.random() * 14),
            life: 2 + Math.random() * 1.5,
            size: 6 + Math.random() * 8,
          });
        }
      }
      for (let i = S.smoke.length - 1; i >= 0; i--) {
        const sm = S.smoke[i];
        sm.life -= dt;
        sm.y += sm.vy * dt;
        sm.x += Math.sin(S.time * 2 + sm.y * 0.05) * 12 * dt;
        sm.size += dt * 6;
        if (sm.life <= 0) S.smoke.splice(i, 1);
      }
      if (S.smoke.length > 120) S.smoke.splice(0, S.smoke.length - 120);

      // Render clouds (behind everything).
      for (const cl of S.clouds) {
        ctx.save();
        ctx.globalAlpha = cl.a;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(cl.x, cl.y, cl.s, cl.s * 0.42, 0, 0, Math.PI * 2);
        ctx.ellipse(cl.x - cl.s * 0.5, cl.y + 8, cl.s * 0.55, cl.s * 0.3, 0, 0, Math.PI * 2);
        ctx.ellipse(cl.x + cl.s * 0.5, cl.y + 6, cl.s * 0.6, cl.s * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // Render birds.
      ctx.strokeStyle = "rgba(15,23,42,0.7)";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      for (const b of S.birds) {
        const flap = Math.sin(S.time * 10 + b.ph) * 6;
        ctx.beginPath();
        ctx.moveTo(b.x - 10, b.y);
        ctx.quadraticCurveTo(b.x - 4, b.y - 6 - flap, b.x, b.y);
        ctx.quadraticCurveTo(b.x + 4, b.y - 6 - flap, b.x + 10, b.y);
        ctx.stroke();
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

      // Built structures around each district.
      const structRef = cityRef.current.structures;
      const SLOT_OFFSETS = [
        { x: -95, y: -70 }, { x: 95, y: -70 }, { x: 0, y: 105 },
      ];
      for (const d of S.districts) {
        const slots = structRef[d.id] ?? [null, null, null];
        slots.forEach((bi, si) => {
          if (bi === null) return;
          const def = BUILDINGS[d.id][bi];
          if (!def) return;
          const ox = SLOT_OFFSETS[si].x;
          const oy = SLOT_OFFSETS[si].y;
          const bx = d.pos.x + ox;
          const by = d.pos.y + oy;
          // Rise animation: scale from 0 with overshoot in first 0.9s.
          const builtAt = builtAtRef.current[`${d.id}:${si}`] ?? 0;
          const age = (performance.now() - builtAt) / 1000;
          let bScale = 1;
          if (age < 0.9) {
            const t = age / 0.9;
            bScale = t < 0.7
              ? 1.15 * (t / 0.7) // grow past
              : 1.15 - 0.15 * ((t - 0.7) / 0.3); // settle
          }
          const bBounce = Math.abs(Math.sin(S.time * 2 + si * 2 + d.pos.x)) * 3;
          ctx.save();
          ctx.translate(bx, by);
          ctx.scale(bScale, bScale);
          ctx.translate(-bx, -by);
          // Glow.
          const bg = ctx.createRadialGradient(bx, by, 4, bx, by, 44);
          bg.addColorStop(0, `${d.color}55`);
          bg.addColorStop(1, `${d.color}00`);
          ctx.fillStyle = bg;
          ctx.beginPath(); ctx.arc(bx, by, 44, 0, Math.PI * 2); ctx.fill();
          // Base.
          ctx.fillStyle = "rgba(0,0,0,0.45)";
          ctx.beginPath(); ctx.ellipse(bx, by + 22, 24, 8, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#0f172a";
          roundRect(ctx, bx - 26, by - 26 + bBounce * 0.3, 52, 52, 12);
          ctx.fill();
          ctx.strokeStyle = d.color;
          ctx.lineWidth = 2;
          roundRect(ctx, bx - 26, by - 26 + bBounce * 0.3, 52, 52, 12);
          ctx.stroke();
          ctx.font = "28px system-ui";
          ctx.textAlign = "center";
          ctx.fillText(def.icon, bx, by + 10 + bBounce * 0.3);
          ctx.restore();
        });
      }

      // Citizens walking.
      for (const c of S.citizens!) {
        const bob = c.pause > 0 ? 0 : Math.abs(Math.sin(S.time * 8 + c.ph)) * 3;
        // Shadow.
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.ellipse(c.x, c.y + 8, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
        // Body.
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.arc(c.x, c.y - 6 - bob, 7, 0, Math.PI * 2); ctx.fill();
        // Head.
        ctx.fillStyle = "#fde68a";
        ctx.beginPath(); ctx.arc(c.x, c.y - 16 - bob, 5, 0, Math.PI * 2); ctx.fill();
      }
      // Chimney smoke.
      for (const sm of S.smoke) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(0.35, sm.life * 0.18));
        ctx.fillStyle = "#e2e8f0";
        ctx.beginPath(); ctx.arc(sm.x, sm.y, sm.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // Night windows glow on districts.
      if (cityMoodRef.current === "night") {
        const dl = districtLevelsRef.current;
        for (const d of S.districts) {
          const lvl = dl[d.id] ?? 1;
          const size = 64 + lvl * 14;
          for (let wi = 0; wi < 3 + lvl; wi++) {
            const wx = d.pos.x - size * 0.3 + (wi % 3) * size * 0.3;
            const wy = d.pos.y - size * 0.25 + Math.floor(wi / 3) * size * 0.28;
            const tw = 0.5 + 0.5 * Math.sin(S.time * 3 + wi * 2 + d.pos.x);
            ctx.save();
            ctx.globalAlpha = 0.35 + tw * 0.45;
            ctx.fillStyle = "#fde68a";
            ctx.shadowColor = "#fde68a"; ctx.shadowBlur = 8;
            ctx.fillRect(wx - 3, wy - 3, 6, 6);
            ctx.restore();
          }
        }
      }

      // Level-up celebration: district grew since last frame.
      const dl2 = districtLevelsRef.current;
      for (const d of S.districts) {
        const lvl = dl2[d.id] ?? 1;
        const prev = S.prevLevels[d.id] ?? lvl;
        if (lvl > prev) {
          for (let i = 0; i < 30; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 80 + Math.random() * 160;
            S.particles.push({
              x: d.pos.x, y: d.pos.y,
              vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
              life: 1 + Math.random() * 0.6, color: d.color,
            });
          }
          toastRef.current(`${d.name} leveled up!`, `Level ${lvl} — your real-life effort built this.`, d.color);
        }
        S.prevLevels[d.id] = lvl;
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
      if (mood !== cityMoodRef.current) setCityMood(mood);
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
          <Button variant="ghost" size="sm" onClick={() => setShowQuests(true)} className="gap-1 text-xs text-white hover:bg-white/15 hover:text-white">
            <span>🎯</span> Quests
          </Button>
          <div className="flex items-center gap-1 text-xs font-bold text-white" title="Trust">
            <Heart className="size-4" style={{ color: trust >= 70 ? "#4ade80" : trust >= 40 ? "#fbbf24" : "#ef4444" }} />
            <span>{trust}</span>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-amber-300" title="Courage">
            <span>💪</span><span>{courage}</span>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-emerald-300" title="Prosperity">
            <span>🏙️</span><span>{cityTier.name}</span><span className="text-white/60">{prosperity}</span>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-yellow-300" title="Units">
            <span>🪙</span><span>{balance}</span>
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
              {/* Build slots */}
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/60">🏗️ Build</p>
              <div className="mb-4 grid grid-cols-3 gap-2">
                {([0, 1, 2] as const).map((si) => {
                  const built = city.structures[selected!]?.[si];
                  const def = BUILDINGS[selected!][si];
                  if (built !== null && built !== undefined) {
                    return (
                      <div key={si} className="rounded-xl border p-2 text-center" style={{ borderColor: `${selDef.color}66`, background: `${selDef.color}11` }}>
                        <p className="text-2xl">{def.icon}</p>
                        <p className="mt-1 text-[10px] font-bold text-white">{def.name}</p>
                        <p className="text-[10px] text-white/50">+{def.prosperity} 🏙️</p>
                      </div>
                    );
                  }
                  return (
                    <button
                      key={si}
                      onClick={() => setBuildSlot({ district: selected!, slot: si })}
                      className="rounded-xl border-2 border-dashed border-white/20 p-2 text-center transition hover:border-white/40 hover:bg-white/5"
                    >
                      <p className="text-2xl text-white/40">+</p>
                      <p className="mt-1 text-[10px] font-bold text-white/60">{def.name}</p>
                      <p className="text-[10px] font-bold text-yellow-300">🪙 {def.cost}</p>
                    </button>
                  );
                })}
              </div>
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

      {/* Build confirmation */}
      {buildSlot && (() => {
        const def = BUILDINGS[buildSlot.district][buildSlot.slot];
        const dName = DISTRICT_DEFS.find((d) => d.id === buildSlot.district)?.name;
        return (
          <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 p-6 backdrop-blur-sm">
            <div className="w-full max-w-xs rounded-3xl border border-white/15 bg-[#0b1020] p-6 text-center">
              <p className="text-5xl">{def.icon}</p>
              <p className="mt-2 font-display text-xl font-bold text-white">{def.name}</p>
              <p className="text-sm text-white/60">{dName}</p>
              <div className="mt-3 flex items-center justify-center gap-4 text-sm font-bold">
                <span className="text-yellow-300">🪙 {def.cost} Units</span>
                <span className="text-emerald-300">🏙️ +{def.prosperity}</span>
              </div>
              <p className="mt-2 text-xs text-white/50">You have {balance} Units</p>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10" onClick={() => setBuildSlot(null)}>Cancel</Button>
                <Button className="flex-1 bg-emerald-400 font-bold text-black hover:bg-emerald-300" onClick={() => buildStructure(buildSlot.district, buildSlot.slot)}>Build!</Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Quests panel */}
      {showQuests && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 p-6 backdrop-blur-sm">
          <div className="max-h-[70%] w-full max-w-sm overflow-y-auto rounded-3xl border border-white/15 bg-[#0b1020] p-5">
            <div className="flex items-center justify-between">
              <p className="font-display text-xl font-bold text-white">🎯 City Quests</p>
              <Button variant="ghost" size="sm" onClick={() => setShowQuests(false)} className="text-white hover:bg-white/10">✕</Button>
            </div>
            <div className="mt-3 space-y-2">
              {QUESTS.map((q) => {
                const done = city.questsDone.includes(q.id);
                return (
                  <div key={q.id} className={`rounded-xl border p-3 ${done ? "border-emerald-400/40 bg-emerald-400/10" : "border-white/10 bg-white/5"}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-white">{done ? "✅" : "⬜"} {q.name}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-white/60">{q.desc}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-xl bg-white/5 p-3">
              <p className="text-xs font-bold uppercase tracking-widest text-white/50">City Tier</p>
              <p className="font-display text-lg font-bold text-white">🏙️ {cityTier.name} <span className="text-sm text-white/50">{prosperity} prosperity</span></p>
              {nextTier && (
                <div className="mt-2">
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" style={{ width: `${Math.min(100, Math.round(((prosperity - cityTier.at) / (nextTier.at - cityTier.at)) * 100))}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-white/50">{nextTier.at - prosperity} to {nextTier.name}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tutorial */}
      {!city.tutorialDone && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-cyan-300/30 bg-[#0b1020] p-6 text-center">
            <p className="text-4xl">🏙️</p>
            <p className="mt-2 font-display text-2xl font-bold text-white">Welcome, Builder!</p>
            <div className="mt-4 space-y-3 text-left text-sm text-white/80">
              <p><span className="font-bold text-cyan-300">1.</span> Tap any district to enter it.</p>
              <p><span className="font-bold text-cyan-300">2.</span> Spend Units you've earned to build structures.</p>
              <p><span className="font-bold text-cyan-300">3.</span> Buildings raise Prosperity — grow from Settlement to Metropolis!</p>
              <p><span className="font-bold text-cyan-300">4.</span> Do real chores and save real Units to unlock more.</p>
            </div>
            <Button
              className="mt-6 w-full bg-cyan-400 font-bold text-black hover:bg-cyan-300"
              onClick={() => persistCity({ ...cityRef.current, tutorialDone: true })}
            >
              Start Building!
            </Button>
          </div>
        </div>
      )}
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

      {/* Tier-up ceremony */}
      {tierCeremony && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/70 p-6 backdrop-blur-sm">
          <div className="mx-6 w-full max-w-sm rounded-3xl border border-emerald-300/50 bg-gradient-to-b from-emerald-950/90 to-black/90 p-8 text-center">
            <p className="text-5xl">{tierCeremony === "Metropolis" ? "🌆" : "🎉"}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-emerald-300">
              {tierCeremony === "Metropolis" ? "The ultimate achievement" : "Your city grows!"}
            </p>
            <p className="mt-2 font-display text-3xl font-bold text-white">
              {tierCeremony === "Metropolis" ? "METROPOLIS!" : `Welcome to ${tierCeremony}!`}
            </p>
            <p className="mt-1 text-sm text-white/70">
              {tierCeremony === "Metropolis"
                ? "You built a city from nothing. Better than yesterday, every single day."
                : "New horizons. Keep building, King."}
            </p>
            <Button className="mt-4 bg-emerald-400 font-bold text-black hover:bg-emerald-300" onClick={() => setTierCeremony(null)}>
              {tierCeremony === "Metropolis" ? "Behold my Metropolis" : "Continue building"}
            </Button>
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
