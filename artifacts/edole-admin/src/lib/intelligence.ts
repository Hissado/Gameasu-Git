import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type Insight = {
  id: string;
  kind: string;
  scope: string;
  scopeId?: string | null;
  audienceRole?: string | null;
  title: string;
  body?: string | null;
  severity?: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  generatedBy?: string;
  isRead: boolean;
  isPinned: boolean;
  isDismissed: boolean;
  validUntil?: string | null;
  createdAt: string;
};

export type Recommendation = {
  id: string;
  entityType: string;
  entityId?: string | null;
  action: string;
  title: string;
  reason?: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  impact?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  generatedBy?: string;
  isApplied: boolean;
  isDismissed: boolean;
  createdAt: string;
};

export type RiskFlag = {
  id: string;
  entityType: string;
  entityId?: string | null;
  severity: "low" | "medium" | "high" | "critical";
  category: string;
  title: string;
  description?: string | null;
  isResolved: boolean;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  detectedAt: string;
};

export type SmartScore = {
  id: string;
  entityType: string;
  entityId: string;
  scoreType: string;
  value: number;
  tier?: string | null;
  factors?: Array<{ key: string; label: string; weight: number; value: number; reason?: string }>;
  computedBy?: string;
  computedAt: string;
};

export type AssistantSummary = {
  id: string;
  scope: string;
  scopeId?: string | null;
  period?: string | null;
  title?: string | null;
  content: string;
  highlights?: string[];
  nextActions?: string[];
  generatedBy?: string;
  createdAt: string;
};

export type IntelligenceOverview = {
  aiAvailable: boolean;
  counts: { insightsOpen: number; recommendationsOpen: number; risksOpen: number; risksCritical: number };
  recentInsights: Insight[];
  topRecommendations: Recommendation[];
  topRisks: RiskFlag[];
};

export type AutomationRule = {
  id: string;
  name: string;
  description?: string | null;
  triggerType: string;
  triggerConfig?: Record<string, unknown>;
  conditions?: Array<{ field: string; op: string; value: unknown }>;
  actions: Array<{ kind: string; params: Record<string, unknown> }>;
  isActive: boolean;
  lastRunAt?: string | null;
  runCount: number;
  createdAt: string;
};

export type AutomationLog = {
  id: string;
  ruleId?: string | null;
  ruleName?: string | null;
  triggerType?: string | null;
  triggeredBy?: string | null;
  payload?: Record<string, unknown>;
  actionsExecuted?: Array<{ kind: string; ok: boolean; error?: string }>;
  status: "ok" | "partial" | "failed";
  durationMs?: number | null;
  executedAt: string;
};

export type AutomationCatalog = {
  triggers: { type: string; label: string; category: string }[];
  actions: { kind: string; label: string }[];
};

// ─── Intelligence ─────────────────────────────────────────────────
export const useIntelligenceOverview = () =>
  useQuery({ queryKey: ["intelligence", "overview"], queryFn: () => apiFetch<IntelligenceOverview>("/api/intelligence/overview") });

export const useInsights = (params: { scope?: string; kind?: string; unreadOnly?: boolean } = {}) => {
  const qs = new URLSearchParams();
  if (params.scope) qs.set("scope", params.scope);
  if (params.kind) qs.set("kind", params.kind);
  if (params.unreadOnly) qs.set("unreadOnly", "true");
  return useQuery({ queryKey: ["intelligence", "insights", params], queryFn: () => apiFetch<Insight[]>(`/api/intelligence/insights?${qs}`) });
};

