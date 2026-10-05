import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Download,
  Drum,
  Film,
  Gamepad2,
  Lock,
  Medal,
  Music2,
  Share2,
  Shirt,
  Sparkles,
  Star,
  Sun,
  TreePine,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useLedger } from "@/store/ledger";
import {
  STUDIO_ROOMS,
  bandForAge,
  missionProgress,
  roomUnlocked,
  type StudioBandId,
  type StudioRoomId,
} from "@/lib/studio-path";
import { cn } from "@/lib/utils";

const TEAMS = [
  { id: "art-squad", name: "Art Squad", blurb: "Draw, stamp, and share a weekly scene.", perk: "+2 XP on every drawing saved" },
  { id: "game-makers", name: "Game Makers", blurb: "Memory, puzzles, and streak runs.", perk: "+2 XP on every game win" },
  { id: "sound-lab", name: "Sound Lab", blurb: "Beats, scales, and four-count loops.", perk: "+2 XP on every studio mission" },
];

const PACKS = [
  { id: "brush-pro", name: "Brush pack", cost: 12, blurb: "Extra liners for Inventor work." },
  { id: "palette-set", name: "Palette set", cost: 8, blurb: "Warm and cool study colors." },
  { id: "template-pack", name: "Template pack", cost: 15, blurb: "Poster and merch layouts." },
];

const ICONS = [Sun, TreePine, Star, Music2, Shirt, Trophy];

export function StudioHub({
  bandId,
  role,
  onOpen,
}: {
  bandId: StudioBandId;
  role: "parent" | "child";
  onOpen: (room: StudioRoomId) => void;
}) {
  const childName = useLedger((s) => s.childName);
  const studioXp = useLedger((s) => s.studioXp ?? 0);
  const streak = useLedger((s) => s.studioStreak ?? 1);
  const gameWins = useLedger((s) => s.gameWins ?? 0);
  const completed = useLedger((s) => s.completedMissionIds ?? []);
  const drawings = useLedger((s) => s.drawings);
  const childAge = useLedger((s) => s.childAge);
  const band = bandForAge(childAge);
  const progress = missionProgress(band, completed);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Studio XP</p>
          <p className="mt-1 font-display text-3xl font-semibold">{studioXp}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Streak</p>
          <p className="mt-1 font-display text-3xl font-semibold">{streak} days</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Games won</p>
          <p className="mt-1 font-display text-3xl font-semibold">{gameWins}</p>
        </Card>
      </div>
      <Card className="p-5">
        <CardTitle>
          {childName} · {band.name} track
        </CardTitle>
        <p className="mt-1 text-sm text-muted">
          {progress.done}/{progress.total} coloring missions complete
        </p>
        <Progress value={progress.pct} className="mt-3" />
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STUDIO_ROOMS.map((room) => {
          const open = role === "parent" || roomUnlocked(bandId, room.id);
          return (
            <button
              key={room.id}
              type="button"
              disabled={!open}
              onClick={() => onOpen(room.id)}
              className={cn(
                "rounded-2xl border border-border bg-surface p-4 text-left",
                open ? "hover:border-accent/40" : "opacity-55",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{room.title}</p>
                {open ? null : <Lock className="size-4 text-muted" />}
              </div>
              <p className="mt-1 text-sm text-muted">{room.blurb}</p>
              <p className="mt-3 text-xs uppercase tracking-wider text-accent">
                {open ? "Open" : `Unlocks at ${room.minBand}`}
              </p>
            </button>
          );
        })}
      </div>
      {drawings[0] ? (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Latest piece</p>
          <img
            src={drawings[0].dataUrl}
            alt={drawings[0].title ?? "Latest drawing"}
            className="mt-3 aspect-[16/9] w-full rounded-xl object-cover"
          />
        </Card>
      ) : null}
    </div>
  );
}

export function StudioRoomView({
  room,
  bandId,
  onBack,
}: {
  room: Exclude<StudioRoomId, "hub" | "color">;
  bandId: StudioBandId;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={onBack}>
        Studio home
      </Button>
      {room === "music" ? <MusicRoom bandId={bandId} /> : null}
      {room === "games" ? <GamesRoom bandId={bandId} /> : null}
      {room === "animation" ? <AnimationRoom /> : null}
      {room === "design" ? <DesignRoom /> : null}
      {room === "challenges" ? <ChallengesRoom /> : null}
      {room === "board" ? <BoardRoom /> : null}
      {room === "gallery" ? <GalleryRoom /> : null}
      {room === "teams" ? <TeamsRoom /> : null}
      {room === "shop" ? <ShopRoom /> : null}
      {room === "awards" ? <AwardsRoom /> : null}
    </div>
  );
}

