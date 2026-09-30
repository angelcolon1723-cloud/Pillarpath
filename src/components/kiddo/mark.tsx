import { cn } from "@/lib/utils";

export function LedgerMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-8", className)}
    >
      <rect
        x="3"
        y="4"
        width="26"
        height="24"
        rx="5"
        fill="currentColor"
        className="text-accent"
      />
      <rect x="8" y="10" width="16" height="1.6" rx="0.8" fill="currentColor" className="text-bg" />
      <rect x="8" y="15" width="12" height="1.6" rx="0.8" fill="currentColor" className="text-bg" opacity="0.75" />
      <rect x="8" y="20" width="9" height="1.6" rx="0.8" fill="currentColor" className="text-bg" opacity="0.5" />
    </svg>
  );
}
