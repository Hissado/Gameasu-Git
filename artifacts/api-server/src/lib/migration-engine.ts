/**
 * Migration Engine — Gameasu
 * Définit les 8 modules importables, leurs champs, validations et exécuteurs.
 */
import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and, isNull } from "drizzle-orm";
import bcryptjs from "bcryptjs";
import {
  clientsTable, clientContactsTable,
  collaboratorsTable,
  invoicesTable, paymentsTable,
  chartOfAccountsTable,
  projectsTable,
  equipmentTable,
  organizationsTable,
  suppliersTable,
  departmentsTable,
  servicesTable,
  usersTable,
  costCentersTable,
  bankAccountsTable,
  stockMovementsTable,
  productsTable,
  leaveBalancesTable,
  budgetsTable,
  budgetLinesTable,
  fiscalPeriodsTable,
  journalsTable,
  journalEntriesTable,
  journalEntryLinesTable,
} from "@workspace/db/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export type FieldType = "string" | "number" | "date" | "email" | "phone" | "enum";

export interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  type: FieldType;
  acceptedValues?: string[];
  examples: string;
  aliases: string[];
  hint?: string;
}

export interface ModuleDef {
  id: string;
  label: string;
  icon: string;
  description: string;
  category: string;
  fields: FieldDef[];
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ParsedFile {
  fileId: string;
  module: string;
  headers: string[];
  rows: string[][];
  createdAt: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
  ids: string[];
}

// ── In-memory temp store for parsed files ─────────────────────────────────────
const parsedFileStore = new Map<string, ParsedFile>();

export function storeParsedFile(data: Omit<ParsedFile, "fileId" | "createdAt">): string {
  const fileId = randomUUID();
  parsedFileStore.set(fileId, { ...data, fileId, createdAt: Date.now() });
  // Cleanup files older than 1 hour
  for (const [id, f] of parsedFileStore.entries()) {
    if (Date.now() - f.createdAt > 3600_000) parsedFileStore.delete(id);
  }
  return fileId;
}

export function getParsedFile(fileId: string): ParsedFile | undefined {
  return parsedFileStore.get(fileId);
}

export function deleteParsedFile(fileId: string): void {
  parsedFileStore.delete(fileId);
}

// ── Module Definitions ────────────────────────────────────────────────────────

export const MODULES: ModuleDef[] = [
  {
    id: "clients",
    label: "Clients",
    icon: "Building2",
    description: "Importer la base clients et prospects",
    category: "CRM",
    fields: [
      { key: "name",              label: "Nom",                   required: true,  type: "string", examples: "SOGELEC Cameroun", aliases: ["nom", "raison_sociale", "company", "entreprise", "client_name", "nom_client"] },
      { key: "email",             label: "Email",                  required: false, type: "email",  examples: "contact@sogelec.cm", aliases: ["email", "e-mail", "courriel", "mail"] },
      { key: "phone",             label: "Téléphone",              required: false, type: "phone",  examples: "+237 699 000 000", aliases: ["telephone", "tel", "phone", "mobile", "portable"] },
      { key: "address",           label: "Adresse",                required: false, type: "string", examples: "Rue Nachtigal, Douala", aliases: ["adresse", "address", "domicile"] },
      { key: "industry",          label: "Secteur",                required: false, type: "string", examples: "BTP", aliases: ["secteur", "industry", "activite", "domaine"] },
      { key: "website",           label: "Site web",               required: false, type: "string", examples: "https://sogelec.cm", aliases: ["site", "website", "web", "url"] },
      { key: "status",            label: "Statut",                 required: false, type: "enum",   examples: "client", acceptedValues: ["prospect", "client", "inactive"], aliases: ["statut", "status", "type"] },
      { key: "paymentTermsDays",  label: "Délai paiement (jours)", required: false, type: "number", examples: "30", aliases: ["delai_paiement", "payment_terms", "echeance", "net_days"] },
      { key: "creditLimit",       label: "Limite de crédit (FCFA)", required: false, type: "number", examples: "5000000", aliases: ["limite_credit", "credit_limit", "plafond"] },
    ],
  },
  {
    id: "contacts",
    label: "Contacts",
    icon: "Users",
    description: "Contacts liés aux clients",
    category: "CRM",
    fields: [
      { key: "firstName",   label: "Prénom",        required: true,  type: "string", examples: "Jean-Pierre", aliases: ["prenom", "first_name", "prénom"] },
      { key: "lastName",    label: "Nom",            required: true,  type: "string", examples: "Mballa", aliases: ["nom", "last_name", "nom_famille"] },
      { key: "clientName",  label: "Client associé", required: true,  type: "string", examples: "SOGELEC Cameroun", aliases: ["client", "societe", "entreprise", "company"] },
      { key: "email",       label: "Email",          required: false, type: "email",  examples: "jp.mballa@sogelec.cm", aliases: ["email", "mail", "courriel"] },
      { key: "phone",       label: "Téléphone",      required: false, type: "phone",  examples: "+237 699 000 000", aliases: ["telephone", "tel", "mobile"] },
      { key: "role",        label: "Fonction",       required: false, type: "string", examples: "Directeur financier", aliases: ["role", "poste", "fonction", "titre", "position"] },
    ],
  },
  {
    id: "collaborators",
    label: "Collaborateurs",
    icon: "UserCheck",
    description: "RH — employés, contrats, salaires",
    category: "RH",
    fields: [
      { key: "firstName",         label: "Prénom",           required: true,  type: "string", examples: "Marie", aliases: ["prenom", "first_name", "prénom"] },
      { key: "lastName",          label: "Nom",              required: true,  type: "string", examples: "Nguema", aliases: ["nom", "last_name"] },
      { key: "email",             label: "Email",            required: false, type: "email",  examples: "m.nguema@org.com", aliases: ["email", "mail", "courriel"] },
      { key: "phone",             label: "Téléphone",        required: false, type: "phone",  examples: "+228 90 00 00 00", aliases: ["telephone", "tel", "mobile"] },
      { key: "position",          label: "Poste",            required: false, type: "string", examples: "Chef de chantier", aliases: ["poste", "position", "fonction", "titre"] },
      { key: "department",        label: "Département",      required: false, type: "string", examples: "Travaux", aliases: ["departement", "department", "service", "direction"] },
      { key: "hireDate",          label: "Date d'embauche",  required: false, type: "date",   examples: "01/01/2022", aliases: ["date_embauche", "hire_date", "debut_contrat", "date_entree"] },
      { key: "baseSalary",        label: "Salaire de base (FCFA)", required: false, type: "number", examples: "350000", aliases: ["salaire", "salaire_base", "base_salary", "remuneration"] },
      { key: "nationalId",        label: "N° pièce identité", required: false, type: "string", examples: "TG-123456", aliases: ["cni", "cin", "piece_identite", "national_id", "ni"] },
      { key: "birthDate",         label: "Date de naissance", required: false, type: "date",   examples: "15/06/1985", aliases: ["date_naissance", "birth_date", "naissance"] },
      { key: "employeeNumber",    label: "Matricule",         required: false, type: "string", examples: "EMP-001", aliases: ["matricule", "employee_number", "ref"] },
    ],
  },
  {
    id: "invoices",
    label: "Factures clients",
    icon: "FileText",
    description: "Soldes ouverts, factures impayées et historique",
    category: "Ventes",
    fields: [
      { key: "referenceNumber", label: "N° facture",      required: true,  type: "string", examples: "FAC-2024-001", aliases: ["reference", "ref", "numero", "numero_facture", "invoice_number"] },
      { key: "clientName",      label: "Client",           required: true,  type: "string", examples: "SOGELEC Cameroun", aliases: ["client", "nom_client", "societe", "company"] },
      { key: "totalAmount",     label: "Montant TTC (FCFA)", required: true, type: "number", examples: "1500000", aliases: ["montant", "total", "total_amount", "montant_ttc", "amount"] },
      { key: "paidAmount",      label: "Montant payé (FCFA)", required: false, type: "number", examples: "500000", aliases: ["paye", "acompte", "paid_amount", "montant_paye"] },
      { key: "dueDate",         label: "Date d'échéance",  required: false, type: "date",   examples: "31/03/2024", aliases: ["echeance", "due_date", "date_echeance", "expiry"] },
      { key: "issuedAt",        label: "Date d'émission",  required: false, type: "date",   examples: "01/01/2024", aliases: ["date_emission", "issued_at", "date_facture", "issue_date"] },
      { key: "status",          label: "Statut",           required: false, type: "enum",   examples: "pending", acceptedValues: ["draft", "pending", "partially_paid", "paid", "overdue", "cancelled"], aliases: ["statut", "status", "etat"] },
      { key: "notes",           label: "Notes",            required: false, type: "string", examples: "Prestation mars 2024", aliases: ["notes", "commentaire", "description", "observation"] },
    ],
  },
  {
    id: "payments",
    label: "Encaissements",
    icon: "CreditCard",
    description: "Paiements reçus, lettrage avec factures",
    category: "Ventes",
    fields: [
      { key: "invoiceReference", label: "N° facture",       required: true,  type: "string", examples: "FAC-2024-001", aliases: ["facture", "reference_facture", "invoice_ref", "invoice_number", "ref_facture"] },
      { key: "amount",           label: "Montant (FCFA)",   required: true,  type: "number", examples: "750000", aliases: ["montant", "amount", "montant_paye"] },
      { key: "paymentDate",      label: "Date de paiement", required: true,  type: "date",   examples: "15/03/2024", aliases: ["date_paiement", "payment_date", "date", "date_reglement"] },
      { key: "method",           label: "Moyen de paiement", required: false, type: "enum",   examples: "virement", acceptedValues: ["especes", "virement", "cheque", "mobile_money", "autre"], aliases: ["mode", "methode", "method", "moyen"] },
      { key: "reference",        label: "Référence paiement", required: false, type: "string", examples: "VIR-20240315", aliases: ["reference", "ref", "numero", "transaction_id"] },
      { key: "notes",            label: "Notes",             required: false, type: "string", examples: "Virement BICICI", aliases: ["notes", "commentaire", "observation"] },
    ],
  },
  {
    id: "chart_of_accounts",
    label: "Plan comptable",
    icon: "BookOpen",
    description: "Comptes SYSCOHADA et balances d'ouverture",
    category: "Comptabilité",
    fields: [
      { key: "code",          label: "Code compte",  required: true,  type: "string", examples: "411000", aliases: ["code", "compte", "account_code", "numero_compte"] },
      { key: "label",         label: "Libellé",      required: true,  type: "string", examples: "Clients, ventes de biens", aliases: ["libelle", "label", "intitule", "description", "nom"] },
      { key: "classNum",      label: "Classe",       required: true,  type: "number", examples: "4", aliases: ["classe", "class", "classe_compte"] },
      { key: "type",          label: "Type",         required: true,  type: "enum",   examples: "asset", acceptedValues: ["asset", "liability", "equity", "revenue", "expense"], aliases: ["type", "nature", "categorie"] },
      { key: "normalBalance", label: "Sens normal",  required: true,  type: "enum",   examples: "debit", acceptedValues: ["debit", "credit"], aliases: ["sens", "normal_balance", "solde_normal"] },
      { key: "openingDebit",  label: "Solde débiteur (FCFA)", required: false, type: "number", examples: "2500000", aliases: ["debit_ouverture", "opening_debit", "solde_debit", "debit"] },
      { key: "openingCredit", label: "Solde créditeur (FCFA)", required: false, type: "number", examples: "0", aliases: ["credit_ouverture", "opening_credit", "solde_credit", "credit"] },
    ],
  },
  {
    id: "projects",
    label: "Projets",
    icon: "Briefcase",
    description: "Portefeuille projets et chantiers",
    category: "Opérations",
    fields: [
      { key: "name",        label: "Nom du projet",    required: true,  type: "string", examples: "Construction école Lomé Nord", aliases: ["nom", "name", "intitule", "projet", "titre"] },
      { key: "status",      label: "Statut",           required: false, type: "enum",   examples: "active", acceptedValues: ["planning", "active", "on_hold", "completed", "cancelled"], aliases: ["statut", "status", "etat", "avancement"] },
      { key: "clientName",  label: "Client",           required: false, type: "string", examples: "Mairie de Lomé", aliases: ["client", "maitre_ouvrage", "donneur_ordre"] },
      { key: "budget",      label: "Budget (FCFA)",    required: false, type: "number", examples: "150000000", aliases: ["budget", "montant", "valeur", "cout"] },
      { key: "startDate",   label: "Date de début",    required: false, type: "date",   examples: "01/01/2024", aliases: ["debut", "start_date", "date_debut", "date_commencement"] },
      { key: "endDate",     label: "Date de fin",      required: false, type: "date",   examples: "31/12/2024", aliases: ["fin", "end_date", "date_fin", "date_livraison"] },
      { key: "description", label: "Description",      required: false, type: "string", examples: "Construction d'une école primaire", aliases: ["description", "notes", "detail"] },
    ],
  },
  {
    id: "suppliers",
    label: "Fournisseurs",
    icon: "Briefcase",
    description: "Fournisseurs, sous-traitants, prestataires",
    category: "Achats",
    fields: [
      { key: "code",         label: "Code fournisseur",     required: true,  type: "string", examples: "F0001",                aliases: ["code", "ref", "numero", "code_fournisseur", "supplier_code"] },
      { key: "name",         label: "Nom / Raison sociale", required: true,  type: "string", examples: "BATIM SARL",           aliases: ["nom", "name", "raison_sociale", "fournisseur", "supplier", "entreprise"] },
      { key: "email",        label: "Email",                required: false, type: "email",  examples: "contact@batim.tg",     aliases: ["email", "mail", "courriel", "e-mail"] },
      { key: "phone",        label: "Téléphone",            required: false, type: "phone",  examples: "+228 90 00 00 00",     aliases: ["telephone", "tel", "phone", "mobile", "portable"] },
      { key: "address",      label: "Adresse",              required: false, type: "string", examples: "Rue du Commerce, Lomé", aliases: ["adresse", "address", "domicile", "siege"] },
      { key: "taxId",        label: "N° Contribuable / RCCM", required: false, type: "string", examples: "TG2024B1234",      aliases: ["numero_contribuable", "tax_id", "rccm", "nif", "siret", "identifiant_fiscal"] },
      { key: "paymentTerms", label: "Conditions de paiement", required: false, type: "string", examples: "30 jours net",      aliases: ["conditions_paiement", "payment_terms", "delai_paiement", "echeance"] },
    ],
  },
  {
    id: "departments",
    label: "Départements",
    icon: "Building2",
    description: "Structure organisationnelle — départements et pôles",
    category: "RH",
    fields: [
      { key: "code",        label: "Code",         required: true,  type: "string", examples: "ADMIN",                             aliases: ["code", "code_dept", "ref", "identifiant"] },
      { key: "name",        label: "Nom",           required: true,  type: "string", examples: "Administration",                    aliases: ["nom", "name", "intitule", "libelle", "departement"] },
      { key: "description", label: "Description",   required: false, type: "string", examples: "Direction générale et administration", aliases: ["description", "notes", "detail"] },
      { key: "color",       label: "Couleur (hex)", required: false, type: "string", examples: "#3B82F6",                           aliases: ["couleur", "color", "hex"] },
    ],
  },
  {
    id: "services",
    label: "Produits & Services",
    icon: "Briefcase",
    description: "Catalogue produits, services et prestations facturables",
    category: "Ventes",
    fields: [
      { key: "code",        label: "Code",               required: true,  type: "string", examples: "PREST-001",            aliases: ["code", "ref", "sku", "code_service", "code_produit", "article"] },
      { key: "name",        label: "Nom",                required: true,  type: "string", examples: "Audit informatique",    aliases: ["nom", "name", "designation", "libelle", "intitule", "service", "produit"] },
      { key: "category",    label: "Catégorie",          required: false, type: "string", examples: "Conseil",               aliases: ["categorie", "category", "famille", "type", "groupe"] },
      { key: "unit",        label: "Unité",              required: false, type: "string", examples: "forfait",               aliases: ["unite", "unit", "unité_mesure", "um", "unité"] },
      { key: "unitPrice",   label: "Prix unitaire (FCFA)", required: false, type: "number", examples: "250000",            aliases: ["prix", "tarif", "unit_price", "prix_unitaire", "montant", "taux"] },
      { key: "description", label: "Description",        required: false, type: "string", examples: "Prestation d'audit",   aliases: ["description", "notes", "detail"] },
    ],
  },
  {
    id: "users",
    label: "Utilisateurs",
    icon: "Users",
    description: "Comptes utilisateurs — le mot de passe temporaire sera à changer à la 1ère connexion",
    category: "Admin",
    fields: [
      { key: "email",     label: "Email",    required: true,  type: "email",  examples: "a.diallo@hissadoconsulting.com", aliases: ["email", "mail", "courriel", "e-mail", "adresse_email"] },
      { key: "firstName", label: "Prénom",   required: true,  type: "string", examples: "Aminata",                        aliases: ["prenom", "first_name", "prénom", "firstname"] },
      { key: "lastName",  label: "Nom",      required: true,  type: "string", examples: "Diallo",                         aliases: ["nom", "last_name", "lastname", "nom_famille"] },
      { key: "role",      label: "Rôle",     required: false, type: "enum",   examples: "manager",                        acceptedValues: ["admin", "manager", "commercial", "collaborator", "comptable"], aliases: ["role", "profil", "fonction", "niveau_acces"] },
      { key: "phone",     label: "Téléphone", required: false, type: "phone",  examples: "+228 90 00 00 00",              aliases: ["telephone", "tel", "mobile", "phone", "portable"] },
    ],
  },
  {
    id: "equipment",
    label: "Équipements",
    icon: "Wrench",
    description: "Parc matériel, engins, outillage",
    category: "Opérations",
    fields: [
      { key: "name",        label: "Nom",              required: true,  type: "string", examples: "Pelle hydraulique CAT 320", aliases: ["nom", "name", "designation", "materiel", "libelle"] },
      { key: "code",        label: "Code / Référence", required: false, type: "string", examples: "EQ-001", aliases: ["code", "ref", "reference", "numero_serie", "immatriculation"] },
      { key: "category",    label: "Catégorie",        required: false, type: "string", examples: "Engins de terrassement", aliases: ["categorie", "category", "type", "famille"] },
      { key: "status",      label: "Statut",           required: false, type: "enum",   examples: "available", acceptedValues: ["available", "in_use", "maintenance", "retired"], aliases: ["statut", "status", "etat", "disponibilite"] },
      { key: "dailyRate",   label: "Tarif journalier (FCFA)", required: false, type: "number", examples: "75000", aliases: ["tarif", "taux_journalier", "daily_rate", "prix_location"] },
      { key: "location",    label: "Localisation",     required: false, type: "string", examples: "Dépôt Lomé", aliases: ["localisation", "location", "lieu", "depot", "site"] },
      { key: "description", label: "Description",      required: false, type: "string", examples: "Pelle sur chenilles", aliases: ["description", "notes", "detail", "caracteristiques"] },
    ],
  },
  {
    id: "cost_centers",
    label: "Centres analytiques",
    icon: "PieChart",
    description: "Centres de coût / analytiques CAGE (département, projet, activité…)",
    category: "Comptabilité",
    fields: [
      { key: "code",         label: "Code",              required: true,  type: "string", examples: "CC-TRAV",      aliases: ["code", "ref", "identifiant", "code_centre"] },
      { key: "name",         label: "Nom",               required: true,  type: "string", examples: "Travaux publics", aliases: ["nom", "name", "libelle", "intitule", "centre"] },
      { key: "type",         label: "Type",              required: false, type: "enum",   examples: "department",   acceptedValues: ["department","project","activity","service","geographic","product_line"], aliases: ["type", "nature", "categorie"] },
      { key: "description",  label: "Description",       required: false, type: "string", examples: "Département chantiers",  aliases: ["description", "notes", "detail"] },
      { key: "budgetAmount", label: "Budget annuel (FCFA)", required: false, type: "number", examples: "50000000", aliases: ["budget", "budget_annuel", "dotation", "budget_amount"] },
      { key: "color",        label: "Couleur (hex)",     required: false, type: "string", examples: "#2563EB",     aliases: ["couleur", "color", "hex"] },
    ],
  },
  {
    id: "bank_accounts",
    label: "Banques & Caisses",
    icon: "Landmark",
    description: "Comptes bancaires et caisses physiques (compte rattaché 521 / 571 requis)",
    category: "Comptabilité",
    fields: [
      { key: "name",           label: "Nom",                  required: true,  type: "string", examples: "BICICI Compte courant",  aliases: ["nom", "name", "libelle", "intitule", "banque"] },
      { key: "type",           label: "Type",                 required: true,  type: "enum",   examples: "bank",                  acceptedValues: ["bank","cash"], aliases: ["type", "nature"] },
      { key: "accountCode",    label: "Code compte (521/571)", required: true,  type: "string", examples: "521000",               aliases: ["code_compte", "compte", "account_code", "numero_compte_pcg"] },
      { key: "bankName",       label: "Banque",               required: false, type: "string", examples: "BICICI",                aliases: ["banque", "bank_name", "etablissement"] },
      { key: "accountNumber",  label: "N° de compte",         required: false, type: "string", examples: "02500123456",           aliases: ["numero_compte", "account_number", "rib", "compte_bancaire"] },
      { key: "iban",           label: "IBAN",                 required: false, type: "string", examples: "TG53TG00605770000010000046",  aliases: ["iban"] },
      { key: "openingBalance", label: "Solde d'ouverture (FCFA)", required: false, type: "number", examples: "5000000",          aliases: ["solde_ouverture", "opening_balance", "solde_initial", "solde"] },
    ],
  },
  {
    id: "opening_balance",
    label: "Balance d'ouverture",
    icon: "Scale",
    description: "Écritures d'à-nouveaux — une ligne par compte (débit ou crédit). Requiert un journal AN et une période fiscale active.",
    category: "Comptabilité",
    fields: [
      { key: "accountCode",  label: "Code compte",           required: true,  type: "string", examples: "411000",   aliases: ["code_compte", "compte", "account_code", "numero_compte"] },
      { key: "debit",        label: "Débit (FCFA)",          required: false, type: "number", examples: "2500000",  aliases: ["debit", "montant_debit", "solde_debiteur", "d"] },
      { key: "credit",       label: "Crédit (FCFA)",         required: false, type: "number", examples: "0",        aliases: ["credit", "montant_credit", "solde_crediteur", "c"] },
      { key: "description",  label: "Description / Libellé", required: false, type: "string", examples: "Clients à recouvrer", aliases: ["description", "libelle", "notes", "commentaire"] },
    ],
  },
  {
    id: "stock_initial",
    label: "Stock initial",
    icon: "Package",
    description: "Entrée de stock initiale pour les articles existants (créés via Produits & Services ou le module inventaire)",
    category: "Opérations",
    fields: [
      { key: "sku",          label: "Code article (SKU)",     required: true,  type: "string", examples: "CIMENT-50KG",  aliases: ["sku", "code_article", "ref", "code_produit", "reference", "codeProduit"] },
      { key: "quantity",     label: "Quantité",               required: true,  type: "number", examples: "500",          aliases: ["quantite", "qty", "quantity", "stock", "qte"] },
      { key: "unitCost",     label: "Coût unitaire (FCFA)",   required: false, type: "number", examples: "7500",         aliases: ["cout_unitaire", "unit_cost", "prix_achat", "pu", "cmp"] },
      { key: "date",         label: "Date d'inventaire",      required: false, type: "date",   examples: "01/01/2024",   aliases: ["date", "date_inventaire", "date_stock", "date_entree"] },
      { key: "reason",       label: "Motif",                  required: false, type: "string", examples: "Stock initial 2024", aliases: ["motif", "reason", "raison", "notes", "commentaire"] },
    ],
  },
  {
    id: "leave_balances",
    label: "Soldes de congés",
    icon: "Calendar",
    description: "Soldes de congés des collaborateurs par type et par année",
    category: "RH",
    fields: [
      { key: "collaboratorEmail", label: "Email collaborateur", required: true,  type: "email",  examples: "m.nguema@org.com", aliases: ["email", "email_collaborateur", "collaborateur", "employe", "salarie"] },
      { key: "leaveType",         label: "Type de congé",       required: true,  type: "enum",   examples: "congé_payé",       acceptedValues: ["congé_payé","RTT","maladie","maternité","paternité","sans_solde","formation","exceptionnel","autre"], aliases: ["type_conge", "type", "conge", "leave_type"] },
      { key: "year",              label: "Année",               required: true,  type: "number", examples: "2024",             aliases: ["annee", "year", "exercice", "an"] },
      { key: "allocated",         label: "Jours alloués",       required: true,  type: "number", examples: "25",               aliases: ["alloues", "allocated", "jours_alloues", "quota", "droit"] },
      { key: "used",              label: "Jours utilisés",      required: false, type: "number", examples: "10",               aliases: ["utilises", "used", "jours_pris", "pris", "consommes"] },
      { key: "carried",           label: "Jours reportés",      required: false, type: "number", examples: "5",                aliases: ["reportes", "carried", "report", "carry_over"] },
    ],
  },
  {
    id: "budgets",
    label: "Budgets",
    icon: "TrendingUp",
    description: "Lignes budgétaires par compte SYSCOHADA et par mois. Chaque fichier crée un budget.",
    category: "Comptabilité",
    fields: [
      { key: "budgetName",  label: "Nom du budget",    required: true,  type: "string", examples: "Budget 2024",  aliases: ["nom_budget", "budget_name", "budget", "nom", "intitule"] },
      { key: "accountCode", label: "Code compte",      required: true,  type: "string", examples: "622000",       aliases: ["code_compte", "compte", "account_code", "numero_compte"] },
      { key: "period",      label: "Mois (YYYY-MM)",   required: true,  type: "string", examples: "2024-03",      aliases: ["mois", "periode", "period", "month", "date"] },
      { key: "amount",      label: "Montant (FCFA)",   required: true,  type: "number", examples: "500000",       aliases: ["montant", "amount", "budget", "prevision", "prevu"] },
      { key: "notes",       label: "Notes",            required: false, type: "string", examples: "Loyers Q1",    aliases: ["notes", "commentaire", "observation", "detail"] },
    ],
  },
];

export function getModule(id: string): ModuleDef | undefined {
  return MODULES.find(m => m.id === id);
}

// ── CSV Parser ────────────────────────────────────────────────────────────────

export function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nonEmpty = lines.filter(l => l.trim());
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && inQuotes && line[i + 1] === '"') { current += '"'; i++; continue; }
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if ((ch === ',' || ch === ';' || ch === '\t') && !inQuotes) { result.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(nonEmpty[0]);
  const rows = nonEmpty.slice(1).map(parseLine);
  return { headers, rows };
}

