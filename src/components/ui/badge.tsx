import { cn } from "@/lib/utils";

function Badge({
  className,
  tone = "accent",
  ...props
}: React.ComponentProps<"span"> & {
  tone?: "accent" | "danger" | "muted" | "warn";
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums leading-none",
        tone === "accent" && "bg-accent text-accent-foreground",
        tone === "danger" && "bg-danger text-danger-foreground",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "muted" && "bg-surface-2 text-muted",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
