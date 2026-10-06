import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none outline-none focus-visible:ring-2 focus-visible:ring-accent/35 disabled:pointer-events-none disabled:opacity-45 transition-[scale,background-color,color,opacity,box-shadow,translate] duration-150 ease-out active:not-disabled:scale-[0.96] hover:not-disabled:-translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-accent-foreground shadow-[var(--shadow-float)] hover:shadow-[var(--shadow-float-hover)] hover:bg-accent/92",
        secondary:
          "bg-surface text-ink shadow-[var(--shadow-float)] hover:shadow-[var(--shadow-float-hover)] hover:bg-surface-2",
        outline:
          "bg-transparent text-ink shadow-[var(--shadow-float)] hover:shadow-[var(--shadow-float-hover)] hover:bg-surface",
        ghost: "bg-transparent text-ink hover:bg-surface-2",
        danger:
          "bg-danger text-danger-foreground shadow-[var(--shadow-float)] hover:shadow-[var(--shadow-float-hover)] hover:bg-danger/92",
        success:
          "bg-success text-success-foreground shadow-[var(--shadow-float)] hover:shadow-[var(--shadow-float-hover)] hover:bg-success/92",
        vault:
          "bg-vault text-vault-foreground shadow-[var(--shadow-float)] hover:shadow-[var(--shadow-float-hover)] hover:bg-vault/92",
      },
      size: {
        default: "h-11 rounded-2xl px-5 text-sm",
        sm: "h-9 rounded-xl px-4 text-sm",
        lg: "h-12 rounded-2xl px-6 text-sm",
        icon: "size-11 rounded-2xl",
        "icon-sm": "size-9 rounded-xl",
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