// ── Auto-mapping suggestion ───────────────────────────────────────────────────

export function suggestMapping(headers: string[], moduleDef: ModuleDef): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalize = (s: string) => s.toLowerCase().trim().replace(/[\s\-_\.]/g, "_").replace(/[^a-z0-9_]/g, "");

  for (const field of moduleDef.fields) {
    const allAliases = [field.key, field.label, ...field.aliases].map(normalize);
    const matched = headers.find(h => allAliases.includes(normalize(h)));
    if (matched) mapping[matched] = field.key;
  }
  return mapping;
}

// ── Apply mapping to a row (array) → object ────────────────────────────────────

export function applyMapping(
  row: string[],
  headers: string[],
  mapping: Record<string, string>,
): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [header, fieldKey] of Object.entries(mapping)) {
    const idx = headers.indexOf(header);
    if (idx >= 0 && row[idx] !== undefined) obj[fieldKey] = row[idx].trim();
  }
  return obj;
}

// ── Validators ────────────────────────────────────────────────────────────────

const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dateFormats = [
  /^\d{4}-\d{2}-\d{2}$/,              // YYYY-MM-DD
  /^\d{2}\/\d{2}\/\d{4}$/,            // DD/MM/YYYY
  /^\d{2}-\d{2}-\d{4}$/,              // DD-MM-YYYY
];

