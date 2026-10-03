export type ProductIcon =
  | "blocks"
  | "backpack"
  | "book"
  | "art"
  | "ball"
  | "science";

export const AWARD_REASONS = [
  "Completed homework",
  "Cleaned room",
  "Helped with dishes",
  "Read for 20 minutes",
  "Kindness at school",
] as const;

export const CHORES = [
  { id: "homework", name: "Finish homework", amount: 5 },
  { id: "room", name: "Clean your room", amount: 8 },
  { id: "dishes", name: "Help with dishes", amount: 4 },
] as const;
