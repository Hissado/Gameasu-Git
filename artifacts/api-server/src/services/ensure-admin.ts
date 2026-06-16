import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, organizationsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const COCKPIT_ADMIN_EMAIL = "cockpit@gameasu.com";
const COCKPIT_ADMIN_PASSWORD = "Cockpit2026!";

/**
 * Garantit qu'un compte super_admin cockpit existe en base.
 * Idempotent : ne crée rien si l'email est déjà présent.
 */
export async function ensureCockpitAdmin(): Promise<void> {
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, COCKPIT_ADMIN_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    logger.info({ email: COCKPIT_ADMIN_EMAIL }, "Cockpit admin already exists");
    return;
  }

  const [org] = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .limit(1);

  if (!org) {
    logger.warn("ensureCockpitAdmin: no organization found, skipping");
    return;
  }

  const passwordHash = await bcrypt.hash(COCKPIT_ADMIN_PASSWORD, 12);

  await db.insert(usersTable).values({
    organizationId: org.id,
    email: COCKPIT_ADMIN_EMAIL,
    firstName: "Admin",
    lastName: "Cockpit",
    role: "super_admin",
    password: passwordHash,
    isActive: true,
    mustChangePassword: true,
  });

  logger.info({ email: COCKPIT_ADMIN_EMAIL }, "Cockpit admin created successfully");
}
