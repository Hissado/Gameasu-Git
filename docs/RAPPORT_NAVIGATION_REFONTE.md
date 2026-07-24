# Rapport — Refonte de la navigation (arborescence cible simplifiée)

> Refonte de la barre latérale globale (`Layout.tsx` → `NAV_GROUPS`) vers
> l'arborescence cible fournie, et re-catégorisation du panneau RH (`hr/_layout.tsx`).
> Principe constant : **aucune page perdue** (cross-check anti-orphelin) et
> **aucun changement d'accès** (moduleKey/permissionKey préservés par élément).
>
> Branche : `claude/gameasu-erp-audit-refactor-cz172i`

## Décisions d'arbitrage (validées)

1. **Blocs RH** → appliqués au **panneau blanc** du module (HrShell), la barre
   bleue restant en lanceurs — évite de ré-introduire la duplication barre/panneau.
2. **Éléments hors cible** (Messagerie, Appels, Approbations, Documents cabinet,
   Portail Expert, Recouvrement, Automatisations, Données/Stockage/Support/Aide)
   → **conservés et replacés** au mieux, aucune page retirée de la navigation.

## Barre latérale globale — nouvelle structure

| Groupe (niveau 1) | Contenu |
|-------------------|---------|
| **Accueil** | Tableau de bord, Briefing · Messagerie, Appels · Approbations, Documents cabinet |
| **Assistant & Intelligence** | Porte IA unique : Assistant IA (Koffi), Insights & recommandations |
| **Ventes** | Relation client (CRM, Clients, Marketing) · Cycle de vente (Devis, Commandes, Tarification) · Facturation (Factures, Encaissements, Avoirs) |
| **Projets** | Projets, Tâches, Portefeuille, Charge équipe, Documents (liste aplatie) |
| **Logistique** | Services, Stock, Équipements, Opérations, Locations (liste aplatie) |
| **Achats** | Vue d'ensemble · Fournisseurs & Commandes · Facturation & Paiements (+ Import OCR) · Analyse |
| **Finance & Comptabilité** | Intelligence financière · Comptabilité (lanceur) · Trésorerie & Recouvrement · Planification (FP&A) · **Fiscalité** (hub : Moteur, Contrôle, Conformité) |
| **Ressources Humaines** | Lanceur module (détail 3 blocs dans le panneau) |
| **Mon espace** | Layout employé réduit (lanceur `/rh/mon-espace`) |
| **Rapports** | Centre transversal (lanceur `/rapports`) |
| **Portail Expert** | Conservé (module additionnel cabinet) |
| **Administration** | Utilisateurs, Rôles & permissions, Départements, Invitations, Journal d'audit · Paramètres, Automatisations · Données & Stockage · Assistance |
| **Abonnement & modules** | Lanceur `/abonnement` |

### Principaux mouvements

- **Accueil** sorti de « Pilotage » : ne porte plus que le tableau de bord + le
  briefing (+ communication et flux de travail transversaux).
- **Assistant & Intelligence** promu en **porte IA unique de premier niveau**
  (fusion Assistant IA + Intelligence, ex-sous-section de Pilotage).
- **Projets** et **Logistique** aplatis (sous-groupes fusionnés en une liste).
- **Fiscalité** devient un **hub unique** (Moteur fiscal, Contrôle fiscal,
  Conformité docs).
- **Rapports**, **Mon espace** et **Abonnement & modules** promus au premier niveau.
- Groupe renommé **Comptabilité & Finance → Finance & Comptabilité**.
- Groupe **Admin → Administration** avec entrées explicites vers les pages
  console (`/admin/users`, `/admin/roles`, `/admin/departments`, `/admin/audit`)
  jusque-là non exposées dans la barre latérale.

## Panneau RH (HrShell) — 3 blocs opérationnels

8 groupes → **5**, avec les 3 blocs cibles au cœur :

- **Vue générale** : Mon espace, Vue d'ensemble, Indicateurs, Rapports, Simulateur, Intelligence RH.
- **Effectif** : Collaborateurs, Organigramme, Postes, Départements.
- **Temps & Paie** : présence, congés, pointage, kiosques + toute la paie (fiches, avances, états, calendrier, déclarations, corrections, hors-cycle, fiscalité RH, virements).
- **Talent** : Recrutement, Intégration, Évaluations, Formations.
- **Dossier & Administratif** : contrats, templates, notes de frais, affectations, mouvements, registre légal, avantages, documents, réclamations, paramètres sectoriels, journal d'audit.

Les **41 pages RH** sont conservées (cross-check anti-orphelin).

## Vérifications

| Contrôle | Résultat |
|----------|----------|
| `check-routes` | ✅ 489 fichiers / 201 routes, aucun lien cassé |
| Typecheck `@workspace/edole-admin` | ✅ 0 erreur |
| `check-permissions` | ✅ 0 incohérence bloquante |
| Cross-check anti-orphelin (barre bleue) | ✅ 67 chemins, tous les anciens conservés + 5 nouvelles entrées Administration |
| Cross-check anti-orphelin (panneau RH) | ✅ 41 chemins conservés |

## À valider en préproduction

**Rendu visuel** (impossible à produire ici) : ordre et densité des groupes,
repliage de la barre, cohérence des icônes, et vérification qu'aucun double menu
n'apparaît (RH/Comptabilité restent des lanceurs vers leur panneau).
