import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export type WidgetId =
  | "kpis"
  | "quick-links"
  | "clock"
  | "intelligence"
  | "alerts"
  | "chart"
  | "projects";

export interface WidgetConfig {
  id: WidgetId;
  enabled: boolean;
}

export const WIDGET_META: Record<WidgetId, { label: string; description: string }> = {
  "kpis":        { label: "Vue d'ensemble (KPIs)", description: "Encaissements, créances, pipeline et indicateurs clés" },
  "quick-links": { label: "Accès rapides", description: "Raccourcis vers les modules les plus utilisés" },
  "clock":       { label: "Pointage du jour", description: "Horloge de pointage et statut de présence" },
  "intelligence":{ label: "Copilote IA", description: "Suggestions et analyses intelligentes" },
  "alerts":      { label: "Alertes & tâches", description: "Factures en retard, tâches échues et tâches à venir" },
  "chart":       { label: "Graphique revenus", description: "Courbe d'encaissements vs facturation + pipeline CRM" },
  "projects":    { label: "Projets actifs", description: "Projets en cours et activité récente" },
};

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "kpis",         enabled: true },
  { id: "quick-links",  enabled: true },
  { id: "clock",        enabled: true },
  { id: "intelligence", enabled: true },
  { id: "alerts",       enabled: true },
  { id: "chart",        enabled: true },
  { id: "projects",     enabled: true },
];

const QK = ["user-preferences-dashboard"];

function mergeWithDefaults(saved: WidgetConfig[]): WidgetConfig[] {
  const savedMap = new Map(saved.map((w) => [w.id, w]));
  const result: WidgetConfig[] = saved.map((w) => ({ ...w }));
  for (const def of DEFAULT_WIDGETS) {
    if (!savedMap.has(def.id)) result.push({ ...def });
  }
  return result;
}

export function useDashboardConfig() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ widgetConfig: WidgetConfig[] }>({
    queryKey: QK,
    queryFn: () => apiFetch("/api/user-preferences/dashboard"),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const saveMut = useMutation({
    mutationFn: (widgetConfig: WidgetConfig[]) =>
      apiFetch("/api/user-preferences/dashboard", {
        method: "PUT",
        body: JSON.stringify({ widgetConfig }),
      }),
    onSuccess: (res: any) => {
      qc.setQueryData(QK, { widgetConfig: res.widgetConfig });
    },
  });

  const resetMut = useMutation({
    mutationFn: () =>
      apiFetch("/api/user-preferences/dashboard", { method: "DELETE" }),
    onSuccess: () => {
      qc.setQueryData(QK, { widgetConfig: DEFAULT_WIDGETS });
    },
  });

  const widgets = isLoading || !data
    ? DEFAULT_WIDGETS
    : mergeWithDefaults(data.widgetConfig);

  const isEnabled = useCallback(
    (id: WidgetId) => widgets.find((w) => w.id === id)?.enabled ?? true,
    [widgets],
  );

  return {
    widgets,
    isLoading,
    isEnabled,
    saveWidgets: saveMut.mutate,
    resetWidgets: resetMut.mutate,
    isSaving: saveMut.isPending || resetMut.isPending,
  };
}
