import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb, Loader2 } from "lucide-react";
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

export function SuggestionDialog({ open, onOpenChange, onSuccess }: SuggestionDialogProps) {
  const { toast } = useToast();
  const [location] = useLocation();

  const initialModule = guessModule(location);
  const [form, setForm] = useState({
    title: "",
    category: "fonctionnalite",
    description: "",
    priority: "normale",
    module: initialModule || MODULE_NONE,
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) => {
      const payload = {
        title: data.title,
        category: data.category,
        description: data.description,
        priority: data.priority,
        module: data.module === MODULE_NONE ? undefined : data.module,
        currentUrl: window.location.href,
      };
      return apiFetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast({ title: "Suggestion envoyée", description: "Merci pour votre retour !" });
      const reset = guessModule(location);
      setForm({ title: "", category: "fonctionnalite", description: "", priority: "normale", module: reset || MODULE_NONE });
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
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            La page actuelle (<code className="font-mono">{location}</code>) sera transmise automatiquement pour contexte.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={!form.title.trim() || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Envoyer la suggestion
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
