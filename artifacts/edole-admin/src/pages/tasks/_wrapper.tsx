import React, { lazy, Suspense, useState } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckSquare, Flame } from "lucide-react";

const TasksList = lazy(() => import("./index"));
const TasksFocus = lazy(() => import("./Focus"));

export default function TasksHub() {
  const [location, setLocation] = useLocation();
  const initial = location.endsWith("/focus") ? "focus" : "all";
  const [tab, setTab] = useState(initial);

  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          setLocation(v === "focus" ? "/tasks/focus" : "/tasks", { replace: true });
        }}
      >
        <TabsList>
          <TabsTrigger value="all" className="gap-2"><CheckSquare className="w-4 h-4" />Toutes les tâches</TabsTrigger>
          <TabsTrigger value="focus" className="gap-2"><Flame className="w-4 h-4" />Focus (priorisation IA)</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Chargement…</div>}>
            <TasksList />
          </Suspense>
        </TabsContent>
        <TabsContent value="focus">
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Chargement…</div>}>
            <TasksFocus />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
