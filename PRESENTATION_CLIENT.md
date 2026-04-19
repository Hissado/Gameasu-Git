# EDOLE AFRICA ADMIN
### Plateforme de pilotage opérationnel pour les entreprises du BTP en Afrique francophone

---

## 1. Vue d'ensemble

**EDOLE AFRICA ADMIN** est une plateforme SaaS tout-en-un conçue spécifiquement pour les entreprises du **Bâtiment et des Travaux Publics** opérant en Afrique francophone. Elle réunit dans un seul espace de travail l'ensemble des outils nécessaires au pilotage d'une société BTP moderne : gestion des chantiers, du parc matériel, des équipes, du commercial, de la comptabilité OHADA et de la communication client.

### À qui s'adresse-t-elle ?

- **Dirigeants & directeurs d'exploitation** qui ont besoin d'une vision consolidée en temps réel.
- **Chefs de chantier & responsables logistiques** qui suivent matériel, locations et inspections sur le terrain.
- **Équipes commerciales** qui gèrent prospects, devis, bons de commande, factures et encaissements.
- **Comptables & contrôleurs de gestion** qui produisent les états financiers conformes au plan comptable OHADA.
- **Ressources humaines** qui pilotent collaborateurs, contrats, affectations et départements.

### Les problèmes qu'elle résout

| Avant EDOLE | Avec EDOLE |
|---|---|
| Données éparpillées entre Excel, WhatsApp, papier | Source unique de vérité, accessible en mobilité |
| Matériel perdu, immobilisé ou loué deux fois | Inventaire QR, disponibilité temps réel, alertes |
| Factures émises en retard, recouvrement opaque | Pipeline devis → facture → encaissement automatisé |
| Comptabilité reconstituée en fin d'exercice | Écritures continues, balance et bilan en un clic |
| Pas de visibilité sur la performance commerciale | KPI consolidés, rapports financiers, alertes intelligentes |
| Communication client dispersée | Messagerie, appels et campagnes intégrés |

### Promesse de valeur

> **« Pilotez vos chantiers, votre matériel et vos équipes depuis une seule plateforme. »**
> Du devis au paiement, du chantier à la maintenance — en français, en FCFA, conçu pour le terrain africain.

---

## 2. Architecture du produit

L'application est organisée en **8 univers métier** accessibles depuis une barre latérale gauche, dans un ordre qui suit la logique opérationnelle d'une entreprise BTP :

```
┌─────────────────────────────────────────────────────────────┐
│  PILOTAGE       Tableau de bord · Rapports · Carte ·        │
│                 Alertes · Documents                          │
├─────────────────────────────────────────────────────────────┤
│  COMMUNICATION  Messagerie · Appels                          │
├─────────────────────────────────────────────────────────────┤
│  OPÉRATIONS     Chantiers · Tâches                           │
├─────────────────────────────────────────────────────────────┤
│  MATÉRIEL       Inventaire · QR · Locations · Inspections   │
│                 · Logistique                                 │
├─────────────────────────────────────────────────────────────┤
│  COMMERCIAL     Clients · Services · Pipeline CRM ·          │
│                 Bons de commande · Devis · Factures ·        │
│                 Encaissements                                │
├─────────────────────────────────────────────────────────────┤
│  MARKETING      Campagnes · Prospects                        │
├─────────────────────────────────────────────────────────────┤
│  RESSOURCES     Tableau RH · Collaborateurs · Départements   │
│  HUMAINES       · Postes · Affectations · Contrats ·         │
│                 Documents RH · Utilisateurs                  │
├─────────────────────────────────────────────────────────────┤
│  COMPTABILITÉ   Tableau financier · Plan comptable ·         │
│                 Écritures · Grand livre · Balance ·          │
│                 Résultat · Bilan · Comptes clients ·         │
│                 Fournisseurs · Banques · Immobilisations    │
└─────────────────────────────────────────────────────────────┘
```

### Parcours utilisateur type