export function parseDate(s: string): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmY = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmY) return `${dmY[3]}-${dmY[2]}-${dmY[1]}`;
  return null;
}

export function validateRows(
  rows: string[][],
  headers: string[],
  mapping: Record<string, string>,
  moduleDef: ModuleDef,
): { errors: ValidationError[]; validCount: number; errorCount: number } {
  const errors: ValidationError[] = [];
  let validCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Skip blank rows
    if (row.every(c => !c.trim())) continue;

    const obj = applyMapping(row, headers, mapping);
    let rowHasError = false;

    for (const field of moduleDef.fields) {
      const val = (obj[field.key] ?? "").trim();

      if (field.required && !val) {
        errors.push({ row: i + 2, field: field.label, message: `Champ obligatoire manquant : ${field.label}`, severity: "error" });
        rowHasError = true;
        continue;
      }
      if (!val) continue;

      if (field.type === "email" && !emailRx.test(val)) {
        errors.push({ row: i + 2, field: field.label, message: `Email invalide : "${val}"`, severity: "warning" });
      }
      if (field.type === "number" && isNaN(parseFloat(val.replace(/\s/g, "").replace(",", ".")))) {
        errors.push({ row: i + 2, field: field.label, message: `Valeur numérique invalide : "${val}"`, severity: "error" });
        rowHasError = true;
      }
      if (field.type === "date" && !dateFormats.some(rx => rx.test(val)) && !parseDate(val)) {
        errors.push({ row: i + 2, field: field.label, message: `Format de date invalide : "${val}" (attendu JJ/MM/AAAA)`, severity: "error" });
        rowHasError = true;
      }
      if (field.type === "enum" && field.acceptedValues && !field.acceptedValues.includes(val.toLowerCase())) {
        errors.push({ row: i + 2, field: field.label, message: `Valeur "${val}" non acceptée. Valeurs : ${field.acceptedValues.join(", ")}`, severity: "warning" });
      }
    }

    if (!rowHasError) validCount++;
  }

  let errorCount = rows.filter((_, i) => !rows[i].every(c => !c.trim())).length - validCount;
  if (errorCount < 0) errorCount = 0;

  return { errors, validCount, errorCount };
}

