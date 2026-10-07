/* ------------------------------------------------------------------ */
/* Emotion Codex — every feeling has a name. Naming it makes it smaller.*/
/* ------------------------------------------------------------------ */

export interface Emotion {
  id: string;
  name: string;
  family: string;
  icon: string;
  color: string;
  whisper: string;
  truth: string;
}

export const EMOTIONS: Emotion[] = [
  {
    id: "doubt",
    name: "Doubt",
    family: "The Shivers",
    icon: "😨",
    color: "#a78bfa",
    whisper: "What if you can't do it?",
    truth: "You've done hard things before. You'll do this too.",
  },
  {
    id: "impulse",
    name: "Impulse",
    family: "The Burns",
    icon: "😡",
    color: "#ef4444",
    whisper: "Do it NOW! Don't think!",
    truth: "Waiting is a superpower. The best choices aren't rushed.",
  },
  {
    id: "loneliness",
    name: "Loneliness",
    family: "The Grays",
    icon: "😔",
    color: "#64748b",
    whisper: "Nobody cares anyway.",
    truth: "You matter more than you know. Reach out — someone's waiting.",
  },
  {
    id: "shame",
    name: "Shame",
    family: "The Hiders",
    icon: "😳",
    color: "#8b5cf6",
    whisper: "You're not good enough.",
    truth: "Mistakes don't define you. What you do next does.",
  },
  {
    id: "anger",
    name: "Anger",
    family: "The Burns",
    icon: "🔥",
    color: "#f97316",
    whisper: "It's not fair! Lash out!",
    truth: "Anger is energy. Point it at the problem, not people.",
  },
  {
    id: "fear",
    name: "Fear",
    family: "The Shivers",
    icon: "🌩️",
    color: "#38bdf8",
    whisper: "Something bad is coming.",
    truth: "Courage isn't no fear — it's moving forward with it.",
  },
  {
    id: "jealousy",
    name: "Jealousy",
    family: "The Burns",
    icon: "👀",
    color: "#22c55e",
    whisper: "Why do THEY get it?",
    truth: "Someone else's win isn't your loss. Your time is coming.",
  },
  {
    id: "sadness",
    name: "Sadness",
    family: "The Grays",
    icon: "💧",
    color: "#60a5fa",
    whisper: "Nothing will feel good again.",
    truth: "Feelings are weather. This storm will pass.",
  },
  {
    id: "worry",
    name: "Worry",
    family: "The Shivers",
    icon: "🌀",
    color: "#c084fc",
    whisper: "What if everything goes wrong?",
    truth: "Most worries never happen. Handle today — that's enough.",
  },
  {
    id: "rejection",
    name: "Rejection",
    family: "The Grays",
    icon: "💔",
    color: "#f472b6",
    whisper: "They don't want you.",
    truth: "One 'no' isn't every 'no.' The right people will say yes.",
  },
  {
    id: "guilt",
    name: "Guilt",
    family: "The Hiders",
    icon: "⚖️",
    color: "#a3a3a3",
    whisper: "It's all your fault.",
    truth: "Guilt means you care. Make it right, then let it go.",
  },
  {
    id: "overwhelm",
    name: "Overwhelm",
    family: "The Storms",
    icon: "🌪️",
    color: "#94a3b8",
    whisper: "It's all too much.",
    truth: "One step. Just one. Then the next one.",
  },
];

const STORAGE_KEY = "pillarpath-emotion-codex";

export function getEncounters(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function recordEncounter(emotionId: string): Record<string, number> {
  const e = getEncounters();
  e[emotionId] = (e[emotionId] || 0) + 1;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(e));
  } catch {
    /* ignore */
  }
  return e;
}