function MusicRoom({ bandId }: { bandId: StudioBandId }) {
  const notes = useMemo(() => [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25], []);
  const drums = useMemo(() => [80, 140, 220, 320], []);

  function tone(freq: number, ms = 220) {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = freq < 200 ? "square" : "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0.12;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000);
    osc.stop(ctx.currentTime + ms / 1000);
    void ctx.resume();
  }

  return (
    <Card className="space-y-4 p-5">
      <CardTitle>Music lab</CardTitle>
      <p className="text-sm text-muted">
        {bandId === "spark" ? "Tap a key. Listen. Repeat." : "Build a short phrase, then add a drum."}
      </p>
      <div className="grid grid-cols-8 gap-1">
        {notes.map((freq, i) => (
          <button
            key={freq}
            type="button"
            aria-label={`Note ${i + 1}`}
            onClick={() => tone(freq)}
            className="h-28 rounded-lg bg-ink text-bg"
          />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {drums.map((freq, i) => (
          <Button key={freq} variant="outline" onClick={() => tone(freq, 140)}>
            <Drum className="size-4" />
            Hit {i + 1}
          </Button>
        ))}
      </div>
    </Card>
  );
}

function GamesRoom({ bandId }: { bandId: StudioBandId }) {
  const award = useLedger((s) => s.awardStudioWin);
  const pairCount = bandId === "spark" ? 4 : 6;
  const deck = useMemo(() => {
    const base = ICONS.slice(0, pairCount);
    const twice = [...base, ...base].map((Icon, i) => ({ id: i, key: Icon.displayName ?? String(i % pairCount), Icon }));
    return twice.sort(() => Math.random() - 0.5);
  }, [pairCount]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [lock, setLock] = useState(false);

  function flip(i: number) {
    if (lock || open.includes(i) || matched.includes(deck[i].key)) return;
    const next = [...open, i];
    setOpen(next);
    if (next.length === 2) {
      setLock(true);
      const [a, b] = next;
      const hit = deck[a].key === deck[b].key;
      window.setTimeout(() => {
        if (hit) {
          const keys = [...matched, deck[a].key];
          setMatched(keys);
          if (keys.length === pairCount) {
            const err = award(20, 8, "Studio game · memory match");
            if (err) toast.message(err);
            else toast.success("Match complete · +8 Units");
          }
        }
        setOpen([]);
        setLock(false);
      }, 520);
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <CardTitle>Memory match</CardTitle>
        <Badge tone="muted">
          {matched.length}/{pairCount} pairs
        </Badge>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {deck.map((card, i) => {
          const shown = open.includes(i) || matched.includes(card.key);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => flip(i)}
              className={cn(
                "grid aspect-square place-items-center rounded-2xl border border-border",
                shown ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted",
              )}
            >
              {shown ? <card.Icon className="size-7" /> : <Gamepad2 className="size-5" />}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function AnimationRoom() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [frames, setFrames] = useState<string[]>([]);
  const [play, setPlay] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = wrap.getBoundingClientRect();
    canvas.width = Math.floor(rect.width);
    canvas.height = 220;
    ctx.fillStyle = "#f4f4f1";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1c1a16";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    const pos = (e: MouseEvent | TouchEvent) => {
      const r = canvas.getBoundingClientRect();
      const t = "touches" in e ? e.touches[0] : e;
      if (!t) return null;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    const start = (e: MouseEvent | TouchEvent) => {
      const p = pos(e);
      if (!p) return;
      drawing.current = true;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawing.current) return;
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
    canvas.addEventListener("touchstart", start, { passive: true });
    canvas.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", end);
    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
    };
  }, []);

  useEffect(() => {
    if (!play || frames.length < 2) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 280);
    return () => window.clearInterval(id);
  }, [play, frames.length]);

  function capture() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setFrames((prev) => [...prev, canvas.toDataURL("image/png")].slice(0, 6));
    toast.success("Frame captured");
  }

  return (
    <Card className="space-y-4 p-5">
      <CardTitle>Animation flipbook</CardTitle>
      <div ref={wrapRef} className="overflow-hidden rounded-xl art-surface">
        {play && frames.length ? (
          <img
            src={frames[tick % frames.length]}
            alt="Playing flipbook"
            className="h-56 w-full object-cover"
          />
        ) : (
          <canvas ref={canvasRef} className="block h-56 w-full touch-none" />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={capture} disabled={frames.length >= 6}>
          <Film className="size-4" />
          Capture frame
        </Button>
        <Button variant="outline" onClick={() => setPlay((p) => !p)} disabled={frames.length < 2}>
          {play ? "Stop" : "Play"}
        </Button>
      </div>
      {frames.length ? (
        <div className="grid grid-cols-6 gap-2">
          {frames.map((src, i) => (
            <img key={src.slice(-12) + i} src={src} alt={`Frame ${i + 1}`} className="aspect-square rounded-md object-cover" />
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function DesignRoom() {
  const drawings = useLedger((s) => s.drawings);
  const saveDrawing = useLedger((s) => s.saveDrawing);
  const [ink, setInk] = useState("#45c58a");
  const [word, setWord] = useState("PILLAR");
  const art = drawings[0]?.dataUrl;

  function downloadTee() {
    const c = document.createElement("canvas");
    c.width = 440; c.height = 560;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // Shirt body
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.roundRect(110, 40, 220, 440, [60, 60, 12, 12]);
    ctx.fill();
    // Artwork
    const img = art ? new Image() : null;
    const draw = () => {
      if (img && art) {
        ctx.drawImage(img, 170, 180, 100, 100);
      }
      // Wordmark
      ctx.fillStyle = "#06100b";
      ctx.font = "bold 36px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(word || "PILLAR", 220, 340);
      const a = document.createElement("a");
      a.download = `tee-${word.toLowerCase() || "design"}.png`;
      a.href = c.toDataURL("image/png");
      a.click();
      toast.success("Tee design downloaded");
    };
    if (img && art) {
      img.onload = draw;
      img.src = art;
    } else {
      draw();
    }
  }

  function shareToShowcase() {
    const c = document.createElement("canvas");
    c.width = 440; c.height = 560;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.roundRect(110, 40, 220, 440, [60, 60, 12, 12]);
    ctx.fill();
    ctx.fillStyle = "#06100b";
    ctx.font = "bold 36px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(word || "PILLAR", 220, 340);
    const dataUrl = c.toDataURL("image/png");
    saveDrawing(dataUrl, { title: `Tee · ${word || "Design"}` });
    toast.success("Shared to Showcase!");
  }

  return (
    <Card className="space-y-4 p-5">
      <CardTitle>Tee designer</CardTitle>
      <div className="grid place-items-center rounded-2xl bg-surface-2 p-8">
        <div
          className="relative flex h-56 w-44 flex-col items-center justify-center rounded-t-[3rem] rounded-b-lg"
          style={{ background: ink, color: "#06100b" }}
        >
          {art ? (
            <img src={art} alt="Print" className="h-20 w-20 rounded-md object-cover" />
          ) : (
            <Shirt className="size-10" />
          )}
          <p className="mt-3 font-display text-lg font-semibold tracking-wide">{word}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {["#45c58a", "#f4f4f1", "#f1bd59", "#1c1a16"].map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Shirt ${c}`}
            onClick={() => setInk(c)}
            className="size-11 rounded-full border border-border"
            style={{ background: c }}
          />
        ))}
      </div>
      <Input value={word} onChange={(e) => setWord(e.target.value.slice(0, 14))} aria-label="Shirt wordmark" />
      <div className="flex gap-2">
        <Button onClick={downloadTee} variant="outline" className="flex-1">
          <Download className="size-4" /> Download PNG
        </Button>
        <Button onClick={shareToShowcase} className="flex-1">
          <Share2 className="size-4" /> Share to Showcase
        </Button>
      </div>
    </Card>
  );
}

function ChallengesRoom() {
  const drawings = useLedger((s) => s.drawings);
  const wins = useLedger((s) => s.gameWins ?? 0);
  const missions = useLedger((s) => s.completedMissionIds ?? []);
  const claimed = useLedger((s) => s.claimedChallenges ?? []);
  const claim = useLedger((s) => s.claimChallenge);
  const items = [
    { id: "daily-art", title: "Daily: save a piece", done: drawings.length > 0, reward: "+8 XP" },
    { id: "weekly-games", title: "Weekly: win 3 games", done: wins >= 3, reward: "+12 Units" },
    { id: "monthly-maker", title: "Monthly: 4 missions", done: missions.length >= 4, reward: "Maker badge · +20 XP" },
  ];
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isClaimed = claimed.includes(item.id);
        return (
          <Card key={item.id} className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm text-muted">{item.reward}</p>
            </div>
            {isClaimed ? (
              <Badge tone="accent">Claimed</Badge>
            ) : item.done ? (
              <Button
                size="sm"
                onClick={() => {
                  const err = claim(item.id);
                  if (err) toast.message(err);
                  else toast.success(`Claimed ${item.reward}!`);
                }}
              >
                Claim
              </Button>
            ) : (
              <Badge tone="muted">Open</Badge>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function BoardRoom() {
  const xp = useLedger((s) => s.studioXp ?? 0);
  const name = useLedger((s) => s.childName);
  // Real ranks based on the child's own XP milestones — no fake competitors.
  const ranks = [
    { name: "Sketchling", xp: 0 },
    { name: "Doodler", xp: 50 },
    { name: "Creator", xp: 150 },
    { name: "Artisan", xp: 300 },
    { name: "Master", xp: 500 },
  ];
  const current = [...ranks].reverse().find((r) => xp >= r.xp) ?? ranks[0];
  const next = ranks.find((r) => r.xp > xp);
  return (
    <div className="space-y-3">
      <Card className="p-5 text-center">
        <p className="text-sm text-muted">{name}'s studio rank</p>
        <p className="font-display text-3xl font-bold text-accent">{current.name}</p>
        <p className="font-mono text-sm text-muted">{xp} XP</p>
        {next && (
          <p className="mt-2 text-xs text-muted">
            {next.xp - xp} XP to {next.name}
          </p>
        )}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${next ? Math.min(100, (xp / next.xp) * 100) : 100}%` }}
          />
        </div>
      </Card>
      <Card className="p-4">
        <p className="mb-2 text-sm font-semibold">Rank ladder</p>
        {ranks.map((r) => (
          <div key={r.name} className="flex items-center justify-between py-1.5 text-sm">
            <span className={r.name === current.name ? "font-bold text-accent" : ""}>
              {r.name} {r.name === current.name && "← you"}
            </span>
            <span className="font-mono text-muted">{r.xp} XP</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function GalleryRoom() {
  const drawings = useLedger((s) => s.drawings);
  if (!drawings.length) {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted">No pieces yet. Open Coloring and save one.</p>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {drawings.map((d) => (
        <figure key={d.id}>
          <img src={d.dataUrl} alt={d.title ?? "Drawing"} className="aspect-square w-full rounded-xl object-cover" />
          {d.title ? <figcaption className="mt-1 truncate text-xs text-muted">{d.title}</figcaption> : null}
        </figure>
      ))}
    </div>
  );
}

function TeamsRoom() {
  const team = useLedger((s) => s.studioTeam);
  const join = useLedger((s) => s.joinStudioTeam);
  return (
    <div className="grid gap-3">
      {team && (
        <Card className="border-accent/40 bg-accent/5 p-4">
          <p className="text-sm">
            <span className="font-semibold">Current team:</span>{" "}
            {TEAMS.find((t) => t.id === team)?.name}
          </p>
          <p className="text-xs text-muted">
            Perk active: {TEAMS.find((t) => t.id === team)?.perk}
          </p>
        </Card>
      )}
      {TEAMS.map((item) => (
        <Card key={item.id} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{item.name}</CardTitle>
              <p className="mt-1 text-sm text-muted">{item.blurb}</p>
              <p className="mt-1 text-xs font-semibold text-accent">{item.perk}</p>
            </div>
            <Users className="size-5 text-accent" />
          </div>
          <Button
            className="mt-4"
            variant={team === item.id ? "secondary" : "default"}
            disabled={team === item.id}
            onClick={() => {
              join(item.id);
              toast.success(`Joined ${item.name} — perk active!`);
            }}
          >
            {team === item.id ? "Current team" : "Join"}
          </Button>
        </Card>
      ))}
    </div>
  );
}

function ShopRoom() {
  const owned = useLedger((s) => s.ownedPacks ?? []);
  const buy = useLedger((s) => s.buyStudioPack);
  const balance = useLedger((s) => s.balance);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Spendable Units · {balance}</p>
      {PACKS.map((pack) => (
        <Card key={pack.id} className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="font-semibold">{pack.name}</p>
            <p className="text-sm text-muted">{pack.blurb}</p>
          </div>
          <Button
            disabled={owned.includes(pack.id)}
            onClick={() => {
              const err = buy(pack.id, pack.cost);
              if (err) toast.message(err);
              else toast.success(`Bought ${pack.name}`);
            }}
          >
            {owned.includes(pack.id) ? "Owned" : `${pack.cost} U`}
          </Button>
        </Card>
      ))}
    </div>
  );
}

function AwardsRoom() {
  const missions = useLedger((s) => s.completedMissionIds ?? []);
  const wins = useLedger((s) => s.gameWins ?? 0);
  const streak = useLedger((s) => s.studioStreak ?? 1);
  const xp = useLedger((s) => s.studioXp ?? 0);
  const badges = [
    { id: "starter", name: "Creative starter", on: missions.length > 0, icon: Sparkles },
    { id: "games", name: "Game champion", on: wins >= 1, icon: Gamepad2 },
    { id: "week", name: "Week warrior", on: streak >= 3, icon: Medal },
    { id: "xp", name: "100 XP", on: xp >= 100, icon: Trophy },
    { id: "story", name: "Story maker", on: missions.length >= 4, icon: BookOpen },
    { id: "legend", name: "Legendary", on: xp >= 400, icon: Star },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {badges.map((badge) => (
        <Card key={badge.id} className={cn("p-4 text-center", !badge.on && "opacity-45")}>
          <badge.icon className="mx-auto size-7 text-accent" />
          <p className="mt-2 text-sm font-semibold">{badge.name}</p>
        </Card>
      ))}
    </div>
  );
}