// ── Import Executors ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = NodePgDatabase<any>;

function num(s: string | undefined): string | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
  return isNaN(n) ? null : String(n);
}

export async function executeImport(
  parsedFile: ParsedFile,
  mapping: Record<string, string>,
  orgId: string,
  db: AnyDB,
): Promise<ImportResult> {
  const mod = getModule(parsedFile.module);
  if (!mod) throw new Error(`Module inconnu : ${parsedFile.module}`);

  const result: ImportResult = { imported: 0, skipped: 0, errors: [], ids: [] };

  switch (parsedFile.module) {
    case "clients":      return importClients(parsedFile, mapping, orgId, db, result);
    case "contacts":     return importContacts(parsedFile, mapping, orgId, db, result);
    case "collaborators": return importCollaborators(parsedFile, mapping, orgId, db, result);
    case "invoices":     return importInvoices(parsedFile, mapping, orgId, db, result);
    case "payments":     return importPayments(parsedFile, mapping, orgId, db, result);
    case "chart_of_accounts": return importChartOfAccounts(parsedFile, mapping, orgId, db, result);
    case "projects":     return importProjects(parsedFile, mapping, orgId, db, result);
    case "equipment":    return importEquipment(parsedFile, mapping, orgId, db, result);
    case "suppliers":    return importSuppliers(parsedFile, mapping, orgId, db, result);
    case "departments":     return importDepartments(parsedFile, mapping, orgId, db, result);
    case "services":        return importServices(parsedFile, mapping, orgId, db, result);
    case "users":           return importUsers(parsedFile, mapping, orgId, db, result);
    case "cost_centers":    return importCostCenters(parsedFile, mapping, orgId, db, result);
    case "bank_accounts":   return importBankAccounts(parsedFile, mapping, orgId, db, result);
    case "opening_balance": return importOpeningBalance(parsedFile, mapping, orgId, db, result);
    case "stock_initial":   return importStockInitial(parsedFile, mapping, orgId, db, result);
    case "leave_balances":  return importLeaveBalances(parsedFile, mapping, orgId, db, result);
    case "budgets":         return importBudgets(parsedFile, mapping, orgId, db, result);
    default: throw new Error(`Exécuteur non implémenté pour : ${parsedFile.module}`);
  }
}

// ── Clients ────────────────────────────────────────────────────────────────

async function importClients(f: ParsedFile, mapping: Record<string, string>, orgId: string, db: AnyDB, r: ImportResult): Promise<ImportResult> {
  for (let i = 0; i < f.rows.length; i++) {
    const row = f.rows[i];
    if (row.every(c => !c.trim())) continue;
    const o = applyMapping(row, f.headers, mapping);
    const name = o.name?.trim();
    if (!name) { r.errors.push({ row: i + 2, message: "Nom manquant, ligne ignorée" }); r.skipped++; continue; }
    try {
      const [rec] = await db.insert(clientsTable).values({
        id: randomUUID(), organizationId: orgId,
        name,
        email: o.email || null,
        phone: o.phone || null,
        address: o.address || null,
        industry: o.industry || null,
        website: o.website || null,
        status: (o.status || "prospect") as string,
        paymentTermsDays: o.paymentTermsDays ? parseInt(o.paymentTermsDays) : null,
        creditLimit: num(o.creditLimit),
      }).returning({ id: clientsTable.id });
      r.ids.push(rec.id);
      r.imported++;
    } catch (e) {
      r.errors.push({ row: i + 2, message: `Erreur insertion : ${(e as Error).message}` });
      r.skipped++;
    }
  }
  return r;
}

