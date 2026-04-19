// Helper fetch pour appeler l'API EDOLE avec authentification automatique.
// Utilisé pour les endpoints non encore couverts par le client OpenAPI généré.
function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const fullUrl = url.startsWith("/") ? url : `/api/${url}`;
  const res = await fetch(fullUrl, { ...options, headers });
  if (!res.ok) {
    let body: any = null;
    try { body = await res.json(); } catch {}
    throw new Error(body?.error || body?.detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null as T;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text() as any;
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

// Ajoute le token d'authentification en query string pour permettre au navigateur
// d'afficher des images servies depuis /uploads (auth-protégé).
export function mediaUrl(url?: string | null): string {
  if (!url) return "";
  if (!url.startsWith("/uploads/")) return url;
  const token = getToken();
  if (!token) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}
