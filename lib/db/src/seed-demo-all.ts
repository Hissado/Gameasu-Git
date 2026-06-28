/**
 * Runner combiné — lance tous les seeds démo Gameasu dans l'ordre.
 *
 * Ordre :
 *   1. seed.ts (base — users, demo data)           → supposé déjà exécuté
 *   2. seed-saas.ts (organisations, plans, modules) → supposé déjà exécuté
 *   3. seed-rich.ts (clients, projets, CRM...)      → supposé déjà exécuté
 *   4. seed-demo-accounting.ts  (comptabilité SYSCOHADA, budget FP&A, centres de coût)
 *   5. seed-demo-hr.ts          (départements, postes, collaborateurs, contrats)
 *   6. seed-demo-hr-supplement.ts (formations, offres emploi, candidatures, congés)
 *   7. seed-inventory.ts        (produits, stock)
 *   8. seed-operations.ts       (missions terrain)
 *
 * Lancement :
 *   cd lib/db && pnpm exec tsx src/seed-demo-all.ts
 */

import { seedDemoAccounting }   from "./seed-demo-accounting";
import { seedDemoHR }           from "./seed-demo-hr";
import { seedDemoHRSupplement } from "./seed-demo-hr-supplement";
import { seedInventoryDemo }    from "./seed-inventory";
import { seedOperationsDemo }   from "./seed-operations";

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Gameasu — Seeds démo complets");
  console.log("═══════════════════════════════════════════════════════════\n");

  await seedDemoAccounting();
  console.log();
  await seedDemoHR();
  console.log();
  await seedDemoHRSupplement();
  console.log();
  await seedInventoryDemo();
  console.log();
  await seedOperationsDemo();

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  ✅ Tous les seeds démo ont été appliqués avec succès !");
  console.log("═══════════════════════════════════════════════════════════");
  process.exit(0);
}

main().catch((e) => {
  console.error("✗ Erreur fatale dans seed-demo-all :", e);
  process.exit(1);
});