// ── Contacts ─────────────────────────────────────────────────────────────────

async function importContacts(f: ParsedFile, mapping: Record<string, string>, orgId: string, db: AnyDB, r: ImportResult): Promise<ImportResult> {
  const clientCache = new Map<string, string>();

  const getClientId = async (name: string): Promise<string | null> => {
    const k = name.toLowerCase();
    if (clientCache.has(k)) return clientCache.get(k)!;
    const rows = await db.select({ id: clientsTable.id }).from(clientsTable)
      .where(and(eq(clientsTable.organizationId, orgId), isNull(clientsTable.deletedAt)));
    for (const row of rows) clientCache.set(row.id, row.id);
    const match = await db.select({ id: clientsTable.id }).from(clientsTable)
      .where(and(eq(clientsTable.organizationId, orgId), isNull(clientsTable.deletedAt))).limit(200);
    const found = match.find((_m: { id: string }) => true); // simplified
    return found?.id ?? null;
  };

  for (let i = 0; i < f.rows.length; i++) {
    const row = f.rows[i];
    if (row.every(c => !c.trim())) continue;
    const o = applyMapping(row, f.headers, mapping);
    if (!o.firstName || !o.lastName) { r.errors.push({ row: i + 2, message: "Prénom/Nom manquant" }); r.skipped++; continue; }
    try {
      const clientId = o.clientName ? await getClientId(o.clientName) : null;
      if (!clientId) { r.errors.push({ row: i + 2, message: "Client introuvable" }); r.skipped++; continue; }
      const [rec] = await db.insert(clientContactsTable).values({
        id: randomUUID(), organizationId: orgId,
        clientId,
        firstName: o.firstName,
        lastName: o.lastName,
        email: o.email || null,
        phone: o.phone || null,
        role: o.role || null,
      }).returning({ id: clientContactsTable.id });
      r.ids.push(rec.id);
      r.imported++;
    } catch (e) {
      r.errors.push({ row: i + 2, message: `Erreur : ${(e as Error).message}` });
      r.skipped++;
    }
  }
  return r;
}

// ── Collaborators ─────────────────────────────────────────────────────────────

async function importCollaborators(f: ParsedFile, mapping: Record<string, string>, orgId: string, db: AnyDB, r: ImportResult): Promise<ImportResult> {
  for (let i = 0; i < f.rows.length; i++) {
    const row = f.rows[i];
    if (row.every(c => !c.trim())) continue;
    const o = applyMapping(row, f.headers, mapping);
    if (!o.firstName || !o.lastName) { r.errors.push({ row: i + 2, message: "Prénom/Nom manquant" }); r.skipped++; continue; }
    try {
      const [rec] = await db.insert(collaboratorsTable).values({
        id: randomUUID(), organizationId: orgId,
        firstName: o.firstName,
        lastName: o.lastName,
        email: o.email || null,
        phone: o.phone || null,
        position: o.position || null,
        department: o.department || null,
        hireDate: parseDate(o.hireDate ?? "") ?? null,
        baseSalary: num(o.baseSalary),
        nationalId: o.nationalId || null,
        birthDate: parseDate(o.birthDate ?? "") ?? null,
        employeeNumber: o.employeeNumber || null,
      }).returning({ id: collaboratorsTable.id });
      r.ids.push(rec.id);
      r.imported++;
    } catch (e) {
      r.errors.push({ row: i + 2, message: `Erreur : ${(e as Error).message}` });
      r.skipped++;
    }
  }
  return r;
}

// ── Invoices ─────────────────────────────────────────────────────────────────

async function importInvoices(f: ParsedFile, mapping: Record<string, string>, orgId: string, db: AnyDB, r: ImportResult): Promise<ImportResult> {
  const clientsByName = new Map<string, string>();
  const allClients = await db.select({ id: clientsTable.id, name: clientsTable.name })
    .from(clientsTable).where(eq(clientsTable.organizationId, orgId));
  for (const c of allClients) clientsByName.set(c.name.toLowerCase().trim(), c.id);

  for (let i = 0; i < f.rows.length; i++) {
    const row = f.rows[i];
    if (row.every(c => !c.trim())) continue;
    const o = applyMapping(row, f.headers, mapping);
    if (!o.referenceNumber || !o.totalAmount) { r.errors.push({ row: i + 2, message: "N° facture ou montant manquant" }); r.skipped++; continue; }

    const clientId = o.clientName ? (clientsByName.get(o.clientName.toLowerCase().trim()) ?? null) : null;
    try {
      const [rec] = await db.insert(invoicesTable).values({
        id: randomUUID(), organizationId: orgId,
        referenceNumber: o.referenceNumber,
        clientId,
        totalAmount: num(o.totalAmount),
        paidAmount: num(o.paidAmount) ?? "0",
        dueDate: parseDate(o.dueDate ?? "") ?? null,
        issuedAt: parseDate(o.issuedAt ?? "") ?? null,
        status: (["draft","pending","partially_paid","paid","overdue","cancelled"].includes(o.status ?? "") ? o.status : "pending") as string,
        notes: o.notes || null,
        currency: "XOF",
      }).returning({ id: invoicesTable.id });
      r.ids.push(rec.id);
      r.imported++;
    } catch (e) {
      r.errors.push({ row: i + 2, message: `Erreur : ${(e as Error).message}` });
      r.skipped++;
    }
  }
  return r;
}

// ── Payments ─────────────────────────────────────────────────────────────────

async function importPayments(f: ParsedFile, mapping: Record<string, string>, orgId: string, db: AnyDB, r: ImportResult): Promise<ImportResult> {
  const invoicesByRef = new Map<string, string>();
  const allInv = await db.select({ id: invoicesTable.id, ref: invoicesTable.referenceNumber })
    .from(invoicesTable).where(eq(invoicesTable.organizationId, orgId));
  for (const inv of allInv) invoicesByRef.set(inv.ref.toLowerCase().trim(), inv.id);

  for (let i = 0; i < f.rows.length; i++) {
    const row = f.rows[i];
    if (row.every(c => !c.trim())) continue;
    const o = applyMapping(row, f.headers, mapping);
    if (!o.amount) { r.errors.push({ row: i + 2, message: "Montant manquant" }); r.skipped++; continue; }

    const invoiceId = o.invoiceReference ? (invoicesByRef.get(o.invoiceReference.toLowerCase().trim()) ?? null) : null;
    if (!invoiceId) { r.errors.push({ row: i + 2, message: `Facture introuvable : "${o.invoiceReference ?? ""}"` }); r.skipped++; continue; }

    const paidAtDate = parseDate(o.paymentDate ?? "");
    try {
      const [rec] = await db.insert(paymentsTable).values({
        id: randomUUID(), organizationId: orgId,
        invoiceId,
        amount: num(o.amount) ?? "0",
        paidAt: paidAtDate ? new Date(paidAtDate) : new Date(),
        method: o.method || "virement",
        reference: o.reference || null,
        notes: o.notes || null,
        currency: "XOF",
      }).returning({ id: paymentsTable.id });
      r.ids.push(rec.id);
      r.imported++;
    } catch (e) {
      r.errors.push({ row: i + 2, message: `Erreur : ${(e as Error).message}` });
      r.skipped++;
    }
  }
  return r;
}

// ── Chart of Accounts ─────────────────────────────────────────────────────────

