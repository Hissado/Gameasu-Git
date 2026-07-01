import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// ─── Slug utility ─────────────────────────────────────────────────────────────

export function nameToSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) +
    "-" +
    Date.now().toString(36)
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExpertFirm = {
  id: string; name: string; slug: string; country: string;
  email?: string; phone?: string; address?: string; logoUrl?: string;
  plan: string; createdAt: string;
};

export type ExpertMember = {
  id: string; firmId: string; userId: string; role: string; joinedAt: string;
  user?: { id: string; firstName: string; lastName: string; email: string; role: string; };
};

export type ExpertClientRow = {
  id: string; firmId: string; orgId: string; accessLevel: string;
  isActive: boolean; notes?: string; grantedAt: string;
  org: { id: string; name: string; country: string; slug: string; };
  subscription?: { planName: string; status: string; planCode: string; } | null;
};

export type DocStatus = "en_attente" | "recu" | "valide" | "rejete";

export type DocRequest = {
  id: string; firmId: string; orgId: string; title: string; description?: string;
  status: DocStatus;
  dueDate?: string; fileUrl?: string; fileName?: string;
  requestedById: string; createdAt: string; updatedAt: string;
};

export type ExpertDashboard = {
  clientCount: number;
  activeSubscriptions: number;
  pendingDocumentRequests: number;
  totalInvoiced: number;
  totalPaid: number;
  activeProjects: number;
};

export type ClientKpi = {
  orgId: string;
  totalInvoiced: number;
  totalPaid: number;
  activeProjects: number;
  pendingDocs: number;
  unpaidInvoices: number;
  totalExpenses: number;
};

export type ExpertContextSession = {
  contextToken: string;
  targetOrgId: string;
  expiresAt: string;
};

// ─── Active Firm State (localStorage-backed) ─────────────────────────────────

const FIRM_KEY    = "expert_active_firm_id";
const CTX_ORG_KEY = "expert_context_org_id";
const CTX_TKN_KEY = "expert_context_token";

export function getActiveFirmId(): string | null {
  try { return localStorage.getItem(FIRM_KEY); } catch { return null; }
}
export function setActiveFirmId(id: string | null): void {
  try { id ? localStorage.setItem(FIRM_KEY, id) : localStorage.removeItem(FIRM_KEY); } catch {}
}
export function getContextOrgId(): string | null {
  try { return localStorage.getItem(CTX_ORG_KEY); } catch { return null; }
}
export function setContextOrgId(id: string | null): void {
  try { id ? localStorage.setItem(CTX_ORG_KEY, id) : localStorage.removeItem(CTX_ORG_KEY); } catch {}
}
export function getContextToken(): string | null {
  try { return localStorage.getItem(CTX_TKN_KEY); } catch { return null; }
}
export function setContextToken(tok: string | null): void {
  try { tok ? localStorage.setItem(CTX_TKN_KEY, tok) : localStorage.removeItem(CTX_TKN_KEY); } catch {}
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useExpertFirms() {
  return useQuery({
    queryKey: ["expert/firms"],
    queryFn: () => apiFetch<ExpertFirm[]>("/api/expert/firms"),
    staleTime: 60_000,
  });
}

export function useActiveFirm() {
  const { data: firms } = useExpertFirms();
  const [firmId, _setFirmId] = useState<string | null>(getActiveFirmId);

  useEffect(() => {
    if (!firms?.length) return;
    if (!firmId || !firms.find((f) => f.id === firmId)) {
      const first = firms[0].id;
      setActiveFirmId(first);
      _setFirmId(first);
    }
  }, [firms, firmId]);

  const setFirm = (id: string) => { setActiveFirmId(id); _setFirmId(id); };
  const activeFirm = firms?.find((f) => f.id === firmId) ?? null;
  return { firmId: firmId ?? null, setFirm, firms: firms ?? [], activeFirm };
}

export function useExpertDashboard(firmId: string | null) {
  return useQuery({
    queryKey: ["expert/dashboard", firmId],
    queryFn: () => apiFetch<ExpertDashboard>(`/api/expert/firms/${firmId}/dashboard`),
    enabled: !!firmId,
    staleTime: 2 * 60_000,
  });
}

export function useExpertClients(firmId: string | null) {
  return useQuery({
    queryKey: ["expert/clients", firmId],
    queryFn: () => apiFetch<ExpertClientRow[]>(`/api/expert/firms/${firmId}/clients`),
    enabled: !!firmId,
    staleTime: 60_000,
  });
}

export function useExpertMembers(firmId: string | null) {
  return useQuery({
    queryKey: ["expert/members", firmId],
    queryFn: () => apiFetch<ExpertMember[]>(`/api/expert/firms/${firmId}/members`),
    enabled: !!firmId,
    staleTime: 60_000,
  });
}

export function useDocRequests(firmId: string | null, orgId: string | null) {
  return useQuery({
    queryKey: ["expert/doc-requests", firmId, orgId],
    queryFn: () => apiFetch<DocRequest[]>(`/api/expert/firms/${firmId}/clients/${orgId}/document-requests`),
    enabled: !!firmId && !!orgId,
    staleTime: 30_000,
  });
}

export function useExpertClientKpis(firmId: string | null) {
  return useQuery({
    queryKey: ["expert/client-kpis", firmId],
    queryFn: () => apiFetch<ClientKpi[]>(`/api/expert/firms/${firmId}/client-kpis`),
    enabled: !!firmId,
    staleTime: 3 * 60_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateFirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; country: string; email?: string; phone?: string }) =>
      apiFetch<ExpertFirm>("/api/expert/firms", {
        method: "POST",
        body: { ...body, slug: nameToSlug(body.name) },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expert/firms"] }),
  });
}

export function useUpdateFirm(firmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ExpertFirm>) =>
      apiFetch<ExpertFirm>(`/api/expert/firms/${firmId}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expert/firms"] }),
  });
}

export function useInviteMember(firmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { userId: string; role: string }) =>
      apiFetch<ExpertMember>(`/api/expert/firms/${firmId}/members`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expert/members", firmId] }),
  });
}

export function useRemoveMember(firmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/expert/firms/${firmId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expert/members", firmId] }),
  });
}

export function useAddClientOrg(firmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string; country: string; ownerFirstName: string; ownerLastName: string;
      ownerEmail: string; accessLevel: string; industry?: string;
    }) =>
      apiFetch(`/api/expert/firms/${firmId}/clients/new-org`, {
        method: "POST",
        body: { ...body, slug: nameToSlug(body.name) },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expert/clients", firmId] });
      qc.invalidateQueries({ queryKey: ["expert/dashboard", firmId] });
    },
  });
}

export function useUnlinkClient(firmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orgId: string) =>
      apiFetch(`/api/expert/firms/${firmId}/clients/${orgId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expert/clients", firmId] });
      qc.invalidateQueries({ queryKey: ["expert/dashboard", firmId] });
      qc.invalidateQueries({ queryKey: ["expert/client-kpis", firmId] });
    },
  });
}

