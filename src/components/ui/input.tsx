import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full rounded-md bg-surface-2 px-3.5 text-sm text-ink outline-none shadow-[var(--shadow-border)] placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-accent/35 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-sm font-medium text-muted",
        className,
      )}
      {...props}
    />
  );
}

function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-11 w-full appearance-none rounded-md bg-surface-2 bg-[length:12px] bg-[right_14px_center] bg-no-repeat px-3.5 pr-10 text-sm text-ink outline-none shadow-[var(--shadow-border)] focus-visible:ring-2 focus-visible:ring-accent/35",
        className,
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236e6a62' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>")`,
      }}
      {...props}
    >
      {children}
    </select>
  );
}

export { Input, FieldLabel, NativeSelect };
