import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none outline-none focus-visible:ring-2 focus-visible:ring-accent/35 disabled:pointer-events-none disabled:opacity-45 transition-[scale,background-color,color,opacity,box-shadow] duration-150 ease-out active:not-disabled:scale-[0.96]",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-accent-foreground shadow-[var(--shadow-border)] hover:bg-accent/92",
        secondary:
          "bg-surface text-ink shadow-[var(--shadow-border)] hover:bg-surface-2",
        outline:
          "bg-transparent text-ink shadow-[var(--shadow-border)] hover:bg-surface",
        ghost: "bg-transparent text-ink hover:bg-surface-2",
        danger:
          "bg-danger text-danger-foreground hover:bg-danger/92",
        success:
          "bg-success text-success-foreground hover:bg-success/92",
        vault:
          "bg-vault text-vault-foreground hover:bg-vault/92",
      },
      size: {
        default: "h-11 rounded-md px-4 text-sm",
        sm: "h-9 rounded-sm px-3 text-sm",
        lg: "h-12 rounded-md px-5 text-sm",
        icon: "size-11 rounded-md",
        "icon-sm": "size-9 rounded-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
