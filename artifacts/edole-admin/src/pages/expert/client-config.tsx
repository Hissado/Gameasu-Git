import { useLocation } from "wouter";
import { useActiveFirm, useExpertClients, ACCESS_LABEL, PLAN_COLOR } from "@/lib/expert-api";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Building2, Globe, Mail, Phone, Settings2, ShieldCheck, AlertCircle,
  Package,
} from "lucide-react";

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? <span className="text-muted-foreground/50">—</span>}</span>
    </div>
  );
}

export default function ClientConfigPage() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.includes("?") ? location.split("?")[1] : "");
  const orgId = params.get("orgId");

  const { firmId } = useActiveFirm();
  const { data: clients } = useExpertClients(firmId);
  const client = clients?.find((c) => c.orgId === orgId);

  const { data: orgData } = useQuery({
    queryKey: ["org-detail", orgId],
    queryFn: () => apiFetch<any>(`/api/organizations/${orgId}`),
    enabled: !!orgId,
  });

  const { data: modules } = useQuery({
    queryKey: ["org-modules", orgId],
    queryFn: () => apiFetch<{ data: any[] }>(`/api/organizations/${orgId}/modules`),
    enabled: !!orgId,
  });

  const qc = useQueryClient();
  const { toast } = useToast();
  const [accessLevel, setAccessLevel] = useState(client?.accessLevel ?? "read");

  const updateAccess = useMutation({
    mutationFn: (level: string) =>
      apiFetch(`/api/expert/firms/${firmId}/clients/${orgId}/access`, { method: "PATCH", body: { accessLevel: level } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expert/clients", firmId] });
      toast({ title: "Niveau d'accès mis à jour" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error, variant: "destructive" }),
  });

  if (!orgId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Aucune organisation sélectionnée.</p>
      </div>
    );
  }

  const org = orgData ?? client?.org;
  const orgName = org?.name ?? "Organisation";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{orgName}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Configuration client</p>
        </div>
        {client?.subscription && (
          <Badge className={`ml-auto border ${PLAN_COLOR[client.subscription.planCode] ?? "bg-slate-100 text-slate-600"}`} variant="outline">
            {client.subscription.planName}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Informations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />Informations
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <InfoRow label="Nom" value={org?.name} />
            <InfoRow label="Pays" value={org?.country} />
            <InfoRow label="Secteur" value={org?.industry} />
            <InfoRow label="E-mail" value={org?.email} />
            <InfoRow label="Téléphone" value={org?.phone} />
            <InfoRow label="Adresse" value={org?.address} />
          </CardContent>
        </Card>

        {/* Accès cabinet */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />Accès cabinet
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">Niveau d'accès actuel</p>
              <Select
                value={accessLevel}
                onValueChange={(v) => { setAccessLevel(v); updateAccess.mutate(v); }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Lecture seule</SelectItem>
                  <SelectItem value="full">Accès complet</SelectItem>
                  <SelectItem value="billing">Facturation</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{ACCESS_LABEL[accessLevel]}</p>
            </div>

            {client && (
              <div className="pt-2 border-t space-y-2">
                <InfoRow label="Statut" value={client.isActive ? "Actif" : "Inactif"} />
                <InfoRow label="Lié depuis" value={client.grantedAt ? new Date(client.grantedAt).toLocaleDateString("fr-FR") : undefined} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modules */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />Modules activés
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {!modules?.data?.length ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Aucune information de module disponible.</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {modules.data.map((m: any) => (
                <div
                  key={m.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${
                    m.enabled ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  <Settings2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{m.moduleName ?? m.moduleKey}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
