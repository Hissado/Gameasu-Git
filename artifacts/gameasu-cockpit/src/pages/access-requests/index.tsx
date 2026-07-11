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
  MessageSquare, TrendingUp, BarChart3, Archive,
  ExternalLink, UserCheck,
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
  assignedTo: string | null;
  source: string;
  confirmationSent: boolean;
  notificationSent: boolean;
  createdAt: string;
  contactedAt: string | null;
};

type Stats = {
  byStatus: Record<string, number>;
  total: number;
  converted: number;
  conversionRate: number;
  topModules: { name: string; count: number }[];
  topSectors: { name: string; count: number }[];
};

type CockpitUser = {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

const STATUS_OPTIONS = [
  { value: "all",           label: "Tous les statuts" },
  { value: "new",           label: "Nouveau" },
  { value: "to_contact",    label: "À contacter" },
  { value: "contacted",     label: "Contacté" },
  { value: "demo_planned",  label: "Démo planifiée" },
  { value: "qualifying",    label: "En qualification" },
  { value: "offer_sent",    label: "Offre envoyée" },
  { value: "converted",     label: "Converti en client" },
  { value: "non_qualified", label: "Non qualifié" },
  { value: "archived",      label: "Archivé" },
];

const STATUS_COLORS: Record<string, string> = {
  new:           "bg-blue-100 text-blue-700 border-blue-200",
  to_contact:    "bg-amber-100 text-amber-700 border-amber-200",
  contacted:     "bg-sky-100 text-sky-700 border-sky-200",
  demo_planned:  "bg-violet-100 text-violet-700 border-violet-200",
  qualifying:    "bg-orange-100 text-orange-700 border-orange-200",
  offer_sent:    "bg-indigo-100 text-indigo-700 border-indigo-200",
  converted:     "bg-emerald-100 text-emerald-700 border-emerald-200",
  non_qualified: "bg-gray-100 text-gray-500 border-gray-200",
  archived:      "bg-gray-100 text-gray-400 border-gray-200",
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

function userName(u: CockpitUser) {
  if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`;
  return u.name || u.email;
}

function DetailDialog({ req, onClose, cockpitUsers }: { req: AccessRequest; onClose: () => void; cockpitUsers: CockpitUser[] }) {
  const qc = useQueryClient();
  const [status, setStatus]   = useState(req.status);
  const [notes, setNotes]     = useState(req.notes ?? "");
  const [assignedTo, setAssignedTo] = useState(req.assignedTo ?? "");
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await apiFetch(`/api/cockpit/access-requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          notes,
          assignedTo: assignedTo || null,
          ...(status === "contacted" && !req.contactedAt ? { contactedAt: new Date().toISOString() } : {}),
        }),
      });
      qc.invalidateQueries({ queryKey: ["cockpit/access-requests"] });
      qc.invalidateQueries({ queryKey: ["cockpit/access-requests/stats/badge"] });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const quickStatus = async (s: string) => {
    await apiFetch(`/api/cockpit/access-requests/${req.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: s, ...(s === "contacted" && !req.contactedAt ? { contactedAt: new Date().toISOString() } : {}) }),
    });
    setStatus(s);
    qc.invalidateQueries({ queryKey: ["cockpit/access-requests"] });
    qc.invalidateQueries({ queryKey: ["cockpit/access-requests/stats/badge"] });
  };

  const prefLabel = req.contactPreference === "whatsapp" ? "WhatsApp" : req.contactPreference === "phone" ? "Téléphone" : "Email";
  const assignedUser = cockpitUsers.find((u) => u.id === req.assignedTo);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-4 h-4 text-primary" />
            {req.orgName}
            <StatusBadge status={req.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Actions rapides */}
          <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border">
            <a href={`mailto:${req.contactEmail}`} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                <Mail className="w-3 h-3" />Envoyer email
              </Button>
            </a>
            {req.contactPhone && (
              <a href={`tel:${req.contactPhone}`}>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                  <Phone className="w-3 h-3" />Appeler
                </Button>
              </a>
            )}
            {req.contactPhone && (
              <a href={`https://wa.me/${req.contactPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                  <ExternalLink className="w-3 h-3" />WhatsApp
                </Button>
              </a>
            )}
            {status !== "contacted" && status !== "demo_planned" && status !== "converted" && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                onClick={() => quickStatus("contacted")}>
                <UserCheck className="w-3 h-3" />Marquer contacté
              </Button>
            )}
            {status !== "archived" && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-gray-500"
                onClick={() => quickStatus("archived")}>
                <Archive className="w-3 h-3" />Archiver
              </Button>
            )}
          </div>

          {/* Contact + Org */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Contact</p>
              <p className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <strong>{req.contactName}</strong>
                {req.contactFunction && <span className="text-muted-foreground">· {req.contactFunction}</span>}
              </p>
              <p className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <a href={`mailto:${req.contactEmail}`} className="text-blue-600 hover:underline">{req.contactEmail}</a>
              </p>
              {req.contactPhone && (
                <p className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />{req.contactPhone}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Préfère : <strong>{prefLabel}</strong></p>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Organisation</p>
              {req.orgSector  && <p className="text-muted-foreground">{req.orgSector}</p>}
              {req.orgDomain  && <p className="text-muted-foreground">{req.orgDomain}</p>}
              {req.orgSize    && <p className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-muted-foreground" />{req.orgSize}</p>}
              {req.estimatedUsers && <p className="text-muted-foreground">{req.estimatedUsers} utilisateurs estimés</p>}
              {(req.city || req.country) && (
                <p className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />{[req.city, req.country].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          </div>

          {/* Modules & besoin */}
          {(req.desiredModules ?? []).length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Modules souhaités</p>
              <div className="flex flex-wrap gap-1.5">
                {(req.desiredModules ?? []).map((m) => (
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
          <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Reçu le {new Date(req.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </span>
            {req.contactedAt && (
              <span className="flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                Contacté le {new Date(req.contactedAt).toLocaleDateString("fr-FR")}
              </span>
            )}
            {assignedUser && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />Assigné à <strong>{userName(assignedUser)}</strong>
              </span>
            )}
            <span className={`text-[10px] ${req.confirmationSent ? "text-emerald-600" : "text-amber-600"}`}>
              {req.confirmationSent ? "✓ Email prospect envoyé" : "⚠ Email prospect non envoyé"}
            </span>
          </div>

          {/* Suivi */}
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
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Responsable assigné</label>
                <Select value={assignedTo || "none"} onValueChange={(v) => setAssignedTo(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Non assigné" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non assigné</SelectItem>
                    {cockpitUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{userName(u)}</SelectItem>
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
  const [showStats, setShowStats] = useState(false);

  const params = new URLSearchParams();
  if (statusFilter !== "all") params.set("status", statusFilter);
  else if (search.trim()) params.set("search", search.trim());

  const { data: requests = [], isLoading, refetch } = useQuery<AccessRequest[]>({
    queryKey: ["cockpit/access-requests", statusFilter, search],
    queryFn: () => apiFetch<AccessRequest[]>(`/api/cockpit/access-requests?${params}`),
    refetchInterval: 60_000,
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["cockpit/access-requests/stats"],
    queryFn: () => apiFetch<Stats>("/api/cockpit/access-requests/stats"),
    refetchInterval: 60_000,
  });

  const { data: cockpitUsers = [] } = useQuery<CockpitUser[]>({
    queryKey: ["cockpit/users"],
    queryFn: () => apiFetch<CockpitUser[]>("/api/super-admin/cockpit-users"),
    staleTime: 300_000,
  });

  const by = stats?.byStatus ?? {};
  const inProgress = (by["demo_planned"] ?? 0) + (by["qualifying"] ?? 0) + (by["offer_sent"] ?? 0);

  const kpis = [
    { label: "Nouveaux",       value: by["new"] ?? 0,        color: "text-blue-600",    sub: "à traiter" },
    { label: "À contacter",    value: by["to_contact"] ?? 0, color: "text-amber-600",   sub: "en attente" },
    { label: "En cours",       value: inProgress,             color: "text-violet-600",  sub: "démo / offre" },
    { label: "Convertis",      value: by["converted"] ?? 0,  color: "text-emerald-600", sub: `${stats?.conversionRate ?? 0}% conversion` },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Demandes d'accès</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Prospects entrants — {stats?.total ?? 0} demande{(stats?.total ?? 0) !== 1 ? "s" : ""} au total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowStats(!showStats)} className="gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />{showStats ? "Masquer stats" : "Voir stats"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />Actualiser
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-card border rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs font-medium text-foreground mt-0.5">{k.label}</p>
            <p className="text-[10px] text-muted-foreground">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Stats avancées */}
      {showStats && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Modules les plus demandés */}
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <p className="text-sm font-semibold">Modules les plus demandés</p>
            </div>
            {stats.topModules.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune donnée</p>
            ) : (
              <div className="space-y-2">
                {stats.topModules.map((m) => {
                  const max = stats.topModules[0]?.count ?? 1;
                  const pct = Math.round((m.count / max) * 100);
                  return (
                    <div key={m.name}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="truncate text-foreground">{m.name}</span>
                        <span className="text-muted-foreground ml-2 shrink-0">{m.count}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Secteurs */}
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-orange-500" />
              <p className="text-sm font-semibold">Demandes par secteur</p>
            </div>
            {stats.topSectors.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune donnée</p>
            ) : (
              <div className="space-y-2">
                {stats.topSectors.map((s) => {
                  const max = stats.topSectors[0]?.count ?? 1;
                  const pct = Math.round((s.count / max) * 100);
                  return (
                    <div key={s.name}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="truncate text-foreground">{s.name}</span>
                        <span className="text-muted-foreground ml-2 shrink-0">{s.count}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Statuts */}
          <div className="bg-card border rounded-xl p-4 sm:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-violet-500" />
              <p className="text-sm font-semibold">Répartition par statut</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.filter((o) => o.value !== "all" && (by[o.value] ?? 0) > 0).map((o) => (
                <button key={o.value}
                  onClick={() => { setStatusFilter(o.value); setSearch(""); }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium hover:opacity-80 transition-opacity"
                  style={{ background: "transparent" }}>
                  <StatusBadge status={o.value} />
                  <span className="font-bold text-foreground">{by[o.value]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-3 flex-wrap">
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
          {requests.map((r) => {
            const assignedUser = cockpitUsers.find((u) => u.id === r.assignedTo);
            return (
              <button key={r.id}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
                onClick={() => setSelected(r)}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${r.status === "new" ? "bg-blue-100" : "bg-primary/10"}`}>
                  <span className={`text-sm font-bold ${r.status === "new" ? "text-blue-600" : "text-primary"}`}>
                    {r.contactName[0]?.toUpperCase()}
                  </span>
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
                    {assignedUser && (
                      <span className="flex items-center gap-1 text-indigo-600">
                        <User className="w-3 h-3" />{userName(assignedUser)}
                      </span>
                    )}
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(r.createdAt).toLocaleDateString("fr-FR")}</span>
                  </div>
                  {(r.desiredModules ?? []).length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {(r.desiredModules ?? []).slice(0, 4).map((m) => (
                        <span key={m} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">{m}</span>
                      ))}
                      {(r.desiredModules ?? []).length > 4 && (
                        <span className="text-[10px] text-muted-foreground">+{(r.desiredModules ?? []).length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <DetailDialog
          req={selected}
          onClose={() => setSelected(null)}
          cockpitUsers={cockpitUsers}
        />
      )}
    </div>
  );
}
