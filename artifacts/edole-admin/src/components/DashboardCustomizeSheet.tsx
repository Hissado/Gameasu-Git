import React, { useState, useRef } from "react";
import { Settings2, GripVertical, RotateCcw, Save, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { type WidgetConfig, type WidgetId, WIDGET_META } from "@/hooks/useDashboardConfig";

interface Props {
  open: boolean;
  onClose: () => void;
  widgets: WidgetConfig[];
  onSave: (widgets: WidgetConfig[]) => void;
  onReset: () => void;
  isSaving: boolean;
}

export function DashboardCustomizeSheet({ open, onClose, widgets, onSave, onReset, isSaving }: Props) {
  const [local, setLocal] = useState<WidgetConfig[]>([]);
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  React.useEffect(() => {
    if (open) setLocal([...widgets]);
  }, [open, widgets]);

  function toggleWidget(id: WidgetId) {
    setLocal((prev) => prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)));
  }

  function handleDragStart(index: number) {
    dragIndex.current = index;
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    dragOverIndex.current = index;
  }

  function handleDrop() {
    if (dragIndex.current === null || dragOverIndex.current === null) return;
    if (dragIndex.current === dragOverIndex.current) return;
    const next = [...local];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(dragOverIndex.current, 0, moved);
    setLocal(next);
    dragIndex.current = null;
    dragOverIndex.current = null;
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...local];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setLocal(next);
  }

  function moveDown(index: number) {
    if (index === local.length - 1) return;
    const next = [...local];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setLocal(next);
  }

  const enabledCount = local.filter((w) => w.enabled).length;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-base">Personnaliser le tableau de bord</SheetTitle>
              <SheetDescription className="text-xs mt-0.5">
                Activez, désactivez et réorganisez les widgets par glisser-déposer.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold mb-3">
            {enabledCount} widget{enabledCount > 1 ? "s" : ""} affiché{enabledCount > 1 ? "s" : ""}
          </p>
          {local.map((widget, index) => {
            const meta = WIDGET_META[widget.id as WidgetId];
            return (
              <div
                key={widget.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={handleDrop}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border bg-white transition-all cursor-grab active:cursor-grabbing select-none",
                  widget.enabled
                    ? "border-slate-200 hover:border-primary/30 hover:shadow-sm"
                    : "border-slate-100 bg-slate-50 opacity-60",
                )}
              >
                <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-semibold leading-tight", !widget.enabled && "text-muted-foreground")}>
                    {meta?.label ?? widget.id}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {meta?.description}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs"
                    aria-label="Monter"
                  >▲</button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={index === local.length - 1}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs"
                    aria-label="Descendre"
                  >▼</button>
                  <Switch
                    checked={widget.enabled}
                    onCheckedChange={() => toggleWidget(widget.id as WidgetId)}
                    aria-label={widget.enabled ? "Masquer ce widget" : "Afficher ce widget"}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <SheetFooter className="p-4 border-t gap-2 flex-col sm:flex-row">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { onReset(); onClose(); }}
            disabled={isSaving}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Réinitialiser
          </Button>
          <Button
            size="sm"
            onClick={() => { onSave(local); onClose(); }}
            disabled={isSaving || enabledCount === 0}
            className="gap-1.5 flex-1"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
