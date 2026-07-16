---
name: Payroll engine formulas
description: Canonical Togo CGI payroll formulas (column-by-column vs Excel SALAIRES sheet)
---

## Source unique : artifacts/api-server/src/lib/payroll-engine.ts

All payroll calculations must import from this file. Never duplicate formulas.

## Chaîne de calcul exacte (feuille SALAIRES — validée colonne par colonne)

| Colonne Excel | Nom           | Formule                                              |
|---------------|---------------|------------------------------------------------------|
| AX            | CNSS salarié  | Brut × 9 %                                          |
| AY            | Après CNSS    | Brut − AX                                           |
| AZ            | Abattement    | AY × 28 % (frais pro 20% + légal 8%)               |
| BA            | Base avant arr| AY − AZ − (nbPersonnes × 10 000 FCFA/mois)         |
| BB            | Base arrondie | ROUNDDOWN(BA, −3) = Math.floor(BA/1000)×1000        |
| BC            | IRPP mensuel  | barème progressif mensuel 8 tranches CGI Togo        |
| BD            | Total retenues| AX + BC                                              |
| BE            | Salaire net   | Brut − BD                                           |
| BF            | CNSS patronal | Brut × 22,5 %                                       |
| BG            | Prov. congés  | (Brut + BF) / 30 × 2,5                             |
| BH            | Coût total    | Brut + BF + BG                                      |

## Barème IRPP — seuils MENSUELS (annuels CGI ÷ 12)

| Mensuel           | Taux  | Annuel équivalent    |
|-------------------|-------|----------------------|
| ≤ 75 000          | 0 %   | ≤ 900 000            |
| 75 001–250 000    | 3 %   | 900K–3M              |
| 250 001–500 000   | 10 %  | 3M–6M                |
| 500 001–750 000   | 15 %  | 6M–9M                |
| 750 001–1 000 000 | 20 %  | 9M–12M               |
| 1M–1 250 000      | 25 %  | 12M–15M              |
| 1,25M–1 666 667   | 30 %  | 15M–20M              |
| > 1 666 667       | 35 %  | > 20M                |

## Points-clés non-évidents

1. **IRPP s'applique sur base MENSUELLE** (BB), pas sur un revenu annualisé × 12.
   L'ancien code annualisait BB × 12 → résultats identiques pour petits salaires
   (même tranche) mais diverge pour les salaires moyens/élevés.

2. **Déduction personnes à charge = 10 000 FCFA/MOIS/personne** (max 6),
   déduite de BA AVANT l'arrondi. Pas de "parts fiscales" × réduction annuelle.

3. **Provision congés = (Brut + CNSS patronal) / 30 × 2,5** — formule exacte Excel.
   NE PAS utiliser un taux forfaitaire (ex: 10,22% est une approximation).

4. **CNSS patronal = 22,5 %** (CNSS + AT/MP + Famille) — pas 16,4 %.

## Validations numériques
- Net=120 000, 0 charge → Brut=132 231, CNSS=11 901, BB=86 000, IRPP=330, Net=120 000 ✓
- Brut=500 000, 2 charges → BB=307 000, IRPP=10 950, Net=444 050 ✓
- Brut=1 000 000, 0 charge → BB=655 000, IRPP=53 500 ✓

**Why:** The formulas come from the user's Excel reference (feuille SALAIRES) validated
against Togolese CGI code. Previous implementations had 3 different engines with wrong
brackets (7 tranches instead of 8), wrong order of deductions, and approximate congés rate.
