import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Search, Building2, Users, CreditCard, Power, PowerOff, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Org = {
  id: string; name: string; slug: string; industry: string | null;
  country: string | null; isActive: boolean; isDefault: boolean;
  createdAt: string; planCode: string | null; planName: string | null;
  seats: number; mrr: number; billingCycle: string | null;
  status: string | null; memberCount: number; enabledModules: number;
};

type OrgList = { count: number; rows: Org[] };

const PLAN_COLOR: Record<string, string> = {
  STARTER: "bg-indigo-50 text-indigo-700 border-indigo-200",
  GROWTH: "bg-violet-50 text-violet-700 border-violet-200",
  PROFESSIONAL: "bg-purple-50 text-purple-700 border-purple-200",
  ENTERPRISE: "bg-pink-50 text-pink-700 border-pink-200",
};

function fmtFCFA(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default function TenantsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [confirming, setConfirming] = useState<Org | null>(null);
  const [toggling, setToggling] = useState(false);

  const { data, isLoading } = useQuery<OrgList>({
    queryKey: ["cockpit-orgs"],
    queryFn: () => apiFetch("/api/super-admin/organizations"),
    refetchInterval: 60_000,
  });

  const rows = (data?.rows ?? []).filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q) || (o.industry ?? "").toLowerCase().includes(q);
  });

  const totalMRR = (data?.rows ?? []).reduce((s, o) => s + o.mrr, 0);

  const handleToggle = async () => {
    if (!confirming) return;
    setToggling(true);
    try {
      const action = confirming.isActive ? "suspend" : "reactivate";
      await apiFetch(`/api/super-admin/organizations/${confirming.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      toast.success(action === "suspend" ? "Organisation suspendue" : "Organisation réactivée");
      qc.invalidateQueries({ queryKey: ["cockpit-orgs"] });
      qc.invalidateQueries({ queryKey: ["cockpit-overview"] });
      setConfirming(null);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erreur");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Cockpit</p>
        <h1 className="text-2xl font-bold tracking-tight">Organisations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data?.count ?? 0} tenants · MRR total {fmtFCFA(totalMRR)}
        </p>
      </div>

      <div className="grid gap-3 grid-cols-3">
        <Card><CardContent className="p-4">
          <p className="text-[11px] uppercase font-semibold text-muted-foreground">Actives</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{data?.rows.filter((o) => o.isActive).length ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[11px] uppercase font-semibold text-muted-foreground">Suspendues</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{data?.rows.filter((o) => !o.isActive).length ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[11px] uppercase font-semibold text-muted-foreground">MRR total</p>
          <p className="text-2xl font-bold text-primary mt-1">{fmtFCFA(totalMRR)}</p>
        </CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Rechercher une organisation…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4" />Liste des tenants</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right"><Users className="w-3.5 h-3.5 inline mr-1" />Membres</TableHead>
                    <TableHead className="text-right"><CreditCard className="w-3.5 h-3.5 inline mr-1" />MRR</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Créée le</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((org) => (
                    <TableRow key={org.id} className={!org.isActive ? "opacity-60" : ""}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{org.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{org.slug}</p>
                          {org.industry && <p className="text-[10px] text-muted-foreground">{org.industry}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {org.planCode ? (
                          <Badge variant="outline" className={PLAN_COLOR[org.planCode] ?? ""}>{org.planCode}</Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">{org.memberCount}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{fmtFCFA(org.mrr)}</TableCell>
                      <TableCell>
                        {org.isDefault ? (
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">Défaut</Badge>
                        ) : org.isActive ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Suspendue</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(org.createdAt)}</TableCell>
                      <TableCell>
                        {!org.isDefault && (
                          <Button
                            size="sm" variant="outline"
                            className={`h-7 text-xs gap-1 ${org.isActive ? "text-red-600 border-red-200 hover:bg-red-50" : "text-emerald-600 border-emerald-200 hover:bg-emerald-50"}`}
                            onClick={() => setConfirming(org)}
                          >
                            {org.isActive ? <><PowerOff className="w-3 h-3" />Suspendre</> : <><Power className="w-3 h-3" />Réactiver</>}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {confirming && (
        <Dialog open onOpenChange={(o) => { if (!o) setConfirming(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirming.isActive ? "Suspendre" : "Réactiver"} l'organisation</DialogTitle>
              <DialogDescription>
                {confirming.isActive
                  ? `Suspendre "${confirming.name}" bloquera l'accès à tous ses membres et mettra en pause son abonnement.`
                  : `Réactiver "${confirming.name}" rétablira l'accès à tous ses membres.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirming(null)}>Annuler</Button>
              <Button
                variant={confirming.isActive ? "destructive" : "default"}
                onClick={handleToggle}
                disabled={toggling}
              >
                {toggling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {confirming.isActive ? "Suspendre" : "Réactiver"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
