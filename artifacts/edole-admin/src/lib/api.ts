// Helper fetch pour appeler l'API Gameasu avec authentification automatique.
// Émet un événement global "auth:unauthorized" sur 401 pour permettre la
// déconnexion automatique depuis le contexte d'authentification.

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(message: string, status: number, body: any = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

function getContextToken(): string | null {
  return localStorage.getItem("expert_context_token");
}

// `body` élargi pour accepter des objets JSON (sérialisés automatiquement).
type ApiFetchOptions = Omit<RequestInit, "body"> & { body?: any; timeoutMs?: number };

type InFlightEntry = { promise: Promise<unknown>; controller: AbortController };
const inFlightGets = new Map<string, InFlightEntry>();
const DEFAULT_TIMEOUT_MS = 30_000;

function isReadOnlyRequest(method?: string) {
  return !method || method.toUpperCase() === "GET";
}

export function cancelApiRequests(reason = "Navigation ou changement d’organisation") {
  for (const entry of inFlightGets.values()) entry.controller.abort(reason);
  inFlightGets.clear();
}

export async function apiFetch<T = unknown>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const token = getToken();
  const ctxToken = getContextToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (ctxToken && !headers["X-Expert-Context-Token"]) {
    headers["X-Expert-Context-Token"] = ctxToken;
  }
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  // Sérialise automatiquement les bodies JSON (plain objects).
  let body: BodyInit | null | undefined = options.body as any;
  if (
    body &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer) &&
    typeof body !== "string"
  ) {
    body = JSON.stringify(body);
  }
  const fullUrl = url.startsWith("/") ? url : `/api/${url}`;
  const method = (options.method ?? "GET").toUpperCase();
  const canDedupe = isReadOnlyRequest(method) && !options.signal;
  const cacheKey = canDedupe ? `${method}:${fullUrl}:${JSON.stringify(headers)}` : "";
  const existing = cacheKey ? inFlightGets.get(cacheKey) : undefined;
  if (existing) return existing.promise as Promise<T>;

  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(`Timeout API après ${options.timeoutMs ?? DEFAULT_TIMEOUT_MS} ms`),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const { timeoutMs: _timeoutMs, signal: _signal, ...fetchOptions } = options;
  const request = (async () => {
    const res = await fetch(fullUrl, { ...fetchOptions, method, headers, body, signal: controller.signal });
    if (!res.ok) {
      let errBody: any = null;
      try { errBody = await res.json(); } catch {}
      if (res.status === 401) {
        // Notifie le AuthProvider qui se chargera de la redirection.
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      }
      if (res.status === 423) {
        // L'utilisateur doit changer son mot de passe avant toute autre action.
        if (typeof window !== "undefined" && !window.location.pathname.endsWith("/changer-mdp")) {
          window.dispatchEvent(new CustomEvent("auth:password-change-required"));
        }
      }
      if (res.status === 403) {
        window.dispatchEvent(new CustomEvent("auth:forbidden", { detail: errBody }));
      }
      throw new ApiError(
        errBody?.error || errBody?.detail || `HTTP ${res.status}`,
        res.status,
        errBody,
      );
    }
    if (res.status === 204) return null as T;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    return res.text() as any;
  })().finally(() => {
      window.clearTimeout(timeout);
      if (cacheKey) inFlightGets.delete(cacheKey);
    });
  if (cacheKey) inFlightGets.set(cacheKey, { promise: request, controller });
  return request;
}

export async function uploadFile(file: File): Promise<{ url: string; filename: string; mimeType: string; size: number }> {
  const fd = new FormData();
  fd.append("file", file);
  return apiFetch("/api/upload", { method: "POST", body: fd });
}

export async function uploadFiles(files: File[]): Promise<{ urls: string[] }> {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  return apiFetch("/api/upload/multi", { method: "POST", body: fd });
}

// Convertit une URL de média en chemin accessible par le navigateur.
// - /uploads/…  → /api/uploads/… (seul /api est routé par le proxy Replit)
// - Ajoute ?token= pour les <img> qui ne peuvent pas envoyer d'en-tête Authorization
export function mediaUrl(url?: string | null): string {
  if (!url) return "";
  // Réécriture du chemin pour passer par le proxy
  const normalized = url.startsWith("/uploads/")
    ? `/api${url}`
    : url;
  if (!normalized.startsWith("/api/uploads/")) return normalized;
  const token = getToken();
  if (!token) return normalized;
  const sep = normalized.includes("?") ? "&" : "?";
  return `${normalized}${sep}token=${encodeURIComponent(token)}`;
}
