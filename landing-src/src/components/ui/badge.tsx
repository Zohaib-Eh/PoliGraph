import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium font-mono tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        outline: "border-border text-muted-foreground",
        close: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
        rfi: "border-amber-400/25 bg-amber-400/10 text-amber-300",
        esc: "border-rose-400/25 bg-rose-400/10 text-rose-300",
      },
    },
    defaultVariants: { variant: "default" },
  }
);
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
function Badge({ className, variant, ...props }: BadgeProps) { return <span className={cn(badgeVariants({ variant }), className)} {...props} />; }
export { Badge, badgeVariants };
