/**
 * Runner standalone — seed Hissado Consulting
 * Usage: pnpm --filter @workspace/api-server exec tsx src/scripts/seed-hissado-runner.ts [orgId]
 */
import { seedHissado } from "../services/seed-hissado";

const orgId = process.argv[2]; // optional override

console.log("🚀 Démarrage seed Hissado Consulting...");
console.log(`   Base de données : ${(process.env.DATABASE_URL ?? "").split("@")[1] ?? "?"}`);
if (orgId) console.log(`   Org ID override : ${orgId}`);

seedHissado(orgId)
  .then(result => {
    const r = result as { log: string[]; counts: Record<string, number>; success: boolean };
    console.log("\n✅ Seed terminé avec succès !\n");
    console.log("Journal :");
    for (const line of r.log) console.log("  " + line);
    console.log("\nCompteurs :", r.counts);
    process.exit(0);
  })
  .catch(err => {
    console.error("\n❌ Erreur seed :", err);
    process.exit(1);
  });
