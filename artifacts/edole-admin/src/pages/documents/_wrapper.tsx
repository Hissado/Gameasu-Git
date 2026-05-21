import React, { lazy, Suspense, useState } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FolderOpen, Sparkles } from "lucide-react";

const DocumentsLibrary = lazy(() => import("./index"));
const DocumentsIntelligence = lazy(() => import("./intelligence"));

export default function DocumentsHub() {
  const [location, setLocation] = useLocation();
  const initial = location.endsWith("/intelligence") ? "ia" : "library";
  const [tab, setTab] = useState(initial);

  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          setLocation(v === "ia" ? "/documents/intelligence" : "/documents", { replace: true });
        }}
      >
        <TabsList>
          <TabsTrigger value="library" className="gap-2"><FolderOpen className="w-4 h-4" />Bibliothèque</TabsTrigger>
          <TabsTrigger value="ia" className="gap-2"><Sparkles className="w-4 h-4" />IA & insights</TabsTrigger>
        </TabsList>
        <TabsContent value="library">
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Chargement…</div>}>
            <DocumentsLibrary />
          </Suspense>
        </TabsContent>
        <TabsContent value="ia">
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Chargement…</div>}>
            <DocumentsIntelligence />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
