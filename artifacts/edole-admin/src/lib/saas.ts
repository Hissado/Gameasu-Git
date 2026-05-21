import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const TOKEN_KEY = "auth_token";

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const url = `${import.meta.env.BASE_URL}api${path}`.replace(/\/+api/, "/api");
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    window.dispatchEvent(new Event("auth:unauthorized"));
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.error || `HTTP ${res.status}`);
    Object.assign(err, { status: res.status, body });
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export type Organization = {
  id: string; slug: string; name: string; legalName?: string;
  industry?: string; country?: string; currency: string; timezone: string;
  locale: string; logoUrl?: string; primaryColor?: string; secondaryColor?: string;
  contactEmail?: string; contactPhone?: string; address?: string; taxId?: string;
  isActive: boolean; isDefault: boolean;
};

export type SubscriptionPlan = {
  id: string; code: "STARTER" | "GROWTH" | "PROFESSIONAL" | "ENTERPRISE";
  name: string; tagline?: string; description?: string;
  monthlyPricePerSeat: number; annualPricePerSeat: number;
  setupFee: number; minimumSeats: number; includedSeats: number; maxSeats: number | null;
  currency: string; includedModules: string[]; isFeatured: boolean; sortOrder: number;
  features?: { id: string; label: string; included: boolean }[];
};

export type Subscription = {
  id: string; organizationId: string; planId: string;
  status: "trial" | "active" | "past_due" | "canceled";
  billingCycle: "monthly" | "annual";
  seats: number; currentPeriodStart: string; currentPeriodEnd?: string;
  unitPrice: number; setupFee: number; currency: string;
};

export type OrganizationModule = {
  id: string; organizationId: string; moduleKey: string;
  enabled: boolean; source: "plan" | "addon" | "manual";
};

export type BillingEvent = {
  id: string; organizationId: string; kind: string; label: string;
  amount: number; currency: string; status: string; reference?: string;
  occurredAt: string;
};

export function useCurrentOrganization() {
  return useQuery({
    queryKey: ["org", "current"],
    queryFn: () => api<Organization>("/organizations/current"),
    staleTime: 60_000,
  });
}

export function useCurrentSubscription() {
  return useQuery({
    queryKey: ["subscription", "current"],
    queryFn: () => api<{ subscription: Subscription; plan: SubscriptionPlan }>("/subscriptions/current"),
    staleTime: 60_000,
  });
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: () => api<SubscriptionPlan[]>("/subscription-plans"),
    staleTime: 5 * 60_000,
  });
}

export function useOrganizationModules() {
  return useQuery({
    queryKey: ["org-modules"],
    queryFn: () => api<OrganizationModule[]>("/organization-modules"),
    staleTime: 30_000,
  });
}

export function useBillingSummary() {
  return useQuery({
    queryKey: ["billing", "summary"],
    queryFn: () => api<{
      subscription: Subscription | null; plan: SubscriptionPlan | null;
      nextInvoiceAt?: string | null; seats: number; unitPrice: number;
      currency: string; paidYearToDate: number; recentEvents: BillingEvent[];
    }>("/billing/summary"),
    staleTime: 60_000,
  });
}

export function useBillingEvents() {
  return useQuery({
    queryKey: ["billing", "events"],
    queryFn: () => api<BillingEvent[]>("/billing/events"),
    staleTime: 60_000,
  });
}

export function useBillingUsage() {
  return useQuery({
    queryKey: ["billing", "usage"],
    queryFn: () => api<{ seatsUsed: number; seatsTotal: number; ratio: number; plan: SubscriptionPlan }>("/billing/usage"),
    staleTime: 60_000,
  });
}

export function useWorkspaceSettings() {
  return useQuery({
    queryKey: ["workspace-settings"],
    queryFn: () => api<{
      organization: Organization; subscription?: Subscription; plan?: SubscriptionPlan;
      modules: OrganizationModule[];
    }>("/workspace-settings"),
    staleTime: 30_000,
  });
}

export function useChangePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planCode: string) =>
      api<{ subscription: Subscription; plan: SubscriptionPlan }>("/subscriptions/change-plan", {
        method: "POST",
        body: JSON.stringify({ planCode }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscription"] });
      qc.invalidateQueries({ queryKey: ["org-modules"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["workspace-settings"] });
    },
  });
}

export function useChangeBillingCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cycle: "monthly" | "annual") =>
      api<Subscription>("/subscriptions/change-billing-cycle", {
        method: "POST",
        body: JSON.stringify({ cycle }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscription"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

export function useToggleModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleKey, enabled }: { moduleKey: string; enabled: boolean }) =>
      api<OrganizationModule>(`/organization-modules/${moduleKey}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-modules"] });
      qc.invalidateQueries({ queryKey: ["workspace-settings"] });
    },
  });
}

export function useUpdateWorkspaceSettings(group: "general" | "branding" | "preferences") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Organization>) =>
      api<Organization>(`/workspace-settings/${group}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org"] });
      qc.invalidateQueries({ queryKey: ["workspace-settings"] });
    },
  });
}

/** Routes frontend ↔ clé module pour le feature gating */
export const ROUTE_MODULE_MAP: Array<{ test: (path: string) => boolean; moduleKey: string }> = [
  { test: (p) => p === "/" || p.startsWith("/dashboard"), moduleKey: "dashboard" },
  { test: (p) => p.startsWith("/clients") || p.startsWith("/commercial/clients"), moduleKey: "clients" },
  { test: (p) => p.startsWith("/services") || p.startsWith("/commercial/services"), moduleKey: "services" },
  { test: (p) => p.startsWith("/projects"), moduleKey: "projects" },
  { test: (p) => p.startsWith("/tasks"), moduleKey: "tasks" },
  { test: (p) => p.startsWith("/crm") || p.startsWith("/orders") || p.startsWith("/proformas") || p.startsWith("/invoices") || p.startsWith("/payments"), moduleKey: "sales_crm" },
  { test: (p) => p.startsWith("/accounting"), moduleKey: "accounting" },
  { test: (p) => p.startsWith("/fpa"), moduleKey: "financial_planning" },
  { test: (p) => p.startsWith("/finance"), moduleKey: "accounting" },
  { test: (p) => p.startsWith("/logistics"), moduleKey: "operations" },
  { test: (p) => p.startsWith("/equipment"), moduleKey: "inventory_assets" },
  { test: (p) => p.startsWith("/rentals") || p.startsWith("/inspections"), moduleKey: "rentals" },
  { test: (p) => p.startsWith("/documents"), moduleKey: "documents" },
  { test: (p) => p.startsWith("/hr") || p.startsWith("/collaborators"), moduleKey: "team_hr" },
  { test: (p) => p.startsWith("/messaging") || p.startsWith("/calls"), moduleKey: "communications" },
  { test: (p) => p.startsWith("/reports") || p.startsWith("/map"), moduleKey: "reports" },
  { test: (p) => p.startsWith("/marketing"), moduleKey: "marketing" },
  { test: (p) => p.startsWith("/admin") || p.startsWith("/users"), moduleKey: "administration" },
  { test: (p) => p.startsWith("/billing"), moduleKey: "billing_subscription" },
  { test: (p) => p.startsWith("/workspace-settings") || p.startsWith("/settings"), moduleKey: "workspace_settings" },
];

export function moduleKeyForPath(path: string): string | null {
  const match = ROUTE_MODULE_MAP.find((r) => r.test(path));
  return match?.moduleKey ?? null;
}
