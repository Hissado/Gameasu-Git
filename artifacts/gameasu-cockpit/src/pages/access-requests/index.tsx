import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  User, Building2, Mail, Phone, Globe, Calendar, Tag,
  Search, RefreshCw, ChevronRight, CheckCircle2,
} from "lucide-react";

type AccessRequest = {
  id: string;
  contactName: string;
  contactFunction: string | null;
  contactEmail: string;
  contactPhone: string | null;
  contactPreference: string;
  orgName: string;
  orgSector: string | null;
  orgDomain: string | null;
  orgSize: string | null;
  estimatedUsers: string | null;
  country: string | null;
  city: string | null;
  desiredModules: string[];
  mainNeed: string | null;
  message: string | null;
  status: string;
  notes: string | null;
  source: string;
  confirmationSent: boolean;
  notificationSent: boolean;
  createdAt: string;
  contactedAt: string | null;
};

const STATUS_OPTIONS = [
  { value: "all",          label: "Tous les statuts" },
  { value: "new",          label: "Nouveau" },
  { value: "to_contact",   label: "À contacter" },
  { value: "contacted",    label: "Contacté" },
  { value: "demo_planned", label: "Démo planifiée" },
  { value: "qualifying",   label: "En qualification" },
  { value: "offer_sent",   label: "Offre envoyée" },
  { value: "converted",    label: "Converti en client" },
  { value: "rejected",     label: "Rejeté" },
];

const STATUS_COLORS: Record<string, string> = {
  new:          "bg-blue-100 text-blue-700 border-blue-200",
  to_contact:   "bg-amber-100 text-amber-700 border-amber-200",
  contacted:    "bg-sky-100 text-sky-700 border-sky-200",
  demo_planned: "bg-violet-100 text-violet-700 border-violet-200",
  qualifying:   "bg-orange-100 text-orange-700 border-orange-200",
  offer_sent:   "bg-indigo-100 text-indigo-700 border-indigo-200",
  converted:    "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected:     "bg-red-100 text-red-700 border-red-200",
};

function statusLabel(s: string) {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {statusLabel(status)}
    </span>
  );
}

function DetailDialog({ req, onClose }: { req: AccessRequest; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(req.status);
  const [notes, setNotes] = useState(req.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await apiFetch(`/api/cockpit/access-requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      qc.invalidateQueries({ queryKey: ["cockpit/access-requests"] });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const prefLabel = req.contactPreference === "whatsapp" ? "WhatsApp" : req.contactPreference === "phone" ? "Téléphone" : "Email";

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-4 h-4 text-primary" />
            {req.orgName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Contact */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Contact</p>
              <p className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-muted-foreground" /><strong>{req.contactName}</strong>{req.contactFunction && <span className="text-muted-foreground">· {req.contactFunction}</span>}</p>
              <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-muted-foreground" /><a href={`mailto:${req.contactEmail}`} className="text-blue-600 hover:underline">{req.contactEmail}</a></p>
              {req.contactPhone && <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-muted-foreground" />{req.contactPhone}</p>}
              <p className="text-xs text-muted-foreground">Préfère : <strong>{prefLabel}</strong></p>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Organisation</p>
              {req.orgSector && <p className="text-muted-foreground">{req.orgSector}</p>}
              {req.orgDomain && <p className="text-muted-foreground">{req.orgDomain}</p>}
              {req.orgSize && <p className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-muted-foreground" />{req.orgSize}</p>}
              {req.estimatedUsers && <p className="text-muted-foreground">{req.estimatedUsers} utilisateurs estimés</p>}
              {(req.city || req.country) && <p className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-muted-foreground" />{[req.city, req.country].filter(Boolean).join(", ")}</p>}
            </div>
          </div>

          {/* Modules & besoin */}
          {req.desiredModules.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Modules souhaités</p>
              <div className="flex flex-wrap gap-1.5">
                {req.desiredModules.map((m) => (
                  <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                ))}
              </div>
            </div>
          )}

          {req.mainNeed && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Besoin principal</p>
              <p className="text-sm text-muted-foreground">{req.mainNeed}</p>
            </div>
          )}

          {req.message && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Message</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3">{req.message}</p>
            </div>
          )}

          {/* Méta */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Reçu le {new Date(req.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
            <span className={`text-[10px] ${req.confirmationSent ? "text-emerald-600" : "text-amber-600"}`}>
              {req.confirmationSent ? "✓ Email prospect envoyé" : "⚠ Email prospect non envoyé"}
            </span>
          </div>

          {/* Actions */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Suivi</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Statut</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.filter((o) => o.value !== "all").map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes internes</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Compte-rendu d'appel, observations, prochaine étape…"
                className="text-sm resize-none h-24" />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={save} disabled={saving} className="h-8">
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
              {saved && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="w-3 h-3" /> Sauvegardé
                </span>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AccessRequestsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AccessRequest | null>(null);

  const params = new URLSearchParams();
  if (statusFilter !== "all") params.set("status", statusFilter);
  else if (search.trim()) params.set("search", search.trim());

  const { data: requests = [], isLoading, refetch } = useQuery<AccessRequest[]>({
    queryKey: ["cockpit/access-requests", statusFilter, search],
    queryFn: () => apiFetch<AccessRequest[]>(`/api/cockpit/access-requests?${params}`),
    refetchInterval: 60_000,
  });

  const countByStatus = (s: string) => requests.filter((r) => r.status === s).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Demandes d'accès</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Prospects entrants depuis la page de connexion</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />Actualiser
        </Button>
      </div>

      {/* KPI résumé */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Nouveaux",      value: countByStatus("new"),       color: "text-blue-600" },
          { label: "Contactés",     value: countByStatus("contacted"),  color: "text-sky-600" },
          { label: "En cours",      value: requests.filter((r) => ["demo_planned","qualifying","offer_sent"].includes(r.status)).length, color: "text-violet-600" },
          { label: "Convertis",     value: countByStatus("converted"),  color: "text-emerald-600" },
        ].map((k) => (
          <div key={k.label} className="bg-card border rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 h-9 text-sm" placeholder="Rechercher par nom, email, organisation…"
            value={search} onChange={(e) => { setSearch(e.target.value); setStatusFilter("all"); }} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setSearch(""); }}>
          <SelectTrigger className="h-9 text-sm w-[200px]">
            <Tag className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />Chargement…
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl bg-muted/20">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Aucune demande d'accès</p>
          <p className="text-xs mt-1">Les demandes soumises depuis la page de connexion apparaîtront ici.</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-card divide-y">
          {requests.map((r) => (
            <button key={r.id}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
              onClick={() => setSelected(r)}>
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-primary">{r.contactName[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground truncate">{r.contactName}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground truncate">{r.orgName}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{r.contactEmail}</span>
                  {r.orgSector && <span>{r.orgSector}</span>}
                  {r.orgSize && <span>{r.orgSize}</span>}
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(r.createdAt).toLocaleDateString("fr-FR")}</span>
                </div>
                {r.desiredModules.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {r.desiredModules.slice(0, 4).map((m) => (
                      <span key={m} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">{m}</span>
                    ))}
                    {r.desiredModules.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">+{r.desiredModules.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {selected && <DetailDialog req={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
