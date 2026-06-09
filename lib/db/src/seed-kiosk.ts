import { db } from "./index";
import { collaboratorsTable, kiosksTable, organizationsTable } from "./schema";
import { eq, isNull, and } from "drizzle-orm";

export async function seedKiosk() {
  console.log("• Seed kiosk...");

  // Assign kiosk codes to existing collaborators (skip if already has code)
  const collabs = await db
    .select({ id: collaboratorsTable.id, kioskCode: collaboratorsTable.kioskCode })
    .from(collaboratorsTable)
    .where(isNull(collaboratorsTable.deletedAt))
    .limit(10);

  const codes = ["1001", "1002", "1003", "1004", "1005", "1006", "1007", "1008", "1009", "1010"];

  for (let i = 0; i < collabs.length; i++) {
    const c = collabs[i];
    if (!c || c.kioskCode) continue;
    await db
      .update(collaboratorsTable)
      .set({ kioskCode: codes[i]! })
      .where(and(eq(collaboratorsTable.id, c.id), isNull(collaboratorsTable.deletedAt)))
      .catch(() => {});
  }

  // Create one demo kiosk per organization (skip if already has one)
  const orgs = await db
    .select({ id: organizationsTable.id, name: organizationsTable.name })
    .from(organizationsTable)
    .limit(10);

  for (const org of orgs) {
    const existing = await db
      .select({ id: kiosksTable.id })
      .from(kiosksTable)
      .where(eq(kiosksTable.organizationId, org.id))
      .limit(1);

    if (existing.length === 0) {
      await db
        .insert(kiosksTable)
        .values({
          organizationId: org.id,
          name: "Entrée principale",
          location: "Accueil",
          description: "Kiosk de pointage principal",
          isActive: true,
        })
        .catch(() => {});
    }
  }

  console.log("[kiosk] seed terminé");
}
