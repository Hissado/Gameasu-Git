import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { MarketingShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, Power, Copy, Eye,
  FormInput, GripVertical, X, ChevronUp, ChevronDown,
} from "lucide-react";

type FormField = {
  name: string; label: string;
  type: "text" | "email" | "phone" | "textarea" | "select" | "checkbox";
  required: boolean; options?: string[]; placeholder?: string;
};

type MarketingForm = {
  id: string; name: string; slug: string; description?: string;
  fields: FormField[]; confirmationMessage?: string;
  sourceTag?: string; automationId?: string;
  isActive: boolean; submissionsCount: number; createdAt: string;
};

const FIELD_TYPES = [
  { k: "text", l: "Texte court" },
  { k: "email", l: "Email" },
  { k: "phone", l: "Téléphone" },
  { k: "textarea", l: "Texte long" },
  { k: "select", l: "Liste déroulante" },
  { k: "checkbox", l: "Case à cocher" },
] as const;

const DEFAULT_FIELDS: FormField[] = [
  { name: "nom", label: "Nom complet", type: "text", required: true, placeholder: "Jean Dupont" },
  { name: "email", label: "Email", type: "email", required: true, placeholder: "jean@exemple.com" },
  { name: "phone", label: "Téléphone", type: "phone", required: false, placeholder: "+228 XX XX XX XX" },
  { name: "entreprise", label: "Entreprise", type: "text", required: false, placeholder: "" },
  { name: "message", label: "Message", type: "textarea", required: false, placeholder: "Votre message…" },
];

