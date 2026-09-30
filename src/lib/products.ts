export type ProductIcon =
  | "blocks"
  | "backpack"
  | "book"
  | "art"
  | "ball"
  | "science";

export type Product = {
  id: string;
  name: string;
  price: number;
  blurb: string;
  icon: ProductIcon;
};

export const PRODUCTS: Product[] = [
  {
    id: "blocks",
    name: "Building Blocks Set",
    price: 18,
    blurb: "120 pieces, wooden finish",
    icon: "blocks",
  },
  {
    id: "pack",
    name: "Kids Backpack",
    price: 22,
    blurb: "Everyday school bag",
    icon: "backpack",
  },
  {
    id: "books",
    name: "Story Book Pack",
    price: 12,
    blurb: "Three illustrated titles",
    icon: "book",
  },
  {
    id: "art",
    name: "Art Supply Kit",
    price: 15,
    blurb: "Pencils, paper, watercolors",
    icon: "art",
  },
  {
    id: "ball",
    name: "Sports Ball",
    price: 10,
    blurb: "Size 3, indoor/outdoor",
    icon: "ball",
  },
  {
    id: "science",
    name: "Science Kit",
    price: 25,
    blurb: "Safe experiments at home",
    icon: "science",
  },
];

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
