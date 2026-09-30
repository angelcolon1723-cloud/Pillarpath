import {
  Backpack,
  BookOpen,
  Boxes,
  Circle,
  FlaskConical,
  Palette,
} from "lucide-react";
import type { ProductIcon as ProductIconId } from "@/lib/products";
import { cn } from "@/lib/utils";

const MAP = {
  blocks: Boxes,
  backpack: Backpack,
  book: BookOpen,
  art: Palette,
  ball: Circle,
  science: FlaskConical,
} as const;

export function ProductIcon({
  name,
  className,
}: {
  name: ProductIconId;
  className?: string;
}) {
  const Icon = MAP[name];
  return <Icon className={cn("size-6", className)} strokeWidth={1.6} />;
}
