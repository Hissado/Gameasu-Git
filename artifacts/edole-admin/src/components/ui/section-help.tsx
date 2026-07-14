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
 * Icône ⓘ avec tooltip contextuel branché sur le dictionnaire centralisé.
 * Utilise un <span> (pas un <button>) pour rester valide quand on l'imbrique
 * dans un TabsTrigger ou tout autre bouton natif.
 * Desktop : survol → tooltip. Mobile : clic → bascule.
 */
export function SectionHelp({ id, className, side = "top" }: SectionHelpProps) {
  const content = getHelpContent(id);
  const [open, setOpen] = useState(false);

  if (!content) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          {/* span au lieu de button → valide HTML même à l'intérieur d'un <button> */}
          <span
            role="img"
            aria-label="Description de la section"
            className={cn(
              "inline-flex items-center justify-center w-3.5 h-3.5 shrink-0 cursor-help",
              "text-muted-foreground/40 hover:text-primary/70 transition-colors",
              "focus-visible:outline-none rounded-full",
              className
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            <Info className="w-3 h-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-[260px] text-[11.5px] leading-relaxed bg-popover text-popover-foreground border shadow-md z-50"
          onPointerDownOutside={() => setOpen(false)}
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
