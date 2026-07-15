import React, { useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FieldTooltipProps {
  content: string;
  className?: string;
}

export function FieldTooltip({ content, className }: FieldTooltipProps) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center w-4 h-4 rounded-full",
              "text-muted-foreground/50 hover:text-primary transition-colors shrink-0",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              className
            )}
            onClick={() => setOpen((v) => !v)}
            onBlur={() => setOpen(false)}
            aria-label="Plus d'informations"
          >
            <HelpCircle className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[260px] text-[11.5px] leading-relaxed bg-popover text-popover-foreground border shadow-md"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface FieldHintProps {
  text?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * FieldHint — two modes:
 *  - `<FieldHint text="..." />` → HelpCircle icon + Radix tooltip (inline aide sur champ)
 *  - `<FieldHint>texte</FieldHint>` → texte italic discret sous le champ (mode historique)
 */
export function FieldHint({ text, children, className }: FieldHintProps) {
  if (text !== undefined) {
    return <FieldTooltip content={text} className={className} />;
  }
  return (
    <p
      className={cn(
        "text-[11px] text-muted-foreground/65 italic mt-0.5 leading-relaxed",
        className
      )}
    >
      {children}
    </p>
  );
}