function slugify(str: string) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function FieldRow({ field, index, total, onChange, onRemove, onMove }: {
  field: FormField; index: number; total: number;
  onChange: (f: FormField) => void; onRemove: () => void; onMove: (d: -1 | 1) => void;
}) {
  return (
    <div className="border rounded-lg p-3 bg-muted/10 space-y-2">
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-semibold text-muted-foreground w-5">{index + 1}.</span>
        <Input
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value, name: slugify(e.target.value) || field.name })}
          placeholder="Libellé du champ" className="flex-1 h-8 text-sm"
        />
        <select value={field.type} onChange={(e) => onChange({ ...field, type: e.target.value as FormField["type"] })}
          className="border rounded h-8 px-2 text-xs bg-background">
          {FIELD_TYPES.map((t) => <option key={t.k} value={t.k}>{t.l}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs whitespace-nowrap cursor-pointer">
          <input type="checkbox" checked={field.required} onChange={(e) => onChange({ ...field, required: e.target.checked })} />
          Requis
        </label>
        <div className="flex gap-0.5 shrink-0">
          <button onClick={() => onMove(-1)} disabled={index === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
          <button onClick={onRemove} className="p-1 rounded hover:bg-destructive/10 text-destructive"><X className="w-3 h-3" /></button>
        </div>
      </div>
      {field.type === "select" && (
        <Input value={(field.options || []).join(", ")}
          onChange={(e) => onChange({ ...field, options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
          placeholder="Option 1, Option 2, Option 3" className="text-xs h-8 ml-9" />
      )}
      {field.type !== "checkbox" && field.type !== "select" && (
        <Input value={field.placeholder || ""} onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
          placeholder="Texte indicatif…" className="text-xs h-8 ml-9 text-muted-foreground" />
      )}
    </div>
  );
}

function FormPreview({ fields, confirmationMessage }: { fields: FormField[]; confirmationMessage?: string }) {
  return (
    <div className="bg-white rounded-lg border p-6 space-y-4 max-w-md mx-auto">
      {fields.map((f, i) => (
        <div key={i}>
          <label className="block text-sm font-medium mb-1">
            {f.label}{f.required && <span className="text-destructive ml-0.5">*</span>}
          </label>
          {f.type === "textarea" ? (
            <div className="border rounded-md p-2 h-20 bg-gray-50 text-xs text-muted-foreground">{f.placeholder}</div>
          ) : f.type === "select" ? (
            <div className="border rounded-md p-2 h-10 bg-gray-50 text-xs text-muted-foreground flex items-center justify-between">
              <span>{f.options?.[0] || "Choisir…"}</span><ChevronDown className="w-3 h-3" />
            </div>
          ) : f.type === "checkbox" ? (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled className="w-4 h-4" />{f.placeholder || f.label}</label>
          ) : (
            <div className="border rounded-md p-2 h-10 bg-gray-50 text-xs text-muted-foreground">{f.placeholder}</div>
          )}
        </div>
      ))}
      <button className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium">Envoyer</button>
      {confirmationMessage && <p className="text-xs text-center text-muted-foreground italic">{confirmationMessage}</p>}
    </div>
  );
}

export default function FormsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<MarketingForm | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewForm, setPreviewForm] = useState<MarketingForm | null>(null);
  const [tab, setTab] = useState<"fields" | "settings" | "preview">("fields");

  const emptyForm = () => ({
    name: "", slug: "", description: "", fields: [...DEFAULT_FIELDS],
    confirmationMessage: "Votre demande a bien été enregistrée. Nous vous recontacterons prochainement.",
    sourceTag: "form", automationId: "",
  });
  const [form, setForm] = useState<ReturnType<typeof emptyForm>>(emptyForm());

  const { data, isLoading } = useQuery<{ data: MarketingForm[] }>({
    queryKey: ["marketing-forms"],
    queryFn: () => apiFetch("/api/marketing/forms"),
  });
  const { data: automationsData } = useQuery<{ data: { id: string; name: string }[] }>({
    queryKey: ["marketing-automations-list"],
    queryFn: () => apiFetch("/api/marketing/automations"),
  });

  const upsert = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name, slug: form.slug || slugify(form.name),
        description: form.description || undefined,
        fields: form.fields,
        confirmationMessage: form.confirmationMessage || undefined,
        sourceTag: form.sourceTag || "form",
        automationId: form.automationId || undefined,
        isActive: edit?.isActive ?? true,
      };
      return edit
        ? apiFetch(`/api/marketing/forms/${edit.id}`, { method: "PUT", body: payload })
        : apiFetch("/api/marketing/forms", { method: "POST", body: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-forms"] });
      setOpen(false); setEdit(null); setForm(emptyForm());
      toast({ title: edit ? "Formulaire modifié" : "Formulaire créé" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const toggle = useMutation({
    mutationFn: (f: MarketingForm) => apiFetch(`/api/marketing/forms/${f.id}`, {
      method: "PUT", body: { name: f.name, slug: f.slug, fields: f.fields, isActive: !f.isActive },
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-forms"] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/marketing/forms/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketing-forms"] }); toast({ title: "Formulaire supprimé" }); },
  });

  const openEdit = (f: MarketingForm) => {
    setEdit(f);
    setForm({ name: f.name, slug: f.slug, description: f.description || "", fields: JSON.parse(JSON.stringify(f.fields)),
      confirmationMessage: f.confirmationMessage || "", sourceTag: f.sourceTag || "form", automationId: f.automationId || "" });
    setTab("fields"); setOpen(true);
  };

  const updateField = (i: number, f: FormField) => setForm({ ...form, fields: form.fields.map((x, idx) => idx === i ? f : x) });
  const removeField = (i: number) => setForm({ ...form, fields: form.fields.filter((_, idx) => idx !== i) });
  const moveField = (i: number, dir: -1 | 1) => {
    const fields = [...form.fields]; const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    [fields[i], fields[j]] = [fields[j], fields[i]]; setForm({ ...form, fields });
  };

  const getPublicUrl = (f: MarketingForm) => `${window.location.origin}/api/public/forms/${f.id}`;
  const copyLink = (f: MarketingForm) => { navigator.clipboard.writeText(getPublicUrl(f)); toast({ title: "Lien copié" }); };

  return (
    <MarketingShell
      title="Formulaires publics"
      subtitle="Capturez des leads via des formulaires hébergés"
      actions={<Button onClick={() => { setEdit(null); setForm(emptyForm()); setTab("fields"); setOpen(true); }}>
        <Plus className="w-4 h-4 mr-2" />Nouveau formulaire
      </Button>}
    >
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Chargement…</div>
      ) : (data?.data ?? []).length === 0 ? (
        <div className="py-16 text-center">
          <FormInput className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <div className="font-semibold text-lg mb-1">Aucun formulaire</div>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
            Créez un formulaire public pour capturer des prospects automatiquement depuis votre site.
          </p>
          <Button onClick={() => { setEdit(null); setForm(emptyForm()); setTab("fields"); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />Créer un formulaire
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {data!.data.map((f) => (
            <Card key={f.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{f.name}</div>
                    {f.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{f.description}</div>}
                  </div>
                  <Badge className={f.isActive ? "bg-emerald-100 text-emerald-700 border-0" : "bg-slate-100 text-slate-600 border-0"}>
                    {f.isActive ? "Actif" : "Inactif"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-muted/30 rounded p-2">
                    <div className="text-xl font-bold text-primary">{f.submissionsCount}</div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Soumissions</div>
                  </div>
                  <div className="bg-muted/30 rounded p-2">
                    <div className="text-xl font-bold">{f.fields.length}</div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Champs</div>
                  </div>
                </div>
                <div className="text-xs font-mono text-muted-foreground truncate bg-muted/20 px-2 py-1 rounded">/{f.slug}</div>
                <div className="flex gap-1 flex-wrap">
                  <Button size="sm" variant="outline" className="flex-1 min-w-0" onClick={() => copyLink(f)}>
                    <Copy className="w-3 h-3 mr-1" />Lien
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 min-w-0" onClick={() => { setPreviewForm(f); setPreviewOpen(true); }}>
                    <Eye className="w-3 h-3 mr-1" />Aperçu
                  </Button>
                  <Button size="icon" variant="ghost" title={f.isActive ? "Désactiver" : "Activer"} onClick={() => toggle.mutate(f)}>
                    <Power className={`w-4 h-4 ${f.isActive ? "text-emerald-600" : ""}`} />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(f)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Supprimer "${f.name}" ?`)) del.mutate(f.id); }}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog création/édition */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit ? "Modifier le formulaire" : "Nouveau formulaire"}</DialogTitle></DialogHeader>

          <div className="flex border-b mb-4">
            {(["fields", "settings", "preview"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {t === "fields" ? "Champs" : t === "settings" ? "Paramètres" : "Aperçu"}
              </button>
            ))}
          </div>

          {tab === "fields" && (
            <div className="space-y-2">
              {form.fields.map((f: FormField, i: number) => (
                <FieldRow key={i} field={f} index={i} total={form.fields.length}
                  onChange={(u) => updateField(i, u)} onRemove={() => removeField(i)} onMove={(d) => moveField(i, d)} />
              ))}
              <Button variant="outline" size="sm" className="w-full"
                onClick={() => setForm({ ...form, fields: [...form.fields, { name: `champ_${form.fields.length + 1}`, label: "Nouveau champ", type: "text", required: false }] })}>
                <Plus className="w-4 h-4 mr-1" />Ajouter un champ
              </Button>
            </div>
          )}

          {tab === "settings" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium mb-1 block">Nom du formulaire *</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugify(e.target.value) })} placeholder="Demande de devis" />
                </div>
                <div><label className="text-xs font-medium mb-1 block">Slug (URL)</label>
                  <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} placeholder="demande-de-devis" />
                </div>
              </div>
              <div><label className="text-xs font-medium mb-1 block">Description</label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Description courte du formulaire…" />
              </div>
              <div><label className="text-xs font-medium mb-1 block">Message de confirmation</label>
                <Textarea value={form.confirmationMessage} onChange={(e) => setForm({ ...form, confirmationMessage: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium mb-1 block">Tag source</label>
                  <Input value={form.sourceTag} onChange={(e) => setForm({ ...form, sourceTag: e.target.value })} placeholder="form-contact" />
                </div>
                <div><label className="text-xs font-medium mb-1 block">Automatisation</label>
                  <select value={form.automationId} onChange={(e) => setForm({ ...form, automationId: e.target.value })}
                    className="w-full border rounded h-10 px-3 text-sm bg-background">
                    <option value="">— Aucune —</option>
                    {(automationsData?.data || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {tab === "preview" && <FormPreview fields={form.fields} confirmationMessage={form.confirmationMessage} />}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending || !form.name || form.fields.length === 0}>
              {edit ? "Enregistrer" : "Créer le formulaire"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog aperçu lecture seule */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Aperçu — {previewForm?.name}</DialogTitle></DialogHeader>
          {previewForm && <FormPreview fields={previewForm.fields} confirmationMessage={previewForm.confirmationMessage} />}
          {previewForm && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t">
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{getPublicUrl(previewForm)}</code>
              <Button size="sm" variant="outline" onClick={() => copyLink(previewForm)}><Copy className="w-3 h-3 mr-1" />Copier</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MarketingShell>
  );
}
