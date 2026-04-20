import React from "react";
import { useGetDashboardKpis, useGetDashboardCharts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FolderKanban, Users, CheckSquare, Banknote, Target, FileText, AlertCircle, ArrowUpRight, Clock, HardHat, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from "recharts";
import { formatFCFA } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function getDateLabel() {
  return new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function Dashboard() {
  const { data: kpis, isLoading: isLoadingKpis } = useGetDashboardKpis();
  const { data: charts, isLoading: isLoadingCharts } = useGetDashboardCharts();
  const { user } = useAuth();
  const firstName = user?.firstName || "";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Bandeau d'accueil personnalisé */}
      <div className="rounded-xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white px-6 py-7 md:px-8 md:py-8 shadow-md border border-slate-800">
        <div className="text-xs uppercase tracking-[0.25em] text-primary/80 font-semibold">{getDateLabel()}</div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mt-2">
          {getGreeting()}{firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="text-sm md:text-base text-slate-300 mt-2 max-w-2xl">
          Voici l'activité de votre entreprise aujourd'hui — chantiers en cours, encaissements, alertes prioritaires.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Chantiers Actifs</CardTitle>
            <div className="p-2 bg-primary/10 rounded-md">
              <HardHat className="w-5 h-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingKpis ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex flex-col">
                <span className="text-3xl font-bold">{kpis?.activeProjects || 0}</span>
                <span className="text-xs text-green-600 font-medium flex items-center mt-1">
                  <ArrowUpRight className="w-3 h-3 mr-1" /> +2 ce mois
                </span>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Clients Actifs</CardTitle>
            <div className="p-2 bg-secondary/10 rounded-md">
              <Users className="w-5 h-5 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingKpis ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex flex-col">
                <span className="text-3xl font-bold">{kpis?.totalClients || 0}</span>
                <span className="text-xs text-muted-foreground mt-1">Entreprises partenaires</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow bg-slate-900 text-white border-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-400">Chiffre d'Affaires (Mois)</CardTitle>
            <div className="p-2 bg-white/10 rounded-md">
              <Banknote className="w-5 h-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingKpis ? (
              <Skeleton className="h-8 w-32 bg-slate-700" />
            ) : (
              <div className="flex flex-col">
                <span className="text-2xl font-bold tracking-tight text-white">{formatFCFA(kpis?.monthlyRevenue || 0)}</span>
                <span className="text-xs text-green-400 font-medium flex items-center mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" /> Objectif: 85%
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pipeline Commercial</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-md">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingKpis ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="flex flex-col">
                <span className="text-2xl font-bold tracking-tight">{formatFCFA(kpis?.pipelineValue || 0)}</span>
                <span className="text-xs text-muted-foreground mt-1">Opportunités qualifiées</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Évolution des Encaissements</CardTitle>
            <CardDescription>Revenus mensuels consolidés sur l'année en cours</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {isLoadingCharts ? (
              <div className="w-full h-full flex items-center justify-center">
                <Skeleton className="w-full h-[250px] rounded-xl" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts?.revenue || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000000}M`} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontWeight: 'bold' }}
                    formatter={(value: number) => [formatFCFA(value), "Revenus"]}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Alertes Logistiques</CardTitle>
              <Badge variant="destructive" className="font-bold">3</Badge>
            </div>
            <CardDescription>Équipements et locations nécessitant une attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-foreground">Grue Mobile Liebherr LTM</h4>
                  <p className="text-xs text-muted-foreground mt-1">Maintenance préventive dépassée de 2 jours (Chantier: Tour Horizon).</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 rounded-lg border border-border">
                <Clock className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-foreground">Retour Location EXC-002</h4>
                  <p className="text-xs text-muted-foreground mt-1">La pelleteuse CAT 320 doit être retournée demain avant 12h00.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 rounded-lg border border-border">
                <FileText className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-foreground">Facture F-2024-089 impayée</h4>
                  <p className="text-xs text-muted-foreground mt-1">Client: MINTP. Montant: 45 000 000 FCFA. En retard de 15 jours.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}