1. **Connexion** sur l'espace professionnel (identifiants nominatifs, rôles différenciés).
2. **Tableau de bord** : vision instantanée des KPI clés (chantiers actifs, CA en cours, matériel mobilisé, créances).
3. **Navigation contextuelle** : chaque module est conçu pour une tâche précise et renvoie naturellement vers les modules connexes (un chantier ouvre ses tâches, ses locations, ses factures).
4. **Mobilité totale** : interface entièrement responsive, utilisable sur smartphone par les chefs de chantier comme sur grand écran par la direction.

### Identité visuelle

- **Palette** orange vif (#FF6B00) sur noir profond — la signature EDOLE, à la fois industrielle et premium.
- **Typographie** sans-serif moderne, hiérarchie claire pour la lisibilité en mobilité.
- **Densité** d'information élevée mais aérée, inspirée des meilleures plateformes B2B (Notion, Linear, Stripe).
- **Langue** intégralement française, devise FCFA partout.

---

## 3. Description des modules

### 3.1 PILOTAGE — Le centre de commandement

#### 📊 Tableau de bord
**Objectif** : donner au dirigeant la vision instantanée de l'activité.

L'utilisateur voit en un coup d'œil : chantiers actifs, chiffre d'affaires du mois, matériel mobilisé, créances en cours. Des graphiques d'évolution (CA, marge, occupation parc) permettent de détecter immédiatement les tendances. C'est la première page après la connexion — pensée pour donner confiance en moins de 5 secondes.

**Visuel à associer** : capture du dashboard avec les 4 cartes KPI orange/noir et les graphiques en bas. Idéalement avec des données réalistes (FCFA, chantiers africains).

---

#### 📈 Rapports
**Objectif** : produire les rapports métier exploitables.

Inclut le **rapport quotidien de stock** (snapshot du parc matériel — disponible, loué, en maintenance), le **rapport de charge des collaborateurs** (qui fait quoi, combien de tâches actives), et l'export PDF des indicateurs clés. Conçu pour les réunions hebdomadaires de direction.

**Visuel à associer** : tableau de stock avec colonnes statut + bouton "Exporter PDF".

---

#### 🗺️ Carte
**Objectif** : visualiser géographiquement les chantiers et le matériel.

Carte interactive (Leaflet/OpenStreetMap) qui regroupe les équipements par chantier. Permet aux chefs d'exploitation de visualiser instantanément où se trouve quel engin, quel chantier est dégarni, où concentrer la logistique du lendemain.

**Visuel à associer** : capture de la carte avec marqueurs orange clusterisés sur Abidjan / Dakar / Douala.

---

#### 🔔 Alertes
**Objectif** : ne plus jamais rater une échéance critique.

Le système scanne automatiquement la base toutes les 6 heures et génère des alertes priorisées :
- Locations qui se terminent dans **moins de 3 jours**
- Factures **en retard de paiement**
- Contrats RH qui expirent dans **moins de 30 jours**
- Équipements dont la **maintenance** est due

Chaque alerte renvoie en un clic vers l'entité concernée pour action. Déduplication intelligente — pas de spam.

**Visuel à associer** : liste d'alertes avec badges colorés (rouge / orange / jaune) et icônes par type.

---

#### 📁 Documents
**Objectif** : centraliser tous les documents de l'entreprise.

Bibliothèque documentaire unifiée avec recherche, filtres par type, par projet, par client. Statistiques d'usage en haut de page. Permet d'arrêter la dispersion entre Drive, WhatsApp et clés USB.

**Visuel à associer** : grille/liste de documents avec aperçus + barre de recherche.

---

### 3.2 OPÉRATIONS — Le cœur du métier

#### 🏗️ Chantiers
**Objectif** : piloter chaque chantier de bout en bout.

Liste filtrable de tous les chantiers (actifs, planifiés, terminés). Chaque fiche chantier regroupe : équipe affectée, matériel mobilisé, tâches en cours, bons de commande, factures liées, documents (plans, contrats, photos), liens Drive externes. C'est le dossier vivant du projet.

**Visuel à associer** : liste de chantiers avec statuts + capture d'une fiche chantier détaillée.

---

#### ✅ Tâches
**Objectif** : décomposer le travail en actions concrètes assignables.

Trois vues au choix : **Liste**, **Kanban** (À faire / En cours / Terminé), **Calendrier**. Sous-tâches imbriquées, historique des modifications, assignation à un collaborateur, échéance, priorité. Synchronisation automatique avec les chantiers.

**Visuel à associer** : vue Kanban avec cartes colorées + popup d'une tâche détaillée avec sous-tâches.

---

### 3.3 MATÉRIEL — Le patrimoine de l'entreprise

#### 🔧 Inventaire
**Objectif** : connaître à tout instant l'état de chaque équipement.

Catalogue complet du parc (engins, outillage, véhicules) avec photos, catégorie, statut (disponible / loué / en maintenance / hors service), localisation, valeur d'achat. Recherche instantanée, filtres multiples.

**Visuel à associer** : grille d'équipements avec photos, badges de statut colorés.

---

#### 🔲 Étiquettes QR
**Objectif** : identifier physiquement chaque équipement sur le terrain.

Génère des QR codes à imprimer pour chaque engin. Un scan depuis le téléphone d'un chef de chantier ouvre instantanément la fiche matériel. Fini les confusions entre deux compresseurs identiques.

**Visuel à associer** : feuille A4 prête à imprimer avec QR codes + nom + référence.

---

#### 🚚 Locations
**Objectif** : gérer les sorties de matériel (location interne ou externe).

Création de bons de location, sélection des équipements (avec **détection automatique des conflits** de disponibilité sur la période), assignation au client/chantier, durée, caution. État des lieux contradictoire en sortie et en retour.

**Visuel à associer** : formulaire de location avec sélecteur d'équipements et calendrier de disponibilité.

---

#### 📋 Inspections
**Objectif** : tracer l'état du matériel et arbitrer les litiges.

Pour chaque location, photos **avant/après** côte à côte, commentaires, signature du loueur. Bouton "Ouvrir un litige" qui déclenche un workflow de résolution si dégât constaté. Preuve juridique solide.

**Visuel à associer** : interface de comparaison photos avant/après avec annotations.

---

#### 🚛 Logistique
**Objectif** : planifier les mouvements de matériel.

Vue des transferts entre chantiers, sorties d'atelier, retours fournisseurs. Synchronisé avec les locations et l'inventaire.

**Visuel à associer** : timeline ou tableau de mouvements logistiques.

---

### 3.4 COMMERCIAL — Du prospect au paiement

#### 🏢 Clients
**Objectif** : annuaire client unifié.

Fiche client complète : raison sociale, contacts, historique des chantiers, devis, factures, encaissements, balance âgée. Une seule fiche pour toute la relation commerciale.

**Visuel à associer** : fiche client avec onglets (Infos / Chantiers / Factures / Historique).

---

#### 💼 Services
**Objectif** : catalogue des prestations vendues.

Liste structurée des services BTP proposés (terrassement, gros œuvre, location d'engin avec opérateur, étude de sol, etc.) avec tarifs de référence. Réutilisable dans tous les devis.

**Visuel à associer** : catalogue de services avec prix unitaires en FCFA.

---

#### 🎯 Pipeline CRM
**Objectif** : suivre les opportunités commerciales.

Pipeline visuel des affaires en cours, étape par étape (Identification → Qualification → Proposition → Négociation → Signature). Activités, relances, notes par opportunité.

**Visuel à associer** : pipeline en colonnes type Kanban commercial.

---

#### 🛒 Bons de commande
**Objectif** : formaliser la commande client.

Génération de bons de commande, joindre le PDF signé du client, lien direct vers le chantier et les factures émises.

**Visuel à associer** : exemple de bon de commande avec ligne d'articles.

---

#### 📄 Devis (Proformas)
**Objectif** : envoyer rapidement des propositions chiffrées.

Création de devis multi-lignes, mentions légales, durée de validité, conditions de paiement, caution. Une fois approuvé, **génère automatiquement la facture** correspondante — zéro double saisie.

**Visuel à associer** : devis en aperçu PDF avec en-tête EDOLE + tableau de lignes.

---

#### 🧾 Factures
**Objectif** : facturer et tracer les créances.

Facturation conforme OHADA, numérotation automatique, suivi du statut (émise / partiellement payée / soldée / en retard). Les factures en retard remontent automatiquement dans les **Alertes**.

**Visuel à associer** : liste de factures avec colonnes statut + montant + ancienneté.

---

#### 💳 Encaissements
**Objectif** : enregistrer les paiements reçus.

Saisie des règlements (virement, espèces, chèque, mobile money), affectation aux factures, mise à jour automatique des soldes clients et de la trésorerie.

**Visuel à associer** : formulaire d'encaissement avec sélecteur de factures à solder.

---

### 3.5 MARKETING — Acquérir et fidéliser

#### 📣 Campagnes
**Objectif** : lancer des campagnes email/SMS ciblées.

Création de campagnes, segmentation des destinataires (clients, prospects, par catégorie), édition du message, simulation d'envoi avec rapport de délivrabilité. Idéal pour annoncer une nouvelle agence, un nouveau service, ou relancer un prospect dormant.

**Visuel à associer** : éditeur de campagne avec aperçu email + statistiques d'envoi.

---

#### 🎯 Prospects
**Objectif** : nourrir le pipeline commercial.

Base de prospects qualifiés, sources d'acquisition, score, statut (nouveau / contacté / qualifié / converti). Conversion en un clic vers fiche client.

**Visuel à associer** : tableau de prospects avec colonnes source + statut + bouton "Convertir".

---

### 3.6 RESSOURCES HUMAINES — L'organisation

#### 👥 Tableau RH
**Objectif** : vision d'ensemble des effectifs.

Indicateurs clés : effectif total, contrats actifs, contrats expirant bientôt, répartition par département.

**Visuel à associer** : dashboard RH avec donuts de répartition + carte des départements.

---

#### 👷 Collaborateurs
**Objectif** : annuaire complet des salariés.

Fiche collaborateur avec photo, coordonnées, poste, département, contrat actif, affectations chantier, **charge de travail** (nombre de tâches actives, projets en cours), historique.

**Visuel à associer** : fiche collaborateur avec onglets et indicateur de charge.

---

#### 🏛️ Départements & Postes
**Objectif** : structurer l'organisation.

Création des entités organisationnelles (Direction, Exploitation, Atelier, Commercial, Compta, etc.) et des postes types (Conducteur de travaux, Chef de chantier, Magasinier…).

**Visuel à associer** : organigramme ou liste hiérarchique.

---

#### 📌 Affectations
**Objectif** : qui travaille sur quel chantier.

Assigne un collaborateur à un projet pour une période donnée, avec rôle. Évite les doubles affectations.

---

#### ✍️ Contrats & Documents RH
**Objectif** : conformité juridique et sociale.

Suivi des contrats (CDI / CDD / mission / stage), dates de début et fin, salaire mensuel. Alertes automatiques 30 jours avant expiration. Bibliothèque de documents RH (contrats signés, attestations, fiches de paie) classée par collaborateur.

**Visuel à associer** : tableau de contrats avec colonne "Expire dans X jours" colorée.

---

#### 🔐 Utilisateurs
**Objectif** : gestion des accès à la plateforme.

Création de comptes utilisateurs, attribution de rôles (admin, manager, commercial, comptable, client), désactivation. Sécurité par défaut.

---

### 3.7 COMPTABILITÉ — Conformité OHADA

#### 💰 Tableau financier
Synthèse instantanée : trésorerie disponible, créances clients, dettes fournisseurs, résultat de la période.

#### 📚 Plan comptable
Plan comptable OHADA pré-chargé, modifiable. Recherche par numéro ou intitulé.

#### 📝 Écritures
Saisie des écritures comptables au format débit/crédit, contrôle d'équilibre automatique, contre-passations.

#### 📖 Grand livre
Consultation détaillée des mouvements compte par compte, sur la période choisie.

#### ⚖️ Balance
Balance générale et auxiliaire, agrégée par classe ou par compte, exportable.

#### 📈 Compte de résultat
Production automatique du résultat (produits / charges / résultat net) à partir des écritures saisies.

#### 🏛️ Bilan
Bilan actif/passif conforme au format OHADA, en un clic.

#### 👤 Comptes clients & fournisseurs
Vue auxiliaire : balance âgée par tiers, factures en attente, relances.

#### 🏦 Banques & caisses
Suivi des comptes bancaires, transactions, **rapprochement bancaire** assisté.

#### 🏗️ Immobilisations
Registre des immobilisations corporelles, dotations aux amortissements automatiques.

**Visuel à associer (pour tout le module Compta)** : capture du compte de résultat ou du bilan, qui démontre instantanément la conformité OHADA.

---

### 3.8 COMMUNICATION

> *Modules livrés en standard, conservés tels quels selon le périmètre client.*

- **Messagerie** : conversations internes et avec les clients.
- **Appels** : journal d'appels et historique.

---

## 4. Style de présentation conseillé pour le pitch

### Structure de la démonstration commerciale (45 min)

| Temps | Section | Message-clé |
|---|---|---|
| 0-3 min | Accueil + slogan | « Le numérique au service du BTP » |
| 3-8 min | Tableau de bord | « En 5 secondes, vous savez où vous en êtes » |
| 8-15 min | Chantier complet | Démo : créer chantier → assigner équipe → mobiliser matériel |
| 15-25 min | Cycle commercial | Démo : devis → bon de commande → facture → encaissement |
| 25-32 min | Comptabilité OHADA | « Votre bilan en un clic, prêt pour le commissaire aux comptes » |
| 32-38 min | Mobilité + Alertes | Démo sur smartphone : un chef de chantier scan un QR |
| 38-45 min | Q&R + tarification | Closing |

### Arguments différenciants à mettre en avant

1. **Conçu pour le BTP africain** — pas un outil générique adapté, un outil pensé pour ce métier dans cette région.
2. **Tout-en-un véritable** — du chantier à la comptabilité OHADA, sans connecteurs fragiles.
3. **Mobilité réelle** — les équipes terrain l'utilisent depuis leur téléphone, pas seulement la direction depuis son bureau.
4. **Alertes intelligentes** — l'application travaille pour vous en arrière-plan.
5. **Performance et fluidité** — interface premium, navigation instantanée, expérience utilisateur soignée.
6. **Français + FCFA partout** — aucune friction linguistique ou monétaire.

### Visuels recommandés pour les supports (slides / brochure)

- **Slide de couverture** : logo édolé sur fond noir, slogan « Le numérique au service du BTP », photo de chantier africain en arrière-plan estompée orange.
- **Slide « Le problème »** : illustration de l'éparpillement (Excel + WhatsApp + papier).
- **Slide « La solution »** : capture du tableau de bord, plein écran.
- **Slides modules** : un module par slide, avec capture d'écran réelle + 3 bullet points de bénéfices.
- **Slide « Mobilité »** : montage d'un smartphone affichant l'app, dans la main d'un chef de chantier sur site.
- **Slide « Conformité »** : extrait du bilan OHADA généré par l'app.
- **Slide « Sécurité & rôles »** : schéma des rôles (admin / manager / commercial / comptable / client).
- **Slide « Tarification »** : packs Starter / Pro / Entreprise avec prix en FCFA/mois.
- **Slide de clôture** : témoignage client (à venir) + appel à l'action « Démarrez votre essai gratuit de 30 jours ».

---

## 5. Synthèse en une phrase

> **EDOLE AFRICA ADMIN est la plateforme tout-en-un qui digitalise enfin les entreprises du BTP en Afrique francophone : chantiers, matériel, équipes, ventes et comptabilité OHADA, dans une expérience moderne, mobile et 100 % en français.**
