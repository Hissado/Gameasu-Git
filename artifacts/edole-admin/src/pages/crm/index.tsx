import React from "react";
import { useGetCrmPipeline, useListOpportunities } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CrmHome() {
  const { data: pipeline, isLoading: isLoadingPipeline } = useGetCrmPipeline();
  const { data: opportunities, isLoading: isLoadingOpps } = useListOpportunities();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM Pipeline</h1>
          <p className="text-muted-foreground mt-1">Track your sales and opportunities</p>
        </div>
      </div>

      {(isLoadingPipeline || isLoadingOpps) ? (
        <div className="p-8 text-center text-muted-foreground animate-pulse">Loading pipeline...</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {pipeline?.stages?.map((stage) => (
            <div key={stage.stage} className="flex-1 min-w-[300px] max-w-[350px]">
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold capitalize">{stage.stage}</h3>
                  <div className="text-sm bg-background px-2 py-1 rounded-full text-muted-foreground font-medium border border-border">
                    {stage.count}
                  </div>
                </div>
                
                <div className="space-y-3">
                  {opportunities?.data?.filter(opp => opp.stage === stage.stage).map(opp => (
                    <Card key={opp.id} className="cursor-pointer hover:border-primary/50 transition-colors">
                      <CardContent className="p-4">
                        <h4 className="font-medium text-sm mb-2">{opp.title}</h4>
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <span>{opp.clientName}</span>
                          <span className="font-semibold text-foreground">
                            ${opp.value?.toLocaleString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {opportunities?.data?.filter(opp => opp.stage === stage.stage).length === 0 && (
                    <div className="text-center p-4 text-sm text-muted-foreground bg-background/50 rounded-md border border-dashed border-border">
                      No opportunities
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
