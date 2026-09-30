export type StudioBandId = "spark" | "maker" | "inventor" | "atelier";
export type StudioToolId =
  | "brush"
  | "crayon"
  | "undo"
  | "grid"
  | "stamp-sun"
  | "stamp-house"
  | "stamp-smile"
  | "stamp-tree"
  | "stamp-star"
  | "stamp-boat"
  | "fine";

export type StudioMission = {
  id: string;
  title: string;
  brief: string;
  xp: number;
  unlocks: StudioToolId[];
};

export type StudioBand = {
  id: StudioBandId;
  name: string;
  ages: string;
  minAge: number;
  maxAge: number;
  pitch: string;
  canvasHint: string;
  missions: StudioMission[];
};

export type StudioRoomId =
  | "hub"
  | "color"
  | "animation"
  | "music"
  | "design"
  | "games"
  | "challenges"
  | "board"
  | "gallery"
  | "teams"
  | "shop"
  | "awards";

export const STUDIO_BANDS: StudioBand[] = [
  {
    id: "spark",
    name: "Spark",
    ages: "5–7",
    minAge: 5,
    maxAge: 7,
    pitch: "Big marks, friendly stamps, and short make-it missions.",
    canvasHint: "Use fat marks and stamps. Keep it simple and bright.",
    missions: [
      { id: "spark-sun", title: "Draw a sun", brief: "Stamp or paint a big sun. Fill the page with warmth.", xp: 25, unlocks: ["stamp-sun"] },
      { id: "spark-house", title: "My house", brief: "Add a house and a path. Who lives here?", xp: 25, unlocks: ["stamp-house"] },
      { id: "spark-smile", title: "Happy face", brief: "Make a face that looks glad. Use the smile stamp if you want.", xp: 25, unlocks: ["stamp-smile"] },
      { id: "spark-garden", title: "Color garden", brief: "Place three stamps and color around them.", xp: 25, unlocks: ["crayon"] },
    ],
  },
  {
    id: "maker",
    name: "Maker",
    ages: "8–10",
    minAge: 8,
    maxAge: 10,
    pitch: "Scenes, patterns, and the first real studio habits — including undo.",
    canvasHint: "Build a scene. Repeat shapes. Try, undo, try again.",
    missions: [
      { id: "maker-scene", title: "Story scene", brief: "A house, a tree, and someone arriving home.", xp: 25, unlocks: ["stamp-tree", "undo"] },
      { id: "maker-weather", title: "Weather day", brief: "Show sun, rain, or wind without writing a single word.", xp: 25, unlocks: ["stamp-star"] },
      { id: "maker-pattern", title: "Pattern play", brief: "Repeat one stamp in a rhythm across the page.", xp: 25, unlocks: ["stamp-boat"] },
      { id: "maker-gift", title: "Gift card", brief: "Design a card you would actually give someone.", xp: 25, unlocks: ["fine"] },
    ],
  },
  {
    id: "inventor",
    name: "Inventor",
    ages: "11–13",
    minAge: 11,
    maxAge: 13,
    pitch: "Layout, lettering, and product thinking on a guided grid.",
    canvasHint: "Use the grid. Leave margins. Make the title earn its space.",
    missions: [
      { id: "inventor-mark", title: "Logo mark", brief: "Invent a simple emblem that could live on a backpack.", xp: 30, unlocks: ["grid"] },
      { id: "inventor-poster", title: "Poster title", brief: "Letter a short title, then illustrate one supporting image.", xp: 30, unlocks: ["fine"] },
      { id: "inventor-city", title: "City block", brief: "Stack buildings on the grid. Vary height, keep a skyline.", xp: 30, unlocks: ["stamp-star"] },
      { id: "inventor-product", title: "Product sketch", brief: "Draw a store object three-quarter view, then add a price tag.", xp: 30, unlocks: ["undo"] },
    ],
  },
  {
    id: "atelier",
    name: "Atelier",
    ages: "14–17",
    minAge: 14,
    maxAge: 17,
    pitch: "Composition, brand study, and a small collection — full toolkit.",
    canvasHint: "Compose with intent. Limit the palette. Finish like a piece, not a doodle.",
    missions: [
      { id: "atelier-still", title: "Still life", brief: "Three objects, one light source, clear foreground and ground.", xp: 35, unlocks: ["grid", "fine"] },
      { id: "atelier-brand", title: "Brand study", brief: "A mark plus a wordmark. Keep them in one family.", xp: 35, unlocks: ["undo"] },
      { id: "atelier-editorial", title: "Editorial spread", brief: "Headline, one illustration, and a quiet margin.", xp: 35, unlocks: ["stamp-star"] },
      { id: "atelier-collection", title: "Mini collection", brief: "Save two related pieces that belong together.", xp: 35, unlocks: ["fine"] },
    ],
  },
];

