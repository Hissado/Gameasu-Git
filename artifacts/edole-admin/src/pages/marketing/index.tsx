import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { MarketingShell } from "./_layout";
import { Plus, Send, Mail, MessageSquare, Phone, Users, Workflow, BellRing, ArrowUpRight, Sparkles } from "lucide-react";

type Overview = {
  campaigns: { total: number; active: number; scheduled: number; sent: number; draft: number };
  byChannel: Array<{ channel: string; count: number; sentTotal: number }>;
  delivery: { sent: number; failed: number; recipients: number; opens: number; clicks: number; replies: number; unsubs: number; openRate: number; clickRate: number; replyRate: number };
  prospects: { total: number; converted: number };
  automations: { total: number; active: number; runs: number };
  alerts: { total: number; active: number; sent: number };
  audiences: { total: number; contacts: number };
  topCampaigns: Array<{ id: string; name: string; channel: string; sentCount: number; recipientsCount: number }>;
};

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const num = (v: number) => v.toLocaleString("fr-FR");

const channelIcon = (c: string) => c === "email" ? <Mail className="w-4 h-4" /> : c === "sms" ? <MessageSquare className="w-4 h-4" /> : c === "whatsapp" ? <Phone className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />;

export default function MarketingOverview() {
  const { data, isLoading } = useQuery<Overview>({
    queryKey: ["marketing-overview"],
    queryFn: () => apiFetch("/api/marketing/overview"),
  });

  return (
    <MarketingShell
      title="Marketing"
      subtitle="Campagnes, automatisations et engagement client — multi-canal"
      actions={
        <>
          <Link href="/marketing/campaigns"><Button variant="outline"><Send className="w-4 h-4 mr-2" /> Campagnes</Button></Link>
          <Link href="/marketing/campaigns"><Button><Plus className="w-4 h-4 mr-2" /> Nouvelle campagne</Button></Link>
        </>
      }
    >
      {isLoading ? (
        <div className="py-20 text-center text-muted-foreground">Chargement…</div>
      ) : !data ? null : (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Campagnes" value={num(data.campaigns.total)} hint={`${data.campaigns.active} en cours · ${data.campaigns.scheduled} planifiées`} />
            <KpiCard label="Messages envoyés" value={num(data.delivery.sent)} hint={`${num(data.delivery.recipients)} destinataires`} accent />
            <KpiCard label="Taux d'ouverture" value={pct(data.delivery.openRate)} hint={`${num(data.delivery.opens)} ouvertures`} />
            <KpiCard label="Taux de clic" value={pct(data.delivery.clickRate)} hint={`${num(data.delivery.clicks)} clics`} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Audiences" value={num(data.audiences.total)} hint={`${num(data.audiences.contacts)} contacts`} icon={<Users className="w-4 h-4" />} />
            <KpiCard label="Automatisations" value={num(data.automations.total)} hint={`${data.automations.active} actives · ${num(data.automations.runs)} exécutions`} icon={<Workflow className="w-4 h-4" />} />
            <KpiCard label="Alertes auto" value={num(data.alerts.total)} hint={`${data.alerts.active} actives · ${num(data.alerts.sent)} envoyées`} icon={<BellRing className="w-4 h-4" />} />
            <KpiCard label="Prospects" value={num(data.prospects.total)} hint={`${data.prospects.converted} convertis`} icon={<Sparkles className="w-4 h-4" />} />
          </div>

          {/* Channels + top campaigns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="border-b"><CardTitle className="text-base">Volume par canal</CardTitle></CardHeader>
              <CardContent className="p-0">
                {data.byChannel.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Aucun envoi à ce jour.</div>
                ) : (
                  <ul className="divide-y">
                    {data.byChannel.map((c) => (
                      <li key={c.channel} className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">{channelIcon(c.channel)}</div>
                          <div>
                            <div className="font-medium capitalize">{c.channel}</div>
                            <div className="text-xs text-muted-foreground">{c.count} campagne(s)</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-semibold">{num(c.sentTotal)}</div>
                          <div className="text-xs text-muted-foreground">messages</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b flex flex-row items-center justify-between">
                <CardTitle className="text-base">Top campagnes</CardTitle>
                <Link href="/marketing/campaigns" className="text-xs text-primary hover:underline flex items-center gap-1">Tout voir <ArrowUpRight className="w-3 h-3" /></Link>
              </CardHeader>
              <CardContent className="p-0">
                {data.topCampaigns.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Aucune campagne envoyée pour le moment.</div>
                ) : (
                  <ul className="divide-y">
                    {data.topCampaigns.map((c) => (
                      <li key={c.id} className="flex items-center justify-between p-4">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[10px] capitalize">{channelIcon(c.channel)} <span className="ml-1">{c.channel}</span></Badge>
                            <span>{num(c.sentCount)} / {num(c.recipientsCount)}</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick actions */}
          <Card>
            <CardHeader className="border-b"><CardTitle className="text-base">Actions rapides</CardTitle></CardHeader>
            <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <QuickAction href="/marketing/campaigns" icon={<Send />} label="Lancer une campagne" />
              <QuickAction href="/marketing/automations" icon={<Workflow />} label="Créer un workflow" />
              <QuickAction href="/marketing/audiences" icon={<Users />} label="Bâtir une audience" />
              <QuickAction href="/marketing/alerts" icon={<BellRing />} label="Programmer une alerte" />
              <QuickAction href="/marketing/templates" icon={<Mail />} label="Modèle email" />
              <QuickAction href="/marketing/templates" icon={<MessageSquare />} label="Modèle SMS" />
              <QuickAction href="/marketing/contacts" icon={<UserSquare2Icon />} label="Voir les contacts" />
              <QuickAction href="/marketing/analytics" icon={<BarChartIcon />} label="Analyser la performance" />
            </CardContent>
          </Card>
        </div>
      )}
    </MarketingShell>
  );
}

function KpiCard({ label, value, hint, accent, icon }: { label: string; value: string; hint?: string; accent?: boolean; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
        <div className={`text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="border rounded-lg p-3 hover:border-primary hover:bg-primary/5 transition-colors flex items-center gap-3 group">
      <div className="w-9 h-9 rounded-md bg-muted text-foreground group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center transition-colors">
        {React.cloneElement(icon as any, { className: "w-4 h-4" })}
      </div>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

// Mini SVG icons referenced in JSX above (avoid circular imports)
function UserSquare2Icon() { return <Users className="w-4 h-4" />; }
function BarChartIcon() { return <ArrowUpRight className="w-4 h-4" />; }
