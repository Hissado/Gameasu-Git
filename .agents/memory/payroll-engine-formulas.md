---
name: Payroll engine formulas
description: Canonical Togo CGI payroll formulas — where they live and why they diverged
---

## Source unique : artifacts/api-server/src/lib/payroll-engine.ts

All payroll calculations must import from this file. Never duplicate formulas.

## Formules canoniques (CGI Togo, validées vs Excel de référence)

- CNSS salarial : **9 %** du brut (pas 4 % — le 4 % était le vieux taux CNSS-retraite seul)
- IPTS : **0 FCFA séparé** — intégré dans l'abattement base imposable (28 % combiné)
- Base imposable mensuelle : `Math.floor(brut × 0.91 × 0.72 / 1000) × 1000`
  - 91 % = après CNSS 9 %
  - 72 % = après abattement combiné 28 % (frais pro 20 % + déductions légales 8 %)
  - Arrondi au **millier inférieur** (Math.floor, pas Math.round)
- Barème IRPP : **8 tranches** (pas 7)
  - 0–900K : 0 %
  - 900K–1.2M : **3 %** (ancien code avait 7 % → bug principal)
  - 1.2M–2.5M : 7 %
  - 2.5M–4M : 11 %
  - 4M–6M : 15 %
  - 6M–10M : 20 %
  - 10M–15M : 25 %
  - >15M : 30 %
- Net = Brut − CNSS − IRPP mensuel (pas d'IPTS séparé)

## Why: source of divergence
The old code had 3 separate implementations (simulateur.tsx, payroll.ts, payroll-extended.ts)
with different rates and barèmes. payroll.ts used 4% CNSS (official CNSS-retraite only).
The simulator used 9% (combined social contributions) and 20% abattement (not 28%).
payroll-extended.ts had wrong 7-bracket table. All now delegate to payroll-engine.ts.

## Validation (Net=120 000, 0 part → Brut=132 231 ✓)
Brut: 132,231 | CNSS: 11,901 | Base: 86,000 | IRPP/mois: 330 | Net: 120,000