export function useCreateDocRequest(firmId: string, orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; description?: string; dueDate?: string }) =>
      apiFetch(`/api/expert/firms/${firmId}/clients/${orgId}/document-requests`, {
        method: "POST", body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expert/doc-requests", firmId, orgId] }),
  });
}

export function useUpdateDocRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: string; fileUrl?: string; fileName?: string }) =>
      apiFetch(`/api/expert/document-requests/${id}`, { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expert/doc-requests"] }),
  });
}

export function useSwitchClientContext(firmId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orgId: string) =>
      apiFetch<ExpertContextSession>(
        `/api/expert/firms/${firmId}/clients/${orgId}/switch`,
        { method: "POST" }
      ),
    onSuccess: (data) => {
      setContextToken(data.contextToken);
      setContextOrgId(data.targetOrgId);
      qc.invalidateQueries({ queryKey: ["expert/context"] });
    },
  });
}

export function useInviteClientMember(firmId: string, orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { firstName: string; lastName: string; email: string; role?: string }) =>
      apiFetch(`/api/expert/firms/${firmId}/clients/${orgId}/invite-member`, {
        method: "POST", body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-users", orgId] }),
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  en_attente: "En attente",
  recu:       "Reçu",
  valide:     "Validé",
  rejete:     "Rejeté",
};

export const DOC_STATUS_COLOR: Record<DocStatus, string> = {
  en_attente: "bg-amber-50 text-amber-700 border-amber-200",
  recu:       "bg-blue-50 text-blue-700 border-blue-200",
  valide:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejete:     "bg-red-50 text-red-700 border-red-200",
};

export const ACCESS_LABEL: Record<string, string> = {
  full:    "Accès complet",
  read:    "Lecture seule",
  billing: "Facturation",
};

export const PLAN_COLOR: Record<string, string> = {
  STARTER:      "bg-slate-100 text-slate-600",
  GROWTH:       "bg-blue-50 text-blue-700",
  PROFESSIONAL: "bg-purple-50 text-purple-700",
  ENTERPRISE:   "bg-amber-50 text-amber-700",
};