async function importChartOfAccounts(f: ParsedFile, mapping: Record<string, string>, orgId: string, db: AnyDB, r: ImportResult): Promise<ImportResult> {
  for (let i = 0; i < f.rows.length; i++) {
    const row = f.rows[i];
    if (row.every(c => !c.trim())) continue;
    const o = applyMapping(row, f.headers, mapping);
    if (!o.code || !o.label) { r.errors.push({ row: i + 2, message: "Code ou libellé manquant" }); r.skipped++; continue; }

    const classNum = o.classNum ? parseInt(o.classNum) : parseInt(o.code.charAt(0));
    const type = o.type || (classNum <= 5 ? (classNum <= 3 ? "asset" : classNum === 4 ? "asset" : "liability") : classNum === 6 ? "expense" : "revenue");
    const normalBalance = o.normalBalance || (["asset","expense"].includes(type) ? "debit" : "credit");

    try {
      await db.insert(chartOfAccountsTable).values({
        id: randomUUID(), organizationId: orgId,
        code: o.code,
        label: o.label,
        classNum,
        type,
        normalBalance,
      }).onConflictDoNothing();
      r.imported++;
      r.ids.push(o.code);
    } catch (e) {
      r.errors.push({ row: i + 2, message: `Erreur : ${(e as Error).message}` });
      r.skipped++;
    }
  }
  return r;
}

// ── Projects ─────────────────────────────────────────────────────────────────

async function importProjects(f: ParsedFile, mapping: Record<string, string>, orgId: string, db: AnyDB, r: ImportResult): Promise<ImportResult> {
  const clientsByName = new Map<string, string>();
  const allClients = await db.select({ id: clientsTable.id, name: clientsTable.name })
    .from(clientsTable).where(and(eq(clientsTable.organizationId, orgId), isNull(clientsTable.deletedAt)));
  for (const c of allClients) clientsByName.set(c.name.toLowerCase().trim(), c.id);

  for (let i = 0; i < f.rows.length; i++) {
    const row = f.rows[i];
    if (row.every(c => !c.trim())) continue;
    const o = applyMapping(row, f.headers, mapping);
    if (!o.name) { r.errors.push({ row: i + 2, message: "Nom du projet manquant" }); r.skipped++; continue; }

    const clientId = o.clientName ? (clientsByName.get(o.clientName.toLowerCase().trim()) ?? null) : null;
    try {
      const [rec] = await db.insert(projectsTable).values({
        id: randomUUID(), organizationId: orgId,
        name: o.name,
        status: (["planning","active","on_hold","completed","cancelled"].includes(o.status ?? "") ? o.status : "planning") as string,
        clientId,
        budget: num(o.budget),
        startDate: parseDate(o.startDate ?? "") ?? null,
        endDate: parseDate(o.endDate ?? "") ?? null,
        description: o.description || null,
      }).returning({ id: projectsTable.id });
      r.ids.push(rec.id);
      r.imported++;
    } catch (e) {
      r.errors.push({ row: i + 2, message: `Erreur : ${(e as Error).message}` });
      r.skipped++;
    }
  }
  return r;
}

// ── Suppliers ─────────────────────────────────────────────────────────────────

async function importSuppliers(f: ParsedFile, mapping: Record<string, string>, orgId: string, db: AnyDB, r: ImportResult): Promise<ImportResult> {
  for (let i = 0; i < f.rows.length; i++) {
    const row = f.rows[i];
    if (row.every(c => !c.trim())) continue;
    const o = applyMapping(row, f.headers, mapping);
    if (!o.code || !o.name) { r.errors.push({ row: i + 2, message: "Code et nom fournisseur obligatoires" }); r.skipped++; continue; }
    try {
      const [rec] = await db.insert(suppliersTable).values({
        id: randomUUID(), organizationId: orgId,
        code: o.code,
        name: o.name,
        email: o.email || null,
        phone: o.phone || null,
        address: o.address || null,
        taxId: o.taxId || null,
        paymentTerms: o.paymentTerms || null,
        isActive: true,
      }).onConflictDoNothing().returning({ id: suppliersTable.id });
      if (rec) { r.ids.push(rec.id); r.imported++; }
      else { r.errors.push({ row: i + 2, message: `Code déjà existant : "${o.code}"` }); r.skipped++; }
    } catch (e) {
      r.errors.push({ row: i + 2, message: `Erreur : ${(e as Error).message}` });
      r.skipped++;
    }
  }
  return r;
}

// ── Departments ───────────────────────────────────────────────────────────────

async function importDepartments(f: ParsedFile, mapping: Record<string, string>, orgId: string, db: AnyDB, r: ImportResult): Promise<ImportResult> {
  for (let i = 0; i < f.rows.length; i++) {
    const row = f.rows[i];
    if (row.every(c => !c.trim())) continue;
    const o = applyMapping(row, f.headers, mapping);
    if (!o.code || !o.name) { r.errors.push({ row: i + 2, message: "Code et nom du département obligatoires" }); r.skipped++; continue; }
    try {
      const [rec] = await db.insert(departmentsTable).values({
        id: randomUUID(), organizationId: orgId,
        code: o.code.toUpperCase().trim(),
        name: o.name.trim(),
        description: o.description || null,
        color: o.color || null,
      }).onConflictDoNothing().returning({ id: departmentsTable.id });
      if (rec) { r.ids.push(rec.id); r.imported++; }
      else { r.errors.push({ row: i + 2, message: `Code département déjà existant : "${o.code}"` }); r.skipped++; }
    } catch (e) {
      r.errors.push({ row: i + 2, message: `Erreur : ${(e as Error).message}` });
      r.skipped++;
    }
  }
  return r;
}

// ── Services / Produits ───────────────────────────────────────────────────────

async function importServices(f: ParsedFile, mapping: Record<string, string>, orgId: string, db: AnyDB, r: ImportResult): Promise<ImportResult> {
  for (let i = 0; i < f.rows.length; i++) {
    const row = f.rows[i];
    if (row.every(c => !c.trim())) continue;
    const o = applyMapping(row, f.headers, mapping);
    if (!o.code || !o.name) { r.errors.push({ row: i + 2, message: "Code et nom obligatoires" }); r.skipped++; continue; }
    try {
      const [rec] = await db.insert(servicesTable).values({
        id: randomUUID(), organizationId: orgId,
        code: o.code.trim(),
        name: o.name.trim(),
        category: o.category || null,
        unit: o.unit || "forfait",
        unitPrice: num(o.unitPrice) ?? "0",
        description: o.description || null,
        isActive: true,
      }).onConflictDoNothing().returning({ id: servicesTable.id });
      if (rec) { r.ids.push(rec.id); r.imported++; }
      else { r.errors.push({ row: i + 2, message: `Code service déjà existant : "${o.code}"` }); r.skipped++; }
    } catch (e) {
      r.errors.push({ row: i + 2, message: `Erreur : ${(e as Error).message}` });
      r.skipped++;
    }
  }
  return r;
}

// ── Users ──────────────────────────────────────────────────────────────────────

async function importUsers(f: ParsedFile, mapping: Record<string, string>, orgId: string, db: AnyDB, r: ImportResult): Promise<ImportResult> {
  const validRoles = ["admin", "manager", "commercial", "collaborator", "comptable"];
  for (let i = 0; i < f.rows.length; i++) {
    const row = f.rows[i];
    if (row.every(c => !c.trim())) continue;
    const o = applyMapping(row, f.headers, mapping);
    if (!o.email || !o.firstName || !o.lastName) {
      r.errors.push({ row: i + 2, message: "Email, prénom et nom obligatoires" }); r.skipped++; continue;
    }
    try {
      const tempPassword = `Gameasu@${Math.random().toString(36).slice(2, 8)}`;
      const hashedPwd = bcryptjs.hashSync(tempPassword, 10);
      const [rec] = await db.insert(usersTable).values({
        id: randomUUID(), organizationId: orgId,
        email: o.email.toLowerCase().trim(),
        password: hashedPwd,
        firstName: o.firstName.trim(),
        lastName: o.lastName.trim(),
        role: validRoles.includes(o.role ?? "") ? (o.role as string) : "collaborator",
        phone: o.phone || null,
        mustChangePassword: true,
        isActive: true,
      }).onConflictDoNothing().returning({ id: usersTable.id });
      if (rec) { r.ids.push(rec.id); r.imported++; }
      else { r.errors.push({ row: i + 2, message: `Email déjà existant : "${o.email}"` }); r.skipped++; }
    } catch (e) {
      r.errors.push({ row: i + 2, message: `Erreur : ${(e as Error).message}` });
      r.skipped++;
    }
  }
  return r;
}

// ── Equipment ─────────────────────────────────────────────────────────────────

