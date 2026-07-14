import React, { lazy, Suspense, useState } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Target, Sparkles, Flame } from "lucide-react";
import { SectionHelp } from "@/components/ui/section-help";

const CrmHome = lazy(() => import("./index"));
const PipelineIntelligence = lazy(() => import("../pipeline/intelligence"));
const SalesScoring = lazy(() => import("../sales/scoring"));

export default function CrmHub() {
  const [location, setLocation] = useLocation();
  const initial = location.startsWith("/sales/scoring") ? "scoring"
    : location.startsWith("/pipeline/intelligence") ? "ia" : "pipeline";
  const [tab, setTab] = useState(initial);

  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          setLocation(v === "ia" ? "/pipeline/intelligence"
            : v === "scoring" ? "/sales/scoring"
            : "/crm", { replace: true });
        }}
      >
        <TabsList>
          <TabsTrigger value="pipeline" className="gap-2"><Target className="w-4 h-4" />Pipeline <SectionHelp id="crm.pipeline" /></TabsTrigger>
          <TabsTrigger value="scoring" className="gap-2"><Flame className="w-4 h-4" />Scoring commercial <SectionHelp id="crm.scoring" /></TabsTrigger>
          <TabsTrigger value="ia" className="gap-2"><Sparkles className="w-4 h-4" />Pipeline IA <SectionHelp id="crm.ia" /></TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline">
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Chargement…</div>}>
            <CrmHome />
          </Suspense>
        </TabsContent>
        <TabsContent value="scoring">
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Chargement…</div>}>
            <SalesScoring />
          </Suspense>
        </TabsContent>
        <TabsContent value="ia">
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Chargement…</div>}>
            <PipelineIntelligence />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
