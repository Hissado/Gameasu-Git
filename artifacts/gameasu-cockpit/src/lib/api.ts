const TOKEN_KEY = "cockpit_token";

type ApiFetchOptions = RequestInit & { timeoutMs?: number };
type InFlightEntry = { promise: Promise<unknown>; controller: AbortController };
const inFlightGets = new Map<string, InFlightEntry>();
const DEFAULT_TIMEOUT_MS = 30_000;

export function cancelApiRequests(reason = "Navigation Cockpit") {
  for (const entry of inFlightGets.values()) entry.controller.abort(reason);
  inFlightGets.clear();
}

export async function apiFetch<T = unknown>(url: string, opts?: ApiFetchOptions): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((opts?.headers ?? {}) as Record<string, string>),
  };
  const method = (opts?.method ?? "GET").toUpperCase();
  const cacheKey = method === "GET" && !opts?.signal ? `${method}:${url}:${JSON.stringify(headers)}` : "";
  const existing = cacheKey ? inFlightGets.get(cacheKey) : undefined;
  if (existing) return existing.promise as Promise<T>;

  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(`Timeout API après ${opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS} ms`),
    opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const { timeoutMs: _timeoutMs, signal: _signal, ...fetchOpts } = opts ?? {};
  const request = fetch(url, { ...fetchOpts, method, headers, signal: controller.signal })
    .finally(() => {
      window.clearTimeout(timeout);
      if (cacheKey) inFlightGets.delete(cacheKey);
    });
  if (cacheKey) inFlightGets.set(cacheKey, { promise: request, controller });

  const r = await request;
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error((err as any).error ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}
