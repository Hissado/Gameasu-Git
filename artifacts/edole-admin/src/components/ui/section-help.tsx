import { useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { getHelpContent } from "@/lib/help-content";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SectionHelpProps {
  id: string;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Icône ⓘ avec tooltip contextuel, branché sur le dictionnaire centralisé.
 * Desktop : apparaît au survol. Mobile : bascule au clic.
 * À placer à côté du label d'un onglet, d'un titre de section ou d'un bouton ambigu.
 *
 * Exemple : <SectionHelp id="settings.profile" />
 */
export function SectionHelp({ id, className, side = "top" }: SectionHelpProps) {
  const content = getHelpContent(id);
  const [open, setOpen] = useState(false);

  if (!content) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center w-3.5 h-3.5 shrink-0",
              "text-muted-foreground/40 hover:text-primary/70 transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-full",
              className
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            onBlur={() => setOpen(false)}
            aria-label="Description de la section"
          >
            <Info className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-[260px] text-[11.5px] leading-relaxed bg-popover text-popover-foreground border shadow-md z-50"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