async function importEquipment(f: ParsedFile, mapping: Record<string, string>, orgId: string, db: AnyDB, r: ImportResult): Promise<ImportResult> {
  for (let i = 0; i < f.rows.length; i++) {
    const row = f.rows[i];
    if (row.every(c => !c.trim())) continue;
    const o = applyMapping(row, f.headers, mapping);
    if (!o.name) { r.errors.push({ row: i + 2, message: "Nom de l'équipement manquant" }); r.skipped++; continue; }
    try {
      const [rec] = await db.insert(equipmentTable).values({
        id: randomUUID(), organizationId: orgId,
        name: o.name,
        code: o.code || null,
        description: o.description || null,
        status: (["available","in_use","maintenance","retired"].includes(o.status ?? "") ? o.status : "available") as string,
        dailyRate: num(o.dailyRate),
        location: o.location || null,
      }).returning({ id: equipmentTable.id });
      r.ids.push(rec.id);
      r.imported++;
    } catch (e) {
      r.errors.push({ row: i + 2, message: `Erreur : ${(e as Error).message}` });
      r.skipped++;
    }
  }
  return r;
}

// ── Cost Centers ──────────────────────────────────────────────────────────────

async function importCostCenters(f: ParsedFile, mapping: Record<string, string>, orgId: string, db: AnyDB, r: ImportResult): Promise<ImportResult> {
  const VALID_TYPES = ["department","project","activity","service","geographic","product_line"];
  for (let i = 0; i < f.rows.length; i++) {
    const row = f.rows[i];
    if (row.every(c => !c.trim())) continue;
    const o = applyMapping(row, f.headers, mapping);
    if (!o.code || !o.name) { r.errors.push({ row: i + 2, message: "Code et nom du centre analytique obligatoires" }); r.skipped++; continue; }
    try {
      const [rec] = await db.insert(costCentersTable).values({
        id: randomUUID(), organizationId: orgId,
        code: o.code.toUpperCase().trim(),
        name: o.name.trim(),
        type: VALID_TYPES.includes(o.type ?? "") ? (o.type as string) : "department",
        description: o.description || null,
        budgetAmount: num(o.budgetAmount),
        color: o.color || null,
        isActive: true,
      }).onConflictDoNothing().returning({ id: costCentersTable.id });
      if (rec) { r.ids.push(rec.id); r.imported++; }
      else { r.errors.push({ row: i + 2, message: `Code déjà existant : "${o.code}"` }); r.skipped++; }
    } catch (e) {
      r.errors.push({ row: i + 2, message: `Erreur : ${(e as Error).message}` });
      r.skipped++;
    }
  }
  return r;
}

// ── Bank Accounts ─────────────────────────────────────────────────────────────

async function importBankAccounts(f: ParsedFile, mapping: Record<string, string>, orgId: string, db: AnyDB, r: ImportResult): Promise<ImportResult> {
  // Pre-load COA codes → ids for this org
  const coaRows = await db.select({ id: chartOfAccountsTable.id, code: chartOfAccountsTable.code })
    .from(chartOfAccountsTable).where(eq(chartOfAccountsTable.organizationId, orgId));
  const coaByCode = new Map<string, string>(coaRows.map(c => [c.code.trim(), c.id]));

  for (let i = 0; i < f.rows.length; i++) {
    const row = f.rows[i];
    if (row.every(c => !c.trim())) continue;
    const o = applyMapping(row, f.headers, mapping);
    if (!o.name || !o.accountCode) { r.errors.push({ row: i + 2, message: "Nom et code compte (521/571) obligatoires" }); r.skipped++; continue; }

    const accountId = coaByCode.get(o.accountCode.trim());
    if (!accountId) { r.errors.push({ row: i + 2, message: `Compte introuvable dans le plan comptable : "${o.accountCode}"` }); r.skipped++; continue; }

    const type = o.type === "cash" ? "cash" : "bank";
    try {
      const [rec] = await db.insert(bankAccountsTable).values({
        id: randomUUID(), organizationId: orgId,
        name: o.name.trim(),
        type,
        accountId,
        bankName: o.bankName || null,
        accountNumber: o.accountNumber || null,
        iban: o.iban || null,
        openingBalance: num(o.openingBalance) ?? "0",
        currency: "XOF",
        isActive: true,
      }).returning({ id: bankAccountsTable.id });
      r.ids.push(rec.id); r.imported++;
    } catch (e) {
      r.errors.push({ row: i + 2, message: `Erreur : ${(e as Error).message}` });
      r.skipped++;
    }
  }
  return r;
}

// ── Opening Balance ───────────────────────────────────────────────────────────

async function importOpeningBalance(f: ParsedFile, mapping: Record<string, string>, orgId: string, db: AnyDB, r: ImportResult): Promise<ImportResult> {
  // Look up or fail: need a journal of type "misc" or code "AN"
  const journals = await db.select({ id: journalsTable.id, code: journalsTable.code })
    .from(journalsTable)
    .where(and(eq(journalsTable.organizationId, orgId), eq(journalsTable.isActive, true)));
  const journal = journals.find(j => j.code === "AN") ?? journals.find(j => j.code === "OD") ?? journals[0];
  if (!journal) {
    r.errors.push({ row: 0, message: "Aucun journal actif trouvé. Créez au moins un journal dans la comptabilité avant d'importer la balance." });
    return r;
  }

  const periods = await db.select({ id: fiscalPeriodsTable.id, status: fiscalPeriodsTable.status })
    .from(fiscalPeriodsTable).where(eq(fiscalPeriodsTable.organizationId, orgId));
  const period = periods.find(p => p.status === "open") ?? periods.find(p => p.status === "closed") ?? periods[0];
  if (!period) {
    r.errors.push({ row: 0, message: "Aucune période fiscale trouvée. Créez d'abord une période fiscale dans la comptabilité." });
    return r;
  }

  // COA map
  const coaRows = await db.select({ id: chartOfAccountsTable.id, code: chartOfAccountsTable.code })
    .from(chartOfAccountsTable).where(eq(chartOfAccountsTable.organizationId, orgId));
  const coaByCode = new Map<string, string>(coaRows.map(c => [c.code.trim(), c.id]));

  // Filter valid rows first
  const validRows: Array<{ accountId: string; debit: string; credit: string; description: string | null }> = [];
  for (let i = 0; i < f.rows.length; i++) {
    const row = f.rows[i];
    if (row.every(c => !c.trim())) continue;
    const o = applyMapping(row, f.headers, mapping);
    if (!o.accountCode) { r.errors.push({ row: i + 2, message: "Code compte manquant" }); r.skipped++; continue; }
    const accountId = coaByCode.get(o.accountCode.trim());
    if (!accountId) { r.errors.push({ row: i + 2, message: `Compte introuvable : "${o.accountCode}"` }); r.skipped++; continue; }
    validRows.push({ accountId, debit: num(o.debit) ?? "0", credit: num(o.credit) ?? "0", description: o.description || null });
  }
  if (validRows.length === 0) return r;

  const totalDebit = validRows.reduce((s, l) => s + parseFloat(l.debit), 0);
  const totalCredit = validRows.reduce((s, l) => s + parseFloat(l.credit), 0);
  const entryNumber = `AN-IMP-${Date.now().toString(36).toUpperCase()}`;
  const today = new Date().toISOString().slice(0, 10);

  try {
    const [entry] = await db.insert(journalEntriesTable).values({
      id: randomUUID(), organizationId: orgId,
      journalId: journal.id,
      fiscalPeriodId: period.id,
      entryNumber,
      entryDate: today,
      description: "Balance d'ouverture importée",
      status: "posted",
      totalDebit: String(totalDebit),
      totalCredit: String(totalCredit),
      sourceType: "opening",
    }).returning({ id: journalEntriesTable.id });

    for (let pos = 0; pos < validRows.length; pos++) {
      const vr = validRows[pos];
      await db.insert(journalEntryLinesTable).values({
        id: randomUUID(), organizationId: orgId,
        entryId: entry.id,
        accountId: vr.accountId,
        debit: vr.debit,
        credit: vr.credit,
        description: vr.description,
        position: pos,
      });
      r.ids.push(entry.id);
      r.imported++;
    }
  } catch (e) {
    r.errors.push({ row: 0, message: `Erreur création écriture : ${(e as Error).message}` });
    r.skipped += validRows.length;
  }
  return r;
}

// ── Stock Initial ─────────────────────────────────────────────────────────────

