/**
 * Tests des contrôles de chronologie des dates introduits au lot P2 (audit
 * §F #11). Fonctions pures, sans dépendance base de données.
 * Exécution : pnpm --filter @workspace/api-server run test:p2
 */
import {
  invoiceDatesError,
  paymentDateError,
  receptionDateError,
  contractDatesError,
} from "../lib/date-guards";

let failures = 0;
function ok(label: string, cond: boolean) {
  if (!cond) { failures++; console.error(`✘ ${label}`); }
  else console.log(`✔ ${label}`);
}

// ── Dates : ordre invalide bloqué, ordre valide accepté ─────────────────────
ok("Échéance avant émission → erreur", invoiceDatesError("2026-02-10", "2026-02-01") !== null);
ok("Échéance après émission → OK", invoiceDatesError("2026-02-01", "2026-02-28") === null);
ok("Même jour émission/échéance → OK", invoiceDatesError("2026-02-01", "2026-02-01") === null);
ok("Paiement avant facture → erreur", paymentDateError("2026-03-05", "2026-03-01") !== null);
ok("Paiement après facture → OK", paymentDateError("2026-03-01", "2026-03-10") === null);
ok("Réception avant commande → erreur", receptionDateError("2026-01-15", "2026-01-10") !== null);
ok("Fin de contrat avant début → erreur", contractDatesError("2026-06-01", "2026-01-01") !== null);
ok("Fin de contrat vide (CDI) → OK", contractDatesError("2026-06-01", null) === null);
ok("Dates optionnelles absentes → OK", invoiceDatesError(null, null) === null);

if (failures > 0) { console.error(`\n${failures} test(s) en échec.`); process.exit(1); }
console.log("\nTous les tests P2 passent.");
