import { db } from "./src/index";
import { organizationsTable, usersTable, organizationMembersTable } from "./src/schema";

async function main() {
  const slug = `tenant2-${Date.now()}`;
  const [org2] = await db.insert(organizationsTable).values({
    slug, name: "Tenant 2 SARL", legalName: "Tenant 2 SARL", currency: "XOF",
    country: "TG", locale: "fr-FR",
  } as any).returning();
  console.log("org2:", org2.id, org2.slug);

  const [u2] = await db.insert(usersTable).values({
    email: `admin2-${Date.now()}@tenant2.test`, password: "demo2026",
    firstName: "Admin", lastName: "Tenant2", role: "super_admin",
    isActive: true, organizationId: org2.id,
  } as any).returning();
  console.log("user2:", u2.id, u2.email);

  await db.insert(organizationMembersTable).values({
    organizationId: org2.id, userId: u2.id, role: "owner", status: "active",
  } as any);
  console.log("✓ tenant2 ready. Email:", u2.email);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