async function importStockInitial(f: ParsedFile, mapping: Record<string, string>, orgId: string, db: AnyDB, r: ImportResult): Promise<ImportResult> {
  // Pre-load products by SKU
  const products = await db.select({ id: productsTable.id, sku: productsTable.sku })
    .from(productsTable).where(and(eq(productsTable.organizationId, orgId), isNull(productsTable.deletedAt)));
  const bySku = new Map<string, string>(products.map(p => [p.sku.toLowerCase().trim(), p.id]));

  const today = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < f.rows.length; i++) {
    const row = f.rows[i];
    if (row.every(c => !c.trim())) continue;
    const o = applyMapping(row, f.headers, mapping);
    if (!o.sku || !o.quantity) { r.errors.push({ row: i + 2, message: "Code article (SKU) et quantité obligatoires" }); r.skipped++; continue; }

    const productId = bySku.get(o.sku.toLowerCase().trim());
    if (!productId) { r.errors.push({ row: i + 2, message: `Article introuvable avec le SKU : "${o.sku}". Importez d'abord vos articles.` }); r.skipped++; continue; }

    const qty = parseFloat(o.quantity.replace(",", "."));
    if (isNaN(qty) || qty <= 0) { r.errors.push({ row: i + 2, message: `Quantité invalide : "${o.quantity}"` }); r.skipped++; continue; }

    const occurredAt = o.date ? new Date(parseDate(o.date) ?? today) : new Date();
    try {
      const [rec] = await db.insert(stockMovementsTable).values({
        id: randomUUID(), organizationId: orgId,
        productId,
        kind: "in",
        quantity: String(qty),
        unitCostFcfa: num(o.unitCost),
        referenceType: "initial",
        referenceLabel: "Stock initial importé",
        reason: o.reason || "Inventaire initial",
        occurredAt,
      }).returning({ id: stockMovementsTable.id });
      r.ids.push(rec.id); r.imported++;
    } catch (e) {
      r.errors.push({ row: i + 2, message: `Erreur : ${(e as Error).message}` });
      r.skipped++;
    }
  }
  return r;
}

// ── Leave Balances ────────────────────────────────────────────────────────────

async function importLeaveBalances(f: ParsedFile, mapping: Record<string, string>, orgId: string, db: AnyDB, r: ImportResult): Promise<ImportResult> {
  const VALID_TYPES = ["congé_payé","RTT","maladie","maternité","paternité","sans_solde","formation","exceptionnel","autre"];

  // Pre-load collaborators — join via user email
  const collabs = await db.select({ id: collaboratorsTable.id, userId: collaboratorsTable.userId })
    .from(collaboratorsTable).where(and(eq(collaboratorsTable.organizationId, orgId), isNull(collaboratorsTable.deletedAt)));
  const userIds = collabs.map(c => c.userId).filter(Boolean) as string[];

  const emailMap = new Map<string, string>(); // email → collaboratorId
  if (userIds.length > 0) {
    const users = await db.select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.organizationId, orgId));
    const userById = new Map(users.map(u => [u.id, u.email.toLowerCase()]));
    for (const c of collabs) {
      if (c.userId) {
        const email = userById.get(c.userId);
        if (email) emailMap.set(email, c.id);
      }
    }
  }

  for (let i = 0; i < f.rows.length; i++) {
    const row = f.rows[i];
    if (row.every(c => !c.trim())) continue;
    const o = applyMapping(row, f.headers, mapping);
    if (!o.collaboratorEmail || !o.leaveType || !o.year || !o.allocated) {
      r.errors.push({ row: i + 2, message: "Email, type, année et jours alloués obligatoires" }); r.skipped++; continue;
    }

    const collaboratorId = emailMap.get(o.collaboratorEmail.toLowerCase().trim());
    if (!collaboratorId) { r.errors.push({ row: i + 2, message: `Collaborateur introuvable : "${o.collaboratorEmail}"` }); r.skipped++; continue; }

    const leaveType = VALID_TYPES.includes(o.leaveType) ? o.leaveType : "congé_payé";
    const year = parseInt(o.year);
    if (isNaN(year)) { r.errors.push({ row: i + 2, message: `Année invalide : "${o.year}"` }); r.skipped++; continue; }

    try {
      const [rec] = await db.insert(leaveBalancesTable).values({
        id: randomUUID(), organizationId: orgId,
        collaboratorId,
        year,
        leaveType,
        allocated: num(o.allocated) ?? "0",
        used: num(o.used) ?? "0",
        carried: num(o.carried) ?? "0",
      }).onConflictDoNothing().returning({ id: leaveBalancesTable.id });
      if (rec) { r.ids.push(rec.id); r.imported++; }
      else { r.errors.push({ row: i + 2, message: `Solde déjà existant pour ${o.collaboratorEmail} / ${leaveType} / ${year}` }); r.skipped++; }
    } catch (e) {
      r.errors.push({ row: i + 2, message: `Erreur : ${(e as Error).message}` });
      r.skipped++;
    }
  }
  return r;
}

// ── Budgets ───────────────────────────────────────────────────────────────────

async function importBudgets(f: ParsedFile, mapping: Record<string, string>, orgId: string, db: AnyDB, r: ImportResult): Promise<ImportResult> {
  // COA map
  const coaRows = await db.select({ id: chartOfAccountsTable.id, code: chartOfAccountsTable.code })
    .from(chartOfAccountsTable).where(eq(chartOfAccountsTable.organizationId, orgId));
  const coaByCode = new Map<string, string>(coaRows.map(c => [c.code.trim(), c.id]));

  // Fiscal periods map: year → id (prefer open period)
  const allPeriods = await db.select({ id: fiscalPeriodsTable.id, startDate: fiscalPeriodsTable.startDate, status: fiscalPeriodsTable.status })
    .from(fiscalPeriodsTable).where(eq(fiscalPeriodsTable.organizationId, orgId));
  const periodByYear = new Map<number, string>();
  for (const p of allPeriods) {
    const y = parseInt(String(p.startDate).slice(0, 4));
    if (!periodByYear.has(y) || p.status === "open") periodByYear.set(y, p.id);
  }

  // Group rows by budget name
  const budgetGroups = new Map<string, Array<{ accountId: string; period: string; amount: string; notes: string | null; rowIdx: number }>>();

  for (let i = 0; i < f.rows.length; i++) {
    const row = f.rows[i];
    if (row.every(c => !c.trim())) continue;
    const o = applyMapping(row, f.headers, mapping);
    if (!o.budgetName || !o.accountCode || !o.period || !o.amount) {
      r.errors.push({ row: i + 2, message: "Nom budget, code compte, période et montant obligatoires" }); r.skipped++; continue;
    }

    const accountId = coaByCode.get(o.accountCode.trim());
    if (!accountId) { r.errors.push({ row: i + 2, message: `Compte introuvable : "${o.accountCode}"` }); r.skipped++; continue; }

    // Validate period format YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(o.period.trim())) {
      r.errors.push({ row: i + 2, message: `Format période invalide : "${o.period}" (attendu YYYY-MM ex: 2024-03)` }); r.skipped++; continue;
    }

    const name = o.budgetName.trim();
    if (!budgetGroups.has(name)) budgetGroups.set(name, []);
    budgetGroups.get(name)!.push({ accountId, period: o.period.trim(), amount: num(o.amount) ?? "0", notes: o.notes || null, rowIdx: i + 2 });
  }

  // Create one budget per group
  for (const [budgetName, lines] of budgetGroups.entries()) {
    // Derive fiscal year from first line's period
    const year = parseInt(lines[0].period.slice(0, 4));
    const fiscalPeriodId = periodByYear.get(year);
    if (!fiscalPeriodId) {
      for (const l of lines) r.errors.push({ row: l.rowIdx, message: `Période fiscale introuvable pour l'année ${year}` });
      r.skipped += lines.length; continue;
    }

    try {
      const [budget] = await db.insert(budgetsTable).values({
        id: randomUUID(), organizationId: orgId,
        name: budgetName,
        kind: "budget",
        fiscalPeriodId,
        scope: "company",
        status: "draft",
        versionNumber: 1,
      }).returning({ id: budgetsTable.id });

      for (const line of lines) {
        await db.insert(budgetLinesTable).values({
          id: randomUUID(), organizationId: orgId,
          budgetId: budget.id,
          accountId: line.accountId,
          period: line.period,
          amount: line.amount,
          notes: line.notes,
        }).onConflictDoNothing();
        r.ids.push(budget.id);
        r.imported++;
      }
    } catch (e) {
      for (const l of lines) r.errors.push({ row: l.rowIdx, message: `Erreur budget "${budgetName}" : ${(e as Error).message}` });
      r.skipped += lines.length;
    }
  }
  return r;
}
