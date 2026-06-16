import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, organizationsTable, organizationMembersTable } from "@workspace/db";
import { logger } from "../lib/logger";

const COCKPIT_ADMIN_EMAIL = "cockpit@gameasu.com";

/** Slug stable de l'organisation interne de la plateforme (jamais un tenant facturable). */
export const PLATFORM_ORG_SLUG = "gameasu-platform";

/** Garantit l'existence de l'organisation interne de la plateforme et renvoie son id. */
async function ensurePlatformOrg(): Promise<string> {
  const [existing] = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.slug, PLATFORM_ORG_SLUG))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(organizationsTable)
    .values({
      slug: PLATFORM_ORG_SLUG,
      name: "Gaméasù Plateforme",
      legalName: "Gaméasù Technology",
      industry: "Édition de logiciels",
      country: "TG",
      isActive: true,
      isDefault: false,
    })
    .onConflictDoNothing({ target: organizationsTable.slug })
    .returning({ id: organizationsTable.id });
  if (created) return created.id;

  // Course concurrente entre deux démarrages : relire la ligne gagnante.
  const [again] = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.slug, PLATFORM_ORG_SLUG))
    .limit(1);
  return again!.id;
}

/** Rattache (idempotent) un utilisateur à l'org plateforme en tant que propriétaire. */
async function ensureMembership(orgId: string, userId: string): Promise<void> {
  await db
    .insert(organizationMembersTable)
    .values({ organizationId: orgId, userId, role: "owner", isPrimary: true })
    .onConflictDoNothing();
}

/**
 * Le super-admin plateforme ne doit être membre d'aucun tenant client : on retire
 * toute adhésion résiduelle hors organisation plateforme (ex. compte historiquement
 * rattaché à un tenant de démo).
 */
async function pruneForeignMemberships(platformOrgId: string, userId: string): Promise<void> {
  await db
    .delete(organizationMembersTable)
    .where(and(
      eq(organizationMembersTable.userId, userId),
      ne(organizationMembersTable.organizationId, platformOrgId),
    ));
}

/**
 * Garantit qu'un compte super_admin Cockpit existe en base, rattaché à
 * l'organisation interne de la plateforme. Idempotent et sûr en production :
 *  - ne définit JAMAIS de mot de passe en clair ni codé en dur ;
 *  - ne réécrit JAMAIS le mot de passe d'un compte existant ;
 *  - n'élève JAMAIS un compte non super_admin (anti-escalade de privilèges).
 * Le premier mot de passe se définit via le lien sécurisé « Mot de passe oublié ».
 */
export async function ensureCockpitAdmin(): Promise<void> {
  const platformOrgId = await ensurePlatformOrg();

  const [existing] = await db
    .select({
      id: usersTable.id,
      role: usersTable.role,
      organizationId: usersTable.organizationId,
      isActive: usersTable.isActive,
    })
    .from(usersTable)
    .where(eq(usersTable.email, COCKPIT_ADMIN_EMAIL))
    .limit(1);

  if (existing) {
    if (existing.role !== "super_admin") {
      logger.error(
        { email: COCKPIT_ADMIN_EMAIL, role: existing.role },
        "ensureCockpitAdmin: un compte existe avec cet email mais n'est PAS super_admin — aucune élévation automatique",
      );
      return;
    }
    // Reparent vers l'org plateforme + réactivation si besoin (sans toucher au mot de passe).
    const patch: Partial<typeof usersTable.$inferInsert> = {};
    if (existing.organizationId !== platformOrgId) patch.organizationId = platformOrgId;
    if (!existing.isActive) patch.isActive = true;
    if (Object.keys(patch).length > 0) {
      await db.update(usersTable).set(patch).where(eq(usersTable.id, existing.id));
      logger.info(
        { email: COCKPIT_ADMIN_EMAIL, fields: Object.keys(patch) },
        "ensureCockpitAdmin: compte super_admin mis à jour",
      );
    }
    await ensureMembership(platformOrgId, existing.id);
    await pruneForeignMemberships(platformOrgId, existing.id);
    return;
  }

  // Création : mot de passe aléatoire inutilisable. L'admin le définit via le lien sécurisé.
  const unusablePassword = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
  const [created] = await db
    .insert(usersTable)
    .values({
      organizationId: platformOrgId,
      email: COCKPIT_ADMIN_EMAIL,
      firstName: "Super",
      lastName: "Admin",
      role: "super_admin",
      password: unusablePassword,
      isActive: true,
      mustChangePassword: true,
    })
    .onConflictDoNothing({ target: usersTable.email })
    .returning({ id: usersTable.id });

  if (created) {
    await ensureMembership(platformOrgId, created.id);
    await pruneForeignMemberships(platformOrgId, created.id);
    logger.info(
      { email: COCKPIT_ADMIN_EMAIL },
      "ensureCockpitAdmin: compte super_admin créé (mot de passe à définir via lien sécurisé)",
    );
  }
}