const BASE_TOOLS: Record<StudioBandId, StudioToolId[]> = {
  spark: ["brush", "crayon"],
  maker: ["brush", "crayon", "undo", "stamp-sun", "stamp-house"],
  inventor: ["brush", "fine", "undo", "grid", "stamp-star"],
  atelier: [
    "brush",
    "fine",
    "undo",
    "grid",
    "stamp-sun",
    "stamp-house",
    "stamp-tree",
    "stamp-star",
    "stamp-boat",
  ],
};

export const STUDIO_ROOMS: Array<{
  id: Exclude<StudioRoomId, "hub">;
  title: string;
  blurb: string;
  minBand: StudioBandId;
}> = [
  { id: "color", title: "Coloring", blurb: "Missions, stamps, and the drawing canvas.", minBand: "spark" },
  { id: "music", title: "Music lab", blurb: "Play a scale and drum a four-beat.", minBand: "spark" },
  { id: "gallery", title: "Gallery", blurb: "Pieces saved on this device.", minBand: "spark" },
  { id: "challenges", title: "Challenges", blurb: "Daily, weekly, and monthly studio goals.", minBand: "spark" },
  { id: "awards", title: "Awards", blurb: "Badges earned from missions and games.", minBand: "spark" },
  { id: "games", title: "Games", blurb: "Memory match that pays Units.", minBand: "maker" },
  { id: "teams", title: "Teams", blurb: "Join a studio crew on this family ledger.", minBand: "maker" },
  { id: "animation", title: "Animation", blurb: "Four-frame flipbook, then play it back.", minBand: "inventor" },
  { id: "design", title: "Design", blurb: "Place a drawing on a tee mockup.", minBand: "inventor" },
  { id: "board", title: "Leaderboard", blurb: "Family rank versus studio peers.", minBand: "atelier" },
  { id: "shop", title: "Studio shop", blurb: "Spend Units on extra packs.", minBand: "atelier" },
];

const BAND_RANK: Record<StudioBandId, number> = {
  spark: 0,
  maker: 1,
  inventor: 2,
  atelier: 3,
};

export function bandForAge(age: number): StudioBand {
  const n = Number.isFinite(age) ? age : 10;
  return (
    STUDIO_BANDS.find((band) => n >= band.minAge && n <= band.maxAge) ??
    STUDIO_BANDS[1]
  );
}

export function bandById(id: StudioBandId): StudioBand {
  return STUDIO_BANDS.find((band) => band.id === id) ?? STUDIO_BANDS[1];
}

export function nextBand(id: StudioBandId): StudioBand | null {
  const index = STUDIO_BANDS.findIndex((band) => band.id === id);
  return STUDIO_BANDS[index + 1] ?? null;
}

export function toolsFor(bandId: StudioBandId, completedMissionIds: string[]) {
  const tools = new Set<StudioToolId>(BASE_TOOLS[bandId]);
  const band = bandById(bandId);
  for (const mission of band.missions) {
    if (completedMissionIds.includes(mission.id)) {
      for (const tool of mission.unlocks) tools.add(tool);
    }
  }
  return tools;
}

export function missionProgress(band: StudioBand, completedMissionIds: string[]) {
  const done = band.missions.filter((mission) =>
    completedMissionIds.includes(mission.id),
  ).length;
  return {
    done,
    total: band.missions.length,
    pct: Math.round((done / band.missions.length) * 100),
    complete: done >= band.missions.length,
  };
}

export function nextMission(band: StudioBand, completedMissionIds: string[]) {
  return (
    band.missions.find((mission) => !completedMissionIds.includes(mission.id)) ??
    null
  );
}

export function roomUnlocked(bandId: StudioBandId, roomId: StudioRoomId) {
  if (roomId === "hub") return true;
  const room = STUDIO_ROOMS.find((item) => item.id === roomId);
  if (!room) return false;
  return BAND_RANK[bandId] >= BAND_RANK[room.minBand];
}

export const STUDIO_SWATCHES = [
  "#1c1a16",
  "#45c58a",
  "#f1bd59",
  "#f06b6b",
  "#5ed4ff",
  "#f4f4f1",
  "#8a6420",
  "#272047",
] as const;
