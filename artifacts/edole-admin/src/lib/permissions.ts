import { useAuth } from "./auth";

/** Rôles en mode lecture seule (ne peuvent pas muter de données). */
const READ_ONLY_ROLES = new Set(["auditeur"]);

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
  const role = user?.role ?? "";
  const isReadOnly = READ_ONLY_ROLES.has(role);
  return {
    has: (code: string) => set.has(code),
    hasAny: (...codes: string[]) => codes.some((c) => set.has(c)),
    hasAll: (...codes: string[]) => codes.every((c) => set.has(c)),
    all: perms ?? [],
    isAdmin: role === "admin" || role === "super_admin",
    /** Vrai si l'utilisateur peut effectuer des mutations (non-auditeur). */
    isReadOnly,
    /**
     * Vrai si l'utilisateur a la permission et n'est pas en mode lecture seule.
     * Usage : `const canCreate = perms.canWrite("projects.create")`
     */
    canWrite: (code: string) => !isReadOnly && set.has(code),
    /**
     * Vrai si l'utilisateur peut écrire sur n'importe laquelle des permissions.
     */
    canWriteAny: (...codes: string[]) => !isReadOnly && codes.some((c) => set.has(c)),
  };
}
