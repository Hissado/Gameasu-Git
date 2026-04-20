import { useAuth } from "./auth";

/**
 * Hook léger pour tester les permissions côté UI (cacher boutons, etc.).
 * Les permissions effectives sont chargées via /auth/me et retournées dans
 * `user.permissions: string[]` (cf. backend rbac/permissions).
 *
 * Note : c'est un confort UI, pas une sécurité. Le backend reste l'autorité.
 */
export function usePermissions() {
  const { user } = useAuth();
  const perms = (user as any)?.permissions as string[] | undefined;
  const set = new Set(perms ?? []);
  return {
    has: (code: string) => set.has(code),
    hasAny: (...codes: string[]) => codes.some((c) => set.has(c)),
    hasAll: (...codes: string[]) => codes.every((c) => set.has(c)),
    all: perms ?? [],
    isAdmin: user?.role === "admin" || user?.role === "super_admin",
  };
}
