import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Sparkles, User, Mail, Phone, Globe, Building2, Clock, Wallet, Users, FileText, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type AppRequest = {
  id: string;
  orgName: string;
  contactPerson: string;
  email: string;
  phone: string | null;
  country: string | null;
  industry: string | null;
  description: string | null;
  expectedUsers: string | null;
  preferredTimeline: string | null;
  budgetRange: string | null;
  status: string;
  assignedTo: string | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUSES: Record<string, { label: string; cls: string }> = {
  new:        { label: "Nouvelle demande", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  analyzing:  { label: "En analyse",       cls: "bg-amber-50 text-amber-700 border-amber-200" },
  discussing: { label: "En discussion",    cls: "bg-violet-50 text-violet-700 border-violet-200" },
  quoted:     { label: "Devis envoyé",     cls: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  accepted:   { label: "Acceptée",         cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  refused:    { label: "Refusée",          cls: "bg-red-50 text-red-700 border-red-200" },
  closed:     { label: "Clôturée",         cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUSES[status] ?? { label: status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return <Badge variant="outline" className={`text-xs font-medium ${cfg.cls}`}>{cfg.label}</Badge>;
}

export default function CustomAppsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<AppRequest | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editAssigned, setEditAssigned] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const { data, isLoading } = useQuery<{ data: AppRequest[]; total: number }>({
    queryKey: ["custom-app-requests", statusFilter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("q", search.trim());
      return apiFetch(`/api/super-admin/custom-app-requests?${params}`);
    },
    refetchInterval: 30_000,
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      apiFetch<AppRequest>(`/api/super-admin/custom-app-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["custom-app-requests"] });
      setSelected(updated);
      toast.success("Demande mise à jour");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const openDetail = (req: AppRequest) => {
    setSelected(req);
    setEditStatus(req.status);
    setEditAssigned(req.assignedTo ?? "");
    setEditNotes(req.internalNotes ?? "");
  };

  const saveChanges = () => {
    if (!selected) return;
    patchMutation.mutate({
      id: selected.id,
      patch: { status: editStatus, assignedTo: editAssigned || null, internalNotes: editNotes || null },
    });
  };

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  const countByStatus = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-slate-900">Demandes d'applications personnalisées</h1>
        </div>
        <Badge variant="outline" className="text-sm">{total} demande{total > 1 ? "s" : ""}</Badge>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { key: "new", label: "Nouvelles" },
          { key: "analyzing", label: "En analyse" },
          { key: "discussing", label: "En discussion" },
          { key: "accepted", label: "Acceptées" },
        ].map(({ key, label }) => {
          const cfg = STATUSES[key];
          return (
            <Card key={key} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(key)}>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 font-medium">{label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{countByStatus[key] ?? 0}</p>
                <Badge variant="outline" className={`text-xs mt-1 ${cfg.cls}`}>{cfg.label}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Demandes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Rechercher organisation, contact, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {Object.entries(STATUSES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucune demande{statusFilter !== "all" ? " dans ce statut" : ""}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Secteur</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((req) => (
                    <TableRow key={req.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openDetail(req)}>
                      <TableCell className="font-medium text-slate-900">{req.orgName}</TableCell>
                      <TableCell>
                        <div className="text-sm">{req.contactPerson}</div>
                        <div className="text-xs text-slate-400">{req.email}</div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{req.industry ?? "—"}</TableCell>
                      <TableCell className="text-sm text-slate-600">{req.budgetRange ?? "—"}</TableCell>
                      <TableCell><StatusBadge status={req.status} /></TableCell>
                      <TableCell className="text-sm text-slate-500">{fmtDate(req.createdAt)}</TableCell>
                      <TableCell>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      {selected && (
        <Dialog open onOpenChange={(o) => { if (!o) setSelected(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                {selected.orgName}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              {/* Infos de contact */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: <User className="w-4 h-4" />, label: "Contact", value: selected.contactPerson },
                  { icon: <Mail className="w-4 h-4" />, label: "Email", value: selected.email },
                  { icon: <Phone className="w-4 h-4" />, label: "Téléphone", value: selected.phone ?? "—" },
                  { icon: <Globe className="w-4 h-4" />, label: "Pays", value: selected.country ?? "—" },
                  { icon: <Building2 className="w-4 h-4" />, label: "Secteur", value: selected.industry ?? "—" },
                  { icon: <Users className="w-4 h-4" />, label: "Utilisateurs", value: selected.expectedUsers ?? "—" },
                  { icon: <Clock className="w-4 h-4" />, label: "Délai souhaité", value: selected.preferredTimeline ?? "—" },
                  { icon: <Wallet className="w-4 h-4" />, label: "Budget", value: selected.budgetRange ?? "—" },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 mt-0.5 flex-shrink-0">{icon}</span>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">{label}</p>
                      <p className="text-sm font-medium text-slate-900">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Description */}
              {selected.description && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> Description des besoins
                  </p>
                  <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap border border-slate-200">
                    {selected.description}
                  </div>
                </div>
              )}

              {/* Gestion interne */}
              <div className="border-t border-slate-200 pt-4 space-y-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Gestion interne</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Statut</label>
                    <Select value={editStatus} onValueChange={setEditStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUSES).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Assigné à</label>
                    <Input
                      value={editAssigned}
                      onChange={(e) => setEditAssigned(e.target.value)}
                      placeholder="Nom du responsable"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes internes</label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={4}
                    placeholder="Notes de suivi, actions en cours, contexte…"
                    className="resize-none"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSelected(null)}>Fermer</Button>
              <Button
                onClick={saveChanges}
                disabled={patchMutation.isPending}
                className="gap-2"
              >
                {patchMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
