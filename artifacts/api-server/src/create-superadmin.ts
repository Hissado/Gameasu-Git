import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
  // Get an existing super_admin's organizationId to reuse
  const [existing_sa] = await db
    .select({ organizationId: usersTable.organizationId })
    .from(usersTable)
    .where(eq(usersTable.role, "super_admin"))
    .limit(1);

  const organizationId = existing_sa?.organizationId;
  if (!organizationId) throw new Error("No existing super_admin found to borrow organizationId from");

  const hash = await bcrypt.hash("Cockpit2025!", 10);
  const [found] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, "cockpit@gameasu.com"));

  if (found) {
    await db
      .update(usersTable)
      .set({ password: hash, role: "super_admin", organizationId })
      .where(eq(usersTable.email, "cockpit@gameasu.com"));
    console.log("updated");
  } else {
    await db.insert(usersTable).values({
      email: "cockpit@gameasu.com",
      firstName: "Super",
      lastName: "Admin",
      password: hash,
      role: "super_admin",
      organizationId,
    });
    console.log("created");
  }
  process.exit(0);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
