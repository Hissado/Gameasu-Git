import React from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertTriangle, Lightbulb, ShieldAlert, ArrowRight, Brain } from "lucide-react";
import { useIntelligenceOverview, severityColor, priorityColor, severityLabel, priorityLabel } from "@/lib/intelligence";

/**
 * Widget cockpit affichant les insights, recommandations et risques
 * prioritaires sur le tableau de bord exécutif.
 */
export function IntelligenceWidget() {
  const { data } = useIntelligenceOverview();
  if (!data) return null;
  const empty = !data.recentInsights.length && !data.topRecommendations.length && !data.topRisks.length;
  if (empty) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /> Copilote exécutif Nexora</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={data.aiAvailable ? "border-emerald-500/30 text-emerald-600 text-[10px]" : "border-amber-500/30 text-amber-600 text-[10px]"}>
              <Sparkles className="w-3 h-3 mr-1" /> {data.aiAvailable ? "IA active" : "heuristique"}
            </Badge>
            <Link href="/intelligence"><Button size="sm" variant="ghost" className="h-7 text-xs">Ouvrir <ArrowRight className="w-3 h-3 ml-1" /></Button></Link>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="flex items-center gap-2"><Lightbulb className="w-4 h-4 text-sky-500" /> <span className="font-semibold text-base">{data.counts.insightsOpen}</span> insights</div>
          <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" /> <span className="font-semibold text-base">{data.counts.recommendationsOpen}</span> recommandations</div>
          <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> <span className="font-semibold text-base">{data.counts.risksOpen}</span> risques</div>
        </div>

        {data.topRisks.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Risques prioritaires</p>
            {data.topRisks.slice(0, 3).map((r) => (
              <div key={r.id} className="text-sm flex items-center gap-2">
                <Badge variant="outline" className={`${severityColor(r.severity)} text-[10px] shrink-0`}>{severityLabel(r.severity)}</Badge>
                <span className="truncate">{r.title}</span>
              </div>
            ))}
          </div>
        )}

        {data.topRecommendations.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1"><Sparkles className="w-3 h-3" /> Prochaines actions</p>
            {data.topRecommendations.slice(0, 3).map((r) => (
              <div key={r.id} className="text-sm flex items-center gap-2">
                <Badge variant="outline" className={`${priorityColor(r.priority)} text-[10px] shrink-0`}>{priorityLabel(r.priority)}</Badge>
                <span className="truncate">{r.title}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
