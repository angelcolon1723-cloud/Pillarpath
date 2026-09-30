import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "font-display text-lg font-semibold leading-snug tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

function CardHint({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-sm text-muted", className)} {...props} />
  );
}

export { Card, CardTitle, CardHint };
