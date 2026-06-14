const TOKEN_KEY = "cockpit_token";

export async function apiFetch<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((opts?.headers ?? {}) as Record<string, string>),
  };
  const r = await fetch(url, { ...opts, headers });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error((err as any).error ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}