export const useUpdateInsight = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<Insight, "isRead" | "isPinned" | "isDismissed">> }) =>
      apiFetch<Insight>(`/api/intelligence/insights/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intelligence"] }),
  });
};

export const useRecommendations = (params: { entityType?: string; entityId?: string; openOnly?: boolean } = {}) => {
  const qs = new URLSearchParams();
  if (params.entityType) qs.set("entityType", params.entityType);
  if (params.entityId) qs.set("entityId", params.entityId);
  if (params.openOnly === false) qs.set("openOnly", "false");
  return useQuery({ queryKey: ["intelligence", "recommendations", params], queryFn: () => apiFetch<Recommendation[]>(`/api/intelligence/recommendations?${qs}`) });
};

export const useApplyRecommendation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Recommendation>(`/api/intelligence/recommendations/${id}/apply`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intelligence"] }),
  });
};

export const useDismissRecommendation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Recommendation>(`/api/intelligence/recommendations/${id}/dismiss`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intelligence"] }),
  });
};

export const useRiskFlags = (params: { entityType?: string; entityId?: string; openOnly?: boolean } = {}) => {
  const qs = new URLSearchParams();
  if (params.entityType) qs.set("entityType", params.entityType);
  if (params.entityId) qs.set("entityId", params.entityId);
  if (params.openOnly === false) qs.set("openOnly", "false");
  return useQuery({ queryKey: ["intelligence", "risks", params], queryFn: () => apiFetch<RiskFlag[]>(`/api/intelligence/risks?${qs}`) });
};

export const useResolveRiskFlag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolutionNote }: { id: string; resolutionNote?: string }) =>
      apiFetch<RiskFlag>(`/api/intelligence/risks/${id}/resolve`, { method: "PATCH", body: { resolutionNote } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intelligence"] }),
  });
};

export const useSummaries = (params: { scope?: string; scopeId?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.scope) qs.set("scope", params.scope);
  if (params.scopeId) qs.set("scopeId", params.scopeId);
  return useQuery({ queryKey: ["intelligence", "summaries", params], queryFn: () => apiFetch<AssistantSummary[]>(`/api/intelligence/summaries?${qs}`) });
};

export const useGenerateSummary = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { scope: string; scopeId?: string | null; period?: string; context: string; title?: string }) =>
      apiFetch<AssistantSummary>("/api/intelligence/summaries/generate", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intelligence", "summaries"] }),
  });
};

// ─── Automation ───────────────────────────────────────────────────
export const useAutomationCatalog = () =>
  useQuery({ queryKey: ["automation", "catalog"], queryFn: () => apiFetch<AutomationCatalog>("/api/automation/catalog"), staleTime: Infinity });

export const useAutomationRules = () =>
  useQuery({ queryKey: ["automation", "rules"], queryFn: () => apiFetch<AutomationRule[]>("/api/automation/rules") });

export const useCreateAutomationRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<AutomationRule, "id" | "createdAt" | "runCount" | "lastRunAt">) =>
      apiFetch<AutomationRule>("/api/automation/rules", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation"] }),
  });
};

export const useUpdateAutomationRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<AutomationRule> }) =>
      apiFetch<AutomationRule>(`/api/automation/rules/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation"] }),
  });
};

export const useDeleteAutomationRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/automation/rules/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation"] }),
  });
};

export const useRunAutomationRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: Record<string, unknown> }) =>
      apiFetch<{ ok: boolean }>(`/api/automation/rules/${id}/run`, { method: "POST", body: { payload: payload || {} } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation"] }),
  });
};

export const useAutomationLogs = (ruleId?: string) => {
  const qs = ruleId ? `?ruleId=${ruleId}` : "";
  return useQuery({ queryKey: ["automation", "logs", ruleId], queryFn: () => apiFetch<AutomationLog[]>(`/api/automation/logs${qs}`) });
};

export const severityColor = (s?: string | null): string => {
  switch (s) {
    case "critical": return "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30";
    case "high": return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30";
    case "medium": case "warning": return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30";
    case "low": case "info": return "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30";
    case "success": return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30";
    default: return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30";
  }
};

export const priorityColor = (p?: string | null): string => {
  switch (p) {
    case "urgent": return "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300";
    case "high": return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300";
    case "medium": return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300";
    case "low": return "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300";
    default: return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300";
  }
};
