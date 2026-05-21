import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Wrench, Users, TrendingUp, Calendar } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type StockReport = {
  generatedAt: string;
  totals: { total: number; available: number; rented: number; maintenance: number };
  byCategory: Record<string, { total: number; available: number; rented: number; maintenance: number }>;
  movements24h: number;
};

type WorkloadEntry = {
  userId: string;
  name: string;
  role: string;
  totalTasks: number;
  activeTasks: number;
  activeProjects: number;
  load: number;
};

export default function ReportsPage() {
  const { data: stock, isLoading: loadingStock } = useQuery<StockReport>({
    queryKey: ["report", "stock-daily"],
    queryFn: () => apiFetch("/api/reports/stock-daily"),
  });

  const { data: workload, isLoading: loadingWl } = useQuery<WorkloadEntry[]>({
    queryKey: ["report", "workload"],
    queryFn: () => apiFetch("/api/reports/workload"),
  });

  const downloadPdf = () => {
    const token = localStorage.getItem("auth_token");
    fetch("/api/reports/stock-daily/pdf", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((b) => {
        const url = URL.createObjectURL(b);
        const a = document.createElement("a");
        a.href = url;
        a.download = `rapport-stock-${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rapports & Indicateurs</h1>
          <p className="text-sm text-muted-foreground mt-1">Génération automatique des bilans opérationnels — parc, charge équipe, finances.</p>
        </div>
        <Badge variant="outline" className="text-xs px-3 py-1.5 border-primary/30 text-primary bg-primary/5">
          <Calendar className="w-3 h-3 mr-1.5" /> Mis à jour en temps réel
        </Badge>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="border-b border-border/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" /> Bilan journalier du parc
            </CardTitle>
            <CardDescription>Snapshot en temps réel de l'inventaire matériel — disponible, en location, en maintenance.</CardDescription>
          </div>
          <Button onClick={downloadPdf} className="bg-primary hover:bg-primary/90">
            <Download className="w-4 h-4 mr-2" /> Exporter PDF
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          {loadingStock ? (
            <Skeleton className="h-40 w-full" />
          ) : stock ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Parc total</div>
                  <div className="text-3xl font-bold text-slate-800">{stock.totals.total}</div>
                </div>
                <div className="bg-green-50 border border-green-100 p-4 rounded-xl">
                  <div className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">Disponible</div>
                  <div className="text-3xl font-bold text-green-700">{stock.totals.available}</div>
                </div>
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                  <div className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">En location</div>
                  <div className="text-3xl font-bold text-blue-700">{stock.totals.rented}</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl">
                  <div className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-2">Maintenance</div>
                  <div className="text-3xl font-bold text-yellow-700">{stock.totals.maintenance}</div>
                </div>
              </div>

              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500 mb-3">Détail par catégorie</h3>
              <div className="space-y-2">
                {Object.entries(stock.byCategory).map(([cat, s]) => (
                  <div key={cat} className="flex items-center justify-between p-3 border border-border rounded-md hover:bg-slate-50/50">
                    <div className="font-semibold text-sm">{cat}</div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-500">Total <strong className="text-slate-800">{s.total}</strong></span>
                      <span className="text-green-600">Dispo <strong>{s.available}</strong></span>
                      <span className="text-blue-600">Loc. <strong>{s.rented}</strong></span>
                      <span className="text-yellow-600">Maint. <strong>{s.maintenance}</strong></span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
                <span><TrendingUp className="w-3 h-3 inline mr-1" /> {stock.movements24h} mouvement(s) sur les 24 dernières heures</span>
                <span>Généré le {new Date(stock.generatedAt).toLocaleString("fr-FR")}</span>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Aucune donnée disponible.</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Charge de travail des collaborateurs
          </CardTitle>
          <CardDescription>Indicateur du nombre de tâches actives et projets attribués par utilisateur.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {loadingWl ? (
            <Skeleton className="h-40 w-full" />
          ) : workload && workload.length > 0 ? (
            <div className="space-y-3">
              {workload.map((u) => (
                <div key={u.userId} className="border border-border rounded-md p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-semibold">{u.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{u.role}</div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-600">Tâches actives <strong>{u.activeTasks}</strong></span>
                      <span className="text-slate-600">Projets <strong>{u.activeProjects}</strong></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={u.load} className={`h-2 flex-1 ${u.load > 80 ? "[&>div]:bg-red-500" : u.load > 60 ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"}`} />
                    <span className="text-xs font-bold w-10 text-right">{u.load}%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Aucun collaborateur actif.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
