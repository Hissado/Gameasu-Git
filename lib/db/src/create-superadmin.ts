import { db } from "./index";
import { usersTable } from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

async function main() {
  const hash = await bcrypt.hash("Cockpit2025!", 10);
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, "cockpit@gameasu.com"));

  if (existing.length > 0) {
    await db
      .update(usersTable)
      .set({ passwordHash: hash, role: "super_admin" })
      .where(eq(usersTable.email, "cockpit@gameasu.com"));
    console.log("updated");
  } else {
    await db.insert(usersTable).values({
      email: "cockpit@gameasu.com",
      name: "Super Admin Gaméasù",
      passwordHash: hash,
      role: "super_admin",
    });
    console.log("created");
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
