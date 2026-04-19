import React from "react";
import { useGetCrmPipeline, useListOpportunities } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Building, Briefcase } from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export default function CrmHome() {
  const { data: pipeline, isLoading: isLoadingPipeline } = useGetCrmPipeline();
  const { data: opportunities, isLoading: isLoadingOpps } = useListOpportunities();

  const getStageTitle = (stage: string) => {
    switch (stage) {
      case "lead": return "Prospects";
      case "qualified": return "Qualifiés";
      case "proposal": return "En proposition";
      case "negotiation": return "Négociation";
      case "won": return "Gagnés";
      case "lost": return "Perdus";
      default: return stage;
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "lead": return "bg-slate-200 border-slate-300 text-slate-700";
      case "qualified": return "bg-blue-100 border-blue-200 text-blue-700";
      case "proposal": return "bg-indigo-100 border-indigo-200 text-indigo-700";
      case "negotiation": return "bg-orange-100 border-orange-200 text-orange-700";
      case "won": return "bg-green-100 border-green-200 text-green-700";
      case "lost": return "bg-red-100 border-red-200 text-red-700";
      default: return "bg-slate-100 border-slate-200 text-slate-700";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-140px)] flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Pipeline Commercial</h1>
          <p className="text-sm text-muted-foreground mt-1">Suivi Kanban des opportunités et contrats</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm">
          <Plus className="w-4 h-4 mr-2" strokeWidth={3} />
          Nouvelle Opportunité
        </Button>
      </div>

      {(isLoadingPipeline || isLoadingOpps) ? (
        <div className="flex gap-4 overflow-hidden h-full">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex-1 min-w-[300px] max-w-[350px] bg-slate-50/50 rounded-xl border border-border p-3">
              <Skeleton className="h-6 w-1/2 mb-4" />
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start custom-scrollbar">
          {pipeline?.stages?.map((stage) => (
            <div key={stage.stage} className="flex-1 min-w-[320px] max-w-[350px] bg-slate-50 rounded-xl border border-border/50 flex flex-col h-full max-h-full">
              <div className={`p-3 border-b border-border/50 flex justify-between items-center bg-white/50 rounded-t-xl ${getStageColor(stage.stage).replace('text-', 'border-t-4 border-t-')}`}>
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wider">{getStageTitle(stage.stage)}</h3>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">{formatFCFA(stage.totalValue)}</p>
                </div>
                <Badge variant="secondary" className="font-bold bg-white shadow-sm border-border">
                  {stage.count}
                </Badge>
              </div>
              
              <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                {opportunities?.data?.filter(opp => opp.stage === stage.stage).map(opp => (
                  <Card key={opp.id} className="cursor-pointer hover:border-primary/50 transition-colors shadow-sm group">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">{opp.title}</h4>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center text-xs text-slate-600">
                          <Building className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                          <span className="truncate font-medium">{opp.clientName || "Prospect non assigné"}</span>
                        </div>
                        <div className="flex items-center text-xs text-slate-600">
                          <Briefcase className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                          <span className="font-bold text-slate-800">{formatFCFA(opp.value)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {opportunities?.data?.filter(opp => opp.stage === stage.stage).length === 0 && (
                  <div className="text-center p-6 text-sm text-muted-foreground bg-white/50 rounded-lg border border-dashed border-border flex flex-col items-center justify-center">
                    <Briefcase className="w-8 h-8 text-slate-200 mb-2" />
                    Aucune opportunité
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}