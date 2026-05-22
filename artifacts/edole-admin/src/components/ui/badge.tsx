import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold leading-none transition-colors border",
  {
    variants: {
      variant: {
        default:
          "bg-primary/10 text-primary border-primary/20",
        secondary:
          "bg-secondary/8 text-secondary border-secondary/15",
        destructive:
          "bg-destructive/10 text-destructive border-destructive/20",
        outline:
          "text-foreground/70 border-border/70 bg-transparent",
        success:
          "bg-emerald-50 text-emerald-700 border-emerald-200",
        warning:
          "bg-amber-50 text-amber-700 border-amber-200",
        info:
          "bg-sky-50 text-sky-700 border-sky-200",
        navy:
          "bg-[#0F1A3A]/8 text-[#0F1A3A] border-[#0F1A3A]/15",
        gold:
          "bg-[#C8A24B]/10 text-[#8B6914] border-[#C8A24B]/25",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
