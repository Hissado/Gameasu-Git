import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb, Loader2, ImagePlus, X, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";

interface SuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const CATEGORIES = [
  { value: "fonctionnalite", label: "Fonctionnalité" },
  { value: "ux", label: "Interface / UX" },
  { value: "performance", label: "Performance" },
  { value: "bug", label: "Bug" },
  { value: "rapport", label: "Rapport" },
  { value: "nouveau_module", label: "Nouveau module" },
  { value: "autre", label: "Autre" },
];

const PRIORITIES = [
  { value: "faible", label: "Faible" },
  { value: "normale", label: "Normale" },
  { value: "haute", label: "Haute" },
  { value: "critique", label: "Critique" },
];

const ERP_MODULES = [
  "Tableau de bord", "CRM / Ventes", "Projets", "Tâches", "Clients", "Factures",
  "Paiements", "Comptabilité", "Équipements", "Locations", "Stocks", "Achats",
  "RH / Paie", "Présences", "Messagerie", "FP&A / Budgets", "Rapports", "Paramètres",
];

const MODULE_NONE = "__none__";

async function uploadScreenshot(file: File): Promise<string> {
  // 1. Request a presigned URL
  const { uploadURL, objectPath } = await apiFetch<{ uploadURL: string; objectPath: string }>(
    "/api/storage/uploads/request-url",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
    },
  );

  // 2. Upload directly to the presigned URL
  await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  return objectPath;
}

export function SuggestionDialog({ open, onOpenChange, onSuccess }: SuggestionDialogProps) {
  const { toast } = useToast();
  const [location] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialModule = guessModule(location);
  const [form, setForm] = useState({
    title: "",
    category: "fonctionnalite",
    description: "",
    priority: "normale",
    module: initialModule || MODULE_NONE,
  });
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Fichier invalide", description: "Seules les images sont acceptées.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Fichier trop lourd", description: "Max 5 Mo pour un screenshot.", variant: "destructive" });
      return;
    }
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setScreenshotPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    const reset = guessModule(location);
    setForm({ title: "", category: "fonctionnalite", description: "", priority: "normale", module: reset || MODULE_NONE });
    setScreenshotFile(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      let screenshotUrl: string | undefined;
      if (screenshotFile) {
        setUploading(true);
        try {
          screenshotUrl = await uploadScreenshot(screenshotFile);
        } finally {
          setUploading(false);
        }
      }
      const payload = {
        title: data.title,
        category: data.category,
        description: data.description,
        priority: data.priority,
        module: data.module === MODULE_NONE ? undefined : data.module,
        currentUrl: window.location.href,
        screenshotUrl,
      };
      return apiFetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast({ title: "Suggestion envoyée", description: "Merci pour votre retour !" });
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'envoyer la suggestion.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    mutation.mutate(form);
  };

  const isPending = mutation.isPending || uploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Faire une suggestion
          </DialogTitle>
          <DialogDescription>
            Partagez votre idée ou signalez un problème. Notre équipe produit examine toutes les suggestions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="suggestion-title">Titre <span className="text-red-500">*</span></Label>
            <Input
              id="suggestion-title"
              placeholder="Décrivez votre idée en quelques mots…"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Priorité</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Module concerné</Label>
            <Select value={form.module} onValueChange={(v) => setForm((f) => ({ ...f, module: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MODULE_NONE}>Général / Non spécifique</SelectItem>
                {ERP_MODULES.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="suggestion-desc">Description détaillée</Label>
            <Textarea
              id="suggestion-desc"
              placeholder="Décrivez le problème actuel, la solution souhaitée, et pourquoi cela serait utile…"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Screenshot upload */}
          <div className="space-y-1.5">
            <Label>Capture d'écran (optionnel)</Label>
            {screenshotPreview ? (
              <div className="relative inline-block">
                <img
                  src={screenshotPreview}
                  alt="Aperçu"
                  className="max-h-32 rounded-lg border object-contain"
                />
                <button
                  type="button"
                  onClick={removeScreenshot}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/80 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-600">
                  <CheckCircle2 className="w-3 h-3" />
                  {screenshotFile?.name}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors w-full"
              >
                <ImagePlus className="w-4 h-4 shrink-0" />
                Ajouter une capture d'écran (max 5 Mo)
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            Page actuelle : <code className="font-mono text-[10px]">{location}</code> — transmise automatiquement.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { onOpenChange(false); resetForm(); }}>
              Annuler
            </Button>
            <Button type="submit" disabled={!form.title.trim() || isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {uploading ? "Upload en cours…" : "Envoyer la suggestion"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function guessModule(location: string): string {
  if (location.startsWith("/crm")) return "CRM / Ventes";
  if (location.startsWith("/projets")) return "Projets";
  if (location.startsWith("/tasks")) return "Tâches";
  if (location.startsWith("/factures")) return "Factures";
  if (location.startsWith("/comptabilite")) return "Comptabilité";
  if (location.startsWith("/equipements")) return "Équipements";
  if (location.startsWith("/locations")) return "Locations";
  if (location.startsWith("/stock")) return "Stocks";
  if (location.startsWith("/achats")) return "Achats";
  if (location.startsWith("/rh")) return "RH / Paie";
  if (location.startsWith("/presences")) return "Présences";
  if (location.startsWith("/messaging")) return "Messagerie";
  if (location.startsWith("/fpa")) return "FP&A / Budgets";
  if (location.startsWith("/rapports")) return "Rapports";
  if (location.startsWith("/clients")) return "Clients";
  if (location === "/") return "Tableau de bord";
  return "";
}
